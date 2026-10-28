import type { ReportDraft, ReportMark, SourceBox } from '@kh/parser';
import type { PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Raporun satırlara koyduğu renkli işaretleri okur: e-Nabız'da aralık dışı satırın kırmızı ünlemi ve
 * pembe zemini, aralık içindekinin yeşil onayı; bazı PDF'lerde kırmızı yazılan değer. Sonuç yalnızca
 * okunan değeri teyit etmek için kullanılır (bkz. packages/parser/src/marks.ts). Görüntü cihazda kalır.
 */

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Pikselin renk sınıfı: uyarı (kırmızı, pembe, turuncu) ya da onay (yeşil); gri ve mavi tonlar sayılmaz. */
function hueClass(r: number, g: number, b: number): 'alert' | 'ok' | null {
  const max = Math.max(r, g, b);
  const c = max - Math.min(r, g, b);
  if (c < 28 || c / max < 0.12) return null;
  let h = max === r ? ((g - b) / c) * 60 : max === g ? ((b - r) / c) * 60 + 120 : ((r - g) / c) * 60 + 240;
  if (h < 0) h += 360;
  if (h >= 320 || h <= 45) return 'alert';
  if (h >= 75 && h <= 190) return 'ok';
  return null;
}

function count(img: RgbaImage, x0: number, x1: number, y0: number, y1: number): { alert: number; ok: number } {
  let alert = 0;
  let ok = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0, i = (y * img.width + x0) * 4; x < x1; x++, i += 4) {
      const cls = hueClass(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
      if (cls === 'alert') alert++;
      else if (cls === 'ok') ok++;
    }
  }
  return { alert, ok };
}

/**
 * Satır kutusunun (görüntü pikseli) içindeki ve solundaki durum simgesinin renkli piksellerinden işareti
 * çıkarır. Simge kutunun içinde değilse (OCR okumadıysa) soldaki en yakın renkli leke alınır; lekeden sonra
 * durulur ki yan yana birleştirilmiş tablolarda komşu tablonun pembe hücresi sayılmasın. Yalnızca bir renk
 * açıkça baskınsa karar verilir.
 */
export function markInRegion(img: RgbaImage, box: { x: number; y: number; w: number; h: number }): ReportMark | undefined {
  const h = Math.max(1, box.h);
  const x0 = Math.max(0, Math.floor(box.x));
  const x1 = Math.min(img.width, Math.ceil(box.x + box.w));
  const y0 = Math.max(0, Math.floor(box.y + 0.15 * h));
  const y1 = Math.min(img.height, Math.ceil(box.y + 0.85 * h));
  if (x1 <= x0 || y1 <= y0) return undefined;
  // Simge yaklaşık yazı yüksekliğinde bir daire; daha azı JPEG gürültüsüdür.
  const need = Math.max(4, 0.12 * h * h);
  const total = count(img, x0, x1, y0, y1);
  const head = count(img, x0, Math.min(x1, x0 + Math.ceil(2 * h)), y0, y1);
  if (head.alert + head.ok < need) {
    const minCol = Math.max(2, Math.round(0.1 * (y1 - y0)));
    let inBlob = false;
    for (let x = x0 - 1; x >= Math.max(0, Math.floor(box.x - 7 * h)); x--) {
      const c = count(img, x, x + 1, y0, y1);
      if (c.alert + c.ok >= minCol) {
        inBlob = true;
        total.alert += c.alert;
        total.ok += c.ok;
      } else if (inBlob) {
        break;
      }
    }
  }
  if (total.alert >= need && total.alert > 3 * total.ok) return 'out';
  if (total.ok >= need && total.ok > 3 * total.alert) return 'in';
  return undefined;
}

/** Taslaktaki tüm satır kutuları (tanınan ve tanınmayan). */
function boxesOf(draft: ReportDraft): SourceBox[] {
  return [...draft.rows.map((r) => r.source), ...draft.unrecognized.map((u) => u.source)].filter((b) => b.w > 0 && b.h > 0);
}

/** Tuvalin piksellerini okur ve tuvali bırakır (telefonda bellek). */
function readCanvas(canvas: HTMLCanvasElement): RgbaImage | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx ? { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height } : null;
  canvas.width = 0;
  canvas.height = 0;
  return img;
}

/** Fotoğraf / ekran görüntüsü: satır kutuları özgün piksel koordinatındadır (EXIF yönü uygulanmış). */
export async function imageMarks(bytes: Uint8Array<ArrayBuffer>, mimeType: string, draft: ReportDraft): Promise<Map<SourceBox, ReportMark>> {
  const out = new Map<SourceBox, ReportMark>();
  const boxes = boxesOf(draft);
  if (!boxes.length) return out;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }), { imageOrientation: 'from-image' });
    const k = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const img = readCanvas(canvas);
    if (!img) return out;
    for (const b of boxes) {
      const m = markInRegion(img, { x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k });
      if (m) out.set(b, m);
    }
  } catch {
    // İşaretler yalnızca teyit içindir; okunamazsa sonuçlar işaretsiz değerlendirilir.
  }
  return out;
}

/** PDF: satır kutuları sayfa biriminde (pt); yalnızca satır içeren sayfalar çizilir. */
export async function pdfMarks(getPage: (n: number) => Promise<PDFPageProxy>, draft: ReportDraft): Promise<Map<SourceBox, ReportMark>> {
  const out = new Map<SourceBox, ReportMark>();
  const boxes = boxesOf(draft);
  const scale = 1.5;
  for (const p of [...new Set(boxes.map((b) => b.page))]) {
    try {
      const page = await getPage(p);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      await page.render({ canvas, viewport: vp }).promise;
      const img = readCanvas(canvas);
      if (!img) continue;
      for (const b of boxes.filter((x) => x.page === p)) {
        const m = markInRegion(img, { x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale });
        if (m) out.set(b, m);
      }
    } catch {
      // Sayfa çizilemezse o sayfanın satırları işaretsiz kalır.
    }
  }
  return out;
}
