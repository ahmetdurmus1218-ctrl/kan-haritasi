import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BackSide,
  BoxGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Headlight, type InsideSceneProps, bumpySphere, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { Cells, type CellSpec, CurveMovers, Hoppers, type Hop, Tubes, curve, makePick } from '../micro';

/**
 * Deri katmanları (temsili kesit bloğu; epidermis anlaşılır olsun diye kalın çizilmiştir).
 * Epidermiste bazal katmanda doğan keratinositler yukarı yükselip yassılaşır ve yüzeyden dökülür;
 * melanositler uzantılarıyla melanin verir, melanin çekirdeklerin üstünde şemsiye oluşturur.
 * Dermiste kolajen lifleri, kılcal kıvrımlar, kıl kökü ve yağ bezi, kıvrımlı ter bezi ve sinir
 * uçları; altta yuvarlak yağ hücreleriyle hipodermis. UVB ışığı epidermiste D vitamini yapımını başlatır.
 */

const X0 = -5;
const X1 = 5;
const Z0 = -1.8;
const Z1 = 0.6;
const SURF = 2.4;
const EPI_BOT = 1.4;
const DERM_BOT = -1.2;
const HYPO_BOT = -3.3;
/** Keratinosit sütunu başına aynı anda görünen hücre sayısı (bazalden yüzeye). */
const PHASES = 7;
const ROWS = [0.42, 0.08];
const HAIR_PORE = new Vector3(-2.3, SURF, -0.05);
const HAIR_BULB = new Vector3(-3.1, -1.4, -0.1);
const SWEAT_PORE = new Vector3(2.65, SURF + 0.02, 0.3);
const SWEAT_COIL = new Vector3(2.5, -1.4, 0.1);
const PACINI = new Vector3(0.2, -1.9, -0.1);
const RAYS = 50;

const SHOTS = [
  { position: [2.4, 2.6, 11.5], target: [0, 0, -0.3] },
  { position: [0.6, 2.3, 2.9], target: [0.2, 1.9, 0.2] },
  { position: [1.6, 3.6, 4.0], target: [0.4, 1.9, 0.1] },
  { position: [-0.6, 2.4, 4.2], target: [-0.4, 1.4, 0.2] },
  { position: [4.8, 1.4, 6.2], target: [2.3, 0.4, 0] },
  { position: [0.9, 0.2, 5.6], target: [0.6, -0.3, 0] },
] as const;

const M4 = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const C = new Color();
const Z_AXIS = new Vector3(0, 0, 1);
const HIDE = new Matrix4().makeScale(0, 0, 0);

function smooth(a: number, b: number, x: number): number {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/** Yükseldikçe renk: canlı bazal → dikenli → granüler → ölü, soluk boynuz katmanı. */
const KERAT_STOPS: [number, Color][] = [
  [0, new Color('#b87464')],
  [0.35, new Color('#dca08a')],
  [0.65, new Color('#e8c49a')],
  [0.85, new Color('#f2e8da')],
];
function keratColor(h: number, out: Color): Color {
  for (let i = 1; i < KERAT_STOPS.length; i++) {
    const [h1, c1] = KERAT_STOPS[i]!;
    const [h0, c0] = KERAT_STOPS[i - 1]!;
    if (h <= h1) return out.copy(c0).lerp(c1, (h - h0) / (h1 - h0));
  }
  return out.copy(KERAT_STOPS[KERAT_STOPS.length - 1]![1]);
}

interface Kerat {
  x: number;
  z: number;
  o: number;
  drift: number;
}

interface Ray {
  x: number;
  z: number;
  stop: number;
  o: number;
  uvb: boolean;
}

export default function SkinScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0b0608', ['#0b0608', 8, 24], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.7, max: 16 }, { position: [3, 5, 17], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);

  const boxGeo = useDisposable(() => new BoxGeometry(1, 1, 1));
  const epiMat = useDisposable(() => new MeshStandardMaterial({ color: '#d8a48e', roughness: 0.7, emissive: '#2a1008', emissiveIntensity: 0.3 }));
  const dermisMat = useDisposable(() => new MeshStandardMaterial({ color: '#c98a86', roughness: 0.8, side: BackSide, emissive: '#200808', emissiveIntensity: 0.3 }));
  const hypoMat = useDisposable(() => new MeshStandardMaterial({ color: '#b8a064', roughness: 0.8, side: BackSide, emissive: '#1a1404', emissiveIntensity: 0.3 }));
  const keratGeo = useDisposable(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.2));
  const keratMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, emissive: '#1a0a06', emissiveIntensity: 0.3 }));
  const small = useDisposable(() => new SphereGeometry(1, 10, 8));
  const nucMat = useDisposable(() => new MeshStandardMaterial({ color: '#5a3a6a', roughness: 0.5, emissive: '#140a1a', emissiveIntensity: 0.4 }));
  const capMelMat = useDisposable(() => new MeshStandardMaterial({ color: '#4a2410', roughness: 0.5, emissive: '#1a0804', emissiveIntensity: 0.4 }));
  const melGeo = useDisposable(() => bumpySphere(2, 0.18, 5));
  const melMat = useDisposable(() => new MeshStandardMaterial({ color: '#7a4424', roughness: 0.5, emissive: '#2a1004', emissiveIntensity: 0.5 }));
  const granuleMat = useDisposable(() => new MeshStandardMaterial({ color: '#5a2a10', emissive: '#3a1404', emissiveIntensity: 0.8 }));
  const collagenMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0e0c8', roughness: 0.6, emissive: '#2a2010', emissiveIntensity: 0.3 }));
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5 }));
  const veinMat = useDisposable(() => new MeshStandardMaterial({ color: '#6a4a9a', roughness: 0.45, emissive: '#140a30', emissiveIntensity: 0.4 }));
  const rbcGeo = useDisposable(() => rbcGeometry(14));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const sheathMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#e8c0a0', roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false, emissive: '#2a1408', emissiveIntensity: 0.3 }));
  const shaftMat = useDisposable(() => new MeshStandardMaterial({ color: '#3a2214', roughness: 0.45, emissive: '#100804', emissiveIntensity: 0.3 }));
  const piliMat = useDisposable(() => new MeshStandardMaterial({ color: '#c05a60', roughness: 0.55, emissive: '#2a0508', emissiveIntensity: 0.4 }));
  const sebGeo = useDisposable(() => bumpySphere(2, 0.14, 8));
  const sebMat = useDisposable(() => new MeshStandardMaterial({ color: '#f2d27a', roughness: 0.45, emissive: '#3a2a08', emissiveIntensity: 0.45 }));
  const sebumMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe8a0', emissive: '#8a6a10', emissiveIntensity: 0.8 }));
  const sweatTubeMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#9ad0f0', roughness: 0.3, transparent: true, opacity: 0.7, emissive: '#10304a', emissiveIntensity: 0.5 }));
  const sweatMat = useDisposable(() => new MeshStandardMaterial({ color: '#bfe8ff', emissive: '#2f7aa8', emissiveIntensity: 1 }));
  const heatMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffa860', emissive: '#a04a10', emissiveIntensity: 1, transparent: true, opacity: 0.8 }));
  const nerveMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0d860', roughness: 0.45, emissive: '#4a3a08', emissiveIntensity: 0.5 }));
  const corpMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f6e6a0', roughness: 0.3, transparent: true, opacity: 0.45, depthWrite: false, emissive: '#4a3a10', emissiveIntensity: 0.4 }));
  const pulseMat = useDisposable(() => new MeshStandardMaterial({ color: '#fffbe0', emissive: '#fff080', emissiveIntensity: 1.6 }));
  const fatGeo = useDisposable(() => bumpySphere(2, 0.06, 11));
  const fatMat = useDisposable(() => new MeshPhysicalMaterial({ color: '#f0dc9a', roughness: 0.35, sheen: 1, sheenColor: '#fff4d0', emissive: '#3a2a08', emissiveIntensity: 0.3 }));
  const rayGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 6));
  const rayMat = useDisposable(() => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }));
  const ico = useDisposable(() => new IcosahedronGeometry(1, 0));
  const dhcMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8d0f0', emissive: '#30406a', emissiveIntensity: 0.6 }));
  const vitdMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe066', emissive: '#d0a000', emissiveIntensity: 1.4 }));

  const geo = useMemo(() => {
    const r = rng(97);
    // Keratinosit sütunları (kıl ve ter gözeneklerinin çevresi boş)
    const kerat: Kerat[] = [];
    ROWS.forEach((z, w) => {
      for (let x = X0 + 0.18 + w * 0.18; x < X1 - 0.1; x += 0.36) {
        if (Math.abs(x - HAIR_PORE.x) < 0.26 || (w === 0 && Math.abs(x - SWEAT_PORE.x) < 0.2)) continue;
        const o = r();
        for (let k = 0; k < PHASES; k++) kerat.push({ x, z, o: (o + k / PHASES) % 1, drift: r() - 0.5 });
      }
    });
    // Melanositler ve uzantıları
    const melanocytes: CellSpec[] = [];
    const dendrites = [];
    const melaninHops: Hop[] = [];
    for (const x of [-3.7, -1.5, 0.1, 1.9, 3.7]) {
      const body = new Vector3(x, EPI_BOT + 0.07, 0.25);
      melanocytes.push({ p: body, s: new Vector3(0.14, 0.1, 0.14) });
      for (let k = 0; k < 4; k++) {
        const tip = new Vector3(x + (k - 1.5) * 0.28 + (r() - 0.5) * 0.1, EPI_BOT + 0.3 + r() * 0.18, 0.25 + (r() - 0.5) * 0.3);
        dendrites.push(curve([[body.x, body.y, body.z], [(body.x + tip.x) / 2, body.y + 0.12, (body.z + tip.z) / 2], [tip.x, tip.y, tip.z]]));
        melaninHops.push({ from: body.clone(), to: tip.clone().add(new Vector3((r() - 0.5) * 0.15, 0.05, (r() - 0.5) * 0.1)), lift: new Vector3(0, 0.08, 0) });
      }
    }
    // Kolajen lifleri: üstte ince (papiller), derinde kalın (retiküler)
    const fibers = [];
    const radii: number[] = [];
    for (let i = 0; i < 28; i++) {
      const thin = i < 12;
      const y = thin ? 0.6 + r() * 0.65 : -1.0 + r() * 1.5;
      const z = Z0 + 0.2 + r() * (Z1 - Z0 - 0.4);
      const x = X0 + r() * 3;
      const len = 3.5 + r() * 3;
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 6; k++) pts.push([Math.min(X1, x + (k / 6) * len), y + Math.sin(k * 1.7 + i) * 0.1, z + Math.cos(k * 1.3 + i) * 0.14]);
      fibers.push(curve(pts));
      radii.push(thin ? 0.022 : 0.045);
    }
    // Kılcal kıvrımlar (papiller) ve damar ağları
    const loops = Array.from({ length: 9 }, (_, i) => {
      const x = -4 + i + (r() - 0.5) * 0.2;
      return curve([
        [x - 0.15, 0.9, 0.32],
        [x - 0.12, 1.2, 0.3],
        [x - 0.03, 1.34, 0.26],
        [x + 0.05, 1.34, 0.22],
        [x + 0.12, 1.2, 0.18],
        [x + 0.15, 0.88, 0.16],
      ]);
    });
    const arteriole = curve([[X0, 0.9, 0.32], [-1.5, 0.93, 0.34], [1.5, 0.88, 0.3], [X1, 0.9, 0.32]]);
    const venule = curve([[X1, 0.86, 0.16], [1.5, 0.84, 0.14], [-1.5, 0.87, 0.16], [X0, 0.85, 0.15]]);
    const deepA = curve([[X0, -1.05, -0.6], [-1, -1.0, -0.65], [2, -1.08, -0.55], [X1, -1.02, -0.6]]);
    const deepV = curve([[X1, -1.1, -0.2], [1, -1.14, -0.25], [-2, -1.08, -0.2], [X0, -1.12, -0.22]]);
    const risers = [-3.5, 0.9, 4.2].map((x) => curve([[x, -1.03, -0.6], [x + 0.1, -0.1, -0.2], [x - 0.05, 0.9, 0.32]]));
    // Kıl kökü, kıl ve yağ bezi
    const follicle = curve([[HAIR_BULB.x, HAIR_BULB.y, HAIR_BULB.z], [-2.85, 0.0, -0.08], [-2.55, 1.4, -0.06], [HAIR_PORE.x, HAIR_PORE.y, HAIR_PORE.z]]);
    const shaft = curve([[HAIR_BULB.x, HAIR_BULB.y + 0.05, HAIR_BULB.z], [-2.85, 0.0, -0.08], [-2.55, 1.4, -0.06], [HAIR_PORE.x, HAIR_PORE.y, HAIR_PORE.z], [-1.95, 3.2, -0.02], [-1.5, 3.9, 0]]);
    const pili = curve([[-2.8, 0.1, -0.08], [-2.3, 0.7, -0.02], [-1.9, 1.35, 0]]);
    const sebaceous: CellSpec[] = (
      [
        [-2.3, 0.95, 0.1, 0.19],
        [-2.12, 0.78, 0.02, 0.16],
        [-2.2, 1.12, -0.05, 0.15],
        [-2.02, 0.98, 0.2, 0.14],
        [-2.35, 0.72, 0.2, 0.13],
      ] as const
    ).map(([x, y, z, s]) => ({ p: new Vector3(x, y, z), s }));
    const sebumHops: Hop[] = sebaceous.map((c) => ({ from: c.p.clone(), to: new Vector3(-2.55, 1.05 + r() * 0.2, -0.06) }));
    // Ter bezi: kıvrımlı salgı kısmı ve yüzeye çıkan kanal
    const coilPts: [number, number, number][] = [];
    for (let k = 0; k <= 36; k++) {
      const a = k * 0.72;
      const rad = 0.2 + 0.06 * Math.sin(k * 1.3);
      coilPts.push([SWEAT_COIL.x + rad * Math.cos(a), SWEAT_COIL.y + 0.1 * Math.sin(k * 0.55) + (k / 36) * 0.28, SWEAT_COIL.z + rad * Math.sin(a)]);
    }
    const ductPts: [number, number, number][] = [
      [2.55, -1.02, 0.1],
      [2.6, -0.2, 0.15],
      [2.5, 0.6, 0.12],
      [2.65, 1.25, 0.2],
      [2.72, 1.55, 0.26],
      [2.58, 1.75, 0.3],
      [2.72, 1.95, 0.28],
      [2.58, 2.15, 0.3],
      [SWEAT_PORE.x, SWEAT_PORE.y, SWEAT_PORE.z],
    ];
    const coil = curve(coilPts);
    const duct = curve(ductPts);
    const sweatPath = curve([...coilPts.filter((_, k) => k % 3 === 0), ...ductPts]);
    const droplets: Hop[] = Array.from({ length: 30 }, () => ({
      from: SWEAT_PORE.clone(),
      to: SWEAT_PORE.clone().add(new Vector3((r() - 0.5) * 0.9, 0.04, (r() - 0.5) * 0.5)),
      lift: new Vector3(0, 0.1, 0),
    }));
    const heat: Hop[] = loops.flatMap((l) =>
      [0, 1, 2].map(() => {
        const top = l.getPointAt(0.5);
        return { from: top.clone(), to: top.clone().add(new Vector3((r() - 0.5) * 0.6, 1.6 + r() * 0.8, (r() - 0.5) * 0.4)) };
      }),
    );
    // Sinirler: ana sinir, serbest uçlar, Meissner ve Pacini cisimcikleri
    const mainNerve = curve([[X0, -0.8, -0.3], [-2, -0.72, -0.35], [1, -0.78, -0.28], [X1, -0.7, -0.3]]);
    const branches = [
      curve([[-0.6, -0.76, -0.3], [-0.5, 0.3, -0.05], [-0.55, 1.2, 0.18], [-0.45, 1.58, 0.25]]),
      curve([[0.6, -0.77, -0.3], [0.7, 0.3, -0.05], [0.65, 1.2, 0.15], [0.75, 1.6, 0.2]]),
      curve([[3.6, -0.72, -0.3], [3.5, 0.3, -0.05], [3.55, 1.2, 0.2], [3.45, 1.56, 0.25]]),
      curve([[1.3, -0.78, -0.3], [1.25, 0.2, 0], [1.2, 0.95, 0.2], [1.2, 1.1, 0.25]]),
      curve([[0.0, -0.78, -0.3], [0.1, -1.35, -0.2], [PACINI.x, PACINI.y + 0.3, PACINI.z]]),
    ];
    const corpuscles: CellSpec[] = [
      { p: new Vector3(1.2, 1.2, 0.25), s: new Vector3(0.08, 0.15, 0.08) },
      { p: PACINI.clone(), s: new Vector3(0.2, 0.34, 0.2) },
      { p: PACINI.clone(), s: new Vector3(0.14, 0.25, 0.14) },
      { p: PACINI.clone(), s: new Vector3(0.08, 0.16, 0.08) },
    ];
    // Sinyal: uçtan ana sinire, oradan omuriliğe doğru (−x)
    const signals = branches.map((b) => {
      const pts: [number, number, number][] = [];
      for (let k = 10; k >= 0; k--) {
        const p = b.getPointAt(k / 10);
        pts.push([p.x, p.y, p.z]);
      }
      const start = b.getPointAt(0);
      pts.push([start.x - 1.2, -0.76, -0.3], [X0, -0.8, -0.3]);
      return curve(pts);
    });
    // Hipodermis yağ hücreleri (bez, kıl kökü ve Pacini cisimciği çevresi boş)
    const fat: CellSpec[] = [];
    for (const y of [-2.9, -2.3, -1.72]) {
      for (let x = -4.6; x <= 4.7; x += 0.62) {
        for (const z of [-1.5, -0.88, -0.26, 0.36]) {
          const p = new Vector3(x + (r() - 0.5) * 0.12, y + (r() - 0.5) * 0.1, z + (r() - 0.5) * 0.1);
          if (p.distanceTo(SWEAT_COIL) < 0.62 || p.distanceTo(PACINI) < 0.5 || p.distanceTo(HAIR_BULB) < 0.5) continue;
          fat.push({ p, s: 0.27 + r() * 0.04 });
        }
      }
    }
    // UV ışınları: UVB epidermiste, UVA dermise kadar
    const rays: Ray[] = Array.from({ length: RAYS }, () => {
      const uvb = r() < 0.6;
      return { x: -4.5 + r() * 9, z: -1.4 + r() * 1.8, stop: uvb ? 1.55 + r() * 0.35 : 0.4 + r() * 0.6, o: r(), uvb };
    });
    // 7-dehidrokolesterol (epidermisin alt katmanlarında) ve D3'ün kılcala geçişi
    const dhc: CellSpec[] = Array.from({ length: 40 }, () => ({ p: new Vector3(-4.5 + r() * 9, EPI_BOT + 0.12 + r() * 0.35, 0.05 + r() * 0.4), s: 0.03 }));
    const vitdHops: Hop[] = dhc.map((d) => {
      const li = Math.max(0, Math.min(loops.length - 1, Math.round(d.p.x + 4)));
      return { from: d.p.clone(), to: loops[li]!.getPointAt(0.35 + r() * 0.3) };
    });
    const vitdPaths = [...loops, arteriole, venule, deepV];
    return {
      kerat,
      melanocytes,
      dendrites,
      melaninHops,
      fibers,
      radii,
      loops,
      arteriole,
      venule,
      deepA,
      deepV,
      risers,
      follicle,
      shaft,
      pili,
      sebaceous,
      sebumHops,
      coil,
      duct,
      sweatPath,
      droplets,
      heat,
      mainNerve,
      branches,
      corpuscles,
      signals,
      fat,
      rays,
      dhc,
      vitdHops,
      vitdPaths,
    };
  }, []);

  // Kişisel: D vitamini molekülü sayısı (düşükse daha az; temsili)
  const vitd = params.vitd;
  const renewE = useEased(stage === 1 ? 1 : 0, 1);
  const melE = useEased(stage === 2 ? 1 : 0, 1.2);
  const uvE = useEased(stage === 2 || stage === 3 ? 1 : 0, 1.5);
  const heatE = useEased(stage === 4 ? 1 : 0, 1);
  const clock = useRef({ last: 0, acc: 0 });
  const keratRef = useRef<InstancedMesh>(null);
  const nucRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);
  const rayRef = useRef<InstancedMesh>(null);
  const uvbColor = useMemo(() => new Color('#8a5cff'), []);
  const uvaColor = useMemo(() => new Color('#d0b8ff'), []);

  useFrame(() => {
    const t = time.current;
    const ck = clock.current;
    ck.acc += Math.max(0, t - ck.last) * (0.012 + 0.045 * renewE.current);
    ck.last = t;
    // Keratinositler: bazalde doğar, yükselip yassılaşır, yüzeyden dökülür
    const km = keratRef.current;
    const nm = nucRef.current;
    const cm = capRef.current;
    if (km && nm && cm) {
      const mel = 0.65 + 0.55 * melE.current;
      for (let i = 0; i < geo.kerat.length; i++) {
        const c = geo.kerat[i]!;
        const h = (c.o + ck.acc) % 1;
        const f = 1 - Math.pow(1 - h, 1.6);
        const height = 0.185 * Math.pow(1 - h, 0.6) + 0.02;
        const born = Math.min(1, h / 0.04);
        const flake = smooth(0.93, 1, h);
        const k = born * (1 - flake);
        P.set(c.x + flake * c.drift * 0.6, EPI_BOT + 0.07 + f * 0.9 + flake * 0.45, c.z);
        Q.setFromAxisAngle(Z_AXIS, flake * c.drift * 0.8);
        S.set((0.26 + 0.1 * h) * k, height * k, (0.28 + 0.05 * h) * k);
        M4.compose(P, Q, S);
        km.setMatrixAt(i, M4);
        km.setColorAt(i, keratColor(h, C));
        // Çekirdek: granüler katmanda kaybolur
        if (h < 0.7) {
          M4.compose(P, Q.identity(), S.setScalar(0.05 * born * (1 - smooth(0.5, 0.7, h))));
          nm.setMatrixAt(i, M4);
        } else nm.setMatrixAt(i, HIDE);
        // Melanin şemsiyesi: çekirdeğin üstünde (ışığa bakan tarafta)
        if (h < 0.62) {
          P.y += 0.045;
          M4.compose(P, Q, S.set(0.075 * mel * born, 0.024 * mel * born, 0.075 * mel * born));
          cm.setMatrixAt(i, M4);
        } else cm.setMatrixAt(i, HIDE);
      }
      km.instanceMatrix.needsUpdate = true;
      if (km.instanceColor) km.instanceColor.needsUpdate = true;
      nm.instanceMatrix.needsUpdate = true;
      cm.instanceMatrix.needsUpdate = true;
    }
    // UV ışınları
    const rm = rayRef.current;
    if (rm) {
      const vis = uvE.current;
      for (let i = 0; i < RAYS; i++) {
        const ray = geo.rays[i]!;
        if (vis < 0.01) {
          rm.setMatrixAt(i, HIDE);
          continue;
        }
        const k = (t * 0.45 + ray.o) % 1;
        const head = 5.4 - Math.min(1, k / 0.75) * (5.4 - ray.stop);
        const len = 0.7 * (1 - smooth(0.75, 1, k)) + 0.02;
        P.set(ray.x, head + len / 2, ray.z);
        const rad = (ray.uvb ? 0.02 : 0.015) * vis;
        M4.compose(P, Q.identity(), S.set(rad, len * vis, rad));
        rm.setMatrixAt(i, M4);
        rm.setColorAt(i, ray.uvb ? uvbColor : uvaColor);
      }
      rm.instanceMatrix.needsUpdate = true;
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    }
    // Isı düzenleme: yüzey damarları genişler ve parlar
    capMat.emissiveIntensity = 0.5 + 0.9 * heatE.current;
  });

  const pulse = (i: number, t: number) => ({ scale: stage === 5 ? 1 + 0.12 * Math.max(0, Math.sin(t * 4 + i)) : 1 });

  return (
    <group>
      <ambientLight intensity={0.4} color="#ffe6dc" />
      <directionalLight position={[3, 7, 5]} intensity={1.15} />
      <Headlight intensity={2.6} distance={16} />
      {/* Katmanlar */}
      <mesh geometry={boxGeo} material={epiMat} position={[0, (EPI_BOT + SURF - 0.02) / 2, (Z0 - 0.2) / 2]} scale={[X1 - X0, SURF - 0.02 - EPI_BOT, -0.2 - Z0]} onClick={pick('epidermis')} />
      <mesh geometry={boxGeo} material={dermisMat} position={[0, (EPI_BOT + DERM_BOT) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, EPI_BOT - DERM_BOT, Z1 - Z0]} onClick={pick('dermis')} />
      <mesh geometry={boxGeo} material={hypoMat} position={[0, (DERM_BOT + HYPO_BOT) / 2, (Z0 + Z1) / 2]} scale={[X1 - X0, DERM_BOT - HYPO_BOT, Z1 - Z0]} onClick={pick('fat')} />
      {/* Epidermis: keratinositler, çekirdekler, melanin, melanositler */}
      <instancedMesh ref={keratRef} args={[keratGeo, keratMat, geo.kerat.length]} onClick={pick('keratinocyte')} frustumCulled={false} />
      <instancedMesh ref={nucRef} args={[small, nucMat, geo.kerat.length]} raycast={() => null} frustumCulled={false} />
      <instancedMesh ref={capRef} args={[small, capMelMat, geo.kerat.length]} onClick={pick('melanin')} frustumCulled={false} />
      <Cells cells={geo.melanocytes} geometry={melGeo} material={melMat} onClick={pick('melanocyte')} />
      <Tubes curves={geo.dendrites} radius={0.018} material={melMat} onClick={pick('melanocyte')} segments={16} radial={6} />
      <Hoppers hops={geo.melaninHops} count={50} geometry={small} material={granuleMat} time={time} duration={2.4} size={0.028} seed={3} active={stage === 2} onClick={pick('melanin')} />
      {/* Dermis: kolajen, damarlar, kıl, bezler, sinirler */}
      <Tubes curves={geo.fibers} radius={geo.radii} material={collagenMat} onClick={pick('collagen')} segments={48} radial={6} />
      <Tubes curves={geo.loops} radius={0.035} material={capMat} onClick={pick('capillary')} segments={24} radial={8} />
      <Tubes curves={[geo.arteriole, geo.deepA, ...geo.risers]} radius={[0.05, 0.1, 0.05, 0.05, 0.05]} material={capMat} onClick={pick('capillary')} segments={64} radial={8} />
      <Tubes curves={[geo.venule, geo.deepV]} radius={[0.06, 0.12]} material={veinMat} onClick={pick('capillary')} segments={64} radial={8} />
      <CurveMovers curves={geo.loops} count={60} shown={stage === 4 ? 60 : 30} geometry={rbcGeo} material={rbcMat} time={time} speed={0.12} size={0.05} flat onClick={pick('capillary')} />
      <CurveMovers curves={[geo.deepA, geo.deepV]} count={24} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={0.11} flat seed={4} onClick={pick('capillary')} />
      <Tubes curves={[geo.follicle]} radius={0.17} material={sheathMat} onClick={pick('hair')} segments={48} radial={14} />
      <Tubes curves={[geo.shaft]} radius={0.055} material={shaftMat} onClick={pick('hair')} segments={64} radial={8} />
      <Tubes curves={[geo.pili]} radius={0.035} material={piliMat} onClick={pick('hair')} segments={16} radial={6} />
      <mesh position={HAIR_BULB} material={sheathMat} onClick={pick('hair')}>
        <sphereGeometry args={[0.24, 20, 14]} />
      </mesh>
      <Cells cells={geo.sebaceous} geometry={sebGeo} material={sebMat} onClick={pick('sebaceous')} />
      <Hoppers hops={geo.sebumHops} count={14} geometry={small} material={sebumMat} time={time} duration={3.2} size={0.03} seed={5} onClick={pick('sebaceous')} />
      <Tubes curves={[geo.coil]} radius={0.055} material={sweatTubeMat} onClick={pick('sweat')} segments={160} radial={8} />
      <Tubes curves={[geo.duct]} radius={0.04} material={sweatTubeMat} onClick={pick('sweat')} segments={96} radial={8} />
      <CurveMovers curves={[geo.sweatPath]} count={40} shown={stage === 4 ? 40 : 6} geometry={small} material={sweatMat} time={time} speed={0.08} size={0.03} seed={6} onClick={pick('sweat')} />
      <Hoppers hops={geo.droplets} count={30} geometry={small} material={sweatMat} time={time} duration={2.4} size={0.05} seed={7} active={stage === 4} onClick={pick('sweat')} />
      <Hoppers hops={geo.heat} count={27} geometry={small} material={heatMat} time={time} duration={2.8} size={0.035} seed={8} active={stage === 4} onClick={pick('capillary')} />
      <Tubes curves={[geo.mainNerve]} radius={0.06} material={nerveMat} onClick={pick('nerve')} segments={64} radial={8} />
      <Tubes curves={geo.branches} radius={0.022} material={nerveMat} onClick={pick('nerve')} segments={32} radial={6} />
      <Cells cells={geo.corpuscles} geometry={small} material={corpMat} onClick={pick('nerve')} time={time} animate={pulse} />
      <CurveMovers curves={geo.signals} count={40} shown={stage === 5 ? 40 : 0} geometry={small} material={pulseMat} time={time} speed={0.14} size={0.035} seed={9} onClick={pick('nerve')} />
      {/* Hipodermis */}
      <Cells cells={geo.fat} geometry={fatGeo} material={fatMat} onClick={pick('fat')} />
      {/* UV ve D vitamini */}
      <instancedMesh ref={rayRef} args={[rayGeo, rayMat, RAYS]} onClick={pick('uv')} frustumCulled={false} />
      <Cells
        cells={geo.dhc}
        geometry={ico}
        material={dhcMat}
        onClick={pick('vitd')}
        time={time}
        animate={(i, t, out) => {
          const k = stage === 3 ? 1 + 1.6 * Math.pow(Math.max(0, Math.sin(t * 2 + i * 0.7)), 4) : 1;
          out.setRGB(k, k, k);
          return { color: true };
        }}
      />
      <Hoppers hops={geo.vitdHops} count={60} shown={scaled(24, vitd, 60)} geometry={ico} material={vitdMat} time={time} duration={3} size={0.04} seed={11} active={stage === 3} onClick={pick('vitd')} />
      <CurveMovers curves={geo.vitdPaths} count={70} shown={scaled(stage === 3 ? 30 : 14, vitd, 70)} geometry={ico} material={vitdMat} time={time} speed={0.07} size={0.04} jitter={0.02} seed={13} onClick={pick('vitd')} />
    </group>
  );
}
