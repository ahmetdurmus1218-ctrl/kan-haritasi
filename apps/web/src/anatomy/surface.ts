import { useSyncExternalStore } from 'react';
import { Color, type MeshPhysicalMaterial, Vector3 } from 'three';

/**
 * Gerçekçi yüzey: modellerde boyalı doku (texture) yoktur; dokusuz kaynaklarda gerçekçi görünüm
 * fiziksel malzeme (ıslak parlaklık katmanı = clearcoat) ve UV gerektirmeyen dünya uzayı gürültüsüyle
 * elde edilir. Gürültü hem renge hafif değişim hem de yüzey normaline kabartma verir (kas lifi,
 * kemik gözenekleri, akciğer süngerimsi dokusu…). Uzaktan bakınca kabartma söner (titreşim olmasın).
 * Bu yalnızca görünümdür: anatomik şekil ve ölçüler kaynak modellerdendir.
 */

export type Surface = 'myocardium' | 'vessel' | 'muscle' | 'tendon' | 'bone' | 'tooth' | 'cartilage' | 'organ' | 'gut' | 'lung' | 'brain' | 'nerve' | 'gland' | 'clear' | 'fat';

interface Noise {
  /** Gürültü sıklığı (1/metre). */
  scale: number;
  /** Eksen başına sıklık çarpanı (ör. kas lifleri uzunlamasına). */
  stretch: [number, number, number];
  /** Kabartma gücü. */
  amp: number;
  /** Renk değişimi. */
  tint: number;
}

interface SurfaceSpec {
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen?: number;
  noise: Noise | null;
}

const n = (scale: number, amp: number, tint: number, stretch: [number, number, number] = [1, 1, 1]): Noise => ({ scale, amp, tint, stretch });

export const SURFACES: Record<Surface, SurfaceSpec> = {
  myocardium: { roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.32, noise: n(150, 0.3, 0.14, [1, 1.6, 1]) },
  vessel: { roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.28, noise: n(160, 0.18, 0.12) },
  muscle: { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, noise: n(55, 0.55, 0.28, [3.5, 0.45, 3.5]) },
  tendon: { roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.25, sheen: 0.4, noise: n(70, 0.3, 0.1, [3, 0.5, 3]) },
  bone: { roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.5, noise: n(95, 0.3, 0.12) },
  tooth: { roughness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.15, noise: null },
  cartilage: { roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.3, noise: n(120, 0.12, 0.08) },
  organ: { roughness: 0.46, clearcoat: 0.4, clearcoatRoughness: 0.34, noise: n(85, 0.35, 0.18) },
  gut: { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, noise: n(70, 0.45, 0.2, [1.4, 1.4, 1.4]) },
  lung: { roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.5, noise: n(140, 0.4, 0.22) },
  brain: { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35, noise: n(60, 0.55, 0.2) },
  nerve: { roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3, sheen: 0.3, noise: n(150, 0.15, 0.08, [3, 0.4, 3]) },
  gland: { roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.3, noise: n(130, 0.35, 0.18) },
  clear: { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, noise: null },
  fat: { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, noise: n(110, 0.4, 0.16) },
};

const VESSEL = new Set(['coronary-arteries', 'aorta', 'carotid-arteries', 'pulmonary-vessels', 'veins', 'renal-vessels', 'abdominal-vessels', 'eye-vessels', 'limb-vessels']);
const GUT = new Set(['small-intestine', 'large-intestine', 'stomach', 'esophagus', 'urinary-tract', 'uterus', 'fallopian-tubes', 'vagina']);
const GLAND = new Set(['thyroid', 'pituitary', 'hypothalamus', 'adrenals', 'pancreas', 'thymus', 'tonsils', 'lymph-node', 'pineal', 'prostate', 'testes', 'ovaries', 'spleen']);

/** Yapının yüzey türü. `name`: bölüm ya da tek yapı adı (küçük harf, İngilizce olabilir). */
export function surfaceFor(structure: string, name: string | null): Surface {
  const s = name ?? '';
  if (structure === 'bones') return /teeth|tooth|incisor|canine|molar|premolar/.test(s) ? 'tooth' : 'bone';
  if (structure === 'joints' || structure === 'knee') return /ligament|acl|pcl|collateral|patellar|menisc/.test(s) ? 'tendon' : 'cartilage';
  if (structure === 'heart') return /valve|mitral|tricuspid|chorda/.test(s) ? 'tendon' : 'myocardium';
  if (VESSEL.has(structure)) return 'vessel';
  if (structure === 'skeletal-muscle') return /fascia|tendon|aponeuros|retinacul|bursa|sheath/.test(s) ? 'tendon' : 'muscle';
  if (structure === 'diaphragm') return 'muscle';
  if (structure === 'lungs') return 'lung';
  if (structure === 'airways') return /cartilage|larynx/.test(s) ? 'cartilage' : 'gut';
  if (structure === 'brain' || structure === 'spinal-cord') return /meninges|ventricle/.test(s) ? 'clear' : 'brain';
  if (structure === 'nerves') return 'nerve';
  if (structure === 'eyes') return /cornea|lens|aqueous|vitreous/.test(s) ? 'clear' : /muscle/.test(s) ? 'muscle' : /nerve/.test(s) ? 'nerve' : 'cartilage';
  if (structure === 'breasts') return /fat/.test(s) ? 'fat' : 'gland';
  if (GUT.has(structure)) return 'gut';
  if (GLAND.has(structure)) return 'gland';
  if (structure === 'ear') return /canal|cochlea|vestibule/.test(s) ? 'clear' : 'cartilage';
  return 'organ';
}

/* ------------------------------------------------------------------ gürültü gölgelendiricisi */

const NOISE_GLSL = /* glsl */ `
  float khH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float khN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(khH(i), khH(i + vec3(1,0,0)), f.x), mix(khH(i + vec3(0,1,0)), khH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(khH(i + vec3(0,0,1)), khH(i + vec3(1,0,1)), f.x), mix(khH(i + vec3(0,1,1)), khH(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float khF(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * khN(p); p *= 2.07; a *= 0.5; } return s; }
`;

/** Malzemenin kesit yüzü rengi (kesit açıkken iç / arka yüzler bu renkte: dokunun kesilmiş yüzü gibi). */
export function setCutColor(mat: MeshPhysicalMaterial, hex: string) {
  const u = (mat.userData.khCut ??= { value: new Color(hex) }) as { value: Color };
  u.value.set(hex);
}

/**
 * Gölgelendirici eki: (1) kesit yüzü rengi — arka yüz (kesitte görünen iç taraf) ayrı renkte çizilir;
 * (2) `noise` verilirse yüzey gürültüsü (renk değişimi + kabartma). Aynı kodu paylaşan tüm malzemeler
 * tek gölgelendirici programı kullanır.
 */
function inject(mat: MeshPhysicalMaterial, noise: Noise | null) {
  mat.userData.khCut ??= { value: new Color('#b07a70') };
  const uniforms = noise
    ? {
        uKhScale: { value: noise.scale },
        uKhStretch: { value: new Vector3(...noise.stretch) },
        uKhAmp: { value: noise.amp },
        uKhTint: { value: noise.tint },
      }
    : null;
  if (uniforms) mat.userData.khNoise = uniforms;
  else delete mat.userData.khNoise;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uKhCut = mat.userData.khCut;
    if (uniforms) Object.assign(sh.uniforms, mat.userData.khNoise);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uKhCut;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n        if (!gl_FrontFacing) diffuseColor.rgb = uKhCut;');
    if (!uniforms) return;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKhW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvKhW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vKhW;\nuniform float uKhScale, uKhAmp, uKhTint;\nuniform vec3 uKhStretch;\n${NOISE_GLSL}`)
      .replace(
        'if (!gl_FrontFacing) diffuseColor.rgb = uKhCut;',
        `if (!gl_FrontFacing) diffuseColor.rgb = uKhCut;
        vec3 khP = vKhW * uKhScale * uKhStretch;
        // Ekranda bir gürültü hücresi pikselden küçükse ayrıntı söner (uzaktan titreşim/kumlanma olmasın)
        float khFade = clamp(1.6 - length(fwidth(khP)) * 1.4, 0.0, 1.0);
        float khV = khF(khP);
        diffuseColor.rgb *= mix(1.0, mix(1.0 - uKhTint, 1.0 + uKhTint * 0.6, khV), khFade);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (khFade > 0.0) {
          float e = 0.35;
          vec3 g = vec3(khF(khP + vec3(e, 0, 0)) - khV, khF(khP + vec3(0, e, 0)) - khV, khF(khP + vec3(0, 0, e)) - khV) / e;
          vec3 gv = (viewMatrix * vec4(g * uKhStretch, 0.0)).xyz;
          normal = normalize(normal - uKhAmp * khFade * (gv - dot(gv, normal) * normal));
        }`,
      );
  };
  mat.customProgramCacheKey = () => (uniforms ? 'kh-organic-2' : 'kh-plain-2');
}

/** Malzemeyi yüzey türüne göre ayarlar. `detail`: false ise gürültü kapalı (hafif kip). */
export function applySurface(mat: MeshPhysicalMaterial, surface: Surface, detail: boolean) {
  const s = SURFACES[surface];
  mat.roughness = s.roughness;
  mat.metalness = 0;
  mat.clearcoat = s.clearcoat;
  mat.clearcoatRoughness = s.clearcoatRoughness;
  mat.sheen = s.sheen ?? 0;
  mat.sheenRoughness = 0.6;
  inject(mat, detail ? s.noise : null);
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------ görünüm tercihi */

export type AnatomyLook = 'real' | 'atlas';
export type SurfaceQuality = 'high' | 'lite';

interface LookState {
  look: AnatomyLook;
  quality: SurfaceQuality;
}

const LOOK_KEY = 'kh-anatomy-look';

/** Telefon ve tabletlerde varsayılan hafif kip (yüzey gürültüsü kapalı); kullanıcı açabilir. */
function defaultQuality(): SurfaceQuality {
  try {
    const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
    const mem = (globalThis.navigator as Navigator & { deviceMemory?: number } | undefined)?.deviceMemory;
    return coarse || (mem !== undefined && mem < 4) ? 'lite' : 'high';
  } catch {
    return 'high';
  }
}

function readLook(): LookState {
  const base: LookState = { look: 'real', quality: defaultQuality() };
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(LOOK_KEY) ?? 'null') as Partial<LookState> | null;
    if (v && (v.look === 'real' || v.look === 'atlas')) base.look = v.look;
    if (v && (v.quality === 'high' || v.quality === 'lite')) base.quality = v.quality;
  } catch {
    /* varsayılan */
  }
  return base;
}

let lookState: LookState = readLook();
const lookListeners = new Set<() => void>();

export function setLook(patch: Partial<LookState>) {
  lookState = { ...lookState, ...patch };
  try {
    globalThis.localStorage?.setItem(LOOK_KEY, JSON.stringify(lookState));
  } catch {
    /* yalnız bu oturum */
  }
  for (const l of lookListeners) l();
}

export function useLook(): LookState {
  return useSyncExternalStore(
    (l) => {
      lookListeners.add(l);
      return () => lookListeners.delete(l);
    },
    () => lookState,
    () => lookState,
  );
}
