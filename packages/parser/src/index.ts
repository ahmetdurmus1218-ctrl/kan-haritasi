import { type LabTestDef, type Sex, matchTestName, normalizeText, testByKey } from '@kh/catalog';
import { type Line, buildLines } from './layout';
import { extractLabName, extractReportDate } from './meta';
import { parseLine } from './row';
import type { MissingValue, ParsedRow, ReportDraft, TextItem, UnrecognizedRow } from './types';

export * from './types';
export { buildLines } from './layout';
export { parseLine, parseRange } from './row';
export { extractReportDate, extractLabName } from './meta';
export { pdfTextToItems } from './pdfItems';
export type { PdfTextItemLike, ViewportLike } from './pdfItems';

export interface ParseOptions {
  sex?: Sex;
  method?: ReportDraft['method'];
  pageSizes?: Map<number, { w: number; h: number }>;
  pageCount?: number;
  /** Normalleştirilmiş ham ad → test anahtarı (kullanıcının önceki eşlemeleri). */
  userAliases?: Record<string, string>;
}

function aliasMapFrom(aliases?: Record<string, string>): Map<string, LabTestDef> | undefined {
  if (!aliases) return undefined;
  const map = new Map<string, LabTestDef>();
  for (const [name, key] of Object.entries(aliases)) {
    const test = testByKey.get(key);
    const norm = normalizeText(name);
    if (test && norm) map.set(norm, test);
  }
  return map;
}

/**
 * Konumlu metin parçalarından (PDF metin katmanı veya OCR) yapılandırılmış rapor taslağı üretir.
 * Taslak asla doğrudan kaydedilmez: kullanıcı onay ekranında her satırı görür, düzeltir, onaylar.
 * Hasta adı, kimlik no gibi satırlar ayrıştırılmaz; ham metin hiçbir yerde saklanmaz.
 */
export function parseReport(items: TextItem[], options: ParseOptions = {}): ReportDraft {
  const sex = options.sex ?? 'unspecified';
  const method = options.method ?? 'text';
  const lines = buildLines(items, options.pageSizes);
  const userAliases = aliasMapFrom(options.userAliases);

  const rows: ParsedRow[] = [];
  const unrecognized: UnrecognizedRow[] = [];
  const missing: MissingValue[] = [];
  const seen = new Map<string, ParsedRow>();

  // Kart düzeni (ör. e-Nabız'da tek testlik kartlar): test adı kendi satırında, değer birkaç satır
  // aşağıda ada sahip olmayan bir satırda ("0,27-4,2  1,3 UIU/mL"). Yalnızca addan oluşan son satır
  // hatırlanır ve en fazla 4 satır içinde adsız bir değer satırına bağlanır.
  let pendingName: { tokens: Line['tokens']; left: number } | null = null;
  for (const line of lines) {
    const ctx = { sex, ocr: method !== 'text', userAliases };
    let result = parseLine(line, ctx);
    if (result.kind === 'none' && pendingName && pendingName.left > 0 && /\d/.test(line.text) && !matchTestName(line.tokens.map((t) => t.text), userAliases)) {
      const merged: Line = { ...line, tokens: [...pendingName.tokens, ...line.tokens], text: `${pendingName.tokens.map((t) => t.text).join(' ')} ${line.text}` };
      const r2 = parseLine(merged, ctx);
      if (r2.kind === 'row' || r2.kind === 'missing') {
        result = r2;
        pendingName = null;
      }
    }
    if (pendingName) pendingName.left--;
    const own = matchTestName(line.tokens.map((t) => t.text), userAliases);
    if (result.kind === 'none' && own && own.tokensUsed === line.tokens.length && own.score >= 1) pendingName = { tokens: line.tokens, left: 4 };
    if (result.kind === 'row') {
      const prev = seen.get(result.row.testKey);
      if (prev) {
        // Aynı test ikinci kez: ilkini tut; değer farklıysa ikisini de incelemeye işaretle.
        if (prev.value !== result.row.value && !prev.issues.includes('DUPLICATE')) prev.issues.push('DUPLICATE');
        continue;
      }
      seen.set(result.row.testKey, result.row);
      rows.push(result.row);
    } else if (result.kind === 'unrecognized') {
      unrecognized.push(result.row);
    } else if (result.kind === 'missing') {
      missing.push(result.row);
    }
  }

  return {
    reportDate: extractReportDate(lines),
    labName: extractLabName(lines),
    rows,
    unrecognized,
    // Başka bir satırda değeri bulunan testler eksik sayılmaz.
    missing: missing.filter((m, i, all) => !seen.has(m.testKey) && all.findIndex((x) => x.testKey === m.testKey) === i),
    pageCount: options.pageCount ?? Math.max(0, ...lines.map((l) => l.page)),
    method,
  };
}

/** Satırın onaya düşmesi gerekip gerekmediği. */
export function needsReview(row: ParsedRow): boolean {
  return row.confidence < 0.75 || row.issues.length > 0;
}
