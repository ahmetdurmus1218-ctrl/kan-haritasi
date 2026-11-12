/**
 * Z-Anatomy FBX okuyucu (CC BY-SA 4.0; BodyParts3D türevi + ek modeller).
 *
 * FBX dosyaları three.js FBXLoader ile okunur, her ağ dünya koordinatına çevrilir ve uygulamanın erkek
 * referans vücut koordinatına (HRA: metre, +Y yukarı, +X kişinin solu, +Z ön) taşınır. Taşıma,
 * Z-Anatomy kemiklerinin ağırlık merkezleri ile aynı BodyParts3D kemiklerinin (uygulamadaki erkek
 * iskeleti) ağırlık merkezleri arasında en küçük kareler benzerlik dönüşümüyle (Umeyama) bulunur.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Mesh, type Object3D, PropertyBinding, Vector3 } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { bp3dName, planBp3d, readStl } from './bp3d';
import { type M3, type V3 } from './fit';

export const ZA_DIR = process.env.ZA_DIR ?? join(import.meta.dirname, '.cache/zanatomy');
export const ZA_COMMIT = '6c7f9016bd5899ac8edafd31b9900c151df42ed6';
export const ZA_REPO = 'https://github.com/LluisV/Z-Anatomy';

export interface ZaMesh {
  /** Kaynaktaki tam ad (ör. "Humerus.r"). */
  name: string;
  /** Üst grupların adları, kökten ("Bones of upper limb.g/..."). */
  path: string[];
  /** Dünya koordinatında üçgen çorbası (Z-Anatomy birimi). */
  pos: Float32Array;
}

// FBXLoader düğüm adlarını temizler ("Humerus.r" → "Humerusr"); kaynak adları korunmalı.
(PropertyBinding as unknown as { sanitizeNodeName: (n: string) => string }).sanitizeNodeName = (n: string) => n;

/** Bir Z-Anatomy FBX dosyasındaki tüm ağlar (etiket noktaları dahil; süzme çağıranda). */
export function readZa(file: string): ZaMesh[] {
  const buf = readFileSync(join(ZA_DIR, 'Resources/Models/FBX', file));
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '');
  root.updateMatrixWorld(true);
  const out: ZaMesh[] = [];
  const v = new Vector3();
  root.traverse((o: Object3D) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    const p = g.getAttribute('position');
    if (!p) return;
    const idx = g.getIndex();
    const n = idx ? idx.count : p.count;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    }
    const path: string[] = [];
    for (let a = mesh.parent; a && a !== root; a = a.parent) path.unshift(a.name);
    out.push({ name: mesh.name, path, pos });
  });
  return out;
}

/** Etiket ve işaret noktaları (".j", ".i") ile kas tutunma yüzeyleri (".o", ".e") yapı değildir. */
export function isLabel(name: string): boolean {
  return /\.(j|i)$/.test(name);
}
export function isAttachment(name: string): boolean {
  return /\.[oe]\d*[lr]?$/.test(name);
}
/** Ad sonundaki taraf eki: ".l" → l, ".r" → r. */
export function sideOf(name: string): 'l' | 'r' | null {
  const m = /\.([lr])$/.exec(name);
  return m ? (m[1] as 'l' | 'r') : null;
}
export function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/^\((.*)\)$/, '$1').trim();
}

/* ------------------------------------------------------------------ hizalama */

const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

/** Z-Anatomy kemik adı → BodyParts3D adı (eşleşen çiftler hizalamada kullanılır). */
function bp3dEquivalent(za: string): string | null {
  const side = sideOf(za);
  const s = side === 'r' ? 'right ' : side === 'l' ? 'left ' : '';
  const b = baseName(za).toLowerCase();
  const v = /^vertebra ([ctl])(\d+)$/.exec(b);
  if (v) {
    const kind = { c: 'cervical', t: 'thoracic', l: 'lumbar' }[v[1] as 'c'];
    return `${ORD[Number(v[2]) - 1]} ${kind} vertebra`;
  }
  if (/^(humerus|radius|ulna|femur|tibia|fibula|clavicle|scapula|patella|calcaneus|talus|hip bone)$/.test(b)) return `${s}${b}`;
  if (/^\w+ rib$/.test(b)) return `${s}${b}`;
  if (b === 'sacrum' || b === 'mandible') return b;
  return null;
}

function centroid(a: Float32Array): V3 {
  const c: V3 = [0, 0, 0];
  const n = a.length / 3;
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) c[k] += a[i + k]! / n;
  return c;
}

/** Umeyama: dst ≈ s·R·src + t (en küçük kareler). 3×3 SVD yerine Horn'un dördey yöntemi. */
export function similarity(src: V3[], dst: V3[]): { s: number; R: M3; t: V3; residual: number; max: number } {
  const n = src.length;
  const cs = [0, 1, 2].map((k) => src.reduce((a, p) => a + p[k]!, 0) / n) as V3;
  const cd = [0, 1, 2].map((k) => dst.reduce((a, p) => a + p[k]!, 0) / n) as V3;
  const S = [0, 1, 2].map(() => [0, 0, 0]);
  let vs = 0;
  for (let i = 0; i < n; i++) {
    const a = [0, 1, 2].map((k) => src[i]![k]! - cs[k]!);
    const b = [0, 1, 2].map((k) => dst[i]![k]! - cd[k]!);
    vs += a[0]! ** 2 + a[1]! ** 2 + a[2]! ** 2;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r]![c]! += a[r]! * b[c]!;
  }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S as [number[], number[], number[]];
  const N = [
    [xx! + yy! + zz!, yz! - zy!, zx! - xz!, xy! - yx!],
    [yz! - zy!, xx! - yy! - zz!, xy! + yx!, zx! + xz!],
    [zx! - xz!, xy! + yx!, -xx! + yy! - zz!, yz! + zy!],
    [xy! - yx!, zx! + xz!, yz! + zy!, -xx! - yy! + zz!],
  ];
  const q = largestEigenvector(N);
  const [w, x, y, z] = q;
  const R: M3 = [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ];
  let num = 0;
  for (let i = 0; i < n; i++) {
    const a = [0, 1, 2].map((k) => src[i]![k]! - cs[k]!);
    const b = [0, 1, 2].map((k) => dst[i]![k]! - cd[k]!);
    const ra = [0, 1, 2].map((r) => R[r]![0]! * a[0]! + R[r]![1]! * a[1]! + R[r]![2]! * a[2]!);
    num += ra[0]! * b[0]! + ra[1]! * b[1]! + ra[2]! * b[2]!;
  }
  const s = num / vs;
  const t = [0, 1, 2].map((r) => cd[r]! - s * (R[r]![0]! * cs[0] + R[r]![1]! * cs[1] + R[r]![2]! * cs[2])) as V3;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const p = applySim({ s, R, t }, src[i]!);
    const d = Math.hypot(p[0] - dst[i]![0], p[1] - dst[i]![1], p[2] - dst[i]![2]);
    sum += d;
    max = Math.max(max, d);
  }
  return { s, R, t, residual: sum / n, max };
}

function largestEigenvector(A: number[][]): [number, number, number, number] {
  // Jacobi özdeğer ayrışımı (4×4 simetrik)
  const a = A.map((r) => [...r]);
  const V = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p]![q]! ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < 4; p++)
      for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p]![q]!) < 1e-30) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 4; k++) {
          const akp = a[k]![p]!;
          const akq = a[k]![q]!;
          a[k]![p] = c * akp - s * akq;
          a[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < 4; k++) {
          const apk = a[p]![k]!;
          const aqk = a[q]![k]!;
          a[p]![k] = c * apk - s * aqk;
          a[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = V[k]![p]!;
          const vkq = V[k]![q]!;
          V[k]![p] = c * vkp - s * vkq;
          V[k]![q] = s * vkp + c * vkq;
        }
      }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i]![i]! > a[best]![best]!) best = i;
  return [V[0]![best]!, V[1]![best]!, V[2]![best]!, V[3]![best]!];
}

export interface Sim {
  s: number;
  R: M3;
  t: V3;
}
export function applySim(T: Sim, p: V3): V3 {
  return [0, 1, 2].map((r) => T.s * (T.R[r]![0]! * p[0] + T.R[r]![1]! * p[1] + T.R[r]![2]! * p[2]) + T.t[r]!) as V3;
}
export function applySimArray(T: Sim, a: Float32Array): void {
  for (let i = 0; i < a.length; i += 3) {
    const q = applySim(T, [a[i]!, a[i + 1]!, a[i + 2]!]);
    a[i] = q[0];
    a[i + 1] = q[1];
    a[i + 2] = q[2];
  }
}

/**
 * Z-Anatomy → uygulamanın erkek vücut koordinatı. `bones`: SkeletalSystem dosyasının ağları.
 * Dönen `pairs`: hizalamada kullanılan kemik çiftleri ve dönüşüm sonrası ağırlık merkezi farkı (m).
 */
export function zaToBody(bones: ZaMesh[]): { T: Sim; residual: number; max: number; pairs: { za: string; bp3d: string; d: number }[] } {
  const plan = planBp3d();
  const byName = new Map<string, string>();
  for (const g of plan.skeleton) for (const id of g.ids) byName.set(bp3dName(id).toLowerCase(), id);
  const src: V3[] = [];
  const dst: V3[] = [];
  const names: { za: string; bp3d: string }[] = [];
  for (const m of bones) {
    if (isLabel(m.name) || isAttachment(m.name)) continue;
    const eq = bp3dEquivalent(m.name);
    const id = eq ? byName.get(eq) : undefined;
    if (!id) continue;
    src.push(centroid(m.pos));
    dst.push(centroid(readStl(id)));
    names.push({ za: m.name, bp3d: eq! });
  }
  if (src.length < 20) throw new Error(`Z-Anatomy hizalaması için yeterli kemik çifti yok (${src.length})`);
  const fit = similarity(src, dst);
  const pairs = names.map((n, i) => {
    const p = applySim(fit, src[i]!);
    return { ...n, d: Math.hypot(p[0] - dst[i]![0], p[1] - dst[i]![1], p[2] - dst[i]![2]) };
  });
  return { T: { s: fit.s, R: fit.R, t: fit.t }, residual: fit.residual, max: fit.max, pairs };
}
