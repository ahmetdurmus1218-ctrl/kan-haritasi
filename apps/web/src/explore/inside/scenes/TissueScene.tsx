import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  type InstancedMesh,
  LineBasicMaterial,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, CurveMovers, Hoppers, type Pick, Tubes, curve, makePick } from '../micro';
import { tissueProfile } from '../tissues';
import { type CellGroup, type GeoKey, type PlacedLayer, TOP, type TissueLayout, X0, X1, Z0, Z1, layerShot, layoutTissue, overviewShot } from '../tissueLayout';

/**
 * Doku atlası sahnesi: tissues.ts'deki profili katman katman çizer. Her katman yarı saydam bir
 * matris bloğu ve ön kesit bandındaki temsili hücrelerden oluşur; katmana dokununca kamera o
 * katmana iner. Hareketler (peristaltizm, sil vuruşu, salgı, akış) basitleştirilmiş animasyondur,
 * sayısal fizyoloji simülasyonu değildir.
 */

const M = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const Z_AXIS = new Vector3(0, 0, 1);

type Geos = Record<GeoKey, import('three').BufferGeometry>;

function useGeos(): Geos {
  const blob = useDisposable(() => bumpySphere(1, 0.07, 4));
  const sphere = useDisposable(() => new SphereGeometry(1, 12, 10));
  const capsule = useDisposable(() => new CapsuleGeometry(0.5, 1, 4, 8).scale(2, 1, 2));
  const fiber = useDisposable(() => new CapsuleGeometry(0.5, 1, 2, 5).scale(2, 1, 2));
  const box = useDisposable(() => new RoundedBoxGeometry(2, 2, 2, 2, 0.35));
  const cilium = useDisposable(() => new CylinderGeometry(0.012, 0.02, 1, 5).translate(0, 0.5, 0));
  return useMemo(() => ({ blob, sphere, capsule, fiber, box, cilium }), [blob, sphere, capsule, fiber, box, cilium]);
}

/** Siller: tabanından eğilerek dalga hâlinde (metakronal) vuran ince çubuklar. */
function Cilia({ group, geometry, material, time, onClick }: { group: CellGroup; geometry: import('three').BufferGeometry; material: MeshStandardMaterial; time: { current: number }; onClick: ReturnType<Pick> }) {
  const ref = useRef<InstancedMesh>(null);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = time.current;
    group.cells.forEach((c, i) => {
      const beat = group.anim === 'sway' ? Math.sin(t * 7 - c.p.x * 5 - c.p.z * 2) : 0;
      Q.setFromAxisAngle(Z_AXIS, -0.25 - beat * 0.45);
      M.compose(c.p, Q, c.s);
      mesh.setMatrixAt(i, M);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, group.cells.length]} onClick={onClick} frustumCulled={false} />;
}

function GroupMesh({ group, geos, material, time, onClick }: { group: CellGroup; geos: Geos; material: MeshStandardMaterial; time: { current: number }; onClick: ReturnType<Pick> }) {
  const tint = useMemo(() => new Color(), []);
  const base = useMemo(() => new Color(group.color), [group.color]);
  const cells = useMemo(() => (group.cells.some((c) => c.color) ? group.cells.map((c) => ({ ...c, color: c.color ?? group.color })) : group.cells), [group]);
  if (group.geo === 'cilium') return <Cilia group={group} geometry={geos.cilium} material={material} time={time} onClick={onClick} />;
  const span = X1 - X0 + 2.4;
  const animate =
    group.anim === 'peristalsis'
      ? (i: number, t: number, out: Color) => {
          // Dalga soldan sağa ilerler: dalga tepesindeki kas lifleri kalınlaşır ve parlar.
          const w = X0 - 1.2 + ((t * 0.9) % span);
          const b = Math.exp(-((cells[i]!.p.x - w) ** 2) / 0.35);
          out.copy(base).lerp(tint.set('#ffffff'), b * 0.35);
          return { scale: 1 + b * 0.4, color: true };
        }
      : group.anim === 'contract'
        ? (_i: number, t: number) => ({ scale: 1 + 0.14 * Math.max(0, Math.sin(t * 1.3)) })
        : undefined;
  return <Cells cells={cells} geometry={geos[group.geo]} material={material} onClick={onClick} time={time} animate={animate} />;
}

/** Lümen içeriği: organın boşluğunda sürüklenen parçacıklar (lokma, safra, idrar, hava vb.). */
function LumenDrift({ layout, color, fast, time, geometry, onClick }: { layout: TissueLayout; color: string; fast: boolean; time: { current: number }; geometry: import('three').BufferGeometry; onClick: ReturnType<Pick> }) {
  const ref = useRef<InstancedMesh>(null);
  const lumen = layout.lumen!;
  const material = useDisposable(() => new MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 }), [color]);
  const data = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 90 }, () => ({ x: r(), y: lumen.yBot + 0.15 + r() * (lumen.yTop - lumen.yBot - 0.25), z: Z0 + 0.2 + r() * (Z1 - Z0 - 0.4), s: 0.03 + r() * 0.06, v: 0.6 + r() * 0.8 }));
  }, [lumen.yBot, lumen.yTop]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = time.current;
    data.forEach((d, i) => {
      const u = (d.x + t * (fast ? 0.09 : 0.025) * d.v) % 1;
      P.set(X0 + u * (X1 - X0), d.y + Math.sin(t * 0.8 + i) * 0.04, d.z);
      S.setScalar(d.s);
      M.compose(P, Q.identity(), S);
      mesh.setMatrixAt(i, M);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, data.length]} onClick={onClick} frustumCulled={false} />;
}

function Slab({ p, active, onClick, edges, box }: { p: PlacedLayer; active: boolean; onClick: ReturnType<Pick>; edges: EdgesGeometry; box: BoxGeometry }) {
  const membrane = p.slab === 'membrane';
  const h = membrane ? 0.04 : p.yTop - p.yBot;
  const y = membrane ? p.yBot + 0.02 : (p.yTop + p.yBot) / 2;
  const mat = useDisposable(
    () =>
      new MeshPhysicalMaterial({
        color: p.layer.color,
        roughness: 0.55,
        clearcoat: 0.4,
        transparent: true,
        opacity: membrane ? 0.7 : 0.26,
        depthWrite: false,
        emissive: p.layer.color,
        emissiveIntensity: 0.08,
      }),
    [p.layer.color, membrane],
  );
  const line = useDisposable(() => new LineBasicMaterial({ color: p.layer.color, transparent: true, opacity: 0.55 }), [p.layer.color]);
  useEffect(() => {
    mat.emissiveIntensity = active ? 0.45 : 0.08;
    mat.opacity = membrane ? 0.7 : active ? 0.4 : 0.26;
    line.opacity = active ? 1 : 0.45;
    line.color.set(active ? '#ffffff' : p.layer.color);
  }, [active, mat, line, membrane, p.layer.color]);
  return (
    <group position={[(X0 + X1) / 2, y, (Z0 + Z1) / 2]} scale={[X1 - X0, h, Z1 - Z0]}>
      <mesh geometry={box} material={mat} onClick={onClick} renderOrder={2} />
      <lineSegments geometry={edges} material={line} />
    </group>
  );
}

const CHANNEL_COLOR = { artery: '#c8323c', vein: '#6a4aa0', sinusoid: '#b8404a', duct: '#e8d8a0' } as const;

function LayerView({ p, geos, active, pick, time, edges, box, rbcGeo, rbcMat, granule, granuleColor }: {
  p: PlacedLayer;
  geos: Geos;
  active: boolean;
  pick: Pick;
  time: { current: number };
  edges: EdgesGeometry;
  box: BoxGeometry;
  rbcGeo: import('three').BufferGeometry;
  rbcMat: MeshStandardMaterial;
  granule: import('three').BufferGeometry;
  granuleColor: string;
}) {
  const onClick = pick(p.layer.key);
  const materials = useMemo(
    () =>
      p.groups.map((g) => {
        const colored = g.cells.some((c) => c.color);
        return new MeshStandardMaterial({ color: colored ? '#ffffff' : g.color, roughness: g.geo === 'fiber' ? 0.7 : 0.5, emissive: g.color, emissiveIntensity: 0.12 });
      }),
    [p.groups],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useEffect(() => {
    for (const m of materials) m.emissiveIntensity = active ? 0.42 : 0.12;
  }, [active, materials]);
  const channelMats = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(CHANNEL_COLOR).map(([k, c]) => [k, new MeshStandardMaterial({ color: c, roughness: 0.45, transparent: k !== 'duct', opacity: k === 'duct' ? 1 : 0.55, emissive: c, emissiveIntensity: 0.2 })]),
      ) as Record<keyof typeof CHANNEL_COLOR, MeshStandardMaterial>,
    [],
  );
  useEffect(() => () => Object.values(channelMats).forEach((m) => m.dispose()), [channelMats]);
  const tubes = useMemo(() => p.channels.map((c) => ({ c, cv: curve(c.points) })), [p.channels]);
  const blood = useMemo(() => tubes.filter((t) => t.c.kind !== 'duct').map((t) => t.cv), [tubes]);
  const granuleMat = useDisposable(() => new MeshStandardMaterial({ color: granuleColor, emissive: granuleColor, emissiveIntensity: 0.6 }), [granuleColor]);
  const hops = useMemo(() => p.flows.map((f) => ({ from: f.from, to: f.to, lift: new Vector3(0, 0.15, 0) })), [p.flows]);

  return (
    <group>
      {p.slab !== 'none' && <Slab p={p} active={active} onClick={onClick} edges={edges} box={box} />}
      {p.groups.map((g, i) => (
        <GroupMesh key={`${g.label}-${i}`} group={g} geos={geos} material={materials[i]!} time={time} onClick={onClick} />
      ))}
      {tubes.map(({ c, cv }, i) => (
        <Tubes key={i} curves={[cv]} radius={c.radius} material={channelMats[c.kind]} onClick={onClick} segments={48} radial={8} />
      ))}
      {blood.length > 0 && <CurveMovers curves={blood} count={blood.length * 14} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={Math.min(0.1, (p.channels[0]?.radius ?? 0.08) * 1.3)} seed={p.layer.key.length} onClick={onClick} />}
      {hops.length > 0 && <Hoppers hops={hops} count={Math.min(80, hops.length * 3)} geometry={granule} material={granuleMat} time={time} duration={3.6} size={0.035} onClick={onClick} />}
    </group>
  );
}

export default function TissueScene({ state, onSelect, reducedMotion }: InsideSceneProps) {
  const profile = tissueProfile(state.scene)!;
  const layout = useMemo(() => layoutTissue(profile), [profile]);
  useAtmosphere(profile.background, [profile.background, 12, 34], 0.45);
  const stageFocus = state.stage > 0 ? profile.process_stages[state.stage - 1]?.focus : undefined;
  const active = state.selected ?? stageFocus ?? null;
  // Masaüstünde sağ panel tuvalin sağ üçte birini örter; blok görünen alana kaydırılır.
  const wide = useThree((s) => s.size.width >= 1024);
  // Dikey (telefon) ekranda 8 birim genişliğindeki blok sığsın diye kamera geri çekilir.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const back = aspect < 1 ? Math.min(2.2, 1.1 / aspect) : 1;
  const shift = wide ? 3 : 0.4;
  const pull = (sh: { position: [number, number, number]; target: [number, number, number] }, k = back) => ({
    target: sh.target,
    position: sh.position.map((v, i) => sh.target[i]! + (v - sh.target[i]!) * k) as [number, number, number],
  });
  const layer = layerShot(layout, active, wide ? 2.2 : 0.4);
  const shot = layer ? pull(layer, Math.sqrt(back)) : pull(overviewShot(layout, shift));
  const overview = pull(overviewShot(layout, shift));
  useStageCamera(shot, { min: 0.8, max: 20 * back }, { position: [overview.position[0] + 2, overview.position[1] + 2, overview.position[2] + 5], target: overview.target });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);
  const geos = useGeos();
  const box = useDisposable(() => new BoxGeometry(1, 1, 1));
  const edges = useDisposable(() => new EdgesGeometry(box), [box]);
  const rbcGeo = useDisposable(() => rbcGeometry(12));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const lumenLine = useDisposable(() => new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12 }));
  const lumenLayer = layout.lumen?.layer;
  const lumenActive = !!lumenLayer && active === lumenLayer.key;
  useEffect(() => {
    lumenLine.opacity = lumenActive ? 0.5 : 0.12;
  }, [lumenActive, lumenLine]);
  const granuleColor = lumenLayer?.particle ?? '#f0e0a0';

  return (
    <group>
      <Headlight intensity={4} distance={14} />
      <hemisphereLight args={['#fff4ec', '#201018', 0.6]} />
      {layout.layers.map((p) => (
        <LayerView
          key={p.layer.key}
          p={p}
          geos={geos}
          active={active === p.layer.key}
          pick={pick}
          time={time}
          edges={edges}
          box={box}
          rbcGeo={rbcGeo}
          rbcMat={rbcMat}
          granule={geos.sphere}
          granuleColor={granuleColor}
        />
      ))}
      {layout.lumen && lumenLayer && (
        <>
          <group position={[(X0 + X1) / 2, (layout.lumen.yTop + layout.lumen.yBot) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, layout.lumen.yTop - TOP, Z1 - Z0]}>
            <lineSegments geometry={edges} material={lumenLine} />
          </group>
          <LumenDrift layout={layout} color={lumenLayer.particle ?? '#e0e0e0'} fast={lumenLayer.motion === 'flow'} time={time} geometry={geos.blob} onClick={pick(lumenLayer.key)} />
        </>
      )}
    </group>
  );
}
