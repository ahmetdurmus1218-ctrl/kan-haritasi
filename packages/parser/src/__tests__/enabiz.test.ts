import { describe, expect, it } from 'vitest';
import { parseReport, type TextItem } from '../index';

/** Satırları (| ile ayrılmış hücreler) konumlu kelimelere çevirir. */
function screen(rows: string[]): TextItem[] {
  const items: TextItem[] = [];
  rows.forEach((row, i) => {
    let x = 30;
    const y = 80 + i * 44;
    for (const cell of row.split('|').map((c) => c.trim())) {
      for (const word of cell.split(' ').filter(Boolean)) {
        const w = word.length * 11;
        items.push({ text: word, x, y, w, h: 20, page: 1, conf: 91 });
        x += w + 10;
      }
      x += 110;
    }
  });
  return items;
}

describe('e-Nabız düzeni (aralık değerden önce, "/" yerine "-")', () => {
  it('hemogram kartı: ad | referans aralığı | değer birim', () => {
    const d = parseReport(
      screen([
        'ÖZEL GÜRLİFE HOSPİTAL HASTANESİ | 11 MAYIS 2024',
        'Tam Kan (Hemogram)',
        '2 Değer Referans Dışı',
        'İşlem Adı | Referans Aralığı | Değer',
        'Tam Kan (Hemogram) | 0-0 | B',
        'WBC | 3,91-8,77 | 7,7 10^9-L',
        'NE% | 40,3-74,8 | 54,8 %',
        'LY% | 12,2-47,1 | 33,1 %',
        'HGB | 13,6-17,2 | 12,1 g-dL',
        'PLT | 150-400 | 452 10^9-L',
      ]),
      { method: 'ocr' },
    );
    expect(d.reportDate).toBe('2024-05-11');
    const rows = Object.fromEntries(d.rows.map((r) => [r.testKey, r]));
    expect(Object.keys(rows)).toEqual(['wbc', 'neutrophil-pct', 'lymphocyte-pct', 'hemoglobin', 'platelet']);
    expect(rows.wbc!.value).toBe(7.7);
    expect(rows.wbc!.unitKey).toBe('10^9/l');
    expect([rows.wbc!.refMin, rows.wbc!.refMax]).toEqual([3.91, 8.77]);
    expect(rows['neutrophil-pct']!.unitKey).toBe('%');
    expect(rows.hemoglobin!.status).toBe('low');
    expect(rows.platelet!.status).toBe('high');
  });

  it('tek testlik kart: ad kendi satırında, değer iki satır aşağıda', () => {
    const d = parseReport(screen(['TSH', 'Değer Normal', 'Referans Aralığı | Değer', '0,27-4,2 | 1,3 UIU-mL']), { method: 'ocr' });
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]!.testKey).toBe('tsh');
    expect(d.rows[0]!.value).toBe(1.3);
    expect(d.rows[0]!.unitKey).toBe('miu/l');
    expect(d.rows[0]!.refMax).toBe(4.2);
  });

  it('OCR kırıntıları: "»" yüzde, "1049-L" 10^9/L, onay işaretleri yok sayılır', () => {
    const d = parseReport(screen(['WBC | 3,91-8,77 | 7,7 1049-L | VA', 'NE? | 40,3-74,8 | 54,8 » | ww']), { method: 'ocr' });
    expect(d.rows.map((r) => [r.testKey, r.value, r.unitKey])).toEqual([
      ['wbc', 7.7, '10^9/l'],
      ['neutrophil-pct', 54.8, '%'],
    ]);
  });

  it('biyokimya kartı: bayraklar ve farklı birimler', () => {
    const d = parseReport(
      screen([
        'Biyokimya',
        'İşlem Adı | Referans Aralığı | Değer',
        'Glukoz | 70-100 | 126 mg-dL',
        'Kreatinin | 0,67-1,17 | 1,4 mg-dL',
        'ALT | 0-41 | 88 U-L',
        'Sodyum | 136-145 | 139 mmol-L',
      ]),
      { method: 'ocr' },
    );
    expect(d.rows.map((r) => [r.testKey, r.value, r.status])).toEqual([
      ['glucose', 126, 'high'],
      ['creatinine', 1.4, 'high'],
      ['alt', 88, 'high'],
      ['sodium', 139, 'normal'],
    ]);
  });

  it('değeri okunamamış satır "eksik" olarak işaretlenir (aralık değer sanılmaz)', () => {
    const d = parseReport(screen(['LDL Kolesterol | 0 - 130', 'HDL | 40-60 | 52 mg/dL']), { method: 'ocr' });
    expect(d.rows.map((r) => r.testKey)).toEqual(['hdl']);
    expect(d.missing.map((m) => m.testKey)).toEqual(['ldl']);
  });
});
