import { firstCross, lastOf } from '../run';
import type { SimModel } from '../types';

const LAG = 15; // dk, katı öğünde öğütme gecikmesi
const KLIQ = Math.LN2 / 15; // 1/dk, sıvının boşalması

/** Mide boşalması ve emilim. Durum: [midede enerji (kcal), midede su (mL), bağırsakta KH, protein, yağ (kcal), emilen KH, protein, yağ]. */
export const digestion: SimModel = {
  id: 'sindirim-emilim',
  title: 'Mide boşalması ve besin emilimi',
  question: 'Bir öğün mideden ne hızla çıkar ve besinler ne zaman kana geçer?',
  system: 'Sindirim',
  organs: ['stomach', 'small-intestine'],
  interior: 'stomach',
  relatedTests: ['glucose', 'triglyceride', 'albumin', 'b12', 'ferritin', 'amylase', 'lipase'],
  timeUnit: 'dk',
  dt: 0.1,
  duration: 480,
  sampleEvery: 2,
  pace: 30,
  panels: ['Midede kalan (% öğün)', 'Emilen (% her besin)'],
  series: [
    { key: 'stomach', label: 'Midede kalan enerji', unit: '%', panel: 0, color: 'a', decimals: 0 },
    { key: 'water', label: 'Midede kalan su', unit: '%', panel: 0, color: 'd', decimals: 0 },
    { key: 'carb', label: 'Karbonhidrat', unit: '%', panel: 1, color: 'b', decimals: 0 },
    { key: 'prot', label: 'Protein', unit: '%', panel: 1, color: 'c', decimals: 0 },
    { key: 'fat', label: 'Yağ', unit: '%', panel: 1, color: 'd', decimals: 0 },
  ],
  params: [
    { key: 'carb', label: 'Karbonhidrat', unit: 'g', min: 0, max: 150, step: 5, value: 70 },
    { key: 'prot', label: 'Protein', unit: 'g', min: 0, max: 80, step: 5, value: 25 },
    { key: 'fat', label: 'Yağ', unit: 'g', min: 0, max: 80, step: 5, value: 20 },
    { key: 'water', label: 'Sıvı', unit: 'mL', min: 0, max: 800, step: 50, value: 300 },
    { key: 'solid', label: 'Katı öğün', unit: '0 sıvı · 1 katı', min: 0, max: 1, step: 1, value: 1 },
  ],
  scenarios: [
    { id: 'yagli', label: 'Yağlı öğün', note: 'İnce bağırsaktaki yağ, mide boşalmasını frenler: öğün midede daha uzun kalır, emilim geç tamamlanır.', set: { carb: 50, prot: 25, fat: 60 } },
    { id: 'sivi', label: 'Sıvı öğün', note: 'Öğütme gecikmesi yoktur: boşalma hemen başlar.', set: { solid: 0, fat: 5, prot: 10, carb: 60 } },
    { id: 'hafif', label: 'Hafif öğün', note: 'Daha az enerji: mide daha kısa sürede boşalır (boşalma hızı kalori bazında sınırlıdır).', set: { carb: 30, prot: 10, fat: 5 } },
  ],
  equations: [
    'Mideden çıkış ≈ sabit enerji hızı: 3,2 kcal/dk / (1 + yağ oranı); katıda ≈ 15 dk gecikme',
    'Sıvı: üstel boşalma, yarı süresi ≈ 15 dk',
    'Bağırsakta emilim (birinci derece): karbonhidrat 0,05, protein 0,03, yağ 0,015 1/dk',
  ],
  assumptions: ['Mide, enerjiyi yaklaşık sabit hızla (1–4 kcal/dk) ince bağırsağa verir.', 'Besinler midede eşit karışmıştır; lif ve öğün yapısı hesaba katılmaz.', 'Emilim tam kabul edilir (emilim bozukluğu yok).'],
  validity: 'Sağlıklı yetişkinde karışık bir öğünün mideden çıkışını ve besinlerin emilim sırasını yaklaşık gösterir.',
  limits: ['Kişisel mide boşalma testi değildir.', 'Kan şekeri ve yağ düzeyi tahmini yapmaz (glukoz–insülin modeline bak).'],
  sources: [
    { title: 'Hunt JN, Stubbs DF. J Physiol 1975;245:209–225', detail: 'Öğünün hacmi ve enerji yoğunluğu ile mide boşalması' },
    { title: 'Camilleri M. Gastroenterology 2006;131:640–658', detail: 'Mide-bağırsak hareketlerinin bütünleşik fizyolojisi' },
  ],
  init: (p) => [4 * p.carb! + 4 * p.prot! + 9 * p.fat!, p.water!, 0, 0, 0, 0, 0, 0],
  deriv(t, y, p) {
    const total = 4 * p.carb! + 4 * p.prot! + 9 * p.fat!;
    const fatFrac = total > 0 ? (9 * p.fat!) / total : 0;
    const ready = p.solid! ? Math.min(1, Math.max(0, t / LAG)) : 1;
    const out = y[0]! > 0.01 ? (ready * 3.2) / (1 + fatFrac) : 0;
    const share = (kcal: number) => (total > 0 ? (out * kcal) / total : 0);
    return [-out, -KLIQ * y[1]!, share(4 * p.carb!) - 0.05 * y[2]!, share(4 * p.prot!) - 0.03 * y[3]!, share(9 * p.fat!) - 0.015 * y[4]!, 0.05 * y[2]!, 0.03 * y[3]!, 0.015 * y[4]!];
  },
  after(_t, y) {
    y[0] = Math.max(0, y[0]!);
  },
  observe(_t, y, p) {
    const total = 4 * p.carb! + 4 * p.prot! + 9 * p.fat!;
    const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : 0);
    return { stomach: pct(y[0]!, total), water: pct(y[1]!, p.water!), carb: pct(y[5]!, 4 * p.carb!), prot: pct(y[6]!, 4 * p.prot!), fat: pct(y[7]!, 9 * p.fat!) };
  },
  phase: (_t, y) => (y[0]! > 1 ? 'Mide boşalıyor' : y[2]! + y[3]! + y[4]! > 5 ? 'Bağırsakta emilim' : 'Emilim tamamlanıyor'),
  metrics(samples, p) {
    return [
      { key: 'kcal', label: 'Öğünün enerjisi', value: 4 * p.carb! + 4 * p.prot! + 9 * p.fat!, unit: 'kcal', decimals: 0 },
      { key: 't50', label: 'Midenin yarısı boşaldı', value: firstCross(samples, 'stomach', 50, 'down'), unit: 'dk', decimals: 0, typical: '60–120 (katı)' },
      { key: 'tend', label: 'Mide boşaldı', value: firstCross(samples, 'stomach', 1, 'down'), unit: 'dk', decimals: 0, typical: '≤ 240' },
      { key: 'fat', label: 'Emilen yağ (8. saat)', value: lastOf(samples, 'fat'), unit: '%', decimals: 0 },
    ];
  },
};
