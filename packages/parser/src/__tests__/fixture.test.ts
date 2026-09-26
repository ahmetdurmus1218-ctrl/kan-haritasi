import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseReport, pdfTextToItems, type TextItem } from '../index';

const fixture = fileURLToPath(new URL('../../../../fixtures/reports/sentetik-kan-tahlili.pdf', import.meta.url));

async function extract(path: string): Promise<{ items: TextItem[]; pages: number }> {
  const task = getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    items.push(...pdfTextToItems(content.items as never, p, viewport));
  }
  const pages = doc.numPages;
  await task.destroy();
  return { items, pages };
}

describe('sentetik PDF raporu (gerçek PDF.js metin katmanı)', () => {
  it('14 testin hepsini doğru değer, birim, aralık ve durumla okur', async () => {
    const { items, pages } = await extract(fixture);
    const draft = parseReport(items, { pageCount: pages });
    const m = new Map(draft.rows.map((r) => [r.testKey, r]));
    const expected: Array<[string, number, string]> = [
      ['hemoglobin', 13.9, 'normal'],
      ['wbc', 7.2, 'normal'],
      ['platelet', 251, 'normal'],
      ['glucose', 94, 'normal'],
      ['creatinine', 0.92, 'normal'],
      ['alt', 68, 'high'],
      ['ast', 35, 'normal'],
      ['cholesterol-total', 241, 'high'],
      ['ldl', 178, 'high'],
      ['hdl', 44, 'normal'],
      ['triglyceride', 162, 'high'],
      ['tsh', 2.1, 'normal'],
      ['ferritin', 19, 'low'],
      ['b12', 312, 'normal'],
    ];
    for (const [key, value, status] of expected) {
      expect(m.get(key), key).toMatchObject({ value, status, refSource: 'report' });
      expect(m.get(key)?.issues, key).toEqual([]);
    }
    expect(draft.rows).toHaveLength(14);
    expect(draft.reportDate).toBe('2026-09-12');
    expect(JSON.stringify(draft)).not.toContain('ÖRNEK HASTA');
  });
});
