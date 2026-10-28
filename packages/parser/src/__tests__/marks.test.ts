import { describe, expect, it } from 'vitest';
import { applyReportMarks, parseReport, type ReportMark, type SourceBox, type TextItem } from '../index';

/** Her satır ayrı bir y'de; kelimeler soldan sağa. */
function table(lines: string[]): TextItem[] {
  const items: TextItem[] = [];
  lines.forEach((text, i) => {
    let x = 20;
    for (const word of text.split(' ')) {
      items.push({ text: word, x, y: 100 + i * 30, w: word.length * 10, h: 20, page: 1, conf: 92 });
      x += word.length * 10 + 10;
    }
  });
  return items;
}

const parse = (lines: string[]) => parseReport(table(lines), { method: 'ocr', sex: 'male' });

/** Satırın y'sine göre işaret: `marks[i]` i. satırın işareti. */
const byLine = (marks: Array<ReportMark | undefined>) => (box: SourceBox) => marks[Math.round((box.y - 100) / 30)];

describe('raporda aralık yoksa genel aralığa göre "yüksek/düşük" denmez', () => {
  it('genel aralığın dışındaki değer "belirsiz" ve doğrulama ister', () => {
    const r = parse(['Total bilirubin 0.1 mg/dL']).rows[0]!;
    expect(r).toMatchObject({ testKey: 'bilirubin-total', status: 'unknown', refSource: 'catalog' });
    expect(r.issues).toContain('RANGE_GENERIC');
  });

  it('genel aralığın içindeki değer "normal"', () => {
    expect(parse(['Total bilirubin 0.6 mg/dL']).rows[0]).toMatchObject({ status: 'normal', refSource: 'catalog' });
  });

  it('raporun kendi H/L işareti varsa yön ondan alınır', () => {
    const r = parse(['Glukoz 250 H mg/dL']).rows[0]!;
    expect(r.status).toBe('high');
    expect(r.issues).not.toContain('RANGE_GENERIC');
  });
});

describe('raporun renkli işaretleriyle teyit', () => {
  const lines = ['ALT 96 U/L 0 - 50', 'AST 31 U/L 0 - 50', 'Glukoz 88 mg/dL 74 - 106', 'Total bilirubin 0.1 mg/dL', 'Kreatinin 0.91 mg/dL 0.70 - 1.20'];

  it('yeşil onaylı, aralığı olmayan satır "normal" olur; uyuşan işaretler sorun çıkarmaz', () => {
    const d = applyReportMarks(parse(lines), byLine(['out', 'in', 'in', 'in', 'in']));
    const got = Object.fromEntries(d.rows.map((r) => [r.testKey, [r.status, r.reportMark, r.issues.includes('MARK_CONFLICT')]]));
    expect(got).toEqual({
      alt: ['high', 'out', false],
      ast: ['normal', 'in', false],
      glucose: ['normal', 'in', false],
      'bilirubin-total': ['normal', 'in', false],
      creatinine: ['normal', 'in', false],
    });
    expect(d.rows.find((r) => r.testKey === 'bilirubin-total')!.issues).not.toContain('RANGE_GENERIC');
  });

  it('kırmızı işaretli, aralığı olmayan satırın yönü genel aralıktan', () => {
    const d = applyReportMarks(parse(lines), byLine(['out', 'in', 'in', 'out', 'in']));
    const r = d.rows.find((x) => x.testKey === 'bilirubin-total')!;
    expect(r.status).toBe('low');
    expect(r.issues).not.toContain('MARK_CONFLICT');
  });

  it('okunan değer işaretle çelişirse durum işarete göre gösterilir ve doğrulama istenir', () => {
    // Raporda "8.8" (aralıkta) ama OCR "88" okudu → aralık dışı hesaplanır; satırda yeşil onay var.
    const d = applyReportMarks(parse(['ALT 96 U/L 0 - 50', 'Potasyum 8.8 mmol/L 3.5 - 5.1', 'Glukoz 88 mg/dL 74 - 106', 'Sodyum 140 mmol/L 136 - 145', 'Klor 101 mmol/L 98 - 107']), byLine(['out', 'in', 'in', 'in', 'in']));
    const k = d.rows.find((r) => r.testKey === 'potassium')!;
    expect(k.status).toBe('normal');
    expect(k.issues).toContain('MARK_CONFLICT');
  });

  it('işaretler okunan değerlerin çoğuyla çelişiyorsa hiç kullanılmaz', () => {
    const draft = parse(lines);
    const d = applyReportMarks(draft, byLine(['in', 'out', 'out', 'in', 'out']));
    expect(d).toBe(draft);
  });

  it('her satır "aralık dışı" görünüyorsa (renkli zemin) işaretler kullanılmaz', () => {
    const draft = parse(lines);
    expect(applyReportMarks(draft, () => 'out')).toBe(draft);
  });

  it('katalogda olmayan satır raporun kendi aralığıyla değerlendirilir ve işaretle teyit edilir', () => {
    const d = parse(['tHb 16.2 g/dL 11.5 - 17.4', 'FHHB 18.9 %', 'ALT 96 U/L 0 - 50', 'AST 31 U/L 0 - 50']);
    expect(d.unrecognized.map((u) => [u.rawName, u.value, u.status])).toEqual([
      ['tHb', 16.2, 'normal'],
      ['FHHB', 18.9, 'unknown'],
    ]);
    const marked = applyReportMarks(d, byLine(['in', 'in', 'out', 'in']));
    expect(marked.unrecognized.map((u) => u.status)).toEqual(['normal', 'normal']);
  });
});

describe('kan gazı ve spot idrar testleri', () => {
  it('kan gazı satırları tanınır; "7.390" binlik ayırıcı sanılmaz', () => {
    const d = parse(['pH 7.390 7.32 - 7.42', 'pCO2 49.3 mmHg 32 - 48', 'pO2 46.8 mmHg 80 - 108', 'HCO3-(p,st) 27.1 mmol/L 21.8 - 26.9', 'sO2 80.8 % 95 - 99', 'Base(Ecf) 4.8 mmol/L', 'Lac 1.4 mmol/L 0.5 - 1.6']);
    const got = Object.fromEntries(d.rows.map((r) => [r.testKey, [r.value, r.status]]));
    expect(got).toEqual({
      ph: [7.39, 'normal'],
      pco2: [49.3, 'high'],
      po2: [46.8, 'low'],
      hco3: [27.1, 'high'],
      so2: [80.8, 'low'],
      'base-excess': [4.8, 'unknown'],
      lactate: [1.4, 'normal'],
    });
    expect(d.rows.find((r) => r.testKey === 'ph')!.issues).toEqual([]);
  });

  it('idrar pH\'ı ("6.0") kan pH\'ı sanılmaz', () => {
    const d = parse(['pH 6.0 5 - 8']);
    expect(d.rows).toEqual([]);
    expect(d.unrecognized[0]).toMatchObject({ rawName: 'pH', value: 6, status: 'normal' });
  });

  it('spot idrar kreatinini serum kreatininiyle karışmaz', () => {
    const d = parse(['Spot Kreatinin (İdrar) 150.5 mg/dL 39 - 259', 'Kreatinin (idrar) 98 mg/dL 39 - 259', 'Kreatinin 0.85 mg/dL 0.70 - 1.20']);
    expect(d.rows.map((r) => [r.testKey, r.status])).toEqual([
      ['urine-creatinine', 'normal'],
      ['creatinine', 'normal'],
    ]);
    expect(d.rows[0]!.issues).toContain('DUPLICATE');
  });

  it('küçük ekran yazısındaki OCR karışıklıkları ("Het", "Nat", "BaselEcf)", "02Hb")', () => {
    const d = parse(['Het 49.6 % 36 - 53', 'Nat 141 mmol/L 135 - 146', 'BaselEcf) 4.8 mmol/L', 'Çı) 02Hb 79.4 % 94 - 98']);
    expect(d.rows.map((r) => r.testKey)).toEqual(['hematocrit', 'sodium', 'base-excess', 'o2hb']);
  });
});
