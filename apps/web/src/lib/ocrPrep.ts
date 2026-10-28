/**
 * OCR öncesi görüntü hesapları (tarayıcıdan bağımsız; testlerde de kullanılır). Girdi gri ton parlaklık
 * dizisidir (0–255, satır satır).
 */

/**
 * Yazı yüksekliği `estimateTextHeight` ölçüsüyle (mürekkepli satır bloğu, yaklaşık büyük harf boyu).
 * Bunun altındaki yazıda Tesseract ondalık noktalarını ve ince harfleri kaçırır (ör. telefonda küçültülmüş
 * ekran görüntüsü kolajı: ~10 px); görüntü hedef boya büyütülür.
 */
export const MIN_TEXT_PX = 16;
export const TARGET_TEXT_PX = 24;
/** Büyütmede tuvalin uzun kenarı en fazla (telefon belleği). */
export const MAX_UPSCALED_EDGE = 4000;

/** Küçük yazı için büyütme oranı (1 = büyütme yok). */
export function textUpscale(textHeight: number | null, longEdge: number): number {
  if (textHeight === null || textHeight >= MIN_TEXT_PX) return 1;
  return Math.max(1, Math.min(TARGET_TEXT_PX / textHeight, MAX_UPSCALED_EDGE / longEdge, 3));
}

/** Parlaklık dizisinin ortancası (çoğu belgede arka plan). */
export function medianLuminance(lum: ArrayLike<number>): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < lum.length; i++) hist[Math.max(0, Math.min(255, Math.round(lum[i]!)))]!++;
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += hist[v]!;
    if (seen * 2 >= lum.length) return v;
  }
  return 255;
}

/**
 * Yazı satırı yüksekliğinin tahmini (piksel): görüntü dikey şeritlere bölünür, her şeritte mürekkep içeren
 * ardışık satır blokları ölçülür, ortanca alınır. Şeritler, yan yana duran ve satırları aynı hizada olmayan
 * tabloların (ekran görüntüsü kolajı) blokları birleştirmesini önler. Açık zeminli olmayan ya da yeterince
 * satır bulunamayan görüntüde null.
 */
export function estimateTextHeight(lum: ArrayLike<number>, w: number, h: number): number | null {
  const bg = medianLuminance(lum);
  if (bg < 150) return null;
  const ink = bg * 0.6;
  const strips = Math.max(1, Math.min(6, Math.round(w / 250)));
  const heights: number[] = [];
  for (let s = 0; s < strips; s++) {
    const x0 = Math.floor((s * w) / strips);
    const x1 = Math.floor(((s + 1) * w) / strips);
    const need = Math.max(2, (x1 - x0) * 0.004);
    let run = 0;
    for (let y = 0; y <= h; y++) {
      let n = 0;
      if (y < h) for (let x = x0, i = y * w + x0; x < x1 && n < need; x++, i++) if (lum[i]! < ink) n++;
      if (y < h && n >= need) run++;
      else {
        if (run >= 4 && run <= h * 0.1) heights.push(run);
        run = 0;
      }
    }
  }
  if (heights.length < 5) return null;
  heights.sort((a, b) => a - b);
  return heights[Math.floor(heights.length / 2)]!;
}

/** RGBA → parlaklık dizisi. */
export function luminanceOf(rgba: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) out[j] = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
  return out;
}
