import type { ReportDraft } from './types';

/** Bir okuma denemesinin puanı: okunan değer sayısı ve güven; sorunlu satırlar eksi. */
export function draftScore(d: ReportDraft): number {
  return d.rows.reduce((s, r) => s + 10 + r.confidence * 5 - r.issues.length * 3, 0) + d.missing.length * 2;
}

/**
 * Aynı görüntünün iki farklı OCR okumasını (ör. "tek blok" ve "otomatik" sayfa bölütleme) birleştirir.
 * - Puanı yüksek okuma esas alınır; yalnızca diğerinde bulunan testler eklenir.
 * - İki okumada da bulunan bir testin değeri farklıysa satır "OCR_DISAGREE" ile işaretlenir ve
 *   kullanıcı doğrulamadan kaydedilen değer sessizce kabul edilmez.
 * - Değerler aynıysa güven biraz artar (iki bağımsız okuma aynı sonucu verdi).
 */
export function mergeOcrDrafts(a: ReportDraft, b: ReportDraft): ReportDraft {
  const [base, other] = draftScore(a) >= draftScore(b) ? [a, b] : [b, a];
  const pool = new Map<string, ReportDraft['rows']>();
  for (const r of other.rows) pool.set(r.testKey, [...(pool.get(r.testKey) ?? []), r]);
  const rows = base.rows.map((r) => {
    const alts = pool.get(r.testKey);
    const o = alts?.shift();
    if (!o) return r;
    if (o.value === r.value && o.unitKey === r.unitKey) return { ...r, confidence: Math.min(1, r.confidence + 0.1) };
    return { ...r, issues: r.issues.includes('OCR_DISAGREE') ? r.issues : [...r.issues, 'OCR_DISAGREE' as const], confidence: Math.min(r.confidence, 0.5) };
  });
  const seen = new Set(base.rows.map((r) => r.testKey));
  for (const [key, left] of pool) if (!seen.has(key)) rows.push(...left);
  rows.sort((x, y) => x.source.page - y.source.page || x.source.y - y.source.y);
  const have = new Set(rows.map((r) => r.testKey));
  const missing = [...base.missing, ...other.missing].filter((m, i, all) => !have.has(m.testKey) && all.findIndex((x) => x.testKey === m.testKey) === i);
  return {
    ...base,
    reportDate: base.reportDate ?? other.reportDate,
    labName: base.labName ?? other.labName,
    rows,
    missing,
  };
}
