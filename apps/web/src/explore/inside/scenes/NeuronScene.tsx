import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  type Curve,
  CylinderGeometry,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, bumpySphere, rng, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, Hoppers, type Hop, curve, faceOut, makePick } from '../micro';

/**
 * Nöron ve sinaps (temsili): sinir dokusunda üç nöron, destek (glia) hücreleri ve bir kimyasal sinaps.
 * Soldaki nöronun miyelinli aksonunda aksiyon potansiyeli, aksonun başındaki açık bölümde kesintisiz
 * ilerler, sonra Ranvier boğumundan boğuma "sıçrar". Akson ucunda kalsiyum girişi veziküllerin
 * boşalmasını tetikler; nörotransmitter sinaptik aralığı geçip sağdaki nöronun reseptörlerine bağlanır
 * ve o hücrede yeni bir sinyal doğar. Arkadaki ince, miyelinsiz akson karşılaştırma için sinyali
 * yavaş ve kesintisiz iletir. Ölçekler ve iyon/vezikül sayıları temsilidir; kişisel değerlerin etkisi
 * görünür olsun diye abartılır. Çevresel sinirden girildiğinde (origin 'nerves') astrosit ve
 * oligodendrosit yerine miyelini saran Schwann hücreleri gösterilir.
 */

/* ------------------------------------------------------------ yardımcılar */

const UP = new Vector3(0, 1, 0);
const M = new Matrix4();
const Q0 = new Quaternion();
const P = new Vector3();
const P2 = new Vector3();
const S = new Vector3();
const HIDE = new Matrix4().makeScale(0, 0, 0);

const mod = (a: number, n: number) => ((a % n) + n) % n;
const smooth = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

/** Eğri boyunca değişken yarıçaplı tüp (uçları sivrilebilir). Konum + normal, indeksli. */
function sweep(c: Curve<Vector3>, radiusAt: (s: number) => number, segments = 32, radial = 10, u0 = 0, u1 = 1): BufferGeometry {
  const pts: Vector3[] = [];
  const tan: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = u0 + ((u1 - u0) * i) / segments;
    pts.push(c.getPointAt(u));
    tan.push(c.getTangentAt(u).normalize());
  }
  const len = Math.max(1e-4, c.getLength() * (u1 - u0));
  const t0 = tan[0]!;
  const nor: Vector3[] = [new Vector3().crossVectors(t0, Math.abs(t0.y) < 0.9 ? UP : new Vector3(1, 0, 0)).normalize()];
  const axis = new Vector3();
  for (let i = 1; i <= segments; i++) {
    const n = nor[i - 1]!.clone();
    const a = tan[i - 1]!;
    const b = tan[i]!;
    axis.crossVectors(a, b);
    const s = axis.length();
    if (s > 1e-6) n.applyAxisAngle(axis.divideScalar(s), Math.atan2(s, a.dot(b)));
    n.addScaledVector(b, -n.dot(b)).normalize();
    nor.push(n);
  }
  const ring = radial + 1;
  const position = new Float32Array((segments + 1) * ring * 3);
  const normal = new Float32Array((segments + 1) * ring * 3);
  const bi = new Vector3();
  const dir = new Vector3();
  const h = 1 / segments;
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    const r = radiusAt(s);
    const sa = Math.max(0, s - h);
    const sb = Math.min(1, s + h);
    const slope = (radiusAt(sb) - radiusAt(sa)) / ((sb - sa) * len);
    const p = pts[i]!;
    const t = tan[i]!;
    const n = nor[i]!;
    bi.crossVectors(t, n);
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      dir.copy(n).multiplyScalar(Math.cos(ang)).addScaledVector(bi, Math.sin(ang));
      const k = (i * ring + j) * 3;
      position[k] = p.x + dir.x * r;
      position[k + 1] = p.y + dir.y * r;
      position[k + 2] = p.z + dir.z * r;
      dir.addScaledVector(t, -slope).normalize();
      normal[k] = dir.x;
      normal[k + 1] = dir.y;
      normal[k + 2] = dir.z;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      const b = a + ring;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setAttribute('normal', new BufferAttribute(normal, 3));
  g.setIndex(index);
  return g;
}

/** Uçları yuvarlatılmış yarıçap çarpanı (e: uç payı, 0..0.5). */
function capEnds(s: number, e: number, start: boolean, end: boolean): number {
  let k = 1;
  if (start && s < e) k = Math.sqrt(Math.max(0, 1 - ((e - s) / e) ** 2));
  if (end && s > 1 - e) k = Math.min(k, Math.sqrt(Math.max(0, 1 - ((s - (1 - e)) / e) ** 2)));
  return k;
}

function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

interface Limb {
  c: Curve<Vector3>;
  r0: number;
  r1: number;
}

function limb(r: () => number, from: Vector3, to: Vector3, bend: number): Curve<Vector3> {
  const d = to.clone().sub(from);
  const len = d.length();
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= 3; k++) {
    const p = from.clone().addScaledVector(d, k / 3);
    if (k > 0 && k < 3) p.add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(bend * len));
    pts.push([p.x, p.y, p.z]);
  }
  return curve(pts);
}

function randomDir(r: () => number, avoid: Vector3[]): Vector3 {
  for (let k = 0; k < 60; k++) {
    const d = new Vector3(r() - 0.5, r() - 0.5, (r() - 0.5) * 0.8).normalize();
    if (avoid.every((a) => d.dot(a) < 0.35)) return d;
  }
  return new Vector3(0, 1, 0);
}

/** Gövdeden ışınsal dallanan uzantılar (dendrit, glia uzantısı). */
function tree(r: () => number, center: Vector3, somaR: number, count: number, len: number, r0: number, avoid: Vector3[]): Limb[] {
  const out: Limb[] = [];
  for (let k = 0; k < count; k++) {
    const dir = randomDir(r, avoid);
    const from = center.clone().addScaledVector(dir, somaR * 0.75);
    const main = limb(r, from, from.clone().addScaledVector(dir, len * (0.75 + 0.5 * r())), 0.22);
    out.push({ c: main, r0, r1: r0 * 0.28 });
    const nb = 1 + Math.floor(r() * 2);
    for (let b = 0; b < nb; b++) {
      const at = main.getPointAt(0.4 + 0.35 * r());
      const bd = dir.clone().add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.5)).normalize();
      out.push({ c: limb(r, at, at.clone().addScaledVector(bd, len * (0.35 + 0.35 * r())), 0.25), r0: r0 * 0.45, r1: r0 * 0.14 });
    }
  }
  return out;
}

function limbGeometry(limbs: Limb[], segments = 20, radial = 7): BufferGeometry[] {
  return limbs.map((l) => sweep(l.c, (s) => (l.r0 + (l.r1 - l.r0) * s) * capEnds(s, 0.05, false, true), segments, radial));
}

function frameAt(c: Curve<Vector3>, u: number) {
  const p = c.getPointAt(u);
  const t = c.getTangentAt(u).normalize();
  const n = new Vector3().crossVectors(t, Math.abs(t.y) < 0.9 ? UP : new Vector3(1, 0, 0)).normalize();
  const b = new Vector3().crossVectors(t, n);
  return { p, t, n, b };
}

/* ------------------------------------------------------------ yerleşim */

const S1 = new Vector3(-4.3, 0.7, 0);
const S2 = new Vector3(4.6, 0.5, -0.4);
const S3 = new Vector3(-1.9, 2.6, -2.4);
/** Akson ucu (sinaptik düğme) ve karşıdaki dendrit dikeni. */
const BC = new Vector3(2.44, -0.26, 0.05);
const R_B = 0.27;
const CLEFT = 0.14;
const R_S = 0.2;
const SC = new Vector3(BC.x + R_B + CLEFT + R_S, BC.y, BC.z);

const A1 = curve([
  [-3.85, 0.6, 0.02],
  [-3.2, 0.42, 0.12],
  [-2.2, 0.18, 0.2],
  [-1.0, 0.02, 0.08],
  [0.3, -0.1, -0.08],
  [1.4, -0.2, -0.02],
  [2.3, -0.26, 0.05],
]);
const A2 = curve([
  [4.92, 0.78, -0.5],
  [5.3, 1.4, -0.65],
  [5.55, 2.3, -0.9],
  [5.8, 3.4, -1.2],
  [6.1, 4.6, -1.5],
]);
const A3 = curve([
  [-1.6, 2.35, -2.3],
  [-0.6, 1.95, -2.1],
  [0.8, 1.9, -2.3],
  [2.4, 2.15, -2.0],
  [3.9, 2.7, -2.2],
  [5.6, 3.1, -2.6],
]);
/** Sağdaki nöronun sinaps yapan dendriti: dikenden gövdeye. */
const D2 = curve([
  [SC.x + 0.12, SC.y, SC.z],
  [3.55, -0.12, 0.0],
  [4.0, 0.12, -0.18],
  [4.3, 0.35, -0.32],
  [S2.x - 0.25, S2.y, S2.z],
]);

const R_AX = 0.1;
const R_MY = 0.24;
const U_IS = 0.13;
const U_MY_END = 0.9;
const N_INT = 6;
const GAP = 0.018;

const { INTERNODES, NODES } = (() => {
  const internodes: [number, number][] = [];
  const nodes: number[] = [];
  const span = (U_MY_END - U_IS - GAP * (N_INT - 1)) / N_INT;
  let u = U_IS;
  for (let k = 0; k < N_INT; k++) {
    internodes.push([u, u + span]);
    u += span;
    if (k < N_INT - 1) {
      nodes.push(u + GAP / 2);
      u += GAP;
    }
  }
  return { INTERNODES: internodes, NODES: nodes };
})();
/** Sinyalin durakları: boğumlar ve miyelinin bittiği yer. */
const STOPS = [...NODES, U_MY_END];

/* ------------------------------------------------------------ zamanlama (simülasyon saniyesi) */

const PERIOD = 4.2;
const T_IS = 1.0;
const HOP = 0.3;
const GLIDE = 0.35;
const T_TERM = 0.25;
const T_ARRIVE = T_IS + HOP * STOPS.length + T_TERM;
const PERIOD3 = 5.0;
const T3 = 3.8;
/** Dinlenimde sinaps döngüsünün "boş" anı. */
const REST = 3.6;

/** Aksiyon potansiyelinin A1 üzerindeki yeri (u); ulaştıktan sonra null. */
function n1U(ph: number): number | null {
  if (ph < 0) return null;
  if (ph < T_IS) return (U_IS * ph) / T_IS;
  let pu = U_IS;
  let pt = T_IS;
  for (const su of STOPS) {
    if (ph < pt + HOP) return pu + (su - pu) * smooth((ph - pt) / (HOP * GLIDE));
    pu = su;
    pt += HOP;
  }
  if (ph < pt + T_TERM) return pu + ((1 - pu) * (ph - pt)) / T_TERM;
  return null;
}

/** Sinyalin u noktasından geçtiği an (iyon akışı için). */
function passTime(u: number): number {
  if (u <= U_IS) return (u / U_IS) * T_IS;
  if (u >= U_MY_END) return T_IS + HOP * STOPS.length + ((u - U_MY_END) / (1 - U_MY_END)) * T_TERM;
  let best = 0;
  let bd = Infinity;
  STOPS.forEach((s, k) => {
    const d = Math.abs(s - u);
    if (d < bd) {
      bd = d;
      best = k;
    }
  });
  return T_IS + HOP * best + HOP * GLIDE;
}

/** İyonun kanal açılınca yer değiştirme oranı (0 = dinlenim yeri, 1 = karşı taraf). */
function flux(since: number, delay: number): number {
  const s = since - delay;
  if (s < 0) return 0;
  if (s < 0.28) return smooth(s / 0.28);
  if (s < 1.5) return 1;
  if (s < 2.6) return 1 - smooth((s - 1.5) / 1.1);
  return 0;
}

interface Ion {
  p: Vector3;
  t: Vector3;
  n: Vector3;
  b: Vector3;
  th: number;
  r0: number;
  r1: number;
  move: boolean;
  tp: number;
  w: number;
}

/** İyonlar aksonun açık bölgelerinde: başlangıç bölümü, boğumlar, uç bölge. */
function ionSet(count: number, seed: number, kind: 'na' | 'kin' | 'kout'): Ion[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const zone = r();
    const u = zone < 0.55 ? 0.05 + r() * 0.075 : zone < 0.85 ? NODES[Math.floor(r() * NODES.length)]! + (r() - 0.5) * 0.008 : 0.915 + r() * 0.06;
    const { p, t, n, b } = frameAt(A1, u);
    const inside = 0.015 + r() * 0.065;
    const outside = R_AX + 0.035 + r() * 0.2;
    const move = kind !== 'kout' && r() < 0.45;
    const r0 = kind === 'kin' ? inside : outside;
    const r1 = kind === 'na' ? inside : kind === 'kin' ? R_AX + 0.04 + r() * 0.12 : outside;
    return { p, t, n, b, th: r() * Math.PI * 2, r0, r1, move, tp: passTime(u), w: r() * 6.28 };
  });
}

function placeIon(mesh: InstancedMesh, i: number, o: Ion, radius: number, t: number, size: number) {
  const th = o.th + 0.22 * Math.sin(t * 0.6 + o.w);
  const rr = radius + 0.01 * Math.sin(t * 2.3 + o.w * 3);
  P.copy(o.p)
    .addScaledVector(o.n, Math.cos(th) * rr)
    .addScaledVector(o.b, Math.sin(th) * rr)
    .addScaledVector(o.t, 0.015 * Math.sin(t * 0.9 + o.w * 2));
  M.compose(P, Q0, S.setScalar(size));
  mesh.setMatrixAt(i, M);
}

/** Kişisel değerin sahnedeki etkisi: küçük farklar görünür olsun diye kazançla büyütülür. */
function gain(v: number | undefined, k: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, 1 + ((v ?? 1) - 1) * k));
}

const NA_BASE = 150;
const NA_MAX = 300;
const K_IN = 110;
const KOUT_BASE = 28;
const KOUT_MAX = 70;
const CA_BASE = 14;
const CA_MAX = 30;
const VES_N = 28;
const REL_BASE = 6;
const REL_MAX = 12;
const NT_PER = 6;
const REC_N = 24;
const TRAIL = 8;

const SHOTS = [
  { position: [-0.6, 1.1, 7.6], target: [-0.3, 0.2, -0.2] },
  { position: [-3.2, 1.0, 1.6], target: [-3.38, 0.47, 0.1] },
  { position: [-2.6, 1.05, 2.4], target: [-2.8, 0.3, 0.15] },
  { position: [-0.9, 1.9, 4.4], target: [-0.7, 0.3, -0.3] },
  { position: [2.98, 0.32, 1.25], target: [2.76, -0.26, 0.05] },
  { position: [4.0, 1.4, 4.0], target: [4.0, 0.4, -0.3] },
] as const;

const SOMA_BASE = new Color('#e59ac0');
const SOMA_FLASH = new Color('#fff2c8');
const NODE_BASE = new Color('#3f8f9f');
const NODE_FLASH = new Color('#d8fdff');
const REC_BASE = new Color('#3a86c8');
const REC_LIT = new Color('#d0f6ff');
const PULSE = new Color('#8ff6ff');
const PSP = new Color('#b4ffd8');

export default function NeuronScene({ state, onSelect, reducedMotion, params, origin }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#05060c', ['#05060c', 7, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.5, max: 14 }, { position: [0, 2.5, 13], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const peripheral = origin === 'nerves';

  // Kişisel: hücre dışı Na⁺ ve K⁺ sayısı, bir sinyalde boşalan vezikül (Ca²⁺), miyelin kalınlığı (B12)
  const naF = gain(params.na, 4, 0.3, 2);
  const kF = gain(params.k, 3, 0.25, 2.5);
  const caF = gain(params.ca, 3, 0.2, 2);
  const nNa = Math.min(NA_MAX, Math.round(NA_BASE * naF));
  const nKout = Math.min(KOUT_MAX, Math.round(KOUT_BASE * kF));
  const nCa = Math.max(3, Math.min(CA_MAX, Math.round(CA_BASE * caF)));
  const rel = Math.max(1, Math.min(REL_MAX, Math.round(REL_BASE * caF)));
  const my = Math.max(0.55, Math.min(1, 0.55 + 0.45 * (params.b12 ?? 1)));

  // Dinlenim aşamasında sinyal yok; diğer aşamalarda nöronlar ateşler
  const fire = useEased(stage === 1 ? 0 : 1, 1.4);
  const myelinGlow = useEased(stage === 3 ? 1 : 0, 1.5);

  const somaGeo = useDisposable(() => bumpySphere(3, 0.07, 4));
  const somaMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.5, transparent: true, opacity: 0.82, depthWrite: false, emissive: '#2a0c1e', emissiveIntensity: 0.4, sheen: 0.6, sheenColor: '#ffd6ea' }),
  );
  const nucGeo = useDisposable(() => bumpySphere(1, 0.1, 8));
  const nucMat = useDisposable(() => new MeshStandardMaterial({ color: '#6a3a9a', roughness: 0.5, emissive: '#1e0c36', emissiveIntensity: 0.5 }));
  const neuronMat = useDisposable(() => new MeshStandardMaterial({ color: '#e59ac0', roughness: 0.55, emissive: '#3a0f28', emissiveIntensity: 0.45 }));
  const axonMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#e59ac0', roughness: 0.4, transparent: true, opacity: 0.5, depthWrite: false, side: DoubleSide, emissive: '#3a0f28', emissiveIntensity: 0.5 }),
  );
  const myelinMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#f4ecd8', roughness: 0.35, sheen: 1, sheenColor: '#ffffff', emissive: '#2a261a', emissiveIntensity: 0.25 }),
  );
  const ringGeo = useDisposable(() => new TorusGeometry(R_AX + 0.012, 0.016, 8, 28));
  const nodeMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#0f3a40', emissiveIntensity: 0.8 }));
  const boutonGeo = useDisposable(() => bumpySphere(2, 0.05, 11));
  const synMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#e59ac0', roughness: 0.35, transparent: true, opacity: 0.4, depthWrite: false, side: DoubleSide, emissive: '#3a0f28', emissiveIntensity: 0.5 }),
  );
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const vesMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffd6ec', roughness: 0.35, emissive: '#5a2040', emissiveIntensity: 0.6 }));
  const ntMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff6fc0', emissive: '#a01a70', emissiveIntensity: 1.1 }));
  const recGeo = useDisposable(() => new CylinderGeometry(0.016, 0.016, 0.05, 8).rotateZ(Math.PI / 2));
  const recMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#0a2a4a', emissiveIntensity: 0.6 }));
  const naMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffd84a', emissive: '#8a6a00', emissiveIntensity: 0.9 }));
  const kMat = useDisposable(() => new MeshStandardMaterial({ color: '#b27dff', emissive: '#40207a', emissiveIntensity: 0.9 }));
  const caMat = useDisposable(() => new MeshStandardMaterial({ color: '#8dffa0', emissive: '#1a7a30', emissiveIntensity: 0.9 }));
  const pumpGeo = useDisposable(() => new CapsuleGeometry(0.024, 0.05, 4, 10));
  const pumpMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9d3b', roughness: 0.45, emissive: '#6a3000', emissiveIntensity: 0.5 }));
  const astroMat = useDisposable(() => new MeshStandardMaterial({ color: '#79c9a4', roughness: 0.55, emissive: '#0c3a26', emissiveIntensity: 0.4 }));
  const oligoMat = useDisposable(() => new MeshStandardMaterial({ color: '#a7a6ff', roughness: 0.55, emissive: '#1a1a50', emissiveIntensity: 0.45 }));
  const schwannGeo = useDisposable(() => bumpySphere(2, 0.08, 14));
  const pulseMat = useDisposable(
    () => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  );

  // Hücre gövdeleri, uzantılar, glia (bir kez üretilir)
  const body = useDisposable(() => {
    const r = rng(101);
    const d1 = tree(r, S1, 0.5, 7, 1.35, 0.085, [new Vector3(1, -0.25, 0).normalize()]);
    const d2 = tree(r, S2, 0.46, 5, 1.2, 0.08, [new Vector3(-1, -0.6, 0.6).normalize(), new Vector3(0.4, 0.9, -0.1).normalize()]);
    const d3 = tree(r, S3, 0.36, 5, 0.95, 0.055, [new Vector3(1, -0.5, 0).normalize()]);
    const dendrites = mergeAll([...limbGeometry([...d1, ...d2, ...d3]), sweep(D2, (s) => 0.05 + 0.06 * s, 40, 10)]);
    const axons = mergeAll([
      sweep(A1, (s) => R_AX + 0.1 * (1 - smooth(s / 0.05)) + 0.05 * smooth((s - 0.96) / 0.04), 220, 14),
      sweep(A2, (s) => (0.075 + 0.07 * (1 - smooth(s / 0.08))) * capEnds(s, 0.02, false, true), 60, 10),
      sweep(A3, (s) => (0.06 + 0.06 * (1 - smooth(s / 0.06))) * capEnds(s, 0.02, false, true), 90, 8),
    ]);
    // Astrosit: uzantılarından biri sinapsı, biri bir boğumu sarar
    const AST = new Vector3(0.7, -1.55, -0.7);
    const astroLimbs: Limb[] = [
      { c: limb(r, AST, new Vector3(2.42, -0.6, -0.05), 0.12), r0: 0.06, r1: 0.022 },
      { c: limb(r, AST, A1.getPointAt(NODES[2]!).add(new Vector3(0, -0.16, -0.05)), 0.12), r0: 0.055, r1: 0.02 },
      ...tree(r, AST, 0.3, 7, 1.0, 0.05, [new Vector3(0.6, 0.8, 0.3).normalize()]),
    ];
    const astroSoma = bumpySphere(2, 0.14, 7);
    astroSoma.scale(0.3, 0.3, 0.3);
    astroSoma.translate(AST.x, AST.y, AST.z);
    const astro = mergeAll([astroSoma, ...limbGeometry(astroLimbs, 18, 6)]);
    // Oligodendrosit: uzantıları miyelin kılıflarına uzanır (diğer aksonlar sahne dışında)
    const OL = new Vector3(-1.3, 1.35, -0.45);
    const oligoLimbs: Limb[] = [1, 2, 3].map((k) => {
      const [a, b] = INTERNODES[k]!;
      return { c: limb(r, OL, A1.getPointAt((a + b) / 2).add(new Vector3(0, R_MY * 0.8, -0.05)), 0.15), r0: 0.045, r1: 0.03 };
    });
    oligoLimbs.push(
      { c: limb(r, OL, new Vector3(-2.7, 2.3, -1.9), 0.15), r0: 0.045, r1: 0.018 },
      { c: limb(r, OL, new Vector3(0.2, 2.5, -2.0), 0.15), r0: 0.045, r1: 0.018 },
    );
    const oligoSoma = bumpySphere(2, 0.1, 9);
    oligoSoma.scale(0.24, 0.24, 0.24);
    oligoSoma.translate(OL.x, OL.y, OL.z);
    const oligo = mergeAll([oligoSoma, ...limbGeometry(oligoLimbs, 18, 6)]);
    const geos = { dendrites, axons, astro, oligo };
    return { ...geos, dispose: () => Object.values(geos).forEach((g) => g.dispose()) };
  });

  // Miyelin kılıfları: kalınlık B12 düğmesine bağlı (değişince yeniden üretilir)
  const myelinGeo = useDisposable(
    () =>
      mergeAll(
        INTERNODES.map(([a, b]) => {
          const R = R_MY * my;
          const e = Math.min(0.35, R / (A1.getLength() * (b - a)));
          return sweep(A1, (s) => Math.max(R_AX * 0.95, R * capEnds(s, e, true, true)), 30, 18, a, b);
        }),
      ),
    [my],
  );

  const cells = useMemo(() => {
    const r = rng(7);
    const somas: CellSpec[] = [
      { p: S1, s: new Vector3(0.55, 0.47, 0.5), color: '#e59ac0' },
      { p: S2, s: new Vector3(0.5, 0.44, 0.46), color: '#e59ac0' },
      { p: S3, s: new Vector3(0.38, 0.34, 0.36), color: '#e59ac0' },
    ];
    const nuclei: CellSpec[] = [
      { p: S1.clone().add(new Vector3(-0.06, 0.04, 0.05)), s: 0.2 },
      { p: S2.clone().add(new Vector3(0.05, 0.03, 0.05)), s: 0.18 },
      { p: S3.clone().add(new Vector3(-0.03, 0.03, 0.04)), s: 0.14 },
    ];
    const nodes: CellSpec[] = NODES.map((u) => ({ p: A1.getPointAt(u), s: 1, q: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), A1.getTangentAt(u).normalize()) }));
    // Na⁺/K⁺ pompaları aksonun başlangıç bölümünde
    const pumps: CellSpec[] = [];
    const pumpNa: Hop[] = [];
    const pumpK: Hop[] = [];
    for (let k = 0; k < 6; k++) {
      const { p, n, b } = frameAt(A1, 0.058 + k * 0.012);
      const th = k * 2.4 + r() * 0.3;
      const dir = n.clone().multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th));
      pumps.push({ p: p.clone().addScaledVector(dir, R_AX), s: 1, q: faceOut(dir) });
      pumpNa.push({ from: p.clone().addScaledVector(dir, 0.03), to: p.clone().addScaledVector(dir, R_AX + 0.2) });
      pumpK.push({ from: p.clone().addScaledVector(dir, R_AX + 0.2), to: p.clone().addScaledVector(dir, 0.03) });
    }
    // Reseptörler: dikenin sinaptik yüzünde ayçiçeği düzeninde
    const receptors: CellSpec[] = [];
    for (let i = 0; i < REC_N; i++) {
      const rr = 0.125 * Math.sqrt((i + 0.5) / REC_N);
      const a = i * 2.39996;
      const y = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const x = SC.x - Math.sqrt(R_S * R_S - rr * rr) - 0.012;
      receptors.push({ p: new Vector3(x, SC.y + y, SC.z + z), s: 1, color: '#3a86c8' });
    }
    return { somas, nuclei, nodes, pumps, pumpNa, pumpK, receptors };
  }, []);

  // Çevresel sinirde her miyelin kılıfını bir Schwann hücresi yapar (çekirdeği kılıfın üstünde)
  const schwann = useMemo<CellSpec[]>(
    () =>
      INTERNODES.map(([a, b]) => {
        const { p, t } = frameAt(A1, (a + b) / 2);
        const up = UP.clone().addScaledVector(t, -UP.dot(t)).normalize();
        return { p: p.clone().addScaledVector(up, R_MY * my * 0.92), s: new Vector3(0.2, 0.055, 0.1), q: new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), t) };
      }),
    [my],
  );

  const ions = useMemo(() => ({ na: ionSet(NA_MAX, 11, 'na'), kin: ionSet(K_IN, 13, 'kin'), kout: ionSet(KOUT_MAX, 15, 'kout') }), []);

  const syn = useMemo(() => {
    const r = rng(17);
    const rest = Array.from({ length: VES_N }, () =>
      BC.clone()
        .add(new Vector3(0.03, 0, 0))
        .add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.04 + Math.cbrt(r()) * 0.15)),
    ).sort((a, b) => b.x - a.x);
    // Kaynaşma noktaları: aktif bölge (düğmenin aralığa bakan yüzü)
    const fuse = rest.map((_, i) => {
      const rr = 0.02 + 0.1 * Math.sqrt((i % REL_MAX + 0.5) / REL_MAX);
      const a = i * 2.39996;
      return new Vector3(BC.x + Math.sqrt(R_B * R_B - rr * rr) - 0.045, BC.y + Math.cos(a) * rr, BC.z + Math.sin(a) * rr);
    });
    const nt = Array.from({ length: REL_MAX * NT_PER }, () => ({
      lift: new Vector3(0, r() - 0.5, r() - 0.5).multiplyScalar(0.06),
      back: new Vector3(0, r() - 0.5, r() - 0.5).multiplyScalar(0.12),
      w: r() * 6.28,
    }));
    const ca = Array.from({ length: CA_MAX }, () => {
      const d = new Vector3(0.35 + r(), r() - 0.5, r() - 0.5).normalize();
      return { out: BC.clone().addScaledVector(d, R_B + 0.06 + r() * 0.12), in: BC.clone().addScaledVector(d, R_B * 0.6), d: r() * 0.12, w: r() * 6.28 };
    });
    return { rest, fuse, nt, ca };
  }, []);

  const naRef = useRef<InstancedMesh>(null);
  const kRef = useRef<InstancedMesh>(null);
  const caRef = useRef<InstancedMesh>(null);
  const vesRef = useRef<InstancedMesh>(null);
  const ntRef = useRef<InstancedMesh>(null);
  const pulseRef = useRef<InstancedMesh>(null);

  useFrame(() => {
    const t = time.current;
    const f = fire.current;
    const ph = mod(t, PERIOD);
    const live = f > 0.02;
    const sy = live ? mod(ph - T_ARRIVE, PERIOD) : REST;
    myelinMat.emissiveIntensity = 0.25 + 0.35 * myelinGlow.current;

    // Na⁺: dışarıda bekler, sinyal geçerken bir kısmı içeri akar
    const na = naRef.current;
    if (na) {
      na.count = nNa;
      for (let i = 0; i < nNa; i++) {
        const o = ions.na[i]!;
        const e = o.move ? flux(mod(ph - o.tp, PERIOD), 0) * f : 0;
        placeIon(na, i, o, o.r0 + (o.r1 - o.r0) * e, t, 0.028);
      }
      na.instanceMatrix.needsUpdate = true;
    }
    // K⁺: içeride bekler, Na⁺'dan hemen sonra bir kısmı dışarı çıkar; dışarıdakiler kişisel değere göre
    const km = kRef.current;
    if (km) {
      km.count = K_IN + nKout;
      for (let i = 0; i < K_IN; i++) {
        const o = ions.kin[i]!;
        const e = o.move ? flux(mod(ph - o.tp, PERIOD), 0.18) * f : 0;
        placeIon(km, i, o, o.r0 + (o.r1 - o.r0) * e, t, 0.03);
      }
      for (let i = 0; i < nKout; i++) {
        const o = ions.kout[i]!;
        placeIon(km, K_IN + i, o, o.r0, t, 0.03);
      }
      km.instanceMatrix.needsUpdate = true;
    }
    // Ca²⁺: sinyal uca varınca düğmeye girer, sonra tamponlanır
    const cm = caRef.current;
    if (cm) {
      cm.count = nCa;
      for (let i = 0; i < nCa; i++) {
        const c = syn.ca[i]!;
        const s = sy - c.d;
        let k = 0;
        let sc = 1;
        if (s >= 0 && s < 0.3) k = smooth(s / 0.3);
        else if (s >= 0.3 && s < 1.1) k = 1;
        else if (s >= 1.1 && s < 1.7) {
          k = 1;
          sc = 1 - smooth((s - 1.1) / 0.6);
        } else if (s >= 1.7 && s < 2.6) sc = 0;
        else if (s >= 2.6 && s < 3.1) sc = smooth((s - 2.6) / 0.5);
        P.lerpVectors(c.out, c.in, k).addScalar(0.012 * Math.sin(t * 2 + c.w));
        M.compose(P, Q0, S.setScalar(0.026 * Math.max(0.0001, sc)));
        cm.setMatrixAt(i, M);
      }
      cm.instanceMatrix.needsUpdate = true;
    }
    // Veziküller: ilk `rel` tanesi aktif bölgeye gider, zarla kaynaşır, sonra yeniden oluşur
    const vm = vesRef.current;
    if (vm) {
      for (let v = 0; v < VES_N; v++) {
        const rest = syn.rest[v]!;
        let sc = 1;
        P.copy(rest);
        if (v < rel && live) {
          const fuse = syn.fuse[v]!;
          if (sy >= 0.12 && sy < 0.4) P.lerpVectors(rest, fuse, smooth((sy - 0.12) / 0.28));
          else if (sy >= 0.4 && sy < 0.55) {
            P.copy(fuse);
            sc = 1 - smooth((sy - 0.4) / 0.15);
          } else if (sy >= 0.55 && sy < 2.7) sc = 0;
          else if (sy >= 2.7 && sy < 3.2) sc = smooth((sy - 2.7) / 0.5);
        }
        P.addScalar(0.006 * Math.sin(t * 1.7 + v));
        M.compose(P, Q0, S.setScalar(0.035 * Math.max(0.0001, sc)));
        vm.setMatrixAt(v, M);
      }
      vm.instanceMatrix.needsUpdate = true;
    }
    // Nörotransmitter: aralığı geçer, reseptöre bağlanır, sonra geri alınır
    const nm = ntRef.current;
    if (nm) {
      nm.count = rel * NT_PER;
      for (let v = 0; v < rel; v++) {
        const fuse = syn.fuse[v]!;
        for (let j = 0; j < NT_PER; j++) {
          const idx = v * NT_PER + j;
          const o = syn.nt[idx]!;
          if (!live || sy < 0.45 || sy >= 2.2) {
            nm.setMatrixAt(idx, HIDE);
            continue;
          }
          const rec = cells.receptors[idx % REC_N]!.p;
          P2.set(fuse.x + 0.05, fuse.y, fuse.z);
          let sc = 1;
          if (sy < 0.95) {
            const e = smooth((sy - 0.45) / 0.5);
            P.set(rec.x - 0.03, rec.y, rec.z);
            P.lerpVectors(P2, P, e).addScaledVector(o.lift, Math.sin(Math.PI * e));
          } else if (sy < 1.5) {
            P.set(rec.x - 0.03, rec.y + 0.005 * Math.sin(t * 9 + o.w), rec.z);
          } else {
            const e = smooth((sy - 1.5) / 0.7);
            P.set(rec.x - 0.03, rec.y, rec.z);
            P2.add(o.back);
            P.lerp(P2, e);
            sc = 1 - 0.9 * e;
          }
          M.compose(P, Q0, S.setScalar(0.013 * sc));
          nm.setMatrixAt(idx, M);
        }
      }
      nm.instanceMatrix.needsUpdate = true;
    }
    // Sinyal ışımaları: A1 (sıçramalı), A3 (kesintisiz, yavaş), karşı hücrede dendrit ve akson
    const pm = pulseRef.current;
    if (pm) {
      let n = 0;
      const trail = (c: Curve<Vector3>, uAt: (dt: number) => number | null, size: number, col: Color) => {
        for (let k = 0; k < TRAIL; k++) {
          const u = live ? uAt(k * 0.035) : null;
          if (u === null) {
            pm.setMatrixAt(n, HIDE);
          } else {
            c.getPointAt(Math.min(1, Math.max(0, u)), P);
            M.compose(P, Q0, S.setScalar(Math.max(0.0001, size * (1 - k / TRAIL) * f)));
            pm.setMatrixAt(n, M);
          }
          pm.setColorAt(n, col);
          n++;
        }
      };
      trail(A1, (dt) => n1U(ph - dt), 0.14, PULSE);
      const ph3 = mod(t + 1.3, PERIOD3);
      trail(A3, (dt) => (ph3 - dt < 0 || ph3 - dt > T3 ? null : (ph3 - dt) / T3), 0.1, PULSE);
      const pspAmp = Math.min(1.25, 0.45 + (0.55 * rel) / REL_BASE);
      trail(D2, (dt) => (sy - dt < 1.0 || sy - dt > 2.0 ? null : sy - dt - 1.0), 0.13 * pspAmp, PSP);
      trail(A2, (dt) => (sy - dt < 2.2 || sy - dt > 3.7 ? null : (sy - dt - 2.2) / 1.5), 0.12, PULSE);
      pm.instanceMatrix.needsUpdate = true;
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }
  });

  const recLit = Math.min(REC_N, rel * NT_PER);

  return (
    <group>
      <ambientLight intensity={0.35} color="#e6dcff" />
      <directionalLight position={[3, 5, 5]} intensity={1.1} />
      <Headlight intensity={2.8} distance={14} />
      {/* Nöronlar */}
      <Cells
        cells={cells.somas}
        geometry={somaGeo}
        material={somaMat}
        onClick={pick('soma')}
        time={time}
        animate={(i, t, out) => {
          const p0 = mod(t, PERIOD);
          let k: number;
          if (i === 0) k = Math.exp(-((Math.min(p0, PERIOD - p0) / 0.25) ** 2));
          else if (i === 1) k = Math.exp(-(((mod(p0 - T_ARRIVE, PERIOD) - 2.1) / 0.22) ** 2));
          else {
            const p3 = mod(t + 1.3, PERIOD3);
            k = Math.exp(-((Math.min(p3, PERIOD3 - p3) / 0.25) ** 2));
          }
          k *= fire.current;
          out.copy(SOMA_BASE).lerp(SOMA_FLASH, k * 0.8);
          return { color: true, scale: 1 + 0.04 * k };
        }}
      />
      <Cells cells={cells.nuclei} geometry={nucGeo} material={nucMat} onClick={pick('soma')} />
      <mesh geometry={body.dendrites} material={neuronMat} onClick={pick('dendrite')} />
      <mesh geometry={body.axons} material={axonMat} onClick={pick('axon')} />
      <mesh geometry={myelinGeo} material={myelinMat} onClick={pick('myelin')} />
      <Cells
        cells={cells.nodes}
        geometry={ringGeo}
        material={nodeMat}
        onClick={pick('node')}
        time={time}
        animate={(i, t, out) => {
          const k = Math.exp(-(((mod(t, PERIOD) - (T_IS + HOP * i + HOP * GLIDE)) / 0.12) ** 2)) * fire.current;
          out.copy(NODE_BASE).lerp(NODE_FLASH, k);
          return { color: true, scale: 1 + 0.5 * k };
        }}
      />
      {/* Sinaps */}
      <mesh geometry={boutonGeo} material={synMat} position={BC} scale={R_B} onClick={pick('synapse')} />
      <mesh geometry={boutonGeo} material={synMat} position={SC} scale={R_S} onClick={pick('synapse')} />
      <instancedMesh ref={vesRef} args={[small, vesMat, VES_N]} onClick={pick('vesicle')} frustumCulled={false} />
      <instancedMesh ref={ntRef} args={[small, ntMat, REL_MAX * NT_PER]} onClick={pick('transmitter')} frustumCulled={false} />
      <Cells
        cells={cells.receptors}
        geometry={recGeo}
        material={recMat}
        onClick={pick('receptor')}
        time={time}
        animate={(i, t, out) => {
          const s = mod(mod(t, PERIOD) - T_ARRIVE, PERIOD);
          const k = i < recLit ? smooth((s - 0.9) / 0.12) * (1 - smooth((s - 1.5) / 0.35)) * fire.current : 0;
          out.copy(REC_BASE).lerp(REC_LIT, k);
          return { color: true, scale: 1 + 0.3 * k };
        }}
      />
      {/* İyonlar ve pompalar */}
      <instancedMesh ref={naRef} args={[small, naMat, NA_MAX]} onClick={pick('sodium')} frustumCulled={false} />
      <instancedMesh ref={kRef} args={[small, kMat, K_IN + KOUT_MAX]} onClick={pick('potassium')} frustumCulled={false} />
      <instancedMesh ref={caRef} args={[small, caMat, CA_MAX]} onClick={pick('calcium')} frustumCulled={false} />
      <Cells cells={cells.pumps} geometry={pumpGeo} material={pumpMat} onClick={pick('axon')} />
      <Hoppers hops={cells.pumpNa} count={18} geometry={small} material={naMat} time={time} duration={2.4} size={0.026} seed={3} onClick={pick('sodium')} />
      <Hoppers hops={cells.pumpK} count={12} geometry={small} material={kMat} time={time} duration={2.4} size={0.028} seed={5} onClick={pick('potassium')} />
      {/* Sinyal */}
      <instancedMesh ref={pulseRef} args={[small, pulseMat, TRAIL * 4]} onClick={pick('axon')} frustumCulled={false} />
      {/* Glia */}
      <mesh geometry={body.astro} material={astroMat} onClick={pick('astrocyte')} visible={!peripheral} />
      <mesh geometry={body.oligo} material={oligoMat} onClick={pick('oligodendrocyte')} visible={!peripheral} />
      <Cells cells={schwann} geometry={schwannGeo} material={oligoMat} onClick={pick('myelin')} visible={peripheral} />
    </group>
  );
}
