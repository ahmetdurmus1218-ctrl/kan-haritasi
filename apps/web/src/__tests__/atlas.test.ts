import { describe, expect, it } from 'vitest';
import { STRUCTURES, testByKey } from '@kh/catalog';
import { hrefFor, parseHash } from '../state/router';
import { insideFit, insideLinks } from '../anatomy/organs';
import { INSIDE, resolveInside } from '../explore/inside/registry';
import { INSIDE_CONTENT } from '../explore/inside/content';
import { TISSUES, TISSUE_IDS, tissueProfile } from '../explore/inside/tissues';
import { DEPTH, MAX_PER_LAYER, TOP, X0, X1, Z0, Z1, layerShot, layoutTissue, overviewShot } from '../explore/inside/tissueLayout';
import { explorePath } from '../explore/BodyPanels';

describe('doku atlası', () => {
  it('her profil kayıtta atlas olarak var, içeriği ve rotası çalışıyor', () => {
    expect(TISSUE_IDS.length).toBeGreaterThanOrEqual(20);
    for (const id of TISSUE_IDS) {
      expect(INSIDE[id].kind, id).toBe('atlas');
      expect(INSIDE[id].ready, id).toBe(true);
      const c = INSIDE_CONTENT[id];
      expect(c.stages.length, id).toBeGreaterThan(1);
      // Katmanlar seçilebilir nesnelerdir; ilk aşama katman turudur.
      expect(Object.keys(c.objects)).toEqual(TISSUES[id].layers.map((l) => l.key));
      expect(c.caution, id).toMatch(/şema/i);
      expect(resolveInside(id)).toEqual({ scene: id, startSimulation: false });
      const route = { name: 'simulation', id, from: TISSUES[id].structures[0]!, mode: 'temel' } as const;
      expect(parseHash(hrefFor(route))).toEqual(route);
    }
  });

  it('profillerdeki yapılar, tahliller ve süreç odakları geçerli', () => {
    const ids = new Set(STRUCTURES.map((s) => s.id));
    for (const t of Object.values(TISSUES)) {
      for (const s of t.structures) expect(ids.has(s), `${t.id} → ${s}`).toBe(true);
      for (const k of t.tests) expect(testByKey.has(k), `${t.id} → ${k}`).toBe(true);
      const keys = new Set(t.layers.map((l) => l.key));
      expect(keys.size, t.id).toBe(t.layers.length);
      for (const st of t.process_stages) if (st.focus) expect(keys.has(st.focus), `${t.id}: ${st.focus}`).toBe(true);
    }
  });

  it('yerleşim: katmanlar üst üste, sınırlar içinde ve her dokulu katmanda hücre var', () => {
    for (const id of TISSUE_IDS) {
      const layout = layoutTissue(tissueProfile(id)!);
      expect(layout.layers[0]!.yTop).toBeCloseTo(TOP);
      expect(layout.bottom).toBeCloseTo(TOP - DEPTH);
      for (let i = 1; i < layout.layers.length; i++) expect(layout.layers[i]!.yTop).toBeCloseTo(layout.layers[i - 1]!.yBot);
      for (const l of layout.layers) {
        const cells = l.groups.reduce((n, g) => n + g.cells.length, 0);
        // Seroza gibi ince katmanlarda bile en az bir hücre grubu ya da kanal olmalı (boş blok yok).
        expect(cells + l.channels.length, `${id}/${l.layer.key}`).toBeGreaterThan(0);
        for (const g of l.groups) {
          expect(g.cells.length, `${id}/${l.layer.key}/${g.label}`).toBeLessThanOrEqual(MAX_PER_LAYER);
          for (const c of g.cells) {
            expect(c.p.x).toBeGreaterThanOrEqual(X0 - 0.5);
            expect(c.p.x).toBeLessThanOrEqual(X1 + 0.5);
            expect(c.p.z).toBeGreaterThanOrEqual(Z0 - 0.5);
            expect(c.p.z).toBeLessThanOrEqual(Z1 + 0.5);
            expect(c.p.y).toBeLessThanOrEqual(l.yTop + 0.45);
            expect(c.p.y).toBeGreaterThanOrEqual(l.yBot - 0.45);
          }
        }
      }
      // Her katman için kamera çekimi var
      for (const l of tissueProfile(id)!.layers) expect(layerShot(layout, l.key), `${id}/${l.key}`).not.toBeNull();
      expect(overviewShot(layout).position[2]).toBeGreaterThan(Z1);
    }
  });
});

describe('iç sahne uygunluğu (kendi dokusu / ortak / ilişkili)', () => {
  const modelled = STRUCTURES.filter((s) => s.asset);

  it('her 3B yapının kendi ya da ortak dokusu var; ilişkili doku hiçbir yapıda ilk sahne değil', () => {
    const relatedFirst = modelled.filter((s) => insideLinks(s.id)[0]?.fit === 'related').map((s) => s.id);
    expect(relatedFirst).toEqual([]);
    for (const s of modelled) expect(insideLinks(s.id).some((l) => l.fit === 'exact' || l.fit === 'shared'), s.id).toBe(true);
  });

  it('düzeltilen yanlış eşleşmeler: toplardamar, kalın bağırsak, prostat, rahim', () => {
    expect(insideLinks('veins')[0]).toEqual({ id: 'ven-duvari', fit: 'exact' });
    expect(insideFit('large-intestine', 'villus')).toBe('related');
    expect(insideLinks('prostate')[0]!.id).toBe('prostat');
    expect(insideFit('uterus', 'ovaryum')).toBe('related');
    expect(insideFit('esophagus', 'mide')).toBe('related');
  });

  it('hemogram tahlilleri kan hücreleri sahnesine gider (dalak dokusu değil)', () => {
    expect(explorePath('hemoglobin')).toMatchObject({ structure: 'spleen', inside: 'kan' });
    expect(explorePath('lipase')?.inside).toBe('adacik');
  });
});

describe('çok sayıda anormal sonuç', () => {
  it('coklu-anormallik raporundaki her anormal test ilişkili tüm yapıları vurgular, hiçbiri kaybolmaz', async () => {
    const { readFileSync } = await import('node:fs');
    const { highlightsFrom } = await import('../anatomy/highlight');
    const expected = JSON.parse(readFileSync(new URL('../../../../fixtures/reports/expected.json', import.meta.url), 'utf8')) as Record<
      string,
      { rows: Array<{ key: string; value: number; status: 'high' | 'low' | 'normal' }> }
    >;
    const rows = expected['coklu-anormallik.pdf']!.rows;
    const series = rows.map((r) => {
      const point = { result: { status: r.status, value: r.value }, report: {}, date: '2026-09-18' };
      return { test: testByKey.get(r.key)!, points: [point], latest: point };
    }) as unknown as Parameters<typeof highlightsFrom>[0];
    const map = highlightsFrom(series);
    const abnormal = rows.filter((r) => r.status !== 'normal');
    expect(abnormal.length).toBe(26);
    for (const r of abnormal)
      for (const sid of testByKey.get(r.key)!.structures) expect(map.get(sid)?.tests.some((t) => t.key === r.key), `${r.key} → ${sid}`).toBe(true);
    // Normal sonuç vurgu üretmez
    for (const r of rows.filter((x) => x.status === 'normal')) for (const h of map.values()) expect(h.tests.some((t) => t.key === r.key)).toBe(false);
    // Aynı yapıda hem yüksek hem düşük sonuç "karışık" olur (ör. dalak: hemoglobin ▼, lökosit ▲)
    expect(map.get('spleen')?.status).toBe('mixed');
  });
});
