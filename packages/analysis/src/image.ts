/** Küçük görüntü yardımcıları (saf fonksiyonlar; tarayıcıda ve Node'da aynı çalışır). */
import type { RasterImage } from './types';

export function percentile(values: ArrayLike<number>, p: number): number {
  const a = Float32Array.from(values as ArrayLike<number>).sort();
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]!;
}

/** RGBA → gri ton (BT.601). */
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let p = 0; p < out.length; p++) out[p] = 0.299 * rgba[p * 4]! + 0.587 * rgba[p * 4 + 1]! + 0.114 * rgba[p * 4 + 2]!;
  return out;
}

export function rasterFromRgba(rgba: Uint8ClampedArray, width: number, height: number): RasterImage {
  return { width, height, rgba, gray: rgbaToGray(rgba, width, height) };
}

/** 0–1 aralığına dayanıklı normalleştirme (1. ve 99,5. yüzdelik). */
export function normalize01(data: Float32Array): Float32Array {
  const step = Math.max(1, Math.floor(data.length / 50000));
  const sample: number[] = [];
  for (let i = 0; i < data.length; i += step) sample.push(data[i]!);
  const lo = percentile(sample, 0.01);
  const hi = percentile(sample, 0.995);
  const k = hi > lo ? 1 / (hi - lo) : 1;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Math.min(1, Math.max(0, (data[i]! - lo) * k));
  return out;
}

/** Alan ortalamalı küçültme: uzun kenar en fazla `max` piksel. */
export function downsample(data: Float32Array, width: number, height: number, max: number): { data: Float32Array; width: number; height: number; scale: number } {
  const k = Math.min(1, max / Math.max(width, height));
  if (k === 1) return { data, width, height, scale: 1 };
  const w = Math.max(1, Math.round(width * k));
  const h = Math.max(1, Math.round(height * k));
  const out = new Float32Array(w * h);
  const fx = width / w;
  const fy = height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let s = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          s += data[yy * width + xx]!;
          n++;
        }
      out[y * w + x] = n ? s / n : 0;
    }
  }
  return { data: out, width: w, height: h, scale: k };
}

/** RGBA'yı küçültür (en yakın komşu; renk istatistikleri için yeterli). */
export function downsampleRgba(rgba: Uint8ClampedArray, width: number, height: number, max: number): { rgba: Uint8ClampedArray; width: number; height: number; scale: number } {
  const k = Math.min(1, max / Math.max(width, height));
  if (k === 1) return { rgba, width, height, scale: 1 };
  const w = Math.max(1, Math.round(width * k));
  const h = Math.max(1, Math.round(height * k));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) / k));
      const sy = Math.min(height - 1, Math.floor((y + 0.5) / k));
      const s = (sy * width + sx) * 4;
      const d = (y * w + x) * 4;
      out[d] = rgba[s]!;
      out[d + 1] = rgba[s + 1]!;
      out[d + 2] = rgba[s + 2]!;
      out[d + 3] = rgba[s + 3]!;
    }
  return { rgba: out, width: w, height: h, scale: k };
}

/** RGB → ton (0–360), doygunluk (0–1), parlaklık (0–1). */
export function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}

/** Sinyalin özilinti (autocorrelation) dizisi (ortalaması çıkarılmış, 0. gecikmeye göre normalize). */
export function autocorrelation(signal: ArrayLike<number>, maxLag: number): Float32Array {
  const n = signal.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += signal[i]!;
  mean /= n || 1;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = signal[i]! - mean;
  let v0 = 0;
  for (let i = 0; i < n; i++) v0 += c[i]! * c[i]!;
  const out = new Float32Array(maxLag + 1);
  if (!v0) return out;
  for (let lag = 0; lag <= maxLag && lag < n; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += c[i]! * c[i + lag]!;
    out[lag] = s / v0;
  }
  return out;
}
