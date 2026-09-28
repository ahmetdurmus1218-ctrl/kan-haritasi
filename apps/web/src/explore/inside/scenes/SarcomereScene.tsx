import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  type BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, Hoppers, type Hop, Tubes, curve, makePick } from '../micro';

/**
 * Kas lifi ve sarkomer (temsili). Solda paralel kas liflerinden oluşan bir demet (fasikül);
 * öndeki lifin ucu kesilmiş, içinden miyofibriller açılıyor. Bir miyofibrildeki tek sarkomer
 * aşağıda büyütülmüş olarak gösterilir: Z çizgileri, aktin (ince) ve miyozin (kalın) iplikleri.
 * Kasılma döngüsü: sinir uyarısı → asetilkolin → lif boyunca elektrik dalgası → kalsiyum →
 * miyozin başlarının güç vuruşu → Z çizgileri yaklaşır (~%22) → gevşeme. Eksen X.
 * Kişisel: CK sonucu üst sınırı aştıkça birkaç liften dışarı sızan CK molekülleri artar.
 */

const BUNDLE_Y = 0.9;
const BUNDLE_Z = -0.8;
const FIBER_R = 0.42;
const FEAT_Y = BUNDLE_Y;
const FEAT_Z = BUNDLE_Z + 0.92 * Math.sqrt(3);
const FIB_X0 = -6.4;
const FEAT_END = 2.0;
/** Çizgilenme aralıkları (temsili): lif yüzeyinde ve açılan miyofibrillerde. */
const FIB_P = 0.16;
const MYO_P = 0.3;
const MYO_ANCHOR = 3.2;
/** Büyütülmüş sarkomerin merkezi ve ölçüleri (1 µm ≈ 1,6 birim). */
const SC = new Vector3(3.2, -2.4, 1.5);
const Z_REST = 2.0;
const SHORTEN = 0.22;
const ACTIN_LEN = 1.6;
const MYO_HALF = 1.28;
const LATTICE = 0.42;
const NMJ_X = -2.6;
/** Bir kasılma döngüsünün süresi (sahne saniyesi). */
const TWITCH = 3.2;
const K_MAX = 200;
const CA_MAX = 300;
const CK_MAX = 180;
const ACH_N = 60;

const SHOTS = [
  { position: [-0.6, 2.6, 10.2], target: [-0.6, -0.1, 0] },
  { position: [4.4, 0.2, 5.6], target: [3.1, -0.9, 1.1] },
  { position: [-1.3, 2.5, 3.9], target: [-2.6, 1.15, 1.0] },
  { position: [3.8, -1.2, 5.0], target: [3.2, -2.3, 1.5] },
  { position: [3.2, -1.9, 4.6], target: [3.2, -2.4, 1.5] },
  { position: [4.9, -1.2, 4.3], target: [3.6, -2.2, 1.6] },
] as const;

const UP = new Vector3(0, 1, 0);
const XAX = new Vector3(1, 0, 0);
const M = new Matrix4();
const P = new Vector3();
const P2 = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const ROT_Y = new Quaternion().setFromAxisAngle(UP, Math.PI);
const C = new Color();
const HIDE = new Matrix4().makeScale(0, 0, 0);
const HEAD_REST = new Color('#ff8fb0');
const HEAD_PULL = new Color('#ffe0ec');

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function polar(r: number, a: number): Vector2 {
  return new Vector2(Math.cos(a) * r, Math.sin(a) * r);
}

/** Lif yüzeyinin normali: θ, +y'den +z'ye doğru ölçülür. */
function normalAt(th: number, out = new Vector3()): Vector3 {
  return out.set(0, Math.cos(th), Math.sin(th));
}

/** Dar referans aralıklı iyonlarda sapmayı görünür kılar (yalnızca görselleştirme). */
function emphasize(v: number | undefined, gain: number): number {
  return Math.max(0.15, Math.min(3, 1 + ((v ?? 1) - 1) * gain));
}

/** Kasılma düzeyi (0..1), döngü evresine göre. */
function contraction(ph: number): number {
  return sstep(0.32, 0.46, ph) * (1 - sstep(0.7, 0.88, ph));
}

/** Eksen boyunca yönlenmiş, yüzeye yassı oturan nesne (çekirdek, uç düğme, son plak). */
function surfaceQuat(n: Vector3): Quaternion {
  const tang = new Vector3().crossVectors(XAX, n);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(XAX, n, tang));
}

function pointAtX(cv: CatmullRomCurve3, x: number, out: Vector3): Vector3 {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (cv.getPoint(m, out).x < x) lo = m;
    else hi = m;
  }
  return cv.getPoint((lo + hi) / 2, out);
}

interface StripeUniforms {
  uP: { value: number };
  uAnchor: { value: number };
  uSqueeze: { value: number };
  uApX: { value: number };
  uApFront: { value: number };
  uApAmp: { value: number };
  uApColor: { value: Color };
}

function stripeUniforms(period: number, anchor: number): StripeUniforms {
  return {
    uP: { value: period },
    uAnchor: { value: anchor },
    uSqueeze: { value: 1 },
    uApX: { value: 0 },
    uApFront: { value: 0 },
    uApAmp: { value: 0 },
    uApColor: { value: new Color('#7fe9ff') },
  };
}

/**
 * Çizgili kas malzemesi: dünya X eksenine göre A bandı (koyu), H bölgesi, I bandı (açık) ve
 * Z çizgisi. Kasılmada (uSqueeze < 1) A bandı sabit kalır, I bandı ve H bölgesi daralır.
 * İsteğe bağlı olarak lif boyunca iki yöne yayılan elektrik dalgası (aksiyon potansiyeli).
 */
function striatedMaterial(color: string, u: StripeUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color, roughness: 0.55, emissive: '#2a0508', emissiveIntensity: 0.45 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vKhX;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 khW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        khW = instanceMatrix * khW;
      #endif
      vKhX = (modelMatrix * khW).x;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uP;\nuniform float uAnchor;\nuniform float uSqueeze;\nuniform float uApX;\nuniform float uApFront;\nuniform float uApAmp;\nuniform vec3 uApColor;\nvarying float vKhX;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float khL = uP * uSqueeze;
        float khS = (vKhX - uAnchor) / khL;
        float khPos = fract(khS) * khL;
        float khDc = abs(khPos - 0.5 * khL);
        float khAA = clamp(1.0 - fwidth(khS) * 2.0, 0.0, 1.0);
        float khA = 1.0 - smoothstep(0.3 * uP, 0.34 * uP, khDc);
        float khHw = max(0.0, 0.5 * khL - 0.4 * uP);
        float khH = 1.0 - smoothstep(khHw - 0.02 * uP, khHw + 0.02 * uP, khDc);
        float khZ = 1.0 - smoothstep(0.0, 0.035 * uP, min(khPos, khL - khPos));
        diffuseColor.rgb *= 1.0 - khAA * (0.3 * khA - 0.12 * khH * khA + 0.35 * khZ);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float khD = abs(vKhX - uApX) - uApFront;
        totalEmissiveRadiance += uApColor * uApAmp * exp(-khD * khD * 5.0);`,
      );
  };
  m.customProgramCacheKey = () => 'kh-striated-x';
  return m;
}

/** Aktin: iki zincirin sarmal dolanmasıyla oluşan ince iplik (eksen X, boy 1). */
function actinGeometry(): BufferGeometry {
  const parts = [0, Math.PI].map((ph) => {
    const pts = Array.from({ length: 41 }, (_, i) => {
      const x = i / 40;
      const a = ph + x * Math.PI * 2 * 3.5;
      return new Vector3(x, Math.cos(a) * 0.02, Math.sin(a) * 0.02);
    });
    return new TubeGeometry(new CatmullRomCurve3(pts), 80, 0.019, 5, false);
  });
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

interface Fiber {
  y: number;
  z: number;
  x0: number;
  x1: number;
  r: number;
}

interface Head {
  base: Vector3;
  radial: Vector3;
  toM: number;
  ph: number;
}

interface CaParticle {
  src: Vector3;
  thin: number;
  side: number;
  v: number;
  off: Vector3;
  delay: number;
  myo: boolean;
}

interface Leak {
  f: number;
  x: number;
  a: number;
  o: number;
}

function buildMuscle() {
  const r = rng(83);
  // Fasikül: altıgen dizilimde lifler (öndeki halka-2 lifi, uç kısmı açılan "öne çıkan" liftir)
  const slots: Vector2[] = [new Vector2(0, 0)];
  for (let k = 0; k < 6; k++) slots.push(polar(0.92, (k * Math.PI) / 3));
  for (let k = 0; k < 6; k++) if (k !== 1) slots.push(polar(0.92 * Math.sqrt(3), Math.PI / 6 + (k * Math.PI) / 3));
  const fibers: Fiber[] = slots.map((s) => ({
    y: BUNDLE_Y + s.x,
    z: BUNDLE_Z + s.y,
    x0: FIB_X0 - r() * 0.4,
    x1: 0.5 + r() * 1.1,
    r: FIBER_R * (0.92 + r() * 0.12),
  }));
  const fiberCells: CellSpec[] = fibers.map((f) => ({ p: new Vector3((f.x0 + f.x1) / 2, f.y, f.z), s: new Vector3(f.x1 - f.x0, f.r, f.r) }));

  // Çevresel çekirdekler (iskelet kası: zarın hemen altında, yassı)
  const nuclei: CellSpec[] = [];
  const allFibers: Fiber[] = [...fibers, { y: FEAT_Y, z: FEAT_Z, x0: FIB_X0, x1: FEAT_END, r: FIBER_R }];
  allFibers.forEach((f) => {
    for (let i = 0; i < 6; i++) {
      const x = f.x0 + 0.5 + r() * (f.x1 - f.x0 - 1);
      if (Math.abs(x - NMJ_X) < 0.45 && f.x1 === FEAT_END) continue;
      const n = normalAt(r() * Math.PI * 2);
      nuclei.push({ p: new Vector3(x, f.y, f.z).addScaledVector(n, f.r - 0.025), s: new Vector3(0.3, 0.06, 0.12), q: surfaceQuat(n) });
    }
  });

  // Öndeki lifin kesik ucundan açılan miyofibriller
  const offs: Vector2[] = [new Vector2(0, 0)];
  for (let k = 0; k < 6; k++) offs.push(polar(0.16, (k * Math.PI) / 3));
  for (let k = 0; k < 6; k++) offs.push(polar(0.32, (k * Math.PI) / 3));
  for (let k = 0; k < 6; k++) offs.push(polar(0.277, Math.PI / 6 + (k * Math.PI) / 3));
  const myofibrils = offs.map((o) =>
    curve([
      [FEAT_END - 0.3, FEAT_Y + o.x, FEAT_Z + o.y],
      [FEAT_END + 0.5, FEAT_Y + o.x * 1.2, FEAT_Z + o.y * 1.2],
      [FEAT_END + 1.4, FEAT_Y + o.x * 1.55, FEAT_Z + o.y * 1.55],
      [FEAT_END + 2.3, FEAT_Y + o.x * 1.85, FEAT_Z + o.y * 1.85],
    ]),
  );
  // Vurgulanan miyofibril: öne bakan (+z) halka-2 miyofibrili (indeks 14)
  const hl = myofibrils[14]!;
  const sleeveA = pointAtX(hl, MYO_ANCHOR, new Vector3());
  const sleeveB = pointAtX(hl, MYO_ANCHOR + MYO_P, new Vector3());

  // Büyütülmüş sarkomer: kalın iplikler altıgen örgüde, ince iplikler üçgen boşluklarda
  const thick: Vector2[] = [new Vector2(0, 0)];
  for (let k = 0; k < 6; k++) thick.push(polar(LATTICE, (k * Math.PI) / 3));
  const thin: Vector2[] = [];
  for (const t of thick) {
    for (let j = 0; j < 6; j++) {
      const p = polar(LATTICE / Math.sqrt(3), Math.PI / 6 + (j * Math.PI) / 3).add(t);
      if (p.length() > 0.75 || thin.some((q) => q.distanceTo(p) < 0.01)) continue;
      thin.push(p);
    }
  }
  const myosin: CellSpec[] = thick.map((t) => ({ p: new Vector3(SC.x, SC.y + t.x, SC.z + t.y), s: new Vector3(2 * MYO_HALF, 1, 1) }));
  const heads: Head[] = [];
  thick.forEach((t, ti) => {
    for (const side of [-1, 1]) {
      for (let j = 0; j < 8; j++) {
        for (let k = 0; k < 3; k++) {
          const ang = (k * Math.PI * 2) / 3 + j * 0.9 + ti * 0.7;
          const radial = normalAt(ang);
          heads.push({
            base: new Vector3(SC.x + side * (0.24 + j * 0.135), SC.y + t.x, SC.z + t.y).addScaledVector(radial, 0.075),
            radial,
            toM: -side,
            ph: r(),
          });
        }
      }
    }
  });

  // Kalsiyum: 1/3'ü açılan miyofibrillerin arasında, kalanı büyütülmüş sarkomerde (depodan aktine)
  const ca: CaParticle[] = Array.from({ length: CA_MAX }, (_, i) => {
    const myo = i % 3 === 0;
    if (myo) {
      const x = FEAT_END + 0.1 + r() * 2.1;
      const spread = 1 + ((x - FEAT_END) / 2.3) * 0.85;
      const o = polar((0.1 + r() * 0.5) * spread, r() * Math.PI * 2);
      return { src: new Vector3(x, FEAT_Y + o.x, FEAT_Z + o.y), thin: 0, side: 1, v: 0, off: new Vector3(), delay: r() * 0.05, myo };
    }
    const a = r() * Math.PI * 2;
    const rad = 1.0 + r() * 0.15;
    return {
      src: new Vector3(SC.x + (r() - 0.5) * 3.6, SC.y + Math.cos(a) * rad, SC.z + Math.sin(a) * rad),
      thin: Math.floor(r() * thin.length),
      side: r() < 0.5 ? -1 : 1,
      v: 0.15 + r() * 0.8,
      off: new Vector3(0, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06),
      delay: r() * 0.04,
      myo,
    };
  });

  // Mitokondriler: miyofibrillerin çevresinde ve büyütülmüş sarkomerin yanında
  const mitoMyo: CellSpec[] = Array.from({ length: 8 }, (_, i) => {
    const x = FEAT_END + 0.3 + (i / 7) * 1.8;
    const spread = 1 + ((x - FEAT_END) / 2.3) * 0.85;
    const o = polar(0.52 * spread, (i * Math.PI * 2) / 8 + 0.4);
    return { p: new Vector3(x, FEAT_Y + o.x, FEAT_Z + o.y), s: 1 };
  });
  const mitoModel: CellSpec[] = [-1.4, -0.5, 0.4, 1.3, 1.9].map((dx, i) => {
    const n = normalAt(0.9 + i * 0.35);
    return { p: new Vector3(SC.x + dx, SC.y, SC.z).addScaledVector(n, 1.3), s: 1.2 };
  });

  // Enerji: mitokondriden miyozin başlarına ATP, M çizgisine kreatin fosfat
  const atpHops: Hop[] = Array.from({ length: 40 }, () => ({ from: mitoModel[Math.floor(r() * mitoModel.length)]!.p.clone(), to: heads[Math.floor(r() * heads.length)]!.base.clone() }));
  const ckM: CellSpec[] = Array.from({ length: 14 }, (_, i) => {
    const n = normalAt((i / 14) * Math.PI * 2);
    return { p: new Vector3(SC.x + (r() - 0.5) * 0.08, SC.y, SC.z).addScaledVector(n, 0.22 + (i % 3) * 0.14), s: 0.045 };
  });
  const cpHops: Hop[] = Array.from({ length: 20 }, (_, i) => ({ from: mitoModel[i % mitoModel.length]!.p.clone(), to: ckM[i % ckM.length]!.p.clone() }));

  // Sinir: akson, miyelin kılıf, uç düğmeler ve son plak (öndeki lifin üst-ön yüzünde)
  const nmjN = normalAt(Math.PI / 4);
  const axonEnd = new Vector3(NMJ_X, FEAT_Y, FEAT_Z).addScaledVector(nmjN, FIBER_R + 0.23);
  const axon = curve([
    [-4.6, 4.6, 3.4],
    [-4.0, 3.5, 2.8],
    [-3.3, 2.5, 2.1],
    [NMJ_X - 0.2, 1.7, 1.5],
    [axonEnd.x, axonEnd.y, axonEnd.z],
  ]);
  const boutonSpec: [number, number][] = [
    [-0.22, -0.1],
    [0.2, -0.12],
    [-0.05, 0.22],
    [0.22, 0.15],
    [-0.25, 0.2],
  ];
  const boutons: CellSpec[] = [];
  const receptors: Vector3[] = [];
  const branches = [axon];
  for (const [dx, dth] of boutonSpec) {
    const n = normalAt(Math.PI / 4 + dth);
    const axis = new Vector3(NMJ_X + dx, FEAT_Y, FEAT_Z);
    const b = axis.clone().addScaledVector(n, FIBER_R + 0.1);
    boutons.push({ p: b, s: new Vector3(0.1, 0.065, 0.1), q: surfaceQuat(n) });
    receptors.push(axis.clone().addScaledVector(n, FIBER_R + 0.005));
    const mid = axonEnd.clone().add(b).multiplyScalar(0.5).addScaledVector(n, 0.05);
    branches.push(curve([[axonEnd.x, axonEnd.y, axonEnd.z], [mid.x, mid.y, mid.z], [b.x, b.y, b.z]]));
  }
  const myelin: CellSpec[] = [0.1, 0.3, 0.5, 0.68].map((u) => ({ p: axon.getPointAt(u), s: 1, q: new Quaternion().setFromUnitVectors(UP, axon.getTangentAt(u)) }));
  const plate = { p: new Vector3(NMJ_X, FEAT_Y, FEAT_Z).addScaledVector(nmjN, FIBER_R + 0.004), q: surfaceQuat(nmjN) };
  const ach = Array.from({ length: ACH_N }, (_, i) => {
    const b = i % boutons.length;
    const tgt = receptors[b]!.clone().add(new Vector3((r() - 0.5) * 0.14, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06));
    return { from: boutons[b]!.p.clone(), to: tgt, delay: r() * 0.1 };
  });

  // Potasyum: lifler arasındaki hücre dışı sıvıda
  const k: { p: Vector3; ph: number }[] = [];
  for (let guard = 0; k.length < K_MAX && guard < 30000; guard++) {
    const p = new Vector3(-5.8 + r() * 7.2, -1.3 + r() * 4.5, -3.0 + r() * 4.5);
    if (allFibers.some((f) => p.x > f.x0 - 0.1 && p.x < f.x1 + 0.1 && Math.hypot(p.y - f.y, p.z - f.z) < f.r + 0.06)) continue;
    k.push({ p, ph: r() * Math.PI * 2 });
  }

  // CK sızıntısı: önde görünen birkaç liften dışarı doğru
  const leakFibers = fibers
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f.z - a.f.z || b.f.y - a.f.y)
    .slice(0, 3)
    .map((e) => e.i);
  const leak: Leak[] = Array.from({ length: CK_MAX }, (_, i) => {
    const f = fibers[leakFibers[i % leakFibers.length]!]!;
    return { f: leakFibers[i % leakFibers.length]!, x: f.x0 + 1 + r() * (f.x1 - f.x0 - 1.6), a: 0.35 + r() * 2.2, o: r() };
  });

  return { fibers, fiberCells, nuclei, myofibrils, sleeveA, sleeveB, thin, myosin, heads, ca, mitoMyo, mitoModel, atpHops, ckM, cpHops, axon, branches, boutons, myelin, plate, ach, k, leak };
}

export default function SarcomereScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0b0508', ['#0b0508', 7, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.7, max: 16 }, { position: [-0.5, 3, 16], target: [-0.8, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const mus = useMemo(buildMuscle, []);

  // Kişisel: CK (üst sınırın katı) → sızan CK; kalsiyum ve potasyum → parçacık yoğunluğu
  const nLeak = Math.min(CK_MAX, Math.round(Math.max(0, (params.ck ?? 0.5) - 0.8) * 40));
  const nCa = scaled(120, emphasize(params.ca, 3), CA_MAX);
  const nK = scaled(70, emphasize(params.k, 3), K_MAX);

  const fiberU = useMemo(() => stripeUniforms(FIB_P, 0), []);
  const featU = useMemo(() => stripeUniforms(FIB_P, 0), []);
  const myoU = useMemo(() => stripeUniforms(MYO_P, MYO_ANCHOR), []);
  const fiberGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 28, 1).rotateZ(Math.PI / 2));
  const fiberMat = useDisposable(() => striatedMaterial('#b8454f', fiberU), [fiberU]);
  const featMat = useDisposable(() => striatedMaterial('#c04e58', featU), [featU]);
  const myoMat = useDisposable(() => striatedMaterial('#d27280', myoU), [myoU]);
  const sphere = useDisposable(() => new SphereGeometry(1, 16, 12));
  const nucMat = useDisposable(() => new MeshStandardMaterial({ color: '#5b3fa8', roughness: 0.5, emissive: '#1a0c3a', emissiveIntensity: 0.5 }));
  const sleeveGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 20, 1).rotateZ(Math.PI / 2));
  const sleeveMat = useDisposable(() => new MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.5, depthWrite: false }));
  const lineGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 6, 1, true));
  const lineMat = useDisposable(() => new MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.4, depthWrite: false }));
  const zGeo = useDisposable(() => new CylinderGeometry(0.92, 0.92, 0.05, 40).rotateZ(Math.PI / 2));
  const zMat = useDisposable(() => new MeshStandardMaterial({ color: '#eef0ff', roughness: 0.4, emissive: '#3a3f60', emissiveIntensity: 0.5, transparent: true, opacity: 0.55, depthWrite: false }));
  const mGeo = useDisposable(() => new CylinderGeometry(0.62, 0.62, 0.035, 32).rotateZ(Math.PI / 2));
  const mMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffc0d4', transparent: true, opacity: 0.45, depthWrite: false }));
  const myosinGeo = useDisposable(() => new CylinderGeometry(0.075, 0.075, 1, 12).rotateZ(Math.PI / 2));
  const myosinMat = useDisposable(() => new MeshStandardMaterial({ color: '#d8506e', roughness: 0.45, emissive: '#3a0818', emissiveIntensity: 0.5 }));
  const headGeo = useDisposable(() => new CapsuleGeometry(0.03, 0.06, 3, 6));
  const headMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.4, emissive: '#4a1028', emissiveIntensity: 0.5 }));
  const actinGeo = useDisposable(actinGeometry);
  const actinMat = useDisposable(() => new MeshStandardMaterial({ color: '#6fb6ff', roughness: 0.4, emissive: '#10306a', emissiveIntensity: 0.6 }));
  const ionGeo = useDisposable(() => new SphereGeometry(1, 10, 8));
  const caMat = useDisposable(() => new MeshBasicMaterial({ color: '#c6ff5c' }));
  const kMat = useDisposable(() => new MeshStandardMaterial({ color: '#a58cff', roughness: 0.4, emissive: '#3e2a8a', emissiveIntensity: 0.9 }));
  const achMat = useDisposable(() => new MeshStandardMaterial({ color: '#7af0ff', emissive: '#1a7a8a', emissiveIntensity: 1.1 }));
  const atpMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe45a', emissive: '#8a6a00', emissiveIntensity: 1 }));
  const cpMat = useDisposable(() => new MeshStandardMaterial({ color: '#e6d6ff', emissive: '#5a4a8a', emissiveIntensity: 0.9 }));
  const ckGeo = useDisposable(() => new IcosahedronGeometry(1, 0));
  const ckMat = useDisposable(() => new MeshStandardMaterial({ color: '#4ff0c0', roughness: 0.4, emissive: '#0e6a50', emissiveIntensity: 1 }));
  const mitoGeo = useDisposable(() => new CapsuleGeometry(0.09, 0.3, 4, 10).rotateZ(Math.PI / 2));
  const mitoMat = useDisposable(() => new MeshStandardMaterial({ color: '#e58a3a', roughness: 0.45, emissive: '#5a2800', emissiveIntensity: 0.35 }));
  const axonMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0c870', roughness: 0.45, emissive: '#4a3408', emissiveIntensity: 0.5 }));
  const myelinGeo = useDisposable(() => new CapsuleGeometry(0.13, 0.34, 4, 12));
  const myelinMat = useDisposable(() => new MeshStandardMaterial({ color: '#f4efe6', roughness: 0.5, transparent: true, opacity: 0.85 }));
  const boutonMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffd27a', roughness: 0.4, emissive: '#6a4a10', emissiveIntensity: 0.6 }));
  const plateMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffcf7a', roughness: 0.5, transparent: true, opacity: 0.6, depthWrite: false }));
  const impulseMat = useDisposable(() => new MeshBasicMaterial({ color: '#fff6b0' }));

  const featRef = useRef<Mesh>(null);
  const sleeveRef = useRef<Mesh>(null);
  const lineARef = useRef<Mesh>(null);
  const lineBRef = useRef<Mesh>(null);
  const zLRef = useRef<Mesh>(null);
  const zRRef = useRef<Mesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const actinRef = useRef<InstancedMesh>(null);
  const caRef = useRef<InstancedMesh>(null);
  const kRef = useRef<InstancedMesh>(null);
  const achRef = useRef<InstancedMesh>(null);
  const leakRef = useRef<InstancedMesh>(null);
  const impulseRef = useRef<Mesh>(null);

  const apGain = useEased(stage === 2 ? 1.7 : 0.9, 1.5);
  const achBoost = useEased(stage === 2 ? 1.6 : 1, 1.5);
  const caBoost = useEased(stage === 3 ? 1.5 : 1, 1.5);
  const energy = useEased(stage === 5 ? 1 : 0, 1.2);

  useFrame(() => {
    const t = time.current;
    const ph = (t % TWITCH) / TWITCH;
    const c = contraction(ph);
    const squeeze = 1 - SHORTEN * c;
    const zh = Z_REST * squeeze;

    // Lif boyunca elektrik dalgası (sinir-kas kavşağından iki yöne)
    featU.uApX.value = NMJ_X;
    featU.uApFront.value = Math.max(0, (ph - 0.17) / 0.2) * 9;
    featU.uApAmp.value = ph > 0.17 && ph < 0.4 ? (1 - sstep(0.33, 0.4, ph)) * apGain.current : 0;
    myoU.uSqueeze.value = squeeze;
    mitoMat.emissiveIntensity = 0.35 + 1.3 * energy.current;

    // Miyofibril üzerindeki vurgulu sarkomer ve büyütmeye giden çizgiler
    const a = mus.sleeveA;
    P2.copy(a).lerp(mus.sleeveB, squeeze);
    const sl = sleeveRef.current;
    if (sl) {
      sl.position.copy(a).add(P2).multiplyScalar(0.5);
      sl.quaternion.setFromUnitVectors(XAX, P.subVectors(P2, a).normalize());
      sl.scale.set(a.distanceTo(P2), 0.088, 0.088);
    }
    const placeLine = (m: Mesh | null, from: Vector3, to: Vector3) => {
      if (!m) return;
      m.position.copy(from).add(to).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, P.subVectors(to, from).normalize());
      m.scale.set(0.008, from.distanceTo(to), 0.008);
    };
    placeLine(lineARef.current, a, new Vector3(SC.x - zh, SC.y + 0.92, SC.z));
    placeLine(lineBRef.current, P2, new Vector3(SC.x + zh, SC.y + 0.92, SC.z));

    // Z çizgileri ve aktin: miyozine doğru kayar (iplikler kısalmaz)
    zLRef.current?.position.set(SC.x - zh, SC.y, SC.z);
    zRRef.current?.position.set(SC.x + zh, SC.y, SC.z);
    const am = actinRef.current;
    if (am) {
      mus.thin.forEach((tp, i) => {
        P.set(SC.x - zh, SC.y + tp.x, SC.z + tp.y);
        S.set(ACTIN_LEN, 1, 1);
        M.compose(P, Q.identity(), S);
        am.setMatrixAt(i * 2, M);
        P.set(SC.x + zh, SC.y + tp.x, SC.z + tp.y);
        M.compose(P, ROT_Y, S);
        am.setMatrixAt(i * 2 + 1, M);
      });
      am.instanceMatrix.needsUpdate = true;
      am.boundingSphere = null;
    }

    // Miyozin başları: kalsiyum varken tutun–eğil–bırak döngüsü (güç vuruşu)
    const hm = headRef.current;
    if (hm) {
      const active = c > 0.03;
      mus.heads.forEach((h, i) => {
        let phi = -0.7;
        let pull = 0;
        if (active) {
          const f = (t * 2.2 + h.ph) % 1;
          if (f < 0.3) {
            phi = -0.7 + 1.05 * sstep(0, 0.3, f);
            pull = 1;
          } else phi = 0.35 - 1.05 * sstep(0.3, 1, f);
        }
        P.copy(h.radial).multiplyScalar(Math.cos(phi)).addScaledVector(XAX, h.toM * Math.sin(phi));
        Q.setFromUnitVectors(UP, P);
        P2.copy(h.base).addScaledVector(P, 0.05);
        M.compose(P2, Q, S.set(1, 1, 1));
        hm.setMatrixAt(i, M);
        hm.setColorAt(i, C.copy(HEAD_REST).lerp(HEAD_PULL, pull * c));
      });
      hm.instanceMatrix.needsUpdate = true;
      if (hm.instanceColor) hm.instanceColor.needsUpdate = true;
      hm.boundingSphere = null;
    }

    // Kalsiyum: depodan salınır, aktine bağlanır, gevşemede geri pompalanır
    const cm = caRef.current;
    if (cm) {
      cm.count = nCa;
      const boost = caBoost.current;
      for (let i = 0; i < nCa; i++) {
        const d = mus.ca[i]!;
        const q = ph - d.delay;
        let size = 0;
        if (d.myo) {
          const vis = sstep(0.28, 0.36, q) * (1 - sstep(0.66, 0.84, q));
          if (vis > 0.02) {
            P.copy(d.src).addScalar(0.02 * Math.sin(t * 3 + i));
            size = 0.028 * vis;
          }
        } else if (q > 0.28 && q < 0.9) {
          const tp = mus.thin[d.thin]!;
          P2.set(SC.x + d.side * (zh - d.v * ACTIN_LEN), SC.y + tp.x, SC.z + tp.y).add(d.off);
          if (q < 0.4) P.copy(d.src).lerp(P2, sstep(0.28, 0.4, q));
          else if (q < 0.7) P.copy(P2);
          else P.copy(P2).lerp(d.src, sstep(0.7, 0.9, q));
          size = 0.032 * (q > 0.7 ? 1 - 0.7 * sstep(0.7, 0.9, q) : 1);
        }
        if (size <= 0) {
          cm.setMatrixAt(i, HIDE);
          continue;
        }
        M.compose(P, Q.identity(), S.setScalar(size * boost));
        cm.setMatrixAt(i, M);
      }
      cm.instanceMatrix.needsUpdate = true;
      cm.boundingSphere = null;
    }

    // Sinir uyarısı aksondan iner, uç düğmelerden asetilkolin salınır
    const im = impulseRef.current;
    if (im) {
      im.visible = ph < 0.1;
      if (im.visible) mus.axon.getPointAt(sstep(0, 0.1, ph), im.position);
    }
    const achm = achRef.current;
    if (achm) {
      const boost = achBoost.current;
      mus.ach.forEach((d, i) => {
        const q = (ph - 0.08 - d.delay) / 0.16;
        if (q < 0 || q >= 1) {
          achm.setMatrixAt(i, HIDE);
          return;
        }
        P.copy(d.from).lerp(d.to, sstep(0, 1, q));
        M.compose(P, Q.identity(), S.setScalar(0.024 * boost * (1 - sstep(0.8, 1, q))));
        achm.setMatrixAt(i, M);
      });
      achm.instanceMatrix.needsUpdate = true;
      achm.boundingSphere = null;
    }

    // Potasyum (hücre dışı)
    const km = kRef.current;
    if (km) {
      km.count = nK;
      for (let i = 0; i < nK; i++) {
        const d = mus.k[i]!;
        P.set(d.p.x + 0.05 * Math.sin(t * 0.8 + d.ph * 3), d.p.y + 0.06 * Math.sin(t * 0.9 + d.ph), d.p.z + 0.06 * Math.cos(t * 0.7 + d.ph * 1.3));
        M.compose(P, Q.identity(), S.setScalar(0.034));
        km.setMatrixAt(i, M);
      }
      km.instanceMatrix.needsUpdate = true;
      km.boundingSphere = null;
    }

    // CK sızıntısı: liften çevre sıvıya doğru uzaklaşır ve söner
    const lm = leakRef.current;
    if (lm) {
      lm.count = nLeak;
      for (let i = 0; i < nLeak; i++) {
        const d = mus.leak[i]!;
        const f = mus.fibers[d.f]!;
        const life = (t / 4.5 + d.o) % 1;
        const dist = f.r + 0.03 + life * 1.5;
        P.set(d.x + 0.2 * Math.sin(life * 6 + d.o * 9), f.y + Math.cos(d.a) * dist + life * 0.3, f.z + Math.sin(d.a) * dist);
        Q.setFromAxisAngle(UP, t + i);
        M.compose(P, Q, S.setScalar(0.05 * sstep(0, 0.08, life) * (1 - sstep(0.75, 1, life))));
        lm.setMatrixAt(i, M);
      }
      lm.instanceMatrix.needsUpdate = true;
      lm.boundingSphere = null;
    }
  });

  const featLen = FEAT_END - FIB_X0;
  return (
    <group>
      <ambientLight intensity={0.35} color="#ffe0e4" />
      <directionalLight position={[3, 6, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />
      {/* Fasikül ve öndeki lif */}
      <Cells cells={mus.fiberCells} geometry={fiberGeo} material={fiberMat} onClick={pick('fiber')} />
      <mesh
        ref={featRef}
        geometry={fiberGeo}
        material={featMat}
        position={[FIB_X0 + featLen / 2, FEAT_Y, FEAT_Z]}
        scale={[featLen, FIBER_R, FIBER_R]}
        onClick={pick('fiber')}
      />
      <Cells cells={mus.nuclei} geometry={sphere} material={nucMat} onClick={pick('nucleus')} />
      <Tubes curves={mus.myofibrils} radius={0.062} material={myoMat} onClick={pick('myofibril')} segments={40} radial={8} />
      <mesh ref={sleeveRef} geometry={sleeveGeo} material={sleeveMat} onClick={pick('sarcomere')} renderOrder={2} />
      <mesh ref={lineARef} geometry={lineGeo} material={lineMat} raycast={() => null} />
      <mesh ref={lineBRef} geometry={lineGeo} material={lineMat} raycast={() => null} />
      <Cells cells={mus.mitoMyo} geometry={mitoGeo} material={mitoMat} onClick={pick('mitochondrion')} />
      {/* Büyütülmüş sarkomer */}
      <mesh ref={zLRef} geometry={zGeo} material={zMat} onClick={pick('zline')} renderOrder={2} />
      <mesh ref={zRRef} geometry={zGeo} material={zMat} onClick={pick('zline')} renderOrder={2} />
      <mesh geometry={mGeo} material={mMat} position={SC} onClick={pick('myosin')} renderOrder={2} />
      <Cells cells={mus.myosin} geometry={myosinGeo} material={myosinMat} onClick={pick('myosin')} />
      <instancedMesh ref={headRef} args={[headGeo, headMat, mus.heads.length]} onClick={pick('myosin')} frustumCulled={false} />
      <instancedMesh ref={actinRef} args={[actinGeo, actinMat, mus.thin.length * 2]} onClick={pick('actin')} frustumCulled={false} />
      <instancedMesh ref={caRef} args={[ionGeo, caMat, CA_MAX]} onClick={pick('calcium')} frustumCulled={false} />
      <Cells cells={mus.mitoModel} geometry={mitoGeo} material={mitoMat} onClick={pick('mitochondrion')} />
      <Hoppers hops={mus.atpHops} count={80} shown={stage === 5 ? 70 : 30} geometry={ionGeo} material={atpMat} time={time} duration={2} size={0.03} seed={19} active={stage >= 4} onClick={pick('atp')} />
      <Hoppers hops={mus.cpHops} count={30} geometry={ionGeo} material={cpMat} time={time} duration={2.6} size={0.028} seed={23} active={stage === 5} onClick={pick('atp')} />
      <Cells
        cells={mus.ckM}
        geometry={ckGeo}
        material={ckMat}
        onClick={pick('ck')}
        visible={stage === 5}
        time={time}
        animate={(i, tt) => ({ scale: 1 + 0.15 * Math.sin(tt * 4 + i) })}
      />
      {/* Sinir-kas kavşağı */}
      <Tubes curves={mus.branches} radius={0.05} material={axonMat} onClick={pick('neuron')} segments={48} radial={8} />
      <Cells cells={mus.myelin} geometry={myelinGeo} material={myelinMat} onClick={pick('neuron')} />
      <Cells cells={mus.boutons} geometry={sphere} material={boutonMat} onClick={pick('neuron')} />
      <mesh geometry={sphere} material={plateMat} position={mus.plate.p} quaternion={mus.plate.q} scale={[0.45, 0.02, 0.3]} onClick={pick('neuron')} />
      <mesh ref={impulseRef} geometry={sphere} material={impulseMat} scale={0.07} raycast={() => null} />
      <instancedMesh ref={achRef} args={[ionGeo, achMat, ACH_N]} onClick={pick('acetylcholine')} frustumCulled={false} />
      {/* Kişisel: hücre dışı potasyum ve liflerden sızan CK */}
      <instancedMesh ref={kRef} args={[ionGeo, kMat, K_MAX]} onClick={pick('potassium')} frustumCulled={false} />
      <instancedMesh ref={leakRef} args={[ckGeo, ckMat, CK_MAX]} onClick={pick('ck')} frustumCulled={false} />
    </group>
  );
}
