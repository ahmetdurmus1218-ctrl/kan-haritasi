import { TESTS, type LabTestDef } from './tests';
import { normalizeText } from './text';

/**
 * Test adı eşleme. Takma adlar normalleştirilip bir sözlükte tutulur. Satırın başındaki
 * 1–8 kelimelik ön ekler sözlükte aranır; en uzun eşleşme kazanır. OCR hatalarına karşı
 * uzun adlarda 1–2 harflik bulanık eşleşmeye izin verilir.
 */
interface AliasEntry {
  norm: string;
  words: number;
  tests: LabTestDef[];
}

const aliasMap = new Map<string, AliasEntry>();
for (const test of TESTS) {
  for (const alias of [test.nameTr, ...test.aliases]) {
    const norm = normalizeText(alias);
    if (!norm) continue;
    const entry = aliasMap.get(norm);
    if (entry) {
      if (!entry.tests.includes(test)) entry.tests.push(test);
    } else {
      aliasMap.set(norm, { norm, words: norm.split(' ').length, tests: [test] });
    }
  }
}
const aliasesByWords = new Map<number, AliasEntry[]>();
for (const e of aliasMap.values()) {
  const list = aliasesByWords.get(e.words) ?? [];
  list.push(e);
  aliasesByWords.set(e.words, list);
}

export interface NameMatch {
  /** Eşleşen testler (birden fazlaysa birim/tür ile ayrılır: ör. Nötrofil # / %). */
  candidates: LabTestDef[];
  /** Adın kapladığı ham kelime sayısı. */
  tokensUsed: number;
  /** 1: tam eşleşme; <1: bulanık. */
  score: number;
  matchedAlias: string;
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? max + 1;
}

/** Bir kelime dizisinin başındaki test adını bulur. `tokens` ham (normalleştirilmemiş) kelimelerdir. */
export function matchTestName(tokens: string[], userAliases?: ReadonlyMap<string, LabTestDef>): NameMatch | null {
  const normTokens: string[] = [];
  const rawCounts: number[] = [];
  // Ham kelime → normalleştirilmiş kelime(ler). "LDL-Kolesterol" iki kelimeye açılabilir.
  for (const t of tokens.slice(0, 10)) {
    const n = normalizeText(t);
    const parts = n ? n.split(' ') : [];
    normTokens.push(...parts);
    rawCounts.push(parts.length);
  }
  let best: NameMatch | null = null;
  let normUsed = 0;
  for (let raw = 1; raw <= Math.min(tokens.length, 8); raw++) {
    normUsed += rawCounts[raw - 1] ?? 0;
    if (normUsed === 0) continue;
    const key = normTokens.slice(0, normUsed).join(' ');
    const exact = aliasMap.get(key);
    if (exact) {
      best = { candidates: exact.tests, tokensUsed: raw, score: 1, matchedAlias: exact.norm };
      continue;
    }
    // Kullanıcının daha önce "bu satır şu testtir" diye eşlediği laboratuvara özgü adlar.
    const user = userAliases?.get(key);
    if (user) {
      best = { candidates: [user], tokensUsed: raw, score: 1, matchedAlias: key };
      continue;
    }
    // Bulanık: yalnızca harf içeren, yeterince uzun adlarda (kısaltmalar asla bulanık eşleşmez).
    if ((!best || best.score < 1) && key.length >= 6 && /^[a-z %#]+$/.test(key)) {
      const maxDist = key.length >= 11 ? 2 : 1;
      for (const e of aliasesByWords.get(normUsed) ?? []) {
        if (e.norm.length < 6) continue;
        const d = levenshtein(key, e.norm, maxDist);
        if (d <= maxDist) {
          const score = 1 - d / Math.max(key.length, e.norm.length);
          if (!best || best.tokensUsed < raw || (best.tokensUsed === raw && best.score < score)) {
            best = { candidates: e.tests, tokensUsed: raw, score: Math.min(score, 0.9), matchedAlias: e.norm };
          }
        }
      }
    }
  }
  return best;
}

/** Aynı ada sahip test adaylarından birimi en uygun olanı seçer. */
export function pickCandidate(candidates: LabTestDef[], unitKey: string | null): LabTestDef | undefined {
  if (candidates.length <= 1) return candidates[0];
  if (unitKey) {
    const byUnit = candidates.filter((c) => unitKey in c.conversions);
    if (byUnit.length === 1) return byUnit[0];
    if (unitKey === '%') return candidates.find((c) => c.kind === 'percent') ?? candidates[0];
  }
  return candidates.find((c) => c.kind === 'count') ?? candidates[0];
}
