import { lastOf } from '../run';
import type { SimModel } from '../types';

const VLUNG = 3; // L, işlevsel artık kapasite
const PH2O = 47; // mmHg, 37 °C su buharı
const CO_LMIN = 5; // L/dk, oksijen sunumu hesabı için tipik debi

/** Kan pH'sı (Henderson–Hasselbalch; HCO₃⁻ 24 mmol/L sabit). */
export const phFromPco2 = (pco2: number, hco3 = 24): number => 6.1 + Math.log10(hco3 / (0.03 * Math.max(1, pco2)));

/**
 * Hemoglobin oksijen doygunluğu (0–1). Severinghaus 1979 bağıntısı; Bohr etkisi için pO₂ pH 7,40'a düzeltilir
 * (düzeltme katsayısı 0,48 · ΔpH).
 */
export function o2Saturation(po2: number, ph = 7.4): number {
  const p = Math.max(0, po2) * Math.pow(10, 0.48 * (ph - 7.4));
  if (p <= 0) return 0;
  return 1 / (1 + 23400 / (p * p * p + 150 * p));
}

/** Arter kanının oksijen içeriği (mL O₂/dL): hemoglobine bağlı + çözünmüş. */
export const o2Content = (hb: number, sat: number, po2: number): number => 1.34 * hb * sat + 0.003 * po2;

/** Alveol gaz denklemi: PAO₂ = FiO₂ · (P_atm − 47) − PaCO₂ / RQ. */
export const alveolarPo2 = (fio2: number, patm: number, paco2: number, rq = 0.8): number => fio2 * (patm - PH2O) - paco2 / rq;

function obs(y: number[], p: Record<string, number>) {
  const pao2 = Math.max(1, y[0]! - p.aa!);
  const ph = phFromPco2(y[1]!);
  const sat = o2Saturation(pao2, ph);
  const cao2 = o2Content(p.hb!, sat, pao2);
  return { pAO2: y[0]!, pao2, paco2: y[1]!, sat: 100 * sat, cao2, ph };
}

/** Tek bölmeli alveol gaz değişimi. Durum: [PAO₂, PACO₂] (mmHg); zaman: dakika. */
export const gas: SimModel = {
  id: 'gaz-degisimi',
  title: 'Akciğerde gaz değişimi ve oksijen taşınması',
  question: 'Solunum ve hemoglobin, kanın taşıdığı oksijeni ve karbondioksiti nasıl belirler?',
  system: 'Solunum',
  organs: ['lungs'],
  interior: 'lungs',
  relatedTests: ['hemoglobin', 'po2', 'pco2', 'so2', 'ph', 'hematocrit', 'cohb'],
  timeUnit: 'dk',
  dt: 0.005,
  duration: 12,
  sampleEvery: 0.05,
  pace: 1.5,
  panels: ['Gaz basınçları (mmHg)', 'Oksijen doygunluğu (%)', 'Oksijen içeriği (mL/dL)'],
  series: [
    { key: 'pao2', label: 'Arter pO₂', unit: 'mmHg', panel: 0, color: 'a', decimals: 0 },
    { key: 'paco2', label: 'Arter pCO₂', unit: 'mmHg', panel: 0, color: 'b', decimals: 0 },
    { key: 'sat', label: 'SaO₂', unit: '%', panel: 1, color: 'c', decimals: 1 },
    { key: 'cao2', label: 'Oksijen içeriği', unit: 'mL/dL', panel: 2, color: 'd', decimals: 1 },
  ],
  params: [
    { key: 'va', label: 'Alveol ventilasyonu', unit: 'L/dk', min: 1, max: 15, step: 0.1, value: 4.2, hint: 'Gaz değişimine katılan hava akımı' },
    { key: 'fio2', label: 'Solunan havadaki oksijen', unit: '%', min: 15, max: 100, step: 1, value: 21 },
    { key: 'patm', label: 'Hava basıncı', unit: 'mmHg', min: 400, max: 760, step: 5, value: 760, hint: 'Deniz düzeyi 760; yükseklik arttıkça düşer' },
    { key: 'hb', label: 'Hemoglobin', unit: 'g/dL', min: 4, max: 20, step: 0.1, value: 15 },
    { key: 'vo2', label: 'Oksijen tüketimi', unit: 'mL/dk', min: 150, max: 1500, step: 10, value: 250 },
    { key: 'aa', label: 'Alveol-arter farkı', unit: 'mmHg', min: 0, max: 60, step: 1, value: 8, hint: 'Ventilasyon-perfüzyon uyumsuzluğu ve difüzyon engeli arttıkça büyür' },
  ],
  scenarios: [
    { id: 'hipoventilasyon', label: 'Yetersiz solunum', note: 'Ventilasyon azalır: CO₂ birikir (pCO₂ ↑), alveol oksijeni düşer.', set: { va: 2.2 } },
    { id: 'hiperventilasyon', label: 'Hızlı-derin solunum', note: 'CO₂ fazla atılır (pCO₂ ↓, pH ↑); doygunluk zaten yüksek olduğundan oksijen içeriği az değişir.', set: { va: 8.5 } },
    { id: 'yukseklik', label: 'Yüksek rakım (≈ 3000 m)', note: 'Hava basıncı düşer: solunan oksijenin kısmi basıncı azalır; eğrinin dik kısmına yaklaşılır.', set: { patm: 526 } },
    { id: 'anemi', label: 'Düşük hemoglobin', note: 'pO₂ ve doygunluk normal kalır ama kanın taşıdığı oksijen (içerik) azalır.', set: { hb: 8 } },
    { id: 'vq', label: 'Artmış alveol-arter farkı', note: 'Alveoldeki oksijen kana tam geçemez: arter pO₂ ve doygunluk düşer, pCO₂ değişmez.', set: { aa: 40 } },
    { id: 'oksijen', label: 'Ek oksijen (%40)', note: 'Alveol pO₂ yükselir; doygunluk platoda olduğundan içerik yalnızca çözünmüş oksijen kadar artar.', set: { fio2: 40 } },
  ],
  equations: [
    'V_akc · dPAO₂/dt = V̇A · (PIO₂ − PAO₂) − 0,863 · V̇O₂;  PIO₂ = FiO₂ · (P_atm − 47)',
    'V_akc · dPACO₂/dt = 0,863 · V̇CO₂ − V̇A · PACO₂;  V̇CO₂ = 0,8 · V̇O₂',
    'SaO₂ = 1 / (1 + 23400 / (P³ + 150·P))  (Severinghaus);  P = PaO₂ · 10^(0,48·(pH − 7,4))',
    'CaO₂ = 1,34 · Hb · SaO₂ + 0,003 · PaO₂;  pH = 6,1 + log₁₀(HCO₃⁻ / (0,03 · PaCO₂))',
  ],
  assumptions: ['Akciğer tek, iyi karışmış bir bölmedir; solunumun gelgiti (nefes alıp verme dalgası) ortalanmıştır.', 'Vücudun CO₂ depoları yok sayılır: pCO₂ gerçekte daha yavaş değişir.', 'HCO₃⁻ 24 mmol/L ve solunum katsayısı 0,8 sabittir; sıcaklık ve 2,3-DPG etkisi yoktur.'],
  validity: 'Kararlı durumdaki değerler alveol gaz denklemiyle uyumludur; yetişkin, 37 °C, normal hemoglobin tipi.',
  limits: ['Kişisel kan gazı ölçümü değildir.', 'Karbonmonoksit, methemoglobin ve anormal hemoglobinler modellenmez.', 'Geçiş süreleri yaklaşık değerdir.'],
  sources: [
    { title: 'Severinghaus JW. J Appl Physiol 1979;46:599–602', detail: 'Oksijen-hemoglobin ayrışma eğrisi için basit bağıntı' },
    { title: 'West JB. Respiratory Physiology: The Essentials', detail: 'Alveol gaz denklemi ve alveol ventilasyon bağıntısı' },
  ],
  init: () => [alveolarPo2(0.21, 760, 41.1), 41.1],
  deriv(_t, y, p) {
    const pio2 = (p.fio2! / 100) * (p.patm! - PH2O);
    return [(p.va! * (pio2 - y[0]!) - 0.863 * p.vo2!) / VLUNG, (0.863 * 0.8 * p.vo2! - p.va! * y[1]!) / VLUNG];
  },
  after(_t, y) {
    y[0] = Math.max(1, y[0]!);
  },
  observe: (_t, y, p) => obs(y, p),
  metrics(samples) {
    const cao2 = lastOf(samples, 'cao2');
    return [
      { key: 'pao2', label: 'Arter pO₂', value: lastOf(samples, 'pao2'), unit: 'mmHg', decimals: 0, typical: '80–100' },
      { key: 'paco2', label: 'Arter pCO₂', value: lastOf(samples, 'paco2'), unit: 'mmHg', decimals: 0, typical: '35–45' },
      { key: 'sat', label: 'Oksijen doygunluğu', value: lastOf(samples, 'sat'), unit: '%', decimals: 1, typical: '95–99' },
      { key: 'ph', label: 'pH (HCO₃⁻ sabitken)', value: lastOf(samples, 'ph'), unit: '', decimals: 2, typical: '7,35–7,45' },
      { key: 'cao2', label: 'Oksijen içeriği', value: cao2, unit: 'mL/dL', decimals: 1, typical: '17–21' },
      { key: 'do2', label: 'Oksijen sunumu (debi 5 L/dk)', value: cao2 * CO_LMIN * 10, unit: 'mL/dk', decimals: 0, typical: '≈ 1000' },
    ];
  },
  curves(samples) {
    const ph = lastOf(samples, 'ph');
    const line = (h: number) => Array.from({ length: 61 }, (_, i) => ({ x: i * 2, y: 100 * o2Saturation(i * 2, h) }));
    return [
      {
        id: 'odc',
        title: 'Oksijen-hemoglobin ayrışma eğrisi',
        xLabel: 'pO₂ (mmHg)',
        yLabel: 'Doygunluk (%)',
        lines: [
          { label: 'pH 7,40', points: line(7.4), dashed: true },
          { label: `Şu anki pH ${ph.toFixed(2)}`, points: line(ph) },
        ],
        marker: { x: lastOf(samples, 'pao2'), y: lastOf(samples, 'sat'), label: 'Model' },
      },
    ];
  },
  personal(m) {
    const used: string[] = [];
    const params: Record<string, number> = {};
    if (m.hemoglobin !== undefined) {
      params.hb = m.hemoglobin;
      used.push('hemoglobin');
    }
    const markers = [];
    if (m.po2 !== undefined && m.so2 !== undefined) {
      markers.push({ curve: 'odc', x: m.po2, y: m.so2, label: 'Senin ölçümün' });
      used.push('po2', 'so2');
    }
    return { params, markers, used };
  },
};
