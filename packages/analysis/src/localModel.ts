/**
 * Cihaz içi (offline) tıbbi görüntü modeli altyapısı.
 *
 *   ImageSource → modalite → Preprocessor → LocalModelProvider → InferenceEngine (cihazda)
 *              → Postprocessor → bulgu (MedicalFinding) → konum (kutu / maske / nokta)
 *              → anatomi (bilgi grafiği) → fizyoloji (akışlar)
 *
 * Model dosyası (.onnx) ve manifest (JSON) kullanıcının cihazına yüklenir; HİÇBİR görüntü ve veri
 * cihaz dışına gönderilmez (uzak servis yok). Depoda gerçek bir tıbbi model ağırlığı YOKTUR: model
 * kurulmadıkça her şey "bu cihazda tıbbi AI modeli bulunmuyor" der ve hiçbir bulgu üretilmez.
 *
 * Bu dosya saf TypeScript'tir (tarayıcı/Node); çıkarım motorunu (ONNX Runtime Web) uygulama
 * `EngineFactory` olarak verir. Böylece ön/son işleme ve sağlayıcı mantığı motor olmadan test edilir.
 */
import { type ModelFinding, type MedicalImageAIProvider, type ProviderOutput, type StudyAnalysis, type StudyInput, UnavailableImageProvider } from './medicalAI';
import { GRAPH } from './knowledge';
import { type Modality, type ModelVersion, type RasterImage, score } from './types';
import type { VolumeSpec } from './volumeModel';

/* ------------------------------------------------------------------ Manifest */

export type ModelTask = 'detection' | 'segmentation' | 'classification' | 'multilabel' | 'segmentation-3d';

export interface ModelLabel {
  id: number;
  /** Modelin kendi sınıf anahtarı (ör. "liver", "Cardiomegaly"). */
  key?: string;
  /** Türkçe ad (bulgu ya da yapı adı). */
  finding: string;
  /** anatomy: normal yapı bölütlemesi (bulgu değil); finding: modelin bildirdiği bulgu. Varsayılan finding. */
  kind?: 'anatomy' | 'finding';
  /** 3B yapı (catalog) ya da bilgi grafiği düğümü. */
  structure?: string;
  /** 3B modeldeki bölüm (catalog PARTS). */
  part?: string;
  /** Bilgi grafiği düğümü (organ sayfası / fizyoloji). */
  node?: string;
  /** 3B bulgu sınıfı: bu hacmin (mL) altı bulgu olarak gösterilmez ("eşik altı" diye ayrıca yazılır). */
  minMl?: number;
  /** 3B bulgu sınıfı: bu hacme (mL) kadarı fizyolojik kabul edilir (Normal ↔ Sende karşılaştırması). */
  normalMaxMl?: number;
  /** Normal fizyolojinin kısa açıklaması (normalMaxMl ile birlikte). */
  normalNote?: string;
}

/** Bir yerel modelin kimlik kartı: ne yapar, hangi girdiyi bekler, çıktısı nasıl okunur, kaynağı ve lisansı. */
export interface ModelManifest {
  schema: 'kh-model-manifest/1' | 'kh-model-manifest/2';
  id: string;
  name: string;
  version: string;
  modalities: Modality[];
  task: ModelTask;
  format: 'onnx';
  /** Model dosyasının adı ve SHA-256 özeti (yüklemede doğrulanır). */
  file: string;
  sha256: string;
  license: string;
  source: string;
  intendedUse: string;
  input: {
    name: string;
    layout: 'NCHW' | 'NCDHW';
    channels: 1 | 3;
    width: number;
    height: number;
    /** piksel / scale, sonra (x - mean) / std */
    scale: number;
    mean: number[];
    std: number[];
    /** Önce merkezden kare kırp (TorchXRayVision XRayCenterCrop). */
    crop?: 'center-square';
    /** Küçültürken örtüşme önleyici Gauss süzgeci (skimage resize anti_aliasing). */
    antialias?: boolean;
  };
  output: {
    /** detection: [N,4] kutular (normalize), [N] skor, [N] etiket */
    boxes?: string;
    scores?: string;
    labels?: string;
    boxFormat?: 'xywh-normalized' | 'xyxy-normalized';
    /** segmentation: [1,C,H,W] olasılık/logit */
    mask?: string;
    /** classification: [1,C] logit */
    logits?: string;
    /** multilabel: [1,C] sigmoid olasılığı */
    probs?: string;
    /** segmentation-3d: [1,K,D,H,W] en yüksek K değer ve sınıf */
    topkValues?: string;
    topkIndices?: string;
  };
  /** 3B hacim modeli parametreleri (segmentation-3d). */
  volume?: VolumeSpec;
  /** multilabel: çalışma noktası normalizasyonu (TorchXRayVision op_norm). */
  calibration?: { kind: 'xrv-op-norm'; thresholds: number[] };
  labels: ModelLabel[];
  scoreThreshold: number;
  limitations: string[];
  /** Bilgi alanları (arayüzde gösterilir). */
  citation?: string;
  validation?: string;
  compatibleDevice?: string;
  size?: number;
  upstream?: { weights: string; weightsSha256: string };
}

const MODALITIES: ReadonlySet<string> = new Set(['MRI', 'CT', 'XRAY', 'ULTRASOUND', 'DOPPLER', 'MAMMOGRAPHY', 'PET', 'PET_CT', 'SPECT', 'FLUOROSCOPY', 'ECHOCARDIOGRAPHY', 'ENDOSCOPY', 'COLONOSCOPY', 'DERMOSCOPY', 'DENTAL', 'FUNDUS', 'PATHOLOGY', 'MICROSCOPY', 'ECG']);

/** Manifest doğrulama: eksik/yanlış alanlar açıkça listelenir; doğrulanmamış model yüklenmez. */
export function validateManifest(json: unknown): { ok: true; manifest: ModelManifest } | { ok: false; errors: string[] } {
  const e: string[] = [];
  const m = json as Partial<ModelManifest> | null;
  if (!m || typeof m !== 'object') return { ok: false, errors: ['Manifest bir JSON nesnesi değil.'] };
  const str = (k: keyof ModelManifest) => typeof m[k] === 'string' && (m[k] as string).trim().length > 0;
  if (m.schema !== 'kh-model-manifest/1' && m.schema !== 'kh-model-manifest/2') e.push('schema "kh-model-manifest/1" ya da "/2" olmalı.');
  for (const k of ['id', 'name', 'version', 'file', 'license', 'source', 'intendedUse'] as const) if (!str(k)) e.push(`${k} eksik.`);
  if (typeof m.id === 'string' && !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(m.id)) e.push('id yalnızca küçük harf, rakam, nokta, tire içermeli.');
  if (typeof m.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(m.sha256)) e.push('sha256 64 haneli onaltılık özet olmalı.');
  if (m.format !== 'onnx') e.push('format yalnızca "onnx" olabilir.');
  if (!Array.isArray(m.modalities) || !m.modalities.length || m.modalities.some((x) => !MODALITIES.has(x))) e.push('modalities geçerli modalite listesi olmalı (ör. ["MRI"]).');
  if (!['detection', 'segmentation', 'classification', 'multilabel', 'segmentation-3d'].includes(m.task as string)) e.push('task: detection | segmentation | classification | multilabel | segmentation-3d.');
  const i = m.input;
  if (!i || typeof i.name !== 'string' || i.layout !== (m.task === 'segmentation-3d' ? 'NCDHW' : 'NCHW') || (i.channels !== 1 && i.channels !== 3) || !(i.width > 0 && i.width <= 2048) || !(i.height > 0 && i.height <= 2048) || !(i.scale > 0) || !Array.isArray(i.mean) || !Array.isArray(i.std) || i.mean.length !== i.channels || i.std.length !== i.channels || i.std.some((x) => !(x > 0)))
    e.push('input: name, layout NCHW, channels 1|3, width/height (1–2048), scale > 0, kanal sayısı kadar mean/std (std > 0).');
  const o = m.output;
  if (!o || typeof o !== 'object') e.push('output eksik.');
  else if (m.task === 'detection' && !(o.boxes && o.scores && o.labels)) e.push('detection için output.boxes, output.scores, output.labels gerekli.');
  else if (m.task === 'segmentation' && !o.mask) e.push('segmentation için output.mask gerekli.');
  else if (m.task === 'classification' && !o.logits) e.push('classification için output.logits gerekli.');
  else if (m.task === 'multilabel' && !o.probs) e.push('multilabel için output.probs gerekli.');
  else if (m.task === 'segmentation-3d' && !(o.topkValues && o.topkIndices)) e.push('segmentation-3d için output.topkValues ve output.topkIndices gerekli.');
  if (m.task === 'segmentation-3d') {
    const v = m.volume;
    const okPatch = Array.isArray(v?.patch) && v.patch.length === 3 && v.patch.every((x) => Number.isInteger(x) && x > 0 && x <= 512);
    const okNorm = v?.normalization?.scheme === 'zscore' || (v?.normalization?.scheme === 'ct' && Array.isArray(v.normalization.clip) && v.normalization.std > 0);
    if (!v || !(v.spacing > 0) || !okPatch || v.axisOrder !== 'SAR' || !okNorm || !(v.tileStep > 0 && v.tileStep <= 1) || !(Number.isInteger(v.topK) && v.topK >= 1 && v.topK <= 16) || !(v.minSlices >= 1))
      e.push('volume: spacing > 0, patch [S,A,R], axisOrder "SAR", normalization (ct | zscore), tileStep (0–1], topK (1–16), minSlices gerekli.');
    const c = v?.cascade;
    if (c !== undefined && !(c && typeof c.model === 'string' && c.model && Array.isArray(c.labels) && c.labels.length && c.labels.every((x) => typeof x === 'string') && c.addonMm >= 0 && c.addonMm <= 200))
      e.push('volume.cascade: { model, labels: [yapı anahtarları], addonMm (0–200) }.');
    if (v?.dropLabels !== undefined && !(Array.isArray(v.dropLabels) && v.dropLabels.every((x) => Number.isInteger(x) && x > 0))) e.push('volume.dropLabels: pozitif tamsayı listesi.');
  }
  if (m.calibration && !(m.calibration.kind === 'xrv-op-norm' && Array.isArray(m.calibration.thresholds) && m.calibration.thresholds.length >= (m.labels?.length ?? 0)))
    e.push('calibration: { kind: "xrv-op-norm", thresholds: [etiket sayısı kadar] }.');
  if (Array.isArray(m.labels) && m.labels.some((l) => l && l.kind !== undefined && l.kind !== 'anatomy' && l.kind !== 'finding')) e.push('labels[].kind: anatomy | finding.');
  if (Array.isArray(m.labels) && m.labels.some((l) => l && ((l.minMl !== undefined && !(l.minMl >= 0)) || (l.normalMaxMl !== undefined && !(l.normalMaxMl > 0)))))
    e.push('labels[].minMl ≥ 0 ve normalMaxMl > 0 olmalı.');
  if (!Array.isArray(m.labels) || !m.labels.length || m.labels.some((l) => typeof l?.id !== 'number' || typeof l.finding !== 'string' || !l.finding.trim())) e.push('labels: en az bir {id, finding} gerekli.');
  if (typeof m.scoreThreshold !== 'number' || m.scoreThreshold < 0 || m.scoreThreshold > 1) e.push('scoreThreshold 0–1 arası olmalı.');
  if (!Array.isArray(m.limitations)) e.push('limitations bir liste olmalı (boş olabilir).');
  return e.length ? { ok: false, errors: e } : { ok: true, manifest: m as ModelManifest };
}

/* ------------------------------------------------------------------ Motor */

export interface Tensor {
  data: Float32Array | Int32Array | BigInt64Array | Uint8Array;
  dims: readonly number[];
}

/** Cihazda çalışan çıkarım motoru (uygulamada ONNX Runtime Web / WASM). */
export interface InferenceEngine {
  run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  dispose(): void;
}

export type EngineFactory = (modelBytes: Uint8Array, manifest: ModelManifest) => Promise<InferenceEngine>;

/* ------------------------------------------------------------------ Ön işleme */

/** scipy.ndimage.gaussian_filter1d (truncate 4, mode "constant", cval 0) — yerinde değil, yeni dizi. */
function blur1d(src: Float32Array<ArrayBuffer>, w: number, h: number, sigma: number, horizontal: boolean): Float32Array<ArrayBuffer> {
  if (!(sigma > 0)) return src;
  const r = Math.floor(4 * sigma + 0.5);
  const k: number[] = [];
  let sum = 0;
  for (let x = -r; x <= r; x++) {
    const v = Math.exp((-0.5 * x * x) / (sigma * sigma));
    k.push(v);
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i]! /= sum;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let t = -r; t <= r; t++) {
        const xx = horizontal ? x + t : x;
        const yy = horizontal ? y : y + t;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        acc += src[yy * w + xx]! * k[t + r]!;
      }
      out[y * w + x] = acc;
    }
  return out;
}

/**
 * Görüntüyü modelin girdisine çevirir: (isteğe bağlı) merkezden kare kırpma, normalizasyon, (isteğe bağlı)
 * örtüşme önleyici Gauss süzgeci ve çift doğrusal yeniden boyutlandırma. Normalizasyon önce yapılır
 * (TorchXRayVision: normalize → kırp → skimage.resize(order=1, anti_aliasing, mode="constant")).
 */
export function preprocess(image: RasterImage, manifest: ModelManifest): Tensor {
  const { width: W, height: H, channels: C, scale, mean, std, crop, antialias } = manifest.input;
  let x0 = 0;
  let y0 = 0;
  let w = image.width;
  let h = image.height;
  if (crop === 'center-square') {
    const size = Math.min(w, h);
    x0 = Math.floor(w / 2) - Math.floor(size / 2);
    y0 = Math.floor(h / 2) - Math.floor(size / 2);
    w = h = size;
  }
  const out = new Float32Array(C * H * W);
  const rgba = C === 3 ? image.rgba : undefined;
  for (let c = 0; c < C; c++) {
    let plane = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const px = (y + y0) * image.width + (x + x0);
        const v = rgba ? rgba[px * 4 + c]! : image.gray[px]!;
        plane[y * w + x] = (v / scale - mean[c]!) / std[c]!;
      }
    const sx = w / W;
    const sy = h / H;
    if (antialias) {
      plane = blur1d(plane, w, h, Math.max(0, (sx - 1) / 2), true);
      plane = blur1d(plane, w, h, Math.max(0, (sy - 1) / 2), false);
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
        const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
        const xa = Math.floor(fx);
        const ya = Math.floor(fy);
        const xb = Math.min(w - 1, xa + 1);
        const yb = Math.min(h - 1, ya + 1);
        const ax = fx - xa;
        const ay = fy - ya;
        const v = (xx: number, yy: number) => plane[yy * w + xx]!;
        out[c * H * W + y * W + x] = (v(xa, ya) * (1 - ax) + v(xb, ya) * ax) * (1 - ay) + (v(xa, yb) * (1 - ax) + v(xb, yb) * ax) * ay;
      }
  }
  return { data: out, dims: [1, C, H, W] };
}

/** Kırpma sonrası model ızgarasından özgün görüntü koordinatına dönüşüm (konumlar özgün görüntüde gösterilir). */
export function inputFrame(image: { width: number; height: number }, manifest: ModelManifest): { x0: number; y0: number; w: number; h: number } {
  if (manifest.input.crop !== 'center-square') return { x0: 0, y0: 0, w: image.width, h: image.height };
  const size = Math.min(image.width, image.height);
  return { x0: Math.floor(image.width / 2) - Math.floor(size / 2), y0: Math.floor(image.height / 2) - Math.floor(size / 2), w: size, h: size };
}

/* ------------------------------------------------------------------ Son işleme */

const num = (t: Tensor, i: number): number => {
  const v = t.data[i];
  return typeof v === 'bigint' ? Number(v) : (v as number);
};
const softmax = (xs: number[]) => {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

/**
 * Model çıktısını bulgulara çevirir. Konumlar özgün görüntünün piksel koordinatlarındadır; eşik
 * altındaki çıktılar atılır. Model ne verdiyse o: maske yoksa maske uydurulmaz.
 */
/** TorchXRayVision op_norm: çalışma noktası 0,5'e gelecek biçimde parçalı doğrusal ölçekleme. */
export function opNorm(p: number, t: number): number {
  if (!Number.isFinite(t)) return 0.5;
  return p < t ? p / (t * 2) : 1 - (1 - p) / ((1 - t) * 2);
}

/** Çok etiketli sınıflandırıcının TÜM skorları (kalibre edilmiş), büyükten küçüğe. Arayüzdeki skor tablosu için. */
export function multilabelScores(outputs: Record<string, Tensor>, manifest: ModelManifest): Array<{ key: string; name: string; structure?: string; score: number }> {
  const t = outputs[manifest.output.probs!];
  if (!t) throw new Error('Çok etiketli çıktı (probs) yok.');
  return manifest.labels
    .map((l) => {
      const raw = num(t, l.id);
      const th = manifest.calibration?.thresholds[l.id];
      const p = manifest.calibration && th !== undefined && th !== null ? opNorm(raw, th) : raw;
      return { key: l.key ?? String(l.id), name: l.finding, ...(l.structure ? { structure: l.structure } : {}), score: Math.round(p * 1000) / 1000 };
    })
    .sort((a, b) => b.score - a.score);
}

export function postprocess(outputs: Record<string, Tensor>, manifest: ModelManifest, imageSize: { width: number; height: number }, frame = 0): ModelFinding[] {
  const label = (id: number) => manifest.labels.find((l) => l.id === id);
  const conf = (p: number) => score(p, `${manifest.name} ${manifest.version} çıktı olasılığı`);
  const out: ModelFinding[] = [];
  const meta = (l: ModelLabel) => ({ ...(l.key ? { key: l.key } : {}), kind: l.kind ?? ('finding' as const), ...(l.structure ? { structure: l.structure } : {}), ...(l.part ? { part: l.part } : {}), ...(l.node ? { node: l.node } : {}) });
  const fr = inputFrame(imageSize, manifest);
  const clampBox = (x: number, y: number, w: number, h: number) => {
    const bx = Math.max(0, Math.min(imageSize.width, x));
    const by = Math.max(0, Math.min(imageSize.height, y));
    return { x: Math.round(bx), y: Math.round(by), w: Math.round(Math.max(1, Math.min(imageSize.width - bx, w))), h: Math.round(Math.max(1, Math.min(imageSize.height - by, h))) };
  };
  if (manifest.task === 'detection') {
    const boxes = outputs[manifest.output.boxes!];
    const scores = outputs[manifest.output.scores!];
    const labels = outputs[manifest.output.labels!];
    if (!boxes || !scores || !labels) throw new Error('Model çıktısında beklenen tensörler yok (boxes/scores/labels).');
    const n = scores.data.length;
    for (let i = 0; i < n; i++) {
      const p = num(scores, i);
      const l = label(num(labels, i));
      if (!(p >= manifest.scoreThreshold) || !l) continue;
      const [a, b] = [num(boxes, i * 4), num(boxes, i * 4 + 1)];
      const xyxy = manifest.output.boxFormat === 'xyxy-normalized';
      const c = xyxy ? num(boxes, i * 4 + 2) - a : num(boxes, i * 4 + 2);
      const d = xyxy ? num(boxes, i * 4 + 3) - b : num(boxes, i * 4 + 3);
      out.push({
        finding: l.finding,
        ...meta(l),
        confidence: conf(p),
        localization: { kind: 'pixel', frame, box: clampBox(fr.x0 + a * fr.w, fr.y0 + b * fr.h, c * fr.w, d * fr.h), imageSize },
      });
    }
  } else if (manifest.task === 'segmentation') {
    const mask = outputs[manifest.output.mask!];
    if (!mask || mask.dims.length !== 4) throw new Error('Segmentasyon çıktısı [1,C,H,W] değil.');
    const [, C, H, W] = mask.dims as [number, number, number, number];
    for (const l of manifest.labels) {
      if (l.id < 0 || l.id >= C) continue;
      let minX = W, minY = H, maxX = -1, maxY = -1, sum = 0, cnt = 0;
      const k = Math.max(1, Math.ceil(Math.max(W, H) / 64));
      const mw = Math.ceil(W / k);
      const mh = Math.ceil(H / k);
      const small = new Array<number>(mw * mh).fill(0);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const raw = num(mask, l.id * H * W + y * W + x);
          const pr = raw >= 0 && raw <= 1 ? raw : 1 / (1 + Math.exp(-raw));
          if (pr < manifest.scoreThreshold) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          sum += pr;
          cnt++;
          small[Math.floor(y / k) * mw + Math.floor(x / k)] = 1;
        }
      if (!cnt) continue;
      const fx = fr.w / W;
      const fy = fr.h / H;
      out.push({
        finding: l.finding,
        ...meta(l),
        confidence: conf(sum / cnt),
        localization: { kind: 'pixel', frame, box: clampBox(fr.x0 + minX * fx, fr.y0 + minY * fy, (maxX - minX + 1) * fx, (maxY - minY + 1) * fy), imageSize, mask: { width: mw, height: mh, data: small } },
        areaFraction: cnt / (W * H),
      });
    }
  } else if (manifest.task === 'multilabel') {
    // Görüntü düzeyinde sınıflandırma: konum UYDURULMAZ (yalnızca ilgili organ/bölge)
    for (const sc of multilabelScores(outputs, manifest)) {
      const l = manifest.labels.find((x) => (x.key ?? String(x.id)) === sc.key);
      if (l && sc.score >= manifest.scoreThreshold) out.push({ finding: l.finding, ...meta(l), confidence: conf(sc.score), localization: { kind: 'region-only' } });
    }
  } else if (manifest.task === 'classification') {
    const logits = outputs[manifest.output.logits!];
    if (!logits) throw new Error('Sınıflandırma çıktısı (logits) yok.');
    const probs = softmax(Array.from({ length: logits.data.length }, (_, i) => num(logits, i)));
    probs.forEach((p, i) => {
      const l = label(i);
      if (l && p >= manifest.scoreThreshold) out.push({ finding: l.finding, ...meta(l), confidence: conf(p), localization: { kind: 'region-only' } });
    });
  } else {
    throw new Error('3B hacim modeli tek görüntüde çalıştırılmaz; seri (DICOM) gerekir.');
  }
  return out;
}

/**
 * Göğüs röntgeninde kardiyotorasik oran: kalp maskesinin en geniş yatay genişliği / iki akciğer maskesinin
 * birlikte en geniş yatay genişliği. Model maskelerinden hesaplanan YAKLAŞIK ölçümdür (iç göğüs çapı yerine
 * akciğer dış sınırları); maske yoksa hesaplanmaz.
 */
export function cardiothoracicRatio(outputs: Record<string, Tensor>, manifest: ModelManifest): { ratio: number; heartWidth: number; thoraxWidth: number } | undefined {
  const mask = manifest.output.mask ? outputs[manifest.output.mask] : undefined;
  if (!mask || mask.dims.length !== 4) return undefined;
  const id = (k: string) => manifest.labels.find((l) => l.key === k)?.id;
  const heart = id('Heart');
  const lungs = [id('Left Lung'), id('Right Lung')].filter((x): x is number => x !== undefined);
  if (heart === undefined || lungs.length !== 2) return undefined;
  const [, , H, W] = mask.dims as [number, number, number, number];
  const on = (c: number, y: number, x: number) => num(mask, c * H * W + y * W + x) >= manifest.scoreThreshold;
  const width = (cs: number[]) => {
    let lo = W;
    let hi = -1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (cs.some((c) => on(c, y, x))) {
          if (x < lo) lo = x;
          if (x > hi) hi = x;
        }
    return hi >= lo ? hi - lo + 1 : 0;
  };
  // kalp için satır başına en geniş genişlik (maksimum yatay çap)
  let heartWidth = 0;
  for (let y = 0; y < H; y++) {
    let lo = W;
    let hi = -1;
    for (let x = 0; x < W; x++)
      if (on(heart, y, x)) {
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    if (hi >= lo) heartWidth = Math.max(heartWidth, hi - lo + 1);
  }
  const thoraxWidth = width(lungs);
  if (!heartWidth || !thoraxWidth) return undefined;
  return { ratio: Math.round((heartWidth / thoraxWidth) * 1000) / 1000, heartWidth, thoraxWidth };
}

/* ------------------------------------------------------------------ Sağlayıcı */

export interface ModelExtras {
  scores?: Array<{ key: string; name: string; structure?: string; score: number }>;
  ctr?: { ratio: number; heartWidth: number; thoraxWidth: number };
}

export function modelVersionOf(m: ModelManifest): ModelVersion & { sha256: string; license: string } {
  return { id: m.id, name: m.name, version: m.version, kind: 'learned', local: true, sha256: m.sha256, license: m.license };
}

/**
 * Cihazda kurulu bir modelle çalışan sağlayıcı. Model dosyası ilk kullanımda yüklenir (lazy) ve
 * oturum önbellekte tutulur; `dispose` belleği bırakır.
 */
export class LocalModelProvider implements MedicalImageAIProvider {
  readonly sendsDataOffDevice = false;
  readonly id: string;
  readonly label: string;
  readonly modalities: readonly Modality[];
  private engine: Promise<InferenceEngine> | null = null;
  private readonly fallback: UnavailableImageProvider;
  /** Son çalıştırmanın ek çıktıları: tüm skorlar (çok etiketli) ve maskelerden ölçümler. */
  lastExtras: ModelExtras = {};

  constructor(
    readonly manifest: ModelManifest,
    private readonly loadBytes: () => Promise<Uint8Array>,
    private readonly createEngine: EngineFactory,
  ) {
    this.id = `local:${manifest.id}`;
    this.label = `${manifest.name} ${manifest.version} (cihazda)`;
    this.modalities = manifest.modalities;
    this.fallback = new UnavailableImageProvider(this.id, 'mri', 'Bu yerel model bu işlemi desteklemiyor.');
  }

  available() {
    return true;
  }

  private session(): Promise<InferenceEngine> {
    this.engine ??= this.loadBytes().then((b) => this.createEngine(b, this.manifest));
    this.engine.catch(() => (this.engine = null));
    return this.engine;
  }

  dispose(): void {
    void this.engine?.then((e) => e.dispose(), () => undefined);
    this.engine = null;
  }

  private ok<T>(value: T): ProviderOutput<T> {
    return { status: 'ok', value, source: 'IMAGE_MODEL', model: modelVersionOf(this.manifest), confidence: score(1, 'model çalıştı'), limitations: this.manifest.limitations };
  }

  async detectFindings(input: StudyInput): Promise<ProviderOutput<ModelFinding[]>> {
    if (!this.manifest.modalities.includes(input.modality)) return { status: 'unavailable', reason: `Bu model ${input.modality} için değil.` };
    if (this.manifest.task === 'segmentation-3d') return { status: 'unavailable', reason: 'Bu 3B hacim modeli tek görüntüde değil, DICOM serisinde çalışır.' };
    const findings: ModelFinding[] = [];
    const engine = await this.session();
    this.lastExtras = {};
    for (const [frame, img] of input.images.entries()) {
      const outputs = await engine.run({ [this.manifest.input.name]: preprocess(img, this.manifest) });
      findings.push(...postprocess(outputs, this.manifest, { width: img.width, height: img.height }, frame));
      if (this.manifest.task === 'multilabel' && !this.lastExtras.scores) this.lastExtras.scores = multilabelScores(outputs, this.manifest);
      if (this.manifest.task === 'segmentation' && !this.lastExtras.ctr) {
        const ctr = cardiothoracicRatio(outputs, this.manifest);
        if (ctr) this.lastExtras.ctr = ctr;
      }
    }
    return this.ok(findings);
  }

  async localizeFindings(_input: StudyInput, findings: ModelFinding[]): Promise<ProviderOutput<ModelFinding[]>> {
    return this.ok(findings);
  }

  async analyzeStudy(input: StudyInput): Promise<ProviderOutput<StudyAnalysis>> {
    const r = await this.detectFindings(input);
    return r.status === 'ok' ? this.ok({ findings: r.value, structures: [], measurements: [] }) : r;
  }

  classifyModality() {
    return this.fallback.classifyModality();
  }
  classifySequence() {
    return this.fallback.classifySequence();
  }
  detectStructures() {
    return this.fallback.detectStructures();
  }
  segmentStructures() {
    return this.fallback.segmentStructures();
  }
  measureStructures() {
    return this.fallback.measureStructures();
  }
  compareStudies() {
    return this.fallback.compareStudies();
  }
}

/* ------------------------------------------------------------------ Yetenek kaydı */

export interface ModalityCapability {
  key: 'dicom' | 'preprocessing' | 'sequence' | 'precheck' | 'local-model' | 'localization' | 'anatomy' | 'mpr';
  label: string;
  supported: boolean;
  /** supported:false ise neden; true ise nasıl (ör. model adı). */
  reason: string;
}

export const CAPABILITY_MODALITIES: Array<{ modality: Modality; label: string }> = [
  { modality: 'MRI', label: 'MR' },
  { modality: 'CT', label: 'BT' },
  { modality: 'XRAY', label: 'Röntgen' },
  { modality: 'ULTRASOUND', label: 'Ultrason' },
  { modality: 'DOPPLER', label: 'Doppler' },
  { modality: 'ECHOCARDIOGRAPHY', label: 'EKO' },
  { modality: 'MAMMOGRAPHY', label: 'Mamografi' },
  { modality: 'PATHOLOGY', label: 'Patoloji' },
  { modality: 'ECG', label: 'EKG' },
  { modality: 'ENDOSCOPY', label: 'Endoskopi' },
  { modality: 'FUNDUS', label: 'Fundus' },
  { modality: 'DENTAL', label: 'Diş' },
];

const PRECHECK: Partial<Record<Modality, string>> = {
  MRI: 'Sağ-sol simetri ön kontrolü (kural tabanlı; tıbbi model değil)',
  CT: 'Sağ-sol simetri ön kontrolü (kural tabanlı; tıbbi model değil)',
  ECG: 'Izgara kalibrasyonu, RR aralığı ve kalp hızı ölçümü (sinyal işleme)',
  ULTRASOUND: 'Ultrason görüntü alanının tanınması (geometri)',
  DOPPLER: 'Ultrason görüntü alanının tanınması (geometri)',
  ECHOCARDIOGRAPHY: 'Ultrason görüntü alanının tanınması (geometri)',
  PATHOLOGY: 'Boyalı doku alanı ve çekirdek sayımı (görüntü ölçümü)',
};

/**
 * Modalite başına yetenekler: neyin gerçekten desteklendiği, neyin neden desteklenmediği. Arayüz
 * ve README bunu gösterir; "yok" olan hiçbir şey varmış gibi davranmaz.
 */
export function capabilitiesFor(modality: Modality, models: readonly ModelManifest[] = []): ModalityCapability[] {
  const mine = models.filter((m) => m.modalities.includes(modality));
  const localizing = mine.filter((m) => m.task !== 'classification' && m.task !== 'multilabel');
  const mapped = mine.filter((m) => m.labels.some((l) => l.structure && (GRAPH.node(l.structure) || l.structure)));
  const describe = (m: ModelManifest) =>
    `${m.name} ${m.version}${m.task === 'segmentation-3d' ? ' — 3B, yalnızca DICOM serisinde' : m.task === 'multilabel' || m.task === 'classification' ? ' — görüntü düzeyinde skor, konum vermez' : ''}${m.labels.every((l) => l.kind === 'anatomy') ? ' (anatomi bölütleme; bulgu değil)' : ''}`;
  const cross = modality === 'MRI' || modality === 'CT';
  return [
    { key: 'dicom', label: 'DICOM okuma (seri, kesit, başlık, anonimleştirme)', supported: modality !== 'ECG', reason: modality === 'ECG' ? 'EKG dalga formu DICOM\'u okunmuyor; kâğıt EKG fotoğrafı/taraması destekleniyor.' : 'Cihazda (Explicit/Implicit VR, sıkıştırmasız, RLE, JPEG Baseline).' },
    { key: 'preprocessing', label: 'Yerel ön işleme (kalite, tür ve bölge tahmini)', supported: true, reason: 'Cihazda.' },
    ...(modality === 'MRI' ? [{ key: 'sequence' as const, label: 'MR sekans bilgisi', supported: true, reason: 'Yalnızca DICOM başlığından (seri açıklaması); fotoğrafta ve dosya adından okunmaz.' }] : []),
    { key: 'precheck', label: 'Kural tabanlı ön inceleme', supported: Boolean(PRECHECK[modality]), reason: PRECHECK[modality] ?? 'Bu modalite için ön inceleme algoritması yok.' },
    {
      key: 'local-model',
      label: 'Yerel tıbbi AI modeli',
      supported: mine.length > 0,
      reason: mine.length ? mine.map(describe).join('; ') : 'Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.',
    },
    {
      key: 'localization',
      label: 'Görüntü üzerinde konum (kutu / maske)',
      supported: localizing.length > 0,
      reason: localizing.length
        ? `Model çıktısı: ${localizing.map((m) => (m.task === 'segmentation-3d' ? '3B voksel maskesi (seri)' : m.task === 'segmentation' ? 'piksel maskesi' : 'kutu')).join(', ')}.`
        : mine.length
          ? 'Kurulu model görüntü düzeyinde sınıflandırır; konum vermez (yalnızca ilgili organ).'
          : cross
            ? 'Yalnızca ön kontroldeki asimetri alanları (bulgu değil); gerçek bulgu konumu için model gerekir.'
            : 'Konum üreten bir model kurulu değil.',
    },
    {
      key: 'anatomy',
      label: 'Anatomi eşlemesi (organ → sistem → 3B)',
      supported: mapped.length > 0 || cross,
      reason: mapped.length ? 'Model etiketlerindeki yapılardan.' : cross ? 'Belgenin bölgesinden ve ön kontrol alanının yaklaşık beyin konumundan (yaklaşık).' : 'Belgenin seçilen bölgesinden (yaklaşık).',
    },
    ...(cross
      ? [{ key: 'mpr' as const, label: 'Eksenel / sagital / koronal (MPR)', supported: true, reason: 'Yalnızca düzenli aralıklı, aynı yönelimli, en az 10 kesitlik DICOM serisinde (görüntüleyicide "Diğer düzlemler"); fotoğrafta, tek kesitte ve düzensiz seride yapılmaz — nedeni gösterilir.' }]
      : []),
  ];
}

/* ------------------------------------------------------------------ Üç durum */

export type AnalysisState = 'model' | 'precheck' | 'none';

export const ANALYSIS_STATE_TEXT: Record<AnalysisState, string> = {
  model: 'Yerel tıbbi AI modeli ile analiz edildi.',
  precheck: 'Görüntü ön incelemesi yapıldı. Bu sonuç tıbbi AI modeli sonucu değildir.',
  none: 'Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.',
};

/** Her görüntü analizinde üç durumdan biri: gerçek model / sınırlı ön inceleme / model yok. Karıştırılmaz. */
export function analysisState(opts: { modelRan: boolean; precheckRan: boolean }): AnalysisState {
  return opts.modelRan ? 'model' : opts.precheckRan ? 'precheck' : 'none';
}
