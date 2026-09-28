/**
 * Anatomi varlık hattı.
 *
 * Kaynaklar:
 *  - HuBMAP Human Reference Atlas (HRA) 3D referans organları, erkek (VH_M), CC BY 4.0: organlar, damarlar.
 *  - BodyParts3D 3.0 (DBCLS), CC BY-SA 2.1 JP: deri, tam iskelet ve kaslar (bkz. bp3d.ts).
 * Bütün organlar ortak bir vücut koordinat sisteminde (metre, +Y yukarı, +X kişinin solu,
 * +Z ön) konumlandırılmıştır; bu yüzden birlikte yerleştirilebilirler.
 *
 * Adımlar (kaynak dosya başına):
 *  1. Sahne hiyerarşisini düzleştir, dönüşümleri köşe noktalarına işle (dünya koordinatı).
 *  2. Yalnızca konum + normal kalsın (doku, renk yok; malzemeleri uygulama verir).
 *  3. Aynı yapıya ait parçaları tek ağda birleştir (damarlarda her damar ayrı kalır: dokununca adı görünür).
 *  4. Üçgen bütçesine göre meshoptimizer ile sadeleştir.
 * Sonra her sistem grubu tek dosyada birleştirilir, nicemlenir (quantize) ve EXT_meshopt_compression ile sıkıştırılır.
 *
 * Kullanım: pnpm --filter @kh/assets-pipeline fetch && pnpm --filter @kh/assets-pipeline build
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, type Mesh, type Node, NodeIO, type Primitive } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, dedup, flatten, joinPrimitives, meshopt, normals, prune, quantize, simplify, weld, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { type ModelAsset, cleanNodeName, partFor, structureById, structureForNode } from '@kh/catalog';
import { BP3D_COMMIT, BP3D_ORGANS, BP3D_REPO, type Bp3dGroup, bp3dDocument, centroidOf, planBp3d, readStl } from './bp3d';
import { limbVesselDocument, nerveDocument, trunkVesselDocument } from './limbs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.HRA_DIR ?? join(here, '.cache/hra');
const OUT = join(here, '../apps/web/public/models');
const WEB_INDEX = join(here, '../apps/web/src/anatomy/assets.generated.ts');

type BodySex = 'male' | 'female';

interface SourceSpec {
  file: string;
  asset: Exclude<ModelAsset, 'schematic'>;
  /** Sabit yapı; yoksa düğüm adından (structureForNode) belirlenir. */
  structure?: string;
  fallback?: string;
  /** Hedef üçgen sayısı (dosya toplamı). */
  tris: number;
  /** Her düğüm ayrı kalsın (damarlar). */
  keepNodes?: boolean;
  /** Düğüme özel yönlendirme (temizlenmiş ad): başka yapıya ata; null: atla; undefined: varsayılan. */
  route?: (clean: string) => string | null | undefined;
}

const brainRoute = (n: string) => (/hypothalamus|of hth|mammillary region/.test(n) ? 'hypothalamus' : /pineal/.test(n) ? 'pineal' : 'brain');
const biliaryRoute = (n: string) => (/pancreatic duct|ampulla/.test(n) ? 'pancreas' : 'gallbladder');
const kneeRoute = (n: string) => (/meniscus|articular cartilage|ligament/.test(n) ? 'knee' : null);
const ureterRoute = (n: string) => (/renal papilla/.test(n) ? 'kidneys' : 'urinary-tract');
const uterusRoute = (n: string) => (/abdominal ostium/.test(n) ? 'fallopian-tubes' : 'uterus');

/** HRA erkek (VH_M) ve kadın (VH_F) referans organları. */
const SOURCES: Record<BodySex, SourceSpec[]> = {
  male: [
    { file: 'VH_Male/v1.2/VH_M_Heart.glb', asset: 'cardio', structure: 'heart', tris: 30000 },
    { file: 'VH_Male/v1.4/3d-vh-m-blood-vasculature.glb', asset: 'cardio', fallback: 'abdominal-vessels', tris: 110000, keepNodes: true },
    { file: 'VH_Male/v1.4/3d-vh-m-lung.glb', asset: 'respiratory', fallback: 'lungs', tris: 42000 },
    { file: 'VH_Male/v1.4/3d-vh-m-trachea.glb', asset: 'respiratory', structure: 'airways', tris: 8000 },
    { file: 'VH_Male/v1.4/3d-vh-m-larynx.glb', asset: 'respiratory', structure: 'airways', tris: 6000 },
    { file: 'VH_Male/v1.2/VH_M_Liver.glb', asset: 'digestive', structure: 'liver', tris: 20000 },
    { file: 'VH_Male/v1.2/VH_M_Gallbladder.glb', asset: 'digestive', structure: 'gallbladder', tris: 2000 },
    { file: 'VH_Male/v1.2/VH_M_Biliary_Tree.glb', asset: 'digestive', route: biliaryRoute, tris: 3000 },
    { file: 'VH_Male/v1.2/VH_M_Pancreas.glb', asset: 'digestive', structure: 'pancreas', tris: 7000 },
    { file: 'VH_Male/v1.2/VH_M_Small_Intestine.glb', asset: 'digestive', structure: 'small-intestine', tris: 16000 },
    { file: 'VH_Male/v1.2/SBU_M_Intestine_Large.glb', asset: 'digestive', structure: 'large-intestine', tris: 14000 },
    { file: 'VH_Male/v1.2/VH_M_Kidney_L.glb', asset: 'urinary', structure: 'kidneys', tris: 14000 },
    { file: 'VH_Male/v1.2/VH_M_Kidney_R.glb', asset: 'urinary', structure: 'kidneys', tris: 14000 },
    { file: 'VH_Male/v1.2/VH_M_Ureter_L.glb', asset: 'urinary', structure: 'urinary-tract', tris: 5000 },
    { file: 'VH_Male/v1.2/VH_M_Ureter_R.glb', asset: 'urinary', structure: 'urinary-tract', tris: 5000 },
    { file: 'VH_Male/v1.2/VH_M_Urinary_Bladder.glb', asset: 'urinary', structure: 'urinary-tract', tris: 5000 },
    { file: 'VH_Male/v1.2/VH_M_Urethra.glb', asset: 'urinary', structure: 'urinary-tract', tris: 2500 },
    { file: 'VH_Male/v1.2/VH_M_Prostate.glb', asset: 'urinary', structure: 'prostate', tris: 9000 },
    { file: 'VH_Male/v1.2/Allen_M_Brain.glb', asset: 'nervous', route: brainRoute, tris: 60000 },
    { file: 'VH_Male/v1.2/VH_M_Spinal_Cord.glb', asset: 'nervous', structure: 'spinal-cord', tris: 8000 },
    { file: 'VH_Male/v1.2/VH_M_Eye_L.glb', asset: 'nervous', structure: 'eyes', tris: 4000 },
    { file: 'VH_Male/v1.2/VH_M_Eye_R.glb', asset: 'nervous', structure: 'eyes', tris: 4000 },
    { file: 'VH_Male/v1.2/VH_M_Nerves_Eye_L.glb', asset: 'nervous', structure: 'eyes', tris: 800 },
    { file: 'VH_Male/v1.2/VH_M_Nerves_Eye_R.glb', asset: 'nervous', structure: 'eyes', tris: 800 },
    { file: 'VH_Male/v1.2/VH_M_Muscles_Eye_L.glb', asset: 'nervous', structure: 'eyes', tris: 2000 },
    { file: 'VH_Male/v1.2/VH_M_Muscles_Eye_R.glb', asset: 'nervous', structure: 'eyes', tris: 2000 },
    { file: 'VH_Male/v1.2/VH_M_Spleen.glb', asset: 'immune', structure: 'spleen', tris: 8000 },
    { file: 'VH_Male/v1.2/VH_M_Thymus.glb', asset: 'immune', structure: 'thymus', tris: 2800 },
    { file: 'VH_Male/v1.4/3d-vh-m-palatine-tonsil-l.glb', asset: 'immune', structure: 'tonsils', tris: 800 },
    { file: 'VH_Male/v1.4/3d-vh-m-palatine-tonsil-r.glb', asset: 'immune', structure: 'tonsils', tris: 800 },
    { file: 'VH_Male/v1.2/NIH_M_Lymph_Node.glb', asset: 'immune', structure: 'lymph-node', tris: 9000 },
    { file: 'VH_Male/v1.2/VH_M_Knee_L.glb', asset: 'skeleton', route: kneeRoute, tris: 5000 },
    { file: 'VH_Male/v1.2/VH_M_Knee_R.glb', asset: 'skeleton', route: kneeRoute, tris: 5000 },
    { file: 'VH_Male/v1.2/VH_M_Ligaments_Knee_L.glb', asset: 'skeleton', structure: 'knee', tris: 2500 },
    { file: 'VH_Male/v1.2/VH_M_Ligaments_Knee_R.glb', asset: 'skeleton', structure: 'knee', tris: 2500 },
  ],
  female: [
    { file: 'VH_Female/v1.3/VH_F_skin.glb', asset: 'body', structure: 'skin', tris: 40000 },
    { file: 'VH_Female/v1.2/VH_F_Vertebrae.glb', asset: 'skeleton', structure: 'bones', tris: 16000 },
    { file: 'VH_Female/v1.2/VH_F_Pelvis.glb', asset: 'skeleton', route: (n) => (/spongy/.test(n) ? null : 'bones'), tris: 12000 },
    { file: 'VH_Female/v1.2/VH_F_Heart.glb', asset: 'cardio', structure: 'heart', tris: 30000 },
    { file: 'VH_Female/v1.4/3d-vh-f-blood-vasculature.glb', asset: 'cardio', fallback: 'abdominal-vessels', tris: 110000, keepNodes: true },
    { file: 'VH_Female/v1.4/3d-vh-f-lung.glb', asset: 'respiratory', fallback: 'lungs', tris: 42000 },
    { file: 'VH_Female/v1.4/3d-vh-f-trachea.glb', asset: 'respiratory', structure: 'airways', tris: 8000 },
    { file: 'VH_Female/v1.4/3d-vh-f-larynx.glb', asset: 'respiratory', structure: 'airways', tris: 6000 },
    { file: 'VH_Female/v1.2/VH_F_Liver.glb', asset: 'digestive', structure: 'liver', tris: 20000 },
    { file: 'VH_Female/v1.2/VH_F_Gallbladder.glb', asset: 'digestive', structure: 'gallbladder', tris: 2000 },
    { file: 'VH_Female/v1.2/VH_F_Biliary_Tree.glb', asset: 'digestive', route: biliaryRoute, tris: 3000 },
    { file: 'VH_Female/v1.2/VH_F_Pancreas.glb', asset: 'digestive', structure: 'pancreas', tris: 7000 },
    { file: 'VH_Female/v1.2/VH_F_Small_Intestine.glb', asset: 'digestive', structure: 'small-intestine', tris: 16000 },
    { file: 'VH_Female/v1.2/SBU_F_Intestine_Large.glb', asset: 'digestive', structure: 'large-intestine', tris: 14000 },
    { file: 'VH_Female/v1.2/VH_F_Kidney_L.glb', asset: 'urinary', structure: 'kidneys', tris: 14000 },
    { file: 'VH_Female/v1.2/VH_F_Kidney_R.glb', asset: 'urinary', structure: 'kidneys', tris: 14000 },
    { file: 'VH_Female/v1.2/VH_F_Ureter_L.glb', asset: 'urinary', route: ureterRoute, tris: 5000 },
    { file: 'VH_Female/v1.2/VH_F_Ureter_R.glb', asset: 'urinary', route: ureterRoute, tris: 5000 },
    { file: 'VH_Female/v1.2/VH_F_Urinary_Bladder.glb', asset: 'urinary', structure: 'urinary-tract', tris: 5000 },
    { file: 'VH_Female/v1.2/Allen_F_Brain.glb', asset: 'nervous', route: brainRoute, tris: 60000 },
    { file: 'VH_Female/v1.2/VH_F_Spinal_Cord.glb', asset: 'nervous', structure: 'spinal-cord', tris: 8000 },
    { file: 'VH_Female/v1.2/VH_F_Eye_L.glb', asset: 'nervous', structure: 'eyes', tris: 4000 },
    { file: 'VH_Female/v1.2/VH_F_Eye_R.glb', asset: 'nervous', structure: 'eyes', tris: 4000 },
    { file: 'VH_Female/v1.2/VH_F_Nerves_of_Eye_L.glb', asset: 'nervous', structure: 'eyes', tris: 800 },
    { file: 'VH_Female/v1.2/VH_F_Nerves_of_Eye_R.glb', asset: 'nervous', structure: 'eyes', tris: 800 },
    { file: 'VH_Female/v1.2/VH_F_Muscles_Eye_L.glb', asset: 'nervous', structure: 'eyes', tris: 2000 },
    { file: 'VH_Female/v1.2/VH_F_Muscles_Eye_R.glb', asset: 'nervous', structure: 'eyes', tris: 2000 },
    { file: 'VH_Female/v1.2/VH_F_Spleen.glb', asset: 'immune', structure: 'spleen', tris: 8000 },
    { file: 'VH_Female/v1.2/VH_F_Thymus.glb', asset: 'immune', structure: 'thymus', tris: 2800 },
    { file: 'VH_Female/v1.4/3d-vh-f-palatine-tonsil-l.glb', asset: 'immune', structure: 'tonsils', tris: 800 },
    { file: 'VH_Female/v1.4/3d-vh-f-palatine-tonsil-r.glb', asset: 'immune', structure: 'tonsils', tris: 800 },
    { file: 'VH_Female/v1.2/NIH_F_Lymph_Node.glb', asset: 'immune', structure: 'lymph-node', tris: 9000 },
    { file: 'VH_Female/v1.2/VH_F_Knee_L.glb', asset: 'skeleton', route: kneeRoute, tris: 5000 },
    { file: 'VH_Female/v1.2/VH_F_Knee_R.glb', asset: 'skeleton', route: kneeRoute, tris: 5000 },
    { file: 'VH_Female/v1.2/VH_F_Ligaments_Knee_L.glb', asset: 'skeleton', structure: 'knee', tris: 2500 },
    { file: 'VH_Female/v1.2/VH_F_Ligaments_Knee_R.glb', asset: 'skeleton', structure: 'knee', tris: 2500 },
    { file: 'VH_Female/v1.2/VH_F_Uterus.glb', asset: 'reproductive', route: uterusRoute, tris: 6000 },
    { file: 'VH_Female/v1.2/VH_F_Ligaments_Uterus_Ovaries.glb', asset: 'reproductive', structure: 'uterus', tris: 5000 },
    { file: 'VH_Female/v1.2/VH_F_Ovary_L.glb', asset: 'reproductive', structure: 'ovaries', tris: 1500 },
    { file: 'VH_Female/v1.2/VH_F_Ovary_R.glb', asset: 'reproductive', structure: 'ovaries', tris: 1500 },
    { file: 'VH_Female/v1.2/VH_F_Fallopian_Tube_L.glb', asset: 'reproductive', structure: 'fallopian-tubes', tris: 2000 },
    { file: 'VH_Female/v1.2/VH_F_Fallopian_Tube_R.glb', asset: 'reproductive', structure: 'fallopian-tubes', tris: 2000 },
    { file: 'VH_Female/v1.2/VH_F_Vagina.glb', asset: 'reproductive', structure: 'vagina', tris: 2500 },
    { file: 'VH_Female/v1.3/VH_F_mammary_gland_L.glb', asset: 'reproductive', structure: 'breasts', tris: 6000 },
    { file: 'VH_Female/v1.3/VH_F_mammary_gland_R.glb', asset: 'reproductive', structure: 'breasts', tris: 6000 },
  ],
};

/**
 * Erkek → kadın referans vücudu benzerlik dönüşümü: p' = s·R·p + t. HRA VH_M ve VH_F omurlarının
 * (C1–L5), sakrum, kuyruk sokumu ve kalça kemiklerinin ağırlık merkezleri üzerinden Umeyama ile bulundu
 * (32 nokta, ortalama artık 12,6 mm, en büyük 25 mm). BodyParts3D kemik ve kasları, gövde damarları,
 * şematik kol-bacak damarları ve sinirleri kadın vücuduna bu dönüşümle taşınır (yaklaşık uyum).
 */
const M2F = {"s": 0.9474131535726638, "R": [[0.9975515385556587, 0.013469898030698587, -0.06862572238076019], [-0.01390318889516129, 0.9998862908193328, -0.005840100179127613], [0.06853925345219351, 0.00677991730033454, 0.9976253823242558]], "t": [-0.015128214748123241, -0.00037655989137586054, -0.06953166038611344]} as const;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

function triCount(doc: Document): number {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
  }
  return Math.round(n);
}

function cleanLabel(name: string): string {
  return name.replace(/^VH_[MF]_|^Allen_/, '').replace(/_+/g, ' ').trim();
}

async function loadSource(spec: SourceSpec): Promise<Document> {
  const doc = await io.read(join(SRC, spec.file));
  const root = doc.getRoot();

  // 1) Düzleştir + dönüşümleri işle
  await doc.transform(flatten());
  for (const node of root.listNodes()) {
    if (node.getMesh()) clearNodeTransform(node);
  }

  // 2) Gereksiz öznitelikler ve malzemeler
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      // Normaller de atılır (sonda yeniden hesaplanır): düz gölgeli kaynaklarda köşeler birleşsin, sadeleştirme çalışsın.
      for (const sem of prim.listSemantics()) if (sem !== 'POSITION') prim.setAttribute(sem, null);
      prim.setMaterial(null);
    }
  }
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();

  // 3) Yapıya göre grupla ve birleştir
  const scene = root.getDefaultScene() ?? root.listScenes()[0]!;
  const groups = new Map<string, { node: Node; label: string }[]>();
  for (const node of root.listNodes()) {
    if (!node.getMesh()) continue;
    const routed = spec.route?.(cleanNodeName(node.getName()));
    if (routed === null) continue;
    const structure = routed ?? spec.structure ?? structureForNode(node.getName(), spec.asset) ?? spec.fallback;
    if (!structure || !structureById.has(structure)) throw new Error(`yapı bulunamadı: ${spec.file} → ${node.getName()}`);
    // Damarlar tek tek; organlar bölümlerine göre (parts.ts); kuralı olmayan yapılar tek parça.
    const part = spec.keepNodes ? cleanLabel(node.getName()) : partFor(structure, node.getName());
    const key = part ? `${structure}|${part}` : structure;
    const list = groups.get(key) ?? [];
    list.push({ node, label: cleanLabel(node.getName()) });
    groups.set(key, list);
  }

  const buffer = root.listBuffers()[0] ?? doc.createBuffer();
  const newNodes: Node[] = [];
  for (const [key, list] of groups) {
    const prims: Primitive[] = [];
    for (const { node } of list) for (const p of (node.getMesh() as Mesh).listPrimitives()) prims.push(p);
    // Aynı öznitelik kümesine sahip primitifleri birleştir (joinPrimitives bunu şart koşar).
    const withNormals = prims.filter((p) => p.getAttribute('NORMAL'));
    const withoutNormals = prims.filter((p) => !p.getAttribute('NORMAL'));
    const mesh = doc.createMesh(key);
    for (const set of [withNormals, withoutNormals]) {
      if (!set.length) continue;
      const joined = set.length === 1 ? set[0]!.clone() : joinPrimitives(set);
      for (const acc of [joined.getIndices(), ...joined.listAttributes()]) acc?.setBuffer(buffer);
      mesh.addPrimitive(joined);
    }
    const n = doc.createNode(key).setMesh(mesh);
    newNodes.push(n);
  }
  for (const node of root.listNodes()) if (!newNodes.includes(node)) node.dispose();
  for (const n of newNodes) scene.addChild(n);
  await doc.transform(prune());

  await simplifyTo(doc, spec.tris, spec.file.split('/').pop() ?? spec.file, groups.size);
  return doc;
}

/** Ağı hedef üçgen sayısına sadeleştirir ve normalleri yeniden hesaplar. */
async function simplifyTo(doc: Document, tris: number, name: string, parts: number) {
  await MeshoptSimplifier.ready;
  const before = triCount(doc);
  const ratio = Math.min(1, tris / Math.max(1, before));
  const spec = { tris };
  await doc.transform(weld({}));
  // Hata sınırını hedefe ulaşılana kadar kademeli gevşet (ince damarlar için küçük başlar).
  if (ratio < 0.98) {
    for (const error of [0.001, 0.003, 0.008, 0.02, 0.05]) {
      await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, spec.tris / Math.max(1, triCount(doc))), error, lockBorder: false }));
      if (triCount(doc) <= spec.tris * 1.15) break;
    }
  }
  await doc.transform(normals({ overwrite: true }));
  console.log(`  ${name.padEnd(34)} ${String(before).padStart(7)} → ${String(triCount(doc)).padStart(6)} üçgen, ${parts} parça`);
}

/* ------------------------------------------------------------------ erkek → kadın dönüşümü */

type V3 = [number, number, number];
const m2fPoint = (p: V3): V3 => {
  const R = M2F.R;
  return [0, 1, 2].map((r) => M2F.s * (R[r]![0]! * p[0] + R[r]![1]! * p[1] + R[r]![2]! * p[2]) + M2F.t[r]!) as V3;
};
const m2fVector = (v: V3): V3 => {
  const R = M2F.R;
  return [0, 1, 2].map((r) => M2F.s * (R[r]![0]! * v[0] + R[r]![1]! * v[1] + R[r]![2]! * v[2])) as V3;
};
const m2fArray = (a: Float32Array) => {
  for (let i = 0; i < a.length; i += 3) {
    const q = m2fPoint([a[i]!, a[i + 1]!, a[i + 2]!]);
    a[i] = q[0];
    a[i + 1] = q[1];
    a[i + 2] = q[2];
  }
};

/** HRA dosyasındaki seçili düğümlerin ağırlık merkezi ya da üst kutbu (dünya koordinatı). */
async function hraAnchor(file: string, filter: (clean: string) => boolean, mode: 'centroid' | 'top'): Promise<V3> {
  const doc = await io.read(join(SRC, file));
  await doc.transform(flatten());
  const pts: V3[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !filter(cleanNodeName(node.getName()))) continue;
    clearNodeTransform(node);
    for (const prim of mesh.listPrimitives()) {
      const acc = prim.getAttribute('POSITION')!;
      const e: number[] = [0, 0, 0];
      for (let i = 0; i < acc.getCount(); i++) {
        acc.getElement(i, e);
        pts.push([e[0]!, e[1]!, e[2]!]);
      }
    }
  }
  if (!pts.length) throw new Error(`işaret noktası yok: ${file}`);
  const use = mode === 'top' ? (() => { const maxY = Math.max(...pts.map((p) => p[1])); return pts.filter((p) => p[1] > maxY - 0.012); })() : pts;
  const c: V3 = [0, 0, 0];
  for (const p of use) for (let k = 0; k < 3; k++) c[k] += p[k]! / use.length;
  return c;
}

/**
 * Küçük BodyParts3D bezlerinin kadın vücudundaki yeri: erkekte (elle ayarlanmış) komşu HRA organına
 * göre konumu ölçülür, aynı göreli konum kadın HRA organına dönüşümle (ölçek + dönme) uygulanır.
 */
async function femaleGlandTargets(): Promise<Record<string, V3>> {
  const H = (n: string) => /hypothalamus|of hth|mammillary region/.test(n);
  const hm = await hraAnchor('VH_Male/v1.2/Allen_M_Brain.glb', H, 'centroid');
  const hf = await hraAnchor('VH_Female/v1.2/Allen_F_Brain.glb', H, 'centroid');
  const all = () => true;
  const krm = await hraAnchor('VH_Male/v1.2/VH_M_Kidney_R.glb', all, 'top');
  const klm = await hraAnchor('VH_Male/v1.2/VH_M_Kidney_L.glb', all, 'top');
  const krf = await hraAnchor('VH_Female/v1.2/VH_F_Kidney_R.glb', all, 'top');
  const klf = await hraAnchor('VH_Female/v1.2/VH_F_Kidney_L.glb', all, 'top');
  const maleCentroid = (key: string) => {
    const g = BP3D_ORGANS.endocrine.find((x) => x.key === key)!;
    const arrays = g.ids.map(readStl);
    const c = centroidOf(arrays);
    return [c[0] + (g.offset?.[0] ?? 0), c[1] + (g.offset?.[1] ?? 0), c[2] + (g.offset?.[2] ?? 0)] as V3;
  };
  const rel = (p: V3, anchor: V3) => m2fVector([p[0] - anchor[0], p[1] - anchor[1], p[2] - anchor[2]]);
  const at = (anchor: V3, d: V3): V3 => [anchor[0] + d[0], anchor[1] + d[1], anchor[2] + d[2]];
  return {
    pituitary: at(hf, rel(maleCentroid('pituitary'), hm)),
    'adrenals|right': at(krf, rel(maleCentroid('adrenals|right'), krm)),
    'adrenals|left': at(klf, rel(maleCentroid('adrenals|left'), klm)),
  };
}

/** Kalp-damar dosyasına eklenenler: BodyParts3D gövde damarları ve şematik kol/bacak damarları. */
async function loadExtraVessels(sex: BodySex): Promise<Document[]> {
  const trunk = trunkVesselDocument(sex === 'female' ? m2fArray : undefined);
  await simplifyTo(trunk, 16000, 'BodyParts3D gövde damarları', 13);
  const limbs = limbVesselDocument(sex === 'female' ? m2fPoint : undefined);
  await limbs.transform(weld({}), normals({ overwrite: true }));
  console.log(`  ${'şematik kol/bacak damarları'.padEnd(34)} ${String(triCount(limbs)).padStart(7)} üçgen, ${limbs.getRoot().listNodes().length} parça`);
  return [trunk, limbs];
}

async function loadNerves(sex: BodySex): Promise<Document> {
  const doc = nerveDocument(sex === 'female' ? m2fPoint : undefined);
  await doc.transform(weld({}), normals({ overwrite: true }));
  console.log(`  ${'şematik periferik sinirler'.padEnd(34)} ${String(triCount(doc)).padStart(7)} üçgen, ${doc.getRoot().listNodes().length} parça`);
  return doc;
}

/** BodyParts3D kaynaklı varlıklar: deri (yalnız erkek), iskelet, kaslar. */
const BP3D_BUDGET = { body: 36000, skeleton: 130000, muscles: 150000 } as const;
const BP3D_ORGAN_BUDGET = { digestive: 14000, endocrine: 4000, reproductive: 9000, respiratory: 5000 } as const;

async function loadBp3d(asset: keyof typeof BP3D_BUDGET, sex: BodySex): Promise<Document> {
  const plan = planBp3d();
  let groups = asset === 'body' ? plan.skin : asset === 'skeleton' ? plan.skeleton : plan.muscles;
  // Kadında omurga ve leğen kemiği HRA VH_F'den gelir (kadın pelvisi); geri kalanı dönüştürülür.
  if (sex === 'female' && asset === 'skeleton') groups = groups.filter((g) => g.key !== 'bones|spine' && g.key !== 'bones|pelvis');
  const doc = bp3dDocument(groups, asset, sex === 'female' ? m2fArray : undefined);
  await simplifyTo(doc, BP3D_BUDGET[asset] * (sex === 'female' && asset === 'skeleton' ? 0.9 : 1), `BodyParts3D ${asset}`, groups.length);
  return doc;
}

async function loadBp3dOrgans(asset: keyof typeof BP3D_ORGANS, sex: BodySex, glands: Record<string, V3> | null): Promise<Document | null> {
  if (asset === 'reproductive' && sex === 'female') return null;
  const groups: Bp3dGroup[] = BP3D_ORGANS[asset];
  const place = glands ? (g: Bp3dGroup, c: V3): V3 | null => (glands[g.key] ? [glands[g.key]![0] - c[0], glands[g.key]![1] - c[1], glands[g.key]![2] - c[2]] : null) : undefined;
  const doc = bp3dDocument(groups, asset, sex === 'female' ? m2fArray : undefined, place);
  await simplifyTo(doc, BP3D_ORGAN_BUDGET[asset], `BodyParts3D ${asset}`, groups.length);
  return doc;
}

const ASSETS: Exclude<ModelAsset, 'schematic'>[] = ['body', 'skeleton', 'endocrine', 'digestive', 'urinary', 'reproductive', 'respiratory', 'nervous', 'immune', 'cardio', 'muscles'];

async function main() {
  const manifest: Record<string, unknown> = {
    source: 'HuBMAP Human Reference Atlas — 3D Reference Object Library (VH Male, VH Female), CC BY 4.0; BodyParts3D 3.0 (DBCLS), CC BY-SA 2.1 JP (skin [male], skeleton, muscles, stomach, esophagus, glands, diaphragm)',
    bp3d: { repo: BP3D_REPO, commit: BP3D_COMMIT },
    sourceUrl: 'https://github.com/hubmapconsortium/ccf-3d-reference-object-library',
    sourceCommit: 'f1a3a63f110e27ff0736047d52d04dba5d3087f9',
    units: 'meter; +Y up, +X subject left, +Z anterior',
    maleToFemale: M2F,
    bodies: {} as Record<string, Record<string, unknown>>,
  };
  mkdirSync(OUT, { recursive: true });
  const only = process.env.ONLY_SEX as BodySex | undefined;
  for (const sex of ['male', 'female'] as const) {
    if (only && only !== sex) continue;
    const dir = join(OUT, sex === 'male' ? 'm' : 'f');
    mkdirSync(dir, { recursive: true });
    const glands = sex === 'female' ? await femaleGlandTargets() : null;
    const assets: Record<string, unknown> = {};
    (manifest.bodies as Record<string, unknown>)[sex] = assets;
    for (const asset of ASSETS) {
      console.log(`\n[${sex} · ${asset}]`);
      const target = new Document();
      target.createBuffer();
      target.createScene(asset);
      const { mergeDocuments } = await import('@gltf-transform/functions');
      if ((asset === 'body' && sex === 'male') || asset === 'skeleton' || asset === 'muscles') mergeDocuments(target, await loadBp3d(asset, sex));
      if (asset === 'cardio') for (const d of await loadExtraVessels(sex)) mergeDocuments(target, d);
      if (asset === 'nervous') mergeDocuments(target, await loadNerves(sex));
      if (asset === 'digestive' || asset === 'endocrine' || asset === 'reproductive' || asset === 'respiratory') {
        const doc = await loadBp3dOrgans(asset, sex, glands);
        if (doc) mergeDocuments(target, doc);
      }
      for (const spec of SOURCES[sex].filter((s) => s.asset === asset)) {
        const src = await loadSource(spec);
        mergeDocuments(target, src);
      }
      const root = target.getRoot();
      // Tüm düğümleri tek sahnede topla, tek arabellek kullan.
      const scene = root.listScenes()[0]!;
      for (const s of root.listScenes().slice(1)) {
        for (const child of s.listChildren()) scene.addChild(child);
        s.dispose();
      }
      const buffer = root.listBuffers()[0]!;
      for (const acc of root.listAccessors()) acc.setBuffer(buffer);
      for (const b of root.listBuffers().slice(1)) b.dispose();
      root.setDefaultScene(scene);

      target.createExtension(KHRMeshQuantization).setRequired(true);
      target.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
      await MeshoptEncoder.ready;
      await target.transform(dedup(), prune(), weld({}), quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

      const file = join(dir, `${asset}.glb`);
      await io.write(file, target);
      const bounds = getBounds(scene);
      assets[asset] = {
        file: `${sex === 'male' ? 'm' : 'f'}/${asset}.glb`,
        bytes: statSync(file).size,
        triangles: triCount(target),
        bounds: { min: bounds.min.map((v) => +v.toFixed(4)), max: bounds.max.map((v) => +v.toFixed(4)) },
        nodes: root.listNodes().map((n) => n.getName()),
      };
      console.log(`  → ${sex}/${asset}.glb ${(statSync(file).size / 1024).toFixed(0)} KB, ${triCount(target)} üçgen`);
    }
  }
  if (only) {
    console.log('\nONLY_SEX: dizin ve künye dosyaları güncellenmedi.');
    return;
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  // Uygulamanın yükleme ilerlemesi ve kamera sınırları için küçük bir TS dizini.
  const bodies = manifest.bodies as Record<string, Record<string, { file: string; bytes: number; triangles: number; bounds: unknown }>>;
  const index = Object.fromEntries(
    Object.entries(bodies).map(([sex, assets]) => [
      sex,
      Object.fromEntries(Object.entries(assets).map(([k, a]) => [k, { file: a.file, bytes: a.bytes, triangles: a.triangles, bounds: a.bounds }])),
    ]),
  );
  writeFileSync(
    WEB_INDEX,
    `// Otomatik üretildi (assets-pipeline/build-anatomy.ts). Elle düzenlemeyin.\n` +
      `export const MODEL_ASSETS = ${JSON.stringify(index, null, 2)} as const;\n\n` +
      `export type BodyModel = keyof typeof MODEL_ASSETS;\n` +
      `export type LoadableAsset = keyof (typeof MODEL_ASSETS)['male'];\n`,
  );
  writeFileSync(
    join(OUT, 'ATTRIBUTION.txt'),
    `3D anatomi modelleri (m/ = erkek referans vücudu, f/ = kadın referans vücudu)

1) Organlar, damarlar, beyin bölgeleri, göz katmanları, kalp odacıkları ve kapakları, böbrek iç yapısı,
   lenf düğümü, bademcikler, diz bağları ve menisküsler; kadın vücudunda ayrıca deri, omurga, leğen kemiği,
   rahim, yumurtalıklar, fallop tüpleri, vajina ve meme bezleri:
   HuBMAP Human Reference Atlas, 3D Reference Object Library (VH Male, VH Female), CC BY 4.0.
   Kaynak: https://github.com/hubmapconsortium/ccf-3d-reference-object-library (commit f1a3a63)
   Lisans: https://creativecommons.org/licenses/by/4.0/

2) Erkek derisi, iskelet (kadında omurga ve leğen kemiği hariç), kaslar, mide, yemek borusu, hipofiz,
   böbreküstü bezleri, diyafram, erkek üreme organları ve bazı gövde damarları:
   BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.
   Kaynak: http://lifesciencedb.jp/bp3d/ — kopya: ${BP3D_REPO} (commit ${BP3D_COMMIT.slice(0, 7)})
   Lisans: https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en
   Bu parçalardan üretilen model dosyaları (uyarlanmış eser) aynı lisansla (CC BY-SA 2.1 JP) dağıtılır.

3) Kol ve bacak damarları ile periferik sinirler: bu uygulama için BodyParts3D kemiklerinden türetilen
   ŞEMATİK tüpler.

Değişiklikler: sahne düzleştirildi, parçalar yapıya ve anatomik bölüme göre birleştirildi, BodyParts3D
parçaları HRA koordinat sistemine benzerlik dönüşümüyle taşındı (farklı vücutlar; uyum yaklaşıktır). Kadın
vücudunda BodyParts3D kemik ve kasları ile şematik damar ve sinirler erkek → kadın benzerlik dönüşümüyle
(omur ve pelvis noktalarına göre) taşındı; hipofiz ve böbreküstü bezleri komşu HRA organlarına göre
yerleştirildi. Ağlar sadeleştirildi (meshoptimizer), nicemlendi ve EXT_meshopt_compression ile sıkıştırıldı.
Tiroid bezi ve kulak kaynaklarda olmadığından uygulamada şematik olarak çizilir.
`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
