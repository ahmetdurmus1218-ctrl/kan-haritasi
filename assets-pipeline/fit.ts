/**
 * İki farklı referans vücut arasında parça uyumu (erkek → kadın, BodyParts3D → HRA).
 *
 * 1. Eklemli kol/bacak uyumu: tek bir benzerlik dönüşümü (omurga + leğen noktalarına göre) gövdeyi
 *    iyi taşır ama kol ve bacak duruşu iki vücutta farklıdır (VH kadın referansında kollar gövdeden
 *    daha açık). Her kol/bacak parçası (üst kol, ön kol, el, uyluk, bacak, ayak) kendi ekleminin
 *    etrafında döndürülerek hedef derinin içine oturtulur; parçalar zincir hâlinde (omuz → dirsek →
 *    bilek) çözülür. Kemikler parça başına katı taşınır; kas, damar ve sinir noktaları en yakın
 *    kemiklere göre yumuşak ağırlıklarla (doğrusal harmanlama) taşınır, eklemlerde kopukluk olmaz.
 * 2. Diz: HRA diz kıkırdağı, menisküs ve bağları kemik yüzeyine katı ICP ile oturtulur.
 *
 * El ve ayak için küçük bir tekdüze ölçek (bilek/ayak bileği merkezli) de aranır: iki vücudun el-ayak
 * boyu farklıdır.
 *
 * Bütün hesaplar metre cinsinden, HRA eksenlerinde (+Y yukarı, +X kişinin solu, +Z ön).
 */

export type V3 = [number, number, number];
export type M3 = [V3, V3, V3];

export interface Rigid {
  R: M3;
  t: V3;
}

export const IDENTITY: Rigid = {
  R: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  t: [0, 0, 0],
};

export const apply = (T: Rigid, p: V3): V3 => [
  T.R[0][0] * p[0] + T.R[0][1] * p[1] + T.R[0][2] * p[2] + T.t[0],
  T.R[1][0] * p[0] + T.R[1][1] * p[1] + T.R[1][2] * p[2] + T.t[1],
  T.R[2][0] * p[0] + T.R[2][1] * p[1] + T.R[2][2] * p[2] + T.t[2],
];

const mulM = (a: M3, b: M3): M3 => [0, 1, 2].map((r) => [0, 1, 2].map((c) => a[r]![0] * b[0]![c]! + a[r]![1] * b[1]![c]! + a[r]![2] * b[2]![c]!)) as M3;
const mulV = (a: M3, v: V3): V3 => [a[0][0] * v[0] + a[0][1] * v[1] + a[0][2] * v[2], a[1][0] * v[0] + a[1][1] * v[1] + a[1][2] * v[2], a[2][0] * v[0] + a[2][1] * v[1] + a[2][2] * v[2]];

/** a ∘ b (önce b, sonra a). */
export function compose(a: Rigid, b: Rigid): Rigid {
  const R = mulM(a.R, b.R);
  const t = mulV(a.R, b.t);
  return { R, t: [t[0] + a.t[0], t[1] + a.t[1], t[2] + a.t[2]] };
}

/** Pivot noktası etrafında dönme. */
export function aboutPivot(R: M3, pivot: V3): Rigid {
  const rp = mulV(R, pivot);
  return { R, t: [pivot[0] - rp[0], pivot[1] - rp[1], pivot[2] - rp[2]] };
}

/** Eksen-açı → dönme matrisi. */
export function axisAngle(axis: V3, angle: number): M3 {
  const l = Math.hypot(...axis) || 1;
  const [x, y, z] = [axis[0] / l, axis[1] / l, axis[2] / l];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const C = 1 - c;
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
}

export function rotationAngle(R: M3): number {
  return Math.acos(Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)));
}

/* ------------------------------------------------------------------ en yakın nokta ızgarası */

export class PointGrid {
  private cells = new Map<number, number[]>();
  constructor(
    readonly pts: Float32Array,
    private readonly size = 0.01,
  ) {
    for (let i = 0; i < pts.length / 3; i++) {
      const k = this.key(pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!);
      const list = this.cells.get(k);
      if (list) list.push(i);
      else this.cells.set(k, [i]);
    }
  }
  private cell(v: number) {
    return Math.floor(v / this.size);
  }
  private keyOf(x: number, y: number, z: number) {
    return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  }
  private key(x: number, y: number, z: number) {
    return this.keyOf(this.cell(x), this.cell(y), this.cell(z));
  }
  /** En yakın nokta (maxR içinde yoksa null). */
  nearest(p: V3, maxR = 0.1): { i: number; d: number } | null {
    const cx = this.cell(p[0]);
    const cy = this.cell(p[1]);
    const cz = this.cell(p[2]);
    let best = -1;
    let bd = Infinity;
    const rings = Math.ceil(maxR / this.size);
    for (let r = 0; r <= rings; r++) {
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
            const list = this.cells.get(this.keyOf(cx + dx, cy + dy, cz + dz));
            if (!list) continue;
            for (const i of list) {
              const d = (this.pts[i * 3]! - p[0]) ** 2 + (this.pts[i * 3 + 1]! - p[1]) ** 2 + (this.pts[i * 3 + 2]! - p[2]) ** 2;
              if (d < bd) {
                bd = d;
                best = i;
              }
            }
          }
      // Bu halkadan sonra daha yakını olamaz
      if (best >= 0 && Math.sqrt(bd) <= r * this.size) break;
    }
    return best >= 0 && Math.sqrt(bd) <= maxR ? { i: best, d: Math.sqrt(bd) } : null;
  }
  /** r yarıçapı içindeki her nokta için cb(i, d). */
  within(p: V3, r: number, cb: (i: number, d: number) => void) {
    const n = Math.ceil(r / this.size);
    const cx = this.cell(p[0]);
    const cy = this.cell(p[1]);
    const cz = this.cell(p[2]);
    for (let dx = -n; dx <= n; dx++)
      for (let dy = -n; dy <= n; dy++)
        for (let dz = -n; dz <= n; dz++) {
          const list = this.cells.get(this.keyOf(cx + dx, cy + dy, cz + dz));
          if (!list) continue;
          for (const i of list) {
            const d = Math.hypot(this.pts[i * 3]! - p[0], this.pts[i * 3 + 1]! - p[1], this.pts[i * 3 + 2]! - p[2]);
            if (d <= r) cb(i, d);
          }
        }
  }
  point(i: number): V3 {
    return [this.pts[i * 3]!, this.pts[i * 3 + 1]!, this.pts[i * 3 + 2]!];
  }
}

/* ------------------------------------------------------------------ deri hacmi */

/** Üçgen çorbasından (her 9 sayı bir üçgen) iç/dış testi yapılabilen voksel hacim. */
export class Volume {
  private g: Uint8Array;
  private nx: number;
  private ny: number;
  private nz: number;
  private min: V3;
  readonly surface: PointGrid;
  constructor(
    tris: Float32Array,
    private readonly r = 0.005,
  ) {
    const lo: V3 = [Infinity, Infinity, Infinity];
    const hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tris.length; i += 3)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k]!, tris[i + k]!);
        hi[k] = Math.max(hi[k]!, tris[i + k]!);
      }
    this.min = [lo[0] - 0.02, lo[1] - 0.02, lo[2] - 0.02];
    this.nx = Math.ceil((hi[0] - lo[0] + 0.04) / r);
    this.ny = Math.ceil((hi[1] - lo[1] + 0.04) / r);
    this.nz = Math.ceil((hi[2] - lo[2] + 0.04) / r);
    this.g = new Uint8Array(this.nx * this.ny * this.nz);
    const surf: number[] = [];
    for (let t = 0; t < tris.length; t += 9) {
      const A: V3 = [tris[t]!, tris[t + 1]!, tris[t + 2]!];
      const B: V3 = [tris[t + 3]!, tris[t + 4]!, tris[t + 5]!];
      const C: V3 = [tris[t + 6]!, tris[t + 7]!, tris[t + 8]!];
      const e = Math.max(Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]), Math.hypot(B[0] - C[0], B[1] - C[1], B[2] - C[2]), Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]));
      const n = Math.ceil(e / (r * 0.45)) + 1;
      for (let i = 0; i <= n; i++)
        for (let j = 0; j <= n - i; j++) {
          const u = i / n;
          const v = j / n;
          const p: V3 = [0, 1, 2].map((k) => A[k]! * (1 - u - v) + B[k]! * u + C[k]! * v) as V3;
          const idx = this.index(p);
          if (idx >= 0 && !this.g[idx]) {
            this.g[idx] = 1;
            surf.push(...p);
          }
        }
    }
    // Dış bölgeyi köşeden doldur: ulaşılamayan hücreler içeridedir.
    const { nx, ny, nz } = this;
    const stack = [0];
    this.g[0] = 2;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % nx;
      const rest = (p - x) / nx;
      const z = rest % nz;
      const y = (rest - z) / nz;
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ] as const) {
        const X = x + dx;
        const Y = y + dy;
        const Z = z + dz;
        if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
        const q = (Y * nz + Z) * nx + X;
        if (!this.g[q]) {
          this.g[q] = 2;
          stack.push(q);
        }
      }
    }
    this.surface = new PointGrid(Float32Array.from(surf), 0.01);
  }
  private index(p: V3): number {
    const x = Math.floor((p[0] - this.min[0]) / this.r);
    const y = Math.floor((p[1] - this.min[1]) / this.r);
    const z = Math.floor((p[2] - this.min[2]) / this.r);
    if (x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz) return -1;
    return (y * this.nz + z) * this.nx + x;
  }
  inside(p: V3): boolean {
    const i = this.index(p);
    return i >= 0 && this.g[i] !== 2;
  }
}

/* ------------------------------------------------------------------ Horn (dönme / katı) */

/** src → dst en küçük kareler dönmesi (merkezler çıkarılmış noktalar). Horn'un dördey yöntemi. */
function hornRotation(src: V3[], dst: V3[], cs: V3, cd: V3): M3 {
  let Sxx = 0,
    Sxy = 0,
    Sxz = 0,
    Syx = 0,
    Syy = 0,
    Syz = 0,
    Szx = 0,
    Szy = 0,
    Szz = 0;
  for (let i = 0; i < src.length; i++) {
    const a = [src[i]![0] - cs[0], src[i]![1] - cs[1], src[i]![2] - cs[2]];
    const b = [dst[i]![0] - cd[0], dst[i]![1] - cd[1], dst[i]![2] - cd[2]];
    Sxx += a[0]! * b[0]!;
    Sxy += a[0]! * b[1]!;
    Sxz += a[0]! * b[2]!;
    Syx += a[1]! * b[0]!;
    Syy += a[1]! * b[1]!;
    Syz += a[1]! * b[2]!;
    Szx += a[2]! * b[0]!;
    Szy += a[2]! * b[1]!;
    Szz += a[2]! * b[2]!;
  }
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  // En büyük özdeğerin özvektörü: kaydırılmış kuvvet yöntemi
  const shift = Math.abs(Sxx) + Math.abs(Syy) + Math.abs(Szz) + Math.abs(Sxy) + Math.abs(Sxz) + Math.abs(Syx) + Math.abs(Syz) + Math.abs(Szx) + Math.abs(Szy) + 1e-9;
  let q = [1, 0, 0, 0];
  for (let it = 0; it < 200; it++) {
    const nq = [0, 1, 2, 3].map((r) => N[r]!.reduce((s, v, c) => s + v * q[c]!, 0) + shift * q[r]!);
    const l = Math.hypot(...nq);
    q = nq.map((v) => v / l);
  }
  const [w, x, y, z] = q as [number, number, number, number];
  return [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ];
}

const centroid = (pts: V3[]): V3 => {
  const c: V3 = [0, 0, 0];
  for (const p of pts) for (let k = 0; k < 3; k++) c[k]! += p[k]! / pts.length;
  return c;
};

/**
 * Katı ICP: src noktaları hedef yüzeye (grid) yaklaştırılır. `gate` kademeli daralır.
 * Dönüş: toplam dönüşüm ve ortalama artık.
 */
export function icp(src: V3[], target: PointGrid, gates = [0.04, 0.025, 0.015, 0.01], iters = 12): { T: Rigid; residual: number } {
  let T = IDENTITY;
  let residual = Infinity;
  for (const gate of gates) {
    for (let it = 0; it < iters; it++) {
      const a: V3[] = [];
      const b: V3[] = [];
      let sum = 0;
      for (const p of src) {
        const q = apply(T, p);
        const n = target.nearest(q, gate);
        if (!n) continue;
        a.push(q);
        b.push(target.point(n.i));
        sum += n.d;
      }
      if (a.length < 12) break;
      residual = sum / a.length;
      const ca = centroid(a);
      const cb = centroid(b);
      const R = hornRotation(a, b, ca, cb);
      const rc = mulV(R, ca);
      const step: Rigid = { R, t: [cb[0] - rc[0], cb[1] - rc[1], cb[2] - rc[2]] };
      T = compose(step, T);
      if (rotationAngle(R) < 1e-4 && Math.hypot(...step.t) < 1e-5) break;
    }
  }
  return { T, residual };
}

/* ------------------------------------------------------------------ eklemli kol/bacak uyumu */

export interface Segment {
  name: string;
  /** Ebeveyn parça (yoksa gövde: dönüşüm yok). */
  parent?: string;
  /** Proksimal eklem (dönme merkezi), kaynak koordinatta. */
  pivot: V3;
  /** Kemik ve kas örnek noktaları, kaynak koordinatta. */
  bone: V3[];
  soft: V3[];
  /** Arama sınırı (derece). */
  range?: number;
  /** İzin verilen tekdüze ölçek aralığı (el/ayak: iki vücudun el-ayak boyu farklıdır). */
  scale?: [number, number];
}

export interface SegmentFit {
  /** Dönme (ve varsa ölçek) içeren dönüşüm; R ölçekli dönme matrisi olabilir. */
  T: Rigid;
  before: number;
  after: number;
  angle: number;
  scale: number;
}

/**
 * Maliyet: kas/yumuşak doku noktaları derinin içinde ve yüzeye yakın olmalı (derinin dışı çok
 * cezalı, gövdenin derinlerine gömülmek de cezalı); kemik noktaları derinin içinde olmalı.
 */
function cost(T: Rigid, seg: Segment, skin: Volume): number {
  let c = 0;
  for (const p of seg.soft) {
    const q = apply(T, p);
    const d = skin.surface.nearest(q, 0.12)?.d ?? 0.12;
    c += skin.inside(q) ? Math.max(0, d - 0.03) : 0.004 + d * 4;
  }
  for (const p of seg.bone) {
    const q = apply(T, p);
    if (!skin.inside(q)) c += 0.004 + (skin.surface.nearest(q, 0.12)?.d ?? 0.12) * 4;
  }
  return c / (seg.soft.length + seg.bone.length);
}

/** Parçaları zincir sırasıyla uydurur: her parça ebeveyninin dönüşümünden sonra kendi ekleminde döner. */
export function fitSegments(segments: Segment[], skin: Volume, log: (s: string) => void = () => {}): Map<string, SegmentFit> {
  const out = new Map<string, SegmentFit>();
  const X: V3 = [1, 0, 0];
  const Y: V3 = [0, 1, 0];
  const Z: V3 = [0, 0, 1];
  for (const seg of segments) {
    const parent = seg.parent ? out.get(seg.parent)!.T : IDENTITY;
    const pivot = apply(parent, seg.pivot);
    const range = seg.range ?? 40;
    const [smin, smax] = seg.scale ?? [1, 1];
    const candidate = (a: number, b: number, c: number, sc = 1): Rigid => {
      const R = mulM(axisAngle(Z, (a * Math.PI) / 180), mulM(axisAngle(X, (b * Math.PI) / 180), axisAngle(Y, (c * Math.PI) / 180)));
      const S = sc === 1 ? R : (R.map((row) => row.map((v) => v * sc)) as M3);
      return compose(aboutPivot(S, pivot), parent);
    };
    const before = cost(parent, seg, skin);
    let best = { a: 0, b: 0, c: 0, s: 1, cost: before };
    for (let a = -range; a <= range; a += 4)
      for (let b = -range; b <= range; b += 4) {
        const k = cost(candidate(a, b, 0), seg, skin);
        if (k < best.cost) best = { a, b, c: 0, s: 1, cost: k };
      }
    for (const step of [2, 1, 0.5]) {
      let improved = true;
      while (improved) {
        improved = false;
        for (const [da, db, dc, ds] of [
          [step, 0, 0, 0],
          [-step, 0, 0, 0],
          [0, step, 0, 0],
          [0, -step, 0, 0],
          [0, 0, step, 0],
          [0, 0, -step, 0],
          [0, 0, 0, step / 50],
          [0, 0, 0, -step / 50],
        ] as const) {
          const a = best.a + da;
          const b = best.b + db;
          const c = best.c + dc;
          const sc = +(best.s + ds).toFixed(3);
          if (Math.abs(a) > range || Math.abs(b) > range || Math.abs(c) > 25 || sc < smin || sc > smax) continue;
          const k = cost(candidate(a, b, c, sc), seg, skin);
          if (k < best.cost - 1e-7) {
            best = { a, b, c, s: sc, cost: k };
            improved = true;
          }
        }
      }
    }
    const T = candidate(best.a, best.b, best.c, best.s);
    out.set(seg.name, { T, before, after: best.cost, angle: Math.hypot(best.a, best.b, best.c), scale: best.s });
    log(
      `  ${seg.name.padEnd(10)} dönme (Z ${best.a}°, X ${best.b}°, Y ${best.c}°)${best.s !== 1 ? ` ölçek ${best.s}` : ''} maliyet ${(before * 1000).toFixed(2)} → ${(best.cost * 1000).toFixed(2)}`,
    );
  }
  return out;
}

/* ------------------------------------------------------------------ harmanlama */

/**
 * Kemik gruplarına göre yumuşak ağırlıklı dönüşüm: noktanın en yakın kemik gruplarına uzaklığı
 * (σ ≈ 1,5 cm) ağırlık verir; her grup bir parçaya (ya da gövdeye: dönüşümsüz) bağlıdır.
 */
export function downsample(points: Float32Array, cell = 0.008): Float32Array {
  const seen = new Set<string>();
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 3) {
    const k = `${Math.floor(points[i]! / cell)},${Math.floor(points[i + 1]! / cell)},${Math.floor(points[i + 2]! / cell)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(points[i]!, points[i + 1]!, points[i + 2]!);
  }
  return Float32Array.from(out);
}

export class Blender {
  private pts: number[] = [];
  private label: number[] = [];
  private transforms: Rigid[] = [];
  private grid: PointGrid | null = null;
  constructor(private readonly sigma = 0.015) {}
  add(points: Float32Array, T: Rigid) {
    const id = this.transforms.length;
    this.transforms.push(T);
    const d = downsample(points);
    for (let i = 0; i < d.length; i++) this.pts.push(d[i]!);
    for (let i = 0; i < d.length / 3; i++) this.label.push(id);
    this.grid = null;
  }
  map(p: V3): V3 {
    this.grid ??= new PointGrid(Float32Array.from(this.pts), 0.02);
    const n = this.grid.nearest(p, 0.4);
    if (!n) return p;
    const best = new Map<number, number>();
    this.grid.within(p, n.d + 0.05, (i, d) => {
      const l = this.label[i]!;
      if (d < (best.get(l) ?? Infinity)) best.set(l, d);
    });
    let W = 0;
    const acc: V3 = [0, 0, 0];
    for (const [l, d] of best) {
      const w = Math.exp(-((d - n.d) ** 2) / (2 * this.sigma ** 2));
      const q = apply(this.transforms[l]!, p);
      acc[0] += w * q[0];
      acc[1] += w * q[1];
      acc[2] += w * q[2];
      W += w;
    }
    return [acc[0] / W, acc[1] / W, acc[2] / W];
  }
}

/**
 * Şematik tüp (damar, sinir) kontrol noktasını derinin içinde tutar: dışarıdaysa ya da yüzeye
 * `margin`'den yakınsa en yakın deri noktasından içeri doğru `margin` kadar taşınır.
 */
export function keepInside(skin: Volume, p: V3, margin = 0.005): V3 {
  const n = skin.surface.nearest(p, 0.2);
  if (!n) return p;
  const inside = skin.inside(p);
  if (inside && n.d >= margin) return p;
  const q = skin.surface.point(n.i);
  const d: V3 = inside ? [p[0] - q[0], p[1] - q[1], p[2] - q[2]] : [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const l = Math.hypot(...d);
  if (l < 1e-6) return p;
  for (let m = margin; m <= margin * 4; m += margin) {
    const r: V3 = [q[0] + (d[0] / l) * m, q[1] + (d[1] / l) * m, q[2] + (d[2] / l) * m];
    if (skin.inside(r)) return r;
  }
  return p;
}
