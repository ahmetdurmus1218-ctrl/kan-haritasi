import { type ResultStatus, testByKey } from '@kh/catalog';
import type { TestSeries } from '../lib/useReports';

export interface StructureHighlight {
  status: 'high' | 'low' | 'mixed';
  tests: Array<{ key: string; status: ResultStatus }>;
}

/**
 * Son sonuçlardan yapı vurgularını çıkarır: aralık dışındaki her test, katalogdaki ilişkili
 * yapılarını işaretler. Bir yapıda hem yüksek hem düşük sonuç varsa "mixed".
 * `onlyTest` verilirse yalnızca o testin yapıları (Vücutta göster).
 */
export function highlightsFrom(series: TestSeries[], onlyTest?: string): Map<string, StructureHighlight> {
  const map = new Map<string, StructureHighlight>();
  for (const s of series) {
    if (onlyTest && s.test.key !== onlyTest) continue;
    const status = s.latest.result.status;
    if (!onlyTest && status !== 'high' && status !== 'low') continue;
    const test = testByKey.get(s.test.key);
    if (!test) continue;
    for (const sid of test.structures) {
      const h = map.get(sid) ?? { status: status === 'low' ? 'low' : 'high', tests: [] };
      if ((status === 'high' && h.status === 'low') || (status === 'low' && h.status === 'high')) h.status = 'mixed';
      h.tests.push({ key: test.key, status });
      map.set(sid, h);
    }
  }
  // "Vücutta göster" normal bir sonuç için de yapıları gösterir (vurgu rengi normal).
  if (onlyTest && map.size === 0) {
    const test = testByKey.get(onlyTest);
    for (const sid of test?.structures ?? []) map.set(sid, { status: 'mixed', tests: [{ key: onlyTest, status: 'unknown' }] });
  }
  return map;
}
