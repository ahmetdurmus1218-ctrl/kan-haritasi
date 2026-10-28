import { describe, expect, it } from 'vitest';
import { CONTENT, type LabInput, TESTS, interpret } from '@kh/catalog';
import { GRAPH } from '../knowledge';
import { BIOMARKER_PHYSIOLOGY, physioNode } from '../physiology';
import { organsForLab } from '../fusion';

/**
 * Kataloğa eklenen her test, uygulamanın her katmanında karşılık bulmalı: hangi organın hangi işini
 * ölçtüğü (bilgi grafiği), vücutta normalde ne yaptığı, nerede üretilip nerede kullanıldığı (fizyoloji)
 * ve ne anlama geldiği (içerik). Yeni test eklenip bir katman unutulursa bu test başarısız olur.
 */
describe('her test her katmanda', () => {
  it.each(TESTS.map((t) => t.key))('%s', (key) => {
    expect(CONTENT[key], 'içerik').toBeDefined();
    const organs = GRAPH.organsForTest(key);
    expect(organs.length, 'bilgi grafiğinde ölçtüğü süreç → organ').toBeGreaterThan(0);
    expect(organsForLab(key).length).toBeGreaterThan(0);
    const info = BIOMARKER_PHYSIOLOGY[key];
    expect(info, 'fizyoloji: normalde ne yapıyor').toBeDefined();
    expect(info!.role.length).toBeGreaterThan(10);
    for (const place of [...info!.producedIn, ...info!.usedIn]) expect(physioNode(place), `${key}: ${place}`).toBeDefined();
  });
});

const L = (testKey: string, value: number, status: LabInput['status'], refMin?: number, refMax?: number): LabInput => ({ testKey, value, canonical: true, unit: '', status, refMin, refMax });

describe('kan gazı ve idrar yorumları', () => {
  it('toplardamar örneğine uyan kan gazı: alarm yok, örnek türü açıklanır', () => {
    const r = interpret([L('ph', 7.39, 'normal', 7.32, 7.42), L('pco2', 49.3, 'high', 32, 48), L('hco3', 27.1, 'high', 21.8, 26.9), L('po2', 46.8, 'low', 80, 108), L('so2', 80.8, 'low', 95, 99)], 'male');
    const ids = r.patterns.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['acid-base-compensated', 'oxygenation']));
    expect(r.patterns.every((p) => p.level === 'info')).toBe(true);
    expect(r.patterns.find((p) => p.id === 'oxygenation')!.title).toContain('toplardamar');
    expect(r.critical).toEqual([]);
  });

  it('atardamar örneğinde belirgin asidoz acil; kaynağı söylenir', () => {
    const r = interpret([L('ph', 7.12, 'low', 7.35, 7.45), L('pco2', 30, 'low', 35, 45), L('hco3', 10, 'low', 22, 26), L('po2', 95, 'normal', 80, 100)], 'male');
    const p = r.patterns.find((x) => x.id === 'acid-base')!;
    expect(p.level).toBe('urgent');
    expect(p.text).toContain('metabolik');
    expect(r.critical.map((f) => f.testKey)).toEqual(expect.arrayContaining(['ph', 'hco3']));
  });

  it('karbonmonoksit ve idrarda protein', () => {
    expect(interpret([L('cohb', 24, 'high', 0, 1.5)]).patterns[0]).toMatchObject({ id: 'carbon-monoxide', level: 'urgent' });
    expect(interpret([L('urine-microalbumin', 85, 'high', 0, 20)]).patterns[0]).toMatchObject({ id: 'urine-protein', level: 'attention' });
  });
});
