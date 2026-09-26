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
import { type ModelAsset, structureById, structureForNode } from '@kh/catalog';
import { BP3D_COMMIT, BP3D_REPO, bp3dDocument, planBp3d } from './bp3d';
import { limbVesselDocument, trunkVesselDocument } from './limbs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.HRA_DIR ?? join(here, '.cache/hra');
const OUT = join(here, '../apps/web/public/models');
const WEB_INDEX = join(here, '../apps/web/src/anatomy/assets.generated.ts');

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
}

const SOURCES: SourceSpec[] = [
  { file: 'VH_Male/v1.2/VH_M_Heart.glb', asset: 'cardio', structure: 'heart', tris: 30000 },
  { file: 'VH_Male/v1.4/3d-vh-m-blood-vasculature.glb', asset: 'cardio', fallback: 'abdominal-vessels', tris: 110000, keepNodes: true },
  { file: 'VH_Male/v1.4/3d-vh-m-lung.glb', asset: 'respiratory', fallback: 'lungs', tris: 42000 },
  { file: 'VH_Male/v1.4/3d-vh-m-trachea.glb', asset: 'respiratory', structure: 'airways', tris: 8000 },
  { file: 'VH_Male/v1.2/VH_M_Liver.glb', asset: 'digestive', structure: 'liver', tris: 18000 },
  { file: 'VH_Male/v1.2/VH_M_Gallbladder.glb', asset: 'digestive', structure: 'gallbladder', tris: 2000 },
  { file: 'VH_Male/v1.2/VH_M_Pancreas.glb', asset: 'digestive', structure: 'pancreas', tris: 7000 },
  { file: 'VH_Male/v1.2/VH_M_Small_Intestine.glb', asset: 'digestive', structure: 'small-intestine', tris: 16000 },
  { file: 'VH_Male/v1.2/SBU_M_Intestine_Large.glb', asset: 'digestive', structure: 'large-intestine', tris: 14000 },
  { file: 'VH_Male/v1.2/VH_M_Kidney_L.glb', asset: 'urinary', structure: 'kidneys', tris: 14000 },
  { file: 'VH_Male/v1.2/VH_M_Kidney_R.glb', asset: 'urinary', structure: 'kidneys', tris: 14000 },
  { file: 'VH_Male/v1.2/VH_M_Ureter_L.glb', asset: 'urinary', structure: 'urinary-tract', tris: 5000 },
  { file: 'VH_Male/v1.2/VH_M_Ureter_R.glb', asset: 'urinary', structure: 'urinary-tract', tris: 5000 },
  { file: 'VH_Male/v1.2/VH_M_Urinary_Bladder.glb', asset: 'urinary', structure: 'urinary-tract', tris: 5000 },
  { file: 'VH_Male/v1.2/VH_M_Prostate.glb', asset: 'urinary', structure: 'prostate', tris: 8000 },
  { file: 'VH_Male/v1.2/Allen_M_Brain.glb', asset: 'nervous', structure: 'brain', tris: 48000 },
  { file: 'VH_Male/v1.2/VH_M_Spinal_Cord.glb', asset: 'nervous', structure: 'spinal-cord', tris: 8000 },
  { file: 'VH_Male/v1.2/VH_M_Spleen.glb', asset: 'immune', structure: 'spleen', tris: 8000 },
  { file: 'VH_Male/v1.2/VH_M_Thymus.glb', asset: 'immune', structure: 'thymus', tris: 2800 },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

function triCount(doc: Document): number {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3;
  }
  return Math.round(n);
}

function cleanLabel(name: string): string {
  return name.replace(/^VH_M_|^Allen_/, '').replace(/_+/g, ' ').trim();
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
      for (const sem of prim.listSemantics()) if (sem !== 'POSITION' && sem !== 'NORMAL') prim.setAttribute(sem, null);
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
    const structure = spec.structure ?? structureForNode(node.getName(), spec.asset) ?? spec.fallback;
    if (!structure || !structureById.has(structure)) throw new Error(`yapı bulunamadı: ${spec.file} → ${node.getName()}`);
    const key = spec.keepNodes ? `${structure}|${cleanLabel(node.getName())}` : structure;
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

/** Kalp-damar dosyasına eklenenler: BodyParts3D gövde damarları ve şematik kol/bacak damarları. */
async function loadExtraVessels(): Promise<Document[]> {
  const trunk = trunkVesselDocument();
  await simplifyTo(trunk, 16000, 'BodyParts3D gövde damarları', 13);
  const limbs = limbVesselDocument();
  await limbs.transform(weld({}), normals({ overwrite: true }));
  console.log(`  ${'şematik kol/bacak damarları'.padEnd(34)} ${String(triCount(limbs)).padStart(7)} üçgen, ${limbs.getRoot().listNodes().length} parça`);
  return [trunk, limbs];
}

/** BodyParts3D kaynaklı varlıklar: deri, iskelet, kaslar. */
const BP3D_BUDGET = { body: 36000, skeleton: 130000, muscles: 150000 } as const;

async function loadBp3d(asset: keyof typeof BP3D_BUDGET): Promise<Document> {
  const plan = planBp3d();
  const groups = asset === 'body' ? plan.skin : asset === 'skeleton' ? plan.skeleton : plan.muscles;
  const doc = bp3dDocument(groups, asset);
  await simplifyTo(doc, BP3D_BUDGET[asset], `BodyParts3D ${asset}`, groups.length);
  return doc;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const assets = [...new Set<Exclude<ModelAsset, 'schematic'>>(['body', 'skeleton', ...SOURCES.map((s) => s.asset), 'muscles'])];
  const manifest: Record<string, unknown> = {
    source: 'HuBMAP Human Reference Atlas — 3D Reference Object Library (VH Male), CC BY 4.0; BodyParts3D 3.0 (DBCLS), CC BY-SA 2.1 JP (skin, skeleton, muscles)',
    bp3d: { repo: BP3D_REPO, commit: BP3D_COMMIT },
    sourceUrl: 'https://github.com/hubmapconsortium/ccf-3d-reference-object-library',
    sourceCommit: 'f1a3a63f110e27ff0736047d52d04dba5d3087f9',
    units: 'meter; +Y up, +X subject left, +Z anterior',
    assets: {} as Record<string, unknown>,
  };

  for (const asset of assets) {
    console.log(`\n[${asset}]`);
    const target = new Document();
    target.createBuffer();
    target.createScene(asset);
    const { mergeDocuments } = await import('@gltf-transform/functions');
    if (asset === 'body' || asset === 'skeleton' || asset === 'muscles') mergeDocuments(target, await loadBp3d(asset));
    if (asset === 'cardio') for (const d of await loadExtraVessels()) mergeDocuments(target, d);
    for (const spec of SOURCES.filter((s) => s.asset === asset)) {
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

    const file = join(OUT, `${asset}.glb`);
    await io.write(file, target);
    const bounds = getBounds(scene);
    (manifest.assets as Record<string, unknown>)[asset] = {
      file: `${asset}.glb`,
      bytes: statSync(file).size,
      triangles: triCount(target),
      bounds: { min: bounds.min.map((v) => +v.toFixed(4)), max: bounds.max.map((v) => +v.toFixed(4)) },
      nodes: root.listNodes().map((n) => n.getName()),
    };
    console.log(`  → ${asset}.glb ${(statSync(file).size / 1024).toFixed(0)} KB, ${triCount(target)} üçgen`);
  }

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  // Uygulamanın yükleme ilerlemesi ve kamera sınırları için küçük bir TS dizini.
  const index = Object.fromEntries(
    Object.entries(manifest.assets as Record<string, { file: string; bytes: number; triangles: number; bounds: unknown }>).map(([k, a]) => [
      k,
      { file: a.file, bytes: a.bytes, triangles: a.triangles, bounds: a.bounds },
    ]),
  );
  writeFileSync(
    WEB_INDEX,
    `// Otomatik üretildi (assets-pipeline/build-anatomy.ts). Elle düzenlemeyin.\n` +
      `export const MODEL_ASSETS = ${JSON.stringify(index, null, 2)} as const;\n\n` +
      `export type LoadableAsset = keyof typeof MODEL_ASSETS;\n`,
  );
  writeFileSync(
    join(OUT, 'ATTRIBUTION.txt'),
    `3D anatomi modelleri

1) Organlar ve damarlar (cardio, respiratory, digestive, urinary, nervous, immune):
   HuBMAP Human Reference Atlas, 3D Reference Object Library (VH Male), CC BY 4.0.
   Kaynak: https://github.com/hubmapconsortium/ccf-3d-reference-object-library (commit f1a3a63)
   Lisans: https://creativecommons.org/licenses/by/4.0/

2) Deri, iskelet ve kaslar (body.glb, skeleton.glb, muscles.glb):
   BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.
   Kaynak: http://lifesciencedb.jp/bp3d/ — kopya: ${BP3D_REPO} (commit ${BP3D_COMMIT.slice(0, 7)})
   Lisans: https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en
   Bu üç dosya (uyarlanmış eser) aynı lisansla (CC BY-SA 2.1 JP) dağıtılır.

Değişiklikler: sahne düzleştirildi, parçalar yapıya/bölgeye göre birleştirildi, BodyParts3D parçaları HRA
koordinat sistemine benzerlik dönüşümüyle taşındı (iki farklı vücut; uyum yaklaşıktır), ağlar sadeleştirildi
(meshoptimizer), nicemlendi ve EXT_meshopt_compression ile sıkıştırıldı. Tiroid, hipofiz, hipotalamus ve
böbreküstü bezleri uygulamada şematik olarak çizilir ve bu kaynaklardan gelmez.
`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
