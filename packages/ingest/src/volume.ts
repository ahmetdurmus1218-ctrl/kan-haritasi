/**
 * DICOM serisinden 3B hacim (hasta koordinatlı): yerel 3B modeller (ör. TotalSegmentator) bu hacimle çalışır.
 * Geometri MPR ile aynı kurallarla doğrulanır (aynı boyut/aralık/yönelim, her kesitte konum, düzenli aralık);
 * güvenilir değilse nedeniyle reddedilir — yanlış geometride model çalıştırılmaz.
 */
import { type DicomInfo, canDecode, decodeFrame, parseDicom } from './dicom';
import { mprGeometry } from './mpr';

type Vec3 = [number, number, number];

export interface DicomVolume {
  slices: number;
  rows: number;
  cols: number;
  /** data[k][j][i]: k = hacim içi kesit sırası (aşağıdaki `order`), değerler HU/sinyal (rescale uygulanmış). */
  data: Float32Array;
  origin: Vec3;
  iVec: Vec3;
  jVec: Vec3;
  kVec: Vec3;
  /** order[k] = girdi dizisindeki dosya indeksi. */
  order: number[];
  modality?: string;
  seriesUid?: string;
}

export type VolumeBuild = { ok: true; volume: DicomVolume } | { ok: false; reason: string };

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function volumeFromDicom(files: readonly Uint8Array[], infos?: readonly DicomInfo[]): VolumeBuild {
  let parsed: DicomInfo[];
  try {
    parsed = infos ? [...infos] : files.map((f) => parseDicom(f));
  } catch {
    return { ok: false, reason: 'Seride okunamayan DICOM dosyası var.' };
  }
  const g = mprGeometry(parsed);
  if (!g.ok) return { ok: false, reason: g.reason };
  if (parsed.some((i) => i.samplesPerPixel !== 1)) return { ok: false, reason: 'Renkli seride 3B analiz yapılmaz.' };
  if (parsed.some((i) => !canDecode(i) || i.codec === 'jpeg-baseline')) return { ok: false, reason: 'Seride bu cihazda hacim olarak çözülemeyen (sıkıştırılmış) kesit var.' };
  const { order, rows, columns } = g.geometry;
  // mprGeometry gösterim için üstten başlar; hacim için baştan sona aynı sıra kullanılır (kVec buna göre).
  const n = order.length;
  const data = new Float32Array(n * rows * columns);
  for (const [k, idx] of order.entries()) {
    const f = decodeFrame(files[idx]!, parsed[idx]!, 0);
    if (f.kind !== 'gray') return { ok: false, reason: 'Kesit gri tonlamalı değil.' };
    data.set(f.data, k * rows * columns);
  }
  const first = parsed[order[0]!]!;
  const last = parsed[order[n - 1]!]!;
  const o = first.imageOrientation!;
  const rowDir: Vec3 = [o[0], o[1], o[2]];
  const colDir: Vec3 = [o[3], o[4], o[5]];
  const [rowSp, colSp] = first.pixelSpacing!;
  const p0 = first.imagePosition!;
  const pn = last.imagePosition!;
  const kVec: Vec3 = n > 1 ? [(pn[0] - p0[0]) / (n - 1), (pn[1] - p0[1]) / (n - 1), (pn[2] - p0[2]) / (n - 1)] : cross(rowDir, colDir);
  return {
    ok: true,
    volume: {
      slices: n,
      rows,
      cols: columns,
      data,
      origin: [p0[0], p0[1], p0[2]],
      iVec: [rowDir[0] * colSp, rowDir[1] * colSp, rowDir[2] * colSp],
      jVec: [colDir[0] * rowSp, colDir[1] * rowSp, colDir[2] * rowSp],
      kVec,
      order,
      ...(first.modality ? { modality: first.modality } : {}),
      ...(first.seriesUid ? { seriesUid: first.seriesUid } : {}),
    },
  };
}
