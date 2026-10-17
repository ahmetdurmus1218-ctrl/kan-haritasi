/**
 * Kişisel organ sahnesi: kasadaki seri model sonuçlarından (StoredVolume) bir organın GERÇEK maske
 * yüzeyini, komşu yapılarını, maskenin kapattığı iç boşluğu ve organın içindeki en derin noktayı üretir.
 * three.js'e bağlı değildir (testlenebilir); yüzeyler hasta RAS (mm) koordinatındadır.
 */
import {
  type OrganInteriorDefinition,
  type PersonalOrganPlan,
  type PersonalSource,
  type SurfaceMesh,
  type Vec3,
  deepestPoint,
  findingClass,
  interiorCavity,
  labelSurface,
  personalOrganPlan,
  smoothSurface,
  spacing3,
  surfaceStep,
} from '@kh/analysis';
import type { StoredVolume } from './imagingRecords';
import { storedLabels } from './volumeResults';

export interface PersonalPart {
  key: string;
  name: string;
  role: 'organ' | 'neighbor' | 'finding' | 'cavity';
  mesh: SurfaceMesh;
  volumeMl: number;
}

export interface PersonalOrganScene {
  volume: StoredVolume;
  plan: PersonalOrganPlan;
  parts: PersonalPart[];
  /** Kameranın dalacağı nokta (RAS mm): boşluk varsa boşluğun, yoksa organ maskesinin en derin vokseli. */
  inside: { point: Vec3; depthMm: number; in: 'cavity' | 'organ' };
  cavityMl: number;
  /** Ölçümler (cihazda): yüzey çıkarma süresi, köşe/üçgen sayısı. */
  stats: { ms: number; vertices: number; triangles: number; spacing: Vec3 };
}

/** Kasadaki seri sonuçları → kişisel kaynaklar (yalnızca anatomi modelleri; basamaklı patoloji modelleri bulgu olarak eklenir). */
export function personalSources(volumes: readonly StoredVolume[]): PersonalSource[] {
  return volumes.filter((v) => !v.cascadeFrom).map((v) => ({ key: `${v.model.id}@${v.at}`, grid: v.grid, structures: v.structures }));
}

/** İç dünyanın eşleştiği kişisel yapı: katalog yapısı ve grafik düğümleri. */
export function matchFor(def: OrganInteriorDefinition): { structure?: string; nodes: string[] } {
  return { ...(def.structure ? { structure: def.structure } : {}), nodes: [def.organId, ...(def.anchor ? [def.anchor] : []), ...(def.aliases ?? [])] };
}

export function planFor(def: OrganInteriorDefinition, volumes: readonly StoredVolume[]): { plan: PersonalOrganPlan; volume: StoredVolume } | null {
  const plan = personalOrganPlan(personalSources(volumes), matchFor(def));
  const volume = plan && volumes.find((v) => `${v.model.id}@${v.at}` === plan.sourceKey);
  return plan && volume ? { plan, volume } : null;
}

const overlaps = (a: { bboxMin: Vec3; bboxMax: Vec3 }, lo: Vec3, hi: Vec3) => [0, 1, 2].every((d) => a.bboxMax[d]! >= lo[d]! && a.bboxMin[d]! <= hi[d]!);

/** Maskeden yüzeyler. Uzun sürebilir: her parça arasında olay döngüsüne dönülür (arayüz donmaz). */
export async function buildPersonalOrgan(volume: StoredVolume, plan: PersonalOrganPlan, pathology: readonly StoredVolume[], onProgress?: (done: number, total: number) => void, signal?: { cancelled: boolean }): Promise<PersonalOrganScene | null> {
  const t0 = performance.now();
  const labels = storedLabels(volume);
  const sp = spacing3(volume.grid.spacing);
  const halfVoxel = Math.max(...sp) / 2;
  const target = new Set(plan.target);
  const byId = new Map(volume.structures.map((s) => [s.labelId, s]));
  const targetStructs = plan.target.map((id) => byId.get(id)!).filter(Boolean);
  // Bulgular: aynı serinin basamaklı patoloji sonuçlarından, organın kutusuyla kesişen gösterilebilir sınıflar.
  const lo = [0, 1, 2].map((d) => Math.min(...targetStructs.map((s) => s.bboxMin[d]!))) as Vec3;
  const hi = [0, 1, 2].map((d) => Math.max(...targetStructs.map((s) => s.bboxMax[d]!))) as Vec3;
  const findings = pathology.flatMap((pv) => pv.structures.filter((s) => s.kind === 'finding' && findingClass(s) === 'finding' && overlaps(s, lo, hi)).map((s) => ({ pv, s })));
  type Job = () => void;
  const parts: PersonalPart[] = [];
  let cavityMl = 0;
  let inside = null as PersonalOrganScene['inside'] | null;
  const jobs: Job[] = [
    ...plan.target.map((id) => () => {
      const s = byId.get(id)!;
      const m = labelSurface(labels, volume.grid, id, surfaceStep(s.voxels));
      if (m?.indices.length) parts.push({ key: `o${id}`, name: s.name, role: 'organ', mesh: smoothSurface(m, halfVoxel), volumeMl: s.volumeMl });
    }),
    () => {
      const cav = interiorCavity(labels, volume.grid, target);
      cavityMl = cav.volumeMl;
      if (cav.volumeMl >= 0.5) {
        const m = labelSurface(cav.mask, volume.grid, 1, surfaceStep(cav.voxels));
        if (m?.indices.length) parts.push({ key: 'cavity', name: 'Maskenin kapattığı iç boşluk', role: 'cavity', mesh: smoothSurface(m, halfVoxel), volumeMl: cav.volumeMl });
        const d = deepestPoint(cav.mask, volume.grid, 1);
        if (d) inside = { ...d, in: 'cavity' };
      }
      if (!inside) {
        const d = deepestPoint(labels, volume.grid, target);
        if (d) inside = { ...d, in: 'organ' };
      }
    },
    ...plan.neighbors.map((id) => () => {
      const s = byId.get(id)!;
      // Bağlam için daha seyrek ızgara
      const m = labelSurface(labels, volume.grid, id, surfaceStep(s.voxels) + 1);
      if (m?.indices.length) parts.push({ key: `n${id}`, name: s.name, role: 'neighbor', mesh: smoothSurface(m, halfVoxel * 2, 4), volumeMl: s.volumeMl });
    }),
    ...findings.map(({ pv, s }) => () => {
      const m = labelSurface(storedLabels(pv), pv.grid, s.labelId, 1);
      if (m?.indices.length) parts.push({ key: `f${pv.model.id}:${s.labelId}`, name: `${s.name} · ${pv.model.name}`, role: 'finding', mesh: smoothSurface(m, Math.max(...spacing3(pv.grid.spacing)) / 2), volumeMl: s.volumeMl });
    }),
  ];
  for (let i = 0; i < jobs.length; i++) {
    if (signal?.cancelled) return null;
    jobs[i]!();
    onProgress?.(i + 1, jobs.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!inside || !parts.some((p) => p.role === 'organ')) return null;
  const vertices = parts.reduce((a, p) => a + p.mesh.positions.length / 3, 0);
  const triangles = parts.reduce((a, p) => a + p.mesh.indices.length / 3, 0);
  return { volume, plan, parts, inside, cavityMl, stats: { ms: Math.round(performance.now() - t0), vertices, triangles, spacing: sp } };
}
