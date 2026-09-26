import { useMemo } from 'react';
import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, fibonacciSphere, makePick } from '../micro';

/**
 * Nefron: glomerül (kılcal yumağı), Bowman kapsülü ve tübülün başlangıcı (temsili).
 * Getirici arteriyol soldan girer, götürücü arteriyol yanından çıkar; süzüntü kapsülden tübüle akar.
 */

const SHOTS = [
  { position: [1.2, 1.6, 7.5], target: [0.8, 0, 0] },
  { position: [-1.8, 1.0, 4.2], target: [-0.8, 0.1, 0] },
  { position: [0.6, 0.7, 3.4], target: [0.2, 0, 0] },
  { position: [3.6, 1.6, 4.6], target: [2.6, -0.4, 0] },
] as const;

export default function NephronScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const shot = SHOTS[state.stage] ?? SHOTS[0];
  useAtmosphere('#07060f', ['#07060f', 6, 18], 0.5);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 12 }, { position: [1.5, 2.5, 13], target: [0.8, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const stage = state.stage;

  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5 }));
  const arterioleMat = useDisposable(() => new MeshStandardMaterial({ color: '#d4454f', roughness: 0.45, emissive: '#300408', emissiveIntensity: 0.4 }));
  const capsuleMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#b9a4ff', roughness: 0.3, transparent: true, opacity: 0.22, side: DoubleSide, depthWrite: false, sheen: 1, sheenColor: '#e6dcff' }),
  );
  const tubuleMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#e8d38a', roughness: 0.35, transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide }));
  const podoGeo = useDisposable(() => bumpySphere(2, 0.22, 6));
  const podoMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8b4ff', roughness: 0.55, emissive: '#1c1340', emissiveIntensity: 0.4 }));
  const rbcGeo = useDisposable(() => rbcGeometry(16));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const small = useDisposable(() => new SphereGeometry(1, 12, 8));
  const waterMat = useDisposable(() => new MeshStandardMaterial({ color: '#8fd8ff', emissive: '#1f6a9a', emissiveIntensity: 0.9 }));
  const creaMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffb86b', emissive: '#8a4a00', emissiveIntensity: 0.9 }));
  const albMat = useDisposable(() => new MeshStandardMaterial({ color: '#8ee89a', emissive: '#1a5a24', emissiveIntensity: 0.6 }));
  const ureaMat = useDisposable(() => new MeshStandardMaterial({ color: '#e6f0ff', emissive: '#4a5a7a', emissiveIntensity: 0.7 }));
  const gfr = params.gfr ?? 1;
  const nAlb = scaled(8, params.alb, 10);

  const geo = useMemo(() => {
    const r = rng(33);
    const afferent = curve([[-5, 0.2, 0], [-3.2, 0.15, 0], [-1.6, 0.1, 0], [-0.9, 0.05, 0]]);
    const efferent = curve([[-0.9, 0.45, 0.1], [-1.6, 0.6, 0.15], [-3.2, 0.8, 0.2], [-5, 1, 0.2]]);
    // Kılcal yumağı: her halka getirici kutuptan çıkar, küre içinde kıvrılarak götürücü kutba döner.
    const C = new Vector3(0.1, 0.2, 0);
    const loops = [];
    for (let i = 0; i < 14; i++) {
      const base = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const pts: [number, number, number][] = [[-0.85, 0.05, 0]];
      const dir = base.clone();
      for (let k = 0; k < 4; k++) {
        dir.add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
        const p = C.clone().addScaledVector(dir, 0.45 + 0.35 * r());
        pts.push([p.x, p.y, p.z]);
      }
      pts.push([-0.85, 0.45, 0.1]);
      loops.push(curve(pts));
    }
    const tubule = curve([[1.25, 0, 0], [1.9, -0.3, 0.2], [2.6, -0.2, -0.5], [3.0, -0.8, -0.1], [3.4, -0.5, 0.6], [4.2, -1.1, 0.4], [5.2, -1.4, 0]]);
    const podocytes: CellSpec[] = fibonacciSphere(26, 0.82, new Vector3(0.1, 0.2, 0)).map((p) => ({ p, s: 0.1 }));
    // Süzme: kılcaldan kapsül boşluğuna, sonra tübüle
    const filt: Hop[] = [];
    const crea: Hop[] = [];
    loops.forEach((lp) => {
      for (let k = 0; k < 3; k++) {
        const from = lp.getPointAt(0.2 + 0.6 * r());
        const dir = from.clone().sub(new Vector3(0.1, 0.2, 0)).normalize();
        const to = new Vector3(0.1, 0.2, 0).addScaledVector(dir, 1.15);
        filt.push({ from, to });
        crea.push({ from: from.clone(), to: to.clone() });
      }
    });
    // Tübülde geri emilim: tübülden dışarı (kana) çıkan su/tuz
    const reabsorb: Hop[] = [];
    for (let k = 0; k < 18; k++) {
      const p = tubule.getPointAt(0.1 + 0.8 * (k / 18));
      reabsorb.push({ from: p, to: p.clone().add(new Vector3(0, 0.9 + r() * 0.4, (r() - 0.5) * 0.8)) });
    }
    return { afferent, efferent, loops, tubule, podocytes, filt, crea, reabsorb };
  }, []);

  const flowCurves = useMemo(() => [geo.afferent, ...geo.loops, geo.efferent], [geo]);
  const albumin = useMemo<CellSpec[]>(() => geo.loops.slice(0, 10).map((l, i) => ({ p: l.getPointAt(0.3 + (i % 3) * 0.2), s: 0.075 })), [geo]);

  return (
    <group>
      <ambientLight intensity={0.35} color="#d8d0ff" />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <Headlight intensity={3} distance={14} />
      <Tubes curves={[geo.afferent]} radius={0.16} material={arterioleMat} onClick={pick('afferent')} />
      <Tubes curves={[geo.efferent]} radius={0.12} material={arterioleMat} onClick={pick('efferent')} />
      <Tubes curves={geo.loops} radius={0.055} material={capMat} onClick={pick('glomerulus')} segments={48} radial={8} />
      <mesh position={[0.1, 0.2, 0]} onClick={pick('bowman')}>
        <sphereGeometry args={[1.25, 48, 32, 0.6, Math.PI * 2 - 0.9]} />
        <primitive object={capsuleMat} attach="material" />
      </mesh>
      <Tubes curves={[geo.tubule]} radius={0.22} material={tubuleMat} onClick={pick('tubule')} segments={120} radial={16} />
      <Cells cells={geo.podocytes} geometry={podoGeo} material={podoMat} onClick={pick('podocyte')} />
      <CurveMovers curves={flowCurves} count={reducedMotion ? 60 : 120} geometry={rbcGeo} material={rbcMat} time={time} speed={0.12} size={0.08} flat onClick={pick('rbc')} />
      <Cells cells={albumin} geometry={small} material={albMat} onClick={pick('albumin')} time={time} animate={(i, t) => ({ scale: i < nAlb ? 1 + 0.08 * Math.sin(t * 4 + i) : 0 })} />
      {/* Kişisel: kandaki kreatinin ve üre (değer yükseldikçe artar) */}
      <CurveMovers curves={flowCurves} count={90} shown={scaled(16, params.crea, 90)} geometry={small} material={creaMat} time={time} speed={0.12} size={0.034} jitter={0.05} seed={31} onClick={pick('creatinine')} />
      <CurveMovers curves={flowCurves} count={80} shown={scaled(16, params.urea, 80)} geometry={small} material={ureaMat} time={time} speed={0.12} size={0.026} jitter={0.05} seed={37} onClick={pick('urea')} />
      <Hoppers hops={geo.filt} count={104} shown={scaled(80, gfr, 104)} geometry={small} material={waterMat} time={time} duration={2.4 / Math.max(0.35, gfr)} size={0.028} onClick={pick('water')} />
      <Hoppers hops={geo.crea} count={48} shown={scaled(36, gfr, 48)} geometry={small} material={creaMat} time={time} duration={2.8} size={0.036} seed={17} active={stage >= 2} onClick={pick('creatinine')} />
      <CurveMovers curves={[geo.tubule]} count={52} shown={stage >= 2 ? scaled(40, gfr, 52) : 0} geometry={small} material={creaMat} time={time} speed={0.06} size={0.036} jitter={0.18} seed={23} onClick={pick('creatinine')} />
      <Hoppers hops={geo.reabsorb} count={50} geometry={small} material={waterMat} time={time} duration={2.2} size={0.028} seed={29} active={stage >= 3} onClick={pick('water')} />
    </group>
  );
}
