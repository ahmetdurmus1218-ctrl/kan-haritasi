import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, type Group, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, fibonacciSphere, makePick, sphereCurve } from '../micro';

/**
 * Alveol ve gaz değişimi (temsili). Bir bronşiyolün ucunda üzüm salkımı gibi alveoller;
 * çevrelerinde kılcal ağ. Oksijen alveolden kana, karbondioksit kandan alveole geçer.
 */

const ALVEOLI: [number, number, number, number][] = [
  [0, 0, 0, 1],
  [1.75, 0.35, -0.2, 0.85],
  [-1.7, 0.25, 0.1, 0.9],
  [0.3, 1.6, -0.3, 0.8],
  [0.2, -1.55, 0.2, 0.85],
  [1.3, -1.2, -0.6, 0.7],
  [-1.2, 1.3, -0.5, 0.72],
];

const SHOTS = [
  { position: [0.4, 0.8, 8.2], target: [0, 0, 0] },
  { position: [2.2, 1.3, 5.0], target: [0.4, 0.1, 0.2] },
  { position: [1.9, 0.9, 4.2], target: [0.3, 0.1, 0.4] },
  { position: [-1.6, 0.9, 4.4], target: [-0.1, 0.1, 0.4] },
  { position: [0.4, 0.4, 3.4], target: [0, 0, 0] },
] as const;

export default function AlveolusScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const shot = SHOTS[state.stage] ?? SHOTS[0];
  useAtmosphere('#040b10', ['#040b10', 5, 16], 0.5);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.6, max: 10 }, { position: [0.5, 1.5, 12], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const stage = state.stage;
  const breath = useRef<Group>(null);

  const membrane = useDisposable(
    () =>
      new MeshPhysicalMaterial({
        color: '#f7c1cf',
        roughness: 0.35,
        transmission: 0,
        transparent: true,
        opacity: 0.3,
        side: DoubleSide,
        depthWrite: false,
        sheen: 1,
        sheenColor: new Color('#ffd6e0'),
        emissive: '#6a1f33',
        emissiveIntensity: 0.55,
      }),
  );
  const sphere = useDisposable(() => new SphereGeometry(1, 48, 32));
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c0303f', roughness: 0.45, emissive: '#3a0508', emissiveIntensity: 0.5, transparent: true, opacity: 0.88 }));
  const airMat = useDisposable(() => new MeshStandardMaterial({ color: '#e7c8c0', roughness: 0.6, transparent: true, opacity: 0.55 }));
  const rbcGeo = useDisposable(() => rbcGeometry(18));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.45, emissive: '#200306', emissiveIntensity: 0.4 }));
  const small = useDisposable(() => new SphereGeometry(1, 12, 8));
  const o2Mat = useDisposable(() => new MeshStandardMaterial({ color: '#bff6ff', emissive: '#4fd6e8', emissiveIntensity: 1.2 }));
  const co2Mat = useDisposable(() => new MeshStandardMaterial({ color: '#b9a8d8', emissive: '#4a3a70', emissiveIntensity: 0.8 }));
  const t2Geo = useDisposable(() => bumpySphere(2, 0.12, 4));
  const t2Mat = useDisposable(() => new MeshStandardMaterial({ color: '#e59bc0', roughness: 0.55, emissive: '#3a0c24', emissiveIntensity: 0.4 }));
  const macGeo = useDisposable(() => bumpySphere(3, 0.16, 8));
  const macMat = useDisposable(() => new MeshStandardMaterial({ color: '#c9b6ff', roughness: 0.6, emissive: '#1a1040', emissiveIntensity: 0.5 }));
  const surfMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff0b0', emissive: '#a07a10', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));

  const { capillaries, hopsO2, hopsCO2, type2, alveoli, surf } = useMemo(() => {
    const r = rng(21);
    const caps = [];
    const hopsO2: Hop[] = [];
    const hopsCO2: Hop[] = [];
    for (const [x, y, z, rad] of ALVEOLI) {
      const c = new Vector3(x, y, z);
      for (let k = 0; k < 3; k++) {
        const cv = sphereCurve(c, rad * 1.04, r, 1.3, 10);
        caps.push(cv);
        for (let h = 0; h < 3; h++) {
          const onCap = cv.getPointAt(0.15 + 0.7 * r());
          const inside = c.clone().lerp(onCap, 0.35);
          hopsO2.push({ from: inside, to: onCap });
          hopsCO2.push({ from: onCap.clone(), to: c.clone().lerp(onCap, 0.4) });
        }
      }
    }
    const type2: CellSpec[] = [];
    const surf: Hop[] = [];
    ALVEOLI.forEach(([x, y, z, rad], ai) => {
      const c = new Vector3(x, y, z);
      fibonacciSphere(4, rad * 0.98, c).forEach((p, i) => {
        if ((i + ai) % 2 === 0) {
          type2.push({ p, s: 0.09 });
          surf.push({ from: p.clone(), to: c.clone().lerp(p, 0.85).add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.4)) });
        }
      });
    });
    return {
      capillaries: caps,
      hopsO2,
      hopsCO2,
      type2,
      surf,
      alveoli: ALVEOLI.map(([x, y, z, rad]) => ({ p: new Vector3(x, y, z), s: rad }) as CellSpec),
    };
  }, []);

  const bronchiole = useMemo(() => [curve([[0, 0, 0], [0.3, -0.4, 1.2], [0.2, -1.2, 2.6], [0.5, -2.4, 3.6]])], []);
  const macrophages = useMemo<CellSpec[]>(() => [{ p: new Vector3(0.25, -0.2, 0.3), s: 0.2 }, { p: new Vector3(1.6, 0.3, 0.1), s: 0.16 }], []);

  useFrame(() => {
    const g = breath.current;
    if (!g) return;
    const t = time.current;
    const s = 1 + 0.035 * Math.sin(t * 1.4);
    g.scale.setScalar(s);
  });

  const oxy = new Color('#e8323f');
  const deoxy = new Color('#6e1024');

  return (
    <group>
      <ambientLight intensity={0.35} color="#cfe8ff" />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <Headlight intensity={3} color="#e8f6ff" distance={12} />
      <group ref={breath}>
        <Cells cells={alveoli} geometry={sphere} material={membrane} onClick={pick(stage >= 2 ? 'type1' : 'alveolus')} />
        <Tubes curves={capillaries} radius={0.045} material={capMat} onClick={pick('capillary')} segments={80} radial={8} />
        <Tubes curves={bronchiole} radius={0.32} material={airMat} onClick={pick('alveolus')} />
        <CurveMovers
          curves={capillaries}
          count={reducedMotion ? 125 : 245}
          shown={scaled(reducedMotion ? 90 : 180, params.rbc, reducedMotion ? 125 : 245)}
          geometry={rbcGeo}
          material={rbcMat}
          time={time}
          speed={0.09}
          size={0.07 * (params.rbcSize ?? 1)}
          flat
          onClick={pick('rbc')}
          color={(u, _i, out) => (stage >= 2 ? out.copy(deoxy).lerp(oxy, Math.min(1, u * 1.6)) : out.copy(deoxy).lerp(oxy, 0.35))}
        />
        <Cells cells={type2} geometry={t2Geo} material={t2Mat} onClick={pick('type2')} time={time} animate={(i, t, out) => (stage === 4 ? { scale: 1 + 0.15 * Math.sin(t * 3 + i), color: !!out.set('#ffc2e0') } : undefined)} />
        <Cells cells={macrophages} geometry={macGeo} material={macMat} onClick={pick('macrophage')} time={time} animate={(i, t) => ({ scale: 1 + 0.06 * Math.sin(t * 2 + i) })} />
        <Hoppers hops={hopsO2} count={125} shown={scaled(90, params.rbc, 125)} geometry={small} material={o2Mat} time={time} duration={2.6} size={0.03} active={stage >= 2} onClick={pick('o2')} />
        <Hoppers hops={hopsCO2} count={70} geometry={small} material={co2Mat} time={time} duration={3.1} size={0.034} seed={9} active={stage >= 3} onClick={pick('co2')} />
        <Hoppers hops={surf} count={40} geometry={small} material={surfMat} time={time} duration={3.5} size={0.028} seed={13} active={stage === 4} onClick={pick('type2')} />
      </group>
    </group>
  );
}
