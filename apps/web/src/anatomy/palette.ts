import { Color } from 'three';
import { type SystemId, structureById } from '@kh/catalog';
import { isVein } from './names';
import { TONE_HEX } from '../lib/tone';

/** Yapı renkleri: gerçekçi olmaktan çok ayırt edilebilir ve koyu zeminde okunur. */
const COLORS: Record<string, string> = {
  skin: '#d9b8a3',
  bones: '#ddd5c4',
  joints: '#e6d9b8',
  mouth: '#d98a8a',
  heart: '#b8484f',
  'coronary-arteries': '#e0505a',
  aorta: '#d4454f',
  'carotid-arteries': '#d4454f',
  'pulmonary-vessels': '#c85a8a',
  veins: '#4a6fd6',
  'renal-vessels': '#d4454f',
  'abdominal-vessels': '#d4454f',
  'eye-vessels': '#e0505a',
  lungs: '#e6a4ad',
  airways: '#e8d2c0',
  liver: '#8e3b2f',
  gallbladder: '#5c8c3a',
  pancreas: '#e8c07a',
  'small-intestine': '#e6a07f',
  'large-intestine': '#c98664',
  kidneys: '#9c3d3a',
  'urinary-tract': '#d9c26a',
  prostate: '#c7899a',
  brain: '#e8b8b0',
  'spinal-cord': '#f2e2b0',
  spleen: '#7a2f45',
  thymus: '#c9a08a',
  thyroid: '#c77fb4',
  pituitary: '#b98cf0',
  hypothalamus: '#9d7fe0',
  adrenals: '#d9a441',
  'skeletal-muscle': '#b4574e',
  stomach: '#e59a7c',
  esophagus: '#d98a78',
  eyes: '#eef0f2',
  testes: '#e3b1c4',
  'male-genitals': '#d59aae',
  pineal: '#b38ce6',
  nerves: '#f2d77a',
  ear: '#e8d8b8',
  tonsils: '#d98aa0',
  'lymph-node': '#9fd6b4',
  knee: '#dfe8f0',
  diaphragm: '#b35a52',
  ovaries: '#e8a0c0',
  uterus: '#d88aa0',
  'fallopian-tubes': '#e7a7bf',
  vagina: '#d98fa5',
  breasts: '#e9c2b0',
};

/**
 * Bölüm renkleri: atlaslardaki gibi komşu bölümler ayırt edilsin. Kalpte sağ taraf (oksijeni azalmış
 * kan) mavimsi, sol taraf kırmızı; beyinde loblar farklı tonlarda; gözde katmanlar gerçek renklerine yakın.
 */
const PART_COLORS: Record<string, string> = {
  // Anatomi paketi bölümleri
  'skeletal-muscle|fascia': '#e8e0d0',
  'skeletal-muscle|bursae': '#c8d8e8',
  'skeletal-muscle|tendon-sheaths': '#d8e4ea',
  'joints|spine': '#e8dcc0',
  'brain|meninges': '#d8c8b8',
  'spinal-cord|meninges': '#d8c8b8',
  'airways|sinuses': '#a8d8e8',
  'airways|nasal-cavity': '#e8a8a8',
  'airways|larynx-cartilages': '#d8e8f0',
  'mouth|tongue': '#d87880',
  'mouth|palate': '#e09098',
  'mouth|gingiva': '#e8a0a8',
  'mouth|salivary': '#e8c890',
  'mouth|pharynx': '#d88888',
  'thyroid|gland': '#c77fb4',
  'thyroid|parathyroid': '#e0a040',
  'ear|auricle': '#d9b8a3',
  'ear|auditory-tube': '#d8a8a8',
  'heart|right-atrium': '#7a6fb8',
  'heart|right-ventricle': '#8a6fae',
  'heart|left-atrium': '#c4565e',
  'heart|left-ventricle': '#b8484f',
  'heart|septum': '#a4545c',
  'heart|tricuspid': '#f0e0b8',
  'heart|mitral': '#f0e0b8',
  'heart|aortic-valve': '#f5e8c8',
  'heart|pulmonary-valve': '#f5e8c8',
  'heart|papillary': '#d9707a',
  'brain|frontal': '#e8b8b0',
  'brain|motor': '#f09a86',
  'brain|sensory': '#f2c07a',
  'brain|parietal': '#c9b4e6',
  'brain|temporal': '#9fcfe0',
  'brain|auditory': '#6fb8e6',
  'brain|occipital': '#a8d8a0',
  'brain|insula': '#e6d28a',
  'brain|cingulate': '#e6a0c8',
  'brain|hippocampus': '#f28aa0',
  'brain|amygdala': '#f06a78',
  'brain|basal-nuclei': '#8ab4f0',
  'brain|thalamus': '#b08af0',
  'brain|midbrain': '#d6a6f0',
  'brain|pons': '#c8a0d8',
  'brain|medulla': '#b89ac8',
  'brain|cerebellum': '#f0c8a8',
  'brain|ventricles': '#7ad6f0',
  'brain|corpus-callosum': '#f5f0e0',
  'brain|visual-pathway': '#f5e66a',
  'brain|olfactory': '#9ae0c0',
  'brain|white-matter': '#efe8dc',
  'eyes|sclera': '#f2f2ee',
  'eyes|cornea': '#cfe8ff',
  'eyes|conjunctiva': '#f6d8d8',
  'eyes|iris': '#6b8fb8',
  'eyes|lens': '#f5e6a8',
  'eyes|zonule': '#e8e0c8',
  'eyes|ciliary': '#9a5a48',
  'eyes|aqueous': '#bfe6ff',
  'eyes|vitreous': '#dff2ff',
  'eyes|retina': '#e0704a',
  'eyes|macula': '#f2c040',
  'eyes|optic-disc': '#f5d8a0',
  'eyes|choroid': '#7a2a2a',
  'eyes|optic-nerve': '#f2d77a',
  'eyes|muscles': '#b4574e',
  'kidneys|capsule': '#c9a09a',
  'kidneys|cortex': '#9c3d3a',
  'kidneys|column': '#a84a44',
  'kidneys|pyramid': '#c86a5a',
  'kidneys|papilla': '#e0907a',
  'kidneys|hilum': '#b8807a',
  'lungs|right-upper': '#eab0b8',
  'lungs|right-middle': '#e8a0c0',
  'lungs|right-lower': '#e4a4a4',
  'lungs|left-upper': '#ecb4a8',
  'lungs|left-lower': '#e2a0b0',
  'lungs|hilum': '#c88a90',
  'liver|capsule': '#a8554a',
  'liver|right-lobe': '#8e3b2f',
  'liver|left-lobe': '#a4483a',
  'liver|caudate': '#b85a48',
  'liver|quadrate': '#c26a52',
  'liver|ligaments': '#e8d0c0',
  'liver|porta': '#d9a080',
  'gallbladder|bile-ducts': '#7aa84a',
  'pancreas|ducts': '#f5e0a0',
  'large-intestine|cecum': '#d99a74',
  'lymph-node|capsule': '#cde8d8',
  'lymph-node|follicles': '#6fb8e6',
  'lymph-node|paracortex': '#8ad6a0',
  'lymph-node|medulla': '#e6c08a',
  'lymph-node|afferent': '#e6e0a0',
  'lymph-node|efferent': '#e6e0a0',
  'lymph-node|vessels': '#d4454f',
  'knee|meniscus': '#e8f0f5',
  'knee|cartilage': '#c8e0f0',
  'knee|acl': '#e8c898',
  'knee|pcl': '#e0b888',
  'knee|collateral': '#e8d0a8',
  'knee|patellar': '#e8d0a8',
  'prostate|transition': '#d8a0b0',
  'prostate|central': '#b87890',
  'prostate|ducts': '#f0d890',
  'urinary-tract|urethra': '#e0c870',
  'uterus|ligaments': '#e8c8d0',
  'uterus|cervix': '#c77890',
  'breasts|fat': '#f0dcc0',
  'breasts|lobes': '#e8a0a8',
  'breasts|ducts': '#f0c890',
  'breasts|nipple': '#c98a78',
  'breasts|ligaments': '#f2e8e0',
  'ear|cochlea': '#f0c8a0',
  'ear|canals': '#a8d8f0',
  'ear|vestibule': '#c8e0a8',
  'ear|eardrum': '#f2e0c8',
  'ear|ossicles': '#f5f0e0',
  'ear|canal': '#e8c0a8',
  'bones|teeth': '#fbf8ef',
};

/** Tek başına saydam çizilen bölümler (dış kılıflar, saydam ortamlar): içleri görünsün. */
export const PART_OPACITY: Record<string, number> = {
  // Anatomi paketi: fasyalar ve sinoviyal keseler kasların üstünü örtmesin
  'skeletal-muscle|fascia': 0.22,
  'skeletal-muscle|bursae': 0.5,
  'skeletal-muscle|tendon-sheaths': 0.5,
  'joints|spine': 0.85,
  'ear|auricle': 0.85,
  'brain|meninges': 0.25,
  'spinal-cord|meninges': 0.3,
  'airways|sinuses': 0.45,
  'eyes|cornea': 0.4,
  'eyes|conjunctiva': 0.25,
  'eyes|aqueous': 0.25,
  'eyes|vitreous': 0.22,
  'eyes|sclera': 0.72,
  'eyes|lens': 0.75,
  'kidneys|capsule': 0.35,
  'liver|capsule': 0.45,
  'lymph-node|capsule': 0.3,
  'breasts|fat': 0.35,
  'uterus|ligaments': 0.45,
  'urinary-tract|bladder': 0.75,
};

export const VEIN_COLOR = '#4a6fd6';
export const ARTERY_COLOR = '#d4454f';

/**
 * Gerçekçi görünüm renkleri (koyu, ıslak doku tonları; ışık ve ton eşleme bunları açar). Atlas
 * geleneği korunur: atardamar kırmızı, toplardamar mavi, sinir sarı, lenf yeşilimsi.
 */
const REAL_COLORS: Record<string, string> = {
  skin: '#c99278',
  bones: '#cdbf9f',
  joints: '#cfd3cc',
  mouth: '#b85a5e',
  heart: '#5c0d10',
  'coronary-arteries': '#a3121a',
  aorta: '#9a141b',
  'carotid-arteries': '#a3121a',
  'pulmonary-vessels': '#9a141b',
  veins: '#24398f',
  'renal-vessels': '#a3121a',
  'abdominal-vessels': '#a3121a',
  'eye-vessels': '#a3121a',
  'limb-vessels': '#a3121a',
  lungs: '#d0848c',
  airways: '#d8b8a6',
  liver: '#521610',
  gallbladder: '#3a6428',
  pancreas: '#d8a585',
  'small-intestine': '#d48a72',
  'large-intestine': '#b87358',
  kidneys: '#6e2019',
  'urinary-tract': '#d8b0a0',
  prostate: '#a8666e',
  brain: '#c28e86',
  'spinal-cord': '#e2cfa0',
  spleen: '#55152a',
  thymus: '#c99a7e',
  thyroid: '#8e2c36',
  pituitary: '#b87868',
  hypothalamus: '#c08a84',
  adrenals: '#cf9438',
  'skeletal-muscle': '#94241b',
  stomach: '#cc7a68',
  esophagus: '#b86a5e',
  eyes: '#ece8e2',
  testes: '#d8a8b0',
  'male-genitals': '#c08088',
  pineal: '#b88a80',
  nerves: '#e8cc6a',
  ear: '#dcc4a8',
  tonsils: '#c06878',
  'lymph-node': '#c9a493',
  knee: '#d4dade',
  diaphragm: '#8a241e',
  ovaries: '#dca2ae',
  uterus: '#b86672',
  'fallopian-tubes': '#d48e9e',
  vagina: '#c27884',
  breasts: '#dcae94',
};
const REAL_ARTERY = '#a3121a';
/** Gerçekçi görünümde atlas renginin yerine geçen bölüm renkleri (ör. karıncıklar koyu boşluk). */
const REAL_PART: Record<string, string> = {
  'brain|ventricles': '#4a3f3c',
  'brain|visual-pathway': '#e6dccb',
  'brain|olfactory': '#e6dccb',
  // Atlas renkleri yerine gerçek doku tonları
  'urinary-tract|urethra': '#d8a898',
  'urinary-tract|bladder': '#d89a8c',
  'prostate|ducts': '#cfae96',
  'kidneys|capsule': '#7a2a22',
  'kidneys|hilum': '#a8645a',
  'lymph-node|capsule': '#d6b4a4',
  'lymph-node|afferent': '#e6dccb',
  'lymph-node|efferent': '#e6dccb',
};
const REAL_VEIN = '#24398f';
/** Gerçekçi görünümde atlas renklendirmesi yapılmayan bölümler (gerçekte aynı dokudan, aynı renkte). */
const REAL_UNIFORM = /^(heart\|(right|left|septum|papillary)|brain\|(?!white-matter|corpus-callosum|ventricles|visual-pathway)|lungs\||liver\|(right|left|caudate|quadrate|capsule)|lymph-node\|(follicles|paracortex|medulla)|prostate\|(transition|central))/;

export type ColorLook = 'real' | 'atlas';

export function colorFor(structure: string, label: string | null, look: ColorLook = 'atlas'): string {
  const real = look === 'real';
  if (label) {
    const key = `${structure}|${label}`;
    if (real && REAL_PART[key]) return REAL_PART[key];
    const pc = PART_COLORS[key];
    if (pc && !(real && REAL_UNIFORM.test(key))) return pc;
    // Akciğer damarlarında yön terstir: pulmoner arter oksijensiz, pulmoner ven oksijenli kan taşır.
    if (structure === 'pulmonary-vessels') return /vein/.test(label) ? (real ? REAL_ARTERY : '#e0505a') : real ? REAL_VEIN : '#6b7fe0';
    if (isVein(label)) return real ? REAL_VEIN : VEIN_COLOR;
    if (/artery|aorta|trunk|arch|branch/.test(label)) return (real ? REAL_COLORS : COLORS)[structure] ?? (real ? REAL_ARTERY : ARTERY_COLOR);
  }
  return (real ? REAL_COLORS[structure] : undefined) ?? COLORS[structure] ?? '#b0a8a0';
}

/** Vurgu renkleri (sonuç durumuna göre) — tek kaynak `lib/tone.ts` (TONE_HEX). */
export const HIGHLIGHT = { high: TONE_HEX.high, low: TONE_HEX.low, mixed: TONE_HEX.mixed } as const;

/** score: 0–3 (yorum motorunun derece ağırlığı). */
export function highlightColor(status: keyof typeof HIGHLIGHT, score: number): string {
  return TONE_HEX.scale[status][score >= 3 ? 2 : score >= 2 ? 1 : 0];
}

/**
 * Katman düğmeleri için yapının "birincil" sistemi. Kan ve kemik iliği (hematolojik) bir
 * katman değildir: kemik iliği omurgada, dalakta vb. gösterilir.
 */
export function primarySystem(structure: string): SystemId | null {
  const s = structureById.get(structure);
  if (!s) return null;
  return s.systems[0] ?? null;
}

export const LAYER_SYSTEMS: SystemId[] = [
  'cardiovascular',
  'respiratory',
  'digestive',
  'urinary',
  'endocrine',
  'nervous',
  'musculoskeletal',
  'immune',
];

/** Saydam çizilen yapılar (içindekiler görünsün). */
export const TRANSLUCENT: Record<string, number> = {
  lungs: 0.38,
  airways: 0.7,
  // Tam iskelet organların önünde durur (kaburgalar, kafatası): yarı saydam
  bones: 0.5,
  'skeletal-muscle': 0.82,
};

const adaptedCache = new Map<string, string>();
/**
 * Erkek referansından uyarlanan yapılar (kadın vücudunda): rengi mora doğru kaydırılır ki kendi
 * kaynağından gelen yapılardan ayırt edilsin. Panelde ayrıca "Erkek referansından uyarlanmıştır" yazar.
 */
export function adaptedColor(hex: string): string {
  let out = adaptedCache.get(hex);
  if (!out) {
    const c = new Color(hex).lerp(new Color('#8f7cf0'), 0.38);
    out = `#${c.getHexString()}`;
    adaptedCache.set(hex, out);
  }
  return out;
}
