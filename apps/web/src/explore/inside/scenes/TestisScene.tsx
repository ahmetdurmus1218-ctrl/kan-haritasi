import { type RefObject, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import {
  type BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  type Curve,
  CylinderGeometry,
  DoubleSide,
  type Group,
  type InstancedMesh,
  type Material,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, type Shot, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, fibonacciSphere, makePick } from '../micro';

/**
 * Testis ve sperm yapımı (temsili). Birkaç seminifer tübülün kesiti: dış kenarda spermatogonyumlar,
 * içe doğru spermatositler ve spermatidler, boşlukta sperm kuyrukları; duvarı baştan başa geçen
 * Sertoli hücreleri. Tübüller arasında kılcallara yakın Leydig hücresi kümeleri: LH ile uyarılıp
 * testosteron salgılar; FSH Sertoli hücrelerine gider. Spermler kıvrımlı epididime taşınır. Son
 * aşamada prostat bez biriminin PSA salgısı ve kana az miktarda sızması gösterilir. Kişisel
 * düğmeler: `testo` (testosteron), `lh`, `fsh` (molekül sayıları, 1 = tipik).
 */

type V3 = [number, number, number];

const TUBS: V3[] = [
  [-3.0, 1.15, 1.05],
  [-0.55, 1.85, 1.0],
  [-1.85, -1.3, 1.0],
  [0.75, -0.65, 1.05],
];
const FACE = 0.2;
const LEYDIG: [number, number][] = [
  [-1.8, 0.5],
  [0.45, 0.85],
  [-0.5, -1.7],
  [-3.25, -0.55],
  [1.35, 1.75],
];
const CAP1 = curve([
  [-5, -1.2, 0],
  [-3.35, -0.45, 0.05],
  [-2.5, 0.0, 0.1],
  [-1.75, 0.35, 0.05],
  [-0.7, 0.62, 0.05],
  [0.35, 0.55, 0.0],
  [1.05, 1.5, 0.05],
  [1.9, 2.4, 0],
  [3.0, 3.4, -0.2],
]);
const CAP2 = curve([
  [-2.9, -3.3, 0],
  [-0.8, -2.35, 0.05],
  [-0.35, -1.45, 0.05],
  [-0.55, -0.35, 0.0],
  [-1.4, 0.3, 0.05],
  [-1.75, 1.25, 0.05],
  [-1.95, 2.7, 0.05],
  [-2.0, 3.8, -0.2],
]);
const CAP3 = curve([
  [3.0, -3.0, 0],
  [2.05, -1.4, 0.05],
  [1.95, 0.2, 0.05],
  [1.25, 1.05, 0.05],
  [0.2, 0.95, 0.0],
]);
const CAP4 = curve([
  [2.2, -4.1, 0.1],
  [3.3, -3.85, -0.1],
  [4.4, -3.8, -0.2],
  [5.6, -3.4, -0.4],
]);
const CAPS = [CAP1, CAP2, CAP3];
const ALL_CAPS = [CAP1, CAP2, CAP3, CAP4];
const PSA_CAPS = [CAP4];

/** Tübül boşluğundan çıkıp epididim sarmalından geçen yol. */
const PATH = curve([
  [0.75, -0.65, 0.1],
  [1.0, -0.55, 0.9],
  [1.9, 0.2, 1.0],
  [2.7, 1.6, 0.6],
  [3.3, 2.75, 0.1],
  ...Array.from({ length: 73 }, (_, i) => {
    const t = i / 72;
    const a = t * 6 * Math.PI * 2;
    return [3.7 + 0.42 * Math.cos(a), 2.8 - 3.4 * t, -0.3 + 0.42 * Math.sin(a)] as V3;
  }),
  [4.6, -1.1, -0.4],
  [5.4, -1.3, -0.5],
]);
const PATHS = [PATH];

const PR = new Vector3(3.7, -2.9, -0.2);
const PR_R = 0.72;
const DUCT = curve([
  [PR.x + 0.4, PR.y + 0.45, PR.z + 0.1],
  [4.7, -2.15, -0.05],
  [5.7, -1.7, -0.3],
]);
const DUCTS = [DUCT];

const SHOTS = [
  { position: [0.9, 0.3, 10.6], target: [0.8, -0.2, 0] },
  { position: [-1.3, 0.9, 3.8], target: [-1.3, 0.3, 0] },
  { position: [0.95, -0.4, 3.3], target: [0.75, -0.65, 0] },
  { position: [5.8, 1.4, 5.6], target: [3.0, 0.9, 0.1] },
  { position: [5.0, -2.2, 3.6], target: [3.8, -2.9, -0.2] },
] as const;
const ENTRY: Shot = { position: [0.9, 2, 15], target: [0.8, -0.2, 0] };

const M = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const T = new Vector3();
const UP = new Vector3(0, 1, 0);
const LEYDIG_C = new Color('#e8a452');
const LEYDIG_ON = new Color('#ffe0a0');
const SERTOLI_C = new Color('#f0e6c8');
const SERTOLI_ON = new Color('#d8ecff');
const PROST_C = new Color('#e6a890');
const PROST_ON = new Color('#d8ffd8');

function useFreshBounds(root: RefObject<Group | null>) {
  useFrame(() => {
    root.current?.traverse((o) => {
      if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).boundingSphere = null;
    });
  });
}

/** Baş yönü hareket yönünde olan yüzücüler (sperm). */
function Swimmers({
  path,
  count,
  shown,
  time,
  speed,
  geometry,
  material,
  jitter = 0.1,
  seed = 3,
  onClick,
}: {
  path: Curve<Vector3>;
  count: number;
  shown?: number;
  time: RefObject<number>;
  speed: number;
  geometry: BufferGeometry;
  material: Material;
  jitter?: number;
  seed?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ o: r(), v: 0.8 + r() * 0.4, j: new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(jitter), ph: r() * 6.28 }));
  }, [count, seed, jitter]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = time.current ?? 0;
    mesh.count = Math.min(count, Math.max(0, shown ?? count));
    for (let i = 0; i < mesh.count; i++) {
      const d = data[i]!;
      const u = (d.o + t * speed * d.v) % 1;
      path.getPointAt(u, P).add(d.j);
      path.getTangentAt(u, T);
      T.x += Math.sin(t * 9 + d.ph) * 0.15;
      T.z += Math.cos(t * 9 + d.ph) * 0.15;
      Q.setFromUnitVectors(UP, T.normalize());
      M.compose(P, Q, S.setScalar(1));
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, count]} onClick={onClick} frustumCulled={false} />;
}

function spermGeometry(): BufferGeometry {
  const head = new SphereGeometry(1, 10, 8).scale(0.03, 0.045, 0.02);
  const tail = new CylinderGeometry(0.005, 0.002, 0.28, 4).translate(0, -0.185, 0);
  const g = mergeGeometries([head, tail])!;
  head.dispose();
  tail.dispose();
  return g;
}

export default function TestisScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0a0709', ['#0a0709', 8, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.6, max: 15 }, ENTRY);
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const root = useRef<Group>(null);
  useFreshBounds(root);

  // Kişisel düğmeler (1 = tipik), sınırlı
  const testo = Math.max(0.1, Math.min(4, params.testo ?? 1));
  const lh = Math.max(0.1, Math.min(5, params.lh ?? 1));
  const fsh = Math.max(0.1, Math.min(5, params.fsh ?? 1));
  const nTesto = scaled(stage >= 1 ? 36 : 26, testo, 150);
  const nLh = scaled(stage === 1 ? 34 : 16, lh, 150);
  const nFsh = scaled(stage === 2 ? 30 : 12, fsh, 130);
  const nLhHop = stage === 1 || stage === 2 ? scaled(stage === 1 ? 28 : 12, lh, 100) : 0;
  const nTHop = stage <= 3 ? scaled(stage === 0 ? 16 : 34, testo, 130) : 0;
  const nFshHop = stage === 2 ? scaled(24, fsh, 90) : 0;

  // Geometriler
  const epiGeo = useDisposable(() => new RingGeometry(0.34, 1, 48, 1));
  const lumenGeo = useDisposable(() => new CircleGeometry(0.34, 32));
  const wallGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 48, 1, true).rotateX(Math.PI / 2));
  const cellGeo = useDisposable(() => bumpySphere(1, 0.08, 4));
  const bigGeo = useDisposable(() => bumpySphere(2, 0.1, 7));
  const tidGeo = useDisposable(() => new SphereGeometry(1, 10, 8));
  const sertoliGeo = useDisposable(() => new CapsuleGeometry(0.06, 0.42, 4, 8));
  const leydigGeo = useDisposable(() => bumpySphere(2, 0.14, 12));
  const spermGeo = useDisposable(() => spermGeometry());
  const molGeo = useDisposable(() => new SphereGeometry(1, 8, 6));
  const sterGeo = useDisposable(() => new CylinderGeometry(1, 1, 0.45, 6));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const liningGeo = useDisposable(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.2));
  const stromaGeo = useDisposable(() => new SphereGeometry(1, 32, 20, Math.PI, Math.PI));
  const prLumenGeo = useDisposable(() => new SphereGeometry(1, 24, 16));

  // Malzemeler
  const epiMat = useDisposable(() => new MeshStandardMaterial({ color: '#a86880', roughness: 0.8, emissive: '#2a0c18', emissiveIntensity: 0.4 }));
  const lumenMat = useDisposable(() => new MeshStandardMaterial({ color: '#2a141e', roughness: 0.9 }));
  const wallMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#d9a0b0', roughness: 0.5, transparent: true, opacity: 0.25, side: DoubleSide, depthWrite: false }));
  const rimMat = useDisposable(() => new MeshStandardMaterial({ color: '#e0b0c0', roughness: 0.55, emissive: '#2a1018', emissiveIntensity: 0.3 }));
  const goniaMat = useDisposable(() => new MeshStandardMaterial({ color: '#8f6ad8', roughness: 0.5, emissive: '#1e1040', emissiveIntensity: 0.5 }));
  const cyteMat = useDisposable(() => new MeshStandardMaterial({ color: '#c48ee8', roughness: 0.5, emissive: '#2a1040', emissiveIntensity: 0.45 }));
  const tidMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0c6f0', roughness: 0.45, emissive: '#3a2040', emissiveIntensity: 0.4 }));
  const spermMat = useDisposable(() => new MeshStandardMaterial({ color: '#eef4ff', roughness: 0.4, emissive: '#3a4a6a', emissiveIntensity: 0.6 }));
  const sertoliMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.5, transparent: true, opacity: 0.6, depthWrite: false, emissive: '#2a2410', emissiveIntensity: 0.3 }));
  const leydigMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, emissive: '#3a2008', emissiveIntensity: 0.45 }));
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c0303f', roughness: 0.45, emissive: '#3a0508', emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const lhMat = useDisposable(() => new MeshStandardMaterial({ color: '#b07cff', emissive: '#4a1ab0', emissiveIntensity: 1.1 }));
  const fshMat = useDisposable(() => new MeshStandardMaterial({ color: '#6fa8ff', emissive: '#1a4aa0', emissiveIntensity: 1.1 }));
  const testoMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9a3c', emissive: '#8a3a00', emissiveIntensity: 1.1 }));
  const ductMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#c9a0dc', roughness: 0.35, transparent: true, opacity: 0.35, side: DoubleSide, depthWrite: false, emissive: '#2a1040', emissiveIntensity: 0.4 }));
  const liningMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, emissive: '#2a1008', emissiveIntensity: 0.35 }));
  const stromaMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#c07a70', roughness: 0.5, transparent: true, opacity: 0.22, side: DoubleSide, depthWrite: false }));
  const prLumenMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f0f8d0', roughness: 0.2, transparent: true, opacity: 0.25, depthWrite: false }));
  const psaMat = useDisposable(() => new MeshStandardMaterial({ color: '#6fe39a', emissive: '#1a7a3a', emissiveIntensity: 1.1 }));

  const geo = useMemo(() => {
    const r = rng(47);
    const jit = (s: number) => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(s);
    const capSamples = CAPS.flatMap((c) => Array.from({ length: 60 }, (_, i) => c.getPointAt(i / 59)));
    const nearestCap = (p: Vector3) => capSamples.reduce((best, q) => (q.distanceToSquared(p) < best.distanceToSquared(p) ? q : best)).clone();

    const rings: CellSpec[] = [];
    const lumens: CellSpec[] = [];
    const walls: CellSpec[] = [];
    const rims: ReturnType<typeof curve>[] = [];
    const gonia: CellSpec[] = [];
    const cytes: CellSpec[] = [];
    const tids: CellSpec[] = [];
    const sperm: CellSpec[] = [];
    const sertoli: CellSpec[] = [];
    const sertoliBase: Vector3[] = [];
    const toCyte: Hop[] = [];
    const toTid: Hop[] = [];
    for (const [x, y, R] of TUBS) {
      const at = (ang: number, f: number, z: number) => new Vector3(x + Math.cos(ang) * f * R, y + Math.sin(ang) * f * R, z);
      rings.push({ p: new Vector3(x, y, 0.02), s: R });
      lumens.push({ p: new Vector3(x, y, 0.0), s: R });
      walls.push({ p: new Vector3(x, y, FACE - 1.15), s: new Vector3(R * 1.02, R * 1.02, 2.3) });
      rims.push(curve(Array.from({ length: 40 }, (_, i) => v3(at((i / 40) * Math.PI * 2, 1.0, FACE))), true));
      const off = r() * 6.28;
      for (let i = 0; i < 18; i++) {
        const a = off + (i / 18) * Math.PI * 2 + (r() - 0.5) * 0.1;
        const p = at(a, 0.9, 0.14);
        gonia.push({ p, s: 0.072 + r() * 0.012 });
        toCyte.push({ from: p.clone(), to: at(a + 0.05, 0.73, 0.16) });
      }
      for (let i = 0; i < 15; i++) {
        const a = off + ((i + 0.5) / 15) * Math.PI * 2 + (r() - 0.5) * 0.1;
        const p = at(a, 0.73, 0.16);
        cytes.push({ p, s: 0.085 + r() * 0.012 });
        toTid.push({ from: p.clone(), to: at(a + 0.08, 0.56, 0.18) });
      }
      for (let i = 0; i < 22; i++) {
        const a = off + (i / 22) * Math.PI * 2 + (r() - 0.5) * 0.12;
        tids.push({ p: at(a, 0.56, 0.18), s: 0.052 + r() * 0.008 });
      }
      for (let i = 0; i < 14; i++) {
        const a = off + ((i + 0.3) / 14) * Math.PI * 2;
        const rd = new Vector3(Math.cos(a), Math.sin(a), 0);
        const head = rd.clone().multiplyScalar(0.7).add(new Vector3(0, 0, 0.7)).normalize();
        sperm.push({ p: at(a, 0.46, FACE + 0.02), s: 1, q: new Quaternion().setFromUnitVectors(UP, head) });
      }
      for (let i = 0; i < 7; i++) {
        const a = off + ((i + 0.15) / 7) * Math.PI * 2;
        const rd = new Vector3(Math.cos(a), Math.sin(a), 0);
        sertoli.push({ p: at(a, 0.66, 0.1), s: new Vector3(1, R, 1), q: faceOut(rd) });
        sertoliBase.push(at(a, 0.92, 0.12));
      }
    }

    // Leydig kümeleri ve hormon yolları
    const leydig: CellSpec[] = LEYDIG.flatMap(([x, y]) => [
      { p: new Vector3(x, y, 0.02), s: 0.12 },
      ...Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + r();
        return { p: new Vector3(x + Math.cos(a) * 0.17, y + Math.sin(a) * 0.17, -0.05 + r() * 0.12), s: 0.1 + r() * 0.03 };
      }),
    ]);
    const lhIn: Hop[] = leydig.map((c) => ({ from: nearestCap(c.p), to: c.p.clone() }));
    const testoOut: Hop[] = leydig.flatMap((c) => {
      const tub = TUBS.reduce((best, tb) => (Math.hypot(tb[0] - c.p.x, tb[1] - c.p.y) - tb[2] < Math.hypot(best[0] - c.p.x, best[1] - c.p.y) - best[2] ? tb : best));
      const d = new Vector3(c.p.x - tub[0], c.p.y - tub[1], 0).normalize();
      return [
        { from: c.p.clone(), to: nearestCap(c.p).add(jit(0.05)) },
        { from: c.p.clone(), to: new Vector3(tub[0], tub[1], 0.14).addScaledVector(d, tub[2] * 0.8) },
      ];
    });
    const fshIn: Hop[] = sertoliBase.map((p) => ({ from: nearestCap(p), to: p.clone() }));

    // Prostat bez birimi
    const lining: CellSpec[] = fibonacciSphere(80, PR_R, PR)
      .filter((p) => p.z - PR.z < 0.25)
      .map((p) => ({ p, s: new Vector3(0.14, 0.2, 0.14), q: faceOut(p.clone().sub(PR)) }));
    const psaIn: Hop[] = Array.from({ length: 30 }, (_, i) => ({
      from: lining[(i * 7) % lining.length]!.p.clone().lerp(PR, 0.12),
      to: PR.clone().add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(r() * 0.35)),
    }));
    const low = [...lining].sort((a, b) => a.p.y - b.p.y).slice(0, 5);
    const psaLeak: Hop[] = low.map((c) => {
      let best = CAP4.getPointAt(0);
      for (let k = 0; k <= 40; k++) {
        const q = CAP4.getPointAt(k / 40);
        if (q.distanceTo(c.p) < best.distanceTo(c.p)) best = q;
      }
      return { from: c.p.clone(), to: best };
    });

    return { rings, lumens, walls, rims, gonia, cytes, tids, sperm, sertoli, toCyte, toTid, leydig, lhIn, testoOut, fshIn, lining, psaIn, psaLeak };
  }, []);

  const lhGlow = useEased(stage === 1 ? 1 : 0, 1.4);
  const fshGlow = useEased(stage === 2 ? 1 : 0, 1.4);
  const psaGlow = useEased(stage === 4 ? 1 : 0, 1.4);
  const lhK = Math.min(1.3, 0.5 + 0.5 * lh);
  const fshK = Math.min(1.3, 0.5 + 0.5 * fsh);

  return (
    <group ref={root}>
      <ambientLight intensity={0.36} color="#ffe8ee" />
      <directionalLight position={[3, 6, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />

      {/* Seminifer tübüller (kesit) */}
      <Cells cells={geo.walls} geometry={wallGeo} material={wallMat} onClick={pick('tubule')} />
      <Cells cells={geo.rings} geometry={epiGeo} material={epiMat} onClick={pick('tubule')} />
      <Cells cells={geo.lumens} geometry={lumenGeo} material={lumenMat} onClick={pick('tubule')} />
      <Tubes curves={geo.rims} radius={0.035} material={rimMat} onClick={pick('tubule')} segments={80} radial={6} />
      <Cells cells={geo.gonia} geometry={cellGeo} material={goniaMat} onClick={pick('spermatogonium')} />
      <Cells cells={geo.cytes} geometry={bigGeo} material={cyteMat} onClick={pick('spermatocyte')} time={time} animate={(i, t) => ({ scale: stage === 2 ? 1 + 0.08 * Math.sin(t * 3 + i) : 1 })} />
      <Cells cells={geo.tids} geometry={tidGeo} material={tidMat} onClick={pick('spermatid')} />
      <Cells cells={geo.sperm} geometry={spermGeo} material={spermMat} onClick={pick('sperm')} />
      <Cells
        cells={geo.sertoli}
        geometry={sertoliGeo}
        material={sertoliMat}
        onClick={pick('sertoli')}
        time={time}
        animate={(i, t, out) => {
          out.copy(SERTOLI_C).lerp(SERTOLI_ON, fshGlow.current * fshK * 0.7 * (0.5 + 0.5 * Math.sin(t * 3 + i)));
          return { color: true };
        }}
      />
      <Hoppers hops={geo.toCyte} count={72} shown={stage === 2 ? 72 : 0} geometry={cellGeo} material={cyteMat} time={time} duration={3.2} size={0.075} seed={11} active={stage === 2} onClick={pick('spermatocyte')} />
      <Hoppers hops={geo.toTid} count={60} shown={stage === 2 ? 60 : 0} geometry={tidGeo} material={tidMat} time={time} duration={3.2} size={0.05} seed={13} active={stage === 2} onClick={pick('spermatid')} />

      {/* Ara doku: Leydig hücreleri ve kılcallar */}
      <Cells
        cells={geo.leydig}
        geometry={leydigGeo}
        material={leydigMat}
        onClick={pick('leydig')}
        time={time}
        animate={(i, t, out) => {
          const k = lhGlow.current * lhK * (0.5 + 0.5 * Math.sin(t * 3 + i * 0.6));
          out.copy(LEYDIG_C).lerp(LEYDIG_ON, 0.8 * k);
          return { color: true, scale: 1 + 0.08 * k };
        }}
      />
      <Tubes curves={ALL_CAPS} radius={0.07} material={capMat} onClick={pick('capillary')} segments={90} radial={8} />
      <CurveMovers curves={CAPS} count={45} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={0.1} flat jitter={0.04} seed={3} onClick={pick('capillary')} />
      <CurveMovers curves={CAPS} count={150} shown={nLh} geometry={molGeo} material={lhMat} time={time} speed={0.05} size={0.04} jitter={0.06} seed={5} onClick={pick('lh')} />
      <CurveMovers curves={CAPS} count={130} shown={nFsh} geometry={molGeo} material={fshMat} time={time} speed={0.05} size={0.04} jitter={0.06} seed={7} onClick={pick('fsh')} />
      <CurveMovers curves={CAPS} count={150} shown={nTesto} geometry={sterGeo} material={testoMat} time={time} speed={0.05} size={0.04} jitter={0.06} seed={9} onClick={pick('testosterone')} />
      <Hoppers hops={geo.lhIn} count={100} shown={nLhHop} geometry={molGeo} material={lhMat} time={time} duration={2.2} size={0.045} seed={15} active={nLhHop > 0} onClick={pick('lh')} />
      <Hoppers hops={geo.testoOut} count={130} shown={nTHop} geometry={sterGeo} material={testoMat} time={time} duration={2.6} size={0.045} seed={17} active={nTHop > 0} onClick={pick('testosterone')} />
      <Hoppers hops={geo.fshIn} count={90} shown={nFshHop} geometry={molGeo} material={fshMat} time={time} duration={2.4} size={0.045} seed={19} active={nFshHop > 0} onClick={pick('fsh')} />

      {/* Epididim ve spermlerin taşınması */}
      <Tubes curves={PATHS} radius={0.1} material={ductMat} onClick={pick('epididymis')} segments={420} radial={8} />
      <Swimmers path={PATH} count={50} shown={stage === 3 ? 50 : 12} time={time} speed={0.02} geometry={spermGeo} material={spermMat} jitter={0.08} onClick={pick('sperm')} />

      {/* Prostat bez birimi ve PSA */}
      <mesh geometry={stromaGeo} material={stromaMat} position={PR} scale={1.0} onClick={pick('prostate')} />
      <mesh geometry={prLumenGeo} material={prLumenMat} position={PR} scale={0.52} raycast={() => null} />
      <Cells
        cells={geo.lining}
        geometry={liningGeo}
        material={liningMat}
        onClick={pick('prostate')}
        time={time}
        animate={(i, t, out) => {
          out.copy(PROST_C).lerp(PROST_ON, psaGlow.current * 0.5 * (0.5 + 0.5 * Math.sin(t * 2.5 + i)));
          return { color: true };
        }}
      />
      <Tubes curves={DUCTS} radius={0.09} material={ductMat} onClick={pick('prostate')} segments={40} radial={8} />
      <Hoppers hops={geo.psaIn} count={60} shown={stage === 4 ? 60 : 0} geometry={molGeo} material={psaMat} time={time} duration={2.6} size={0.035} seed={23} active={stage === 4} onClick={pick('psa')} />
      <CurveMovers curves={DUCTS} count={30} shown={stage === 4 ? 30 : 0} geometry={molGeo} material={psaMat} time={time} speed={0.1} size={0.035} jitter={0.08} seed={29} onClick={pick('psa')} />
      <Hoppers hops={geo.psaLeak} count={6} shown={stage === 4 ? 6 : 0} geometry={molGeo} material={psaMat} time={time} duration={3} size={0.035} seed={31} active={stage === 4} onClick={pick('psa')} />
      <CurveMovers curves={PSA_CAPS} count={6} shown={stage === 4 ? 6 : 0} geometry={molGeo} material={psaMat} time={time} speed={0.06} size={0.035} jitter={0.05} seed={37} onClick={pick('psa')} />
    </group>
  );
}

function v3(v: Vector3): V3 {
  return [v.x, v.y, v.z];
}
