import { normalizeText } from '@kh/catalog';
import type { Line } from './layout';

const DATE_RE = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/;
const DATE_KEYS: Array<[RegExp, number]> = [
  [/numune|alinma|alim tarihi|kan alma|orneklem/, 5],
  [/kabul/, 4],
  [/sonuc|onay/, 3],
  [/rapor/, 2],
  [/tarih|istem/, 1],
];

/** Numune/rapor tarihini bulur. Doğum tarihi içeren satırlar yok sayılır. */
export function extractReportDate(lines: Line[]): string | undefined {
  let best: { date: string; score: number } | undefined;
  for (const line of lines.slice(0, 120)) {
    const norm = normalizeText(line.text);
    if (/dogum/.test(norm)) continue;
    const m = DATE_RE.exec(line.text);
    if (!m) continue;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) continue;
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const score = DATE_KEYS.find(([re]) => re.test(norm))?.[1] ?? 0;
    if (!best || score > best.score) best = { date: iso, score };
  }
  return best?.date;
}

/** Kurum adı (hasta değil): ilk sayfanın üst kısmında "laboratuvar/hastane/tıp merkezi" geçen satır. */
export function extractLabName(lines: Line[]): string | undefined {
  for (const line of lines.filter((l) => l.page === 1).slice(0, 12)) {
    const norm = normalizeText(line.text);
    if (/hasta|adi|soyad|kimlik|dogum/.test(norm)) continue;
    if (/laboratuvar|hastane|tip merkezi|saglik|klinik|lab\b/.test(norm)) {
      return line.text.replace(/\s+/g, ' ').trim().slice(0, 80);
    }
  }
  return undefined;
}
