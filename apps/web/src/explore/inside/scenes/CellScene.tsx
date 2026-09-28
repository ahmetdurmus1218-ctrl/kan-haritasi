import { useMemo } from 'react';
import {
  type BufferGeometry,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Headlight, type InsideSceneProps, bumpySphere, rng, scaled, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, fibonacciSphere, makePick } from '../micro';

/**
 * Hücre ve enerji (genel, temsili hücre modeli). Önü kesik büyük bir hücre: yarı saydam zar,
 * nükleer porlu çekirdek ve çekirdekçik, ribozomlu (granüllü) ER, Golgi yığını, kristalı
 * mitokondriler, lizozomlar. mRNA çekirdekten ribozomlara gider; proteinler ER’de yapılıp
 * Golgi’de paketlenir ve keseciklerle zara taşınır. Glukoz taşıyıcılardan girer, mitokondride
 * oksijenle birlikte ATP’ye dönüşür; zar reseptörüne bağlanan hormon hücre içine sinyal gönderir.
 * Gerçek hücreler organa göre çok farklıdır; girilen yapıya göre yalnızca zar rengi hafifçe değişir.
 */

const RC = 4.2;
const WEDGE = 0.7;
const NC = new Vector3(-1.1, 0.3, -0.4);
const NR = 1.3;
const GC = new Vector3(1.9, -1.0, 0.4);
const ER_LAYERS = 4;
const MITO: [number, number, number][] = [
  [1.2, 1.9, -0.8],
  [2.6, 0.6, -1.2],
  [0.4, -2.2, -0.5],
  [-2.4, -1.9, 0.3],
  [-2.8, 1.6, -0.6],
  [0.6, 0.8, 1.9],
  [-0.6, -1.4, 2.0],
  [2.4, -2.0, -1.0],
];
const LYSO: [number, number, number][] = [
  [-2.0, -0.4, 1.8],
  [1.4, -2.6, 1.0],
  [-1.6, 2.4, 0.8],
  [3.0, 1.4, 0.6],
  [-3.0, -0.6, -1.2],
];
/** Girilen yapıya göre zar tonu (yalnızca hafif vurgu; model geneldir). */
const ORIGIN_TINT: Record<string, string> = {
  liver: '#e0a080',
  heart: '#f08a8a',
  'skeletal-muscle': '#f08a8a',
  brain: '#a8b0f8',
  nerves: '#a8b0f8',
  'spinal-cord': '#a8b0f8',
  kidneys: '#e8c890',
  skin: '#f0c0a0',
  lungs: '#f4b8c8',
  thyroid: '#f0a8d0',
  pancreas: '#e8d090',
  bones: '#e8e0c8',
};

const SHOTS = [
  { position: [3.2, 2.6, 11.5], target: [0, 0, 0] },
  { position: [-0.5, 1.0, 3.6], target: [-1.0, 0.3, -0.4] },
  { position: [1.8, 0.4, 4.4], target: [1.0, -0.3, 0] },
  { position: [6.2, 1.2, 5.4], target: [2.6, 0.2, 1.4] },
  { position: [0.8, 0.2, 5.0], target: [0.1, -0.3, 1.6] },
  { position: [-4.6, 4.8, 5.2], target: [-2.0, 2.6, 1.2] },
] as const;

const UP = new Vector3(0, 1, 0);

/** Önden kesilen dilimin içinde mi (kameraya bakan açık kısım)? */
function inWedge(d: Vector3): boolean {
  const h = Math.hypot(d.x, d.z);
  return h > 1e-3 && d.z / h > Math.cos(WEDGE);
}

/** ER yaprağı üzerindeki nokta: çekirdeği saran dalgalı katman. */
function erPoint(k: number, theta: number, y: number, offset = 0): Vector3 {
  const rad = 1.55 + k * 0.24 + 0.07 * Math.sin(y * 5 + theta * 6 + k) + offset;
  return new Vector3(NC.x + rad * Math.cos(theta), NC.y + y, NC.z + rad * Math.sin(theta));
}

function erGeometry(): BufferGeometry {
  const parts = Array.from({ length: ER_LAYERS }, (_, k) => {
    const g = new PlaneGeometry(1, 1, 28, 16);
    const pos = g.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const theta = -1.3 + u * (2.2 - k * 0.12);
      const p = erPoint(k, theta, -1.0 + v * 2.0 - k * 0.05);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function golgiGeometry(): BufferGeometry {
  const parts = Array.from({ length: 5 }, (_, i) => {
    const rho = 0.8 + i * 0.13;
    return new SphereGeometry(rho, 28, 5, 0, Math.PI * 2, 0, 0.6).translate(0, i * 0.13 - rho, 0);
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.scale(1, 0.7, 1).rotateZ(0.9).rotateY(-0.4);
  return merged;
}

/** Y biçimli zar reseptörü (sap +y yönünde dışarı bakar). */
function receptorGeometry(): BufferGeometry {
  const stem = new CylinderGeometry(0.045, 0.045, 0.45, 8).translate(0, 0.02, 0);
  const armL = new CylinderGeometry(0.035, 0.035, 0.26, 8).translate(0, 0.13, 0).rotateZ(0.6).translate(0, 0.24, 0);
  const armR = new CylinderGeometry(0.035, 0.035, 0.26, 8).translate(0, 0.13, 0).rotateZ(-0.6).translate(0, 0.24, 0);
  const merged = mergeGeometries([stem, armL, armR], false)!;
  [stem, armL, armR].forEach((p) => p.dispose());
  return merged;
}

/** Kısa, kıvrık tek zincir (mRNA). */
function strandGeometry(): BufferGeometry {
  const c = curve([[-0.5, 0, 0], [-0.25, 0.12, 0.05], [0, -0.08, 0], [0.25, 0.1, -0.05], [0.5, 0, 0]]);
  return new TubeGeometry(c, 16, 0.05, 5, false);
}

/** Boncuk dizisi (polipeptit zinciri). */
function chainGeometry(): BufferGeometry {
  const parts = Array.from({ length: 6 }, (_, i) => new SphereGeometry(0.16, 8, 6).translate(-0.8 + i * 0.32, i % 2 ? 0.12 : -0.12, 0));
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

export default function CellScene({ state, onSelect, reducedMotion, params, origin }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#070810', ['#070810', 9, 26], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 17 }, { position: [4, 4, 17], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);

  const tint = (origin && ORIGIN_TINT[origin]) || null;
  const memGeo = useDisposable(() => new SphereGeometry(RC, 64, 48, Math.PI / 2 + WEDGE, Math.PI * 2 - 2 * WEDGE));
  const memMat = useDisposable(
    () =>
      new MeshPhysicalMaterial({
        color: new Color('#9fd4e8').lerp(new Color(tint ?? '#9fd4e8'), 0.45),
        roughness: 0.3,
        transparent: true,
        opacity: 0.22,
        side: DoubleSide,
        depthWrite: false,
        sheen: 1,
        sheenColor: '#e0f4ff',
        emissive: '#10304a',
        emissiveIntensity: 0.4,
      }),
    [tint],
  );
  const nucGeo = useDisposable(() => new SphereGeometry(NR, 48, 32, Math.PI / 2 + WEDGE, Math.PI * 2 - 2 * WEDGE));
  const nucMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#8a70d8', roughness: 0.4, side: DoubleSide, transparent: true, opacity: 0.75, emissive: '#1c1048', emissiveIntensity: 0.5 }));
  const nucleolusMat = useDisposable(() => new MeshStandardMaterial({ color: '#4a2a8a', roughness: 0.5, emissive: '#180a30', emissiveIntensity: 0.5 }));
  const dnaMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8a8ff', roughness: 0.5, emissive: '#4a2a90', emissiveIntensity: 0.6 }));
  const poreGeo = useDisposable(() => new TorusGeometry(0.07, 0.025, 6, 14).rotateX(Math.PI / 2));
  const poreMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8d8ff', roughness: 0.4, emissive: '#3a2a6a', emissiveIntensity: 0.5 }));
  const erGeo = useDisposable(erGeometry);
  const erMat = useDisposable(() => new MeshStandardMaterial({ color: '#e89ab8', roughness: 0.5, side: DoubleSide, transparent: true, opacity: 0.8, emissive: '#3a0c20', emissiveIntensity: 0.4 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const riboMat = useDisposable(() => new MeshStandardMaterial({ color: '#4a4ac0', roughness: 0.4, emissive: '#181860', emissiveIntensity: 0.6 }));
  const golgiGeo = useDisposable(golgiGeometry);
  const golgiMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8b84a', roughness: 0.45, side: DoubleSide, emissive: '#3a2a08', emissiveIntensity: 0.45 }));
  const mitoGeo = useDisposable(() => new CapsuleGeometry(0.3, 0.7, 6, 16));
  const mitoMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f0905a', roughness: 0.4, transparent: true, opacity: 0.5, depthWrite: false, emissive: '#3a1404', emissiveIntensity: 0.4 }));
  const boxGeo = useDisposable(() => new BoxGeometry(1, 1, 1));
  const cristaMat = useDisposable(() => new MeshStandardMaterial({ color: '#e0703a', roughness: 0.5, emissive: '#5a2008', emissiveIntensity: 0.5 }));
  const lysoGeo = useDisposable(() => bumpySphere(2, 0.12, 12));
  const lysoMat = useDisposable(() => new MeshStandardMaterial({ color: '#7ab87a', roughness: 0.5, emissive: '#1a3a1a', emissiveIntensity: 0.5 }));
  const glutGeo = useDisposable(() => new CylinderGeometry(0.1, 0.1, 0.42, 10));
  const glutMat = useDisposable(() => new MeshStandardMaterial({ color: '#5ee0c8', roughness: 0.4, emissive: '#107a6a', emissiveIntensity: 0.8 }));
  const recGeo = useDisposable(receptorGeometry);
  const recMat = useDisposable(() => new MeshStandardMaterial({ color: '#d070e0', roughness: 0.4, emissive: '#4a1060', emissiveIntensity: 0.6 }));
  const vesMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#d8c0ff', roughness: 0.2, transparent: true, opacity: 0.7, emissive: '#3a2a6a', emissiveIntensity: 0.5 }));
  const strandGeo = useDisposable(strandGeometry);
  const mrnaMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9ad8', emissive: '#a02a70', emissiveIntensity: 1 }));
  const chainGeo = useDisposable(chainGeometry);
  const proteinMat = useDisposable(() => new MeshStandardMaterial({ color: '#b8f070', emissive: '#4a7a10', emissiveIntensity: 0.9 }));
  const ico = useDisposable(() => new IcosahedronGeometry(1, 0));
  const glucMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff08a', emissive: '#8a7a10', emissiveIntensity: 1 }));
  const fuelMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffb060', emissive: '#8a4a00', emissiveIntensity: 1 }));
  const o2Mat = useDisposable(() => new MeshStandardMaterial({ color: '#bff6ff', emissive: '#4fd6e8', emissiveIntensity: 1.2 }));
  const atpMat = useDisposable(() => new MeshStandardMaterial({ color: '#fffbe0', emissive: '#ffe070', emissiveIntensity: 1.8 }));
  const hormoneMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff5ad0', emissive: '#a0107a', emissiveIntensity: 1.1 }));
  const signalMat = useDisposable(() => new MeshStandardMaterial({ color: '#7af0ff', emissive: '#10a0c0', emissiveIntensity: 1.3 }));

  const geo = useMemo(() => {
    const r = rng(113);
    const unit = () => new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    // Çekirdek: porlar, çekirdekçik, kromatin
    const pores: CellSpec[] = fibonacciSphere(70, 1)
      .filter((d) => !inWedge(d))
      .map((d) => ({ p: NC.clone().addScaledVector(d, NR), s: 1, q: faceOut(d) }));
    const erSidePores = pores.filter((p) => p.p.x > NC.x + 0.4);
    const chromatin = Array.from({ length: 7 }, () => {
      const pts: [number, number, number][] = [];
      let p = NC.clone().addScaledVector(unit(), 0.5 * r());
      for (let k = 0; k < 7; k++) {
        pts.push([p.x, p.y, p.z]);
        p = p.clone().addScaledVector(unit(), 0.35);
        if (p.distanceTo(NC) > NR * 0.85) p = NC.clone().lerp(p, 0.6);
      }
      return curve(pts);
    });
    // Ribozomlar ER yüzeyinde
    const ribos: { p: Vector3; k: number; theta: number; y: number }[] = Array.from({ length: 220 }, () => {
      const k = Math.floor(r() * ER_LAYERS);
      const theta = -1.3 + r() * (2.2 - k * 0.12);
      const y = -0.95 + r() * 1.9 - k * 0.05;
      return { p: erPoint(k, theta, y, 0.035), k, theta, y };
    });
    const riboCells: CellSpec[] = ribos.map((b) => ({ p: b.p, s: 0.035 }));
    const mrnaHops: Hop[] = Array.from({ length: 30 }, () => {
      const pore = erSidePores[Math.floor(r() * erSidePores.length)]!;
      const rb = ribos[Math.floor(r() * ribos.length)]!;
      return { from: pore.p.clone(), to: rb.p.clone(), lift: new Vector3(0, (r() - 0.5) * 0.3, 0) };
    });
    const proteinHops: Hop[] = Array.from({ length: 30 }, () => {
      const rb = ribos[Math.floor(r() * ribos.length)]!;
      return { from: rb.p.clone(), to: erPoint(rb.k, rb.theta, rb.y, 0.14) };
    });
    // Kesecikler: ER → Golgi → zar
    const toGolgi: Hop[] = Array.from({ length: 16 }, () => ({
      from: erPoint(ER_LAYERS - 1, -0.9 + r() * 0.9, -0.8 + r() * 0.6, 0.12),
      to: GC.clone().add(new Vector3(-0.55 + (r() - 0.5) * 0.3, 0.35 + (r() - 0.5) * 0.4, (r() - 0.5) * 0.6)),
      lift: new Vector3(0, 0.2, 0),
    }));
    const toMembrane: Hop[] = Array.from({ length: 16 }, () => {
      const from = GC.clone().add(new Vector3(0.4 + (r() - 0.5) * 0.3, -0.35 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.6));
      const d = from.clone().add(unit().multiplyScalar(1.2)).normalize();
      if (inWedge(d)) d.z -= 0.8;
      return { from, to: d.normalize().multiplyScalar(RC - 0.12) };
    });
    // Mitokondriler ve kristalar
    const mito: CellSpec[] = MITO.map(([x, y, z]) => ({ p: new Vector3(x, y, z), s: 1, q: new Quaternion().setFromUnitVectors(UP, unit()) }));
    const cristae: CellSpec[] = mito.flatMap((m) =>
      [-0.4, -0.2, 0, 0.2, 0.4].map((ly) => ({ p: new Vector3(0, ly, 0).applyQuaternion(m.q!).add(m.p), s: new Vector3(0.44, 0.022, 0.3), q: m.q })),
    );
    const lyso: CellSpec[] = LYSO.map(([x, y, z]) => ({ p: new Vector3(x, y, z), s: 0.2 }));
    // Zar: taşıyıcılar ve reseptörler
    const shell = fibonacciSphere(160, 1).filter((d) => !inWedge(d));
    const glutDirs = shell.filter((d) => d.z > -0.35 && d.y < 0.45).sort(() => r() - 0.5).slice(0, 40);
    const gluts: CellSpec[] = glutDirs.map((d) => ({ p: d.clone().multiplyScalar(RC), s: 1, q: faceOut(d) }));
    const glucHops: Hop[] = glutDirs.map((d) => ({ from: d.clone().multiplyScalar(RC + 0.8), to: d.clone().multiplyScalar(RC - 0.7) }));
    const fuelHops: Hop[] = glutDirs.map((d, i) => ({ from: d.clone().multiplyScalar(RC - 0.7), to: mito[i % mito.length]!.p.clone() }));
    const recDirs = shell.filter((d) => d.y > 0.35 && d.x < -0.1 && d.z > -0.5).slice(0, 6);
    const receptors: CellSpec[] = recDirs.map((d) => ({ p: d.clone().multiplyScalar(RC - 0.05), s: 1, q: faceOut(d) }));
    const hormoneHops: Hop[] = recDirs.flatMap((d) =>
      [0, 1, 2, 3].map(() => ({ from: d.clone().multiplyScalar(RC + 1.3).add(unit().multiplyScalar(0.5)), to: d.clone().multiplyScalar(RC + 0.42) })),
    );
    const signalHops: Hop[] = recDirs.flatMap((d) =>
      [0, 1, 2, 3, 4].map(() => ({ from: d.clone().multiplyScalar(RC - 0.3), to: NC.clone().lerp(d.clone().multiplyScalar(RC - 0.3), 0.35 + r() * 0.3).add(unit().multiplyScalar(0.3)) })),
    );
    // Hücre dışı akış (glukoz, oksijen) ve oksijenin mitokondriye difüzyonu
    const outside = Array.from({ length: 6 }, (_, i) => {
      const axis = unit();
      const q = new Quaternion().setFromUnitVectors(UP, axis);
      const rad = 4.9 + (i % 3) * 0.35;
      return curve(
        Array.from({ length: 12 }, (_, k) => {
          const a = (k / 12) * Math.PI * 2;
          const p = new Vector3(Math.cos(a) * rad, (r() - 0.5) * 0.3, Math.sin(a) * rad).applyQuaternion(q);
          return [p.x, p.y, p.z] as [number, number, number];
        }),
        true,
      );
    });
    const o2Hops: Hop[] = Array.from({ length: 50 }, (_, i) => {
      const d = shell[Math.floor(r() * shell.length)]!;
      return { from: d.clone().multiplyScalar(RC + 0.8), to: mito[i % mito.length]!.p.clone().add(unit().multiplyScalar(0.2)) };
    });
    const atpHops: Hop[] = Array.from({ length: 120 }, (_, i) => {
      const m = mito[i % mito.length]!.p;
      const to = m.clone().add(unit().multiplyScalar(0.8 + r() * 1.4));
      if (to.length() > RC - 0.4) to.setLength(RC - 0.4);
      return { from: m.clone(), to };
    });
    return {
      pores,
      chromatin,
      riboCells,
      mrnaHops,
      proteinHops,
      toGolgi,
      toMembrane,
      mito,
      cristae,
      lyso,
      gluts,
      glucHops,
      fuelHops,
      receptors,
      hormoneHops,
      signalHops,
      outside,
      o2Hops,
      atpHops,
    };
  }, []);

  // Kişisel: glukoz, oksijen (hemoglobin), metabolizma hızı (serbest T4), taşıyıcı sayısı (insülin)
  const glu = params.glucose;
  const o2 = params.o2;
  const metab = Math.max(0.4, Math.min(2, params.metab ?? 1));
  const nGlut = Math.max(2, scaled(16, params.insulin, 40));
  const glucHops = useMemo(() => geo.glucHops.slice(0, nGlut), [geo, nGlut]);
  const nucleolus = useMemo(() => NC.clone().add(new Vector3(0.25, 0.15, -0.1)), []);

  return (
    <group>
      <ambientLight intensity={0.4} color="#e0ecff" />
      <directionalLight position={[3, 6, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />
      <mesh geometry={memGeo} material={memMat} onClick={pick('membrane')} />
      {/* Çekirdek */}
      <mesh geometry={nucGeo} material={nucMat} position={NC} onClick={pick('nucleus')} />
      <mesh position={nucleolus} material={nucleolusMat} onClick={pick('nucleus')}>
        <sphereGeometry args={[0.42, 24, 16]} />
      </mesh>
      <Tubes curves={geo.chromatin} radius={0.035} material={dnaMat} onClick={pick('dna')} segments={40} radial={6} />
      <Cells cells={geo.pores} geometry={poreGeo} material={poreMat} onClick={pick('nucleus')} />
      {/* Protein yapım hattı */}
      <mesh geometry={erGeo} material={erMat} onClick={pick('er')} />
      <Cells cells={geo.riboCells} geometry={small} material={riboMat} onClick={pick('ribosome')} />
      <mesh geometry={golgiGeo} material={golgiMat} position={GC} onClick={pick('golgi')} />
      <Hoppers hops={geo.mrnaHops} count={30} shown={stage === 1 || stage === 2 ? 30 : 6} geometry={strandGeo} material={mrnaMat} time={time} duration={3.2} size={0.3} seed={3} onClick={pick('mrna')} />
      <Hoppers hops={geo.proteinHops} count={30} geometry={chainGeo} material={proteinMat} time={time} duration={2.6} size={0.16} seed={5} active={stage === 2} onClick={pick('ribosome')} />
      <Hoppers hops={geo.toGolgi} count={16} shown={stage === 2 ? 16 : 4} geometry={small} material={vesMat} time={time} duration={3.4} size={0.1} seed={7} onClick={pick('vesicle')} />
      <Hoppers hops={geo.toMembrane} count={16} shown={stage === 2 ? 16 : 4} geometry={small} material={vesMat} time={time} duration={3.8} size={0.1} seed={9} onClick={pick('vesicle')} />
      {/* Mitokondriler ve lizozomlar */}
      <Cells cells={geo.mito} geometry={mitoGeo} material={mitoMat} onClick={pick('mitochondrion')} />
      <Cells
        cells={geo.cristae}
        geometry={boxGeo}
        material={cristaMat}
        onClick={pick('mitochondrion')}
        time={time}
        animate={(i, t, out) => {
          const k = stage === 4 ? 1.1 + 0.4 * Math.max(0, Math.sin(t * 3 * metab + i)) : 1;
          out.setRGB(k, k, k);
          return { color: true };
        }}
      />
      <Cells cells={geo.lyso} geometry={lysoGeo} material={lysoMat} onClick={pick('lysosome')} />
      {/* Zar: glukoz taşıyıcıları ve reseptörler */}
      <Cells cells={geo.gluts} geometry={glutGeo} material={glutMat} onClick={pick('transporter')} time={time} animate={(i) => ({ scale: i < nGlut ? 1 : 0 })} />
      <Cells
        cells={geo.receptors}
        geometry={recGeo}
        material={recMat}
        onClick={pick('receptor')}
        time={time}
        animate={(i, t, out) => {
          const k = stage === 5 ? 1.2 + 0.4 * Math.max(0, Math.sin(t * 3 + i)) : 1;
          out.setRGB(k, k, k);
          return { color: true };
        }}
      />
      {/* Glukoz: dışarıda akar, taşıyıcıdan girer, yakıt olarak mitokondriye gider */}
      <CurveMovers curves={geo.outside} count={100} shown={scaled(40, glu, 100)} geometry={ico} material={glucMat} time={time} speed={0.02} size={0.06} jitter={0.4} seed={11} onClick={pick('glucose')} />
      <Hoppers hops={glucHops} count={60} shown={stage === 3 ? scaled(30, glu, 60) : scaled(8, glu, 24)} geometry={ico} material={glucMat} time={time} duration={2.4} size={0.06} seed={13} onClick={pick('glucose')} />
      <Hoppers hops={geo.fuelHops} count={30} geometry={small} material={fuelMat} time={time} duration={3} size={0.045} seed={15} active={stage === 4} onClick={pick('glucose')} />
      {/* Oksijen ve ATP */}
      <CurveMovers curves={geo.outside} count={60} shown={scaled(24, o2, 60)} geometry={small} material={o2Mat} time={time} speed={0.025} size={0.04} jitter={0.45} seed={17} onClick={pick('oxygen')} />
      <Hoppers hops={geo.o2Hops} count={50} shown={stage === 4 ? scaled(30, o2, 50) : scaled(8, o2, 20)} geometry={small} material={o2Mat} time={time} duration={2.8} size={0.04} seed={19} onClick={pick('oxygen')} />
      <Hoppers
        hops={geo.atpHops}
        count={120}
        shown={scaled(stage === 4 ? 60 : 24, metab, 120)}
        geometry={small}
        material={atpMat}
        time={time}
        duration={2.6 / metab}
        size={0.04}
        seed={21}
        onClick={pick('atp')}
      />
      {/* Hormon → reseptör → hücre içi sinyal */}
      <Hoppers hops={geo.hormoneHops} count={24} geometry={small} material={hormoneMat} time={time} duration={2.6} size={0.07} seed={23} active={stage === 5} fade={false} onClick={pick('receptor')} />
      <Hoppers hops={geo.signalHops} count={30} geometry={small} material={signalMat} time={time} duration={2.2} size={0.04} seed={25} active={stage === 5} onClick={pick('receptor')} />
    </group>
  );
}
