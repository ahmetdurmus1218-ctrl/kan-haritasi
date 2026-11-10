import { lastOf, maxOf, minOf } from '../run';
import type { SimModel } from '../types';

const TBW0 = 42; // L
const OSM0 = 285 * TBW0; // mOsm, etkin çözünen
const SOLUTE = 800 / 24; // mOsm/saat, atılması gereken çözünen
const INSENS = 0.6 / 24; // L/saat
const DRINK0 = 0.0958; // L/saat (≈ 2,3 L/gün) — tipik dengede idrar + duyulmayan kayıp
const AT = 2; // saat: olay anı

const adhOf = (posm: number, floor: number): number => Math.max(floor, 0.38 * (posm - 280));
const uosmOf = (adh: number): number => 50 + (1150 * adh * adh) / (adh * adh + 6.25);

/** Su-sodyum dengesi ve ADH. Durum: [toplam vücut suyu (L), etkin çözünen (mOsm), ADH (pg/mL)]; zaman: saat. */
export const fluid: SimModel = {
  id: 'su-dengesi',
  title: 'Su dengesi, sodyum ve ADH',
  question: 'Vücut, su ve tuz değişince kanın yoğunluğunu nasıl sabit tutar?',
  system: 'Üriner · endokrin',
  organs: ['kidneys'],
  interior: 'kidneys',
  relatedTests: ['sodium', 'potassium', 'chloride', 'urea', 'glucose', 'creatinine'],
  timeUnit: 'saat',
  dt: 0.01,
  duration: 36,
  sampleEvery: 0.1,
  pace: 3,
  panels: ['Plazma sodyumu (mmol/L)', 'İdrar akımı (mL/saat)', 'İdrar yoğunluğu (mOsm/kg)'],
  series: [
    { key: 'na', label: 'Sodyum', unit: 'mmol/L', panel: 0, color: 'a', decimals: 1 },
    { key: 'urine', label: 'İdrar akımı', unit: 'mL/saat', panel: 1, color: 'b', decimals: 0 },
    { key: 'uosm', label: 'İdrar ozmolalitesi', unit: 'mOsm/kg', panel: 2, color: 'c', decimals: 0 },
  ],
  params: [
    { key: 'bolus', label: 'Bir kerede içilen su', unit: 'L', min: 0, max: 3, step: 0.1, value: 0 },
    { key: 'drink', label: 'Günlük su alımı', unit: '× tipik', min: 0, max: 3, step: 0.1, value: 1, hint: '0 = suya erişim yok' },
    { key: 'salt', label: 'Tuz yükü (sodyum)', unit: 'mmol', min: 0, max: 300, step: 10, value: 0, hint: '≈ 17 mmol = 1 g tuz' },
    { key: 'adhmin', label: 'ADH alt sınırı', unit: 'pg/mL', min: 0, max: 6, step: 0.5, value: 0, hint: 'ADH\'nin baskılanamadığı durum' },
    { key: 'thirst', label: 'Susama yanıtı', unit: '0 kapalı · 1 açık', min: 0, max: 1, step: 1, value: 1 },
  ],
  scenarios: [
    { id: 'su-yuku', label: '1,5 L su içmek', note: 'Plazma seyrelir, ADH baskılanır: böbrek saatler içinde bol ve seyreltik idrar çıkarır; sodyum çok az değişir.', set: { bolus: 1.5 } },
    { id: 'susuzluk', label: 'Su içmemek', note: 'Sodyum ve ozmolalite yavaşça yükselir; ADH artar, idrar azalır ve yoğunlaşır.', set: { drink: 0, thirst: 0 } },
    { id: 'tuz', label: 'Tuz yükü', note: 'Ozmolalite yükselir: ADH ve susama devreye girer, su tutulur; fazla tuz saatler-günler içinde atılır.', set: { salt: 200 } },
    { id: 'adh', label: 'Baskılanamayan ADH + su', note: 'ADH yüksek kaldığı için içilen su atılamaz: sodyum seyrelerek düşer.', set: { adhmin: 4, bolus: 1.5, drink: 1.5 } },
  ],
  equations: [
    'P_osm = etkin çözünen / toplam vücut suyu;  Na⁺ ≈ P_osm / 2 − 2,5',
    'ADH = max(alt sınır, 0,38 · (P_osm − 280))   (ozmoreseptör eşiği ≈ 280 mOsm/kg)',
    'U_osm = 50 + 1150 · ADH² / (ADH² + 2,5²);  idrar akımı = atılan çözünen / U_osm',
    'd(su)/dt = içilen − idrar − duyulmayan kayıp;  susama: P_osm > 290 ise ek alım',
  ],
  assumptions: ['Tek bölme: hücre içi ve dışı sıvı ozmotik dengededir.', 'Günlük çözünen yükü 800 mOsm; tuz fazlası ≈ 24 saat zaman sabitiyle atılır.', 'Hacim (basınç) reseptörleri, aldosteron ve natriüretik peptitler yoktur.'],
  validity: 'Ozmolalite → ADH → idrar yoğunluğu geri bildirimini ve su yüküne verilen yanıtı gösterir.',
  limits: ['Kişisel sodyum değerinin nedeni hakkında bilgi vermez.', 'Kalp, karaciğer ve böbrek hastalıklarındaki su-tuz dengesi modellenmez.'],
  sources: [
    { title: 'Robertson GL ve ark. J Clin Invest 1973;52:2340–2352', detail: 'Plazma ozmolalitesi ile vazopressin ilişkisi' },
    { title: 'Verbalis JG. Best Pract Res Clin Endocrinol Metab 2003;17:471–503', detail: 'Su dengesi bozuklukları ve düzenlenmesi' },
  ],
  init: () => [TBW0, OSM0, adhOf(285, 0)],
  deriv(t, y, p) {
    const [w, osm, adh] = y as [number, number, number];
    const posm = osm / w;
    const excr = Math.max(5, SOLUTE + (osm - OSM0) / 24);
    const urine = excr / uosmOf(adh);
    const bolus = t >= AT && t < AT + 1 ? p.bolus! : 0;
    const salt = t >= AT && t < AT + 0.5 ? (2 * p.salt!) / 0.5 : 0;
    const thirst = p.thirst! && posm > 290 ? 0.15 * (posm - 290) : 0;
    const drink = (t < AT ? DRINK0 : DRINK0 * p.drink!) + thirst + bolus;
    return [drink - urine - INSENS, SOLUTE + salt - excr, (adhOf(posm, p.adhmin!) - adh) / 0.3];
  },
  observe(_t, y) {
    const posm = y[1]! / y[0]!;
    const excr = Math.max(5, SOLUTE + (y[1]! - OSM0) / 24);
    return { na: posm / 2 - 2.5, posm, urine: (1000 * excr) / uosmOf(y[2]!), uosm: uosmOf(y[2]!), adh: y[2]! };
  },
  metrics(samples) {
    return [
      { key: 'namin', label: 'En düşük sodyum', value: minOf(samples, 'na'), unit: 'mmol/L', decimals: 1, typical: '135–145' },
      { key: 'namax', label: 'En yüksek sodyum', value: maxOf(samples, 'na'), unit: 'mmol/L', decimals: 1, typical: '135–145' },
      { key: 'urmax', label: 'En yüksek idrar akımı', value: maxOf(samples, 'urine'), unit: 'mL/saat', decimals: 0, typical: '≈ 60–80 (dengede)' },
      { key: 'uosm', label: 'İdrar ozmolalitesi (son)', value: lastOf(samples, 'uosm'), unit: 'mOsm/kg', decimals: 0, typical: '50–1200' },
      { key: 'posm', label: 'Plazma ozmolalitesi (son)', value: lastOf(samples, 'posm'), unit: 'mOsm/kg', decimals: 0, typical: '275–295' },
    ];
  },
};
