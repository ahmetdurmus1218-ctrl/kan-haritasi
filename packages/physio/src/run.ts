import type { Params, Sample, SimModel } from './types';

/** Modelin tipik (normal) parametreleri. */
export function defaultParams(model: SimModel): Params {
  return Object.fromEntries(model.params.map((d) => [d.key, d.value]));
}

/** Parametreleri tanımlı aralığa sıkıştırır; bilinmeyen anahtarlar atılır, eksikler tipik değerle doldurulur. */
export function clampParams(model: SimModel, p: Params): Params {
  const out: Params = {};
  for (const d of model.params) {
    const v = p[d.key];
    out[d.key] = typeof v === 'number' && Number.isFinite(v) ? Math.min(d.max, Math.max(d.min, v)) : d.value;
  }
  return out;
}

export function scenarioParams(model: SimModel, scenarioId: string | undefined): Params {
  const base = defaultParams(model);
  const s = model.scenarios.find((x) => x.id === scenarioId);
  return s ? clampParams(model, { ...base, ...s.set }) : base;
}

/** Klasik 4. derece Runge–Kutta adımı (yerinde değil; yeni durum döner). */
export function rk4(f: (t: number, y: number[]) => number[], t: number, y: number[], h: number): number[] {
  const n = y.length;
  const k1 = f(t, y);
  const y2 = new Array<number>(n);
  for (let i = 0; i < n; i++) y2[i] = y[i]! + (h / 2) * k1[i]!;
  const k2 = f(t + h / 2, y2);
  const y3 = new Array<number>(n);
  for (let i = 0; i < n; i++) y3[i] = y[i]! + (h / 2) * k2[i]!;
  const k3 = f(t + h / 2, y3);
  const y4 = new Array<number>(n);
  for (let i = 0; i < n; i++) y4[i] = y[i]! + h * k3[i]!;
  const k4 = f(t + h, y4);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = y[i]! + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!);
  return out;
}

export interface SimResult {
  samples: Sample[];
  /** Sayısal kararsızlık (NaN/sonsuz) görüldüyse true: sonuç gösterilmez. */
  unstable: boolean;
}

/** Modeli baştan sona çözer (deterministik). Arayüz bu çözümü zaman imleciyle oynatır. */
export function simulate(model: SimModel, params: Params): SimResult {
  const p = clampParams(model, params);
  let y = model.init(p);
  const steps = Math.round(model.duration / model.dt);
  const every = Math.max(1, Math.round(model.sampleEvery / model.dt));
  const samples: Sample[] = [];
  const f = (t: number, s: number[]) => model.deriv(t, s, p);
  let unstable = false;
  for (let i = 0; i <= steps; i++) {
    const t = i * model.dt;
    if (i % every === 0) {
      const v = model.observe(t, y, p);
      if (Object.values(v).some((x) => !Number.isFinite(x))) {
        unstable = true;
        break;
      }
      samples.push({ t, v, ...(model.phase ? { phase: model.phase(t, y, p) } : {}) });
    }
    if (i === steps) break;
    y = rk4(f, t, y, model.dt);
    model.after?.(t + model.dt, y, p, model.dt);
  }
  return { samples, unstable };
}

/** t anına en yakın örnek (ikili arama). */
export function sampleAt(samples: Sample[], t: number): Sample | undefined {
  if (!samples.length) return undefined;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  const a = samples[Math.max(0, lo - 1)]!;
  const b = samples[lo]!;
  return Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b;
}

export const maxOf = (s: Sample[], key: string): number => s.reduce((m, x) => Math.max(m, x.v[key] ?? -Infinity), -Infinity);
export const minOf = (s: Sample[], key: string): number => s.reduce((m, x) => Math.min(m, x.v[key] ?? Infinity), Infinity);
export const meanOf = (s: Sample[], key: string): number => (s.length ? s.reduce((m, x) => m + (x.v[key] ?? 0), 0) / s.length : NaN);
export const lastOf = (s: Sample[], key: string): number => s[s.length - 1]?.v[key] ?? NaN;
/** Serinin ilk kez eşiği geçtiği an (yoksa NaN). */
export function firstCross(s: Sample[], key: string, level: number, dir: 'up' | 'down' = 'up'): number {
  for (const x of s) {
    const v = x.v[key];
    if (v === undefined) continue;
    if (dir === 'up' ? v >= level : v <= level) return x.t;
  }
  return NaN;
}
/** Tepe anı. */
export function argMax(s: Sample[], key: string): number {
  let best = -Infinity;
  let t = NaN;
  for (const x of s) {
    const v = x.v[key] ?? -Infinity;
    if (v > best) {
      best = v;
      t = x.t;
    }
  }
  return t;
}
