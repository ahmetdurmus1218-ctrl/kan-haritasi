import { argMax, maxOf } from '../run';
import type { SimModel } from '../types';

const K = 1; // taşıma kapasitesi (göreli yük)
const KI = 1.2;
const KA = 8;
const DI = 0.8; // 1/gün
const DA = 0.05; // 1/gün
const HI = 0.05;
const HA = 0.004;
const CLEARED = 1e-7;

/** Enfeksiyona bağışıklık yanıtı. Durum: [patojen, doğal yanıt, edinsel yanıt]; zaman: gün. */
export const immune: SimModel = {
  id: 'bagisiklik-yaniti',
  title: 'Enfeksiyona bağışıklık yanıtı',
  question: 'Doğal ve edinsel bağışıklık bir mikrobu nasıl sınırlar; bellek neyi değiştirir?',
  system: 'Bağışıklık',
  organs: [],
  interior: 'ic.lymph-node',
  relatedTests: ['wbc', 'crp', 'esr', 'neutrophil-abs', 'lymphocyte-abs'],
  timeUnit: 'gün',
  dt: 0.005,
  duration: 30,
  sampleEvery: 0.1,
  pace: 3,
  panels: ['Patojen yükü (log₁₀, göreli)', 'Bağışıklık yanıtı (göreli)'],
  series: [
    { key: 'logp', label: 'Patojen', unit: 'log₁₀', panel: 0, color: 'a', decimals: 1 },
    { key: 'inn', label: 'Doğal yanıt', unit: '', panel: 1, color: 'b', decimals: 2 },
    { key: 'ada', label: 'Edinsel yanıt', unit: '', panel: 1, color: 'c', decimals: 2 },
  ],
  params: [
    { key: 'r', label: 'Patojenin çoğalma hızı', unit: '1/gün', min: 0.5, max: 4, step: 0.1, value: 2 },
    { key: 'dose', label: 'Başlangıç yükü', unit: 'log₁₀', min: -6, max: -1, step: 0.5, value: -4 },
    { key: 'a0', label: 'Hazır edinsel hücreler (bellek)', unit: 'göreli', min: 0.001, max: 1, step: 0.001, value: 0.005, hint: 'İlk karşılaşmada çok az; aşı ya da geçirilmiş enfeksiyondan sonra fazla' },
    { key: 'pa', label: 'Edinsel yanıtın çoğalma hızı', unit: '1/gün', min: 0.2, max: 2.5, step: 0.05, value: 1.3 },
    { key: 'si', label: 'Doğal yanıtın gücü', unit: '× tipik', min: 0, max: 2, step: 0.05, value: 1 },
  ],
  scenarios: [
    { id: 'bellek', label: 'İkinci karşılaşma (bellek)', note: 'Hazır bellek hücreleri hızla çoğalır: patojen düşük düzeyde ve kısa sürede temizlenir.', set: { a0: 0.6 } },
    { id: 'zayif-edinsel', label: 'Yavaş edinsel yanıt', note: 'Özgül hücreler yavaş çoğalır: patojen daha yükseğe çıkar ve temizlenmesi uzar.', set: { pa: 0.6 } },
    { id: 'zayif-dogal', label: 'Zayıf doğal yanıt', note: 'İlk günlerdeki fren zayıftır: patojen daha hızlı ve daha yükseğe çoğalır.', set: { si: 0.2 } },
    { id: 'yuksek-doz', label: 'Yüksek başlangıç yükü', note: 'Tepe daha erken gelir; edinsel yanıt da daha erken uyarılır.', set: { dose: -1.5 } },
  ],
  equations: [
    'dP/dt = r · P · (1 − P/K) − k_d · D · P − k_e · E · P',
    'dD/dt = s_d · P / (P + h_d) − δ_d · D   (doğal bağışıklık: hızlı, özgül değil)',
    'dE/dt = p_e · E · P / (P + h_e) − δ_e · (E − E₀)   (edinsel: klonal çoğalma, bellek E₀)',
  ],
  assumptions: ['Patojen, doğal ve edinsel yanıt tek birer değişkendir; birimler görelidir.', 'Doku hasarı, ateş, sitokinler ve patojenin kaçış mekanizmaları yoktur.', 'Edinsel yanıt antikor ve T hücrelerini birlikte temsil eder.'],
  validity: 'Enfeksiyonun tipik seyrini (çoğalma → doğal fren → edinsel temizleme) ve belleğin etkisini nitel olarak gösterir.',
  limits: ['Belirli bir mikrop ya da aşı için öngörü değildir.', 'Lökosit ve CRP gibi kan değerleri bu modelle kişisel olarak yorumlanamaz.'],
  sources: [
    { title: 'Perelson AS. Nat Rev Immunol 2002;2:28–36', detail: 'Viral ve bağışıklık dinamiğinin matematiksel modellenmesi' },
    { title: 'Antia R ve ark. Nat Rev Immunol 2005;5:101–111', detail: 'Klonal çoğalma ve bağışıklık belleğinin dinamiği' },
  ],
  init: (p) => [Math.pow(10, p.dose!), 0, p.a0!],
  deriv(_t, y, p) {
    const [pg, d, e] = y as [number, number, number];
    if (pg <= CLEARED) return [0, -DI * d, -DA * (e - p.a0!)];
    return [p.r! * pg * (1 - pg / K) - KI * d * pg - KA * e * pg, (p.si! * pg) / (pg + HI) - DI * d, (p.pa! * e * pg) / (pg + HA) - DA * (e - p.a0!)];
  },
  after(_t, y) {
    if (y[0]! <= CLEARED) y[0] = 0;
  },
  observe: (_t, y) => ({ logp: Math.log10(Math.max(CLEARED, y[0]!)), p: y[0]!, inn: y[1]!, ada: y[2]! }),
  phase(_t, y) {
    if (y[0]! <= CLEARED) return 'Temizlendi · bellek kalır';
    return y[2]! > 0.3 ? 'Edinsel yanıt baskın' : 'Doğal yanıt baskın';
  },
  metrics(samples) {
    const cleared = samples.find((s) => s.t > 0 && s.v.p! <= CLEARED)?.t ?? NaN;
    return [
      { key: 'peak', label: 'En yüksek patojen yükü', value: maxOf(samples, 'p'), unit: 'göreli', decimals: 3 },
      { key: 'tpeak', label: 'Tepe günü', value: argMax(samples, 'p'), unit: '. gün', decimals: 1 },
      { key: 'clear', label: 'Temizlenme', value: cleared, unit: '. gün', decimals: 1 },
      { key: 'ada', label: 'En yüksek edinsel yanıt', value: maxOf(samples, 'ada'), unit: 'göreli', decimals: 2 },
    ];
  },
};
