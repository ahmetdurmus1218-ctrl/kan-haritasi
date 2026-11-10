import { alveolarPo2, o2Content } from './models/gas';

/**
 * Hesaplanan (türetilmiş) değerler: AYNI rapordaki ölçülmüş sonuçlardan, yayımlanmış bir formülle hesaplanır.
 * Ölçüm değildir; arayüzde her zaman "hesaplandı" diye, formülü, girdileri ve sınırlarıyla gösterilir.
 * Girdilerin hepsi aynı raporda yoksa hesap yapılmaz ("veri yetersiz") — farklı günlerin değerleri karıştırılmaz.
 */
export interface DerivedContext {
  /** Yıl olarak yaş (kullanıcı girer; saklanmaz). */
  age?: number;
  sex?: 'female' | 'male';
}

export interface DerivedDef {
  id: string;
  title: string;
  unit: string;
  decimals: number;
  /** Gerekli katalog testleri (kanonik birimde, aynı rapordan). */
  needs: string[];
  needsAge?: boolean;
  needsSex?: boolean;
  formula: string;
  /** Ne anlatır (tanı dili olmadan). */
  meaning: string;
  /** Yayımlandığı kaynakta verilen tipik aralık / eşik. */
  typical?: string;
  limits: string[];
  source: string;
  /** İlişkili organ düğümleri. */
  organs: string[];
  compute(v: Record<string, number>, ctx: DerivedContext): number | null;
}

/** CKD-EPI 2021 (ırk katsayısız) kreatinin denklemi. Kreatinin mg/dL, yaş yıl. */
export function ckdEpi2021(creatinine: number, age: number, sex: 'female' | 'male'): number {
  const k = sex === 'female' ? 0.7 : 0.9;
  const a = sex === 'female' ? -0.241 : -0.302;
  const r = creatinine / k;
  return 142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, age) * (sex === 'female' ? 1.012 : 1);
}

export const DERIVED: DerivedDef[] = [
  {
    id: 'egfr-ckdepi',
    title: 'Tahmini süzme hızı (eGFR, CKD-EPI 2021)',
    unit: 'mL/dk/1,73 m²',
    decimals: 0,
    needs: ['creatinine'],
    needsAge: true,
    needsSex: true,
    formula: '142 · min(Kr/κ, 1)^α · max(Kr/κ, 1)^−1,200 · 0,9938^yaş · (kadın: 1,012);  κ = 0,7 (K) / 0,9 (E);  α = −0,241 (K) / −0,302 (E)',
    meaning: 'Kreatinin, yaş ve cinsiyetten böbreklerin süzme hızının istatistiksel tahmini. Ölçülmüş GFR değildir.',
    typical: '≥ 90 (yaşla azalır); 60–89 tek başına hastalık göstermez',
    limits: ['Yalnızca kararlı kreatinin düzeyinde ve 18 yaş üstünde geçerlidir.', 'Kas kütlesi çok az/çok fazla olanlarda, gebelikte ve hızlı değişen böbrek işlevinde yanıltır.', 'Raporundaki eGFR farklı bir denklemle hesaplanmış olabilir.'],
    source: 'Inker LA ve ark. N Engl J Med 2021;385:1737–1749',
    organs: ['kidneys'],
    compute: (v, c) => (c.age !== undefined && c.sex && c.age >= 18 && c.age <= 110 ? ckdEpi2021(v.creatinine!, c.age, c.sex) : null),
  },
  {
    id: 'anion-gap',
    title: 'Anyon açığı',
    unit: 'mmol/L',
    decimals: 0,
    needs: ['sodium', 'chloride', 'hco3'],
    formula: 'Na⁺ − (Cl⁻ + HCO₃⁻)',
    meaning: 'Ölçülmeyen anyonların (laktat, keton, fosfat, albümin…) dolaylı göstergesi; asit-baz değerlendirmesinde kullanılır.',
    typical: '≈ 8–12 (potasyumsuz; laboratuvara göre değişir)',
    limits: ['Albümin düşükse olduğundan küçük çıkar.', 'Üç değerin aynı örnekten ölçülmüş olması gerekir.'],
    source: 'Kraut JA, Madias NE. Clin J Am Soc Nephrol 2007;2:162–174',
    organs: ['kidneys'],
    compute: (v) => v.sodium! - (v.chloride! + v.hco3!),
  },
  {
    id: 'osmolality',
    title: 'Hesaplanan serum ozmolalitesi',
    unit: 'mOsm/kg',
    decimals: 0,
    needs: ['sodium', 'glucose', 'bun'],
    formula: '2 · Na⁺ + glukoz / 18 + BUN / 2,8',
    meaning: 'Kanın yoğunluğunun başlıca çözünenlerden (sodyum, glukoz, üre) hesaplanan değeri.',
    typical: '≈ 275–295',
    limits: ['Ölçülen ozmolalite değildir; alkol gibi ölçülmeyen çözünenleri içermez.'],
    source: 'Worthley LI ve ark. Arch Intern Med 1987;147:343–346',
    organs: ['kidneys'],
    compute: (v) => 2 * v.sodium! + v.glucose! / 18 + v.bun! / 2.8,
  },
  {
    id: 'corrected-calcium',
    title: 'Albümine göre düzeltilmiş kalsiyum',
    unit: 'mg/dL',
    decimals: 1,
    needs: ['calcium', 'albumin'],
    formula: 'Ca + 0,8 · (4,0 − albümin)',
    meaning: 'Kalsiyumun yaklaşık yarısı albümine bağlıdır; albümin düşükken total kalsiyum olduğundan düşük görünür.',
    typical: '≈ 8,5–10,5',
    limits: ['Kaba bir düzeltmedir; kesin değerlendirme iyonize kalsiyum ölçümüyle yapılır.'],
    source: 'Payne RB ve ark. Br Med J 1973;4:643–646',
    organs: ['bones'],
    compute: (v) => v.calcium! + 0.8 * (4 - v.albumin!),
  },
  {
    id: 'ldl-friedewald',
    title: 'Hesaplanan LDL (Friedewald)',
    unit: 'mg/dL',
    decimals: 0,
    needs: ['cholesterol-total', 'hdl', 'triglyceride'],
    formula: 'Total kolesterol − HDL − trigliserid / 5',
    meaning: 'LDL kolesterolün doğrudan ölçülmediği raporlarda kullanılan tahmin.',
    limits: ['Trigliserid ≥ 400 mg/dL iken hesaplanmaz.', 'Açlık örneği varsayılır; düşük LDL düzeylerinde hata payı büyür.'],
    source: 'Friedewald WT ve ark. Clin Chem 1972;18:499–502',
    organs: ['liver'],
    compute: (v) => (v.triglyceride! < 400 ? v['cholesterol-total']! - v.hdl! - v.triglyceride! / 5 : null),
  },
  {
    id: 'homa-ir',
    title: 'HOMA-IR',
    unit: '',
    decimals: 1,
    needs: ['glucose', 'insulin'],
    formula: 'açlık glukozu (mg/dL) · açlık insülini (µIU/mL) / 405',
    meaning: 'Açlık glukozu ve insülininden insülin direncinin dolaylı göstergesi.',
    typical: 'Eşik topluma ve yönteme göre değişir (çoğu çalışmada ≈ 2–2,9)',
    limits: ['Yalnızca AÇLIK örneğinde anlamlıdır; uygulama örneğin aç alınıp alınmadığını bilemez.', 'İnsülin kullananlarda ve belirgin yüksek glukozda geçersizdir.', 'Evrensel bir eşiği yoktur.'],
    source: 'Matthews DR ve ark. Diabetologia 1985;28:412–419',
    organs: ['pancreas', 'liver'],
    compute: (v) => (v.glucose! * v.insulin!) / 405,
  },
  {
    id: 'tsat',
    title: 'Transferrin doygunluğu (hesaplanan)',
    unit: '%',
    decimals: 0,
    needs: ['iron', 'tibc'],
    formula: '100 · serum demiri / TDBK',
    meaning: 'Demir taşıyan proteinin ne kadarının dolu olduğu; iliğe sunulan demirin göstergesi.',
    typical: '≈ 20–45',
    limits: ['Serum demiri gün içinde ve öğünle değişir.'],
    source: 'Camaschella C. N Engl J Med 2015;372:1832–1843',
    organs: ['bones', 'liver'],
    compute: (v) => (v.tibc! > 0 ? (100 * v.iron!) / v.tibc! : null),
  },
  {
    id: 'bun-cr',
    title: 'BUN / kreatinin oranı',
    unit: '',
    decimals: 0,
    needs: ['bun', 'creatinine'],
    formula: 'BUN / kreatinin',
    meaning: 'Üre ve kreatininin birbirine göre değişimi; sıvı durumu ve protein yüküyle değişir.',
    typical: '≈ 10–20',
    limits: ['Tek başına bir nedeni göstermez; beslenme, kanama ve ilaçlardan etkilenir.'],
    source: 'Hosten AO. Clinical Methods, 3. baskı, bölüm 193 (NCBI Bookshelf)',
    organs: ['kidneys'],
    compute: (v) => (v.creatinine! > 0 ? v.bun! / v.creatinine! : null),
  },
  {
    id: 'acr',
    title: 'İdrar albümin / kreatinin oranı',
    unit: 'mg/g',
    decimals: 0,
    needs: ['urine-microalbumin', 'urine-creatinine'],
    formula: '100 · idrar albümini (mg/L) / idrar kreatinini (mg/dL)',
    meaning: 'Spot idrarda albümin kaçağını idrarın yoğunluğundan bağımsız gösterir.',
    typical: '< 30',
    limits: ['Egzersiz, ateş, idrar yolu enfeksiyonu ve adet dönemi geçici yükseltir; kalıcılık için tekrar gerekir.'],
    source: 'KDIGO 2012 CKD Guideline. Kidney Int Suppl 2013;3:1–150',
    organs: ['kidneys'],
    compute: (v) => (v['urine-creatinine']! > 0 ? (100 * v['urine-microalbumin']!) / v['urine-creatinine']! : null),
  },
  {
    id: 'aa-gradient',
    title: 'Alveol-arter oksijen farkı',
    unit: 'mmHg',
    decimals: 0,
    needs: ['po2', 'pco2'],
    formula: '[0,21 · (760 − 47) − pCO₂ / 0,8] − pO₂',
    meaning: 'Alveoldeki oksijenin arter kanına ne kadar iyi geçtiğinin göstergesi.',
    typical: '≈ yaş / 4 + 4 (genç erişkinde < 15)',
    limits: ['Yalnızca ARTER kanı, oda havası ve deniz düzeyi için geçerlidir; toplardamar örneğinde anlamsızdır.', 'Uygulama örneğin türünü ve solunan oksijeni bilemez.'],
    source: 'West JB. Respiratory Physiology: The Essentials',
    organs: ['lungs'],
    compute: (v) => alveolarPo2(0.21, 760, v.pco2!) - v.po2!,
  },
  {
    id: 'winter',
    title: 'Beklenen pCO₂ (solunumsal telafi)',
    unit: 'mmHg',
    decimals: 0,
    needs: ['hco3'],
    formula: 'HCO₃⁻ < 22: 1,5 · HCO₃⁻ + 8 (Winter);  HCO₃⁻ > 26: 40 + 0,7 · (HCO₃⁻ − 24)',
    meaning: 'Metabolik bir değişiklikte akciğerin telafisiyle beklenen pCO₂; ölçülenle karşılaştırılır.',
    limits: ['± 2 mmHg belirsizlik taşır; telafinin tamamlanması 12–24 saat sürer.', 'Yalnızca birincil metabolik bozukluk bağlamında anlamlıdır; HCO₃⁻ 22–26 arasındayken hesaplanmaz.'],
    source: 'Albert MS ve ark. Ann Intern Med 1967;66:312–322',
    organs: ['lungs', 'kidneys'],
    compute: (v) => (v.hco3! < 22 ? 1.5 * v.hco3! + 8 : v.hco3! > 26 ? 40 + 0.7 * (v.hco3! - 24) : null),
  },
  {
    id: 'cao2',
    title: 'Kanın oksijen içeriği',
    unit: 'mL/dL',
    decimals: 1,
    needs: ['hemoglobin', 'so2', 'po2'],
    formula: '1,34 · Hb · SO₂ + 0,003 · pO₂',
    meaning: 'Kanın taşıdığı toplam oksijen: çoğu hemoglobine bağlı, azı çözünmüş.',
    typical: 'arter kanında ≈ 17–21',
    limits: ['Değer örneğin türüne (arter/ven) bağlıdır.'],
    source: 'West JB. Respiratory Physiology: The Essentials',
    organs: ['lungs', 'heart'],
    compute: (v) => o2Content(v.hemoglobin!, v.so2! / 100, v.po2!),
  },
];

export const derivedById = new Map(DERIVED.map((d) => [d.id, d]));

export interface DerivedReport {
  id: string;
  /** ISO tarih. */
  date: string;
  /** Test anahtarı → kanonik değer (yalnızca "<", ">" nitelikli olmayan kesin sayılar). */
  values: Record<string, number>;
}

export interface DerivedResult {
  def: DerivedDef;
  /** Hesaplanamıyorsa null. */
  value: number | null;
  /** Girdilerin geldiği rapor. */
  reportId?: string;
  date?: string;
  inputs: Array<{ key: string; value: number }>;
  /** Hesaplanamama nedeni. */
  missing?: { tests: string[]; age?: boolean; sex?: boolean; outOfRange?: boolean };
}

/**
 * Her hesap için, gerekli TÜM girdileri içeren en yeni rapor bulunur. Böyle bir rapor yoksa değer üretilmez;
 * hangi girdinin hiç ölçülmediği ya da aynı raporda bulunmadığı bildirilir.
 */
export function computeDerived(reports: DerivedReport[], ctx: DerivedContext): DerivedResult[] {
  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  return DERIVED.map((def) => {
    const report = sorted.find((r) => def.needs.every((k) => Number.isFinite(r.values[k])));
    if (!report) {
      const ever = new Set(sorted.flatMap((r) => Object.keys(r.values)));
      return { def, value: null, inputs: [], missing: { tests: def.needs.filter((k) => !ever.has(k)).length ? def.needs.filter((k) => !ever.has(k)) : def.needs } };
    }
    const inputs = def.needs.map((key) => ({ key, value: report.values[key]! }));
    const base = { def, reportId: report.id, date: report.date, inputs };
    const noAge = def.needsAge && ctx.age === undefined;
    const noSex = def.needsSex && !ctx.sex;
    if (noAge || noSex) return { ...base, value: null, missing: { tests: [], ...(noAge ? { age: true } : {}), ...(noSex ? { sex: true } : {}) } };
    const value = def.compute(report.values, ctx);
    if (value === null || !Number.isFinite(value)) return { ...base, value: null, missing: { tests: [], outOfRange: true } };
    return { ...base, value };
  });
}
