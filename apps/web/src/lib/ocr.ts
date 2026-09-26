import type { TextItem } from '@kh/parser';
import type { Worker as TesseractWorker } from 'tesseract.js';

/**
 * Cihaz içi OCR (Tesseract.js, Türkçe). Worker, çekirdek (WASM) ve dil verisi uygulamayla
 * paketlenir; hiçbir görüntü veya metin cihazdan çıkmaz. Dil verisi önbelleğe yazılmaz.
 *
 * Telefonlarda güvenilirlik için:
 *  - Aşama aşama ilerleme bildirilir (motor, dil verisi, hazırlık, tanıma %).
 *  - Bir aşama belirli süre hiç ilerlemezse (bellek yetmezliği, işçinin sessizce ölmesi) iş
 *    iptal edilir ve anlaşılır bir hata döner; kullanıcı tekrar deneyebilir veya elle girebilir.
 *  - Tek dil (Türkçe; Latin harfleri ve birimleri de kapsar) → daha az bellek, daha hızlı açılış.
 */

export type OcrStage = 'prepare' | 'core' | 'lang' | 'init' | 'recognize';

export interface OcrProgress {
  stage: OcrStage;
  /** 0–1 (yalnızca tanıma ve dil verisinde anlamlı). */
  fraction: number;
}

export class OcrError extends Error {
  constructor(
    readonly code: 'STALLED' | 'FAILED' | 'CANCELLED',
    readonly stage: OcrStage,
    /** Teknik ayrıntı (ör. "dil dosyası bulunamadı (404)"); sağlık verisi içermez. */
    readonly detail?: string,
  ) {
    super(`ocr ${code} at ${stage}${detail ? `: ${detail}` : ''}`);
    this.name = 'OcrError';
  }
}

/** İşçi hata metnini kısa, kullanıcıya gösterilebilir bir ayrıntıya çevirir (URL'ler kısaltılır). */
function describeFailure(e: unknown): string {
  const text = String(e instanceof Error ? e.message : e);
  const net = /Network error while fetching .*\/([^/\s]+)\. Response code: (\d+)/.exec(text);
  if (net) return `${net[1]} alınamadı (HTTP ${net[2]})`;
  if (/out of memory|Cannot enlarge memory|RangeError/i.test(text)) return 'bellek yetmedi';
  return text.replace(/https?:\/\/\S+/g, '…').slice(0, 140);
}

const LANG = 'tur';
/** Aşama başına "hiç ilerleme yoksa" bekleme sınırı. */
const STALL_MS: Record<OcrStage, number> = { prepare: 60_000, core: 120_000, lang: 90_000, init: 90_000, recognize: 150_000 };

let workerPromise: Promise<TesseractWorker> | null = null;
let workerInstance: TesseractWorker | null = null;
let listener: ((p: OcrProgress) => void) | null = null;
let stage: OcrStage = 'core';
let lastActivity = 0;
let failure: string | null = null;
let cancelled = false;

function report(s: OcrStage, fraction: number) {
  stage = s;
  lastActivity = Date.now();
  listener?.({ stage: s, fraction });
}

const STATUS_STAGE: Record<string, OcrStage> = {
  'loading tesseract core': 'core',
  'initializing tesseract': 'core',
  'loading language traineddata': 'lang',
  'initializing api': 'init',
  'recognizing text': 'recognize',
};

/** Söz verilen iş ilerlemeden takılırsa (ya da işçi hata bildirirse) reddeder. */
function watch<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setInterval(() => {
      if (cancelled) {
        clearInterval(timer);
        reject(new OcrError('CANCELLED', stage));
      } else if (failure) {
        clearInterval(timer);
        reject(new OcrError('FAILED', stage, failure));
      } else if (Date.now() - lastActivity > STALL_MS[stage]) {
        clearInterval(timer);
        reject(new OcrError('STALLED', stage));
      }
    }, 1000);
    p.then(
      (v) => {
        clearInterval(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearInterval(timer);
        reject(e instanceof OcrError ? e : new OcrError('FAILED', stage, failure ?? describeFailure(e)));
      },
    );
  });
}

async function getWorker(): Promise<TesseractWorker> {
  workerPromise ??= (async () => {
    report('core', 0);
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    const base = new URL('./ocr/', document.baseURI).href;
    const worker = await createWorker(LANG, OEM.LSTM_ONLY, {
      workerPath: `${base}worker.min.js`,
      corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
      langPath: base.replace(/\/$/, ''),
      workerBlobURL: false,
      // Dosya gzip'li ama ".gz" uzantısız (Android paketleme nedeniyle; bkz. copy-vendor-assets.mjs)
      gzip: false,
      cacheMethod: 'none',
      logger: (m) => {
        const s = STATUS_STAGE[m.status];
        if (s) report(s, typeof m.progress === 'number' ? m.progress : 0);
      },
      errorHandler: (err: unknown) => {
        failure = describeFailure(err);
      },
    });
    report('init', 1);
    // user_defined_dpi: çözünürlük tahmin uyarısını önler; görseller OCR öncesi ~300 dpi'ye ölçeklenir.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    workerInstance = worker;
    return worker;
  })();
  try {
    return await watch(workerPromise);
  } catch (e) {
    await releaseOcr();
    throw e;
  }
}

/** OCR işçisini kapatır (belge ekranından çıkınca ya da takılınca bellek geri verilir). */
export async function releaseOcr(): Promise<void> {
  const w = workerInstance;
  workerPromise = null;
  workerInstance = null;
  failure = null;
  if (w) await w.terminate().catch(() => undefined);
}

/** Süren okumayı iptal eder. */
export function cancelOcr(): void {
  cancelled = true;
  void releaseOcr();
}

/**
 * Bir tuvali OCR'dan geçirir. `scale`: tuval pikseli / hedef koordinat birimi
 * (PDF sayfasında görüntü alanı ölçeği; fotoğrafta ölçek). `offset`: kırpılan kenar (hedef birimde).
 */
export async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  page: number,
  scale: number,
  onProgress?: (p: OcrProgress) => void,
  offset: { x: number; y: number } = { x: 0, y: 0 },
): Promise<TextItem[]> {
  listener = onProgress ?? null;
  cancelled = false;
  failure = null;
  try {
    const worker = await getWorker();
    report('recognize', 0);
    const { data } = await watch(worker.recognize(canvas, {}, { blocks: true, text: false }));
    const items: TextItem[] = [];
    const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
    const theta = skewAngle(lines);
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    for (const line of lines) {
      const words = line.words.filter((w) => w.text.trim());
      if (!words.length) continue;
      // Satırın eğimi düzeltilmiş dikey merkezi: aynı tablo satırının tüm kelimeleri aynı gruba düşer.
      const ys = words.map((w) => {
        const cx = (w.bbox.x0 + w.bbox.x1) / 2;
        const cy = (w.bbox.y0 + w.bbox.y1) / 2;
        return -cx * sin + cy * cos;
      });
      const lineCy = ys.reduce((a, b) => a + b, 0) / ys.length / scale + offset.y;
      for (const w of words) {
        items.push({
          text: w.text,
          x: w.bbox.x0 / scale + offset.x,
          y: w.bbox.y0 / scale + offset.y,
          w: (w.bbox.x1 - w.bbox.x0) / scale,
          h: (w.bbox.y1 - w.bbox.y0) / scale,
          page,
          conf: w.confidence,
          cy: lineCy,
        });
      }
    }
    return items;
  } catch (e) {
    if (e instanceof OcrError && e.code !== 'CANCELLED') await releaseOcr();
    throw e;
  } finally {
    listener = null;
  }
}

interface OcrLine {
  baseline: { x0: number; y0: number; x1: number; y1: number };
  bbox: { x0: number; x1: number };
}

/** Fotoğrafın eğimi: yeterince uzun satırların taban çizgisi açılarının ortancası (radyan). */
export function skewAngle(lines: OcrLine[]): number {
  const angles = lines
    .filter((l) => l.baseline && l.baseline.x1 - l.baseline.x0 > Math.max(80, (l.bbox.x1 - l.bbox.x0) * 0.5))
    .map((l) => Math.atan2(l.baseline.y1 - l.baseline.y0, l.baseline.x1 - l.baseline.x0))
    .filter((a) => Math.abs(a) < 0.35)
    .sort((a, b) => a - b);
  if (!angles.length) return 0;
  return angles[Math.floor(angles.length / 2)]!;
}

/**
 * Kâğıdın sınırlarını kabaca bulur (arka plan masa/kumaş gibi daha koyu). Kâğıt görüntünün makul bir
 * bölümünü kaplıyorsa kırpılır: OCR daha hızlı çalışır, arka plandaki gürültüyü metin sanmaz.
 */
function paperBounds(bitmap: ImageBitmap): { x: number; y: number; w: number; h: number } | null {
  const S = 200;
  const k = S / Math.max(bitmap.width, bitmap.height);
  const tw = Math.max(1, Math.round(bitmap.width * k));
  const th = Math.max(1, Math.round(bitmap.height * k));
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, tw, th);
  const px = ctx.getImageData(0, 0, tw, th).data;
  const lum = new Float32Array(tw * th);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < tw * th; i++) {
    const l = 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
    lum[i] = l;
    hist[Math.min(255, Math.round(l))]!++;
  }
  // Otsu eşiği
  const total = tw * th;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = i;
    }
  }
  const rowOk = (y: number) => {
    let n = 0;
    for (let x = 0; x < tw; x++) if (lum[y * tw + x]! > thr) n++;
    return n / tw > 0.35;
  };
  const colOk = (x: number) => {
    let n = 0;
    for (let y = 0; y < th; y++) if (lum[y * tw + x]! > thr) n++;
    return n / th > 0.35;
  };
  let y0 = 0;
  while (y0 < th && !rowOk(y0)) y0++;
  let y1 = th - 1;
  while (y1 > y0 && !rowOk(y1)) y1--;
  let x0 = 0;
  while (x0 < tw && !colOk(x0)) x0++;
  let x1 = tw - 1;
  while (x1 > x0 && !colOk(x1)) x1--;
  const area = ((x1 - x0 + 1) * (y1 - y0 + 1)) / total;
  if (area < 0.2 || area > 0.9) return null;
  const m = 0.02 * S;
  const nx0 = Math.max(0, x0 - m);
  const ny0 = Math.max(0, y0 - m);
  const nx1 = Math.min(tw, x1 + 1 + m);
  const ny1 = Math.min(th, y1 + 1 + m);
  return { x: nx0 / k, y: ny0 / k, w: (nx1 - nx0) / k, h: (ny1 - ny0) / k };
}

/**
 * Ekran görüntüsü mü (telefon ekranı: uzun ve dar; ya da PNG)? Kâğıt fotoğrafları çoğunlukla 4:3 veya
 * 16:9'dur; telefon ekranları 19,5:9–20:9. Yalnızca hangi ön işlemenin önce deneneceğini belirler.
 */
export async function looksLikeScreenshot(bytes: Uint8Array<ArrayBuffer>, mimeType: string): Promise<boolean> {
  if (mimeType === 'image/png') return true;
  try {
    const bmp = await createImageBitmap(new Blob([bytes], { type: mimeType }), { imageOrientation: 'from-image' });
    const r = Math.max(bmp.width, bmp.height) / Math.max(1, Math.min(bmp.width, bmp.height));
    bmp.close();
    return r >= 1.9;
  } catch {
    return false;
  }
}

/**
 * Görüntü ön işleme. İki kip:
 *  - 'document': kâğıt fotoğrafı — yön (EXIF), kâğıdı kırp, gri ton + kontrast, küçükse büyüt.
 *  - 'screen': ekran görüntüsü (e-Nabız, hastane uygulaması) — kırpma yok, yalnızca gri ton; açık gri
 *    yazılar kontrastla silinmesin, büyütme harfleri bulanıklaştırmasın.
 */
export async function prepareImage(
  bytes: Uint8Array<ArrayBuffer>,
  mimeType: string,
  mode: 'document' | 'screen' = 'document',
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; scale: number; offset: { x: number; y: number }; cropped: boolean }> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }), { imageOrientation: 'from-image' });
  const full = { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const paper = mode === 'document' ? paperBounds(bitmap) : null;
  const crop = paper ?? full;
  const longEdge = Math.max(crop.w, crop.h);
  // Küçük görselleri büyüt (doğruluk), büyükleri 2400 px'e indir (telefonda bellek ve hız).
  const scale =
    mode === 'screen' ? (longEdge < 1000 ? 1000 / longEdge : Math.min(1, 3200 / longEdge)) : longEdge < 1600 ? 1600 / longEdge : Math.min(1, 2400 / longEdge);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.w * scale);
  canvas.height = Math.round(crop.h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('canvas');
  ctx.filter = mode === 'screen' ? 'grayscale(1)' : 'grayscale(1) contrast(1.35)';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Koordinatlar orijinal görsel pikseline göre tutulur (görüntüleyicideki kutu için).
  return { canvas, width: full.w, height: full.h, scale, offset: { x: crop.x, y: crop.y }, cropped: paper !== null };
}
