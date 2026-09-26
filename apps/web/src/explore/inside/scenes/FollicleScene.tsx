import { useMemo } from 'react';
import { MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Headlight, type InsideSceneProps, bumpySphere, rng, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, fibonacciSphere, makePick } from '../micro';

/**
 * Tiroid folikülleri (temsili): tek sıra hücreyle çevrili, içi koloid dolu kesecikler.
 * Ortadaki folikülün önü açık (kesit) çizilir ki koloid görünsün.
 */

const FOLLICLES: [number, number, number, number][] = [
  [0, 0, 0, 1.1],
  [2.5, 0.4, -0.6, 0.9],
  [-2.4, 0.2, -0.3, 0.95],
  [0.6, 2.2, -0.8, 0.8],
  [-0.4, -2.2, -0.5, 0.85],
  [2.1, -1.9, -1.0, 0.7],
];

const SHOTS = [
  { position: [0.4, 1.2, 8.5], target: [0, 0, -0.3] },
  { position: [1.8, 1.0, 4.2], target: [0.9, 0.2, 0] },
  { position: [0.8, 0.5, 3.4], target: [0, 0, 0] },
  { position: [-1.6, 0.6, 3.6], target: [-0.9, 0.1, 0] },
  { position: [0.2, 1.8, 7.2], target: [0, 0, -0.3] },
] as const;

export default function FollicleScene({ state, onSelect, reducedMotion }: InsideSceneProps) {
  const shot = SHOTS[state.stage] ?? SHOTS[0];
  useAtmosphere('#0a0508', ['#0a0508', 7, 19], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 14 }, { position: [0.4, 2, 13], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const stage = state.stage;

  const cellGeo = useDisposable(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.22));
  const cellMat = useDisposable(() => new MeshStandardMaterial({ color: '#d98fb0', roughness: 0.5, emissive: '#2a0a1a', emissiveIntensity: 0.4 }));
  const colloidMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f5b48a', roughness: 0.25, transparent: true, opacity: 0.6, emissive: '#4a2008', emissiveIntensity: 0.4, depthWrite: false }));
  const sphere = useDisposable(() => new SphereGeometry(1, 32, 24));
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const tshMat = useDisposable(() => new MeshStandardMaterial({ color: '#b98cf0', emissive: '#4a2a90', emissiveIntensity: 1.1 }));
  const iodMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff27a', emissive: '#8a7a10', emissiveIntensity: 1 }));
  const t4Mat = useDisposable(() => new MeshStandardMaterial({ color: '#ffae5c', emissive: '#8a4a00', emissiveIntensity: 1 }));
  const t3Mat = useDisposable(() => new MeshStandardMaterial({ color: '#ff6b6b', emissive: '#8a1a1a', emissiveIntensity: 1 }));
  const cGeo = useDisposable(() => bumpySphere(2, 0.12, 7));
  const cMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.6 }));

  const geo = useMemo(() => {
    const r = rng(61);
    const cells: CellSpec[] = [];
    const colloids: CellSpec[] = [];
    FOLLICLES.forEach(([x, y, z, rad], fi) => {
      const c = new Vector3(x, y, z);
      colloids.push({ p: c, s: rad * 0.86 });
      const n = Math.round(90 * rad * rad);
      fibonacciSphere(n, rad, c).forEach((p) => {
        const nrm = p.clone().sub(c);
        // Ortadaki folikül: kameraya bakan yarısı kesik
        if (fi === 0 && nrm.z > 0.25) return;
        cells.push({ p, s: new Vector3(0.2 * rad, 0.16, 0.2 * rad), q: faceOut(nrm) });
      });
    });
    const caps = [
      curve([[-4, -1, 1], [-1.2, -1.2, 1.2], [1.2, -0.9, 1.0], [4, -0.4, 0.4]]),
      curve([[-4, 1.4, 0.6], [-1.3, 1.3, 0.9], [1.4, 1.2, 0.6], [4, 1.6, -0.2]]),
      curve([[1.3, -4, 0], [1.3, -1.2, 0.3], [1.35, 1.2, 0.2], [1.2, 4, -0.4]]),
    ];
    const toCells = (count: number, reverse: boolean): Hop[] =>
      Array.from({ length: count }, () => {
        const cv = caps[Math.floor(r() * caps.length)]!;
        const from = cv.getPointAt(0.25 + r() * 0.5);
        const f = FOLLICLES[Math.floor(r() * FOLLICLES.length)]!;
        const center = new Vector3(f[0], f[1], f[2]);
        const to = center.clone().addScaledVector(from.clone().sub(center).normalize(), f[3]);
        return reverse ? { from: to, to: from } : { from, to };
      });
    const tsh = toCells(40, false);
    const iodine = toCells(40, false).map((h) => {
      // Hücreden koloide kadar devam et
      const f = FOLLICLES.reduce((best, cur) => (h.to.distanceTo(new Vector3(cur[0], cur[1], cur[2])) < h.to.distanceTo(new Vector3(best[0], best[1], best[2])) ? cur : best));
      return { from: h.from, to: new Vector3(f[0], f[1], f[2]).lerp(h.to, 0.55) };
    });
    const hormones = toCells(50, true);
    const ccells: CellSpec[] = [new Vector3(1.25, 1.1, -0.2), new Vector3(-1.3, -1.0, -0.1), new Vector3(1.4, -1.1, -0.5)].map((p) => ({ p, s: 0.24 }));
    return { cells, colloids, caps, tsh, iodine, hormones, ccells };
  }, []);

  const tshCount = stage === 1 ? 40 : stage === 4 ? 10 : stage >= 2 ? 20 : 0;

  return (
    <group>
      <ambientLight intensity={0.35} color="#ffe6f0" />
      <directionalLight position={[3, 6, 6]} intensity={1.15} />
      <Headlight intensity={2.6} distance={16} />
      <Cells
        cells={geo.cells}
        geometry={cellGeo}
        material={cellMat}
        onClick={pick('follicle')}
        time={time}
        animate={(i, t, out) => {
          if (stage === 1 || stage === 3) {
            out.set('#ffffff').lerp(out.clone().set('#ffd0ff'), 0.5 + 0.5 * Math.sin(t * 3 + i * 0.2));
            return { color: true };
          }
          out.set('#ffffff');
          return { color: true };
        }}
      />
      <Cells cells={geo.colloids} geometry={sphere} material={colloidMat} onClick={pick('colloid')} />
      <Cells cells={geo.ccells} geometry={cGeo} material={cMat} onClick={pick('ccell')} />
      <Tubes curves={geo.caps} radius={0.09} material={capMat} onClick={pick('capillary')} segments={80} />
      <Hoppers hops={geo.tsh} count={Math.max(1, tshCount)} geometry={small} material={tshMat} time={time} duration={3} size={0.05} active={tshCount > 0} onClick={pick('tsh')} />
      <Hoppers hops={geo.iodine} count={40} geometry={small} material={iodMat} time={time} duration={3.2} size={0.035} seed={8} active={stage === 2} onClick={pick('iodine')} />
      <Hoppers hops={geo.hormones} count={44} geometry={small} material={t4Mat} time={time} duration={2.8} size={0.05} seed={12} active={stage >= 3} onClick={pick('t4')} />
      <Hoppers hops={geo.hormones} count={12} geometry={small} material={t3Mat} time={time} duration={3.1} size={0.045} seed={19} active={stage >= 3} onClick={pick('t3')} />
      <CurveMovers curves={geo.caps} count={stage >= 3 ? 30 : 1} geometry={small} material={t4Mat} time={time} speed={0.08} size={stage >= 3 ? 0.05 : 0} seed={5} onClick={pick('t4')} />
    </group>
  );
}
