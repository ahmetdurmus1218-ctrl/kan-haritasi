/**
 * Genel örüntü motoru (veriyle tanımlı; "X ve Y ise hastalık Z" kuralı DEĞİL).
 *
 * Her örüntü, onu destekleyen ve onunla çelişen ölçütlerden oluşur. Değerlendirme her ölçüt için
 * "karşılandı / karşılanmadı / veri yok" der ve şunları üretir: destekleyen bulgular, çelişen bulgular,
 * eksik bilgiler, ilgili organ/sistemler, güven (kanıtın tutarlılığı) ve açıklama. Tanı koymaz;
 * başlıklar "örüntü" olarak adlandırılır ve olası açıklamalar listelenir.
 */
import { type Confidence, type EvidenceSource, type ImageObservation, type LabObservation, type ReportFinding, isPositiveReport, score } from './types';

export type Criterion =
  | { kind: 'lab'; test: string; expect: 'high' | 'low' | 'abnormal' | 'normal'; weight?: number; label: string }
  | { kind: 'imaging'; structure: string; expect: 'abnormal'; weight?: number; label: string }
  | { kind: 'ecg'; expect: 'tachycardia' | 'bradycardia' | 'irregular'; weight?: number; label: string };

export interface PatternDef {
  id: string;
  title: string;
  /** Örüntünün ne anlattığı (tanı değil). */
  meaning: string;
  organs: string[];
  systems: string[];
  supporting: Criterion[];
  /** Görülürse örüntüye karşı kanıt olan ölçütler. */
  contradicting?: Criterion[];
  /** Etkin sayılmak için en az kaç destekleyen ölçüt. */
  minSupport: number;
  level: 'info' | 'attention' | 'urgent';
  possibleExplanations: string[];
}

export interface EvidenceItem {
  source: EvidenceSource;
  label: string;
  detail: string;
}

export interface PatternResult {
  id: string;
  title: string;
  meaning: string;
  active: boolean;
  level: PatternDef['level'];
  supporting: EvidenceItem[];
  contradictory: EvidenceItem[];
  missing: string[];
  organs: string[];
  systems: string[];
  confidence: Confidence;
  explanation: string;
  possibleExplanations: string[];
}

export interface EvidenceSet {
  /** Test başına en güncel sonuç. */
  labs: LabObservation[];
  reportFindings: ReportFinding[];
  imageObservations: ImageObservation[];
}

export const PATTERNS: readonly PatternDef[] = [
  {
    id: 'hepatocellular',
    title: 'Karaciğer hücresi enzim örüntüsü',
    meaning: 'ALT/AST gibi karaciğer hücresi içindeki enzimlerin kanda yükselmesi, hücrelerin zorlandığını ya da hasar gördüğünü gösterebilir.',
    organs: ['liver'],
    systems: ['digestive'],
    supporting: [
      { kind: 'lab', test: 'alt', expect: 'high', label: 'ALT yüksek' },
      { kind: 'lab', test: 'ast', expect: 'high', label: 'AST yüksek' },
      { kind: 'imaging', structure: 'liver', expect: 'abnormal', weight: 0.5, label: 'Karaciğerde görüntüleme bulgusu' },
    ],
    contradicting: [{ kind: 'lab', test: 'ck', expect: 'high', label: 'CK yüksek (AST kas kaynaklı olabilir)' }],
    minSupport: 1,
    level: 'attention',
    possibleExplanations: ['Karaciğer yağlanması', 'İlaçlar, takviyeler, alkol', 'Viral hepatitler', 'Yoğun egzersiz ya da kas hasarı (özellikle AST)'],
  },
  {
    id: 'cholestatic',
    title: 'Safra akışı (kolestatik) örüntüsü',
    meaning: 'ALP, GGT ve bilirubinin birlikte yükselmesi safranın karaciğerden bağırsağa akışında yavaşlamayla ilişkili olabilir.',
    organs: ['liver', 'gallbladder'],
    systems: ['digestive'],
    supporting: [
      { kind: 'lab', test: 'alp', expect: 'high', label: 'ALP yüksek' },
      { kind: 'lab', test: 'ggt', expect: 'high', label: 'GGT yüksek' },
      { kind: 'lab', test: 'bilirubin-total', expect: 'high', label: 'Bilirubin yüksek' },
      { kind: 'imaging', structure: 'gallbladder', expect: 'abnormal', weight: 0.5, label: 'Safra kesesi / yollarında görüntüleme bulgusu' },
    ],
    minSupport: 2,
    level: 'attention',
    possibleExplanations: ['Safra taşı', 'Safra yolu daralması', 'İlaçlar', 'ALP tek başına yüksekse kemik kaynaklı olabilir'],
  },
  {
    id: 'liver-synthesis',
    title: 'Karaciğer protein üretimi örüntüsü',
    meaning: 'Albümin düşüklüğü ve INR yüksekliği, karaciğerin protein üretiminin azaldığını gösterebilir; beslenme ve böbrek kaybı da albümini düşürür.',
    organs: ['liver'],
    systems: ['digestive'],
    supporting: [
      { kind: 'lab', test: 'albumin', expect: 'low', label: 'Albümin düşük' },
      { kind: 'lab', test: 'inr', expect: 'high', label: 'INR yüksek' },
      { kind: 'lab', test: 'total-protein', expect: 'low', weight: 0.5, label: 'Total protein düşük' },
    ],
    minSupport: 2,
    level: 'attention',
    possibleExplanations: ['Kronik karaciğer hastalığı', 'Yetersiz beslenme', 'Böbrekten protein kaybı', 'Kan sulandırıcı ilaçlar (INR)'],
  },
  {
    id: 'glucose',
    title: 'Kan şekeri düzenlenmesi örüntüsü',
    meaning: 'Glukoz ve HbA1c yüksekliği, insülinin kan şekerini düşürme etkisinin yetersiz kaldığını gösterebilir (pankreas → insülin → hücrelerin glukoz kullanımı zinciri).',
    organs: ['pancreas'],
    systems: ['endocrine'],
    supporting: [
      { kind: 'lab', test: 'glucose', expect: 'high', label: 'Glukoz yüksek' },
      { kind: 'lab', test: 'hba1c', expect: 'high', label: 'HbA1c yüksek' },
      { kind: 'lab', test: 'insulin', expect: 'high', weight: 0.5, label: 'İnsülin yüksek (direnç ile uyumlu olabilir)' },
      { kind: 'lab', test: 'triglyceride', expect: 'high', weight: 0.5, label: 'Trigliserid yüksek' },
    ],
    contradicting: [{ kind: 'lab', test: 'hba1c', expect: 'normal', label: 'HbA1c normal (son 2–3 ay ortalaması normal)' }],
    minSupport: 1,
    level: 'attention',
    possibleExplanations: ['Prediyabet / diyabet', 'İnsülin direnci', 'Açlık süresinin kısa olması', 'Stres, steroid ilaçlar'],
  },
  {
    id: 'pancreatic-enzymes',
    title: 'Pankreas enzimleri örüntüsü',
    meaning: 'Amilaz ve lipazın birlikte yükselmesi pankreasın ekzokrin (sindirim enzimi) bölümünün etkilendiğini gösterebilir.',
    organs: ['pancreas'],
    systems: ['digestive'],
    supporting: [
      { kind: 'lab', test: 'lipase', expect: 'high', label: 'Lipaz yüksek' },
      { kind: 'lab', test: 'amylase', expect: 'high', label: 'Amilaz yüksek' },
      { kind: 'lab', test: 'triglyceride', expect: 'high', weight: 0.5, label: 'Trigliserid yüksek' },
      { kind: 'imaging', structure: 'pancreas', expect: 'abnormal', label: 'Pankreasta görüntüleme bulgusu' },
    ],
    minSupport: 1,
    level: 'attention',
    possibleExplanations: ['Pankreas iltihabı', 'Safra taşı', 'Çok yüksek trigliserid', 'Tükürük bezi kaynaklı amilaz', 'Böbrek fonksiyonunun azalması (enzim atılımı)'],
  },
  {
    id: 'kidney-filtration',
    title: 'Böbrek süzme örüntüsü',
    meaning: 'Kreatinin ve ürenin yükselmesi, eGFR’nin düşmesi böbreklerin kanı süzme hızının azaldığını gösterebilir.',
    organs: ['kidneys'],
    systems: ['urinary'],
    supporting: [
      { kind: 'lab', test: 'creatinine', expect: 'high', label: 'Kreatinin yüksek' },
      { kind: 'lab', test: 'egfr', expect: 'low', label: 'eGFR düşük' },
      { kind: 'lab', test: 'urea', expect: 'high', weight: 0.5, label: 'Üre yüksek' },
      { kind: 'imaging', structure: 'kidneys', expect: 'abnormal', weight: 0.5, label: 'Böbreklerde görüntüleme bulgusu' },
    ],
    minSupport: 1,
    level: 'attention',
    possibleExplanations: ['Sıvı kaybı (geçici)', 'Kronik böbrek hastalığı', 'İlaçlar', 'Yüksek kas kütlesi (kreatinin)'],
  },
  {
    id: 'electrolytes',
    title: 'Sıvı–elektrolit dengesi örüntüsü',
    meaning: 'Sodyum ya da potasyumun aralık dışında olması böbreklerin tuz-su dengesini ve kalp ritmini etkileyebilir.',
    organs: ['kidneys', 'heart'],
    systems: ['urinary', 'cardiovascular'],
    supporting: [
      { kind: 'lab', test: 'sodium', expect: 'abnormal', label: 'Sodyum aralık dışında' },
      { kind: 'lab', test: 'potassium', expect: 'abnormal', label: 'Potasyum aralık dışında' },
      { kind: 'ecg', expect: 'irregular', weight: 0.5, label: 'EKG’de düzensiz RR aralıkları' },
    ],
    minSupport: 1,
    level: 'attention',
    possibleExplanations: ['İshal, kusma, terleme', 'İdrar söktürücü ilaçlar', 'Böbrek fonksiyon değişikliği', 'Örnek hemolizi (potasyum yalancı yüksek)'],
  },
  {
    id: 'iron-deficiency',
    title: 'Demir eksikliği örüntüsü',
    meaning: 'Düşük hemoglobin, küçük alyuvarlar (düşük MCV) ve düşük ferritin birlikte demir depolarının azaldığını gösterebilir.',
    organs: ['bones'],
    systems: ['hematologic'],
    supporting: [
      { kind: 'lab', test: 'hemoglobin', expect: 'low', label: 'Hemoglobin düşük' },
      { kind: 'lab', test: 'mcv', expect: 'low', label: 'MCV düşük' },
      { kind: 'lab', test: 'ferritin', expect: 'low', label: 'Ferritin düşük' },
      { kind: 'lab', test: 'iron', expect: 'low', weight: 0.5, label: 'Demir düşük' },
    ],
    contradicting: [{ kind: 'lab', test: 'ferritin', expect: 'high', label: 'Ferritin yüksek (depo dolu; iltihapta da yükselir)' }],
    minSupport: 2,
    level: 'attention',
    possibleExplanations: ['Kan kaybı (adet, sindirim kanalı)', 'Yetersiz alım ya da emilim', 'Gebelik'],
  },
  {
    id: 'thyroid-low',
    title: 'Tiroid hormonu düşüklüğü örüntüsü',
    meaning: 'TSH yüksek ve serbest T4 düşükse, hipofiz tiroidi daha çok uyardığı hâlde hormon üretimi yetersiz kalıyor olabilir.',
    organs: ['thyroid'],
    systems: ['endocrine'],
    supporting: [
      { kind: 'lab', test: 'tsh', expect: 'high', label: 'TSH yüksek' },
      { kind: 'lab', test: 'ft4', expect: 'low', label: 'Serbest T4 düşük' },
    ],
    contradicting: [{ kind: 'lab', test: 'ft4', expect: 'high', label: 'Serbest T4 yüksek' }],
    minSupport: 1,
    level: 'attention',
    possibleExplanations: ['Hashimoto tiroiditi', 'İyot eksikliği', 'İlaçlar', 'Hastalıktan iyileşme dönemi (geçici)'],
  },
  {
    id: 'lipids',
    title: 'Kolesterol taşınması örüntüsü',
    meaning: 'Yüksek LDL ve trigliserid ile düşük HDL, yıllar içinde damar duvarında plak oluşumu riskiyle ilişkilidir.',
    organs: ['liver', 'heart'],
    systems: ['cardiovascular'],
    supporting: [
      { kind: 'lab', test: 'ldl', expect: 'high', label: 'LDL yüksek' },
      { kind: 'lab', test: 'triglyceride', expect: 'high', label: 'Trigliserid yüksek' },
      { kind: 'lab', test: 'hdl', expect: 'low', label: 'HDL düşük' },
    ],
    minSupport: 1,
    level: 'info',
    possibleExplanations: ['Beslenme ve hareket', 'Ailesel yatkınlık', 'Tiroid düşüklüğü', 'Diyabet'],
  },
  {
    id: 'inflammation',
    title: 'İnflamasyon (iltihap) belirteçleri örüntüsü',
    meaning: 'CRP, sedimantasyon ve lökositin yükselmesi vücutta bir iltihap ya da enfeksiyon yanıtı olduğunu gösterebilir; tek bir organa özgü değildir.',
    organs: [],
    systems: ['immune'],
    supporting: [
      { kind: 'lab', test: 'crp', expect: 'high', label: 'CRP yüksek' },
      { kind: 'lab', test: 'esr', expect: 'high', weight: 0.5, label: 'Sedimantasyon yüksek' },
      { kind: 'lab', test: 'wbc', expect: 'high', label: 'Lökosit yüksek' },
    ],
    minSupport: 1,
    level: 'attention',
    possibleExplanations: ['Enfeksiyon', 'Otoimmün hastalıklar', 'Doku hasarı', 'Yakın zamanda geçirilmiş hastalık'],
  },
  {
    id: 'heart-rate',
    title: 'Kalp hızı örüntüsü',
    meaning: 'EKG görüntüsünden ölçülen kalp hızının dinlenme aralığı (50–100/dk) dışında olması.',
    organs: ['heart'],
    systems: ['cardiovascular'],
    supporting: [
      { kind: 'ecg', expect: 'tachycardia', label: 'Kalp hızı > 100/dk' },
      { kind: 'ecg', expect: 'bradycardia', label: 'Kalp hızı < 50/dk' },
      { kind: 'lab', test: 'potassium', expect: 'abnormal', weight: 0.5, label: 'Potasyum aralık dışında' },
      { kind: 'lab', test: 'tsh', expect: 'abnormal', weight: 0.5, label: 'TSH aralık dışında (tiroid kalp hızını etkiler)' },
      { kind: 'lab', test: 'hemoglobin', expect: 'low', weight: 0.5, label: 'Hemoglobin düşük (kansızlıkta kalp hızlanabilir)' },
    ],
    minSupport: 1,
    level: 'info',
    possibleExplanations: ['Egzersiz, kaygı, kafein (hızlı)', 'Sporcu kalbi, uyku (yavaş)', 'Tiroid bozuklukları', 'İlaçlar', 'İletim sistemi sorunları'],
  },
];

type State = { state: 'met' | 'not-met' | 'missing'; item?: EvidenceItem };

const fmt = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

function check(c: Criterion, ev: EvidenceSet): State {
  if (c.kind === 'lab') {
    const l = ev.labs.find((x) => x.testKey === c.test);
    if (!l || l.status === 'unknown') return { state: 'missing' };
    const met = c.expect === 'abnormal' ? l.status === 'high' || l.status === 'low' : l.status === c.expect;
    const range = l.refMin !== undefined || l.refMax !== undefined ? ` (referans ${l.refMin ?? '…'}–${l.refMax ?? '…'}${l.refSource ? `, ${REF_TR[l.refSource]}` : ''})` : '';
    return { state: met ? 'met' : 'not-met', item: { source: 'LAB', label: met ? c.label : `${l.name}: ${STATUS_TR[l.status]}`, detail: `${l.name} ${fmt(l.value)} ${l.unit}${range} · ${l.date}` } };
  }
  if (c.kind === 'imaging') {
    const rep = ev.reportFindings.filter((f) => f.location?.structure === c.structure);
    const img = ev.imageObservations.filter((o) => o.location?.structure === c.structure && o.kind === 'asymmetry');
    if (!rep.length && !img.length) return { state: 'missing' };
    const abn = rep.find(isPositiveReport);
    if (abn) return { state: 'met', item: { source: abn.source, label: c.label, detail: `Rapor: “${abn.text}”` } };
    if (img.length) return { state: 'met', item: { source: 'IMAGE_ANALYSIS', label: `${c.label} (görüntü analizi, doğrulanmamış)`, detail: img[0]!.text } };
    return { state: 'not-met', item: { source: rep[0]!.source, label: 'Rapor bu yapıyı olağan bildiriyor', detail: `“${rep[0]!.text}”` } };
  }
  const hr = ev.imageObservations.find((o) => o.kind === 'heart-rate' && o.measurement);
  const rhythm = ev.imageObservations.find((o) => o.kind === 'rhythm');
  if (c.expect === 'irregular') {
    if (!rhythm) return { state: 'missing' };
    const irr = /düzensiz/.test(rhythm.text);
    return { state: irr ? 'met' : 'not-met', item: { source: 'IMAGE_ANALYSIS', label: irr ? c.label : 'EKG’de RR aralıkları düzenli', detail: rhythm.text } };
  }
  if (!hr?.measurement) return { state: 'missing' };
  const v = hr.measurement.value;
  const met = c.expect === 'tachycardia' ? v > 100 : v < 50;
  return { state: met ? 'met' : 'not-met', item: { source: 'IMAGE_ANALYSIS', label: met ? c.label : `Kalp hızı ${v}/dk`, detail: hr.text } };
}

const STATUS_TR = { low: 'düşük', normal: 'aralıkta', high: 'yüksek', unknown: 'değerlendirilemedi' } as const;
export const REF_TR = { report: 'raporun kendi aralığı', laboratory: 'laboratuvarın aralığı', demographic: 'yaş/cinsiyete göre', system: 'genel aralık' } as const;

export function evaluatePattern(def: PatternDef, ev: EvidenceSet): PatternResult {
  let sup = 0;
  let con = 0;
  let present = 0;
  let total = 0;
  let supCount = 0;
  const supporting: EvidenceItem[] = [];
  const contradictory: EvidenceItem[] = [];
  const missing: string[] = [];
  for (const c of def.supporting) {
    const w = c.weight ?? 1;
    total += w;
    const s = check(c, ev);
    if (s.state === 'missing') {
      missing.push(c.label.replace(/ (yüksek|düşük|aralık dışında).*$/, '') || c.label);
      continue;
    }
    present += w;
    if (s.state === 'met') {
      sup += w;
      supCount++;
      supporting.push(s.item!);
    } else if (c.kind === 'lab' && s.item) {
      // Beklenen yönde değilse (ör. ALT normal) örüntüye karşı zayıf kanıt.
      con += w * 0.5;
      contradictory.push(s.item);
    } else if (s.item && c.kind === 'imaging') {
      con += w * 0.5;
      contradictory.push(s.item);
    }
  }
  for (const c of def.contradicting ?? []) {
    const s = check(c, ev);
    if (s.state === 'met') {
      con += c.weight ?? 1;
      contradictory.push({ ...s.item!, label: c.label });
    }
  }
  const active = supCount >= def.minSupport && sup > 0;
  const coverage = total ? present / total : 0;
  const value = sup + con > 0 ? (sup / (sup + con)) * Math.sqrt(coverage) : 0;
  const explanation = active
    ? `${def.meaning} Destekleyen: ${supporting.map((s) => s.label).join(', ')}.${contradictory.length ? ` Karşı yönde: ${contradictory.map((s) => s.label).join(', ')}.` : ''}${missing.length ? ` Eksik bilgi: ${missing.join(', ')}.` : ''} Bu bir tanı değildir.`
    : `${def.title} için yeterli destekleyici bulgu yok.`;
  return {
    id: def.id,
    title: def.title,
    meaning: def.meaning,
    active,
    level: def.level,
    supporting,
    contradictory,
    missing,
    organs: def.organs,
    systems: def.systems,
    confidence: score(value, 'destekleyen/çelişen kanıt oranı × veri kapsamı (hastalık olasılığı değildir)'),
    explanation,
    possibleExplanations: def.possibleExplanations,
  };
}

export function evaluatePatterns(ev: EvidenceSet, defs: readonly PatternDef[] = PATTERNS): PatternResult[] {
  return defs.map((d) => evaluatePattern(d, ev)).filter((r) => r.active);
}
