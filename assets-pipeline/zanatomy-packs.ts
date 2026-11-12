/**
 * İsteğe bağlı anatomi paketleri (Z-Anatomy, CC BY-SA 4.0; BodyParts3D türevi + ek modeller).
 *
 * Her paket bir sistemdir (kaslar, eklemler, sinirler, damarlar, lenf düğümleri, baş-boyun) ve her
 * vücut (erkek/kadın) için ayrı üretilir. Paket dosyası (.khpack) bir ZIP'tir:
 *   manifest.json    kimlik, vücut, içerik, kaynak/lisans, model.glb'nin SHA-256 özeti
 *   model.glb        her yapı ayrı düğüm ("yapı|bölüm|kaynak-adı"), adı ve kaynağı düğüm extras'ında
 *   ATTRIBUTION.txt  atıf ve değişiklikler
 * Uygulama paketi kurarken özeti hem manifestle hem de uygulamaya gömülü resmi listeyle
 * (apps/web/src/anatomy/packs.generated.ts) karşılaştırır; eşleşmeyen paket kurulmaz.
 *
 * Alınmayanlar (lisans/kaynak): iç kulak (koklea, vestibül: Dundee, CC BY-NC-SA), böbrek
 * (lissiecowley, CC BY-NC), beyin yüzeyleri (Brainder / UW, lisansı belirtilmemiş). Uygulamada daha iyi
 * kaynaktan (HRA) zaten bulunan yapılar da alınmaz (göz, kalp, ana gövde damarları, iç organlar).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { bp3dName, meshNode, planBp3d, readStl } from './bp3d';
import { type Rigid, type V3, PointGrid, apply as applyRigid, icp } from './fit';
import { ZA_COMMIT, ZA_REPO, type Sim, type ZaMesh, applySimArray, baseName, isAttachment, isLabel, readZa, sideOf, zaToBody } from './zanatomy-read';
import { zaName } from './zanatomy-names';

export const PACK_FORMAT = 'kh-anatomy-pack';
export const PACK_VERSION = 1;

type Side = 'l' | 'r' | null;
interface Placed {
  structure: string;
  part: string;
  /** Kemik gibi katı yapı: kadında katı (eklem) dönüşümü; değilse yumuşak doku eşlemesi. */
  rigid?: string;
  /** Yerel hizalama: bu kemiğe göre ek düzeltme (dişler çeneye, kemikçikler şakak kemiğine). */
  anchor?: Anchor;
}

type Anchor = 'mandible' | 'maxilla' | 'temporal-l' | 'temporal-r';
/** Yerel hizalama kemikleri: Z-Anatomy adı → uygulamadaki (BodyParts3D) kemik adları. */
const ANCHORS: Record<Anchor, { za: string[]; bp3d: string[] }> = {
  mandible: { za: ['Mandible'], bp3d: ['mandible'] },
  maxilla: { za: ['Maxilla.l', 'Maxilla.r'], bp3d: ['left maxilla', 'right maxilla'] },
  'temporal-l': { za: ['Temporal bone.l'], bp3d: ['left temporal bone'] },
  'temporal-r': { za: ['Temporal bone.r'], bp3d: ['right temporal bone'] },
};

export interface PackDef {
  id: string;
  title: string;
  summary: string;
  files: string[];
  classify: (m: ZaMesh, side: Side, base: string) => Placed | null;
  tris: number;
  /** Paket etkinken temel modelde gizlenen yapılar (paket onların yerini alır). */
  replaces: string[];
  /** Paket etkinken çizilmeyen şematik parçalar: "tiroid" ya da "yapı:bölüm". */
  schematicReplaced: string[];
  /** Ek atıflar (Z-Anatomy içindeki başka kaynaklı modeller). */
  credits?: string[];
}

const P = (m: ZaMesh) => m.path.join('/');
const lr = (side: Side) => side ?? 'l';

/** HRA'da (uygulamada) zaten bulunan ana gövde damarları: paketten alınmaz. */
const HRA_VESSELS =
  /^(aorta|ascending aorta|aortic arch|thoracic aorta|abdominal aorta|descending aorta|aortic bifurcation|brachiocephalic trunk|(left |right )?common carotid artery|(left |right )?subclavian (artery|vein)|(common|external|internal) iliac (artery|vein)|(left |right )?renal (artery|vein)|(superior|inferior) mesenteric (artery|vein)|co?eliac trunk|splenic (artery|vein)|common hepatic artery|hepatic artery proper|(left |right )?hepatic (artery|vein|veins)|middle hepatic vein|hepatic portal vein|portal vein|inferior vena cava.*|superior vena cava|(left |right )?brachiocephalic vein|internal jugular vein|.*colic (artery|vein|arteries|veins)|ileocolic (artery|vein)|sigmoid (arteries|veins|artery|vein)|.*rectal (artery|vein|arteries|veins)|cystic (artery|vein)|marginal artery.*|.*pancreaticoduodenal.*|uterine (artery|vein|veins)|internal pudendal (artery|vein|veins)|median sacral (artery|vein))$/i;

const HRA_KNEE = /meniscus|cruciate ligament|tibial collateral ligament|fibular collateral ligament|patellar ligament/i;

export const PACKS: PackDef[] = [
  {
    id: 'kaslar',
    title: 'Kaslar, tendonlar ve fasyalar',
    summary: 'Tek tek iskelet kasları (tendonlarıyla), fasyalar, bursalar ve tendon kılıfları. Temel modeldeki 15 bölgesel kas parçasının yerini alır.',
    files: ['MuscularSystem100.fbx'],
    tris: 520000,
    replaces: ['skeletal-muscle'],
    schematicReplaced: [],
    classify: (m, side) => {
      const p = P(m);
      if (/Extra-ocular/.test(p)) return null; // göz kasları HRA'dan
      const s = lr(side);
      const M = (part: string): Placed => ({ structure: 'skeletal-muscle', part });
      if (/^Fasciae/.test(p)) return M('fascia');
      if (/Bursae of/.test(p)) return M('bursae');
      if (/Tendon sheaths/.test(p)) return M('tendon-sheaths');
      if (/^Cranial part/.test(p)) return M('head');
      if (/^Cervical part/.test(p)) return M('neck');
      if (/^Thoracic part/.test(p)) return M('thorax');
      if (/^Abdominal part/.test(p)) return M('abdomen');
      if (/^Dorsal part/.test(p)) return M('back');
      if (/^Pelvic part/.test(p)) return M('pelvic-floor');
      if (/upper limb/.test(p)) return M(/forearm|Muscles of hand/.test(p) ? `forearm-${s}` : `upper-arm-${s}`);
      if (/lower limb/.test(p)) return M(/gluteal|Iliopsoas/.test(p) ? `hip-${s}` : /thigh/.test(p) ? `thigh-${s}` : `leg-${s}`);
      return M('other');
    },
  },
  {
    id: 'eklemler',
    title: 'Eklemler ve bağlar',
    summary: 'Eklem kapsülleri, bağlar, eklem diskleri ve zarlar (kafatası, omurga, göğüs, kol, bacak, gırtlak). Diz bağları ve menisküsler temel modelde (HRA) kalır.',
    files: ['Joints100.fbx'],
    tris: 130000,
    replaces: [],
    schematicReplaced: [],
    classify: (m, side, base) => {
      const p = P(m);
      if (/Intervertebral symphysis/.test(p)) return null; // diskler temel iskelette (BodyParts3D)
      if (HRA_KNEE.test(base)) return null; // diz: HRA
      const s = lr(side);
      const J = (part: string): Placed => ({ structure: 'joints', part });
      if (/Joints of skull/.test(p)) return J('skull');
      if (/Joints of vertebral column/.test(p)) return J('spine');
      if (/Thoracic joints/.test(p)) return J('thorax');
      if (/Laryngeal joints/.test(p)) return J('larynx');
      if (/Joints of upper limb/.test(p)) return J(`upper-${s}`);
      if (/Joints of pelvic girdle/.test(p) && !side) return J('pelvis');
      if (/Joints of lower limb/.test(p)) return J(`lower-${s}`);
      return J('other');
    },
  },
  {
    id: 'sinirler',
    title: 'Sinirler',
    summary: 'Kafa sinirleri (I–XII ve dalları), boyun, kol (brakiyal pleksus) ve bel-sakral pleksus sinirleri, sempatik zincir, spinal ganglionlar ve beyin-omurilik zarları. Temel modeldeki şematik sinir tüplerinin yerini alır.',
    files: ['NervousSystem100.fbx'],
    tris: 260000,
    replaces: ['nerves'],
    schematicReplaced: [],
    credits: ['Kafa sinirleri: "Cranial Nerves and Foramina" — University of Dundee, CAHID, CC BY 4.0 (Z-Anatomy aracılığıyla).'],
    classify: (m, side, base) => {
      const p = P(m);
      if (/^Sense organs/.test(p)) return null; // göz HRA'dan; kulak baş-boyun paketinde
      if (/^Central nervous system/.test(p)) {
        if (/Meninges/.test(p)) return { structure: /spinal/i.test(base) ? 'spinal-cord' : 'brain', part: 'meninges' };
        return null; // beyin yüzeyleri: lisans belirsiz; omurilik HRA'dan
      }
      const s = lr(side);
      const N = (part: string): Placed => ({ structure: 'nerves', part });
      if (/\((i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\)/i.test(base) || /Cranial nerves/.test(p)) return N('cranial');
      if (/Brachial plexus/.test(p)) return N(`brachial-${s}`);
      if (/Lumbosacral plexus|Lumbar nerves/.test(p)) return N(`lumbosacral-${s}`);
      if (/Cervical nerves/.test(p)) return N('cervical');
      if (/Thoracic nerves/.test(p)) return N('intercostal');
      if (/Autonomic/.test(p)) return N('autonomic');
      if (/Ganglia|Roots of nerves/.test(p)) return N('ganglia');
      return N('spinal');
    },
  },
  {
    id: 'damarlar',
    title: 'Kol, bacak, baş-boyun ve gövde duvarı damarları',
    summary: 'Kol ve bacağın atardamar ve toplardamarları (el ve ayak dallarına kadar), dış ve iç karotis dalları, vertebral arter, Willis halkası, dural venöz sinüsler, gövde duvarı ve pelvis damarları. Temel modeldeki şematik kol/bacak damarlarının yerini alır; kalp ve ana gövde damarları temel modelde (HRA) kalır.',
    files: ['CardioVascular41.fbx'],
    tris: 320000,
    replaces: ['limb-vessels'],
    schematicReplaced: [],
    classify: (m, side, base) => {
      const p = P(m);
      if (/Heart|Arteries of heart|Cardiac veins|Pulmonary arteries|Pulmonary veins|Orbital veins/.test(p)) return null;
      if (HRA_VESSELS.test(base)) return null;
      const s = lr(side);
      if (/Axillary (artery|vein)/.test(p)) return { structure: 'limb-vessels', part: `arm-${s}` };
      if (/Femoral (artery|vein)/.test(p)) return { structure: 'limb-vessels', part: `leg-${s}` };
      if (/carotid artery|Vertebral artery|Cerebral arterial circle|Arteries of spinal cord|Costocervical|Thyrocervical/.test(p)) return { structure: 'carotid-arteries', part: 'head-neck' };
      if (/Dural venous sinuses|Common facial vein|External jugular vein|Internal jugular vein/.test(p)) return { structure: 'veins', part: 'head-neck' };
      return { structure: 'abdominal-vessels', part: 'trunk-wall' };
    },
  },
  {
    id: 'lenf',
    title: 'Lenf düğümleri',
    summary: 'Baş, boyun, koltuk altı ve kol, göğüs, karın, pelvis ve bacaktaki adlandırılmış lenf düğümü grupları. Lenf damarları (toraks kanalı vb.) hiçbir açık kaynakta model olarak yok.',
    files: ['LymphoidOrgans100.fbx'],
    tris: 70000,
    replaces: [],
    schematicReplaced: [],
    classify: (m) => {
      const p = P(m);
      if (!/Lymph nodes/.test(p)) return null; // timus, dalak, bademcik HRA'dan
      const L = (part: string): Placed => ({ structure: 'lymph-node', part });
      if (/of head/.test(p)) return L('head');
      if (/of neck/.test(p)) return L('neck');
      if (/upper limb/.test(p)) return L('upper-limb');
      if (/Thoracic/.test(p)) return L('thorax');
      if (/Abdominal/.test(p)) return L('abdomen');
      if (/Pelvic/.test(p)) return L('pelvis');
      if (/lower limb/.test(p)) return L('lower-limb');
      return L('other');
    },
  },
  {
    id: 'bas-boyun',
    title: 'Baş-boyun: ağız, dişler, yutak, burun, tiroid, kulak',
    summary: 'Dil, damak, dişeti, tükürük bezleri, 28 diş, yutak, burun boşluğu ve sinüsler, gırtlak kıkırdakları, tiroid ve paratiroid bezleri, kulak kepçesi, kulak zarı, kulak kemikçikleri ve Östaki borusu. Şematik tiroidin ve kulağın dış/orta kısmının yerini alır; iç kulak (koklea, vestibül) lisans nedeniyle şematik kalır.',
    files: ['VisceralSystem100.fbx', 'SkeletalSystem100.fbx', 'NervousSystem100.fbx', 'Regions of human body100.fbx'],
    tris: 160000,
    replaces: [],
    schematicReplaced: ['thyroid', 'ear:canal', 'ear:eardrum', 'ear:ossicles'],
    classify: (m, side, base) => {
      const p = P(m);
      const b = base.toLowerCase();
      // Kemik dosyası: yalnız temel iskelette olmayanlar (dişler, kemikçikler, kıkırdaklar, sinüsler)
      if (/^Teeth/.test(p)) return { structure: 'bones', part: 'teeth', rigid: 'bones|skull', anchor: /^lower /.test(b) ? 'mandible' : 'maxilla' };
      if (/^Auditory ossicles/.test(p)) return { structure: 'ear', part: 'ossicles', rigid: 'bones|skull', anchor: side === 'r' ? 'temporal-r' : 'temporal-l' };
      if (/^Laryngeal cartilages/.test(p)) return { structure: 'airways', part: 'larynx-cartilages' };
      if (/^Nasal cartilages/.test(p)) return { structure: 'airways', part: 'nasal-cavity' };
      if (/cells of ethmoid bone|^sinus of/.test(b)) return { structure: 'airways', part: 'sinuses', rigid: 'bones|skull' };
      if (/^(Bones|Cranium|Vertebral|Thoracic skeleton|Extracranial)/.test(p)) return null;
      // Duyu organları: kulak (iç kulak hariç)
      if (/^Sense organs/.test(p)) {
        if (/Internal ear/.test(p)) return null; // CC BY-NC-SA: alınmaz
        if (/Ear/.test(p)) return { structure: 'ear', part: /tympanic/.test(b) ? 'eardrum' : 'auditory-tube', anchor: side === 'r' ? 'temporal-r' : 'temporal-l' };
        return null;
      }
      if (/^Regions of head.*Auricular region/.test(p)) return { structure: 'ear', part: 'auricle' };
      if (/^Regions/.test(p)) return null;
      // İç organ dosyası: baş-boyun
      if (b === 'thyroid gland') return { structure: 'thyroid', part: 'gland' };
      if (/parathyroid/.test(b)) return { structure: 'thyroid', part: 'parathyroid' };
      if (/^Digestive system\/Mouth/.test(p) || /^Digestive system.g\/Mouth/.test(p)) {
        if (b === 'tongue') return { structure: 'mouth', part: 'tongue' };
        if (/palate|uvula/.test(b)) return { structure: 'mouth', part: 'palate' };
        if (b === 'gingiva') return { structure: 'mouth', part: 'gingiva' };
        return { structure: 'mouth', part: 'salivary' };
      }
      if (/Pharynx/.test(p)) return { structure: 'mouth', part: 'pharynx' };
      if (/^Respiratory system(\.g)?\/Nose/.test(p)) return { structure: 'airways', part: 'nasal-cavity' };
      return null;
    },
  },
];

/* ------------------------------------------------------------------ üretim */

export interface BodyMaps {
  /** Yumuşak doku: erkek → kadın eşlemesi (kadında). */
  soft?: (a: Float32Array) => void;
  /** Katı yapı: grup anahtarına göre eklem dönüşümü (kadında). */
  rigid?: (a: Float32Array, group: string) => void;
}

export interface PackIndexEntry {
  id: string;
  body: 'male' | 'female';
  title: string;
  summary: string;
  file: string;
  /** model.glb'nin SHA-256 özeti (onaltılık). */
  sha256: string;
  bytes: number;
  packBytes: number;
  triangles: number;
  elements: number;
  structures: Record<string, number>;
  replaces: string[];
  schematicReplaced: string[];
  adapted: boolean;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const cache = new Map<string, ZaMesh[]>();
function meshesOf(file: string): ZaMesh[] {
  let m = cache.get(file);
  if (!m) {
    m = readZa(file);
    cache.set(file, m);
  }
  return m;
}

interface Align {
  T: Sim;
  residual: number;
  max: number;
  pairs: number;
  /** Yerel düzeltmeler (ICP): bağlı yapılar kendi kemiğine oturtulur. */
  local: Partial<Record<Anchor, { T: Rigid; residualMm: number; shiftMm: number }>>;
}
let ALIGN: Align | null = null;
export function alignment(log: (s: string) => void): Align {
  if (!ALIGN) {
    const bones = meshesOf('SkeletalSystem100.fbx');
    const r = zaToBody(bones);
    log(`  Z-Anatomy → vücut: ${r.pairs.length} kemik çifti, ortalama ${(r.residual * 1000).toFixed(1)} mm, en büyük ${(r.max * 1000).toFixed(1)} mm`);
    for (const p of r.pairs.sort((a, b) => b.d - a.d).slice(0, 4)) log(`    ${p.za} ↔ ${p.bp3d}: ${(p.d * 1000).toFixed(1)} mm`);
    const byName = new Map<string, string>();
    for (const g of planBp3d().skeleton) for (const id of g.ids) byName.set(bp3dName(id).toLowerCase(), id);
    const local: Align['local'] = {};
    for (const [key, a] of Object.entries(ANCHORS) as [Anchor, (typeof ANCHORS)[Anchor]][]) {
      const src: V3[] = [];
      for (const m of bones.filter((x) => a.za.includes(x.name))) {
        const pos = new Float32Array(m.pos);
        applySimArray(r.T, pos);
        const step = Math.max(1, Math.floor(pos.length / 3 / 4000));
        for (let i = 0; i < pos.length / 3; i += step) src.push([pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!]);
      }
      const ids = a.bp3d.map((n) => byName.get(n)).filter((x): x is string => !!x);
      if (!src.length || ids.length !== a.bp3d.length) throw new Error(`yerel hizalama kemiği bulunamadı: ${key}`);
      const tgt = ids.map(readStl);
      const all = new Float32Array(tgt.reduce((n, x) => n + x.length, 0));
      let o = 0;
      for (const x of tgt) {
        all.set(x, o);
        o += x.length;
      }
      const fit = icp(src, new PointGrid(all, 0.01), [0.05, 0.03, 0.015, 0.008]);
      const c = src.reduce<V3>((s, p) => [s[0] + p[0] / src.length, s[1] + p[1] / src.length, s[2] + p[2] / src.length], [0, 0, 0]);
      const moved = applyRigid(fit.T, c);
      const shift = Math.hypot(moved[0] - c[0], moved[1] - c[1], moved[2] - c[2]);
      local[key] = { T: fit.T, residualMm: +(fit.residual * 1000).toFixed(2), shiftMm: +(shift * 1000).toFixed(1) };
      log(`    yerel: ${key} kayma ${(shift * 1000).toFixed(1)} mm, ICP artık ${(fit.residual * 1000).toFixed(1)} mm`);
    }
    ALIGN = { T: r.T, residual: r.residual, max: r.max, pairs: r.pairs.length, local };
  }
  return ALIGN;
}

/**
 * Yumuşak köşe normalleri (alan ağırlıklı yüz normallerinin toplamı). gltf-transform'un normals()
 * işlevi düz gölgeleme için her üçgene ayrı köşe üretir; kaslar, sinirler ve damarlar gibi organik
 * yüzeylerde yumuşak gölgeleme hem gerçeğe yakındır hem de dosyayı ~3 kat küçültür.
 */
function smoothNormals(doc: Document) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      if (!pos || !idx) continue;
      const P = pos.getArray() as Float32Array;
      const I = idx.getArray()!;
      const N = new Float32Array(P.length);
      for (let f = 0; f < I.length; f += 3) {
        const a = I[f]! * 3, b = I[f + 1]! * 3, c = I[f + 2]! * 3;
        const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!;
        const vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const k of [a, b, c]) {
          N[k] += nx;
          N[k + 1] += ny;
          N[k + 2] += nz;
        }
      }
      for (let i = 0; i < N.length; i += 3) {
        const l = Math.hypot(N[i]!, N[i + 1]!, N[i + 2]!) || 1;
        N[i] /= l;
        N[i + 1] /= l;
        N[i + 2] /= l;
      }
      prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(pos.getBuffer()));
    }
}

function triCount(doc: Document): number {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) n += (p.getIndices()?.getCount() ?? 0) / 3;
  return Math.round(n);
}

export async function buildPack(def: PackDef, body: 'male' | 'female', maps: BodyMaps, outDir: string, log: (s: string) => void): Promise<PackIndexEntry> {
  const { T, residual, max, pairs, local } = alignment(log);
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(def.id);
  const structures: Record<string, number> = {};
  const skipped: string[] = [];
  let elements = 0;
  let before = 0;
  for (const file of def.files) {
    for (const m of meshesOf(file)) {
      if (isLabel(m.name) || isAttachment(m.name)) continue;
      const side = sideOf(m.name);
      const base = baseName(m.name);
      const placed = def.classify(m, side, base);
      if (!placed) {
        skipped.push(m.name);
        continue;
      }
      const pos = new Float32Array(m.pos);
      applySimArray(T, pos);
      const fix = placed.anchor ? local[placed.anchor] : undefined;
      if (fix)
        for (let i = 0; i < pos.length; i += 3) {
          const q = applyRigid(fix.T, [pos[i]!, pos[i + 1]!, pos[i + 2]!]);
          pos[i] = q[0];
          pos[i + 1] = q[1];
          pos[i + 2] = q[2];
        }
      if (body === 'female') {
        if (placed.rigid && maps.rigid) maps.rigid(pos, placed.rigid);
        else maps.soft?.(pos);
      }
      before += pos.length / 9;
      const n = zaName(base, side);
      const key = `${placed.structure}|${placed.part}|${m.name.replace(/\s+/g, '-')}`;
      const extras = {
        id: m.name,
        en: base,
        ...(side ? { side } : {}),
        ...(n ? { tr: n.tr, la: n.la } : {}),
        src: 'za',
        ...(body === 'female' ? { adapted: true } : {}),
      };
      scene.addChild(meshNode(doc, buffer, pos, key).setExtras(extras));
      structures[placed.structure] = (structures[placed.structure] ?? 0) + 1;
      elements++;
    }
  }
  doc.getRoot().setDefaultScene(scene);

  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;
  await doc.transform(weld({}));
  for (const error of [0.0008, 0.002, 0.005, 0.012, 0.03]) {
    const cur = triCount(doc);
    if (cur <= def.tris * 1.1) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, def.tris / cur), error, lockBorder: false }));
  }
  smoothNormals(doc);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const glb = await io.writeBinary(doc);
  const sha256 = createHash('sha256').update(glb).digest('hex');
  const triangles = triCount(doc);
  const tag = body === 'male' ? 'erkek' : 'kadin';
  const fileName = `anatomi-${def.id}-${tag}.khpack`;

  const manifest = {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    id: def.id,
    body,
    title: def.title,
    summary: def.summary,
    model: { path: 'model.glb', sha256, bytes: glb.byteLength, triangles, elements },
    structures,
    replaces: def.replaces,
    schematicReplaced: def.schematicReplaced,
    adapted: body === 'female',
    units: 'meter; +Y up, +X subject left, +Z anterior',
    alignment: {
      method: 'Umeyama benzerlik dönüşümü: Z-Anatomy kemik ağırlık merkezleri → uygulamanın BodyParts3D erkek iskeleti',
      pairs,
      meanResidualMm: +(residual * 1000).toFixed(2),
      maxResidualMm: +(max * 1000).toFixed(2),
      local: Object.fromEntries(Object.entries(local).map(([k, v]) => [k, { shiftMm: v.shiftMm, icpResidualMm: v.residualMm }])),
      female: body === 'female' ? 'Erkek → kadın benzerlik dönüşümü + eklem (omuz, dirsek, bilek, kalça, diz, ayak bileği) uyumu; temel modeldeki kadın kemik ve kaslarıyla aynı yöntem.' : undefined,
    },
    sources: [
      { src: 'za', name: 'Z-Anatomy', license: 'CC BY-SA 4.0', url: ZA_REPO, commit: ZA_COMMIT },
      { src: 'bp3d', name: 'BodyParts3D (DBCLS)', license: 'CC BY-SA 2.1 JP', url: 'https://github.com/Kevin-Mattheus-Moerman/BodyParts3D' },
    ],
    credits: def.credits ?? [],
    skipped: skipped.length,
  };
  const attribution = `Kan Haritası anatomi paketi: ${def.title} (${body === 'male' ? 'erkek' : 'kadın'} vücudu)

Kaynak: Z-Anatomy — The open source atlas of anatomy, CC BY-SA 4.0
  ${ZA_REPO} (commit ${ZA_COMMIT.slice(0, 7)}, Resources/Models/FBX)
  https://creativecommons.org/licenses/by-sa/4.0/
Z-Anatomy modelleri BodyParts3D'den türetilmiştir:
  BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan
  https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en
${(def.credits ?? []).map((c) => `${c}\n`).join('')}
Bu paketteki model dosyası uyarlanmış eserdir ve aynı lisansla (CC BY-SA 4.0) dağıtılır.

Değişiklikler: FBX → glTF; ağlar dünya koordinatına çevrildi; uygulamanın vücut koordinatına
(metre, +Y yukarı) Umeyama benzerlik dönüşümüyle taşındı (${pairs} kemik çifti, ortalama sapma
${(residual * 1000).toFixed(1)} mm, en büyük ${(max * 1000).toFixed(1)} mm);${
    body === 'female'
      ? ' kadın vücuduna erkek → kadın benzerlik dönüşümü ve eklem uyumuyla yerleştirildi (ERKEK REFERANSINDAN UYARLANMIŞTIR; kadına özgü şekil farklarını taşımaz);'
      : ''
  } etiket ve işaret noktası ağları çıkarıldı; meshoptimizer ile sadeleştirildi, nicemlendi ve
EXT_meshopt_compression ile sıkıştırıldı.
Alınmayanlar: iç kulak (CC BY-NC-SA), böbrek (CC BY-NC), lisansı belirtilmemiş beyin yüzeyleri ve
uygulamada başka kaynaktan zaten bulunan yapılar.
`;
  const zip = zipSync(
    {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 1)),
      'model.glb': glb,
      'ATTRIBUTION.txt': strToU8(attribution),
    },
    { level: 0 },
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, fileName), zip);
  log(`  ${fileName.padEnd(34)} ${String(Math.round(before)).padStart(8)} → ${String(triangles).padStart(7)} üçgen, ${elements} yapı, ${(zip.byteLength / 1048576).toFixed(1)} MB`);
  return {
    id: def.id,
    body,
    title: def.title,
    summary: def.summary,
    file: fileName,
    sha256,
    bytes: glb.byteLength,
    packBytes: zip.byteLength,
    triangles,
    elements,
    structures,
    replaces: def.replaces,
    schematicReplaced: def.schematicReplaced,
    adapted: body === 'female',
  };
}
