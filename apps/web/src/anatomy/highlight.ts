import { type ResultStatus, testByKey } from '@kh/catalog';
import type { TestSeries } from '../lib/useReports';

export interface StructureHighlight {
  status: 'high' | 'low' | 'mixed';
  /** En ağır ilişkili sapmanın derecesi: 1 hafif, 2 orta, 3 belirgin. */
  score: number;
  tests: Array<{ key: string; status: ResultStatus; score: number }>;
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
