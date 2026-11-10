import { lastOf } from '../run';
import type { Params, SimModel } from '../types';

const RA0 = 0.0317; // mmHg·dk/mL, getirici arteriyol
const RE0 = 0.0308; // götürücü arteriyol
const RV0 = 0.0117; // venöz
const PV = 4;
const PBS = 15; // Bowman boşluğu basıncı
const HCT = 0.45;
const VD = 420; // dL, kreatinin dağılım hacmi (≈ 42 L)

export interface Glomerulus {
  rbf: number;
  rpf: number;
  pgc: number;
  nfp: number;
  gfr: number;
  ff: number;
}

/** Glomerül hemodinamiği: Starling kuvvetleri; onkotik basınç süzme oranıyla artar (sabit nokta yinelemesi). */
export function glomerulus(p: Params): Glomerulus {
  const ra = RA0 * p.ra!;
  const re = RE0 * p.re!;
  const rbf = Math.max(0, (p.map! - PV) / (ra + re + RV0));
  const pgc = p.map! - rbf * ra;
  const rpf = rbf * (1 - HCT);
  let gfr = 100;
  for (let k = 0; k < 60; k++) {
    const ff = Math.min(0.6, gfr / Math.max(1, rpf));
    const piAvg = (p.pia! + p.pia! / (1 - ff)) / 2;
    const next = Math.max(0, p.kf! * (pgc - PBS - piAvg));
    gfr = 0.5 * gfr + 0.5 * next;
  }
  const ff = rpf > 0 ? gfr / rpf : 0;
  const nfp = p.kf! > 0 ? gfr / p.kf! : 0;
  return { rbf, rpf, pgc, nfp, gfr, ff };
}

const NORMAL: Params = { map: 93, ra: 1, re: 1, kf: 10, pia: 25, prod: 1 };
const GFR0 = glomerulus(NORMAL).gfr;

/** Glomerüler süzme ve kreatinin dengesi. Durum: [plazma kreatinini (mg/dL)]; zaman: saat. */
export const kidney: SimModel = {
  id: 'bobrek-suzme',
  title: 'Böbrekte süzme (GFR) ve kreatinin',
  question: 'Glomerüldeki basınçlar süzme hızını, süzme hızı da kandaki kreatinini nasıl belirler?',
  system: 'Üriner',
  organs: ['kidneys'],
  interior: 'kidneys',
  relatedTests: ['creatinine', 'egfr', 'urea', 'bun', 'albumin', 'urine-microalbumin', 'potassium'],
  timeUnit: 'saat',
  dt: 0.05,
  duration: 96,
  sampleEvery: 0.5,
  pace: 8,
  panels: ['Süzme hızı (mL/dk)', 'Plazma kreatinini (mg/dL)'],
  series: [
    { key: 'gfr', label: 'GFR', unit: 'mL/dk', panel: 0, color: 'a', decimals: 0 },
    { key: 'cr', label: 'Kreatinin', unit: 'mg/dL', panel: 1, color: 'b', decimals: 2 },
  ],
  params: [
    { key: 'map', label: 'Ortalama arter basıncı', unit: 'mmHg', min: 50, max: 160, step: 1, value: 93 },
    { key: 'ra', label: 'Getirici arteriyol direnci', unit: '× tipik', min: 0.5, max: 3, step: 0.05, value: 1, hint: 'Daralırsa glomerül basıncı ve akım düşer' },
    { key: 're', label: 'Götürücü arteriyol direnci', unit: '× tipik', min: 0.5, max: 3, step: 0.05, value: 1, hint: 'Daralırsa glomerül basıncı artar' },
    { key: 'kf', label: 'Süzme katsayısı (Kf)', unit: 'mL/dk/mmHg', min: 1, max: 14, step: 0.5, value: 10, hint: 'Çalışan nefron sayısı ve süzgeç geçirgenliği' },
    { key: 'pia', label: 'Plazma onkotik basıncı', unit: 'mmHg', min: 15, max: 35, step: 0.5, value: 25, hint: 'Başlıca albümin belirler' },
    { key: 'prod', label: 'Kreatinin üretimi', unit: 'mg/dk', min: 0.4, max: 2, step: 0.05, value: 1, hint: 'Kas kütlesiyle orantılı' },
  ],
  scenarios: [
    { id: 'getirici', label: 'Getirici arteriyol daralması', note: 'Glomerüle gelen akım ve basınç azalır: GFR düşer; kreatinin günler içinde yeni dengesine yükselir.', set: { ra: 1.35 } },
    { id: 'goturucu', label: 'Götürücü arteriyol gevşemesi', note: 'Glomerül basıncı düşer: akım artsa da GFR azalır.', set: { re: 0.6 } },
    { id: 'nefron', label: 'Azalmış süzme yüzeyi', note: 'Kf düşer (daha az çalışan nefron): GFR azalır. Kreatinin GFR ile ters orantılı arttığı için erken kayıpta az değişir.', set: { kf: 4 } },
    { id: 'dusuk-basinc', label: 'Düşük kan basıncı', note: 'Bu modelde öz-düzenleme yoktur: basınç düşünce GFR belirgin düşer (gerçekte 80–180 mmHg arasında korunur).', set: { map: 75 } },
    { id: 'kas', label: 'Yüksek kas kütlesi', note: 'Süzme aynıyken kreatinin üretimi fazla: kreatinin daha yüksek dengede durur (böbrek işlevi değişmeden).', set: { prod: 1.5 } },
  ],
  equations: [
    'Böbrek kan akımı = (OAB − P_ven) / (R_getirici + R_götürücü + R_ven);  P_GK = OAB − akım · R_getirici',
    'Net süzme basıncı = P_GK − P_Bowman − π_GK;  π_GK süzme oranıyla artar: π_çıkış = π_giriş / (1 − FF)',
    'GFR = K_f · net süzme basıncı;  FF = GFR / plazma akımı',
    'V · dCr/dt = üretim − GFR · Cr  →  dengede Cr = üretim / GFR',
  ],
  assumptions: ['Öz-düzenleme (miyojenik yanıt, tübüloglomerüler geri bildirim) yoktur.', 'Kreatinin yalnızca süzülür; tübüler salgı ve böbrek dışı atılım yok sayılır.', 'Hematokrit %45, Bowman basıncı 15 mmHg sabittir.'],
  validity: 'Starling kuvvetleri ve klirens kavramını gösterir; kararlı durumda kreatinin ↔ GFR ters orantısı doğrudur.',
  limits: ['Kişisel GFR ölçümü ya da tahmini değildir (kişisel tahmin için eGFR hesaplayıcısına bak).', 'Akut böbrek hasarının hücresel mekanizmaları modellenmez.'],
  sources: [
    { title: 'Deen WM ve ark. Am J Physiol 1972;223:1178–1183', detail: 'Glomerüler ultrafiltrasyon modeli' },
    { title: 'Hall JE. Guyton and Hall Textbook of Medical Physiology', detail: 'Glomerül hemodinamiği için tipik değerler' },
  ],
  init: () => [(NORMAL.prod! / GFR0) * 100],
  deriv(_t, y, p) {
    const g = glomerulus(p).gfr / 100; // dL/dk
    return [(60 * (p.prod! - g * y[0]!)) / VD];
  },
  observe(_t, y, p) {
    const g = glomerulus(p);
    return { gfr: g.gfr, cr: y[0]!, pgc: g.pgc };
  },
  metrics(samples, p) {
    const g = glomerulus(p);
    return [
      { key: 'gfr', label: 'GFR', value: g.gfr, unit: 'mL/dk', decimals: 0, typical: '90–125' },
      { key: 'pgc', label: 'Glomerül kılcal basıncı', value: g.pgc, unit: 'mmHg', decimals: 0, typical: '≈ 55' },
      { key: 'nfp', label: 'Net süzme basıncı', value: g.nfp, unit: 'mmHg', decimals: 1, typical: '10–15' },
      { key: 'ff', label: 'Süzme oranı', value: 100 * g.ff, unit: '%', decimals: 0, typical: '≈ 20' },
      { key: 'rpf', label: 'Böbrek plazma akımı', value: g.rpf, unit: 'mL/dk', decimals: 0, typical: '≈ 600–700' },
      { key: 'cr', label: 'Kreatinin (96. saat)', value: lastOf(samples, 'cr'), unit: 'mg/dL', decimals: 2, typical: '0,6–1,2' },
      { key: 'crss', label: 'Kreatinin (yeni denge)', value: g.gfr >= 1 ? (100 * p.prod!) / g.gfr : NaN, unit: 'mg/dL', decimals: 2 },
    ];
  },
  curves(_s, p) {
    const g = glomerulus(p);
    return [
      {
        id: 'crgfr',
        title: 'Dengede kreatinin ↔ GFR (ters orantı)',
        xLabel: 'GFR (mL/dk)',
        yLabel: 'Kreatinin (mg/dL)',
        lines: [{ label: `Üretim ${p.prod!.toFixed(2)} mg/dk`, points: Array.from({ length: 56 }, (_, i) => ({ x: 10 + i * 2.5, y: (100 * p.prod!) / (10 + i * 2.5) })) }],
        ...(g.gfr >= 10 ? { marker: { x: g.gfr, y: (100 * p.prod!) / g.gfr, label: 'Model' } } : {}),
      },
    ];
  },
  personal(m) {
    const markers = [];
    const used: string[] = [];
    if (m.creatinine !== undefined && m.egfr !== undefined) {
      markers.push({ curve: 'crgfr', x: m.egfr, y: m.creatinine, label: 'Senin raporun (eGFR, kreatinin)' });
      used.push('creatinine', 'egfr');
    }
    return { params: {}, markers, used };
  },
};
