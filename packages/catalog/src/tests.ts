import type { ProcessId, SystemId } from './anatomy';
import type { Conversion } from './units';

/**
 * Test kataloğu: ~75 rutin test. Her test LOINC koduyla tanımlanır.
 *
 * Referans aralıkları: sonuçlar her zaman RAPORUN KENDİ aralığıyla değerlendirilir.
 * Aşağıdaki `ranges` yalnızca raporda aralık yoksa kullanılan, yaklaşık, genel yetişkin
 * değerleridir ve arayüzde "genel referans" diye etiketlenir. Laboratuvara, yöntemine, yaşa
 * ve cinsiyete göre değişir.
 */
export type TestGroup =
  | 'hemogram'
  | 'liver'
  | 'lipid'
  | 'electrolyte'
  | 'kidney'
  | 'iron'
  | 'glucose'
  | 'thyroid'
  | 'vitamin'
  | 'inflammation'
  | 'pancreas'
  | 'hormone'
  | 'coagulation'
  | 'other';

export const GROUP_LABEL: Record<TestGroup, string> = {
  hemogram: 'Hemogram (tam kan sayımı)',
  liver: 'Karaciğer',
  lipid: 'Lipid (kolesterol)',
  electrolyte: 'Elektrolit ve mineral',
  kidney: 'Böbrek',
  iron: 'Demir',
  glucose: 'Şeker metabolizması',
  thyroid: 'Tiroid',
  vitamin: 'Vitaminler',
  inflammation: 'İnflamasyon',
  pancreas: 'Pankreas',
  hormone: 'Hormonlar',
  coagulation: 'Pıhtılaşma',
  other: 'Diğer',
};

export interface RangeDef {
  sex?: 'female' | 'male';
  min?: number;
  max?: number;
}

export interface LabTestDef {
  key: string;
  loinc: string;
  nameTr: string;
  group: TestGroup;
  aliases: string[];
  /** Kanonik birim (gösterim). */
  unit: string;
  /** normalizeUnit() anahtarı → kanonik birime dönüşüm. Kanonik birim [1] ile listelenir. */
  conversions: Record<string, Conversion>;
  ranges: RangeDef[];
  /** Kanonik birimde fizyolojik olarak mümkün aralık; dışı OCR/birim hatası şüphesidir. */
  plausible: [number, number];
  decimals: number;
  /** Aynı ada sahip mutlak sayım ve yüzde testlerini ayırmak için. */
  kind?: 'count' | 'percent';
  processes: ProcessId[];
  structures: string[];
  systems: SystemId[];
  simulation?: 'ldl-atherosclerosis';
}

const COUNT3: Record<string, Conversion> = { '10^3/ul': [1], '10^9/l': [1], '/ul': [0.001] };
const COUNT6: Record<string, Conversion> = { '10^6/ul': [1], '10^12/l': [1] };
const PCT: Record<string, Conversion> = { '%': [1] };
const UL: Record<string, Conversion> = { 'u/l': [1] };
const G_DL: Record<string, Conversion> = { 'g/dl': [1], 'g/l': [0.1] };
const CHOL: Record<string, Conversion> = { 'mg/dl': [1], 'mmol/l': [38.67] };

const BLOOD = { structures: ['bones', 'spleen', 'abdominal-vessels', 'aorta', 'veins'], systems: ['hematologic', 'cardiovascular'] as SystemId[] };
const MARROW_IMMUNE = { structures: ['bones', 'spleen', 'thymus'], systems: ['hematologic', 'immune'] as SystemId[] };

function diff(prefix: string, loincAbs: string, loincPct: string, nameTr: string, abbr: string[], absRange: [number, number], pctRange: [number, number]): LabTestDef[] {
  const names = [nameTr, ...abbr];
  return [
    {
      key: `${prefix}-abs`,
      loinc: loincAbs,
      nameTr: `${nameTr} (sayı)`,
      group: 'hemogram',
      aliases: [...names.flatMap((n) => [`${n}#`, `${n} #`, `${n} sayisi`, `mutlak ${n}`]), ...names],
      unit: '10³/µL',
      conversions: COUNT3,
      ranges: [{ min: absRange[0], max: absRange[1] }],
      plausible: [0, 200],
      decimals: 2,
      kind: 'count',
      processes: ['immune-response'],
      ...MARROW_IMMUNE,
    },
    {
      key: `${prefix}-pct`,
      loinc: loincPct,
      nameTr: `${nameTr} (%)`,
      group: 'hemogram',
      aliases: [...names.flatMap((n) => [`${n}%`, `${n} %`, `${n} yuzdesi`]), ...names],
      unit: '%',
      conversions: PCT,
      ranges: [{ min: pctRange[0], max: pctRange[1] }],
      plausible: [0, 100],
      decimals: 1,
      kind: 'percent',
      processes: ['immune-response'],
      ...MARROW_IMMUNE,
    },
  ];
}

export const TESTS: readonly LabTestDef[] = [
  // ---------------------------------------------------------------- Hemogram
  {
    key: 'hemoglobin', loinc: '718-7', nameTr: 'Hemoglobin', group: 'hemogram',
    aliases: ['Hemoglobin', 'HGB', 'Hb', 'Hemoglobin (HGB)'],
    unit: 'g/dL', conversions: { ...G_DL, 'mmol/l': [1.611] },
    ranges: [{ sex: 'female', min: 12.0, max: 15.5 }, { sex: 'male', min: 13.5, max: 17.5 }],
    plausible: [2, 25], decimals: 1, processes: ['oxygen-transport', 'erythropoiesis'], ...BLOOD,
  },
  {
    key: 'hematocrit', loinc: '4544-3', nameTr: 'Hematokrit', group: 'hemogram',
    aliases: ['Hematokrit', 'HCT', 'Htc', 'Hematokrit (HCT)'],
    unit: '%', conversions: { '%': [1], 'l/l': [100] },
    ranges: [{ sex: 'female', min: 36, max: 46 }, { sex: 'male', min: 41, max: 53 }],
    plausible: [8, 75], decimals: 1, processes: ['oxygen-transport', 'erythropoiesis'], ...BLOOD,
  },
  {
    key: 'rbc', loinc: '789-8', nameTr: 'Eritrosit (alyuvar)', group: 'hemogram',
    aliases: ['Eritrosit', 'Eritrosit sayisi', 'RBC', 'Alyuvar', 'Kirmizi kan hucresi', 'Eritrosit (RBC)'],
    unit: '10⁶/µL', conversions: COUNT6,
    ranges: [{ sex: 'female', min: 4.0, max: 5.2 }, { sex: 'male', min: 4.5, max: 5.9 }],
    plausible: [0.5, 9], decimals: 2, processes: ['oxygen-transport', 'erythropoiesis'], ...BLOOD,
  },
  {
    key: 'wbc', loinc: '6690-2', nameTr: 'Lökosit (akyuvar)', group: 'hemogram',
    aliases: ['Lokosit', 'Lokosit sayisi', 'WBC', 'Akyuvar', 'Beyaz kure', 'Beyaz kan hucresi', 'Lokosit (WBC)'],
    unit: '10³/µL', conversions: COUNT3, ranges: [{ min: 4.0, max: 10.5 }],
    plausible: [0.1, 500], decimals: 2, processes: ['immune-response'], ...MARROW_IMMUNE,
  },
  {
    key: 'platelet', loinc: '777-3', nameTr: 'Trombosit', group: 'hemogram',
    aliases: ['Trombosit', 'Trombosit sayisi', 'PLT', 'Platelet', 'Trombosit (PLT)'],
    unit: '10³/µL', conversions: COUNT3, ranges: [{ min: 150, max: 400 }],
    plausible: [1, 2500], decimals: 0, processes: ['hemostasis'], structures: ['bones', 'spleen', 'aorta'], systems: ['hematologic'],
  },
  {
    key: 'mcv', loinc: '787-2', nameTr: 'MCV (ortalama alyuvar hacmi)', group: 'hemogram',
    aliases: ['MCV', 'Ortalama eritrosit hacmi', 'Ortalama korpuskuler hacim'],
    unit: 'fL', conversions: { fl: [1] }, ranges: [{ min: 80, max: 100 }],
    plausible: [40, 160], decimals: 1, processes: ['erythropoiesis', 'b12-folate', 'iron-metabolism'], ...BLOOD,
  },
  {
    key: 'mch', loinc: '785-6', nameTr: 'MCH', group: 'hemogram',
    aliases: ['MCH', 'Ortalama eritrosit hemoglobini', 'Ortalama korpuskuler hemoglobin'],
    unit: 'pg', conversions: { pg: [1] }, ranges: [{ min: 27, max: 33 }],
    plausible: [10, 60], decimals: 1, processes: ['erythropoiesis', 'iron-metabolism'], ...BLOOD,
  },
  {
    key: 'mchc', loinc: '786-4', nameTr: 'MCHC', group: 'hemogram',
    aliases: ['MCHC', 'Ortalama eritrosit hemoglobin konsantrasyonu'],
    unit: 'g/dL', conversions: G_DL, ranges: [{ min: 32, max: 36 }],
    plausible: [20, 45], decimals: 1, processes: ['erythropoiesis'], ...BLOOD,
  },
  {
    key: 'rdw', loinc: '788-0', nameTr: 'RDW (alyuvar dağılım genişliği)', group: 'hemogram',
    aliases: ['RDW', 'RDW-CV', 'RDW CV', 'Eritrosit dagilim genisligi'],
    unit: '%', conversions: PCT, ranges: [{ min: 11.5, max: 14.5 }],
    plausible: [5, 40], decimals: 1, processes: ['erythropoiesis', 'iron-metabolism'], ...BLOOD,
  },
  {
    key: 'mpv', loinc: '32623-1', nameTr: 'MPV (ortalama trombosit hacmi)', group: 'hemogram',
    aliases: ['MPV', 'Ortalama trombosit hacmi'],
    unit: 'fL', conversions: { fl: [1] }, ranges: [{ min: 7.5, max: 11.5 }],
    plausible: [3, 25], decimals: 1, processes: ['hemostasis'], structures: ['bones', 'spleen'], systems: ['hematologic'],
  },
  ...diff('neutrophil', '751-8', '770-8', 'Notrofil', ['NEU', 'NEUT', 'NE'], [2.0, 7.0], [40, 75]),
  ...diff('lymphocyte', '731-0', '736-9', 'Lenfosit', ['LYM', 'LYMPH', 'LY'], [1.0, 4.0], [20, 45]),
  ...diff('monocyte', '742-7', '5905-5', 'Monosit', ['MONO', 'MO'], [0.2, 1.0], [2, 10]),
  ...diff('eosinophil', '711-2', '713-8', 'Eozinofil', ['EOS', 'EO'], [0.0, 0.5], [0, 6]),
  ...diff('basophil', '704-7', '706-2', 'Bazofil', ['BASO', 'BA'], [0.0, 0.1], [0, 2]),

  // ---------------------------------------------------------------- Karaciğer
  {
    key: 'alt', loinc: '1742-6', nameTr: 'ALT', group: 'liver',
    aliases: ['ALT', 'ALT (SGPT)', 'SGPT', 'Alanin aminotransferaz', 'Alanin transaminaz', 'ALAT'],
    unit: 'U/L', conversions: UL, ranges: [{ sex: 'female', max: 33 }, { sex: 'male', max: 41 }, { max: 41 }],
    plausible: [1, 10000], decimals: 0, processes: ['hepatocyte-injury'], structures: ['liver'], systems: ['digestive'],
  },
  {
    key: 'ast', loinc: '1920-8', nameTr: 'AST', group: 'liver',
    aliases: ['AST', 'AST (SGOT)', 'SGOT', 'Aspartat aminotransferaz', 'Aspartat transaminaz', 'ASAT'],
    unit: 'U/L', conversions: UL, ranges: [{ sex: 'female', max: 32 }, { sex: 'male', max: 40 }, { max: 40 }],
    plausible: [1, 10000], decimals: 0, processes: ['hepatocyte-injury', 'muscle-injury'], structures: ['liver', 'heart'], systems: ['digestive', 'cardiovascular'],
  },
  {
    key: 'ggt', loinc: '2324-2', nameTr: 'GGT', group: 'liver',
    aliases: ['GGT', 'Gama glutamil transferaz', 'Gamma glutamil transferaz', 'Gamma GT', 'GGTP', 'G-GT'],
    unit: 'U/L', conversions: UL, ranges: [{ sex: 'female', max: 38 }, { sex: 'male', max: 60 }, { max: 60 }],
    plausible: [1, 5000], decimals: 0, processes: ['bile-metabolism', 'hepatocyte-injury'], structures: ['liver', 'gallbladder'], systems: ['digestive'],
  },
  {
    key: 'alp', loinc: '6768-6', nameTr: 'ALP (alkalen fosfataz)', group: 'liver',
    aliases: ['ALP', 'Alkalen fosfataz', 'Alkalin fosfataz', 'ALKP', 'Alkali fosfataz'],
    unit: 'U/L', conversions: UL, ranges: [{ min: 40, max: 129 }],
    plausible: [5, 5000], decimals: 0, processes: ['bile-metabolism', 'bone-mineral'], structures: ['liver', 'gallbladder', 'bones'], systems: ['digestive', 'musculoskeletal'],
  },
  {
    key: 'bilirubin-total', loinc: '1975-2', nameTr: 'Total bilirubin', group: 'liver',
    aliases: ['Total bilirubin', 'Bilirubin total', 'Bilirubin (total)', 'T bilirubin', 'TBIL', 'T BIL', 'Bilirubin'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'umol/l': [1 / 17.1] }, ranges: [{ min: 0.2, max: 1.2 }],
    plausible: [0, 50], decimals: 2, processes: ['bile-metabolism'], structures: ['liver', 'gallbladder', 'spleen'], systems: ['digestive'],
  },
  {
    key: 'bilirubin-direct', loinc: '1968-7', nameTr: 'Direkt bilirubin', group: 'liver',
    aliases: ['Direkt bilirubin', 'Bilirubin direkt', 'Bilirubin (direkt)', 'D bilirubin', 'DBIL', 'D BIL', 'Konjuge bilirubin'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'umol/l': [1 / 17.1] }, ranges: [{ max: 0.3 }],
    plausible: [0, 40], decimals: 2, processes: ['bile-metabolism'], structures: ['liver', 'gallbladder'], systems: ['digestive'],
  },
  {
    key: 'bilirubin-indirect', loinc: '1971-1', nameTr: 'İndirekt bilirubin', group: 'liver',
    aliases: ['Indirekt bilirubin', 'Bilirubin indirekt', 'Bilirubin (indirekt)', 'I bilirubin', 'IBIL'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'umol/l': [1 / 17.1] }, ranges: [{ min: 0.1, max: 1.0 }],
    plausible: [0, 40], decimals: 2, processes: ['bile-metabolism'], structures: ['spleen', 'liver'], systems: ['digestive', 'hematologic'],
  },
  {
    key: 'albumin', loinc: '1751-7', nameTr: 'Albümin', group: 'liver',
    aliases: ['Albumin', 'ALB', 'Albumin (serum)'],
    unit: 'g/dL', conversions: G_DL, ranges: [{ min: 3.5, max: 5.2 }],
    plausible: [0.5, 8], decimals: 1, processes: ['protein-synthesis'], structures: ['liver', 'kidneys'], systems: ['digestive', 'urinary'],
  },
  {
    key: 'total-protein', loinc: '2885-2', nameTr: 'Total protein', group: 'liver',
    aliases: ['Total protein', 'Protein total', 'Protein (total)', 'TP'],
    unit: 'g/dL', conversions: G_DL, ranges: [{ min: 6.4, max: 8.3 }],
    plausible: [1, 15], decimals: 1, processes: ['protein-synthesis', 'immune-response'], structures: ['liver'], systems: ['digestive', 'immune'],
  },
  {
    key: 'ldh', loinc: '2532-0', nameTr: 'LDH', group: 'liver',
    aliases: ['LDH', 'Laktat dehidrogenaz', 'Laktik dehidrogenaz', 'LD'],
    unit: 'U/L', conversions: UL, ranges: [{ min: 135, max: 225 }],
    plausible: [20, 10000], decimals: 0, processes: ['hepatocyte-injury', 'muscle-injury', 'erythropoiesis'], structures: ['liver', 'heart', 'spleen'], systems: ['digestive', 'hematologic'],
  },

  // ---------------------------------------------------------------- Lipid
  {
    key: 'cholesterol-total', loinc: '2093-3', nameTr: 'Total kolesterol', group: 'lipid',
    aliases: ['Total kolesterol', 'Kolesterol total', 'Kolesterol (total)', 'T kolesterol', 'CHOL', 'Kolesterol'],
    unit: 'mg/dL', conversions: CHOL, ranges: [{ max: 200 }],
    plausible: [30, 1000], decimals: 0, processes: ['lipid-transport', 'atherosclerosis'],
    structures: ['coronary-arteries', 'aorta', 'carotid-arteries', 'liver'], systems: ['cardiovascular', 'digestive'], simulation: 'ldl-atherosclerosis',
  },
  {
    key: 'ldl', loinc: '13457-7', nameTr: 'LDL kolesterol', group: 'lipid',
    aliases: ['LDL kolesterol', 'LDL', 'LDL-C', 'LDL kolesterol hesaplanan', 'LDL direkt', 'Direkt LDL', 'LDL kolesterol direkt', 'LDL (hesaplanan)'],
    unit: 'mg/dL', conversions: CHOL, ranges: [{ max: 130 }],
    plausible: [5, 700], decimals: 0, processes: ['lipid-transport', 'atherosclerosis'],
    structures: ['coronary-arteries', 'aorta', 'carotid-arteries', 'liver'], systems: ['cardiovascular', 'digestive'], simulation: 'ldl-atherosclerosis',
  },
  {
    key: 'hdl', loinc: '2085-9', nameTr: 'HDL kolesterol', group: 'lipid',
    aliases: ['HDL kolesterol', 'HDL', 'HDL-C', 'HDL (iyi kolesterol)'],
    unit: 'mg/dL', conversions: CHOL, ranges: [{ sex: 'female', min: 50 }, { sex: 'male', min: 40 }, { min: 40 }],
    plausible: [5, 200], decimals: 0, processes: ['lipid-transport', 'atherosclerosis'],
    structures: ['liver', 'coronary-arteries', 'aorta'], systems: ['cardiovascular', 'digestive'],
  },
  {
    key: 'triglyceride', loinc: '2571-8', nameTr: 'Trigliserit', group: 'lipid',
    aliases: ['Trigliserid', 'Trigliserit', 'Trigliseridler', 'TG', 'TRIG', 'TRIGL'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'mmol/l': [88.57] }, ranges: [{ max: 150 }],
    plausible: [10, 10000], decimals: 0, processes: ['lipid-transport'],
    structures: ['liver', 'pancreas', 'aorta'], systems: ['cardiovascular', 'digestive'],
  },
  {
    key: 'non-hdl', loinc: '43396-1', nameTr: 'HDL dışı kolesterol', group: 'lipid',
    aliases: ['Non-HDL kolesterol', 'Non HDL kolesterol', 'Non HDL', 'HDL disi kolesterol', 'Non-HDL'],
    unit: 'mg/dL', conversions: CHOL, ranges: [{ max: 130 }],
    plausible: [10, 900], decimals: 0, processes: ['lipid-transport', 'atherosclerosis'],
    structures: ['coronary-arteries', 'aorta', 'carotid-arteries'], systems: ['cardiovascular'], simulation: 'ldl-atherosclerosis',
  },
  {
    key: 'vldl', loinc: '13458-5', nameTr: 'VLDL kolesterol', group: 'lipid',
    aliases: ['VLDL kolesterol', 'VLDL', 'VLDL-C'],
    unit: 'mg/dL', conversions: CHOL, ranges: [{ max: 30 }],
    plausible: [1, 500], decimals: 0, processes: ['lipid-transport'], structures: ['liver', 'aorta'], systems: ['cardiovascular', 'digestive'],
  },

  // ---------------------------------------------------------------- Elektrolit / mineral
  {
    key: 'sodium', loinc: '2951-2', nameTr: 'Sodyum', group: 'electrolyte',
    aliases: ['Sodyum', 'Na', 'Na+', 'Sodyum (Na)'],
    unit: 'mmol/L', conversions: { 'mmol/l': [1] }, ranges: [{ min: 136, max: 145 }],
    plausible: [100, 190], decimals: 0, processes: ['electrolyte-balance'], structures: ['kidneys', 'brain', 'adrenals'], systems: ['urinary', 'nervous'],
  },
  {
    key: 'potassium', loinc: '2823-3', nameTr: 'Potasyum', group: 'electrolyte',
    aliases: ['Potasyum', 'K', 'K+', 'Potasyum (K)'],
    unit: 'mmol/L', conversions: { 'mmol/l': [1] }, ranges: [{ min: 3.5, max: 5.1 }],
    plausible: [1, 10], decimals: 1, processes: ['electrolyte-balance'], structures: ['kidneys', 'heart', 'adrenals'], systems: ['urinary', 'cardiovascular'],
  },
  {
    key: 'chloride', loinc: '2075-0', nameTr: 'Klor', group: 'electrolyte',
    aliases: ['Klor', 'Klorur', 'Cl', 'Cl-', 'Klor (Cl)'],
    unit: 'mmol/L', conversions: { 'mmol/l': [1] }, ranges: [{ min: 98, max: 107 }],
    plausible: [60, 150], decimals: 0, processes: ['electrolyte-balance'], structures: ['kidneys'], systems: ['urinary'],
  },
  {
    key: 'calcium', loinc: '17861-6', nameTr: 'Kalsiyum', group: 'electrolyte',
    aliases: ['Kalsiyum', 'Ca', 'Kalsiyum (Ca)', 'Total kalsiyum'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'mmol/l': [4.008] }, ranges: [{ min: 8.6, max: 10.2 }],
    plausible: [3, 20], decimals: 1, processes: ['bone-mineral'], structures: ['bones', 'kidneys', 'small-intestine', 'thyroid'], systems: ['musculoskeletal', 'urinary'],
  },
  {
    key: 'magnesium', loinc: '19123-9', nameTr: 'Magnezyum', group: 'electrolyte',
    aliases: ['Magnezyum', 'Mg', 'Magnezyum (Mg)'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'mmol/l': [2.431] }, ranges: [{ min: 1.6, max: 2.6 }],
    plausible: [0.3, 8], decimals: 2, processes: ['bone-mineral', 'electrolyte-balance'], structures: ['bones', 'kidneys', 'heart'], systems: ['musculoskeletal', 'urinary'],
  },
  {
    key: 'phosphorus', loinc: '2777-1', nameTr: 'Fosfor', group: 'electrolyte',
    aliases: ['Fosfor', 'Inorganik fosfor', 'Fosfat', 'P', 'Fosfor (P)'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'mmol/l': [3.097] }, ranges: [{ min: 2.5, max: 4.5 }],
    plausible: [0.3, 20], decimals: 1, processes: ['bone-mineral'], structures: ['bones', 'kidneys'], systems: ['musculoskeletal', 'urinary'],
  },

  // ---------------------------------------------------------------- Böbrek
  {
    key: 'creatinine', loinc: '2160-0', nameTr: 'Kreatinin', group: 'kidney',
    aliases: ['Kreatinin', 'CREA', 'Kreatinin (serum)', 'Creatinine', 'Kreatinin serum'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'umol/l': [1 / 88.42] },
    ranges: [{ sex: 'female', min: 0.51, max: 0.95 }, { sex: 'male', min: 0.67, max: 1.17 }],
    plausible: [0.1, 25], decimals: 2, processes: ['glomerular-filtration'], structures: ['kidneys', 'renal-vessels'], systems: ['urinary'],
  },
  {
    key: 'egfr', loinc: '62238-1', nameTr: 'eGFR (tahmini süzme hızı)', group: 'kidney',
    aliases: ['eGFR', 'GFR', 'Tahmini GFR', 'eGFR (CKD-EPI)', 'eGFR CKD EPI', 'Glomeruler filtrasyon hizi', 'Tahmini glomeruler filtrasyon hizi'],
    unit: 'mL/dk/1,73m²', conversions: { 'ml/min/1.73m2': [1] }, ranges: [{ min: 60 }],
    plausible: [1, 200], decimals: 0, processes: ['glomerular-filtration'], structures: ['kidneys', 'renal-vessels'], systems: ['urinary'],
  },
  {
    key: 'urea', loinc: '3091-6', nameTr: 'Üre', group: 'kidney',
    aliases: ['Ure', 'Urea', 'Ure (serum)'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'mmol/l': [6.006] }, ranges: [{ min: 17, max: 43 }],
    plausible: [2, 500], decimals: 0, processes: ['glomerular-filtration', 'protein-synthesis'], structures: ['kidneys', 'liver'], systems: ['urinary'],
  },
  {
    key: 'bun', loinc: '3094-0', nameTr: 'BUN (kan üre azotu)', group: 'kidney',
    aliases: ['BUN', 'Kan ure azotu', 'Ure azotu'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'mmol/l': [2.801] }, ranges: [{ min: 6, max: 20 }],
    plausible: [1, 250], decimals: 0, processes: ['glomerular-filtration'], structures: ['kidneys'], systems: ['urinary'],
  },
  {
    key: 'uric-acid', loinc: '3084-1', nameTr: 'Ürik asit', group: 'kidney',
    aliases: ['Urik asit', 'UA', 'Urik asit (serum)', 'Uric acid'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'umol/l': [1 / 59.48] },
    ranges: [{ sex: 'female', min: 2.4, max: 5.7 }, { sex: 'male', min: 3.4, max: 7.0 }],
    plausible: [0.3, 25], decimals: 1, processes: ['uric-acid-metabolism'], structures: ['kidneys'], systems: ['urinary'],
  },

  // ---------------------------------------------------------------- Demir
  {
    key: 'iron', loinc: '2498-4', nameTr: 'Demir', group: 'iron',
    aliases: ['Demir', 'Serum demiri', 'Demir (serum)', 'Fe', 'Demir (Fe)', 'Serum demir'],
    unit: 'µg/dL', conversions: { 'ug/dl': [1], 'umol/l': [5.585] },
    ranges: [{ sex: 'female', min: 50, max: 170 }, { sex: 'male', min: 65, max: 175 }],
    plausible: [2, 600], decimals: 0, processes: ['iron-metabolism'], structures: ['small-intestine', 'liver', 'bones', 'spleen'], systems: ['hematologic', 'digestive'],
  },
  {
    key: 'ferritin', loinc: '2276-4', nameTr: 'Ferritin', group: 'iron',
    aliases: ['Ferritin', 'Ferritin (serum)'],
    unit: 'ng/mL', conversions: { 'ng/ml': [1], 'pmol/l': [1 / 2.247] },
    ranges: [{ sex: 'female', min: 13, max: 150 }, { sex: 'male', min: 30, max: 400 }],
    plausible: [0.5, 100000], decimals: 0, processes: ['iron-metabolism', 'inflammation'], structures: ['liver', 'spleen', 'bones'], systems: ['hematologic', 'digestive'],
  },
  {
    key: 'tibc', loinc: '2500-7', nameTr: 'Total demir bağlama kapasitesi', group: 'iron',
    aliases: ['TDBK', 'Total demir baglama kapasitesi', 'TIBC', 'Demir baglama kapasitesi'],
    unit: 'µg/dL', conversions: { 'ug/dl': [1], 'umol/l': [5.585] }, ranges: [{ min: 250, max: 450 }],
    plausible: [50, 1000], decimals: 0, processes: ['iron-metabolism'], structures: ['liver'], systems: ['hematologic'],
  },
  {
    key: 'uibc', loinc: '2501-5', nameTr: 'Serbest demir bağlama kapasitesi', group: 'iron',
    aliases: ['UIBC', 'SDBK', 'Serbest demir baglama kapasitesi', 'Doymamis demir baglama kapasitesi'],
    unit: 'µg/dL', conversions: { 'ug/dl': [1], 'umol/l': [5.585] }, ranges: [{ min: 155, max: 355 }],
    plausible: [10, 900], decimals: 0, processes: ['iron-metabolism'], structures: ['liver'], systems: ['hematologic'],
  },
  {
    key: 'transferrin-saturation', loinc: '2502-3', nameTr: 'Transferrin satürasyonu', group: 'iron',
    aliases: ['Transferrin saturasyonu', 'TSAT', 'Demir saturasyonu', 'Transferrin doygunlugu'],
    unit: '%', conversions: PCT, ranges: [{ min: 20, max: 50 }],
    plausible: [0, 100], decimals: 0, processes: ['iron-metabolism'], structures: ['liver', 'bones'], systems: ['hematologic'],
  },

  // ---------------------------------------------------------------- Şeker
  {
    key: 'glucose', loinc: '1558-6', nameTr: 'Açlık kan şekeri (glukoz)', group: 'glucose',
    aliases: ['Glukoz', 'Aclik kan sekeri', 'Aclik glukozu', 'Glukoz (aclik)', 'AKS', 'GLU', 'Kan sekeri', 'Glukoz aclik', 'Aclik plazma glukozu'],
    unit: 'mg/dL', conversions: { 'mg/dl': [1], 'mmol/l': [18.016] }, ranges: [{ min: 70, max: 100 }],
    plausible: [10, 1500], decimals: 0, processes: ['glucose-regulation'], structures: ['pancreas', 'liver'], systems: ['endocrine', 'digestive'],
  },
  {
    key: 'hba1c', loinc: '4548-4', nameTr: 'HbA1c', group: 'glucose',
    aliases: ['HbA1c', 'Hemoglobin A1c', 'Glikozile hemoglobin', 'A1c', 'Glikolize hemoglobin', 'HbA1c (NGSP)'],
    unit: '%', conversions: { '%': [1], 'mmol/mol': [0.09148, 2.152] }, ranges: [{ max: 5.7 }],
    plausible: [2.5, 20], decimals: 1, processes: ['glucose-regulation'], structures: ['pancreas', 'aorta', 'eye-vessels', 'kidneys'], systems: ['endocrine', 'cardiovascular'],
  },
  {
    key: 'insulin', loinc: '20448-7', nameTr: 'İnsülin', group: 'glucose',
    aliases: ['Insulin', 'Aclik insulini', 'Insulin (aclik)'],
    unit: 'µIU/mL', conversions: { 'miu/l': [1], 'pmol/l': [1 / 6] }, ranges: [{ min: 2.6, max: 24.9 }],
    plausible: [0.2, 1000], decimals: 1, processes: ['glucose-regulation'], structures: ['pancreas'], systems: ['endocrine'],
  },

  // ---------------------------------------------------------------- Tiroid
  {
    key: 'tsh', loinc: '3016-3', nameTr: 'TSH', group: 'thyroid',
    aliases: ['TSH', 'Tiroid stimulan hormon', 'Tirotropin', 'TSH (3. kusak)'],
    unit: 'mIU/L', conversions: { 'miu/l': [1] }, ranges: [{ min: 0.27, max: 4.2 }],
    plausible: [0.001, 200], decimals: 2, processes: ['thyroid-axis'], structures: ['hypothalamus', 'pituitary', 'thyroid'], systems: ['endocrine'],
  },
  {
    key: 'ft4', loinc: '3024-7', nameTr: 'Serbest T4', group: 'thyroid',
    aliases: ['Serbest T4', 'sT4', 'FT4', 'Free T4', 'Serbest tiroksin'],
    unit: 'ng/dL', conversions: { 'ng/dl': [1], 'pmol/l': [1 / 12.87] }, ranges: [{ min: 0.93, max: 1.7 }],
    plausible: [0.05, 10], decimals: 2, processes: ['thyroid-axis'], structures: ['thyroid', 'pituitary'], systems: ['endocrine'],
  },
  {
    key: 'ft3', loinc: '3051-0', nameTr: 'Serbest T3', group: 'thyroid',
    aliases: ['Serbest T3', 'sT3', 'FT3', 'Free T3', 'Serbest triiyodotironin'],
    unit: 'pg/mL', conversions: { 'pg/ml': [1], 'pmol/l': [1 / 1.536] }, ranges: [{ min: 2.0, max: 4.4 }],
    plausible: [0.2, 40], decimals: 2, processes: ['thyroid-axis'], structures: ['thyroid'], systems: ['endocrine'],
  },
  {
    key: 'anti-tpo', loinc: '8099-4', nameTr: 'Anti-TPO', group: 'thyroid',
    aliases: ['Anti TPO', 'Anti-TPO', 'Tiroid peroksidaz antikoru', 'TPO Ab', 'Anti tiroid peroksidaz'],
    unit: 'IU/mL', conversions: { 'iu/ml': [1] }, ranges: [{ max: 34 }],
    plausible: [0, 10000], decimals: 1, processes: ['thyroid-axis', 'immune-response'], structures: ['thyroid'], systems: ['endocrine', 'immune'],
  },

  // ---------------------------------------------------------------- Vitaminler
  {
    key: 'b12', loinc: '2132-9', nameTr: 'Vitamin B12', group: 'vitamin',
    aliases: ['Vitamin B12', 'B12 vitamini', 'Kobalamin', 'B12', 'Vit B12'],
    unit: 'pg/mL', conversions: { 'pg/ml': [1], 'pmol/l': [1.355] }, ranges: [{ min: 197, max: 771 }],
    plausible: [20, 5000], decimals: 0, processes: ['b12-folate'], structures: ['bones', 'small-intestine', 'spinal-cord', 'brain'], systems: ['hematologic', 'nervous', 'digestive'],
  },
  {
    key: 'folate', loinc: '2284-8', nameTr: 'Folat', group: 'vitamin',
    aliases: ['Folat', 'Folik asit', 'Folate', 'Folat (serum)'],
    unit: 'ng/mL', conversions: { 'ng/ml': [1], 'nmol/l': [1 / 2.266] }, ranges: [{ min: 3.9 }],
    plausible: [0.3, 60], decimals: 1, processes: ['b12-folate'], structures: ['bones', 'small-intestine'], systems: ['hematologic', 'digestive'],
  },
  {
    key: 'vitamin-d', loinc: '1989-3', nameTr: '25-OH D vitamini', group: 'vitamin',
    aliases: ['25 OH vitamin D', 'Vitamin D', 'D vitamini', '25 OH D vitamini', '25 hidroksi vitamin D', 'Vitamin D3', 'Vitamin D (25 OH)', '25 OH D', 'Vitamin D total'],
    unit: 'ng/mL', conversions: { 'ng/ml': [1], 'nmol/l': [1 / 2.496] }, ranges: [{ min: 30, max: 100 }],
    plausible: [1, 250], decimals: 1, processes: ['bone-mineral'], structures: ['skin', 'liver', 'kidneys', 'bones'], systems: ['musculoskeletal', 'integumentary'],
  },

  // ---------------------------------------------------------------- İnflamasyon
  {
    key: 'crp', loinc: '1988-5', nameTr: 'CRP', group: 'inflammation',
    aliases: ['CRP', 'C reaktif protein', 'C-reaktif protein'],
    unit: 'mg/L', conversions: { 'mg/l': [1], 'mg/dl': [10] }, ranges: [{ max: 5 }],
    plausible: [0, 600], decimals: 1, processes: ['inflammation'], structures: ['liver', 'aorta', 'abdominal-vessels'], systems: ['immune', 'digestive'],
  },
  {
    key: 'hs-crp', loinc: '30522-7', nameTr: 'hs-CRP', group: 'inflammation',
    aliases: ['hs CRP', 'hsCRP', 'Yuksek duyarlikli CRP', 'hs-CRP'],
    unit: 'mg/L', conversions: { 'mg/l': [1], 'mg/dl': [10] }, ranges: [{ max: 3 }],
    plausible: [0, 300], decimals: 2, processes: ['inflammation', 'atherosclerosis'], structures: ['liver', 'coronary-arteries', 'aorta'], systems: ['immune', 'cardiovascular'],
  },
  {
    key: 'esr', loinc: '4537-7', nameTr: 'Sedimantasyon', group: 'inflammation',
    aliases: ['Sedimantasyon', 'Eritrosit sedimantasyon hizi', 'ESH', 'ESR', 'Sedim', 'Sedimentasyon'],
    unit: 'mm/sa', conversions: { 'mm/h': [1] }, ranges: [{ sex: 'female', max: 20 }, { sex: 'male', max: 15 }, { max: 20 }],
    plausible: [0, 150], decimals: 0, processes: ['inflammation'], structures: ['aorta', 'veins'], systems: ['immune', 'hematologic'],
  },

  // ---------------------------------------------------------------- Pankreas
  {
    key: 'amylase', loinc: '1798-8', nameTr: 'Amilaz', group: 'pancreas',
    aliases: ['Amilaz', 'Amylase', 'Amilaz (serum)'],
    unit: 'U/L', conversions: UL, ranges: [{ min: 28, max: 100 }],
    plausible: [1, 10000], decimals: 0, processes: ['pancreatic-enzymes'], structures: ['pancreas'], systems: ['digestive'],
  },
  {
    key: 'lipase', loinc: '3040-3', nameTr: 'Lipaz', group: 'pancreas',
    aliases: ['Lipaz', 'Lipase'],
    unit: 'U/L', conversions: UL, ranges: [{ min: 13, max: 60 }],
    plausible: [1, 20000], decimals: 0, processes: ['pancreatic-enzymes'], structures: ['pancreas'], systems: ['digestive'],
  },

  // ---------------------------------------------------------------- Hormon / diğer
  {
    key: 'ck', loinc: '2157-6', nameTr: 'CK (kreatin kinaz)', group: 'other',
    aliases: ['CK', 'Kreatin kinaz', 'CPK', 'Kreatin fosfokinaz', 'CK total'],
    unit: 'U/L', conversions: UL, ranges: [{ sex: 'female', min: 26, max: 192 }, { sex: 'male', min: 39, max: 308 }],
    plausible: [5, 200000], decimals: 0, processes: ['muscle-injury'], structures: ['skeletal-muscle', 'heart'], systems: ['musculoskeletal', 'cardiovascular'],
  },
  {
    key: 'cortisol', loinc: '2143-6', nameTr: 'Kortizol', group: 'hormone',
    aliases: ['Kortizol', 'Cortisol', 'Kortizol (sabah)', 'Sabah kortizolu'],
    unit: 'µg/dL', conversions: { 'ug/dl': [1], 'nmol/l': [1 / 27.59] }, ranges: [{ min: 6.2, max: 19.4 }],
    plausible: [0.1, 100], decimals: 1, processes: ['stress-hormones'], structures: ['adrenals', 'pituitary'], systems: ['endocrine'],
  },
  {
    key: 'prolactin', loinc: '2842-3', nameTr: 'Prolaktin', group: 'hormone',
    aliases: ['Prolaktin', 'PRL'],
    unit: 'ng/mL', conversions: { 'ng/ml': [1], 'miu/l': [1 / 21.2] },
    ranges: [{ sex: 'female', min: 4.8, max: 23.3 }, { sex: 'male', min: 4.0, max: 15.2 }],
    plausible: [0.1, 5000], decimals: 1, processes: ['pituitary-hormones'], structures: ['pituitary'], systems: ['endocrine'],
  },
  {
    key: 'psa', loinc: '2857-1', nameTr: 'PSA', group: 'other',
    aliases: ['PSA', 'Total PSA', 'Prostat spesifik antijen', 'PSA total'],
    unit: 'ng/mL', conversions: { 'ng/ml': [1] }, ranges: [{ max: 4 }],
    plausible: [0, 5000], decimals: 2, processes: ['prostate'], structures: ['prostate'], systems: ['urinary'],
  },
  {
    key: 'inr', loinc: '6301-6', nameTr: 'INR', group: 'coagulation',
    aliases: ['INR', 'PT INR', 'Protrombin zamani INR', 'PT (INR)'],
    unit: '', conversions: { ratio: [1] }, ranges: [{ min: 0.8, max: 1.2 }],
    plausible: [0.5, 15], decimals: 2, processes: ['hemostasis', 'protein-synthesis'], structures: ['liver', 'aorta'], systems: ['hematologic', 'digestive'],
  },
  {
    key: 'aptt', loinc: '3173-2', nameTr: 'aPTT', group: 'coagulation',
    aliases: ['aPTT', 'APTT', 'Aktive parsiyel tromboplastin zamani', 'PTT'],
    unit: 'sn', conversions: { s: [1] }, ranges: [{ min: 25, max: 37 }],
    plausible: [10, 200], decimals: 1, processes: ['hemostasis'], structures: ['liver', 'aorta'], systems: ['hematologic'],
  },
  {
    key: 'homocysteine', loinc: '13965-9', nameTr: 'Homosistein', group: 'other',
    aliases: ['Homosistein', 'Homocysteine'],
    unit: 'µmol/L', conversions: { 'umol/l': [1] }, ranges: [{ min: 5, max: 15 }],
    plausible: [1, 300], decimals: 1, processes: ['atherosclerosis', 'b12-folate'], structures: ['coronary-arteries', 'aorta', 'carotid-arteries'], systems: ['cardiovascular'],
  },
];

export const testByKey = new Map(TESTS.map((t) => [t.key, t]));
export const testByLoinc = new Map(TESTS.map((t) => [t.loinc, t]));
