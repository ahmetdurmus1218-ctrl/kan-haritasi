import type { TextItem } from '@kh/parser';
import type { Worker as TesseractWorker } from 'tesseract.js';

/**
 * Cihaz içi OCR (Tesseract.js, Türkçe + İngilizce). Worker, çekirdek (WASM) ve dil verisi
 * uygulamayla paketlenir; hiçbir görüntü veya metin cihazdan çıkmaz. Dil verisi tarayıcı
 * önbelleğine yazılmaz (cacheMethod: none).
 */
let workerPromise: Promise<TesseractWorker> | null = null;
let progressListener: ((p: number) => void) | null = null;

async function getWorker(): Promise<TesseractWorker> {
  workerPromise ??= (async () => {
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    const base = new URL('./ocr/', document.baseURI).href;
    const worker = await createWorker(['tur', 'eng'], OEM.LSTM_ONLY, {
      workerPath: `${base}worker.min.js`,
      corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
      langPath: base.replace(/\/$/, ''),
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'none',
      logger: (m) => {
        if (m.status === 'recognizing text' && progressListener) progressListener(m.progress);
      },
    });
    // user_defined_dpi: çözünürlük tahmin uyarısını önler; görseller OCR öncesi ~300 dpi'ye ölçeklenir.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    return worker;
  })();
  try {
    return await workerPromise;
  } catch (e) {
    workerPromise = null;
    throw e;
  }
}

/** OCR işçisini kapatır (belge ekranından çıkınca bellek geri verilir). */
export async function releaseOcr(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  if (p) await (await p).terminate().catch(() => undefined);
}

/**
 * Bir tuvali OCR'dan geçirir. `scale`: tuval pikseli / hedef koordinat birimi
 * (PDF sayfasında görüntü alanı ölçeği; fotoğrafta 1).
 */
export async function recognizeCanvas(canvas: HTMLCanvasElement, page: number, scale: number, onProgress?: (p: number) => void): Promise<TextItem[]> {
  const worker = await getWorker();
  progressListener = onProgress ?? null;
  try {
    const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
    const items: TextItem[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          for (const w of line.words) {
            if (!w.text.trim()) continue;
            items.push({
              text: w.text,
              x: w.bbox.x0 / scale,
              y: w.bbox.y0 / scale,
              w: (w.bbox.x1 - w.bbox.x0) / scale,
              h: (w.bbox.y1 - w.bbox.y0) / scale,
              page,
              conf: w.confidence,
            });
          }
        }
      }
    }
    return items;
  } finally {
    progressListener = null;
  }
}

/** Fotoğraf ön işleme: yönü düzelt (EXIF), gri tona çevir, kontrastı artır, OCR için uygun boyuta getir. */
export async function prepareImage(bytes: Uint8Array<ArrayBuffer>, mimeType: string): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; scale: number }> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }), { imageOrientation: 'from-image' });
  const longEdge = Math.max(bitmap.width, bitmap.height);
  // Küçük görselleri büyüt (OCR doğruluğu), büyükleri 2800 px'e indir (bellek).
  const scale = longEdge < 1600 ? 1600 / longEdge : Math.min(1, 2800 / longEdge);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('canvas');
  ctx.filter = 'grayscale(1) contrast(1.35)';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Koordinatlar orijinal görsel pikseline göre tutulur (görüntüleyicideki kutu için).
  return { canvas, width: canvas.width / scale, height: canvas.height / scale, scale };
}
