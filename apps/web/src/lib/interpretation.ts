import { useEffect, useMemo, useState } from 'react';
import {
  type Finding,
  type Interpretation,
  type LabInput,
  type Pattern,
  type PatternLevel,
  type Severity,
  type Sex,
  SEVERITY_WEIGHT,
  interpret,
} from '@kh/catalog';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { loadSex } from './reports';
import type { TestSeries } from './useReports';

/**
 * Onaylı son sonuçları yorum motorunun girdisine çevirir. Değer ve aralık, birimi dönüştürülebildiyse
 * kanonik birimde (raporun aralığı kayıt sırasında dönüştürülür), değilse rapordaki haliyle verilir.
 */
export function labInputs(series: TestSeries[]): LabInput[] {
  return series.map((s) => {
    const r = s.latest.result;
    const canonical = r.canonicalValue !== null;
    return {
      testKey: r.testKey,
      value: canonical ? r.canonicalValue! : r.value,
      canonical,
      unit: canonical ? s.test.unit : r.unit,
      refMin: r.refMin,
      refMax: r.refMax,
      refText: r.refText,
      status: r.status,
      qualifier: r.qualifier,
      date: s.latest.date,
    };
  });
}

export function interpretSeries(series: TestSeries[], sex: Sex): Interpretation {
  return interpret(labInputs(series), sex);
}

/** Kasadaki profil cinsiyeti (kılavuz kategorileri ve genel aralıklar için). */
export function useSex(): Sex {
  const vault = useUnlockedVault();
  const { revision } = useVault();
  const [sex, setSex] = useState<Sex>('unspecified');
  useEffect(() => {
    let cancelled = false;
    loadSex(vault).then(
      (s) => !cancelled && setSex(s),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [vault, revision]);
  return sex;
}

export function useInterpretation(series: TestSeries[], sex: Sex): Interpretation {
  return useMemo(() => interpretSeries(series, sex), [series, sex]);
}

/** testKey → bulgu */
export function findingMap(interp: Interpretation): Map<string, Finding> {
  return new Map(interp.findings.map((f) => [f.testKey, f]));
}

/** testKey → derece ağırlığı (0–3); yalnızca aralık dışı sonuçlar. */
export function severityWeights(interp: Interpretation): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of interp.findings) if (f.status === 'high' || f.status === 'low') m.set(f.testKey, Math.max(1, SEVERITY_WEIGHT[f.severity]));
  return m;
}

export const LEVEL_ORDER: Record<PatternLevel, number> = { urgent: 0, attention: 1, info: 2 };

export function sortPatterns(ps: Pattern[]): Pattern[] {
  return [...ps].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

export const LEVEL_LABEL: Record<PatternLevel, string> = {
  urgent: 'Hızlı değerlendirme',
  attention: 'Hekimle konuş',
  info: 'Bilgi',
};

/** Arayüz renkleri (koyu zemin). */
export const LEVEL_COLOR: Record<PatternLevel, string> = {
  urgent: '#ff5d5d',
  attention: '#f5b14c',
  info: '#6aa8ff',
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  normal: '#37d6c4',
  borderline: '#b9d66a',
  mild: '#f5c96a',
  moderate: '#f59a3c',
  marked: '#ef5a4c',
  unknown: '#7b8494',
};

/** "Orta derecede yüksek" gibi kısa ifade. */
export function severityPhrase(f: Pick<Finding, 'severity' | 'status'>): string {
  if (f.status === 'normal') return f.severity === 'borderline' ? 'Aralıkta, sınıra yakın' : 'Aralıkta';
  if (f.status === 'unknown') return f.severity === 'unknown' ? 'Aralık yok' : 'Genel eşiklere göre dikkat';
  const dir = f.status === 'high' ? 'yüksek' : 'düşük';
  if (f.severity === 'marked') return `Belirgin ${dir}`;
  if (f.severity === 'moderate') return `Orta derecede ${dir}`;
  return `Hafif ${dir}`;
}
