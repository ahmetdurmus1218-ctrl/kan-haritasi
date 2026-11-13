/**
 * Organ–iskelet uyumu. Uygulamadaki vücut iki farklı insandan gelir:
 *
 *  - Erkek: deri, iskelet ve kaslar BodyParts3D; organlar ve damarlar HRA (VH Male). bp3d.ts'deki
 *    genel benzerlik dönüşümü yalnız omurga ve leğen kemiği üzerinden bulunmuştu; omurgadan uzak
 *    bölgelerde (baş, karın organları) 2–4 cm sapma kalıyordu (gözler göz çukurunun üstünde).
 *    Burada HRA geometrisine yumuşak bir bükme (Gauss RBF yer değiştirme alanı) uygulanır:
 *    çapalar HRA omurları → BodyParts3D omurları, HRA gözleri/beyni/organları → aynı BodyParts3D
 *    vücudundan türeyen Z-Anatomy'deki karşılıkları (uygulamanın iskeletine hizalanmış). Alan
 *    sürekli olduğundan organlara bağlanan damarlar kopmaz; çapalardan uzakta (kol/bacak) etkisi söner.
 *  - Kadın: deri, organlar, omurga ve leğen HRA (VH Female); diğer kemikler erkekten uyarlanır.
 *    Kafatası (ve baş kasları, baş-boyun paketleri) için katı bir baş dönüşümü bulunur: Z-Anatomy
 *    gözleri, beyni ve atlası (C1) kadın modelinin gözlerine, beynine ve C1 omuruna oturtulur.
 *
 * Z-Anatomy burada yalnız konum referansıdır (ölçüm); dağıtılmaz.
 */
import { join } from 'node:path';
import { cleanNodeName } from '@kh/catalog';
import { bp3dName, planBp3d, readStl } from './bp3d';
import { trianglesOf } from './anatomy-fit';
import { type Rigid, type V3, Volume, aboutPivot, apply as applyRigid, axisAngle, mulM } from './fit';
import { boneName, hraBoneName } from './names-tr';
import { alignment } from './zanatomy-packs';
import { applySimArray, readZa } from './zanatomy-read';

type Box = { min: V3; max: V3 };
function boxOf(a: Float32Array): Box {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, a[i + k]!);
      max[k] = Math.max(max[k]!, a[i + k]!);
    }
  return { min, max };
}
const center = (a: Float32Array): V3 => {
  const b = boxOf(a);
  return [0, 1, 2].map((k) => (b.min[k]! + b.max[k]!) / 2) as V3;
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const mm = (v: number) => `${(v * 1000).toFixed(0)} mm`;
function concat(list: Float32Array[]): Float32Array {
  const out = new Float32Array(list.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of list) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/* ------------------------------------------------------------------ Z-Anatomy referans konumları */

interface ZaRef {
  eyeL: V3;
  eyeR: V3;
  brain: V3;
  organs: Record<string, V3>;
}
let ZA_REF: ZaRef | null = null;
/** Z-Anatomy organ merkezleri, uygulamanın (BodyParts3D erkek) koordinatında. */
function zaRef(): ZaRef {
  if (ZA_REF) return ZA_REF;
  const { T } = alignment(() => {});
  const pick = (file: string, test: (name: string, path: string) => boolean) => {
    const list = readZa(file)
      .filter((m) => test(m.name, m.path.join('/')))
      .map((m) => {
        const p = new Float32Array(m.pos);
        applySimArray(T, p);
        return p;
      });
    if (!list.length) throw new Error(`Z-Anatomy referansı yok: ${file}`);
    return center(concat(list));
  };
  const nerv = 'NervousSystem100.fbx';
  const visc = 'VisceralSystem100.fbx';
  ZA_REF = {
    eyeL: pick(nerv, (n, p) => /Sense organs\.?g?\/Eye\.?g?\/Eyeball/.test(p) && n.endsWith('.l')),
    eyeR: pick(nerv, (n, p) => /Sense organs\.?g?\/Eye\.?g?\/Eyeball/.test(p) && n.endsWith('.r')),
    brain: pick(nerv, (_n, p) => /Central nervous system\.?g?\/Brain/.test(p)),
    organs: {
      liver: pick(visc, (n) => n === 'Liver'),
      'kidney-l': pick(visc, (n) => n === 'Kidney.l'),
      'kidney-r': pick(visc, (n) => n === 'Kidney.r'),
      heart: pick('CardioVascular41.fbx', (_n, p) => /Heart\.g/.test(p)),
      trachea: pick(visc, (n) => n === 'Trachea'),
      bladder: pick(visc, (n) => n === 'Urinary bladder'),
    },
  };
  return ZA_REF;
}

/* ------------------------------------------------------------------ Gauss RBF bükme alanı */

interface Anchor {
  label: string;
  src: V3;
  dst: V3;
  /** Düzenlileştirme: küçük = çapaya tam uy, büyük = komşularla ortalaması alınır. */
  lambda: number;
}

export interface Warp {
  map(p: V3): V3;
  /** Çapa başına: önce / sonra sapma (m). */
  report: { label: string; before: number; after: number }[];
}

function solve(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...B[i]!]);
  const m = B[0]!.length;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    for (let k = c; k < n + m; k++) M[c]![k]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      if (!f) continue;
      for (let k = c; k < n + m; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((r) => r.slice(n));
}

export function rbfWarp(anchors: Anchor[], sigma: number): Warp {
  const phi = (a: V3, b: V3) => Math.exp(-((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / (2 * sigma * sigma));
  const A = anchors.map((ai, i) => anchors.map((aj, j) => phi(ai.src, aj.src) + (i === j ? ai.lambda : 0)));
  const D = anchors.map((a) => sub(a.dst, a.src));
  const W = solve(A, D);
  const map = (p: V3): V3 => {
    const q: V3 = [p[0], p[1], p[2]];
    for (let i = 0; i < anchors.length; i++) {
      const f = phi(p, anchors[i]!.src);
      if (f < 1e-6) continue;
      q[0] += W[i]![0]! * f;
      q[1] += W[i]![1]! * f;
      q[2] += W[i]![2]! * f;
    }
    return q;
  };
  return { map, report: anchors.map((a) => ({ label: a.label, before: len(sub(a.dst, a.src)), after: len(sub(a.dst, map(a.src))) })) };
}

/* ------------------------------------------------------------------ erkek: HRA → BodyParts3D */

/** BodyParts3D omurlarının merkezleri, Türkçe ada göre (HRA omurlarıyla eşleştirmek için). */
function bp3dVertebrae(map?: (a: Float32Array) => void): Map<string, V3> {
  const out = new Map<string, V3>();
  const spine = planBp3d().skeleton.find((g) => g.key === 'bones|spine')!;
  for (const id of spine.ids) {
    const tr = boneName(bp3dName(id))?.tr;
    if (!tr) continue;
    const a = readStl(id);
    map?.(a);
    out.set(tr.replace(/ —.*$/, ''), center(a));
  }
  return out;
}

async function hraCenters(file: string, test: (clean: string) => boolean = () => true): Promise<V3> {
  return center(await trianglesOf(file, (n) => test(cleanNodeName(n))));
}

async function hraVertebrae(file: string): Promise<Map<string, V3>> {
  const out = new Map<string, V3>();
  const names = [...Array(7)].map((_, i) => `cervical vertebra ${i + 1}`).concat([...Array(12)].map((_, i) => `thoracic vertebra ${i + 1}`), [...Array(6)].map((_, i) => `lumbar vertebra ${i + 1}`));
  const all = await Promise.all(names.map(async (n) => [n, await trianglesOf(file, (x) => cleanNodeName(x) === n)] as const));
  for (const [n, a] of all) {
    if (!a.length) continue;
    const tr = hraBoneName(n)?.tr;
    if (tr) out.set(tr.replace(/ —.*$/, ''), center(a));
  }
  return out;
}

export async function maleOrganWarp(hraDir: string, log: (s: string) => void): Promise<Warp> {
  log('\n[erkek · organ–iskelet uyumu (HRA → BodyParts3D)]');
  const f = (x: string) => join(hraDir, 'VH_Male', x);
  const ref = zaRef();
  const anchors: Anchor[] = [];
  // HRA göz küresi Z-Anatomy'ninkinden küçük ve BodyParts3D derisinin göz kapakları önde: göz 8 mm geride
  const back = (p: V3): V3 => [p[0], p[1], p[2] - 0.008];
  // Omurga: omur omur
  const hv = await hraVertebrae(f('v1.2/VH_M_Vertebrae.glb'));
  const bv = bp3dVertebrae();
  for (const [tr, src] of hv) {
    const dst = bv.get(tr);
    if (dst) anchors.push({ label: tr, src, dst, lambda: 0.15 });
  }
  // Baş: gözler ve beyin (göz çukurlarına ve kafatası boşluğuna)
  anchors.push({ label: 'sol göz', src: await hraCenters(f('v1.2/VH_M_Eye_L.glb')), dst: back(ref.eyeL), lambda: 0.01 });
  anchors.push({ label: 'sağ göz', src: await hraCenters(f('v1.2/VH_M_Eye_R.glb')), dst: back(ref.eyeR), lambda: 0.01 });
  anchors.push({ label: 'beyin', src: await hraCenters(f('v1.2/Allen_M_Brain.glb')), dst: ref.brain, lambda: 0.03 });
  // Gövde organları (iki ayrı insan: şekiller farklı; düzenlileştirme daha güçlü)
  const organ = async (label: string, file: string, key: string, lambda = 0.25) => anchors.push({ label, src: await hraCenters(f(file)), dst: ref.organs[key]!, lambda });
  await organ('karaciğer', 'v1.2/VH_M_Liver.glb', 'liver');
  await organ('sol böbrek', 'v1.2/VH_M_Kidney_L.glb', 'kidney-l');
  await organ('sağ böbrek', 'v1.2/VH_M_Kidney_R.glb', 'kidney-r');
  await organ('kalp', 'v1.2/VH_M_Heart.glb', 'heart');
  await organ('mesane', 'v1.2/VH_M_Urinary_Bladder.glb', 'bladder', 0.4);
  const warp = rbfWarp(anchors, 0.07);
  const show = warp.report.filter((r) => !/omur/.test(r.label) || r.before > 0.015);
  for (const r of show) log(`  ${r.label.padEnd(24)} ${mm(r.before).padStart(7)} → ${mm(r.after)}`);
  const sp = warp.report.filter((r) => /omur/.test(r.label));
  log(`  omurlar (${sp.length}): ortalama ${mm(sp.reduce((s, r) => s + r.before, 0) / sp.length)} → ${mm(sp.reduce((s, r) => s + r.after, 0) / sp.length)}`);
  return warp;
}

/* ------------------------------------------------------------------ kadın: baş dönüşümü */

/**
 * Kadında uyarlanmış kafatası için katı (+ölçek) dönüşüm. `m2f`: erkek → kadın noktası (kafatasının
 * şu anki konumu bununla hesaplanır). İki koşul birlikte aranır: (1) kafatası kadının derisinin içinde
 * kalsın (kafa derisi ~4 mm), (2) Z-Anatomy gözleri, beyni ve atlas (C1) kadın modelinin gözlerine,
 * beynine ve C1 omuruna mümkün olduğunca yakın olsun (C1 en güçlü: kafa omurgaya otursun). Kalan
 * küçük fark kadının göz ve beyninde yumuşak bükmeyle kapatılır.
 */
export async function femaleHeadFit(hraDir: string, m2f: (p: V3) => V3, log: (s: string) => void): Promise<{ head: Rigid; organs: Warp }> {
  log('\n[kadın · baş uyumu (uyarlanmış kafatası → kadın derisi, gözleri, beyni, C1)]');
  const f = (x: string) => join(hraDir, 'VH_Female', x);
  const ref = zaRef();
  const atlasTr = hraBoneName('cervical vertebra 1')!.tr;
  const c1Male = bp3dVertebrae().get(atlasTr);
  const hv = await hraVertebrae(f('v1.2/VH_F_Vertebrae.glb'));
  const c1F = hv.get(atlasTr);
  if (!c1Male || !c1F) throw new Error('C1 omuru bulunamadı');
  const pairs: [string, V3, V3, number][] = [
    ['sol göz', m2f(ref.eyeL), await hraCenters(f('v1.2/VH_F_Eye_L.glb')), 1],
    ['sağ göz', m2f(ref.eyeR), await hraCenters(f('v1.2/VH_F_Eye_R.glb')), 1],
    ['beyin', m2f(ref.brain), await hraCenters(f('v1.2/Allen_F_Brain.glb')), 1],
    ['C1', m2f(c1Male), c1F, 4],
  ];
  const skin = new Volume(await trianglesOf(f('v1.3/VH_F_skin.glb')), 0.004);
  const skullGroup = planBp3d().skeleton.find((g) => g.key === 'bones|skull')!;
  const skull: V3[] = [];
  for (const id of skullGroup.ids) {
    const a = readStl(id);
    for (let i = 0; i < a.length; i += 3 * 40) skull.push(m2f([a[i]!, a[i + 1]!, a[i + 2]!]));
  }
  const pivot = pairs[3]![1];
  // Parametreler: dönme (Z, X, Y derece), öteleme (mm), ölçek — C1 çevresinde
  const make = (q: number[]): Rigid => {
    const [a, b, c, tx, ty, tz, sc] = q as [number, number, number, number, number, number, number];
    const Rm = mulM(axisAngle([0, 0, 1], (a * Math.PI) / 180), mulM(axisAngle([1, 0, 0], (b * Math.PI) / 180), axisAngle([0, 1, 0], (c * Math.PI) / 180)));
    const S = Rm.map((row) => row.map((v) => v * sc)) as Rigid['R'];
    const T = aboutPivot(S, pivot);
    return { R: T.R, t: [T.t[0] + tx / 1000, T.t[1] + ty / 1000, T.t[2] + tz / 1000] };
  };
  const cost = (q: number[]) => {
    const T = make(q);
    let c = 0;
    for (const [, src, dst, w] of pairs) {
      const d = len(sub(dst, applyRigid(T, src)));
      c += w * d * d;
    }
    let pen = 0;
    for (const p of skull) {
      const x = applyRigid(T, p);
      const d = skin.surface.nearest(x, 0.05)?.d ?? 0.05;
      if (!skin.inside(x)) pen += (d + 0.004) ** 2;
      else if (d < 0.004) pen += (0.004 - d) ** 2;
    }
    return c / 7 + (pen / skull.length) * 40;
  };
  let q = [0, 0, 0, 0, 0, 0, 1];
  let best = cost(q);
  const before = best;
  for (const step of [4, 2, 1, 0.5, 0.25]) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let k = 0; k < 7; k++)
        for (const dir of [1, -1]) {
          const n = [...q];
          n[k]! += dir * (k === 6 ? step / 100 : step);
          if (n[6]! < 0.92 || n[6]! > 1.12 || Math.abs(n[0]!) > 15 || Math.abs(n[1]!) > 15 || Math.abs(n[2]!) > 15) continue;
          const c = cost(n);
          if (c < best - 1e-12) {
            best = c;
            q = n;
            improved = true;
          }
        }
    }
  }
  const T = make(q);
  const outside = skull.filter((p) => !skin.inside(applyRigid(T, p))).length / skull.length;
  for (const [label, a, b] of pairs) log(`  ${label.padEnd(8)} ${mm(len(sub(b, a))).padStart(7)} → ${mm(len(sub(b, applyRigid(T, a))))}`);
  log(`  dönme (Z ${q[0]}°, X ${q[1]}°, Y ${q[2]}°), öteleme (${q[3]}, ${q[4]}, ${q[5]}) mm, ölçek ${q[6]!.toFixed(3)}; kafatasının deri dışında kalan oranı %${(outside * 100).toFixed(1)}; maliyet ${(before * 1e6).toFixed(1)} → ${(best * 1e6).toFixed(1)}`);
  // Kalan farkı kadının kendi göz ve beyninde yumuşak bükmeyle kapat (boyun omurları sabit)
  const anchors: Anchor[] = [
    { label: 'sol göz', src: pairs[0]![2], dst: applyRigid(T, pairs[0]![1]), lambda: 0.01 },
    { label: 'sağ göz', src: pairs[1]![2], dst: applyRigid(T, pairs[1]![1]), lambda: 0.01 },
    { label: 'beyin', src: pairs[2]![2], dst: applyRigid(T, pairs[2]![1]), lambda: 0.03 },
  ];
  for (const [tr, p] of hv) if (/boyun omuru/i.test(tr)) anchors.push({ label: tr, src: p, dst: p, lambda: 0.05 });
  const organs = rbfWarp(anchors, 0.05);
  for (const r of organs.report.slice(0, 3)) log(`  kadın ${r.label.padEnd(8)} ${mm(r.before).padStart(7)} → ${mm(r.after)}`);
  return { head: T, organs };
}
