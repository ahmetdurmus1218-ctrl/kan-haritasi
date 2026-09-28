import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  type Curve,
  CylinderGeometry,
  DoubleSide,
  type Group,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, bumpySphere, rng, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, Tubes, curve, makePick } from '../micro';

/**
 * İç kulak (temsili). Solda dış kulak yolu, kulak zarı ve üç kemikçik (çekiç, örs, üzengi); üzengi
 * oval pencereyi iter. Koklea anlaşılır olsun diye büyük ölçüde açılmış (düz) çizilir, yalnızca
 * tepesi kıvrılır. İçindeki baziler zar boyunca ilerleyen dalga, sesin frekansına göre farklı yerde
 * en yükseğe çıkar (tabanda tiz, tepede pes). Zarın üstündeki iç ve dış tüy hücrelerinin kirpikleri
 * dalgayla eğilir; iç tüy hücrelerinden çıkan işitme siniri lifleri sinyali taşır. Arkada denge
 * organları: üç yarım daire kanalı ve otolit kristalli utrikül/sakkül. Ölçekler ve genlikler temsilidir.
 */

const UP = new Vector3(0, 1, 0);
const M = new Matrix4();
const Q = new Quaternion();
const Q2 = new Quaternion();
const Q0 = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const C = new Color();
const HIDE = new Matrix4().makeScale(0, 0, 0);
const X_AXIS = new Vector3(1, 0, 0);

function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Eğri boyunca değişken yarıçaplı tüp. Konum + normal, indeksli. */
function sweep(c: Curve<Vector3>, radiusAt: (s: number) => number, segments = 32, radial = 10): BufferGeometry {
  const pts: Vector3[] = [];
  const tan: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    pts.push(c.getPointAt(i / segments));
    tan.push(c.getTangentAt(i / segments).normalize());
  }
  const len = Math.max(1e-4, c.getLength());
  const t0 = tan[0]!;
  const nor: Vector3[] = [new Vector3().crossVectors(t0, Math.abs(t0.y) < 0.9 ? UP : X_AXIS).normalize()];
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
    bi.crossVectors(t, nor[i]!);
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      dir.copy(nor[i]!).multiplyScalar(Math.cos(ang)).addScaledVector(bi, Math.sin(ang));
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

function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/* ------------------------------------------------------------ koklea ekseni */

/** Tabandan (oval pencere) tepeye: önce düz, sonra 3/4 tur kıvrılan eksen. */
const CENTER = (() => {
  const pts: [number, number, number][] = [
    [-2.4, 0, 0],
    [-1.4, 0, 0],
    [-0.4, 0, 0],
    [0.6, 0, 0],
    [1.6, 0, 0],
  ];
  const end = Math.PI * 1.5;
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * end;
    const R = 1.2 - 0.45 * (a / end);
    pts.push([1.6 + R * Math.sin(a), 0.25 * (a / end), -1.2 + R * Math.cos(a)]);
  }
  return curve(pts);
})();

interface Frame {
  p: Vector3;
  t: Vector3;
  u: Vector3;
  s: Vector3;
  q: Quaternion;
}

function frameAt(u: number): Frame {
  const p = CENTER.getPointAt(u);
  const t = CENTER.getTangentAt(u).normalize();
  const s = new Vector3().crossVectors(t, UP).normalize();
  const up = new Vector3().crossVectors(s, t).normalize();
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(t, up, s));
  return { p, t, u: up, s, q };
}

/** Baziler zar genişliği: tabanda dar ve sert, tepede geniş ve esnek. */
const width = (u: number) => 0.3 + 0.48 * u;
const ductRadius = (u: number) => 0.62 - 0.16 * u;

/** Dalga zarfı: tepe noktasına (uP) doğru büyür, sonra hızla söner. */
function envelope(u: number, uP: number): number {
  if (u <= uP) {
    const x = (uP - u) / Math.max(0.12, uP * 0.9);
    return 0.12 + 0.88 * Math.exp(-x * x * 2.2);
  }
  const x = (u - uP) / 0.045;
  return Math.exp(-x * x);
}

/** Yerel faz: dalga boyu tepe noktasına yaklaştıkça kısalır (dalga yavaşlar). */
function phaseAt(u: number, uP: number): number {
  const l0 = 0.28;
  const lm = 0.035;
  const at = (x: number) => -2 * Math.PI * (uP / l0) * Math.log((l0 * (uP - x)) / uP + lm) + 2 * Math.PI * (uP / l0) * Math.log(l0 + lm);
  if (u <= uP) return at(u);
  return at(uP) + (2 * Math.PI * (u - uP)) / lm;
}

/** Ton: tepe noktası (u) ve görsel titreşim hızı. */
const TONES = [
  { uP: 0.12, w: 12 },
  { uP: 0.45, w: 7 },
  { uP: 0.82, w: 3.6 },
];

const NSEG = 150;
const NHC = 60;
const NF = 30;
const SLOTS = 2;
const N_RING = 6;
const N_ENDO = 20;
const AMP = 0.1;
const SPIKE_T = 1.6;

const V0 = new Vector3(-2.95, 1.45, -1.1);
const TRUNK = curve([
  [1.45, -0.35, -1.2],
  [0.4, -0.35, -1.12],
  [-0.8, -0.35, -1.08],
  [-2.0, -0.4, -1.12],
  [-2.9, -0.5, -1.4],
  [-3.6, -0.7, -2.0],
  [-4.4, -0.9, -2.8],
]);
const CANAL = curve([
  [-6.5, 0.58, 0.62],
  [-5.5, 0.5, 0.52],
  [-4.5, 0.45, 0.45],
]);
const PIVOT = new Vector3(-3.6, 0.95, 0.35);

const C3 = CENTER.getPointAt(0.3);
const SHOTS = [
  { position: [-1.6, 3.0, 8.2], target: [-1.4, 0.2, -0.5] },
  { position: [-2.0, 1.1, 1.7], target: [-0.6, -0.05, -0.1] },
  { position: [0.2, 4.6, 4.2], target: [0.3, 0, -0.6] },
  { position: [C3.x + 0.25, C3.y + 0.42, C3.z + 0.62], target: [C3.x, C3.y + 0.06, C3.z - 0.02] },
  { position: [0.6, 2.2, 1.8], target: [0.0, -0.25, -0.8] },
  { position: [V0.x + 1.3, V0.y + 0.9, V0.z + 2.2], target: [V0.x, V0.y + 0.35, V0.z] },
] as const;

const BM_BASE = new Color('#e9d9b8');
const IHC_BASE = new Color('#ffb68a');
const OHC_BASE = new Color('#f59ab8');
const LIT = new Color('#fff6d0');
const GRAD = new Color();

export default function CochleaScene({ state, onSelect, reducedMotion }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#050709', ['#050709', 7, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.4, max: 15 }, { position: [-1, 3.5, 13], target: [-1.2, 0.2, -0.5] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);

  const mapE = useEased(stage === 2 ? 1 : 0, 1.4);
  const rotE = useEased(stage === 5 ? 1 : 0, 1.0);
  const wave = useRef({ phase: 0, last: 0, uP: 0.45, w: 7 });
  const spikes = useRef({ start: new Float32Array(NF * SLOTS).fill(-99), prev: new Float32Array(NF) });

  const skinMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#e8b49a', roughness: 0.5, transparent: true, opacity: 0.2, depthWrite: false, side: DoubleSide }),
  );
  const drumMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#f2c9b8', roughness: 0.35, transparent: true, opacity: 0.75, side: DoubleSide, sheen: 1, sheenColor: '#ffffff', emissive: '#3a1a10', emissiveIntensity: 0.3 }),
  );
  const boneMat = useDisposable(() => new MeshStandardMaterial({ color: '#efe4cc', roughness: 0.6, emissive: '#2a2414', emissiveIntensity: 0.3 }));
  const windowMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffd28a', roughness: 0.4, side: DoubleSide, emissive: '#5a3a00', emissiveIntensity: 0.6 }));
  const ductMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#7fb5ff', roughness: 0.3, transparent: true, opacity: 0.16, depthWrite: false, side: DoubleSide, sheen: 1, sheenColor: '#cfe4ff' }),
  );
  const box = useDisposable(() => new BoxGeometry(1, 1, 1));
  const bmMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#1a1408', emissiveIntensity: 0.4 }));
  const tmMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#d8f0ff', roughness: 0.3, transparent: true, opacity: 0.28, depthWrite: false, emissive: '#10283a', emissiveIntensity: 0.4 }),
  );
  const cellGeo = useDisposable(() => new CapsuleGeometry(0.03, 0.08, 4, 10));
  const hcMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#2a0c10', emissiveIntensity: 0.4 }));
  const cilMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff0c0', roughness: 0.35, emissive: '#5a4a10', emissiveIntensity: 0.7 }));
  const nerveMat = useDisposable(() => new MeshStandardMaterial({ color: '#f2d27a', roughness: 0.5, emissive: '#3a2a00', emissiveIntensity: 0.45 }));
  const trunkMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#f2d27a', roughness: 0.4, transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide, emissive: '#3a2a00', emissiveIntensity: 0.3 }),
  );
  const ganglionGeo = useDisposable(() => bumpySphere(1, 0.1, 5));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const glowMat = useDisposable(
    () => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  const ringGeo = useDisposable(() => new TorusGeometry(0.4, 0.02, 8, 40).rotateY(Math.PI / 2));
  const ringMat = useDisposable(() => new MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
  const vestMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#b9e4ff', roughness: 0.3, transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide, sheen: 1, sheenColor: '#ffffff' }),
  );
  const endoMat = useDisposable(() => new MeshStandardMaterial({ color: '#8fdcff', emissive: '#1a6a9a', emissiveIntensity: 1 }));
  const otoGeo = useDisposable(() => new OctahedronGeometry(1, 0));
  const otoMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.1, emissive: '#3a4a5a', emissiveIntensity: 0.5 }));

  // Kirpik demetleri: kademeli boylu ince çubuklar (iç tüy hücresinde düz sıra, dışta V biçimi)
  const bundles = useDisposable(() => {
    const make = (vee: boolean) => {
      const parts: BufferGeometry[] = [];
      for (let row = 0; row < 3; row++) {
        const hgt = 0.03 + row * 0.016;
        for (let k = -4; k <= 4; k++) {
          const x = k * 0.008;
          const z = (vee ? -Math.abs(x) * 0.9 : 0) + (row - 1) * 0.008;
          parts.push(new CylinderGeometry(0.0045, 0.0045, hgt, 5).translate(x, hgt / 2, z));
        }
      }
      return mergeAll(parts);
    };
    const ihc = make(false);
    const ohc = make(true);
    return { ihc, ohc, dispose: () => [ihc, ohc].forEach((g) => g.dispose()) };
  });

  const ear = useDisposable(() => {
    // Kulak zarı: içe (kemikçiklere) doğru hafif koni
    const drum = new ConeGeometry(0.5, 0.14, 36, 1, true).rotateZ(-Math.PI / 2);
    // Çekiç + örs birlikte döner (menteşe PIVOT); üzengi piston gibi ileri geri gider
    const at = (x: number, y: number, z: number) => new Vector3(x, y, z).sub(PIVOT);
    const loc = (x: number, y: number, z: number): [number, number, number] => [x - PIVOT.x, y - PIVOT.y, z - PIVOT.z];
    const ball = (p: Vector3, r: number, seed: number) => {
      const g = bumpySphere(1, 0.08, seed);
      g.scale(r, r, r);
      g.translate(p.x, p.y, p.z);
      return g;
    };
    const mi = mergeAll([
      ball(at(-3.78, 1.02, 0.4), 0.14, 2),
      sweep(curve([loc(-3.78, 1.0, 0.4), loc(-4.1, 0.72, 0.44), loc(-4.36, 0.45, 0.45)]), (s) => 0.055 - 0.03 * s, 20, 8),
      ball(at(-3.5, 0.96, 0.3), 0.13, 3),
      sweep(curve([[0.1, 0.0, -0.05], [0.4, -0.3, -0.15], [0.55, -0.6, -0.23]]), (s) => 0.045 - 0.015 * s, 20, 8),
      sweep(curve([[0.1, 0.05, -0.05], [0.3, 0.2, -0.2], [0.42, 0.26, -0.28]]), (s) => 0.045 * (1 - 0.7 * s), 12, 8),
    ]);
    const stapes = mergeAll([
      ball(new Vector3(-3.0, 0.33, 0.12), 0.045, 4),
      sweep(curve([[-3.0, 0.33, 0.12], [-2.75, 0.34, 0.24], [-2.5, 0.29, 0.14]]), () => 0.018, 16, 6),
      sweep(curve([[-3.0, 0.33, 0.12], [-2.75, 0.32, -0.04], [-2.5, 0.27, -0.1]]), () => 0.018, 16, 6),
      (() => {
        const g = bumpySphere(1, 0.03, 6);
        g.scale(0.025, 0.1, 0.15);
        g.translate(-2.48, 0.28, 0.02);
        return g;
      })(),
    ]);
    const duct = mergeAll([
      sweep(CENTER, (s) => ductRadius(s) * (s > 0.97 ? Math.sqrt(Math.max(0, 1 - ((s - 0.97) / 0.03) ** 2)) : 1), 220, 20),
      new CircleGeometry(ductRadius(0), 32).deleteAttribute('uv').rotateY(-Math.PI / 2).translate(-2.4, 0, 0),
    ]);
    const window = new CircleGeometry(0.13, 24).rotateY(-Math.PI / 2);
    const geos = { drum, mi, stapes, duct, window };
    return { ...geos, dispose: () => Object.values(geos).forEach((g) => g.dispose()) };
  });

  // Denge organları (V0'a göre yerel): kanallar + ampullalar, utrikül + sakkül
  const vest = useDisposable(() => {
    const canals = [
      new Matrix4().makeTranslation(-0.55, 0.1, 0).multiply(new Matrix4().makeRotationX(Math.PI / 2)),
      new Matrix4().makeTranslation(0.1, 0.72, 0.25).multiply(new Matrix4().makeRotationY(Math.PI / 4)),
      new Matrix4().makeTranslation(0.15, 0.7, -0.35).multiply(new Matrix4().makeRotationY(-Math.PI / 4)),
    ];
    const tube = mergeAll(
      canals.flatMap((m) => [new TorusGeometry(0.6, 0.06, 10, 56).applyMatrix4(m), new SphereGeometry(0.11, 16, 12).translate(0.6, 0, 0).applyMatrix4(m)]),
    );
    const sacs = mergeAll([new SphereGeometry(1, 24, 16).scale(0.32, 0.22, 0.26), new SphereGeometry(1, 24, 16).scale(0.22, 0.24, 0.2).translate(0.15, -0.42, 0.25)]);
    const geos = { tube, sacs };
    return { ...geos, canals, dispose: () => Object.values(geos).forEach((g) => g.dispose()) };
  });

  const geo = useMemo(() => {
    const r = rng(83);
    const seg = Array.from({ length: NSEG }, (_, i) => ({ u: (i + 0.5) / NSEG, f: frameAt((i + 0.5) / NSEG) }));
    const hc = Array.from({ length: NHC }, (_, i) => ({ u: (i + 0.5) / NHC, f: frameAt((i + 0.5) / NHC) }));
    // İşitme siniri lifleri: iç tüy hücresinden spiral gangliyona, oradan sinir gövdesine
    const trunkU = Array.from({ length: 80 }, (_, i) => i / 79);
    const trunkP = trunkU.map((u) => TRUNK.getPointAt(u));
    const fibers: Curve<Vector3>[] = [];
    const paths: Curve<Vector3>[] = [];
    const ganglia: CellSpec[] = [];
    const fiberU: number[] = [];
    for (let k = 0; k < NF; k++) {
      const h = hc[k * 2]!;
      const { p, s, u } = h.f;
      const w = width(h.u);
      const p0 = p.clone().addScaledVector(s, -0.3 * w).addScaledVector(u, -0.02);
      const p1 = p.clone().addScaledVector(s, -(0.5 * w + 0.18)).addScaledVector(u, -0.08);
      const p2 = p.clone().addScaledVector(s, -0.95).addScaledVector(u, -0.12);
      let best = 0;
      trunkP.forEach((q, i) => {
        if (q.distanceTo(p2) < trunkP[best]!.distanceTo(p2)) best = i;
      });
      const p3 = trunkP[best]!;
      const pts = [p0, p1, p2, p3].map((v) => [v.x, v.y, v.z] as [number, number, number]);
      fibers.push(curve(pts));
      const tail: [number, number, number][] = [];
      for (let i = best + 6; i < trunkP.length; i += 8) tail.push([trunkP[i]!.x, trunkP[i]!.y, trunkP[i]!.z]);
      const last = trunkP[trunkP.length - 1]!;
      tail.push([last.x, last.y, last.z]);
      paths.push(curve([...pts, ...tail]));
      ganglia.push({ p: p2, s: 0.06 + r() * 0.015 });
      fiberU.push(h.u);
    }
    // Vestibüler sinir dalı (denge organlarından sinir gövdesine)
    fibers.push(curve([[V0.x + 0.05, V0.y - 0.3, V0.z + 0.05], [V0.x + 0.1, V0.y - 1.1, V0.z - 0.1], [-2.9, -0.5, -1.4]]));
    const fiberR = [...Array.from({ length: NF }, () => 0.012), 0.06];
    // Endolenf parçacıkları: her kanalda halka boyunca
    const endoA = Array.from({ length: 3 * N_ENDO }, (_, i) => ((i % N_ENDO) / N_ENDO) * Math.PI * 2 + r() * 0.2);
    // Otolit kristalleri: utrikülde yatay, sakkülde dikey bir alan
    const oto: CellSpec[] = [];
    for (let i = 0; i < 80; i++) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r());
      const q = new Quaternion().setFromAxisAngle(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), r() * 3);
      if (i < 46) oto.push({ p: new Vector3(Math.cos(a) * rr * 0.2, -0.13 + r() * 0.03, Math.sin(a) * rr * 0.16), s: 0.02 + r() * 0.01, q });
      else oto.push({ p: new Vector3(0.15 + Math.cos(a) * rr * 0.13, -0.42 + Math.sin(a) * rr * 0.14, 0.33 + r() * 0.02), s: 0.018 + r() * 0.01, q });
    }
    return { seg, hc, fibers, fiberR, paths, ganglia, fiberU, endoA, oto };
  }, []);

  const trunk = useMemo(() => [TRUNK], []);
  const canal = useMemo(() => [CANAL], []);

  const bmRef = useRef<InstancedMesh>(null);
  const tmRef = useRef<InstancedMesh>(null);
  const ihcRef = useRef<InstancedMesh>(null);
  const ohcRef = useRef<InstancedMesh>(null);
  const ihcBRef = useRef<InstancedMesh>(null);
  const ohcBRef = useRef<InstancedMesh>(null);
  const ringRef = useRef<InstancedMesh>(null);
  const spikeRef = useRef<InstancedMesh>(null);
  const endoRef = useRef<InstancedMesh>(null);
  const miRef = useRef<Group>(null);
  const stapesRef = useRef<Group>(null);
  const drumRef = useRef<Group>(null);
  const ovalRef = useRef<Group>(null);
  const roundRef = useRef<Group>(null);
  const vestRef = useRef<Group>(null);
  const otoRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const t = time.current;
    const wv = wave.current;
    // Aşamaya göre ton; aşama 2'de tiz → orta → pes sırayla çalar
    const tone = stage === 2 ? TONES[Math.floor(t / 4) % 3]! : stage === 3 ? { uP: 0.3, w: 8 } : TONES[1]!;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 2.2);
    wv.uP += (tone.uP - wv.uP) * k;
    wv.w += (tone.w - wv.w) * k;
    const dt = Math.max(0, Math.min(0.1, t - wv.last));
    wv.last = t;
    wv.phase += wv.w * dt;
    const ph = wv.phase;
    const uP = wv.uP;
    const toneCol = C.setHSL(0.58 - 0.51 * Math.max(0, Math.min(1, (uP - 0.12) / 0.7)), 0.85, 0.62).clone();
    const disp = (u: number) => AMP * envelope(u, uP) * Math.sin(ph - phaseAt(u, uP));

    // Orta kulak: kulak zarı → kemikçikler → oval pencere; yuvarlak pencere ters yönde
    const th = 0.1 * Math.sin(ph);
    if (miRef.current) miRef.current.rotation.z = th;
    if (drumRef.current) drumRef.current.position.x = 0.5 * th;
    if (stapesRef.current) stapesRef.current.position.x = 0.6 * th;
    if (ovalRef.current) ovalRef.current.position.x = 0.6 * th;
    if (roundRef.current) roundRef.current.position.x = -0.6 * th;
    const rings = ringRef.current;
    if (rings) {
      for (let i = 0; i < N_RING; i++) {
        const f = (ph / (Math.PI * 2) + i / N_RING) % 1;
        CANAL.getPointAt(f, P);
        const sc = Math.sin(Math.PI * f) * (0.8 + 0.2 * f);
        M.compose(P, Q0, S.setScalar(Math.max(0.0001, sc)));
        rings.setMatrixAt(i, M);
      }
      rings.instanceMatrix.needsUpdate = true;
    }

    // Baziler zar ve tektoryal zar
    const bm = bmRef.current;
    const tm = tmRef.current;
    const ds = (CENTER.getLength() / NSEG) * 1.06;
    for (let i = 0; i < NSEG; i++) {
      const { u, f } = geo.seg[i]!;
      const d = disp(u);
      const w = width(u);
      if (bm) {
        P.copy(f.p).addScaledVector(f.u, d);
        M.compose(P, f.q, S.set(ds, 0.025, w));
        bm.setMatrixAt(i, M);
        C.copy(BM_BASE).lerp(toneCol, Math.min(1, Math.abs(d) / AMP) * 0.8);
        if (mapE.current > 0.01) C.lerp(GRAD.setHSL(0.58 - 0.51 * u, 0.8, 0.6), mapE.current * 0.55);
        bm.setColorAt(i, C);
      }
      if (tm) {
        P.copy(f.p).addScaledVector(f.u, d * 0.9 + 0.22).addScaledVector(f.s, -0.02 * w);
        M.compose(P, f.q, S.set(ds, 0.018, 0.75 * w));
        tm.setMatrixAt(i, M);
      }
    }
    if (bm) {
      bm.instanceMatrix.needsUpdate = true;
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    }
    if (tm) tm.instanceMatrix.needsUpdate = true;

    // Tüy hücreleri: zarla birlikte hareket eder, kirpikler eğilir; dış tüy hücreleri boy değiştirir
    const ihc = ihcRef.current;
    const ohc = ohcRef.current;
    const ib = ihcBRef.current;
    const ob = ohcBRef.current;
    for (let j = 0; j < NHC; j++) {
      const { u, f } = geo.hc[j]!;
      const d = disp(u);
      const w = width(u);
      const rel = Math.max(-1, Math.min(1, d / AMP));
      Q2.setFromAxisAngle(X_AXIS, rel * 0.45);
      Q.copy(f.q).multiply(Q2);
      for (let row = 0; row < 4; row++) {
        const s = row === 0 ? -0.3 : -0.02 + (row - 1) * 0.14;
        const len = row === 0 ? 1 : 1 + 0.3 * rel;
        P.copy(f.p).addScaledVector(f.s, s * w).addScaledVector(f.u, d + 0.012 + 0.07 * len);
        M.compose(P, f.q, S.set(1, len, 1));
        if (row === 0 && ihc) {
          ihc.setMatrixAt(j, M);
          ihc.setColorAt(j, C.copy(IHC_BASE).lerp(LIT, Math.max(0, rel) * 0.9));
        } else if (row > 0 && ohc) {
          ohc.setMatrixAt(j * 3 + row - 1, M);
          ohc.setColorAt(j * 3 + row - 1, C.copy(OHC_BASE).lerp(LIT, Math.max(0, rel) * 0.5));
        }
        P.addScaledVector(f.u, 0.055 * len);
        M.compose(P, Q, S.set(1, 1, 1));
        if (row === 0) ib?.setMatrixAt(j, M);
        else ob?.setMatrixAt(j * 3 + row - 1, M);
      }
    }
    for (const mesh of [ihc, ohc, ib, ob]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Sinir sinyalleri: dalganın tepesindeki iç tüy hücreleri, zar yukarı eğildikçe ateşler
    const sp = spikes.current;
    const sm = spikeRef.current;
    for (let fI = 0; fI < NF; fI++) {
      const u = geo.fiberU[fI]!;
      const v = Math.sin(ph - phaseAt(u, uP));
      const env = envelope(u, uP);
      if (sp.prev[fI]! < 0 && v >= 0 && env > 0.35 && hash(fI * 977 + Math.floor(ph * 10), 7) < env * 0.9) {
        for (let s = 0; s < SLOTS; s++) {
          const idx = fI * SLOTS + s;
          if (t - sp.start[idx]! > SPIKE_T || t < sp.start[idx]!) {
            sp.start[idx] = t;
            break;
          }
        }
      }
      sp.prev[fI] = v;
      if (!sm) continue;
      for (let s = 0; s < SLOTS; s++) {
        const idx = fI * SLOTS + s;
        const age = (t - sp.start[idx]!) / SPIKE_T;
        if (age >= 0 && age <= 1) {
          geo.paths[fI]!.getPointAt(age, P);
          M.compose(P, Q0, S.setScalar(0.05));
          sm.setMatrixAt(idx, M);
        } else sm.setMatrixAt(idx, HIDE);
      }
    }
    if (sm) sm.instanceMatrix.needsUpdate = true;

    // Denge organları: baş döner (aşama 5); kanal sıvısı eylemsizlikle geride kalır, otolitler kayar
    const rot = 0.45 * Math.sin(1.1 * t) * rotE.current;
    if (vestRef.current) vestRef.current.rotation.y = rot;
    if (otoRef.current) otoRef.current.position.x = -0.04 * Math.sin(1.1 * t) * rotE.current;
    const em = endoRef.current;
    if (em) {
      for (let c = 0; c < 3; c++) {
        const lag = -rot * (c === 0 ? 0.9 : 0.2);
        for (let i = 0; i < N_ENDO; i++) {
          const a = geo.endoA[c * N_ENDO + i]! + lag;
          P.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0).applyMatrix4(vest.canals[c]!);
          M.compose(P, Q0, S.setScalar(0.03));
          em.setMatrixAt(c * N_ENDO + i, M);
        }
      }
      em.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.38} color="#e6f0ff" />
      <directionalLight position={[2, 6, 5]} intensity={1.1} />
      <Headlight intensity={2.6} distance={15} />
      {/* Dış ve orta kulak */}
      <Tubes curves={canal} radius={0.5} material={skinMat} onClick={pick('soundwave')} segments={30} radial={24} />
      <instancedMesh ref={ringRef} args={[ringGeo, ringMat, N_RING]} onClick={pick('soundwave')} frustumCulled={false} />
      <group ref={drumRef}>
        <mesh geometry={ear.drum} material={drumMat} position={[-4.42, 0.45, 0.45]} onClick={pick('eardrum')} />
      </group>
      <group ref={miRef} position={PIVOT}>
        <mesh geometry={ear.mi} material={boneMat} onClick={pick('ossicles')} />
      </group>
      <group ref={stapesRef}>
        <mesh geometry={ear.stapes} material={boneMat} onClick={pick('ossicles')} />
      </group>
      <group ref={ovalRef}>
        <mesh geometry={ear.window} material={windowMat} position={[-2.41, 0.28, 0.02]} scale={[1, 0.8, 1.15]} onClick={pick('ovalwindow')} />
      </group>
      <group ref={roundRef}>
        <mesh geometry={ear.window} material={windowMat} position={[-2.41, -0.3, 0]} scale={0.85} onClick={pick('ovalwindow')} />
      </group>
      {/* Koklea */}
      <mesh geometry={ear.duct} material={ductMat} onClick={pick('cochlea')} renderOrder={2} />
      <instancedMesh ref={bmRef} args={[box, bmMat, NSEG]} onClick={pick('basilar')} frustumCulled={false} />
      <instancedMesh ref={tmRef} args={[box, tmMat, NSEG]} onClick={pick('tectorial')} frustumCulled={false} />
      <instancedMesh ref={ihcRef} args={[cellGeo, hcMat, NHC]} onClick={pick('haircell')} frustumCulled={false} />
      <instancedMesh ref={ohcRef} args={[cellGeo, hcMat, NHC * 3]} onClick={pick('haircell')} frustumCulled={false} />
      <instancedMesh ref={ihcBRef} args={[bundles.ihc, cilMat, NHC]} onClick={pick('stereocilia')} frustumCulled={false} />
      <instancedMesh ref={ohcBRef} args={[bundles.ohc, cilMat, NHC * 3]} onClick={pick('stereocilia')} frustumCulled={false} />
      {/* İşitme siniri */}
      <Tubes curves={geo.fibers} radius={geo.fiberR} material={nerveMat} onClick={pick('nerve')} segments={24} radial={6} />
      <Cells cells={geo.ganglia} geometry={ganglionGeo} material={nerveMat} onClick={pick('nerve')} />
      <Tubes curves={trunk} radius={0.2} material={trunkMat} onClick={pick('nerve')} segments={80} radial={16} />
      <instancedMesh ref={spikeRef} args={[small, glowMat, NF * SLOTS]} onClick={pick('nerve')} frustumCulled={false} />
      {/* Denge organları */}
      <group ref={vestRef} position={V0}>
        <mesh geometry={vest.tube} material={vestMat} onClick={pick('canals')} />
        <mesh geometry={vest.sacs} material={vestMat} onClick={pick('otolith')} />
        <instancedMesh ref={endoRef} args={[small, endoMat, 3 * N_ENDO]} onClick={pick('canals')} frustumCulled={false} />
        <group ref={otoRef}>
          <Cells cells={geo.oto} geometry={otoGeo} material={otoMat} onClick={pick('otolith')} />
        </group>
      </group>
    </group>
  );
}
