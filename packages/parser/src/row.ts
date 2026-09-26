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
// Hormon aralıkları çoğu zaman döngü evresine, menopoza ya da gebelik haftasına göre verilir.
// Hangi evrenin geçerli olduğunu yazılım bilemez; aralık kullanıcıya bırakılır.
const PHASE_WORDS = /(folik[uü]ler|l[uü]teal|ovulasyon|ovulat[uü]ar|mid ?siklus|menopoz|postmenopoz|gebelik|trimester|follicular|ovulation|postmenopausal|pregnan)/i;
// "Etiket: aralık" parçaları. Etiket harfle başlar, en fazla birkaç kelimedir.
const LABEL_SEG = /([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü ]{0,24}?)\s*:\s*(?=[<>≤≥]|\d)/g;
const GOOD_LABEL = /^(yeterli|normal|optimal|optimum|istenen|arzu edilen|ideal|onerilen|hedef|desirable|sufficient|referans|referans araligi)$/;
const SEX_LABEL = /^(e|k|erkek|kadin|male|female)$/;
const RISK_LABEL = /(eksik|yetersiz|dusuk|yuksek|sinirda|risk|toksik|zehirli|optimale yakin|borderline|high|low|deficien|insufficien|diyabet|intoks)/;
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
export function parseRange(text: string, sex: Sex): { range: RangeValue; sexSpecific: boolean; phaseSpecific?: boolean; categories?: boolean } {
  const t = text.replace(/−/g, '-');
  if (PHASE_WORDS.test(t) && /\d/.test(t)) return { range: { source: 'report', text: t.trim() }, sexSpecific: false, phaseSpecific: true };
  const sx = SEX_RANGE.exec(t);
  if (sx) {
    const male = { min: num(sx[2] ?? ''), max: num(sx[3] ?? '') };
    const female = { min: num(sx[5] ?? ''), max: num(sx[6] ?? '') };
    const text2 = sx[0].trim();
    if (sex === 'male') return { range: { ...male, source: 'report', text: text2 }, sexSpecific: false };
    if (sex === 'female') return { range: { ...female, source: 'report', text: text2 }, sexSpecific: false };
    return { range: { source: 'report', text: text2 }, sexSpecific: true };
  }
  // Etiketli aralıklar: "Optimal: <100 · Sınırda yüksek: 130-159", "Eksiklik: <20 / Yeterli: 30-100",
  // "Erkek: 13,5-17,5" (tek cinsiyet, satırın devamı alt satırda).
  const labels = [...t.matchAll(LABEL_SEG)];
  if (labels.length > 0) {
    const seg = (i: number) => t.slice(labels[i]!.index! + labels[i]![0].length, labels[i + 1]?.index ?? t.length);
    const names = labels.map((l) => normalizeText(l[1] ?? '').trim());
    const good = names.findIndex((n) => GOOD_LABEL.test(n));
    if (good >= 0) {
      const r = parseRange(seg(good), sex).range;
      if (r.source === 'report') return { range: { ...r, text: `${labels[good]![1]!.trim()}: ${r.text ?? ''}`.trim() }, sexSpecific: false };
    }
    const sexIdx = names.findIndex((n) => SEX_LABEL.test(n));
    if (sexIdx >= 0 && labels.length === 1) {
      const labelSex = /^(e|erkek|male)$/.test(names[sexIdx]!) ? 'male' : 'female';
      if (sex === 'unspecified') return { range: { source: 'report', text: t.trim() }, sexSpecific: true };
      if (sex === labelSex) return parseRange(seg(sexIdx), sex);
      return { range: { source: 'none' }, sexSpecific: false };
    }
    // Yalnızca risk/eksiklik kategorileri varsa bunlar "normal aralık" değildir; genel aralık kullanılır.
    if (names.some((n) => RISK_LABEL.test(n))) return { range: { source: 'none', text: t.trim() }, sexSpecific: false, categories: true };
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

/** Satır başındaki aralığın kaç belirteç sürdüğü: "74-100", "74 - 100", "< 5", "<5", "> 90". */
function rangeTokenCount(tokens: string[]): number {
  const a = tokens[0] ?? '';
  if (GLUED_RANGE.test(a) || /^[<>≤≥]=?\d/.test(a)) return 1;
  if (/^[<>≤≥]=?$/.test(a) && parseNumber(tokens[1] ?? '')) return 2;
  if (parseNumber(a) && DASH_TOKEN.test(tokens[1] ?? '') && parseNumber(tokens[2] ?? '')) return 3;
  if (parseNumber(a) && /^[-–—]\d/.test(tokens[1] ?? '')) return 2;
  return 0;
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
const GLUED_RANGE = /^\d+(?:[.,]\d+)?[-–—]\d+(?:[.,]\d+)?$/;
/** Ekran simgeleri ve OCR kırıntıları (e-Nabız'daki onay işaretleri, "»" gibi). */
const NOISE_TOKEN = /^(v|nv|va|vv|ww|✓|✔|«|\|)$/i;

// OCR'ın "%" işaretini okuyamadığı durumlar (Türkçe modelde sık): "Yo", "Vo", "Ve", "Y", "V", "96", "00".
const PCT_LOOKALIKE = /^(yo|vo|ve|ke|ko|y|v|96|9o|o\/o|0\/0|00|%o|°\/o|»)$/i;
const DIFF_WORD = /^(notrofil|lenfosit|monosit|eozinofil|bazofil|neu|neut|ne|lym|lymph|ly|mon|mono|mo|eos|eo|bas|baso|ba)$/;
const GLUED_DIFF_PCT = /^(ne|neu|neut|ly|lym|lymph|mo|mon|mono|eo|eos|ba|bas|baso)(y|yo|vo|96|9o)$/i;
/** Adı yüzde türünde bir testi gösteren sözcükler. */
const PCT_NAME = /(%|notrofil|lenfosit|monosit|eozinofil|bazofil|hematokrit|\bhct\b|\brdw|hba1c|saturasyon)/;

/**
 * Yüzde işaretinin OCR'daki benzerlerini düzeltir; yalnızca ad bir yüzde testini gösteriyorsa.
 * Değişiklik yapıldıysa `true` döner (satır "doğrula" diye işaretlenir).
 */
function fixPercent(raw: string[]): boolean {
  let changed = false;
  const firstNum = raw.findIndex((t) => /^\d/.test(t));
  const nameEnd = firstNum < 0 ? raw.length : firstNum;
  for (let i = 0; i < Math.min(nameEnd, 3); i++) {
    const g = GLUED_DIFF_PCT.exec(raw[i]!);
    if (g && i === 0) {
      raw[i] = `${g[1]}%`;
      changed = true;
    }
    const next = raw[i + 1];
    // "Nötrofil Yo 59,2" / "Eozinofil 4 3,1": addan sonraki benzer belirteç (ardından sayı gelmeli)
    if (next && DIFF_WORD.test(normalizeText(raw[i]!)) && (PCT_LOOKALIKE.test(next) || next === '4') && /^\d/.test(raw[i + 2] ?? '')) {
      raw[i + 1] = '%';
      changed = true;
    }
  }
  const name = normalizeText(raw.slice(0, nameEnd).join(' ').replace(/%/g, ' yuzde ')) + (raw.slice(0, nameEnd).some((t) => t.includes('%')) ? ' %' : '');
  if (!PCT_NAME.test(name)) return changed;
  // Değerden (veya e-Nabız'da aralıktan sonraki değerden) hemen sonra gelen benzer belirteç
  for (let i = nameEnd; i < raw.length - 1 && i < nameEnd + 4; i++) {
    if (/^\d/.test(raw[i]!) && !/[-–—]\d/.test(raw[i]!) && PCT_LOOKALIKE.test(raw[i + 1]!)) {
      raw[i + 1] = '%';
      changed = true;
      break;
    }
  }
  return changed;
}

export function parseLine(line: Line, ctx: RowContext, noMatch = false): LineResult {
  const raw = line.tokens.map((t) => t.text);
  const percentGuessed = ctx.ocr && fixPercent(raw);
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
  // "Ad | Referans | Değer | Birim" düzeni (ör. e-Nabız): aralık değerden önce gelir.
  let rangeBefore: { text: string; start: number } | null = null;
  for (let i = match ? 0 : 1; i < rest.length && i < 8; i++) {
    let tok = stripPunct(rest[i] ?? '');
    if (match && !rangeBefore) {
      const glued = GLUED_RANGE.test(tok);
      const spaced = !glued && !!parseNumber(tok) && DASH_TOKEN.test(rest[i + 1] ?? '') && !!parseNumber(stripPunct(rest[i + 2] ?? ''));
      if (glued || spaced) {
        const end = glued ? i : i + 2;
        const text = glued ? tok : `${tok} - ${stripPunct(rest[i + 2] ?? '')}`;
        // Aralıktan sonra (isteğe bağlı birimden sonra) bir sayı varsa o değerdir.
        let j = end + 1;
        const u = j < rest.length && !/\d/.test(rest[j] ?? '') ? findUnit(rest.slice(j, j + 3)) : null;
        if (u) j += u.used;
        const cand = stripPunct(rest[j] ?? '');
        const cf = VALUE_WITH_FLAG.exec(cand);
        const candNum = cf ? `${cf[1] ?? ''}${cf[2] ?? ''}` : cand;
        const [cv, cu] = splitGlued(candNum);
        if (cand && !GLUED_RANGE.test(cand) && parseNumber(cv)) {
          rangeBefore = { text, start: i };
          if (u) unitBefore = { unit: u.unit, unitKey: u.unitKey };
          if (cf) {
            const f = (cf[3] ?? '').toLowerCase();
            gluedFlag = f.startsWith('h') || f === '↑' ? 'H' : f.startsWith('l') || f === '↓' ? 'L' : undefined;
          }
          valueIdx = j;
          valueText = cv;
          gluedUnit = cu;
          break;
        }
        rangeFirst = true;
        break;
      }
    }
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

  let afterValue = rest.slice(valueIdx + 1).filter((t) => !NOISE_TOKEN.test(t) || t === '%');
  let unitFound = gluedUnit
    ? { unit: gluedUnit, unitKey: normalizeUnit(gluedUnit) as string, used: 0 }
    : (findUnit(afterValue) ?? (unitBefore ? { ...unitBefore, used: 0 } : null));
  if (!unitFound) {
    // "Sonuç | Referans | Birim" düzeni: birim aralıktan sonra gelir ("112 74 - 100 mg/dL").
    const k = rangeTokenCount(afterValue);
    const u = k ? findUnit(afterValue.slice(k)) : null;
    if (u) {
      unitFound = { unit: u.unit, unitKey: u.unitKey, used: 0 };
      afterValue = [...afterValue.slice(0, k), ...afterValue.slice(k + u.used)];
    }
  }
  const unitKey = unitFound?.unitKey ?? null;
  const tail = afterValue.slice(unitFound?.used ?? 0);
  const tailText = tail.join(' ');

  // Bayrak: H/L/Y/D/↑/↓ (değerin yanında veya satır sonunda)
  let reportFlag: 'H' | 'L' | undefined;
  if (gluedFlag) reportFlag = gluedFlag;
  for (const t of [...tail, ...rest.slice(0, valueIdx)]) {
    // "Düşük: < 40" gibi aralık etiketleri bayrak değildir.
    if (t.endsWith(':')) continue;
    if (t.includes('↑')) reportFlag = 'H';
    else if (t.includes('↓')) reportFlag = 'L';
    const n = normalizeText(t);
    if (FLAG_HIGH.test(n)) reportFlag = 'H';
    else if (FLAG_LOW.test(n)) reportFlag = 'L';
  }

  const parsedValue = parseNumber(valueText, isCountUnit(unitKey));
  if (!parsedValue) return { kind: 'none' };
  const { range: reportRange, sexSpecific, phaseSpecific, categories } = parseRange(rangeBefore ? rangeBefore.text : tailText, ctx.sex);

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
    const between = rest.slice(0, rangeBefore ? rangeBefore.start : valueIdx);
    const unitMismatch = unitFound !== null && !(unitKey && unitKey in test.conversions);
    if (between.some((t) => /\d/.test(t)) || unitMismatch) return parseLine(line, ctx, true);
  }

  const issues: IssueCode[] = [];
  let confidence = match.score >= 1 ? 0.55 : 0.4;
  if (match.score < 1) issues.push('NAME_FUZZY');
  if (percentGuessed) {
    issues.push('PERCENT_GUESSED');
    confidence -= 0.1;
  }

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
    else if (phaseSpecific) issues.push('RANGE_PHASE_SPECIFIC');
    else if (categories) issues.push('RANGE_CATEGORIES');
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
  if (range.source === 'none' && canonicalValue !== null && !sexSpecific && !phaseSpecific) {
    const fallback = catalogRange(test, ctx.sex);
    if (fallback.source === 'catalog') {
      storedRange = fallback;
      status = statusFor(canonicalValue, fallback, parsedValue.qualifier);
    }
  }
  if (sexSpecific || phaseSpecific) {
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
