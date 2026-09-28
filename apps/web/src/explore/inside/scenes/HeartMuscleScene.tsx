import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  type Intersection,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  type Raycaster,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { Headlight, type InsideSceneProps, rbcGeometry, rng, scaled, useAtmosphere, useDisposable, useEased, useSimClock, useStageCamera } from '../kit';
import { CurveMovers, Hoppers, type Hop, Tubes, curve, makePick } from '../micro';

/**
 * Kalp kası (miyokard), temsili. Dallanan, çizgili kalp kası hücreleri uç uca ara disklerle
 * bağlanır; aralarından kılcallar geçer. Sinüs düğümü yönünden (soldan) gelen elektrik dalgası
 * ara disklerdeki oluklu bağlantılardan hücreden hücreye geçer; dalganın ardından hücre içinde
 * kalsiyum yükselir, hücreler kısalır ve gevşer (sahne saatinde ~1 atım/sn).
 * Doku ekseni X. Kasılma doku boyunca sürekli bir haritayla (x → F(x)) çizilir; böylece hücreler
 * ara disklerde kopmadan birlikte kısalır. Ölçekler ve iyon sayıları bilerek abartılmıştır.
 */

/** Bir atımın süresi (sahne saniyesi) ve dalganın dokuyu baştan sona geçme süresi. */
const PERIOD = 1;
const WAVE = 0.36;
const X0 = -6.8;
const X1 = 6.8;
/** Sarkomer (çizgi) aralığı, dinlenme uzunluğunda (temsili). */
const SARC = 0.2;
/** Kasılma haritası için örnekleme ızgarası (x: -7..7). */
const GRID_N = 57;
const GX0 = -7;
const GDX = 0.25;
const GAPS = 7;
const CA_MAX = 420;
const MG_MAX = 140;
const K_MAX = 210;
const RBC_MAX = 150;

/** Hücre zincirleri (y, z): arkada üç, önde iki sıra (altıgen dizilim). */
const CHAINS: [number, number][] = [
  [-1.6, -0.9],
  [0, -0.9],
  [1.6, -0.9],
  [-0.8, 0.9],
  [0.8, 0.9],
];
/** Y-dallanmaların bağladığı zincir çiftleri (arka → ön). */
const BRANCH_PAIRS: [number, number][] = [
  [0, 3],
  [1, 3],
  [1, 4],
  [2, 4],
];
/** Kılcallar (y, z): hücre sıralarının arasındaki boşluklarda, liflere paralel. */
const CAPS: [number, number][] = [
  [-0.8, -0.95],
  [0.8, -0.95],
  [0, 0.95],
  [-1.6, 0.95],
  [1.6, 0.95],
];

const SHOTS = [
  { position: [2.2, 2.6, 9.6], target: [0, 0, 0] },
  { position: [-3.8, 1.6, 6.6], target: [-0.8, 0, 0] },
  { position: [1.0, 1.5, 3.9], target: [0.3, 0.8, 0.9] },
  { position: [0.3, 1.0, 10.8], target: [0, 0, 0] },
  { position: [2.6, 0.5, 4.0], target: [1.5, 0, 0.9] },
] as const;

const UP = new Vector3(0, 1, 0);
const M = new Matrix4();
const P = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const OFF = new Vector3();
const TB = new Vector3();
const C = new Color();
const HIDE = new Matrix4().makeScale(0, 0, 0);
const GAP_DIM = new Color('#3aa6b8');
const GAP_LIT = new Color('#f2ffff');

function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Dalganın x noktasına varışından bu yana geçen süre (atım içinde, sahne saniyesi). */
function sinceWave(x: number, tau: number): number {
  let l = tau - ((x - X0) / (X1 - X0)) * WAVE;
  if (l < 0) l += PERIOD;
  return l;
}

/** Yerel kasılma düzeyi (0..1): uyarının ardından kısa gecikmeyle kasılma, sonra gevşeme. */
function contraction(l: number): number {
  return sstep(0.05, 0.2, l) * (1 - sstep(0.3, 0.58, l));
}

/** Hücre içi kalsiyum yükselişi: kasılmadan hemen önce başlar, depoya geri pompalanınca söner. */
function calciumPulse(l: number): number {
  return sstep(0, 0.07, l) * (1 - sstep(0.16, 0.42, l));
}

/**
 * Referans aralığı dar iyonlarda (K, Ca, Mg) tipik düzeyden sapmayı görünür kılmak için büyütür.
 * Yalnızca görselleştirme içindir; arayüz sayıların temsili olduğunu yazar.
 */
function emphasize(v: number | undefined, gain: number): number {
  return Math.max(0.15, Math.min(3, 1 + ((v ?? 1) - 1) * gain));
}

function closestOnSegment(p: Vector3, a: Vector3, b: Vector3, out: Vector3): Vector3 {
  TB.subVectors(b, a);
  const t = Math.max(0, Math.min(1, OFF.subVectors(p, a).dot(TB) / TB.lengthSq()));
  return out.copy(a).addScaledVector(TB, t);
}

function segDist(p: Vector3, a: Vector3, b: Vector3): number {
  return closestOnSegment(p, a, b, P).distanceTo(p);
}

function raycastIfVisible(this: Mesh, raycaster: Raycaster, hits: Intersection[]) {
  if (this.visible) Mesh.prototype.raycast.call(this, raycaster, hits);
}

function instancedIfVisible(this: InstancedMesh, raycaster: Raycaster, hits: Intersection[]) {
  if (this.visible) InstancedMesh.prototype.raycast.call(this, raycaster, hits);
}

interface CellSeg {
  a: Vector3;
  b: Vector3;
  r: number;
  rest: number;
  branch: boolean;
  twist: number;
}

interface Disc {
  p: Vector3;
  /** Yönünü aldığı (diskten sonra gelen) hücre. */
  cell: number;
  r: number;
}

/** Bir hücreye bağlı nokta: u = eksen boyunca (0..1), th = açı, rho = yarıçap oranı. */
interface Attach {
  c: number;
  u: number;
  th: number;
  rho: number;
  k: number;
}

interface Drifter {
  p: Vector3;
  ph: number;
}

interface Frame {
  a: Vector3[];
  dir: Vector3[];
  q: Quaternion[];
  len: Float32Array;
  bulge: Float32Array;
  cum: Float32Array;
}

function buildTissue() {
  const r = rng(47);
  const cells: CellSeg[] = [];
  const discs: Disc[] = [];
  const inner: { p: Vector3; x: number }[][] = [];
  for (const [y, z] of CHAINS) {
    const rad = 0.34 + r() * 0.05;
    const node = (x: number) => new Vector3(x, y + (r() - 0.5) * 0.18, z + (r() - 0.5) * 0.18);
    const nodes = [node(X0)];
    let x = X0 + 0.9 + r() * 1.5;
    while (x < X1 - 1.0) {
      nodes.push(node(x));
      x += 2.4 + r() * 0.6;
    }
    nodes.push(node(X1));
    const list: { p: Vector3; x: number }[] = [];
    for (let k = 0; k < nodes.length - 1; k++) {
      const a = nodes[k]!;
      const b = nodes[k + 1]!;
      cells.push({ a, b, r: rad, rest: a.distanceTo(b), branch: false, twist: r() * Math.PI * 2 });
      if (k > 0) {
        discs.push({ p: a, cell: cells.length - 1, r: rad });
        list.push({ p: a, x: a.x });
      }
    }
    inner.push(list);
  }
  // Y-dallanma: bir ara diskten komşu sıradaki bir ara diske uzanan dal hücreleri
  for (const [ia, ib] of BRANCH_PAIRS) {
    let made = 0;
    for (const na of inner[ia] ?? []) {
      if (made >= 2) break;
      const nb = (inner[ib] ?? []).find((n) => {
        const dx = Math.abs(n.x - na.x);
        return dx > 1.8 && dx < 3.1;
      });
      if (!nb || r() < 0.3) continue;
      const a = na.x < nb.x ? na.p : nb.p;
      const b = na.x < nb.x ? nb.p : na.p;
      cells.push({ a, b, r: 0.26, rest: a.distanceTo(b), branch: true, twist: r() * Math.PI * 2 });
      made++;
    }
  }

  const totalRest = cells.reduce((s, c) => s + c.rest, 0);
  const pickCell = () => {
    let v = r() * totalRest;
    for (let i = 0; i < cells.length; i++) {
      v -= cells[i]!.rest;
      if (v <= 0) return i;
    }
    return cells.length - 1;
  };

  const nuclei: Attach[] = [];
  const mito: Attach[] = [];
  cells.forEach((c, ci) => {
    if (c.rest > 1.1) {
      if (!c.branch && c.rest > 2.4 && r() < 0.3) nuclei.push({ c: ci, u: 0.4, th: 0, rho: 0, k: 0 }, { c: ci, u: 0.6, th: 0, rho: 0, k: 0 });
      else nuclei.push({ c: ci, u: 0.5, th: 0, rho: 0, k: 0 });
    }
    // Mitokondriler miyofibriller arasında boylu boyunca sıralar halinde
    const n = Math.max(2, Math.floor(c.rest / 0.42));
    for (let row = 0; row < 3; row++) {
      for (let j = 0; j < n; j++) mito.push({ c: ci, u: (j + 0.5) / n + (r() - 0.5) * 0.04, th: c.twist + (row * Math.PI * 2) / 3, rho: 0.6, k: r() });
    }
  });

  // Kalsiyum: hücre içi depodan (SR) salınan kıvılcımlar; k < 0.18 olanlar dışarıdan giren "tetikleyici" kalsiyum
  const ca: Attach[] = Array.from({ length: CA_MAX }, () => ({ c: pickCell(), u: 0.08 + r() * 0.84, th: r() * Math.PI * 2, rho: 0.15 + r() * 0.55, k: r() }));
  // Magnezyum: çoğunlukla hücre içinde, ATP ile birlikte (mitokondri sıralarının yakınında)
  const mg: Attach[] = Array.from({ length: MG_MAX }, () => {
    const ci = pickCell();
    const c = cells[ci]!;
    return { c: ci, u: 0.1 + r() * 0.8, th: c.twist + Math.floor(r() * 3) * ((Math.PI * 2) / 3) + (r() - 0.5) * 0.9, rho: 0.4 + r() * 0.3, k: r() * 20 };
  });

  const caps = CAPS.map(([y, z], i) =>
    curve(
      Array.from({ length: 9 }, (_, j): [number, number, number] => {
        const x = X0 - 0.3 + (j / 8) * (X1 - X0 + 0.6);
        return [x, y + Math.sin(j * 1.3 + i) * 0.07, z + Math.cos(j * 1.1 + i * 2) * 0.07];
      }),
    ),
  );

  // Potasyum: hücre dışı sıvıda (tahlilde ölçülen serum potasyumu hücre dışıdır)
  const k: Drifter[] = [];
  for (let guard = 0; k.length < K_MAX && guard < 40000; guard++) {
    const p = new Vector3(X0 + 0.2 + r() * (X1 - X0 - 0.4), (r() - 0.5) * 4.8, (r() - 0.5) * 3.6);
    if (cells.some((c) => segDist(p, c.a, c.b) < c.r + 0.08)) continue;
    if (CAPS.some(([cy, cz]) => Math.hypot(p.y - cy, p.z - cz) < 0.2)) continue;
    k.push({ p, ph: r() * Math.PI * 2 });
  }

  // Oksijen: kılcaldan en yakın kas hücresine
  const o2: Hop[] = [];
  caps.forEach((cv) => {
    for (let j = 0; j < 10; j++) {
      const from = cv.getPointAt(0.05 + 0.9 * ((j + r() * 0.6) / 10));
      let best = 0;
      let bd = Infinity;
      cells.forEach((c, ci) => {
        const d = segDist(from, c.a, c.b);
        if (d < bd) {
          bd = d;
          best = ci;
        }
      });
      const c = cells[best]!;
      const to = closestOnSegment(from, c.a, c.b, new Vector3()).lerp(from, 0.35);
      o2.push({ from, to });
    }
  });

  // Öndeki üst sıradan bir hücre: sarkomer (Z çizgisi) halkaları bunun üzerinde gösterilir
  const want = new Vector3(0.3, 0.8, 0.9);
  let featured = 0;
  let fd = Infinity;
  cells.forEach((c, ci) => {
    if (c.branch) return;
    const d = P.copy(c.a).add(c.b).multiplyScalar(0.5).distanceTo(want);
    if (d < fd) {
      fd = d;
      featured = ci;
    }
  });
  const fc = cells[featured]!;
  const rings: number[] = [];
  const kmax = Math.floor((fc.rest / 2 - 0.12) / SARC);
  for (let j = -kmax; j <= kmax; j++) rings.push(j * SARC);

  const rest = new Float32Array(cells.map((c) => c.rest));
  return { cells, discs, nuclei, mito, ca, mg, k, caps, o2, featured, rings, rest };
}

/** Kalp kası hücresi: ortası hafif kalın, uçları ara diske oturan düz iğ (eksen Y, boy 1, yarıçap 1). */
function myocyteGeometry(rest: Float32Array) {
  const pts: Vector2[] = [new Vector2(0, -0.5)];
  const n = 16;
  for (let i = 0; i <= n; i++) pts.push(new Vector2(0.84 + 0.16 * Math.sin(Math.PI * (i / n)), -0.5 + i / n));
  pts.push(new Vector2(0, 0.5));
  const g = new LatheGeometry(pts, 22);
  // Her örneğin dinlenme uzunluğu: çizgilenme (sarkomerler) hücreyle birlikte sıkışsın
  g.setAttribute('khRest', new InstancedBufferAttribute(rest, 1));
  return g;
}

interface WaveUniforms {
  uWaveX: { value: number };
  uWaveAmp: { value: number };
  uWaveColor: { value: Color };
  uInvP: { value: number };
}

/** Çizgili (A/I bantları ve Z çizgileri) ve elektrik dalgasıyla parlayan kalp kası malzemesi. */
function myocyteMaterial(u: WaveUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: '#c9525e',
    roughness: 0.55,
    emissive: '#2a0508',
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float khRest;\nvarying float vKhX;\nvarying float vKhL;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 khW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          khW = instanceMatrix * khW;
        #endif
        vKhX = (modelMatrix * khW).x;
        vKhL = position.y * khRest;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWaveX;\nuniform float uWaveAmp;\nuniform vec3 uWaveColor;\nuniform float uInvP;\nvarying float vKhX;\nvarying float vKhL;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float khF = vKhL * uInvP;
        float khPh = fract(khF);
        float khAA = clamp(1.0 - fwidth(khF) * 2.0, 0.0, 1.0);
        float khA = smoothstep(0.2, 0.3, khPh) * (1.0 - smoothstep(0.7, 0.8, khPh));
        float khZ = 1.0 - smoothstep(0.0, 0.05, min(khPh, 1.0 - khPh));
        diffuseColor.rgb *= 1.0 - khAA * (0.24 * khA + 0.3 * khZ);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float khD = vKhX - uWaveX;
        totalEmissiveRadiance += uWaveColor * uWaveAmp * (exp(-khD * khD * 3.0) + (khD < 0.0 ? 0.22 * exp(khD * 0.7) : 0.0));`,
      );
  };
  m.customProgramCacheKey = () => 'kh-myocyte';
  return m;
}

/** Hücreye bağlı bir noktanın o anki (kasılmış) dünya konumu. */
function attach(fr: Frame, cells: CellSeg[], c: number, u: number, th: number, rho: number, out: Vector3): Vector3 {
  const cell = cells[c]!;
  out.copy(fr.a[c]!).addScaledVector(fr.dir[c]!, u * fr.len[c]!);
  const rr = cell.r * fr.bulge[c]! * rho;
  OFF.set(Math.cos(th) * rr, 0, Math.sin(th) * rr).applyQuaternion(fr.q[c]!);
  return out.add(OFF);
}

export default function HeartMuscleScene({ state, onSelect, reducedMotion, params }: InsideSceneProps) {
  const stage = state.stage;
  const shot = SHOTS[stage] ?? SHOTS[0];
  useAtmosphere('#0c0407', ['#0c0407', 7, 21], 0.45);
  useStageCamera({ position: [...shot.position], target: [...shot.target] }, { min: 0.8, max: 16 }, { position: [0, 3, 16], target: [0, 0, 0] });
  const time = useSimClock(state, reducedMotion);
  const pick = makePick(onSelect);

  const tissue = useMemo(buildTissue, []);

  // Kişisel: hücre dışı potasyum, atım başına kalsiyum kıvılcımı, hücre içi magnezyum, alyuvar yoğunluğu
  const nK = scaled(70, emphasize(params.k, 3), K_MAX);
  const nCa = scaled(140, emphasize(params.ca, 3), CA_MAX);
  const nMg = scaled(45, emphasize(params.mg, 3), MG_MAX);
  const o2 = params.o2 ?? 1;
  const nRbc = scaled(70, o2, RBC_MAX);

  const uniforms = useMemo<WaveUniforms>(() => ({ uWaveX: { value: -99 }, uWaveAmp: { value: 0 }, uWaveColor: { value: new Color('#6fe6ff') }, uInvP: { value: 1 / SARC } }), []);
  const cellGeo = useDisposable(() => myocyteGeometry(tissue.rest), [tissue]);
  const cellMat = useDisposable(() => myocyteMaterial(uniforms), [uniforms]);
  const discGeo = useDisposable(() => new CylinderGeometry(1, 1, 1, 28));
  const discMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffe7a3', roughness: 0.35, emissive: '#6a4c12', emissiveIntensity: 0.7 }));
  const dotGeo = useDisposable(() => new SphereGeometry(1, 8, 6));
  const gapMat = useDisposable(() => new MeshBasicMaterial({ color: '#ffffff' }));
  const nucGeo = useDisposable(() => new SphereGeometry(1, 16, 12));
  const nucMat = useDisposable(() => new MeshStandardMaterial({ color: '#6b4fc0', roughness: 0.5, emissive: '#1c1040', emissiveIntensity: 0.5 }));
  const mitoGeo = useDisposable(() => new CapsuleGeometry(0.055, 0.2, 4, 8));
  const mitoMat = useDisposable(() => new MeshStandardMaterial({ color: '#f0a048', roughness: 0.45, emissive: '#6a3000', emissiveIntensity: 0.35 }));
  const ringGeo = useDisposable(() => new TorusGeometry(1, 0.045, 6, 36).rotateX(Math.PI / 2));
  const ringMat = useDisposable(() => new MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0, depthWrite: false }));
  const capMat = useDisposable(() => new MeshStandardMaterial({ color: '#c8323f', roughness: 0.4, emissive: '#3a0508', emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }));
  const rbcGeo = useDisposable(() => rbcGeometry(16));
  const rbcMat = useDisposable(() => new MeshStandardMaterial({ color: '#b3202c', roughness: 0.45, emissive: '#2a0306', emissiveIntensity: 0.4 }));
  const ionGeo = useDisposable(() => new SphereGeometry(1, 10, 8));
  const caMat = useDisposable(() => new MeshBasicMaterial({ color: '#c6ff5c' }));
  const kMat = useDisposable(() => new MeshStandardMaterial({ color: '#b48cff', roughness: 0.4, emissive: '#4a2a9a', emissiveIntensity: 0.9 }));
  const mgMat = useDisposable(() => new MeshStandardMaterial({ color: '#ff9ad2', roughness: 0.4, emissive: '#8a2a60', emissiveIntensity: 0.8 }));
  const o2Mat = useDisposable(() => new MeshStandardMaterial({ color: '#bff6ff', emissive: '#4fd6e8', emissiveIntensity: 1.1 }));
  const waveGeo = useDisposable(() => new BoxGeometry(0.45, 5.4, 4.0));
  const waveMat = useDisposable(() => new MeshBasicMaterial({ color: '#6fe6ff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  const paceGeo = useDisposable(() => new SphereGeometry(1, 20, 14));
  const paceMat = useDisposable(() => new MeshBasicMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false }));

  const cellRef = useRef<InstancedMesh>(null);
  const discRef = useRef<InstancedMesh>(null);
  const gapRef = useRef<InstancedMesh>(null);
  const nucRef = useRef<InstancedMesh>(null);
  const mitoRef = useRef<InstancedMesh>(null);
  const ringRef = useRef<InstancedMesh>(null);
  const caRef = useRef<InstancedMesh>(null);
  const mgRef = useRef<InstancedMesh>(null);
  const kRef = useRef<InstancedMesh>(null);
  const waveRef = useRef<Mesh>(null);
  const paceRef = useRef<Mesh>(null);

  // Aşamaya göre: dalga aşamasında atım yavaşlar; kalsiyum ve enerji aşamalarında hücre içi görünür olur
  const rate = useEased(stage === 1 ? 0.45 : stage === 2 ? 0.6 : 1, 1.2);
  const reveal = useEased(stage === 2 || stage === 4 ? 1 : 0, 1.5);
  const sarcVis = useEased(stage === 2 || stage === 3 ? 1 : 0, 1.5);
  const energy = useEased(stage === 4 ? 1 : 0, 1.2);
  const waveGain = useEased(stage === 1 ? 1.6 : 0.8, 1.5);
  const caBoost = useEased(stage === 2 ? 1.5 : 1, 1.5);
  const clock = useRef({ last: 0, beat: 0 });

  const frame = useMemo<Frame>(
    () => ({
      a: tissue.cells.map(() => new Vector3()),
      dir: tissue.cells.map(() => new Vector3(1, 0, 0)),
      q: tissue.cells.map(() => new Quaternion()),
      len: new Float32Array(tissue.cells.length),
      bulge: new Float32Array(tissue.cells.length).fill(1),
      cum: new Float32Array(GRID_N),
    }),
    [tissue],
  );

  // Hücre içinin gösterildiği aşamalarda tıklama içteki yapılara (çekirdek, mitokondri, iyonlar) geçsin
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const cellRaycast = useMemo(
    () =>
      function (this: InstancedMesh, raycaster: Raycaster, hits: Intersection[]) {
        if (stageRef.current === 2 || stageRef.current === 4) return;
        InstancedMesh.prototype.raycast.call(this, raycaster, hits);
      },
    [],
  );

  useFrame(() => {
    const t = time.current;
    const ck = clock.current;
    let dt = t - ck.last;
    ck.last = t;
    if (dt < 0 || dt > 0.25) dt = 0;
    ck.beat += dt * rate.current;
    const tau = ck.beat % PERIOD;
    const amp = reducedMotion ? 0.05 : 0.1;

    // Kasılma haritası: F(x) = ∫₀ˣ (1 − amp·kasılma) ds  (orta nokta sabit, uçlar ortaya yaklaşır)
    const cum = frame.cum;
    let prev = 1 - amp * contraction(sinceWave(GX0, tau));
    cum[0] = 0;
    for (let k = 1; k < GRID_N; k++) {
      const s = 1 - amp * contraction(sinceWave(GX0 + k * GDX, tau));
      cum[k] = cum[k - 1]! + 0.5 * GDX * (prev + s);
      prev = s;
    }
    const zero = cum[(GRID_N - 1) / 2]!;
    const F = (x: number) => {
      const f = (x - GX0) / GDX;
      const i = Math.max(0, Math.min(GRID_N - 2, Math.floor(f)));
      const w = f - i;
      return cum[i]! + (cum[i + 1]! - cum[i]!) * w - zero;
    };

    // Elektrik dalgası
    const waveRefX = X0 + Math.min(1, tau / WAVE) * (X1 - X0);
    const waveVis = tau < WAVE ? 1 : Math.max(0, 1 - (tau - WAVE) / 0.12);
    const waveX = F(waveRefX);
    uniforms.uWaveX.value = waveX;
    uniforms.uWaveAmp.value = waveVis * waveGain.current;

    // Hücreler
    const cells = tissue.cells;
    const cm = cellRef.current;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      const a = frame.a[i]!.set(F(c.a.x), c.a.y, c.a.z);
      const d = frame.dir[i]!.set(F(c.b.x), c.b.y, c.b.z).sub(a);
      const len = d.length();
      d.divideScalar(len);
      frame.len[i] = len;
      // Hacim korunur: kısalan hücre biraz kalınlaşır
      const bulge = 1 / Math.sqrt(len / c.rest);
      frame.bulge[i] = bulge;
      frame.q[i]!.setFromUnitVectors(UP, d);
      if (cm) {
        P.copy(a).addScaledVector(d, len / 2);
        S.set(c.r * bulge, len - 0.02, c.r * bulge);
        M.compose(P, frame.q[i]!, S);
        cm.setMatrixAt(i, M);
      }
    }
    if (cm) {
      cm.instanceMatrix.needsUpdate = true;
      cm.boundingSphere = null;
    }
    cellMat.opacity = 0.86 - 0.4 * reveal.current;

    // Ara diskler ve oluklu bağlantılar (dalga geçerken parlar)
    const dm = discRef.current;
    const gm = gapRef.current;
    if (dm && gm) {
      tissue.discs.forEach((disc, i) => {
        const x = F(disc.p.x);
        const bulge = frame.bulge[disc.cell]!;
        const q = frame.q[disc.cell]!;
        P.set(x, disc.p.y, disc.p.z);
        S.set(disc.r * 1.1 * bulge, 0.035, disc.r * 1.1 * bulge);
        M.compose(P, q, S);
        dm.setMatrixAt(i, M);
        const dx = (x - waveX) / 0.45;
        const flash = Math.exp(-dx * dx) * waveVis;
        for (let j = 0; j < GAPS; j++) {
          const th = (j / GAPS) * Math.PI * 2 + i;
          const rr = disc.r * bulge * (0.3 + 0.35 * (j % 2));
          OFF.set(Math.cos(th) * rr, 0, Math.sin(th) * rr).applyQuaternion(q);
          P.set(x, disc.p.y, disc.p.z).add(OFF);
          S.setScalar(0.038 * (1 + 0.9 * flash));
          M.compose(P, Q.identity(), S);
          gm.setMatrixAt(i * GAPS + j, M);
          gm.setColorAt(i * GAPS + j, C.copy(GAP_DIM).lerp(GAP_LIT, Math.min(1, flash * 1.4)));
        }
      });
      dm.instanceMatrix.needsUpdate = true;
      gm.instanceMatrix.needsUpdate = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
      dm.boundingSphere = null;
      gm.boundingSphere = null;
    }

    // Çekirdekler (hücrenin ortasında) ve mitokondri sıraları
    const nm = nucRef.current;
    if (nm) {
      tissue.nuclei.forEach((at, i) => {
        attach(frame, cells, at.c, at.u, 0, 0, P);
        const b = frame.bulge[at.c]!;
        S.set(0.13 * b, 0.3 / (b * b), 0.13 * b);
        M.compose(P, frame.q[at.c]!, S);
        nm.setMatrixAt(i, M);
      });
      nm.instanceMatrix.needsUpdate = true;
      nm.boundingSphere = null;
    }
    const mm = mitoRef.current;
    if (mm) {
      tissue.mito.forEach((at, i) => {
        attach(frame, cells, at.c, at.u, at.th, at.rho, P);
        const b = frame.bulge[at.c]!;
        S.set(b, 1 / (b * b), b);
        M.compose(P, frame.q[at.c]!, S);
        mm.setMatrixAt(i, M);
      });
      mm.instanceMatrix.needsUpdate = true;
      mm.boundingSphere = null;
    }
    mitoMat.emissiveIntensity = 0.35 + 1.3 * energy.current;

    // Sarkomer halkaları (Z çizgileri): kasılmada birbirine yaklaşır
    const rm = ringRef.current;
    if (rm) {
      const vis = sarcVis.current;
      rm.visible = vis > 0.01;
      ringMat.opacity = 0.85 * vis;
      const fi = tissue.featured;
      const fc = cells[fi]!;
      const b = frame.bulge[fi]!;
      tissue.rings.forEach((l0, i) => {
        P.copy(frame.a[fi]!).addScaledVector(frame.dir[fi]!, (0.5 + l0 / fc.rest) * frame.len[fi]!);
        S.setScalar(fc.r * b * 1.04);
        M.compose(P, frame.q[fi]!, S);
        rm.setMatrixAt(i, M);
      });
      rm.instanceMatrix.needsUpdate = true;
      rm.boundingSphere = null;
    }

    // Kalsiyum kıvılcımları: dalga hücreye ulaşınca yanar, depoya geri pompalanınca söner
    const cam = caRef.current;
    if (cam) {
      cam.count = nCa;
      const boost = caBoost.current;
      for (let i = 0; i < nCa; i++) {
        const at = tissue.ca[i]!;
        const cell = cells[at.c]!;
        const l = sinceWave(cell.a.x + (cell.b.x - cell.a.x) * at.u, tau);
        const p = calciumPulse(l);
        if (p < 0.02) {
          cam.setMatrixAt(i, HIDE);
          continue;
        }
        const rho = at.k < 0.18 ? 1.3 - 0.55 * sstep(0, 0.1, l) : at.rho * (0.45 + 0.75 * sstep(0, 0.14, l));
        attach(frame, cells, at.c, at.u, at.th, rho, P);
        S.setScalar(0.034 * boost * (0.4 + 0.6 * p));
        M.compose(P, Q.identity(), S);
        cam.setMatrixAt(i, M);
      }
      cam.instanceMatrix.needsUpdate = true;
      cam.boundingSphere = null;
    }

    // Magnezyum (hücre içi) ve potasyum (hücre dışı)
    const mgm = mgRef.current;
    if (mgm) {
      mgm.count = nMg;
      for (let i = 0; i < nMg; i++) {
        const at = tissue.mg[i]!;
        attach(frame, cells, at.c, at.u + 0.012 * Math.sin(t * 2.3 + at.k), at.th + 0.15 * Math.sin(t * 1.7 + at.k * 2), at.rho, P);
        S.setScalar(0.03);
        M.compose(P, Q.identity(), S);
        mgm.setMatrixAt(i, M);
      }
      mgm.instanceMatrix.needsUpdate = true;
      mgm.boundingSphere = null;
    }
    const km = kRef.current;
    if (km) {
      km.count = nK;
      for (let i = 0; i < nK; i++) {
        const d = tissue.k[i]!;
        P.set(F(d.p.x) + 0.05 * Math.sin(t * 0.8 + d.ph * 3), d.p.y + 0.06 * Math.sin(t * 0.9 + d.ph), d.p.z + 0.06 * Math.cos(t * 0.7 + d.ph * 1.3));
        S.setScalar(0.036);
        M.compose(P, Q.identity(), S);
        km.setMatrixAt(i, M);
      }
      km.instanceMatrix.needsUpdate = true;
      km.boundingSphere = null;
    }

    // Dalga cephesi ve sinüs düğümü yönündeki uyarı kaynağı
    const wm = waveRef.current;
    if (wm) {
      wm.position.set(waveX, 0, 0);
      wm.visible = waveVis > 0.01;
      waveMat.opacity = 0.13 * waveVis * waveGain.current;
    }
    const pm = paceRef.current;
    if (pm) {
      const pulse = Math.exp(-tau * 9);
      pm.scale.setScalar(0.26 * (1 + 0.7 * pulse));
      paceMat.opacity = 0.2 + 0.65 * pulse;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.35} color="#ffd8dc" />
      <directionalLight position={[3, 5, 6]} intensity={1.1} />
      <Headlight intensity={2.6} distance={16} />
      <Tubes curves={tissue.caps} radius={0.1} material={capMat} onClick={pick('capillary')} segments={90} radial={10} />
      <CurveMovers curves={tissue.caps} count={RBC_MAX} shown={nRbc} geometry={rbcGeo} material={rbcMat} time={time} speed={0.05} size={0.17} flat onClick={pick('rbc')} />
      <Hoppers hops={tissue.o2} count={70} shown={scaled(40, o2, 70)} geometry={ionGeo} material={o2Mat} time={time} duration={2.4} size={0.03} seed={11} active={stage === 0 || stage === 4} onClick={pick('oxygen')} />
      <instancedMesh ref={nucRef} args={[nucGeo, nucMat, tissue.nuclei.length]} onClick={pick('nucleus')} frustumCulled={false} />
      <instancedMesh ref={mitoRef} args={[mitoGeo, mitoMat, tissue.mito.length]} onClick={pick('mitochondrion')} frustumCulled={false} />
      <instancedMesh ref={mgRef} args={[ionGeo, mgMat, MG_MAX]} onClick={pick('magnesium')} frustumCulled={false} />
      <instancedMesh ref={caRef} args={[ionGeo, caMat, CA_MAX]} onClick={pick('calcium')} frustumCulled={false} />
      <instancedMesh ref={kRef} args={[ionGeo, kMat, K_MAX]} onClick={pick('potassium')} frustumCulled={false} />
      <instancedMesh ref={discRef} args={[discGeo, discMat, tissue.discs.length]} onClick={pick('disc')} frustumCulled={false} />
      <instancedMesh ref={gapRef} args={[dotGeo, gapMat, tissue.discs.length * GAPS]} onClick={pick('gap')} frustumCulled={false} />
      <instancedMesh ref={cellRef} args={[cellGeo, cellMat, tissue.cells.length]} onClick={pick('cardiomyocyte')} raycast={cellRaycast} frustumCulled={false} renderOrder={2} />
      <instancedMesh
        ref={ringRef}
        args={[ringGeo, ringMat, tissue.rings.length]}
        onClick={pick('sarcomere')}
        raycast={instancedIfVisible}
        frustumCulled={false}
        renderOrder={3}
      />
      <mesh ref={waveRef} geometry={waveGeo} material={waveMat} onClick={pick('wave')} raycast={raycastIfVisible} renderOrder={4} />
      <mesh ref={paceRef} geometry={paceGeo} material={paceMat} position={[-7.25, 0, 0]} onClick={pick('wave')} renderOrder={4} />
    </group>
  );
}
