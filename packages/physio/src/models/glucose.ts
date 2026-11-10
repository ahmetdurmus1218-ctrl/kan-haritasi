import { argMax, maxOf, sampleAt } from '../run';
import type { SimModel } from '../types';

const GB = 90; // mg/dL, açlık glukozu
const IB = 8; // µU/mL, bazal insülin
const SG = 0.014; // 1/dk, glukoz etkinliği
const P2 = 0.03; // 1/dk
const SI = 7e-4; // 1/dk per µU/mL, insülin duyarlılığı
const N = 0.14; // 1/dk, insülin temizlenmesi
const GAMMA = 0.11; // µU/mL per mg/dL per dk, glukoza salgı yanıtı
const KG = 0.0085; // 1/dk, mide boşalması
const KABS = 0.05; // 1/dk, bağırsaktan emilim
const F = 0.9; // emilen oran
const BW = 70; // kg
const VG = 1.7; // dL/kg, glukoz dağılım hacmi
const MEAL_AT = 15; // dk

/**
 * Bergman minimal modeli + basit iki bölmeli emilim. Durum: [G (mg/dL), X (1/dk), I (µU/mL), mide (mg), bağırsak (mg)].
 */
export const glucose: SimModel = {
  id: 'glukoz-insulin',
  title: 'Glukoz–insülin dengesi (öğün sonrası)',
  question: 'Bir öğünden sonra kan şekeri neden yükselir ve insülin onu nasıl geri indirir?',
  system: 'Endokrin · metabolizma',
  organs: ['pancreas', 'liver'],
  interior: 'pancreas.endocrine',
  relatedTests: ['glucose', 'hba1c', 'insulin', 'triglyceride'],
  timeUnit: 'dk',
  dt: 0.1,
  duration: 300,
  sampleEvery: 1,
  pace: 30,
  panels: ['Kan glukozu (mg/dL)', 'İnsülin (µU/mL)'],
  series: [
    { key: 'g', label: 'Glukoz', unit: 'mg/dL', panel: 0, color: 'a', decimals: 0 },
    { key: 'i', label: 'İnsülin', unit: 'µU/mL', panel: 1, color: 'b', decimals: 0 },
  ],
  params: [
    { key: 'carbs', label: 'Öğündeki karbonhidrat', unit: 'g', min: 0, max: 150, step: 5, value: 75 },
    { key: 'si', label: 'İnsülin duyarlılığı', unit: '× tipik', min: 0.1, max: 2, step: 0.05, value: 1, hint: 'Kas, yağ ve karaciğerin insüline yanıtı' },
    { key: 'beta', label: 'İnsülin salgı yanıtı', unit: '× tipik', min: 0, max: 2, step: 0.05, value: 1, hint: 'Beta hücrelerinin glukoza yanıtı' },
    { key: 'sg', label: 'İnsülinden bağımsız glukoz kullanımı', unit: '× tipik', min: 0.5, max: 2.5, step: 0.05, value: 1, hint: 'Egzersizde artar' },
  ],
  scenarios: [
    { id: 'direnc', label: 'Azalmış insülin duyarlılığı', note: 'Dokular insüline daha az yanıt verir: glukoz daha yükseğe çıkar, daha geç iner; insülin yanıtı büyür.', set: { si: 0.3 } },
    { id: 'salgi', label: 'Azalmış insülin salgısı', note: 'Beta hücre yanıtı zayıf: insülin az yükselir, glukoz uzun süre yüksek kalır.', set: { beta: 0.2 } },
    { id: 'ikisi', label: 'İkisi birlikte', note: 'Hem duyarlılık hem salgı azalmış: en yüksek ve en uzun glukoz yükselmesi.', set: { si: 0.3, beta: 0.3 } },
    { id: 'egzersiz', label: 'Öğün sonrası yürüyüş', note: 'Kaslar insülinden bağımsız glukoz alır ve duyarlılık artar: tepe küçülür.', set: { sg: 1.8, si: 1.4 } },
    { id: 'kucuk-ogun', label: 'Küçük öğün (30 g)', note: 'Daha az karbonhidrat: daha küçük glukoz ve insülin dalgası.', set: { carbs: 30 } },
  ],
  equations: [
    'dG/dt = −(S_G + X) · G + S_G · G_b + Ra(t) / V_G',
    'dX/dt = −p₂ · X + p₂ · S_I · (I − I_b)',
    'dI/dt = −n · (I − I_b) + γ · max(0, G − G_b)',
    'Mide → bağırsak → kan: dQ_m/dt = −k_g·Q_m;  dQ_b/dt = k_g·Q_m − k_abs·Q_b;  Ra = f · k_abs · Q_b / kütle',
  ],
  assumptions: ['Açlık glukozu 90 mg/dL ve bazal insülin 8 µU/mL sabit alınır; senaryolarda da açlık değerleri değişmez.', 'Glukagon, inkretinler, karaciğer glukoz üretiminin ayrıntısı ve böbrekten glukoz kaybı yoktur.', '70 kg yetişkin; öğün yalnızca karbonhidrat olarak modellenir.'],
  validity: 'Sağlıklı yetişkinde öğün/OGTT sonrası 0–5 saatlik glukoz ve insülin eğrisinin biçimini gösterir.',
  limits: ['Kişisel OGTT sonucu ya da diyabet tanısı değildir.', 'HbA1c tahmini yapmaz.', 'İlaç ve insülin tedavisi modellenmez.'],
  sources: [
    { title: 'Bergman RN ve ark. Am J Physiol 1979;236:E667–E677', detail: 'Glukoz kinetiğinin minimal modeli, insülin duyarlılığı' },
    { title: 'Dalla Man C ve ark. IEEE Trans Biomed Eng 2007;54:1740–1749', detail: 'Öğün simülasyon modeli (emilim bölmeleri)' },
  ],
  init: () => [GB, 0, IB, 0, 0],
  deriv(_t, y, p) {
    const [g, x, i, qs, qg] = y as [number, number, number, number, number];
    const ra = (F * KABS * qg) / BW / VG;
    return [-(SG * p.sg! + x) * g + SG * p.sg! * GB + ra, -P2 * x + P2 * SI * p.si! * (i - IB), -N * (i - IB) + GAMMA * p.beta! * Math.max(0, g - GB), -KG * qs, KG * qs - KABS * qg];
  },
  after(t, y, p, dt) {
    // Öğün: MEAL_AT anında mideye girer.
    if (t >= MEAL_AT && t - dt < MEAL_AT) y[3] = y[3]! + p.carbs! * 1000;
  },
  observe: (_t, y) => ({ g: y[0]!, i: y[2]!, x: y[1]! }),
  phase: (t, y) => (t < MEAL_AT ? 'Açlık' : y[4]! + y[3]! > 1500 ? 'Emilim' : 'Açlığa dönüş'),
  metrics(samples) {
    const peak = maxOf(samples, 'g');
    return [
      { key: 'peak', label: 'En yüksek glukoz', value: peak, unit: 'mg/dL', decimals: 0, typical: '< 140–160' },
      { key: 'tpeak', label: 'Tepeye ulaşma (öğünden sonra)', value: argMax(samples, 'g') - MEAL_AT, unit: 'dk', decimals: 0, typical: '30–60' },
      { key: 'g120', label: '2. saat glukozu', value: sampleAt(samples, MEAL_AT + 120)?.v.g ?? NaN, unit: 'mg/dL', decimals: 0, typical: '< 140' },
      { key: 'ipeak', label: 'En yüksek insülin', value: maxOf(samples, 'i'), unit: 'µU/mL', decimals: 0, typical: '30–90' },
    ];
  },
};
