/**
 * Tahlil → vücut etkisi motoru: "Bu sonuç vücudumda NEREYİ, NASIL etkiler? Normalde nasıl çalışır?
 * Olası nedenler neler ve diğer sonuçlarım hangisini destekliyor?"
 *
 * Kurallar:
 *   - Olası neden sıralaması yalnızca kişinin ÖLÇÜLMÜŞ sonuçlarının bir nedenin tipik tahlil imzasına
 *     uyumudur (destekleyen ✓ / çelişen ✗ / eksik ?). Hastalık olasılığı değildir, tanı koymaz.
 *   - Ölçülmemiş test asla "normal" ya da "anormal" sayılmaz; eksik olarak yazılır.
 *   - Örnek kaynaklı nedenler (hemoliz, aç kalmama, biyotin…) listede açıkça "örnek / ölçüm kaynaklı" diye
 *     ayrılır: bazı sonuçlar gerçek bir değişiklik değildir.
 */
import { testByKey } from '@kh/catalog';
import { interiorById } from '../interior';
import type { LabObservation } from '../types';
import { CONDITIONS, conditionById } from './conditions';
import { BLOODGAS } from './data/bloodgas';
import { ENDOCRINE } from './data/endocrine';
import { HEMOGRAM } from './data/hemogram';
import { KIDNEY } from './data/kidney';
import { LIVER } from './data/liver';
import { METABOLIC } from './data/metabolic';
import { VITAMINS } from './data/vitamins';
import type { Clue, Condition, Dir, DirEffect, LabEffect, SceneShift, Site } from './types';

export * from './types';
export { CONDITIONS, conditionById } from './conditions';

export const LAB_EFFECTS: readonly LabEffect[] = [...HEMOGRAM, ...LIVER, ...KIDNEY, ...BLOODGAS, ...METABOLIC, ...ENDOCRINE, ...VITAMINS];

const byTest = new Map<string, LabEffect>();
for (const e of LAB_EFFECTS) {
  if (byTest.has(e.test)) throw new Error(`duplicate lab effect ${e.test}`);
  byTest.set(e.test, e);
}

/** Akyuvar alt türlerinin sayı (-abs) ve yüzde (-pct) testleri aynı fizyolojiyi paylaşır. */
const DIFF_BASES = ['neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil', 'ig'];

/** Test anahtarının bilgi tabanındaki karşılığı. */
export function effectKey(testKey: string): string {
  if (byTest.has(testKey)) return testKey;
  const base = testKey.replace(/-(abs|pct)$/, '');
  return DIFF_BASES.includes(base) ? base : testKey;
}

export function labEffect(testKey: string): LabEffect | undefined {
  return byTest.get(effectKey(testKey));
}

/** Yönün etkisi; yön anlamsızsa null (gerekçe `notMeaningful` ile alınır). */
export function directionEffect(testKey: string, dir: Dir): DirEffect | null {
  const e = labEffect(testKey);
  const d = e?.[dir];
  return d && typeof d !== 'string' ? d : null;
}

export function notMeaningful(testKey: string, dir: Dir): string | null {
  const d = labEffect(testKey)?.[dir];
  return typeof d === 'string' ? d : null;
}

export function dirOf(l: Pick<LabObservation, 'status'>): Dir | null {
  return l.status === 'high' ? 'high' : l.status === 'low' ? 'low' : null;
}

/* ------------------------------------------------------------------ olası neden sıralaması */

export type ClueMatch = 'supports' | 'contradicts' | 'not-expected' | 'missing';

export interface ClueResult {
  clue: Clue;
  state: ClueMatch;
  /** Ölçülen sonuç (varsa). */
  lab?: LabObservation;
  /** "Ferritin düşük (12 ng/mL)" gibi kısa açıklama. */
  label: string;
}

export interface CauseRank {
  condition: Condition;
  /** 0–1: ölçülen sonuçların bu nedenin tipik imzasına uyumu (hastalık olasılığı DEĞİL). */
  fit: number;
  supporting: ClueResult[];
  contradicting: ClueResult[];
  missing: ClueResult[];
  /** Kısa gerekçe metni. */
  summary: string;
}

const DIR_TR: Record<Clue['dir'], string> = { high: 'yüksek', low: 'düşük', normal: 'normal' };

function testName(key: string): string {
  return testByKey.get(key)?.nameTr ?? key;
}

function labLabel(l: LabObservation): string {
  const st = l.status === 'high' ? 'yüksek' : l.status === 'low' ? 'düşük' : l.status === 'normal' ? 'aralıkta' : 'belirsiz';
  return `${l.name} ${st} (${l.value.toLocaleString('tr-TR')} ${l.unit})`;
}

/** İpucuyla eşleşen ölçüm: aynı test ya da akyuvar alt türünün sayı/yüzde karşılığı. */
function findLab(byKey: Map<string, LabObservation>, test: string): LabObservation | undefined {
  const direct = byKey.get(test);
  if (direct) return direct;
  const base = test.replace(/-(abs|pct)$/, '');
  if (DIFF_BASES.includes(base)) return byKey.get(`${base}-abs`) ?? byKey.get(`${base}-pct`);
  // Üre ↔ BUN aynı ölçümün iki gösterimi.
  if (test === 'urea') return byKey.get('bun');
  if (test === 'bun') return byKey.get('urea');
  return undefined;
}

function evalClue(clue: Clue, byKey: Map<string, LabObservation>, against = false): ClueResult {
  const lab = findLab(byKey, clue.test);
  const expect = `${testName(clue.test)} ${DIR_TR[clue.dir]}`;
  if (!lab || lab.status === 'unknown') return { clue, state: 'missing', label: expect };
  const matches = lab.status === clue.dir;
  if (against) return { clue, lab, state: matches ? 'contradicts' : 'missing', label: labLabel(lab) };
  if (matches) return { clue, lab, state: 'supports', label: labLabel(lab) };
  // Beklenen yön yüksek/düşükken ölçüm ters yöndeyse çelişir; aralıktaysa "beklenen yönde değil" (zayıf karşı kanıt).
  if (clue.dir !== 'normal' && lab.status === 'normal') return { clue, lab, state: 'not-expected', label: `${labLabel(lab)} — ${DIR_TR[clue.dir]} beklenirdi` };
  return { clue, lab, state: 'contradicts', label: `${labLabel(lab)} — ${DIR_TR[clue.dir]} beklenirdi` };
}

export interface RankOptions {
  sex?: 'female' | 'male';
}

/**
 * Bir durumun kişinin sonuçlarına uyumu. `anchor` verilirse (incelenen test) o ipucu uyumda zaten
 * karşılanmış sayılır ama sayıma katılmaz — skor "diğer sonuçların" desteğini yansıtır.
 */
export function evaluateCondition(c: Condition, labs: readonly LabObservation[], anchor?: string): CauseRank {
  const byKey = new Map(labs.map((l) => [l.testKey, l]));
  const sig = c.signature.map((cl) => evalClue(cl, byKey));
  const ag = (c.against ?? []).map((cl) => evalClue(cl, byKey, true));
  const isAnchor = (r: ClueResult) => Boolean(anchor && (r.clue.test === anchor || effectKey(r.clue.test) === effectKey(anchor)));
  const supporting = sig.filter((r) => r.state === 'supports');
  const contradicting = [...sig.filter((r) => r.state === 'contradicts' || r.state === 'not-expected'), ...ag.filter((r) => r.state === 'contradicts')];
  const missing = sig.filter((r) => r.state === 'missing');
  const w = (r: ClueResult) => r.clue.w ?? 1;
  const others = (rs: ClueResult[]) => rs.filter((r) => !isAnchor(r));
  const S = others(supporting).reduce((s, r) => s + w(r), 0);
  const C = others(contradicting).reduce((s, r) => s + w(r) * (r.state === 'not-expected' ? 0.5 : 1), 0) + ag.filter((r) => r.state === 'contradicts').length * 0.5;
  const M = others(missing).reduce((s, r) => s + w(r), 0);
  // Uyum: destek / (destek + karşı + eksiklerin küçük payı + sabit). Anchor zaten karşılandığı için taban 0,15.
  const base = anchor ? 0.15 : 0;
  const fit = Math.max(0, Math.min(1, base + (S - C) / (S + C + 0.25 * M + 1.5)));
  const parts: string[] = [];
  if (others(supporting).length) parts.push(`${others(supporting).length} sonuç destekliyor`);
  if (contradicting.length) parts.push(`${contradicting.length} sonuç uymuyor`);
  if (others(missing).length) parts.push(`${others(missing).length} test eksik`);
  return { condition: c, fit, supporting, contradicting, missing, summary: parts.join(' · ') || 'Diğer sonuçlarla karşılaştırılacak veri yok' };
}

/**
 * Bir sonucun (test + yön) olası nedenleri, kişinin diğer sonuçlarına göre sıralı. Liste sırası
 * (yaygınlık) eşitlikte korunur. Cinsiyete özgü nedenler, cinsiyet biliniyorsa süzülür.
 */
export function rankCauses(testKey: string, dir: Dir, labs: readonly LabObservation[], opts: RankOptions = {}): CauseRank[] {
  const eff = directionEffect(testKey, dir);
  if (!eff) return [];
  const out = eff.causes
    .map((id) => conditionById.get(id))
    .filter((c): c is Condition => Boolean(c))
    .filter((c) => !c.sex || !opts.sex || c.sex === opts.sex)
    .map((c, i, arr) => ({ r: evaluateCondition(c, labs, testKey), prior: 0.06 * (1 - i / Math.max(1, arr.length)) }));
  out.sort((a, b) => b.r.fit + b.prior - (a.r.fit + a.prior));
  return out.map((x) => x.r);
}

/**
 * Tüm sonuçlara birlikte bakınca: en az iki referans dışı sonucun desteklediği nedenler. Kişinin
 * tablosunu tek tek testlerden bağımsız olarak "birlikte" okur.
 */
export function differential(labs: readonly LabObservation[], opts: RankOptions & { min?: number } = {}): CauseRank[] {
  const abnormal = labs.filter((l) => dirOf(l));
  if (!abnormal.length) return [];
  const min = opts.min ?? 2;
  return CONDITIONS.filter((c) => !c.sex || !opts.sex || c.sex === opts.sex)
    .map((c) => evaluateCondition(c, labs))
    .filter((r) => r.supporting.filter((s) => s.lab && dirOf(s.lab)).length >= min)
    .sort((a, b) => b.fit - a.fit || b.supporting.length - a.supporting.length);
}

/* ------------------------------------------------------------------ iç dünyalara bağ */

export interface InteriorEffect {
  lab: LabObservation;
  dir: Dir;
  site: Site;
  effect: DirEffect;
  /** Basamak eşleşmesi: tam basamak mı, yalnızca organ düzeyi mi? */
  exact: boolean;
}

/** Bu iç dünyada (ve basamakta) kişinin referans dışı sonuçlarının etkisi. */
export function effectsAtInterior(interior: string, stage: string | undefined, labs: readonly LabObservation[]): InteriorEffect[] {
  const out: InteriorEffect[] = [];
  for (const lab of labs) {
    const dir = dirOf(lab);
    if (!dir) continue;
    const eff = directionEffect(lab.testKey, dir);
    if (!eff) continue;
    const sites = eff.sites.filter((s) => s.interior === interior);
    const exact = stage ? sites.find((s) => s.stage === stage) : undefined;
    const site = exact ?? sites[0];
    if (site) out.push({ lab, dir, site, effect: eff, exact: Boolean(exact) || !stage });
  }
  // Önce bu basamağa tam bağlananlar, sonra kritik/şiddetli olanlar.
  const sev = (l: LabObservation) => (l.critical ? 3 : l.severity === 'marked' ? 2 : l.severity === 'moderate' ? 1 : 0);
  return out.sort((a, b) => Number(b.exact) - Number(a.exact) || sev(b.lab) - sev(a.lab));
}

export interface NormalHere {
  testKey: string;
  name: string;
  site: Site;
  /** Normal yolun kaçıncı adımı (1'den). */
  step: number;
  steps: number;
}

/** "Burada normalde ne olur?": normal yolu bu iç dünyadan (basamaktan) geçen testler. */
export function normalAtInterior(interior: string, stage?: string): NormalHere[] {
  const out: NormalHere[] = [];
  for (const e of LAB_EFFECTS) {
    const i = e.normal.path.findIndex((s) => s.interior === interior && (!stage || !s.stage || s.stage === stage));
    if (i >= 0) out.push({ testKey: e.test, name: DIFF_BASES.includes(e.test) ? testName(`${e.test}-abs`).replace(/ \(sayı\)$/, '') : testName(e.test), site: e.normal.path[i]!, step: i + 1, steps: e.normal.path.length });
  }
  return out;
}

/** Sapma derecesine göre görsel etki gücü (hafif sapma yarım etki). */
function strength(l: LabObservation): number {
  if (l.critical) return 1;
  switch (l.severity) {
    case 'borderline':
    case 'mild':
      return 0.55;
    case 'moderate':
      return 0.8;
    default:
      return 1;
  }
}

const MULTIPLIERS = new Set<keyof SceneShift>(['rbc', 'rbcSize', 'wbc', 'plt', 'flow', 'oxygen', 'signal']);

/** İç sahnenin "sonucuma göre" görünümü: bu iç dünyayı etkileyen sonuçların birleşik görsel etkisi. */
export function sceneShiftFor(interior: string, labs: readonly LabObservation[]): { shift: SceneShift; from: Array<{ lab: LabObservation; dir: Dir; keys: Array<keyof SceneShift> }> } {
  const shift: SceneShift = {};
  const from: Array<{ lab: LabObservation; dir: Dir; keys: Array<keyof SceneShift> }> = [];
  for (const fx of effectsAtInterior(interior, undefined, labs)) {
    const sc = fx.effect.scene;
    if (!sc) continue;
    const k = strength(fx.lab);
    const keys: Array<keyof SceneShift> = [];
    for (const [key, raw] of Object.entries(sc) as Array<[keyof SceneShift, number]>) {
      if (typeof raw !== 'number') continue;
      keys.push(key);
      if (MULTIPLIERS.has(key)) {
        const v = 1 + (raw - 1) * k;
        shift[key] = (shift[key] ?? 1) * v;
      } else if (key === 'acid') {
        shift.acid = Math.max(-1, Math.min(1, (shift.acid ?? 0) + raw * k));
      } else {
        shift[key] = Math.max(shift[key] ?? 0, raw * k);
      }
    }
    if (keys.length) from.push({ lab: fx.lab, dir: fx.dir, keys });
  }
  return { shift, from };
}

/** "Nereden nereye girilir?": bir testin normal yolu ve yüksek/düşükte etkilediği tüm iç dünyalar. */
export function entriesForTest(testKey: string): { normal: Site[]; high: Site[]; low: Site[] } {
  const e = labEffect(testKey);
  if (!e) return { normal: [], high: [], low: [] };
  return { normal: e.normal.path, high: directionEffect(testKey, 'high')?.sites ?? [], low: directionEffect(testKey, 'low')?.sites ?? [] };
}

/** Bir iç dünyaya giren testler (normal yolu ya da etkilenen yerleri buradan geçen). */
export function testsForInterior(interior: string): string[] {
  const out = new Set<string>();
  for (const e of LAB_EFFECTS) {
    const all = [...e.normal.path, ...(typeof e.high === 'string' ? [] : e.high.sites), ...(typeof e.low === 'string' ? [] : e.low.sites)];
    if (all.some((s) => s.interior === interior)) out.add(e.test);
  }
  return [...out];
}

/* ------------------------------------------------------------------ doğrulama */

export interface LabEffectIssue {
  where: string;
  detail: string;
}

/** Bilgi tabanının bütünlüğü: her katalog testi, her iç dünya/basamak, her neden ve her imza testi gerçekten var mı? */
export function validateLabEffects(): LabEffectIssue[] {
  const out: LabEffectIssue[] = [];
  const bad = (where: string, detail: string) => out.push({ where, detail });
  for (const t of testByKey.keys()) if (!labEffect(t)) bad(t, 'Katalog testinin etki kaydı yok.');
  const site = (where: string, s: Site) => {
    const d = interiorById(s.interior);
    if (!d) return bad(where, `Olmayan iç dünya: ${s.interior}`);
    if (s.stage && !d.stages.some((x) => x.id === s.stage)) bad(where, `${s.interior} iç dünyasında olmayan basamak: ${s.stage}`);
    if (!s.text.trim()) bad(where, 'Boş metin.');
  };
  const testExists = (k: string) => testByKey.has(k) || DIFF_BASES.includes(k) || testByKey.has(`${k}-abs`);
  for (const e of LAB_EFFECTS) {
    if (!testExists(e.test)) bad(e.test, 'Katalogda olmayan test.');
    if (!e.normal.path.length) bad(e.test, 'Normal yol boş.');
    e.normal.path.forEach((s) => site(`${e.test}/normal`, s));
    for (const dir of ['high', 'low'] as const) {
      const d = e[dir];
      if (typeof d === 'string') {
        if (d.length < 20) bad(`${e.test}/${dir}`, 'Gerekçe çok kısa.');
        continue;
      }
      if (!d.sites.length) bad(`${e.test}/${dir}`, 'Etkilenen yer yok.');
      if (!d.causes.length) bad(`${e.test}/${dir}`, 'Olası neden yok.');
      if (!d.mechanism.length) bad(`${e.test}/${dir}`, 'Mekanizma yok.');
      d.sites.forEach((s) => site(`${e.test}/${dir}`, s));
      for (const c of d.causes) if (!conditionById.has(c)) bad(`${e.test}/${dir}`, `Olmayan neden: ${c}`);
      if (new Set(d.causes).size !== d.causes.length) bad(`${e.test}/${dir}`, 'Yinelenen neden.');
      for (const n of d.next ?? []) if (!testExists(n)) bad(`${e.test}/${dir}`, `Olmayan ek test: ${n}`);
    }
  }
  const ids = new Set<string>();
  for (const c of CONDITIONS) {
    if (ids.has(c.id)) bad(c.id, 'Yinelenen neden kimliği.');
    ids.add(c.id);
    if (!c.signature.length) bad(c.id, 'İmza boş.');
    for (const cl of [...c.signature, ...(c.against ?? [])]) if (!testExists(cl.test)) bad(c.id, `İmzada olmayan test: ${cl.test}`);
    for (const o of c.organs) if (!interiorById(o)) bad(c.id, `Olmayan iç dünya: ${o}`);
  }
  // Her neden en az bir test yönünden ulaşılabilir olmalı (yetim neden yok).
  const reachable = new Set(LAB_EFFECTS.flatMap((e) => (['high', 'low'] as const).flatMap((d) => (typeof e[d] === 'string' ? [] : (e[d] as DirEffect).causes))));
  for (const c of CONDITIONS) if (!reachable.has(c.id)) bad(c.id, 'Hiçbir test yönünden ulaşılamayan neden.');
  return out;
}
