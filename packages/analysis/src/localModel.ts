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

/* ------------------------------------------------------------------ Manifest */

export type ModelTask = 'detection' | 'segmentation' | 'classification';

export interface ModelLabel {
  id: number;
  /** Bulgunun adı (ör. "Lezyon adayı"). */
  finding: string;
  /** Bilgi grafiği düğümü ya da 3B yapı (anatomi eşlemesi); yoksa bölge belgeden gelir. */
  structure?: string;
}

/** Bir yerel modelin kimlik kartı: ne yapar, hangi girdiyi bekler, çıktısı nasıl okunur, kaynağı ve lisansı. */
export interface ModelManifest {
  schema: 'kh-model-manifest/1';
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
    layout: 'NCHW';
    channels: 1 | 3;
    width: number;
    height: number;
    /** piksel / scale, sonra (x - mean) / std */
    scale: number;
    mean: number[];
    std: number[];
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
  };
  labels: ModelLabel[];
  scoreThreshold: number;
  limitations: string[];
}

const MODALITIES: ReadonlySet<string> = new Set(['MRI', 'CT', 'XRAY', 'ULTRASOUND', 'DOPPLER', 'MAMMOGRAPHY', 'PET', 'PET_CT', 'SPECT', 'FLUOROSCOPY', 'ECHOCARDIOGRAPHY', 'ENDOSCOPY', 'COLONOSCOPY', 'DERMOSCOPY', 'DENTAL', 'FUNDUS', 'PATHOLOGY', 'MICROSCOPY', 'ECG']);

/** Manifest doğrulama: eksik/yanlış alanlar açıkça listelenir; doğrulanmamış model yüklenmez. */
export function validateManifest(json: unknown): { ok: true; manifest: ModelManifest } | { ok: false; errors: string[] } {
  const e: string[] = [];
  const m = json as Partial<ModelManifest> | null;
  if (!m || typeof m !== 'object') return { ok: false, errors: ['Manifest bir JSON nesnesi değil.'] };
  const str = (k: keyof ModelManifest) => typeof m[k] === 'string' && (m[k] as string).trim().length > 0;
  if (m.schema !== 'kh-model-manifest/1') e.push('schema "kh-model-manifest/1" olmalı.');
  for (const k of ['id', 'name', 'version', 'file', 'license', 'source', 'intendedUse'] as const) if (!str(k)) e.push(`${k} eksik.`);
  if (typeof m.id === 'string' && !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(m.id)) e.push('id yalnızca küçük harf, rakam, nokta, tire içermeli.');
  if (typeof m.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(m.sha256)) e.push('sha256 64 haneli onaltılık özet olmalı.');
  if (m.format !== 'onnx') e.push('format yalnızca "onnx" olabilir.');
  if (!Array.isArray(m.modalities) || !m.modalities.length || m.modalities.some((x) => !MODALITIES.has(x))) e.push('modalities geçerli modalite listesi olmalı (ör. ["MRI"]).');
  if (m.task !== 'detection' && m.task !== 'segmentation' && m.task !== 'classification') e.push('task: detection | segmentation | classification.');
  const i = m.input;
  if (!i || typeof i.name !== 'string' || i.layout !== 'NCHW' || (i.channels !== 1 && i.channels !== 3) || !(i.width > 0 && i.width <= 2048) || !(i.height > 0 && i.height <= 2048) || !(i.scale > 0) || !Array.isArray(i.mean) || !Array.isArray(i.std) || i.mean.length !== i.channels || i.std.length !== i.channels || i.std.some((x) => !(x > 0)))
    e.push('input: name, layout NCHW, channels 1|3, width/height (1–2048), scale > 0, kanal sayısı kadar mean/std (std > 0).');
  const o = m.output;
  if (!o || typeof o !== 'object') e.push('output eksik.');
  else if (m.task === 'detection' && !(o.boxes && o.scores && o.labels)) e.push('detection için output.boxes, output.scores, output.labels gerekli.');
  else if (m.task === 'segmentation' && !o.mask) e.push('segmentation için output.mask gerekli.');
  else if (m.task === 'classification' && !o.logits) e.push('classification için output.logits gerekli.');
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

/**
 * Görüntüyü modelin girdisine çevirir: çift doğrusal yeniden boyutlandırma, kanal (gri → 3 kanal
 * tekrar), ölçek ve normalizasyon. Kopya en aza indirilir: yalnızca hedef boyutta tek bir dizi.
 */
export function preprocess(image: RasterImage, manifest: ModelManifest): Tensor {
  const { width: W, height: H, channels: C, scale, mean, std } = manifest.input;
  const out = new Float32Array(C * H * W);
  const sx = image.width / W;
  const sy = image.height / H;
  const rgba = C === 3 ? image.rgba : undefined;
  const sample = (x: number, y: number, ch: number): number => {
    const fx = Math.min(image.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
    const fy = Math.min(image.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(image.width - 1, x0 + 1);
    const y1 = Math.min(image.height - 1, y0 + 1);
    const ax = fx - x0;
    const ay = fy - y0;
    const v = (xx: number, yy: number) => (rgba ? rgba[(yy * image.width + xx) * 4 + ch]! : image.gray[yy * image.width + xx]!);
    return (v(x0, y0) * (1 - ax) + v(x1, y0) * ax) * (1 - ay) + (v(x0, y1) * (1 - ax) + v(x1, y1) * ax) * ay;
  };
  for (let c = 0; c < C; c++)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) out[c * H * W + y * W + x] = (sample(x, y, c) / scale - mean[c]!) / std[c]!;
  return { data: out, dims: [1, C, H, W] };
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
export function postprocess(outputs: Record<string, Tensor>, manifest: ModelManifest, imageSize: { width: number; height: number }, frame = 0): ModelFinding[] {
  const label = (id: number) => manifest.labels.find((l) => l.id === id);
  const conf = (p: number) => score(p, `${manifest.name} ${manifest.version} çıktı olasılığı`);
  const out: ModelFinding[] = [];
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
        ...(l.structure ? { structure: l.structure } : {}),
        confidence: conf(p),
        localization: { kind: 'pixel', frame, box: clampBox(a * imageSize.width, b * imageSize.height, c * imageSize.width, d * imageSize.height), imageSize },
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
      const fx = imageSize.width / W;
      const fy = imageSize.height / H;
      out.push({
        finding: l.finding,
        ...(l.structure ? { structure: l.structure } : {}),
        confidence: conf(sum / cnt),
        localization: { kind: 'pixel', frame, box: clampBox(minX * fx, minY * fy, (maxX - minX + 1) * fx, (maxY - minY + 1) * fy), imageSize, mask: { width: mw, height: mh, data: small } },
      });
    }
  } else {
    const logits = outputs[manifest.output.logits!];
    if (!logits) throw new Error('Sınıflandırma çıktısı (logits) yok.');
    const probs = softmax(Array.from({ length: logits.data.length }, (_, i) => num(logits, i)));
    probs.forEach((p, i) => {
      const l = label(i);
      if (l && p >= manifest.scoreThreshold) out.push({ finding: l.finding, ...(l.structure ? { structure: l.structure } : {}), confidence: conf(p), localization: { kind: 'region-only' } });
    });
  }
  return out;
}

/* ------------------------------------------------------------------ Sağlayıcı */

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
    const findings: ModelFinding[] = [];
    const engine = await this.session();
    for (const [frame, img] of input.images.entries()) {
      const outputs = await engine.run({ [this.manifest.input.name]: preprocess(img, this.manifest) });
      findings.push(...postprocess(outputs, this.manifest, { width: img.width, height: img.height }, frame));
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
  const localizing = mine.filter((m) => m.task !== 'classification');
  const mapped = mine.filter((m) => m.labels.some((l) => l.structure && (GRAPH.node(l.structure) || l.structure)));
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
      reason: mine.length ? mine.map((m) => `${m.name} ${m.version}`).join(', ') : 'Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.',
    },
    {
      key: 'localization',
      label: 'Görüntü üzerinde konum (kutu / maske)',
      supported: localizing.length > 0,
      reason: localizing.length ? `Model çıktısı (${localizing.map((m) => m.task).join(', ')}).` : cross ? 'Yalnızca ön kontroldeki asimetri alanları (bulgu değil); gerçek bulgu konumu için model gerekir.' : 'Konum üreten bir model kurulu değil.',
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
