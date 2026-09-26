import { describe, expect, it } from 'vitest';
import { parseReport, type TextItem } from '../index';

/** Satırları hücrelere böler; `skew` derece eğimle (fotoğraf) konumlar kayar. */
function photo(rows: string[], skewDeg = 0, withCy = true): TextItem[] {
  const t = (skewDeg * Math.PI) / 180;
  const items: TextItem[] = [];
  rows.forEach((row, i) => {
    let x = 40;
    const baseY = 100 + i * 40;
    for (const cell of row.split('|').map((c) => c.trim())) {
      for (const word of cell.split(' ').filter(Boolean)) {
        const w = word.length * 12;
        // Eğik satır: x arttıkça y kayar
        const y = baseY + Math.tan(t) * x;
        items.push({ text: word, x, y, w, h: 22, page: 1, conf: 92, cy: withCy ? baseY + 11 : undefined });
        x += w + 12;
      }
      x += 120;
    }
  });
  return items;
}

const TABLE = [
  'Hemoglobin | 13,9 | g/dL | 13,5 - 17,5',
  'Kreatinin | 0,92 | mg/dL | 0,70 - 1,20',
  'ALT | 68 | U/L | 0 - 41 | H',
  'LDL Kolesterol | 178 | mg/dL | 0 - 130 | H',
];

describe('fotoğraf (OCR) düzeni', () => {
  it('eğik fotoğrafta, eğimi düzeltilmiş satır merkezleriyle tüm satırlar okunur', () => {
    const d = parseReport(photo(TABLE, 3), { method: 'ocr' });
    expect(d.rows.map((r) => [r.testKey, r.value])).toEqual([
      ['hemoglobin', 13.9],
      ['creatinine', 0.92],
      ['alt', 68],
      ['ldl', 178],
    ]);
  });

  it('eğim düzeltmesi olmadan eğik satırlar bölünür (düzeltmenin gerekliliği)', () => {
    const d = parseReport(photo(TABLE, 3, false), { method: 'ocr' });
    expect(d.rows.length).toBeLessThan(4);
  });

  it('OCR değeri kaçırırsa referans aralığı değer sanılmaz; test "okunamadı" listesine düşer', () => {
    const d = parseReport(photo(['Total Kolesterol | mg/dL | < 200', 'LDL Kolesterol | 0 - 130 | mg/dL', 'Glukoz | 94 | mg/dL | 70 - 100']), { method: 'ocr' });
    expect(d.rows.map((r) => r.testKey)).toEqual(['glucose']);
    expect(d.missing.map((m) => m.testKey).sort()).toEqual(['cholesterol-total', 'ldl']);
  });

  it('birimin değerden önce yazıldığı raporlar da okunur', () => {
    const d = parseReport(photo(['Hemoglobin | g/dL | 13,9 | 13,5 - 17,5', 'Kreatinin | mg/dL | 1,45 | 0,70 - 1,20']), { method: 'ocr' });
    expect(d.rows.map((r) => [r.testKey, r.value, r.unitKey, r.refMax, r.status])).toEqual([
      ['hemoglobin', 13.9, 'g/dl', 17.5, 'normal'],
      ['creatinine', 1.45, 'mg/dl', 1.2, 'high'],
    ]);
  });

  it('sayıya yapışan OCR noktalaması temizlenir', () => {
    const d = parseReport(photo(['AST | 35) | U/L | 0 - 40', 'Trombosit | (251 | 10^3/µL | 150 - 400']), { method: 'ocr' });
    expect(d.rows.map((r) => [r.testKey, r.value])).toEqual([
      ['ast', 35],
      ['platelet', 251],
    ]);
  });
});
