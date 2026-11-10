import { maxOf, meanOf, minOf } from '../run';
import type { Sample, SimModel } from '../types';

const V0 = 10; // mL, basınçsız hacim
const RMV = 0.01; // mmHg·sn/mL, mitral kapak direnci
const RAV = 0.01; // aort kapağı direnci
const PCVP = 3; // mmHg, sistemik venöz basınç

/** Normalize elastans (Stergiopulos ve ark. 1996, "çift Hill" işlevi): 0 → 1 → 0. */
export function elastance(tInCycle: number, period: number): number {
  const tMax = 0.2 + 0.15 * period;
  const tn = tInCycle / tMax;
  const a = Math.pow(tn / 0.7, 1.9);
  const b = Math.pow(tn / 1.17, 21.9);
  return 1.55 * (a / (1 + a)) * (1 / (1 + b));
}

function state(t: number, y: number[], p: Record<string, number>) {
  const period = 60 / p.hr!;
  const e = elastance(t % period, period);
  const E = p.emin! + (p.emax! - p.emin!) * e;
  const plv = E * (y[0]! - V0);
  const qmv = Math.max(0, (p.pla! - plv) / RMV);
  const qav = Math.max(0, (plv - y[1]!) / RAV);
  return { e, plv, qmv, qav, period };
}

/**
 * Sol ventrikül + arter sistemi: zamanla değişen elastans modeli (Suga & Sagawa) ve iki elemanlı Windkessel.
 * Durum: [sol ventrikül hacmi (mL), aort basıncı (mmHg)].
 */
export const cardiac: SimModel = {
  id: 'kalp-dongusu',
  title: 'Kalp döngüsü ve kan basıncı',
  question: 'Sol karıncık her atımda nasıl dolar, kasılır ve aorta kan pompalar?',
  system: 'Dolaşım',
  organs: ['heart'],
  interior: 'heart',
  relatedTests: ['ldl', 'hdl', 'triglyceride', 'ck', 'potassium'],
  timeUnit: 'sn',
  dt: 0.0005,
  duration: 8,
  sampleEvery: 0.005,
  pace: 1,
  loop: true,
  panels: ['Basınç (mmHg)', 'Sol karıncık hacmi (mL)'],
  series: [
    { key: 'plv', label: 'Sol karıncık basıncı', unit: 'mmHg', panel: 0, color: 'a', decimals: 0 },
    { key: 'pao', label: 'Aort basıncı', unit: 'mmHg', panel: 0, color: 'b', decimals: 0 },
    { key: 'vlv', label: 'Sol karıncık hacmi', unit: 'mL', panel: 1, color: 'c', decimals: 0 },
  ],
  params: [
    { key: 'hr', label: 'Kalp hızı', unit: 'atım/dk', min: 40, max: 180, step: 1, value: 70 },
    { key: 'emax', label: 'Kasılma gücü (Emax)', unit: 'mmHg/mL', min: 0.5, max: 5, step: 0.1, value: 3, hint: 'Sistol sonu elastans: karıncığın kasılabilirliği' },
    { key: 'emin', label: 'Diyastolik sertlik (Emin)', unit: 'mmHg/mL', min: 0.03, max: 0.2, step: 0.002, value: 0.068, hint: 'Gevşemiş karıncığın sertliği; arttıkça dolum zorlaşır' },
    { key: 'rs', label: 'Sistemik damar direnci', unit: 'mmHg·sn/mL', min: 0.4, max: 2.5, step: 0.05, value: 1, hint: 'Ard yük' },
    { key: 'c', label: 'Arter esnekliği (kompliyans)', unit: 'mL/mmHg', min: 0.4, max: 3, step: 0.05, value: 1.3 },
    { key: 'pla', label: 'Dolum basıncı (sol kulakçık)', unit: 'mmHg', min: 2, max: 25, step: 0.5, value: 8, hint: 'Ön yük' },
  ],
  scenarios: [
    { id: 'egzersiz', label: 'Egzersiz', note: 'Kalp hızı ve kasılma gücü artar, çalışan kaslarda damar direnci düşer: kalp debisi yükselir.', set: { hr: 130, emax: 4.5, rs: 0.55, pla: 12 } },
    { id: 'dusuk-kasilma', label: 'Azalmış kasılma gücü', note: 'Emax düşer: sistol sonu hacim artar, atım hacmi ve ejeksiyon fraksiyonu azalır.', set: { emax: 1.1 } },
    { id: 'yuksek-direnc', label: 'Artmış damar direnci', note: 'Ard yük artar: aort basıncı yükselir, atım hacmi bir miktar düşer.', set: { rs: 1.8 } },
    { id: 'sert-arter', label: 'Sertleşmiş arterler', note: 'Kompliyans düşer: sistolik basınç artar, diyastolik düşer; nabız basıncı genişler.', set: { c: 0.6 } },
    { id: 'dusuk-dolum', label: 'Azalmış dolum (sıvı kaybı)', note: 'Ön yük düşer: diyastol sonu hacim ve atım hacmi azalır (Frank–Starling).', set: { pla: 4 } },
    { id: 'sert-karincik', label: 'Sert karıncık (gevşeme güçlüğü)', note: 'Diyastolik sertlik artar: aynı dolum basıncıyla daha az dolar; ejeksiyon fraksiyonu korunabilir.', set: { emin: 0.14 } },
  ],
  equations: [
    'P_sv(t) = E(t) · (V − V₀);  E(t) = E_min + (E_max − E_min) · e(t)',
    'dV/dt = Q_mitral − Q_aort;  Q = max(0, ΔP / R_kapak)',
    'C · dP_aort/dt = Q_aort − (P_aort − P_ven) / R_sistemik',
    'Atım hacmi = EDV − ESV;  EF = atım hacmi / EDV;  debi = atım hacmi × kalp hızı',
  ],
  assumptions: [
    'Yalnızca sol karıncık ve sistemik arterler modellenir; sağ kalp ve akciğer dolaşımı sabit dolum basıncıyla temsil edilir.',
    'Kapaklar ideal diyottur (geri kaçış ve darlık yok).',
    'Otonom sinir sistemi refleksleri (barorefleks) yoktur: parametre değişince vücudun telafisi gösterilmez.',
  ],
  validity: 'Dinlenme ve orta egzersiz aralığında, tek bir karıncığın basınç-hacim ilişkisini nitel ve yaklaşık nicel olarak gösterir.',
  limits: ['Kişisel kalp ölçümü (EKO, kateter) değildir; ejeksiyon fraksiyonu tahmini yapmaz.', 'Diyastolik basınç-hacim ilişkisi doğrusal alınmıştır; gerçekte üsteldir.', 'Ritim bozuklukları, kapak hastalıkları ve iskemi modellenmez.'],
  sources: [
    { title: 'Suga H, Sagawa K. Circ Res 1974;35:117–126', detail: 'Zamanla değişen elastans ve sistol sonu basınç-hacim ilişkisi' },
    { title: 'Stergiopulos N ve ark. Am J Physiol 1996;270:H2050–H2059', detail: 'Normalize elastans işlevi' },
    { title: 'Westerhof N ve ark. Med Biol Eng Comput 2009;47:131–141', detail: 'Arteriyel Windkessel modeli' },
  ],
  init: (p) => [V0 + p.pla! / p.emin!, 80],
  deriv(t, y, p) {
    const s = state(t, y, p);
    return [s.qmv - s.qav, (s.qav - (y[1]! - PCVP) / p.rs!) / p.c!];
  },
  observe(t, y, p) {
    const s = state(t, y, p);
    return { plv: s.plv, pao: y[1]!, vlv: y[0]!, qav: s.qav, qmv: s.qmv };
  },
  phase(t, y, p) {
    const s = state(t, y, p);
    if (s.qav > 0) return 'Fırlatma (aort kapağı açık)';
    if (s.qmv > 0) return 'Dolum (mitral kapak açık)';
    const period = s.period;
    return (t % period) < 0.2 + 0.15 * period ? 'İzovolümetrik kasılma' : 'İzovolümetrik gevşeme';
  },
  metrics(samples, p) {
    const period = 60 / p.hr!;
    const end = samples[samples.length - 1]?.t ?? 0;
    const beats = Math.max(1, Math.floor(end / period) - 1);
    // Son tam atım (başlangıç geçici rejimi dışarıda).
    const from = (beats - 1) * period + period;
    const last: Sample[] = samples.filter((s) => s.t >= from - period && s.t < from);
    const edv = maxOf(last, 'vlv');
    const esv = minOf(last, 'vlv');
    const sv = edv - esv;
    return [
      { key: 'sv', label: 'Atım hacmi', value: sv, unit: 'mL', decimals: 0, typical: '60–100' },
      { key: 'ef', label: 'Ejeksiyon fraksiyonu', value: (100 * sv) / edv, unit: '%', decimals: 0, typical: '55–70' },
      { key: 'co', label: 'Kalp debisi', value: (sv * p.hr!) / 1000, unit: 'L/dk', decimals: 1, typical: '4–8 (dinlenme)' },
      { key: 'sbp', label: 'Sistolik basınç', value: maxOf(last, 'pao'), unit: 'mmHg', decimals: 0, typical: '90–130' },
      { key: 'dbp', label: 'Diyastolik basınç', value: minOf(last, 'pao'), unit: 'mmHg', decimals: 0, typical: '60–85' },
      { key: 'map', label: 'Ortalama arter basıncı', value: meanOf(last, 'pao'), unit: 'mmHg', decimals: 0, typical: '70–100' },
      { key: 'edv', label: 'Diyastol sonu hacim', value: edv, unit: 'mL', decimals: 0, typical: '100–150' },
      { key: 'esv', label: 'Sistol sonu hacim', value: esv, unit: 'mL', decimals: 0, typical: '35–65' },
    ];
  },
  curves(samples, p) {
    const period = 60 / p.hr!;
    const end = samples[samples.length - 1]?.t ?? 0;
    const from = Math.max(0, end - period * 1.02);
    const loop = samples.filter((s) => s.t >= from).map((s) => ({ x: s.v.vlv!, y: s.v.plv! }));
    // Yardımcı doğrular halkanın basınç aralığında kesilir (ölçeği bozmasınlar).
    const pTop = 1.15 * Math.max(1, ...loop.map((q) => q.y));
    const vEnd = Math.max(V0 + 1, ...loop.map((q) => q.x)) * 1.05;
    return [
      {
        id: 'pv',
        title: 'Basınç-hacim halkası (son atım)',
        xLabel: 'Hacim (mL)',
        yLabel: 'Basınç (mmHg)',
        lines: [
          { label: 'Bir kalp atımı', points: loop },
          { label: 'Sistol sonu ilişkisi (Emax)', dashed: true, points: [V0, Math.min(vEnd, V0 + pTop / p.emax!)].map((v) => ({ x: v, y: p.emax! * (v - V0) })) },
          { label: 'Diyastolik ilişki (Emin)', dashed: true, points: [V0, vEnd].map((v) => ({ x: v, y: p.emin! * (v - V0) })) },
        ],
      },
    ];
  },
};
