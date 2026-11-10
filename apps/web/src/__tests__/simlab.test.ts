import { describe, expect, it } from 'vitest';
import { GRAPH, interiorById } from '@kh/analysis';
import { testByKey } from '@kh/catalog';
import { DERIVED, SIM_MODELS } from '@kh/physio';
import { hrefFor, parseHash } from '../state/router';
import { activeKey } from '../screens/AppShell';
import { derivedReports } from '../screens/SimLabPage';
import { viewWindow } from '../components/simlab';
import type { StoredReport } from '../lib/reports';

describe('simülasyon laboratuvarı: uygulama verisine bağlar', () => {
  it('her modelin organı bilgi grafiğinde, iç dünyası İÇİNE GİR motorunda, testleri katalogda var', () => {
    for (const m of SIM_MODELS) {
      for (const o of m.organs) expect(GRAPH.node(o), `${m.id} organ ${o}`).toBeTruthy();
      if (m.interior) expect(interiorById(m.interior), `${m.id} iç dünya ${m.interior}`).toBeTruthy();
      expect(m.relatedTests.length, m.id).toBeGreaterThan(0);
      for (const t of m.relatedTests) expect(testByKey.get(t), `${m.id} test ${t}`).toBeTruthy();
    }
  });
  it('kişisel bağ yalnızca tanımlı parametrelere ve eğrilere, katalogdaki testlerle kurulur', () => {
    const measured = Object.fromEntries([...testByKey.keys()].map((k) => [k, 7.3]));
    for (const m of SIM_MODELS) {
      const b = m.personal?.(measured);
      if (!b) continue;
      for (const k of Object.keys(b.params)) expect(m.params.some((p) => p.key === k), `${m.id} param ${k}`).toBe(true);
      for (const k of b.used) expect(testByKey.get(k), `${m.id} test ${k}`).toBeTruthy();
      // Ölçüm yokken hiçbir şey bağlanmaz.
      expect(m.personal!({}).used).toEqual([]);
    }
  });
  it('hesaplayıcıların girdileri katalogda, organları grafikte', () => {
    for (const d of DERIVED) {
      for (const k of d.needs) expect(testByKey.get(k), `${d.id} girdi ${k}`).toBeTruthy();
      for (const o of d.organs) expect(GRAPH.node(o), `${d.id} organ ${o}`).toBeTruthy();
    }
  });
  it('rotalar: #/sim, #/sim/<model>/<senaryo>, #/laboratuvar; eski 3B sahne rotaları bozulmadı', () => {
    expect(parseHash('#/sim')).toEqual({ name: 'simlab' });
    expect(parseHash('#/simulasyon')).toEqual({ name: 'simlab' });
    expect(parseHash('#/sim/kalp-dongusu')).toEqual({ name: 'simlab', id: 'kalp-dongusu' });
    expect(parseHash('#/sim/kalp-dongusu/egzersiz')).toEqual({ name: 'simlab', id: 'kalp-dongusu', scenario: 'egzersiz' });
    expect(parseHash('#/sim/<script>')).toEqual({ name: 'simlab' });
    expect(parseHash('#/laboratuvar')).toEqual({ name: 'anatomylab' });
    expect(parseHash('#/simulasyon/nefron')).toEqual({ name: 'simulation', id: 'nefron' });
    expect(parseHash('#/simulasyon/nefron/kidneys/benim')).toEqual({ name: 'simulation', id: 'nefron', from: 'kidneys', mode: 'benim' });
    for (const m of SIM_MODELS) for (const s of [undefined, ...m.scenarios.map((x) => x.id)]) {
      const r = { name: 'simlab' as const, id: m.id, ...(s ? { scenario: s } : {}) };
      expect(parseHash(hrefFor(r))).toEqual(r);
    }
  });
  it('gezinme: dokuz ana yerin her biri etkin öğesini bulur', () => {
    expect(activeKey({ name: 'simlab' })).toBe('simlab');
    expect(activeKey({ name: 'flow' })).toBe('simlab');
    expect(activeKey({ name: 'anatomylab' })).toBe('anatomylab');
    expect(activeKey({ name: 'body' })).toBe('anatomylab');
    expect(activeKey({ name: 'interior', id: 'heart' })).toBe('anatomylab');
    expect(activeKey({ name: 'organ', id: 'heart' })).toBe('mybody');
    expect(activeKey({ name: 'documents' })).toBe('documents');
    expect(activeKey({ name: 'result', key: 'tsh' })).toBe('results');
  });
  it('hesaplayıcı girdileri: "<" / ">" nitelikli ve kanonik değeri olmayan sonuçlar kullanılmaz', () => {
    const base = { loinc: '', rawName: '', unit: '', unitKey: null, refText: '', refSource: 'none' as const, status: 'normal' as const, userEdited: false };
    const report = {
      id: 'r1', fileId: 'f', createdAt: '2026-02-03T10:00:00Z', reportDate: '2026-02-01', parserVersion: '1',
      results: [
        { ...base, testKey: 'sodium', value: 140, canonicalValue: 140 },
        { ...base, testKey: 'crp', value: 3, canonicalValue: 3, qualifier: '<' as const },
        { ...base, testKey: 'glucose', value: 5, canonicalValue: null },
      ],
    } as unknown as StoredReport;
    expect(derivedReports([report])).toEqual([{ id: 'r1', date: '2026-02-01', values: { sodium: 140 } }]);
  });
  it('yakınlaştırma penceresi imlecin çevresinde ve sınırlar içinde kalır', () => {
    expect(viewWindow(100, 50, 1)).toEqual([0, 100]);
    expect(viewWindow(100, 50, 4)).toEqual([37.5, 62.5]);
    expect(viewWindow(100, 2, 4)).toEqual([0, 25]);
    expect(viewWindow(100, 99, 4)).toEqual([75, 100]);
  });
});
