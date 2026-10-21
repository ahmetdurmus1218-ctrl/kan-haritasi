/**
 * Uygulama verisi ↔ @kh/analysis köprüsü: kasadaki dosyayı ham görüntüye çevirir, analizi (mümkünse
 * Web Worker'da) çalıştırır; rapor bulgularını ve tahlil sonuçlarını analiz çekirdeğinin kaynaklı
 * tiplerine dönüştürür ve birleşik sağlık modelini kurar.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  GRAPH,
  brainPath,
  type HealthModel,
  type ImageAnalysisRun,
  type ImageContext,
  type Modality,
  type ModelManifest,
  type ModelExtras,
  type ModelRun,
  type RasGrid,
  type VolumeStructure,
  type LabObservation,
  type RasterImage,
  type ReportFinding,
  REPORTED,
  analyzeImage,
  buildHealthModel,
  score,
} from '@kh/analysis';
import { gradeResult } from '@kh/catalog';
import { type DicomInfo, type DicomVolume, canDecode, decodeFrame, parseDicom } from '@kh/ingest';
import type { Bytes, FileInfo } from '@kh/vault';
import { regionByKey } from './imaging';
import { volumeRun } from './volumeResults';
import { modelBytes } from './localModels/store';
import type { ImagingFinding } from './imagingFindings';
import type { StoredAnalysis } from './imagingRecords';
import type { ImagingStudy } from './imagingStudies';
import type { StoredReport } from './reports';
import { reportDate, useReports } from './useReports';
import { relatedStudies, useImagingStudies } from './imagingStudies';

const MAX_SIDE = 1024;

async function bitmapRaster(blob: Blob, orient: boolean): Promise<RasterImage> {
  const bitmap = await createImageBitmap(blob, orient ? { imageOrientation: 'from-image' } : undefined);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  const gray = new Float32Array(img.width * img.height);
  for (let p = 0; p < gray.length; p++) gray[p] = 0.299 * img.data[p * 4]! + 0.587 * img.data[p * 4 + 1]! + 0.114 * img.data[p * 4 + 2]!;
  return { width: img.width, height: img.height, gray, rgba: img.data };
}

/** Kasadaki dosyayı ham görüntüye çevirir (DICOM'da ortadaki kare). Desteklenmiyorsa null. */
export async function loadRaster(info: Pick<FileInfo, 'kind' | 'mimeType'>, bytes: Bytes): Promise<RasterImage | null> {
  if (info.kind === 'jpeg' || info.kind === 'png') return bitmapRaster(new Blob([bytes.slice()], { type: info.mimeType }), true);
  if (info.kind !== 'dicom') return null;
  const dicom = parseDicom(bytes);
  if (!canDecode(dicom) || dicom.samplesPerPixel !== 1) return null;
  const frame = decodeFrame(bytes, dicom, Math.floor((dicom.frames - 1) / 2));
  if (frame.kind === 'encoded') {
    const r = await bitmapRaster(new Blob([frame.data.slice()], { type: frame.mime }), false);
    return { width: r.width, height: r.height, gray: r.gray };
  }
  if (frame.kind !== 'gray') return null;
  return { width: frame.width, height: frame.height, gray: frame.data };
}

/**
 * Model girdisi: 8 bit görüntü bekleyen modeller (ör. TorchXRayVision) için DICOM ham değerleri
 * dosyadaki pencereyle (yoksa en küçük–en büyük) 0–255'e eşlenir; MONOCHROME1 tersine çevrilir.
 * Fotoğraflar zaten 0–255'tir ve olduğu gibi kalır.
 */
export function modelRaster(raster: RasterImage, dicom: DicomInfo | null): RasterImage {
  if (!dicom) return raster;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < raster.gray.length; i++) {
    const v = raster.gray[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const inBytes = min >= 0 && max <= 255 && dicom.photometric !== 'MONOCHROME1';
  if (inBytes) return raster;
  const lo = dicom.windowWidth ? (dicom.windowCenter ?? 0) - dicom.windowWidth / 2 : min;
  const hi = dicom.windowWidth ? (dicom.windowCenter ?? 0) + dicom.windowWidth / 2 : max;
  const k = 255 / Math.max(1e-6, hi - lo);
  const gray = new Float32Array(raster.gray.length);
  const inv = dicom.photometric === 'MONOCHROME1';
  for (let i = 0; i < gray.length; i++) {
    const v = Math.min(255, Math.max(0, (raster.gray[i]! - lo) * k));
    gray[i] = inv ? 255 - v : v;
  }
  return { width: raster.width, height: raster.height, gray };
}

export function contextFor(info: FileInfo, dicom: DicomInfo | null, files = 1): ImageContext {
  const region = info.region ? regionByKey.get(info.region) : undefined;
  return {
    fileName: info.displayName,
    declaredCategory: info.category,
    ...(region ? { declaredRegion: region.key, ...(region.structure ? { declaredStructure: region.structure } : {}) } : {}),
    ...(dicom
      ? {
          dicom: {
            modality: dicom.modality,
            bodyPart: dicom.bodyPart,
            pixelSpacing: dicom.pixelSpacing,
            sliceThickness: dicom.sliceThickness,
            ...(dicom.seriesDescription ? { seriesDescription: dicom.seriesDescription } : {}),
            ...(dicom.studyDescription ? { studyDescription: dicom.studyDescription } : {}),
            frames: dicom.frames,
          },
        }
      : {}),
    files,
  };
}

let worker: Worker | null | undefined;
let seq = 0;
export type VolumeJobProgress = { stage: 'loading' | 'resample' | 'inference' | 'merge'; done: number; total: number };
export type VolumeResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      grid: RasGrid;
      labels: Uint8Array;
      structures: VolumeStructure[];
      tiles: number;
      seconds: number;
      geometry: Omit<DicomVolume, 'data'>;
    };
type Progress = 'inference' | VolumeJobProgress;
type WorkerReply = { id: number; run?: ImageAnalysisRun; model?: ModelRun; extras?: ModelExtras; volume?: VolumeResult; progress?: Progress; needBytes?: boolean; error?: string };
const pending = new Map<number, { resolve: (r: WorkerReply) => void; reject: (e: Error) => void; onProgress?: (p: Progress) => void }>();
/** Bu işçide oturumu açılmış modeller (SHA-256): model baytları yalnızca ilk kullanımda gönderilir. */
let loadedModels = new Set<string>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      if (e.data.progress) {
        p.onProgress?.(e.data.progress);
        return;
      }
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data);
    };
    worker.onerror = () => resetWorker('worker failed');
  } catch {
    worker = null;
  }
  return worker;
}

function resetWorker(reason: string) {
  for (const p of pending.values()) p.reject(new Error(reason));
  pending.clear();
  worker?.terminate();
  worker = undefined;
  loadedModels = new Set();
}

function ask(w: Worker, msg: Record<string, unknown>, transfer: Transferable[] = [], onProgress?: (p: Progress) => void): Promise<WorkerReply> {
  const id = ++seq;
  return new Promise<WorkerReply>((resolve, reject) => {
    pending.set(id, { resolve, reject, ...(onProgress ? { onProgress } : {}) });
    w.postMessage({ ...msg, id }, transfer);
  });
}

/** Analizi Web Worker'da çalıştırır; worker yoksa ana iş parçacığında. */
export async function runImageAnalysis(image: RasterImage, context: ImageContext, reportAvailable: boolean): Promise<ImageAnalysisRun> {
  const w = getWorker();
  if (!w) return analyzeImage(image, context, { reportAvailable });
  try {
    // Pikseller kopyalanır (görüntüleyici aynı diziyi çizmeye devam eder).
    const r = await ask(w, { kind: 'analyze', image, context, reportAvailable });
    if (!r.run) throw new Error('no run');
    return r.run;
  } catch {
    return analyzeImage(image, context, { reportAvailable });
  }
}

export type ModelProgress = 'loading' | 'inference';

/**
 * Cihazda kurulu modeli bu görüntüde çalıştırır (işçide). Model dosyası ilk kullanımda okunur ve
 * işçiye bir kez aktarılır (lazy loading + önbellek). `signal` iptal edince işçi sonlandırılır.
 */
export async function runLocalModel(
  manifest: ModelManifest,
  image: RasterImage,
  modality: Modality,
  context: ImageContext,
  opts: { documentId?: string; signal?: AbortSignal; onProgress?: (p: ModelProgress) => void } = {},
): Promise<ModelRun & { extras?: ModelExtras }> {
  const w = getWorker();
  if (!w) return { status: 'unavailable', reason: 'Bu tarayıcıda arka plan işçisi (Web Worker) yok; model çalıştırılamadı.' };
  const abort = () => resetWorker('cancelled');
  opts.signal?.addEventListener('abort', abort, { once: true });
  try {
    const base = { kind: 'model', manifest, image, modality, context, ...(opts.documentId ? { documentId: opts.documentId } : {}) };
    const onP = (p: Progress) => p === 'inference' && opts.onProgress?.('inference');
    let r: WorkerReply;
    if (loadedModels.has(manifest.sha256)) r = await ask(w, base, [], onP);
    else r = { id: 0, needBytes: true };
    if (r.needBytes) {
      opts.onProgress?.('loading');
      const bytes = await modelBytes(manifest.id);
      if (!bytes) return { status: 'unavailable', reason: 'Model dosyası cihazda bulunamadı.' };
      const copy = bytes.slice(0);
      r = await ask(w, { ...base, bytes: copy }, [copy], onP);
      loadedModels.add(manifest.sha256);
    }
    return r.model ? { ...r.model, ...(r.extras ? { extras: r.extras } : {}) } : { status: 'unavailable', reason: 'Model sonuç döndürmedi.' };
  } catch (e) {
    loadedModels.delete(manifest.sha256);
    return { status: 'unavailable', reason: e instanceof Error && e.message === 'cancelled' ? 'İptal edildi.' : `Model çalıştırılamadı: ${e instanceof Error ? e.message : 'bilinmeyen hata'}` };
  } finally {
    opts.signal?.removeEventListener('abort', abort);
  }
}

/**
 * 3B hacim modelini bir DICOM serisinde çalıştırır (işçide, cihazda). Kesit baytları işçiye aktarılır;
 * model baytları yalnızca ilk kullanımda gönderilir. İptal işçiyi sonlandırır (bellek bırakılır).
 */
export async function runVolumeAnalysis(
  manifest: ModelManifest,
  files: Uint8Array[],
  opts: { signal?: AbortSignal; onProgress?: (p: VolumeJobProgress) => void; prior?: { labels: ModelManifest['labels']; grid: RasGrid; labelsRle: number[] } } = {},
): Promise<VolumeResult> {
  const w = getWorker();
  if (!w) return { ok: false, reason: 'Bu tarayıcıda arka plan işçisi (Web Worker) yok.' };
  const abort = () => resetWorker('cancelled');
  opts.signal?.addEventListener('abort', abort, { once: true });
  const onP = (p: Progress) => typeof p === 'object' && opts.onProgress?.(p);
  const copies = () => files.map((f) => f.slice().buffer as ArrayBuffer);
  try {
    let r: WorkerReply = { id: 0, needBytes: true };
    if (loadedModels.has(`vol:${manifest.sha256}`)) {
      const bufs = copies();
      r = await ask(w, { kind: 'volume', manifest, files: bufs, prior: opts.prior }, bufs, onP);
    }
    if (r.needBytes) {
      opts.onProgress?.({ stage: 'loading', done: 0, total: 1 });
      const bytes = await modelBytes(manifest.id);
      if (!bytes) return { ok: false, reason: 'Model dosyası cihazda bulunamadı.' };
      const bufs = copies();
      r = await ask(w, { kind: 'volume', manifest, files: bufs, bytes, prior: opts.prior }, [bytes, ...bufs], onP);
      loadedModels.add(`vol:${manifest.sha256}`);
    }
    return r.volume ?? { ok: false, reason: 'Model sonuç döndürmedi.' };
  } catch (e) {
    loadedModels.delete(`vol:${manifest.sha256}`);
    const msg = e instanceof Error ? e.message : 'bilinmeyen hata';
    return { ok: false, reason: msg === 'cancelled' ? 'İptal edildi.' : /memory|allocation|out of bounds/i.test(msg) ? 'Cihaz belleği bu model için yetmedi.' : `Model çalıştırılamadı: ${msg}` };
  } finally {
    opts.signal?.removeEventListener('abort', abort);
  }
}

export function toStoredAnalysis(run: ImageAnalysisRun, sourceId: string): StoredAnalysis {
  return {
    at: run.at,
    sourceId,
    modality: run.result.modality,
    modalitySource: run.modality?.primary.source ?? 'IMAGE_ANALYSIS',
    ...(run.anatomy?.structure ? { structure: run.anatomy.structure } : {}),
    status: run.result.status,
    adapterId: run.result.adapterId,
    model: { id: run.result.model.id, name: run.result.model.name, version: run.result.model.version },
    summary: run.result.summary,
    observations: run.result.observations.slice(0, 24),
    qualityIssues: run.quality.issues.map((i) => i.code),
    coverage: run.coverage,
    sequence: run.sequence,
    kind: run.kind,
    ...(run.modelFindings ? { modelFindings: run.modelFindings.slice(0, 32) } : {}),
    ...(run.modelStructures ? { modelStructures: run.modelStructures.slice(0, 40) } : {}),
    ...(run.modelInfo ? { modelInfo: run.modelInfo } : {}),
  };
}

/** Kayıtlı özetten (yeniden çalıştırmadan) birleşik modele girecek analiz. */
export function runFromStored(a: StoredAnalysis, reportAvailable: boolean): ImageAnalysisRun {
  return {
    id: `stored-${a.at}`,
    at: a.at,
    quality: { usable: true, score: 1, issues: [], metrics: { width: 0, height: 0, edgeWidth: 0, glareFraction: 0, contrast: null, median: null } },
    route: 'image-analysis',
    kind: a.kind ?? 'precheck',
    ...(a.modelFindings ? { modelFindings: a.modelFindings } : {}),
    ...(a.modelStructures ? { modelStructures: a.modelStructures } : {}),
    ...(a.modelInfo ? { modelInfo: a.modelInfo } : {}),
    coverage: a.coverage ?? { kind: 'photo', frames: 1, label: '1 görüntü' },
    sequence: a.sequence ?? { source: 'none', text: 'Sekans belirlenemedi.' },
    reportAvailable,
    statements: [],
    result: { adapterId: a.adapterId, modality: a.modality, status: a.status, model: { ...a.model, kind: 'heuristic', local: true }, capabilities: [], observations: a.observations, limitations: [], summary: a.summary },
  };
}

/* ------------------------------------------------------------------ rapor ve tahlil dönüşümleri */

export function reportFindingsFrom(findings: ImagingFinding[], meta: { date?: string; documentId?: string; ocr?: boolean } = {}): ReportFinding[] {
  return findings.map((f, i) => {
    const node = f.structure ? GRAPH.nodeForStructure(f.structure, f.part) : undefined;
    const side = f.side;
    const path = node ? (f.structure === 'brain' ? brainPath(node.id, side) : GRAPH.pathTo(node.id).map((n) => n.id)) : f.structure ? [f.structure] : [];
    return {
      id: `${meta.documentId ?? 'doc'}-${i}`,
      source: meta.ocr ? 'OCR' : 'RADIOLOGY_REPORT',
      text: f.text,
      status: f.status,
      negated: f.negated,
      ...(f.structure
        ? {
            location: {
              path,
              structure: f.structure,
              ...(f.part ? { part: f.part } : {}),
              ...(side ? { side } : {}),
              basis: f.located === 'text' ? ('report-text' as const) : ('region' as const),
              confidence: REPORTED,
            },
          }
        : {}),
      localization: f.where ? { kind: 'report-approximate', text: f.where } : f.structure ? { kind: 'region-only' } : { kind: 'none' },
      ...(f.severity ? { severity: f.severity } : {}),
      ...(f.temporal ? { temporal: f.temporal } : {}),
      recommendation: f.recommendation,
      ...(f.size ? { size: f.size } : {}),
      confidence: REPORTED,
      ...(meta.date ? { date: meta.date } : {}),
      ...(meta.documentId ? { documentId: meta.documentId } : {}),
    };
  });
}

export function labObservationsFrom(reports: StoredReport[]): LabObservation[] {
  return reports.flatMap((r) =>
    r.results.map((res) => ({
      testKey: res.testKey,
      name: res.rawName && res.rawName.length < 40 ? res.rawName : res.testKey,
      value: res.value,
      unit: res.unit,
      status: res.status,
      ...(res.refMin !== undefined ? { refMin: res.refMin } : {}),
      ...(res.refMax !== undefined ? { refMax: res.refMax } : {}),
      // Uygulamada aralık ya rapordan ya genel katalogdan gelir (öncelik: rapor > sistem).
      ...(res.refSource === 'report' ? { refSource: 'report' as const } : res.refSource === 'catalog' ? { refSource: 'system' as const } : {}),
      date: reportDate(r),
      source: 'LAB' as const,
      confidence: res.userEdited || res.verified ? REPORTED : score(res.confidence ?? 1, 'okuma (OCR/PDF) güveni'),
      ...gradeFields(res),
    })),
  );
}

/** Katalog yorum motorundan sapma derecesi ve kritik düzey. */
export function gradeFields(res: StoredReport['results'][number]): Pick<LabObservation, 'critical' | 'severity'> {
  const g = gradeResult({
    testKey: res.testKey,
    value: res.canonicalValue ?? res.value,
    canonical: res.canonicalValue !== null,
    unit: res.unit,
    refMin: res.refMin,
    refMax: res.refMax,
    status: res.status,
    qualifier: res.qualifier,
  });
  return g ? { critical: g.critical, severity: g.severity } : {};
}

const STUDY_MODALITY: Record<string, string> = { mr: 'MRI', ct: 'CT', xray: 'XRAY', us: 'ULTRASOUND', mammo: 'MAMMOGRAPHY', pet: 'PET_CT', ekg: 'ECG', pathology: 'PATHOLOGY', endoscopy: 'ENDOSCOPY' };

/** Tüm kasa verisinden birleşik sağlık modeli. */
export function healthModelFrom(reports: StoredReport[], studies: ImagingStudy[]): HealthModel {
  const images = studies.flatMap((st) => {
    const vol = st.note?.volume;
    const volumeInput = (vol ? [vol, ...(st.note?.pathology ?? [])] : []).map((v) => ({ run: volumeRun(v, st.findings.length > 0), date: st.date, documentId: st.head.id, studyKey: st.key, modality: STUDY_MODALITY[st.category] ?? st.category }));
    const a = st.note?.analysis;
    if (!a) return volumeInput;
    const structure = a.structure ?? (st.region ? regionByKey.get(st.region)?.structure : undefined);
    // Aynı çekimin raporu (kendi notu ya da bağlı rapor belgesi) uyum karşılaştırması için eşleştirilir.
    const reportStudy = st.findings.length ? st : relatedStudies(st, studies).find((r) => r.findings.length > 0);
    return [{ run: runFromStored(a, Boolean(reportStudy)), date: st.date, documentId: st.head.id, studyKey: reportStudy?.key ?? st.key, modality: STUDY_MODALITY[st.category] ?? st.category, ...(structure ? { structure } : {}) }, ...volumeInput.map((v) => ({ ...v, studyKey: reportStudy?.key ?? st.key }))];
  });
  const reps = studies
    .filter((st) => st.findings.length > 0)
    .map((st) => {
      const structure = st.region ? regionByKey.get(st.region)?.structure : undefined;
      return {
        findings: reportFindingsFrom(st.findings, { date: st.date, documentId: st.head.id, ocr: st.note?.method === 'ocr' }),
        date: st.date,
        documentId: st.head.id,
        studyKey: st.key,
        modality: STUDY_MODALITY[st.category] ?? st.category,
        ...(structure ? { structure } : {}),
      };
    });
  return buildHealthModel({ images, reports: reps, labs: labObservationsFrom(reports) });
}

/** Kasadaki tüm veriden birleşik model (kasa değişince yenilenir). */
export function useHealthModel(): { model: HealthModel | null; studies: ImagingStudy[] | null } {
  const { reports } = useReports();
  const studies = useImagingStudies();
  const model = useMemo(() => (reports && studies ? healthModelFrom(reports, studies) : null), [reports, studies]);
  return { model, studies };
}

/** Bir dosya için analiz durumunu döndüren küçük kanca (ImagingPanel için). */
/** Gerçek işlem aşaması: dosya okunuyor → görüntü analiz ediliyor → bitti. */
export type AnalysisStage = 'idle' | 'reading' | 'analyzing' | 'done' | 'unsupported' | 'error';

export function useImageAnalysis(info: FileInfo, bytes: Bytes, context: ImageContext, reportAvailable: boolean, enabled: boolean): { run: ImageAnalysisRun | null; raster: RasterImage | null; state: AnalysisStage } {
  const [out, setOut] = useState<{ run: ImageAnalysisRun | null; raster: RasterImage | null; state: AnalysisStage }>({ run: null, raster: null, state: 'idle' });
  const key = JSON.stringify(context);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setOut({ run: null, raster: null, state: 'reading' });
    const t = setTimeout(() => {
      loadRaster(info, bytes)
        .then(async (raster) => {
          if (cancelled) return;
          if (!raster) return setOut({ run: null, raster: null, state: 'unsupported' });
          setOut({ run: null, raster, state: 'analyzing' });
          const run = await runImageAnalysis(raster, context, reportAvailable);
          if (!cancelled) setOut({ run, raster, state: 'done' });
        })
        .catch(() => !cancelled && setOut({ run: null, raster: null, state: 'error' }));
    }, 40);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // context nesnesi her çizimde yenilenir; içeriği (key) izlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.id, bytes, key, reportAvailable, enabled]);
  return out;
}
