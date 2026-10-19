import type { BufferGeometry } from 'three';
import type { ModelPart } from './models';
import { addFatAttribute, inflateGeometry, smoothWorldGeometry, worldPoints } from './surface';

/**
 * Atlas stüdyosu geometrisi: organ yakın planda (odakta, kesitte) gösterilirken atlas ağının yumuşatılmış
 * hâli. Kalbin yüzey damarları (koroner arterler, kalp venleri) atlasta çok ince olduğu için gerçek
 * kalınlığa (≈3–4 mm) şişirilir; kalp yüzeyine, bu damarların geçtiği oluklarda epikard yağı özniteliği
 * eklenir. Yerel koordinatta kalır (parçanın kendi dünya matrisiyle çizilir); parça başına bir kez
 * hesaplanır ve oturum boyunca önbellekte tutulur. Genel vücut görünümü özgün (hafif) ağları kullanır.
 */

/** Kalp yüzeyinde seyreden damarlar. */
export function isSurfaceVessel(structure: string, label: string | null): boolean {
  return structure === 'coronary-arteries' || (structure === 'veins' && /cardiac|coronary sinus|oblique|posterior vein/.test(label ?? ''));
}

/** Epikard yağı taşıyan yüzeyler (kalbin dış duvarları; kapaklar ve iç bölmeler hariç). */
export function hasEpicardialFat(structure: string, label: string | null): boolean {
  return structure === 'heart' && /atrium|ventricle/.test(label ?? '');
}

const cache = new Map<string, BufferGeometry>();
let vesselCache: { key: string; pts: Float32Array } | null = null;

function surfaceVesselPoints(all: ModelPart[]): Float32Array {
  const vs = all.filter((p) => isSurfaceVessel(p.structure, p.label));
  const key = vs.map((p) => p.id).join();
  if (!vesselCache || vesselCache.key !== key) vesselCache = { key, pts: worldPoints(vs) };
  return vesselCache.pts;
}

export function studioGeometry(part: ModelPart, all: ModelPart[]): BufferGeometry {
  const fat = hasEpicardialFat(part.structure, part.label);
  const key = `${part.id}|${fat ? 'f' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const vessel = isSurfaceVessel(part.structure, part.label) || /vessels|veins|aorta|arteries/.test(part.structure);
  const g = smoothWorldGeometry(part.geometry, null, vessel ? 0 : part.geometry.attributes.position!.count > 60000 ? 3 : 7);
  const scale = part.matrix.getMaxScaleOnAxis();
  if (isSurfaceVessel(part.structure, part.label)) inflateGeometry(g, 0.0011 / scale);
  if (fat) addFatAttribute(g, surfaceVesselPoints(all), 0.0018, 0.0075, part.matrix);
  cache.set(key, g);
  return g;
}
