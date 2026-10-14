import { describe, expect, it } from 'vitest';
import { PIXEL_TEXT_WARNING, burnedInRisk, parseDicom, scanBurnedInText, scanDicomPixels } from '../index';
import { imageElements, u16Pixels, writeDicom } from './dicomWriter';

/** Koyu zemin + ortada yuvarlak "doku" (yazı yok). */
function phantom(w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2, y - h / 2) / (Math.min(w, h) / 2);
      g[y * w + x] = d < 0.8 ? 600 + 300 * Math.cos(d * 3) : 0;
    }
  return g;
}

/** 5×7 piksellik basit "harf" blokları: dikey/yatay çizgiler (yazıya benzer, okunmaz). */
function stampText(g: Float32Array, w: number, x0: number, y0: number, chars: number, scale = 2, value = 4095) {
  const glyphs = [
    ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    ['01110', '10001', '10000', '01110', '00001', '10001', '01110'],
    ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  ];
  for (let c = 0; c < chars; c++) {
    const gl = glyphs[c % glyphs.length]!;
    for (let r = 0; r < 7; r++)
      for (let k = 0; k < 5; k++)
        if (gl[r]![k] === '1')
          for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) g[(y0 + r * scale + sy) * w + x0 + (c * 6 + k) * scale + sx] = value;
  }
}

describe('görüntüye yakılmış yazı — piksel kontrolü (kural tabanlı)', () => {
  it('köşedeki yazıya benzer alanı bulur ve "Görüntü içinde kişisel bilgi bulunabilir." der', () => {
    const w = 256;
    const h = 256;
    const g = phantom(w, h);
    stampText(g, w, 6, 6, 9);
    const scan = scanBurnedInText(g, w, h);
    expect(scan.status).toBe('detected');
    expect(scan.regions[0]!.where).toBe('sol üst');
    expect(scan.reason.startsWith(PIXEL_TEXT_WARNING)).toBe(true);
    // Alt şeritte de
    const g2 = phantom(w, h);
    stampText(g2, w, 140, 240, 8);
    expect(scanBurnedInText(g2, w, h).regions.map((r) => r.where)).toContain('sağ alt');
  });

  it('yazısız görüntüde "bulunmadı" der ama garanti vermez; küçük görüntüde değerlendirmez', () => {
    const scan = scanBurnedInText(phantom(256, 256), 256, 256);
    expect(scan.status).toBe('none');
    expect(scan.reason).toMatch(/garanti etmez/);
    expect(scanBurnedInText(new Float32Array(16), 4, 4).status).toBe('not-assessed');
  });

  it('meta veri + piksel birlikte: başlık "NO" dese de piksellerde yazı varsa "olası"', () => {
    const w = 128;
    const g = phantom(w, w);
    stampText(g, w, 4, 4, 6, 1);
    const pixels = u16Pixels(Array.from(g, (v) => Math.round(v)));
    const bytes = writeDicom(imageElements({ rows: w, cols: w, pixels, extra: [{ g: 0x0028, e: 0x0301, vr: 'CS', value: 'NO' }] }));
    const info = parseDicom(bytes);
    const scan = scanDicomPixels(bytes, info);
    expect(scan.status).toBe('detected');
    const risk = burnedInRisk(info, scan);
    expect(risk.level).toBe('possible');
    expect(risk.reason).toContain(PIXEL_TEXT_WARNING);
    expect(risk.reason).toContain('başlığı yazı olmadığını bildiriyor');
    // Temiz görüntü + başlık NO → no (piksel kontrolü de bulmadı)
    const clean = writeDicom(imageElements({ rows: w, cols: w, pixels: u16Pixels(Array.from(phantom(w, w), (v) => Math.round(v))), extra: [{ g: 0x0028, e: 0x0301, vr: 'CS', value: 'NO' }] }));
    const ci = parseDicom(clean);
    expect(burnedInRisk(ci, scanDicomPixels(clean, ci))).toMatchObject({ level: 'no' });
  });
});
