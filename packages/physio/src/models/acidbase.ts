import { lastOf } from '../run';
import type { SimModel } from '../types';

/** Henderson–Hasselbalch: pH = 6,1 + log₁₀(HCO₃⁻ / (0,03 · pCO₂)). */
export const hhPh = (hco3: number, pco2: number): number => 6.1 + Math.log10(Math.max(0.1, hco3) / (0.03 * Math.max(1, pco2)));

/**
 * Metabolik bozuklukta beklenen solunumsal telafi (pCO₂ hedefi). Asidozda ΔpCO₂ ≈ 1,2 · ΔHCO₃⁻; bu kural
 * HCO₃⁻ 5–20 mmol/L arasında Winter formülüyle (1,5 · HCO₃⁻ + 8) ± 2 mmHg içinde aynı sonucu verir ve
 * normal değerde (24 → 40) süreklidir.
 */
export function expectedPco2(hco3: number): number {
  return hco3 <= 24 ? 40 - 1.2 * (24 - hco3) : 40 + 0.7 * (hco3 - 24);
}

/** Solunumsal bozuklukta böbreğin KRONİK telafisiyle beklenen HCO₃⁻. */
export function chronicHco3(pco2: number): number {
  return pco2 >= 40 ? 24 + 0.35 * (pco2 - 40) : 24 - 0.5 * (40 - pco2);
}
/** AKUT (tamponlama) yanıtı. */
export function acuteHco3(pco2: number): number {
  return pco2 >= 40 ? 24 + 0.1 * (pco2 - 40) : 24 - 0.2 * (40 - pco2);
}

const START = 6; // saat: bozukluk başlar

/** Asit-baz bozukluğu ve telafisi. Durum: [HCO₃⁻ (mmol/L), pCO₂ (mmHg), böbrek telafisi bileşeni]; zaman: saat. */
export const acidbase: SimModel = {
  id: 'asit-baz',
  title: 'Asit-baz dengesi ve telafi',
  question: 'Kanın pH\'sı nasıl korunur; akciğer ve böbrek bir bozukluğu nasıl telafi eder?',
  system: 'Solunum · üriner',
  organs: ['lungs', 'kidneys'],
  interior: 'kidneys',
  relatedTests: ['ph', 'pco2', 'hco3', 'base-excess', 'lactate', 'chloride', 'sodium', 'potassium'],
  timeUnit: 'saat',
  dt: 0.02,
  duration: 120,
  sampleEvery: 0.5,
  pace: 10,
  panels: ['pH', 'pCO₂ (mmHg) · HCO₃⁻ (mmol/L)'],
  series: [
    { key: 'ph', label: 'pH', unit: '', panel: 0, color: 'a', decimals: 2 },
    { key: 'pco2', label: 'pCO₂', unit: 'mmHg', panel: 1, color: 'b', decimals: 0 },
    { key: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', panel: 1, color: 'c', decimals: 0 },
  ],
  params: [
    { key: 'dh', label: 'Metabolik değişim (HCO₃⁻)', unit: 'mmol/L', min: -18, max: 16, step: 1, value: 0, hint: 'Eksi: asit yükü ya da bikarbonat kaybı; artı: asit kaybı' },
    { key: 'pc', label: 'Akciğerin belirlediği pCO₂', unit: 'mmHg', min: 20, max: 80, step: 1, value: 40, hint: '40 = birincil solunum bozukluğu yok' },
    { key: 'comp', label: 'Telafi', unit: '0 kapalı · 1 açık', min: 0, max: 1, step: 1, value: 1 },
  ],
  scenarios: [
    { id: 'met-asidoz', label: 'Metabolik asidoz', note: 'HCO₃⁻ düşer, pH düşer; solunum artarak pCO₂\'yi saatler içinde Winter formülünün öngördüğü değere indirir (pH kısmen düzelir).', set: { dh: -12 } },
    { id: 'met-alkaloz', label: 'Metabolik alkaloz', note: 'HCO₃⁻ artar, pH yükselir; solunum yavaşlayarak pCO₂\'yi sınırlı ölçüde yükseltir.', set: { dh: 10 } },
    { id: 'sol-asidoz', label: 'Solunumsal asidoz', note: 'pCO₂ yükselir, pH hızla düşer; böbrek günler içinde HCO₃⁻ tutarak pH\'yı kısmen düzeltir (akut → kronik).', set: { pc: 60 } },
    { id: 'sol-alkaloz', label: 'Solunumsal alkaloz', note: 'pCO₂ düşer, pH yükselir; böbrek günler içinde HCO₃⁻ atar.', set: { pc: 28 } },
    { id: 'telafisiz', label: 'Telafisiz metabolik asidoz', note: 'Telafi kapalı: pCO₂ 40\'ta kalır; pH daha düşük seyreder. Telafinin katkısını görmek için.', set: { dh: -12, comp: 0 } },
  ],
  equations: [
    'pH = 6,1 + log₁₀(HCO₃⁻ / (0,03 · pCO₂));  [H⁺] (nmol/L) = 24 · pCO₂ / HCO₃⁻',
    'Metabolik asidozda beklenen pCO₂ ≈ 40 − 1,2 · (24 − HCO₃⁻)  (Winter formülü 1,5 · HCO₃⁻ + 8 ile ± 2 mmHg içinde aynı)',
    'Metabolik alkalozda beklenen pCO₂ ≈ 40 + 0,7 · (HCO₃⁻ − 24)',
    'Solunumsal: her 10 mmHg pCO₂ değişimi için HCO₃⁻ akut ±1–2, kronik +3,5 / −5 mmol/L',
  ],
  assumptions: ['Telafi ampirik kurallarla (klinikte kullanılan beklenen telafi formülleri) ve birinci derece gecikmeyle modellenir.', 'Solunumsal telafi ≈ 6 saat, böbrek telafisi ≈ 36 saat zaman sabitiyle ilerler.', 'Bikarbonat dışı tamponlar ve anyon açığı ayrıca modellenmez.'],
  validity: 'Tek bir birincil bozukluk için pH, pCO₂ ve HCO₃⁻ arasındaki ilişkiyi ve telafinin yönünü/büyüklüğünü gösterir.',
  limits: ['Kan gazı yorumu değildir; karışık bozukluklar ve örnek türü (arter/ven) hekim değerlendirmesi gerektirir.', 'Telafi hızları kişiden kişiye değişir.'],
  sources: [
    { title: 'Albert MS, Dell RB, Winters RW. Ann Intern Med 1967;66:312–322', detail: 'Metabolik asidozda solunumsal telafi (Winter formülü)' },
    { title: 'Berend K ve ark. N Engl J Med 2014;371:1434–1445', detail: 'Asit-baz bozukluklarına fizyolojik yaklaşım, beklenen telafi' },
  ],
  init: () => [24, 40, 0],
  deriv(t, y, p) {
    if (t < START) return [0, 0, 0];
    const respiratory = Math.abs(p.pc! - 40) > 0.5;
    const [h, c, r] = y as [number, number, number];
    if (respiratory) {
      // Akut tamponlama dakikalar içinde; böbrek bileşeni (r) günler içinde eklenir.
      const renal = p.comp! ? chronicHco3(c) - acuteHco3(c) : 0;
      return [(acuteHco3(c) + p.dh! + r - h) / 0.3, (p.pc! - c) / 0.3, (renal - r) / 36];
    }
    return [(24 + p.dh! - h) / 0.5, ((p.comp! ? expectedPco2(h) : 40) - c) / 6, 0];
  },
  observe: (_t, y) => ({ ph: hhPh(y[0]!, y[1]!), pco2: y[1]!, hco3: y[0]! }),
  phase: (t) => (t < START ? 'Denge' : t < START + 12 ? 'Akut evre' : 'Telafi'),
  metrics(samples) {
    const hco3 = lastOf(samples, 'hco3');
    const pco2 = lastOf(samples, 'pco2');
    const early = samples.find((s) => s.t >= START + 1.5)?.v.ph ?? NaN;
    return [
      { key: 'ph', label: 'pH (telafi sonrası)', value: lastOf(samples, 'ph'), unit: '', decimals: 2, typical: '7,35–7,45' },
      { key: 'ph0', label: 'pH (ilk saatler)', value: early, unit: '', decimals: 2 },
      { key: 'pco2', label: 'pCO₂', value: pco2, unit: 'mmHg', decimals: 0, typical: '35–45' },
      { key: 'hco3', label: 'HCO₃⁻', value: hco3, unit: 'mmol/L', decimals: 0, typical: '22–26' },
      { key: 'h', label: '[H⁺]', value: (24 * pco2) / hco3, unit: 'nmol/L', decimals: 0, typical: '35–45' },
    ];
  },
  curves(samples) {
    const iso = (pc: number) => Array.from({ length: 41 }, (_, i) => 7 + i * 0.02).map((ph) => ({ x: ph, y: 0.03 * pc * Math.pow(10, ph - 6.1) }));
    return [
      {
        id: 'davenport',
        title: 'Davenport diyagramı',
        xLabel: 'pH',
        yLabel: 'HCO₃⁻ (mmol/L)',
        lines: [
          ...[20, 40, 60, 80].map((pc) => ({ label: `pCO₂ ${pc}`, points: iso(pc).filter((q) => q.y <= 50), dashed: true })),
          { label: 'Modelin izlediği yol', points: samples.map((s) => ({ x: s.v.ph!, y: s.v.hco3! })) },
        ],
        marker: { x: lastOf(samples, 'ph'), y: lastOf(samples, 'hco3'), label: 'Model' },
      },
    ];
  },
  personal(m) {
    const markers = [];
    const used: string[] = [];
    if (m.ph !== undefined && m.hco3 !== undefined) {
      markers.push({ curve: 'davenport', x: m.ph, y: m.hco3, label: 'Senin ölçümün (pH, HCO₃⁻)' });
      used.push('ph', 'hco3');
    }
    return { params: {}, markers, used };
  },
};
