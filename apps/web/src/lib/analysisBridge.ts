/**
 * Uygulama verisi ↔ @kh/analysis köprüsü: kasadaki dosyayı ham görüntüye çevirir, analizi (mümkünse
 * Web Worker'da) çalıştırır; rapor bulgularını ve tahlil sonuçlarını analiz çekirdeğinin kaynaklı
 * tiplerine dönüştürür ve birleşik sağlık modelini kurar.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  GRAPH,
  type HealthModel,
  type ImageAnalysisRun,
  type ImageContext,
  type LabObservation,
  type RasterImage,
  type ReportFinding,
  REPORTED,
  analyzeImage,
  buildHealthModel,
  score,
} from '@kh/analysis';
import { gradeResult } from '@kh/catalog';
import { type DicomInfo, canDecode, decodeFrame, parseDicom } from '@kh/ingest';
import type { Bytes, FileInfo } from '@kh/vault';
import { regionByKey } from './imaging';
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

export function contextFor(info: FileInfo, dicom: DicomInfo | null): ImageContext {
  const region = info.region ? regionByKey.get(info.region) : undefined;
  return {
    fileName: info.displayName,
    declaredCategory: info.category,
    ...(region ? { declaredRegion: region.key, ...(region.structure ? { declaredStructure: region.structure } : {}) } : {}),
    ...(dicom ? { dicom: { modality: dicom.modality, bodyPart: dicom.bodyPart, pixelSpacing: dicom.pixelSpacing, sliceThickness: dicom.sliceThickness } } : {}),
  };
}

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, { resolve: (r: ImageAnalysisRun) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; run?: ImageAnalysisRun; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.run) p.resolve(e.data.run);
      else p.reject(new Error(e.data.error ?? 'analysis failed'));
    };
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error('worker failed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Analizi Web Worker'da çalıştırır; worker yoksa ana iş parçacığında. */
export async function runImageAnalysis(image: RasterImage, context: ImageContext, reportAvailable: boolean): Promise<ImageAnalysisRun> {
  const w = getWorker();
  if (!w) return analyzeImage(image, context, { reportAvailable });
  const id = ++seq;
  try {
    return await new Promise<ImageAnalysisRun>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      // Pikseller kopyalanır (görüntüleyici aynı diziyi çizmeye devam eder).
      w.postMessage({ id, image, context, reportAvailable });
    });
  } catch {
    return analyzeImage(image, context, { reportAvailable });
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
  };
}

/** Kayıtlı özetten (yeniden çalıştırmadan) birleşik modele girecek analiz. */
export function runFromStored(a: StoredAnalysis, reportAvailable: boolean): ImageAnalysisRun {
  return {
    id: `stored-${a.at}`,
    at: a.at,
    quality: { usable: true, score: 1, issues: [], metrics: { width: 0, height: 0, edgeWidth: 0, glareFraction: 0, contrast: null, median: null } },
    route: 'image-analysis',
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
    const sideNode = f.structure === 'brain' && (side === 'left' || side === 'right') ? `brain.hemisphere-${side}` : undefined;
    const path = node ? GRAPH.pathTo(node.id, sideNode).map((n) => n.id) : f.structure ? [f.structure] : [];
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
function gradeFields(res: StoredReport['results'][number]): Pick<LabObservation, 'critical' | 'severity'> {
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
    const a = st.note?.analysis;
    if (!a) return [];
    const structure = a.structure ?? (st.region ? regionByKey.get(st.region)?.structure : undefined);
    // Aynı çekimin raporu (kendi notu ya da bağlı rapor belgesi) uyum karşılaştırması için eşleştirilir.
    const reportStudy = st.findings.length ? st : relatedStudies(st, studies).find((r) => r.findings.length > 0);
    return [{ run: runFromStored(a, Boolean(reportStudy)), date: st.date, documentId: st.head.id, studyKey: reportStudy?.key ?? st.key, modality: STUDY_MODALITY[st.category] ?? st.category, ...(structure ? { structure } : {}) }];
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
