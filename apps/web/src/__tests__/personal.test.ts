import { describe, expect, it } from 'vitest';
import { type LabInput, type ResultStatus, interpret } from '@kh/catalog';
import { personalFor, typicalParams } from '../explore/inside/personal';
import { INSIDE_CONTENT } from '../explore/inside/content';

const r = (testKey: string, value: number, status: ResultStatus, refMin?: number, refMax?: number, unit = ''): LabInput => ({
  testKey,
  value,
  canonical: true,
  unit,
  refMin,
  refMax,
  status,
});

describe('içeri-gir sahnelerinin kişiselleştirilmesi', () => {
  it('sonuç yoksa sahne tipik değerlerle çizilir', () => {
    const p = personalFor('damar', interpret([]), INSIDE_CONTENT.damar.tests);
    expect(p.lines).toHaveLength(0);
    expect(p.params).toEqual(typicalParams('damar'));
    expect(p.missing).toContain('ldl');
  });

  it('LDL, HDL ve trigliserid damar sahnesinin düğmelerini değiştirir', () => {
    const interp = interpret([r('ldl', 178, 'high', undefined, 130), r('hdl', 36, 'low', 40), r('triglyceride', 420, 'high', undefined, 150)], 'male');
    const p = personalFor('damar', interp, INSIDE_CONTENT.damar.tests);
    expect(p.params.ldl).toBeCloseTo(1.78);
    expect(p.params.hdl).toBeCloseTo(36 / 55);
    expect(p.params.tg).toBeCloseTo(4.2);
    expect(p.lines.find((l) => l.param === 'ldl')!.effect).toMatch(/tipik düzeyin ~1,8 katı/);
    expect(p.patterns.map((x) => x.id)).toContain('lipids');
  });

  it('enzimler üst sınırın katıyla sahneye yansır, değerler sınırlanır', () => {
    const p = personalFor('lobul', interpret([r('alt', 250, 'high', undefined, 41)]), INSIDE_CONTENT.lobul.tests);
    expect(p.params.alt).toBeCloseTo(250 / 41);
    expect(p.lines[0]!.effect).toMatch(/üst sınırın 6,1 katına göre/);
    const extreme = personalFor('adacik', interpret([r('glucose', 900, 'high', 70, 100)]), INSIDE_CONTENT.adacik.tests);
    expect(extreme.params.glucose).toBe(4.5);
  });

  it('düğmesi olmayan ilişkili sonuçlar da listede görünür', () => {
    const p = personalFor('damar', interpret([r('cholesterol-total', 250, 'high', undefined, 200)]), INSIDE_CONTENT.damar.tests);
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]!.param).toBe('');
    expect(p.params).toEqual(typicalParams('damar'));
  });

  it('kan sahnesi: yüzde × toplam akyuvar = tür sayısı', () => {
    const interp = interpret([r('wbc', 14, 'high', 4, 10), r('neutrophil-pct', 80, 'high', 40, 75), r('lymphocyte-pct', 15, 'low', 20, 45)]);
    const p = personalFor('kan', interp, INSIDE_CONTENT.kan.tests);
    // nötrofil: (80/60) × (14/7) ≈ 2,67
    expect(p.params.neutrophil).toBeCloseTo((80 / 60) * 2);
    expect(p.params.lymphocyte).toBeCloseTo((15 / 30) * 2);
    // alt türü verilmeyenler tipik kalır
    expect(p.params.monocyte).toBe(1);
  });

  it('kan sahnesi: alt tür yoksa toplam akyuvar tüm türleri ölçekler', () => {
    const p = personalFor('kan', interpret([r('wbc', 2.1, 'low', 4, 10), r('hemoglobin', 9.8, 'low', 12, 15.5)], 'female'), INSIDE_CONTENT.kan.tests);
    expect(p.params.neutrophil).toBeCloseTo(0.3);
    expect(p.params.basophil).toBeCloseTo(0.3);
    expect(p.params.rbc).toBeCloseTo(0.7);
    expect(p.lines.find((l) => l.finding.testKey === 'wbc')!.effect).toMatch(/akyuvar sayısı/);
  });
});
