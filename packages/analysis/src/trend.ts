/**
 * Eğilim (trend) motoru: tarih sıralı değerlerden değişim, yıllık eğim, yön ve referans aralığını
 * geçiş. Eğilim tek başına tanı koydurmaz; açıklama metni bunu söyler.
 */

export interface TrendPoint {
  /** YYYY-AA-GG */
  date: string;
  value: number;
  refMin?: number;
  refMax?: number;
}

export interface Trend {
  n: number;
  first?: TrendPoint;
  last?: TrendPoint;
  change?: number;
  changePct?: number;
  /** Doğrusal eğim (birim/yıl). */
  slopePerYear?: number;
  direction: 'rising' | 'falling' | 'stable' | 'insufficient';
  /** Her ölçüm bir öncekinden aynı yönde mi değişmiş? */
  monotonic: boolean;
  /** Referans aralığına göre son durum değişimi. */
  crossing?: 'became-high' | 'became-low' | 'returned-to-range';
  spanDays: number;
  statement: string;
  caution: string;
}

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
const fmt = (v: number, d = 2) => v.toLocaleString('tr-TR', { maximumFractionDigits: d });
const year = (d: string) => d.slice(0, 4);

function rangeState(p: TrendPoint): 'high' | 'low' | 'normal' | 'unknown' {
  if (p.refMax !== undefined && p.value > p.refMax) return 'high';
  if (p.refMin !== undefined && p.value < p.refMin) return 'low';
  return p.refMin !== undefined || p.refMax !== undefined ? 'normal' : 'unknown';
}

export const TREND_CAUTION = 'Eğilim tek başına tanı koydurmaz: ölçümler farklı laboratuvarlarda, farklı yöntemlerle ya da farklı koşullarda (açlık, saat, ilaç) yapılmış olabilir.';

export function computeTrend(points: TrendPoint[], name = 'Değer', stablePct = 5): Trend {
  const pts = points.filter((p) => Number.isFinite(p.value) && !Number.isNaN(t(p.date))).sort((a, b) => t(a.date) - t(b.date));
  if (pts.length < 2) return { n: pts.length, first: pts[0], last: pts[0], direction: 'insufficient', monotonic: false, spanDays: 0, statement: `${name} için eğilim çıkarmak üzere en az iki ölçüm gerekir.`, caution: TREND_CAUTION };
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const change = last.value - first.value;
  const changePct = first.value !== 0 ? (change / Math.abs(first.value)) * 100 : 0;
  // En küçük kareler eğimi (yıl)
  const xs = pts.map((p) => (t(p.date) - t(first.date)) / (365.25 * DAY));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = pts.reduce((a, p) => a + p.value, 0) / pts.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (pts[i]!.value - my);
    den += (x - mx) ** 2;
  });
  const slopePerYear = den > 0 ? num / den : 0;
  const steps = pts.slice(1).map((p, i) => Math.sign(p.value - pts[i]!.value));
  const monotonic = steps.every((s) => s === steps[0] && s !== 0);
  const direction: Trend['direction'] = Math.abs(changePct) < stablePct ? 'stable' : change > 0 ? 'rising' : 'falling';
  const a = rangeState(first);
  const b = rangeState(last);
  const crossing: Trend['crossing'] = a !== b && b !== 'unknown' && a !== 'unknown' ? (b === 'high' ? 'became-high' : b === 'low' ? 'became-low' : 'returned-to-range') : undefined;
  const series = pts.length <= 6 ? pts.map((p) => `${year(p.date)} → ${fmt(p.value)}`).join(', ') : `${year(first.date)} → ${fmt(first.value)} … ${year(last.date)} → ${fmt(last.value)}`;
  const dirTr = { rising: 'artmış', falling: 'azalmış', stable: 'belirgin değişmemiş', insufficient: '' }[direction];
  const statement =
    `${name}: ${series}. ${pts.length} ölçümde ${dirTr}` +
    (direction !== 'stable' ? ` (${change > 0 ? '+' : ''}${fmt(changePct, 1)}%, yılda ≈ ${slopePerYear > 0 ? '+' : ''}${fmt(slopePerYear)})` : '') +
    (monotonic && direction !== 'stable' ? '; her ölçüm bir öncekinden aynı yönde' : '') +
    '.' +
    (crossing === 'became-high' ? ' Son ölçüm referans aralığının üstüne çıkmış.' : crossing === 'became-low' ? ' Son ölçüm referans aralığının altına inmiş.' : crossing === 'returned-to-range' ? ' Son ölçüm referans aralığına dönmüş.' : '');
  return { n: pts.length, first, last, change, changePct, slopePerYear, direction, monotonic, ...(crossing ? { crossing } : {}), spanDays: Math.round((t(last.date) - t(first.date)) / DAY), statement, caution: TREND_CAUTION };
}
