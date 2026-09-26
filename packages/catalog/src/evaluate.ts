import type { LabTestDef, RangeDef } from './tests';
import { convert } from './units';

export type ResultStatus = 'low' | 'normal' | 'high' | 'unknown';

export interface RangeValue {
  min?: number;
  max?: number;
  /** "<200" gibi: sınırın kendisi aralık dışıdır. */
  minExclusive?: boolean;
  maxExclusive?: boolean;
  source: 'report' | 'catalog' | 'none';
  text?: string;
}

export type Sex = 'female' | 'male' | 'unspecified';

/** Değer "<0,5" gibi bir sınırla verildiyse bu yön bilgisi durum hesabında kullanılır. */
export function statusFor(value: number, range: RangeValue, qualifier?: '<' | '>' | '<=' | '>='): ResultStatus {
  if (range.min === undefined && range.max === undefined) return 'unknown';
  const below = (limit: number, exclusive?: boolean) => {
    if (qualifier === '<' || qualifier === '<=') return value <= limit;
    return exclusive ? value <= limit : value < limit;
  };
  const above = (limit: number, exclusive?: boolean) => {
    if (qualifier === '>' || qualifier === '>=') return value >= limit;
    if (qualifier === '<' || qualifier === '<=') return false;
    return exclusive ? value >= limit : value > limit;
  };
  if (range.min !== undefined && below(range.min, range.minExclusive)) return 'low';
  if (range.max !== undefined && above(range.max, range.maxExclusive)) return 'high';
  return 'normal';
}

/** Rapor aralığı yoksa kullanılacak genel aralık. Cinsiyet bilinmiyorsa cinsiyete özgü aralıkların birleşimi. */
export function catalogRange(test: LabTestDef, sex: Sex): RangeValue {
  const generic = test.ranges.find((r) => !r.sex);
  const specific = sex !== 'unspecified' ? test.ranges.find((r) => r.sex === sex) : undefined;
  let r: RangeDef | undefined = specific ?? generic;
  if (!r) {
    const sexed = test.ranges.filter((x) => x.sex);
    if (sexed.length === 0) return { source: 'none' };
    const mins = sexed.map((x) => x.min).filter((v): v is number => v !== undefined);
    const maxs = sexed.map((x) => x.max).filter((v): v is number => v !== undefined);
    r = { min: mins.length ? Math.min(...mins) : undefined, max: maxs.length ? Math.max(...maxs) : undefined };
  }
  return { min: r.min, max: r.max, source: 'catalog', text: rangeText(r.min, r.max, test.decimals) };
}

export function toCanonical(test: LabTestDef, value: number, unitKey: string | null): number | null {
  if (!unitKey) return null;
  const conv = test.conversions[unitKey];
  return conv ? convert(value, conv) : null;
}

/** Aralığı rapor biriminden kanonik birime çevirir. */
export function convertRange(test: LabTestDef, range: RangeValue, unitKey: string | null): RangeValue {
  if (range.source !== 'report' || !unitKey) return range;
  const conv = test.conversions[unitKey];
  if (!conv) return range;
  return {
    ...range,
    min: range.min !== undefined ? convert(range.min, conv) : undefined,
    max: range.max !== undefined ? convert(range.max, conv) : undefined,
  };
}

export function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function rangeText(min: number | undefined, max: number | undefined, decimals = 2): string {
  const f = (v: number) => formatNumber(v, decimals);
  if (min !== undefined && max !== undefined) return `${f(min)} – ${f(max)}`;
  if (max !== undefined) return `< ${f(max)}`;
  if (min !== undefined) return `> ${f(min)}`;
  return '';
}

export const STATUS_LABEL: Record<ResultStatus, string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  unknown: 'Belirsiz',
};
