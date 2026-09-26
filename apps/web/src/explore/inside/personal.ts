import { type Finding, type Interpretation, type Pattern, formatNumber, testByKey } from '@kh/catalog';
import type { InsideId } from './registry';

/**
 * İçeri-gir sahnelerini kişinin değerlerine bağlar. Her sahne birkaç "düğme" (param) okur:
 * 1 = tipik düzey. Sonuç yoksa düğme tipik değerde kalır. Oranlar görselleştirme içindir,
 * gerçek hücre/parçacık sayısı değildir; arayüz bunu açıkça yazar.
 */

export type SceneParams = Record<string, number>;

interface Knob {
  /** Sahnedeki düğme adı. */
  param: string;
  /** Öncelik sırasıyla aranan testler (ilk bulunan kullanılır). */
  tests: string[];
  /** Tipik (orta) değer, kanonik birimde. `uln` ise değer üst sınırın katı olarak kullanılır. */
  typical: number | 'uln';
  min: number;
  max: number;
  /** Sahnede neyin değiştiği (ör. "LDL parçacıklarının yoğunluğu"). */
  what: string;
}

const KNOBS: Record<InsideId, Knob[]> = {
  damar: [
    { param: 'ldl', tests: ['ldl'], typical: 100, min: 0.3, max: 2.6, what: 'LDL parçacıklarının yoğunluğu' },
    { param: 'hdl', tests: ['hdl'], typical: 55, min: 0.35, max: 2, what: 'HDL parçacıklarının yoğunluğu' },
    { param: 'tg', tests: ['triglyceride'], typical: 100, min: 0.4, max: 8, what: 'plazmanın bulanıklığı (trigliserid taşıyan parçacıklar)' },
    { param: 'rbc', tests: ['hemoglobin', 'rbc'], typical: 14, min: 0.4, max: 1.35, what: 'alyuvar yoğunluğu' },
    { param: 'rbcSize', tests: ['mcv'], typical: 90, min: 0.72, max: 1.3, what: 'alyuvar büyüklüğü' },
    { param: 'plt', tests: ['platelet'], typical: 250, min: 0.12, max: 3, what: 'trombosit sayısı' },
    { param: 'inflam', tests: ['hs-crp', 'crp'], typical: 'uln', min: 0, max: 8, what: 'damar iç yüzeyindeki inflamasyon işaretleri' },
  ],
  alveol: [
    { param: 'rbc', tests: ['hemoglobin', 'rbc'], typical: 14, min: 0.4, max: 1.35, what: 'kılcallardaki alyuvar sayısı ve taşınan oksijen' },
    { param: 'rbcSize', tests: ['mcv'], typical: 90, min: 0.72, max: 1.3, what: 'alyuvar büyüklüğü' },
  ],
  nefron: [
    { param: 'gfr', tests: ['egfr'], typical: 100, min: 0.08, max: 1.3, what: 'glomerülden süzülen sıvı miktarı' },
    { param: 'crea', tests: ['creatinine'], typical: 0.9, min: 0.4, max: 6, what: 'kandaki kreatinin parçacıkları' },
    { param: 'urea', tests: ['urea', 'bun'], typical: 30, min: 0.3, max: 5, what: 'kandaki üre' },
    { param: 'alb', tests: ['albumin'], typical: 4.3, min: 0.4, max: 1.3, what: 'kandaki albumin' },
  ],
  lobul: [
    { param: 'alt', tests: ['alt', 'ast'], typical: 'uln', min: 0, max: 12, what: 'hepatositlerden kana geçen enzim miktarı' },
    { param: 'bili', tests: ['bilirubin-total'], typical: 0.7, min: 0.3, max: 12, what: 'safra/bilirubin rengi' },
    { param: 'alb', tests: ['albumin'], typical: 4.3, min: 0.4, max: 1.3, what: 'hepatositlerin ürettiği albumin' },
    { param: 'ggt', tests: ['ggt', 'alp'], typical: 'uln', min: 0, max: 10, what: 'safra kanalı çevresindeki enzim işaretleri' },
  ],
  adacik: [
    { param: 'glucose', tests: ['glucose'], typical: 90, min: 0.5, max: 4.5, what: 'kılcallardaki glukoz' },
    { param: 'a1c', tests: ['hba1c'], typical: 5.2, min: 0.7, max: 2.8, what: 'glukozun yapıştığı (glikozillenmiş) parçacıklar' },
    { param: 'insulin', tests: ['insulin'], typical: 8, min: 0.2, max: 6, what: 'salgılanan insülin granülleri' },
  ],
  folikul: [
    { param: 'tsh', tests: ['tsh'], typical: 2, min: 0.02, max: 10, what: 'foliküllere ulaşan TSH sinyali' },
    { param: 't4', tests: ['ft4'], typical: 1.3, min: 0.2, max: 4, what: 'kana verilen T4' },
    { param: 't3', tests: ['ft3'], typical: 3.2, min: 0.2, max: 4, what: 'kana verilen T3' },
  ],
  ilik: [
    { param: 'rbc', tests: ['hemoglobin', 'rbc'], typical: 14, min: 0.4, max: 1.35, what: 'kana çıkan alyuvarlar' },
    { param: 'rbcSize', tests: ['mcv'], typical: 90, min: 0.72, max: 1.3, what: 'alyuvar büyüklüğü' },
    { param: 'wbc', tests: ['wbc'], typical: 7, min: 0.1, max: 5, what: 'akyuvarlar' },
    { param: 'plt', tests: ['platelet'], typical: 250, min: 0.1, max: 3, what: 'trombositler' },
    { param: 'iron', tests: ['ferritin', 'iron'], typical: 80, min: 0.05, max: 4, what: 'alyuvar öncüllerine ulaşan demir' },
  ],
  kan: [
    { param: 'rbc', tests: ['rbc', 'hemoglobin'], typical: 14, min: 0.4, max: 1.35, what: 'alyuvar sayısı' },
    { param: 'rbcSize', tests: ['mcv'], typical: 90, min: 0.72, max: 1.3, what: 'alyuvar büyüklüğü' },
    { param: 'rbcColor', tests: ['mch'], typical: 29, min: 0.6, max: 1.3, what: 'alyuvar renginin koyuluğu (içindeki hemoglobin)' },
    { param: 'neutrophil', tests: ['neutrophil-abs', 'neutrophil-pct'], typical: 4.2, min: 0.05, max: 5, what: 'nötrofil sayısı' },
    { param: 'lymphocyte', tests: ['lymphocyte-abs', 'lymphocyte-pct'], typical: 2.1, min: 0.05, max: 5, what: 'lenfosit sayısı' },
    { param: 'monocyte', tests: ['monocyte-abs', 'monocyte-pct'], typical: 0.42, min: 0.05, max: 6, what: 'monosit sayısı' },
    { param: 'eosinophil', tests: ['eosinophil-abs', 'eosinophil-pct'], typical: 0.2, min: 0.05, max: 10, what: 'eozinofil sayısı' },
    { param: 'basophil', tests: ['basophil-abs', 'basophil-pct'], typical: 0.05, min: 0.05, max: 10, what: 'bazofil sayısı' },
    { param: 'plt', tests: ['platelet'], typical: 250, min: 0.1, max: 3, what: 'trombosit sayısı' },
  ],
};

/** Hemoglobinin sahne karşılığı: RBC testi varsa (10⁶/µL) tipik 4,8. */
const TYPICAL_OVERRIDE: Record<string, number> = {
  rbc: 4.8,
  bun: 14,
  iron: 100,
  // Akyuvar yüzdeleri (mutlak sayı yoksa): tipik dağılım
  'neutrophil-pct': 60,
  'lymphocyte-pct': 30,
  'monocyte-pct': 6,
  'eosinophil-pct': 3,
  'basophil-pct': 1,
};

export interface PersonalLine {
  finding: Finding;
  param: string;
  factor: number;
  /** "LDL parçacıklarının yoğunluğu tipik düzeyin ~1,8 katı" */
  effect: string;
}

export interface ScenePersonal {
  params: SceneParams;
  typical: SceneParams;
  lines: PersonalLine[];
  patterns: Pattern[];
  /** Sahneyle ilişkili olup sonucu olmayan testler. */
  missing: string[];
}

function ratio(factor: number): string {
  if (Math.abs(factor - 1) < 0.12) return 'tipik düzeye yakın';
  if (factor > 1) return `tipik düzeyin ~${formatNumber(factor, factor >= 3 ? 0 : 1)} katı`;
  return `tipik düzeyin ~%${Math.max(1, Math.round(factor * 100))}’i`;
}

export function typicalParams(scene: InsideId): SceneParams {
  const out: SceneParams = {};
  for (const k of KNOBS[scene]) out[k.param] = k.typical === 'uln' ? 0.5 : 1;
  return out;
}

export function personalFor(scene: InsideId, interp: Interpretation, sceneTests: string[]): ScenePersonal {
  const byKey = new Map(interp.findings.map((f) => [f.testKey, f]));
  const typical = typicalParams(scene);
  const params: SceneParams = { ...typical };
  const lines: PersonalLine[] = [];
  const used = new Set<string>();
  for (const k of KNOBS[scene]) {
    const f = k.tests.map((t) => byKey.get(t)).find((x) => x && x.canonical);
    if (!f) continue;
    used.add(f.testKey);
    let factor: number;
    let effect: string;
    if (k.typical === 'uln') {
      const uln = f.uln ?? 0.5;
      factor = Math.max(k.min, Math.min(k.max, uln));
      effect = `${k.what}: ${uln > 1 ? `üst sınırın ${formatNumber(uln, 1)} katına göre artırıldı` : 'aralık içinde, az miktarda'}`;
    } else {
      const typ = TYPICAL_OVERRIDE[f.testKey] ?? k.typical;
      factor = Math.max(k.min, Math.min(k.max, f.value / typ));
      effect = `${k.what}: ${ratio(factor)}`;
    }
    params[k.param] = factor;
    lines.push({ finding: f, param: k.param, factor, effect });
  }
  // Kan sahnesi: akyuvar türü yüzdeyle verildiyse toplam akyuvar sayısıyla ölçeklenir (yüzde × toplam = sayı).
  if (scene === 'kan') {
    const wbc = byKey.get('wbc');
    const wbcFactor = wbc && wbc.canonical ? Math.max(0.1, Math.min(4, wbc.value / 7)) : 1;
    for (const l of lines) {
      if (/-pct$/.test(l.finding.testKey) && wbcFactor !== 1) {
        l.factor = Math.max(0.05, Math.min(10, l.factor * wbcFactor));
        params[l.param] = l.factor;
        l.effect = `${l.effect.split(':')[0]}: yüzde × toplam akyuvar → ${ratio(l.factor)}`;
      }
    }
    if (wbc && !lines.some((l) => l.finding.testKey === 'wbc')) {
      used.add('wbc');
      const types = ['neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil'];
      const hasDiff = lines.some((l) => types.includes(l.param));
      if (wbc.canonical && !hasDiff) {
        // Alt türler yoksa toplam sayı tüm türleri aynı oranda ölçekler (tipik dağılım varsayılır).
        for (const t of types) params[t] = wbcFactor;
        lines.push({ finding: wbc, param: 'wbc', factor: wbcFactor, effect: `akyuvar sayısı (tipik tür dağılımıyla): ${ratio(wbcFactor)}` });
      } else {
        lines.push({ finding: wbc, param: '', factor: 1, effect: '' });
      }
    }
  }
  // Düğmesi olmayan ama sahneyle ilişkili sonuçlar da listede görünür (yalnızca metin).
  for (const key of sceneTests) {
    const f = byKey.get(key);
    if (f && !used.has(key)) {
      used.add(key);
      lines.push({ finding: f, param: '', factor: 1, effect: '' });
    }
  }
  const keys = new Set([...sceneTests, ...KNOBS[scene].flatMap((k) => k.tests)]);
  const patterns = interp.patterns.filter((p) => p.scene === scene || p.tests.some((t) => keys.has(t) && used.has(t)));
  const missing = [...new Set(KNOBS[scene].map((k) => k.tests[0]!))].filter((t) => !byKey.has(t) && testByKey.has(t));
  return { params, typical, lines, patterns, missing };
}
