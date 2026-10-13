/**
 * Birden çok yerel modelin sonuçlarını KÖRÜ KÖRÜNE birleştirmeden karşılaştırır. Uyuşmazlık varsa
 * "Modeller arasında uyuşmazlık var" diye, iki tarafın ne dediğiyle birlikte gösterilir; hiçbiri seçilmez.
 *
 * Kurallar veriyle tanımlıdır (hastalığa özel kod yok):
 *  - Skor ↔ ölçüm: bir sınıflandırıcının skoru ile başka bir modelin maskelerinden hesaplanan ölçüm çelişirse
 *    (ör. kardiyomegali skoru ↔ kardiyotorasik oran).
 *  - Konum ↔ anatomi: bir model bulguyu bir yapıda bildiriyor, o yapıyı bölütleyebilen anatomi modeli ise
 *    bu görüntüde o yapıyı hiç bulamadıysa.
 *  - Aynı bulgu, iki modelde zıt sonuç (biri eşik üstü, diğeri belirgin biçimde altı).
 */
import type { MedicalFinding, ModelStructure } from './types';

export interface ModelResultSummary {
  modelId: string;
  modelName: string;
  findings: MedicalFinding[];
  structures: ModelStructure[];
  /** Çok etiketli modelin tüm skorları (anahtar → skor). */
  scores?: Array<{ key: string; name: string; score: number }>;
  /** Maskelerden hesaplanan ölçümler (anahtar → değer), ör. ctr. */
  measures?: Record<string, number>;
  /** Bu modelin bölütleyebildiği 3B yapılar (manifest etiketlerinden). */
  segmentable?: string[];
}

export interface ModelDisagreement {
  id: string;
  text: string;
  models: [string, string];
  structure?: string;
}

const fmt = (x: number) => x.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

/** Skor ↔ ölçüm kuralları (veri). */
export const SCORE_MEASURE_RULES: Array<{ id: string; scoreKey: string; measure: string; structure: string; highScore: number; lowScore: number; measureHigh: number; measureLow: number; scoreName: string; measureName: string }> = [
  { id: 'cardiomegaly-ctr', scoreKey: 'Cardiomegaly', measure: 'ctr', structure: 'heart', highScore: 0.6, lowScore: 0.5, measureHigh: 0.55, measureLow: 0.5, scoreName: 'kardiyomegali skoru', measureName: 'kardiyotorasik oran (maskelerden, yaklaşık)' },
];

export function modelDisagreements(results: readonly ModelResultSummary[]): ModelDisagreement[] {
  const out: ModelDisagreement[] = [];
  for (const a of results)
    for (const b of results) {
      if (a === b) continue;
      // 1) skor ↔ ölçüm
      for (const r of SCORE_MEASURE_RULES) {
        const s = a.scores?.find((x) => x.key === r.scoreKey)?.score;
        const m = b.measures?.[r.measure];
        if (s === undefined || m === undefined) continue;
        if ((s >= r.highScore && m < r.measureLow) || (s < r.lowScore && m >= r.measureHigh))
          out.push({
            id: `${r.id}:${a.modelId}:${b.modelId}`,
            models: [a.modelName, b.modelName],
            structure: r.structure,
            text: `Modeller arasında uyuşmazlık var: ${a.modelName} ${r.scoreName} ${fmt(s)} (${s >= r.highScore ? 'yüksek' : 'düşük'}), ${b.modelName} ${r.measureName} ${fmt(m)} (${m >= r.measureHigh ? 'yüksek' : 'olağan sınırda'}). İki sonuç ayrı gösterilir; değerlendirme hekime aittir.`,
          });
      }
      // 2) konum ↔ anatomi
      if (b.segmentable?.length)
        for (const f of a.findings) {
          const st = f.anatomicalStructure?.structure;
          if (!st || !b.segmentable.includes(st)) continue;
          if (b.structures.some((x) => x.anatomicalStructure?.structure === st)) continue;
          out.push({
            id: `loc:${f.id}:${b.modelId}`,
            models: [a.modelName, b.modelName],
            structure: st,
            text: `Modeller arasında uyuşmazlık var: ${a.modelName} "${f.finding}" bildiriyor; ${b.modelName} bu görüntüde ilgili yapıyı bölütlemedi.`,
          });
        }
      // 3) aynı bulgu, zıt sonuç
      for (const sa of a.scores ?? []) {
        const sb = b.scores?.find((x) => x.key === sa.key);
        if (sb && a.modelId < b.modelId && ((sa.score >= 0.6 && sb.score < 0.4) || (sb.score >= 0.6 && sa.score < 0.4)))
          out.push({ id: `same:${sa.key}:${a.modelId}:${b.modelId}`, models: [a.modelName, b.modelName], text: `Modeller arasında uyuşmazlık var: "${sa.name}" için ${a.modelName} ${fmt(sa.score)}, ${b.modelName} ${fmt(sb.score)}.` });
      }
    }
  return out;
}
