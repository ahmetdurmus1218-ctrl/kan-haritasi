import { type RefObject, useMemo, useRef, useState } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  type BufferGeometry,
  CapsuleGeometry,
  Color,
  type Curve,
  CylinderGeometry,
  DoubleSide,
  type Group,
  type InstancedMesh,
  LatheGeometry,
  type Material,
  Matrix4,
  type Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, type Shot, bumpySphere, rng, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, fibonacciSphere, makePick } from '../micro';

/**
 * Yumurtalık ve adet döngüsü (temsili). Önden kesik bir yumurtalık: kortekste çok sayıda ilkel
 * folikül, FSH ile büyüyen tek bir baskın folikül (granüloza katları, sıvı dolu antrum), LH dalgasıyla
 * yüzeyde yırtılıp yumurtayı bırakması ve geride kalan sarı korpus luteum. Yanında Fallop tüpünün
 * saçaklı ucu yumurtayı yakalar, kirpikler onu tüp boyunca taşır; tüpte spermler yumurtaya ulaşır.
 * Son aşamada rahim iç tabakası (endometriyum) östrojenle kalınlaşır, progesteronla salgı evresine
 * geçer ve dökülür (döngü halinde). Hormonlar döngü evresine bağlı olduğundan kişisel düğme yoktur.
 */

type V3 = [number, number, number];
const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];

const OC = new Vector3(-1.5, -0.1, 0);
const OV = new Vector3(2.7, 1.75, 1.4);
const A_G = 0.45;
/** Baskın folikülün merkezi (yüzeye yakın; olgunlaşınca yüzeyden taşar). */
const G = new Vector3(OC.x + OV.x * 0.83 * Math.cos(A_G), OC.y + OV.y * 0.83 * Math.sin(A_G), -0.15);
const STIGMA = new Vector3(OC.x + OV.x * 1.02 * Math.cos(A_G), OC.y + OV.y * 1.02 * Math.sin(A_G), -0.02);
const SDIR = STIGMA.clone().sub(G).normalize();
const MOUTH = new Vector3(1.75, 1.15, 0.1);
const FDIR = STIGMA.clone().sub(MOUTH).normalize();
const FUNNEL_H = 0.72;
const NECK = MOUTH.clone().addScaledVector(FDIR, -FUNNEL_H);
const FQ = faceOut(FDIR);
const OUTSIDE = STIGMA.clone().addScaledVector(SDIR, 0.18);
/** Kumulus: yumurtanın antrum içinde oturduğu taraf. */
const CUM = new Vector3(-0.7, -0.35, -0.6).normalize();
const TUBE_R = 0.27;
const TUBE = curve([v3(NECK), [2.95, 1.95, 0.05], [3.85, 2.15, -0.15], [4.7, 1.6, -0.3], [5.1, 0.4, -0.4], [4.85, -0.8, -0.5], [4.3, -1.5, -0.5]]);
const TUBES = [TUBE];
const ART = curve([
  [-3.4, -3.8, 0.3],
  [-2.3, -2.3, -0.1],
  [-1.6, -1.2, -0.45],
  [-0.7, -0.35, -0.6],
  [0.05, 0.2, -0.65],
  [0.35, 0.3, -0.8],
]);
const VEIN = curve([
  [0.6, 0.15, -0.75],
  [-0.3, -0.55, -0.7],
  [-1.3, -1.35, -0.45],
  [-2.2, -2.45, -0.05],
  [-3.2, -3.9, 0.3],
]);
const ARTS = [ART];
const VEINS = [VEIN];
const VESSELS = [ART, VEIN];
const RIM = curve(
  Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [OC.x + OV.x * Math.cos(a), OC.y + OV.y * Math.sin(a), 0] as V3;
  }),
  true,
);
const RIMS = [RIM];

// Rahim iç tabakası
const EN = new Vector3(4.0, -2.75, -0.5);
const EN_W = 2.6;
const EN_D = 1.4;
const BASE_H = 0.26;
const FUNC_H = 1.0;
const BASE_TOP = EN.y + BASE_H / 2;
const ENCAP = curve([
  [2.3, -3.05, 0.2],
  [3.4, -2.98, -0.2],
  [4.6, -3.0, -0.4],
  [5.7, -3.2, -0.7],
]);
const ENCAPS = [ENCAP];
const CYCLE = 10;

const SHOTS = [
  { position: [0.8, 0.5, 10.8], target: [0.8, -0.2, -0.2] },
  { position: [1.4, 1.1, 3.6], target: [0.5, 0.5, -0.2] },
  { position: [2.2, 2.0, 4.4], target: [1.2, 0.9, 0] },
  { position: [0.9, 1.3, 3.4], target: [0.5, 0.5, -0.2] },
  { position: [4.0, 3.2, 4.8], target: [3.3, 1.6, -0.1] },
  { position: [4.8, -1.5, 4.0], target: [4.0, -2.4, -0.5] },
] as const;
const ENTRY: Shot = { position: [0.8, 2, 15], target: [0.8, -0.2, -0.2] };

const M = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const T = new Vector3();
const C = new Color();
const UP = new Vector3(0, 1, 0);
const HIDE = new Matrix4().makeScale(0, 0, 0);
const GRAN = new Color('#f3b8c8');
const LUTEAL = new Color('#f2c14e');
const THECA = new Color('#e89aa8');
const PROLIF = new Color('#f09aa8');
const SECRET = new Color('#e87890');
const MENSES = new Color('#b0304a');

const smooth = (k: number) => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

function pickThrough(onSelect: (key: string | null) => void, key: string, inner: ReadonlyArray<readonly [BufferGeometry, string]>, depth = 1.2) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    for (const x of e.intersections) {
      if (x.distance - e.distance > depth) break;
      const g = (x.object as Partial<Mesh>).geometry;
      const hit = g ? inner.find(([geo]) => geo === g) : undefined;
      if (hit) {
        onSelect(hit[1]);
        return;
      }
    }
    onSelect(key);
  };
}

function useFreshBounds(root: RefObject<Group | null>) {
  useFrame(() => {
    root.current?.traverse((o) => {
      if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).boundingSphere = null;
    });
  });
}

/** Baş yönü hareket yönünde olan yüzücüler (sperm): eğri üzerinde from→to arasında akar. */
function Swimmers({
  path,
  count,
  shown,
  time,
  speed,
  geometry,
  material,
  size = 1,
  from = 0,
  to = 1,
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
  size?: number;
  from?: number;
  to?: number;
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
      const u = from + (to - from) * ((d.o + t * speed * d.v) % 1);
      path.getPointAt(u, P).add(d.j);
      path.getTangentAt(u, T);
      if (to < from) T.negate();
      // Kuyruk vuruşu: baş yönü hafifçe salınır
      T.x += Math.sin(t * 9 + d.ph) * 0.15;
      T.z += Math.cos(t * 9 + d.ph) * 0.15;
      Q.setFromUnitVectors(UP, T.normalize());
      M.compose(P, Q, S.setScalar(size));
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, count]} onClick={onClick} frustumCulled={false} />;
}

/** Baş (+y) ve kuyruk (−y) olan sperm geometrisi. */
function spermGeometry(): BufferGeometry {
  const head = new SphereGeometry(1, 10, 8).scale(0.03, 0.045, 0.02);
  const tail = new CylinderGeometry(0.005, 0.002, 0.28, 4).translate(0, -0.185, 0);
  const g = mergeGeometries([head, tail])!;
  head.dispose();
  tail.dispose();
  return g;
}

export default function OvaryScene({ state, onSelect, reducedMotion }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0c060a', ['#0c060a', 8, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.6, max: 15 }, ENTRY);
  const time = useSimClock(state, reducedMotion);
  const invalidate = useThree((s) => s.invalidate);
  const pick = makePick(onSelect);
  const root = useRef<Group>(null);
  useFreshBounds(root);

  // Geometriler
  const shellGeo = useDisposable(() => new SphereGeometry(1, 56, 36, Math.PI, Math.PI).scale(OV.x, OV.y, OV.z));
  const cellGeo = useDisposable(() => bumpySphere(1, 0.1, 5));
  const granGeo = useDisposable(() => bumpySphere(1, 0.1, 9));
  const oocyteGeo = useDisposable(() => new SphereGeometry(1, 24, 16));
  const zonaGeo = useDisposable(() => new SphereGeometry(1, 24, 16));
  const primOoGeo = useDisposable(() => new SphereGeometry(1, 12, 8));
  const coronaGeo = useDisposable(() => bumpySphere(1, 0.1, 12));
  const antrumGeo = useDisposable(() => new SphereGeometry(1, 32, 24));
  const thecaGeo = useDisposable(() => new SphereGeometry(1, 40, 28, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8));
  const molGeo = useDisposable(() => new SphereGeometry(1, 8, 6));
  const sterGeo = useDisposable(() => new CylinderGeometry(1, 1, 0.45, 6));
  const funnelGeo = useDisposable(
    () =>
      new LatheGeometry(
        [new Vector2(0.26, 0), new Vector2(0.28, 0.18), new Vector2(0.36, 0.38), new Vector2(0.48, 0.56), new Vector2(0.62, FUNNEL_H)],
        32,
      ),
  );
  const fimGeo = useDisposable(() => new CapsuleGeometry(0.05, 0.26, 3, 6));
  const ciliaGeo = useDisposable(() => new CylinderGeometry(0.012, 0.012, 0.11, 4).translate(0, 0.055, 0));
  const spermGeo = useDisposable(() => spermGeometry());
  const baseGeo = useDisposable(() => new RoundedBoxGeometry(EN_W, BASE_H, EN_D, 2, 0.06));
  const funcGeo = useDisposable(() => new RoundedBoxGeometry(EN_W, 1, EN_D, 2, 0.06));
  const glandGeo = useDisposable(() => new CylinderGeometry(0.05, 0.05, 1, 8));
  const fragGeo = useDisposable(() => bumpySphere(1, 0.25, 19));

  // Malzemeler
  const shellMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#f0c0c8', roughness: 0.5, transparent: true, opacity: 0.3, side: DoubleSide, depthWrite: false, emissive: '#3a1420', emissiveIntensity: 0.4 }),
  );
  const rimMat = useDisposable(() => new MeshStandardMaterial({ color: '#e0a8b4', roughness: 0.6, emissive: '#2a0e14', emissiveIntensity: 0.3 }));
  const primOoMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff0d8', roughness: 0.4, emissive: '#4a3a20', emissiveIntensity: 0.5 }));
  const primCellMat = useDisposable(() => new MeshStandardMaterial({ color: '#f3b8c8', roughness: 0.55, emissive: '#2a0e18', emissiveIntensity: 0.3 }));
  const granMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#2a1010', emissiveIntensity: 0.35 }));
  const coronaMat = useDisposable(() => new MeshStandardMaterial({ color: '#f3b8c8', roughness: 0.5, emissive: '#2a0e18', emissiveIntensity: 0.35 }));
  const oocyteMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff0d8', roughness: 0.35, emissive: '#5a4a28', emissiveIntensity: 0.55 }));
  const zonaMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#e8f0ff', roughness: 0.2, transparent: true, opacity: 0.35, depthWrite: false, emissive: '#ffd9a0', emissiveIntensity: 0 }));
  const antrumMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#bfe0ff', roughness: 0.15, transparent: true, opacity: 0.28, depthWrite: false, emissive: '#10304a', emissiveIntensity: 0.4 }));
  const thecaMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#e89aa8', roughness: 0.45, transparent: true, opacity: 0.3, side: DoubleSide, depthWrite: false, emissive: '#3a1018', emissiveIntensity: 0.4 }));
  const vesselMat = useDisposable(() => new MeshStandardMaterial({ color: '#c0303f', roughness: 0.45, emissive: '#3a0508', emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
  const fshMat = useDisposable(() => new MeshStandardMaterial({ color: '#6fa8ff', emissive: '#1a4aa0', emissiveIntensity: 1.1 }));
  const lhMat = useDisposable(() => new MeshStandardMaterial({ color: '#b07cff', emissive: '#4a1ab0', emissiveIntensity: 1.1 }));
  const estMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff7fb8', emissive: '#9a1a5a', emissiveIntensity: 1.1 }));
  const progMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffb347', emissive: '#8a5000', emissiveIntensity: 1.1 }));
  const tubeMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f2a0b8', roughness: 0.35, transparent: true, opacity: 0.3, side: DoubleSide, depthWrite: false, emissive: '#3a1020', emissiveIntensity: 0.4 }));
  const fimMat = useDisposable(() => new MeshStandardMaterial({ color: '#f5a8bc', roughness: 0.5, emissive: '#3a1020', emissiveIntensity: 0.4 }));
  const ciliaMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe0ea', roughness: 0.5, emissive: '#5a2a3a', emissiveIntensity: 0.6 }));
  const spermMat = useDisposable(() => new MeshStandardMaterial({ color: '#eef4ff', roughness: 0.4, emissive: '#3a4a6a', emissiveIntensity: 0.6 }));
  const baseMat = useDisposable(() => new MeshStandardMaterial({ color: '#b85a6e', roughness: 0.7, emissive: '#2a0810', emissiveIntensity: 0.4 }));
  const funcMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f09aa8', roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false, emissive: '#3a1018', emissiveIntensity: 0.4 }));
  const glandMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff0f0', roughness: 0.5, emissive: '#4a2a30', emissiveIntensity: 0.4 }));
  const spiralMat = useDisposable(() => new MeshStandardMaterial({ color: '#d02a40', roughness: 0.45, emissive: '#4a0810', emissiveIntensity: 0.5 }));
  const fragMat = useDisposable(() => new MeshStandardMaterial({ color: '#a0203a', roughness: 0.6, emissive: '#3a0510', emissiveIntensity: 0.5 }));

  const geo = useMemo(() => {
    const r = rng(29);
    const jit = (s: number) => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(s);
    const dir = () => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const inOvary = (d: Vector3, k: number) => new Vector3(OC.x + d.x * OV.x * k, OC.y + d.y * OV.y * k, OC.z + d.z * OV.z * k);

    // İlkel foliküller: oosit + tek sıra yassı hücre halkası
    const prim: CellSpec[] = [];
    const primCells: CellSpec[] = [];
    for (let n = 0; prim.length < 38 && n < 4000; n++) {
      const d = dir();
      if (d.z > 0.12) continue;
      const p = inOvary(d, 0.8 + r() * 0.13);
      if (p.distanceTo(G) < 0.95 || prim.some((q) => q.p.distanceTo(p) < 0.22)) continue;
      prim.push({ p, s: 0.05 });
      const nrm = dir();
      const a = new Vector3().crossVectors(nrm, new Vector3(0.3, 1, 0.2)).normalize();
      const b = new Vector3().crossVectors(nrm, a);
      for (let j = 0; j < 7; j++) {
        const ang = (j / 7) * Math.PI * 2;
        const rd = a.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
        primCells.push({ p: p.clone().addScaledVector(rd, 0.068), s: new Vector3(0.036, 0.016, 0.036), q: faceOut(rd) });
      }
    }
    // Birkaç ikincil folikül (baskın olmayanlar geriler)
    const secCenters: { p: Vector3; r: number }[] = [];
    for (let n = 0; secCenters.length < 4 && n < 2000; n++) {
      const d = dir();
      if (d.z > 0) continue;
      const p = inOvary(d, 0.66);
      if (p.distanceTo(G) < 1.2 || secCenters.some((q) => q.p.distanceTo(p) < 0.65)) continue;
      secCenters.push({ p, r: 0.17 + r() * 0.05 });
    }
    const secCells: CellSpec[] = secCenters.flatMap((c) => fibonacciSphere(26, c.r, c.p).map((p) => ({ p, s: 0.045 })));
    const secOo: CellSpec[] = secCenters.map((c) => ({ p: c.p, s: c.r * 0.42 }));

    // Baskın folikülün granüloza hücreleri (birim yön + katman; önü kesik)
    const gran = fibonacciSphere(420, 1)
      .filter((d) => d.z < 0.3)
      .map((d) => ({ d: d.add(jit(0.12)).normalize(), l: r() }));
    const corona: CellSpec[] = fibonacciSphere(24, 0.215).map((p) => ({ p, s: 0.045 }));

    // Hormon yolları
    const nearG = () => G.clone().addScaledVector(dir(), 0.4);
    const fshIn: Hop[] = Array.from({ length: 40 }, () => ({ from: ART.getPointAt(0.6 + r() * 0.4), to: nearG() }));
    const estOut: Hop[] = Array.from({ length: 40 }, () => ({ from: G.clone().addScaledVector(dir(), 0.3), to: VEIN.getPointAt(r() * 0.35) }));

    // Fimbriya saçakları ve tüp kirpikleri
    const fimbriae: CellSpec[] = Array.from({ length: 16 }, (_, i) => {
      const th = (i / 16) * Math.PI * 2;
      const base = new Vector3(0.6 * Math.cos(th), FUNNEL_H, 0.6 * Math.sin(th)).applyQuaternion(FQ).add(NECK);
      const d = new Vector3(Math.cos(th) * 0.75, 0.66, Math.sin(th) * 0.75).normalize().applyQuaternion(FQ);
      return { p: base.addScaledVector(d, 0.16), s: 1, q: faceOut(d) };
    });
    const cilia: CellSpec[] = [];
    for (let k = 0; k < 24; k++) {
      const u = 0.03 + (k / 23) * 0.57;
      const c = TUBE.getPointAt(u);
      const tan = TUBE.getTangentAt(u);
      const n = new Vector3().crossVectors(tan, new Vector3(0, 0, 1));
      if (n.lengthSq() < 1e-4) n.set(1, 0, 0);
      n.normalize();
      const b = new Vector3().crossVectors(tan, n).normalize();
      for (let j = 0; j < 7; j++) {
        const ph = (j / 7) * Math.PI * 2 + u * 3;
        const rd = n.clone().multiplyScalar(Math.cos(ph)).addScaledVector(b, Math.sin(ph));
        cilia.push({ p: c.clone().addScaledVector(rd, TUBE_R - 0.035), s: 1, q: faceOut(rd.clone().negate()) });
      }
    }

    // Endometriyum: bezler, sarmal atardamarlar, dökülen parçalar, hormon girişleri
    const glands = Array.from({ length: 9 }, (_, i) => ({ x: EN.x - 1.05 + (i / 8) * 2.1 + (r() - 0.5) * 0.1, z: EN.z + (r() - 0.5) * 0.8, ph: r() * 6.28 }));
    const spirals = [-0.7, 0.1, 0.8].map((dx) =>
      curve(Array.from({ length: 14 }, (_, i) => [EN.x + dx + 0.09 * Math.cos(i * 1.4), (i / 13) * 0.92, EN.z + 0.25 + 0.09 * Math.sin(i * 1.4)] as V3)),
    );
    const frags = Array.from({ length: 30 }, () => ({ x: EN.x + (r() - 0.5) * 2.2, z: EN.z + (r() - 0.5) * 1.1, dx: 0.4 + r() * 0.9, dz: (r() - 0.3) * 0.8, delay: r() * 0.5, s: 0.05 + r() * 0.05 }));
    const layerPt = () => new Vector3(EN.x + (r() - 0.5) * 2.2, BASE_TOP + 0.1 + r() * 0.35, EN.z + (r() - 0.5) * 1.0);
    const endoIn: Hop[] = Array.from({ length: 30 }, () => ({ from: ENCAP.getPointAt(0.1 + r() * 0.8), to: layerPt() }));

    return { prim, primCells, secCells, secOo, gran, corona, fshIn, estOut, fimbriae, cilia, glands, spirals, frags, endoIn };
  }, []);

  // Aşamaya göre büyüme, luteinleşme, ikincil foliküllerin gerilemesi
  const growth = useEased(stage === 0 ? 0.25 : stage === 1 ? 0.72 : 1, 0.8);
  const luteal = useEased(stage >= 3 ? 1 : 0, 0.8);
  const atresia = useEased(stage >= 2 ? 1 : 0, 0.5);

  const granRef = useRef<InstancedMesh>(null);
  const thecaRef = useRef<Mesh>(null);
  const antrumRef = useRef<Mesh>(null);
  const ooRef = useRef<Group>(null);
  const funcRef = useRef<Mesh>(null);
  const glandRef = useRef<InstancedMesh>(null);
  const spiralRef = useRef<Group>(null);
  const fragRef = useRef<InstancedMesh>(null);
  const clock = useRef({ stage: -1, t: 0, rup: 0, fert: 0, placed: false });
  const phaseRef = useRef(-1);
  const [phase, setPhase] = useState(-1);
  const target = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const t = time.current;
    const ck = clock.current;
    if (ck.stage !== stage) {
      ck.stage = stage;
      ck.t = t;
    }
    const tau = t - ck.t;
    const dt = Math.min(delta, 0.1);
    let moving = false;

    // Yırtılma ve döllenme (yerel zamanla)
    const rupT = stage >= 3 || (stage === 2 && tau > 3.2) ? 1 : 0;
    ck.rup += (rupT - ck.rup) * (1 - Math.exp(-dt * 3));
    const fertT = (stage === 4 && tau > 6.5) || stage === 5 ? 1 : 0;
    ck.fert += (fertT - ck.fert) * (1 - Math.exp(-dt * 2));
    if (Math.abs(rupT - ck.rup) > 1e-3 || Math.abs(fertT - ck.fert) > 1e-3) moving = true;

    const g = growth.current;
    const L = luteal.current;
    const R = 0.16 + 0.46 * g;
    const A = R * 0.74 * clamp01((g - 0.35) / 0.65) * (1 - 0.55 * ck.rup) * (1 - L);

    // Granüloza → korpus luteum
    const gm = granRef.current;
    if (gm) {
      for (let i = 0; i < geo.gran.length; i++) {
        const c = geo.gran[i]!;
        const shell = A + (R - A) * (0.12 + 0.88 * c.l);
        const solid = 0.5 * (0.25 + 0.75 * c.l);
        const rr = shell + (solid - shell) * L;
        const open = c.d.dot(SDIR) > 0.82 ? 1 - ck.rup * (1 - L) : 1;
        P.copy(G).addScaledVector(c.d, rr);
        S.setScalar(0.052 * (1 + 0.25 * L) * open);
        Q.identity();
        M.compose(P, Q, S);
        gm.setMatrixAt(i, M);
        gm.setColorAt(i, C.copy(GRAN).lerp(LUTEAL, L));
      }
      gm.instanceMatrix.needsUpdate = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
    }
    const th = thecaRef.current;
    if (th) th.scale.setScalar(R + 0.06 + (0.56 - (R + 0.06)) * L);
    thecaMat.color.copy(THECA).lerp(LUTEAL, L);
    const an = antrumRef.current;
    if (an) {
      an.scale.setScalar(Math.max(0.001, A));
      an.visible = A > 0.01;
    }

    // Yumurta hücresinin hedef konumu
    const cumulus = P.copy(G).addScaledVector(CUM, A > 0.02 ? A * 0.85 : 0);
    if (stage <= 1) target.copy(cumulus);
    else if (stage === 2) {
      if (tau < 3.5) target.copy(cumulus);
      else if (tau < 5.5) target.copy(cumulus).lerp(OUTSIDE, smooth((tau - 3.5) / 2));
      else if (tau < 8.5) target.copy(OUTSIDE).lerp(MOUTH, smooth((tau - 5.5) / 3));
      else target.copy(MOUTH).lerp(NECK, smooth((tau - 8.5) / 2.5));
    } else if (stage === 3) TUBE.getPointAt(Math.min(0.07, 0.01 + tau * 0.006), target);
    else if (stage === 4) TUBE.getPointAt(0.07 + 0.25 * smooth(tau / 7), target);
    else TUBE.getPointAt(0.32, target);
    const oo = ooRef.current;
    if (oo) {
      if (!ck.placed) {
        oo.position.copy(target);
        ck.placed = true;
      } else oo.position.lerp(target, 1 - Math.exp(-dt * 4));
      if (oo.position.distanceTo(target) > 1e-3) moving = true;
      oo.scale.setScalar(0.55 + 0.45 * g);
    }
    zonaMat.emissiveIntensity = ck.fert * (1.2 + 0.4 * Math.sin(t * 3));

    // Endometriyum döngüsü (yalnızca son aşamada)
    let thick = 0.55;
    let sec = 0.3;
    let men = -1;
    let ph = -1;
    if (stage === 5) {
      const c = (tau / CYCLE) % 1;
      if (c < 0.45) {
        ph = 0;
        thick = 0.22 + 0.53 * (c / 0.45);
        sec = 0;
      } else if (c < 0.78) {
        ph = 1;
        thick = 0.75 + 0.25 * ((c - 0.45) / 0.33);
        sec = smooth((c - 0.45) / 0.15);
      } else {
        ph = 2;
        men = (c - 0.78) / 0.22;
        thick = 1 - 0.78 * men;
        sec = 1 - men;
      }
    }
    if (ph !== phaseRef.current) {
      phaseRef.current = ph;
      setPhase(ph);
    }
    const fm = funcRef.current;
    if (fm) {
      fm.scale.set(1, thick * FUNC_H, 1);
      fm.position.set(EN.x, BASE_TOP + (thick * FUNC_H) / 2, EN.z);
    }
    if (ph === 2) funcMat.color.copy(SECRET).lerp(MENSES, smooth(men * 2));
    else funcMat.color.copy(PROLIF).lerp(SECRET, sec);
    const sp = spiralRef.current;
    if (sp) sp.scale.set(1, thick * FUNC_H, 1);
    const glm = glandRef.current;
    if (glm) {
      for (let i = 0; i < geo.glands.length; i++) {
        const gl = geo.glands[i]!;
        P.set(gl.x, BASE_TOP + thick * FUNC_H * 0.48, gl.z);
        Q.setFromAxisAngle(T.set(0, 0, 1), Math.sin(gl.ph + t * 0.5) * 0.12 * sec);
        S.set(1 + 0.9 * sec, thick * FUNC_H * 0.9, 1 + 0.9 * sec);
        M.compose(P, Q, S);
        glm.setMatrixAt(i, M);
      }
      glm.instanceMatrix.needsUpdate = true;
    }
    const frm = fragRef.current;
    if (frm) {
      for (let i = 0; i < geo.frags.length; i++) {
        const f = geo.frags[i]!;
        const k = men < 0 ? 0 : clamp01((men - f.delay) / (1 - f.delay));
        if (k <= 0 || k >= 1) {
          frm.setMatrixAt(i, HIDE);
          continue;
        }
        P.set(f.x + f.dx * k, BASE_TOP + thick * FUNC_H + k * 0.7 - k * k * 0.3, f.z + f.dz * k);
        Q.setFromAxisAngle(UP, i + k * 3);
        M.compose(P, Q, S.setScalar(f.s * (1 - 0.4 * k)));
        frm.setMatrixAt(i, M);
      }
      frm.instanceMatrix.needsUpdate = true;
    }
    if (moving) invalidate();
  });

  const granKey = stage >= 3 ? 'luteum' : 'granulosa';
  const pickTheca = pickThrough(
    onSelect,
    stage >= 3 ? 'luteum' : 'follicle',
    [
      [oocyteGeo, 'oocyte'],
      [zonaGeo, 'oocyte'],
      [coronaGeo, 'granulosa'],
      [granGeo, granKey],
      [antrumGeo, 'antrum'],
    ],
    1.4,
  );
  const pickAntrum = pickThrough(
    onSelect,
    'antrum',
    [
      [oocyteGeo, 'oocyte'],
      [zonaGeo, 'oocyte'],
      [coronaGeo, 'granulosa'],
    ],
    1.2,
  );
  const pickTube = pickThrough(
    onSelect,
    'fimbria',
    [
      [oocyteGeo, 'oocyte'],
      [zonaGeo, 'oocyte'],
      [ciliaGeo, 'cilia'],
      [spermGeo, 'oocyte'],
    ],
    0.6,
  );

  // Aşamaya bağlı hormon parçacıkları
  const nFsh = stage === 1 ? 40 : 12;
  const nLh = stage === 2 ? 90 : stage === 3 ? 18 : 10;
  const nEst = stage === 1 ? 40 : stage === 2 ? 30 : stage === 3 ? 18 : 10;
  const nProg = stage >= 3 ? 40 : 4;

  return (
    <group ref={root}>
      <ambientLight intensity={0.36} color="#ffe6ee" />
      <directionalLight position={[3, 6, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />

      {/* Yumurtalık */}
      <mesh geometry={shellGeo} material={shellMat} position={OC} onClick={pick('ovary')} />
      <Tubes curves={RIMS} radius={0.05} material={rimMat} onClick={pick('ovary')} segments={200} radial={8} />
      <Tubes curves={VESSELS} radius={0.07} material={vesselMat} onClick={pick('ovary')} segments={60} radial={8} />
      <Cells cells={geo.prim} geometry={primOoGeo} material={primOoMat} onClick={pick('primordial')} />
      <Cells cells={geo.primCells} geometry={cellGeo} material={primCellMat} onClick={pick('primordial')} />
      <Cells cells={geo.secCells} geometry={cellGeo} material={primCellMat} onClick={pick('follicle')} time={time} animate={() => ({ scale: 1 - 0.45 * atresia.current })} />
      <Cells cells={geo.secOo} geometry={primOoGeo} material={primOoMat} onClick={pick('follicle')} time={time} animate={() => ({ scale: 1 - 0.45 * atresia.current })} />

      {/* Baskın folikül → korpus luteum */}
      <instancedMesh ref={granRef} args={[granGeo, granMat, geo.gran.length]} onClick={pick(granKey)} frustumCulled={false} />
      <mesh ref={antrumRef} geometry={antrumGeo} material={antrumMat} position={G} onClick={pickAntrum} />
      <mesh ref={thecaRef} geometry={thecaGeo} material={thecaMat} position={G} onClick={pickTheca} />
      <group ref={ooRef}>
        <mesh geometry={oocyteGeo} material={oocyteMat} scale={0.12} onClick={pick('oocyte')} />
        <mesh geometry={zonaGeo} material={zonaMat} scale={0.155} onClick={pick('oocyte')} />
        <Cells cells={geo.corona} geometry={coronaGeo} material={coronaMat} onClick={pick('granulosa')} />
      </group>

      {/* Hormonlar: FSH/LH atardamarla gelir; östrojen/progesteron toplardamarla çıkar */}
      <CurveMovers curves={ARTS} count={40} shown={nFsh} geometry={molGeo} material={fshMat} time={time} speed={0.07} size={0.04} jitter={0.08} seed={3} onClick={pick('fsh')} />
      <CurveMovers curves={ARTS} count={90} shown={nLh} geometry={molGeo} material={lhMat} time={time} speed={stage === 2 ? 0.11 : 0.07} size={0.042} jitter={0.08} seed={5} onClick={pick('lh')} />
      <CurveMovers curves={VEINS} count={40} shown={nEst} geometry={sterGeo} material={estMat} time={time} speed={0.07} size={0.04} jitter={0.08} seed={7} onClick={pick('estrogen')} />
      <CurveMovers curves={VEINS} count={40} shown={nProg} geometry={sterGeo} material={progMat} time={time} speed={0.07} size={0.04} jitter={0.08} seed={9} onClick={pick('progesterone')} />
      <Hoppers hops={geo.fshIn} count={40} shown={stage <= 1 ? (stage === 1 ? 36 : 10) : 0} geometry={molGeo} material={fshMat} time={time} duration={2.6} size={0.045} seed={11} active={stage <= 1} onClick={pick('fsh')} />
      <Hoppers hops={geo.fshIn} count={60} shown={stage === 2 ? 60 : stage === 3 ? 10 : 0} geometry={molGeo} material={lhMat} time={time} duration={2} size={0.045} seed={13} active={stage === 2 || stage === 3} onClick={pick('lh')} />
      <Hoppers hops={geo.estOut} count={40} shown={stage >= 1 && stage <= 3 ? (stage === 1 ? 36 : 14) : 0} geometry={sterGeo} material={estMat} time={time} duration={2.6} size={0.045} seed={15} active={stage >= 1 && stage <= 3} onClick={pick('estrogen')} />
      <Hoppers hops={geo.estOut} count={40} shown={stage === 3 ? 40 : 0} geometry={sterGeo} material={progMat} time={time} duration={2.4} size={0.045} seed={17} active={stage === 3} onClick={pick('progesterone')} />

      {/* Fallop tüpü: fimbriya, kirpikler, spermler */}
      <mesh geometry={funnelGeo} material={tubeMat} position={NECK} quaternion={FQ} onClick={pickTube} />
      <Tubes curves={TUBES} radius={TUBE_R} material={tubeMat} onClick={pickTube} segments={140} radial={20} />
      <Cells cells={geo.fimbriae} geometry={fimGeo} material={fimMat} onClick={pick('fimbria')} time={time} animate={(i, t) => ({ scale: 1 + (stage === 2 ? 0.2 : 0.08) * Math.sin(t * 2.2 + i * 0.8) })} />
      <Cells cells={geo.cilia} geometry={ciliaGeo} material={ciliaMat} onClick={pick('cilia')} time={time} animate={(i, t) => ({ scale: 1 + 0.35 * Math.sin(t * 7 - Math.floor(i / 7) * 0.7) })} />
      <Swimmers path={TUBE} count={14} shown={stage === 4 ? 14 : 0} time={time} speed={0.05} geometry={spermGeo} material={spermMat} from={1} to={0.35} jitter={0.22} onClick={pick('oocyte')} />

      {/* Rahim iç tabakası */}
      <mesh geometry={baseGeo} material={baseMat} position={EN} onClick={pick('endometrium')} />
      <mesh ref={funcRef} geometry={funcGeo} material={funcMat} onClick={pick('endometrium')} />
      <instancedMesh ref={glandRef} args={[glandGeo, glandMat, geo.glands.length]} onClick={pick('endometrium')} frustumCulled={false} />
      <group ref={spiralRef} position={[0, BASE_TOP, 0]}>
        <Tubes curves={geo.spirals} radius={0.025} material={spiralMat} onClick={pick('endometrium')} segments={60} radial={6} />
      </group>
      <instancedMesh ref={fragRef} args={[fragGeo, fragMat, geo.frags.length]} onClick={pick('endometrium')} frustumCulled={false} />
      <Tubes curves={ENCAPS} radius={0.07} material={vesselMat} onClick={pick('endometrium')} segments={40} radial={8} />
      <Hoppers hops={geo.endoIn} count={30} shown={stage === 5 && phase === 0 ? 30 : 0} geometry={sterGeo} material={estMat} time={time} duration={2.4} size={0.045} seed={19} active={stage === 5 && phase === 0} onClick={pick('estrogen')} />
      <Hoppers hops={geo.endoIn} count={30} shown={stage === 5 && phase === 1 ? 30 : 0} geometry={sterGeo} material={progMat} time={time} duration={2.4} size={0.045} seed={23} active={stage === 5 && phase === 1} onClick={pick('progesterone')} />
    </group>
  );
}
