/**
 * Organ–iskelet uyum ölçümü: uygulamadaki HRA organlarının konumu, BodyParts3D iskeletine hizalanmış
 * Z-Anatomy'deki karşılıklarıyla (aynı iskeletten türemiş) karşılaştırılır. Fark mm cinsinden yazılır.
 * Kullanım: pnpm --filter @kh/assets-pipeline exec tsx measure-organs.ts [male|female]
 */
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { alignment } from './zanatomy-packs';
import { applySimArray, readZa } from './zanatomy-read';

type V3 = [number, number, number];
const root = new URL('../apps/web/public/models/', import.meta.url);
const body = process.argv[2] ?? 'male';
const tag = body === 'male' ? 'm' : 'f';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

class Box {
  min: V3 = [Infinity, Infinity, Infinity];
  max: V3 = [-Infinity, -Infinity, -Infinity];
  n = 0;
  add(x: number, y: number, z: number) {
    const p = [x, y, z];
    for (let k = 0; k < 3; k++) {
      this.min[k] = Math.min(this.min[k]!, p[k]!);
      this.max[k] = Math.max(this.max[k]!, p[k]!);
    }
    this.n++;
  }
  get c(): V3 {
    return [0, 1, 2].map((k) => (this.min[k]! + this.max[k]!) / 2) as V3;
  }
  get size(): V3 {
    return [0, 1, 2].map((k) => this.max[k]! - this.min[k]!) as V3;
  }
}

const app = new Map<string, Box>();
function addApp(key: string, x: number, y: number, z: number) {
  let b = app.get(key);
  if (!b) app.set(key, (b = new Box()));
  b.add(x, y, z);
}
const KEYS: Record<string, (s: string, part: string, x: number) => string | null> = {
  eyes: (_s, part, x) => (/muscle|nerve/.test(part) ? null : x > 0 ? 'eye.l' : 'eye.r'),
  heart: () => 'heart',
  liver: () => 'liver',
  kidneys: (_s, _p, x) => (x > 0 ? 'kidney.l' : 'kidney.r'),
  lungs: (_s, _p, x) => (x > 0 ? 'lung.l' : 'lung.r'),
  brain: () => 'brain',
  spleen: () => 'spleen',
  pancreas: () => 'pancreas',
  stomach: () => 'stomach',
  gallbladder: () => 'gallbladder',
  thyroid: () => 'thyroid',
  prostate: () => 'prostate',
  'urinary-tract': (_s, part) => (/bladder/.test(part) ? 'bladder' : null),
  airways: (_s, part) => (/trachea/.test(part) ? 'trachea' : null),
  'small-intestine': () => 'small-intestine',
};
for (const f of ['nervous', 'cardio', 'digestive', 'urinary', 'respiratory', 'immune', 'endocrine']) {
  const doc = await io.read(new URL(`${tag}/${f}.glb`, root).pathname);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const [structure = '', part = ''] = node.getName().split('|');
    const fn = KEYS[structure];
    if (!fn) continue;
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!;
      const e = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, e);
        const [x, y, z] = e as V3;
        const wx = M[0] * x + M[4] * y + M[8] * z + M[12];
        const key = fn(structure, part.toLowerCase(), wx);
        if (key) addApp(key, wx, M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
      }
    }
  }
}

const za = new Map<string, Box>();
const { T } = alignment(() => {});
const ZA_RULES: [string, (name: string, path: string) => string | null][] = [
  ['NervousSystem100.fbx', (n, p) => (/Eye\/Eyeball/.test(p) || /^(Sclera|Cornea)\./.test(n) ? (n.endsWith('.l') ? 'eye.l' : n.endsWith('.r') ? 'eye.r' : null) : /\/Brain\b|Brain\//.test(p) && !/nerve|Meninges|artery|vein|sinus/i.test(p + n) ? 'brain' : null)],
  ['CardioVascular41.fbx', (n, p) => (/(^|\/)Heart(\/|$)/.test(p) ? 'heart' : null)],
  ['VisceralSystem100.fbx', (n, p) => {
    if (n === 'Liver') return 'liver';
    if (n === 'Kidney.l') return 'kidney.l';
    if (n === 'Kidney.r') return 'kidney.r';
    if (/Right lung/i.test(p + '/' + n)) return 'lung.r';
    if (/Left lung/i.test(p + '/' + n)) return 'lung.l';
    if (n === 'Pancreas') return 'pancreas';
    if (n === 'Stomach') return 'stomach';
    if (n === 'Gallbladder') return 'gallbladder';
    if (n === 'Thyroid gland') return 'thyroid';
    if (n === 'Prostate') return 'prostate';
    if (n === 'Urinary bladder') return 'bladder';
    if (n === 'Trachea') return 'trachea';
    if (/Small intestine/.test(p)) return 'small-intestine';
    return null;
  }],
  ['LymphoidOrgans100.fbx', (n) => (n === 'Spleen' ? 'spleen' : null)],
];
for (const [file, rule] of ZA_RULES) {
  for (const m of readZa(file)) {
    const key = rule(m.name, m.path.join('/'));
    if (!key) continue;
    const pos = new Float32Array(m.pos);
    applySimArray(T, pos);
    let b = za.get(key);
    if (!b) za.set(key, (b = new Box()));
    for (let i = 0; i < pos.length; i += 3) b.add(pos[i]!, pos[i + 1]!, pos[i + 2]!);
  }
}
const mm = (v: number) => (v * 1000).toFixed(0).padStart(5);
console.log(`${body}: organ          fark (x sol+, y yukarı+, z ön+) mm   |fark|   uygulama boyutu   Z-Anatomy boyutu`);
for (const [k, a] of [...app].sort()) {
  const z = za.get(k);
  if (!z) {
    console.log(`  ${k.padEnd(16)} Z-Anatomy karşılığı yok`);
    continue;
  }
  const d = [0, 1, 2].map((i) => a.c[i]! - z.c[i]!);
  console.log(`  ${k.padEnd(16)} ${d.map(mm).join(' ')}   ${mm(Math.hypot(...d))}   ${a.size.map(mm).join('')}   ${z.size.map(mm).join('')}`);
}
void readFileSync;
