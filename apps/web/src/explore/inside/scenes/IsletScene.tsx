import { useMemo } from 'react';
import { CapsuleGeometry, IcosahedronGeometry, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { Headlight, type InsideSceneProps, bumpySphere, rng, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, makePick } from '../micro';

/**
 * Langerhans adacığı (temsili): asinus hücreleriyle çevrili bir hücre kümesi; beta (insülin),
 * alfa (glukagon), delta hücreleri ve içinden geçen kılcallar. Son aşamada insülinin hedef
 * hücrede glukoz alımını sağlaması gösterilir.
 */

const TARGET = new Vector3(4.2, -0.2, 0);

const SHOTS = [
  { position: [0.5, 2.2, 9.5], target: [0, 0, 0] },
  { position: [1.2, 1.6, 5.6], target: [0, 0, 0] },
  { position: [2.0, 1.2, 4.8], target: [0.3, 0, 0.2] },
  { position: [-1.8, 1.2, 4.6], target: [0, 0, 0.3] },
  { position: [6.2, 1.6, 4.4], target: [4.0, -0.2, 0] },
] as const;

export default function IsletScene({ state, onSelect, reducedMotion }: InsideSceneProps) {
  const shot = SHOTS[state.stage] ?? SHOTS[0];
  useAtmosphere('#0a050b', ['#0a050b', 7, 20], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 14 }, { position: [0.5, 3, 14], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const stage = state.stage;

  const cellGeo = useDisposable(() => bumpySphere(2, 0.09, 2));
  const betaMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#7fb0ff', roughness: 0.45, transparent: true, opacity: 0.8, emissive: '#10204a', emissiveIntensity: 0.5 }));
  const alphaMat = useDisposable(() => new MeshStandardMaterial({ color: '#f28fb5', roughness: 0.5, emissive: '#3a0c20', emissiveIntensity: 0.4 }));
  const deltaMat = useDisposable(() => new MeshStandardMaterial({ color: '#9be7a0', roughness: 0.5, emissive: '#0c3010', emissiveIntensity: 0.4 }));
  const acinarMat = useDisposable(() => new MeshStandardMaterial({ color: '#d9a07a', roughness: 0.6, emissive: '#2a1206', emissiveIntensity: 0.3 }));
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const glucGeo = useDisposable(() => new IcosahedronGeometry(1, 0));
  const glucMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff4b0', emissive: '#7a6a10', emissiveIntensity: 0.9 }));
  const insMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffc94d', emissive: '#a06a00', emissiveIntensity: 1.1 }));
  const glucagonMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9ac0', emissive: '#8a1a4a', emissiveIntensity: 0.9 }));
  const muscleGeo = useDisposable(() => new CapsuleGeometry(0.9, 3.4, 8, 24).rotateZ(Math.PI / 2));
  const muscleMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#c45a5a', roughness: 0.5, transparent: true, opacity: 0.55, emissive: '#2a0808', emissiveIntensity: 0.4, depthWrite: false }));
  const glutMat = useDisposable(() => new MeshStandardMaterial({ color: '#7ff0d8', emissive: '#1a7a6a', emissiveIntensity: 1 }));

  const geo = useMemo(() => {
    const r = rng(51);
    const beta: CellSpec[] = [];
    const alpha: CellSpec[] = [];
    const delta: CellSpec[] = [];
    for (let i = 0; i < 70; i++) {
      const p = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()) * 1.25);
      const cell = { p, s: 0.2 + r() * 0.04 };
      const outer = p.length() > 0.85;
      if (outer && r() < 0.55) alpha.push(cell);
      else if (r() < 0.08) delta.push(cell);
      else beta.push(cell);
    }
    const acinar: CellSpec[] = [];
    for (let i = 0; i < 160; i++) {
      const dir = new Vector3(r() - 0.5, (r() - 0.5) * 0.8, r() - 0.5).normalize();
      acinar.push({ p: dir.multiplyScalar(1.8 + r() * 1.6), s: 0.24 + r() * 0.06 });
    }
    const caps = [
      curve([[-4, 0.3, 0.4], [-1.2, 0.2, 0.3], [0, 0.1, 0], [1.2, -0.1, -0.2], [4.2, -0.2, 0]]),
      curve([[-3.5, -1, -0.6], [-1, -0.5, -0.4], [0.2, 0.3, 0.6], [1, 1, 0.2], [3, 1.6, -0.4]]),
      curve([[-2.5, 1.8, 0.8], [-0.6, 0.7, 0.5], [0.3, -0.6, -0.3], [1.5, -1.2, 0.5], [3.8, -1.6, 0.2]]),
    ];
    // Glukoz kılcaldan beta hücresine
    const glucIn: Hop[] = beta.slice(0, 30).map((b) => {
      const c = caps[Math.floor(r() * caps.length)]!;
      return { from: c.getPointAt(0.3 + r() * 0.4), to: b.p.clone() };
    });
    // İnsülin beta hücresinden kılcala
    const insOut: Hop[] = beta.slice(0, 40).map((b) => {
      const c = caps[Math.floor(r() * caps.length)]!;
      return { from: b.p.clone(), to: c.getPointAt(0.35 + r() * 0.3) };
    });
    const glucagonOut: Hop[] = alpha.map((a) => ({ from: a.p.clone(), to: a.p.clone().multiplyScalar(1.4) }));
    // Hedef kas hücresi: glukoz zar kanallarından içeri girer
    const gluts: CellSpec[] = [];
    const muscleIn: Hop[] = [];
    for (let i = 0; i < 16; i++) {
      const x = TARGET.x - 1.6 + (i / 15) * 3.2;
      const a = r() * Math.PI * 2;
      const p = new Vector3(x, TARGET.y + Math.cos(a) * 0.9, TARGET.z + Math.sin(a) * 0.9);
      gluts.push({ p, s: new Vector3(0.05, 0.12, 0.05) });
      const out = p.clone().sub(new Vector3(x, TARGET.y, TARGET.z)).normalize();
      muscleIn.push({ from: p.clone().addScaledVector(out, 0.7), to: p.clone().addScaledVector(out, -0.5) });
    }
    return { beta, alpha, delta, acinar, caps, glucIn, insOut, glucagonOut, gluts, muscleIn };
  }, []);

  return (
    <group>
      <ambientLight intensity={0.35} color="#ffe0f0" />
      <directionalLight position={[3, 6, 5]} intensity={1.15} />
      <Headlight intensity={2.6} distance={16} />
      <Cells cells={geo.acinar} geometry={cellGeo} material={acinarMat} onClick={pick('acinar')} />
      <Cells
        cells={geo.beta}
        geometry={cellGeo}
        material={betaMat}
        onClick={pick('beta')}
        time={time}
        animate={(i, t) => (stage === 3 ? { scale: 1 + 0.06 * Math.sin(t * 5 + i) } : undefined)}
      />
      <Cells cells={geo.alpha} geometry={cellGeo} material={alphaMat} onClick={pick('alpha')} />
      <Cells cells={geo.delta} geometry={cellGeo} material={deltaMat} onClick={pick('delta')} />
      <Tubes curves={geo.caps} radius={0.07} material={capMat} onClick={pick('capillary')} segments={96} />
      <CurveMovers curves={geo.caps} count={stage >= 2 ? 90 : 36} geometry={glucGeo} material={glucMat} time={time} speed={0.06} size={0.05} onClick={pick('glucose')} />
      <Hoppers hops={geo.glucIn} count={50} geometry={glucGeo} material={glucMat} time={time} duration={2.6} size={0.05} active={stage >= 2} onClick={pick('glucose')} />
      <Hoppers hops={geo.insOut} count={70} geometry={small} material={insMat} time={time} duration={2.2} size={0.04} seed={9} active={stage >= 3} onClick={pick('insulin')} />
      <Hoppers hops={geo.glucagonOut} count={24} geometry={small} material={glucagonMat} time={time} duration={3} size={0.035} seed={4} active={stage === 1} onClick={pick('glucagon')} />
      <mesh geometry={muscleGeo} material={muscleMat} position={TARGET} onClick={pick('target')} />
      <Cells cells={geo.gluts} geometry={small} material={glutMat} onClick={pick('target')} visible={stage === 4} />
      <Hoppers hops={geo.muscleIn} count={40} geometry={glucGeo} material={glucMat} time={time} duration={2} size={0.05} seed={21} active={stage === 4} onClick={pick('glucose')} />
    </group>
  );
}
