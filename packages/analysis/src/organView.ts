/**
 * Organ sayfasının içeriği: "Bu organ normalde ne yapar?" ile "Bende ne var?" ayrı ayrı, sonra fark,
 * ilişkiler, zaman ve belirsizlik. Ayrıca bir bulgu ya da sonuç için "Neden?" zinciri.
 */
import { type KNode, type KnowledgeGraph, GRAPH } from './knowledge';
import type { HealthModel, OrganState } from './fusion';
import type { PatternResult } from './patterns';
import type { Trend } from './trend';
import { type AnatomicalLocation, type EvidenceSource, type ImageObservation, type LabObservation, type ReportFinding, SOURCE_LABEL, isPositiveReport } from './types';

export interface ChainOverlay {
  chain: KNode[];
  /** Zincirdeki biyobelirteç düğümlerine kişinin verisi. */
  overlay: Array<{ nodeId: string; status: LabObservation['status']; text: string }>;
}

export interface DiffItem {
  label: string;
  detail: string;
  source: EvidenceSource;
  direction?: 'high' | 'low' | 'abnormal' | 'uncertain';
}

export interface OrganView {
  node: KNode;
  path: KNode[];
  systems: KNode[];
  normal: { summary: string; parts: KNode[]; functions: KNode[]; physiology: KNode[][]; biomarkers: KNode[] };
  personal: { labs: LabObservation[]; reportFindings: ReportFinding[]; imageObservations: ImageObservation[]; patterns: PatternResult[]; hasData: boolean };
  difference: DiffItem[];
  relations: ChainOverlay[];
  time: Array<{ testKey: string; name: string; trend: Trend }>;
  uncertainty: { certain: string[]; probabilistic: string[]; missing: string[] };
}

const EMPTY: OrganState = { organ: '', imageObservations: [], reportFindings: [], labs: [], patterns: [], attention: false };

export function buildOrganView(organId: string, model: HealthModel | null, graph: KnowledgeGraph = GRAPH): OrganView | null {
  const node = graph.node(organId);
  if (!node) return null;
  const state = model?.organs.get(node.structure ?? organId) ?? model?.organs.get(organId) ?? EMPTY;
  const biomarkers = graph.biomarkersFor(organId, 5);
  const labByKey = new Map(state.labs.map((l) => [l.testKey, l]));
  const relations: ChainOverlay[] = graph.chains(organId, 6, 10).map((chain) => ({
    chain,
    overlay: chain
      .map((n) => {
        const ms = graph.edgesFrom(n.id, 'measured_by').map((e) => graph.node(e.to)!);
        const markers = n.kind === 'biomarker' ? [n] : ms;
        return markers.flatMap((m) => {
          const l = m.testKey ? labByKey.get(m.testKey) ?? model?.latestLabs.find((x) => x.testKey === m.testKey) : undefined;
          return l ? [{ nodeId: n.id, status: l.status, text: `${l.name} ${l.value.toLocaleString('tr-TR')} ${l.unit} (${STATUS_TR[l.status]})` }] : [];
        });
      })
      .flat(),
  }));

  const difference: DiffItem[] = [
    ...state.labs.filter((l) => l.status === 'high' || l.status === 'low').map((l) => ({ label: `${l.name} ${l.status === 'high' ? 'yüksek' : 'düşük'}`, detail: `${l.value.toLocaleString('tr-TR')} ${l.unit}${l.refMin !== undefined || l.refMax !== undefined ? ` · referans ${l.refMin ?? '…'}–${l.refMax ?? '…'}` : ''} · ${l.date}`, source: 'LAB' as const, direction: l.status as 'high' | 'low' })),
    ...state.reportFindings.filter(isPositiveReport).map((f) => ({ label: f.status === 'uncertain' ? 'Raporda olasılık olarak yazılan' : 'Raporda dikkat çeken bulgu', detail: f.text, source: f.source, direction: f.status === 'uncertain' ? ('uncertain' as const) : ('abnormal' as const) })),
    ...state.imageObservations.filter((o) => o.kind === 'asymmetry' || o.kind === 'heart-rate' || o.kind === 'rhythm').map((o) => ({ label: 'Görüntü asimetrisi gözlemi (doğrulanmamış)', detail: o.text, source: 'IMAGE_ANALYSIS' as const, direction: 'uncertain' as const })),
  ];

  const time = state.labs.flatMap((l) => {
    const t = model?.trends.get(l.testKey);
    return t ? [{ testKey: l.testKey, name: l.name, trend: t }] : [];
  });

  const certain = [
    ...state.labs.map((l) => `${l.name}: ${l.value.toLocaleString('tr-TR')} ${l.unit} (ölçülmüş değer; ${SOURCE_LABEL.LAB.toLocaleLowerCase('tr')})`),
    ...state.reportFindings.filter((f) => f.status !== 'uncertain').map((f) => `Rapor: “${f.text}” (raporda yazan; sistem yorumu değil)`),
  ];
  const probabilistic = [
    ...state.imageObservations.map((o) => `${o.text} — güven ${o.confidence.kind === 'score' ? o.confidence.value.toFixed(2) : 'ölçüm'} (${o.model.name})`),
    ...state.reportFindings.filter((f) => f.status === 'uncertain').map((f) => `Raporun kendisi olasılık olarak yazıyor: “${f.text}”`),
    ...state.patterns.map((p) => `Örüntü: ${p.title} (kanıt tutarlılığı ${p.confidence.kind === 'score' ? p.confidence.value.toFixed(2) : '—'}; tanı değil)`),
  ];
  const have = new Set(state.labs.map((l) => l.testKey));
  const missing = [
    ...biomarkers.filter((b) => b.testKey && !have.has(b.testKey)).map((b) => `${b.nameTr} sonucu yok`),
    ...biomarkers.filter((b) => !b.testKey && b.note).map((b) => `${b.nameTr}: ${b.note}`),
    ...(state.reportFindings.length || state.imageObservations.length ? [] : ['Bu organa ait görüntüleme ya da rapor yok']),
  ];

  return {
    node,
    path: graph.pathTo(organId),
    systems: graph.systemsOf(organId),
    normal: { summary: node.summary, parts: graph.children(organId), functions: graph.functionsOf(organId), physiology: graph.chains(organId, 6, 6), biomarkers },
    personal: { labs: state.labs, reportFindings: state.reportFindings, imageObservations: state.imageObservations, patterns: state.patterns, hasData: state.labs.length + state.reportFindings.length + state.imageObservations.length > 0 },
    difference,
    relations,
    time,
    uncertainty: { certain, probabilistic, missing },
  };
}

const STATUS_TR = { low: 'düşük', normal: 'aralıkta', high: 'yüksek', unknown: 'aralık yok' } as const;

export interface WhyStep {
  title: string;
  items: string[];
}

/**
 * "Neden?" / "Bu neyi etkiler?" zinciri:
 *   Bulgu → etkilenen anatomi → normal işlevi → olası etkilenen süreçler → ilişkili organlar → ilişkili veriler
 */
export function explainWhy(location: AnatomicalLocation | undefined, model: HealthModel | null, graph: KnowledgeGraph = GRAPH, testKey?: string): WhyStep[] {
  const steps: WhyStep[] = [];
  const target = location?.path.length ? location.path[location.path.length - 1]! : location?.structure;
  const node = target ? graph.node(target) : undefined;
  const organId = location?.path[0] ?? location?.structure;
  if (node) {
    steps.push({ title: 'Etkilenen anatomi', items: [graph.pathTo(node.id, location?.path[location.path.length - 2]).map((n) => n.nameTr).join(' › ') + (location?.basis === 'pixel-mapped' || location?.basis === 'report-text' ? ' (yaklaşık konum)' : '')] });
    const fns = graph.functionsOf(node.id);
    steps.push({ title: 'Normalde ne yapar', items: [node.summary, ...fns.map((f) => `${f.nameTr}: ${f.summary}`)] });
    const chains = graph.chains(node.id, 5, 6).map((c) => c.map((n) => n.nameTr).join(' → '));
    steps.push({ title: 'Olası etkilenen süreçler', items: chains.length ? chains : ['Bu yapı için bilgi grafiğinde süreç zinciri tanımlı değil.'] });
  } else if (testKey) {
    const organs = graph.organsForTest(testKey);
    steps.push({ title: 'İlişkili organlar', items: organs.length ? organs.map((o) => o.nameTr) : ['Bu test tek bir organa bağlanmıyor.'] });
    for (const o of organs) steps.push({ title: `${o.nameTr}: süreç zinciri`, items: graph.chains(o.id, 5, 4).map((c) => c.map((n) => n.nameTr).join(' → ')) });
  }
  if (organId && model) {
    const st = model.organs.get(organId);
    const related = [
      ...(st?.labs ?? []).map((l) => `${l.name} ${l.value.toLocaleString('tr-TR')} ${l.unit} (${STATUS_TR[l.status]})`),
      ...(st?.reportFindings ?? []).filter(isPositiveReport).map((f) => `Rapor: ${f.text}`),
      ...(st?.patterns ?? []).map((p) => `Örüntü: ${p.title}`),
    ];
    steps.push({ title: 'Senin ilişkili verilerin', items: related.length ? related : ['Bu organla ilişkili başka verin yok.'] });
  }
  steps.push({ title: 'Sınırlar', items: ['Bu zincir genel fizyoloji bilgisidir; bulgunun sende bu süreçleri gerçekten etkilediğini göstermez. Değerlendirme hekime aittir.'] });
  return steps;
}
