/**
 * Ekranlar için kısa özetler: "Vücudum nasıl?" sayıları ve "Ne değişti?" listesi. Ayrıntı yerine önce
 * özet; her öğe tıklanınca ilgili ayrıntı sayfasına gider.
 */
import type { HealthModel } from '@kh/analysis';
import { structureById, testByKey } from '@kh/catalog';
import type { Route } from '../state/router';
import type { ImagingStudy } from './imagingStudies';
import { CATEGORY_SHORT, regionByKey } from './imaging';
import { labTone } from './tone';
import { GRAPH } from '@kh/analysis';

export interface SummaryItem {
  label: string;
  detail?: string;
  tone: 'normal' | 'follow' | 'attention' | 'urgent';
  route: Route;
}

export interface OrganAttention {
  organ: string;
  tone: 'follow' | 'attention' | 'urgent';
  /** Kısa nedenler (ör. "Kreatinin yüksek", "Böbrek süzme örüntüsü", "1 görüntüleme bulgusu"). */
  reasons: string[];
}

export interface BodySummary {
  /** Kritik düzeydeki sonuçlar. */
  urgent: SummaryItem[];
  /** Dikkat çeken organlar (önem sırasıyla): belirgin sapma, örüntü, rapordaki bulgu, görüntü gözlemi. */
  organs: OrganAttention[];
  /** Hafif sapma: takip edilebilir değerler. */
  follow: SummaryItem[];
  hasData: boolean;
}

/** Testin birincil organı (bilgi grafiği öncelikli); tek organa özgü olmayan testlerde yok. */
export function primaryOrgan(testKey: string): string | undefined {
  const t = testByKey.get(testKey);
  if (t?.nonSpecific) return undefined;
  return GRAPH.organsForTest(testKey)[0]?.id ?? t?.structures[0];
}

export const organName = (id: string) => GRAPH.node(id)?.nameTr ?? structureById.get(id)?.nameTr ?? id;

const RANK = { follow: 1, attention: 2, urgent: 3 } as const;

export function bodySummary(model: HealthModel): BodySummary {
  const urgent: SummaryItem[] = [];
  const follow: SummaryItem[] = [];
  const organs = new Map<string, OrganAttention>();
  const add = (organ: string, tone: OrganAttention['tone'], reason: string) => {
    const o = organs.get(organ) ?? organs.set(organ, { organ, tone, reasons: [] }).get(organ)!;
    if (RANK[tone] > RANK[o.tone]) o.tone = tone;
    if (!o.reasons.includes(reason)) o.reasons.push(reason);
  };
  // Özet sayılar şişmesin: her tahlil yalnızca BİRİNCİL organına sayılır; tek organa özgü olmayan testler
  // (CRP, lökosit, ferritin…) hiçbir organa yazılmaz. Organ sayfası ise ilişkili tüm testleri gösterir.
  for (const l of model.latestLabs) {
    const t = labTone(l);
    const organ = primaryOrgan(l.testKey);
    if (organ && (t === 'attention' || t === 'urgent')) add(organ, t, `${l.name} ${l.status === 'high' ? 'yüksek' : 'düşük'}`);
  }
  for (const [id, st] of model.organs) {
    for (const p of st.patterns) add(id, 'attention', p.title);
    const rep = st.reportFindings.filter((f) => !f.negated && f.status === 'abnormal').length;
    if (rep) add(id, 'attention', `${rep} rapor bulgusu`);
    const img = st.imageObservations.filter((o) => o.kind === 'asymmetry').length;
    if (img) add(id, 'attention', `${img} görüntü gözlemi`);
  }
  for (const l of model.latestLabs) {
    const t = labTone(l);
    const item: SummaryItem = { label: `${l.name} ${l.status === 'high' ? 'yüksek' : 'düşük'}`, detail: `${l.value.toLocaleString('tr-TR')} ${l.unit}`, tone: t, route: { name: 'result', key: l.testKey } };
    if (t === 'urgent') urgent.push(item);
    else if (t === 'follow') follow.push(item);
  }
  return {
    urgent,
    follow,
    organs: [...organs.values()].sort((a, b) => RANK[b.tone] - RANK[a.tone] || b.reasons.length - a.reasons.length),
    hasData: model.latestLabs.length + model.reportFindings.length + model.imageObservations.length > 0,
  };
}

export interface ChangeItem {
  icon: '↑' | '↓' | '=' | '+';
  label: string;
  date: string;
  route: Route;
}

/** "Ne değişti?": eğilimler, eski↔yeni görüntüleme, son eklenen çalışmalar (en yeni önce). */
export function whatChanged(model: HealthModel, studies: ImagingStudy[] = [], limit = 5): ChangeItem[] {
  const out: ChangeItem[] = [];
  for (const [key, t] of model.trends) {
    if (!t.last || t.direction === 'insufficient') continue;
    const name = model.latestLabs.find((l) => l.testKey === key)?.name ?? key;
    out.push({ icon: t.direction === 'rising' ? '↑' : t.direction === 'falling' ? '↓' : '=', label: `${name} ${t.direction === 'rising' ? 'artmış' : t.direction === 'falling' ? 'azalmış' : 'stabil'}`, date: t.last.date, route: { name: 'timeline', key } });
  }
  for (const c of model.comparisons) {
    const grow = c.changes.filter((x) => x.change === 'growing' || x.change === 'new').length;
    out.push({ icon: grow ? '↑' : '=', label: grow ? `${c.current.modality === 'MRI' ? 'MR' : c.current.modality} bulgusunda değişiklik (${grow})` : `${c.current.modality === 'MRI' ? 'MR' : c.current.modality} bulguları stabil görünüyor`, date: c.current.date, route: { name: 'mybody' } });
  }
  for (const st of [...studies].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)) {
    const region = st.region ? regionByKey.get(st.region)?.label : undefined;
    out.push({ icon: '+', label: `Yeni ${CATEGORY_SHORT[st.category]}${region ? ` · ${region}` : ''}`, date: st.date, route: { name: 'document', id: st.head.id } });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
