import { describe, expect, it } from 'vitest';
import { mergeOcrDrafts, parseReport, type TextItem } from '../index';

function words(rows: string[]): TextItem[] {
  const items: TextItem[] = [];
  rows.forEach((row, i) => {
    let x = 20;
    for (const w of row.split(' ')) {
      items.push({ text: w, x, y: 100 + i * 30, w: w.length * 8, h: 14, page: 1, conf: 92 });
      x += w.length * 8 + 12;
    }
  });
  return items;
}

describe('iki OCR okumasının birleştirilmesi', () => {
  it('uyuşan değerler kalır, uyuşmayanlar doğrulamaya düşer, yalnız birinde olanlar eklenir', () => {
    const a = parseReport(words(['Hemoglobin 13,9 g/dL 13,5 - 17,5', 'AST 25 U/L 0 - 40', 'Glukoz 94 mg/dL 70 - 100']), { method: 'ocr' });
    const b = parseReport(words(['Hemoglobin 13,9 g/dL 13,5 - 17,5', 'AST 35 U/L 0 - 40', 'ALT 68 U/L 0 - 41']), { method: 'ocr' });
    const m = mergeOcrDrafts(a, b);
    const by = new Map(m.rows.map((r) => [r.testKey, r]));
    expect([...by.keys()].sort()).toEqual(['alt', 'ast', 'glucose', 'hemoglobin']);
    expect(by.get('hemoglobin')!.issues).toEqual([]);
    expect(by.get('ast')!.issues).toContain('OCR_DISAGREE');
    expect(by.get('ast')!.confidence).toBeLessThanOrEqual(0.5);
    // Okuma sırası korunur
    expect(m.rows.map((r) => r.testKey).slice(0, 2)).toEqual(['hemoglobin', 'ast']);
  });
});
