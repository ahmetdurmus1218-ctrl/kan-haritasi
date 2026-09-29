import { describe, expect, it } from 'vitest';
import { isGrayAfterCast, reviewImage, rotateImage, splitPanels } from '../review';

/** Yapay eksenel "baş" kesiti: parlak cilt halkası, dokulu simetrik beyin, orta hatta koyu ventrikül. */
function head(w: number, h: number, opts: { lesion?: { x: number; y: number; r: number; v: number }; tilt?: number; profile?: boolean } = {}): Float32Array {
  const img = new Float32Array(w * h);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.36;
  const ry = h * 0.44;
  const t = ((opts.tilt ?? 0) * Math.PI) / 180;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx0 = x - cx;
      const dy0 = y - cy;
      const dx = dx0 * Math.cos(t) + dy0 * Math.sin(t);
      const dy = -dx0 * Math.sin(t) + dy0 * Math.cos(t);
      // Yan kesit benzeri: bir tarafa çıkıntı (yüz) eklenir, şekil simetrik olmaz.
      const e = (dx / rx) ** 2 + (dy / ry) ** 2;
      // Yan kesit benzeri: sol altta yüz/boyun çıkıntısı; dış şekil simetrik olmaz.
      const neck = opts.profile && dx < -w * 0.02 && dx > -w * 0.46 && dy > 0 && dy < h * 0.47;
      if (e > 1 && !neck) continue;
      let v = e > 0.82 ? 220 : 120 + 25 * Math.cos(Math.abs(dx) * 0.35) * Math.cos(dy * 0.3);
      if (Math.abs(dx) < w * 0.05 && Math.abs(dy) < h * 0.12) v = 40;
      if (opts.lesion) {
        const l = opts.lesion;
        if ((x - l.x) ** 2 + (y - l.y) ** 2 < l.r * l.r) v = l.v;
      }
      img[y * w + x] = v;
    }
  return img;
}

function collage(parts: Float32Array[], w: number, h: number, gap = 12): { img: Float32Array; W: number; H: number } {
  const W = parts.length * w + (parts.length - 1) * gap;
  const img = new Float32Array(W * h);
  parts.forEach((p, k) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img[y * W + k * (w + gap) + x] = p[y * w + x]!;
  });
  return { img, W, H: h };
}

describe('görüntü incelemesi (sağ-sol karşılaştırması)', () => {
  it('simetrik kesitte dikkat bölgesi işaretlemez', () => {
    const r = reviewImage(head(200, 240), 200, 240);
    expect(r.panels).toHaveLength(1);
    expect(r.panels[0]!.kind).toBe('symmetric');
    expect(r.flagged).toBe(0);
    expect(r.headLike).toBe(true);
  });

  it('tek taraftaki parlak odağı doğru yarıda ve konumda bulur', () => {
    const r = reviewImage(head(200, 240, { lesion: { x: 62, y: 90, r: 14, v: 245 } }), 200, 240);
    const reg = r.panels[0]!.regions;
    expect(reg.length).toBeGreaterThanOrEqual(1);
    expect(reg[0]!.side).toBe('left');
    expect(reg[0]!.brighter).toBe(true);
    expect(reg[0]!.vertical).not.toBe('bottom');
    // Kutu gerçek odağı içerir.
    expect(reg[0]!.x).toBeLessThanOrEqual(62);
    expect(reg[0]!.x + reg[0]!.w).toBeGreaterThanOrEqual(62);
  });

  it('eğik başta orta hattı bulur ve koyu odağı sağda işaretler', () => {
    const r = reviewImage(head(200, 240, { tilt: 8, lesion: { x: 140, y: 150, r: 14, v: 10 } }), 200, 240);
    const p = r.panels[0]!;
    expect(p.kind).toBe('symmetric');
    const [x1, y1, x2, y2] = p.midline!;
    const deg = (Math.atan2(x2 - x1, y2 - y1) * 180) / Math.PI;
    expect(Math.abs(Math.abs(deg) - 8)).toBeLessThan(3.5);
    expect(p.regions.some((g) => g.side === 'right' && !g.brighter)).toBe(true);
  });

  it('kolajı kesitlere ayırır; yan (simetrik olmayan) kesitte karşılaştırma yapmaz', () => {
    const { img, W, H } = collage([head(160, 190), head(160, 190, { profile: true })], 160, 190);
    expect(splitPanels(img.map((v) => v / 255), W, H)).toHaveLength(2);
    const r = reviewImage(img, W, H);
    expect(r.panels.map((p) => p.kind)).toEqual(['symmetric', 'asymmetric-shape']);
    expect(r.compared).toBe(1);
  });

  it('telefonla eğik çekilmiş, gri çerçeveli kolajda da kesitleri ayırır', () => {
    const w = 160;
    const h = 190;
    const gap = 3;
    const parts = [head(w, h), head(w, h, { lesion: { x: 50, y: 70, r: 12, v: 245 } }), head(w, h)];
    const { img, W, H } = collage(parts, w, h, gap);
    // Kesitler arası ince açık çizgi, çevrede gri çerçeve, sonra 5° eğiklik
    for (const k of [1, 2]) for (let y = 0; y < H; y++) for (let x = 0; x < gap; x++) img[y * W + k * (w + gap) - gap + x] = 140;
    const FW = W + 120;
    const FH = H + 120;
    const framed = new Float32Array(FW * FH).fill(70);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) framed[(y + 60) * FW + x + 60] = img[y * W + x]!;
    const tilted = rotateImage(framed, FW, FH, 5, 70);
    const r = reviewImage(tilted, FW, FH);
    expect(Math.abs(r.angle)).toBeGreaterThanOrEqual(3);
    expect(r.panels.filter((p) => p.kind === 'symmetric')).toHaveLength(3);
    expect(r.flagged).toBe(1);
  });

  it('renk kayması olan gri fotoğraf gri sayılır, renkli fotoğraf sayılmaz', () => {
    const n = 64 * 64;
    const tinted = new Uint8ClampedArray(n * 4);
    const colorful = new Uint8ClampedArray(n * 4);
    for (let p = 0; p < n; p++) {
      const v = (p * 37) % 256;
      tinted.set([Math.round(v * 0.9), v, Math.min(255, v + 14), 255], p * 4);
      colorful.set([(p * 7) % 256, (p * 13) % 256, (p * 29) % 256, 255], p * 4);
    }
    expect(isGrayAfterCast(tinted)).toBe(true);
    expect(isGrayAfterCast(colorful)).toBe(false);
  });

  it('boş görüntüde kesit bulmaz', () => {
    const r = reviewImage(new Float32Array(100 * 100), 100, 100);
    expect(r.panels).toHaveLength(0);
    expect(r.headLike).toBe(false);
  });
});
