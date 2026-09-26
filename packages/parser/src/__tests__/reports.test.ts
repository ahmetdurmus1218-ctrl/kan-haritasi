import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { type Sex, interpret, testByKey } from '@kh/catalog';
import { parseReport, pdfTextToItems, type ParsedRow, type TextItem } from '../index';

/**
 * Farklı laboratuvar düzenlerini taklit eden sentetik PDF raporları (fixtures/make_fixtures.py).
 * Beklenen değerler expected.json'dan gelir; metin gerçek PDF.js metin katmanından okunur.
 */
const dir = fileURLToPath(new URL('../../../../fixtures/reports/', import.meta.url));

interface Expected {
  kind: 'pdf' | 'image';
  sex: Sex;
  date: string | null;
  rows: Array<{ key: string; value: number; status: 'low' | 'normal' | 'high' | null }>;
  patterns: string[];
  phaseSpecific?: string[];
}
const EXPECTED = JSON.parse(readFileSync(dir + 'expected.json', 'utf8')) as Record<string, Expected>;

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

const labInputs = (rows: ParsedRow[]) =>
  rows
    .filter((r) => r.canonicalValue !== null)
    .map((r) => ({
      testKey: r.testKey,
      value: r.canonicalValue!,
      canonical: true,
      unit: testByKey.get(r.testKey)?.unit ?? '',
      refMin: r.refMin,
      refMax: r.refMax,
      status: r.status,
      qualifier: r.qualifier,
    }));

const pdfs = Object.entries(EXPECTED).filter(([, e]) => e.kind === 'pdf');

describe('sentetik PDF raporları: farklı laboratuvar düzenleri', () => {
  it.each(pdfs)('%s: tüm testler doğru değer ve durumla okunur', async (name, exp) => {
    const { items, pages } = await extract(dir + name);
    const draft = parseReport(items, { pageCount: pages, sex: exp.sex });
    const byKey = new Map(draft.rows.map((r) => [r.testKey, r]));
    const problems: string[] = [];
    for (const e of exp.rows) {
      const row = byKey.get(e.key);
      if (!row) {
        problems.push(`${e.key}: okunmadı`);
        continue;
      }
      if (row.value !== e.value) problems.push(`${e.key}: değer ${row.value} ≠ ${e.value}`);
      const want = e.status ?? 'unknown';
      if (row.status !== want) problems.push(`${e.key}: durum ${row.status} ≠ ${want} (${row.refText ?? '-'})`);
      if (row.canonicalValue === null) problems.push(`${e.key}: birim dönüştürülemedi (${row.unit})`);
      // Temiz PDF metninde yalnızca rapordan kaynaklanan (beklenen) sorunlar olabilir.
      const allowed = ['RANGE_PHASE_SPECIFIC', 'RANGE_CATEGORIES', ...(exp.sex ? [] : ['RANGE_SEX_SPECIFIC'])];
      const unexpected = row.issues.filter((i) => !allowed.includes(i));
      if (unexpected.length) problems.push(`${e.key}: beklenmeyen sorun ${unexpected.join(',')}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
    // Fazladan (uydurma) satır yok
    expect(draft.rows.map((r) => r.testKey).sort()).toEqual(exp.rows.map((r) => r.key).sort());
    expect(draft.unrecognized.map((u) => u.rawName)).toEqual([]);
    if (exp.date) expect(draft.reportDate).toBe(exp.date);
    // Kişisel bilgiler taslağa girmez
    expect(JSON.stringify(draft)).not.toMatch(/HASTA:|DENEME KİŞİ|KURMACA KİŞİ|UYDURMA KİŞİ|ÖRNEK KİŞİ/);
  });

  it.each(pdfs)('%s: yorum motoru beklenen örüntüleri bulur', async (name, exp) => {
    const { items, pages } = await extract(dir + name);
    const draft = parseReport(items, { pageCount: pages, sex: exp.sex });
    const out = interpret(labInputs(draft.rows), exp.sex);
    const ids = out.patterns.map((p) => p.id);
    for (const p of exp.patterns) expect(ids, `${name} → ${p}`).toContain(p);
    // Her anormal sonuç ayrı bir bulgu olarak listelenir
    const abnormal = exp.rows.filter((r) => r.status === 'low' || r.status === 'high').map((r) => r.key);
    for (const key of abnormal) {
      const f = out.findings.find((x) => x.testKey === key);
      expect(f?.status, `${name} → ${key}`).toMatch(/low|high/);
    }
  });
});

describe('aralık biçimleri', () => {
  it('döngü evresine göre verilen hormon aralıkları doğrulama ister, durum uydurulmaz', async () => {
    const exp = EXPECTED['hormon-kadin.pdf']!;
    const { items, pages } = await extract(dir + 'hormon-kadin.pdf');
    const draft = parseReport(items, { pageCount: pages, sex: 'female' });
    for (const key of exp.phaseSpecific ?? []) {
      const row = draft.rows.find((r) => r.testKey === key)!;
      expect(row.status, key).toBe('unknown');
      expect(row.issues, key).toContain('RANGE_PHASE_SPECIFIC');
      expect(row.refText, key).toMatch(/Foliküler/);
    }
  });

  it('etiketli aralıklardan "yeterli/optimal/istenen" olan seçilir; yalnızca risk etiketi varsa genel aralık kullanılır', async () => {
    const { items, pages } = await extract(dir + 'lipid.pdf');
    const draft = parseReport(items, { pageCount: pages, sex: 'male' });
    const m = new Map(draft.rows.map((r) => [r.testKey, r]));
    expect(m.get('ldl')).toMatchObject({ refMax: 100, refSource: 'report', status: 'high' });
    expect(m.get('cholesterol-total')).toMatchObject({ refMax: 200, refSource: 'report' });
    expect(m.get('triglyceride')).toMatchObject({ refMax: 150, refSource: 'report' });
    // HDL satırında yalnızca "Düşük: < 40" var → rapor aralığı sayılmaz; "Düşük" kelimesi de bayrak sayılmaz
    expect(m.get('hdl')).toMatchObject({ refSource: 'catalog', status: 'low' });
    expect(m.get('hdl')!.issues).not.toContain('FLAG_CONFLICT');
  });

  it('cinsiyete göre verilen aralık: cinsiyet bilinmiyorsa doğrulama ister, biliniyorsa doğru aralık seçilir', async () => {
    const { items, pages } = await extract(dir + 'coklu-anormallik.pdf');
    const unknown = parseReport(items, { pageCount: pages });
    const hgb = unknown.rows.find((r) => r.testKey === 'hemoglobin')!;
    expect(hgb.issues).toContain('RANGE_SEX_SPECIFIC');
    expect(hgb.status).toBe('low'); // raporun ↓ işaretinden
    const male = parseReport(items, { pageCount: pages, sex: 'male' }).rows.find((r) => r.testKey === 'hemoglobin')!;
    expect([male.refMin, male.refMax]).toEqual([13.5, 17.5]);
  });
});
