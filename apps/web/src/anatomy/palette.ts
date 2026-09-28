import { type SystemId, structureById } from '@kh/catalog';
import { isVein } from './names';

/** Yapı renkleri: gerçekçi olmaktan çok ayırt edilebilir ve koyu zeminde okunur. */
const COLORS: Record<string, string> = {
  skin: '#d9b8a3',
  bones: '#ddd5c4',
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

export function colorFor(structure: string, label: string | null): string {
  if (label) {
    const pc = PART_COLORS[`${structure}|${label}`];
    if (pc) return pc;
    // Akciğer damarlarında yön terstir: pulmoner arter oksijensiz, pulmoner ven oksijenli kan taşır.
    if (structure === 'pulmonary-vessels') return /vein/.test(label) ? '#e0505a' : '#6b7fe0';
    if (isVein(label)) return VEIN_COLOR;
    if (/artery|aorta|trunk|arch|branch/.test(label)) return COLORS[structure] ?? ARTERY_COLOR;
  }
  return COLORS[structure] ?? '#b0a8a0';
}

/** Vurgu renkleri (sonuç durumuna göre). */
export const HIGHLIGHT = {
  high: '#f5b14c',
  low: '#6aa8ff',
  mixed: '#c58cff',
} as const;

/** Yön (renk tonu) × derece (hafif / orta / belirgin). Belirgin yükseklik kırmızıya kayar. */
const HIGHLIGHT_SCALE: Record<keyof typeof HIGHLIGHT, [string, string, string]> = {
  high: ['#f5c96a', '#f59a3c', '#ef5a4c'],
  low: ['#9cc6ff', '#6aa8ff', '#6275ff'],
  mixed: ['#d4b0ff', '#c58cff', '#a66bff'],
};

/** score: 0–3 (yorum motorunun derece ağırlığı). */
export function highlightColor(status: keyof typeof HIGHLIGHT, score: number): string {
  return HIGHLIGHT_SCALE[status][score >= 3 ? 2 : score >= 2 ? 1 : 0];
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
