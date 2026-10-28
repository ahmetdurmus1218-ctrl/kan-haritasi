import type { ResultStatus } from '@kh/catalog';
import type { IssueCode, ParsedRow, ReportDraft, ReportMark, SourceBox, UnrecognizedRow } from './types';

/**
 * Raporun satırlara koyduğu görsel işaretler: e-Nabız'da aralık dışı satırın kırmızı ünlemi ve pembe
 * zemini, aralık içindekinin yeşil onayı; bazı PDF'lerde kırmızı yazılan değer. Laboratuvarın kendi
 * kararıdır; okunan değer veya aralık bununla çelişiyorsa büyük olasılıkla okuma hatalıdır.
 */

/** Değeri şüpheli satırlar işaretlerin güvenilirliğini ölçmede kullanılmaz. */
const DOUBT: IssueCode[] = ['IMPLAUSIBLE', 'AMBIGUOUS_DECIMAL', 'RANGE_DECIMAL_GUESSED', 'OCR_DISAGREE', 'LOW_OCR_CONFIDENCE', 'PERCENT_GUESSED', 'NAME_FUZZY', 'DUPLICATE'];

interface Judged {
  status: ResultStatus;
  value: number;
  refMin?: number;
  refMax?: number;
}

/** Aralık dışı işaretli değerin yönü: aralığın hangi ucuna yakın. */
function direction(r: Judged): 'high' | 'low' | undefined {
  const { value: v, refMin: min, refMax: max } = r;
  if (!Number.isFinite(v)) return undefined;
  if (min !== undefined && max !== undefined) return v >= (min + max) / 2 ? 'high' : 'low';
  if (max !== undefined) return 'high';
  if (min !== undefined) return 'low';
  return undefined;
}

/**
 * İşarete göre durum. `generic`: durum yalnızca genel aralıktan çıkarıldı (raporda aralık yok).
 * `conflict`: işaret okunanla çelişiyor ya da yönü kestirildi; kullanıcı belgeyle karşılaştırmalı.
 */
export function statusWithMark(r: Judged & { generic: boolean; fromReport: boolean }, mark: ReportMark): { status: ResultStatus; conflict: boolean } {
  if (mark === 'in') {
    if (r.status === 'high' || r.status === 'low') return { status: 'normal', conflict: r.fromReport };
    return { status: 'normal', conflict: false };
  }
  if (r.status === 'high' || r.status === 'low') return { status: r.status, conflict: false };
  const dir = direction(r);
  if (!dir) return { status: 'unknown', conflict: true };
  // Genel aralığın dışındaki değeri rapor da aralık dışı diye işaretlemiş: yön genel aralıktan.
  if (r.generic) return { status: dir, conflict: false };
  return { status: dir, conflict: true };
}

function markRow(row: ParsedRow, mark: ReportMark): ParsedRow {
  // Olanaksız değer okuma hatasıdır; işaret durumu düzeltemez.
  if (row.issues.includes('IMPLAUSIBLE')) return { ...row, reportMark: mark };
  const generic = row.issues.includes('RANGE_GENERIC');
  const { status, conflict } = statusWithMark(
    { status: row.status, value: row.canonicalValue ?? row.value, refMin: row.refMin, refMax: row.refMax, generic, fromReport: row.refSource === 'report' },
    mark,
  );
  const issues = row.issues.filter((i) => i !== 'RANGE_GENERIC' || status === 'unknown');
  if (conflict && !issues.includes('MARK_CONFLICT')) issues.push('MARK_CONFLICT');
  return { ...row, status, reportMark: mark, issues, confidence: conflict ? Math.max(0, row.confidence - 0.2) : row.confidence };
}

function markUnrecognized(row: UnrecognizedRow, mark: ReportMark): UnrecognizedRow {
  const { status } = statusWithMark({ status: row.status, value: row.value, refMin: row.refMin, refMax: row.refMax, generic: false, fromReport: row.refMin !== undefined || row.refMax !== undefined }, mark);
  return { ...row, status, reportMark: mark };
}

/**
 * Raporun görsel işaretlerini taslağa uygular. `markOf` satırın kutusu için işareti döndürür (bkz.
 * apps/web/src/lib/rowMarks.ts). İşaretler belge genelinde tutarsızsa (ör. tüm sayfa renkli zeminli
 * ya da okunan değerlerin çoğuyla çelişiyor) hiç kullanılmaz.
 */
export function applyReportMarks(draft: ReportDraft, markOf: (box: SourceBox) => ReportMark | undefined): ReportDraft {
  const rowMarks = draft.rows.map((r) => markOf(r.source));
  const unrecMarks = draft.unrecognized.map((u) => markOf(u.source));
  const all = [...rowMarks, ...unrecMarks];
  const outs = all.filter((m) => m === 'out').length;
  const ins = all.filter((m) => m === 'in').length;
  if (outs + ins < 2) return draft;
  // Renkli zebra çizgili tablolar: "aralık dışı" işareti satırların çoğunda ve hiç "aralık içi" yok.
  if (ins === 0 && outs > all.length * 0.6) return draft;
  let compared = 0;
  let disagree = 0;
  draft.rows.forEach((r, i) => {
    const m = rowMarks[i];
    if (!m || r.refSource !== 'report' || r.status === 'unknown' || r.issues.some((x) => DOUBT.includes(x))) return;
    compared++;
    if ((m === 'out') !== (r.status !== 'normal')) disagree++;
  });
  if (compared >= 3 && disagree / compared > 0.25) return draft;
  return {
    ...draft,
    rows: draft.rows.map((r, i) => (rowMarks[i] ? markRow(r, rowMarks[i]) : r)),
    unrecognized: draft.unrecognized.map((u, i) => (unrecMarks[i] ? markUnrecognized(u, unrecMarks[i]) : u)),
  };
}
