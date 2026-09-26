/**
 * Metin normalizasyonu: Türkçe büyük/küçük harf, aksan katlama, noktalama temizliği.
 * Hem katalog takma adları hem rapor satırları aynı fonksiyondan geçer; eşleşme bunun üstüne kurulur.
 */
const FOLD: Record<string, string> = {
  ş: 's',
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
  é: 'e',
};

/** "Lökosit (WBC)" → "lokosit wbc"; "LDL-Kolesterol" → "ldl kolesterol"; "%" ve "#" korunur. */
export function normalizeText(input: string): string {
  const lower = input.normalize('NFC').toLocaleLowerCase('tr');
  let out = '';
  for (const ch of lower) out += FOLD[ch] ?? ch;
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sayısal değer ayrıştırma sonucu. */
export interface ParsedNumber {
  value: number;
  /** "<5" gibi sınır değerler: değer sınırın kendisidir, yön ayrıca tutulur. */
  qualifier?: '<' | '>' | '<=' | '>=';
  /** Ondalık ayırıcı belirsizdi (ör. "1,234"); düşük güvenle işaretlenir. */
  ambiguous?: boolean;
}

const NUM_RE = /^([<>≤≥]=?|<=|>=)?\s*([+-]?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|[+-]?\d+(?:[.,]\d+)?)$/;

/**
 * Türkçe raporlardaki sayıları çözer. Kural: virgül ondalıktır (17,8 → 17.8).
 * - Hem nokta hem virgül varsa nokta binlik ayırıcıdır (1.234,5 → 1234.5).
 * - Yalnızca nokta ve ardından tam 3 hane varsa (7.200) belirsizdir: `countLike` true ise binlik,
 *   değilse ondalık kabul edilir ve `ambiguous` işaretlenir.
 * - Yalnızca virgül ve ardından tam 3 hane (1,234): Türkçe kuralıyla ondalık, `ambiguous`.
 */
export function parseNumber(raw: string, countLike = false): ParsedNumber | null {
  const text = raw.replace(/−/g, '-').replace(/\s+/g, ' ').trim();
  const m = NUM_RE.exec(text);
  if (!m) return null;
  const q = m[1]?.replace('≤', '<=').replace('≥', '>=') as ParsedNumber['qualifier'] | undefined;
  let body = (m[2] ?? '').replace(/\s/g, '');
  let ambiguous = false;
  const hasDot = body.includes('.');
  const hasComma = body.includes(',');
  if (hasDot && hasComma) {
    body = body.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    const [, frac = ''] = body.split(',');
    if (frac.length === 3) ambiguous = true;
    body = body.replace(',', '.');
  } else if (hasDot) {
    const parts = body.split('.');
    if (parts.length > 2) {
      body = parts.join('');
    } else if ((parts[1] ?? '').length === 3) {
      ambiguous = !countLike;
      if (countLike) body = parts.join('');
    }
  }
  const value = Number(body);
  if (!Number.isFinite(value)) return null;
  return { value, ...(q ? { qualifier: q } : {}), ...(ambiguous ? { ambiguous } : {}) };
}
