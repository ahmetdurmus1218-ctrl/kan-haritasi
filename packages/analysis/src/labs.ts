/**
 * Laboratuvar referans aralığı önceliği:
 *   1. Raporun kendi referans aralığı  2. Laboratuvarın verdiği aralık  3. Demografik (yaş/cinsiyet)  4. Sistem aralığı
 * Raporda aralık varsa asla yok sayılıp sabit bir değerle değiştirilmez.
 */
import type { LabObservation, ReferenceSource } from './types';

export interface RangeCandidate {
  min?: number;
  max?: number;
}

export const REFERENCE_PRIORITY: readonly ReferenceSource[] = ['report', 'laboratory', 'demographic', 'system'];

export function resolveReference(c: Partial<Record<ReferenceSource, RangeCandidate | undefined>>): (RangeCandidate & { source: ReferenceSource }) | undefined {
  for (const s of REFERENCE_PRIORITY) {
    const r = c[s];
    if (r && (r.min !== undefined || r.max !== undefined)) return { ...r, source: s };
  }
  return undefined;
}

export function statusAgainst(value: number, r: RangeCandidate | undefined): LabObservation['status'] {
  if (!r || (r.min === undefined && r.max === undefined)) return 'unknown';
  if (r.max !== undefined && value > r.max) return 'high';
  if (r.min !== undefined && value < r.min) return 'low';
  return 'normal';
}

/** Test başına en güncel sonuç (tarih eşitse listedeki son). */
export function latestByTest(labs: readonly LabObservation[]): LabObservation[] {
  const m = new Map<string, LabObservation>();
  for (const l of labs) {
    const p = m.get(l.testKey);
    if (!p || l.date >= p.date) m.set(l.testKey, l);
  }
  return [...m.values()];
}
