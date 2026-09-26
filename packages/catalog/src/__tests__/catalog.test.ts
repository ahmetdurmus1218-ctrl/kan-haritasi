import { describe, expect, it } from 'vitest';
import { CONTENT, PROCESSES, STRUCTURES, TESTS, structureById, structureForNode, testByKey } from '../index';

describe('katalog bütünlüğü', () => {
  it('her testin benzersiz anahtarı, LOINC kodu ve içeriği var', () => {
    expect(new Set(TESTS.map((t) => t.key)).size).toBe(TESTS.length);
    expect(new Set(TESTS.map((t) => t.loinc)).size).toBe(TESTS.length);
    for (const t of TESTS) {
      expect(t.loinc, t.key).toMatch(/^\d{1,6}-\d$/);
      expect(CONTENT[t.key], `içerik: ${t.key}`).toBeDefined();
    }
    expect(TESTS.length).toBeGreaterThanOrEqual(70);
  });

  it('her testin kanonik birimi (çarpan 1) ve tutarlı aralıkları var', () => {
    for (const t of TESTS) {
      expect(Object.values(t.conversions).some((c) => c[0] === 1 && (c[1] ?? 0) === 0), t.key).toBe(true);
      for (const r of t.ranges) if (r.min !== undefined && r.max !== undefined) expect(r.min, t.key).toBeLessThanOrEqual(r.max);
      expect(t.plausible[0], t.key).toBeLessThan(t.plausible[1]);
    }
  });

  it('testlerin bağlandığı yapı ve süreçler tanımlı', () => {
    for (const t of TESTS) {
      for (const s of t.structures) expect(structureById.has(s), `${t.key} → ${s}`).toBe(true);
      for (const p of t.processes) expect(PROCESSES[p], `${t.key} → ${p}`).toBeDefined();
      expect(t.structures.length + t.systems.length, t.key).toBeGreaterThan(0);
    }
  });

  it('içerikte teşhis ve ilaç talimatı dili yok', () => {
    const forbidden = /(tanınız|kesin olarak|hastalığınız var|ilacı bırak|dozunu artır|şu ilacı kullan)/i;
    for (const [key, c] of Object.entries(CONTENT)) {
      const all = [c.what, c.high ?? '', c.low ?? '', ...c.factors, ...c.actions, ...c.askDoctor].join(' ');
      expect(forbidden.test(all), key).toBe(false);
    }
  });

  it('HRA düğüm adları doğru yapılara bağlanır', () => {
    expect(structureForNode('VH_M_left_coronary_artery', 'cardio')).toBe('coronary-arteries');
    expect(structureForNode('VH_M_posterior_vein_of_left_ventricle', 'cardio')).toBe('veins');
    expect(structureForNode('VH_M_heart_left_ventricle', 'cardio')).toBe('heart');
    expect(structureForNode('VH_M_aortic_arch', 'cardio')).toBe('aorta');
    expect(structureForNode('VH_M_renal_papilla_L_a', 'urinary')).toBe('kidneys');
    expect(structureForNode('VH_M_left_apical_bronchopulmonary_segment', 'respiratory')).toBe('lungs');
    expect(structureForNode('VH_M_right_anterosuperior_segment', 'digestive')).toBe('liver');
    expect(STRUCTURES.filter((s) => s.schematic).every((s) => s.asset === 'schematic')).toBe(true);
    expect(testByKey.get('ldl')?.simulation).toBe('ldl-atherosclerosis');
  });
});
