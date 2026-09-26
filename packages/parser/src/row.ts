import {
  type LabTestDef,
  type RangeValue,
  type Sex,
  catalogRange,
  convertRange,
  isCountUnit,
  matchTestName,
  normalizeText,
  normalizeUnit,
  parseNumber,
  pickCandidate,
  rangeText,
  statusFor,
  toCanonical,
} from '@kh/catalog';
import type { Line } from './layout';
import type { IssueCode, MissingValue, ParsedRow, UnrecognizedRow } from './types';

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const RANGE_DASH = new RegExp(String.raw`(${NUMBER})\s*[-–—~]\s*(${NUMBER})`);
const RANGE_LT = new RegExp(String.raw`(<=|≤|<)\s*(${NUMBER})`);
const RANGE_GT = new RegExp(String.raw`(>=|≥|>)\s*(${NUMBER})`);
const SEX_RANGE = new RegExp(
  String.raw`(?:^|\s)(E|Erkek|M|Male)\s*[:=]?\s*(${NUMBER})\s*[-–—]\s*(${NUMBER}).*?(?:^|\s)(K|Kad[ıi]n|F|Female)\s*[:=]?\s*(${NUMBER})\s*[-–—]\s*(${NUMBER})`,
  'i',
);
const FLAG_HIGH = /^(h|hh|y|yuksek|high|\*h)$/;
const FLAG_LOW = /^(l|ll|d|dusuk|low|\*l)$/;
const VALUE_WITH_FLAG = /^([<>≤≥]=?)?(\d+(?:[.,]\d+)*)(hh|ll|h|l|↑|↓|\*)$/i;
const VALUE_WITH_UNIT = /^([<>≤≥]=?\s*)?(\d+(?:[.,]\d+)*)([a-zA-Zµμ%/^*³⁶].*)$/;
const PII_LINE = /\b(hasta|adi|soyad|tc|t c|kimlik|dogum|protokol|barkod|telefon|adres|dosya no|sicil|yas)\b/;

export interface RowContext {
  sex: Sex;
  ocr: boolean;
  userAliases?: ReadonlyMap<string, LabTestDef>;
}

function num(text: string): number {
  return parseNumber(text)?.value ?? Number.NaN;
}

/** Rapor aralığını serbest metinden çıkarır. */
export function parseRange(text: string, sex: Sex): { range: RangeValue; sexSpecific: boolean } {
  const t = text.replace(/−/g, '-');
  const sx = SEX_RANGE.exec(t);
  if (sx) {
    const male = { min: num(sx[2] ?? ''), max: num(sx[3] ?? '') };
    const female = { min: num(sx[5] ?? ''), max: num(sx[6] ?? '') };
    const text2 = sx[0].trim();
    if (sex === 'male') return { range: { ...male, source: 'report', text: text2 }, sexSpecific: false };
    if (sex === 'female') return { range: { ...female, source: 'report', text: text2 }, sexSpecific: false };
    return { range: { source: 'report', text: text2 }, sexSpecific: true };
  }
  // Birden fazla "a-b" olabilir (ör. OCR'ın bozduğu birim "10-3/pL"); geçerli ilk aralık alınır.
  for (const dash of t.matchAll(new RegExp(RANGE_DASH.source, 'g'))) {
    const min = num(dash[1] ?? '');
    const max = num(dash[2] ?? '');
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) return { range: { min, max, source: 'report', text: dash[0] }, sexSpecific: false };
  }
  const lt = RANGE_LT.exec(t);
  if (lt) {
    const max = num(lt[2] ?? '');
    if (Number.isFinite(max)) return { range: { max, maxExclusive: lt[1] === '<', source: 'report', text: lt[0] }, sexSpecific: false };
  }
  const gt = RANGE_GT.exec(t);
  if (gt) {
    const min = num(gt[2] ?? '');
    if (Number.isFinite(min)) return { range: { min, minExclusive: gt[1] === '>', source: 'report', text: gt[0] }, sexSpecific: false };
  }
  return { range: { source: 'none' }, sexSpecific: false };
}

/** Değer belirtecinden birim kuyruğunu ayırır: "178mg/dL" → ["178", "mg/dL"]. */
function splitGlued(token: string): [string, string | null] {
  const m = VALUE_WITH_UNIT.exec(token);
  if (!m) return [token, null];
  const unit = m[3] ?? '';
  if (normalizeUnit(unit) === null) return [token, null];
  return [`${m[1] ?? ''}${m[2] ?? ''}`, unit];
}

function findUnit(tokens: string[]): { unit: string; unitKey: string; used: number } | null {
  // Birim bazen iki-üç kelimeye bölünür: "mg /dL", "mL/dk/1,73 m²", "10^3 /µL".
  for (let n = Math.min(3, tokens.length); n >= 1; n--) {
    const cand = tokens.slice(0, n).join('');
    const key = normalizeUnit(cand);
    if (key) return { unit: tokens.slice(0, n).join(' '), unitKey: key, used: n };
  }
  return null;
}

export type LineResult =
  | { kind: 'row'; row: ParsedRow }
  | { kind: 'unrecognized'; row: UnrecognizedRow }
  | { kind: 'missing'; row: MissingValue }
  | { kind: 'none' };

/** OCR'ın sayıya yapıştırdığı noktalama: "35)", "(94", "13,9|". */
function stripPunct(tok: string): string {
  return tok.replace(/^[([{|'"`]+/, '').replace(/[)\]}|:;'"`]+$/, '');
}

const DASH_TOKEN = /^[-–—~]$/;

export function parseLine(line: Line, ctx: RowContext, noMatch = false): LineResult {
  const raw = line.tokens.map((t) => t.text);
  const normLine = normalizeText(line.text);
  if (!normLine || PII_LINE.test(normLine)) return { kind: 'none' };

  // Bazı raporlarda satır başında test kodu olur ("1001 Hemoglobin ..."): bir sayı atlanabilir.
  let start = 0;
  let match = noMatch ? null : matchTestName(raw, ctx.userAliases);
  if (!match && !noMatch && raw.length > 2 && /^\d{2,6}$/.test(raw[0] ?? '')) {
    const m2 = matchTestName(raw.slice(1), ctx.userAliases);
    if (m2) {
      match = m2;
      start = 1;
    }
  }

  const nameEnd = match ? start + match.tokensUsed : 0;
  const rest = raw.slice(nameEnd);

  // Değer: addan sonraki ilk sayısal belirteç (arada "(hesaplanan)", ":" gibi sözcükler olabilir).
  let valueIdx = -1;
  let gluedUnit: string | null = null;
  let gluedFlag: 'H' | 'L' | undefined;
  let valueText = '';
  // Sayıdan önce gelen birim: bazı raporlar "Test | Birim | Sonuç | Referans" sırasıyla yazar; çoğu
  // ise değer → birim → aralık. Birimden sonraki ilk sayının ardından ayrıca bir aralık geliyorsa o sayı
  // değerdir; gelmiyorsa o sayı aralığın kendisidir ve değer okunamamıştır (OCR kaçırmış olabilir).
  let unitBefore: { unit: string; unitKey: string } | null = null;
  let rangeFirst = false;
  for (let i = match ? 0 : 1; i < rest.length && i < 8; i++) {
    let tok = stripPunct(rest[i] ?? '');
    if (match && !/\d/.test(tok) && !unitBefore) {
      const u = findUnit(rest.slice(i, i + 3));
      if (u && normalizeUnit(tok) !== null) {
        unitBefore = { unit: u.unit, unitKey: u.unitKey };
        i += u.used - 1;
        continue;
      }
    }
    const vf = VALUE_WITH_FLAG.exec(tok);
    if (vf) {
      const f = (vf[3] ?? '').toLowerCase();
      // "*" yalnızca "aralık dışı" demektir; yönü aralıktan hesaplanır.
      gluedFlag = f.startsWith('h') || f === '↑' ? 'H' : f.startsWith('l') || f === '↓' ? 'L' : undefined;
      tok = `${vf[1] ?? ''}${vf[2] ?? ''}`;
    }
    const [v, u] = splitGlued(tok);
    const joined = /^[<>≤≥]=?$/.test(tok) && rest[i + 1] ? `${tok}${rest[i + 1]}` : v;
    if (parseNumber(joined)) {
      const idx = joined === v ? i : i + 1;
      // "0 - 130", "0-130": değer değil aralık (değer eksik)
      const next = rest[idx + 1] ?? '';
      if (match && ((DASH_TOKEN.test(next) && parseNumber(stripPunct(rest[idx + 2] ?? ''))) || /^\d+(?:[.,]\d+)?[-–—]\d/.test(tok))) {
        rangeFirst = true;
        break;
      }
      if (match && unitBefore && parseRange(rest.slice(idx + 1).join(' '), ctx.sex).range.source === 'none') {
        rangeFirst = true;
        break;
      }
      // Tanınmayan satırda adın içinde sayı olabilir ("CA 19-9"): değer, ardından birim veya
      // aralık gelen ilk sayıdır.
      if (!match && !u && !findUnit(rest.slice(idx + 1)) && parseRange(rest.slice(idx + 1).join(' '), ctx.sex).range.source === 'none') continue;
      valueIdx = idx;
      valueText = joined;
      gluedUnit = joined === v ? u : null;
      break;
    }
  }

  if (valueIdx < 0 || (match && rangeFirst)) {
    if (match && (rangeFirst || unitBefore)) {
      const test = match.candidates[0];
      if (test) return { kind: 'missing', row: { testKey: test.key, rawName: raw.slice(start, nameEnd).join(' '), source: line.box } };
    }
    return { kind: 'none' };
  }

  const afterValue = rest.slice(valueIdx + 1);
  const unitFound = gluedUnit
    ? { unit: gluedUnit, unitKey: normalizeUnit(gluedUnit) as string, used: 0 }
    : (findUnit(afterValue) ?? (unitBefore ? { ...unitBefore, used: 0 } : null));
  const unitKey = unitFound?.unitKey ?? null;
  const tail = afterValue.slice(unitFound?.used ?? 0);
  const tailText = tail.join(' ');

  // Bayrak: H/L/Y/D/↑/↓ (değerin yanında veya satır sonunda)
  let reportFlag: 'H' | 'L' | undefined;
  if (gluedFlag) reportFlag = gluedFlag;
  for (const t of [...tail, ...rest.slice(0, valueIdx)]) {
    if (t.includes('↑')) reportFlag = 'H';
    else if (t.includes('↓')) reportFlag = 'L';
    const n = normalizeText(t);
    if (FLAG_HIGH.test(n)) reportFlag = 'H';
    else if (FLAG_LOW.test(n)) reportFlag = 'L';
  }

  const parsedValue = parseNumber(valueText, isCountUnit(unitKey));
  if (!parsedValue) return { kind: 'none' };
  const { range: reportRange, sexSpecific } = parseRange(tailText, ctx.sex);

  if (!match) {
    // Tanınmayan satır: adı harf içeren ve değer + (birim veya aralık) taşıyan satırlar listelenir.
    const rawName = raw.slice(0, Math.max(1, valueIdx)).join(' ');
    if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]{2,}/.test(rawName) || (!unitFound && reportRange.source === 'none')) return { kind: 'none' };
    return {
      kind: 'unrecognized',
      row: { rawName, valueText, unit: unitFound?.unit ?? '', refText: reportRange.text ?? '', source: line.box },
    };
  }

  const test: LabTestDef | undefined = pickCandidate(match.candidates, unitKey);
  if (!test) return { kind: 'none' };

  // Kısa takma adlar ("Ca", "K", "P", "TP") başka testlerin adının başı olabilir ("CA 19-9").
  // Adla değer arasında sayı içeren bir belirteç varsa veya birim bu testle uyumsuzsa eşleşme reddedilir.
  const shortAlias = match.matchedAlias.replace(/[^a-z]/g, '').length <= 3;
  if (shortAlias) {
    const between = rest.slice(0, valueIdx);
    const unitMismatch = unitFound !== null && !(unitKey && unitKey in test.conversions);
    if (between.some((t) => /\d/.test(t)) || unitMismatch) return parseLine(line, ctx, true);
  }

  const issues: IssueCode[] = [];
  let confidence = match.score >= 1 ? 0.55 : 0.4;
  if (match.score < 1) issues.push('NAME_FUZZY');

  let canonicalValue: number | null;
  if (!unitFound) {
    // Birim yazılmamış: kanonik birim varsayılır ama düşük güvenle.
    canonicalValue = parsedValue.value;
    issues.push('UNIT_MISSING');
  } else {
    canonicalValue = toCanonical(test, parsedValue.value, unitKey);
    if (canonicalValue === null) issues.push('UNIT_UNKNOWN');
    else confidence += 0.2;
  }

  let range: RangeValue;
  if (reportRange.source === 'report' && (reportRange.min !== undefined || reportRange.max !== undefined)) {
    range = reportRange;
    confidence += 0.2;
  } else {
    if (sexSpecific) issues.push('RANGE_SEX_SPECIFIC');
    else issues.push('RANGE_MISSING');
    range = { source: 'none' };
  }

  if (parsedValue.ambiguous) {
    issues.push('AMBIGUOUS_DECIMAL');
    confidence -= 0.25;
  }

  if (canonicalValue !== null) {
    const [lo, hi] = test.plausible;
    if (canonicalValue < lo || canonicalValue > hi) {
      issues.push('IMPLAUSIBLE');
      confidence -= 0.35;
    } else {
      confidence += 0.05;
    }
  }

  // Durum: rapor aralığı (rapor biriminde) varsa o; yoksa genel aralık (kanonik birimde).
  let status = statusFor(parsedValue.value, range, parsedValue.qualifier);
  let storedRange: RangeValue = convertRange(test, range, unitKey);
  if (range.source === 'none' && canonicalValue !== null && !sexSpecific) {
    const fallback = catalogRange(test, ctx.sex);
    if (fallback.source === 'catalog') {
      storedRange = fallback;
      status = statusFor(canonicalValue, fallback, parsedValue.qualifier);
    }
  }
  if (sexSpecific) {
    storedRange = { source: 'report', text: reportRange.text };
    status = 'unknown';
  }

  if (reportFlag && status !== 'unknown') {
    const expected = reportFlag === 'H' ? 'high' : 'low';
    if (status !== expected) {
      issues.push('FLAG_CONFLICT');
      confidence -= 0.3;
    }
  } else if (reportFlag && status === 'unknown') {
    status = reportFlag === 'H' ? 'high' : 'low';
  }

  if (ctx.ocr && line.conf !== undefined) {
    confidence *= Math.max(0.3, Math.min(1, line.conf / 90));
    if (line.conf < 70) issues.push('LOW_OCR_CONFIDENCE');
  }

  const row: ParsedRow = {
    testKey: test.key,
    loinc: test.loinc,
    rawName: raw.slice(start, nameEnd).join(' '),
    valueText,
    value: parsedValue.value,
    ...(parsedValue.qualifier ? { qualifier: parsedValue.qualifier } : {}),
    unit: unitFound?.unit ?? '',
    unitKey,
    canonicalValue,
    refMin: storedRange.min,
    refMax: storedRange.max,
    ...(storedRange.minExclusive ? { refMinExclusive: true } : {}),
    ...(storedRange.maxExclusive ? { refMaxExclusive: true } : {}),
    refText: storedRange.source === 'catalog' ? storedRange.text ?? '' : reportRange.text ?? rangeText(storedRange.min, storedRange.max, test.decimals),
    refSource: storedRange.source,
    status,
    ...(reportFlag ? { reportFlag } : {}),
    confidence: Math.max(0, Math.min(1, confidence)),
    issues,
    source: line.box,
  };
  return { kind: 'row', row };
}
