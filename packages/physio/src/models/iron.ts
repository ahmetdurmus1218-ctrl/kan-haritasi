import { firstCross, lastOf } from '../run';
import type { Params, SimModel } from '../types';

const FE_PER_HB = 170; // mg demir / (g/dL hemoglobin) — ≈ 5 L kan, 3,4 mg Fe / g Hb
const LIFESPAN = 120; // gün
const HB_SET = 14.5;
const S0 = 800; // mg, tipik depo
const BASAL_LOSS = 1.5; // mg/gün
const START = 20;
const BASE_DEMAND = (14.5 * 170) / 120; // mg/gün, dengede iliğin kullandığı demir

interface Flows {
  hep: number;
  absorb: number;
  supply: number;
  demand: number;
  used: number;
  recycle: number;
  bleedFe: number;
  tsat: number;
  ferritin: number;
}

function flows(y: number[], p: Params): Flows {
  const hb = y[0]! / FE_PER_HB;
  const s = Math.max(0, y[1]!);
  // Hepsidin: depo doluluğu ve inflamasyonla artar; demir emilimini ve depodan salınımı kısar.
  const hep = Math.pow(s / S0, 0.7) * p.infl!;
  const absorb = (p.diet! * 0.3) / (1 + 2 * hep);
  // İnflamasyonda hepsidin, makrofaj ve depodan demir çıkışını (ferroportin) kısar; tümüyle kapatamaz.
  const avail = Math.max(0.25, 1 / (1 + 0.9 * Math.pow(p.infl! - 1, 1.5)));
  const recycle = y[0]! / LIFESPAN;
  const mobil = (40 * s) / (s + 200);
  const supply = (recycle + mobil) * avail + absorb;
  // Eritropoietin: hemoglobin düştükçe üstel artar (böbrek kapasitesiyle sınırlı).
  const epo = Math.min(8, Math.exp(0.45 * (HB_SET - hb))) * p.epo!;
  const demand = (HB_SET * FE_PER_HB * epo) / LIFESPAN;
  const used = Math.min(demand, supply);
  const bleedFe = (p.bleed! * hb * 3.4) / 100;
  // Doygunluk: iliğe sunulabilen demirin dengedeki kullanıma oranı (dengede ≈ %30).
  const tsat = Math.max(3, Math.min(90, (30 * (supply / BASE_DEMAND)) / 2.6));
  const ferritin = (s / 8) * (1 + 0.5 * (p.infl! - 1));
  return { hep, absorb, supply, demand, used, recycle, bleedFe, tsat, ferritin };
}

const NORMAL: Params = { diet: 15, bleed: 0, infl: 1, epo: 1 };

/** Demir dengesi ve alyuvar yapımı. Durum: [alyuvarlardaki demir (mg), depo demiri (mg)]; zaman: gün. */
export const iron: SimModel = {
  id: 'demir-eritropoez',
  title: 'Demir dengesi ve alyuvar yapımı',
  question: 'Demir emilimi, depolar ve eritropoietin hemoglobini nasıl belirler?',
  system: 'Kan · kemik iliği',
  organs: ['bones', 'small-intestine', 'liver', 'kidneys'],
  interior: 'ic.bone-marrow',
  relatedTests: ['hemoglobin', 'ferritin', 'iron', 'tibc', 'transferrin-saturation', 'mcv', 'rbc', 'crp'],
  timeUnit: 'gün',
  dt: 0.25,
  duration: 420,
  sampleEvery: 2,
  pace: 40,
  panels: ['Hemoglobin (g/dL)', 'Ferritin (ng/mL)', 'Transferrin doygunluğu (%)'],
  series: [
    { key: 'hb', label: 'Hemoglobin', unit: 'g/dL', panel: 0, color: 'a', decimals: 1 },
    { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', panel: 1, color: 'b', decimals: 0 },
    { key: 'tsat', label: 'Transferrin doygunluğu', unit: '%', panel: 2, color: 'c', decimals: 0 },
  ],
  params: [
    { key: 'diet', label: 'Besinle alınan demir', unit: 'mg/gün', min: 0, max: 40, step: 1, value: 15 },
    { key: 'bleed', label: 'Günlük kan kaybı', unit: 'mL/gün', min: 0, max: 60, step: 1, value: 0 },
    { key: 'infl', label: 'İnflamasyon (hepsidin uyarısı)', unit: '× tipik', min: 1, max: 5, step: 0.1, value: 1 },
    { key: 'epo', label: 'Eritropoietin yanıtı', unit: '× tipik', min: 0.1, max: 1.5, step: 0.05, value: 1, hint: 'Böbreğin EPO üretme kapasitesi' },
  ],
  scenarios: [
    { id: 'kan-kaybi', label: 'Süregelen kan kaybı', note: 'Önce depolar boşalır (ferritin ↓), sonra iliğe giden demir azalır (doygunluk ↓), en son hemoglobin düşer.', set: { bleed: 20 } },
    { id: 'az-alim', label: 'Yetersiz demir alımı', note: 'Emilim kayıpları karşılayamaz: depolar aylar içinde yavaşça azalır.', set: { diet: 3 } },
    { id: 'inflamasyon', label: 'Süregelen inflamasyon', note: 'Hepsidin artar: demir depoda hapsolur. Ferritin yüksek/normal kalırken doygunluk ve hemoglobin düşer.', set: { infl: 3 } },
    { id: 'epo', label: 'Azalmış eritropoietin', note: 'İlik yeterince uyarılmaz: demir yeterliyken hemoglobin düşer, kullanılmayan demir depoda birikir.', set: { epo: 0.3 } },
  ],
  equations: [
    'd(Fe_alyuvar)/dt = iliğin kullandığı demir − Fe_alyuvar / 120 gün − kanamayla kayıp',
    'd(Fe_depo)/dt = geri kazanılan + emilen − kullanılan − bazal kayıp',
    'hepsidin ∝ (depo / 800 mg)^0,7 · inflamasyon;  emilim = alım · 0,30 / (1 + 2 · hepsidin)',
    'depodan/makrofajdan demir çıkışı = 1 / (1 + 0,9 · (inflamasyon − 1)^1,5), en az 0,25',
    'ilik talebi ∝ EPO = exp(0,45 · (Hb_hedef − Hb));  kullanılan = min(talep, sunulabilen demir)',
  ],
  assumptions: ['Alyuvar ömrü 120 gün, kan hacmi ≈ 5 L, ferritin 1 ng/mL ≈ 8 mg depo demiri.', 'Hepsidin, depo ve inflamasyonun tek bir işleviyle temsil edilir.', 'B12/folat, hemoliz ve alyuvar boyutu (MCV) modellenmez.'],
  validity: 'Demir eksikliğinin evrelerini (depo → taşıma → hemoglobin) ve inflamasyon anemisindeki farklı örüntüyü nitel olarak gösterir.',
  limits: ['Kişisel demir durumu, kanama miktarı ya da tedavi yanıtı tahmini değildir.', 'Süreler ve düzeyler yaklaşık değerlerdir.'],
  sources: [
    { title: 'Ganz T. Physiol Rev 2013;93:1721–1741', detail: 'Sistemik demir dengesi ve hepsidin' },
    { title: 'Finch C. Blood 1994;84:1697–1702', detail: 'Demir dengesinin düzenleyicileri, depo ve eritropoez' },
  ],
  init: () => [HB_SET * FE_PER_HB, S0],
  deriv(t, y, p) {
    const f = flows(y, t < START ? NORMAL : p);
    return [f.used - f.recycle - f.bleedFe, f.recycle + f.absorb - f.used - BASAL_LOSS];
  },
  after(_t, y) {
    y[1] = Math.max(0, y[1]!);
  },
  observe(t, y, p) {
    const f = flows(y, t < START ? NORMAL : p);
    return { hb: y[0]! / FE_PER_HB, ferritin: f.ferritin, tsat: f.tsat, absorb: f.absorb };
  },
  phase: (t) => (t < START ? 'Denge' : 'Değişiklik sürüyor'),
  metrics(samples) {
    const t12 = firstCross(samples, 'hb', 12, 'down');
    const t15 = firstCross(samples, 'ferritin', 15, 'down');
    return [
      { key: 'hb', label: 'Hemoglobin (420. gün)', value: lastOf(samples, 'hb'), unit: 'g/dL', decimals: 1, typical: '12–17' },
      { key: 'ferritin', label: 'Ferritin (420. gün)', value: lastOf(samples, 'ferritin'), unit: 'ng/mL', decimals: 0, typical: '30–300' },
      { key: 'tsat', label: 'Transferrin doygunluğu', value: lastOf(samples, 'tsat'), unit: '%', decimals: 0, typical: '20–45' },
      { key: 'absorb', label: 'Günlük demir emilimi', value: lastOf(samples, 'absorb'), unit: 'mg', decimals: 1, typical: '1–2' },
      { key: 'tfer', label: 'Ferritin 15\'in altına indi', value: Number.isNaN(t15) ? NaN : t15 - START, unit: '. gün', decimals: 0 },
      { key: 'thb', label: 'Hemoglobin 12\'nin altına indi', value: Number.isNaN(t12) ? NaN : t12 - START, unit: '. gün', decimals: 0 },
    ];
  },
};
