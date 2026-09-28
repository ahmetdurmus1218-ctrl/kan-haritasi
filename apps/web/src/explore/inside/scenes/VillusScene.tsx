import { useMemo } from 'react';
import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, faceOut, makePick } from '../micro';

/**
 * İnce bağırsak villusları (temsili). Bağırsak duvarından yükselen parmak biçimli villuslar ve
 * aralarındaki kriptler. Öndeki villus kesik çizilir: ortada lenf kanalı (lakteal), çevresinde kılcal
 * ağ; yüzeyde fırçamsı kenarlı (mikrovillus) enterositler ve mukus salgılayan goblet hücreleri.
 * Boşluktaki besinler enterositlerden geçip kana (şeker, amino asit, demir, B12) ya da şilomikron
 * olarak lenfe (yağ) katılır. Yanda villussuz, yalnızca kriptli kalın bağırsak yüzeyi ve mikrobiyota.
 */

const WALL = -1.5;
const WALL_BOT = -3;
const X0 = -5.2;
const X1 = 2.6;
const Z0 = -2.4;
const Z1 = 1.4;
/** Kesik (öne çıkarılmış) villus: taban merkezi, yarıçap, yükseklik. */
const FX = -0.8;
const FZ = 0.75;
const FR = 0.5;
const FH = 2.7;
const DOME = FH - FR;
const CORE = FR - 0.21;
const COLON = { x0: 3.3, x1: 6.3, z0: -2.2, z1: 1.2, top: -1.3 };

const SHOTS = [
  { position: [1.8, 2.6, 9.8], target: [0.2, -0.4, -0.2] },
  { position: [0.55, 0.6, 1.95], target: [-0.35, 0.25, 0.8] },
  { position: [0.2, 0.3, 3.6], target: [-0.8, -0.1, 0.6] },
  { position: [-2.2, 0.4, 4.2], target: [-1.2, -0.6, 0.4] },
  { position: [0.5, 1.2, 3.6], target: [-0.8, 0.1, 0.6] },
  { position: [7.2, 1.2, 5.0], target: [4.8, -1.2, -0.4] },
] as const;

const UP = new Vector3(0, 1, 0);

/** Kesik villusun yerel silindir koordinatından dünya noktası (φ=0 → +z, kameraya doğru). */
function onVillus(phi: number, y: number, radius: number): Vector3 {
  return new Vector3(FX + radius * Math.sin(phi), WALL + y, FZ + radius * Math.cos(phi));
}

/** Parmak profili (birim yarıçap ve yükseklik): hafif genişleyen taban, silindir, yuvarlak uç. */
function fingerProfile(radius: number, height: number, dome: number): Vector2[] {
  const pts = [new Vector2(radius * 1.3, 0), new Vector2(radius * 1.08, height * 0.012), new Vector2(radius, height * 0.03), new Vector2(radius, height - dome)];
  for (let k = 1; k <= 8; k++) {
    const a = (k / 8) * (Math.PI / 2);
    pts.push(new Vector2(Math.max(1e-4, radius * Math.cos(a)), height - dome + dome * Math.sin(a)));
  }
  return pts;
}

export default function VillusScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0b0508', ['#0b0508', 8, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.6, max: 15 }, { position: [2.5, 5, 15], target: [0.2, -0.4, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);

  const boxGeo = useDisposable(() => new BoxGeometry(1, 1, 1));
  const wallMat = useDisposable(() => new MeshStandardMaterial({ color: '#8e3e48', roughness: 0.75, side: BackSide, emissive: '#200408', emissiveIntensity: 0.35 }));
  const planeGeo = useDisposable(() => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const wallTopMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8747a', roughness: 0.65, emissive: '#2a080c', emissiveIntensity: 0.35 }));
  const fingerGeo = useDisposable(() => new LatheGeometry(fingerProfile(1, 1, 0.2), 20));
  const villusMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#e7a3a0', roughness: 0.5, sheen: 1, sheenColor: '#ffd6d0', emissive: '#3a0e12', emissiveIntensity: 0.35 }),
  );
  const coreGeo = useDisposable(() => {
    const pts = [new Vector2(CORE * 1.2, 0), new Vector2(CORE, 0.06), new Vector2(CORE, DOME)];
    for (let k = 1; k <= 8; k++) {
      const a = (k / 8) * (Math.PI / 2);
      pts.push(new Vector2(Math.max(1e-4, CORE * Math.cos(a)), DOME + CORE * Math.sin(a)));
    }
    // Yalnızca arka yarı (kameraya bakan yarısı kesilmiş)
    return new LatheGeometry(pts, 24, 1.37, Math.PI * 2 - 2 * 1.37);
  });
  const coreMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8646e', roughness: 0.7, side: DoubleSide, emissive: '#2a060c', emissiveIntensity: 0.4 }));
  const enteroGeo = useDisposable(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.22));
  const enteroMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0b4aa', roughness: 0.5, emissive: '#2a0c08', emissiveIntensity: 0.35 }));
  const gobletGeo = useDisposable(() => bumpySphere(2, 0.08, 4));
  const gobletMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#dfe8ff', roughness: 0.3, transparent: true, opacity: 0.85, emissive: '#1a2a4a', emissiveIntensity: 0.4 }));
  const mvGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 5));
  const mvMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe0d8', roughness: 0.4, emissive: '#5a2a20', emissiveIntensity: 0.5 }));
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5 }));
  const lactealMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#f6efd6', roughness: 0.3, transparent: true, opacity: 0.5, depthWrite: false, side: DoubleSide, emissive: '#4a4430', emissiveIntensity: 0.4 }),
  );
  const torusGeo = useDisposable(() => new TorusGeometry(0.13, 0.04, 8, 20));
  const cryptMat = useDisposable(() => new MeshStandardMaterial({ color: '#5a2230', roughness: 0.55, emissive: '#1a0408', emissiveIntensity: 0.5 }));
  const cryptBaseGeo = useDisposable(() => bumpySphere(1, 0.12, 6));
  const cryptBaseMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0d890', roughness: 0.5, emissive: '#3a2a08', emissiveIntensity: 0.5 }));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const ico = useDisposable(() => new IcosahedronGeometry(1, 0));
  const glucMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff08a', emissive: '#8a7a10', emissiveIntensity: 1 }));
  const aaMat = useDisposable(() => new MeshStandardMaterial({ color: '#8ee89a', emissive: '#1a6a24', emissiveIntensity: 0.9 }));
  const micelleGeo = useDisposable(() => bumpySphere(1, 0.18, 2));
  const micelleMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffa040', roughness: 0.4, emissive: '#8a3a00', emissiveIntensity: 0.8 }));
  const chyloMat = useDisposable(() => new MeshStandardMaterial({ color: '#fbfbf2', roughness: 0.35, emissive: '#6a6a60', emissiveIntensity: 0.7 }));
  const ironMat = useDisposable(() => new MeshStandardMaterial({ color: '#c4502e', emissive: '#6a1a08', emissiveIntensity: 0.9 }));
  const b12Mat = useDisposable(() => new MeshStandardMaterial({ color: '#ff7ab8', emissive: '#a01a5a', emissiveIntensity: 1.1 }));
  const mucusMat = useDisposable(() => new MeshStandardMaterial({ color: '#e8f4ff', emissive: '#4a7aa0', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
  const colonMat = useDisposable(() => new MeshStandardMaterial({ color: '#8e4450', roughness: 0.75, side: BackSide, emissive: '#200608', emissiveIntensity: 0.35 }));
  const colonTopMat = useDisposable(() => new MeshStandardMaterial({ color: '#b87078', roughness: 0.65, emissive: '#200608', emissiveIntensity: 0.35 }));
  const colonMucusMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#d8ecff', roughness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, emissive: '#20405a', emissiveIntensity: 0.35 }),
  );
  const bacGeo = useDisposable(() => new CapsuleGeometry(0.05, 0.16, 4, 8));
  const bacMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#1a2a10', emissiveIntensity: 0.5 }));
  const waterMat = useDisposable(() => new MeshStandardMaterial({ color: '#8fd8ff', emissive: '#1f6a9a', emissiveIntensity: 0.9 }));

  const geo = useMemo(() => {
    const r = rng(83);
    // Arka plandaki villuslar (öndeki kesik villusun yakını boş bırakılır)
    const villi: CellSpec[] = [];
    for (const z of [-1.9, -0.7, 0.5]) {
      for (const x of [-4.5, -3.3, -2.1, -0.9, 0.3, 1.5]) {
        if (z === 0.5 && (x === -0.9 || x === 0.3)) continue;
        const R = 0.36 + r() * 0.07;
        const tilt = new Quaternion().setFromAxisAngle(new Vector3(r() - 0.5, 0, r() - 0.5).normalize(), (r() - 0.5) * 0.16);
        villi.push({ p: new Vector3(x + (r() - 0.5) * 0.3, WALL, z + (r() - 0.5) * 0.3), s: new Vector3(R, 2.2 + r() * 0.5, R), q: tilt });
      }
    }
    // Kesik villusun epiteli: enterositler, goblet hücreleri, mikrovilluslar
    const entero: CellSpec[] = [];
    const goblet: CellSpec[] = [];
    const mv: CellSpec[] = [];
    const gobletHops: Hop[] = [];
    let idx = 0;
    const place = (n: Vector3, center: Vector3) => {
      const p = center.clone().addScaledVector(n, FR - 0.1);
      const q = faceOut(n);
      if (idx++ % 7 === 3) {
        goblet.push({ p, s: new Vector3(0.12, 0.22, 0.12), q });
        gobletHops.push({ from: p.clone().addScaledVector(n, 0.12), to: p.clone().addScaledVector(n, 0.5).add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.2)) });
        return;
      }
      entero.push({ p, s: new Vector3(0.14, 0.22, 0.14), q });
      const t1 = new Vector3().crossVectors(n, UP);
      if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = new Vector3().crossVectors(t1, n).normalize();
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        mv.push({ p: p.clone().addScaledVector(n, 0.15).addScaledVector(t1, a * 0.032).addScaledVector(t2, b * 0.032), s: new Vector3(0.012, 0.07, 0.012), q });
      }
    };
    for (let row = 0, y = 0.14; y <= DOME; row++, y += 0.165) {
      for (let j = 0; j < 20; j++) {
        const phi = (j / 20) * Math.PI * 2 + row * 0.16;
        if (Math.cos(phi) > 0.2) continue;
        place(new Vector3(Math.sin(phi), 0, Math.cos(phi)), new Vector3(FX, WALL + y, FZ));
      }
    }
    const domeC = new Vector3(FX, WALL + DOME, FZ);
    ([[0.35, 18], [0.75, 13], [1.1, 7]] as const).forEach(([e, n]) => {
      for (let j = 0; j < n; j++) {
        const phi = (j / n) * Math.PI * 2;
        const d = new Vector3(Math.sin(phi) * Math.cos(e), Math.sin(e), Math.cos(phi) * Math.cos(e));
        if (d.z > 0.2) continue;
        place(d, domeC);
      }
    });
    place(UP.clone(), domeC);

    // Kılcal ağ: duvardaki arteriyolden villusa çıkar, döner, venülle uzaklaşır
    const loops: [number, number][] = [
      [1.7, 4.6],
      [2.1, 4.2],
      [1.9, 4.4],
    ];
    const capillaries = loops.map(([pa, pd], k) => {
      const pts: Vector3[] = [new Vector3(FX + 1.1, WALL - 0.55, FZ - 0.6 - 0.1 * k), onVillus(pa, 0.02, 0.22)];
      for (let i = 1; i < 14; i++) {
        const s = i / 14;
        const y = s < 0.5 ? 0.1 + (DOME + 0.08 - k * 0.08) * s * 2 : 0.1 + (DOME + 0.08 - k * 0.08) * (1 - s) * 2;
        pts.push(onVillus(pa + (pd - pa) * s + 0.22 * Math.sin(s * 11 + k * 2), y, 0.22));
      }
      pts.push(onVillus(pd, 0.02, 0.22), new Vector3(FX - 1.0, WALL - 0.6, FZ - 0.5 - 0.1 * k), new Vector3(X0, WALL - 0.7, FZ - 0.7 - 0.1 * k));
      return curve(pts.map((p) => [p.x, p.y, p.z]));
    });
    // Emilen maddelerin yolu: kılcalın inen yarısından venüle ve dışarı
    const drains = capillaries.map((c) => {
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 10; i++) {
        const p = c.getPointAt(0.42 + (i / 10) * 0.58);
        pts.push([p.x, p.y, p.z]);
      }
      return curve(pts);
    });
    const lymph = curve([
      [FX, WALL + DOME - 0.05, FZ],
      [FX + 0.02, WALL + 1.2, FZ],
      [FX, WALL, FZ],
      [FX, WALL - 0.9, FZ - 0.2],
      [FX - 2, WALL - 1.05, FZ - 0.3],
      [X0, WALL - 1.1, FZ - 0.4],
    ]);

    // Emilim: boşluktan hücre içinden kılcala / lenfe
    const sidePhi = () => (r() < 0.5 ? 1.45 + r() * 0.8 : 4.05 + r() * 0.8);
    const toBlood = (n: number): Hop[] =>
      Array.from({ length: n }, () => {
        const phi = sidePhi();
        const y = 0.3 + r() * 1.7;
        return { from: onVillus(phi, y, FR + 0.4 + r() * 0.3), to: onVillus(phi + (r() - 0.5) * 0.2, y + (r() - 0.5) * 0.2, 0.2) };
      });
    const micelleHops: Hop[] = Array.from({ length: 40 }, () => {
      const phi = sidePhi();
      const y = 0.3 + r() * 1.7;
      return { from: onVillus(phi, y, FR + 0.55 + r() * 0.3), to: onVillus(phi, y, FR + 0.05) };
    });
    const chyloHops: Hop[] = Array.from({ length: 60 }, () => {
      const phi = sidePhi();
      const y = 0.3 + r() * 1.7;
      return { from: onVillus(phi, y, FR - 0.2), to: onVillus(phi, y, 0.06) };
    });

    // Boşluk (lümen) akışı: villusların üstünde ve önünde
    const lumen = [
      ...Array.from({ length: 5 }, (_, i) =>
        curve(Array.from({ length: 5 }, (_, k) => [X0 + k * 1.95, 1.5 + i * 0.28 + Math.sin(k * 1.4 + i) * 0.2, -1.9 + ((i * 2) % 5) * 0.75 + Math.cos(k + i) * 0.25] as [number, number, number])),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        curve(Array.from({ length: 5 }, (_, k) => [X0 + k * 1.95, -0.7 + i * 0.7 + Math.sin(k * 1.2 + i) * 0.15, 1.55 + 0.12 * i + Math.cos(k * 1.7 + i) * 0.08] as [number, number, number])),
      ),
    ];

    // Kriptler (villuslar arasında duvara inen bezler)
    const cryptRings: CellSpec[] = [];
    const cryptTubes = [];
    const cryptBase: CellSpec[] = [];
    const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    for (const z of [-1.3, -0.1, 1.05]) {
      for (const x of [-3.9, -2.7, -1.5, -0.3, 0.9, 2.1]) {
        if (Math.hypot(x - FX, z - FZ) < 0.75) continue;
        cryptRings.push({ p: new Vector3(x, WALL + 0.01, z), s: 1, q: flat });
        cryptTubes.push(curve([[x, WALL, z], [x + 0.04, WALL - 0.5, z], [x - 0.03, WALL - 1.0, z]]));
        if (z > 1) for (let k = 0; k < 4; k++) cryptBase.push({ p: new Vector3(x + Math.cos(k * 1.57) * 0.13, WALL - 1.0 + (k % 2) * 0.08, z + Math.sin(k * 1.57) * 0.13), s: 0.07 });
      }
    }

    // Kalın bağırsak: villus yok, yalnızca kript ağızları; mukus ve bakteriler
    const colonRings: CellSpec[] = [];
    const colonCrypts = [];
    for (let x = COLON.x0 + 0.35; x < COLON.x1 - 0.2; x += 0.6) {
      for (let z = COLON.z0 + 0.35; z < COLON.z1 - 0.2; z += 0.7) {
        colonRings.push({ p: new Vector3(x, COLON.top + 0.01, z), s: 1, q: flat });
        colonCrypts.push(curve([[x, COLON.top, z], [x + 0.03, COLON.top - 0.6, z], [x - 0.02, COLON.top - 1.2, z]]));
      }
    }
    const bacColors = ['#8ee07a', '#b48cf0', '#f0b060', '#7ad0e0'];
    const bacteria: CellSpec[] = Array.from({ length: 70 }, () => ({
      p: new Vector3(COLON.x0 + 0.2 + r() * (COLON.x1 - COLON.x0 - 0.4), -0.85 + r() * 0.65, COLON.z0 + 0.2 + r() * (COLON.z1 - COLON.z0 - 0.4)),
      s: 0.9 + r() * 0.4,
      q: new Quaternion().setFromUnitVectors(UP, new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize()),
      color: bacColors[Math.floor(r() * bacColors.length)]!,
    }));
    const water: Hop[] = Array.from({ length: 40 }, () => {
      const x = COLON.x0 + 0.3 + r() * (COLON.x1 - COLON.x0 - 0.6);
      const z = COLON.z0 + 0.3 + r() * (COLON.z1 - COLON.z0 - 0.6);
      return { from: new Vector3(x, 0.1 + r() * 0.5, z), to: new Vector3(x + (r() - 0.5) * 0.2, COLON.top - 0.05, z + (r() - 0.5) * 0.2) };
    });

    return {
      villi,
      entero,
      goblet,
      mv,
      gobletHops,
      capillaries,
      drains,
      lymph,
      glucHops: toBlood(60),
      aaHops: toBlood(40),
      ironHops: toBlood(40),
      b12Hops: toBlood(30),
      micelleHops,
      chyloHops,
      lumen,
      cryptRings,
      cryptTubes,
      cryptBase,
      colonRings,
      colonCrypts,
      bacteria,
      water,
    };
  }, []);

  // Kişisel: boşluktaki şeker, demir, B12 ve yağ (şilomikron) miktarı (temsili)
  const glu = params.glucose;
  const nGluc = scaled(40, glu, 120);
  const nIron = scaled(24, params.iron, 72);
  const nB12 = scaled(18, params.b12, 54);
  const nFat = scaled(20, params.fat, 60);
  const lactealTip = useMemo(() => onVillus(0, DOME - 0.05, 0), []);

  return (
    <group>
      <ambientLight intensity={0.4} color="#ffe2dc" />
      <directionalLight position={[3, 6, 5]} intensity={1.1} />
      <Headlight intensity={2.6} distance={15} />
      {/* İnce bağırsak duvarı ve villuslar */}
      <mesh geometry={boxGeo} material={wallMat} position={[(X0 + X1) / 2, (WALL + WALL_BOT) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, WALL - WALL_BOT, Z1 - Z0]} onClick={pick('crypt')} />
      <mesh geometry={planeGeo} material={wallTopMat} position={[(X0 + X1) / 2, WALL, (Z0 + Z1) / 2]} scale={[X1 - X0, 1, Z1 - Z0]} onClick={pick('villus')} />
      <Cells cells={geo.villi} geometry={fingerGeo} material={villusMat} onClick={pick('villus')} />
      <mesh geometry={coreGeo} material={coreMat} position={[FX, WALL, FZ]} onClick={pick('villus')} />
      <Cells cells={geo.entero} geometry={enteroGeo} material={enteroMat} onClick={pick('enterocyte')} />
      <Cells
        cells={geo.goblet}
        geometry={gobletGeo}
        material={gobletMat}
        onClick={pick('goblet')}
        time={time}
        animate={(i, t) => ({ scale: stage === 1 ? 1 + 0.08 * Math.sin(t * 3 + i) : 1 })}
      />
      <Cells cells={geo.mv} geometry={mvGeo} material={mvMat} onClick={pick('microvilli')} />
      <Hoppers hops={geo.gobletHops} count={30} geometry={small} material={mucusMat} time={time} duration={2.6} size={0.035} seed={3} active={stage === 1} onClick={pick('goblet')} />
      <Tubes curves={geo.capillaries} radius={0.035} material={capMat} onClick={pick('capillary')} segments={120} radial={8} />
      <CurveMovers curves={geo.capillaries} count={45} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={0.06} flat onClick={pick('capillary')} />
      <Tubes curves={[geo.lymph]} radius={0.085} material={lactealMat} onClick={pick('lacteal')} segments={80} radial={12} />
      <mesh position={lactealTip} material={lactealMat} onClick={pick('lacteal')}>
        <sphereGeometry args={[0.085, 16, 12]} />
      </mesh>
      {/* Kriptler */}
      <Cells cells={geo.cryptRings} geometry={torusGeo} material={cryptMat} onClick={pick('crypt')} />
      <Tubes curves={geo.cryptTubes} radius={0.08} material={cryptMat} onClick={pick('crypt')} segments={16} radial={8} />
      <Cells cells={geo.cryptBase} geometry={cryptBaseGeo} material={cryptBaseMat} onClick={pick('crypt')} />
      {/* Boşluktaki besinler (kişisel miktarlar) */}
      <CurveMovers curves={geo.lumen} count={120} shown={nGluc} geometry={ico} material={glucMat} time={time} speed={0.025} size={0.045} jitter={0.5} seed={5} onClick={pick('glucose')} />
      <CurveMovers curves={geo.lumen} count={60} shown={36} geometry={small} material={aaMat} time={time} speed={0.025} size={0.032} jitter={0.5} seed={7} onClick={pick('aminoacid')} />
      <CurveMovers curves={geo.lumen} count={60} shown={nFat} geometry={micelleGeo} material={micelleMat} time={time} speed={0.02} size={0.07} jitter={0.5} seed={9} onClick={pick('fat')} />
      <CurveMovers curves={geo.lumen} count={72} shown={nIron} geometry={ico} material={ironMat} time={time} speed={0.022} size={0.045} jitter={0.5} seed={11} onClick={pick('iron')} />
      <CurveMovers curves={geo.lumen} count={54} shown={nB12} geometry={small} material={b12Mat} time={time} speed={0.022} size={0.045} jitter={0.5} seed={13} onClick={pick('b12')} />
      {/* Şeker ve amino asitler: enterositten kılcala */}
      <Hoppers hops={geo.glucHops} count={60} shown={scaled(24, glu, 60)} geometry={ico} material={glucMat} time={time} duration={2.6} size={0.045} seed={15} active={stage === 2} onClick={pick('glucose')} />
      <Hoppers hops={geo.aaHops} count={40} geometry={small} material={aaMat} time={time} duration={2.8} size={0.032} seed={17} active={stage === 2} onClick={pick('aminoacid')} />
      <CurveMovers curves={geo.drains} count={60} shown={scaled(stage === 2 ? 24 : 10, glu, 60)} geometry={ico} material={glucMat} time={time} speed={0.07} size={0.04} jitter={0.02} seed={19} onClick={pick('glucose')} />
      <CurveMovers curves={geo.drains} count={30} shown={stage === 2 ? 24 : 0} geometry={small} material={aaMat} time={time} speed={0.07} size={0.03} jitter={0.02} seed={21} onClick={pick('aminoacid')} />
      {/* Yağ: misel → enterosit → şilomikron → lakteal */}
      <Hoppers hops={geo.micelleHops} count={40} geometry={micelleGeo} material={micelleMat} time={time} duration={2.6} size={0.07} seed={23} active={stage === 3} onClick={pick('fat')} />
      <Hoppers hops={geo.chyloHops} count={60} shown={scaled(24, params.fat, 60)} geometry={small} material={chyloMat} time={time} duration={2.4} size={0.055} seed={25} active={stage === 3} onClick={pick('chylomicron')} />
      <CurveMovers curves={[geo.lymph]} count={72} shown={stage === 3 ? scaled(24, params.fat, 72) : scaled(6, params.fat, 18)} geometry={small} material={chyloMat} time={time} speed={0.05} size={0.05} jitter={0.04} seed={27} onClick={pick('chylomicron')} />
      {/* Demir ve B12 */}
      <Hoppers hops={geo.ironHops} count={40} shown={scaled(16, params.iron, 40)} geometry={ico} material={ironMat} time={time} duration={2.8} size={0.045} seed={29} active={stage === 4} onClick={pick('iron')} />
      <Hoppers hops={geo.b12Hops} count={30} shown={scaled(12, params.b12, 30)} geometry={small} material={b12Mat} time={time} duration={3} size={0.045} seed={31} active={stage === 4} onClick={pick('b12')} />
      <CurveMovers curves={geo.drains} count={40} shown={stage === 4 ? scaled(14, params.iron, 40) : 0} geometry={ico} material={ironMat} time={time} speed={0.07} size={0.04} jitter={0.02} seed={33} onClick={pick('iron')} />
      <CurveMovers curves={geo.drains} count={30} shown={stage === 4 ? scaled(10, params.b12, 30) : 0} geometry={small} material={b12Mat} time={time} speed={0.07} size={0.04} jitter={0.02} seed={35} onClick={pick('b12')} />
      {/* Kalın bağırsak (yan bölüm): kript ağızları, mukus, mikrobiyota, su emilimi */}
      <mesh
        geometry={boxGeo}
        material={colonMat}
        position={[(COLON.x0 + COLON.x1) / 2, (COLON.top + WALL_BOT) / 2, (COLON.z0 + COLON.z1) / 2]}
        scale={[COLON.x1 - COLON.x0, COLON.top - WALL_BOT, COLON.z1 - COLON.z0]}
        onClick={pick('colon')}
      />
      <mesh
        geometry={planeGeo}
        material={colonTopMat}
        position={[(COLON.x0 + COLON.x1) / 2, COLON.top, (COLON.z0 + COLON.z1) / 2]}
        scale={[COLON.x1 - COLON.x0, 1, COLON.z1 - COLON.z0]}
        onClick={pick('colon')}
      />
      <Cells cells={geo.colonRings} geometry={torusGeo} material={cryptMat} onClick={pick('colon')} />
      <Tubes curves={geo.colonCrypts} radius={0.07} material={cryptMat} onClick={pick('colon')} segments={12} radial={6} />
      <mesh
        geometry={boxGeo}
        material={colonMucusMat}
        position={[(COLON.x0 + COLON.x1) / 2, COLON.top + 0.18, (COLON.z0 + COLON.z1) / 2]}
        scale={[COLON.x1 - COLON.x0, 0.36, COLON.z1 - COLON.z0]}
        onClick={pick('colon')}
      />
      <Cells
        cells={geo.bacteria}
        geometry={bacGeo}
        material={bacMat}
        onClick={pick('bacteria')}
        time={time}
        animate={(i, t) => ({ scale: 1 + 0.08 * Math.sin(t * 2.5 + i * 1.7) })}
      />
      <Hoppers hops={geo.water} count={40} geometry={small} material={waterMat} time={time} duration={2.6} size={0.04} seed={37} active={stage === 5} onClick={pick('colon')} />
    </group>
  );
}
