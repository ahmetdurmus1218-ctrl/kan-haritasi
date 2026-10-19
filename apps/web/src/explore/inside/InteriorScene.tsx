/**
 * "İÇİNE GİR" 3B sahnesi: tek bir genel motor, iç dünya tanımındaki SceneSpec'ten çizilir.
 *
 *   lumen      organın tüpünün/kesesinin İÇİNDEN bakış: astar (villus, kıvrım, haustra, rugae, sil…),
 *              içerik parçacıkları, peristaltik dalga, emilim/salgı/gaz değişimi; "duvar" odağında katman kesiti
 *   vessel     damar lümeni: alyuvarlar, nabız (atardamar) ya da sürekli akış (toplardamar), kılcalda tek sıra
 *   chambers   kalbin dört odacığı ve kapakları; kan yolu (sağ → akciğer → sol → aort) parçacıklarla
 *   parenchyma dolu organ: fonksiyonel birimler (lobül, nefron, folikül, nöron, asinus…) ve kanın girişten çıkışa akışı
 *   pathway    ses / ışık / hava yolu: istasyonlar ve ilerleyen sinyal
 *
 * Her şey prosedürel ve EĞİTİMSELDİR (normal anatomi/fizyoloji); kişinin görüntüsü değildir. Modlar ve odak
 * yalnızca tanımdan gelir, kişinin verisinden türetilmez.
 *
 * Sahne 3B vücut keşfinin (Explorer) tuvalinde, aynı kamera denetimiyle çizilir: "İçine gir" ile kamera
 * organa dalar, perde açılınca iç dünyaya GİRİŞ çekiminden (dışarıdan / derinden) bu basamağın çekimine
 * animasyonla gider. Basamak değişince kamera yeni odağa hareket eder; başka bir seviyeye geçilirken
 * (duvar, doku…) perde kapanmadan önce kamera o yöne yaklaşır, geri dönülürken uzaklaşır. Nesne sahneleri
 * (odacık, parankim, yol, duvar kesiti) görünür alana — panelin kapatmadığı kısma — sığdırılır.
 */
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { type CameraControlsImpl, Html } from '@react-three/drei';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  FrontSide,
  type InstancedMesh,
  type Mesh,
  MeshStandardMaterial,
  Object3D,
  type PerspectiveCamera,
  Plane,
  Quaternion,
  Matrix4,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { InteriorMode, SceneFocus, SceneSpec } from '@kh/analysis';
import { partDef, structureById } from '@kh/catalog';
import { Headlight, bumpySphere, rbcGeometry, rng, useAtmosphere, useDisposable } from './kit';
import type { ModelPart } from '../../anatomy/models';
import { PART_OPACITY } from '../../anatomy/palette';
import { type TissueMaterial, contentLook, createTissueMaterial, lumenLook, setTissueCut, tissueLook } from '../../anatomy/tissue';
import { hasEpicardialFat, studioGeometry, useStudioVersion } from '../../anatomy/studio';
import { type AtlasSectionDef, type PartRef, LABEL_TR, VIEW_DIR, matchesRef, splitRef } from './atlas';

/** Görünür alan: tuval boyutu ve panelin sağdan/alttan kapattığı piksel. */
export interface WorldView {
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/**
 * Seviyeler arası geçiş: 'in' = daha derine (duvar, doku…) geçilmek üzere, kamera o yöne yaklaşır;
 * 'out' = yukarı (organın dışına) çıkılmak üzere, kamera uzaklaşır.
 */
export type Leaving = 'in' | 'out' | null;
/** Sahneye giriş çekimi: 'outside' = organın dışından içeri; 'deeper' = daha derin bir seviyeden geri dönüş. */
export type Entry = 'outside' | 'deeper';

export interface InteriorWorldProps {
  spec: SceneSpec;
  focus: SceneFocus;
  /** 0–1: iç dünyada ne kadar ilerlendi (İlerle → kamera lümende ileri gider). */
  progress: number;
  /** Duvar kesiti (duvar ve doku seviyesi). */
  wall: boolean;
  mode?: InteriorMode;
  /** Duvar katmanları (lümenden dışa / yüzeyden derine). */
  layers?: Array<{ id: string; name: string }>;
  highlightLayer?: number;
  /** Akış yolu istasyon sayısı (kalp, kulak, göz, hava). */
  stations?: number;
  playing: boolean;
  reducedMotion: boolean;
  entry: Entry;
  leaving: Leaving;
  view: WorldView;
  /** Kadraja alınan nesnenin küresi (uçtan uca testte ekrana sığma denetimi); lümen içinde null. */
  onSubject?: (s: { center: [number, number, number]; radius: number } | null) => void;
  /** Bu basamak gerçek insan atlas ağlarının kesitiyle çizilir (parçalar yüklendiyse). */
  atlas?: { def: AtlasSectionDef; stage: string; parts: ModelPart[] };
  /** Vurgu rengi (seçili bölüm). */
  accent?: string;
}

const TMP = new Object3D();
const V = new Vector3();

/** Lümen içinde geniş açı (endoskop hissi); nesne sahnelerinde dar açı. 3B vücut 35° ile çizilir. */
export const WORLD_FOV = { lumen: 62, object: 38, body: 35 } as const;

/** Yoğunluk/hareket varsayılanları (mod yoksa): tipik normal işleyiş. */
const DEFAULT_MODE: InteriorMode = { id: 'normal', name: 'Normal', text: '', content: 0.6, motion: 0.6, digestion: 0.3, absorption: 0 };

const WorldContext = createContext<{ view: WorldView; entry: Entry; leaving: Leaving; reducedMotion: boolean; progress: number; onSubject?: InteriorWorldProps['onSubject'] }>({
  view: { width: 1, height: 1, right: 0, bottom: 0 },
  progress: 0,
  entry: 'outside',
  leaving: null,
  reducedMotion: false,
});

function useClock(playing: boolean, reducedMotion: boolean) {
  const t = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const live = useRef(playing);
  live.current = playing;
  useFrame((_, dt) => {
    if (!live.current) return;
    t.current += Math.min(dt, 0.05) * (reducedMotion ? 0.3 : 1);
    invalidate();
  });
  useEffect(() => invalidate(), [playing, invalidate]);
  return t;
}

interface Pose {
  eye: Vector3;
  target: Vector3;
  /** Odak kaydırması (kamera uzayı): panelin kapattığı alanı dengeler. */
  offset?: [number, number];
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Küreyi panelin kapatmadığı görünür alana sığdıran çekim (ekran oranı, dikey/yatay, alttan/yandan panel).
 * Mesafe dikey ve yatay görüş açısından küçük olana göre hesaplanır; odak kaydırması nesneyi görünür
 * alanın ortasına taşır. Böylece telefonda dikey ekranda da model ekran dışına taşmaz.
 */
export function fitPose(center: Vector3, radius: number, dir: Vector3, view: WorldView, fov: number = WORLD_FOV.object, margin = 1.08): Pose {
  const aspect = view.width / Math.max(1, view.height);
  const vt = Math.tan((fov * Math.PI) / 360);
  const fh = clamp((view.height - view.bottom) / Math.max(1, view.height), 0.4, 1);
  const fw = clamp((view.width - view.right) / Math.max(1, view.width), 0.4, 1);
  const t = Math.min(vt * fh, vt * aspect * fw);
  const dist = (radius / Math.sin(Math.atan(t))) * margin;
  const visibleH = 2 * dist * vt;
  const visibleW = visibleH * aspect;
  return {
    eye: center.clone().addScaledVector(dir.clone().normalize(), dist),
    target: center.clone(),
    offset: [(visibleW * view.right) / Math.max(1, view.width) / 2, (visibleH * view.bottom) / Math.max(1, view.height) / 2],
  };
}

/** Geçiş öncesi kamera: derine inerken hedefe yaklaşır, yukarı çıkarken geri çekilir. */
function leavingPose(p: Pose, leaving: Leaving): Pose {
  if (!leaving) return p;
  const d = p.eye.clone().sub(p.target);
  return { eye: p.target.clone().addScaledVector(d, leaving === 'in' ? 0.28 : 2.4), target: p.target, offset: p.offset };
}

/**
 * Kamera yönetimi (CameraControls): sahne açılınca giriş çekimine anında yerleşir, sonra bu basamağın
 * çekimine animasyonla gider; anahtar değişince (yeni basamak / geçiş) yine animasyonla gider.
 */
function useWorldCamera(pose: Pose, key: string, entry: Pose | null, fov: number) {
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const placed = useRef(false);
  useEffect(() => {
    const prev = camera.fov;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    invalidate();
    return () => {
      camera.fov = prev === fov ? WORLD_FOV.body : prev;
      camera.updateProjectionMatrix();
    };
  }, [camera, fov, invalidate]);
  useEffect(() => {
    const [ox, oy] = pose.offset ?? [0, 0];
    if (!controls || typeof controls.setLookAt !== 'function') {
      camera.position.copy(pose.eye);
      camera.lookAt(pose.target);
      invalidate();
      return;
    }
    controls.minDistance = 0.01;
    controls.maxDistance = 30;
    if (!placed.current) {
      placed.current = true;
      const e = entry ?? pose;
      void controls.setFocalOffset(ox, oy, 0, false);
      void controls.setLookAt(e.eye.x, e.eye.y, e.eye.z, e.target.x, e.target.y, e.target.z, false);
    }
    void controls.setFocalOffset(ox, oy, 0, true);
    void controls.setLookAt(pose.eye.x, pose.eye.y, pose.eye.z, pose.target.x, pose.target.y, pose.target.z, true);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, controls]);
}

/** Nesne sahnelerinin kadrajı: görünür alana sığdırılır; giriş dışarıdan (uzaktan) ya da derinden (yakından). */
function useFitted(center: Vector3, radius: number, dir: Vector3, key: string) {
  const { view, entry, leaving, onSubject, progress } = useContext(WorldContext);
  // Bölge basamakları (progress > 1): her bölgede kamera nesnenin etrafında başka bir açıya döner.
  const orbit = progress > 1 ? (progress - 1) * 4 * 0.6 : 0;
  const d0 = orbit ? dir.clone().applyAxisAngle(new Vector3(0, 1, 0), orbit) : dir;
  const base = fitPose(center, radius, d0, view);
  const pose = leavingPose(base, leaving);
  const d = base.eye.clone().sub(base.target);
  const entryPose: Pose = { eye: base.target.clone().addScaledVector(d, entry === 'outside' ? 3.2 : 0.3), target: base.target, offset: base.offset };
  useWorldCamera(pose, `${key}|${orbit.toFixed(2)}|${leaving ?? ''}|${view.width}x${view.height}|${view.right},${view.bottom}`, entryPose, WORLD_FOV.object);
  const subjectKey = `${center.toArray().map((x) => x.toFixed(2)).join()}|${radius.toFixed(2)}`;
  useEffect(() => {
    onSubject?.({ center: center.toArray() as [number, number, number], radius });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKey, onSubject]);
}

/* ================================================================== LÜMEN (organ/damar içi) */

interface LumenSpec {
  shape: 'tube' | 'sac' | 'canal';
  lining: string;
  content: string;
  radius: number;
  wave: number;
  flow: number;
  color: string;
  pulse?: boolean;
}

const LENGTH = 14;
const TUBULAR = 180;
const RADIAL = 40;

function lumenCurve(shape: LumenSpec['shape']): CatmullRomCurve3 {
  const len = shape === 'sac' ? 6 : LENGTH;
  const pts = Array.from({ length: 7 }, (_, i) => new Vector3(Math.sin(i * 1.3) * (shape === 'sac' ? 0.15 : 0.9), Math.cos(i * 0.9) * (shape === 'sac' ? 0.1 : 0.5), -i * (len / 6)));
  return new CatmullRomCurve3(pts);
}

/** Yarıçap profili: şekil × astar deseni × peristaltik dalga (s: 0–1 boy, th: açı). */
function radiusAt(sp: LumenSpec, s: number, th: number, t: number, motion: number): number {
  return Math.max(sp.radius * 0.2, staticRadius(sp, s, th) * waveFactor(sp, s, t, motion));
}

/** Zamanla değişmeyen kısım: şekil ve astar deseni (köşe başına bir kez hesaplanır). */
function staticRadius(sp: LumenSpec, s: number, th: number): number {
  let r = sp.radius;
  if (sp.shape === 'sac') r *= 0.32 + 0.68 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, s))), 0.55);
  const L = sp.shape === 'sac' ? 6 : LENGTH;
  switch (sp.lining) {
    case 'villi':
    case 'folds':
      r *= 1 - 0.11 * Math.pow(Math.abs(Math.sin(s * L * 2.6)), 8);
      break;
    case 'haustra':
      r *= 1 + 0.1 * Math.pow(Math.abs(Math.sin(s * L * 1.1)), 2) - 0.16 * Math.pow(Math.abs(Math.cos(s * L * 1.1)), 14);
      break;
    case 'rugae':
      r *= 1 - 0.1 * Math.pow(Math.abs(Math.sin(th * 7 + s * 5)), 6);
      break;
    case 'trabeculae':
      r *= 1 - 0.07 * Math.pow(Math.abs(Math.sin(th * 5 + s * L * 2)), 4) - 0.05 * Math.pow(Math.abs(Math.sin(th * 11 - s * L * 3)), 6);
      break;
    default:
      r *= 1 + 0.025 * Math.sin(th * 9 + s * 30) * Math.sin(s * 17);
  }
  return r;
}

/** Zamanla değişen kısım: peristaltik dalga ya da nabız — yalnızca boy konumuna (s) bağlı, halka başına bir kez. */
function waveFactor(sp: LumenSpec, s: number, t: number, motion: number): number {
  if (sp.pulse) return 1 + 0.07 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * (t * 1.1 - s * 1.5))), 3);
  if (sp.wave > 0) {
    const squeeze = Math.pow(Math.max(0, Math.sin(2 * Math.PI * (s * (sp.shape === 'sac' ? 1.5 : 3) - t * 0.22))), 6);
    return 1 - sp.wave * motion * 0.38 * squeeze;
  }
  return 1;
}

const CONTENT: Record<string, { color: string; size: [number, number]; opacity: number; geo: 'blob' | 'sphere' | 'rbc' | 'long' }> = {
  chyme: { color: '#d9b26a', size: [0.06, 0.14], opacity: 0.9, geo: 'blob' },
  bolus: { color: '#d2a46f', size: [0.08, 0.3], opacity: 0.95, geo: 'blob' },
  saliva: { color: '#e7eef3', size: [0.03, 0.07], opacity: 0.45, geo: 'sphere' },
  feces: { color: '#5e3d23', size: [0.06, 0.15], opacity: 0.95, geo: 'blob' },
  bile: { color: '#7fa04a', size: [0.03, 0.07], opacity: 0.7, geo: 'sphere' },
  juice: { color: '#efe0a6', size: [0.03, 0.06], opacity: 0.6, geo: 'sphere' },
  air: { color: '#ffffff', size: [0.015, 0.04], opacity: 0.35, geo: 'sphere' },
  urine: { color: '#e9cf59', size: [0.03, 0.06], opacity: 0.5, geo: 'sphere' },
  blood: { color: '#c0272d', size: [0.09, 0.11], opacity: 1, geo: 'rbc' },
  mucus: { color: '#f2efe4', size: [0.05, 0.12], opacity: 0.5, geo: 'long' },
  fluid: { color: '#9cc7e0', size: [0.02, 0.05], opacity: 0.45, geo: 'sphere' },
  sperm: { color: '#f3efe6', size: [0.03, 0.05], opacity: 0.9, geo: 'long' },
  none: { color: '#ffffff', size: [0.02, 0.03], opacity: 0.2, geo: 'sphere' },
};

interface Particle {
  s: number;
  th: number;
  rho: number;
  size: number;
  role: 'flow' | 'absorb' | 'secrete' | 'o2' | 'co2';
  speed: number;
}

/**
 * Düzenli ızgaranın (halka × çevre) normalleri: komşu köşelerin farkından (merkezi fark), üçgen dolaşma
 * yönüyle aynı yönde. computeVertexNormals'ın kare başına maliyeti olmadan aynı yumuşak sonuç; çevrede
 * ek yeri yok.
 */
function gridNormals(g: BufferGeometry, rings: number, radial: number) {
  const p = (g.attributes.position as BufferAttribute).array as Float32Array;
  let na = g.attributes.normal as BufferAttribute | undefined;
  if (!na) {
    na = new BufferAttribute(new Float32Array(p.length), 3);
    g.setAttribute('normal', na);
  }
  const n = na.array as Float32Array;
  const row = radial + 1;
  for (let i = 0; i <= rings; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(rings, i + 1);
    for (let j = 0; j <= radial; j++) {
      const jm = j === 0 ? radial - 1 : j - 1;
      const jp = j === radial ? 1 : j + 1;
      const a = (i1 * row + j) * 3;
      const b = (i0 * row + j) * 3;
      const c = (i * row + jp) * 3;
      const d = (i * row + jm) * 3;
      const ux = p[a]! - p[b]!;
      const uy = p[a + 1]! - p[b + 1]!;
      const uz = p[a + 2]! - p[b + 2]!;
      const vx = p[c]! - p[d]!;
      const vy = p[c + 1]! - p[d + 1]!;
      const vz = p[c + 2]! - p[d + 2]!;
      let x = uy * vz - uz * vy;
      let y = uz * vx - ux * vz;
      let z = ux * vy - uy * vx;
      const l = Math.hypot(x, y, z) || 1;
      x /= l;
      y /= l;
      z /= l;
      const o = (i * row + j) * 3;
      n[o] = x;
      n[o + 1] = y;
      n[o + 2] = z;
    }
  }
  na.needsUpdate = true;
}

function LumenView({ sp, focus, mode, time, progress }: { sp: LumenSpec; focus: SceneFocus; mode: InteriorMode; time: { current: number }; progress: number }) {
  const { entry, leaving, onSubject } = useContext(WorldContext);
  const curve = useMemo(() => lumenCurve(sp.shape), [sp.shape]);
  const frames = useMemo(() => curve.computeFrenetFrames(TUBULAR, false), [curve]);
  const centers = useMemo(() => Array.from({ length: TUBULAR + 1 }, (_, i) => curve.getPointAt(i / TUBULAR)), [curve]);
  const wall = useDisposable(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array((TUBULAR + 1) * (RADIAL + 1) * 3);
    const idx: number[] = [];
    for (let i = 0; i < TUBULAR; i++)
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = (i + 1) * (RADIAL + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }, [curve]);
  // Islak mukoza: parlak sıvı film, mukozanın altından görünen damar ağı, astara göre yüzey dokusu (tissue.ts).
  const wallMat = useDisposable(() => {
    const m = createTissueMaterial(lumenLook(sp.lining, sp.color));
    m.side = DoubleSide;
    return m;
  }, [sp.color, sp.lining]);

  const cfg = CONTENT[sp.content] ?? CONTENT.none!;
  const n = sp.content === 'none' ? 0 : sp.content === 'bolus' ? 14 : Math.round(30 + 170 * mode.content);
  const particles = useMemo<Particle[]>(() => {
    const r = rng(7);
    return Array.from({ length: Math.max(n, 1) }, (_, k) => ({
      s: 0.14 + r() * 0.83,
      th: r() * Math.PI * 2,
      rho: Math.sqrt(r()) * 0.75,
      size: cfg.size[0] + r() * (cfg.size[1] - cfg.size[0]) * (sp.content === 'bolus' && k === 0 ? 3 : 1),
      role: 'flow',
      speed: 0.6 + r() * 0.8,
    }));
  }, [n, cfg.size, sp.content]);
  const pGeo = useDisposable(() => (cfg.geo === 'rbc' ? rbcGeometry(20) : cfg.geo === 'blob' ? bumpySphere(3, 0.18, 3) : cfg.geo === 'long' ? new CapsuleGeometry(0.5, 1.6, 3, 8) : new SphereGeometry(1, 14, 10)), [cfg.geo]);
  const pMat = useDisposable(() => {
    const m = createTissueMaterial(contentLook(sp.content));
    m.transparent = cfg.opacity < 1;
    m.opacity = cfg.opacity;
    return m;
  }, [cfg.opacity, sp.content]);
  const pRef = useRef<InstancedMesh>(null);

  // Ek parçacıklar: emilen (yeşil), salgılanan (sarı), gaz değişimi (O₂ kırmızı, CO₂ mavi)
  const extraN = 60;
  const extras = useMemo<Particle[]>(() => {
    const r = rng(11);
    return Array.from({ length: extraN }, (_, k) => ({ s: 0.05 + r() * 0.5, th: r() * Math.PI * 2, rho: r(), size: 0.035 + r() * 0.03, role: k % 2 ? 'o2' : 'co2', speed: 0.5 + r() }));
  }, []);
  const eRef = useRef<InstancedMesh>(null);
  const eGeo = useDisposable(() => new SphereGeometry(1, 8, 6));
  const eMat = useDisposable(() => new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.4 }));

  // Astar: villus (ince bağırsak) ya da sil (solunum yolu, tüp)
  const liningN = sp.lining === 'villi' ? 2200 : sp.lining === 'cilia' ? 1800 : 0;
  const lining = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: liningN }, () => ({ s: 0.02 + r() * 0.96, th: r() * Math.PI * 2, len: 0.7 + r() * 0.6, ph: r() * 6.28 }));
  }, [liningN]);
  const lGeo = useDisposable(() => (sp.lining === 'villi' ? new CapsuleGeometry(0.022, 0.1, 3, 6).translate(0, 0.072, 0) : new CylinderGeometry(0.004, 0.006, 0.07, 3).translate(0, 0.035, 0)), [sp.lining]);
  const lMat = useDisposable(() => {
    const l = lumenLook(sp.lining, `#${new Color(sp.color).offsetHSL(0.01, 0.05, 0.1).getHexString()}`);
    return createTissueMaterial({ ...l, veinAmount: 0, bump: 0.05 });
  }, [sp.color, sp.lining]);
  const lRef = useRef<InstancedMesh>(null);

  const frameAt = (s: number) => {
    const i = Math.min(TUBULAR, Math.max(0, Math.round(s * TUBULAR)));
    return { c: centers[i]!, nn: frames.normals[i]!, bb: frames.binormals[i]! };
  };
  const pointAt = (s: number, th: number, rad: number, out: Vector3) => {
    const { c, nn, bb } = frameAt(s);
    return out.copy(c).addScaledVector(nn, Math.cos(th) * rad).addScaledVector(bb, Math.sin(th) * rad);
  };

  // Kare başına iş az olsun diye zamanla değişmeyen her şey bir kez hesaplanır: halka merkezi, köşenin
  // radyal yönü ve astar deseninin yarıçapı; villus/silin merkeze bakan yönelimi. Her karede yalnızca halka
  // başına peristaltik dalga (s'ye bağlı) çarpılır. Sonuç önceki hesapla birebir aynıdır.
  const grid = useMemo(() => {
    const n = (TUBULAR + 1) * (RADIAL + 1);
    const center = new Float32Array(n * 3);
    const dir = new Float32Array(n * 3);
    const stat = new Float32Array(n);
    for (let i = 0; i <= TUBULAR; i++) {
      const s = i / TUBULAR;
      const c = centers[i]!;
      const nn = frames.normals[i]!;
      const bb = frames.binormals[i]!;
      for (let j = 0; j <= RADIAL; j++) {
        const th = (j / RADIAL) * Math.PI * 2;
        const k = i * (RADIAL + 1) + j;
        center.set([c.x, c.y, c.z], k * 3);
        dir.set([nn.x * Math.cos(th) + bb.x * Math.sin(th), nn.y * Math.cos(th) + bb.y * Math.sin(th), nn.z * Math.cos(th) + bb.z * Math.sin(th)], k * 3);
        stat[k] = staticRadius(sp, s, th);
      }
    }
    return { center, dir, stat, wave: new Float32Array(TUBULAR + 1) };
  }, [centers, frames, sp]);
  const liningPose = useMemo(
    () =>
      lining.map((v) => {
        const i = Math.min(TUBULAR, Math.max(0, Math.round(v.s * TUBULAR)));
        pointAt(v.s, v.th, 1, V);
        const d = V.clone().sub(centers[i]!).normalize();
        // Merkeze bakan yönelim (lookAt) sabittir; her karede yalnızca sallanma açısı eklenir.
        TMP.position.copy(centers[i]!).addScaledVector(d, staticRadius(sp, v.s, v.th));
        TMP.up.set(0, 1, 0);
        TMP.lookAt(centers[i]!);
        return { ring: i, c: centers[i]!, d, stat: staticRadius(sp, v.s, v.th), q: TMP.quaternion.clone(), sc: (sp.radius / 0.9) * v.len, ph: v.ph };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lining, centers, sp],
  );
  const QX = useMemo(() => ({ q: new Quaternion(), x: new Vector3(1, 0, 0), m: new Matrix4(), s: new Vector3() }), []);

  const color = useMemo(() => new Color(), []);
  useFrame(() => {
    const t = time.current;
    const motion = mode.motion;
    // Duvar: halka başına dalga × köşenin sabit yarıçapı, radyal yön boyunca.
    const minR = sp.radius * 0.2;
    for (let i = 0; i <= TUBULAR; i++) grid.wave[i] = waveFactor(sp, i / TUBULAR, t, motion);
    const pos = wall.attributes.position as BufferAttribute;
    const pa = pos.array as Float32Array;
    const { center, dir, stat, wave } = grid;
    for (let i = 0, k = 0; i <= TUBULAR; i++) {
      const w = wave[i]!;
      for (let j = 0; j <= RADIAL; j++, k++) {
        const r = Math.max(minR, stat[k]! * w);
        const o = k * 3;
        pa[o] = center[o]! + dir[o]! * r;
        pa[o + 1] = center[o + 1]! + dir[o + 1]! * r;
        pa[o + 2] = center[o + 2]! + dir[o + 2]! * r;
      }
    }
    pos.needsUpdate = true;
    gridNormals(wall, TUBULAR, RADIAL);
    // Astar: sabit yönelim × sallanma; konum dalgayla.
    const lm = lRef.current;
    if (lm) {
      const cil = sp.lining === 'cilia';
      for (let k = 0; k < liningPose.length; k++) {
        const v = liningPose[k]!;
        const R = Math.max(minR, v.stat * wave[v.ring]!) * 0.995;
        V.copy(v.c).addScaledVector(v.d, R);
        QX.q.setFromAxisAngle(QX.x, Math.PI / 2 + Math.sin(t * (cil ? 9 : 1.4) + v.ph) * (cil ? 0.5 : 0.12)).premultiply(v.q);
        QX.m.compose(V, QX.q, QX.s.set(v.sc, v.sc, v.sc));
        lm.setMatrixAt(k, QX.m);
      }
      lm.instanceMatrix.needsUpdate = true;
    }
    // İçerik
    const pm = pRef.current;
    const absorbing = focus === 'absorb' ? 0.45 : mode.absorption * 0.3;
    if (pm) {
      particles.forEach((p, k) => {
        const forward = sp.flow * 0.035 * p.speed * (0.4 + motion * 0.9);
        p.s += forward * 0.016 * (1 + (sp.pulse ? Math.max(0, Math.sin(2 * Math.PI * t * 1.1)) * 2 : 0));
        p.th += Math.sin(t * 0.7 + k) * 0.002 * (1 + motion * 3);
        const absorbingHere = k / particles.length < absorbing;
        if (absorbingHere) p.rho = Math.min(1.05, p.rho + 0.002 * p.speed);
        if (p.s > 0.97 || p.rho > 1.02) {
          p.s = 0.14 + (k % 7) * 0.01;
          p.rho = ((k * 37) % 100) / 140;
        }
        const R = radiusAt(sp, p.s, p.th, t, motion);
        pointAt(p.s, p.th, p.rho * R * 0.85, V);
        TMP.position.copy(V);
        TMP.rotation.set(t * 0.3 + k, k, t * 0.2);
        const digest = sp.content === 'chyme' ? 1 - mode.digestion * 0.55 * p.s : 1;
        const sc = p.size * digest * (absorbingHere ? Math.max(0.3, 1.1 - p.rho * 0.7) : 1);
        // Dışkı yumrukları biraz uzun (bağırsak boyunca sıkışmış parçalar)
        TMP.scale.set(sc * (sp.content === 'feces' ? 1.5 : 1), sc, sc);
        TMP.updateMatrix();
        pm.setMatrixAt(k, TMP.matrix);
        color.set(absorbingHere ? '#7ee0b0' : cfg.color);
        pm.setColorAt(k, color);
      });
      pm.instanceMatrix.needsUpdate = true;
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }
    // Ek parçacıklar: salgı ya da gaz değişimi
    const em = eRef.current;
    if (em) {
      const showExchange = focus === 'exchange';
      const showSecrete = focus === 'secrete';
      extras.forEach((p, k) => {
        if (!showExchange && !showSecrete) {
          TMP.scale.setScalar(0);
        } else {
          const phase = (t * 0.25 * p.speed + k / extraN) % 1;
          // O₂: lümenden duvara; CO₂: duvardan lümene; salgı: duvardan lümene
          const rho = showSecrete || p.role === 'co2' ? 1 - phase * 0.7 : 0.3 + phase * 0.75;
          const R = radiusAt(sp, p.s, p.th, t, mode.motion);
          pointAt(p.s, p.th, rho * R, V);
          TMP.position.copy(V);
          TMP.scale.setScalar(p.size * (sp.radius / 0.9));
          color.set(showSecrete ? '#f6d36b' : p.role === 'o2' ? '#ff5a5f' : '#5b8cff');
          em.setColorAt(k, color);
        }
        TMP.updateMatrix();
        em.setMatrixAt(k, TMP.matrix);
      });
      em.instanceMatrix.needsUpdate = true;
      if (em.instanceColor) em.instanceColor.needsUpdate = true;
    }
  });

  // Kamera: lümenin İÇİNDE. "İlerle" ile tüp boyunca ileri gider (progress); odakla bakış değişir
  // (merkez, içerik, duvara yakın emilim/salgı). Genel bakış (bölümler) geride, uzağa bakar.
  const R = sp.radius;
  const near = focus === 'absorb' || focus === 'secrete' || focus === 'exchange';
  const overview = focus === 'overview' || focus === 'flow';
  const s0 = Math.min(0.62, 0.05 + progress * 0.5 + (focus === 'motion' ? -0.02 : 0));
  const pose: Pose = near
    ? { eye: pointAt(s0, Math.PI * 0.5, R * 0.55, new Vector3()), target: pointAt(s0 + 0.06, Math.PI * 0.5, R * 0.9, new Vector3()) }
    : overview
      ? { eye: pointAt(Math.max(0.02, s0 - 0.04), Math.PI * 0.5, R * 0.25, new Vector3()), target: pointAt(Math.min(0.97, s0 + 0.4), 0, 0, new Vector3()) }
      : { eye: pointAt(s0, Math.PI * 0.5, R * 0.1, new Vector3()), target: pointAt(s0 + (focus === 'contents' ? 0.12 : 0.26), 0, 0, new Vector3()) };
  // Duvara yaklaşma (derine geçiş) ve tüpün ağzından dışarı çıkış (yukarı geçiş)
  const toWall: Pose = { eye: pointAt(s0 + 0.02, Math.PI * 0.5, R * 0.86, new Vector3()), target: pointAt(s0 + 0.035, Math.PI * 0.5, R * 1.1, new Vector3()) };
  const mouth = centers[0]!.clone();
  const outward = mouth.clone().sub(centers[Math.round(TUBULAR * 0.08)]!).normalize();
  const outside: Pose = { eye: mouth.clone().addScaledVector(outward, R * 3.2), target: mouth.clone().addScaledVector(outward, -R) };
  const entryPose = entry === 'deeper' ? toWall : outside;
  useWorldCamera(leaving === 'in' ? toWall : leaving === 'out' ? outside : pose, `${focus}|${progress.toFixed(3)}|${leaving ?? ''}|${sp.shape}|${R}`, entryPose, WORLD_FOV.lumen);
  useEffect(() => onSubject?.(null), [onSubject]);

  return (
    <group>
      <mesh geometry={wall} material={wallMat} />
      {liningN > 0 && <instancedMesh ref={lRef} args={[lGeo, lMat, liningN]} frustumCulled={false} />}
      {n > 0 && <instancedMesh ref={pRef} args={[pGeo, pMat, particles.length]} frustumCulled={false} />}
      <instancedMesh ref={eRef} args={[eGeo, eMat, extraN]} frustumCulled={false} />
    </group>
  );
}

/* ================================================================== DUVAR KESİTİ */

const LAYER_COLORS = ['#20151a', '#f1ece0', '#e6a0a0', '#d98b8b', '#e4c0a8', '#b9545c', '#efe4d8', '#cfa0b0', '#a87f6a'];

const WALL_AT = new Vector3(0, -0.3, -3.2);

function WallSection({ layers, highlight, time }: { layers: Array<{ id: string; name: string }>; highlight?: number; time: { current: number } }) {
  const shown = layers.filter((l, i) => !(i === 0 && /lümen|boşluk/i.test(l.name)));
  const offset = layers.length - shown.length;
  const { geos, radii } = useMemo(() => {
    let r = 0.6;
    const radii: Array<[number, number]> = [];
    const geos = shown.map((_, i) => {
      const th = i === 0 ? 0.08 : 0.16 + (i % 3) * 0.06;
      const inner = r;
      const outer = r + th;
      radii.push([inner, outer]);
      r = outer + 0.015;
      const sh = new Shape();
      sh.absarc(0, 0, outer, 0, Math.PI, false);
      sh.absarc(0, 0, inner, Math.PI, 0, true);
      return new ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false, curveSegments: 48 });
    });
    return { geos, radii };
  }, [shown.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  const group = useRef<import('three').Group>(null);
  // Kadraj: bütün kesit; doku seviyesinde vurgulanan katmana yaklaşılır (ölçek büyür).
  const outer = radii.at(-1)?.[1] ?? 1.5;
  const hi = highlight !== undefined ? highlight - offset : -1;
  const layer = hi >= 0 ? radii[hi] : undefined;
  const center = layer ? WALL_AT.clone().add(new Vector3(0, (layer[0] + layer[1]) / 2, 0)) : WALL_AT.clone().add(new Vector3(0, outer * 0.45, 0));
  useFitted(center, layer ? Math.max(0.35, (layer[1] - layer[0]) * 2.2) : outer * 1.15, new Vector3(0, 0.35, 1), `wall${hi}`);
  useFrame(() => {
    if (group.current) group.current.rotation.y = -0.5 + Math.sin(time.current * 0.3) * 0.25;
  });
  return (
    <group ref={group} rotation={[0, -0.5, 0]} position={[0, -0.3, -3.2]}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0, -0.8]}>
          <meshStandardMaterial color={LAYER_COLORS[(i + 1) % LAYER_COLORS.length]} roughness={0.6} emissive={highlight === i + offset ? '#ffd27a' : '#000000'} emissiveIntensity={highlight === i + offset ? 0.55 : 0} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== KALP ODACIKLARI */

const CH = {
  ra: new Vector3(-0.75, 0.45, 0),
  rv: new Vector3(-0.45, -0.5, 0.25),
  la: new Vector3(0.7, 0.55, -0.25),
  lv: new Vector3(0.45, -0.55, 0),
};
const HEART_PATH = [
  new Vector3(-1.5, 1.3, 0),
  CH.ra,
  new Vector3(-0.62, -0.05, 0.15),
  CH.rv,
  new Vector3(-0.15, 0.3, 0.45),
  new Vector3(0, 1.1, 0.4),
  new Vector3(0.5, 1.6, 0),
  new Vector3(1.2, 1.2, -0.3),
  CH.la,
  new Vector3(0.6, 0.0, -0.1),
  CH.lv,
  new Vector3(0.15, 0.25, 0.1),
  new Vector3(0.05, 1.25, -0.1),
  new Vector3(-0.35, 1.45, -0.35),
  new Vector3(-0.3, 0.6, -0.7),
];
/** Yoldaki 9 istasyon: RA, triküspit, RV, pulmoner, akciğer, LA, mitral, LV, aort → eğri üzerindeki noktalar. */
const STATION_PT = [1, 2, 3, 4, 6, 8, 9, 10, 12];

function ChambersView({ focus, time }: { focus: SceneFocus; time: { current: number } }) {
  const curve = useMemo(() => new CatmullRomCurve3(HEART_PATH), []);
  const stationU = useMemo(() => STATION_PT.map((i) => i / (HEART_PATH.length - 1)), []);
  const blob = useDisposable(() => bumpySphere(2, 0.05, 2));
  const valveGeo = useDisposable(() => new TorusGeometry(0.11, 0.025, 8, 24));
  const n = 140;
  const pRef = useRef<InstancedMesh>(null);
  const pGeo = useDisposable(() => rbcGeometry(16));
  const pMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.5 }));
  const vessel = useDisposable(() => new TubeGeometry(curve, 200, 0.06, 8, false));
  const vMat = useDisposable(() => new MeshStandardMaterial({ color: '#8e2b33', transparent: true, opacity: 0.25, side: DoubleSide }));
  const chambers = useRef<Mesh[]>([]);
  const active = focus.startsWith('path:') ? Number(focus.slice(5)) : -1;
  const color = useMemo(() => new Color(), []);
  useFrame(() => {
    const t = time.current;
    const beat = (t * 1.15) % 1;
    const sys = beat < 0.35 ? Math.sin((beat / 0.35) * Math.PI) : 0;
    const atr = beat > 0.75 ? Math.sin(((beat - 0.75) / 0.25) * Math.PI) : 0;
    chambers.current.forEach((m, i) => {
      if (!m) return;
      const ventricle = i === 1 || i === 3;
      const base = [0.42, 0.5, 0.4, 0.56][i]!;
      m.scale.setScalar(base * (1 - (ventricle ? sys : atr) * 0.1));
    });
    const pm = pRef.current;
    if (!pm) return;
    for (let k = 0; k < n; k++) {
      const u = (k / n + t * 0.05 * (1 + sys * 0.6)) % 1;
      curve.getPointAt(u, V);
      TMP.position.copy(V);
      TMP.rotation.set(k, t + k, 0);
      TMP.scale.setScalar(0.07);
      TMP.updateMatrix();
      pm.setMatrixAt(k, TMP.matrix);
      // Akciğerden (istasyon 4) önce oksijeni azalmış (mavi), sonra oksijenli (kırmızı)
      color.set(u < stationU[4]! || u > 0.97 ? '#4b6cc6' : '#d23a3f');
      pm.setColorAt(k, color);
    }
    pm.instanceMatrix.needsUpdate = true;
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
  });
  const chamberOf = [0, -1, 1, -1, -1, 2, -1, 3, -1];
  const valveAt = [-1, 2, -1, 4, -1, -1, 9, -1, 11];
  const target = active >= 0 ? curve.getPointAt(stationU[active]!) : new Vector3(0, 0.3, 0);
  // Bütün kalp ya da kan yolundaki istasyon (odacık/kapak) görünür alana sığdırılır.
  useFitted(active >= 0 ? target : new Vector3(0, 0.45, 0), active >= 0 ? 0.75 : 1.75, new Vector3(target.x * 0.25, 0.25, 1), `ch${active}`);
  return (
    <group>
      {[CH.ra, CH.rv, CH.la, CH.lv].map((p, i) => {
        const lit = chamberOf[active] === i;
        return (
          <mesh key={i} ref={(m) => void (m && (chambers.current[i] = m))} geometry={blob} position={p}>
            <meshStandardMaterial color={i < 2 ? '#7a3a52' : '#a8343c'} transparent opacity={lit ? 0.55 : 0.28} emissive={lit ? '#ffcf70' : '#000000'} emissiveIntensity={lit ? 0.35 : 0} side={DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
      {valveAt.map((pi, i) =>
        pi >= 0 ? (
          <mesh key={i} geometry={valveGeo} position={HEART_PATH[pi]!} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={active === i ? '#ffd27a' : '#f0d9c8'} emissive={active === i ? '#ffd27a' : '#000000'} emissiveIntensity={active === i ? 0.6 : 0} />
          </mesh>
        ) : null,
      )}
      <mesh geometry={vessel} material={vMat} />
      <instancedMesh ref={pRef} args={[pGeo, pMat, n]} frustumCulled={false} />
    </group>
  );
}

/* ================================================================== PARANKİM (dolu organ) */

function unitGeometry(unit: string): BufferGeometry {
  switch (unit) {
    case 'lobule':
      return new CylinderGeometry(0.46, 0.46, 0.25, 6);
    case 'follicle':
      return new SphereGeometry(0.32, 20, 14);
    case 'acinus':
    case 'islet':
    case 'cells':
      return bumpySphere(1, 0.1, 5).scale(0.22, 0.22, 0.22);
    case 'neuron':
      return bumpySphere(1, 0.15, 9).scale(0.14, 0.14, 0.14);
    case 'fibers':
    case 'fascicles':
      return new CylinderGeometry(0.09, 0.09, 4.2, 10).rotateZ(Math.PI / 2);
    case 'layers':
      return new CylinderGeometry(2.4, 2.4, 0.22, 48);
    case 'osteon':
      return new TorusGeometry(0.4, 0.06, 8, 32);
    case 'alveoli':
      return new SphereGeometry(0.25, 16, 12);
    default:
      return new SphereGeometry(0.25, 14, 10);
  }
}

function unitLayout(unit: string): Array<{ p: Vector3; s: number }> {
  const r = rng(unit.length * 13 + 5);
  const out: Array<{ p: Vector3; s: number }> = [];
  if (unit === 'lobule') {
    for (let q = -2; q <= 2; q++) for (let k = -2; k <= 2; k++) out.push({ p: new Vector3((q + (k % 2 ? 0.5 : 0)) * 0.9, 0, k * 0.78), s: 1 });
  } else if (unit === 'layers') {
    for (let i = 0; i < 5; i++) out.push({ p: new Vector3(0, 0.9 - i * 0.45, 0), s: 1 });
  } else if (unit === 'fibers' || unit === 'fascicles') {
    const groups = unit === 'fascicles' ? 5 : 1;
    for (let g = 0; g < groups; g++) {
      const cx = unit === 'fascicles' ? Math.cos(g * 1.25) * 0.7 : 0;
      const cz = unit === 'fascicles' ? Math.sin(g * 1.25) * 0.7 : 0;
      for (let i = 0; i < (unit === 'fascicles' ? 12 : 30); i++) out.push({ p: new Vector3(0, cx + (r() - 0.5) * 0.5 * (groups > 1 ? 1 : 3), cz + (r() - 0.5) * 0.5 * (groups > 1 ? 1 : 3)), s: 0.7 + r() * 0.5 });
    }
  } else if (unit === 'osteon') {
    for (let q = 0; q < 6; q++) for (let ring = 0; ring < 4; ring++) out.push({ p: new Vector3(Math.cos(q) * 1.4 * (q % 2 ? 0.6 : 1), 0, Math.sin(q) * 1.1), s: 0.4 + ring * 0.28 });
  } else {
    const count = unit === 'cells' ? 70 : unit === 'neuron' ? 40 : unit === 'follicle' ? 14 : 46;
    for (let i = 0; i < count; i++) out.push({ p: new Vector3((r() - 0.5) * 4, (r() - 0.5) * 1.6, (r() - 0.5) * 2.6), s: unit === 'follicle' ? 0.4 + r() * 1.3 : 0.6 + r() * 0.8 });
  }
  return out;
}

function ParenchymaView({ unit, color, focus, time }: { unit: string; color: string; focus: SceneFocus; time: { current: number } }) {
  const geo = useDisposable(() => unitGeometry(unit), [unit]);
  const layout = useMemo(() => unitLayout(unit), [unit]);
  // Renk örnek başına (instanceColor) verilir; malzeme beyaz kalır ki renkler çarpılıp kararmasın.
  const mat = useDisposable(() => {
    // Islak doku yüzeyi (kabartı, renk dalgalanması); renk örnek başına gelir.
    const m = createTissueMaterial({ ...contentLook('cells'), bump: 0.18, bumpFreq: 7, mottle: 0.14, mottleFreq: 2.5, clearcoat: 0.55, roughness: 0.45, rimAmount: 0.06, rim: '#ff8070' });
    m.transparent = unit === 'follicle' || unit === 'layers';
    m.opacity = unit === 'layers' ? 0.75 : unit === 'follicle' ? 0.6 : 1;
    return m;
  }, [unit]);
  const uRef = useRef<InstancedMesh>(null);
  // Kan/sinyal akışı: girişten (sol, kırmızı) çıkışa (sağ, mavi-mor); lobülde köşeden merkeze.
  const n = focus === 'flow' ? 220 : 120;
  const flows = useMemo(() => {
    const r = rng(29);
    return Array.from({ length: n }, () => ({ y: (r() - 0.5) * 1.4, z: (r() - 0.5) * 2.2, ph: r(), sp: 0.6 + r() * 0.8, unit: Math.floor(r() * 25) }));
  }, [n]);
  const fRef = useRef<InstancedMesh>(null);
  const fGeo = useDisposable(() => (unit === 'neuron' || unit === 'fibers' || unit === 'fascicles' ? new SphereGeometry(1, 8, 6) : rbcGeometry(12)), [unit]);
  const fMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.5, emissive: '#000000' }));
  const c = useMemo(() => new Color(), []);
  const signal = unit === 'neuron' || unit === 'fibers' || unit === 'fascicles';
  useEffect(() => {
    const m = uRef.current;
    if (!m) return;
    layout.forEach((u, k) => {
      TMP.position.copy(u.p);
      TMP.rotation.set(unit === 'osteon' ? Math.PI / 2 : 0, unit === 'lobule' ? Math.PI / 6 : 0, 0);
      TMP.scale.setScalar(u.s);
      TMP.updateMatrix();
      m.setMatrixAt(k, TMP.matrix);
      c.set(color).offsetHSL(0, 0, unit === 'layers' ? k * 0.07 - 0.1 : ((k * 17) % 10) / 100 - 0.05);
      m.setColorAt(k, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout, unit, color, c]);
  useFrame(() => {
    const t = time.current;
    const m = fRef.current;
    if (!m) return;
    flows.forEach((f, k) => {
      const u = (f.ph + t * 0.06 * f.sp) % 1;
      if (unit === 'lobule') {
        // Portal üçlüden (altıgen köşesi) merkezi vene doğru
        const cell = layout[f.unit % layout.length]!.p;
        const a = Math.floor(f.ph * 6) * (Math.PI / 3);
        V.set(cell.x + Math.cos(a) * 0.5 * (1 - u), 0.2, cell.z + Math.sin(a) * 0.5 * (1 - u));
        c.set('#d23a3f').lerp(new Color('#5b3a8c'), u);
      } else {
        V.set(-2.4 + u * 4.8, f.y + Math.sin(u * 9 + k) * 0.12, f.z + Math.cos(u * 7 + k) * 0.12);
        c.set(signal ? '#ffe27a' : '#d23a3f').lerp(new Color(signal ? '#a78bfa' : '#5b3a8c'), signal ? 0 : u);
      }
      if (focus === 'secrete' && k % 3 === 0) {
        const src = layout[k % layout.length]!.p;
        V.set(src.x, src.y + u * 1.2, src.z);
        c.set('#f6d36b');
      }
      TMP.position.copy(V);
      TMP.rotation.set(k, t + k, 0);
      TMP.scale.setScalar(signal ? 0.035 : 0.06);
      TMP.updateMatrix();
      m.setMatrixAt(k, TMP.matrix);
      m.setColorAt(k, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  const close = focus === 'units' || focus === 'secrete';
  // Genel bakışta bütün parankim, birim/salgı odağında yakın plan; ikisi de görünür alana sığar.
  useFitted(new Vector3(0, 0, 0), close ? 1.25 : unit === 'layers' || unit === 'fibers' || unit === 'fascicles' ? 2.5 : 2.35, new Vector3(close ? 0.4 : 0.15, close ? 0.65 : 0.55, 1), `p${focus}`);
  return (
    <group>
      <instancedMesh ref={uRef} args={[geo, mat, layout.length]} />
      <instancedMesh ref={fRef} args={[fGeo, fMat, n]} frustumCulled={false} />
    </group>
  );
}

/* ================================================================== YOL (ses / ışık / hava) */

const STATION_SHAPES: Record<'sound' | 'light' | 'air', string[]> = {
  sound: ['bowl', 'tube', 'disc', 'bone', 'bone', 'bone', 'spiral', 'strip', 'block', 'hair', 'nerve'],
  light: ['glow', 'dome', 'sphere', 'lens', 'big', 'shell', 'hair', 'cell', 'cell', 'nerve', 'brain'],
  air: ['cloud', 'tube', 'fork', 'thin', 'cluster', 'capillary'],
};

function stationGeometry(kind: string): BufferGeometry {
  switch (kind) {
    case 'bowl':
      return new SphereGeometry(0.35, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2);
    case 'tube':
      return new CylinderGeometry(0.16, 0.16, 0.7, 20, 1, true).rotateZ(Math.PI / 2);
    case 'thin':
      return new CylinderGeometry(0.07, 0.07, 0.6, 12, 1, true).rotateZ(Math.PI / 2);
    case 'disc':
      return new CylinderGeometry(0.3, 0.3, 0.02, 32).rotateZ(Math.PI / 2);
    case 'bone':
      return new CapsuleGeometry(0.06, 0.18, 4, 8);
    case 'spiral':
      return new TorusGeometry(0.28, 0.07, 10, 40, Math.PI * 4.5);
    case 'strip':
      return new CylinderGeometry(0.02, 0.02, 0.8, 6).rotateZ(Math.PI / 2).scale(1, 1, 6);
    case 'block':
      return new CylinderGeometry(0.12, 0.16, 0.18, 6);
    case 'hair':
      return new CapsuleGeometry(0.05, 0.22, 4, 8);
    case 'nerve':
      return new CylinderGeometry(0.05, 0.05, 0.8, 10).rotateZ(Math.PI / 2);
    case 'glow':
      return new SphereGeometry(0.16, 16, 12);
    case 'dome':
      return new SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3).rotateZ(-Math.PI / 2);
    case 'lens':
      return new SphereGeometry(0.22, 24, 16).scale(0.45, 1, 1);
    case 'big':
      return new SphereGeometry(0.45, 24, 16);
    case 'shell':
      return new SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 3).rotateZ(Math.PI / 2);
    case 'brain':
      return bumpySphere(2, 0.12, 4).scale(0.35, 0.3, 0.3);
    case 'fork':
      return new CylinderGeometry(0.1, 0.13, 0.6, 14).rotateZ(Math.PI / 2.6);
    case 'cluster':
      return bumpySphere(1, 0.25, 6).scale(0.3, 0.3, 0.3);
    case 'capillary':
      return new TorusGeometry(0.22, 0.04, 8, 30);
    case 'cloud':
      return new SphereGeometry(0.2, 12, 10);
    default:
      return new SphereGeometry(0.14, 14, 10);
  }
}

function PathwayView({ signal, color, focus, stations, time }: { signal: 'sound' | 'light' | 'air'; color: string; focus: SceneFocus; stations: number; time: { current: number } }) {
  const shapes = useMemo(() => STATION_SHAPES[signal].slice(0, Math.max(1, stations)), [signal, stations]);
  const geos = useMemo(() => shapes.map(stationGeometry), [shapes]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  const xs = useMemo(() => shapes.map((_, i) => -((shapes.length - 1) * 0.55) / 2 + i * 0.55), [shapes]);
  const active = focus.startsWith('path:') ? Number(focus.slice(5)) : -1;
  const pulseRef = useRef<InstancedMesh>(null);
  const pn = 24;
  const pGeo = useDisposable(() => (signal === 'sound' ? new TorusGeometry(0.12, 0.012, 6, 24).rotateY(Math.PI / 2) : new SphereGeometry(1, 8, 6)), [signal]);
  const pMat = useDisposable(() => new MeshStandardMaterial({ emissive: '#ffffff', emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
  const c = useMemo(() => new Color(), []);
  // Dönüşüm noktası: kulakta tüy hücresi (9), gözde fotoreseptör (6); sonrası elektrik sinyali.
  const transduce = signal === 'sound' ? 9 : signal === 'light' ? 6 : 99;
  useFrame(() => {
    const t = time.current;
    const m = pulseRef.current;
    if (!m) return;
    for (let k = 0; k < pn; k++) {
      const u = (k / pn + t * 0.06) % 1;
      const x = xs[0]! + u * (xs[xs.length - 1]! - xs[0]!);
      const idx = Math.round(u * (xs.length - 1));
      const electric = idx >= transduce;
      V.set(x, Math.sin(u * 30 + k) * (signal === 'air' ? 0.12 : 0.02), signal === 'air' ? Math.cos(u * 21 + k) * 0.12 : 0);
      TMP.position.copy(V);
      TMP.rotation.set(0, 0, 0);
      TMP.scale.setScalar(signal === 'sound' && !electric ? 1 + Math.sin(u * 40) * 0.2 : signal === 'air' ? 0.03 : 0.035);
      TMP.updateMatrix();
      m.setMatrixAt(k, TMP.matrix);
      c.set(electric ? '#a78bfa' : signal === 'light' ? '#fff3b0' : signal === 'air' ? '#e8f4ff' : '#ffd27a');
      m.setColorAt(k, c);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  const ax = active >= 0 ? xs[Math.min(active, xs.length - 1)]! : 0;
  // Bütün yol ya da sinyalin bulunduğu istasyon görünür alana sığar (dikey telefonda da taşmaz).
  const span = (xs[xs.length - 1]! - xs[0]!) / 2 + 0.45;
  useFitted(new Vector3(ax, 0, 0), active >= 0 ? 0.7 : span, new Vector3(0, 0.18, 1), `w${active}`);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} position={[xs[i]!, 0, 0]}>
          <meshStandardMaterial color={i >= transduce ? '#c9b8ef' : color} roughness={0.5} transparent opacity={shapes[i] === 'big' || shapes[i] === 'sphere' ? 0.35 : 0.92} emissive={active === i ? '#ffd27a' : '#000000'} emissiveIntensity={active === i ? 0.55 : 0} side={DoubleSide} />
        </mesh>
      ))}
      <instancedMesh ref={pulseRef} args={[pGeo, pMat, pn]} frustumCulled={false} />
    </group>
  );
}

/* ================================================================== ATLAS KESİTİ (gerçek insan anatomisi ağları) */

/** Kesit sahnesinde organın yarıçapı (sahne birimi). */
const ATLAS_R = 1.6;

interface AtlasSelection {
  main: ModelPart[];
  context: ModelPart[];
  ghost: ModelPart[];
  center: Vector3;
  scale: number;
}

const refsMatch = (p: ModelPart, refs: PartRef[] | undefined) => !!refs?.some((r) => matchesRef(p.structure, p.label, r));

/** Kesitte çizilecek parçalar: organ (tek tarafı), yakınındaki bağlam yapıları ve saydam kılıf. */
export function selectAtlasParts(def: AtlasSectionDef, parts: ModelPart[]): AtlasSelection | null {
  const sideOk = (b: Box3) => !def.side || (def.side === 'right' ? b.getCenter(V).x < 0 : b.getCenter(V).x > 0);
  const main = parts.filter((p) => def.structures.includes(p.structure) && (!def.only?.[p.structure] || (p.label !== null && def.only[p.structure]!.includes(p.label))) && !refsMatch(p, def.ghost) && sideOk(p.box));
  if (!main.length) return null;
  const box = new Box3();
  for (const p of main) box.union(p.box);
  const near = box.clone().expandByVector(box.getSize(new Vector3()).multiplyScalar(0.35));
  const context = parts.filter((p) => !main.includes(p) && refsMatch(p, def.context) && near.intersectsBox(p.box));
  const ghost = parts.filter((p) => refsMatch(p, def.ghost) && sideOk(p.box));
  const frame = box.clone();
  for (const p of ghost) frame.union(p.box);
  const radius = frame.getSize(new Vector3()).length() / 2;
  return { main, context, ghost, center: frame.getCenter(new Vector3()), scale: ATLAS_R / Math.max(radius, 1e-4) };
}

const nameOf = (ref: PartRef) => {
  const [s, l] = splitRef(ref);
  return LABEL_TR[ref] ?? (l ? partDef(s, l)?.tr : undefined) ?? structureById.get(s)?.nameTr ?? ref;
};

/** Parçaların sahnedeki (ölçeklenmiş) merkezi. */
function centroidOf(parts: ModelPart[], sel: AtlasSelection, out: Vector3): Vector3 | null {
  if (!parts.length) return null;
  const b = new Box3();
  for (const p of parts) b.union(p.box);
  return b.getCenter(out).sub(sel.center).multiplyScalar(sel.scale);
}

/**
 * Etiketin bölüm üzerindeki noktası: kesit açıksa bölümün kesit düzlemindeki köşelerinden (kesit yüzünde
 * görünen yeri), kapalıysa kameraya bakan yüzünden; önceki etiketlerden en uzak, kendi merkezine yakın olan.
 */
function anchorOn(ps: ModelPart[], sel: AtlasSelection, dir: Vector3, plane: number | null, chosen: Vector3[]): Vector3 | null {
  if (!ps.length) return null;
  const c = centroidOf(ps, sel, new Vector3())!;
  const front = c.dot(dir);
  const band = ATLAS_R * 0.07;
  let best: Vector3 | null = null;
  let bestScore = -Infinity;
  const q = new Vector3();
  for (const p of ps) {
    const pos = p.geometry.attributes.position!;
    const step = Math.max(1, Math.floor(pos.count / 500));
    for (let i = 0; i < pos.count; i += step) {
      q.fromBufferAttribute(pos, i).applyMatrix4(p.matrix).sub(sel.center).multiplyScalar(sel.scale);
      const d = q.dot(dir);
      if (plane !== null ? Math.abs(d - plane) > band : d < front) continue;
      const spread = chosen.length ? Math.min(...chosen.map((x) => x.distanceTo(q))) : 0;
      const score = Math.min(spread, ATLAS_R * 0.5) - 0.6 * q.distanceTo(c);
      if (score > bestScore) {
        bestScore = score;
        best = q.clone();
      }
    }
  }
  if (!best) {
    // Bölüm kesit düzlemine ulaşmıyorsa merkezi düzleme izdüşürülür.
    best = c.clone();
    if (plane !== null && front > plane) best.addScaledVector(dir, plane - front);
  }
  return best;
}

function AtlasPartMesh({ part, all, sel, plane, cut, ghost, lit, accent, time, rank }: { part: ModelPart; all: ModelPart[]; sel: AtlasSelection; plane: Plane; cut: boolean; ghost: boolean; lit: boolean; accent: string; time: { current: number }; rank: number }) {
  const key = `${part.structure}|${part.label ?? ''}`;
  const media = PART_OPACITY[key] !== undefined && /cornea|aqueous|vitreous|conjunctiva/.test(key);
  const opacity = ghost ? 0.2 : media ? PART_OPACITY[key]! : cut ? 1 : (PART_OPACITY[key] ?? 1);
  const mat = useDisposable(() => {
    const m = createTissueMaterial(tissueLook(part.structure, part.label), { freqScale: 1 / sel.scale, fat: hasEpicardialFat(part.structure, part.label) });
    m.side = ghost ? FrontSide : DoubleSide;
    return m;
  }, [part.id, sel.scale, ghost]) as TissueMaterial;
  useEffect(() => {
    mat.clippingPlanes = ghost ? null : [plane];
    setTissueCut(mat, !ghost);
    mat.transparent = opacity < 1;
    mat.opacity = opacity;
    mat.depthWrite = opacity >= 1;
    mat.emissive.set(lit ? accent : '#000000');
    // Atlas ağlarında komşu bölümlerin yüzeyleri çakışır (kapsül ↔ korteks, odacık duvarları): büyük (dış)
    // bölümler derinlikte geri itilir, küçük (iç) bölüm öne çıkar — kesitte titreşen lekeler olmaz.
    mat.polygonOffset = rank > 0;
    mat.polygonOffsetFactor = rank * 1.5;
    mat.polygonOffsetUnits = rank * 6;
    mat.needsUpdate = true;
  }, [mat, plane, ghost, opacity, lit, accent, rank]);
  useFrame(() => {
    if (lit) mat.emissiveIntensity = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(time.current * 2.4));
  });
  // Yumuşatılmış ağ işçide hazırlanır (organ odaklanınca önceden istenir); gelene kadar özgün ağ.
  useStudioVersion();
  return <mesh geometry={studioGeometry(part, all) ?? part.geometry} matrixAutoUpdate={false} matrix={part.matrix} material={mat} renderOrder={ghost ? 5 : 0} />;
}

const ORIGIN = new Vector3();
const P = new Vector3();

/**
 * Atlas etiketleri (tıbbi atlas düzeni): bölümün kesit yüzündeki noktası + organın iki yanında sütun halinde
 * ad ve aralarında kılavuz çizgi. Etiketler üst üste binmez; görünür alanın (panelin kapatmadığı kısım) içinde kalır.
 */
function Callouts({ items, center, radius }: { items: Array<{ ref: string; at: Vector3; name: string; lit: boolean }>; center: Vector3; radius: number }) {
  const { view } = useContext(WorldContext);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const labels = useRef<Array<HTMLSpanElement | null>>([]);
  const lines = useRef<Array<SVGLineElement | null>>([]);
  const dots = useRef<Array<SVGCircleElement | null>>([]);
  useFrame(() => {
    // Tam ekran Html kabı, sahne kökünün ekrandaki izdüşümüne göre yerleşir: tuval koordinatına çevir.
    P.set(0, 0, 0).project(camera);
    const ox = ((P.x + 1) / 2) * size.width - size.width / 2;
    const oy = ((1 - P.y) / 2) * size.height - size.height / 2;
    P.copy(center).project(camera);
    const cx = ((P.x + 1) / 2) * size.width;
    const dist = camera.position.distanceTo(center);
    const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 180;
    const rpx = (radius / Math.max(1e-3, dist * Math.tan(fov / 2))) * (size.height / 2);
    const pts = items.map((it, i) => {
      P.copy(it.at).project(camera);
      return { i, x: ((P.x + 1) / 2) * size.width - ox, y: ((1 - P.y) / 2) * size.height - oy };
    });
    const maxX = size.width - view.right - 8;
    for (const side of [-1, 1]) {
      const group = pts.filter((p) => (side < 0 ? p.x < cx - ox : p.x >= cx - ox)).sort((a, b) => a.y - b.y);
      let y = -Infinity;
      for (const p of group) {
        y = Math.max(p.y, y + 30);
        const ly = Math.min(size.height - view.bottom - 16, Math.max(16, y)) - oy;
        const el = labels.current[p.i];
        const w = el?.offsetWidth ?? 120;
        // Sol sütunda etiketin sağ kenarı, sağ sütunda sol kenarı kılavuz çizginin ucundadır; ikisi de tuvalin içinde kalır.
        const lx = (side < 0 ? Math.max(8 + w, cx - rpx * 0.85 - 28) : Math.min(maxX - w, cx + rpx * 0.85 + 28)) - ox;
        if (el) el.style.transform = `translate(${lx}px, ${ly}px) translate(${side < 0 ? '-100%' : '0'}, -50%)`;
        lines.current[p.i]?.setAttribute('x1', String(p.x));
        lines.current[p.i]?.setAttribute('y1', String(p.y));
        lines.current[p.i]?.setAttribute('x2', String(lx));
        lines.current[p.i]?.setAttribute('y2', String(ly));
        dots.current[p.i]?.setAttribute('cx', String(p.x));
        dots.current[p.i]?.setAttribute('cy', String(p.y));
      }
    }
  });
  if (!items.length) return null;
  return (
    <Html fullscreen zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
      <svg className="atlas-lines" width={size.width} height={size.height} aria-hidden="true">
        {items.map((it, i) => (
          <g key={it.ref} className={it.lit ? 'lit' : undefined}>
            <line ref={(el) => void (lines.current[i] = el)} />
            <circle ref={(el) => void (dots.current[i] = el)} r={3} />
          </g>
        ))}
      </svg>
      {items.map((it, i) => (
        <span key={it.ref} ref={(el) => void (labels.current[i] = el)} data-testid="atlas-label" data-ref={it.ref} className={`atlas-label${it.lit ? ' atlas-label-lit' : ''}`}>
          {it.name}
        </span>
      ))}
    </Html>
  );
}

function AtlasView({ def, stage, parts, focus: _focus, time, accent }: { def: AtlasSectionDef; stage: string; parts: ModelPart[]; focus: SceneFocus; time: { current: number }; accent: string }) {
  const { reducedMotion } = useContext(WorldContext);
  const st = def.stages[stage] ?? {};
  const sel = useMemo(() => selectAtlasParts(def, parts)!, [def, parts]);
  const dir = useMemo(() => new Vector3(...VIEW_DIR[def.view]), [def.view]);
  const all = useMemo(() => [...sel.main, ...sel.context], [sel]);
  // Hacme göre sıra (0 = en küçük): çakışan yüzeylerde iç bölüm kazanır.
  const rank = useMemo(() => {
    const vol = (p: ModelPart) => {
      const d = p.box.getSize(V);
      return d.x * d.y * d.z;
    };
    const order = [...all].sort((a, b) => vol(a) - vol(b));
    return new Map(order.map((p, i) => [p.id, Math.round((i / Math.max(1, order.length - 1)) * 8)]));
  }, [all]);
  const focused = useMemo(() => all.filter((p) => refsMatch(p, st.focus)), [all, st.focus]);
  const fc = useMemo(() => centroidOf(focused, sel, new Vector3()), [focused, sel]);
  const cut = st.cut !== false;
  // Kesit düzlemi: bakış yönünde t'den öndeki her şey kesilir (dot(dir, p) ≤ t kalır). Girişte organ
  // kapalıdır (düzlem önde); düzlem yüzeyden içeri ilerler ve iç yapı ortaya çıkar.
  const open = ATLAS_R * 1.6;
  const target = !cut ? open : st.depth !== undefined ? st.depth * ATLAS_R : fc ? fc.dot(dir) + 0.02 : 0;
  const plane = useMemo(() => new Plane(dir.clone().negate(), open), [dir, open]);
  const live = useRef(target);
  live.current = target;
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    const d = live.current - plane.constant;
    if (Math.abs(d) < 1e-4) return;
    plane.constant += reducedMotion ? d : d * (1 - Math.exp(-Math.min(dt, 0.1) * 1.9));
    invalidate();
  });
  // Kan yolu (kalp): bölüm merkezlerinden geçen eğri; akciğerden önce oksijeni azalmış (mavi), sonra oksijenli.
  const flow = useMemo(() => {
    if (!def.flow) return null;
    const pts: Vector3[] = [];
    for (const f of def.flow) {
      const ps = all.filter((p) => matchesRef(p.structure, p.label, f.at));
      const c = centroidOf(ps, sel, new Vector3());
      if (c) pts.push(c.addScaledVector(new Vector3(...(f.off ?? [0, 0, 0])), ATLAS_R));
    }
    if (pts.length < 3) return null;
    const curve = new CatmullRomCurve3(pts);
    // Oksijenlenme noktasının eğri üzerindeki yeri
    const ox = Math.min(pts.length - 1, def.oxygenAt ?? pts.length);
    return { curve, oxygen: ox / (pts.length - 1) };
  }, [def.flow, def.oxygenAt, all, sel]);
  const n = 150;
  const pRef = useRef<InstancedMesh>(null);
  const pGeo = useDisposable(() => rbcGeometry(16));
  const pMat = useDisposable(() => new MeshStandardMaterial({ roughness: 0.4 }));
  const color = useMemo(() => new Color(), []);
  useFrame(() => {
    const m = pRef.current;
    if (!m || !flow) return;
    const t = time.current;
    const beat = (t * 1.15) % 1;
    const push = beat < 0.35 ? Math.sin((beat / 0.35) * Math.PI) : 0;
    for (let k = 0; k < n; k++) {
      const u = (k / n + t * 0.045 + push * 0.004) % 1;
      flow.curve.getPointAt(u, V);
      TMP.position.copy(V);
      TMP.rotation.set(k, t * 0.8 + k, 0);
      TMP.scale.setScalar(0.06);
      TMP.updateMatrix();
      m.setMatrixAt(k, TMP.matrix);
      color.set(u < flow.oxygen ? '#4b6cc6' : '#d23a3f');
      m.setColorAt(k, color);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  // Kadraj: bütün organ ya da odaktaki bölüm; kesit yüzüne hafif yukarıdan bakılır.
  const camDir = useMemo(() => dir.clone().add(new Vector3(dir.x ? 0 : 0.12, dir.y ? 0 : 0.22, dir.z ? 0 : 0.1)), [dir]);
  useFitted(fc ?? new Vector3(), ATLAS_R * (st.zoom ?? (fc ? 0.55 : 1)) * 1.05, camDir, `atlas:${stage}`);
  // Etiketler: bölümün kesit yüzündeki yeri (kesilen yarıdaysa düzleme izdüşürülür).
  const labelRefs = (st.labels ?? (st.focus?.length ? st.focus : def.labels) ?? []).slice(0, 6);
  const labelKey = labelRefs.join();
  const labels = useMemo(() => {
    const chosen: Vector3[] = [];
    return labelRefs
      .map((ref) => {
        const ps = [...all, ...sel.ghost].filter((p) => matchesRef(p.structure, p.label, ref));
        const at = anchorOn(ps, sel, dir, cut && !ps.some((p) => sel.ghost.includes(p)) ? target : null, chosen);
        if (!at) return null;
        chosen.push(at);
        return { ref, at, name: nameOf(ref), lit: refsMatch(ps[0]!, st.focus) };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey, all, sel, dir, cut, target, stage]);
  return (
    <group>
      <group scale={sel.scale} position={sel.center.clone().multiplyScalar(-sel.scale)}>
        {sel.main.map((p) => (
          <AtlasPartMesh key={p.id} part={p} all={parts} sel={sel} plane={plane} cut={cut} ghost={false} lit={refsMatch(p, st.focus)} accent={accent} time={time} rank={rank.get(p.id) ?? 0} />
        ))}
        {sel.context.map((p) => (
          <AtlasPartMesh key={p.id} part={p} all={parts} sel={sel} plane={plane} cut={cut} ghost={false} lit={refsMatch(p, st.focus)} accent={accent} time={time} rank={rank.get(p.id) ?? 0} />
        ))}
        {sel.ghost.map((p) => (
          <AtlasPartMesh key={p.id} part={p} all={parts} sel={sel} plane={plane} cut={false} ghost={!st.solid} lit={refsMatch(p, st.focus)} accent={accent} time={time} rank={0} />
        ))}
      </group>
      {flow && st.flow && <instancedMesh ref={pRef} args={[pGeo, pMat, n]} frustumCulled={false} />}
      <Callouts items={labels} center={fc ?? ORIGIN} radius={ATLAS_R * (st.zoom ?? (fc ? 0.55 : 1))} />
    </group>
  );
}

/* ================================================================== KÖK */

function Scene({ spec, focus, progress, wall, mode, layers, highlightLayer, stations, playing, reducedMotion, atlas, accent }: InteriorWorldProps) {
  const time = useClock(playing, reducedMotion);
  const m = mode ?? DEFAULT_MODE;
  if (wall && layers?.length) return <WallSection layers={layers} highlight={highlightLayer} time={time} />;
  // Gerçek insan atlas ağları yüklendiyse organın iç yapısı kesitle; yüklenmediyse aynı basamak prosedürel çizilir.
  if (atlas && !wall && selectAtlasParts(atlas.def, atlas.parts)) return <AtlasView def={atlas.def} stage={atlas.stage} parts={atlas.parts} focus={focus} time={time} accent={accent ?? '#ffcf70'} />;
  switch (spec.kind) {
    case 'lumen':
      return <LumenView sp={spec} focus={focus} mode={m} time={time} progress={progress} />;
    case 'vessel': {
      const radius = spec.caliber === 'large' ? 1.4 : spec.caliber === 'medium' ? 1 : spec.caliber === 'small' ? 0.55 : 0.28;
      return <LumenView sp={{ shape: 'tube', lining: 'smooth', content: 'blood', radius, wave: 0, flow: spec.pulse ? 1 : 0.5, color: spec.color, pulse: spec.pulse }} focus={focus} mode={{ ...m, content: spec.caliber === 'capillary' ? 0.15 : 0.7, motion: 0.6 }} time={time} progress={progress} />;
    }
    case 'chambers':
      return <ChambersView focus={focus} time={time} />;
    case 'parenchyma':
      return <ParenchymaView unit={spec.unit} color={spec.color} focus={focus} time={time} />;
    case 'pathway':
      return <PathwayView signal={spec.signal} color={spec.color} focus={focus} stations={stations ?? STATION_SHAPES[spec.signal].length} time={time} />;
  }
}

/**
 * Organın iç dünyası, 3B vücut keşfinin tuvalinde (kendi Canvas'ı yok): ortam (arka plan, sis), ışık ve
 * sahne. Kamera denetimi Explorer'ındır; sahne yalnızca çekimleri ister.
 */
export function InteriorWorld(props: InteriorWorldProps) {
  const lumenLike = !props.wall && (props.spec.kind === 'lumen' || props.spec.kind === 'vessel');
  useAtmosphere(lumenLike ? '#14080a' : '#0b0e14', lumenLike ? ['#1e0a0d', 1.5, 9] : null, lumenLike ? 0.3 : props.atlas ? 0.32 : 0.45, true);
  const ctx = useMemo(
    () => ({ view: props.view, entry: props.entry, leaving: props.leaving, reducedMotion: props.reducedMotion, progress: props.progress, onSubject: props.onSubject }),
    [props.view, props.entry, props.leaving, props.reducedMotion, props.progress, props.onSubject],
  );
  return (
    <WorldContext value={ctx}>
      <group>
        {lumenLike && <Headlight intensity={3} distance={10} />}
        {!props.atlas && <pointLight position={[0, 2, 3]} intensity={lumenLike ? 0.5 : 1.2} distance={12} decay={1.3} color="#ffe8e0" />}
        <Scene {...props} />
      </group>
    </WorldContext>
  );
}
