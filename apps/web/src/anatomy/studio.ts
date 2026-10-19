import { useEffect, useState } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import type { ModelPart } from './models';
import { worldPoints } from './surface';
import { type StudioJob, type StudioResult, runStudioJob } from './studio.worker';

/**
 * Atlas stüdyosu geometrisi: organ yakın planda (odakta, kesitte) gösterilirken atlas ağının yumuşatılmış
 * hâli. Kalbin yüzey damarları (koroner arterler, kalp venleri) atlasta çok ince olduğu için gerçek
 * kalınlığa (≈3–4 mm) şişirilir; kalp yüzeyine, bu damarların geçtiği oluklarda epikard yağı özniteliği
 * eklenir. Yerel koordinatta kalır (parçanın kendi dünya matrisiyle çizilir).
 *
 * Hesap ayrı bir işçide (Web Worker) yapılır: çizim hiç donmaz. Sonuç gelene kadar özgün ağ çizilir
 * (`studioGeometry` null döner), gelince sahne kendiliğinden güncellenir (`useStudioVersion`). Parça başına
 * bir kez hesaplanır, oturum boyunca önbellekte kalır; organ odaklanınca kesit parçaları da önceden istenir.
 */

/** Kalp yüzeyinde seyreden damarlar. */
export function isSurfaceVessel(structure: string, label: string | null): boolean {
  return structure === 'coronary-arteries' || (structure === 'veins' && /cardiac|coronary sinus|oblique|posterior vein/.test(label ?? ''));
}

/** Epikard yağı taşıyan yüzeyler (kalbin dış duvarları; kapaklar ve iç bölmeler hariç). */
export function hasEpicardialFat(structure: string, label: string | null): boolean {
  return structure === 'heart' && /atrium|ventricle/.test(label ?? '');
}

const ready = new Map<string, BufferGeometry>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let vesselCache: { key: string; pts: Float32Array } | null = null;
let worker: Worker | null | undefined;

function surfaceVesselPoints(all: ModelPart[]): Float32Array {
  const vs = all.filter((p) => isSurfaceVessel(p.structure, p.label));
  const key = vs.map((p) => p.id).join();
  if (!vesselCache || vesselCache.key !== key) vesselCache = { key, pts: worldPoints(vs) };
  return vesselCache.pts;
}

function keyOf(part: ModelPart): string {
  return `${part.id}|${hasEpicardialFat(part.structure, part.label) ? 'f' : ''}`;
}

function accept(r: StudioResult) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(r.pos, 3));
  g.setAttribute('normal', new BufferAttribute(r.normal, 3));
  g.setIndex(new BufferAttribute(r.index, 1));
  if (r.fat) g.setAttribute('khFat', new BufferAttribute(r.fat, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  ready.set(r.key, g);
  pending.delete(r.key);
  for (const l of listeners) l();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./studio.worker.ts', import.meta.url), { type: 'module' });
    if (worker) worker.onmessage = (e: MessageEvent<StudioResult>) => accept(e.data);
  } catch {
    worker = null;
  }
  return worker;
}

function jobFor(part: ModelPart, all: ModelPart[]): StudioJob {
  const pos = part.geometry.attributes.position!;
  const flat = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    flat[i * 3] = pos.getX(i);
    flat[i * 3 + 1] = pos.getY(i);
    flat[i * 3 + 2] = pos.getZ(i);
  }
  const vessel = isSurfaceVessel(part.structure, part.label) || /vessels|veins|aorta|arteries/.test(part.structure);
  const fat = hasEpicardialFat(part.structure, part.label);
  return {
    key: keyOf(part),
    pos: flat,
    index: part.geometry.index ? Uint32Array.from(part.geometry.index.array) : null,
    iterations: vessel ? 0 : pos.count > 60000 ? 3 : 7,
    inflate: isSurfaceVessel(part.structure, part.label) ? 0.0011 / part.matrix.getMaxScaleOnAxis() : 0,
    fat: fat ? { vessels: surfaceVesselPoints(all), matrix: part.matrix.toArray(), near: 0.0018, far: 0.0075 } : null,
  };
}

/** Hazırsa stüdyo geometrisi; değilse null (hesap işçide başlatılır, gelince dinleyiciler uyarılır). */
export function studioGeometry(part: ModelPart, all: ModelPart[]): BufferGeometry | null {
  const key = keyOf(part);
  const hit = ready.get(key);
  if (hit) return hit;
  if (!pending.has(key)) {
    pending.add(key);
    const job = jobFor(part, all);
    const w = getWorker();
    if (w) w.postMessage(job, [job.pos.buffer, ...(job.index ? [job.index.buffer] : [])]);
    else queueMicrotask(() => accept(runStudioJob(job)));
  }
  return null;
}

/** Önceden iste (ör. organ odaklanınca o organın kesit parçaları): "İçine gir" anında hazır olsun. */
export function prewarmStudio(parts: ModelPart[], all: ModelPart[]) {
  for (const p of parts) studioGeometry(p, all);
}

/** İşçiden sonuç geldikçe artan sürüm: bileşen bunu kullanınca hazır geometrilerle yeniden çizilir. */
export function useStudioVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const l = () => setV((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return v;
}
