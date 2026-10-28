import { describe, expect, it } from 'vitest';
import { parseReport, type TextItem } from '../index';

/**
 * e-Nabız tablosu: [simge] | ad | sonuç | birim | referans; sütunlar sabit x'te. `dx`, `dy`: panelin konumu
 * (iki ekran görüntüsünün yan yana birleştirildiği kolajda sağ panel biraz kaymış olabilir).
 */
function panel(rows: string[], dx: number, dy: number): TextItem[] {
  const cols = [10, 120, 400, 500, 610];
  const items: TextItem[] = [];
  rows.forEach((row, i) => {
    const y = dy + i * 30;
    row.split('|').forEach((cell, c) => {
      let x = dx + cols[c]!;
      for (const word of cell.trim().split(' ').filter(Boolean)) {
        const w = word.length * 9;
        items.push({ text: word, x, y, w, h: 18, page: 1, conf: 90 });
        x += w + 8;
      }
    });
  });
  return items;
}

const LEFT = [
  'o | ALT | 96 | U/L | 0 - 50',
  'o | AST | 71 | U/L | 0 - 50',
  'o | CK | 133.4 | U/L | 0 - 190',
  'o | Glukoz | 88 | mg/dL | 74 - 106',
  'o | Kreatinin | 0.91 | mg/dL | 0.70 - 1.20',
  '© | Ca++ | 1.09 | mmol/L | 1.15 - 1.29',
];
const RIGHT = [
  'o | HGB | 14.7 | g/dL | 11.7 - 18',
  'o | MCV | 89.7 | fL | 78 - 101',
  'o | PLT | 233 | 10^3/µL | 150 - 450',
  'o | LDH | 284 | U/L | 135 - 225',
  'o | Bilirubin, Direkt | 0.21 | mg/dL | 0 - 0.4',
  'o | Üre | 31.6 | mg/dL | 10 - 50',
];

describe('yan yana iki tablo (ekran görüntüsü kolajı)', () => {
  it('aynı yükseklikteki iki tablonun satırları ayrı ayrı okunur', () => {
    const d = parseReport([...panel(LEFT, 40, 120), ...panel(RIGHT, 780, 126)], { method: 'ocr', sex: 'male' });
    const got = Object.fromEntries(d.rows.map((r) => [r.testKey, [r.value, r.status]]));
    expect(got).toEqual({
      alt: [96, 'high'],
      ast: [71, 'high'],
      ck: [133.4, 'normal'],
      glucose: [88, 'normal'],
      creatinine: [0.91, 'normal'],
      'calcium-ionized': [1.09, 'low'],
      hemoglobin: [14.7, 'normal'],
      mcv: [89.7, 'normal'],
      platelet: [233, 'normal'],
      ldh: [284, 'high'],
      'bilirubin-direct': [0.21, 'normal'],
      urea: [31.6, 'normal'],
    });
  });

  it('tek tablo, sütun araları ne kadar geniş olursa olsun bölünmez', () => {
    const d = parseReport(panel(LEFT, 40, 120), { method: 'ocr', sex: 'male' });
    expect(d.rows.map((r) => r.testKey)).toEqual(['alt', 'ast', 'ck', 'glucose', 'creatinine', 'calcium-ionized']);
  });
});

/** Tek satırlık OCR okuması. */
function line(text: string): TextItem[] {
  let x = 20;
  return text.split(' ').map((word) => {
    const it: TextItem = { text: word, x, y: 100, w: word.length * 10, h: 20, page: 1, conf: 90 };
    x += word.length * 10 + 10;
    return it;
  });
}
const one = (text: string) => parseReport(line(text), { method: 'ocr', sex: 'male' }).rows[0];

describe('küçük ekran görüntüsü yazısının OCR hataları', () => {
  it('satır başındaki durum simgesi adın parçası sayılmaz', () => {
    expect(one('İv) Bilirubin, Direkt 0.17 mg/dL 0 - 0.4')?.testKey).toBe('bilirubin-direct');
    expect(one('0 LDH 316 U/L 135 - 225')).toMatchObject({ testKey: 'ldh', value: 316, status: 'high' });
    expect(one('| © EOS# 0.18 10^3/µL 0.01 - 0.82')).toMatchObject({ testKey: 'eosinophil-abs', value: 0.18 });
  });

  it('"Ca++" iyonize kalsiyumdur, toplam kalsiyum değil (OCR\'da "Catt", "Cat t")', () => {
    for (const name of ['Ca++', 'Catt', 'Cat t']) expect(one(`${name} 1.08 mmol/L 1.15 - 1.29`)).toMatchObject({ testKey: 'calcium-ionized', value: 1.08, status: 'low' });
    expect(one('Kalsiyum 9.63 mg/dL 8.6 - 10.5')?.testKey).toBe('calcium');
  });

  it('"%" işaretinin benzerleri (NEUX, LYMPH36, BASO94, MONO9») yüzde testine eşlenir ve doğrulama ister', () => {
    for (const [name, key] of [
      ['NEUX', 'neutrophil-pct'],
      ['LYMPH36', 'lymphocyte-pct'],
      ['BASO94', 'basophil-pct'],
      ['MONO9»', 'monocyte-pct'],
    ]) {
      const r = one(`${name} 10.2 % 4.3 - 54.6`);
      expect(r?.testKey).toBe(key);
      expect(r?.issues).toContain('PERCENT_GUESSED');
    }
    // Birimsiz satırda aralığın başındaki 9 "%" sanılmaz.
    expect(one('MONO% 10.2 9 - 15')).toMatchObject({ testKey: 'monocyte-pct', refMin: 9, refMax: 15 });
  });

  it('aralıkta kaybolan ondalık noktası değeri "düşük" göstermez; düzeltilir ve doğrulama ister', () => {
    const r = one('RBC 5.26 10^6/µL 40-62');
    expect(r).toMatchObject({ testKey: 'rbc', status: 'normal', refMin: 4, refMax: 6.2 });
    expect(r?.issues).toContain('RANGE_DECIMAL_GUESSED');
  });

  it('değerde kaybolan ondalık noktası değeri "yüksek" göstermez; düzeltilir ve doğrulama ister', () => {
    expect(one('EOS% 23 % 0.02 - 7.6')).toMatchObject({ testKey: 'eosinophil-pct', value: 2.3, status: 'normal' });
    expect(one('EOS% 23 % 0.02 - 7.6')?.issues).toContain('AMBIGUOUS_DECIMAL');
    // "0.3" → "03", "0.01-1.2" → "001-12"
    expect(one('BASO% 03 % 001-12')).toMatchObject({ testKey: 'basophil-pct', value: 0.3, status: 'normal', refMin: 0.01 });
  });

  it('gerçekten aralık dışı tamsayı değere dokunulmaz', () => {
    expect(one('ALT 282 U/L 0 - 50')).toMatchObject({ value: 282, status: 'high', issues: [] });
    expect(one('Glukoz 250 mg/dL 74 - 106')).toMatchObject({ value: 250, status: 'high' });
  });

  it('olanaksız değere "yüksek/düşük" denmez (ör. "1.08" → "108")', () => {
    const r = one('Ca++ 108 mmol/L');
    expect(r?.status).toBe('unknown');
    expect(r?.issues).toContain('IMPLAUSIBLE');
  });
});
