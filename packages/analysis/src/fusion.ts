/**
 * Birleşik sağlık modeli: eldeki TÜM kaynaklar ayrı ayrı işlenir, sonra birleştirilir.
 *
 *   if raw_image_available:      analyze_image()        (pipeline.ts — rapor gerekmez)
 *   if report_available:         analyze_report()       (rapordaki bulgular, ayrı kaynak)
 *   if lab_available:            analyze_labs()         (en güncel sonuçlar + eğilimler)
 *   if previous_study_available: compare_temporally()
 *   merge_available_evidence()
 *
 * "Rapor yoksa analiz yok" mantığı YOKTUR. Kaynaklar birleştirilirken de kaynağı değişmez: görüntü
 * gözlemi rapor bulgusu gibi, rapor bulgusu piksel konumu gibi gösterilmez.
 */
import { testByKey } from '@kh/catalog';
import { GRAPH } from './knowledge';
import { latestByTest } from './labs';
import { type EvidenceSet, type PatternResult, evaluatePatterns } from './patterns';
import type { ImageAnalysisRun } from './pipeline';
import { type StudyComparison, type StudySnapshot, compareStudies, itemFromObservation, itemFromReport } from './temporal';
import { type Trend, computeTrend } from './trend';
import type { Confidence, EvidenceSource, ImageObservation, LabObservation, ReportFinding } from './types';

export interface ImageStudyInput {
  run: ImageAnalysisRun;
  /** Çekim tarihi (YYYY-AA-GG). */
  date?: string;
  documentId?: string;
  /** Aynı çalışmanın raporuyla eşleştirmek için (tür + bölge + tarih). */
  studyKey?: string;
  modality?: string;
  structure?: string;
}

export interface ReportStudyInput {
  findings: ReportFinding[];
  date?: string;
  documentId?: string;
  studyKey?: string;
  modality?: string;
  structure?: string;
}

export interface HealthInput {
  images: ImageStudyInput[];
  reports: ReportStudyInput[];
  /** Tüm onaylanmış laboratuvar sonuçları (birden çok tarih olabilir). */
  labs: LabObservation[];
}

export interface Concordance {
  observation: ImageObservation;
  relation: 'supported-by-report' | 'report-says-normal' | 'not-mentioned-in-report' | 'no-report';
  reportFindings: ReportFinding[];
  text: string;
}

export interface TimelineEvent {
  date: string;
  type: 'lab' | 'imaging-report' | 'image-analysis';
  source: EvidenceSource;
  label: string;
  organs: string[];
  status?: 'abnormal' | 'uncertain' | 'normal' | 'high' | 'low';
  confidence?: Confidence;
  ref?: string;
}

export interface OrganState {
  organ: string;
  imageObservations: ImageObservation[];
  reportFindings: ReportFinding[];
  labs: LabObservation[];
  patterns: PatternResult[];
  /** Dikkat çeken veri var mı (aralık dışı tahlil, rapordaki bulgu, görüntü gözlemi, örüntü). */
  attention: boolean;
}

export interface MergeStep {
  step: 'analyze_image' | 'analyze_report' | 'analyze_labs' | 'compare_temporally' | 'merge_available_evidence';
  ran: boolean;
  detail: string;
}

export interface HealthModel {
  available: { image: boolean; report: boolean; lab: boolean; previous: boolean };
  steps: MergeStep[];
  imageObservations: ImageObservation[];
  reportFindings: ReportFinding[];
  latestLabs: LabObservation[];
  trends: Map<string, Trend>;
  concordance: Concordance[];
  patterns: PatternResult[];
  organs: Map<string, OrganState>;
  timeline: TimelineEvent[];
  comparisons: StudyComparison[];
  statements: string[];
}

/** Bir laboratuvar testinin ilişkili olduğu organlar (katalog + bilgi grafiği). */
export function organsForLab(testKey: string): string[] {
  const set = new Set<string>(testByKey.get(testKey)?.structures ?? []);
  for (const n of GRAPH.organsForTest(testKey)) set.add(n.id);
  return [...set];
}

function concordanceFor(o: ImageObservation, reports: ReportFinding[], reportAvailable: boolean): Concordance {
  if (!reportAvailable) return { observation: o, relation: 'no-report', reportFindings: [], text: 'Rapor yok: bu görüntü gözlemi bir rapor ile doğrulanamadı.' };
  const s = o.location?.structure;
  const side = o.location?.side;
  const same = reports.filter((f) => s && f.location?.structure === s && (!side || !f.location.side || f.location.side === side || f.location.side === 'both'));
  const positive = same.filter((f) => !f.negated && f.status !== 'normal');
  if (positive.length)
    return {
      observation: o,
      relation: 'supported-by-report',
      reportFindings: positive,
      text: 'Rapor aynı yapıda (ve tarafta) bir bulgu bildiriyor. Görüntü gözlemi bu bulguyla uyumlu olabilir; aynı şey olduğu otomatik olarak doğrulanamaz.',
    };
  if (same.length)
    return { observation: o, relation: 'report-says-normal', reportFindings: same, text: 'Rapor bu bölgeyi olağan bildiriyor. Görüntü gözlemi normal bir asimetri ya da çekim etkisi (yanlış pozitif) olabilir; rapor esastır.' };
  return { observation: o, relation: 'not-mentioned-in-report', reportFindings: [], text: 'Rapor bu bölgeden söz etmiyor. Gözlem doğrulanmadı; önemi için hekime danış.' };
}

export function buildHealthModel(input: HealthInput): HealthModel {
  const steps: MergeStep[] = [];
  const imageObservations = input.images.flatMap((i) => i.run.result.observations);
  const reportFindings = input.reports.flatMap((r) => r.findings);
  const available = {
    image: input.images.length > 0,
    report: input.reports.some((r) => r.findings.length > 0),
    lab: input.labs.length > 0,
    previous: false,
  };
  steps.push({ step: 'analyze_image', ran: available.image, detail: available.image ? `${input.images.length} görüntü analiz edildi; ${imageObservations.length} görüntü gözlemi.` : 'Ham görüntü yok.' });
  steps.push({ step: 'analyze_report', ran: available.report, detail: available.report ? `${reportFindings.length} rapor cümlesi yapılandırıldı (olumsuzlamalar "yok" olarak).` : 'Rapor yok; analiz rapora bağlı değildir.' });
  const latestLabs = latestByTest(input.labs);
  const trends = new Map<string, Trend>();
  const byTest = new Map<string, LabObservation[]>();
  for (const l of input.labs) (byTest.get(l.testKey) ?? byTest.set(l.testKey, []).get(l.testKey)!).push(l);
  for (const [k, ls] of byTest) if (ls.length >= 2) trends.set(k, computeTrend(ls.map((l) => ({ date: l.date, value: l.value, refMin: l.refMin, refMax: l.refMax })), ls[0]!.name));
  steps.push({ step: 'analyze_labs', ran: available.lab, detail: available.lab ? `${latestLabs.length} testin en güncel sonucu; ${trends.size} test için eğilim.` : 'Laboratuvar sonucu yok.' });

  // Zaman içinde karşılaştırma: aynı yapı + modalite için tarih sıralı çalışmalar.
  const snapshots = new Map<string, StudySnapshot[]>();
  const add = (k: string, s: StudySnapshot) => (snapshots.get(k) ?? snapshots.set(k, []).get(k)!).push(s);
  for (const r of input.reports)
    if (r.date && r.structure) add(`${r.modality ?? '?'}|${r.structure}`, { date: r.date, modality: r.modality ?? '?', structure: r.structure, items: r.findings.map(itemFromReport).filter((x) => x !== null) });
  for (const i of input.images)
    if (i.date && i.structure) {
      const k = `${i.modality ?? '?'}|${i.structure}`;
      const items = i.run.result.observations.map(itemFromObservation).filter((x) => x !== null);
      const existing = snapshots.get(k)?.find((s) => s.date === i.date);
      if (existing) existing.items.push(...items);
      else add(k, { date: i.date, modality: i.modality ?? '?', structure: i.structure, items });
    }
  const comparisons: StudyComparison[] = [];
  for (const list of snapshots.values()) {
    const sorted = list.sort((a, b) => a.date.localeCompare(b.date));
    for (let k = 1; k < sorted.length; k++) if (sorted[k]!.date !== sorted[k - 1]!.date) comparisons.push(compareStudies(sorted[k - 1]!, sorted[k]!));
  }
  available.previous = comparisons.length > 0;
  steps.push({ step: 'compare_temporally', ran: available.previous, detail: available.previous ? `${comparisons.length} eski ↔ yeni karşılaştırma (yalnızca konum etiketiyle eşleştirme).` : 'Karşılaştırılacak önceki çalışma yok.' });

  // Kaynak uyumu: görüntü gözlemi ↔ aynı çalışmanın raporu.
  const concordance = input.images.flatMap((img) => {
    const reps = input.reports.filter((r) => (img.studyKey && r.studyKey === img.studyKey) || (img.documentId && r.documentId === img.documentId));
    return img.run.result.observations.filter((o) => o.kind === 'asymmetry').map((o) => concordanceFor(o, reps.flatMap((r) => r.findings), reps.some((r) => r.findings.length > 0)));
  });

  const evidence: EvidenceSet = { labs: latestLabs, reportFindings, imageObservations };
  const patterns = evaluatePatterns(evidence);

  // Organ durumları
  const organs = new Map<string, OrganState>();
  const get = (id: string) => organs.get(id) ?? organs.set(id, { organ: id, imageObservations: [], reportFindings: [], labs: [], patterns: [], attention: false }).get(id)!;
  for (const o of imageObservations) if (o.location?.structure) {
    const s = get(o.location.structure);
    s.imageObservations.push(o);
    if (o.kind === 'asymmetry' || (o.kind === 'heart-rate' && o.measurement && (o.measurement.value > 100 || o.measurement.value < 50))) s.attention = true;
  }
  for (const f of reportFindings) if (f.location?.structure) {
    const s = get(f.location.structure);
    s.reportFindings.push(f);
    if (!f.negated && f.status !== 'normal') s.attention = true;
  }
  for (const l of latestLabs)
    for (const id of organsForLab(l.testKey)) {
      const s = get(id);
      s.labs.push(l);
      if (l.status === 'high' || l.status === 'low') s.attention = true;
    }
  for (const p of patterns)
    for (const id of p.organs) {
      const s = get(id);
      s.patterns.push(p);
      s.attention = true;
    }

  // Zaman çizelgesi
  const timeline: TimelineEvent[] = [];
  for (const l of input.labs) timeline.push({ date: l.date, type: 'lab', source: 'LAB', label: `${l.name} ${l.value.toLocaleString('tr-TR')} ${l.unit}`, organs: organsForLab(l.testKey), status: l.status === 'unknown' ? undefined : l.status, confidence: l.confidence, ref: l.testKey });
  for (const r of input.reports)
    for (const f of r.findings)
      if (!f.negated && f.status !== 'normal' && r.date) timeline.push({ date: r.date, type: 'imaging-report', source: f.source, label: f.text, organs: f.location?.structure ? [f.location.structure] : [], status: f.status, confidence: f.confidence, ...(r.documentId ? { ref: r.documentId } : {}) });
  for (const i of input.images)
    for (const o of i.run.result.observations)
      if (i.date && o.kind !== 'quality' && o.kind !== 'structure-presence') timeline.push({ date: i.date, type: 'image-analysis', source: 'IMAGE_ANALYSIS', label: o.text, organs: o.location?.structure ? [o.location.structure] : [], status: 'uncertain', confidence: o.confidence, ...(i.documentId ? { ref: i.documentId } : {}) });
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  steps.push({ step: 'merge_available_evidence', ran: true, detail: `Kaynaklar ayrı tutularak birleştirildi: ${organs.size} organ/yapı, ${patterns.length} örüntü, ${timeline.length} zaman olayı.` });

  const statements: string[] = [];
  if (available.image && !available.report) statements.push('Rapor yok: görüntüyle ilgili sonuçlar yalnızca görüntünün kendisine dayanıyor.');
  if (!available.image && available.report) statements.push('Ham görüntü yok: görüntüleme bilgisi yalnızca rapordan geliyor.');
  if (!available.lab) statements.push('Laboratuvar sonucu yok: organ durumları laboratuvar verisi olmadan değerlendirildi.');
  if (!available.image && !available.report && !available.lab) statements.push('Henüz analiz edilecek veri yok.');

  return { available, steps, imageObservations, reportFindings, latestLabs, trends, concordance, patterns, organs, timeline, comparisons, statements };
}
