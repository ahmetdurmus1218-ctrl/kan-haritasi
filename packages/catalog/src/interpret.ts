/**
 * Kural tabanlı sonuç yorumu (yapay zekâ değildir).
 *
 * Her sonuç için:
 *  - raporun kendi referans aralığına göre durum ve SAPMA DERECESİ (hafif / orta / belirgin),
 *  - bazı testlerde yaygın kabul görmüş kılavuz kategorileri (ör. LDL, açlık glukozu, HbA1c, eGFR, D vitamini),
 *  - acil değerlendirme gerektirebilecek kritik düzeyler.
 * Ardından birlikte anlam taşıyan sonuçlar (paternler) ve sistem özetleri üretilir.
 *
 * İlkeler: teşhis koymaz ("… ile uyumlu olabilir"), ilaç önermez, tek ölçümün sınırlarını söyler.
 * Eşikler hasta bilgilendirme amaçlı yaygın kaynaklara dayanır (WHO anemi sınıflaması, NCEP ATP III
 * lipid kategorileri, ADA glukoz/HbA1c eşikleri, KDIGO eGFR evreleri, Endocrine Society D vitamini
 * sınırları, laboratuvar kritik değer listeleri). Yayından önce bir hekimin gözden geçirmesi önerilir.
 */
import { type ResultStatus, type Sex, formatNumber, rangeText } from './evaluate';
import { type LabTestDef, testByKey } from './tests';
import { type SystemId, systemById } from './anatomy';
import { CONTENT } from './content';

export type Severity = 'normal' | 'borderline' | 'mild' | 'moderate' | 'marked' | 'unknown';

export const SEVERITY_LABEL: Record<Severity, string> = {
  normal: 'Aralıkta',
  borderline: 'Sınırda',
  mild: 'Hafif',
  moderate: 'Orta',
  marked: 'Belirgin',
  unknown: 'Değerlendirilemedi',
};

export const SEVERITY_WEIGHT: Record<Severity, number> = { unknown: 0, normal: 0, borderline: 0.5, mild: 1, moderate: 2, marked: 3 };

/** Yorum motorunun girdisi: bir testin (en son) sonucu. */
export interface LabInput {
  testKey: string;
  /** Kanonik birimde değer (varsa); yoksa rapordaki değer. */
  value: number;
  /** `value` kataloğun kanonik biriminde mi? (kılavuz kategorileri yalnızca bu durumda uygulanır) */
  canonical: boolean;
  unit: string;
  refMin?: number;
  refMax?: number;
  refText?: string;
  status: ResultStatus;
  qualifier?: '<' | '>' | '<=' | '>=';
  date?: string;
}

export interface Finding {
  testKey: string;
  name: string;
  value: number;
  /** `value` kanonik birimde mi (eşik karşılaştırmaları yalnızca bu durumda yapılır). */
  canonical: boolean;
  unit: string;
  status: ResultStatus;
  severity: Severity;
  /** Referans sınırına göre sapma: yüksekte (değer−üst)/üst, düşükte (alt−değer)/alt. */
  deviation: number | null;
  /** Üst sınırın katı (enzimler için anlamlı). */
  uln: number | null;
  /** Kılavuz kategorisi (varsa), ör. "Sınırda yüksek (130–159)". */
  category?: string;
  /** Acil değerlendirme gerektirebilecek düzey. */
  critical: boolean;
  /** Tek cümlelik özet. */
  headline: string;
  /** Açıklama (neden önemli, neyle ilişkili). */
  detail: string;
  systems: SystemId[];
  structures: string[];
  date?: string;
}

export type PatternLevel = 'info' | 'attention' | 'urgent';

export interface Pattern {
  id: string;
  title: string;
  level: PatternLevel;
  text: string;
  tests: string[];
  systems: SystemId[];
  structures: string[];
  /** İçeri-gir sahnesi (varsa). */
  scene?: 'damar' | 'alveol' | 'nefron' | 'lobul' | 'adacik' | 'folikul' | 'ilik';
  /** Hekime sorulabilecek. */
  ask?: string[];
}

export interface SystemSummary {
  system: SystemId;
  name: string;
  status: 'ok' | 'attention' | 'urgent' | 'none';
  findings: Finding[];
  patterns: Pattern[];
  text: string;
}

export interface StructureState {
  structure: string;
  /** 0 (normal) … 3 (belirgin) */
  score: number;
  direction: 'high' | 'low' | 'mixed' | null;
  findings: Finding[];
}

export interface Interpretation {
  findings: Finding[];
  patterns: Pattern[];
  systems: SystemSummary[];
  structures: Map<string, StructureState>;
  critical: Finding[];
  overall: { total: number; abnormal: number; bySeverity: Record<Severity, number>; text: string };
}

// ------------------------------------------------------------------------------------------------
// Yardımcılar

const f = (v: number, d = 1) => formatNumber(v, d);
const pct = (r: number) => `%${Math.round(r * 100)}`;

/** Üst sınırın katıyla derecelendirilen testler (enzimler ve inflamasyon belirteçleri). */
const ULN_TESTS = new Set(['alt', 'ast', 'ggt', 'alp', 'ck', 'amylase', 'lipase', 'ldh', 'crp']);

interface Grade {
  severity: Severity;
  category?: string;
  critical?: boolean;
  note?: string;
}

type Grader = (v: number, sex: Sex) => Grade | null;

function band(v: number, bands: Array<[number, Severity, string?]>): { severity: Severity; category?: string } {
  // bands: [üst sınır (hariç), derece, etiket] artan sırada; son eleman Infinity
  for (const [lim, sev, label] of bands) if (v < lim) return { severity: sev, category: label };
  const last = bands[bands.length - 1]!;
  return { severity: last[1], category: last[2] };
}

/** Kılavuz kategorileri ve kritik düzeyler (yalnızca kanonik birimde). */
const GRADERS: Record<string, Grader> = {
  glucose: (v) => {
    if (v < 54) return { severity: 'marked', category: 'Belirgin düşük (<54)', critical: true };
    if (v < 70) return { severity: 'mild', category: 'Düşük (54–69)' };
    if (v < 100) return { severity: 'normal', category: 'Normal açlık değeri (70–99)' };
    if (v < 126) return { severity: 'mild', category: 'Bozulmuş açlık glukozu aralığı (100–125)', note: 'Açlıkta ölçüldüyse bu aralık "prediyabet" olarak adlandırılır; tek ölçüm tanı koydurmaz.' };
    if (v < 200) return { severity: 'moderate', category: 'Diyabet eşiğinin üzerinde (≥126)', note: 'Açlık değeriyse diyabet için tanı eşiğinin üzerindedir; tanı için tekrar ölçüm ya da HbA1c gerekir.' };
    return { severity: 'marked', category: 'Çok yüksek (≥200)', critical: v >= 400 };
  },
  hba1c: (v) => {
    if (v < 5.7) return { severity: 'normal', category: 'Normal (<5,7)' };
    if (v < 6.5) return { severity: 'mild', category: 'Prediyabet aralığı (5,7–6,4)' };
    if (v < 9) return { severity: 'moderate', category: 'Diyabet eşiğinin üzerinde (≥6,5)' };
    return { severity: 'marked', category: 'Çok yüksek (≥9)' };
  },
  ldl: (v) => band(v, [
    [100, 'normal', 'İdeal (<100)'],
    [130, 'normal', 'İdeale yakın (100–129)'],
    [160, 'mild', 'Sınırda yüksek (130–159)'],
    [190, 'moderate', 'Yüksek (160–189)'],
    [Infinity, 'marked', 'Çok yüksek (≥190)'],
  ]),
  'cholesterol-total': (v) => band(v, [
    [200, 'normal', 'İstenen düzey (<200)'],
    [240, 'mild', 'Sınırda yüksek (200–239)'],
    [Infinity, 'moderate', 'Yüksek (≥240)'],
  ]),
  triglyceride: (v) => band(v, [
    [150, 'normal', 'Normal (<150)'],
    [200, 'mild', 'Sınırda yüksek (150–199)'],
    [500, 'moderate', 'Yüksek (200–499)'],
    [Infinity, 'marked', 'Çok yüksek (≥500)'],
  ]),
  'non-hdl': (v) => band(v, [
    [130, 'normal', 'İstenen düzey (<130)'],
    [160, 'mild', 'Sınırda yüksek (130–159)'],
    [190, 'moderate', 'Yüksek (160–189)'],
    [Infinity, 'marked', 'Çok yüksek (≥190)'],
  ]),
  hdl: (v, sex) => {
    const low = sex === 'female' ? 50 : 40;
    if (v < low - 10) return { severity: 'moderate', category: `Düşük (<${low - 10})` };
    if (v < low) return { severity: 'mild', category: `Düşük (<${low})` };
    if (v >= 60) return { severity: 'normal', category: 'Yüksek HDL (≥60), olumlu kabul edilir' };
    return { severity: 'normal', category: `İstenen düzey (≥${low})` };
  },
  egfr: (v) => {
    if (v >= 90) return { severity: 'normal', category: 'G1: normal veya yüksek (≥90)' };
    if (v >= 60) return { severity: 'borderline', category: 'G2: hafif azalmış (60–89)', note: 'Bu aralık tek başına böbrek hastalığı anlamına gelmez; yaşla da azalır.' };
    if (v >= 45) return { severity: 'mild', category: 'G3a: hafif-orta azalmış (45–59)' };
    if (v >= 30) return { severity: 'moderate', category: 'G3b: orta-ağır azalmış (30–44)' };
    if (v >= 15) return { severity: 'marked', category: 'G4: ağır azalmış (15–29)' };
    return { severity: 'marked', category: 'G5: böbrek yetmezliği aralığı (<15)', critical: true };
  },
  'vitamin-d': (v) => {
    if (v < 12) return { severity: 'marked', category: 'Ciddi eksiklik (<12)' };
    if (v < 20) return { severity: 'moderate', category: 'Eksiklik (12–19)' };
    if (v < 30) return { severity: 'mild', category: 'Yetersizlik (20–29)' };
    if (v <= 100) return { severity: 'normal', category: 'Yeterli (30–100)' };
    if (v <= 150) return { severity: 'mild', category: 'Yüksek (100–150)' };
    return { severity: 'marked', category: 'Çok yüksek (>150), zehirlenme riski' };
  },
  hemoglobin: (v, sex) => {
    const lo = sex === 'male' ? 13.5 : 12;
    const hi = sex === 'male' ? 17.5 : 15.5;
    if (v < 7) return { severity: 'marked', category: 'Ağır kansızlık düzeyi (<7)', critical: true };
    if (v < 8) return { severity: 'marked', category: 'Ağır kansızlık düzeyi (<8)' };
    if (v < 11) return { severity: 'moderate', category: 'Orta düzey kansızlık (8–10,9)' };
    if (v < lo) return { severity: 'mild', category: `Hafif kansızlık (11–${f(lo - 0.1)})` };
    if (v > hi + 2) return { severity: 'moderate', category: 'Belirgin yüksek' };
    if (v > hi) return { severity: 'mild', category: 'Yüksek' };
    return null;
  },
  potassium: (v) => {
    if (v < 2.5) return { severity: 'marked', category: 'Çok düşük (<2,5)', critical: true };
    if (v < 3.0) return { severity: 'moderate', category: 'Düşük (2,5–2,9)' };
    if (v < 3.5) return { severity: 'mild', category: 'Hafif düşük (3,0–3,4)' };
    if (v >= 6.0) return { severity: 'marked', category: 'Çok yüksek (≥6,0)', critical: true };
    if (v >= 5.5) return { severity: 'moderate', category: 'Yüksek (5,5–5,9)' };
    if (v > 5.1) return { severity: 'mild', category: 'Hafif yüksek' };
    return null;
  },
  sodium: (v) => {
    if (v < 120) return { severity: 'marked', category: 'Çok düşük (<120)', critical: true };
    if (v < 125) return { severity: 'marked', category: 'Belirgin düşük (<125)' };
    if (v < 130) return { severity: 'moderate', category: 'Düşük (125–129)' };
    if (v < 136) return { severity: 'mild', category: 'Hafif düşük (130–135)' };
    if (v >= 160) return { severity: 'marked', category: 'Çok yüksek (≥160)', critical: true };
    if (v >= 155) return { severity: 'marked', category: 'Belirgin yüksek (≥155)' };
    if (v >= 150) return { severity: 'moderate', category: 'Yüksek (150–154)' };
    if (v > 145) return { severity: 'mild', category: 'Hafif yüksek (146–149)' };
    return null;
  },
  calcium: (v) => {
    if (v < 6.5) return { severity: 'marked', category: 'Çok düşük (<6,5)', critical: true };
    if (v < 7.5) return { severity: 'moderate', category: 'Düşük' };
    if (v >= 13) return { severity: 'marked', category: 'Çok yüksek (≥13)', critical: true };
    if (v >= 12) return { severity: 'moderate', category: 'Yüksek (≥12)' };
    return null;
  },
  platelet: (v) => {
    if (v < 20) return { severity: 'marked', category: 'Çok düşük (<20)', critical: true };
    if (v < 50) return { severity: 'marked', category: 'Belirgin düşük (<50)' };
    if (v < 100) return { severity: 'moderate', category: 'Düşük (50–99)' };
    if (v < 150) return { severity: 'mild', category: 'Hafif düşük (100–149)' };
    if (v > 1000) return { severity: 'marked', category: 'Çok yüksek (>1000)' };
    if (v > 600) return { severity: 'moderate', category: 'Yüksek (600–1000)' };
    if (v > 400) return { severity: 'mild', category: 'Hafif yüksek (401–600)' };
    return null;
  },
  wbc: (v) => {
    if (v < 1) return { severity: 'marked', category: 'Çok düşük (<1)', critical: true };
    if (v < 2) return { severity: 'marked', category: 'Belirgin düşük (<2)' };
    if (v < 3) return { severity: 'moderate', category: 'Düşük (2–2,9)' };
    if (v > 30) return { severity: 'marked', category: 'Çok yüksek (>30)', critical: true };
    if (v > 15) return { severity: 'moderate', category: 'Yüksek (15–30)' };
    return null;
  },
  tsh: (v) => {
    if (v < 0.1) return { severity: 'moderate', category: 'Baskılanmış (<0,1)' };
    if (v > 20) return { severity: 'marked', category: 'Çok yüksek (>20)' };
    if (v > 10) return { severity: 'moderate', category: 'Yüksek (>10)' };
    return null;
  },
  'hs-crp': (v) => {
    if (v > 10) return { severity: 'moderate', category: 'Yüksek (>10): büyük olasılıkla akut inflamasyon', note: 'Kalp-damar riski için yorum, akut bir hastalık yokken tekrarlanan ölçümle yapılır.' };
    if (v > 3) return { severity: 'mild', category: 'Kalp-damar riski açısından yüksek kategori (>3)' };
    if (v >= 1) return { severity: 'normal', category: 'Ortalama risk kategorisi (1–3)' };
    return { severity: 'normal', category: 'Düşük risk kategorisi (<1)' };
  },
  'uric-acid': (v) => {
    if (v > 12) return { severity: 'marked', category: 'Çok yüksek (>12)' };
    if (v > 9) return { severity: 'moderate', category: 'Yüksek (>9)' };
    return null;
  },
  psa: (v) => {
    if (v > 20) return { severity: 'marked', category: 'Belirgin yüksek (>20)' };
    if (v > 10) return { severity: 'moderate', category: 'Yüksek (>10)' };
    if (v > 4) return { severity: 'mild', category: '"Gri bölge" (4–10)' };
    return null;
  },
  inr: (v) => {
    if (v > 4.5) return { severity: 'marked', category: 'Çok yüksek (>4,5)', critical: true, note: 'Kan sulandırıcı kullananlarda hedef aralık farklıdır (çoğunlukla 2–3).' };
    if (v > 2) return { severity: 'moderate', category: 'Yüksek (>2)', note: 'Kan sulandırıcı (varfarin) kullanıyorsan hedef aralığın 2–3 olabilir.' };
    return null;
  },
  ferritin: (v) => {
    if (v < 15) return { severity: 'moderate', category: 'Demir depoları tükenmiş düzeyde (<15)' };
    if (v < 30) return { severity: 'mild', category: 'Demir depoları azalmış olabilir (<30)' };
    return null;
  },
  bilirubin: () => null,
};

function defaultGrade(test: LabTestDef | undefined, input: LabInput): { severity: Severity; deviation: number | null; uln: number | null } {
  const { value: v, refMin: min, refMax: max, status } = input;
  const uln = max !== undefined && max > 0 ? v / max : null;
  if (status === 'unknown') return { severity: 'unknown', deviation: null, uln };
  if (status === 'normal') {
    // Sınırda: aralığın uç %5'inde
    let severity: Severity = 'normal';
    if (min !== undefined && max !== undefined && max > min) {
      const w = max - min;
      if (v - min < w * 0.05 || max - v < w * 0.05) severity = 'borderline';
    } else if (max !== undefined && max > 0 && v > max * 0.95) severity = 'borderline';
    else if (min !== undefined && min > 0 && v < min * 1.05) severity = 'borderline';
    return { severity, deviation: 0, uln };
  }
  if (status === 'high' && max !== undefined && max > 0) {
    const dev = (v - max) / max;
    if (test && ULN_TESTS.has(test.key)) {
      const m = v / max;
      return { severity: m >= 5 ? 'marked' : m >= 2 ? 'moderate' : 'mild', deviation: dev, uln: m };
    }
    return { severity: dev >= 0.4 ? 'marked' : dev >= 0.15 ? 'moderate' : 'mild', deviation: dev, uln };
  }
  if (status === 'low' && min !== undefined && min > 0) {
    const dev = (min - v) / min;
    return { severity: dev >= 0.4 ? 'marked' : dev >= 0.15 ? 'moderate' : 'mild', deviation: dev, uln };
  }
  return { severity: status === 'high' || status === 'low' ? 'mild' : 'unknown', deviation: null, uln };
}

const MAX_SEV = (a: Severity, b: Severity) => (SEVERITY_WEIGHT[a] >= SEVERITY_WEIGHT[b] ? a : b);

function describe(test: LabTestDef, input: LabInput, g: { severity: Severity; deviation: number | null; uln: number | null; category?: string }): { headline: string; detail: string } {
  const name = test.nameTr;
  const val = `${input.qualifier ?? ''}${f(input.value, test.decimals)} ${input.unit}`.trim();
  const ref = input.refText || rangeText(input.refMin, input.refMax, test.decimals);
  const content = CONTENT[test.key];
  let where = '';
  if (input.status === 'high' && g.deviation !== null) {
    where = ULN_TESTS.has(test.key) && g.uln !== null ? `üst sınırın ${f(g.uln, 1)} katı` : `üst sınırın ${pct(g.deviation)} üzerinde`;
  } else if (input.status === 'low' && g.deviation !== null) {
    where = `alt sınırın ${pct(g.deviation)} altında`;
  } else if (input.status === 'normal') {
    where = g.severity === 'borderline' ? 'aralıkta ama sınıra çok yakın' : 'referans aralığında';
  }
  const sev = input.status === 'high' || input.status === 'low' ? ` (${SEVERITY_LABEL[g.severity].toLocaleLowerCase('tr')} ${input.status === 'high' ? 'yükseklik' : 'düşüklük'})` : '';
  const headline = `${name} ${val}${ref ? `, referans ${ref}` : ''}: ${where || 'referans aralığı yok'}${sev}.`;
  const parts: string[] = [];
  if (g.category) parts.push(`Genel kategori: ${g.category}.`);
  if (input.status === 'high' && content?.high) parts.push(content.high);
  else if (input.status === 'low' && content?.low) parts.push(content.low);
  else if (content?.what) parts.push(content.what);
  return { headline, detail: parts.join(' ') };
}

export function gradeResult(input: LabInput, sex: Sex = 'unspecified'): Finding | null {
  const test = testByKey.get(input.testKey);
  if (!test) return null;
  const base = defaultGrade(test, input);
  let severity = base.severity;
  let category: string | undefined;
  let critical = false;
  let note: string | undefined;
  const grader = input.canonical ? GRADERS[test.key] : undefined;
  if (grader) {
    const g = grader(input.value, sex);
    if (g) {
      category = g.category;
      critical = !!g.critical;
      note = g.note;
      // Laboratuvarın kendi aralığı esastır: aralık içindeyken kılavuz derecesi yalnızca "sınırda" olarak yansır.
      if (input.status === 'normal') severity = SEVERITY_WEIGHT[g.severity] >= 1 ? MAX_SEV(severity, 'borderline') : severity;
      else if (input.status === 'high' || input.status === 'low') severity = SEVERITY_WEIGHT[g.severity] > 0 ? g.severity : severity;
      else if (input.status === 'unknown' && g.severity !== 'normal') severity = g.severity;
    }
  }
  const d = describe(test, input, { ...base, severity, category });
  return {
    testKey: test.key,
    name: test.nameTr,
    value: input.value,
    canonical: input.canonical,
    unit: input.unit,
    status: input.status,
    severity,
    deviation: base.deviation,
    uln: base.uln,
    category,
    critical,
    headline: d.headline,
    detail: note ? `${d.detail} ${note}` : d.detail,
    systems: test.systems,
    structures: test.structures,
    date: input.date,
  };
}

// ------------------------------------------------------------------------------------------------
// Paternler

type FMap = Map<string, Finding>;
const is = (m: FMap, key: string, status: ResultStatus) => m.get(key)?.status === status;
const has = (m: FMap, key: string) => m.has(key);
/** Kanonik birimdeki değer; birimi dönüştürülemeyen sonuçlarda eşik karşılaştırması yapılmaz. */
const val = (m: FMap, key: string) => {
  const x = m.get(key);
  return x && x.canonical ? x.value : undefined;
};

function patterns(m: FMap, sex: Sex): Pattern[] {
  const out: Pattern[] = [];
  const push = (p: Pattern) => out.push(p);

  // --- Kan: kansızlık tipi ve demir
  const hbLow = is(m, 'hemoglobin', 'low') || is(m, 'hematocrit', 'low');
  const mcv = val(m, 'mcv');
  const ferritinLow = is(m, 'ferritin', 'low') || (val(m, 'ferritin') ?? 999) < 15;
  const ironLowish = is(m, 'iron', 'low') || is(m, 'transferrin-saturation', 'low');
  if (hbLow) {
    const kind = mcv === undefined ? null : mcv < 80 ? 'micro' : mcv > 100 ? 'macro' : 'normo';
    const kindText =
      kind === 'micro'
        ? 'Alyuvarlar küçük (MCV düşük): bu tip kansızlık en sık demir eksikliğiyle, daha az sıklıkla talasemi taşıyıcılığı ya da kronik hastalıklarla ilişkilidir.'
        : kind === 'macro'
          ? 'Alyuvarlar büyük (MCV yüksek): bu tip kansızlık B12 veya folat eksikliği, alkol, bazı ilaçlar ya da tiroid sorunlarıyla ilişkili olabilir.'
          : kind === 'normo'
            ? 'Alyuvar büyüklüğü normal: kan kaybı, kronik hastalık, böbrek işlevi ya da karışık nedenler düşünülebilir.'
            : 'Alyuvar büyüklüğü (MCV) bilinmediği için tipi değerlendirilemedi.';
    push({
      id: 'anemia',
      title: 'Kansızlık (anemi) bulgusu',
      level: (val(m, 'hemoglobin') ?? 99) < 8 ? 'urgent' : 'attention',
      text: `Hemoglobin/hematokrit referansın altında. ${kindText} Nedeninin hekimle birlikte araştırılması gerekir.`,
      tests: ['hemoglobin', 'hematocrit', 'mcv', 'ferritin', 'b12', 'folate'].filter((k) => has(m, k)),
      systems: ['hematologic'],
      structures: ['bones', 'spleen'],
      scene: 'ilik',
      ask: ['Kansızlığın nedenini anlamak için hangi testler gerekir (demir, B12, folat, retikülosit)?', 'Kan kaybı olasılığı araştırılmalı mı?'],
    });
  }
  if (ferritinLow && (hbLow || (mcv !== undefined && mcv < 80) || ironLowish)) {
    push({
      id: 'iron-deficiency',
      title: 'Demir eksikliği ile uyumlu tablo',
      level: 'attention',
      text: 'Ferritin (demir deposu) düşük ve buna eşlik eden kan/demir bulguları var. Bu birliktelik demir eksikliği ile uyumlu olabilir. Demir eksikliğinin nedeni (beslenme, adet kanaması, sindirim kanalından kayıp, emilim sorunu) ayrıca araştırılmalıdır; demir takviyesine hekimle karar verilmelidir.',
      tests: ['ferritin', 'hemoglobin', 'mcv', 'iron', 'transferrin-saturation'].filter((k) => has(m, k)),
      systems: ['hematologic', 'digestive'],
      structures: ['bones', 'small-intestine', 'liver'],
      scene: 'ilik',
      ask: ['Demir eksikliğinin nedeni araştırılmalı mı?', 'Demir takviyesi gerekir mi, ne kadar süre?'],
    });
  } else if (ferritinLow) {
    push({
      id: 'iron-stores',
      title: 'Demir depoları azalmış olabilir',
      level: 'info',
      text: 'Ferritin düşük ama hemoglobin normal görünüyor: kansızlık henüz gelişmemiş, depolar azalmış olabilir.',
      tests: ['ferritin'],
      systems: ['hematologic'],
      structures: ['liver', 'bones'],
      scene: 'ilik',
    });
  }
  if ((is(m, 'b12', 'low') || is(m, 'folate', 'low')) && !hbLow) {
    push({
      id: 'b12-folate',
      title: 'B12 / folat düşüklüğü',
      level: 'attention',
      text: 'B12 veya folat referansın altında. Bu vitaminler kan hücresi yapımı ve sinir sistemi için gereklidir; uzun süreli eksiklik kansızlık ve his bozukluklarına yol açabilir.',
      tests: ['b12', 'folate', 'mcv', 'homocysteine'].filter((k) => has(m, k)),
      systems: ['hematologic', 'nervous'],
      structures: ['bones', 'spinal-cord', 'small-intestine'],
      scene: 'ilik',
    });
  }

  // --- Karaciğer
  const alt = m.get('alt');
  const ast = m.get('ast');
  const hepatocellular = alt?.status === 'high' || ast?.status === 'high';
  const cholestatic = (is(m, 'alp', 'high') || is(m, 'ggt', 'high')) && !hepatocellular;
  if (hepatocellular) {
    const astAlt = alt && ast ? ast.value / Math.max(1, alt.value) : null;
    const muscle = is(m, 'ck', 'high');
    push({
      id: 'liver-cells',
      title: 'Karaciğer hücre enzimlerinde artış',
      level: (alt?.uln ?? 0) >= 5 || (ast?.uln ?? 0) >= 5 ? 'urgent' : 'attention',
      text: [
        `${[alt?.status === 'high' ? `ALT (üst sınırın ${f(alt.uln ?? 0, 1)} katı)` : '', ast?.status === 'high' ? `AST (üst sınırın ${f(ast.uln ?? 0, 1)} katı)` : ''].filter(Boolean).join(' ve ')} yüksek. Bu enzimler karaciğer hücrelerinin içinde bulunur; yükselmeleri hücrelerin zorlandığını gösterebilir (hepatosellüler patern).`,
        'Yaygın nedenler: yağlanma, alkol, bazı ilaçlar ve takviyeler, viral hepatitler, yoğun egzersiz.',
        astAlt !== null && astAlt > 2 && ast?.status === 'high' ? 'AST, ALT’nin 2 katından fazla: bu oran alkol ilişkili karaciğer hasarında ya da kas kaynaklı artışta görülebilir.' : '',
        muscle ? 'CK da yüksek: enzim artışı kısmen kaslardan (egzersiz, kas hasarı) kaynaklanıyor olabilir.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      tests: ['alt', 'ast', 'ggt', 'alp', 'bilirubin-total', 'ck'].filter((k) => has(m, k)),
      systems: ['digestive'],
      structures: ['liver'],
      scene: 'lobul',
      ask: ['Karaciğer yağlanması için ultrason gerekir mi?', 'Kullandığım ilaç ve takviyeler karaciğeri etkiler mi?', 'Hepatit testleri gerekir mi?'],
    });
  }
  if (cholestatic) {
    push({
      id: 'cholestasis',
      title: 'Safra akışıyla ilişkili enzimlerde artış',
      level: 'attention',
      text: 'ALP ve/veya GGT yüksek, ALT/AST ise normal: bu kolestatik patern safra yollarıyla, bazı ilaçlarla ya da (yalnız ALP yüksekse) kemik kaynaklı durumlarla ilişkili olabilir. GGT alkol kullanımıyla da artabilir.',
      tests: ['alp', 'ggt', 'bilirubin-total', 'bilirubin-direct'].filter((k) => has(m, k)),
      systems: ['digestive'],
      structures: ['liver', 'gallbladder'],
      scene: 'lobul',
    });
  }
  if (is(m, 'bilirubin-total', 'high')) {
    const direct = m.get('bilirubin-direct');
    const directHigh = direct?.status === 'high';
    push({
      id: 'bilirubin',
      title: 'Bilirubin yüksekliği',
      level: (val(m, 'bilirubin-total') ?? 0) > 3 ? 'attention' : 'info',
      text: directHigh
        ? 'Direkt (bağlı) bilirubin yüksek: bilirubinin safrayla atılımında sorun olabilir; karaciğer ve safra yolları değerlendirilmelidir.'
        : 'Toplam bilirubin yüksek, direkt bilirubin normal/bilinmiyor: alyuvar yıkımının artması ya da zararsız bir kalıtsal özellik olan Gilbert sendromu ile ilişkili olabilir.',
      tests: ['bilirubin-total', 'bilirubin-direct', 'bilirubin-indirect'].filter((k) => has(m, k)),
      systems: ['digestive'],
      structures: ['liver', 'gallbladder', 'spleen'],
      scene: 'lobul',
    });
  }

  // --- Böbrek
  const egfr = val(m, 'egfr');
  const creHigh = is(m, 'creatinine', 'high');
  if (creHigh || (egfr !== undefined && egfr < 60)) {
    push({
      id: 'kidney-filtration',
      title: 'Böbrek süzme işlevinde azalma olabilir',
      level: egfr !== undefined && egfr < 30 ? 'urgent' : 'attention',
      text: [
        egfr !== undefined ? `eGFR ${f(egfr, 0)}: ${gradeResult({ testKey: 'egfr', value: egfr, canonical: true, unit: '', status: egfr < 60 ? 'low' : 'normal', refMin: 60 }, sex)?.category ?? ''}.` : 'Kreatinin yüksek.',
        'Tek ölçüm kronik böbrek hastalığı tanısı koydurmaz: su kaybı, yoğun egzersiz, yüksek protein tüketimi, kas kütlesi ve bazı ilaçlar kreatinini etkiler. Tanı için en az 3 ay arayla tekrar ve idrarda albümin ölçümü gerekir.',
      ].join(' '),
      tests: ['creatinine', 'egfr', 'urea', 'bun', 'potassium'].filter((k) => has(m, k)),
      systems: ['urinary'],
      structures: ['kidneys', 'renal-vessels'],
      scene: 'nefron',
      ask: ['Tekrar ölçüm ve idrar albümin testi gerekir mi?', 'Kullandığım ilaçların dozu böbrek işlevime göre ayarlanmalı mı?'],
    });
  }
  const bun = val(m, 'bun');
  const cre = val(m, 'creatinine');
  if (bun !== undefined && cre !== undefined && cre > 0 && bun / cre > 20 && (is(m, 'bun', 'high') || is(m, 'urea', 'high'))) {
    push({
      id: 'bun-ratio',
      title: 'BUN/kreatinin oranı yüksek',
      level: 'info',
      text: `BUN/kreatinin oranı ${f(bun / cre, 0)}: bu oran sıvı kaybı (az su içme, ishal, kusma), yüksek protein tüketimi veya sindirim kanalında kanamayla artabilir.`,
      tests: ['bun', 'creatinine', 'urea'].filter((k) => has(m, k)),
      systems: ['urinary'],
      structures: ['kidneys'],
      scene: 'nefron',
    });
  }

  // --- Glukoz metabolizması
  const glu = val(m, 'glucose');
  const a1c = val(m, 'hba1c');
  if ((glu !== undefined && glu >= 100) || (a1c !== undefined && a1c >= 5.7)) {
    const diabetesRange = (glu !== undefined && glu >= 126) || (a1c !== undefined && a1c >= 6.5);
    push({
      id: 'glucose',
      title: diabetesRange ? 'Kan şekeri diyabet eşiklerinin üzerinde' : 'Kan şekeri prediyabet aralığında',
      level: diabetesRange ? 'attention' : 'info',
      text: [
        glu !== undefined ? `Glukoz ${f(glu, 0)} mg/dL.` : '',
        a1c !== undefined ? `HbA1c %${f(a1c, 1)} (son 2–3 ayın ortalaması).` : '',
        diabetesRange
          ? 'Bu düzeyler diyabet için kullanılan eşiklerin üzerindedir. Tanı, belirti yoksa farklı bir günde tekrarlanan ölçümle konur.'
          : 'Bu aralık ileride diyabet gelişme riskinin arttığını gösterebilir; kilo, beslenme ve hareketle çoğu zaman geri döndürülebilir.',
        glu !== undefined && a1c === undefined ? 'HbA1c ölçümü tabloyu netleştirebilir.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      tests: ['glucose', 'hba1c', 'insulin'].filter((k) => has(m, k)),
      systems: ['endocrine'],
      structures: ['pancreas'],
      scene: 'adacik',
      ask: ['Diyabet açısından tekrar ölçüm veya yükleme testi gerekir mi?', 'Göz ve böbrek taraması gerekir mi?'],
    });
  }

  // --- Tiroid
  const tsh = m.get('tsh');
  const ft4 = m.get('ft4');
  if (tsh && tsh.status !== 'normal' && tsh.status !== 'unknown') {
    let title: string;
    let text: string;
    if (tsh.status === 'high') {
      if (ft4?.status === 'low') {
        title = 'Tiroid bezi az çalışıyor olabilir';
        text = 'TSH yüksek, serbest T4 düşük: bu birliktelik hipotiroidi (tiroidin az çalışması) ile uyumludur.';
      } else {
        title = 'TSH yüksek';
        text = ft4 ? 'TSH yüksek, serbest T4 normal: "subklinik hipotiroidi" olarak adlandırılan bir tablo olabilir; çoğu zaman tekrar ölçümle izlenir.' : 'TSH yüksek: hipofiz tiroidi daha çok uyarıyor. Serbest T4 ölçümü tabloyu netleştirir.';
      }
    } else {
      if (ft4?.status === 'high') {
        title = 'Tiroid bezi fazla çalışıyor olabilir';
        text = 'TSH düşük, serbest T4 yüksek: bu birliktelik hipertiroidi (tiroidin fazla çalışması) ile uyumludur.';
      } else {
        title = 'TSH düşük';
        text = ft4 ? 'TSH düşük, serbest T4 normal: "subklinik hipertiroidi" olabilir ya da tiroid hormonu ilacı dozuyla ilişkili olabilir.' : 'TSH düşük: serbest T4 ve T3 ölçümü tabloyu netleştirir.';
      }
    }
    if (is(m, 'anti-tpo', 'high')) text += ' Anti-TPO yüksek: tiroide karşı gelişen otoimmün süreçle (Hashimoto tiroiditi) ilişkili bir antikordur.';
    push({
      id: 'thyroid',
      title,
      level: 'attention',
      text,
      tests: ['tsh', 'ft4', 'ft3', 'anti-tpo'].filter((k) => has(m, k)),
      systems: ['endocrine'],
      structures: ['thyroid', 'pituitary'],
      scene: 'folikul',
      ask: ['Tiroid ultrasonu gerekir mi?', 'Ne zaman tekrar ölçülmeli?'],
    });
  } else if (is(m, 'anti-tpo', 'high')) {
    push({
      id: 'thyroid-antibody',
      title: 'Tiroid antikoru yüksek',
      level: 'info',
      text: 'Anti-TPO yüksek, tiroid hormonları normal: tiroidin otoimmün iltihabına yatkınlığı gösterebilir; tiroid işlevi zaman içinde izlenir.',
      tests: ['anti-tpo', 'tsh'].filter((k) => has(m, k)),
      systems: ['endocrine', 'immune'],
      structures: ['thyroid'],
      scene: 'folikul',
    });
  }

  // --- Lipidler
  const ldl = m.get('ldl');
  const hdl = m.get('hdl');
  const tg = m.get('triglyceride');
  const ldlHigh = ldl?.status === 'high' || (val(m, 'ldl') ?? 0) >= 160;
  const lipidIssues = [ldlHigh, hdl?.status === 'low', tg?.status === 'high'].filter(Boolean).length;
  if (lipidIssues > 0) {
    push({
      id: 'lipids',
      title: lipidIssues > 1 ? 'Birden fazla lipid değeri istenmeyen yönde' : 'Lipid profilinde sapma',
      level: (val(m, 'ldl') ?? 0) >= 190 || (val(m, 'triglyceride') ?? 0) >= 500 ? 'attention' : lipidIssues > 1 ? 'attention' : 'info',
      text: [
        ldl ? `LDL ${f(ldl.value, 0)} ${ldl.unit}${ldl.category ? ` — ${ldl.category.toLocaleLowerCase('tr')}` : ''}.` : '',
        hdl?.status === 'low' ? `HDL düşük: ${f(hdl.value, 0)} ${hdl.unit}.` : '',
        tg?.status === 'high' ? `Trigliserid ${f(tg.value, 0)} ${tg.unit}${tg.category ? ` — ${tg.category.toLocaleLowerCase('tr')}` : ''}.` : '',
        `${[ldlHigh ? 'yüksek LDL' : '', hdl?.status === 'low' ? 'düşük HDL' : '', tg?.status === 'high' ? 'yüksek trigliserid' : ''].filter(Boolean).join(', ').replace(/^./, (c) => c.toLocaleUpperCase('tr'))}, yıllar içinde damar duvarında plak gelişimi (ateroskleroz) riskini artıran etkenlerdendir. Bu, damarlarında plak olduğu anlamına gelmez; kişisel risk yaş, tansiyon, sigara, diyabet ve aile öyküsüyle birlikte hesaplanır ve hedef LDL buna göre belirlenir.`,
        (val(m, 'triglyceride') ?? 0) >= 500 ? 'Trigliserid 500 mg/dL üzerindeyse pankreas iltihabı riski de artar.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      tests: ['ldl', 'hdl', 'triglyceride', 'cholesterol-total', 'non-hdl'].filter((k) => has(m, k)),
      systems: ['cardiovascular'],
      structures: ['coronary-arteries', 'aorta', 'carotid-arteries', 'liver'],
      scene: 'damar',
      ask: ['10 yıllık kalp-damar riskim nedir, LDL hedefim ne olmalı?', 'Ne zaman tekrar ölçülmeli?'],
    });
  }

  // --- İnflamasyon
  const crpHigh = is(m, 'crp', 'high') || (val(m, 'hs-crp') ?? 0) > 10;
  const wbcHigh = is(m, 'wbc', 'high');
  if (crpHigh || (wbcHigh && is(m, 'esr', 'high'))) {
    push({
      id: 'inflammation',
      title: 'İnflamasyon (iltihap) belirteçleri yüksek',
      level: (val(m, 'crp') ?? 0) > 100 ? 'urgent' : 'attention',
      text: `${crpHigh ? 'CRP yüksek' : 'Sedimantasyon yüksek'}${wbcHigh ? ' ve akyuvar sayısı artmış' : ''}: vücutta aktif bir iltihap veya enfeksiyon olabilir. Belirtilerle (ateş, ağrı, halsizlik) birlikte değerlendirilmelidir.`,
      tests: ['crp', 'hs-crp', 'wbc', 'esr', 'neutrophil-abs'].filter((k) => has(m, k)),
      systems: ['immune'],
      structures: ['bones', 'spleen', 'liver'],
      scene: 'ilik',
    });
  }

  // --- Elektrolit
  const naK = ['sodium', 'potassium', 'calcium'].filter((k) => m.get(k) && m.get(k)!.status !== 'normal' && m.get(k)!.status !== 'unknown');
  if (naK.length) {
    const crit = naK.some((k) => m.get(k)!.critical);
    push({
      id: 'electrolytes',
      title: 'Elektrolit dengesinde sapma',
      level: crit ? 'urgent' : 'attention',
      text: `${naK.map((k) => `${m.get(k)!.name} ${m.get(k)!.status === 'high' ? 'yüksek' : 'düşük'}`).join(', ')}. Elektrolitler kalp ritmi, kas ve sinir işlevi için dar bir aralıkta tutulur; sıvı kaybı, böbrek işlevi, hormonlar ve ilaçlar (ör. idrar söktürücüler) etkiler.${crit ? ' Bu düzey acil değerlendirme gerektirebilir.' : ''}`,
      tests: naK,
      systems: ['urinary'],
      structures: ['kidneys', 'adrenals', 'heart'],
      scene: 'nefron',
    });
  }

  // --- Kemik-mineral / D vitamini
  const vitd = val(m, 'vitamin-d');
  if (vitd !== undefined && vitd < 30) {
    push({
      id: 'vitamin-d',
      title: vitd < 20 ? 'D vitamini eksikliği' : 'D vitamini yetersizliği',
      level: vitd < 12 ? 'attention' : 'info',
      text: `25-OH D vitamini ${f(vitd, 0)} ng/mL. D vitamini kalsiyum emilimi ve kemik sağlığı için gereklidir. Güneş ışığı (deride yapım), beslenme ve gerekirse hekimin önerdiği takviyeyle düzeltilir.`,
      tests: ['vitamin-d', 'calcium', 'phosphorus', 'alp'].filter((k) => has(m, k)),
      systems: ['musculoskeletal'],
      structures: ['skin', 'kidneys', 'bones'],
      scene: 'ilik',
    });
  }

  // --- Pankreas
  const lipase = m.get('lipase');
  if (lipase?.status === 'high' || is(m, 'amylase', 'high')) {
    const strong = (lipase?.uln ?? 0) >= 3;
    push({
      id: 'pancreas',
      title: 'Pankreas enzimleri yüksek',
      level: strong ? 'urgent' : 'info',
      text: strong
        ? 'Lipaz üst sınırın 3 katından fazla: karın ağrısıyla birlikteyse pankreas iltihabı açısından aynı gün değerlendirme gerekir.'
        : 'Amilaz/lipazda hafif artış; pankreas dışında tükürük bezleri, böbrek işlevi ve bazı ilaçlarla da ilişkili olabilir.',
      tests: ['lipase', 'amylase', 'triglyceride'].filter((k) => has(m, k)),
      systems: ['digestive'],
      structures: ['pancreas'],
      scene: 'adacik',
    });
  }

  // --- Kan hücreleri (sayı)
  if (is(m, 'platelet', 'low') || is(m, 'platelet', 'high')) {
    const p = m.get('platelet')!;
    push({
      id: 'platelets',
      title: p.status === 'low' ? 'Trombosit sayısı düşük' : 'Trombosit sayısı yüksek',
      level: p.severity === 'marked' ? 'urgent' : 'info',
      text:
        p.status === 'low'
          ? 'Trombositler pıhtılaşma için gereklidir. Düşüklük; enfeksiyonlar, ilaçlar, dalak büyümesi ya da kemik iliği ile ilişkili olabilir. Morarma veya kanama olursa hemen başvur.'
          : 'Trombosit yüksekliği çoğunlukla iltihap, demir eksikliği ya da kanama sonrası tepkiseldir; kalıcıysa kemik iliği açısından değerlendirilir.',
      tests: ['platelet', 'mpv'].filter((k) => has(m, k)),
      systems: ['hematologic'],
      structures: ['bones', 'spleen'],
      scene: 'ilik',
    });
  }
  if (is(m, 'wbc', 'low')) {
    push({
      id: 'leukopenia',
      title: 'Akyuvar sayısı düşük',
      level: m.get('wbc')!.severity === 'marked' ? 'urgent' : 'info',
      text: 'Akyuvar düşüklüğü bazı viral enfeksiyonlar, ilaçlar, B12/folat eksikliği ya da kemik iliği ile ilişkili olabilir. Ateş olursa hemen başvurmak gerekir.',
      tests: ['wbc', 'neutrophil-abs', 'lymphocyte-abs'].filter((k) => has(m, k)),
      systems: ['immune', 'hematologic'],
      structures: ['bones', 'spleen', 'thymus'],
      scene: 'ilik',
    });
  }

  // --- Diğer
  if (is(m, 'uric-acid', 'high')) {
    push({
      id: 'uric-acid',
      title: 'Ürik asit yüksek',
      level: 'info',
      text: 'Ürik asit yüksekliği gut hastalığı ve böbrek taşı riskini artırabilir; beslenme (kırmızı et, sakatat, alkol, şekerli içecekler), kilo ve böbrek işlevi etkiler.',
      tests: ['uric-acid', 'creatinine'].filter((k) => has(m, k)),
      systems: ['urinary'],
      structures: ['kidneys'],
      scene: 'nefron',
    });
  }
  if (is(m, 'homocysteine', 'high')) {
    push({
      id: 'homocysteine',
      title: 'Homosistein yüksek',
      level: 'info',
      text: 'Homosistein yüksekliği B12, folat veya B6 eksikliği ve böbrek işleviyle ilişkili olabilir; damar sağlığı açısından da izlenen bir belirteçtir.',
      tests: ['homocysteine', 'b12', 'folate'].filter((k) => has(m, k)),
      systems: ['cardiovascular'],
      structures: ['coronary-arteries', 'aorta'],
      scene: 'damar',
    });
  }
  if (is(m, 'ck', 'high') && !hepatocellular) {
    push({
      id: 'muscle',
      title: 'Kas enzimi (CK) yüksek',
      level: (m.get('ck')!.uln ?? 0) >= 5 ? 'attention' : 'info',
      text: 'CK artışı çoğunlukla yakın zamandaki yoğun egzersiz ya da kas zorlanmasıyla ilişkilidir; bazı ilaçlar (ör. kolesterol ilaçları) ve kas hastalıkları da yükseltebilir. Kas ağrısı, güçsüzlük veya koyu idrar varsa hemen başvur.',
      tests: ['ck'],
      systems: ['musculoskeletal'],
      structures: ['heart'],
    });
  }
  if (is(m, 'psa', 'high')) {
    push({
      id: 'psa',
      title: 'PSA yüksek',
      level: 'attention',
      text: 'PSA prostat büyümesi, iltihabı, yakın zamanda bisiklet sürme/muayene veya prostat kanseri gibi durumlarla yükselebilir. Tek başına tanı koydurmaz; üroloji değerlendirmesi önerilir.',
      tests: ['psa'],
      systems: ['urinary'],
      structures: ['prostate'],
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Ana giriş

const SUMMARY_SYSTEMS: SystemId[] = ['cardiovascular', 'hematologic', 'digestive', 'urinary', 'endocrine', 'immune', 'musculoskeletal', 'nervous', 'respiratory'];

export function interpret(inputs: LabInput[], sex: Sex = 'unspecified'): Interpretation {
  const findings = inputs.map((i) => gradeResult(i, sex)).filter((x): x is Finding => x !== null);
  const map: FMap = new Map(findings.map((x) => [x.testKey, x]));
  const pats = patterns(map, sex);

  const bySeverity: Record<Severity, number> = { normal: 0, borderline: 0, mild: 0, moderate: 0, marked: 0, unknown: 0 };
  for (const x of findings) bySeverity[x.severity]++;
  const abnormal = findings.filter((x) => x.status === 'high' || x.status === 'low');
  const critical = findings.filter((x) => x.critical);

  const systems: SystemSummary[] = SUMMARY_SYSTEMS.map((sid) => {
    const fs = findings.filter((x) => x.systems.includes(sid));
    const ps = pats.filter((p) => p.systems.includes(sid));
    const ab = fs.filter((x) => x.status === 'high' || x.status === 'low');
    const status: SystemSummary['status'] = !fs.length ? 'none' : ps.some((p) => p.level === 'urgent') || fs.some((x) => x.critical) ? 'urgent' : ab.length || ps.some((p) => p.level === 'attention') ? 'attention' : 'ok';
    const text = !fs.length
      ? 'Bu sistemle ilişkili sonuç yok.'
      : ab.length
        ? `${fs.length} ilişkili testten ${ab.length} tanesi aralık dışında: ${ab.map((x) => `${x.name} ${x.status === 'high' ? '▲' : '▼'}`).join(', ')}.`
        : `${fs.length} ilişkili testin tümü referans aralığında.`;
    return { system: sid, name: systemById.get(sid)?.nameTr ?? sid, status, findings: fs, patterns: ps, text };
  }).filter((s) => s.status !== 'none');

  const structures = new Map<string, StructureState>();
  for (const x of findings) {
    if (x.status !== 'high' && x.status !== 'low') continue;
    const score = SEVERITY_WEIGHT[x.severity];
    for (const sid of x.structures) {
      const s = structures.get(sid) ?? { structure: sid, score: 0, direction: null, findings: [] };
      s.score = Math.max(s.score, score);
      s.direction = s.direction && s.direction !== x.status ? 'mixed' : x.status;
      s.findings.push(x);
      structures.set(sid, s);
    }
  }

  const worst = [...abnormal].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]).slice(0, 3);
  const text = !findings.length
    ? 'Henüz değerlendirilecek sonuç yok.'
    : !abnormal.length
      ? `${findings.length} testin tümü laboratuvarın referans aralığında.${bySeverity.borderline ? ` ${bySeverity.borderline} tanesi sınıra yakın.` : ''}`
      : `${findings.length} testten ${abnormal.length} tanesi referans aralığı dışında` +
        ` (${[bySeverity.marked && `${bySeverity.marked} belirgin`, bySeverity.moderate && `${bySeverity.moderate} orta`, bySeverity.mild && `${bySeverity.mild} hafif`].filter(Boolean).join(', ')}).` +
        (worst.length ? ` En çok dikkat isteyen: ${worst.map((x) => x.name).join(', ')}.` : '');

  return { findings, patterns: pats, systems, structures, critical, overall: { total: findings.length, abnormal: abnormal.length, bySeverity, text } };
}

export const CRITICAL_ADVICE =
  'Bu düzey acil tıbbi değerlendirme gerektirebilir. Kendini iyi hissetsen bile bugün bir sağlık kuruluşuna başvur; göğüs ağrısı, nefes darlığı, bilinç bulanıklığı, çarpıntı veya kanama varsa 112’yi ara.';
