/**
 * KİŞİSEL ORGAN — gerçek BT/MR bölütleme maskesinden "İçine gir" sahnesinin temel geometrisi.
 *
 *   DICOM → hacim → yerel model → etiket hacmi → bu organın maskesi → yüzey (surface nets) → hacim
 *   korumalı yumuşatma (yer değiştirme yarım vokselle sınırlı) → organın İÇİNDE bir nokta (maskenin en derin
 *   vokseli) → kamera oraya dalar.
 *
 * Dürüstlük kuralları:
 *   - Yalnızca maskenin kendisi kullanılır: yumuşatma maskenin sınırından en fazla yarım voksel uzaklaşır,
 *     şekil uydurulmaz.
 *   - Lümen (iç boşluk) yalnızca maskenin GERÇEKTEN kapattığı arka plan vokselleri varsa "senin görüntünden"
 *     sayılır. Bölütleme organı dolu bir kütle olarak verdiyse (ör. kolon maskesi içeriğiyle birlikte) iç
 *     lümen eğitimsel anatomi olarak gösterilir ve bu açıkça yazılır.
 *   - Hücre, doku, molekül hiçbir zaman BT/MR'dan türetilmez.
 */
import type { InteriorArchetype } from './interior/types';
import { type RasGrid, type Vec3, type VolumeStructure, spacing3, voxelMm3 } from './volumeModel';
import type { SurfaceMesh } from './volumeSurface';

type Grid = Pick<RasGrid, 'shape' | 'spacing' | 'lo'>;

/** Hasta RAS (mm) koordinatında bir vokselin merkezi (labelSurface ile aynı dönüşüm). */
export function voxelRas(grid: Grid, s: number, a: number, r: number): Vec3 {
  const sp = spacing3(grid.spacing);
  return [grid.lo[0] + r * sp[0], grid.lo[1] + a * sp[1], grid.lo[2] + s * sp[2]];
}

interface Box {
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  r0: number;
  r1: number;
}

function labelBox(labels: Uint8Array, grid: Grid, ids: ReadonlySet<number>): Box | null {
  const [S, A, R] = grid.shape;
  const b: Box = { s0: S, s1: -1, a0: A, a1: -1, r0: R, r1: -1 };
  for (let s = 0, o = 0; s < S; s++)
    for (let a = 0; a < A; a++)
      for (let r = 0; r < R; r++, o++)
        if (ids.has(labels[o]!)) {
          if (s < b.s0) b.s0 = s;
          if (s > b.s1) b.s1 = s;
          if (a < b.a0) b.a0 = a;
          if (a > b.a1) b.a1 = a;
          if (r < b.r0) b.r0 = r;
          if (r > b.r1) b.r1 = r;
        }
  return b.s1 < 0 ? null : b;
}

/**
 * Maskenin kapattığı iç boşluk: kutunun dışından (6-komşulukla) ulaşılamayan, etikete ait olmayan vokseller.
 * Dönen `mask` tam ızgara boyutundadır (1 = boşluk); boşluk yoksa voxels 0.
 */
export function interiorCavity(labels: Uint8Array, grid: Grid, labelIds: Iterable<number>): { mask: Uint8Array; voxels: number; volumeMl: number } {
  const ids = new Set(labelIds);
  const [S, A, R] = grid.shape;
  const mask = new Uint8Array(S * A * R);
  const b = labelBox(labels, grid, ids);
  if (!b) return { mask, voxels: 0, volumeMl: 0 };
  // Kutu + 1 voksel pay: dış bölge her zaman kutunun kenarından başlar.
  const s0 = Math.max(0, b.s0 - 1), s1 = Math.min(S - 1, b.s1 + 1);
  const a0 = Math.max(0, b.a0 - 1), a1 = Math.min(A - 1, b.a1 + 1);
  const r0 = Math.max(0, b.r0 - 1), r1 = Math.min(R - 1, b.r1 + 1);
  const ns = s1 - s0 + 1, na = a1 - a0 + 1, nr = r1 - r0 + 1;
  const local = (s: number, a: number, r: number) => ((s - s0) * na + (a - a0)) * nr + (r - r0);
  const outside = new Uint8Array(ns * na * nr);
  const queue = new Int32Array(ns * na * nr);
  let head = 0, tail = 0;
  const push = (s: number, a: number, r: number) => {
    const l = local(s, a, r);
    if (outside[l] || ids.has(labels[(s * A + a) * R + r]!)) return;
    outside[l] = 1;
    queue[tail++] = l;
  };
  for (let s = s0; s <= s1; s++)
    for (let a = a0; a <= a1; a++)
      for (let r = r0; r <= r1; r++) if (s === s0 || s === s1 || a === a0 || a === a1 || r === r0 || r === r1) push(s, a, r);
  while (head < tail) {
    const l = queue[head++]!;
    const r = (l % nr) + r0;
    const a = (Math.floor(l / nr) % na) + a0;
    const s = Math.floor(l / (nr * na)) + s0;
    if (s > s0) push(s - 1, a, r);
    if (s < s1) push(s + 1, a, r);
    if (a > a0) push(s, a - 1, r);
    if (a < a1) push(s, a + 1, r);
    if (r > r0) push(s, a, r - 1);
    if (r < r1) push(s, a, r + 1);
  }
  let voxels = 0;
  for (let s = s0; s <= s1; s++)
    for (let a = a0; a <= a1; a++)
      for (let r = r0; r <= r1; r++) {
        const o = (s * A + a) * R + r;
        if (!outside[local(s, a, r)] && !ids.has(labels[o]!)) {
          mask[o] = 1;
          voxels++;
        }
      }
  return { mask, voxels, volumeMl: (voxels * voxelMm3(grid.spacing)) / 1000 };
}

/**
 * Maskenin en derin noktası (sınıra en uzak voksel; iki geçişli 3B chamfer uzaklığı, mm). Kamera organın
 * içine buraya dalar: kıvrık organlarda (kolon) ağırlık merkezi organın dışında kalabilir, bu nokta kalmaz.
 */
export function deepestPoint(mask: Uint8Array, grid: Grid, value: number | ReadonlySet<number> = 1): { point: Vec3; depthMm: number } | null {
  const ids = typeof value === 'number' ? new Set([value]) : value;
  const b = labelBox(mask, grid, ids);
  if (!b) return null;
  const [, A, R] = grid.shape;
  const sp = spacing3(grid.spacing);
  const ns = b.s1 - b.s0 + 3, na = b.a1 - b.a0 + 3, nr = b.r1 - b.r0 + 3;
  const dist = new Float32Array(ns * na * nr);
  const at = (i: number, j: number, k: number) => (i * na + j) * nr + k;
  for (let i = 0; i < ns; i++)
    for (let j = 0; j < na; j++)
      for (let k = 0; k < nr; k++) {
        const s = b.s0 + i - 1, a = b.a0 + j - 1, r = b.r0 + k - 1;
        const inside = i > 0 && j > 0 && k > 0 && i < ns - 1 && j < na - 1 && k < nr - 1 && ids.has(mask[(s * A + a) * R + r]!);
        dist[at(i, j, k)] = inside ? Infinity : 0;
      }
  // Komşu ofsetleri (26-komşuluk), voksel boyutuyla ağırlıklı.
  const fwd: Array<[number, number, number, number]> = [];
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      for (let dk = -1; dk <= 1; dk++) {
        if (di === 0 && dj === 0 && dk === 0) continue;
        const before = di < 0 || (di === 0 && (dj < 0 || (dj === 0 && dk < 0)));
        if (before) fwd.push([di, dj, dk, Math.hypot(di * sp[2], dj * sp[1], dk * sp[0])]);
      }
  for (let i = 1; i < ns - 1; i++)
    for (let j = 1; j < na - 1; j++)
      for (let k = 1; k < nr - 1; k++) {
        const o = at(i, j, k);
        if (dist[o] === 0) continue;
        let d = dist[o]!;
        for (const [di, dj, dk, w] of fwd) d = Math.min(d, dist[at(i + di, j + dj, k + dk)]! + w);
        dist[o] = d;
      }
  let best = -1, bi = 0, bj = 0, bk = 0;
  for (let i = ns - 2; i >= 1; i--)
    for (let j = na - 2; j >= 1; j--)
      for (let k = nr - 2; k >= 1; k--) {
        const o = at(i, j, k);
        if (dist[o] === 0) continue;
        let d = dist[o]!;
        for (const [di, dj, dk, w] of fwd) d = Math.min(d, dist[at(i - di, j - dj, k - dk)]! + w);
        dist[o] = d;
        if (d > best) {
          best = d;
          bi = i;
          bj = j;
          bk = k;
        }
      }
  return { point: voxelRas(grid, b.s0 + bi - 1, b.a0 + bj - 1, b.r0 + bk - 1), depthMm: best };
}

/**
 * Taubin (λ/μ) yumuşatma: voksel basamaklarını giderir, hacmi korur (Laplace gibi büzmez). Her köşenin
 * özgün konumundan uzaklaşması `maxShiftMm` ile sınırlıdır (öntanım: en büyük voksel kenarının yarısı), yani
 * yüzey maskenin gerçek sınırından ayrılmaz. Girdi değiştirilmez.
 */
export function smoothSurface(mesh: SurfaceMesh, maxShiftMm: number, iterations = 8): SurfaceMesh {
  const n = mesh.positions.length / 3;
  const orig = mesh.positions;
  const p = Float32Array.from(orig);
  const tmp = new Float32Array(p.length);
  // Komşuluk (CSR)
  const deg = new Uint32Array(n);
  const tri = mesh.indices;
  for (let t = 0; t < tri.length; t += 3) for (let e = 0; e < 3; e++) deg[tri[t + e]!]! += 2;
  const start = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i]! + deg[i]!;
  const nbr = new Uint32Array(start[n]!);
  const fill = start.slice(0, n);
  for (let t = 0; t < tri.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = tri[t + e]!, b = tri[t + ((e + 1) % 3)]!, c = tri[t + ((e + 2) % 3)]!;
      nbr[fill[a]!++] = b;
      nbr[fill[a]!++] = c;
    }
  const pass = (f: number) => {
    for (let i = 0; i < n; i++) {
      const k0 = start[i]!, k1 = start[i + 1]!;
      if (k1 === k0) {
        tmp[i * 3] = p[i * 3]!;
        tmp[i * 3 + 1] = p[i * 3 + 1]!;
        tmp[i * 3 + 2] = p[i * 3 + 2]!;
        continue;
      }
      let x = 0, y = 0, z = 0;
      for (let k = k0; k < k1; k++) {
        const j = nbr[k]!;
        x += p[j * 3]!;
        y += p[j * 3 + 1]!;
        z += p[j * 3 + 2]!;
      }
      const m = k1 - k0;
      tmp[i * 3] = p[i * 3]! + f * (x / m - p[i * 3]!);
      tmp[i * 3 + 1] = p[i * 3 + 1]! + f * (y / m - p[i * 3 + 1]!);
      tmp[i * 3 + 2] = p[i * 3 + 2]! + f * (z / m - p[i * 3 + 2]!);
    }
    p.set(tmp);
  };
  for (let it = 0; it < iterations; it++) {
    pass(0.5);
    pass(-0.53);
  }
  // Maskeye sadakat: yer değiştirme sınırı
  for (let i = 0; i < n; i++) {
    const dx = p[i * 3]! - orig[i * 3]!, dy = p[i * 3 + 1]! - orig[i * 3 + 1]!, dz = p[i * 3 + 2]! - orig[i * 3 + 2]!;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxShiftMm) {
      const f = maxShiftMm / d;
      p[i * 3] = orig[i * 3]! + dx * f;
      p[i * 3 + 1] = orig[i * 3 + 1]! + dy * f;
      p[i * 3 + 2] = orig[i * 3 + 2]! + dz * f;
    }
  }
  return { ...mesh, positions: p };
}

/** Kapalı yüzeyin hacmi (mm³; işaretli tetrahedron toplamı). Doğrulama ve testler için. */
export function meshVolumeMm3(mesh: Pick<SurfaceMesh, 'positions' | 'indices'>): number {
  const p = mesh.positions, t = mesh.indices;
  let v = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i]! * 3, b = t[i + 1]! * 3, c = t[i + 2]! * 3;
    v += p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) - p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!) + p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!);
  }
  return Math.abs(v) / 6;
}

/* ------------------------------------------------------------------ plan: hangi etiketler, komşular (bbox/ağırlık merkezi LPS mm; yalnızca göreli karşılaştırılır) */

export interface PersonalSource {
  /** Kaynak model sonucunun kimliği (ör. model kimliği + zaman). */
  key: string;
  grid: Grid;
  structures: Pick<VolumeStructure, 'labelId' | 'name' | 'kind' | 'structure' | 'node' | 'voxels' | 'volumeMl' | 'bboxMin' | 'bboxMax' | 'centroid'>[];
}

export interface PersonalOrganPlan {
  sourceKey: string;
  /** Organın kendi etiketleri (ör. sol + sağ böbrek ayrı etiketse ikisi). */
  target: number[];
  /** Organı çevreleyen bölütlenmiş komşu yapılar (bağlam; en yakın ilk). */
  neighbors: number[];
  volumeMl: number;
}

/** Bir organ (katalog yapısı ya da grafik düğümü) için kişisel sahne planı. Gerçek maske yoksa null. */
export function personalOrganPlan(sources: readonly PersonalSource[], match: { structure?: string; nodes?: readonly string[] }, maxNeighbors = 12, marginMm = 40): PersonalOrganPlan | null {
  const nodes = new Set(match.nodes ?? []);
  const isTarget = (s: PersonalSource['structures'][number]) => s.kind === 'anatomy' && ((match.structure && s.structure === match.structure) || (s.node && nodes.has(s.node)));
  // En büyük toplam hacimli kaynak (aynı organ birden çok seride bölütlendiyse en kapsamlısı)
  let best: { src: PersonalSource; target: PersonalSource['structures'] } | null = null;
  for (const src of sources) {
    const target = src.structures.filter(isTarget);
    if (!target.length) continue;
    const vol = target.reduce((a, s) => a + s.volumeMl, 0);
    if (!best || vol > best.target.reduce((a, s) => a + s.volumeMl, 0)) best = { src, target };
  }
  if (!best) return null;
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const s of best.target)
    for (let d = 0; d < 3; d++) {
      lo[d] = Math.min(lo[d]!, s.bboxMin[d]! - marginMm);
      hi[d] = Math.max(hi[d]!, s.bboxMax[d]! + marginMm);
    }
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const targetIds = new Set(best.target.map((s) => s.labelId));
  const neighbors = best.src.structures
    .filter((s) => s.kind === 'anatomy' && !targetIds.has(s.labelId) && [0, 1, 2].every((d) => s.bboxMax[d]! >= lo[d]! && s.bboxMin[d]! <= hi[d]!))
    .map((s) => ({ s, d: Math.hypot(s.centroid[0] - c[0], s.centroid[1] - c[1], s.centroid[2] - c[2]) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, maxNeighbors)
    .map((x) => x.s.labelId);
  return { sourceKey: best.src.key, target: [...targetIds], neighbors, volumeMl: best.target.reduce((a, s) => a + s.volumeMl, 0) };
}

/* ------------------------------------------------------------------ dürüst etiketler */

export const REAL_DATA_TAG = 'GERÇEK VERİ';
export const EDUCATIONAL_TAG = 'ANATOMİK EĞİTİM';

/**
 * Organın içine girildiğinde gerçek veri ile eğitimsel anatominin nerede ayrıldığı. `cavityMl` maskenin
 * kapattığı gerçek iç boşluğun hacmi (interiorCavity).
 */
export function personalInteriorNote(archetype: InteriorArchetype, organName: string, cavityMl: number): { real: string; educational: string; lumen: 'real' | 'educational' | 'none' } {
  const hasLumen = archetype === 'hollow' || archetype === 'vascular' || archetype === 'airway' || archetype === 'chamber';
  const realCavity = cavityMl >= 0.5;
  const real = `Bu ${organName} 3B modeli yüklediğiniz görüntüdeki segmentasyon maskesinden oluşturuldu (organın dış/segmentasyon geometrisi).`;
  if (hasLumen && realCavity)
    return {
      lumen: 'real',
      real: `${real} Maskenin kapattığı iç boşluk (${cavityMl.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL) da senin görüntünden.`,
      educational: 'İç yüzeydeki doku, içerik ve hareket eğitimsel normal anatomidir; BT/MR’dan doğrudan görüntülenmez.',
    };
  if (hasLumen)
    return {
      lumen: 'educational',
      real,
      educational: `Gerçek segmentasyon burada organın dış/segmentasyon geometrisini sağlıyor; maske ${organName} içini dolu bir bölge olarak verdiği için iç lümen eğitimsel anatomi olarak gösteriliyor.`,
    };
  return {
    lumen: 'none',
    real,
    educational: `${organName.charAt(0).toLocaleUpperCase('tr-TR')}${organName.slice(1)} dolu (parankimli) bir organdır; içi lümen değil dokudur. İçerideki fonksiyonel birimler (lobül, nefron…) ve hücreler eğitimsel normal anatomidir; BT/MR’dan doğrudan görüntülenmez.`,
  };
}
