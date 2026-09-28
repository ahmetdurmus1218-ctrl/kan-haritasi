import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  type InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Tubes, curve, makePick } from '../micro';

/**
 * Retina (temsili yan kesit). Işık soldan, camsı cisim tarafından gelir ve saydam iç katmanları
 * (gangliyon ve bipolar hücreler) geçerek en dıştaki çubuk ve konilere ulaşır; arkada koyu pigment
 * epiteli (RPE) ve koroid damarları vardır. Soğurulan foton fotoreseptörde bir sinyal başlatır;
 * sinyal bipolar hücre üzerinden gangliyon hücresine, oradan aksonlarla üst kenardaki görme sinirine
 * gider. Alt kenar sarı nokta (makula) bölgesidir: çukurda (fovea) yalnızca koniler bulunur, iç
 * katmanlar yana itilmiştir. Kılcallardaki glukoz ve glikozillenmiş (sarımsı) alyuvar oranı kişinin
 * değerlerinden türetilir. Ölçekler ve sayılar temsilidir.
 */

const M = new Matrix4();
const Q0 = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const HIDE = new Matrix4().makeScale(0, 0, 0);

/** Deterministik tamsayı karması → [0,1). */
function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* ------------------------------------------------------------ katmanlar (ışık +x yönünde ilerler) */

const X_START = -6.6;
const X_NFL = -4.3;
const X_GCL = -3.8;
const X_IPL = -2.9;
const X_INL = -1.9;
const X_OPL = -1.1;
const X_RPE = 2.95;
const Y_MIN = -2.3;
const Y_MAX = 2.3;
const Z_MAX = 1.35;
/** Fovea merkezi (y, z) ve çukur yarıçapı. */
const FOV_Y = -1.95;
const FOV_R = 0.85;

type ConeType = 'S' | 'M' | 'L';
const CONE_COLOR: Record<ConeType, string> = { S: '#6f8cff', M: '#6fe08a', L: '#ff7b6b' };
const PHOTON: Record<ConeType | 'rod', Color> = { S: new Color('#9fb4ff'), M: new Color('#a8ffba'), L: new Color('#ffb3a8'), rod: new Color('#c6f4ff') };

/** Fotoreseptör profilleri: (yarıçap, x) — uç (terminal) solda, dış segment sağda. */
const ROD_PROFILE: [number, number][] = [
  [0, -1.14], [0.03, -1.13], [0.045, -1.1], [0.03, -1.05], [0.012, -1.0], [0.012, -0.62], [0.05, -0.56], [0.056, -0.48],
  [0.05, -0.4], [0.014, -0.34], [0.016, -0.08], [0.055, 0.0], [0.066, 0.4], [0.06, 0.85], [0.03, 0.9], [0.052, 0.95],
  [0.055, 1.5], [0.055, 2.55], [0.03, 2.6], [0, 2.61],
];
const CONE_PROFILE: [number, number][] = [
  [0, -1.14], [0.04, -1.13], [0.065, -1.1], [0.04, -1.04], [0.014, -0.98], [0.014, -0.3], [0.06, -0.24], [0.07, -0.15],
  [0.06, -0.07], [0.03, -0.02], [0.08, 0.05], [0.11, 0.35], [0.1, 0.65], [0.075, 0.8], [0.03, 0.84], [0.07, 0.87],
  [0.045, 1.35], [0.018, 1.8], [0, 1.84],
];
const ROD_OS: [number, number] = [1.0, 2.45];
const CONE_OS: [number, number] = [0.92, 1.6];

function latheX(profile: [number, number][], segments: number) {
  const g = new LatheGeometry(
    profile.map(([r, x]) => new Vector2(r, x)),
    segments,
  );
  g.rotateZ(-Math.PI / 2);
  return g;
}

interface Receptor {
  kind: 'rod' | 'cone';
  /** Türü içindeki sıra (Cells örnek numarası). */
  k: number;
  y: number;
  z: number;
  type: ConeType | 'rod';
  bip: number;
  path: Vector3[];
  cum: number[];
}

function along(path: Vector3[], cum: number[], s: number, out: Vector3): Vector3 {
  const L = cum[cum.length - 1]!;
  const d = Math.max(0, Math.min(1, s)) * L;
  for (let i = 1; i < path.length; i++) {
    if (d <= cum[i]! || i === path.length - 1) {
      const seg = cum[i]! - cum[i - 1]!;
      return out.lerpVectors(path[i - 1]!, path[i]!, seg > 0 ? (d - cum[i - 1]!) / seg : 0);
    }
  }
  return out.copy(path[path.length - 1]!);
}

/* ------------------------------------------------------------ zamanlama */

const N_PH = 16;
const T_FLY = 1.1;
const T_SIG = 1.2;
const T_GANG = 2.0;
const T_SPIKE = 1.2;
const SPIKE_TRAIL = 3;

const SHOTS = [
  { position: [-0.4, 1.0, 9.4], target: [-0.5, 0.4, 0] },
  { position: [-0.7, 0.6, 6.4], target: [-0.7, 0.3, 0] },
  { position: [1.9, -0.6, 3.4], target: [0.9, -1.2, 0.5] },
  { position: [2.35, 1.0, 2.7], target: [1.75, 0.65, 1.3] },
  { position: [-1.6, 3.5, 5.0], target: [-3.2, 2.5, 0.2] },
  { position: [-2.4, 1.1, 3.6], target: [-3.5, 0.6, 0.5] },
] as const;

const ROD_BASE = new Color('#d6b3e0');
const FLASH = new Color('#fffbe6');
const DISC_BASE = new Color('#b98ad0');
const BIP_BASE = new Color('#8fb8ff');
const GANG_BASE = new Color('#f2c46b');
const SIGNAL = new Color('#fff0b0');
const SPIKE = new Color('#8ff6ff');

export default function RetinaScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#04050b', ['#04050b', 7, 22], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.6, max: 15 }, { position: [0, 1.5, 14], target: [-0.5, 0.4, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);

  // Kişisel: kılcallardaki glukoz ve glikozillenmiş alyuvar oranı (HbA1c)
  const glu = params.glucose ?? 1;
  const glyc = Math.max(0.04, Math.min(0.9, ((params.a1c ?? 1) * 5.2 - 4) / 6));
  const xray = useEased(stage === 3 ? 1 : 0, 1.4);
  const vesselGlow = useEased(stage === 5 ? 1 : 0, 1.4);

  const rodGeo = useDisposable(() => latheX(ROD_PROFILE, 10));
  const coneGeo = useDisposable(() => latheX(CONE_PROFILE, 12));
  const rodMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.45, transparent: true, opacity: 1, emissive: '#1c1024', emissiveIntensity: 0.4 }));
  const coneMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, emissive: '#141414', emissiveIntensity: 0.4 }));
  const discGeo = useDisposable(() => new CylinderGeometry(0.047, 0.047, 0.018, 14).rotateZ(Math.PI / 2));
  const discMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#2a1440', emissiveIntensity: 0.6 }));
  const rpeGeo = useDisposable(() => new BoxGeometry(1, 1, 1));
  const rpeMat = useDisposable(() => new MeshStandardMaterial({ color: '#3b2418', roughness: 0.85, emissive: '#120804', emissiveIntensity: 0.3 }));
  const bipGeo = useDisposable(() => bumpySphere(2, 0.08, 3));
  const bipMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#0c1840', emissiveIntensity: 0.45 }));
  const bipProcMat = useDisposable(() => new MeshStandardMaterial({ color: '#8fb8ff', roughness: 0.5, emissive: '#0c1840', emissiveIntensity: 0.4 }));
  const gangGeo = useDisposable(() => bumpySphere(2, 0.1, 6));
  const gangMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#3a2400', emissiveIntensity: 0.4 }));
  const gangProcMat = useDisposable(() => new MeshStandardMaterial({ color: '#f2c46b', roughness: 0.5, emissive: '#3a2400', emissiveIntensity: 0.4 }));
  const nerveMat = useDisposable(
    () => new MeshPhysicalMaterial({ color: '#f0e6c8', roughness: 0.4, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide, sheen: 1, sheenColor: '#ffffff' }),
  );
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
  const choroidMat = useDisposable(() => new MeshStandardMaterial({ color: '#a8283a', roughness: 0.45, emissive: '#2a0408', emissiveIntensity: 0.45 }));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const glucGeo = useDisposable(() => new IcosahedronGeometry(1, 0));
  const glucMat = useDisposable(() => new MeshStandardMaterial({ color: '#fff4b0', emissive: '#7a6a10', emissiveIntensity: 0.9 }));
  const maculaGeo = useDisposable(() => new SphereGeometry(1, 32, 20));
  const maculaMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#ffd84a', roughness: 0.3, transparent: true, opacity: 0.1, depthWrite: false, side: DoubleSide, emissive: '#6a5000', emissiveIntensity: 0.5 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const glowMat = useDisposable(
    () => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  const red = useMemo(() => new Color('#b3202c'), []);
  const sugared = useMemo(() => new Color('#e0b040'), []);

  const geo = useMemo(() => {
    const r = rng(61);
    // Fotoreseptör mozaiği: çevrede çoğunlukla çubuk, fovea çukurunda yalnızca sık koniler
    const spots: { y: number; z: number; fovea: boolean }[] = [];
    for (let y = Y_MIN; y <= Y_MAX + 1e-6; y += 0.19) {
      for (let z = -Z_MAX; z <= Z_MAX + 1e-6; z += 0.3) {
        const jy = y + (r() - 0.5) * 0.04;
        const jz = z + (r() - 0.5) * 0.06;
        const fovea = Math.hypot(jy - FOV_Y, jz) < FOV_R;
        spots.push({ y: jy, z: jz, fovea });
        if (fovea && jy + 0.095 <= Y_MAX) spots.push({ y: jy + 0.095, z: jz + 0.15, fovea });
      }
    }
    const rods: CellSpec[] = [];
    const cones: CellSpec[] = [];
    const recs: Omit<Receptor, 'bip' | 'path' | 'cum'>[] = [];
    for (const sp of spots) {
      const isCone = sp.fovea || r() < 0.13;
      if (!isCone) {
        recs.push({ kind: 'rod', k: rods.length, y: sp.y, z: sp.z, type: 'rod' });
        rods.push({ p: new Vector3(0, sp.y, sp.z), s: 1 });
      } else {
        const center = Math.hypot(sp.y - FOV_Y, sp.z) < 0.3;
        const q = r();
        const type: ConeType = !center && q < 0.1 ? 'S' : q < 0.55 ? 'L' : 'M';
        recs.push({ kind: 'cone', k: cones.length, y: sp.y, z: sp.z, type });
        cones.push({ p: new Vector3(0, sp.y, sp.z), s: sp.fovea ? new Vector3(1.06, 0.78, 0.78) : 1, color: CONE_COLOR[type] });
      }
    }
    // Bipolar hücreler (çukurun dışında)
    const bips: CellSpec[] = [];
    for (let y = -1.1; y <= 2.25; y += 0.55) {
      for (const z of [-1.1, -0.37, 0.37, 1.1]) {
        const p = new Vector3(X_INL + (r() - 0.5) * 0.15, y + (r() - 0.5) * 0.12, z + (r() - 0.5) * 0.12);
        if (Math.hypot(p.y - FOV_Y, p.z) < 0.75) continue;
        bips.push({ p, s: new Vector3(0.2, 0.12, 0.12) });
      }
    }
    // Gangliyon hücreleri; çukurun kenarında daha sık
    const gangs: CellSpec[] = [];
    const gPos: [number, number][] = [];
    for (const y of [-0.7, 0.3, 1.2, 2.05]) for (const z of [-0.95, 0, 0.95]) gPos.push([y, z]);
    gPos.push([-1.08, -0.85], [-1.02, 0.05], [-1.08, 0.9]);
    for (const [y, z] of gPos) gangs.push({ p: new Vector3(X_GCL + (r() - 0.5) * 0.1, y + (r() - 0.5) * 0.1, z + (r() - 0.5) * 0.1), s: 0.25 });

    const nearest = (list: CellSpec[], y: number, z: number) => {
      let best = 0;
      let bd = Infinity;
      list.forEach((c, i) => {
        const d = Math.hypot(c.p.y - y, c.p.z - z);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    };
    const bipGang = bips.map((b) => nearest(gangs, b.p.y, b.p.z));
    // Sinyal yolu: dış segment → çekirdek → uç → bipolar gövde → bipolar akson ucu → gangliyon gövdesi
    const receptors: Receptor[] = recs.map((rc) => {
      const bip = nearest(bips, rc.y, rc.z);
      const b = bips[bip]!.p;
      const g = gangs[bipGang[bip]!]!.p;
      const osMid = rc.kind === 'rod' ? 1.7 : 1.25;
      const path = [
        new Vector3(osMid, rc.y, rc.z),
        new Vector3(rc.kind === 'rod' ? -0.48 : -0.15, rc.y, rc.z),
        new Vector3(X_OPL, rc.y, rc.z),
        b.clone(),
        new Vector3(X_IPL, b.y, b.z),
        g.clone(),
      ];
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + path[i]!.distanceTo(path[i - 1]!));
      return { ...rc, bip, path, cum };
    });
    // Bipolar uzantıları: yakındaki fotoreseptör uçlarına dendrit, iç katmana akson
    const bipCurves = [];
    for (let i = 0; i < bips.length; i++) {
      const b = bips[i]!.p;
      const near = receptors
        .map((rc) => ({ rc, d: Math.hypot(rc.y - b.y, rc.z - b.z) }))
        .filter((x) => x.d < 0.42 && x.rc.bip === i)
        .sort((a, c) => a.d - c.d)
        .slice(0, 4);
      for (const { rc } of near) bipCurves.push(curve([[b.x + 0.15, b.y, b.z], [(b.x + X_OPL) / 2, (b.y + rc.y) / 2, (b.z + rc.z) / 2], [X_OPL - 0.02, rc.y, rc.z]]));
      bipCurves.push(curve([[b.x - 0.15, b.y, b.z], [(b.x + X_IPL) / 2, b.y + 0.03, b.z], [X_IPL, b.y + 0.05, b.z]]));
    }
    // Gangliyon dendritleri (iç pleksiform katmanda yayılır) ve aksonları (görme sinirine)
    const gangDend = [];
    const gangAxons = [];
    for (let i = 0; i < gangs.length; i++) {
      const g = gangs[i]!.p;
      for (let k = 0; k < 4; k++) {
        const a = k * 1.57 + r();
        gangDend.push(curve([[g.x + 0.2, g.y, g.z], [g.x + 0.55, g.y + Math.cos(a) * 0.15, g.z + Math.sin(a) * 0.15], [X_IPL - 0.04, g.y + Math.cos(a) * 0.38, g.z + Math.sin(a) * 0.38]]));
      }
      const dy = ((i % 5) - 2) * 0.035;
      const dz = g.z * 0.07;
      gangAxons.push(
        curve([
          [g.x - 0.2, g.y, g.z],
          [X_NFL, g.y + 0.12, g.z],
          [X_NFL - 0.02, (g.y + 0.12 + 2.6) / 2, g.z * 0.75],
          [X_NFL + 0.05, 2.6, g.z * 0.4],
          [-4.0, 3.05 + dy, g.z * 0.15],
          [-3.0, 3.32 + dy, dz],
          [-0.5, 3.42 + dy, dz],
          [2.5, 3.38 + dy, dz],
          [6.2, 3.0 + dy, dz],
        ]),
      );
    }
    const nerve = [curve([[-4.05, 3.04, 0], [-3.0, 3.32, 0], [-0.5, 3.42, 0], [2.5, 3.38, 0], [6.2, 3.0, 0]])];
    // Retina kılcalları (yüzeyel ve derin ağ; foveanın merkezi damarsızdır) ve arkadaki koroid
    const caps = [
      curve([[-4.1, 3.2, 0.45], [-4.05, 2.2, 1.0], [-3.95, 1.0, 0.55], [-4.05, -0.1, 1.15], [-3.95, -0.95, 0.55], [-4.05, -0.5, -0.4], [-3.95, 0.7, -1.15], [-4.05, 2.0, -0.9], [-4.1, 3.2, -0.45]]),
      curve([[-4.1, 3.1, 0.2], [-3.3, 2.3, 0.9], [-1.55, 1.8, 1.1], [-1.4, 0.6, 0.4], [-1.5, -0.6, 1.0], [-1.45, -0.85, -0.2], [-1.5, 0.3, -1.1], [-1.45, 1.6, -0.6], [-3.2, 2.4, -0.9], [-4.1, 3.1, -0.2]]),
    ];
    const choroid = [-1.0, 0, 1.0].map((z) => curve([[3.55, -2.9, z], [3.7, -1.0, z + 0.15], [3.6, 1.0, z - 0.15], [3.7, 2.9, z]]));
    // Pigment epiteli: koyu hücre sırası
    const rpe: CellSpec[] = [];
    for (let y = Y_MIN - 0.05; y <= Y_MAX + 0.1; y += 0.3) {
      for (let z = -Z_MAX - 0.05; z <= Z_MAX + 0.1; z += 0.3) {
        const v = 0.85 + r() * 0.3;
        rpe.push({ p: new Vector3(X_RPE + (r() - 0.5) * 0.04, y, z), s: new Vector3(0.42, 0.29, 0.29), color: new Color('#3b2418').multiplyScalar(v).getStyle() });
      }
    }
    // Disk yığınlarını gösterilen öndeki birkaç çubuk
    const discRods = receptors
      .filter((rc) => rc.kind === 'rod' && rc.z > 1.0 && rc.y > 0.15 && rc.y < 1.25)
      .slice(0, 6)
      .map((rc) => rc.k);
    const discs: CellSpec[] = [];
    const discInfo: { rod: number; x: number }[] = [];
    for (const k of discRods) {
      const rp = rods[k]!.p;
      for (let d = 0; d < 18; d++) {
        const x = ROD_OS[0] + 0.03 + (d / 17) * (ROD_OS[1] - ROD_OS[0] - 0.06);
        discs.push({ p: new Vector3(x, rp.y, rp.z), s: 1 });
        discInfo.push({ rod: k, x });
      }
    }
    const rodIdx = receptors.filter((rc) => rc.kind === 'rod').map((rc) => receptors.indexOf(rc));
    const coneIdx = receptors.filter((rc) => rc.kind === 'cone').map((rc) => receptors.indexOf(rc));
    const discRec = discRods.map((k) => rodIdx[k]!);
    return { rods, cones, receptors, bips, gangs, bipGang, bipCurves, gangDend, gangAxons, nerve, caps, choroid, rpe, discs, discInfo, rodIdx, coneIdx, discRec };
  }, []);

  const vessels = useMemo(() => [...geo.caps, ...geo.choroid], [geo]);
  const maculaCells = useMemo<CellSpec[]>(() => [{ p: new Vector3(-2.75, FOV_Y, 0), s: new Vector3(1.75, 0.8, 0.9) }], []);

  // Anlık parlamalar (her karede olay döngüsünden doldurulur; Cells bunları okur)
  const flash = useMemo(
    () => ({
      rod: new Float32Array(geo.rods.length),
      rodHit: new Float32Array(geo.rods.length),
      cone: new Float32Array(geo.cones.length),
      bip: new Float32Array(geo.bips.length),
      gang: new Float32Array(geo.gangs.length),
    }),
    [geo],
  );

  const photonRef = useRef<InstancedMesh>(null);
  const signalRef = useRef<InstancedMesh>(null);

  useFrame(() => {
    const t = time.current;
    rodMat.opacity = 1 - 0.62 * xray.current;
    rodMat.depthWrite = xray.current < 0.05;
    capMat.emissiveIntensity = 0.5 + 0.5 * vesselGlow.current;
    flash.rod.fill(0);
    flash.cone.fill(0);
    flash.bip.fill(0);
    flash.gang.fill(0);
    const pm = photonRef.current;
    const sm = signalRef.current;
    // Aşama 2: loş ışık (az foton, yalnız çubuklar) ile parlak ışık (koniler) dönüşümlü
    const dim = stage === 2 && Math.floor(t / 7) % 2 === 0;
    const { receptors, rodIdx, coneIdx, discRec, gangAxons } = geo;
    for (let c = 0; c < N_PH; c++) {
      const period = 3.6 + 0.7 * hash(c, 1);
      const tt = t + hash(c, 2) * period;
      const cyc = Math.floor(tt / period);
      const ph = tt - cyc * period;
      const key = c * 131 + cyc;
      const on = !dim || c < 5;
      let ri: number;
      const h = hash(key, 3);
      if (stage === 3 && hash(key, 4) < 0.6) ri = discRec[Math.floor(h * discRec.length)]!;
      else if (stage === 2) ri = dim || hash(key, 4) < 0.25 ? rodIdx[Math.floor(h * rodIdx.length)]! : coneIdx[Math.floor(h * coneIdx.length)]!;
      else ri = Math.floor(h * receptors.length);
      const rc = receptors[ri]!;
      const os = rc.kind === 'rod' ? ROD_OS : CONE_OS;
      const xHit = os[0] + (os[1] - os[0]) * hash(key, 5);

      // Foton: camsı cisimden fotoreseptöre düz bir çizgide
      if (pm) {
        if (on && ph < T_FLY) {
          P.set(X_START + (xHit - X_START) * (ph / T_FLY), rc.y, rc.z);
          M.compose(P, Q0, S.set(0.18, 0.032, 0.032));
          pm.setMatrixAt(c, M);
        } else pm.setMatrixAt(c, HIDE);
        pm.setColorAt(c, PHOTON[rc.type]);
      }
      if (!on) {
        if (sm) for (let k = 0; k <= SPIKE_TRAIL; k++) sm.setMatrixAt(c * (SPIKE_TRAIL + 1) + k, HIDE);
        continue;
      }
      // Soğurulma: fotoreseptör parlar
      if (ph >= T_FLY && ph < T_FLY + 0.9) {
        const f = Math.exp(-(((ph - T_FLY - 0.12) / 0.28) ** 2));
        if (rc.kind === 'rod') {
          if (f > flash.rod[rc.k]!) {
            flash.rod[rc.k] = f;
            flash.rodHit[rc.k] = xHit;
          }
        } else flash.cone[rc.k] = Math.max(flash.cone[rc.k]!, f);
      }
      // Kademeli sinyal: fotoreseptör → bipolar → gangliyon
      const s = (ph - T_SIG) / (T_GANG - T_SIG);
      if (s >= 0 && s <= 1) flash.bip[rc.bip] = Math.max(flash.bip[rc.bip]!, Math.exp(-(((s - 0.62) / 0.16) ** 2)));
      const gi = geo.bipGang[rc.bip] ?? 0;
      flash.gang[gi] = Math.max(flash.gang[gi]!, Math.exp(-(((ph - T_GANG) / 0.14) ** 2)));
      if (sm) {
        const base = c * (SPIKE_TRAIL + 1);
        if (s >= 0 && s <= 1) {
          along(rc.path, rc.cum, s, P);
          M.compose(P, Q0, S.setScalar(0.07));
          sm.setMatrixAt(base, M);
        } else sm.setMatrixAt(base, HIDE);
        sm.setColorAt(base, SIGNAL);
        // Gangliyon hücresinin aksiyon potansiyelleri akson boyunca görme sinirine
        const axon = gangAxons[gi]!;
        for (let k = 0; k < SPIKE_TRAIL; k++) {
          const u = (ph - T_GANG - k * 0.05) / T_SPIKE;
          const idx = base + 1 + k;
          if (u >= 0 && u <= 1) {
            axon.getPointAt(u, P);
            M.compose(P, Q0, S.setScalar(0.075 * (1 - k / (SPIKE_TRAIL + 1))));
            sm.setMatrixAt(idx, M);
          } else sm.setMatrixAt(idx, HIDE);
          sm.setColorAt(idx, SPIKE);
        }
      }
    }
    if (pm) {
      pm.instanceMatrix.needsUpdate = true;
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }
    if (sm) {
      sm.instanceMatrix.needsUpdate = true;
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.35} color="#e0e6ff" />
      <directionalLight position={[-3, 5, 6]} intensity={1.1} />
      <Headlight intensity={2.8} distance={15} />
      {/* Fotoreseptörler */}
      <Cells
        cells={geo.rods}
        geometry={rodGeo}
        material={rodMat}
        onClick={pick('rod')}
        time={time}
        animate={(i, _t, out) => {
          out.copy(ROD_BASE).lerp(FLASH, flash.rod[i] ?? 0);
          return { color: true };
        }}
      />
      <Cells
        cells={geo.cones}
        geometry={coneGeo}
        material={coneMat}
        onClick={pick('cone')}
        time={time}
        animate={(i, _t, out) => {
          const rc = geo.receptors[geo.coneIdx[i]!]!;
          out.set(CONE_COLOR[rc.type as ConeType]).lerp(FLASH, (flash.cone[i] ?? 0) * 0.85);
          return { color: true, scale: 1 + 0.04 * (flash.cone[i] ?? 0) };
        }}
      />
      <Cells
        cells={geo.discs}
        geometry={discGeo}
        material={discMat}
        onClick={pick('rod')}
        time={time}
        animate={(i, _t, out) => {
          const d = geo.discInfo[i]!;
          const f = (flash.rod[d.rod] ?? 0) * Math.exp(-(((d.x - (flash.rodHit[d.rod] ?? 0)) / 0.35) ** 2));
          out.copy(DISC_BASE).lerp(FLASH, f);
          return { color: true, scale: Math.max(0.0001, xray.current) };
        }}
      />
      <Cells cells={geo.rpe} geometry={rpeGeo} material={rpeMat} onClick={pick('rpe')} />
      {/* İç katmanlar */}
      <Cells
        cells={geo.bips}
        geometry={bipGeo}
        material={bipMat}
        onClick={pick('bipolar')}
        time={time}
        animate={(i, _t, out) => {
          out.copy(BIP_BASE).lerp(FLASH, (flash.bip[i] ?? 0) * 0.8);
          return { color: true };
        }}
      />
      <Tubes curves={geo.bipCurves} radius={0.014} material={bipProcMat} onClick={pick('bipolar')} segments={10} radial={5} />
      <Cells
        cells={geo.gangs}
        geometry={gangGeo}
        material={gangMat}
        onClick={pick('ganglion')}
        time={time}
        animate={(i, _t, out) => {
          const f = flash.gang[i] ?? 0;
          out.copy(GANG_BASE).lerp(FLASH, f * 0.85);
          return { color: true, scale: 1 + 0.08 * f };
        }}
      />
      <Tubes curves={geo.gangDend} radius={0.02} material={gangProcMat} onClick={pick('ganglion')} segments={10} radial={5} />
      <Tubes curves={geo.gangAxons} radius={0.028} material={gangProcMat} onClick={pick('nerve')} segments={90} radial={6} />
      <Tubes curves={geo.nerve} radius={0.3} material={nerveMat} onClick={pick('nerve')} segments={80} radial={20} />
      <Cells cells={maculaCells} geometry={maculaGeo} material={maculaMat} onClick={pick('macula')} />
      {/* Damarlar */}
      <Tubes curves={geo.caps} radius={0.06} material={capMat} onClick={pick('capillary')} segments={140} radial={8} />
      <Tubes curves={geo.choroid} radius={0.15} material={choroidMat} onClick={pick('choroid')} segments={60} radial={12} />
      <CurveMovers
        curves={vessels}
        count={70}
        geometry={rbcGeo}
        material={rbcMat}
        time={time}
        speed={0.045}
        size={0.1}
        flat
        seed={13}
        onClick={pick('rbc')}
        color={(_u, i, out) => (i < 70 * glyc ? out.copy(red).lerp(sugared, 0.7) : out.copy(red))}
      />
      <CurveMovers curves={vessels} count={320} shown={scaled(90, glu, 320)} geometry={glucGeo} material={glucMat} time={time} speed={0.04} size={0.045} jitter={0.04} seed={29} onClick={pick('glucose')} />
      {/* Işık ve sinyal */}
      <instancedMesh ref={photonRef} args={[small, glowMat, N_PH]} onClick={pick('photon')} frustumCulled={false} />
      <instancedMesh ref={signalRef} args={[small, glowMat, N_PH * (SPIKE_TRAIL + 1)]} onClick={pick('ganglion')} frustumCulled={false} />
    </group>
  );
}
