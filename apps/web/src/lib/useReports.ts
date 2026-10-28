import { useEffect, useState } from 'react';
import { type LabTestDef, normalizeText, testByKey } from '@kh/catalog';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type StoredOther, type StoredReport, type StoredResult, listReports } from './reports';

export interface ResultPoint {
  result: StoredResult;
  report: StoredReport;
  /** Raporun tarihi, yoksa kayıt tarihi (ISO). */
  date: string;
}

export interface TestSeries {
  test: LabTestDef;
  points: ResultPoint[];
  latest: ResultPoint;
  previous?: ResultPoint;
}

export function reportDate(r: StoredReport): string {
  return r.reportDate ?? r.createdAt.slice(0, 10);
}

/** Tüm raporlardan test başına zaman sıralı seri çıkarır (en yenisi `latest`). */
export function buildSeries(reports: StoredReport[]): TestSeries[] {
  const map = new Map<string, ResultPoint[]>();
  for (const report of reports) {
    for (const result of report.results) {
      const list = map.get(result.testKey) ?? [];
      list.push({ result, report, date: reportDate(report) });
      map.set(result.testKey, list);
    }
  }
  const out: TestSeries[] = [];
  for (const [key, points] of map) {
    const test = testByKey.get(key);
    if (!test) continue;
    points.sort((a, b) => a.date.localeCompare(b.date) || a.report.createdAt.localeCompare(b.report.createdAt));
    const latest = points[points.length - 1];
    if (!latest) continue;
    out.push({ test, points, latest, previous: points[points.length - 2] });
  }
  return out;
}

export interface OtherPoint {
  result: StoredOther;
  report: StoredReport;
  date: string;
}

/** Katalogda olmayan testler: rapordaki adına göre, en yeni sonuç. */
export function buildOthers(reports: StoredReport[]): OtherPoint[] {
  const latest = new Map<string, OtherPoint>();
  for (const report of reports) {
    for (const result of report.others ?? []) {
      const key = normalizeText(result.rawName);
      const point = { result, report, date: reportDate(report) };
      const prev = latest.get(key);
      if (!prev || point.date > prev.date || (point.date === prev.date && report.createdAt > prev.report.createdAt)) latest.set(key, point);
    }
  }
  return [...latest.values()].sort((a, b) => a.result.rawName.localeCompare(b.result.rawName, 'tr'));
}

/** Kilit açıkken tüm onaylanmış raporları yükler; kasa değişince yenilenir. */
export function useReports(): { reports: StoredReport[] | null; error: boolean } {
  const vault = useUnlockedVault();
  const { revision } = useVault();
  const [reports, setReports] = useState<StoredReport[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listReports(vault).then(
      (r) => !cancelled && (setReports(r), setError(false)),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [vault, revision]);
  return { reports, error };
}
