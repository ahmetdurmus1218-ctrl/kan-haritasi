/**
 * Çok düzlemli yeniden yapılandırma (MPR): düzenli aralıklı, aynı yönelimli bir DICOM serisinden
 * diğer iki düzlemi (ör. eksenel seriden sagital ve koronal) üretir. Yalnızca güvenilir olduğunda
 * çalışır; aksi hâlde nedenini döndürür ve hiçbir görüntü "uydurulmaz".
 *
 * Koşullar: ≥ 10 kesit, tek kareli dosyalar, aynı boyut ve piksel aralığı, aynı yönelim (0020,0037),
 * her kesitte konum (0020,0032), kesitler arası aralık düzenli (ortancadan sapma ≤ %10), bellek sınırı.
 */
import type { DicomInfo } from './dicom';

export type AnatomicalPlane = 'axial' | 'sagittal' | 'coronal';

export const PLANE_LABEL: Record<AnatomicalPlane, string> = { axial: 'Eksenel', sagittal: 'Sagital', coronal: 'Koronal' };

/** En fazla voksel sayısı (Float32: ~128 MB). */
export const MPR_MAX_VOXELS = 32 * 1024 * 1024;
export const MPR_MIN_SLICES = 10;

export interface MprGeometry {
  /** Kesitlerin hacimdeki sırası (girdi dizisindeki indeksler). */
  order: number[];
  rows: number;
  columns: number;
  /** mm: [satır aralığı, sütun aralığı] */
  pixelSpacing: [number, number];
  /** mm: kesitler arası ortalama aralık */
  sliceSpacing: number;
  /**
   * Gantri eğimi (derece): kesitlerin birbirine göre düzlem içinde kayması. Eğik çekimde kesit sırası
   * normal boyunca değil eğik bir eksen boyunca ilerler; hacim (3B analiz) bunu kesit konumlarıyla hesaba katar,
   * ama basit yeniden dilimleme (MPR) diğer düzlemleri kaymış/eğik gösterir.
   */
  tiltDeg: number;
  /** Çekim düzlemi ve yeniden üretilebilen iki düzlem. */
  acquired: AnatomicalPlane;
  /** Bir sütunu sabitleyince oluşan düzlem (sütun yönüne dik). */
  byColumn: AnatomicalPlane;
  /** Bir satırı sabitleyince oluşan düzlem. */
  byRow: AnatomicalPlane;
}

export type MprCheck = { ok: true; geometry: MprGeometry } | { ok: false; reason: string };

const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** Bir yönün baskın eksenine göre o yöne DİK düzlem: x → sagital, y → koronal, z → eksenel (DICOM LPS). */
function planeNormalTo(v: readonly number[]): AnatomicalPlane {
  const ax = [Math.abs(v[0]!), Math.abs(v[1]!), Math.abs(v[2]!)];
  const i = ax.indexOf(Math.max(...ax));
  return i === 0 ? 'sagittal' : i === 1 ? 'coronal' : 'axial';
}

/** Bu eğimin üstünde basit yeniden dilimleme (MPR) güvenilir değildir; diğer düzlemler gösterilmez. */
export const MPR_MAX_TILT_DEG = 1;

export function mprGeometry(slices: ReadonlyArray<Pick<DicomInfo, 'rows' | 'columns' | 'frames' | 'pixelSpacing' | 'imageOrientation' | 'imagePosition'>>): MprCheck {
  const n = slices.length;
  if (n < MPR_MIN_SLICES) return { ok: false, reason: `Seride ${n} kesit var; yeniden yapılandırma için en az ${MPR_MIN_SLICES} kesit gerekir.` };
  const first = slices[0]!;
  if (slices.some((s) => s.frames > 1)) return { ok: false, reason: 'Çok kareli (enhanced) DICOM serilerinde yeniden yapılandırma desteklenmiyor.' };
  if (slices.some((s) => s.rows !== first.rows || s.columns !== first.columns)) return { ok: false, reason: 'Kesitlerin boyutları farklı.' };
  const ps = first.pixelSpacing;
  if (!ps || !(ps[0] > 0 && ps[1] > 0)) return { ok: false, reason: 'Piksel aralığı (0028,0030) yok; gerçek ölçekle yeniden yapılandırılamaz.' };
  if (slices.some((s) => !s.pixelSpacing || Math.abs(s.pixelSpacing[0] - ps[0]) > 1e-3 || Math.abs(s.pixelSpacing[1] - ps[1]) > 1e-3)) return { ok: false, reason: 'Kesitlerin piksel aralıkları farklı.' };
  const o = first.imageOrientation;
  if (!o) return { ok: false, reason: 'Görüntü yönelimi (0020,0037) yok.' };
  if (slices.some((s) => !s.imageOrientation || s.imageOrientation.some((v, i) => Math.abs(v - o[i]!) > 1e-3))) return { ok: false, reason: 'Kesitlerin yönelimi farklı (eğik ya da karışık seri).' };
  if (slices.some((s) => !s.imagePosition)) return { ok: false, reason: 'Kesit konumu (0020,0032) eksik.' };
  if (first.rows * first.columns * n > MPR_MAX_VOXELS) return { ok: false, reason: 'Seri bu cihazda yeniden yapılandırmak için çok büyük (bellek sınırı).' };

  const rowDir = o.slice(0, 3);
  const colDir = o.slice(3, 6);
  const normal = cross(rowDir, colDir);
  const along = slices.map((s, i) => ({ i, d: dot(s.imagePosition!, normal) }));
  along.sort((a, b) => a.d - b.d);
  const gaps = along.slice(1).map((x, k) => x.d - along[k]!.d);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  if (!(median > 1e-3)) return { ok: false, reason: 'Kesitler aynı konumda (tekrarlı ya da çok yankılı seri).' };
  if (gaps.some((g) => Math.abs(g - median) > median * 0.1)) return { ok: false, reason: 'Kesitler arası aralık düzensiz (boşluklu ya da farklı kalınlıkta kesitler).' };
  const sliceSpacing = (along[along.length - 1]!.d - along[0]!.d) / (n - 1);
  // İlk ve son kesitin konum farkının düzlem içi bileşeni → gantri eğimi
  const pf = slices[along[0]!.i]!.imagePosition!;
  const pl = slices[along[along.length - 1]!.i]!.imagePosition!;
  const dv = [pl[0] - pf[0], pl[1] - pf[1], pl[2] - pf[2]];
  const dn = dot(dv, normal);
  const inPlane = Math.hypot(dv[0]! - dn * normal[0]!, dv[1]! - dn * normal[1]!, dv[2]! - dn * normal[2]!);
  const tiltDeg = (Math.atan2(inPlane, Math.abs(dn)) * 180) / Math.PI;

  // Görüntüde yukarısı baş (+z, LPS) olsun: normal yukarı bakıyorsa üstten en büyük konumla başla.
  const order = (normal[2]! > 0 ? [...along].reverse() : along).map((x) => x.i);
  return {
    ok: true,
    geometry: {
      order,
      rows: first.rows,
      columns: first.columns,
      pixelSpacing: [ps[0], ps[1]],
      sliceSpacing,
      tiltDeg,
      acquired: planeNormalTo(normal),
      byColumn: planeNormalTo(rowDir),
      byRow: planeNormalTo(colDir),
    },
  };
}

export interface Volume {
  geometry: MprGeometry;
  /** order sırasıyla kesitler: z * rows * columns + y * columns + x */
  data: Float32Array;
  min: number;
  max: number;
}

/** Kesit verilerini (order sırasıyla) tek bir hacimde toplar. */
export function buildVolume(geometry: MprGeometry, slices: ReadonlyArray<Float32Array>): Volume {
  const { rows, columns, order } = geometry;
  const size = rows * columns;
  const data = new Float32Array(size * order.length);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  order.forEach((src, z) => {
    const s = slices[src];
    if (!s || s.length !== size) throw new Error('Kesit verisi geometriyle uyuşmuyor.');
    data.set(s, z * size);
    for (let i = 0; i < size; i++) {
      const v = s[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  });
  return { geometry, data, min, max };
}

export interface Reslice {
  width: number;
  height: number;
  data: Float32Array;
  min: number;
  max: number;
  /** mm: [satır, sütun] — yeniden örnekleme sonrası kare piksel. */
  pixelSpacing: [number, number];
  plane: AnatomicalPlane;
}

/**
 * Hacimden bir düzlem çıkarır. `fix: 'column'` → sütun x sabit (görüntü: satırlar × kesitler);
 * `fix: 'row'` → satır y sabit (görüntü: sütunlar × kesitler). Dikey eksen kesit yönüdür ve gerçek
 * mm oranına göre doğrusal enterpolasyonla kare piksele örneklenir (görüntü basık/uzamış görünmez).
 */
export function reslice(vol: Volume, fix: 'column' | 'row', index: number): Reslice {
  const g = vol.geometry;
  const { rows, columns } = g;
  const depth = g.order.length;
  const across = fix === 'column' ? rows : columns;
  const inPlane = fix === 'column' ? g.pixelSpacing[0] : g.pixelSpacing[1];
  const k = Math.max(0, Math.min((fix === 'column' ? columns : rows) - 1, Math.round(index)));
  const height = Math.max(1, Math.round(((depth - 1) * g.sliceSpacing) / inPlane) + 1);
  const data = new Float32Array(across * height);
  const at = (z: number, a: number) => (fix === 'column' ? vol.data[z * rows * columns + a * columns + k]! : vol.data[z * rows * columns + k * columns + a]!);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < height; y++) {
    const fz = height === 1 ? 0 : (y * (depth - 1)) / (height - 1);
    const z0 = Math.floor(fz);
    const z1 = Math.min(depth - 1, z0 + 1);
    const t = fz - z0;
    for (let a = 0; a < across; a++) {
      const v = at(z0, a) * (1 - t) + at(z1, a) * t;
      data[y * across + a] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { width: across, height, data, min, max, pixelSpacing: [inPlane, inPlane], plane: fix === 'column' ? g.byColumn : g.byRow };
}
