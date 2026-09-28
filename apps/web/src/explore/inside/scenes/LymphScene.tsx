import { type RefObject, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import {
  type BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  type Group,
  type InstancedMesh,
  type Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, type Shot, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, fibonacciSphere, makePick } from '../micro';

/**
 * Lenf düğümü ve bağışıklık yanıtı (temsili). Fasulye biçimli düğüm önden kesik çizilir: arkada
 * yarı saydam kapsül; kortekste B hücresi folikülleri ve parlak germinal merkezler, daha derinde T
 * hücrelerinin parakorteksi, ortada medulla kordonları. Dışbükey yüzden giren getirici lenf
 * damarları antijen ve dendritik hücre taşır; göbekten (hilus) götürücü lenf damarı ve kan damarı
 * çıkar. Aşamalar: lenf akışı, antijen sunumu, T/B çoğalması, plazma hücrelerinden antikor salgısı
 * ve bellek hücreleri. Kişisel düğmeler: `lymph` (T/B hücre sayısı), `inflam` (CRP, üst sınırın
 * katı; 0,5 = aralık içi), `wbc` (kan damarındaki akyuvarlar).
 */

const BEAN = { x: 3.4, y: 2.3, z: 1.25 };
type V3 = [number, number, number];

/** Fasulye kesit çizgisi: a açısı, f içe doğru oran (1 = kapsül), z derinlik. */
function outline(a: number, f: number, z = 0): Vector3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dent = 0.5 * Math.exp(-(c * c) / 0.1) * Math.max(0, -s);
  return new Vector3(BEAN.x * f * c, BEAN.y * f * (s + dent), z);
}
const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];

const HILUM = new Vector3(0.1, -1.1, -0.3);
const EFF: V3[] = [
  [0.1, -1.1, -0.3],
  [0.3, -2.2, 0.0],
  [0.9, -3.6, 0.3],
  [1.5, -5.2, 0.5],
];
const EFFERENT = curve(EFF);
const EFFERENTS = [EFFERENT];
const AFF_ANGLES = [0.55, 1.57, 2.6];
const FOL_ANGLES = [0.32, 0.78, 1.3, 1.84, 2.36, 2.82];
const P_DC = outline(1.05, 0.46, -0.3);
const FLOWS = AFF_ANGLES.map((a) =>
  curve([v3(outline(a, 1.75, 0.45)), v3(outline(a, 1.3, 0.2)), v3(outline(a, 0.97, -0.15)), v3(outline(a, 0.72, -0.35)), v3(outline(a, 0.48, -0.5)), v3(outline(a, 0.24, -0.5)), [0.05, -0.72, -0.45], ...EFF]),
);
const DC_PATHS = AFF_ANGLES.map((a) => curve([v3(outline(a, 1.75, 0.45)), v3(outline(a, 1.3, 0.2)), v3(outline(a, 0.97, -0.15)), v3(outline(a, 0.7, -0.35)), v3(outline(a, 0.5, -0.45))]));
const AFFERENTS = AFF_ANGLES.map((a) => curve([v3(outline(a, 1.75, 0.45)), v3(outline(a, 1.3, 0.2)), v3(outline(a, 0.99, -0.12))]));
const LYMPH_VESSELS = [...AFFERENTS, EFFERENT];
const RIM = curve(
  Array.from({ length: 72 }, (_, i) => v3(outline((i / 72) * Math.PI * 2, 1, 0))),
  true,
);
const RIMS = [RIM];
const CORDS = [-1.8, -1.1, -0.4, 0.4, 1.1, 1.8].map((x0) =>
  curve([
    [x0, -0.05, -0.5],
    [x0 * 0.72, -0.45, -0.55],
    [x0 * 0.35, -0.82, -0.45],
    [x0 * 0.05 + 0.1, -1.02, -0.35],
  ]),
);
const VESSEL = curve([
  [-1.6, -5.2, 0.5],
  [-0.9, -3.4, 0.2],
  [-0.35, -1.9, -0.1],
  [-0.25, -1.0, -0.5],
  [-0.8, -0.1, -0.7],
  [-1.6, 0.5, -0.75],
  [-2.4, 0.35, -0.8],
]);
const VESSELS = [VESSEL];

const SHOTS = [
  { position: [0.2, 0.4, 10.5], target: [0, -0.4, 0] },
  { position: [2.2, 3.4, 5.4], target: [1.2, 1.3, -0.2] },
  { position: [1.3, 1.2, 3.0], target: [0.78, 0.92, -0.3] },
  { position: [0.4, 2.0, 4.2], target: [0.5, 1.2, -0.3] },
  { position: [1.6, -2.0, 5.0], target: [0.3, -1.5, -0.3] },
  { position: [-1.0, 0.6, 7.2], target: [0, 0, -0.2] },
] as const;
const ENTRY: Shot = { position: [0.2, 1.5, 14.5], target: [0, -0.4, 0] };

const T_COLOR = new Color('#5fd3b0');
const T_ON = new Color('#d8fff0');
const MEM = new Color('#ffd36b');
const MEM_ON = new Color('#fff4c8');

/** Arka yarı fasulye kabuğu (göbek tarafında hafif çukur). */
function beanShell(): BufferGeometry {
  const g = new SphereGeometry(1, 72, 40, Math.PI, Math.PI);
  const pos = g.attributes.position!;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.y += 0.5 * Math.exp(-(v.x * v.x) / 0.1) * Math.max(0, -v.y);
    pos.setXYZ(i, v.x * BEAN.x, v.y * BEAN.y, v.z * BEAN.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Gövde + dışa uzanan koniler (dendritik hücre, dikenli antijen). */
function spiky(bodyR: number, arms: number, coneR: number, coneH: number, seed: number): BufferGeometry {
  const r = rng(seed);
  const parts: BufferGeometry[] = [new SphereGeometry(bodyR, 14, 10)];
  for (const d of fibonacciSphere(arms, 1)) {
    const cone = new ConeGeometry(coneR, coneH, 6);
    cone.translate(0, bodyR * 0.8 + coneH / 2, 0);
    cone.applyQuaternion(faceOut(d.add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.5))));
    parts.push(cone);
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Y biçimli antikor. */
function antibody(): BufferGeometry {
  const stem = new CapsuleGeometry(0.13, 0.6, 3, 6).translate(0, -0.35, 0);
  const left = new CapsuleGeometry(0.12, 0.55, 3, 6).rotateZ(0.6).translate(-0.24, 0.26, 0);
  const right = new CapsuleGeometry(0.12, 0.55, 3, 6).rotateZ(-0.6).translate(0.24, 0.26, 0);
  const g = mergeGeometries([stem, left, right])!;
  [stem, left, right].forEach((p) => p.dispose());
  return g;
}

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

export default function LymphScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#07080d', ['#07080d', 8, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 15 }, ENTRY);
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const root = useRef<Group>(null);
  useFreshBounds(root);

  // Kişisel düğmeler
  const lymph = Math.max(0.05, params.lymph ?? 1);
  const wbc = Math.max(0.05, params.wbc ?? 1);
  const inflam = Math.max(0, Math.min(8, params.inflam ?? 0.5));
  /** CRP aralık içindeyse 1; üst sınırı aştıkça antijen ve etkinleşme artar (en çok 4 kat). */
  const af = inflam <= 1 ? 1 : Math.min(4, 1 + (inflam - 1) * 0.6);

  const shellGeo = useDisposable(() => beanShell());
  const cellGeo = useDisposable(() => bumpySphere(2, 0.08, 5));
  const bGeo = useDisposable(() => bumpySphere(2, 0.08, 8));
  const plasmaGeo = useDisposable(() => bumpySphere(2, 0.1, 13));
  const macGeo = useDisposable(() => bumpySphere(3, 0.2, 9));
  const memGeo = useDisposable(() => bumpySphere(2, 0.06, 17));
  const folGeo = useDisposable(() => new SphereGeometry(1, 28, 20));
  const gcGeo = useDisposable(() => new SphereGeometry(1, 24, 16));
  const zoneGeo = useDisposable(() => new SphereGeometry(1, 20, 12));
  const dcGeo = useDisposable(() => spiky(1, 7, 0.24, 1.6, 3));
  const agGeo = useDisposable(() => spiky(0.55, 10, 0.16, 0.55, 7));
  const abGeo = useDisposable(() => antibody());
  const dot = useDisposable(() => new SphereGeometry(1, 6, 4));
  const small = useDisposable(() => new SphereGeometry(1, 8, 6));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const wbcGeo = useDisposable(() => bumpySphere(2, 0.18, 21));

  const shellMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#e8b4a0', roughness: 0.5, transparent: true, opacity: 0.26, side: DoubleSide, depthWrite: false, emissive: '#3a1a10', emissiveIntensity: 0.4 }),
  );
  const rimMat = useDisposable(() => new MeshStandardMaterial({ color: '#d99a88', roughness: 0.6, emissive: '#2a1008', emissiveIntensity: 0.3 }));
  const folMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#9fb0ff', roughness: 0.4, transparent: true, opacity: 0.16, depthWrite: false, emissive: '#1a2250', emissiveIntensity: 0.5 }));
  const gcMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.55, emissive: '#b08a20', emissiveIntensity: 0.5, depthWrite: false }));
  const zoneMat = useDisposable(() => new MeshStandardMaterial({ color: '#3f8f80', transparent: true, opacity: 0.16, depthWrite: false, emissive: '#0c3a30', emissiveIntensity: 0.5 }));
  const bMat = useDisposable(() => new MeshStandardMaterial({ color: '#6f9bff', roughness: 0.5, emissive: '#10204a', emissiveIntensity: 0.5 }));
  const bOnMat = useDisposable(() => new MeshStandardMaterial({ color: '#b8d0ff', roughness: 0.45, emissive: '#3050c0', emissiveIntensity: 0.8 }));
  const tMat = useDisposable(() => new MeshStandardMaterial({ color: '#5fd3b0', roughness: 0.5, emissive: '#0c3a2a', emissiveIntensity: 0.5 }));
  const tAnimMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#0c4a3a', emissiveIntensity: 0.6 }));
  const plasmaMat = useDisposable(() => new MeshStandardMaterial({ color: '#e79cff', roughness: 0.5, emissive: '#3a1050', emissiveIntensity: 0.5 }));
  const macMat = useDisposable(() => new MeshStandardMaterial({ color: '#d8b48a', roughness: 0.6, emissive: '#2a1a08', emissiveIntensity: 0.4 }));
  const dcMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9a6a', roughness: 0.5, emissive: '#5a2008', emissiveIntensity: 0.6 }));
  const agMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff4d6d', roughness: 0.4, emissive: '#7a0a20', emissiveIntensity: 0.9 }));
  const fragMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9ab0', emissive: '#c02050', emissiveIntensity: 1.4 }));
  const abMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff27a', roughness: 0.4, emissive: '#8a7a10', emissiveIntensity: 1 }));
  const memMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#6a4a00', emissiveIntensity: 0.8 }));
  const lymphVMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f0e0b0', roughness: 0.35, transparent: true, opacity: 0.38, side: DoubleSide, depthWrite: false }));
  const cordMat = useDisposable(() => new MeshStandardMaterial({ color: '#d88fa0', roughness: 0.55, transparent: true, opacity: 0.7, emissive: '#2a0a12', emissiveIntensity: 0.4 }));
  const vesselMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#c8323f', roughness: 0.4, transparent: true, opacity: 0.45, side: DoubleSide, depthWrite: false }));
  const fluidMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff6d0', transparent: true, opacity: 0.6, emissive: '#5a5020', emissiveIntensity: 0.6 }));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const wbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#eef0f8', roughness: 0.6, emissive: '#1a2030', emissiveIntensity: 0.3 }));

  const geo = useMemo(() => {
    const r = rng(97);
    const jit = (s: number) => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(s);
    const dir = () => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();

    // Foliküller (B hücresi), germinal merkezler
    const fol = FOL_ANGLES.map((a) => ({ c: outline(a, 0.76, -0.35), r: 0.38 + r() * 0.08 }));
    const follicles: CellSpec[] = fol.map((f) => ({ p: f.c, s: f.r }));
    const germinal: CellSpec[] = fol.map((f) => ({ p: f.c.clone().add(new Vector3(0, 0, -0.04)), s: f.r * 0.42 }));
    const bAll: CellSpec[] = [];
    for (let k = 0; k < 55; k++)
      for (const f of fol) {
        let d = jit(2);
        for (let n = 0; n < 40 && (d.lengthSq() > 1 || d.lengthSq() < 0.3 || d.z > 0.2); n++) d = jit(2);
        bAll.push({ p: f.c.clone().addScaledVector(d, f.r * 0.95), s: 0.05 + r() * 0.01 });
      }

    // Parakorteks: T hücreleri ve arkadaki bölge
    const tAll: CellSpec[] = [];
    for (let n = 0; tAll.length < 300 && n < 5000; n++) {
      const p = outline(0.35 + r() * 2.45, 0.3 + r() * 0.28, -0.8 + r() * 0.82);
      if (p.distanceTo(P_DC) < 0.42) continue;
      tAll.push({ p, s: 0.056 + r() * 0.012 });
    }
    const zone: CellSpec[] = [0.45, 0.9, 1.35, 1.8, 2.25, 2.7].map((a) => ({ p: outline(a, 0.46, -0.95), s: new Vector3(0.62, 0.42, 0.1) }));

    // Dendritik hücreler, eşleşen T hücreleri, klonlar
    const dcs: CellSpec[] = [P_DC, outline(1.95, 0.44, -0.35), outline(2.3, 0.42, -0.4), outline(0.2, 0.44, -0.35)].map((p) => ({ p, s: 0.14, q: faceOut(dir()) }));
    const partners: CellSpec[] = fibonacciSphere(8, 0.3, P_DC).map((p) => ({ p, s: 0.066 }));
    const cloneT: CellSpec[] = Array.from({ length: 36 }, () => {
      const p = P_DC.clone().addScaledVector(dir(), 0.36 + r() * 0.4);
      p.z = Math.max(-0.9, Math.min(0.1, p.z));
      return { p, s: 0.06 };
    });
    const present: Hop[] = Array.from({ length: 24 }, (_, i) => ({ from: P_DC.clone(), to: partners[i % partners.length]!.p.clone() }));
    const tDivide: Hop[] = Array.from({ length: 16 }, (_, i) => {
      const p = partners[i % partners.length]!.p;
      return { from: p.clone(), to: p.clone().addScaledVector(p.clone().sub(P_DC).normalize(), 0.3).add(jit(0.1)) };
    });
    const gc2 = fol[2]!.c;
    const cloneB: CellSpec[] = Array.from({ length: 30 }, () => {
      let d = dir();
      if (d.z > 0.2) d = d.setZ(-Math.abs(d.z)).normalize();
      return { p: gc2.clone().addScaledVector(d, 0.1 + r() * 0.2), s: 0.048 };
    });
    const bDivide: Hop[] = fol.flatMap((f) => Array.from({ length: 4 }, () => {
      const from = f.c.clone().add(jit(0.1));
      return { from, to: from.clone().addScaledVector(dir(), 0.22) };
    }));

    // Medulla: plazma hücreleri, antikorlar; makrofajlar
    const plasma: CellSpec[] = Array.from({ length: 14 }, (_, i) => ({ p: CORDS[i % CORDS.length]!.getPointAt(0.2 + r() * 0.65).add(jit(0.16)), s: 0.085 }));
    const bToPlasma: Hop[] = plasma.map((c, i) => ({ from: fol[(i * 2) % fol.length]!.c.clone(), to: c.p.clone() }));
    const abOut: Hop[] = Array.from({ length: 42 }, (_, i) => ({ from: plasma[i % plasma.length]!.p.clone(), to: HILUM.clone().add(jit(0.2)) }));
    const macs: CellSpec[] = [
      ...AFF_ANGLES.map((a) => outline(a + 0.12, 0.9, -0.25)),
      ...[1, 2, 3, 4].map((i) => CORDS[i]!.getPointAt(0.55).add(new Vector3(0.12, 0.05, 0.1))),
    ].map((p) => ({ p, s: 0.15, q: faceOut(dir()) }));
    const eat: Hop[] = macs.flatMap((m) => Array.from({ length: 6 }, () => ({ from: m.p.clone().addScaledVector(dir(), 0.45), to: m.p.clone() })));

    // Bellek hücreleri: parakortekste ve folikül kenarlarında
    const memory: CellSpec[] = [
      ...Array.from({ length: 5 }, () => {
        const p = P_DC.clone().addScaledVector(dir(), 0.85 + r() * 0.12);
        p.z = Math.max(-0.9, Math.min(0.1, p.z));
        return p;
      }),
      ...fol.slice(0, 5).map((f) => f.c.clone().addScaledVector(new Vector3(r() - 0.5, -0.8, -0.2).normalize(), f.r * 1.05)),
    ].map((p) => ({ p, s: 0.066 }));

    // Kandan parakortekse giren lenfositler
    const hev: Hop[] = Array.from({ length: 20 }, () => {
      const from = VESSEL.getPointAt(0.6 + r() * 0.35);
      const to = from.clone().addScaledVector(dir(), 0.4);
      to.z = Math.max(-0.9, Math.min(0.05, to.z));
      return { from, to };
    });

    return { follicles, germinal, bAll, tAll, zone, dcs, partners, cloneT, present, tDivide, cloneB, bDivide, plasma, bToPlasma, abOut, macs, eat, memory, hev };
  }, []);

  const nT = scaled(120, lymph, 300);
  const nB = scaled(150, lymph, 330);
  const tCells = useMemo(() => geo.tAll.slice(0, nT), [geo, nT]);
  const bCells = useMemo(() => geo.bAll.slice(0, nB), [geo, nB]);

  const grow = useEased(stage >= 3 ? 1 : 0, 0.7);
  const act = useEased(stage >= 2 ? 1 : 0, 1.2);
  const mem = useEased(stage === 5 ? 1 : 0, 1.2);
  const gcAct = Math.min(1.75, 1 + (af - 1) * 0.25);

  useFrame(() => {
    gcMat.emissiveIntensity = 0.4 + 0.25 * (af - 1) + 0.7 * grow.current;
  });

  const pickFollicle = pickThrough(
    onSelect,
    'follicle',
    [
      [gcGeo, 'germinal'],
      [bGeo, 'bcell'],
    ],
    0.9,
  );

  return (
    <group ref={root}>
      <ambientLight intensity={0.38} color="#e8f0ff" />
      <directionalLight position={[3, 6, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />

      {/* Kapsül ve kesit kenarı */}
      <mesh geometry={shellGeo} material={shellMat} onClick={pick('capsule')} />
      <Tubes curves={RIMS} radius={0.06} material={rimMat} onClick={pick('capsule')} segments={220} radial={8} />

      {/* Korteks: foliküller */}
      <Cells cells={geo.follicles} geometry={folGeo} material={folMat} onClick={pickFollicle} />
      <Cells
        cells={geo.germinal}
        geometry={gcGeo}
        material={gcMat}
        onClick={pick('germinal')}
        time={time}
        animate={(i, t) => ({ scale: gcAct * (1 + 0.5 * grow.current) * (1 + 0.03 * Math.sin(t * 2 + i)) })}
      />
      <Cells cells={bCells} geometry={bGeo} material={bMat} onClick={pick('bcell')} />
      <Cells cells={geo.cloneB} geometry={bGeo} material={bOnMat} onClick={pick('bcell')} time={time} animate={(i) => ({ scale: Math.max(0, Math.min(1, grow.current * 1.6 - (i % 10) * 0.06)) })} />
      <Hoppers hops={geo.bDivide} count={24} shown={stage === 3 ? 24 : 0} geometry={bGeo} material={bOnMat} time={time} duration={2.4} size={0.05} seed={31} active={stage === 3} onClick={pick('bcell')} />

      {/* Parakorteks: T hücreleri ve antijen sunumu */}
      <Cells cells={geo.zone} geometry={zoneGeo} material={zoneMat} onClick={pick('paracortex')} />
      <Cells cells={tCells} geometry={cellGeo} material={tMat} onClick={pick('tcell')} />
      <Cells cells={geo.dcs} geometry={dcGeo} material={dcMat} onClick={pick('dendritic')} time={time} animate={(i, t) => ({ scale: 1 + (i === 0 ? 0.08 * act.current : 0.03) * Math.sin(t * 2.5 + i) })} />
      <Cells
        cells={geo.partners}
        geometry={cellGeo}
        material={tAnimMat}
        onClick={pick('tcell')}
        time={time}
        animate={(i, t, out) => {
          const k = act.current * Math.min(1, af * 0.8) * (0.5 + 0.5 * Math.sin(t * 3 + i));
          out.copy(T_COLOR).lerp(T_ON, k);
          return { color: true, scale: 1 + 0.12 * k };
        }}
      />
      <Cells
        cells={geo.cloneT}
        geometry={cellGeo}
        material={tAnimMat}
        onClick={pick('tcell')}
        time={time}
        animate={(i, _t, out) => {
          out.copy(T_COLOR).lerp(T_ON, 0.45);
          return { color: true, scale: Math.max(0, Math.min(1, grow.current * 1.6 - (i % 12) * 0.05)) };
        }}
      />
      <Hoppers hops={geo.present} count={24} shown={stage === 2 ? 24 : 0} geometry={small} material={fragMat} time={time} duration={1.8} size={0.028} seed={11} active={stage === 2} onClick={pick('antigen')} />
      <Hoppers hops={geo.tDivide} count={16} shown={stage === 3 ? 16 : 0} geometry={cellGeo} material={tMat} time={time} duration={2.2} size={0.06} seed={13} active={stage === 3} onClick={pick('tcell')} />
      <Hoppers hops={geo.hev} count={30} shown={stage <= 1 ? scaled(10, lymph, 30) : 0} geometry={cellGeo} material={tMat} time={time} duration={3.4} size={0.056} seed={17} active={stage <= 1} onClick={pick('tcell')} />

      {/* Medulla: kordonlar, plazma hücreleri, antikorlar */}
      <Tubes curves={CORDS} radius={0.09} material={cordMat} onClick={pick('medulla')} segments={40} radial={8} />
      <Cells cells={geo.plasma} geometry={plasmaGeo} material={plasmaMat} onClick={pick('plasma')} time={time} animate={(i, t) => ({ scale: stage === 4 ? 1 + 0.1 * Math.sin(t * 4 + i) : 1 })} />
      <Hoppers hops={geo.bToPlasma} count={14} shown={stage === 4 ? 14 : 0} geometry={bGeo} material={bOnMat} time={time} duration={4} size={0.05} seed={19} active={stage === 4} onClick={pick('bcell')} />
      <Hoppers hops={geo.abOut} count={84} shown={stage >= 4 ? scaled(42, Math.min(af, 2), 84) : 0} geometry={abGeo} material={abMat} time={time} duration={2.6} size={0.075} seed={23} active={stage >= 4} onClick={pick('antibody')} />
      <CurveMovers curves={EFFERENTS} count={70} shown={stage >= 4 ? scaled(34, Math.min(af, 2), 70) : 0} geometry={abGeo} material={abMat} time={time} speed={0.09} size={0.075} jitter={0.18} seed={29} onClick={pick('antibody')} />

      {/* Makrofajlar antijen yutar */}
      <Cells cells={geo.macs} geometry={macGeo} material={macMat} onClick={pick('macrophage')} time={time} animate={(i, t) => ({ scale: 1 + 0.06 * Math.sin(t * 2 + i) })} />
      <Hoppers hops={geo.eat} count={42} shown={stage >= 1 ? scaled(20, af, 42) : 0} geometry={agGeo} material={agMat} time={time} duration={2.8} size={0.05} seed={37} active={stage >= 1} onClick={pick('antigen')} />

      {/* Lenf damarları ve akış */}
      <Tubes curves={LYMPH_VESSELS} radius={0.16} material={lymphVMat} onClick={pick('lymphvessel')} segments={60} radial={12} />
      <CurveMovers curves={FLOWS} count={90} geometry={dot} material={fluidMat} time={time} speed={0.03} size={0.025} jitter={0.2} seed={41} onClick={pick('lymphvessel')} />
      <CurveMovers curves={FLOWS} count={100} shown={scaled(stage === 1 ? 30 : 18, af, 100)} geometry={agGeo} material={agMat} time={time} speed={0.03} size={0.06} jitter={0.14} seed={43} onClick={pick('antigen')} />
      <CurveMovers curves={DC_PATHS} count={14} shown={scaled(stage === 1 ? 5 : 3, af, 14)} geometry={dcGeo} material={dcMat} time={time} speed={0.035} size={0.11} jitter={0.1} tumble={0.3} seed={47} onClick={pick('dendritic')} />

      {/* Kan damarı */}
      <Tubes curves={VESSELS} radius={0.14} material={vesselMat} onClick={pick('vessel')} segments={80} radial={12} />
      <CurveMovers curves={VESSELS} count={26} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={0.12} flat jitter={0.1} seed={53} onClick={pick('vessel')} />
      <CurveMovers curves={VESSELS} count={48} shown={scaled(8, wbc, 48)} geometry={wbcGeo} material={wbcMat} time={time} speed={0.035} size={0.075} jitter={0.1} seed={59} onClick={pick('vessel')} />

      {/* Bellek hücreleri */}
      <Cells
        cells={geo.memory}
        geometry={memGeo}
        material={memMat}
        onClick={pick('tcell')}
        time={time}
        animate={(i, t, out) => {
          out.copy(MEM).lerp(MEM_ON, 0.5 + 0.5 * Math.sin(t * 2.4 + i));
          return { color: true, scale: mem.current * (1 + 0.08 * Math.sin(t * 2 + i)) };
        }}
      />
      <CurveMovers curves={EFFERENTS} count={6} shown={stage === 5 ? 6 : 0} geometry={memGeo} material={memMat} time={time} speed={0.06} size={0.066} jitter={0.14} seed={61} onClick={pick('tcell')} />
    </group>
  );
}
