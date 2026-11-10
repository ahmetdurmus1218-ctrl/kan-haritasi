import { lastOf } from '../run';
import type { SimModel } from '../types';

const PROD = 0.3; // mg/dL/saat, tipik üretim (alyuvar yıkımı)
const KM = 6; // mg/dL
const VMAX = 3.3; // mg/dL/saat, karaciğerin alım + konjugasyon kapasitesi
const KR = 0.1; // 1/saat, kandaki direkt bilirubinin temizlenmesi
const START = 6;

/** Bilirubin kinetiği. Durum: [indirekt, direkt] (mg/dL); zaman: saat. */
export const bilirubin: SimModel = {
  id: 'bilirubin',
  title: 'Karaciğerde bilirubin işlenmesi',
  question: 'Alyuvar yıkımından safraya: bilirubin nerede birikirse hangi türü yükselir?',
  system: 'Sindirim · karaciğer',
  organs: ['liver'],
  interior: 'liver',
  relatedTests: ['bilirubin-total', 'bilirubin-direct', 'bilirubin-indirect', 'alt', 'ast', 'alp', 'ggt', 'ldh', 'hemoglobin'],
  timeUnit: 'saat',
  dt: 0.02,
  duration: 120,
  sampleEvery: 0.5,
  pace: 10,
  panels: ['Bilirubin (mg/dL)'],
  series: [
    { key: 'ind', label: 'İndirekt', unit: 'mg/dL', panel: 0, color: 'a', decimals: 2 },
    { key: 'dir', label: 'Direkt', unit: 'mg/dL', panel: 0, color: 'b', decimals: 2 },
    { key: 'tot', label: 'Total', unit: 'mg/dL', panel: 0, color: 'c', decimals: 2 },
  ],
  params: [
    { key: 'hem', label: 'Alyuvar yıkımı (üretim)', unit: '× tipik', min: 0.5, max: 6, step: 0.1, value: 1 },
    { key: 'ugt', label: 'Konjugasyon kapasitesi', unit: '× tipik', min: 0.05, max: 1, step: 0.05, value: 1, hint: 'Karaciğer hücresindeki UGT1A1 enzimi' },
    { key: 'obs', label: 'Safra akışında engel', unit: '0–1', min: 0, max: 1, step: 0.05, value: 0 },
  ],
  scenarios: [
    { id: 'hemoliz', label: 'Artmış alyuvar yıkımı', note: 'Üretim artar: indirekt bilirubin yükselir; karaciğerin yedek kapasitesi büyük olduğundan artış sınırlıdır.', set: { hem: 4 } },
    { id: 'konjugasyon', label: 'Azalmış konjugasyon', note: 'Enzim kapasitesi düşük: indirekt bilirubin hafif-orta yükselir, direkt normal kalır.', set: { ugt: 0.3 } },
    { id: 'tikaniklik', label: 'Safra akışında engel', note: 'Konjuge bilirubin safraya atılamaz, kana geri kaçar: direkt bilirubin yükselir.', set: { obs: 0.8 } },
  ],
  equations: [
    'd(indirekt)/dt = üretim − V_max · kapasite · indirekt / (K_m + indirekt)   (Michaelis–Menten)',
    'd(direkt)/dt = konjugasyon hızı · geri kaçış oranı − k · direkt;  geri kaçış = 0,05 + 0,95 · engel',
    'total = indirekt + direkt',
  ],
  assumptions: ['Karaciğere alım ve konjugasyon tek bir doyabilen basamaktır.', 'Albümine bağlanma, enterohepatik dolaşım ve böbrekten atılımın ayrıntısı yoktur.', 'Üretim alyuvar yıkımıyla orantılıdır.'],
  validity: 'Bilirubin yüksekliğinin üç ana mekanizmasını (üretim, konjugasyon, atılım) ve hangi türün yükseldiğini gösterir.',
  limits: ['Sarılığın nedenini kişiye özel ayırt etmez.', 'Karaciğer hücre hasarında görülen karışık tablo modellenmez.'],
  sources: [
    { title: 'Berk PD ve ark. J Clin Invest 1969;48:2176–2190', detail: 'İnsanda bilirubin kinetiği' },
    { title: 'Erlinger S ve ark. Gastroenterology 2014;146:1625–1638', detail: 'Bilirubin metabolizması ve kalıtsal bozuklukları' },
  ],
  init: () => [0.6, 0.15],
  deriv(t, y, p) {
    const q = t < START ? { hem: 1, ugt: 1, obs: 0 } : p;
    const conj = (VMAX * q.ugt! * y[0]!) / (KM + y[0]!);
    return [PROD * q.hem! - conj, conj * (0.05 + 0.95 * q.obs!) - KR * y[1]!];
  },
  observe: (_t, y) => ({ ind: y[0]!, dir: y[1]!, tot: y[0]! + y[1]! }),
  phase: (t) => (t < START ? 'Denge' : 'Yeni dengeye geçiş'),
  metrics(samples) {
    const tot = lastOf(samples, 'tot');
    return [
      { key: 'tot', label: 'Total bilirubin', value: tot, unit: 'mg/dL', decimals: 2, typical: '0,2–1,2' },
      { key: 'ind', label: 'İndirekt', value: lastOf(samples, 'ind'), unit: 'mg/dL', decimals: 2, typical: '0,2–0,9' },
      { key: 'dir', label: 'Direkt', value: lastOf(samples, 'dir'), unit: 'mg/dL', decimals: 2, typical: '0–0,3' },
      { key: 'frac', label: 'Direkt / total', value: tot > 0 ? (100 * lastOf(samples, 'dir')) / tot : NaN, unit: '%', decimals: 0, typical: '< 20–30' },
    ];
  },
};
