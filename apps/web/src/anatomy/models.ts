import { Box3, type BufferGeometry, Matrix4, type Mesh, type Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { type BodyModel, type LoadableAsset, MODEL_ASSETS } from './assets.generated';

export type { BodyModel, LoadableAsset };

/**
 * 3D anatomi modellerini yükler (yalnızca uygulamanın kendi dosyalarından: ./models/m|f/*.glb).
 * İki referans vücut vardır: erkek (m) ve kadın (f); ikisi de aynı yapı ve bölüm kimliklerini kullanır.
 * Model dosyaları sağlık verisi içermez; kasada değil, uygulama paketinde durur.
 * Geometriler bir kez çözülür ve oturum boyunca önbellekte kalır.
 */

export interface ModelPart {
  /** Dosya içinde benzersiz anahtar. */
  id: string;
  body: BodyModel;
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

const cache = new Map<string, Promise<ModelPart[]>>();

export function modelUrl(body: BodyModel, asset: LoadableAsset): string {
  return new URL(`./models/${MODEL_ASSETS[body][asset].file}`, document.baseURI).href;
}

export function assetBytes(body: BodyModel, asset: LoadableAsset): number {
  return MODEL_ASSETS[body][asset].bytes;
}

/** Bir model dosyasını yükler; `onBytes` indirilen bayt sayısını bildirir. */
export function loadAsset(body: BodyModel, asset: LoadableAsset, onBytes?: (loaded: number) => void): Promise<ModelPart[]> {
  const key = `${body}:${asset}`;
  const size = assetBytes(body, asset);
  const hit = cache.get(key);
  if (hit) {
    void hit.then(() => onBytes?.(size));
    return hit;
  }
  const promise = new Promise<ModelPart[]>((resolve, reject) => {
    getLoader().load(
      modelUrl(body, asset),
      (gltf) => {
        try {
          resolve(extractParts(body, asset, gltf.scene, gltf.parser.associations, gltf.parser.json as { nodes?: Array<{ name?: string }> }));
        } catch (e) {
          reject(e instanceof Error ? e : new Error('model okunamadı'));
        }
      },
      (e) => onBytes?.(Math.min(e.loaded, size)),
      (e) => reject(e instanceof Error ? e : new Error('model yüklenemedi')),
    );
  });
  cache.set(key, promise);
  promise.then(
    () => onBytes?.(size),
    () => cache.delete(key),
  );
  return promise;
}

type Associations = Map<Object3D | unknown, { nodes?: number; meshes?: number; primitives?: number } | undefined>;

function extractParts(
  body: BodyModel,
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
    parts.push({ id: `${body}:${asset}:${n++}`, body, asset, structure, label, geometry, matrix, box });
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
