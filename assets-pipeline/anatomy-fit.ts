/**
 * Referans vücut uyumu için hesaplanan dönüşümler (bkz. fit.ts):
 *  - femaleLimbs: erkek BodyParts3D kol/bacaklarını kadın (VH_F) derisine oturtan eklemli uyum.
 *  - kneeFit: HRA diz kıkırdağı/menisküs/bağlarını o vücudun femur ve tibia yüzeyine oturtan katı dönüşüm.
 */
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, flatten } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { bp3dName, planBp3d, readStl } from './bp3d';
import { Blender, IDENTITY, PointGrid, type Rigid, type Segment, type SegmentFit, type V3, Volume, aboutPivot, apply, axisAngle, compose, downsample, fitSegments, icp, mulM } from './fit';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/** glTF dosyasının (seçili düğümlerinin) dünya koordinatlı üçgen çorbası. */
export async function trianglesOf(file: string, filter: (name: string) => boolean = () => true): Promise<Float32Array> {
  const doc = await io.read(file);
  await doc.transform(flatten());
  const out: number[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !filter(node.getName())) continue;
    clearNodeTransform(node);
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!;
      const idx = prim.getIndices();
      const e: number[] = [0, 0, 0];
      const n = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i < n; i++) {
        pos.getElement(idx ? idx.getScalar(i) : i, e);
        out.push(e[0]!, e[1]!, e[2]!);
      }
    }
  }
  return Float32Array.from(out);
}

type ArrayMap = (a: Float32Array) => void;

function mapped(ids: string[], map?: ArrayMap): Float32Array {
  const arrays = ids.map(readStl);
  if (map) for (const a of arrays) map(a);
  const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

const toV3 = (a: Float32Array, max = Infinity): V3[] => {
  const n = a.length / 3;
  const step = Math.max(1, Math.floor(n / max));
  const out: V3[] = [];
  for (let i = 0; i < n; i += step) out.push([a[i * 3]!, a[i * 3 + 1]!, a[i * 3 + 2]!]);
  return out;
};

/** Uzun kemiğin üst (top) ya da alt uç bölgesinin ağırlık merkezi. */
function endCentroid(a: Float32Array, which: 'top' | 'bottom', frac = 0.04): V3 {
  const pts = toV3(a);
  const ys = pts.map((p) => p[1]).sort((x, y) => x - y);
  const cut = which === 'top' ? ys[Math.floor(ys.length * (1 - frac))]! : ys[Math.floor(ys.length * frac)]!;
  const sel = pts.filter((p) => (which === 'top' ? p[1] >= cut : p[1] <= cut));
  const c: V3 = [0, 0, 0];
  for (const p of sel) for (let k = 0; k < 3; k++) c[k]! += p[k]! / sel.length;
  return c;
}

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** Kemik grubu → kol/bacak parçası (yoksa gövde). */
export function segmentOfBone(group: string): string | null {
  const m = /^bones\|(humerus|forearm|hand|femur|leg|foot)-([lr])$/.exec(group);
  if (!m) return null;
  const seg = { humerus: 'upper', forearm: 'fore', hand: 'hand', femur: 'thigh', leg: 'shank', foot: 'foot' }[m[1]!]!;
  return `${seg}-${m[2]}`;
}

export interface LimbFit {
  /** Kemik grubu (ve verilirse tek kemik: parmak) için katı dönüşüm (gövde kemiklerinde birim). */
  bone: (group: string, id?: string) => Rigid;
  /** Yumuşak doku / damar / sinir noktası için harmanlanmış dönüşüm. */
  point: (p: V3) => V3;
  report: Map<string, SegmentFit>;
}

/**
 * Kadın vücudu için eklemli kol/bacak uyumu. `m2f`: erkek → kadın benzerlik dönüşümü (dizi üzerinde).
 */
export async function femaleLimbs(hraDir: string, m2f: ArrayMap, log: (s: string) => void, head: Rigid = IDENTITY): Promise<LimbFit> {
  log('\n[kadın · kol/bacak uyumu]');
  const skin = new Volume(await trianglesOf(join(hraDir, 'VH_Female/v1.3/VH_F_skin.glb')), 0.005);
  const plan = planBp3d();
  const bones = new Map(plan.skeleton.map((g) => [g.key, mapped(g.ids, m2f)] as const));
  const muscles = plan.muscles.map((g) => mapped(g.ids, m2f));

  // Kas noktalarını en yakın kemik grubuna ata (parça örnekleri için)
  const labels: string[] = [];
  const bonePts: number[] = [];
  for (const [key, a] of bones) {
    const d = downsample(a, 0.01);
    for (let i = 0; i < d.length; i++) bonePts.push(d[i]!);
    for (let i = 0; i < d.length / 3; i++) labels.push(key);
  }
  const boneGrid = new PointGrid(Float32Array.from(bonePts), 0.02);
  const soft = new Map<string, V3[]>();
  for (const a of muscles) {
    for (const p of toV3(downsample(a, 0.012))) {
      const n = boneGrid.nearest(p, 0.2);
      if (!n) continue;
      const seg = segmentOfBone(labels[n.i]!);
      if (!seg) continue;
      const list = soft.get(seg) ?? [];
      list.push(p);
      soft.set(seg, list);
    }
  }
  const sample = (pts: V3[], max: number) => pts.filter((_, i) => i % Math.max(1, Math.ceil(pts.length / max)) === 0);
  const b = (k: string) => bones.get(`bones|${k}`)!;

  const segments: Segment[] = [];
  for (const s of ['l', 'r'] as const) {
    const shoulder = endCentroid(b(`humerus-${s}`), 'top');
    const elbow = mid(endCentroid(b(`humerus-${s}`), 'bottom'), endCentroid(b(`forearm-${s}`), 'top'));
    const wrist = mid(endCentroid(b(`forearm-${s}`), 'bottom'), endCentroid(b(`hand-${s}`), 'top'));
    const hip = endCentroid(b(`femur-${s}`), 'top');
    const knee = mid(endCentroid(b(`femur-${s}`), 'bottom'), endCentroid(b(`leg-${s}`), 'top'));
    const ankle = mid(endCentroid(b(`leg-${s}`), 'bottom'), endCentroid(b(`foot-${s}`), 'top', 0.25));
    const seg = (name: string, parent: string | undefined, pivot: V3, bone: string, range?: number, scale?: [number, number]): Segment => ({
      name: `${name}-${s}`,
      parent: parent && `${parent}-${s}`,
      pivot,
      bone: sample(toV3(downsample(b(`${bone}-${s}`), 0.01)), 250),
      soft: sample(soft.get(`${name}-${s}`) ?? [], 700),
      range,
      scale,
    });
    segments.push(
      seg('upper', undefined, shoulder, 'humerus'),
      seg('fore', 'upper', elbow, 'forearm'),
      seg('hand', 'fore', wrist, 'hand', 45, [0.85, 1.05]),
      seg('thigh', undefined, hip, 'femur', 20),
      seg('shank', 'thigh', knee, 'leg', 24),
      seg('foot', 'shank', ankle, 'foot', 30, [0.88, 1.05]),
    );
  }
  const report = fitSegments(segments, skin, log);

  const blender = new Blender(0.015);
  // Kafatası (uyarlanmış) kadının baş dönüşümüyle; çevresindeki yumuşak doku da onunla harmanlanır.
  const segT = (key: string) => {
    if (key === 'bones|skull') return head;
    const seg = segmentOfBone(key);
    return seg ? report.get(seg)!.T : IDENTITY;
  };
  const digits = fitDigits(plan.skeleton, m2f, report, skin, log);
  const boneT = (key: string, id?: string) => (id && digits.get(id)) || segT(key);
  for (const g of plan.skeleton) {
    if (!/^bones\|(hand|foot)-/.test(g.key)) {
      blender.add(bones.get(g.key)!, segT(g.key));
      continue;
    }
    // El ve ayakta her kemik kendi dönüşümüyle (parmaklar ayrı oturtuldu)
    for (const id of g.ids) blender.add(mapped([id], m2f), boneT(g.key, id));
  }
  return {
    bone: boneT,
    point: (p) => blender.map(p),
    report,
  };
}

/**
 * Parmaklar (el ve ayak): kadın derisinde parmak duruşu erkek modelinden farklıdır (ör. bükük
 * parmak uçları derinin dışında kalıyordu). Her parmak, el/ayak dönüşümünden sonra kendi taban
 * ekleminde (MCP/MTP: tarak kemiği ile ilk falanks arası) döndürülerek deriye oturtulur; küçük açılar
 * yeğlenir (gereksiz bükme olmasın).
 */
const DIGIT = /^(proximal|middle|distal) phalanx of (left|right) (thumb|index finger|middle finger|ring finger|little finger|big toe|second toe|third toe|fourth toe|little toe)$/;
const RAY: Record<string, string> = { thumb: 'first', 'index finger': 'second', 'middle finger': 'third', 'ring finger': 'fourth', 'little finger': 'fifth', 'big toe': 'first', 'second toe': 'second', 'third toe': 'third', 'fourth toe': 'fourth', 'little toe': 'fifth' };
function fitDigits(skeleton: { key: string; ids: string[] }[], m2f: ArrayMap, report: Map<string, SegmentFit>, skin: Volume, log: (s: string) => void): Map<string, Rigid> {
  const out = new Map<string, Rigid>();
  const lines: string[] = [];
  for (const g of skeleton) {
    const m = /^bones\|(hand|foot)-([lr])$/.exec(g.key);
    if (!m) continue;
    const parent = report.get(`${m[1]}-${m[2]}`)!.T;
    const digits = new Map<string, { ids: string[]; proximal?: string; level: Map<string, string> }>();
    const rays = new Map<string, string>();
    for (const id of g.ids) {
      const name = bp3dName(id);
      const d = DIGIT.exec(name);
      if (d) {
        const e = digits.get(d[3]!) ?? { ids: [], level: new Map<string, string>() };
        e.ids.push(id);
        e.level.set(d[1]!, id);
        if (d[1] === 'proximal') e.proximal = id;
        digits.set(d[3]!, e);
      }
      const r = /(first|second|third|fourth|fifth) (metacarpal|metatarsal) bone$/.exec(name);
      if (r) rays.set(r[1]!, id);
    }
    for (const [digit, e] of digits) {
      const ray = rays.get(RAY[digit]!);
      if (!e.proximal || !ray) continue;
      const prox = toV3(mapped([e.proximal], m2f)).map((p) => apply(parent, p));
      const meta = new PointGrid(Float32Array.from(toV3(mapped([ray], m2f)).flatMap((p) => apply(parent, p))), 0.01);
      const near = prox.map((p) => ({ p, d: meta.nearest(p, 0.08)?.d ?? 1 })).sort((a, b) => a.d - b.d);
      const sel = near.slice(0, Math.max(3, Math.floor(near.length * 0.05)));
      const pivot: V3 = [0, 1, 2].map((k) => sel.reduce((s, x) => s + x.p[k]!, 0) / sel.length) as V3;
      const pts = e.ids.flatMap((id) => toV3(downsample(mapped([id], m2f), 0.003))).map((p) => apply(parent, p));
      const rot = (a: number, b: number, c: number) => aboutPivot(mulM(axisAngle([0, 0, 1], (a * Math.PI) / 180), mulM(axisAngle([1, 0, 0], (b * Math.PI) / 180), axisAngle([0, 1, 0], (c * Math.PI) / 180))), pivot);
      const outside = (T: Rigid) => {
        let c = 0;
        for (const p of pts) {
          const q = apply(T, p);
          if (!skin.inside(q)) c += 0.002 + (skin.surface.nearest(q, 0.05)?.d ?? 0.05);
        }
        return c / pts.length;
      };
      const cost = (q: [number, number, number]) => outside(rot(...q)) + 2e-7 * (q[0] ** 2 + q[1] ** 2 + q[2] ** 2);
      let q: [number, number, number] = [0, 0, 0];
      const before = outside(rot(0, 0, 0));
      let best = cost(q);
      const lim = m[1] === 'hand' ? 70 : 40;
      for (const step of [10, 5, 2, 1]) {
        let improved = true;
        while (improved) {
          improved = false;
          for (let k = 0; k < 3; k++)
            for (const dir of [1, -1]) {
              const n: [number, number, number] = [...q];
              n[k] += dir * step;
              if (Math.abs(n[k]) > lim) continue;
              const c = cost(n);
              if (c < best - 1e-9) {
                best = c;
                q = n;
                improved = true;
              }
            }
        }
      }
      const T = compose(rot(...q), parent);
      for (const id of e.ids) out.set(id, T);
      const after1 = outside(rot(...q));
      // Orta (PIP) ve uç (DIP) eklemleri: kalan taşma için parmağın uç kısmı ayrıca bükülür
      let extra = '';
      const chain = ['proximal', 'middle', 'distal'].filter((l) => e.level.has(l));
      for (let li = 1; li < chain.length && after1 > 5e-5; li++) {
        const prevId = e.level.get(chain[li - 1]!)!;
        const sub = chain.slice(li).map((l) => e.level.get(l)!);
        const cur = (id: string) => toV3(downsample(mapped([id], m2f), 0.003)).map((p) => apply(out.get(id)!, p));
        const prevPts = cur(prevId);
        const firstPts = cur(sub[0]!);
        const grid = new PointGrid(Float32Array.from(prevPts.flat()), 0.01);
        const nearSub = firstPts.map((p) => ({ p, d: grid.nearest(p, 0.05)?.d ?? 1 })).sort((a, b) => a.d - b.d).slice(0, 4);
        const pv: V3 = [0, 1, 2].map((k) => nearSub.reduce((a, x) => a + x.p[k]!, 0) / nearSub.length) as V3;
        const subPts = sub.flatMap(cur);
        const rotS = (a: number, b: number, c: number) => aboutPivot(mulM(axisAngle([0, 0, 1], (a * Math.PI) / 180), mulM(axisAngle([1, 0, 0], (b * Math.PI) / 180), axisAngle([0, 1, 0], (c * Math.PI) / 180))), pv);
        const outS = (T2: Rigid) => subPts.reduce((c, p) => {
          const x = apply(T2, p);
          return c + (skin.inside(x) ? 0 : 0.002 + (skin.surface.nearest(x, 0.05)?.d ?? 0.05));
        }, 0) / subPts.length;
        const costS = (v: [number, number, number]) => outS(rotS(...v)) + 2e-7 * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
        let v: [number, number, number] = [0, 0, 0];
        let bestS = costS(v);
        for (const step of [10, 5, 2, 1]) {
          let imp = true;
          while (imp) {
            imp = false;
            for (let k = 0; k < 3; k++)
              for (const dir of [1, -1]) {
                const n: [number, number, number] = [...v];
                n[k] += dir * step;
                if (Math.abs(n[k]) > 60) continue;
                const c = costS(n);
                if (c < bestS - 1e-9) {
                  bestS = c;
                  v = n;
                  imp = true;
                }
              }
          }
        }
        if (v.some((x) => x !== 0)) {
          for (const id of sub) out.set(id, compose(rotS(...v), out.get(id)!));
          extra += ` + ${chain[li]} eklemi (Z ${v[0]}°, X ${v[1]}°, Y ${v[2]}°)`;
        }
      }
      if (before > 1e-5) lines.push(`${m[1]}-${m[2]} ${digit}: dışarıda ${(before * 1000).toFixed(1)} → ${(after1 * 1000).toFixed(1)} (Z ${q[0]}°, X ${q[1]}°, Y ${q[2]}°)${extra}`);
    }
  }
  log(`  parmak uyumu: ${lines.length} parmak düzeltildi`);
  for (const l of lines) log(`    ${l}`);
  return out;
}

/**
 * Diz parçalarını kemiklere oturtan katı dönüşüm (taraf başına). HRA diz dosyası kendi femur, tibia,
 * fibula ve patella uçlarını içerir: bunlar uygulamadaki (BodyParts3D) aynı kemiklerin yüzeyine ICP
 * ile oturtulur; bulunan dönüşüm o taraftaki kıkırdak, menisküs ve bağlara uygulanır.
 */
export async function kneeFit(kneeFile: string, femur: Float32Array, leg: Float32Array, log: (s: string) => void): Promise<Rigid> {
  const src = toV3(await trianglesOf(kneeFile, (n) => /_(femur|tibia|fibula|patella)_[LR]$/i.test(n)), 2500);
  const target = new PointGrid(Float32Array.from([...downsample(femur, 0.003), ...downsample(leg, 0.003)]), 0.01);
  const joint = mid(endCentroid(femur, 'bottom'), endCentroid(leg, 'top'));
  const c: V3 = [0, 0, 0];
  for (const p of src) for (let k = 0; k < 3; k++) c[k]! += p[k]! / src.length;
  const shift: Rigid = { R: IDENTITY.R, t: [joint[0] - c[0], joint[1] - c[1], joint[2] - c[2]] };
  const meanDist = (T: Rigid) => src.reduce((s, p) => s + (target.nearest(apply(T, p), 0.2)?.d ?? 0.2), 0) / src.length;
  const before = meanDist(IDENTITY);
  // İki başlangıçtan (olduğu yer / eklem merkezine taşınmış) iyi olanı
  const tries = [IDENTITY, shift].map((init) => {
    const moved = src.map((p) => apply(init, p));
    const r = icp(moved, target, [0.05, 0.03, 0.015, 0.008], 15);
    const T = { R: r.T.R, t: r.T.t };
    const total = { R: mulR(T.R, init.R), t: add(applyR(T.R, init.t), T.t) };
    return { T: total, d: meanDist(total) };
  });
  const best = tries.sort((a, b) => a.d - b.d)[0]!;
  log(`  diz ${kneeFile.split('/').pop()}: HRA kemik uçları – uygulama kemikleri ortalama uzaklık ${(before * 1000).toFixed(1)} → ${(best.d * 1000).toFixed(1)} mm`);
  return best.T;
}

const mulR = (a: Rigid['R'], b: Rigid['R']): Rigid['R'] => [0, 1, 2].map((r) => [0, 1, 2].map((c) => a[r]![0] * b[0]![c]! + a[r]![1] * b[1]![c]! + a[r]![2] * b[2]![c]!)) as Rigid['R'];
const applyR = (R: Rigid['R'], v: V3): V3 => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Bir kemik grubunun eşlenmiş noktaları (diz uyumu hedefi için). */
export function boneArray(group: string, map?: (a: Float32Array, g: string) => void): Float32Array {
  const g = planBp3d().skeleton.find((x) => x.key === group);
  if (!g) throw new Error(`kemik grubu yok: ${group}`);
  const arrays = g.ids.map(readStl);
  if (map) for (const a of arrays) map(a, g.key);
  const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
