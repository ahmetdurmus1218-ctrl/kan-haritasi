/**
 * Kol ve bacak damarları (ŞEMATİK).
 *
 * Kullandığımız kaynaklarda (HRA erkek, BodyParts3D 3.0) kol ve bacak damarı modeli yok. Ana
 * atardamar ve toplardamarların yolu, BodyParts3D kemiklerinden çıkarılan işaret noktalarına göre
 * yaklaşık olarak çizilir (ör. brakiyal arter humerusun iç yanında, femoral arter uyluğun ön-iç
 * yüzünde, popliteal arter diz arkasında). Gövde uçları BodyParts3D'nin köprücükaltı ve dış iliak
 * damarlarının uçlarından başlar. Arayüz bu damarları "şematik" olarak etiketler.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document } from '@gltf-transform/core';
import { BP3D_DIR, readStl } from './bp3d';

type V = [number, number, number];

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V) => Math.sqrt(dot(a, a));
const norm = (a: V): V => mul(a, 1 / (len(a) || 1));
const lerp = (a: V, b: V, t: number): V => add(a, mul(sub(b, a), t));

function names(): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of readFileSync(join(BP3D_DIR, 'parts_list_e.txt'), 'utf8').split('\n').slice(1)) {
    const [id, name] = line.split('\t');
    if (id && name) m.set(name.trim(), id.replace(/"/g, ''));
  }
  return m;
}

function verts(id: string): V[] {
  const p = readStl(id);
  const out: V[] = [];
  for (let i = 0; i < p.length; i += 9) out.push([p[i]!, p[i + 1]!, p[i + 2]!]);
  return out;
}

const centroid = (vs: V[]): V => mul(vs.reduce((s, v) => add(s, v), [0, 0, 0] as V), 1 / vs.length);

/** Uzun kemiğin iki ucu (uzun eksen boyunca en uç %4'lük dilimlerin ortası); `top` yukarıdaki uç. */
function longBone(vs: V[]): { top: V; bottom: V; at: (t: number) => V } {
  const c = centroid(vs);
  // Kuvvet yöntemiyle ana eksen
  let axis: V = [0, 1, 0];
  for (let it = 0; it < 20; it++) {
    let acc: V = [0, 0, 0];
    for (const v of vs) {
      const d = sub(v, c);
      acc = add(acc, mul(d, dot(d, axis)));
    }
    axis = norm(acc);
  }
  if (axis[1] < 0) axis = mul(axis, -1);
  const proj = vs.map((v) => dot(sub(v, c), axis)).sort((a, b) => a - b);
  const lo = proj[Math.floor(proj.length * 0.02)]!;
  const hi = proj[Math.floor(proj.length * 0.98)]!;
  const top = add(c, mul(axis, hi));
  const bottom = add(c, mul(axis, lo));
  return { top, bottom, at: (t) => lerp(top, bottom, t) };
}

/** Bir damar ucunun en dıştaki / en alttaki bölgesi. */
function extreme(vs: V[], score: (v: V) => number): V {
  const sorted = [...vs].sort((a, b) => score(b) - score(a));
  return centroid(sorted.slice(0, Math.max(3, Math.floor(sorted.length * 0.03))));
}

/* ---------------------------------------------------------------- Catmull-Rom + tüp */

function catmull(points: V[], samples: number): V[] {
  const out: V[] = [];
  const p = [points[0]!, ...points, points[points.length - 1]!];
  const segs = points.length - 1;
  for (let s = 0; s < segs; s++) {
    const [p0, p1, p2, p3] = [p[s]!, p[s + 1]!, p[s + 2]!, p[s + 3]!];
    const n = Math.max(2, Math.round(samples * (len(sub(p2, p1)) / 0.1)));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

function tube(path: V[], r0: number, r1: number, radial = 8): { pos: number[]; idx: number[] } {
  const pos: number[] = [];
  const idx: number[] = [];
  let normal: V = [1, 0, 0];
  for (let i = 0; i < path.length; i++) {
    const t = norm(sub(path[Math.min(i + 1, path.length - 1)]!, path[Math.max(i - 1, 0)]!));
    // Paralel taşıma: normal teğete dik kalsın
    normal = norm(sub(normal, mul(t, dot(normal, t))));
    if (len(normal) < 0.5 || Number.isNaN(normal[0])) normal = norm(cross(t, [0, 0, 1]));
    const binormal = cross(t, normal);
    const r = r0 + (r1 - r0) * (i / (path.length - 1));
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const d = add(mul(normal, Math.cos(a) * r), mul(binormal, Math.sin(a) * r));
      pos.push(...add(path[i]!, d));
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      const c = (i + 1) * radial + k;
      const d = (i + 1) * radial + ((k + 1) % radial);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Uç kapakları
  for (const [ring, flip] of [
    [0, true],
    [path.length - 1, false],
  ] as const) {
    const center = pos.length / 3;
    pos.push(...path[ring]!);
    for (let k = 0; k < radial; k++) {
      const a = ring * radial + k;
      const b = ring * radial + ((k + 1) % radial);
      if (flip) idx.push(center, b, a);
      else idx.push(center, a, b);
    }
  }
  return { pos, idx };
}

interface Vessel {
  /** İngilizce kaynak adı (arayüzde Türkçeye çevrilir). */
  name: string;
  points: V[];
  r: [number, number];
}

export function limbVessels(): Vessel[] {
  const n = names();
  const id = (name: string) => {
    const x = n.get(name);
    if (!x) throw new Error(`BodyParts3D parçası yok: ${name}`);
    return x;
  };
  const out: Vessel[] = [];
  const ANT: V = [0, 0, 1];
  const UP: V = [0, 1, 0];

  for (const side of ['right', 'left'] as const) {
    const sx = side === 'left' ? 1 : -1;
    const MED: V = [-sx, 0, 0];
    const LAT: V = [sx, 0, 0];
    const o = (...parts: [V, number][]) => parts.reduce((s, [v, k]) => add(s, mul(v, k)), [0, 0, 0] as V);

    // --- Kol
    const hum = longBone(verts(id(`${side} humerus`)));
    const rad = longBone(verts(id(`${side} radius`)));
    const uln = longBone(verts(id(`${side} ulna`)));
    const handIds = [...n].filter(([k]) => new RegExp(`(metacarpal|phalanx).*${side} hand|${side} (first|second|third|fourth|fifth) metacarpal`).test(k)).map(([, v]) => v);
    const hand = handIds.length ? centroid(handIds.flatMap((h) => verts(h))) : add(rad.bottom, [0, -0.08, 0]);
    const subA = verts(id(`${side} subclavian artery`));
    const subV = verts(id(`${side} subclavian vein`));
    const aStart = extreme(subA, (v) => v[0] * sx);
    const vStart = extreme(subV, (v) => v[0] * sx);
    const elbow = add(hum.bottom, o([ANT, 0.022], [UP, 0.012]));
    const wristR = add(rad.bottom, o([ANT, 0.01], [UP, 0.012]));
    const wristU = add(uln.bottom, o([ANT, 0.01], [UP, 0.014]));
    const palm = add(hand, o([ANT, 0.014], [UP, 0.015]));

    const axilla = add(hum.at(0.08), o([MED, 0.032], [ANT, 0.005], [UP, -0.01]));
    out.push({
      name: `${side} axillary and brachial artery`,
      points: [aStart, lerp(aStart, axilla, 0.5), axilla, add(hum.at(0.45), o([MED, 0.02], [ANT, 0.012])), add(hum.at(0.8), o([MED, 0.012], [ANT, 0.018])), elbow],
      r: [0.0034, 0.0028],
    });
    out.push({ name: `${side} radial artery`, points: [elbow, add(rad.at(0.2), o([ANT, 0.014])), add(rad.at(0.6), o([ANT, 0.011])), wristR], r: [0.0022, 0.0019] });
    out.push({ name: `${side} ulnar artery`, points: [elbow, add(uln.at(0.2), o([ANT, 0.016], [LAT, 0.004])), add(uln.at(0.6), o([ANT, 0.012])), wristU], r: [0.0024, 0.002] });
    out.push({ name: `${side} palmar arch`, points: [wristR, add(palm, o([LAT, 0.012], [UP, 0.01])), add(palm, o([UP, -0.005])), add(palm, o([MED, 0.012], [UP, 0.012])), wristU], r: [0.0016, 0.0016] });
    // Toplardamarlar
    const vElbow = add(elbow, o([ANT, 0.004], [MED, 0.004]));
    out.push({
      name: `${side} axillary and brachial vein`,
      points: [vStart, lerp(vStart, axilla, 0.5), add(axilla, o([MED, 0.006], [ANT, 0.006])), add(hum.at(0.45), o([MED, 0.026], [ANT, 0.014])), add(hum.at(0.8), o([MED, 0.017], [ANT, 0.02])), vElbow],
      r: [0.0036, 0.0028],
    });
    out.push({
      name: `${side} cephalic vein`,
      points: [add(rad.bottom, o([LAT, 0.012], [ANT, 0.004])), add(rad.at(0.5), o([LAT, 0.02], [ANT, 0.014])), add(hum.bottom, o([LAT, 0.024], [ANT, 0.024])), add(hum.at(0.45), o([LAT, 0.012], [ANT, 0.03])), add(hum.at(0.08), o([MED, 0.004], [ANT, 0.04])), vStart],
      r: [0.0018, 0.0022],
    });
    out.push({
      name: `${side} basilic vein`,
      points: [add(uln.bottom, o([MED, 0.012], [ANT, 0.004])), add(uln.at(0.5), o([MED, 0.018], [ANT, 0.012])), add(hum.bottom, o([MED, 0.03], [ANT, 0.016])), add(hum.at(0.55), o([MED, 0.026], [ANT, 0.012])), add(hum.at(0.35), o([MED, 0.026], [ANT, 0.012]))],
      r: [0.0018, 0.0024],
    });

    // --- Bacak
    const fem = longBone(verts(id(`${side} femur`)));
    const tib = longBone(verts(id(`${side} tibia`)));
    const fib = longBone(verts(id(`${side} fibula`)));
    const footIds = [...n].filter(([k]) => new RegExp(`${side} (talus|calcaneus|navicular|cuboid|.*cuneiform|.*metatarsal)`).test(k)).map(([, v]) => v);
    const foot = centroid(footIds.flatMap((f) => verts(f)));
    const iliacA = verts(id(`${side} external iliac artery`));
    const iliacV = verts(id(`${side} external iliac vein`));
    const lStart = extreme(iliacA, (v) => -v[1]);
    const lvStart = extreme(iliacV, (v) => -v[1]);
    const groin = add(fem.at(0.06), o([MED, 0.03], [ANT, 0.04]));
    const knee = add(fem.bottom, o([ANT, -0.032], [UP, 0.035]));
    const belowKnee = add(tib.at(0.1), o([ANT, -0.024]));
    const ankleFront = add(tib.bottom, o([ANT, 0.024], [LAT, 0.012], [UP, 0.02]));
    const ankleBack = add(tib.bottom, o([MED, 0.014], [ANT, -0.014], [UP, 0.02]));
    const dorsum = add(foot, o([ANT, 0.045], [UP, 0.025], [LAT, 0.004]));
    const sole = add(foot, o([ANT, 0.02], [UP, -0.018], [MED, 0.01]));
    out.push({
      name: `${side} femoral and popliteal artery`,
      points: [lStart, groin, add(fem.at(0.4), o([MED, 0.026], [ANT, 0.024])), add(fem.at(0.72), o([MED, 0.022], [ANT, 0.0])), add(fem.at(0.9), o([ANT, -0.024])), knee, belowKnee],
      r: [0.004, 0.0032],
    });
    out.push({
      name: `${side} anterior tibial artery`,
      points: [belowKnee, add(lerp(tib.at(0.15), fib.at(0.15), 0.45), o([ANT, 0.008])), add(lerp(tib.at(0.5), fib.at(0.5), 0.4), o([ANT, 0.014])), ankleFront, dorsum],
      r: [0.0024, 0.0018],
    });
    out.push({
      name: `${side} posterior tibial artery`,
      points: [belowKnee, add(tib.at(0.25), o([ANT, -0.026], [MED, 0.004])), add(tib.at(0.65), o([ANT, -0.02], [MED, 0.008])), ankleBack, sole],
      r: [0.0026, 0.0019],
    });
    out.push({
      name: `${side} femoral and popliteal vein`,
      points: [lvStart, add(groin, o([MED, 0.012], [ANT, -0.004])), add(fem.at(0.4), o([MED, 0.034], [ANT, 0.018])), add(fem.at(0.72), o([MED, 0.028], [ANT, -0.004])), add(fem.at(0.9), o([ANT, -0.03], [MED, 0.006])), add(knee, o([ANT, -0.008], [MED, 0.006])), add(belowKnee, o([ANT, -0.006], [MED, 0.006]))],
      r: [0.0046, 0.0036],
    });
    out.push({
      name: `${side} great saphenous vein`,
      points: [add(dorsum, o([MED, 0.02], [UP, -0.006])), add(tib.bottom, o([MED, 0.02], [ANT, 0.016], [UP, 0.03])), add(tib.at(0.5), o([MED, 0.034], [ANT, -0.004])), add(fem.bottom, o([MED, 0.042], [ANT, -0.012], [UP, 0.03])), add(fem.at(0.5), o([MED, 0.05], [ANT, 0.014])), add(fem.at(0.1), o([MED, 0.036], [ANT, 0.045])), add(groin, o([MED, 0.012], [ANT, -0.002], [UP, 0.008]))],
      r: [0.0022, 0.0026],
    });
    out.push({
      name: `${side} small saphenous vein`,
      points: [add(fib.bottom, o([ANT, -0.02], [LAT, 0.006], [UP, 0.02])), add(lerp(tib.at(0.55), fib.at(0.55), 0.5), o([ANT, -0.05])), add(lerp(tib.at(0.2), fib.at(0.2), 0.5), o([ANT, -0.052])), add(knee, o([ANT, -0.01], [UP, -0.006]))],
      r: [0.0018, 0.0022],
    });
  }
  return out;
}

/** Şematik damarlar tek belgeye: her damar ayrı düğüm ("limb-vessels|right radial artery"). */
export function limbVesselDocument(): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('limbs');
  for (const v of limbVessels()) {
    const path = catmull(v.points, 14);
    const { pos, idx } = tube(path, v.r[0], v.r[1], 8);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer));
    const key = `limb-vessels|${v.name}`;
    scene.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(prim)));
  }
  doc.getRoot().setDefaultScene(scene);
  return doc;
}

/** BodyParts3D'nin gövde damarlarından HRA'da olmayanlar (gerçek model). */
export const BP3D_TRUNK_VESSELS: [string, string][] = [
  ['right subclavian artery', 'carotid-arteries'],
  ['left subclavian artery', 'carotid-arteries'],
  ['right common carotid artery', 'carotid-arteries'],
  ['right common iliac artery', 'abdominal-vessels'],
  ['left common iliac artery', 'abdominal-vessels'],
  ['right external iliac artery', 'abdominal-vessels'],
  ['left external iliac artery', 'abdominal-vessels'],
  ['right internal iliac artery', 'abdominal-vessels'],
  ['left internal iliac artery', 'abdominal-vessels'],
  ['right internal jugular vein', 'veins'],
  ['left internal jugular vein', 'veins'],
  ['right subclavian vein', 'veins'],
  ['left subclavian vein', 'veins'],
];

export function trunkVesselDocument(): Document {
  const n = names();
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('trunk');
  for (const [name, structure] of BP3D_TRUNK_VESSELS) {
    const pos = readStl(n.get(name)!);
    const count = pos.length / 3;
    const index = new Uint32Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(index).setBuffer(buffer));
    const key = `${structure}|${name}`;
    scene.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(prim)));
  }
  doc.getRoot().setDefaultScene(scene);
  return doc;
}
