/**
 * BodyParts3D (DBCLS, CC BY-SA 2.1 JP) kaynaklı tam iskelet, kaslar ve deri.
 *
 * HRA erkek referans vücudunda kol-bacak kemikleri, kafatası, kaburgalar ve kaslar yoktur. Bu
 * parçalar BodyParts3D 3.0'dan alınır ve HRA koordinat sistemine benzerlik dönüşümüyle taşınır.
 *
 * Kaynak eksenleri: milimetre, +Z yukarı, +X kişinin solu, -Y ön. Hedef (HRA): metre, +Y yukarı,
 * +X kişinin solu, +Z ön. Dönüşüm: p' = S · R · A(p) + T, A(p) = (x, z, -y) / 1000.
 * S, R, T; 24 omurga, sakrum ve iki kalça kemiğinin ağırlık merkezleri üzerinden en küçük kareler
 * (Umeyama) ile bulundu; ortalama artık 14 mm. İki farklı insan vücudu olduğundan organ–kemik
 * uyumu yaklaşıktır; arayüz bunu belirtir.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, type Node } from '@gltf-transform/core';

const here = dirname(fileURLToPath(import.meta.url));
export const BP3D_DIR = process.env.BP3D_DIR ?? join(here, '.cache/bp3d/assets/BodyParts3D_data');
export const BP3D_COMMIT = 'f0eeb6e843380cfe6b83797cf8c3e1af74de5e61';
export const BP3D_REPO = 'https://github.com/Kevin-Mattheus-Moerman/BodyParts3D';

const S = 1.072518214283341;
const R = [
  [0.9962502031151572, -0.018126869173971556, 0.08459875535111862],
  [0.0214648482242222, 0.9990197154016889, -0.03871522348430529],
  [-0.0838140387030705, 0.04038594870345767, 0.9956626848805789],
] as const;
const T = [0.017390832076822262, -0.8381167523984394, -0.15901248002379698] as const;

const SKIN = 'FMA7163';
const SKELETAL_SYSTEM = 'FMA23881';
const MUSCULAR_SYSTEM = 'FMA72954';
const MUSCLE_REGIONS: [string, string][] = [
  ['upper', 'FMA9621'],
  ['lower', 'FMA9622'],
  ['head', 'FMA71287'],
  ['neck', 'FMA71290'],
  ['thorax', 'FMA71293'],
  ['abdomen', 'FMA86917'],
  ['back', 'FMA71291'],
];

/** İkili STL → dönüştürülmüş konumlar (her üçgen 3 köşe, indekssiz). */
export function readStl(id: string): Float32Array {
  const buf = readFileSync(join(BP3D_DIR, 'stl', `${id}.stl`));
  const n = buf.readUInt32LE(80);
  const out = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const base = 84 + i * 50 + 12;
    for (let k = 0; k < 3; k++) {
      const x = buf.readFloatLE(base + k * 12) / 1000;
      const y = buf.readFloatLE(base + k * 12 + 4) / 1000;
      const z = buf.readFloatLE(base + k * 12 + 8) / 1000;
      const a = [x, z, -y];
      const o = i * 9 + k * 3;
      for (let r = 0; r < 3; r++) out[o + r] = S * (R[r]![0] * a[0]! + R[r]![1] * a[1]! + R[r]![2] * a[2]!) + T[r]!;
    }
  }
  return out;
}

interface Hierarchy {
  names: Map<string, string>;
  children: Map<string, Set<string>>;
}

function hierarchy(): Hierarchy {
  const names = new Map<string, string>();
  for (const line of readFileSync(join(BP3D_DIR, 'parts_list_e.txt'), 'utf8').split('\n').slice(1)) {
    const [id, name] = line.split('\t');
    if (id && name) names.set(id.replace(/"/g, ''), name.trim());
  }
  const children = new Map<string, Set<string>>();
  for (const line of readFileSync(join(BP3D_DIR, 'conventional_part_of.txt'), 'utf8').split('\n').slice(1)) {
    const [a, , b] = line.split('\t').map((x) => x.replace(/"/g, ''));
    if (!a || !b) continue;
    const set = children.get(a) ?? new Set();
    set.add(b);
    children.set(a, set);
  }
  return { names, children };
}

function descendants(h: Hierarchy, root: string): Set<string> {
  const out = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const x = stack.pop()!;
    if (out.has(x)) continue;
    out.add(x);
    for (const c of h.children.get(x) ?? []) stack.push(c);
  }
  return out;
}

const side = (name: string) => (/\bright\b/.test(name) ? 'Sağ' : /\bleft\b/.test(name) ? 'Sol' : null);

/** Kemik → grup etiketi (Türkçe). null: iskelete alınmaz. */
function boneGroup(name: string): string | null {
  const s = side(name);
  const sided = (label: string) => (s ? `${s} ${label}` : label);
  if (/eyeball|gingiva/.test(name)) return null;
  if (/vertebra|atlas|\baxis\b|intervertebral|sacrum|coccyx/.test(name)) return 'Omurga';
  if (/\brib\b|costal|sternum|manubrium|xiphoid/.test(name)) return 'Göğüs kafesi';
  if (/hip bone|pubic symphysis/.test(name)) return 'Leğen kemiği (pelvis)';
  if (/clavicle|scapula/.test(name)) return sided('omuz kuşağı (köprücük, kürek)');
  if (/humerus/.test(name)) return sided('üst kol kemiği (humerus)');
  if (/radius|ulna|of right forearm|of left forearm/.test(name)) return sided('önkol kemikleri');
  if (/carpal|scaphoid|lunate|triquetr|pisiform|trapezi|trapezoid|capitate|hamate|finger|thumb|of hand|metacarp/.test(name)) return sided('el kemikleri');
  if (/femur|patella/.test(name)) return sided('uyluk kemiği ve diz kapağı');
  if (/tibia|fibula|of right leg|of left leg/.test(name)) return sided('bacak kemikleri');
  if (/talus|calcaneus|navicular|cuboid|cuneiform|metatars|toe|of foot|plantar/.test(name)) return sided('ayak kemikleri');
  return 'Kafatası ve yüz kemikleri';
}

const HIP_MUSCLE = /glute|piriformis|gemell|obturator|quadratus femoris|tensor fasciae latae/;

export interface Bp3dGroup {
  /** "bones|Sol el kemikleri" gibi düğüm adı. */
  key: string;
  ids: string[];
}

export interface Bp3dSet {
  skin: Bp3dGroup[];
  skeleton: Bp3dGroup[];
  muscles: Bp3dGroup[];
  /** Kullanılan tüm dosya kimlikleri (fetch betiği için). */
  all: string[];
}

function centroidY(id: string): number {
  const p = readStl(id);
  let s = 0;
  for (let i = 1; i < p.length; i += 3) s += p[i]!;
  return s / (p.length / 3);
}

function minY(id: string): number {
  const p = readStl(id);
  let m = Infinity;
  for (let i = 1; i < p.length; i += 3) m = Math.min(m, p[i]!);
  return m;
}

/** Hangi dosyanın hangi gruba gideceğini hiyerarşi ve adlardan belirler. */
export function planBp3d(): Bp3dSet {
  const h = hierarchy();
  const available = (id: string) => existsSync(join(BP3D_DIR, 'stl', `${id}.stl`));
  const skeletal = [...descendants(h, SKELETAL_SYSTEM)].filter(available);
  const muscular = [...descendants(h, MUSCULAR_SYSTEM)].filter((id) => available(id) && !skeletal.includes(id));
  const regions = MUSCLE_REGIONS.map(([k, id]) => [k, descendants(h, id)] as const);
  const name = (id: string) => h.names.get(id) ?? id;

  const add = (map: Map<string, string[]>, key: string, id: string) => map.set(key, [...(map.get(key) ?? []), id]);

  const bones = new Map<string, string[]>();
  for (const id of skeletal) {
    const g = boneGroup(name(id));
    if (g) add(bones, `bones|${g}`, id);
  }

  // Kol ve bacakta dirsek / diz yüksekliği: kemiklerin alt ucu
  const idOf = (n: string) => [...h.names].find(([, v]) => v === n)?.[0];
  const elbow = (s: 'right' | 'left') => minY(idOf(`${s} humerus`)!);
  const knee = (s: 'right' | 'left') => minY(idOf(`${s} femur`)!) + 0.02;
  const levels = { right: { elbow: elbow('right'), knee: knee('right') }, left: { elbow: elbow('left'), knee: knee('left') } };

  const muscles = new Map<string, string[]>();
  for (const id of muscular) {
    const n = name(id);
    if (/tendon$/.test(n)) continue;
    const region = regions.find(([, set]) => set.has(id))?.[0];
    const s = side(n);
    const sk = /\bright\b/.test(n) ? 'right' : 'left';
    let label: string;
    switch (region) {
      case 'upper':
        label = `${s ?? 'Sol'} ${centroidY(id) > levels[sk].elbow ? 'omuz ve üst kol kasları' : 'önkol ve el kasları'}`;
        break;
      case 'lower':
        label = HIP_MUSCLE.test(n)
          ? `${s ?? 'Sol'} kalça kasları`
          : `${s ?? 'Sol'} ${centroidY(id) > levels[sk].knee ? 'uyluk kasları' : 'bacak ve ayak kasları'}`;
        break;
      case 'head':
        label = 'Baş ve yüz kasları';
        break;
      case 'neck':
        label = 'Boyun kasları';
        break;
      case 'thorax':
        label = 'Göğüs kasları';
        break;
      case 'abdomen':
        label = 'Karın kasları';
        break;
      case 'back':
        label = 'Sırt kasları';
        break;
      default:
        label = 'Diğer kaslar';
    }
    add(muscles, `skeletal-muscle|${label}`, id);
  }

  const toGroups = (m: Map<string, string[]>) => [...m].map(([key, ids]) => ({ key, ids })).sort((a, b) => a.key.localeCompare(b.key, 'tr'));
  const skeleton = toGroups(bones);
  const muscleGroups = toGroups(muscles);
  return {
    skin: [{ key: 'skin', ids: [SKIN] }],
    skeleton,
    muscles: muscleGroups,
    all: [SKIN, ...skeleton.flatMap((g) => g.ids), ...muscleGroups.flatMap((g) => g.ids)],
  };
}

/** Grupları tek belgeye (her grup bir düğüm) yazar; sadeleştirme çağıran tarafta yapılır. */
export function bp3dDocument(groups: Bp3dGroup[], sceneName: string): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(sceneName);
  for (const g of groups) {
    const arrays = g.ids.map(readStl);
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const pos = new Float32Array(total);
    let o = 0;
    for (const a of arrays) {
      pos.set(a, o);
      o += a.length;
    }
    const count = pos.length / 3;
    const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(index).setBuffer(buffer));
    const mesh = doc.createMesh(g.key).addPrimitive(prim);
    const node: Node = doc.createNode(g.key).setMesh(mesh);
    scene.addChild(node);
  }
  doc.getRoot().setDefaultScene(scene);
  return doc;
}
