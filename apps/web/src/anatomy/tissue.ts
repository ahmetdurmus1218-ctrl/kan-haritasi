import { Color, MeshPhysicalMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { VEIN_COLOR, colorFor } from './palette';

/**
 * Gerçekçi doku malzemesi (tıbbi atlas görünümü). HRA / BodyParts3D ağlarında UV yoktur; bu yüzden doku
 * deseni dosya (texture) olmadan, GPU'da 3B gürültüyle (simplex) yüzeyin kendi koordinatından üretilir:
 *
 *   - doğal yüzey kabartısı (normal sapması, iki oktav): karaciğer lobülleri, pankreas lobcukları, kas lifi…
 *   - renk dalgalanması ve ikinci renk lekeleri (epikard yağı, akciğerde antrakotik lekeler, hilus yağı…)
 *   - yüzey damar ağı (seroza/pia damarları, sklera damarları): dallanan ince çizgiler
 *   - ıslak doku parlaklığı (clearcoat: düzgün sıvı film, kabartıdan bağımsız) ve seroza ipeksiliği (sheen)
 *   - kenar ışığı: ışığın dokunun içinden saçılması hissi (yüzeyaltı saçılma yaklaşımı)
 *   - kesit yüzeyi: kırpma düzlemiyle açılan organın içi (arka yüzler) dolu bir kesit gibi tek renk ve
 *     düzleme dik ışıkla çizilir — organ "kabuk" gibi değil, gerçek bir kesit gibi görünür.
 *
 * Renkler ve desenler genel insan anatomisini temsil eder (eğitimsel); kişinin görüntüsünden gelmez.
 * Düşük donanımlı cihazda (az bellek / az çekirdek) tek oktav ve damar ağı olmadan çizilir.
 */

export interface TissueLook {
  /** Temel renk (sRGB). */
  color: string;
  roughness: number;
  /** Islak film (0–1). */
  clearcoat: number;
  /** Seroza / zar ipeksiliği (0–1). */
  sheen: number;
  sheenColor: string;
  /** Kabartı eğimi (0–1) ve sıklığı (metre başına devir). */
  bump: number;
  bumpFreq: number;
  /** Parlaklık dalgalanması (0–0,4) ve sıklığı. */
  mottle: number;
  mottleFreq: number;
  /** İkinci renk lekeleri (yağ, antrakoz…). */
  tint: string;
  tintAmount: number;
  /** Yüzey damar ağı. */
  vein: string;
  veinAmount: number;
  veinFreq: number;
  /** Kenar (yüzeyaltı) ışığı. */
  rim: string;
  rimAmount: number;
  /** Kesit yüzeyinin rengi. */
  cut: string;
}

const BASE: TissueLook = {
  color: '#b0a8a0',
  roughness: 0.5,
  clearcoat: 0.35,
  sheen: 0.15,
  sheenColor: '#ffd9cc',
  bump: 0.12,
  bumpFreq: 160,
  mottle: 0.1,
  mottleFreq: 28,
  tint: '#d8b46a',
  tintAmount: 0,
  vein: '#8a1f28',
  veinAmount: 0,
  veinFreq: 18,
  rim: '#ff6a55',
  rimAmount: 0.06,
  cut: '#a05048',
};

const look = (o: Partial<TissueLook>): TissueLook => ({ ...BASE, cut: o.cut ?? shade(o.color ?? BASE.color, 0.06), ...o });

function shade(hex: string, dl: number): string {
  const c = new Color(hex);
  c.offsetHSL(0, -0.05, dl);
  return `#${c.getHexString()}`;
}

/** Islak seroza ile kaplı içi boş organ (mide, bağırsak). */
const SEROSA = { clearcoat: 0.55, sheen: 0.35, roughness: 0.55, veinAmount: 0.38, veinFreq: 22, bump: 0.1, bumpFreq: 140, rimAmount: 0.08 };
/** Kapsüllü dolu organ (karaciğer, böbrek, dalak). */
const CAPSULE = { clearcoat: 0.7, sheen: 0.1, roughness: 0.38, bump: 0.08, bumpFreq: 260, mottle: 0.12, mottleFreq: 40, rimAmount: 0.05 };

// Atlas geleneği: atardamarlar kırmızı, toplardamarlar (ve oksijensiz kan taşıyan pulmoner arterler) mavi.
const ARTERY = look({ color: '#a01f27', clearcoat: 0.7, roughness: 0.36, bump: 0.04, mottle: 0.08, rim: '#ff5a50', rimAmount: 0.1, cut: '#c4535a' });
const VEIN = look({ color: '#2e467f', clearcoat: 0.65, roughness: 0.38, bump: 0.04, mottle: 0.08, rim: '#7a8cff', rimAmount: 0.08, cut: '#5a3a6a' });

const STRUCTURE_LOOKS: Record<string, TissueLook> = {
  // Kalp: koyu kırmızı-kahve miyokard, ince yüzey damarları; epikard yağı damar oluklarında (KH_FAT).
  heart: look({ color: '#6e1c1a', ...SEROSA, bump: 0.03, bumpFreq: 260, mottle: 0.12, mottleFreq: 35, tintAmount: 0, veinAmount: 0.35, vein: '#3d0b10', veinFreq: 34, clearcoat: 0.45, sheen: 0.1, roughness: 0.5, cut: '#9a3330', rim: '#ff5a48' }),
  'coronary-arteries': ARTERY,
  aorta: ARTERY,
  'carotid-arteries': ARTERY,
  'abdominal-vessels': ARTERY,
  'renal-vessels': ARTERY,
  'eye-vessels': ARTERY,
  'limb-vessels': ARTERY,
  veins: VEIN,
  lungs: look({ color: '#b9616a', roughness: 0.5, clearcoat: 0.4, sheen: 0.08, sheenColor: '#ffe0e0', bump: 0.1, bumpFreq: 210, mottle: 0.16, mottleFreq: 45, tint: '#4f3f48', tintAmount: 0.2, veinAmount: 0.4, vein: '#5e1f3a', cut: '#c27a7e' }),
  airways: look({ color: '#e3c9b8', roughness: 0.5, clearcoat: 0.3, bump: 0.18, bumpFreq: 120, mottle: 0.08, cut: '#e9d6c8' }),
  liver: look({ color: '#6b271e', ...CAPSULE, tint: '#4a1a14', tintAmount: 0.18, cut: '#7e3326' }),
  gallbladder: look({ color: '#4c7438', clearcoat: 0.8, roughness: 0.3, sheen: 0.2, sheenColor: '#d8f0c0', bump: 0.05, veinAmount: 0.18, vein: '#7a3a2a', cut: '#6a8a4a' }),
  pancreas: look({ color: '#d09447', roughness: 0.55, clearcoat: 0.35, bump: 0.32, bumpFreq: 150, mottle: 0.12, mottleFreq: 70, tint: '#e2b25e', tintAmount: 0.3, veinAmount: 0.12, cut: '#e2bc90' }),
  'small-intestine': look({ color: '#c4644e', ...SEROSA, sheen: 0.15, cut: '#c46a66' }),
  'large-intestine': look({ color: '#b8624a', ...SEROSA, sheen: 0.15, tint: '#e0c07a', tintAmount: 0.15, cut: '#b86a5e' }),
  stomach: look({ color: '#bb5a52', ...SEROSA, sheen: 0.15, cut: '#c06a64' }),
  esophagus: look({ color: '#b5605a', ...SEROSA, sheen: 0.15, veinAmount: 0.18, cut: '#b8686a' }),
  kidneys: look({ color: '#78291f', ...CAPSULE, mottle: 0.1, cut: '#8a3428' }),
  'urinary-tract': look({ color: '#d7b0a0', clearcoat: 0.5, sheen: 0.3, roughness: 0.45, bump: 0.08, veinAmount: 0.25, cut: '#e0c0b0' }),
  prostate: look({ color: '#c08680', roughness: 0.5, clearcoat: 0.4, bump: 0.16, bumpFreq: 200, mottle: 0.1, veinAmount: 0.15, cut: '#caa098' }),
  // Kesitte gri cevher (korteks, çekirdekler) koyu pembe-gri, ak madde açık: atlas kesitlerindeki karşıtlık.
  brain: look({ color: '#c4877c', roughness: 0.5, clearcoat: 0.45, sheen: 0.12, sheenColor: '#ffe6e0', bump: 0.14, bumpFreq: 170, mottle: 0.1, veinAmount: 0.65, veinFreq: 26, vein: '#8a1520', cut: '#a77f78' }),
  'spinal-cord': look({ color: '#e9dcc2', roughness: 0.5, clearcoat: 0.4, bump: 0.06, veinAmount: 0.2, cut: '#efe4d0' }),
  spleen: look({ color: '#56202f', ...CAPSULE, cut: '#6a2a3a' }),
  thymus: look({ color: '#d4ae94', roughness: 0.55, clearcoat: 0.3, bump: 0.25, bumpFreq: 130, mottle: 0.12, tint: '#e8cc9a', tintAmount: 0.3, cut: '#dab89e' }),
  thyroid: look({ color: '#9e3f4c', ...CAPSULE, bump: 0.14, bumpFreq: 220, veinAmount: 0.2, cut: '#b05a62' }),
  pituitary: look({ color: '#c98a7a', ...CAPSULE }),
  hypothalamus: look({ color: '#cfa294', roughness: 0.5, clearcoat: 0.4 }),
  pineal: look({ color: '#c9958a', roughness: 0.5, clearcoat: 0.4 }),
  adrenals: look({ color: '#d39a45', roughness: 0.5, clearcoat: 0.45, bump: 0.2, bumpFreq: 190, mottle: 0.12, cut: '#a8603a' }),
  'skeletal-muscle': look({ color: '#8f302b', roughness: 0.48, clearcoat: 0.35, sheen: 0.25, bump: 0.2, bumpFreq: 320, mottle: 0.1, mottleFreq: 60, cut: '#a8443c' }),
  diaphragm: look({ color: '#8f322c', roughness: 0.48, clearcoat: 0.4, sheen: 0.3, bump: 0.16, bumpFreq: 280, cut: '#a8443c' }),
  bones: look({ color: '#e3d8c0', roughness: 0.62, clearcoat: 0.12, sheen: 0, bump: 0.22, bumpFreq: 240, mottle: 0.08, mottleFreq: 50, tint: '#c8b48a', tintAmount: 0.18, rim: '#ffe0b0', rimAmount: 0.03, cut: '#d8a890' }),
  knee: look({ color: '#e6eef2', roughness: 0.35, clearcoat: 0.6, bump: 0.04, rim: '#d0e8ff', rimAmount: 0.05 }),
  nerves: look({ color: '#ecdcae', roughness: 0.5, clearcoat: 0.35, bump: 0.1, bumpFreq: 300, rim: '#fff0c0', rimAmount: 0.05 }),
  eyes: look({ color: '#ece8e0', roughness: 0.35, clearcoat: 0.7, bump: 0.03, veinAmount: 0.35, veinFreq: 90, vein: '#b8303a', rim: '#ffd8d0', rimAmount: 0.04 }),
  testes: look({ color: '#ddbcb2', ...CAPSULE, veinAmount: 0.25 }),
  'male-genitals': look({ color: '#c99085', roughness: 0.5, clearcoat: 0.4, veinAmount: 0.2 }),
  ovaries: look({ color: '#e2bfae', roughness: 0.5, clearcoat: 0.45, bump: 0.3, bumpFreq: 160, mottle: 0.14, cut: '#e6cab8' }),
  uterus: look({ color: '#c47a82', ...SEROSA, veinAmount: 0.22, cut: '#b8606a' }),
  'fallopian-tubes': look({ color: '#d4909a', ...SEROSA }),
  vagina: look({ color: '#c98290', roughness: 0.45, clearcoat: 0.5 }),
  breasts: look({ color: '#e6c4aa', roughness: 0.55, clearcoat: 0.25, bump: 0.12, tint: '#f0d8b0', tintAmount: 0.3 }),
  tonsils: look({ color: '#c9808c', roughness: 0.5, clearcoat: 0.5, bump: 0.3, bumpFreq: 260 }),
  'lymph-node': look({ color: '#c9a490', ...CAPSULE }),
  ear: look({ color: '#e2cdb0', roughness: 0.5, clearcoat: 0.35, bump: 0.1 }),
};

/** Bölüm düzeyinde görünüm (iç yapılar, kapaklar, katmanlar). */
const PART_LOOKS: Record<string, Partial<TissueLook>> = {
  'heart|right-atrium': { color: '#7a2424' },
  'heart|right-ventricle': { color: '#7f2622' },
  'heart|left-atrium': { color: '#80261f' },
  'heart|left-ventricle': { color: '#7c221f' },
  'heart|septum': { color: '#8a2c28', tintAmount: 0, veinAmount: 0 },
  'heart|papillary': { color: '#9a3430', tintAmount: 0, veinAmount: 0 },
  'heart|tricuspid': { color: '#ead9bf', roughness: 0.35, bump: 0.03, tintAmount: 0, veinAmount: 0, rim: '#fff0e0', cut: '#efe2cc' },
  'heart|mitral': { color: '#ead9bf', roughness: 0.35, bump: 0.03, tintAmount: 0, veinAmount: 0, rim: '#fff0e0', cut: '#efe2cc' },
  'heart|aortic-valve': { color: '#efe2c8', roughness: 0.35, bump: 0.03, tintAmount: 0, veinAmount: 0, cut: '#f2e8d4' },
  'heart|pulmonary-valve': { color: '#efe2c8', roughness: 0.35, bump: 0.03, tintAmount: 0, veinAmount: 0, cut: '#f2e8d4' },
  'kidneys|capsule': { color: '#caa49c', clearcoat: 0.8, bump: 0.03, mottle: 0.04 },
  'kidneys|cortex': { color: '#7a2a22', cut: '#8e3a2e' },
  'kidneys|column': { color: '#86322a', cut: '#94402f' },
  'kidneys|pyramid': { color: '#9a4636', bump: 0.22, bumpFreq: 520, cut: '#a85440' },
  'kidneys|papilla': { color: '#b25e48', cut: '#c07058' },
  'kidneys|hilum': { color: '#d8b888', tint: '#e8cc9a', tintAmount: 0.4, cut: '#e0c49a' },
  'liver|capsule': { color: '#7e3428', clearcoat: 0.85, bump: 0.03 },
  'liver|ligaments': { color: '#e2cbb6', clearcoat: 0.4 },
  'liver|porta': { color: '#cfa080' },
  'lungs|hilum': { color: '#c08486', tintAmount: 0 },
  'airways|tracheal-rings': { color: '#efe2d0', bump: 0.06 },
  'airways|bronchial-cartilage': { color: '#efe2d0', bump: 0.06 },
  // Ak madde dıştan bakışta korteks örtüsü altında kalır (atlas ağında kıvrım aralarından görünür):
  // dış yüzü korteks tonunda, kesit yüzü beyaz çizilir — kesitte gri/ak madde karşıtlığı.
  'brain|white-matter': { color: '#bb8077', veinAmount: 0.35, cut: '#f6f0e6' },
  'brain|corpus-callosum': { color: '#ece0d0', veinAmount: 0.03, bump: 0.03, cut: '#f2ebde' },
  'brain|ventricles': { color: '#4f8fcf', clearcoat: 0.9, roughness: 0.2, veinAmount: 0, bump: 0.02, rim: '#cfeaff', rimAmount: 0.12, cut: '#7fb4d2' },
  'brain|thalamus': { color: '#b98a80', veinAmount: 0.15, cut: '#a87e76' },
  'brain|basal-nuclei': { color: '#b5877d', veinAmount: 0.15, cut: '#a07870' },
  'brain|hippocampus': { color: '#c99588', veinAmount: 0.2 },
  'brain|amygdala': { color: '#c48e80', veinAmount: 0.2 },
  'brain|cerebellum': { color: '#cc978b', bump: 0.26, bumpFreq: 420, veinAmount: 0.35 },
  'brain|midbrain': { color: '#d8b6a2', veinAmount: 0.25 },
  'brain|pons': { color: '#dbbaa6', veinAmount: 0.25 },
  'brain|medulla': { color: '#dcbea8', veinAmount: 0.25 },
  'brain|visual-pathway': { color: '#eadcb0', veinAmount: 0 },
  'brain|olfactory': { color: '#e6d4b0', veinAmount: 0 },
  'eyes|cornea': { color: '#d8ecff', clearcoat: 1, roughness: 0.05, veinAmount: 0, bump: 0, rim: '#ffffff', rimAmount: 0.15 },
  'eyes|conjunctiva': { color: '#f2d4d0', veinAmount: 0.5 },
  'eyes|iris': { color: '#5f7fa6', bump: 0.3, bumpFreq: 900, veinAmount: 0, mottle: 0.2, mottleFreq: 400, tint: '#8a6a40', tintAmount: 0.25 },
  'eyes|lens': { color: '#f0e2b0', clearcoat: 1, roughness: 0.1, veinAmount: 0, bump: 0, rimAmount: 0.12, rim: '#fff4d0' },
  'eyes|aqueous': { color: '#cfeaff', clearcoat: 1, roughness: 0.05, veinAmount: 0, bump: 0 },
  'eyes|vitreous': { color: '#e4f4ff', clearcoat: 1, roughness: 0.05, veinAmount: 0, bump: 0 },
  'eyes|retina': { color: '#c4553a', veinAmount: 0.45, veinFreq: 120, vein: '#7a1018', cut: '#d06a4a' },
  'eyes|macula': { color: '#d89a3a', veinAmount: 0 },
  'eyes|optic-disc': { color: '#f0d0a0', veinAmount: 0.3, vein: '#9a1a22' },
  'eyes|choroid': { color: '#581c1c', veinAmount: 0.35, vein: '#a0202a', cut: '#6a2424' },
  'eyes|optic-nerve': { color: '#e8dcbe', veinAmount: 0.1 },
  'eyes|muscles': { color: '#8f302b', veinAmount: 0.1, bump: 0.2, bumpFreq: 500 },
  'eyes|ciliary': { color: '#6a2a24' },
  'eyes|zonule': { color: '#e8e0c8', veinAmount: 0 },
  'lymph-node|capsule': { color: '#d8c4b4' },
  'lymph-node|follicles': { color: '#8fa8c8' },
  'lymph-node|paracortex': { color: '#a8c09a' },
  'lymph-node|medulla': { color: '#d8b48a' },
  'pancreas|ducts': { color: '#f0dca0', bump: 0.04 },
  'gallbladder|bile-ducts': { color: '#6a9a48', bump: 0.04 },
  'spleen|hilum': { color: '#d8b8a0' },
  'urinary-tract|renal-pelvis': { color: '#e6cfb8', cut: '#eedcc8' },
  'urinary-tract|calyces': { color: '#e6cfb8', cut: '#eedcc8' },
  'prostate|transition': { color: '#cc9690' },
  'prostate|central': { color: '#b87c7a' },
  'prostate|ducts': { color: '#ead8a0', bump: 0.03 },
  'large-intestine|cecum': { color: '#b05e48' },
  'bones|teeth': { color: '#f6f1e4', clearcoat: 0.8, roughness: 0.25, bump: 0.02, tintAmount: 0 },
  'breasts|fat': { color: '#f0d8b4' },
  'breasts|lobes': { color: '#e0a8a0' },
  'breasts|ducts': { color: '#ecc896' },
};

const VESSEL_STRUCTURES = new Set(['abdominal-vessels', 'renal-vessels', 'carotid-arteries', 'limb-vessels', 'eye-vessels', 'pulmonary-vessels', 'veins']);
const lookCache = new Map<string, TissueLook>();

/** Yapının (ve bölümünün) gerçekçi doku görünümü. */
export function tissueLook(structure: string, label: string | null): TissueLook {
  const key = `${structure}|${label ?? ''}`;
  const hit = lookCache.get(key);
  if (hit) return hit;
  let out: TissueLook;
  const part = label ? PART_LOOKS[key] : undefined;
  if (VESSEL_STRUCTURES.has(structure)) {
    // Akciğer damarlarında yön terstir (pulmoner ven oksijenli): palet bunu zaten bilir.
    out = colorFor(structure, label) === VEIN_COLOR || /#6b7fe0/i.test(colorFor(structure, label)) ? VEIN : ARTERY;
  } else {
    const base = STRUCTURE_LOOKS[structure] ?? look({ color: colorFor(structure, label) });
    out = part ? { ...base, ...part, cut: part.cut ?? (part.color ? shade(part.color, 0.06) : base.cut) } : base;
  }
  lookCache.set(key, out);
  return out;
}

/** Düşük donanım: tek oktav, damar ağı yok (mobil GPU'da kare hızı korunur). */
export function tissueQuality(): 'high' | 'low' {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((nav.deviceMemory ?? 8) <= 3 || (nav.hardwareConcurrency ?? 8) <= 4) return 'low';
  } catch {
    /* yok say */
  }
  return 'high';
}

/* ----------------------------------------------------------------- GLSL */

// Simplex gürültüsü ve analitik gradyanı (Ashima Arts / Stefan Gustavson, MIT lisansı — webgl-noise).
const NOISE = /* glsl */ `
varying vec3 vKhPos;
uniform float uKhFreqScale;
uniform float uKhBump, uKhBumpFreq, uKhMottle, uKhMottleFreq, uKhTintAmount, uKhVeinAmount, uKhVeinFreq, uKhRimAmount, uKhCut;
uniform vec3 uKhTint, uKhVein, uKhRim, uKhCutColor, uKhFat;
#ifdef KH_FAT
varying float vKhFat;
#endif
vec3 khMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 khMod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 khPermute(vec4 x) { return khMod289(((x * 34.0) + 10.0) * x); }
vec4 khTaylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float khNoiseGrad(vec3 v, out vec3 gradient) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = khMod289(i);
  vec4 p = khPermute(khPermute(khPermute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = khTaylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec4 temp = m2 * m * pdotx;
  gradient = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  gradient += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
  gradient *= 105.0;
  return 105.0 * dot(m4, pdotx);
}
float khNoise(vec3 v) { vec3 g; return khNoiseGrad(v, g); }
`;

const COLOR = /* glsl */ `
#include <color_fragment>
vec3 khP = vKhPos * uKhFreqScale;
float khM = khNoise(khP * uKhMottleFreq);
#ifndef KH_LOW
khM = khM * 0.65 + 0.35 * khNoise(khP * uKhMottleFreq * 2.3 + 5.1);
float khT = smoothstep(0.2, 0.62, khNoise(khP * uKhMottleFreq * 0.55 + 7.3));
diffuseColor.rgb = mix(diffuseColor.rgb, uKhTint, khT * uKhTintAmount);
// Damar ağı: bükülmüş gürültünün sıfır çizgileri (dallanan ince kıvrımlar), iki kalınlıkta.
vec3 khWp = khP * uKhVeinFreq + vec3(khM * 0.8);
float khV1 = 1.0 - smoothstep(0.0, 0.07, abs(khNoise(khWp)));
float khV2 = 1.0 - smoothstep(0.0, 0.05, abs(khNoise(khWp * 2.4 + 13.7)));
float khVm = smoothstep(-0.25, 0.35, khNoise(khP * uKhVeinFreq * 0.33 + 3.1));
diffuseColor.rgb = mix(diffuseColor.rgb, uKhVein, clamp(khV1 * khVm + 0.55 * khV2 * khVm * khVm, 0.0, 1.0) * uKhVeinAmount);
#endif
diffuseColor.rgb *= 1.0 + uKhMottle * khM;
#ifdef KH_FAT
// Epikard yağı: koroner damarların geçtiği oluklarda sarımsı, lobcuklu yağ (köşe başına uzaklıktan).
float khFatM = 0.85 * smoothstep(0.2, 0.9, vKhFat + 0.22 * khNoise(khP * uKhMottleFreq * 3.0 + 2.0));
diffuseColor.rgb = mix(diffuseColor.rgb, uKhFat * (0.9 + 0.2 * khM), khFatM);
#endif
bool khCutFace = uKhCut > 0.5 && !gl_FrontFacing;
// Kesit yüzü: doku rengi, düzleme dik ışıkta parlamasın diye biraz koyu ve mat.
if (khCutFace) diffuseColor.rgb = uKhCutColor * (0.78 + 0.08 * khM);
`;

const NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  // Kesit yüzü düzleme (kameraya) bakar; sonra her yüzeye doğal kabartı eklenir.
  if (khCutFace) normal = vec3(0.0, 0.0, 1.0);
  vec3 khG1;
  khNoiseGrad(khP * uKhBumpFreq, khG1);
  vec3 khG = khG1;
  #ifndef KH_LOW
  vec3 khG2;
  khNoiseGrad(khP * uKhBumpFreq * 2.17 + 11.0, khG2);
  khG += 0.25 * khG2;
  #endif
  #ifdef KH_FAT
  vec3 khG3;
  khNoiseGrad(khP * uKhBumpFreq * 1.6 + 4.0, khG3);
  khG += khG3 * 1.6 * khFatM;
  #endif
  vec3 khGv = (viewMatrix * vec4(khG * uKhBump * (khCutFace ? 0.3 : 1.0), 0.0)).xyz;
  normal = normalize(normal - (khGv - dot(khGv, normal) * normal));
}
`;

const RIM = /* glsl */ `
float khF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
outgoingLight += uKhRim * khF * uKhRimAmount * (khCutFace ? 0.0 : 1.0);
if (khCutFace) outgoingLight -= totalSpecular * 0.6;
#include <opaque_fragment>
`;

const VERTEX = /* glsl */ `
#include <begin_vertex>
vec4 khW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
khW = instanceMatrix * khW;
#endif
vKhPos = (modelMatrix * khW).xyz;
#ifdef KH_FAT
vKhFat = khFat;
#endif
`;

export interface TissueUniforms {
  uKhFreqScale: { value: number };
  uKhBump: { value: number };
  uKhBumpFreq: { value: number };
  uKhMottle: { value: number };
  uKhMottleFreq: { value: number };
  uKhTint: { value: Color };
  uKhTintAmount: { value: number };
  uKhVein: { value: Color };
  uKhVeinAmount: { value: number };
  uKhVeinFreq: { value: number };
  uKhRim: { value: Color };
  uKhRimAmount: { value: number };
  uKhCut: { value: number };
  uKhCutColor: { value: Color };
  uKhFat: { value: Color };
}

export type TissueMaterial = MeshPhysicalMaterial & { userData: { kh: TissueUniforms } };

/**
 * Gerçekçi doku malzemesi. `freqScale`: ağ ölçeklenerek çiziliyorsa (ör. atlas kesiti sahnesi) desenin
 * gerçek boyutu korunsun diye 1/ölçek verilir. Kesit gölgelendirmesi `setTissueCut` ile açılır.
 */
export function createTissueMaterial(l: TissueLook, opts: { quality?: 'high' | 'low'; freqScale?: number; fat?: boolean } = {}): TissueMaterial {
  const low = (opts.quality ?? tissueQuality()) === 'low';
  const m = new MeshPhysicalMaterial({
    color: l.color,
    roughness: l.roughness,
    metalness: 0,
    clearcoat: l.clearcoat,
    clearcoatRoughness: 0.32,
    sheen: l.sheen,
    sheenColor: new Color(l.sheenColor),
    sheenRoughness: 0.55,
    // Ortam (oda) yansıması sınırlı: ıslak film parlasın ama dokunun rengi beyaza kaçmasın.
    envMapIntensity: 0.55,
  }) as TissueMaterial;
  const u: TissueUniforms = {
    uKhFreqScale: { value: opts.freqScale ?? 1 },
    uKhBump: { value: l.bump },
    uKhBumpFreq: { value: l.bumpFreq },
    uKhMottle: { value: l.mottle },
    uKhMottleFreq: { value: l.mottleFreq },
    uKhTint: { value: new Color(l.tint) },
    uKhTintAmount: { value: l.tintAmount },
    uKhVein: { value: new Color(l.vein) },
    uKhVeinAmount: { value: l.veinAmount },
    uKhVeinFreq: { value: l.veinFreq },
    uKhRim: { value: new Color(l.rim) },
    uKhRimAmount: { value: l.rimAmount },
    uKhCut: { value: 0 },
    uKhCutColor: { value: new Color(l.cut) },
    uKhFat: { value: new Color('#b98c3e') },
  };
  m.userData.kh = u;
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, u);
    if (low) shader.fragmentShader = `#define KH_LOW\n${shader.fragmentShader}`;
    // Epikard yağı: geometride köşe başına "khFat" (0–1) özniteliği varsa (bkz. fatAttribute).
    const fat = opts.fat ? '#define KH_FAT\n' : '';
    shader.fragmentShader = fat + shader.fragmentShader;
    shader.vertexShader = fat + shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vKhPos;${opts.fat ? '\nattribute float khFat;\nvarying float vKhFat;' : ''}`).replace('#include <begin_vertex>', VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', COLOR)
      .replace('#include <normal_fragment_maps>', NORMAL)
      .replace('#include <opaque_fragment>', RIM);
  };
  m.customProgramCacheKey = () => `kh-tissue${low ? '-low' : ''}${opts.fat ? '-fat' : ''}`;
  return m;
}

/** Kesit gölgelendirmesi: arka yüzler (kırpma düzleminin açtığı iç) dolu kesit gibi çizilir. */
export function setTissueCut(m: TissueMaterial, on: boolean) {
  m.userData.kh.uKhCut.value = on ? 1 : 0;
}

/**
 * İç dünya (lümen) duvarı: sahne biriminde (lümen yarıçapı ≈ 1–1,6 birim) ıslak mukoza. Kolonoskopi ve
 * endoskopide görüldüğü gibi parlak sıvı film, mukozanın altından görünen ince damar ağı ve astar türüne
 * göre yüzey dokusu (villus kadifesi, rugae, trabekül…). Eğitimsel temsildir.
 */
export function lumenLook(lining: string, color: string): TissueLook {
  // Canlı mukoza: tanımdaki tondan daha doygun ve koyu (endoskopideki kırmızı-pembe).
  const c = new Color(color);
  c.offsetHSL(-0.01, 0.18, -0.07);
  color = `#${c.getHexString()}`;
  const base = { color, cut: color, mottleFreq: 1.6, veinFreq: 3.2, bumpFreq: 14, rim: '#ff7a60', rimAmount: 0.05 };
  switch (lining) {
    case 'haustra':
    case 'mucosa':
      return look({ ...base, roughness: 0.48, clearcoat: 0.95, sheen: 0.2, bump: 0.06, mottle: 0.12, veinAmount: 0.85, veinFreq: 2.4, vein: '#7e1220' });
    case 'villi':
    case 'folds':
      return look({ ...base, roughness: 0.55, clearcoat: 0.35, sheen: 0.7, sheenColor: '#ffe2d6', bump: 0.28, bumpFreq: 34, mottle: 0.1, veinAmount: 0.15, vein: '#a8303a' });
    case 'rugae':
      return look({ ...base, roughness: 0.32, clearcoat: 0.9, sheen: 0.25, bump: 0.12, mottle: 0.12, veinAmount: 0.3, vein: '#94202a' });
    case 'trabeculae':
      return look({ ...base, roughness: 0.4, clearcoat: 0.7, sheen: 0.1, bump: 0.2, bumpFreq: 9, mottle: 0.14, veinAmount: 0 });
    case 'smooth':
      return look({ ...base, roughness: 0.2, clearcoat: 1, sheen: 0.1, bump: 0.03, mottle: 0.06, veinAmount: 0.06, vein: '#7a1a20' });
    case 'cilia':
      return look({ ...base, roughness: 0.35, clearcoat: 0.85, sheen: 0.3, bump: 0.1, mottle: 0.1, veinAmount: 0.35, vein: '#a83040' });
    case 'urothelium':
    case 'squamous':
      return look({ ...base, roughness: 0.35, clearcoat: 0.8, sheen: 0.2, bump: 0.1, mottle: 0.1, veinAmount: 0.3, vein: '#a83040' });
    default:
      return look({ ...base, roughness: 0.35, clearcoat: 0.8, sheen: 0.2, bump: 0.1, mottle: 0.1, veinAmount: 0.25 });
  }
}

/** İçerik (dışkı, kimus, lokma…) ve hücre parçacıkları: renk örnek başına (instanceColor) gelir. */
export function contentLook(kind: string): TissueLook {
  const lumpy = kind === 'feces' || kind === 'bolus' || kind === 'chyme';
  return look({
    color: '#ffffff',
    cut: '#ffffff',
    roughness: lumpy ? 0.7 : 0.35,
    clearcoat: lumpy ? 0.2 : 0.6,
    sheen: 0,
    bump: lumpy ? 0.45 : 0.05,
    bumpFreq: lumpy ? 9 : 4,
    mottle: lumpy ? 0.22 : 0.05,
    mottleFreq: 4,
    rimAmount: 0.03,
  });
}
