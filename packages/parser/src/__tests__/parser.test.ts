import { describe, expect, it } from 'vitest';
import { normalizeUnit, parseNumber, matchTestName, catalogRange, testByKey, statusFor } from '@kh/catalog';
import { parseReport, parseRange, needsReview, type TextItem } from '../index';

/** "Hücre1 | Hücre2 | ..." biçimindeki satırları konumlu metin parçalarına çevirir. */
function layout(rows: string[], page = 1): TextItem[] {
  const items: TextItem[] = [];
  rows.forEach((row, i) => {
    let x = 40;
    for (const cell of row.split('|').map((c) => c.trim())) {
      if (cell) items.push({ text: cell, x, y: 100 + i * 18, w: cell.length * 5, h: 10, page });
      x += Math.max(90, cell.length * 5 + 20);
    }
  });
  return items;
}

describe('sayı ve birim', () => {
  it('Türkçe ondalık virgül: 17,8 asla 178 olmaz', () => {
    expect(parseNumber('17,8')?.value).toBe(17.8);
    expect(parseNumber('0,92')?.value).toBe(0.92);
    expect(parseNumber('1.234,5')?.value).toBe(1234.5);
    expect(parseNumber('13.9')?.value).toBe(13.9);
    expect(parseNumber('<5')).toEqual({ value: 5, qualifier: '<' });
    expect(parseNumber('≥ 40')).toEqual({ value: 40, qualifier: '>=' });
  });

  it('belirsiz binlik: sayım biriminde binlik, diğerlerinde ondalık + işaret', () => {
    expect(parseNumber('7.200', true)?.value).toBe(7200);
    expect(parseNumber('7.200')).toEqual({ value: 7.2, ambiguous: true });
    expect(parseNumber('1,234')).toEqual({ value: 1.234, ambiguous: true });
  });

  it('birim yazımları tek anahtara iner', () => {
    expect(normalizeUnit('mg/dL')).toBe('mg/dl');
    expect(normalizeUnit('x10³/µL')).toBe('10^3/ul');
    expect(normalizeUnit('10^3/uL')).toBe('10^3/ul');
    expect(normalizeUnit('K/uL')).toBe('10^3/ul');
    expect(normalizeUnit('10*9/L')).toBe('10^9/l');
    expect(normalizeUnit('µIU/mL')).toBe('miu/l');
    expect(normalizeUnit('mL/dk/1,73m²')).toBe('ml/min/1.73m2');
    expect(normalizeUnit('mm/saat')).toBe('mm/h');
    expect(normalizeUnit('mcg/dL')).toBe('ug/dl');
    expect(normalizeUnit('elma')).toBeNull();
  });

  it('OCR bozulmaları: üst simge, µ ve I harfi', () => {
    for (const u of ['1073/pL', '10*3/pL', '10“3/pL', '1073/pHL', '1073/pAL', '10-3/µL']) expect(normalizeUnit(u), u).toBe('10^3/ul');
    for (const u of ['10“-9/L', '10-9/L', '10“9/L', '1049-1']) expect(normalizeUnit(u), u).toBe('10^9/l');
    expect(normalizeUnit('10“6/pL')).toBe('10^6/ul');
    expect(normalizeUnit('mlU/mL')).toBe('miu/ml');
    expect(normalizeUnit('mlU/L')).toBe('miu/l');
    expect(normalizeUnit('ulU/mL')).toBe('miu/l');
    expect(normalizeUnit('uUlU/mL')).toBe('miu/l');
    expect(normalizeUnit('Hg/dL')).toBe('ug/dl');
    // Tutarsız üs/payda: tahmin edilmez
    expect(normalizeUnit('10-3/L')).toBeNull();
    expect(normalizeUnit('pg/mL')).toBe('pg/ml');
  });
});

describe('test adı eşleme', () => {
  it('en uzun takma ad kazanır; LDL ile VLDL, HDL ile Kolesterol karışmaz', () => {
    expect(matchTestName(['LDL', 'Kolesterol', '178'])?.candidates[0]?.key).toBe('ldl');
    expect(matchTestName(['VLDL', '32'])?.candidates[0]?.key).toBe('vldl');
    expect(matchTestName(['HDL', 'Kolesterol', '44'])?.candidates[0]?.key).toBe('hdl');
    expect(matchTestName(['Kolesterol', '241'])?.candidates[0]?.key).toBe('cholesterol-total');
    expect(matchTestName(['Glukoz', '(açlık)', '94'])?.tokensUsed).toBe(2);
    expect(matchTestName(['ALT', '(SGPT)', '68'])?.candidates[0]?.key).toBe('alt');
  });

  it('OCR harf hataları uzun adlarda tolere edilir, kısaltmalarda edilmez', () => {
    const m = matchTestName(['Hemoglobın', '13,9']);
    expect(m?.candidates[0]?.key).toBe('hemoglobin');
    expect(matchTestName(['Kreatınin', '0,92'])?.candidates[0]?.key).toBe('creatinine');
    const fuzzy = matchTestName(['Hemogiobin', '13,9']);
    expect(fuzzy?.candidates[0]?.key).toBe('hemoglobin');
    expect(fuzzy?.score).toBeLessThan(1);
    expect(matchTestName(['XLT', '68'])).toBeNull();
  });
});

describe('referans aralığı', () => {
  it('tire, küçüktür, büyüktür ve cinsiyete özgü aralıklar', () => {
    expect(parseRange('0 - 130', 'unspecified').range).toMatchObject({ min: 0, max: 130 });
    expect(parseRange('13,5 - 17,5', 'unspecified').range).toMatchObject({ min: 13.5, max: 17.5 });
    expect(parseRange('< 200', 'unspecified').range).toMatchObject({ max: 200, maxExclusive: true });
    expect(parseRange('> 40', 'unspecified').range).toMatchObject({ min: 40, minExclusive: true });
    const sx = parseRange('E: 13,5-17,5 K: 12-15,5', 'unspecified');
    expect(sx.sexSpecific).toBe(true);
    expect(parseRange('E: 13,5-17,5 K: 12-15,5', 'female').range).toMatchObject({ min: 12, max: 15.5 });
  });

  it('etiketli, tek cinsiyetli ve evreye göre verilen aralıklar', () => {
    expect(parseRange('Eksiklik: < 20 / Yetersizlik: 20 - 30 / Yeterli: 30 - 100', 'unspecified').range).toMatchObject({ min: 30, max: 100 });
    expect(parseRange('Optimal: < 100 · Optimale yakın: 100 - 129', 'unspecified').range).toMatchObject({ max: 100, maxExclusive: true });
    // Yalnızca risk kategorisi: normal aralık sayılmaz
    expect(parseRange('Düşük: < 40', 'male').range.source).toBe('none');
    // Kategori olmayan etiket (ör. yaş grubu) aralığı bozmaz
    expect(parseRange('Yetişkin: 70 - 100', 'unspecified').range).toMatchObject({ min: 70, max: 100 });
    // Satırda yalnızca bir cinsiyetin aralığı varsa (devamı alt satırda)
    expect(parseRange('Erkek: 13,5 - 17,5', 'male').range).toMatchObject({ min: 13.5, max: 17.5 });
    expect(parseRange('Erkek: 13,5 - 17,5', 'female').range.source).toBe('none');
    expect(parseRange('Erkek: 13,5 - 17,5', 'unspecified').sexSpecific).toBe(true);
    // Döngü evresine göre: aralık seçilmez
    const ph = parseRange('Foliküler: 12,5 - 166', 'female');
    expect(ph.phaseSpecific).toBe(true);
    expect(ph.range.min).toBeUndefined();
  });

  it('"<200" aralığında 200 yüksektir; "0-130" aralığında 130 normaldir', () => {
    expect(statusFor(200, { max: 200, maxExclusive: true, source: 'report' })).toBe('high');
    expect(statusFor(130, { min: 0, max: 130, source: 'report' })).toBe('normal');
    expect(statusFor(131, { min: 0, max: 130, source: 'report' })).toBe('high');
    expect(statusFor(0.5, { min: 1, max: 5, source: 'report' }, '<')).toBe('low');
  });

  it('cinsiyet bilinmiyorsa genel aralık, cinsiyete özgü aralıkların birleşimidir', () => {
    expect(catalogRange(testByKey.get('hemoglobin')!, 'unspecified')).toMatchObject({ min: 12, max: 17.5, source: 'catalog' });
    expect(catalogRange(testByKey.get('hemoglobin')!, 'male')).toMatchObject({ min: 13.5, max: 17.5 });
  });
});

describe('rapor ayrıştırma', () => {
  const report = layout([
    'ÖRNEK LABORATUVARI',
    'Hasta Adı: ÖRNEK HASTA | TC: 00000000000',
    'Numune Tarihi: 12.09.2026 08:40',
    'Doğum Tarihi: 01.01.1980',
    'Test | Sonuç | Birim | Referans Aralığı',
    'Hemoglobin | 13,9 | g/dL | 13,5 - 17,5',
    'Lökosit (WBC) | 7,20 | 10^3/µL | 4,0 - 10,0',
    'LDL Kolesterol | 178 | mg/dL | 0 - 130 | H',
    'HDL Kolesterol | 44 | mg/dL | > 40',
    'Trigliserid | 162 | mg/dL | < 150 | H',
    'Ferritin | 19 | ng/mL | 30 - 400 | L',
    'Nötrofil % | 58,2 | % | 40 - 75',
    'Nötrofil # | 4,19 | 10^3/µL | 2,0 - 7,0',
    'TSH | 2,10 | µIU/mL | 0,27 - 4,20',
    'Glukoz (açlık) | 5,2 | mmol/L | 3,9 - 5,6',
    'CA 19-9 | 12,3 | U/mL | < 37',
  ]);
  const draft = parseReport(report);
  const byKey = new Map(draft.rows.map((r) => [r.testKey, r]));

  it('test satırlarını, değerleri, birimleri ve durumu çıkarır', () => {
    expect(byKey.get('ldl')).toMatchObject({ value: 178, unitKey: 'mg/dl', canonicalValue: 178, refMin: 0, refMax: 130, status: 'high', reportFlag: 'H', refSource: 'report' });
    expect(byKey.get('hemoglobin')).toMatchObject({ value: 13.9, status: 'normal' });
    expect(byKey.get('wbc')).toMatchObject({ value: 7.2, canonicalValue: 7.2, status: 'normal' });
    expect(byKey.get('hdl')).toMatchObject({ value: 44, status: 'normal', refMin: 40 });
    expect(byKey.get('triglyceride')).toMatchObject({ status: 'high' });
    expect(byKey.get('ferritin')).toMatchObject({ status: 'low', reportFlag: 'L' });
    expect(byKey.get('tsh')).toMatchObject({ value: 2.1, unitKey: 'miu/l', status: 'normal' });
  });

  it('aynı ada sahip # ve % testlerini birimden ayırır', () => {
    expect(byKey.get('neutrophil-pct')?.value).toBe(58.2);
    expect(byKey.get('neutrophil-abs')?.value).toBe(4.19);
  });

  it('mmol/L değeri kanonik birime çevrilir; aralık da çevrilir', () => {
    const glu = byKey.get('glucose')!;
    expect(glu.canonicalValue).toBeCloseTo(93.7, 0);
    expect(glu.refMin).toBeCloseTo(70.3, 0);
    expect(glu.status).toBe('normal');
  });

  it('tanınmayan satır listeye düşer, atılmaz', () => {
    expect(draft.unrecognized.map((u) => u.rawName)).toContain('CA 19-9');
  });

  it('tarih numune satırından alınır; doğum tarihi ve hasta satırı kullanılmaz', () => {
    expect(draft.reportDate).toBe('2026-09-12');
    expect(draft.labName).toBe('ÖRNEK LABORATUVARI');
    const all = JSON.stringify(draft);
    expect(all).not.toContain('ÖRNEK HASTA');
    expect(all).not.toContain('1980');
  });

  it('temiz satırlar yüksek güvenli, sorunlu satırlar incelemeye düşer', () => {
    expect(needsReview(byKey.get('ldl')!)).toBe(false);
    const messy = parseReport(layout(['Hemoglobin | 139 | g/dL | 13,5 - 17,5', 'Kreatinin | 0,92', 'LDL | 90 | mg/dL | 0 - 130 | H']));
    const m = new Map(messy.rows.map((r) => [r.testKey, r]));
    expect(m.get('hemoglobin')?.issues).toContain('IMPLAUSIBLE');
    expect(needsReview(m.get('hemoglobin')!)).toBe(true);
    expect(m.get('creatinine')?.issues).toEqual(expect.arrayContaining(['UNIT_MISSING', 'RANGE_MISSING']));
    expect(m.get('creatinine')?.refSource).toBe('catalog');
    expect(m.get('ldl')?.issues).toContain('FLAG_CONFLICT');
  });

  it('bitişik yazımlar: "178mg/dL", "178H", test kodu ile başlayan satır', () => {
    const d = parseReport(layout(['LDL Kolesterol 178mg/dL 0-130', 'Ferritin 19L ng/mL 30-400', '1001 Hemoglobin 13,9 g/dL 13,5-17,5']));
    const m = new Map(d.rows.map((r) => [r.testKey, r]));
    expect(m.get('ldl')).toMatchObject({ value: 178, unitKey: 'mg/dl', status: 'high' });
    expect(m.get('ferritin')).toMatchObject({ value: 19, reportFlag: 'L', status: 'low' });
    expect(m.get('hemoglobin')).toMatchObject({ value: 13.9 });
  });

  it('cinsiyete özgü aralıkta cinsiyet bilinmiyorsa durum belirsiz kalır ve incelemeye düşer', () => {
    const d = parseReport(layout(['Hemoglobin | 13,0 | g/dL | E: 13,5-17,5 K: 12-15,5']));
    expect(d.rows[0]).toMatchObject({ status: 'unknown', issues: ['RANGE_SEX_SPECIFIC'] });
    const f = parseReport(layout(['Hemoglobin | 13,0 | g/dL | E: 13,5-17,5 K: 12-15,5']), { sex: 'female' });
    expect(f.rows[0]).toMatchObject({ status: 'normal', refMin: 12 });
  });
});

describe('kullanıcı takma adları', () => {
  it('laboratuvara özgü ad, kullanıcı eşledikten sonra tanınır', () => {
    const rows = layout(['Kolesterol-LDL (Friedewald) | 150 | mg/dL | 0 - 130']);
    expect(parseReport(rows).rows).toHaveLength(0);
    const d = parseReport(layout(['Friedewald LDL | 150 | mg/dL | 0 - 130']), { userAliases: { 'Friedewald LDL': 'ldl' } });
    expect(d.rows[0]).toMatchObject({ testKey: 'ldl', value: 150, status: 'high' });
  });
});
