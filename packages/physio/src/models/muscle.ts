import { maxOf, minOf } from '../run';
import type { SimModel } from '../types';

const TAU_C = 0.05; // sn, kalsiyum geri alımı
const TAU_F = 0.045; // sn, kuvvet gelişimi
const KCA = 0.9;
const START = 0.1;

/** Sarkomer boyu–gerim ilişkisi (Gordon, Huxley, Julian 1966): 0–1. */
export function lengthTension(sl: number): number {
  const pts: Array<[number, number]> = [[1.27, 0], [1.67, 0.84], [2.0, 1], [2.25, 1], [3.65, 0]];
  if (sl <= pts[0]![0] || sl >= pts[4]![0]) return 0;
  for (let k = 1; k < pts.length; k++) {
    const [x1, y1] = pts[k]!;
    const [x0, y0] = pts[k - 1]!;
    if (sl <= x1) return y0 + ((y1 - y0) * (sl - x0)) / (x1 - x0);
  }
  return 0;
}

/** Hill kuvvet–hız ilişkisi: (F + a)(v + b) = (F₀ + a)·b; a/F₀ = 0,25. v, v_max'ın oranı; dönen değer F/F₀. */
export const hillForce = (vRel: number): number => (0.25 * (1 - vRel)) / (vRel + 0.25);

/** İskelet kasında uyarı sıklığı → kalsiyum → kuvvet. Durum: [Ca (göreli), kuvvet (0–1)]; zaman: sn. */
export const muscle: SimModel = {
  id: 'kas-kasilmasi',
  title: 'Kas kasılması: seğirmeden tetanosa',
  question: 'Sinir uyarılarının sıklığı ve kasın boyu, üretilen kuvveti nasıl belirler?',
  system: 'Kas-iskelet',
  organs: [],
  interior: 'skeletal-muscle',
  relatedTests: ['ck', 'calcium', 'magnesium', 'potassium', 'ldh'],
  timeUnit: 'sn',
  dt: 0.0005,
  duration: 2,
  sampleEvery: 0.004,
  pace: 0.4,
  panels: ['Kuvvet (% en yüksek)', 'Hücre içi kalsiyum (göreli)'],
  series: [
    { key: 'f', label: 'Kuvvet', unit: '%', panel: 0, color: 'a', decimals: 0 },
    { key: 'ca', label: 'Kalsiyum', unit: '', panel: 1, color: 'b', decimals: 2 },
  ],
  params: [
    { key: 'freq', label: 'Uyarı sıklığı', unit: 'Hz', min: 1, max: 100, step: 1, value: 1 },
    { key: 'sl', label: 'Sarkomer boyu', unit: 'µm', min: 1.3, max: 3.6, step: 0.05, value: 2.2, hint: 'Aktin-miyozin örtüşmesi 2,0–2,25 µm arasında en iyidir' },
  ],
  scenarios: [
    { id: 'toplanma', label: 'Toplanma (10 Hz)', note: 'Kas gevşemeden yeni uyarı gelir: seğirmeler üst üste biner, kuvvet artar.', set: { freq: 10 } },
    { id: 'tetanos-eksik', label: 'Tam olmayan tetanos (20 Hz)', note: 'Kuvvet yüksek ama dalgalıdır.', set: { freq: 20 } },
    { id: 'tetanos', label: 'Tam tetanos (60 Hz)', note: 'Kalsiyum sürekli yüksek kalır: kuvvet düzgün ve en yüksek düzeydedir.', set: { freq: 60 } },
    { id: 'gergin', label: 'Aşırı gerilmiş kas', note: 'Aktin ve miyozin daha az örtüşür: aynı uyarıyla daha az kuvvet.', set: { freq: 60, sl: 3.1 } },
    { id: 'kisa', label: 'Aşırı kısalmış kas', note: 'İnce filamentler üst üste biner: kuvvet düşer.', set: { freq: 60, sl: 1.55 } },
  ],
  equations: [
    'dCa/dt = −Ca / τ_Ca + (her uyarıda kalsiyum salınımı)',
    'Etkinleşme A = Ca³ / (Ca³ + K³)  (troponine bağlanma, Hill)',
    'dF/dt = (A · f_L(boy) − F) / τ_F',
    'Kuvvet–hız (Hill): (F + a)(v + b) = (F₀ + a) · b',
  ],
  assumptions: ['Tek bir motor birim; yorgunluk ve lif tipi farkları yoktur.', 'Kalsiyum salınımı her uyarıda eşittir (doyma basitçe temsil edilir).', 'Boy sabittir (izometrik kasılma).'],
  validity: 'Seğirme, toplanma ve tetanos ile boy–gerim ilişkisini nitel olarak doğru gösterir.',
  limits: ['Kişisel kas gücü ölçümü değildir.', 'CK gibi kan değerlerinden kas kasılma özelliği çıkarılamaz.'],
  sources: [
    { title: 'Gordon AM, Huxley AF, Julian FJ. J Physiol 1966;184:170–192', detail: 'Sarkomer boyu–gerim ilişkisi' },
    { title: 'Hill AV. Proc R Soc Lond B 1938;126:136–195', detail: 'Kısalma ısısı ve kuvvet–hız ilişkisi' },
  ],
  init: () => [0, 0],
  deriv(_t, y, p) {
    const c = y[0]!;
    const a = c ** 3 / (c ** 3 + KCA ** 3);
    return [-c / TAU_C, (a * lengthTension(p.sl!) - y[1]!) / TAU_F];
  },
  after(t, y, p, dt) {
    if (t < START) return;
    const period = 1 / p.freq!;
    const k = Math.floor((t - START) / period);
    const kPrev = Math.floor((t - dt - START) / period);
    if (t - dt < START || k !== kPrev) y[0] = y[0]! + 1;
  },
  observe: (_t, y) => ({ f: 100 * y[1]!, ca: y[0]! }),
  metrics(samples, p) {
    const late = samples.filter((s) => s.t > 1.2);
    const hi = maxOf(late, 'f');
    const lo = minOf(late, 'f');
    return [
      { key: 'peak', label: 'En yüksek kuvvet', value: maxOf(samples, 'f'), unit: '%', decimals: 0 },
      { key: 'ripple', label: 'Dalgalanma (son 0,8 sn)', value: hi > 0 ? (100 * (hi - lo)) / hi : 0, unit: '%', decimals: 0, typical: 'tam tetanosta ≈ 0' },
      { key: 'fl', label: 'Boy etkeni', value: 100 * lengthTension(p.sl!), unit: '%', decimals: 0 },
    ];
  },
  curves(_s, p) {
    return [
      {
        id: 'lt',
        title: 'Boy–gerim ilişkisi',
        xLabel: 'Sarkomer boyu (µm)',
        yLabel: 'Etkin gerim (%)',
        lines: [{ label: 'Etkin gerim', points: Array.from({ length: 49 }, (_, i) => 1.25 + i * 0.05).map((x) => ({ x, y: 100 * lengthTension(x) })) }],
        marker: { x: p.sl!, y: 100 * lengthTension(p.sl!), label: 'Model' },
      },
      {
        id: 'fv',
        title: 'Kuvvet–hız ilişkisi (Hill)',
        xLabel: 'Kısalma hızı (% en yüksek)',
        yLabel: 'Kuvvet · güç (%)',
        lines: [
          { label: 'Kuvvet', points: Array.from({ length: 51 }, (_, i) => ({ x: i * 2, y: 100 * hillForce(i / 50) })) },
          { label: 'Güç (kuvvet × hız, ölçekli)', dashed: true, points: Array.from({ length: 51 }, (_, i) => ({ x: i * 2, y: 1000 * hillForce(i / 50) * (i / 50) })) },
        ],
      },
    ];
  },
};
