import { useMemo } from 'react';
import { Color, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, makePick } from '../micro';

/**
 * Karaciğer lobülü (temsili): altıgen lobül, köşelerde portal alanlar (portal ven, hepatik arter,
 * safra kanalı), ortada merkez ven. Hepatosit sıraları merkeze doğru ışınsal dizilir; kan
 * sinüzoidlerde merkeze, safra ters yönde köşelere akar.
 */

const R = 3;
const ROWS = 30;
const PER_ROW = 8;

const SHOTS = [
  { position: [0, 7.5, 5.2], target: [0, 0, 0] },
  { position: [2.8, 3.2, 3.6], target: [1.2, 0, 0.6] },
  { position: [1.6, 1.8, 2.4], target: [0.9, 0, 0.3] },
  { position: [-2.8, 2.6, 2.6], target: [-2, 0, 0.8] },
  { position: [1.8, 2.2, -1.2], target: [1.3, 0, -0.9] },
] as const;

export default function LobuleScene({ state, onSelect, reducedMotion }: InsideSceneProps) {
  const shot = SHOTS[state.stage] ?? SHOTS[0];
  useAtmosphere('#0b0604', ['#0b0604', 7, 20], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 14 }, { position: [0, 13, 8], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const stage = state.stage;

  const hepGeo = useDisposable(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.22));
  const hepMat = useDisposable(() => new MeshStandardMaterial({ color: '#b5654a', roughness: 0.55, emissive: '#2a0e05', emissiveIntensity: 0.4 }));
  const cvMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#4a6fd6', roughness: 0.35, transparent: true, opacity: 0.55, emissive: '#0c1840', emissiveIntensity: 0.5 }));
  const pvMat = useDisposable(() => new MeshStandardMaterial({ color: '#6a5ad6', roughness: 0.4, emissive: '#10103a', emissiveIntensity: 0.4 }));
  const haMat = useDisposable(() => new MeshStandardMaterial({ color: '#d4454f', roughness: 0.4, emissive: '#300408', emissiveIntensity: 0.4 }));
  const bdMat = useDisposable(() => new MeshStandardMaterial({ color: '#6fbf5a', roughness: 0.4, emissive: '#10300a', emissiveIntensity: 0.4 }));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const bileMat = useDisposable(() => new MeshStandardMaterial({ color: '#9be07a', emissive: '#2f6a14', emissiveIntensity: 0.9 }));
  const altMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff7ad9', emissive: '#8a1a6a', emissiveIntensity: 1.1 }));
  const albMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff3c4', emissive: '#6a5a20', emissiveIntensity: 0.7 }));
  const kupGeo = useDisposable(() => bumpySphere(2, 0.2, 5));
  const kupMat = useDisposable(() => new MeshStandardMaterial({ color: '#c9b6ff', roughness: 0.6, emissive: '#1a1040', emissiveIntensity: 0.4 }));

  const geo = useMemo(() => {
    const r = rng(41);
    const corners = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      return new Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
    });
    const hep: CellSpec[] = [];
    const stressed = new Set<number>();
    const sinusoids = [];
    const bile: Hop[] = [];
    for (let row = 0; row < ROWS; row++) {
      const a = (row / ROWS) * Math.PI * 2;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      // Altıgen sınıra kadar uzunluk
      const sector = ((a + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6;
      const len = (R * Math.cos(Math.PI / 6)) / Math.cos(sector) - 0.2;
      const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), dir);
      for (let k = 0; k < PER_ROW; k++) {
        const d = 0.55 + (k / (PER_ROW - 1)) * (len - 0.7);
        const idx = hep.length;
        hep.push({ p: dir.clone().multiplyScalar(d).setY((r() - 0.5) * 0.05), s: new Vector3(0.3, 0.34, 0.2), q });
        if (row >= 4 && row <= 7 && k >= 2 && k <= 5) stressed.add(idx);
      }
      // Sinüzoid: iki sıra arasından merkeze
      const a2 = a + Math.PI / ROWS;
      const d2 = new Vector3(Math.cos(a2), 0, Math.sin(a2));
      sinusoids.push(curve([[d2.x * len, 0.02, d2.z * len], [d2.x * len * 0.5, 0.02, d2.z * len * 0.5], [d2.x * 0.45, 0.02, d2.z * 0.45]]));
      // Safra: sıranın içinden köşeye (akışın tersi)
      const mid = dir.clone().multiplyScalar(len * 0.35);
      const end = dir.clone().multiplyScalar(len * 0.95);
      bile.push({ from: mid, to: end.setY(0.12) });
    }
    const altHops: Hop[] = [...stressed].map((i) => {
      const p = hep[i]!.p;
      return { from: p.clone(), to: p.clone().multiplyScalar(0.7).add(new Vector3(0, 0.25, 0)) };
    });
    const albHops: Hop[] = hep.filter((_, i) => i % 9 === 0).map((c) => ({ from: c.p.clone(), to: c.p.clone().multiplyScalar(0.85).add(new Vector3(0, 0.2, 0)) }));
    const kupffer: CellSpec[] = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      return { p: new Vector3(Math.cos(a) * 1.6, 0.08, Math.sin(a) * 1.6), s: 0.13 };
    });
    return { corners, hep, stressed, sinusoids, bile, altHops, albHops, kupffer };
  }, []);

  const tint = useMemo(() => new Color('#e0564a'), []);
  const cv = useMemo(() => [curve([[0, -0.5, 0], [0, 0.5, 0]])], []);
  const pv = useMemo(() => geo.corners.map((c) => curve([[c.x - 0.12, -0.45, c.z], [c.x - 0.12, 0.45, c.z]])), [geo]);
  const ha = useMemo(() => geo.corners.map((c) => curve([[c.x + 0.16, -0.45, c.z + 0.1], [c.x + 0.16, 0.45, c.z + 0.1]])), [geo]);
  const bd = useMemo(() => geo.corners.map((c) => curve([[c.x + 0.1, -0.45, c.z - 0.16], [c.x + 0.1, 0.45, c.z - 0.16]])), [geo]);

  return (
    <group>
      <ambientLight intensity={0.35} color="#ffe2cc" />
      <directionalLight position={[3, 8, 4]} intensity={1.2} />
      <Headlight intensity={2.5} distance={16} />
      <Cells
        cells={geo.hep}
        geometry={hepGeo}
        material={hepMat}
        onClick={pick('hepatocyte')}
        time={time}
        animate={(i, t, out) => {
          const scale = stage === 2 ? 1 + 0.04 * Math.sin(t * 2.4 + i * 0.3) : 1;
          // İnstance rengi malzeme rengiyle çarpılır: beyaz = değişmemiş hepatosit.
          if (stage === 4 && geo.stressed.has(i)) out.copy(tint).offsetHSL(0, 0, 0.08 * Math.sin(t * 3 + i));
          else out.set('#ffffff');
          return { scale, color: true };
        }}
      />
      <Tubes curves={cv} radius={0.34} material={cvMat} onClick={pick('centralvein')} />
      <Tubes curves={pv} radius={0.16} material={pvMat} onClick={pick('portal')} />
      <Tubes curves={ha} radius={0.07} material={haMat} onClick={pick('portal')} />
      <Tubes curves={bd} radius={0.07} material={bdMat} onClick={pick('bile')} />
      <CurveMovers curves={geo.sinusoids} count={reducedMotion ? 110 : 220} geometry={rbcGeo} material={rbcMat} time={time} speed={0.07} size={0.11} flat jitter={0.05} onClick={pick('rbc')} />
      <Cells cells={geo.kupffer} geometry={kupGeo} material={kupMat} onClick={pick('kupffer')} time={time} animate={(i, t) => ({ scale: 1 + 0.08 * Math.sin(t * 2 + i) })} />
      <Hoppers hops={geo.albHops} count={40} geometry={small} material={albMat} time={time} duration={3} size={0.045} active={stage === 2} onClick={pick('hepatocyte')} />
      <Hoppers hops={geo.bile} count={70} geometry={small} material={bileMat} time={time} duration={3.4} size={0.04} seed={7} active={stage === 3} onClick={pick('bile')} />
      <Hoppers hops={geo.altHops} count={32} geometry={small} material={altMat} time={time} duration={2.6} size={0.05} seed={11} active={stage === 4} onClick={pick('alt')} />
    </group>
  );
}
