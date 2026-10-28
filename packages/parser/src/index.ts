import { type LabTestDef, type Sex, matchTestName, normalizeText, testByKey } from '@kh/catalog';
import { type Line, buildLines } from './layout';
import { extractLabName, extractReportDate } from './meta';
import { draftScore } from './merge';
import { parseLine } from './row';
import type { MissingValue, ParsedRow, ReportDraft, TextItem, UnrecognizedRow } from './types';

export * from './types';
export { buildLines } from './layout';
export { parseLine, parseRange } from './row';
export { extractReportDate, extractLabName } from './meta';
export { pdfTextToItems } from './pdfItems';
export { draftScore, mergeOcrDrafts } from './merge';
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
  const lines = buildLines(items, options.pageSizes);
  let best = parseLines(lines, options);
  // Yan yana iki tablo (ör. iki ekran görüntüsünden yapılmış kolaj ya da iki sütunlu sayfa): aynı yükseklikteki
  // iki satır tek satır sanılır ve ikisi de okunamaz. Sayfa, satırları ikiye bölen boş bir şeritten ayrılarak
  // da okunur; daha çok sonuç veren okuma seçilir. İki yarı da kendi başına sonuç vermelidir: tek tablonun ad
  // sütununu değerlerinden ayırmak (yalnızca adlardan oluşan yarı) hiçbir zaman kabul edilmez.
  const splits = new Map<number, number>();
  for (const [page, xs] of gutterCandidates(lines)) {
    let pageBest: number | undefined;
    for (const x of xs) {
      const halves = splitPage(items, page, x, options.pageSizes);
      if (halves.some((half) => parseLines(half, options).rows.length < 2)) continue;
      const trial = new Map(splits).set(page, x);
      const draft = parseLines(splitLines(items, trial, options.pageSizes), options);
      const [score, current] = [draftScore(draft), draftScore(best)];
      // En az bir sağlam satır kadar daha iyi olmalı (draftScore'da tam güvenli satır ~15–20 puan).
      if (score - current >= 15) {
        best = draft;
        pageBest = x;
      }
    }
    if (pageBest !== undefined) splits.set(page, pageBest);
  }
  return best;
}

/**
 * Sayfayı ikiye bölebilecek dikey boş şeritler (sayfa başına aday x konumları, genişten dara): neredeyse hiçbir
 * kelimenin üstünden geçmediği, iki yanında da satırların önemli bir kısmının kelimesi bulunan konumlar.
 * Tablonun kendi sütun araları da aday olur; onları ayırmak okumayı bozduğu için puanla elenirler.
 */
function gutterCandidates(lines: Line[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const page of new Set(lines.map((l) => l.page))) {
    const ls = lines.filter((l) => l.page === page && l.tokens.length > 0);
    if (ls.length < 6) continue;
    const x0 = Math.min(...ls.map((l) => l.box.x));
    const x1 = Math.max(...ls.map((l) => l.box.x + l.box.w));
    const step = (x1 - x0) / 300;
    if (!(step > 0)) continue;
    const runs: Array<[number, number]> = [];
    let runStart = -1;
    for (let i = 1; i < 300; i++) {
      const x = x0 + i * step;
      let cross = 0;
      let left = 0;
      let right = 0;
      for (const l of ls) {
        if (l.tokens.some((t) => t.x < x && t.x + t.w > x)) cross++;
        if (l.tokens.some((t) => t.x + t.w <= x)) left++;
        if (l.tokens.some((t) => t.x >= x)) right++;
      }
      const side = Math.max(3, ls.length * 0.25);
      const ok = cross <= Math.max(1, ls.length * 0.06) && left >= side && right >= side;
      if (ok && runStart < 0) runStart = x;
      if (!ok && runStart >= 0) {
        runs.push([runStart, x - step]);
        runStart = -1;
      }
    }
    if (runs.length) out.set(page, runs.sort((a, b) => b[1] - b[0] - (a[1] - a[0])).slice(0, 16).map(([a, b]) => (a + b) / 2));
  }
  return out;
}

/** Sayfanın `x`'ten bölünmüş sol ve sağ yarısının satırları. */
function splitPage(items: TextItem[], page: number, x: number, pageSizes?: Map<number, { w: number; h: number }>): [Line[], Line[]] {
  const own = items.filter((it) => it.page === page);
  const isLeft = (it: TextItem) => it.x + it.w / 2 < x;
  return [buildLines(own.filter(isLeft), pageSizes), buildLines(own.filter((it) => !isLeft(it)), pageSizes)];
}

/** Bölünen sayfalarda önce sol, sonra sağ yarının satırları; diğer sayfalar olduğu gibi. */
function splitLines(items: TextItem[], splits: Map<number, number>, pageSizes?: Map<number, { w: number; h: number }>): Line[] {
  const pages = [...new Set(items.map((it) => it.page))].sort((a, b) => a - b);
  return pages.flatMap((page) => {
    const x = splits.get(page);
    return x === undefined ? buildLines(items.filter((it) => it.page === page), pageSizes) : splitPage(items, page, x, pageSizes).flat();
  });
}

function parseLines(lines: Line[], options: ParseOptions): ReportDraft {
  const sex = options.sex ?? 'unspecified';
  const method = options.method ?? 'text';
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
