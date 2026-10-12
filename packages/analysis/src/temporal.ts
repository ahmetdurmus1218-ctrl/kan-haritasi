/**
 * Eski ↔ yeni çalışma karşılaştırması. Görüntü çakıştırma (registration) ve segmentasyon bu kurulumda
 * yoktur: eşleştirme yalnızca anatomik konum etiketiyle (yapı, bölüm, taraf) yapılır ve sonuçta bu
 * açıkça yazılır. Ölçü değişimi yalnızca iki çalışmada da ölçü yazıyorsa hesaplanır.
 */
import type { EvidenceSource, ImageObservation, ReportFinding } from './types';

export interface StudyItem {
  key: string;
  label: string;
  source: EvidenceSource;
  status: 'abnormal' | 'uncertain' | 'normal';
  sizeMm?: number;
  temporal?: ReportFinding['temporal'];
}

export interface StudySnapshot {
  date: string;
  modality: string;
  structure?: string;
  items: StudyItem[];
}

export type ChangeKind = 'new' | 'resolved' | 'persisting' | 'growing' | 'shrinking' | 'stable-size' | 'report-states';

export interface StudyChange {
  key: string;
  label: string;
  change: ChangeKind;
  detail: string;
  source: EvidenceSource;
}

export interface StudyComparison {
  previous: { date: string; modality: string };
  current: { date: string; modality: string };
  changes: StudyChange[];
  reliability: string[];
}

/** "12 × 8 mm", "1,2 cm" → en büyük boyut (mm). */
export function parseSizeMm(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /(\d+(?:[.,]\d+)?(?:\s*[x×*]\s*\d+(?:[.,]\d+)?){0,2})\s*(mm|cm)\b/i.exec(text);
  if (!m) return undefined;
  const nums = m[1]!.split(/\s*[x×*]\s*/).map((n) => Number(n.replace(',', '.')));
  const k = m[2]!.toLowerCase() === 'cm' ? 10 : 1;
  return Math.max(...nums) * k;
}

export function itemFromReport(f: ReportFinding): StudyItem | null {
  if (f.negated || !f.location?.structure) return null;
  const key = [f.location.structure, f.location.part ?? '-', f.location.side ?? '-'].join('|');
  const size = parseSizeMm(f.size ?? f.text);
  return { key, label: f.text, source: f.source, status: f.status, ...(size !== undefined ? { sizeMm: size } : {}), ...(f.temporal ? { temporal: f.temporal } : {}) };
}

export function itemFromObservation(o: ImageObservation): StudyItem | null {
  if (o.kind !== 'asymmetry' || !o.location?.structure) return null;
  return { key: ['img', o.location.structure, o.location.part ?? '-', o.location.side ?? '-'].join('|'), label: o.text, source: 'IMAGE_ANALYSIS', status: 'uncertain' };
}

export function compareStudies(previous: StudySnapshot, current: StudySnapshot): StudyComparison {
  const changes: StudyChange[] = [];
  const prevAbn = previous.items.filter((i) => i.status !== 'normal');
  const curAbn = current.items.filter((i) => i.status !== 'normal');
  for (const c of curAbn) {
    const p = prevAbn.find((x) => x.key === c.key);
    if (!p) {
      changes.push({ key: c.key, label: c.label, change: 'new', detail: 'Önceki çalışmada aynı konumda kayıtlı bulgu/gözlem yok.', source: c.source });
      continue;
    }
    if (c.sizeMm !== undefined && p.sizeMm !== undefined) {
      const d = c.sizeMm - p.sizeMm;
      const pct = p.sizeMm ? (d / p.sizeMm) * 100 : 0;
      const kind: ChangeKind = Math.abs(pct) < 10 ? 'stable-size' : d > 0 ? 'growing' : 'shrinking';
      changes.push({ key: c.key, label: c.label, change: kind, detail: `${p.sizeMm} mm → ${c.sizeMm} mm (${d > 0 ? '+' : ''}${Math.round(pct)}%). Ölçüler raporlardan alındı; farklı kesit/yöntem farkı etkileyebilir.`, source: c.source });
    } else {
      changes.push({ key: c.key, label: c.label, change: 'persisting', detail: 'Önceki çalışmada da aynı konumda kayıtlı; boyut karşılaştırması için iki raporda da ölçü gerekir.', source: c.source });
    }
  }
  for (const p of prevAbn) if (!curAbn.some((c) => c.key === p.key)) changes.push({ key: p.key, label: p.label, change: 'resolved', detail: 'Yeni çalışmada aynı konumda kayıtlı bulgu yok (görülmemesi kaybolduğunu kanıtlamaz; farklı kesit/protokol olabilir).', source: p.source });
  for (const c of current.items) if (c.temporal) changes.push({ key: c.key, label: c.label, change: 'report-states', detail: `Rapor karşılaştırma ifadesi: ${{ new: 'yeni', stable: 'stabil', increased: 'artmış', decreased: 'azalmış', resolved: 'kaybolmuş' }[c.temporal]}.`, source: c.source });
  return {
    previous: { date: previous.date, modality: previous.modality },
    current: { date: current.date, modality: current.modality },
    changes,
    reliability: [
      'Görüntü çakıştırma (registration) yapılmadı: eski ve yeni bulgular yalnızca anatomik konum etiketiyle eşleştirildi.',
      'Otomatik segmentasyon yok: boyut değişimi yalnızca raporlarda yazan ölçülerden hesaplanır.',
      ...(previous.modality !== current.modality ? ['İki çalışma farklı yöntemle çekilmiş; karşılaştırma sınırlıdır.'] : []),
    ],
  };
}
