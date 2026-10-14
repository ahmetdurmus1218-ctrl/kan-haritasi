/**
 * Etiket hacminden (model maskesi) 3B yüzey: "surface nets" — her karışık hücreye (8 vokselden bazıları
 * yapıya ait) bir köşe konur, işaret değiştiren her voksel kenarı için dört komşu hücre bir dörtgenle
 * bağlanır. Sonuç, maskenin GERÇEK sınırını izleyen kapalı bir yüzeydir (yumuşatılmış voksel kabuğu);
 * uydurma şekil eklenmez. Koordinatlar hasta RAS (mm) cinsindendir: kişinin kendi anatomisi.
 */
import { type RasGrid, spacing3 } from './volumeModel';

export interface SurfaceMesh {
  labelId: number;
  /** x, y, z (RAS mm) üçlüleri. */
  positions: Float32Array;
  /** Üçgen indisleri. */
  indices: Uint32Array;
  voxels: number;
  /** RAS mm sınırları. */
  min: [number, number, number];
  max: [number, number, number];
}

/** Bir etiketin yüzeyi. `step` > 1 ise ızgara seyreltilir (büyük organlarda bellek ve hız için). */
export function labelSurface(labels: Uint8Array, grid: Pick<RasGrid, 'shape' | 'spacing' | 'lo'>, labelId: number, step = 1): SurfaceMesh | null {
  const [S, A, R] = grid.shape;
  const sp = spacing3(grid.spacing);
  // Etiketin sınırlayıcı kutusu
  let s0 = S, a0 = A, r0 = R, s1 = -1, a1 = -1, r1 = -1, voxels = 0;
  for (let s = 0, o = 0; s < S; s++)
    for (let a = 0; a < A; a++)
      for (let r = 0; r < R; r++, o++)
        if (labels[o] === labelId) {
          voxels++;
          if (s < s0) s0 = s;
          if (s > s1) s1 = s;
          if (a < a0) a0 = a;
          if (a > a1) a1 = a;
          if (r < r0) r0 = r;
          if (r > r1) r1 = r;
        }
  if (!voxels) return null;
  // Örnekleme ızgarası (kutu + 1 boşluk, step adım)
  const ns = Math.floor((s1 - s0) / step) + 3;
  const na = Math.floor((a1 - a0) / step) + 3;
  const nr = Math.floor((r1 - r0) / step) + 3;
  const inside = (i: number, j: number, k: number): number => {
    // i: s, j: a, k: r (örnek ızgarası; 0 ve son satır boşluk)
    const s = s0 + (i - 1) * step;
    const a = a0 + (j - 1) * step;
    const r = r0 + (k - 1) * step;
    if (i < 1 || j < 1 || k < 1 || s > s1 || a > a1 || r > r1 || s >= S || a >= A || r >= R) return 0;
    return labels[(s * A + a) * R + r] === labelId ? 1 : 0;
  };
  const sample = new Uint8Array(ns * na * nr);
  for (let i = 0; i < ns; i++) for (let j = 0; j < na; j++) for (let k = 0; k < nr; k++) sample[(i * na + j) * nr + k] = inside(i, j, k);
  const at = (i: number, j: number, k: number) => sample[(i * na + j) * nr + k]!;
  // Hücre köşeleri: hücre (i,j,k) örnek noktaları (i..i+1, j..j+1, k..k+1)
  const cellIndex = new Int32Array((ns - 1) * (na - 1) * (nr - 1)).fill(-1);
  const pos: number[] = [];
  const idx: number[] = [];
  const toRas = (i: number, j: number, k: number): [number, number, number] => [
    grid.lo[0] + (r0 + (k - 1) * step) * sp[0],
    grid.lo[1] + (a0 + (j - 1) * step) * sp[1],
    grid.lo[2] + (s0 + (i - 1) * step) * sp[2],
  ];
  for (let i = 0; i < ns - 1; i++)
    for (let j = 0; j < na - 1; j++)
      for (let k = 0; k < nr - 1; k++) {
        let mask = 0;
        let n = 0;
        let ci = 0, cj = 0, ck = 0;
        for (let c = 0; c < 8; c++) if (at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))) mask |= 1 << c;
        if (mask === 0 || mask === 255) continue;
        // 12 kenarın işaret değiştirenlerinin orta noktalarının ortalaması
        for (let c = 0; c < 8; c++)
          for (const d of [1, 2, 4]) {
            const c2 = c | d;
            if (c2 === c) continue;
            if (((mask >> c) & 1) !== ((mask >> c2) & 1)) {
              ci += ((c & 1) + (c2 & 1)) / 2;
              cj += (((c >> 1) & 1) + ((c2 >> 1) & 1)) / 2;
              ck += (((c >> 2) & 1) + ((c2 >> 2) & 1)) / 2;
              n++;
            }
          }
        const p = toRas(i + ci / n, j + cj / n, k + ck / n);
        cellIndex[(i * (na - 1) + j) * (nr - 1) + k] = pos.length / 3;
        pos.push(p[0], p[1], p[2]);
      }
  const cell = (i: number, j: number, k: number) => (i < 0 || j < 0 || k < 0 || i >= ns - 1 || j >= na - 1 || k >= nr - 1 ? -1 : cellIndex[(i * (na - 1) + j) * (nr - 1) + k]!);
  // Her örnek kenarı (eksen boyunca) işaret değiştiriyorsa, kenarı paylaşan 4 hücreyi bağla
  for (let i = 0; i < ns - 1; i++)
    for (let j = 0; j < na - 1; j++)
      for (let k = 0; k < nr - 1; k++) {
        const v = at(i, j, k);
        // +k yönü (r): kenarı paylaşan hücreler (i-1..i, j-1..j, k)
        const quads: Array<[number, number, number, number, number]> = [
          [at(i, j, k + 1), cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k)],
          [at(i, j + 1, k), cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1)],
          [at(i + 1, j, k), cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k)],
        ];
        for (const [w, q0, q1, q2, q3] of quads) {
          if (v === w || q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) continue;
          if (v) idx.push(q0, q1, q2, q0, q2, q3);
          else idx.push(q0, q2, q1, q0, q3, q2);
        }
      }
  const positions = Float32Array.from(pos);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let p = 0; p < positions.length; p += 3)
    for (let d = 0; d < 3; d++) {
      min[d] = Math.min(min[d]!, positions[p + d]!);
      max[d] = Math.max(max[d]!, positions[p + d]!);
    }
  return { labelId, positions, indices: Uint32Array.from(idx), voxels, min, max };
}

/** Büyük yapılarda seyreltme adımı: ~yüz bin köşeyi aşmayacak şekilde. */
export function surfaceStep(voxels: number): number {
  return voxels > 400_000 ? 3 : voxels > 60_000 ? 2 : 1;
}
