import { type RefObject, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  type BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
  IcosahedronGeometry,
  type InstancedMesh,
  type Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { Headlight, type InsideSceneProps, type Shot, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, fibonacciSphere, makePick } from '../micro';

/**
 * Hormon salgısı (temsili). Solda hormon üreten bez hücreleri ve içlerindeki salgı granülleri; ortada
 * alyuvarların ve salınan hormon moleküllerinin aktığı bir kılcal damar; sağda iki hedef hücre:
 * üstteki zar reseptörlü (peptit hormon bağlanır → hücre içinde ikincil haberci yayılır), alttaki
 * hücre içi reseptörlü (steroid hormon zardan geçer → reseptörle çekirdeğe girer, DNA parlar).
 * Steroidlerin çoğu taşıyıcı proteinlere (albumin, SHBG) bağlı akar. Son aşamada hipotalamus–hipofiz
 * geri bildirim döngüsü şematik çizilir. Girilen yapıya (origin) göre vurgulanan hormon ailesi ve bez
 * hücresinin rengi değişir. Kişisel düğme: `hormone` (salınan/dolaşan hormon miktarı, 1 = tipik).
 */

type Family = 'peptide' | 'steroid' | 'amine';
interface Look {
  family: Family;
  cell: string;
  glow: string;
}

/** Girilen yapıya göre bez hücresi rengi ve vurgulanan hormon ailesi. */
const LOOKS: Record<string, Look> = {
  pituitary: { family: 'peptide', cell: '#b7a0f2', glow: '#261650' },
  hypothalamus: { family: 'peptide', cell: '#8fb6ff', glow: '#10214d' },
  breasts: { family: 'peptide', cell: '#f4a9c6', glow: '#3d1026' },
  pineal: { family: 'amine', cell: '#8fe3d6', glow: '#0c3a34' },
  adrenals: { family: 'steroid', cell: '#f2c462', glow: '#3d2a06' },
  testes: { family: 'steroid', cell: '#86d0b0', glow: '#0c3322' },
  ovaries: { family: 'steroid', cell: '#f5a0b6', glow: '#3d0e1c' },
};
const DEFAULT_LOOK: Look = { family: 'peptide', cell: '#c9a3e6', glow: '#2a1042' };
const MOLECULE: Record<Family, { color: string; emissive: string }> = {
  peptide: { color: '#ffd166', emissive: '#8a5a00' },
  amine: { color: '#7fe8ff', emissive: '#0e6a80' },
  steroid: { color: '#ff8a4c', emissive: '#8a2a00' },
};
const GRANULE: Record<Family, string> = { peptide: '#ffe08a', amine: '#bff3ff', steroid: '#fff3b8' };

const GLAND = new Vector3(-3.4, 1.6, -0.1);
/** Zar reseptörlü hedef (peptit) ve hücre içi reseptörlü hedef (steroid). */
const T1 = new Vector3(2.4, 1.8, -0.1);
const T2 = new Vector3(3.2, -1.85, -0.1);
const CELL_R = 0.95;
const NUC1 = new Vector3(2.58, 2.0, -0.42);
const NUC2 = new Vector3(3.3, -1.97, -0.36);
const NUC2_R = 0.38;
const HYPO = new Vector3(-0.6, 3.8, -0.8);
const PIT = new Vector3(-0.6, 3.08, -0.8);
/** Hedef hücrelerin kameraya bakan yüzünde açılan kesit (radyan, yarım genişlik). */
const WEDGE = 0.75;

const CAP = curve([
  [-6.4, -0.1, 0.2],
  [-3.4, 0.05, 0.3],
  [-1.0, -0.05, 0.1],
  [1.2, 0.05, 0.1],
  [3.6, -0.05, 0.2],
  [6.4, 0.1, 0],
]);
const CAPS = [CAP];
const SENSE = curve([
  [0.6, 0.1, -0.1],
  [0.9, 1.5, -0.8],
  [0.5, 2.7, -1.0],
  [-0.3, 3.2, -0.85],
]);
const COMMAND = curve([
  [-0.9, 2.9, -0.8],
  [-1.8, 2.95, -0.5],
  [-2.8, 2.75, -0.2],
  [-3.3, 2.35, 0],
]);
const STALK = curve([
  [-0.6, 3.6, -0.8],
  [-0.63, 3.38, -0.78],
  [-0.6, 3.2, -0.8],
]);
const SENSES = [SENSE];
const COMMANDS = [COMMAND];
const LOOP = [SENSE, COMMAND];
const STALKS = [STALK];
const TARGETS: CellSpec[] = [
  { p: T1, s: CELL_R },
  { p: T2, s: CELL_R },
];
const NODES: CellSpec[] = [
  { p: HYPO, s: 0.34, color: '#8fb6ff' },
  { p: PIT, s: 0.26, color: '#c2a6f5' },
];

const SHOTS = [
  { position: [0.2, 1.2, 10.6], target: [0, 0.6, 0] },
  { position: [-2.1, 1.5, 4.4], target: [-3.2, 1.2, 0] },
  { position: [0.8, 0.8, 3.4], target: [0.3, 0, 0.1] },
  { position: [5.2, 0.5, 6.0], target: [2.8, 0, -0.1] },
  { position: [-0.8, 2.4, 8.8], target: [-1.2, 1.8, -0.3] },
] as const;
const ENTRY: Shot = { position: [0.2, 2.4, 14.5], target: [0, 0.6, 0] };

const TMP = new Color();
const RECEPTOR = new Color('#7fe0c0');
const RECEPTOR_ON = new Color('#e8fff8');

/** Nokta (hücre merkezine göre birim yön) kesit penceresinde mi? */
function inWedge(n: Vector3): boolean {
  if (Math.hypot(n.x, n.z) < 0.35) return false;
  return Math.abs(Math.atan2(n.z, -n.x) - Math.PI / 2) < WEDGE + 0.12;
}

/** Saydam bir kabuğa tıklanınca, ışının hemen arkasında seçilebilir bir iç yapı varsa onu seçer. */
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

/** Hareket eden ya da aşamaya göre gizlenip açılan örnekli ağların ışın testi sınırını tazeler. */
function useFreshBounds(root: RefObject<Group | null>) {
  useFrame(() => {
    root.current?.traverse((o) => {
      if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).boundingSphere = null;
    });
  });
}

export default function HormoneScene({ state, onSelect, reducedMotion, params, origin }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#08060d', ['#08060d', 8, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 15 }, ENTRY);
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const root = useRef<Group>(null);
  useFreshBounds(root);

  const look = (origin ? LOOKS[origin] : undefined) ?? DEFAULT_LOOK;
  const family = look.family;
  const steroidMain = family === 'steroid';

  // Geometriler
  const cellGeo = useDisposable(() => bumpySphere(2, 0.08, 4));
  const nucGeo = useDisposable(() => bumpySphere(2, 0.1, 6));
  const granGeo = useDisposable(() => new SphereGeometry(1, 10, 8));
  const wedgeGeo = useDisposable(() => new SphereGeometry(1, 40, 28, Math.PI / 2 + WEDGE, Math.PI * 2 - WEDGE * 2));
  const tnucGeo = useDisposable(() => bumpySphere(2, 0.06, 11));
  const recGeo = useDisposable(() => new CapsuleGeometry(0.35, 1.2, 4, 8));
  const irecGeo = useDisposable(() => new SphereGeometry(1, 12, 10));
  const pepGeo = useDisposable(() => new IcosahedronGeometry(1, 0));
  const sterGeo = useDisposable(() => new CylinderGeometry(1, 1, 0.45, 6));
  const carrierGeo = useDisposable(() => new SphereGeometry(1, 16, 12));
  const small = useDisposable(() => new SphereGeometry(1, 8, 6));
  const nodeGeo = useDisposable(() => new SphereGeometry(1, 24, 16));
  const glowGeo = useDisposable(() => new SphereGeometry(1, 28, 20));
  const rbcGeo = useDisposable(() => rbcGeometry(16));

  // Malzemeler (bez rengi girilen yapıya göre)
  const glandMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: look.cell, roughness: 0.45, transparent: true, opacity: 0.55, emissive: look.glow, emissiveIntensity: 0.55, depthWrite: false }),
    [look.cell, look.glow],
  );
  const glandNucMat = useDisposable(() => new MeshStandardMaterial({ color: '#5b3d8f', roughness: 0.55, emissive: '#1c0c30', emissiveIntensity: 0.5 }));
  const granMat = useDisposable(
    () =>
      new MeshStandardMaterial({
        color: GRANULE[family],
        roughness: family === 'steroid' ? 0.2 : 0.4,
        emissive: family === 'steroid' ? '#5a4a10' : '#6a4a00',
        emissiveIntensity: 0.7,
        transparent: family === 'steroid',
        opacity: family === 'steroid' ? 0.8 : 1,
      }),
    [family],
  );
  const pepMol = MOLECULE[family === 'amine' ? 'amine' : 'peptide'];
  const pepMat = useDisposable(() => new MeshStandardMaterial({ color: pepMol.color, emissive: pepMol.emissive, emissiveIntensity: 1.1, roughness: 0.4 }), [pepMol.color]);
  const sterMat = useDisposable(() => new MeshStandardMaterial({ color: MOLECULE.steroid.color, emissive: MOLECULE.steroid.emissive, emissiveIntensity: 1.1, roughness: 0.35 }));
  const carrierMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#b8d4ff', roughness: 0.3, transparent: true, opacity: 0.45, emissive: '#1a2a4a', emissiveIntensity: 0.5, depthWrite: false }));
  const capMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#d25a66', roughness: 0.35, transparent: true, opacity: 0.24, side: DoubleSide, depthWrite: false }));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const memMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#b9c6ec', roughness: 0.4, transparent: true, opacity: 0.32, side: DoubleSide, depthWrite: false, sheen: 1, sheenColor: new Color('#e8eeff') }),
  );
  const nuc1Mat = useDisposable(() => new MeshStandardMaterial({ color: '#6a5aa8', roughness: 0.55, emissive: '#1a1440', emissiveIntensity: 0.4 }));
  const nuc2Mat = useDisposable(() => new MeshStandardMaterial({ color: '#7a60c8', roughness: 0.5, emissive: '#6a4aff', emissiveIntensity: 0.25, transparent: true, opacity: 0.8 }));
  const chromMat = useDisposable(() => new MeshStandardMaterial({ color: '#d9c8ff', roughness: 0.4, emissive: '#8a6aff', emissiveIntensity: 0.3 }));
  const recMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#0c3a2a', emissiveIntensity: 0.6 }));
  const complexMat = useDisposable(() => new MeshStandardMaterial({ color: '#b8ffc8', emissive: '#2a9a4a', emissiveIntensity: 1.2 }));
  const msgMat = useDisposable(() => new MeshStandardMaterial({ color: '#9ff6ff', emissive: '#2ab8d0', emissiveIntensity: 1.4 }));
  const mrnaMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8ff9a', emissive: '#6a8a10', emissiveIntensity: 1.1 }));
  const glowMat = useDisposable(() => new MeshBasicMaterial({ color: '#7ff0ff', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
  const nodeMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, emissive: '#6a4ad0', emissiveIntensity: 0.15 }));
  const loopMat = useDisposable(() => new MeshStandardMaterial({ color: '#b98cf0', roughness: 0.4, transparent: true, opacity: 0.5, emissive: '#6a3ad0', emissiveIntensity: 0.8, depthWrite: false }));
  const tropicMat = useDisposable(() => new MeshStandardMaterial({ color: '#c9a2ff', emissive: '#5a2ab0', emissiveIntensity: 1.2 }));

  const mainGeo = steroidMain ? sterGeo : pepGeo;
  const mainMat = steroidMain ? sterMat : pepMat;
  const mainKey = steroidMain ? 'steroid' : 'peptide';

  const geo = useMemo(() => {
    const r = rng(83);
    const jit = (s: number) => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(s);
    const inBall = (s: number) => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()) * s);
    const capAt = (x: number) => CAP.getPointAt(Math.max(0.01, Math.min(0.99, (x + 6.4) / 12.8)));

    // Bez hücreleri, çekirdekleri ve granüller (granüller kılcala bakan tarafta yoğun)
    const gland: CellSpec[] = fibonacciSphere(12, 0.8, GLAND).map((p) => ({ p, s: 0.38 + r() * 0.06 }));
    const nuclei: CellSpec[] = gland.map((c) => ({ p: c.p.clone().addScaledVector(c.p.clone().sub(GLAND).normalize(), 0.1).add(new Vector3(0, 0.1, 0)), s: 0.13 }));
    const granules: CellSpec[] = [];
    for (const c of gland) for (let k = 0; k < 7; k++) granules.push({ p: c.p.clone().add(jit(0.36)).add(new Vector3(0, -0.08, 0)), s: 0.038 + r() * 0.014 });
    const low = [...gland].sort((a, b) => a.p.y - b.p.y).slice(0, 7);
    const release: Hop[] = Array.from({ length: 36 }, (_, i) => {
      const c = low[i % low.length]!;
      const from = c.p.clone().add(jit(0.25)).add(new Vector3(0, -0.12, 0));
      return { from, to: capAt(from.x + (r() - 0.5) * 0.8).add(jit(0.3)) };
    });

    // Zar reseptörlü hedef: yüzey reseptörleri, bağlanma ve ikincil haberci
    const receptors: CellSpec[] = [];
    const tips: Vector3[] = [];
    const bases: Vector3[] = [];
    for (const p of fibonacciSphere(46, CELL_R, T1)) {
      const n = p.clone().sub(T1).normalize();
      if (inWedge(n)) continue;
      receptors.push({ p: p.clone().addScaledVector(n, 0.05), s: 0.07, q: faceOut(n) });
      tips.push(p.clone().addScaledVector(n, 0.13));
      bases.push(p.clone().addScaledVector(n, -0.04));
    }
    const lowTips = tips.filter((p) => p.y < T1.y + 0.1);
    const pepBind: Hop[] = Array.from({ length: 30 }, (_, k) => {
      const tip = lowTips[k % lowTips.length]!;
      return { from: capAt(tip.x + (r() - 0.5) * 0.6).add(jit(0.25)), to: tip.clone() };
    });
    const msg: Hop[] = Array.from({ length: 40 }, (_, k) => ({ from: bases[k % bases.length]!.clone(), to: T1.clone().add(inBall(0.62)) }));

    // Hücre içi reseptörlü hedef: steroid zardan girer, reseptörle birleşip çekirdeğe gider
    const irec: CellSpec[] = [];
    while (irec.length < 10) {
      const d = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const p = T2.clone().addScaledVector(d, 0.52 + r() * 0.22);
      if (p.distanceTo(NUC2) < NUC2_R + 0.12) continue;
      irec.push({ p, s: 0.065 });
    }
    const sterIn: Hop[] = Array.from({ length: 30 }, (_, k) => ({ from: capAt(T2.x + (r() - 0.5) * 1.4).add(jit(0.25)), to: irec[k % irec.length]!.p.clone() }));
    const complex: Hop[] = Array.from({ length: 20 }, (_, k) => {
      const p = irec[k % irec.length]!.p;
      return { from: p.clone(), to: NUC2.clone().addScaledVector(p.clone().sub(NUC2).normalize(), NUC2_R * 0.9) };
    });
    const mrna: Hop[] = Array.from({ length: 16 }, () => {
      const d = new Vector3(r() - 0.5, r() - 0.5, r() - 0.3).normalize();
      return { from: NUC2.clone().addScaledVector(d, NUC2_R * 0.9), to: NUC2.clone().addScaledVector(d, 0.78) };
    });
    const chromatin = Array.from({ length: 3 }, () => curve(Array.from({ length: 6 }, () => NUC2.clone().add(inBall(0.26)).toArray() as [number, number, number])));

    return { gland, nuclei, granules, release, receptors, pepBind, msg, irec, sterIn, complex, mrna, chromatin };
  }, []);

  // Kişisel: salınan/dolaşan hormon miktarı (1 = tipik); vurgulanan aile girilen yapıdan gelir.
  const h = Math.max(0.2, Math.min(4, params.hormone ?? 1));
  const circ = scaled(stage >= 2 ? 44 : 34, h, 170);
  const nPep = steroidMain ? 10 : circ;
  const nFree = steroidMain ? Math.max(2, Math.round(circ * 0.3)) : 5;
  const nBound = steroidMain ? Math.round(circ * 0.7) : 8;
  const nRelease = scaled(stage === 1 ? 36 : stage === 0 ? 12 : 16, h, 140);
  const nPepBind = stage === 3 ? (steroidMain ? 8 : scaled(26, h, 80)) : 0;
  const nSterIn = stage === 3 ? (steroidMain ? scaled(24, h, 80) : 6) : 0;
  const nMsg = stage === 3 ? scaled(34, steroidMain ? 0.45 : Math.min(h, 2.5), 90) : 0;
  const nSense = stage === 4 ? scaled(12, h, 48) : 0;
  // Geri bildirim: hormon düzeyi yükseldikçe hipofizden bezi uyaran molekül azalır
  const nCommand = stage === 4 ? Math.max(3, Math.min(60, Math.round(22 / h))) : 0;
  const pepSignal = steroidMain ? 0.45 : Math.min(1.4, 0.55 + 0.3 * h);
  const sterSignal = steroidMain ? Math.min(1.4, 0.55 + 0.3 * h) : 0.45;

  const sig = useEased(stage === 3 ? 1 : 0, 1.4);
  const fb = useEased(stage === 4 ? 1 : 0, 1.4);
  const glowRef = useRef<Mesh>(null);

  useFrame(() => {
    const t = time.current;
    const s = sig.current;
    const g = glowRef.current;
    if (g) {
      // İkincil haberci: zardan içeri yayılan dalga
      const k = (t * 0.45) % 1;
      g.scale.setScalar(0.2 + 0.62 * k);
      glowMat.opacity = s * pepSignal * 0.4 * (1 - k);
      g.visible = glowMat.opacity > 0.003;
    }
    nuc2Mat.emissiveIntensity = 0.25 + s * sterSignal * (1.1 + 0.5 * Math.sin(t * 3));
    chromMat.emissiveIntensity = 0.3 + s * sterSignal * (1.6 + 0.8 * Math.sin(t * 3 + 1));
    nodeMat.emissiveIntensity = 0.15 + fb.current * (0.9 + 0.3 * Math.sin(t * 2.5));
  });

  const pickGland = pickThrough(onSelect, 'gland', [[granGeo, 'granule']], 0.9);
  const pickCap = pickThrough(
    onSelect,
    'capillary',
    [
      [rbcGeo, 'rbc'],
      [pepGeo, 'peptide'],
      [sterGeo, 'steroid'],
      [carrierGeo, 'carrier'],
    ],
    0.9,
  );
  const pickTarget = pickThrough(
    onSelect,
    'target',
    [
      [tnucGeo, 'nucleus'],
      [recGeo, 'receptor'],
      [irecGeo, 'receptor'],
    ],
    2,
  );

  return (
    <group ref={root}>
      <ambientLight intensity={0.35} color="#f0e6ff" />
      <directionalLight position={[3, 6, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />

      {/* Bez hücreleri */}
      <Cells cells={geo.nuclei} geometry={nucGeo} material={glandNucMat} onClick={pick('gland')} />
      <Cells
        cells={geo.granules}
        geometry={granGeo}
        material={granMat}
        onClick={pick('granule')}
        time={time}
        animate={(i, t) => ({ scale: stage === 1 ? 1 + 0.3 * Math.sin(t * 4 + i * 0.9) : 1 })}
      />
      <Cells cells={geo.gland} geometry={cellGeo} material={glandMat} onClick={pickGland} time={time} animate={(i, t) => ({ scale: 1 + (stage === 1 ? 0.04 : 0.015) * Math.sin(t * 2.2 + i) })} />
      <Hoppers hops={geo.release} count={140} shown={nRelease} geometry={mainGeo} material={mainMat} time={time} duration={2.6} size={0.055} seed={5} onClick={pick(mainKey)} />

      {/* Kılcal damar: alyuvarlar, serbest hormonlar, taşıyıcıya bağlı steroidler */}
      <Tubes curves={CAPS} radius={0.44} material={capMat} onClick={pickCap} segments={120} radial={24} />
      <CurveMovers curves={CAPS} count={30} geometry={rbcGeo} material={rbcMat} time={time} speed={0.045} size={0.26} flat jitter={0.34} seed={3} onClick={pick('rbc')} />
      <CurveMovers curves={CAPS} count={170} shown={nPep} geometry={pepGeo} material={pepMat} time={time} speed={0.05} size={0.055} jitter={0.52} seed={7} onClick={pick('peptide')} />
      <CurveMovers curves={CAPS} count={60} shown={nFree} geometry={sterGeo} material={sterMat} time={time} speed={0.05} size={0.06} jitter={0.52} seed={11} onClick={pick('steroid')} />
      {/* Aynı tohum/sayı: bağlı steroid, taşıyıcı proteinin tam ortasında akar */}
      <CurveMovers curves={CAPS} count={120} shown={nBound} geometry={carrierGeo} material={carrierMat} time={time} speed={0.042} size={0.13} jitter={0.46} seed={17} onClick={pick('carrier')} />
      <CurveMovers curves={CAPS} count={120} shown={nBound} geometry={sterGeo} material={sterMat} time={time} speed={0.042} size={0.045} jitter={0.46} seed={17} onClick={pick('carrier')} />

      {/* Hedef hücreler (önü kesik) */}
      <Cells cells={TARGETS} geometry={wedgeGeo} material={memMat} onClick={pickTarget} />
      <mesh geometry={tnucGeo} material={nuc1Mat} position={NUC1} scale={0.34} onClick={pick('nucleus')} />
      <mesh geometry={tnucGeo} material={nuc2Mat} position={NUC2} scale={NUC2_R} onClick={pick('nucleus')} />
      <Tubes curves={geo.chromatin} radius={0.018} material={chromMat} onClick={pick('nucleus')} segments={40} radial={5} />
      <Cells
        cells={geo.receptors}
        geometry={recGeo}
        material={recMat}
        onClick={pick('receptor')}
        time={time}
        animate={(i, t, out) => {
          if (stage !== 3) {
            out.copy(RECEPTOR);
            return { color: true };
          }
          const k = 0.5 + 0.5 * Math.sin(t * 4 + i * 0.7);
          out.copy(RECEPTOR).lerp(RECEPTOR_ON, k * pepSignal * 0.7);
          return { color: true, scale: 1 + 0.12 * k };
        }}
      />
      <Cells
        cells={geo.irec}
        geometry={irecGeo}
        material={recMat}
        onClick={pick('receptor')}
        time={time}
        animate={(i, t, out) => {
          out.copy(RECEPTOR).lerp(TMP.set('#b8ffc8'), stage === 3 ? 0.5 + 0.5 * Math.sin(t * 3 + i) : 0);
          return { color: true };
        }}
      />
      <mesh ref={glowRef} geometry={glowGeo} material={glowMat} position={T1} raycast={() => null} />
      <Hoppers hops={geo.pepBind} count={80} shown={nPepBind} geometry={pepGeo} material={pepMat} time={time} duration={2.4} size={0.055} seed={9} active={stage === 3} onClick={pick('peptide')} />
      <Hoppers hops={geo.msg} count={90} shown={nMsg} geometry={small} material={msgMat} time={time} duration={1.8} size={0.035} seed={13} active={stage === 3} onClick={pick('messenger')} />
      <Hoppers hops={geo.sterIn} count={80} shown={nSterIn} geometry={sterGeo} material={sterMat} time={time} duration={2.8} size={0.06} seed={15} active={stage === 3} onClick={pick('steroid')} />
      <Hoppers hops={geo.complex} count={20} shown={stage === 3 ? 20 : 0} geometry={small} material={complexMat} time={time} duration={2.2} size={0.05} seed={19} active={stage === 3} onClick={pick('receptor')} />
      <Hoppers hops={geo.mrna} count={16} shown={stage === 3 ? 16 : 0} geometry={small} material={mrnaMat} time={time} duration={2.6} size={0.03} seed={23} active={stage === 3} onClick={pick('nucleus')} />

      {/* Geri bildirim: hipotalamus–hipofiz (şema) */}
      <Cells cells={NODES} geometry={nodeGeo} material={nodeMat} onClick={pick('feedback')} />
      <Tubes curves={STALKS} radius={0.07} material={loopMat} onClick={pick('feedback')} segments={12} radial={8} />
      {stage === 4 && <Tubes curves={LOOP} radius={0.045} material={loopMat} onClick={pick('feedback')} segments={60} radial={8} />}
      <CurveMovers curves={SENSES} count={48} shown={nSense} geometry={mainGeo} material={mainMat} time={time} speed={0.12} size={0.05} seed={29} onClick={pick('feedback')} />
      <CurveMovers curves={COMMANDS} count={60} shown={nCommand} geometry={pepGeo} material={tropicMat} time={time} speed={0.12} size={0.055} seed={31} onClick={pick('feedback')} />
    </group>
  );
}
