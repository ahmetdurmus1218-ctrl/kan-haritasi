/**
 * 3B hacim modelleri (ör. TotalSegmentator, nnU-Net) için cihaz içi çıkarım hattı. Saf TypeScript; çıkarım
 * motoru dışarıdan verilir (uygulamada ONNX Runtime Web / WASM).
 *
 *   DICOM serisi (kesitler + konum/yönelim) → hasta koordinatı (LPS) → RAS'a hizalı izotropik ızgara
 *   (doğrusal yeniden örnekleme) → sıfır olmayan bölgeye kırpma → normalizasyon (BT: kırp + z-skor,
 *   veri kümesi parmak izi; MR: görüntü başına z-skor) → kayan pencere (adım 0,8, Gauss ağırlığı)
 *   → her karonun en yüksek K sınıfıyla birleştirme → argmax → etiket hacmi
 *   → yapı başına voksel sayısı, hacim (mL), ağırlık merkezi ve sınırlar (LPS mm), kesit aralığı.
 *
 * Bu adımların Python karşılığı scripts/models/reference_pipeline.py'dir; o betik resmi TotalSegmentator
 * çıktısıyla Dice karşılaştırmasıyla doğrulandı. Burada uydurma hiçbir şey yoktur: model ne verdiyse o.
 */
import type { EngineFactory, InferenceEngine, ModelManifest, Tensor } from './localModel';

export type Vec3 = [number, number, number];

/** Kesitlerden kurulmuş kaynak hacim: data[k][j][i] (kesit, satır, sütun), değerler HU/sinyal. */
export interface SourceVolume {
  slices: number;
  rows: number;
  cols: number;
  data: Float32Array;
  /** (i=0, j=0, k=0) vokselinin hasta koordinatı (LPS, mm). */
  origin: Vec3;
  /** +1 sütun (i), +1 satır (j), +1 kesit (k) adımlarının LPS vektörleri (mm). */
  iVec: Vec3;
  jVec: Vec3;
  kVec: Vec3;
}

export interface VolumeSpec {
  spacing: number;
  /** Ağ girdisi [S, A, R] (nnU-Net / SimpleITK dizi sırası). */
  patch: [number, number, number];
  axisOrder: 'SAR';
  normalization: { scheme: 'ct'; clip: [number, number]; mean: number; std: number } | { scheme: 'zscore' };
  tileStep: number;
  topK: number;
  cropNonzero: boolean;
  minSlices: number;
}

export interface RasGrid {
  /** [S, A, R] boyutları. */
  shape: [number, number, number];
  spacing: number;
  /** (r=0, a=0, s=0) noktasının RAS koordinatı (mm). */
  lo: Vec3;
}

export interface VolumeStructure {
  labelId: number;
  key: string;
  name: string;
  kind: 'anatomy' | 'finding';
  structure?: string;
  part?: string;
  node?: string;
  voxels: number;
  volumeMl: number;
  centroid: Vec3;
  bboxMin: Vec3;
  bboxMax: Vec3;
  sliceRange: [number, number];
  centroidSlice: number;
}

export interface VolumeSegmentation {
  grid: RasGrid;
  /** Etiket hacmi, [S][A][R] sırasıyla (0 = arka plan). */
  labels: Uint8Array;
  structures: VolumeStructure[];
  tiles: number;
}

export interface VolumeProgress {
  stage: 'resample' | 'inference' | 'merge';
  done: number;
  total: number;
}

const lpsToRas = (p: Vec3): Vec3 => [-p[0], -p[1], p[2]];

function inverse3(m: number[][]): number[][] {
  const [a, b, c] = m as [number[], number[], number[]];
  const det = a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) - a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) + a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new Error('Kesit geometrisi tekil (yönelim ya da aralık hatalı).');
  const inv = (r: number, col: number) => {
    const idx = [0, 1, 2];
    const rr = idx.filter((x) => x !== col);
    const cc = idx.filter((x) => x !== r);
    const minor = m[rr[0]!]![cc[0]!]! * m[rr[1]!]![cc[1]!]! - m[rr[0]!]![cc[1]!]! * m[rr[1]!]![cc[0]!]!;
    return (((r + col) % 2 === 0 ? 1 : -1) * minor) / det;
  };
  return [0, 1, 2].map((r) => [0, 1, 2].map((col) => inv(r, col)));
}

/** numpy.round gibi: yarım değerlerde çifte yuvarla (nnU-Net karo adımları bununla hesaplanır). */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (Math.abs(d - 0.5) > 1e-9) return Math.round(x);
  return f % 2 === 0 ? f : f + 1;
}

/** nnU-Net compute_steps_for_sliding_window. */
export function tileSteps(size: number, patch: number, step: number): number[] {
  if (size <= patch) return [0];
  const n = Math.ceil((size - patch) / (patch * step)) + 1;
  const actual = (size - patch) / (n - 1);
  return Array.from({ length: n }, (_, i) => roundHalfEven(actual * i));
}

/** scipy.ndimage.gaussian_filter(delta, σ = boyut/8) / max × 10 ile aynı (ayrılabilir), sıfırlar en küçük değere. */
export function gaussianImportance(patch: readonly [number, number, number]): Float32Array {
  const axis = (n: number) => {
    const sigma = n / 8;
    const radius = Math.floor(4 * sigma + 0.5);
    const c = Math.floor(n / 2);
    const w: number[] = [];
    let sum = 0;
    for (let x = -radius; x <= radius; x++) {
      const v = Math.exp((-0.5 * x * x) / (sigma * sigma));
      w.push(v);
      sum += v;
    }
    return Array.from({ length: n }, (_, i) => (Math.abs(i - c) <= radius ? w[i - c + radius]! / sum : 0));
  };
  const [gz, gy, gx] = [axis(patch[0]), axis(patch[1]), axis(patch[2])];
  const out = new Float32Array(patch[0] * patch[1] * patch[2]);
  let max = 0;
  for (let z = 0, o = 0; z < patch[0]; z++) for (let y = 0; y < patch[1]; y++) for (let x = 0; x < patch[2]; x++, o++) max = Math.max(max, (out[o] = gz[z]! * gy[y]! * gx[x]!));
  let minNz = Infinity;
  for (let i = 0; i < out.length; i++) {
    out[i] = (out[i]! / max) * 10;
    if (out[i]! > 0 && out[i]! < minNz) minNz = out[i]!;
  }
  for (let i = 0; i < out.length; i++) if (out[i] === 0) out[i] = minNz;
  return out;
}

/** Kaynak hacmi kapsayan RAS'a hizalı ızgara. */
export function rasGrid(vol: SourceVolume, spacing: number): RasGrid {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const i of [0, vol.cols - 1])
    for (const j of [0, vol.rows - 1])
      for (const k of [0, vol.slices - 1]) {
        const p = lpsToRas([0, 1, 2].map((a) => vol.origin[a]! + i * vol.iVec[a]! + j * vol.jVec[a]! + k * vol.kVec[a]!) as Vec3);
        for (let a = 0; a < 3; a++) {
          lo[a] = Math.min(lo[a]!, p[a]!);
          hi[a] = Math.max(hi[a]!, p[a]!);
        }
      }
  const n = (a: number) => Math.floor((hi[a]! - lo[a]!) / spacing + 1e-6) + 1;
  return { shape: [n(2), n(1), n(0)], spacing, lo };
}

/** RAS noktasından kaynak (i, j, k) sürekli indeksine dönüşüm. */
function sourceMapper(vol: SourceVolume) {
  const inv = inverse3([
    [vol.iVec[0], vol.jVec[0], vol.kVec[0]],
    [vol.iVec[1], vol.jVec[1], vol.kVec[1]],
    [vol.iVec[2], vol.jVec[2], vol.kVec[2]],
  ]);
  return (ras: Vec3): Vec3 => {
    const q = [-ras[0] - vol.origin[0], -ras[1] - vol.origin[1], ras[2] - vol.origin[2]];
    return [0, 1, 2].map((r) => inv[r]![0]! * q[0]! + inv[r]![1]! * q[1]! + inv[r]![2]! * q[2]!) as Vec3;
  };
}

/** Kaynak hacmi ızgaraya doğrusal (trilinear) örnekler; dışarısı padValue. Çıkış [S][A][R]. */
export function resampleToGrid(vol: SourceVolume, grid: RasGrid, padValue: number): Float32Array {
  const [S, A, R] = grid.shape;
  const out = new Float32Array(S * A * R);
  const toSrc = sourceMapper(vol);
  const { rows, cols, slices, data } = vol;
  const at = (k: number, j: number, i: number) => data[(k * rows + j) * cols + i]!;
  const sp = grid.spacing;
  let o = 0;
  for (let s = 0; s < S; s++)
    for (let a = 0; a < A; a++)
      for (let r = 0; r < R; r++, o++) {
        const [fi, fj, fk] = toSrc([grid.lo[0] + r * sp, grid.lo[1] + a * sp, grid.lo[2] + s * sp]);
        // scipy map_coordinates(order=1, mode='constant'): sınırın dışı padValue
        if (fi < -1e-6 || fj < -1e-6 || fk < -1e-6 || fi > cols - 1 + 1e-6 || fj > rows - 1 + 1e-6 || fk > slices - 1 + 1e-6) {
          out[o] = padValue;
          continue;
        }
        const i0 = Math.min(cols - 1, Math.max(0, Math.floor(fi)));
        const j0 = Math.min(rows - 1, Math.max(0, Math.floor(fj)));
        const k0 = Math.min(slices - 1, Math.max(0, Math.floor(fk)));
        const i1 = Math.min(cols - 1, i0 + 1);
        const j1 = Math.min(rows - 1, j0 + 1);
        const k1 = Math.min(slices - 1, k0 + 1);
        const di = Math.min(1, Math.max(0, fi - i0));
        const dj = Math.min(1, Math.max(0, fj - j0));
        const dk = Math.min(1, Math.max(0, fk - k0));
        const c00 = at(k0, j0, i0) * (1 - di) + at(k0, j0, i1) * di;
        const c01 = at(k0, j1, i0) * (1 - di) + at(k0, j1, i1) * di;
        const c10 = at(k1, j0, i0) * (1 - di) + at(k1, j0, i1) * di;
        const c11 = at(k1, j1, i0) * (1 - di) + at(k1, j1, i1) * di;
        out[o] = (c00 * (1 - dj) + c01 * dj) * (1 - dk) + (c10 * (1 - dj) + c11 * dj) * dk;
      }
  return out;
}

const labelOf = (t: Tensor, i: number): number => {
  const v = t.data[i];
  return typeof v === 'bigint' ? Number(v) : (v as number);
};

/**
 * Hacim bölütleme. `engine` her karo için {input: [1,1,D,H,W]} alır ve {topk_values, topk_indices}
 * ([1,K,D,H,W]) döndürür. İlerleme her karo sonrasında bildirilir.
 */
export async function segmentVolume(
  vol: SourceVolume,
  manifest: ModelManifest,
  engine: InferenceEngine,
  opts: { onProgress?: (p: VolumeProgress) => void; isCancelled?: () => boolean } = {},
): Promise<VolumeSegmentation> {
  const spec = manifest.volume;
  if (!spec) throw new Error('Bu model 3B hacim modeli değil.');
  if (vol.slices < spec.minSlices) throw new Error(`Seride ${vol.slices} kesit var; bu model için en az ${spec.minSlices} kesit gerekir.`);
  opts.onProgress?.({ stage: 'resample', done: 0, total: 1 });
  let srcMin = Infinity;
  for (let i = 0; i < vol.data.length; i++) if (vol.data[i]! < srcMin) srcMin = vol.data[i]!;
  const grid = rasGrid(vol, spec.spacing);
  const full = resampleToGrid(vol, grid, srcMin);
  const [S, A, R] = grid.shape;

  // Sıfır olmayan bölgenin sınırlayıcı kutusu (nnU-Net crop_to_nonzero)
  let b0: Vec3 = [0, 0, 0];
  let b1: Vec3 = [S, A, R];
  if (spec.cropNonzero) {
    const mn: Vec3 = [S, A, R];
    const mx: Vec3 = [-1, -1, -1];
    for (let s = 0, o = 0; s < S; s++)
      for (let a = 0; a < A; a++)
        for (let r = 0; r < R; r++, o++)
          if (full[o] !== 0) {
            if (s < mn[0]) mn[0] = s;
            if (a < mn[1]) mn[1] = a;
            if (r < mn[2]) mn[2] = r;
            if (s > mx[0]) mx[0] = s;
            if (a > mx[1]) mx[1] = a;
            if (r > mx[2]) mx[2] = r;
          }
    if (mx[0] >= 0) {
      b0 = mn;
      b1 = [mx[0] + 1, mx[1] + 1, mx[2] + 1];
    }
  }
  const shape: Vec3 = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
  const n = shape[0] * shape[1] * shape[2];
  const arr = new Float32Array(n);
  for (let s = 0, o = 0; s < shape[0]; s++)
    for (let a = 0; a < shape[1]; a++) {
      const src = ((s + b0[0]) * A + (a + b0[1])) * R + b0[2];
      arr.set(full.subarray(src, src + shape[2]), o);
      o += shape[2];
    }
  const norm = spec.normalization;
  if (norm.scheme === 'ct') {
    for (let i = 0; i < n; i++) arr[i] = (Math.min(norm.clip[1], Math.max(norm.clip[0], arr[i]!)) - norm.mean) / norm.std;
  } else {
    let mean = 0;
    for (let i = 0; i < n; i++) mean += arr[i]!;
    mean /= n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (arr[i]! - mean) ** 2;
    const std = Math.max(Math.sqrt(v / n), 1e-8);
    for (let i = 0; i < n; i++) arr[i] = (arr[i]! - mean) / std;
  }
  opts.onProgress?.({ stage: 'resample', done: 1, total: 1 });

  // Karo boyutuna dolgu (ortalanmış, 0)
  const patch = spec.patch;
  const P: Vec3 = [Math.max(shape[0], patch[0]), Math.max(shape[1], patch[1]), Math.max(shape[2], patch[2])];
  const off: Vec3 = [Math.floor((P[0] - shape[0]) / 2), Math.floor((P[1] - shape[1]) / 2), Math.floor((P[2] - shape[2]) / 2)];
  const NP = P[0] * P[1] * P[2];
  const big = new Float32Array(NP);
  for (let s = 0; s < shape[0]; s++)
    for (let a = 0; a < shape[1]; a++) big.set(arr.subarray((s * shape[1] + a) * shape[2], (s * shape[1] + a + 1) * shape[2]), ((s + off[0]) * P[1] + (a + off[1])) * P[2] + off[2]);

  const g = gaussianImportance(patch);
  const K = spec.topK;
  const M = 2 * K;
  const EMPTY = 255;
  const lab = new Uint8Array(M * NP).fill(EMPTY);
  const val = new Float32Array(M * NP);
  const floor = new Float32Array(NP);
  const tiles: Vec3[] = [];
  for (const z of tileSteps(P[0], patch[0], spec.tileStep)) for (const y of tileSteps(P[1], patch[1], spec.tileStep)) for (const x of tileSteps(P[2], patch[2], spec.tileStep)) tiles.push([z, y, x]);
  const PV = patch[0] * patch[1] * patch[2];
  const input = new Float32Array(PV);
  const inName = manifest.input.name;
  const vName = manifest.output.topkValues ?? 'topk_values';
  const iName = manifest.output.topkIndices ?? 'topk_indices';
  const tv = new Float32Array(K);
  const ti = new Int32Array(K);
  for (const [t, [z0, y0, x0]] of tiles.entries()) {
    if (opts.isCancelled?.()) throw new Error('İptal edildi.');
    opts.onProgress?.({ stage: 'inference', done: t, total: tiles.length });
    for (let z = 0; z < patch[0]; z++)
      for (let y = 0; y < patch[1]; y++) {
        const src = ((z + z0) * P[1] + (y + y0)) * P[2] + x0;
        input.set(big.subarray(src, src + patch[2]), (z * patch[1] + y) * patch[2]);
      }
    const out = await engine.run({ [inName]: { data: input, dims: [1, 1, patch[0], patch[1], patch[2]] } });
    const V = out[vName];
    const I = out[iName];
    if (!V || !I) throw new Error('Model çıktısında topk_values / topk_indices yok.');
    for (let z = 0, p = 0; z < patch[0]; z++)
      for (let y = 0; y < patch[1]; y++)
        for (let x = 0; x < patch[2]; x++, p++) {
          const w = g[p]!;
          for (let k = 0; k < K; k++) {
            tv[k] = (V.data[k * PV + p] as number) * w;
            ti[k] = labelOf(I, k * PV + p);
          }
          const kth = tv[K - 1]!;
          const q = ((z + z0) * P[1] + (y + y0)) * P[2] + (x + x0);
          // mevcut adaylar: bu karoda K içindeyse kendi değeri, değilse K'ıncı değer
          for (let m = 0; m < M; m++) {
            const L = lab[m * NP + q]!;
            if (L === EMPTY) continue;
            let add = kth;
            for (let k = 0; k < K; k++)
              if (ti[k] === L) {
                add = tv[k]!;
                break;
              }
            val[m * NP + q]! += add;
          }
          // bu karonun sınıflarından aday olmayanlar: ilk boş yuvaya, önceki karoların taban değeriyle
          for (let k = 0; k < K; k++) {
            let present = false;
            let free = -1;
            for (let m = 0; m < M; m++) {
              const L = lab[m * NP + q]!;
              if (L === ti[k]) {
                present = true;
                break;
              }
              if (L === EMPTY && free < 0) free = m;
            }
            if (!present && free >= 0) {
              lab[free * NP + q] = ti[k]!;
              val[free * NP + q] = floor[q]! + tv[k]!;
            }
          }
          floor[q]! += kth;
        }
  }
  opts.onProgress?.({ stage: 'merge', done: 0, total: 1 });

  // argmax → tam ızgarada etiket hacmi
  const labels = new Uint8Array(S * A * R);
  for (let s = 0; s < shape[0]; s++)
    for (let a = 0; a < shape[1]; a++)
      for (let r = 0; r < shape[2]; r++) {
        const q = ((s + off[0]) * P[1] + (a + off[1])) * P[2] + (r + off[2]);
        let best = -Infinity;
        let bl = 0;
        for (let m = 0; m < M; m++) {
          const L = lab[m * NP + q]!;
          if (L === EMPTY) continue;
          const v = val[m * NP + q]!;
          if (v > best) {
            best = v;
            bl = L;
          }
        }
        labels[((s + b0[0]) * A + (a + b0[1])) * R + (r + b0[2])] = bl;
      }
  const structures = structureStats(labels, grid, vol, manifest);
  opts.onProgress?.({ stage: 'merge', done: 1, total: 1 });
  return { grid, labels, structures, tiles: tiles.length };
}

/** Etiket başına voksel sayısı, hacim, ağırlık merkezi, sınırlar ve kaynak kesit aralığı. */
export function structureStats(labels: Uint8Array, grid: RasGrid, vol: SourceVolume, manifest: Pick<ModelManifest, 'labels'>): VolumeStructure[] {
  const [S, A, R] = grid.shape;
  const sp = grid.spacing;
  const toSrc = sourceMapper(vol);
  type Acc = { n: number; sum: Vec3; min: Vec3; max: Vec3; kmin: number; kmax: number };
  const acc = new Map<number, Acc>();
  for (let s = 0, o = 0; s < S; s++)
    for (let a = 0; a < A; a++)
      for (let r = 0; r < R; r++, o++) {
        const L = labels[o]!;
        if (!L) continue;
        const ras: Vec3 = [grid.lo[0] + r * sp, grid.lo[1] + a * sp, grid.lo[2] + s * sp];
        const lps = lpsToRas(ras);
        let e = acc.get(L);
        if (!e) acc.set(L, (e = { n: 0, sum: [0, 0, 0], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], kmin: Infinity, kmax: -Infinity }));
        e.n++;
        for (let d = 0; d < 3; d++) {
          e.sum[d]! += lps[d]!;
          if (lps[d]! < e.min[d]!) e.min[d] = lps[d]!;
          if (lps[d]! > e.max[d]!) e.max[d] = lps[d]!;
        }
        const k = toSrc(ras)[2];
        if (k < e.kmin) e.kmin = k;
        if (k > e.kmax) e.kmax = k;
      }
  const byId = new Map(manifest.labels.map((l) => [l.id, l]));
  const clampK = (k: number) => Math.max(0, Math.min(vol.slices - 1, Math.round(k)));
  return [...acc.entries()]
    .map(([id, e]) => {
      const l = byId.get(id);
      const centroid = e.sum.map((v) => Math.round((v / e.n) * 10) / 10) as Vec3;
      const ck = toSrc(lpsToRas(centroid))[2];
      return {
        labelId: id,
        key: l?.key ?? String(id),
        name: l?.finding ?? `Sınıf ${id}`,
        kind: l?.kind === 'finding' ? ('finding' as const) : ('anatomy' as const),
        ...(l?.structure ? { structure: l.structure } : {}),
        ...(l?.part ? { part: l.part } : {}),
        ...(l?.node ? { node: l.node } : {}),
        voxels: e.n,
        volumeMl: Math.round(((e.n * sp ** 3) / 1000) * 10) / 10,
        centroid,
        bboxMin: e.min.map((v) => Math.round(v * 10) / 10) as Vec3,
        bboxMax: e.max.map((v) => Math.round(v * 10) / 10) as Vec3,
        sliceRange: [clampK(Math.min(e.kmin, e.kmax)), clampK(Math.max(e.kmin, e.kmax))] as [number, number],
        centroidSlice: clampK(ck),
      };
    })
    .sort((a, b) => b.voxels - a.voxels);
}

/** Bir kaynak kesitin pikselleri için etiketler (en yakın komşu): görüntü üzerine maske çizmek için. */
export function sliceLabels(seg: Pick<VolumeSegmentation, 'grid' | 'labels'>, vol: Pick<SourceVolume, 'rows' | 'cols' | 'origin' | 'iVec' | 'jVec' | 'kVec'>, k: number): Uint8Array {
  const out = new Uint8Array(vol.rows * vol.cols);
  const [S, A, R] = seg.grid.shape;
  const sp = seg.grid.spacing;
  for (let j = 0, o = 0; j < vol.rows; j++)
    for (let i = 0; i < vol.cols; i++, o++) {
      const x = vol.origin[0] + i * vol.iVec[0] + j * vol.jVec[0] + k * vol.kVec[0];
      const y = vol.origin[1] + i * vol.iVec[1] + j * vol.jVec[1] + k * vol.kVec[1];
      const z = vol.origin[2] + i * vol.iVec[2] + j * vol.jVec[2] + k * vol.kVec[2];
      const r = Math.round((-x - seg.grid.lo[0]) / sp);
      const a = Math.round((-y - seg.grid.lo[1]) / sp);
      const s = Math.round((z - seg.grid.lo[2]) / sp);
      if (r < 0 || a < 0 || s < 0 || r >= R || a >= A || s >= S) continue;
      out[o] = seg.labels[(s * A + a) * R + r]!;
    }
  return out;
}

/** Etiket hacmini saklamak için RLE ([değer, tekrar, ...]). */
export function encodeRle(a: Uint8Array): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i]!;
    let j = i + 1;
    while (j < a.length && a[j] === v) j++;
    out.push(v, j - i);
    i = j;
  }
  return out;
}

export function decodeRle(rle: readonly number[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i + 1 < rle.length; i += 2) {
    out.fill(rle[i]!, o, o + rle[i + 1]!);
    o += rle[i + 1]!;
  }
  return out;
}

/** Tahmini süre (karo sayısı): kullanıcıya çalıştırmadan önce söylenir. */
export function estimateTiles(vol: SourceVolume, spec: VolumeSpec): number {
  const g = rasGrid(vol, spec.spacing);
  const P = [0, 1, 2].map((a) => Math.max(g.shape[a]!, spec.patch[a]!));
  return P.reduce((n, size, a) => n * tileSteps(size, spec.patch[a]!, spec.tileStep).length, 1);
}

/** Oturumu bir kez açıp hacim çalıştıran yardımcı (motor fabrikasıyla). */
export async function runVolumeModel(
  vol: SourceVolume,
  manifest: ModelManifest,
  bytes: Uint8Array,
  createEngine: EngineFactory,
  opts: { onProgress?: (p: VolumeProgress) => void; isCancelled?: () => boolean } = {},
): Promise<VolumeSegmentation> {
  const engine = await createEngine(bytes, manifest);
  try {
    return await segmentVolume(vol, manifest, engine, opts);
  } finally {
    engine.dispose();
  }
}
