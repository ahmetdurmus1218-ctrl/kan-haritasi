import { useMemo } from 'react';
import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, makePick } from '../micro';

/**
 * Kemik iliği (temsili): süngerimsi kemik çubukları arasında kan yapan doku, yağ hücreleri ve
 * olgun hücrelerin kana geçtiği geniş bir sinüzoid.
 */

const SHOTS = [
  { position: [0.6, 2.4, 9.5], target: [0, 0, 0] },
  { position: [-1.6, 1.2, 4.2], target: [-1.2, 0.2, 0.4] },
  { position: [1.4, 1.0, 4.0], target: [0.8, 0, 0.5] },
  { position: [2.6, 1.6, 4.4], target: [1.8, 0.4, 0] },
  { position: [0.4, 1.6, 4.6], target: [0, 0.8, -0.4] },
] as const;

const SINUS = curve([
  [-6, 1.1, -0.5],
  [-3, 0.9, -0.3],
  [0, 0.8, -0.4],
  [3, 1.0, -0.2],
  [6, 1.2, -0.6],
]);

export default function MarrowScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const shot = SHOTS[state.stage] ?? SHOTS[0];
  useAtmosphere('#0b0708', ['#0b0708', 7, 20], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 14 }, { position: [0.6, 3.5, 14], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const stage = state.stage;

  const boneMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8dfcc', roughness: 0.8, emissive: '#1a1508', emissiveIntensity: 0.2 }));
  const sinusMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#d25a66', roughness: 0.3, transparent: true, opacity: 0.25, side: DoubleSide, depthWrite: false }));
  const fatGeo = useDisposable(() => new SphereGeometry(1, 24, 18));
  const fatMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f6e7a8', roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false }));
  const cellGeo = useDisposable(() => bumpySphere(2, 0.1, 3));
  const stemMat = useDisposable(() => new MeshStandardMaterial({ color: '#a98cf0', roughness: 0.5, emissive: '#2a1a60', emissiveIntensity: 0.6 }));
  const eryMat = useDisposable(() => new MeshStandardMaterial({ color: '#c0405a', roughness: 0.5, emissive: '#3a0818', emissiveIntensity: 0.5 }));
  const wbcGeo = useDisposable(() => bumpySphere(3, 0.2, 9));
  const wbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8ecf5', roughness: 0.6, emissive: '#1a2030', emissiveIntensity: 0.3 }));
  const megaGeo = useDisposable(() => bumpySphere(3, 0.22, 12));
  const megaMat = useDisposable(() => new MeshStandardMaterial({ color: '#c9a0e0', roughness: 0.6, emissive: '#2a1040', emissiveIntensity: 0.4 }));
  const rbcGeo = useDisposable(() => rbcGeometry(16));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const pltGeo = useDisposable(() => new SphereGeometry(1, 10, 6).scale(1, 0.35, 1));
  const pltMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0c8e0', roughness: 0.5, emissive: '#3a1a30', emissiveIntensity: 0.4 }));
  const ironGeo = useDisposable(() => new SphereGeometry(1, 8, 6));
  const ironMat = useDisposable(() => new MeshStandardMaterial({ color: '#d98a3a', roughness: 0.4, emissive: '#6a3000', emissiveIntensity: 0.9 }));

  const geo = useMemo(() => {
    const r = rng(71);
    const bones = [
      curve([[-5, -2, -1], [-3, -1.4, -1.6], [-1, -2, -1.2], [1.5, -1.6, -1.8], [5, -2.2, -1]]),
      curve([[-4.5, 2.6, -2], [-2, 2.2, -1.4], [0.5, 2.8, -2.2], [4, 2.3, -1.6]]),
      curve([[-3.6, -2.4, -1], [-3.2, 0, -1.4], [-3.8, 2.6, -1.8]]),
      curve([[3.4, -2.2, -1.4], [3.9, 0.2, -1.8], [3.2, 2.5, -1.6]]),
      curve([[-0.5, -2.2, -1.6], [0.2, -0.4, -2.4], [0.4, 2.6, -2.2]]),
    ];
    const fat: CellSpec[] = Array.from({ length: 11 }, () => ({ p: new Vector3((r() - 0.5) * 7, (r() - 0.5) * 3.2, -0.6 - r() * 1.2), s: 0.35 + r() * 0.25 }));
    const stem: CellSpec[] = Array.from({ length: 7 }, (_, i) => ({ p: new Vector3(-1.8 + (i % 4) * 0.45, -0.4 + Math.floor(i / 4) * 0.5, 0.4 + r() * 0.3), s: 0.2 }));
    const ery: CellSpec[] = Array.from({ length: 22 }, () => ({ p: new Vector3(0.2 + (r() - 0.5) * 1.6, -0.3 + (r() - 0.5) * 1.2, 0.4 + (r() - 0.5) * 0.8), s: 0.15 }));
    const wbc: CellSpec[] = Array.from({ length: 8 }, () => ({ p: new Vector3(1.6 + (r() - 0.5) * 1.2, -0.6 + (r() - 0.5) * 0.9, 0.3 + (r() - 0.5) * 0.6), s: 0.19 }));
    const mega: CellSpec[] = [{ p: new Vector3(2.2, 0.35, -0.1), s: 0.55 }];
    // Olgun hücreler sinüzoide geçer
    const toSinus = (from: Vector3): Hop => ({ from: from.clone(), to: SINUS.getPointAt(Math.min(0.95, Math.max(0.05, (from.x + 6) / 12))) });
    const eryOut: Hop[] = ery.map((c) => toSinus(c.p));
    const wbcOut: Hop[] = wbc.map((c) => toSinus(c.p));
    const pltOut: Hop[] = Array.from({ length: 16 }, () => ({ from: mega[0]!.p.clone().add(new Vector3((r() - 0.5) * 0.6, 0.3, (r() - 0.5) * 0.5)), to: SINUS.getPointAt(0.66 + r() * 0.12) }));
    const division: Hop[] = stem.map((c) => ({ from: c.p.clone(), to: c.p.clone().add(new Vector3(0.35, 0.2, 0.1)) }));
    // Demir: sinüzoidden alyuvar öncüllerine (hemoglobin yapımı için)
    const ironIn: Hop[] = ery.map((c) => ({ from: SINUS.getPointAt(Math.min(0.95, Math.max(0.05, (c.p.x + 6) / 12 + (r() - 0.5) * 0.05))), to: c.p.clone() }));
    return { bones, fat, stem, ery, wbc, mega, eryOut, wbcOut, pltOut, division, ironIn };
  }, []);

  return (
    <group>
      <ambientLight intensity={0.35} color="#ffe8e0" />
      <directionalLight position={[3, 6, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />
      <Tubes curves={geo.bones} radius={[0.35, 0.3, 0.28, 0.3, 0.26]} material={boneMat} onClick={pick('bone')} segments={60} radial={12} />
      <Tubes curves={[SINUS]} radius={0.55} material={sinusMat} onClick={pick('sinusoid')} segments={100} radial={24} />
      <Cells cells={geo.fat} geometry={fatGeo} material={fatMat} onClick={pick('fat')} />
      <Cells cells={geo.stem} geometry={cellGeo} material={stemMat} onClick={pick('stem')} time={time} animate={(i, t) => (stage === 1 ? { scale: 1 + 0.12 * Math.sin(t * 3 + i) } : undefined)} />
      <Cells cells={geo.ery} geometry={cellGeo} material={eryMat} onClick={pick('erythroblast')} />
      <Hoppers hops={geo.ironIn} count={120} shown={scaled(30, params.iron, 120)} geometry={ironGeo} material={ironMat} time={time} duration={3.4} size={0.035} seed={47} onClick={pick('iron')} />
      <Cells cells={geo.wbc} geometry={wbcGeo} material={wbcMat} onClick={pick('wbc')} visible={stage >= 3} />
      <Cells cells={geo.mega} geometry={megaGeo} material={megaMat} onClick={pick('megakaryocyte')} visible={stage >= 3} time={time} animate={(_i, t) => ({ scale: 1 + 0.04 * Math.sin(t * 2) })} />
      <Hoppers hops={geo.division} count={7} geometry={cellGeo} material={stemMat} time={time} duration={3} size={0.16} active={stage === 1} onClick={pick('stem')} />
      <Hoppers hops={geo.eryOut} count={30} shown={scaled(22, params.rbc, 30)} geometry={rbcGeo} material={rbcMat} time={time} duration={4} size={0.2 * (params.rbcSize ?? 1)} seed={3} active={stage === 2 || stage === 4} onClick={pick('rbc')} />
      <Hoppers hops={geo.wbcOut} count={40} shown={scaled(8, params.wbc, 40)} geometry={wbcGeo} material={wbcMat} time={time} duration={4.4} size={0.16} seed={5} active={stage === 4} onClick={pick('wbc')} />
      <Hoppers hops={geo.pltOut} count={90} shown={scaled(30, params.plt, 90)} geometry={pltGeo} material={pltMat} time={time} duration={3} size={0.07} seed={7} active={stage >= 3} onClick={pick('platelet')} />
      {/* Kişisel: sinüzoiddeki olgun hücreler senin sayımına göre */}
      <CurveMovers
        curves={[SINUS]}
        count={reducedMotion ? 55 : 110}
        shown={scaled(reducedMotion ? 40 : 80, params.rbc, reducedMotion ? 55 : 110)}
        geometry={rbcGeo}
        material={rbcMat}
        time={time}
        speed={0.05}
        size={0.2 * (params.rbcSize ?? 1)}
        flat
        jitter={0.55}
        onClick={pick('rbc')}
      />
      <CurveMovers curves={[SINUS]} count={40} shown={scaled(8, params.wbc, 40)} geometry={wbcGeo} material={wbcMat} time={time} speed={0.035} size={0.17} jitter={0.5} seed={41} onClick={pick('wbc')} />
      <CurveMovers curves={[SINUS]} count={72} shown={scaled(24, params.plt, 72)} geometry={pltGeo} material={pltMat} time={time} speed={0.05} size={0.07} jitter={0.55} seed={43} onClick={pick('platelet')} />
    </group>
  );
}
