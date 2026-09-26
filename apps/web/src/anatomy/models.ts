import { Box3, type BufferGeometry, Matrix4, type Mesh, type Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { type LoadableAsset, MODEL_ASSETS } from './assets.generated';

/**
 * 3D anatomi modellerini yükler (yalnızca uygulamanın kendi dosyalarından: ./models/*.glb).
 * Model dosyaları sağlık verisi içermez; kasada değil, uygulama paketinde durur.
 * Geometriler bir kez çözülür ve oturum boyunca önbellekte kalır.
 */

export interface ModelPart {
  /** Dosya içinde benzersiz anahtar. */
  id: string;
  asset: LoadableAsset;
  /** Katalogdaki yapı kimliği (ör. "coronary-arteries"). */
  structure: string;
  /** Damar gibi alt parçaların kaynak adı (ör. "left coronary artery"). */
  label: string | null;
  geometry: BufferGeometry;
  /** Nicemleme (quantization) ölçeğini de içeren dünya matrisi. */
  matrix: Matrix4;
  box: Box3;
}

export const LOAD_ORDER: LoadableAsset[] = ['body', 'skeleton', 'endocrine', 'digestive', 'urinary', 'reproductive', 'respiratory', 'nervous', 'immune', 'cardio'];
/** İstenince yüklenenler (ör. kaslar, katman açılınca). */
export const OPTIONAL_ASSETS: LoadableAsset[] = ['muscles'];

let loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

const cache = new Map<LoadableAsset, Promise<ModelPart[]>>();

export function modelUrl(asset: LoadableAsset): string {
  return new URL(`./models/${MODEL_ASSETS[asset].file}`, document.baseURI).href;
}

/** Bir model dosyasını yükler; `onBytes` indirilen bayt sayısını bildirir. */
export function loadAsset(asset: LoadableAsset, onBytes?: (loaded: number) => void): Promise<ModelPart[]> {
  const hit = cache.get(asset);
  if (hit) {
    void hit.then(() => onBytes?.(MODEL_ASSETS[asset].bytes));
    return hit;
  }
  const promise = new Promise<ModelPart[]>((resolve, reject) => {
    getLoader().load(
      modelUrl(asset),
      (gltf) => {
        try {
          resolve(extractParts(asset, gltf.scene, gltf.parser.associations, gltf.parser.json as { nodes?: Array<{ name?: string }> }));
        } catch (e) {
          reject(e instanceof Error ? e : new Error('model okunamadı'));
        }
      },
      (e) => onBytes?.(Math.min(e.loaded, MODEL_ASSETS[asset].bytes)),
      (e) => reject(e instanceof Error ? e : new Error('model yüklenemedi')),
    );
  });
  cache.set(asset, promise);
  promise.then(
    () => onBytes?.(MODEL_ASSETS[asset].bytes),
    () => cache.delete(asset),
  );
  return promise;
}

type Associations = Map<Object3D | unknown, { nodes?: number; meshes?: number; primitives?: number } | undefined>;

function extractParts(
  asset: LoadableAsset,
  scene: Object3D,
  associations: Associations,
  json: { nodes?: Array<{ name?: string }> },
): ModelPart[] {
  scene.updateMatrixWorld(true);
  const parts: ModelPart[] = [];
  let n = 0;
  scene.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    // GLTFLoader düğüm adlarını değiştirir (boşluk → _); özgün adı glTF JSON'dan al.
    let cur: Object3D | null = mesh;
    let name = '';
    while (cur) {
      const idx = associations.get(cur)?.nodes;
      if (idx !== undefined) {
        name = json.nodes?.[idx]?.name ?? '';
        break;
      }
      cur = cur.parent;
    }
    const [structure = 'unknown', label = null] = name.split('|');
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const matrix = mesh.matrixWorld.clone();
    const box = (geometry.boundingBox ?? new Box3()).clone().applyMatrix4(matrix);
    parts.push({ id: `${asset}:${n++}`, asset, structure, label, geometry, matrix, box });
  });
  return parts;
}

export function boxOf(parts: Iterable<ModelPart>): Box3 {
  const box = new Box3();
  for (const p of parts) box.union(p.box);
  return box;
}

export function centerOf(box: Box3): Vector3 {
  return box.getCenter(new Vector3());
}

/** WebGL kullanılabilir mi (ör. eski WebView, kapalı donanım hızlandırma)? */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    const ok = !!gl;
    (gl as WebGL2RenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}
