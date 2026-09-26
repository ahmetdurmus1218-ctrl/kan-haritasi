import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { mergeOcrDrafts, parseReport } from '@kh/parser';
import { ocrLinesToItems, type OcrLine } from '../lib/ocrItems';
import { VERIFY_ISSUES } from '../lib/reports';

/**
 * Görüntü raporları gerçek Tesseract (uygulamayla aynı Türkçe model) ile okunur ve ayrıştırılır.
 * Tarayıcıdaki ön işleme (kırpma, gri ton, ölçek) burada yoktur; uçtan uca test (tests/e2e/reports.py)
 * aynı dosyaları uygulamanın kendisiyle okur. Asıl güvence: yanlış okunan her değer "doğrulaman gerekiyor" diye işaretlenmelidir.
 */
const dir = fileURLToPath(new URL('../../../../fixtures/reports/', import.meta.url));
const require = createRequire(import.meta.url);
const langPath = join(dirname(require.resolve('@tesseract.js-data/tur/package.json')), '4.0.0_best_int');

interface Expected {
  kind: string;
  sex: 'male' | 'female';
  rows: Array<{ key: string; value: number; status: string | null }>;
}
const EXPECTED = JSON.parse(readFileSync(dir + 'expected.json', 'utf8')) as Record<string, Expected>;

/** Dosya başına en az kaç satırın doğru okunması gerektiği (bilinen OCR sınırları not edildi). */
const MIN_CORRECT: Record<string, number> = {
  'sentetik-kan-tahlili.png': 9,
  // Eğik telefon fotoğrafı: "0,7 %" satırı "0/7 V" okunuyor → eksik kalır, elle girilir.
  'hemogram-foto.jpg': 18,
  'hormon-erkek.png': 8,
  // "LY%" adı "YY" okunuyor → tanınamaz; kullanıcı elle ekler.
  'enabiz-ekran.png': 6,
};

let worker: Worker;
beforeAll(async () => {
  worker = await createWorker('tur', OEM.LSTM_ONLY, { langPath, gzip: true, cacheMethod: 'none' });
  await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
}, 60_000);
afterAll(async () => {
  await worker?.terminate();
});

describe('görüntü raporları (gerçek OCR)', () => {
  it.each(Object.keys(MIN_CORRECT))(
    '%s',
    async (name) => {
      const exp = EXPECTED[name]!;
      // Uygulamadaki gibi: iki bölütleme kipi (tek blok, otomatik) okunur ve birleştirilir.
      const drafts = [];
      for (const psm of ['6', '3']) {
        await worker.setParameters({ tessedit_pageseg_mode: psm as never });
        const { data } = await worker.recognize(readFileSync(dir + name), {}, { blocks: true, text: false });
        const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)) as unknown as OcrLine[];
        drafts.push(parseReport(ocrLinesToItems(lines, 1, 1), { method: 'ocr', sex: exp.sex }));
      }
      const draft = mergeOcrDrafts(drafts[0]!, drafts[1]!);
      const byKey = new Map(exp.rows.map((r) => [r.key, r]));
      let correct = 0;
      const silentErrors: string[] = [];
      for (const row of draft.rows) {
        const e = byKey.get(row.testKey);
        const right = e && e.value === row.value && (e.status ?? 'unknown') === row.status;
        if (right) correct++;
        // Yanlış (ya da raporda olmayan) bir satır sessizce kaydedilmemeli: doğrulama istemeli.
        else if (!row.issues.some((i) => VERIFY_ISSUES.includes(i))) silentErrors.push(`${row.testKey}=${row.value} (${row.status})`);
      }
      expect(silentErrors, `${name}: doğrulama istemeyen hatalı satırlar`).toEqual([]);
      expect(correct, `${name}: doğru okunan satır`).toBeGreaterThanOrEqual(MIN_CORRECT[name]!);
    },
    60_000,
  );
});
