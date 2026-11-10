import { maxOf } from '../run';
import type { SimModel } from '../types';

const CM = 1; // µF/cm²
const GL = 0.3;
const ENA = 50;
const EL = -54.4;
const K0 = 4.5; // mmol/L, tipik hücre dışı potasyum
const STIM_AT = 5; // ms

// Hodgkin–Huxley hız sabitleri (dinlenim −65 mV olacak biçimde kaydırılmış, 6,3 °C).
const vtrap = (x: number, y: number): number => (Math.abs(x / y) < 1e-6 ? y * (1 - x / y / 2) : x / (Math.exp(x / y) - 1));
const am = (v: number) => 0.1 * vtrap(-(v + 40), 10);
const bm = (v: number) => 4 * Math.exp(-(v + 65) / 18);
const ah = (v: number) => 0.07 * Math.exp(-(v + 65) / 20);
const bh = (v: number) => 1 / (1 + Math.exp(-(v + 35) / 10));
const an = (v: number) => 0.01 * vtrap(-(v + 55), 10);
const bn = (v: number) => 0.125 * Math.exp(-(v + 65) / 80);

/** Nernst kayması: hücre dışı potasyum değişince potasyum denge potansiyeli. */
export const eK = (ko: number): number => -77 + 25.3 * Math.log(ko / K0);

/** Dinlenim durumu (verilen potasyumda akımsız denge) — ikiye bölme ile. */
function rest(p: Record<string, number>): number[] {
  const ek = eK(p.ko!);
  const net = (v: number) => {
    const m = am(v) / (am(v) + bm(v));
    const h = ah(v) / (ah(v) + bh(v));
    const n = an(v) / (an(v) + bn(v));
    return p.gna! * m * m * m * h * (v - ENA) + p.gk! * n ** 4 * (v - ek) + GL * (v - EL);
  };
  let lo = -100;
  let hi = -30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (net(mid) > 0) hi = mid;
    else lo = mid;
  }
  const v = (lo + hi) / 2;
  return [v, am(v) / (am(v) + bm(v)), ah(v) / (ah(v) + bh(v)), an(v) / (an(v) + bn(v))];
}

/** Hodgkin–Huxley aksiyon potansiyeli. Durum: [V (mV), m, h, n]; zaman: ms. */
export const neuron: SimModel = {
  id: 'aksiyon-potansiyeli',
  title: 'Sinir hücresinde aksiyon potansiyeli',
  question: 'Bir sinir hücresi uyarıyı elektrik sinyaline nasıl çevirir?',
  system: 'Sinir',
  organs: ['brain'],
  interior: 'nerves',
  relatedTests: ['potassium', 'sodium', 'calcium', 'magnesium', 'b12'],
  timeUnit: 'ms',
  dt: 0.01,
  duration: 60,
  sampleEvery: 0.05,
  pace: 6,
  panels: ['Zar potansiyeli (mV)', 'Kanal kapıları (0–1)'],
  series: [
    { key: 'v', label: 'Zar potansiyeli', unit: 'mV', panel: 0, color: 'a', decimals: 0 },
    { key: 'm', label: 'Na⁺ açılma (m)', unit: '', panel: 1, color: 'b', decimals: 2 },
    { key: 'h', label: 'Na⁺ kapanma (h)', unit: '', panel: 1, color: 'c', decimals: 2 },
    { key: 'n', label: 'K⁺ açılma (n)', unit: '', panel: 1, color: 'd', decimals: 2 },
  ],
  params: [
    { key: 'i', label: 'Uyarı akımı', unit: 'µA/cm²', min: 0, max: 40, step: 0.5, value: 15 },
    { key: 'dur', label: 'Uyarı süresi', unit: 'ms', min: 0.5, max: 50, step: 0.5, value: 1 },
    { key: 'gna', label: 'Na⁺ kanal iletkenliği', unit: 'mS/cm²', min: 0, max: 120, step: 5, value: 120 },
    { key: 'gk', label: 'K⁺ kanal iletkenliği', unit: 'mS/cm²', min: 5, max: 60, step: 1, value: 36 },
    { key: 'ko', label: 'Hücre dışı potasyum', unit: 'mmol/L', min: 2.5, max: 10, step: 0.1, value: 4.5 },
  ],
  scenarios: [
    { id: 'esik-alti', label: 'Eşik altı uyarı', note: 'Uyarı eşiğe ulaşmaz: küçük bir sapma olur, aksiyon potansiyeli oluşmaz (ya hep ya hiç).', set: { i: 3 } },
    { id: 'tekrar', label: 'Sürekli uyarı', note: 'Uyarı sürdükçe hücre ardışık ateşler; frekans uyarının şiddetini kodlar.', set: { i: 10, dur: 50 } },
    { id: 'na-blok', label: 'Na⁺ kanalları kısmen kapalı', note: 'Lokal anestezik benzeri: sodyum iletkenliği azalınca aynı uyarı aksiyon potansiyeli oluşturamaz.', set: { gna: 35 } },
    { id: 'yuksek-k', label: 'Yüksek hücre dışı potasyum', note: 'Dinlenim potansiyeli daha az negatif olur (Nernst); Na⁺ kanalları kısmen etkisizleşir, uyarılabilirlik değişir.', set: { ko: 8.5 } },
    { id: 'dusuk-k', label: 'Düşük hücre dışı potasyum', note: 'Dinlenim potansiyeli daha negatif olur: eşiğe ulaşmak zorlaşır.', set: { ko: 3, i: 6 } },
  ],
  equations: [
    'C · dV/dt = I_uyarı − g_Na · m³h · (V − E_Na) − g_K · n⁴ · (V − E_K) − g_L · (V − E_L)',
    'dx/dt = α_x(V) · (1 − x) − β_x(V) · x,  x ∈ {m, h, n}',
    'E_K = E_K⁰ + 25,3 · ln([K⁺]_dış / 4,5)  (Nernst)',
  ],
  assumptions: ['Dev mürekkep balığı aksonunun özgün Hodgkin–Huxley parametreleri (6,3 °C) kullanılır.', 'Tek bir zar parçası: iletim (yayılma) ve miyelin modellenmez.', 'Potasyum değişimi yalnızca denge potansiyelini kaydırır.'],
  validity: 'Eşik, ya hep ya hiç yanıtı, dinlenme (refrakter) dönemi ve tekrarlı ateşlemeyi nitel olarak doğru gösterir.',
  limits: ['İnsan nöronlarının kanal çeşitliliğini ve vücut sıcaklığını yansıtmaz.', 'Kandaki potasyum değerinden kişisel sinir işlevi çıkarımı yapılamaz.'],
  sources: [{ title: 'Hodgkin AL, Huxley AF. J Physiol 1952;117:500–544', detail: 'Zar akımının nicel tanımı ve sinirde iletim/uyarılma' }],
  init: (p) => rest(p),
  deriv(t, y, p) {
    const [v, m, h, n] = y as [number, number, number, number];
    const stim = t >= STIM_AT && t < STIM_AT + p.dur! ? p.i! : 0;
    const ina = p.gna! * m * m * m * h * (v - ENA);
    const ik = p.gk! * n ** 4 * (v - eK(p.ko!));
    return [(stim - ina - ik - GL * (v - EL)) / CM, am(v) * (1 - m) - bm(v) * m, ah(v) * (1 - h) - bh(v) * h, an(v) * (1 - n) - bn(v) * n];
  },
  observe: (_t, y) => ({ v: y[0]!, m: y[1]!, h: y[2]!, n: y[3]! }),
  phase(t, y) {
    const v = y[0]!;
    if (v > 0) return 'Tepe (Na⁺ girişi)';
    if (y[1]! > 0.3) return 'Depolarizasyon';
    if (y[3]! > 0.45) return 'Repolarizasyon / hiperpolarizasyon';
    return t < STIM_AT ? 'Dinlenim' : 'Dinlenim / toparlanma';
  },
  metrics(samples, p) {
    let spikes = 0;
    for (let k = 1; k < samples.length; k++) if (samples[k - 1]!.v.v! < 0 && samples[k]!.v.v! >= 0) spikes++;
    return [
      { key: 'spikes', label: 'Aksiyon potansiyeli sayısı', value: spikes, unit: '', decimals: 0 },
      { key: 'peak', label: 'En yüksek zar potansiyeli', value: maxOf(samples, 'v'), unit: 'mV', decimals: 0, typical: '+30 – +45' },
      { key: 'rest', label: 'Dinlenim potansiyeli', value: samples[0]?.v.v ?? NaN, unit: 'mV', decimals: 0, typical: '≈ −65' },
      { key: 'ek', label: 'Potasyum denge potansiyeli', value: eK(p.ko!), unit: 'mV', decimals: 0, typical: '≈ −77' },
    ];
  },
};
