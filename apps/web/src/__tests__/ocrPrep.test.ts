import { describe, expect, it } from 'vitest';
import { MAX_UPSCALED_EDGE, estimateTextHeight, textUpscale } from '../lib/ocrPrep';

/** Açık zeminde `lineH` piksel yüksekliğinde "yazı satırları" (koyu kesik çizgiler). */
function page(w: number, h: number, lineH: number, bg = 242, ink = 40): Uint8Array {
  const lum = new Uint8Array(w * h).fill(bg);
  for (let top = 30; top + lineH < h; top += lineH * 2 + 8) {
    for (let y = top; y < top + lineH; y++) for (let x = 20; x < w - 20; x++) if (x % 7 < 3) lum[y * w + x] = ink;
  }
  return lum;
}

describe('OCR ön işleme hesapları', () => {
  it('yazı satırı yüksekliğini ölçer', () => {
    expect(estimateTextHeight(page(1500, 800, 10), 1500, 800)).toBe(10);
    expect(estimateTextHeight(page(1500, 800, 26), 1500, 800)).toBe(26);
  });

  it('koyu zeminde (karanlık tema, röntgen) ölçmez', () => {
    expect(estimateTextHeight(page(800, 600, 12, 20, 230), 800, 600)).toBeNull();
  });

  it('yalnızca küçük yazıyı büyütür; tuval sınırını aşmaz', () => {
    expect(textUpscale(26, 2000)).toBe(1);
    expect(textUpscale(null, 2000)).toBe(1);
    expect(textUpscale(12, 1500)).toBe(2);
    expect(textUpscale(10, 2000)).toBe(MAX_UPSCALED_EDGE / 2000);
  });
});
