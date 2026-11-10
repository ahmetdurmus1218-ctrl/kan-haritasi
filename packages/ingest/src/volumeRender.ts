import type { Volume } from './mpr';

/**
 * 3B hacim görüntüleme (volume rendering) için hazırlık: DICOM serisinden kurulan hacim, GPU dokusuna
 * sığacak boyuta İNDİRGENİR ve 8 bit'e pencerelenir. Fiziksel boyutlar (mm) korunur: kutu, voksel aralığına
 * göre ölçeklenir; hacim küp varsayılmaz. Buradaki her şey kişinin kendi görüntüsünün vokselleridir —
 * bölütleme, yorum ya da tanı içermez.
 */
export interface RenderVolume {
  nx: number;
  ny: number;
  nz: number;
  /** 0–255: [lo, hi] penceresine göre doğrusal; z * ny * nx + y * nx + x. */
  data: Uint8Array;
  /** Hacmin fiziksel boyutu (mm): [sütun yönü, satır yönü, kesit yönü]. */
  sizeMm: [number, number, number];
  /** İndirgeme adımları (kaç özgün voksel bir voksele toplandı). */
  stride: [number, number, number];
  lo: number;
  hi: number;
}

/** GPU dokusunun en büyük kenarı (voksel). 160³ ≈ 4 MB: telefonlarda da güvenli. */
export const VR_MAX_DIM = 160;

export interface VrPreset {
  key: string;
  label: string;
  /** Hounsfield biriminde pencere (yalnızca BT). */
  lo: number;
  hi: number;
}

/** BT için yoğunluk pencereleri (HU). MR'da mutlak birim olmadığından yalnızca otomatik pencere kullanılır. */
export const VR_CT_PRESETS: readonly VrPreset[] = [
  { key: 'kemik', label: 'Kemik', lo: 150, hi: 1200 },
  { key: 'yumusak', label: 'Yumuşak doku', lo: -160, hi: 240 },
  { key: 'akciger', label: 'Akciğer', lo: -1000, hi: -350 },
  { key: 'kontrast', label: 'Damar (kontrastlı)', lo: 120, hi: 500 },
];

/**
 * Otomatik pencere: değerlerin yüzdelikleri (varsayılan %40 – %99,7). Alt sınırın yüksek tutulması, hava ve
 * arka planın saydam kalmasını sağlar. Histogram 1024 kutuyla, örnekleyerek hesaplanır.
 */
export function volumeWindow(vol: Pick<Volume, 'data' | 'min' | 'max'>, pLo = 0.4, pHi = 0.997): { lo: number; hi: number } {
  const { data, min, max } = vol;
  if (!(max > min)) return { lo: min, hi: min + 1 };
  const bins = new Uint32Array(1024);
  const step = Math.max(1, Math.floor(data.length / 2_000_000));
  const k = 1023 / (max - min);
  let n = 0;
  for (let i = 0; i < data.length; i += step) {
    bins[Math.min(1023, Math.max(0, Math.floor((data[i]! - min) * k)))]!++;
    n++;
  }
  const at = (p: number) => {
    let acc = 0;
    for (let b = 0; b < 1024; b++) {
      acc += bins[b]!;
      if (acc >= p * n) return min + (b + 0.5) / k;
    }
    return max;
  };
  const lo = at(pLo);
  const hi = at(pHi);
  return hi > lo ? { lo, hi } : { lo: min, hi: max };
}

/** Hacmi en büyük kenarı `maxDim` olacak biçimde ortalama alarak indirger ve [lo, hi] penceresiyle 8 bit'e çevirir. */
export function toRenderVolume(vol: Volume, window: { lo: number; hi: number }, maxDim = VR_MAX_DIM): RenderVolume {
  const g = vol.geometry;
  const depth = g.order.length;
  const sx = Math.max(1, Math.ceil(g.columns / maxDim));
  const sy = Math.max(1, Math.ceil(g.rows / maxDim));
  const sz = Math.max(1, Math.ceil(depth / maxDim));
  const nx = Math.max(1, Math.floor(g.columns / sx));
  const ny = Math.max(1, Math.floor(g.rows / sy));
  const nz = Math.max(1, Math.floor(depth / sz));
  const out = new Uint8Array(nx * ny * nz);
  const span = Math.max(1e-9, window.hi - window.lo);
  const plane = g.rows * g.columns;
  const count = sx * sy * sz;
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        let sum = 0;
        for (let dz = 0; dz < sz; dz++) {
          const zo = (z * sz + dz) * plane;
          for (let dy = 0; dy < sy; dy++) {
            const yo = zo + (y * sy + dy) * g.columns + x * sx;
            for (let dx = 0; dx < sx; dx++) sum += vol.data[yo + dx]!;
          }
        }
        const v = (sum / count - window.lo) / span;
        out[(z * ny + y) * nx + x] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
      }
  return {
    nx,
    ny,
    nz,
    data: out,
    // Fiziksel boyut özgün ızgaradan: indirgeme şekli değiştirmez.
    sizeMm: [g.columns * g.pixelSpacing[1], g.rows * g.pixelSpacing[0], Math.max(1, depth - 1) * g.sliceSpacing + g.sliceSpacing],
    stride: [sx, sy, sz],
    lo: window.lo,
    hi: window.hi,
  };
}

export interface Projection {
  width: number;
  height: number;
  data: Uint8Array;
  /** Bir pikselin fiziksel boyutu (mm): [yatay, dikey]. */
  pixelMm: [number, number];
}

/**
 * En yüksek yoğunluk izdüşümü (MIP): bir eksen boyunca en parlak voksel. WebGL2 olmayan cihazlarda 3B
 * görünümün yerine kullanılır ve GPU sonucunun CPU karşılığıdır (testlerde doğrulanır).
 * axis 0: sütun yönü boyunca (genişlik = satır, yükseklik = kesit); 1: satır yönü boyunca; 2: kesit yönü boyunca.
 */
export function mipProjection(rv: RenderVolume, axis: 0 | 1 | 2): Projection {
  const { nx, ny, nz, data } = rv;
  const [w, h] = axis === 0 ? [ny, nz] : axis === 1 ? [nx, nz] : [nx, ny];
  const out = new Uint8Array(w * h);
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const v = data[(z * ny + y) * nx + x]!;
        // Kesit ekseni görüntüde yukarı doğru çizilir (z arttıkça yukarı).
        const i = axis === 0 ? (nz - 1 - z) * w + y : axis === 1 ? (nz - 1 - z) * w + x : y * w + x;
        if (v > out[i]!) out[i] = v;
      }
  const mm = [rv.sizeMm[0] / nx, rv.sizeMm[1] / ny, rv.sizeMm[2] / nz] as const;
  return { width: w, height: h, data: out, pixelMm: axis === 0 ? [mm[1], mm[2]] : axis === 1 ? [mm[0], mm[2]] : [mm[0], mm[1]] };
}
