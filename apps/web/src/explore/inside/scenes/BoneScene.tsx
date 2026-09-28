import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
  IcosahedronGeometry,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, makePick } from '../micro';

/**
 * Kemik dokusu (temsili). Solda periost, ortada kompakt kemik bloğu: üst yüzde basamaklı
 * lamel halkalarıyla osteonlar ve öne çıkarılmış, dilimi kesilerek iç katmanları gösterilen bir
 * osteon (Havers kanalında damar, lameller arasında osteositler ve kanalcıklar). Sağda süngerimsi
 * kemik: bir trabekül plakasında yenilenme birimi — osteoklastın açtığı çukur ve osteoblastların
 * doldurduğu, sonra mineralleşen yeni lamel. Damarlardan D vitamini, kalsiyum ve fosfat gelir.
 * Kemiğin uzun ekseni Y. Ölçekler ve parçacık sayıları bilerek abartılmıştır.
 */

const TOP = 0.9;
const BOT = -1.8;
const BX0 = -4.4;
const BX1 = 2.0;
const BZ0 = -2.2;
const BZ1 = 1.6;
/** Öne çıkarılmış (kama biçiminde kesilmiş) osteon. */
const FO = { x: -1.2, z: 2.2 };
const FO_SHELLS = [0.3, 0.43, 0.56, 0.69, 0.82, 0.95];
const WEDGE_START = 1.15;
const WEDGE_LEN = Math.PI * 2 - 1.6;
/** Bloğa gömülü osteonlar: x, z, ölçek. */
const OSTEONS: [number, number, number][] = [
  [-3.4, -1.2, 0.85],
  [-3.2, 0.7, 0.85],
  [-1.6, -0.9, 0.9],
  [0.1, -1.3, 0.8],
  [0.2, 0.5, 0.85],
  [1.35, -0.6, 0.6],
  [-1.45, 0.6, 0.6],
];
/** Basamaklı osteon: lamel sınır yarıçapları ve basamak yükseklikleri (birim osteon). */
const STEP_R = [0.22, 0.37, 0.52, 0.67, 0.82, 1.0];
const STEP_H = [0.2, 0.16, 0.12, 0.08, 0.04];
/** Trabekül plakası (üst yüz merkezi) ve üzerindeki iki çukur (plakaya göre). */
const PL = new Vector3(4.2, -0.55, 0.3);
const PL_W = 3.0;
const PL_D = 2.2;
const PL_H = 0.7;
const PIT_A = { x: -0.65, z: 0.2 };
const PIT_B = { x: 0.65, z: -0.1 };
const PIT_RX = 0.55;
const PIT_RZ = 0.45;
const PIT_B_DEPTH = 0.3;
const OB_MAX = 24;
const ALP_MAX = 60;
const CRYSTAL_N = 70;

const SHOTS = [
  { position: [0.6, 4.4, 9.4], target: [0.4, -0.4, 0.2] },
  { position: [0.6, 2.5, 5.8], target: [-1.3, 0.2, 1.6] },
  { position: [5.9, 1.0, 3.3], target: [4.9, -0.6, 0.3] },
  { position: [4.2, 1.3, 3.9], target: [4.6, -0.3, 0.4] },
  { position: [2.6, 0.9, 3.4], target: [3.6, -0.6, 0.5] },
  { position: [4.3, 2.5, 5.0], target: [4.2, -0.6, 0.3] },
] as const;

const PERI_V = curve([
  [-5.12, -0.5, -2.8],
  [-5.12, -0.6, -1.2],
  [-5.14, -0.55, 0.4],
  [-5.12, -0.7, 2.1],
  [-5.05, -0.9, 3.2],
]);
const VOLK_V = curve([
  [-5.1, -0.7, 2.1],
  [-4.1, -1.25, 2.25],
  [-3.0, -1.5, 2.35],
  [-2.0, -1.55, 2.3],
  [FO.x, -1.3, FO.z],
  [FO.x, -0.3, FO.z],
  [FO.x, 0.8, FO.z],
  [FO.x + 0.05, 1.5, FO.z + 0.1],
  [FO.x + 0.3, 2.0, FO.z + 0.4],
]);
const MARROW_V = curve([
  [6.5, 0.0, 0.8],
  [5.6, 0.15, -0.6],
  [4.4, 0.1, -1.0],
  [3.2, 0.2, -0.9],
  [2.4, 0.3, -0.5],
  [2.0, 0.2, -0.2],
]);
const VESSELS = [PERI_V, VOLK_V, MARROW_V];

const UP = new Vector3(0, 1, 0);
const M = new Matrix4();
const P = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const C = new Color();
const C2 = new Color();
const BONE = new Color('#e6dcc4');
const ERODED = new Color('#b8936c');
const OSTEOID = new Color('#f2b8a6');
const NEW_BONE = new Color('#f1e8d2');

/** Dar referans aralıklı iyonlarda sapmayı görünür kılar (yalnızca görselleştirme). */
function emphasize(v: number | undefined, gain: number): number {
  return Math.max(0.15, Math.min(3, 1 + ((v ?? 1) - 1) * gain));
}

/** Yumuşak kenarlı çukur profili (0..1), plaka yerel koordinatında. */
function bowl(dx: number, dz: number): number {
  const q = (dx / PIT_RX) ** 2 + (dz / PIT_RZ) ** 2;
  return q >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(q));
}

/** Plaka yüzeyinin yüksekliği: A çukuru (yıkım) derinleşir, B çukuru (yapım) dolar. */
function surfaceY(x: number, z: number, depthA: number, fillB: number): number {
  const a = bowl(x - PIT_A.x, z - PIT_A.z);
  const b = bowl(x - PIT_B.x, z - PIT_B.z);
  const scallop = a > 0 ? 0.025 * Math.sin(x * 23) * Math.sin(z * 19) * a * Math.min(1, depthA / 0.1) : 0;
  return -depthA * a - PIT_B_DEPTH * (1 - fillB) * b + scallop;
}

function tint(g: BufferGeometry, hex: string): BufferGeometry {
  const c = new Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

/** Basamaklı (teleskop gibi) osteon üst yüzü: eş merkezli lamel halkaları ve basamak duvarları. */
function osteonGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const r0 = STEP_R[k]!;
    const r1 = STEP_R[k + 1]!;
    const h = STEP_H[k]!;
    parts.push(tint(new RingGeometry(r0, r1, 48, 1).rotateX(-Math.PI / 2).translate(0, h, 0), k % 2 ? '#dccfb2' : '#f2e9d4'));
    const lo = k < 4 ? STEP_H[k + 1]! : 0;
    parts.push(tint(new CylinderGeometry(r1, r1, h - lo, 48, 1, true).translate(0, lo + (h - lo) / 2, 0), '#cbbd9e'));
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Havers kanalı ağzı: koyu iç duvar ve taban. */
function canalGeometry(): BufferGeometry {
  const r0 = STEP_R[0]!;
  const h = STEP_H[0]!;
  const parts = [
    tint(new CylinderGeometry(r0, r0, h, 32, 1, true).translate(0, h / 2, 0), '#4a1d17'),
    tint(new CircleGeometry(r0, 32).rotateX(-Math.PI / 2).translate(0, 0.003, 0), '#2a0f0c'),
  ];
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Yuvarlatılmış küp: osteoblastların küp biçimli görünümü için. */
function cuboidGeometry(): BufferGeometry {
  const raw = new BoxGeometry(1, 1, 1, 4, 4, 4);
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  const g = mergeVertices(raw);
  raw.dispose();
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    v.lerp(v.clone().multiplyScalar(0.62 / Math.max(1e-6, len)), 0.4);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Teğet (x), yukarı (y), dışa doğru (z) eksenli yönelim: osteon çevresindeki hücreler için. */
function ringQuat(th: number): Quaternion {
  const radial = new Vector3(Math.sin(th), 0, Math.cos(th));
  const tangent = new Vector3(Math.cos(th), 0, -Math.sin(th));
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(tangent, UP, radial));
}

function buildBone() {
  const r = rng(29);
  const osteons: CellSpec[] = OSTEONS.map(([x, z, s]) => ({ p: new Vector3(x, TOP, z), s: new Vector3(s, 1, s) }));
  const vessels: CellSpec[] = OSTEONS.map(([x, z, s]) => ({ p: new Vector3(x, TOP + 0.08, z), s: new Vector3(s, 1, s) }));
  const shells: CellSpec[] = FO_SHELLS.map((rad, k) => ({
    p: new Vector3(FO.x, BOT, FO.z),
    s: new Vector3(rad, TOP + 0.3 - k * 0.05 - BOT, rad),
    color: k % 2 ? '#dccdb0' : '#f3ead6',
  }));

  const cytes: CellSpec[] = [];
  const canals: CellSpec[] = [];
  const addProcess = (from: Vector3, dir: Vector3, len: number) => {
    canals.push({ p: from.clone().addScaledVector(dir, len / 2), s: new Vector3(0.011, len, 0.011), q: new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()) });
  };
  // Gömülü osteonların basamakları üzerinde osteositler (üstten görünür) ve kanalcıklar
  for (const [cx, cz, s] of OSTEONS) {
    for (let k = 1; k < 5; k++) {
      const rm = ((STEP_R[k]! + STEP_R[k + 1]!) / 2) * s;
      const n = Math.max(3, Math.round((2 * Math.PI * rm) / 0.62));
      const th0 = r() * Math.PI * 2;
      for (let j = 0; j < n; j++) {
        const th = th0 + (j / n) * Math.PI * 2;
        const radial = new Vector3(Math.sin(th), 0, Math.cos(th));
        const tangent = new Vector3(Math.cos(th), 0, -Math.sin(th));
        const p = new Vector3(cx, TOP + STEP_H[k]! + 0.012, cz).addScaledVector(radial, rm);
        cytes.push({ p, s: new Vector3(0.07, 0.022, 0.04), q: ringQuat(th) });
        addProcess(p, radial.clone().negate(), 0.07 * s);
        addProcess(p, tangent, 0.1);
        addProcess(p, tangent.clone().negate(), 0.1);
      }
    }
  }
  // Öne çıkarılmış osteonda lameller arasındaki osteositler
  for (let g = 0; g < FO_SHELLS.length - 1; g++) {
    const rm = (FO_SHELLS[g]! + FO_SHELLS[g + 1]!) / 2;
    const n = Math.round((rm * WEDGE_LEN) / 0.45);
    for (const y of [-1.1, -0.35, 0.4]) {
      for (let j = 0; j < n; j++) {
        const th = WEDGE_START + 0.12 + ((j + (r() - 0.5) * 0.4) / n) * (WEDGE_LEN - 0.24);
        const radial = new Vector3(Math.sin(th), 0, Math.cos(th));
        const p = new Vector3(FO.x, y + (r() - 0.5) * 0.3, FO.z).addScaledVector(radial, rm);
        cytes.push({ p, s: new Vector3(0.055, 0.09, 0.03), q: ringQuat(th) });
        addProcess(p, radial.clone().negate(), 0.12);
        addProcess(p, radial, 0.12);
        addProcess(p, UP, 0.12);
      }
    }
  }

  // Süngerimsi kemik: trabekül çubukları (plaka ayrıca çizilir)
  const struts = [
    curve([[2.0, 0.3, -1.4], [3.0, 0.5, -1.7], [4.2, 0.3, -1.9], [5.6, 0.6, -1.6]]),
    curve([[3.1, -0.7, -0.6], [3.3, 0.0, -1.3], [3.2, 0.35, -1.7]]),
    curve([[5.5, -0.7, -0.5], [5.8, 0.1, -1.1], [5.7, 0.6, -1.6]]),
    curve([[2.0, -0.9, 0.3], [2.4, -0.95, 0.3], [2.8, -0.9, 0.3]]),
    curve([[4.6, -1.2, 1.0], [4.9, -1.7, 1.6], [5.3, -1.9, 2.3]]),
    curve([[2.0, 0.6, -0.4], [2.8, 0.95, -0.9], [3.8, 1.0, -1.4], [4.8, 0.8, -1.7]]),
    curve([[5.6, -0.9, 0.9], [6.2, -0.5, 1.1], [6.6, -0.2, 0.8]]),
    curve([[3.4, -1.2, -0.4], [3.1, -1.7, -1.1], [2.6, -1.9, -1.8]]),
  ];
  const periFibers = Array.from({ length: 7 }, (_, i) => {
    const y0 = BOT + 0.2 + i * 0.36;
    return curve([[-4.97, y0, BZ0], [-4.97, y0 + 0.25, -0.5], [-4.97, y0 - 0.1, 0.6], [-4.97, y0 + 0.15, BZ1]]);
  });

  // Osteoblastlar: B çukurunun tabanından kenarına doğru ayçiçeği dizilimi (ilk N tanesi merkezde)
  const obXZ = Array.from({ length: OB_MAX }, (_, i) => {
    const rr = Math.sqrt((i + 0.5) / OB_MAX) * 1.2;
    const th = i * 2.39996;
    return { x: PIT_B.x + Math.cos(th) * rr * PIT_RX, z: PIT_B.z + Math.sin(th) * rr * PIT_RZ };
  });
  const alp = Array.from({ length: ALP_MAX }, () => ({ d: new Vector3(r() - 0.5, r() * 0.6, r() - 0.5).normalize().multiplyScalar(0.12 + r() * 0.03), ph: r() * 6.28 }));
  const crystals = Array.from({ length: CRYSTAL_N }, () => {
    const th = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 0.85;
    return {
      x: PIT_B.x + Math.cos(th) * rr * PIT_RX,
      z: PIT_B.z + Math.sin(th) * rr * PIT_RZ,
      q: new Quaternion().setFromAxisAngle(new Vector3(r() - 0.5, 0, r() - 0.5).normalize(), (r() - 0.5) * 1.2),
    };
  });

  // Kalsiyum ve fosfat: damardan yeni lamele (ve öne çıkarılmış osteonda kanaldan lamellere)
  const toPitB = (): Hop => {
    const th = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 0.8;
    return {
      from: MARROW_V.getPointAt(0.2 + r() * 0.5),
      to: new Vector3(PL.x + PIT_B.x + Math.cos(th) * rr * PIT_RX, PL.y + 0.03, PL.z + PIT_B.z + Math.sin(th) * rr * PIT_RZ),
      lift: new Vector3(0, 0.25, 0),
    };
  };
  const toShell = (): Hop => {
    const th = WEDGE_START + r() * WEDGE_LEN;
    const y = -1.2 + r() * 1.9;
    const rr = FO_SHELLS[1 + Math.floor(r() * 3)]!;
    return { from: new Vector3(FO.x, y, FO.z), to: new Vector3(FO.x + Math.sin(th) * rr, y + (r() - 0.5) * 0.2, FO.z + Math.cos(th) * rr) };
  };
  const caHops: Hop[] = Array.from({ length: 40 }, (_, i) => (i % 4 === 3 ? toShell() : toPitB()));
  const pHops: Hop[] = Array.from({ length: 40 }, (_, i) => (i % 4 === 1 ? toShell() : toPitB()));
  // Yıkım: A çukurundan çözülen kalsiyum damara geçer
  const release: Hop[] = Array.from({ length: 16 }, () => {
    const th = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 0.6;
    return {
      from: new Vector3(PL.x + PIT_A.x + Math.cos(th) * rr * PIT_RX, PL.y - 0.12, PL.z + PIT_A.z + Math.sin(th) * rr * PIT_RZ),
      to: MARROW_V.getPointAt(0.45 + r() * 0.3),
      lift: new Vector3(0, 0.3, 0),
    };
  });
  // D vitamini: damardan osteoblastlara (reseptörüne bağlanır)
  const vitdHops: Hop[] = obXZ.slice(0, 12).map((o) => ({ from: MARROW_V.getPointAt(0.25 + r() * 0.4), to: new Vector3(PL.x + o.x, PL.y + 0.1, PL.z + o.z), lift: new Vector3(0, 0.2, 0) }));

  const ocNuclei: CellSpec[] = Array.from({ length: 5 }, (_, i) => {
    const th = (i / 5) * Math.PI * 2 + 0.3;
    return { p: new Vector3(Math.cos(th) * 0.24, 0.07, Math.sin(th) * 0.18), s: 0.075 };
  });

  return { osteons, vessels, shells, cytes, canals, struts, periFibers, obXZ, alp, crystals, caHops, pHops, release, vitdHops, ocNuclei };
}

export default function BoneScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0b0907', ['#0b0907', 8, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 16 }, { position: [0.5, 6, 15], target: [0.3, -0.4, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const bone = useMemo(buildBone, []);

  // Kişisel: D vitamini, kalsiyum, fosfat yoğunluğu; ALP üst sınırı aştıkça osteoblast sayısı ve etkinliği
  const nVitD = scaled(36, params.vitd, 120);
  const nCa = scaled(30, emphasize(params.ca, 3), 90);
  const nP = scaled(30, emphasize(params.p, 2), 90);
  const alpHigh = Math.max(0, Math.min(3, (params.alp ?? 0.5) - 1));
  const nOb = Math.min(OB_MAX, 8 + Math.round(alpHigh * 5));
  const obRate = 1 + alpHigh * 0.6;
  const nAlp = Math.min(ALP_MAX, 10 + Math.round(alpHigh * 16));

  const boneMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8dcc2', roughness: 0.85, emissive: '#1a1508', emissiveIntensity: 0.2 }));
  const hiddenMat = useDisposable(() => new MeshBasicMaterial({ visible: false }));
  const blockGeo = useDisposable(() => new BoxGeometry(BX1 - BX0, TOP - BOT, BZ1 - BZ0));
  const osteonGeo = useDisposable(osteonGeometry);
  const osteonMat = useDisposable(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide, emissive: '#1a1508', emissiveIntensity: 0.2 }));
  const canalGeo = useDisposable(canalGeometry);
  const canalMat = useDisposable(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: DoubleSide }));
  const vesselGeo = useDisposable(() => new CylinderGeometry(0.1, 0.1, 0.16, 16));
  const vesselMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5 }));
  const shellGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 48, 1, true, WEDGE_START, WEDGE_LEN).translate(0, 0.5, 0));
  const shellMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.7, side: DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }));
  const foCanalGeo = useDisposable(() => new CylinderGeometry(0.2, 0.2, TOP + 0.34 - BOT, 24, 1, true, WEDGE_START, WEDGE_LEN));
  const foCanalMat = useDisposable(() => new MeshStandardMaterial({ color: '#5a2219', roughness: 0.7, side: DoubleSide }));
  const cyteGeo = useDisposable(() => bumpySphere(1, 0.12, 5));
  const cyteMat = useDisposable(() => new MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.6, emissive: '#3a1a08', emissiveIntensity: 0.3 }));
  const lineGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 4, 1, true));
  const canalicMat = useDisposable(() => new MeshStandardMaterial({ color: '#8a6a4c', roughness: 0.7, emissive: '#2a1a08', emissiveIntensity: 0.3 }));
  const periGeo = useDisposable(() => new BoxGeometry(0.55, TOP + 0.05 - BOT, BZ1 - BZ0));
  const periMat = useDisposable(() => new MeshStandardMaterial({ color: '#d8998e', roughness: 0.9, emissive: '#2a0c08', emissiveIntensity: 0.3 }));
  const periFiberMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0c8bd', roughness: 0.7 }));
  const strutMat = useDisposable(() => new MeshStandardMaterial({ color: '#e3d7bd', roughness: 0.85, emissive: '#1a1508', emissiveIntensity: 0.2 }));
  const plateGeo = useDisposable(() => new BoxGeometry(PL_W, PL_H, PL_D));
  const hfGeo = useDisposable(() => {
    const g = new PlaneGeometry(PL_W, PL_D, 60, 44).rotateX(-Math.PI / 2);
    g.setAttribute('color', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
    return g;
  });
  const hfMat = useDisposable(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  const ocGeo = useDisposable(() => bumpySphere(3, 0.14, 11));
  const ocMat = useDisposable(() => new MeshStandardMaterial({ color: '#c07ad8', roughness: 0.55, emissive: '#3a1050', emissiveIntensity: 0.4, transparent: true, opacity: 0.75 }));
  const ocNucMat = useDisposable(() => new MeshStandardMaterial({ color: '#4a2a7a', roughness: 0.5 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const obGeo = useDisposable(cuboidGeometry);
  const obMat = useDisposable(() => new MeshStandardMaterial({ color: '#6fb0ff', roughness: 0.5, emissive: '#10306a', emissiveIntensity: 0.4 }));
  const alpGeo = useDisposable(() => new OctahedronGeometry(1, 0));
  const alpMat = useDisposable(() => new MeshStandardMaterial({ color: '#9a7bff', emissive: '#4a30b0', emissiveIntensity: 1 }));
  const crystalGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 6));
  const crystalMat = useDisposable(() => new MeshStandardMaterial({ color: '#eaf6ff', roughness: 0.2, emissive: '#5a7a90', emissiveIntensity: 0.6 }));
  const caMat = useDisposable(() => new MeshBasicMaterial({ color: '#c6ff5c' }));
  const pGeo = useDisposable(() => new IcosahedronGeometry(1, 0));
  const pMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9f4a', emissive: '#8a4000', emissiveIntensity: 0.9 }));
  const vitdMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffd84a', emissive: '#8a6a00', emissiveIntensity: 1.1 }));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const vesselTubeMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5, transparent: true, opacity: 0.7 }));
  const plateMats = useMemo(() => [strutMat, strutMat, hiddenMat, strutMat, strutMat, strutMat], [strutMat, hiddenMat]);

  const ocRef = useRef<Group>(null);
  const obRef = useRef<InstancedMesh>(null);
  const alpRef = useRef<InstancedMesh>(null);
  const crRef = useRef<InstancedMesh>(null);
  const last = useRef({ a: -1, b: -1, m: -1 });

  // Yenilenme birimi: A çukuru yıkımla derinleşir, B çukuru osteoidle dolar ve mineralleşir
  const depthA = useEased(stage === 4 ? 0.34 : stage === 5 ? 0.24 : 0.14, 0.35);
  const fillB = useEased(stage === 2 ? 0.8 : stage === 3 || stage === 5 ? 1 : stage === 4 ? 0.85 : 0.45, 0.35);
  const mineral = useEased(stage === 3 || stage === 5 ? 1 : stage === 4 ? 0.8 : stage === 2 ? 0.1 : 0.35, 0.5);
  const cellGlow = useEased(stage === 1 ? 1 : 0, 1.5);
  const obGlow = useEased(stage === 2 ? 1 : 0, 1.5);
  const ocGlow = useEased(stage === 4 ? 1 : 0, 1.5);

  useFrame(() => {
    const t = time.current;
    const dA = depthA.current;
    const fB = fillB.current;
    const mn = mineral.current;
    cyteMat.emissiveIntensity = 0.3 + 1.2 * cellGlow.current;
    canalicMat.emissiveIntensity = 0.3 + 1.4 * cellGlow.current;
    obMat.emissiveIntensity = 0.4 + 0.8 * obGlow.current;
    ocMat.emissiveIntensity = 0.4 + 0.9 * ocGlow.current;

    // Plaka yüzeyi (yalnızca değer değiştiğinde yeniden hesaplanır)
    const l = last.current;
    if (Math.abs(l.a - dA) > 0.001 || Math.abs(l.b - fB) > 0.001 || Math.abs(l.m - mn) > 0.004) {
      l.a = dA;
      l.b = fB;
      l.m = mn;
      const pos = hfGeo.getAttribute('position');
      const col = hfGeo.getAttribute('color');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, surfaceY(x, z, dA, fB));
        const a = bowl(x - PIT_A.x, z - PIT_A.z);
        const b = bowl(x - PIT_B.x, z - PIT_B.z);
        C.copy(BONE);
        if (a > 0) C.lerp(ERODED, Math.min(1, a * 1.6) * Math.min(1, dA / 0.12));
        if (b > 0) C.lerp(C2.copy(OSTEOID).lerp(NEW_BONE, mn), Math.min(1, b * 2.2) * Math.min(1, fB * 1.5));
        col.setXYZ(i, C.r, C.g, C.b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      hfGeo.computeVertexNormals();
      hfGeo.computeBoundingSphere();
    }

    // Osteoklast çukurun içinde çalışır
    const oc = ocRef.current;
    if (oc) {
      oc.position.y = PL.y - dA * 0.6 + 0.14;
      const s = 1 + 0.05 * ocGlow.current * Math.sin(t * 3);
      oc.scale.set(s, 1 / s, s);
    }

    // Osteoblastlar yeni lamelin yüzeyinde; ALP taneleri zarlarında
    const om = obRef.current;
    if (om) {
      om.count = nOb;
      for (let i = 0; i < nOb; i++) {
        const o = bone.obXZ[i]!;
        const pulse = 1 + 0.07 * Math.sin(t * 3 * obRate + i * 1.7);
        P.set(PL.x + o.x, PL.y + surfaceY(o.x, o.z, dA, fB) + 0.075, PL.z + o.z);
        M.compose(P, Q.identity(), S.set(0.13 * pulse, 0.1 / pulse, 0.13 * pulse));
        om.setMatrixAt(i, M);
      }
      om.instanceMatrix.needsUpdate = true;
      om.boundingSphere = null;
    }
    const am = alpRef.current;
    if (am) {
      am.count = nAlp;
      for (let i = 0; i < nAlp; i++) {
        const d = bone.alp[i]!;
        const o = bone.obXZ[i % nOb]!;
        P.set(PL.x + o.x, PL.y + surfaceY(o.x, o.z, dA, fB) + 0.08, PL.z + o.z).add(d.d).addScalar(0.015 * Math.sin(t * 2.5 * obRate + d.ph));
        Q.setFromAxisAngle(UP, t * obRate + d.ph);
        M.compose(P, Q, S.setScalar(0.022));
        am.setMatrixAt(i, M);
      }
      am.instanceMatrix.needsUpdate = true;
      am.boundingSphere = null;
    }

    // Hidroksiapatit kristalleri: mineralleştikçe artar
    const cm = crRef.current;
    if (cm) {
      const n = Math.round(mn * CRYSTAL_N);
      cm.count = n;
      for (let i = 0; i < n; i++) {
        const c = bone.crystals[i]!;
        P.set(PL.x + c.x, PL.y + surfaceY(c.x, c.z, dA, fB) + 0.025, PL.z + c.z);
        M.compose(P, c.q, S.set(0.022, 0.06, 0.022));
        cm.setMatrixAt(i, M);
      }
      cm.instanceMatrix.needsUpdate = true;
      cm.boundingSphere = null;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.4} color="#fff0e0" />
      <directionalLight position={[3, 6, 6]} intensity={1.15} />
      <Headlight intensity={2.4} distance={16} />
      {/* Kompakt kemik bloğu ve gömülü osteonlar */}
      <mesh geometry={blockGeo} material={boneMat} position={[(BX0 + BX1) / 2, (TOP + BOT) / 2, (BZ0 + BZ1) / 2]} onClick={pick('osteon')} />
      <Cells cells={bone.osteons} geometry={osteonGeo} material={osteonMat} onClick={pick('osteon')} />
      <Cells cells={bone.osteons} geometry={canalGeo} material={canalMat} onClick={pick('canal')} />
      <Cells cells={bone.vessels} geometry={vesselGeo} material={vesselMat} onClick={pick('vessel')} />
      {/* Öne çıkarılmış osteon: lameller, kanal ve osteosit ağı */}
      <mesh geometry={foCanalGeo} material={foCanalMat} position={[FO.x, (TOP + 0.34 + BOT) / 2, FO.z]} onClick={pick('canal')} />
      <Cells cells={bone.cytes} geometry={cyteGeo} material={cyteMat} onClick={pick('osteocyte')} />
      <Cells cells={bone.canals} geometry={lineGeo} material={canalicMat} onClick={pick('canaliculi')} />
      <Cells cells={bone.shells} geometry={shellGeo} material={shellMat} onClick={pick('lamella')} />
      {/* Periost ve damarlar */}
      <mesh geometry={periGeo} material={periMat} position={[-4.675, (TOP + 0.05 + BOT) / 2, (BZ0 + BZ1) / 2]} onClick={pick('periosteum')} />
      <Tubes curves={bone.periFibers} radius={0.018} material={periFiberMat} onClick={pick('periosteum')} segments={40} radial={5} />
      <Tubes curves={[PERI_V]} radius={0.13} material={vesselTubeMat} onClick={pick('vessel')} segments={60} radial={12} />
      <Tubes curves={[VOLK_V]} radius={0.09} material={vesselTubeMat} onClick={pick('vessel')} segments={100} radial={10} />
      <Tubes curves={[MARROW_V]} radius={0.16} material={vesselTubeMat} onClick={pick('vessel')} segments={80} radial={12} />
      <CurveMovers curves={VESSELS} count={60} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={0.12} flat seed={5} onClick={pick('vessel')} />
      <CurveMovers curves={VESSELS} count={120} shown={nVitD} geometry={small} material={vitdMat} time={time} speed={0.05} size={0.035} jitter={0.06} seed={7} onClick={pick('vitd')} />
      {/* Süngerimsi kemik ve yenilenme birimi */}
      <Tubes curves={bone.struts} radius={[0.24, 0.2, 0.22, 0.26, 0.2, 0.22, 0.2, 0.22]} material={strutMat} onClick={pick('trabecula')} segments={40} radial={12} />
      <mesh geometry={plateGeo} material={plateMats} position={[PL.x, PL.y - PL_H / 2, PL.z]} onClick={pick('trabecula')} />
      <mesh geometry={hfGeo} material={hfMat} position={PL} onClick={pick('trabecula')} />
      <group ref={ocRef} position={[PL.x + PIT_A.x, PL.y, PL.z + PIT_A.z]}>
        <mesh geometry={ocGeo} material={ocMat} scale={[0.5, 0.2, 0.4]} onClick={pick('osteoclast')} />
        <Cells cells={bone.ocNuclei} geometry={small} material={ocNucMat} onClick={pick('osteoclast')} />
      </group>
      <instancedMesh ref={obRef} args={[obGeo, obMat, OB_MAX]} onClick={pick('osteoblast')} frustumCulled={false} />
      <instancedMesh ref={alpRef} args={[alpGeo, alpMat, ALP_MAX]} onClick={pick('alp')} frustumCulled={false} />
      <instancedMesh ref={crRef} args={[crystalGeo, crystalMat, CRYSTAL_N]} onClick={pick('calcium')} frustumCulled={false} />
      {/* Kişisel: kalsiyum ve fosfat damardan yeni kemiğe; yıkımda kalsiyum kana döner */}
      <Hoppers hops={bone.caHops} count={90} shown={nCa} geometry={small} material={caMat} time={time} duration={2.6} size={0.03} seed={13} onClick={pick('calcium')} />
      <Hoppers hops={bone.pHops} count={90} shown={nP} geometry={pGeo} material={pMat} time={time} duration={2.8} size={0.034} seed={17} onClick={pick('phosphate')} />
      <Hoppers hops={bone.release} count={30} geometry={small} material={caMat} time={time} duration={2.6} size={0.03} seed={21} active={stage >= 4} onClick={pick('calcium')} />
      <Hoppers hops={bone.vitdHops} count={16} geometry={small} material={vitdMat} time={time} duration={3} size={0.038} seed={27} active={stage === 3} onClick={pick('vitd')} />
    </group>
  );
}
