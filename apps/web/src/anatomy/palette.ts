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
};

export const VEIN_COLOR = '#4a6fd6';
export const ARTERY_COLOR = '#d4454f';

export function colorFor(structure: string, label: string | null): string {
  if (label) {
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
