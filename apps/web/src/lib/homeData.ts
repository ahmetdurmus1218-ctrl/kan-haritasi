/**
 * Ana ekranın verileri. Hepsi mevcut analiz motorunun gerçek çıktısından türetilir:
 *  - Etkilenen organlar: `bodySummary` organları (belirgin sapma, örüntü, rapor/AI bulgusu) + hafif sapmalı
 *    tahlillerin BİRİNCİL organı (bilgi grafiği). Tek organa özgü olmayan testler hiçbir organa yazılmaz.
 *  - 3B vurgular: keşif ekranıyla aynı kaynak (tahlil, görüntüleme ölçümü, rapor bulgusu).
 *  - Sonuç durumu: son tahlil sonuçlarının kaçı raporun referans aralığında — bir SAĞLIK PUANI DEĞİLDİR;
 *    yaşam süresi, risk ya da tanı tahmini üretilmez.
 */
import { useEffect, useMemo, useState } from 'react';
import { GRAPH, type HealthModel } from '@kh/analysis';
import { type Sex, type SystemId, structureById, systemById, testByKey } from '@kh/catalog';
import { useUnlockedVault } from '../state/VaultContext';
import { loadSex } from './reports';
import { buildSeries, useReports } from './useReports';
import { severityWeights, useInterpretation } from './interpretation';
import { useImagingStudies } from './imagingStudies';
import { type StructureHighlight, highlightsFrom, withFindingHighlights, withImagingHighlights } from '../anatomy/highlight';
import { type BodySummary, organName, primaryOrgan } from './summary';
import { type Tone, TONE_RANK, labTone } from './tone';

export type OrganTone = 'urgent' | 'attention' | 'follow' | 'uncertain';

export interface AffectedOrgan {
  /** Bilgi grafiği düğümü (organ sayfası). */
  organ: string;
  /** 3B modeldeki yapı (yoksa 3B'de gösterilemez, organ sayfası açılır). */
  structure?: string;
  name: string;
  tone: OrganTone;
  reasons: string[];
}

/** Kart ve 3B etiketindeki durum ifadesi (tanı değil). */
export const ORGAN_STATUS: Record<OrganTone, string> = {
  urgent: 'Acil değerlendirme',
  attention: 'Dikkat gerekli',
  follow: 'İzlem önerilir',
  uncertain: 'Belirsiz bulgu',
};

/** Organ düğümünün 3B yapısı. */
export function structureOfOrgan(organ: string): string | undefined {
  const s = GRAPH.node(organ)?.structure;
  if (s && structureById.has(s)) return s;
  return structureById.has(organ) ? organ : undefined;
}

/** 3B yapının organ düğümü (yapıya tıklanınca hangi organ kartı seçilir). */
export function organOfStructure(structure: string): string {
  return GRAPH.nodeForStructure(structure)?.id ?? structure;
}

export function affectedOrgans(summary: BodySummary, model: HealthModel): AffectedOrgan[] {
  const map = new Map<string, AffectedOrgan>();
  for (const o of summary.organs) map.set(o.organ, { organ: o.organ, structure: structureOfOrgan(o.organ), name: organName(o.organ), tone: o.tone, reasons: [...o.reasons] });
  // Hafif sapma (takip): yalnızca birincil organı olan testler; organ zaten listedeyse nedeni eklenir.
  for (const l of model.latestLabs) {
    if (labTone(l) !== 'follow') continue;
    const organ = primaryOrgan(l.testKey);
    if (!organ) continue;
    const reason = `${l.name} hafif ${l.status === 'high' ? 'yüksek' : 'düşük'}`;
    const cur = map.get(organ);
    if (cur) {
      if (!cur.reasons.includes(reason)) cur.reasons.push(reason);
    } else map.set(organ, { organ, structure: structureOfOrgan(organ), name: organName(organ), tone: 'follow', reasons: [reason] });
  }
  return [...map.values()].sort((a, b) => TONE_RANK[b.tone as Tone] - TONE_RANK[a.tone as Tone] || b.reasons.length - a.reasons.length);
}

export interface SystemStat {
  id: SystemId;
  name: string;
  color: string;
  total: number;
  inRange: number;
}

export interface ResultStats {
  total: number;
  inRange: number;
  /** Referans aralığı dışında olup belirgin/kritik olanlar (yalnız sayım). */
  flagged: number;
  systems: SystemStat[];
  latestDate?: string;
}

/**
 * Son tahlil sonuçlarının referans aralığıyla karşılaştırılması. Durumu bilinmeyen (aralıksız) sonuçlar
 * sayılmaz. Sistem kırılımı testin katalogdaki ilk sistemine göredir.
 */
export function resultStats(model: HealthModel): ResultStats | null {
  const labs = model.latestLabs.filter((l) => l.status !== 'unknown');
  if (!labs.length) return null;
  const sys = new Map<SystemId, SystemStat>();
  let inRange = 0;
  let flagged = 0;
  let latest: string | undefined;
  for (const l of labs) {
    const ok = l.status === 'normal';
    if (ok) inRange++;
    const t = labTone(l);
    if (t === 'attention' || t === 'urgent') flagged++;
    if (!latest || l.date > latest) latest = l.date;
    const sid = testByKey.get(l.testKey)?.systems[0];
    if (!sid) continue;
    const def = systemById.get(sid);
    const s = sys.get(sid) ?? sys.set(sid, { id: sid, name: def?.nameTr ?? sid, color: def?.color ?? '#22d3ee', total: 0, inRange: 0 }).get(sid)!;
    s.total++;
    if (ok) s.inRange++;
  }
  return { total: labs.length, inRange, flagged, systems: [...sys.values()].sort((a, b) => b.total - a.total), ...(latest ? { latestDate: latest } : {}) };
}

/** Profil cinsiyeti (yorum ve erkek/kadın vücut seçimi için). */
export function useSex(): Sex {
  const vault = useUnlockedVault();
  const [sex, setSex] = useState<Sex>('unspecified');
  useEffect(() => {
    loadSex(vault).then(setSex, () => undefined);
  }, [vault]);
  return sex;
}

/** 3B vücuttaki vurgular: keşif ekranının genel görünümüyle aynı kaynaklar. */
export function useBodyHighlights(sex: Sex): Map<string, StructureHighlight> {
  const { reports } = useReports();
  const series = useMemo(() => (reports ? buildSeries(reports) : []), [reports]);
  const interp = useInterpretation(series, sex);
  const studies = useImagingStudies();
  const weights = useMemo(() => severityWeights(interp), [interp]);
  return useMemo(() => {
    const base = highlightsFrom(series, undefined, weights);
    if (!studies) return base;
    const withMeasures = withImagingHighlights(base, studies.flatMap((st) => st.abnormal));
    return withFindingHighlights(withMeasures, studies.flatMap((st) => st.findings.map((f) => ({ ...f, fileId: st.head.id }))));
  }, [series, weights, studies]);
}
