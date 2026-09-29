import { type ResultStatus, testByKey } from '@kh/catalog';
import type { TestSeries } from '../lib/useReports';

export interface StructureHighlight {
  status: 'high' | 'low' | 'mixed';
  /** En ağır ilişkili sapmanın derecesi: 1 hafif, 2 orta, 3 belirgin. */
  score: number;
  /** `name`: tahlil dışı kaynaklar (ör. görüntüleme ölçümü "Dalak") için gösterilecek ad. */
  tests: Array<{ key: string; status: ResultStatus; score: number; name?: string }>;
}

/** Vurgu kaynağının kısa adı (tahlil ya da görüntüleme ölçümü). */
export function highlightName(t: { key: string; name?: string }): string {
  return t.name ?? testByKey.get(t.key)?.nameTr.split(' (')[0] ?? t.key;
}

/** Görüntüleme ölçümünün referanstan sapma derecesi: 1 hafif, 2 orta, 3 belirgin. */
export function measureScore(value: number, min?: number, max?: number): number {
  const bound = max !== undefined && value > max ? max : min !== undefined && value < min ? min : undefined;
  if (bound === undefined) return 1;
  const rel = Math.abs(value - bound) / Math.max(Math.abs(bound), 1e-6);
  return rel >= 0.3 ? 3 : rel >= 0.1 ? 2 : 1;
}

/**
 * Referans dışındaki görüntüleme ölçümlerini (ör. dalak 145 mm ▲) tahlil vurgularına ekler:
 * ilgili yapı 3B modelde tahlil sonuçları gibi renklenir.
 */
export function withImagingHighlights(
  base: Map<string, StructureHighlight>,
  measures: Array<{ def: { key: string; short: string; structure: string }; value: number; status: ResultStatus; range: { min?: number; max?: number } }>,
): Map<string, StructureHighlight> {
  if (!measures.length) return base;
  const map = new Map([...base].map(([k, v]) => [k, { ...v, tests: [...v.tests] }]));
  for (const m of measures) {
    if (m.status !== 'high' && m.status !== 'low') continue;
    const score = measureScore(m.value, m.range.min, m.range.max);
    const sid = m.def.structure;
    const h: StructureHighlight = map.get(sid) ?? { status: m.status, score: 0, tests: [] };
    if ((m.status === 'high' && h.status === 'low') || (m.status === 'low' && h.status === 'high')) h.status = 'mixed';
    h.score = Math.max(h.score, score);
    if (!h.tests.some((t) => t.key === `img:${m.def.key}`)) h.tests.push({ key: `img:${m.def.key}`, status: m.status, score, name: m.def.short });
    h.tests.sort((a, b) => b.score - a.score);
    map.set(sid, h);
  }
  return map;
}

/**
 * Son sonuçlardan yapı vurgularını çıkarır: aralık dışındaki her test, katalogdaki ilişkili
 * yapılarını işaretler. Bir yapıda hem yüksek hem düşük sonuç varsa "mixed".
 * `onlyTest` verilirse yalnızca o testin yapıları (Vücutta göster).
 */
export function highlightsFrom(series: TestSeries[], onlyTest?: string, weights?: Map<string, number>): Map<string, StructureHighlight> {
  const map = new Map<string, StructureHighlight>();
  for (const s of series) {
    if (onlyTest && s.test.key !== onlyTest) continue;
    const status = s.latest.result.status;
    if (!onlyTest && status !== 'high' && status !== 'low') continue;
    const test = testByKey.get(s.test.key);
    if (!test) continue;
    const score = status === 'high' || status === 'low' ? (weights?.get(test.key) ?? 1) : 1;
    for (const sid of test.structures) {
      const h: StructureHighlight = map.get(sid) ?? { status: status === 'low' ? 'low' : 'high', score: 0, tests: [] };
      if ((status === 'high' && h.status === 'low') || (status === 'low' && h.status === 'high')) h.status = 'mixed';
      h.score = Math.max(h.score, score);
      h.tests.push({ key: test.key, status, score });
      map.set(sid, h);
    }
  }
  // "Vücutta göster" normal bir sonuç için de yapıları gösterir (vurgu rengi normal).
  if (onlyTest && map.size === 0) {
    const test = testByKey.get(onlyTest);
    for (const sid of test?.structures ?? []) map.set(sid, { status: 'mixed', score: 1, tests: [{ key: onlyTest, status: 'unknown', score: 1 }] });
  }
  // Aynı yapıda en ağır sapma önce
  for (const h of map.values()) h.tests.sort((a, b) => b.score - a.score);
  return map;
}
