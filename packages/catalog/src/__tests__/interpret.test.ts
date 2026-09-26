import { describe, expect, it } from 'vitest';
import { type LabInput, type ResultStatus, gradeResult, interpret, testByKey } from '../index';

/** Kanonik birimde bir sonuç; aralık verilmezse kataloğun ilk aralığı kullanılır. */
function r(testKey: string, value: number, status: ResultStatus, refMin?: number, refMax?: number): LabInput {
  const t = testByKey.get(testKey)!;
  const range = t.ranges[t.ranges.length - 1];
  return {
    testKey,
    value,
    canonical: true,
    unit: t.unit,
    refMin: refMin ?? range?.min,
    refMax: refMax ?? range?.max,
    status,
  };
}

describe('tek sonuç derecelendirmesi', () => {
  it('sapma derecesi referans sınırına göre hesaplanır', () => {
    expect(gradeResult(r('b12', 180, 'low', 197, 771))!.severity).toBe('mild'); // %9 altında
    expect(gradeResult(r('b12', 150, 'low', 197, 771))!.severity).toBe('moderate'); // %24
    expect(gradeResult(r('b12', 100, 'low', 197, 771))!.severity).toBe('marked'); // %49
    const hi = gradeResult(r('bun', 26, 'high', 6, 20))!;
    expect(hi.severity).toBe('moderate');
    expect(hi.headline).toContain('üst sınırın %30 üzerinde');
  });

  it('enzimler üst sınırın katıyla derecelendirilir', () => {
    const mild = gradeResult(r('alt', 60, 'high', undefined, 41))!;
    expect(mild.severity).toBe('mild');
    expect(mild.uln).toBeCloseTo(60 / 41);
    expect(gradeResult(r('alt', 120, 'high', undefined, 41))!.severity).toBe('moderate');
    const marked = gradeResult(r('alt', 250, 'high', undefined, 41))!;
    expect(marked.severity).toBe('marked');
    expect(marked.headline).toContain('katı');
  });

  it('aralık içindeki ama sınıra çok yakın değer "sınırda" olur', () => {
    expect(gradeResult(r('tsh', 4.15, 'normal', 0.27, 4.2))!.severity).toBe('borderline');
    expect(gradeResult(r('tsh', 2, 'normal', 0.27, 4.2))!.severity).toBe('normal');
  });

  it('kılavuz kategorileri eklenir, laboratuvar aralığı esas kalır', () => {
    const ldl = gradeResult(r('ldl', 178, 'high', undefined, 130))!;
    expect(ldl.category).toMatch(/Yüksek \(160–189\)/);
    expect(ldl.severity).toBe('moderate');
    // Laboratuvar aralığında ama kılavuza göre yüksek: yalnızca "sınırda"
    const glu = gradeResult(r('glucose', 104, 'normal', 70, 110))!;
    expect(glu.severity).toBe('borderline');
    expect(glu.category).toMatch(/Bozulmuş açlık/);
    expect(gradeResult(r('egfr', 52, 'low', 60))!.category).toMatch(/G3a/);
    expect(gradeResult(r('vitamin-d', 15, 'low', 30, 100))!.category).toMatch(/Eksiklik/);
  });

  it('kanonik olmayan birimde kılavuz eşiği uygulanmaz', () => {
    const g = gradeResult({ ...r('glucose', 7.2, 'high', 3.9, 5.6), canonical: false, unit: 'mmol/L' })!;
    expect(g.category).toBeUndefined();
    expect(g.critical).toBe(false);
  });

  it('kritik düzeyler işaretlenir', () => {
    expect(gradeResult(r('potassium', 6.3, 'high', 3.5, 5.1))!.critical).toBe(true);
    expect(gradeResult(r('sodium', 118, 'low', 136, 145))!.critical).toBe(true);
    expect(gradeResult(r('hemoglobin', 6.5, 'low', 12, 15.5), 'female')!.critical).toBe(true);
    expect(gradeResult(r('potassium', 5.3, 'high', 3.5, 5.1))!.critical).toBe(false);
  });

  it('bilinmeyen test yok sayılır', () => {
    expect(gradeResult({ ...r('ldl', 1, 'normal'), testKey: 'yok-boyle-test' })).toBeNull();
  });
});

describe('birlikte yorum (paternler)', () => {
  const ids = (inputs: LabInput[], sex: 'female' | 'male' | 'unspecified' = 'female') => interpret(inputs, sex).patterns.map((p) => p.id);

  it('düşük hemoglobin + küçük alyuvar + düşük ferritin: demir eksikliği ile uyumlu', () => {
    const out = interpret([r('hemoglobin', 10.2, 'low', 12, 15.5), r('mcv', 72, 'low', 80, 100), r('ferritin', 6, 'low', 13, 150)], 'female');
    const anemia = out.patterns.find((p) => p.id === 'anemia')!;
    expect(anemia.text).toContain('MCV düşük');
    expect(anemia.scene).toBe('ilik');
    expect(out.patterns.map((p) => p.id)).toContain('iron-deficiency');
    expect(out.systems.find((s) => s.system === 'hematologic')!.status).toBe('attention');
  });

  it('yalnız ferritin düşükse depoların azaldığı söylenir', () => {
    expect(ids([r('ferritin', 9, 'low', 13, 150), r('hemoglobin', 13, 'normal', 12, 15.5)])).toEqual(['iron-stores']);
  });

  it('tiroid: TSH yüksek + sT4 düşük ve subklinik tablo ayrılır', () => {
    const hypo = interpret([r('tsh', 9.8, 'high', 0.27, 4.2), r('ft4', 0.7, 'low', 0.93, 1.7)]).patterns[0]!;
    expect(hypo.title).toMatch(/az çalışıyor/);
    const sub = interpret([r('tsh', 6.1, 'high', 0.27, 4.2), r('ft4', 1.2, 'normal', 0.93, 1.7)]).patterns[0]!;
    expect(sub.text).toMatch(/subklinik hipotiroidi/);
    const hyper = interpret([r('tsh', 0.05, 'low', 0.27, 4.2), r('ft4', 2.4, 'high', 0.93, 1.7)]).patterns[0]!;
    expect(hyper.title).toMatch(/fazla çalışıyor/);
  });

  it('karaciğer: hücre hasarı ve safra paterni ayrılır, 5 kat artış acil sayılır', () => {
    const hep = interpret([r('alt', 95, 'high', undefined, 41), r('ast', 60, 'high', undefined, 40)]).patterns;
    expect(hep.map((p) => p.id)).toEqual(['liver-cells']);
    expect(hep[0]!.level).toBe('attention');
    expect(interpret([r('alt', 400, 'high', undefined, 41)]).patterns[0]!.level).toBe('urgent');
    expect(ids([r('alp', 210, 'high', 35, 104), r('ggt', 90, 'high', undefined, 40), r('alt', 20, 'normal', undefined, 41)])).toEqual(['cholestasis']);
  });

  it('böbrek: eGFR kategorisi metne yansır', () => {
    const k = interpret([r('egfr', 38, 'low', 60), r('creatinine', 1.8, 'high', 0.7, 1.2)]).patterns.find((p) => p.id === 'kidney-filtration')!;
    expect(k.text).toMatch(/G3b/);
    expect(k.scene).toBe('nefron');
    expect(interpret([r('egfr', 22, 'low', 60)]).patterns[0]!.level).toBe('urgent');
  });

  it('glukoz ve HbA1c birlikte değerlendirilir', () => {
    const pre = interpret([r('glucose', 112, 'high', 70, 100), r('hba1c', 6.0, 'high', 4, 5.6)]).patterns[0]!;
    expect(pre.title).toMatch(/prediyabet/);
    const dm = interpret([r('glucose', 150, 'high', 70, 100), r('hba1c', 7.4, 'high', 4, 5.6)]).patterns[0]!;
    expect(dm.title).toMatch(/diyabet eşik/);
    expect(dm.scene).toBe('adacik');
  });

  it('lipidler: yüksek LDL + düşük HDL damar sahnesine bağlanır', () => {
    const lip = interpret([r('ldl', 178, 'high', undefined, 130), r('hdl', 36, 'low', 40)], 'male').patterns[0]!;
    expect(lip.id).toBe('lipids');
    expect(lip.level).toBe('attention');
    expect(lip.scene).toBe('damar');
    expect(lip.text).toContain('plak olduğu anlamına gelmez');
  });

  it('inflamasyon, elektrolit, D vitamini, pankreas, kan hücreleri', () => {
    expect(ids([r('crp', 48, 'high', undefined, 5)])).toEqual(['inflammation']);
    const el = interpret([r('potassium', 6.4, 'high', 3.5, 5.1)]);
    expect(el.patterns[0]!.level).toBe('urgent');
    expect(el.critical).toHaveLength(1);
    expect(ids([r('vitamin-d', 14, 'low', 30, 100)])).toEqual(['vitamin-d']);
    expect(interpret([r('lipase', 250, 'high', 13, 60)]).patterns[0]!.level).toBe('urgent');
    expect(ids([r('platelet', 90, 'low', 150, 400)])).toEqual(['platelets']);
    expect(ids([r('wbc', 2.5, 'low', 4, 10)])).toEqual(['leukopenia']);
  });

  it('tüm değerler normalken patern üretilmez, özet olumlu olur', () => {
    const out = interpret([r('hemoglobin', 14, 'normal', 12, 15.5), r('ldl', 95, 'normal', undefined, 130), r('tsh', 1.8, 'normal', 0.27, 4.2)]);
    expect(out.patterns).toHaveLength(0);
    expect(out.overall.abnormal).toBe(0);
    expect(out.overall.text).toMatch(/tümü laboratuvarın referans aralığında/);
    expect(out.structures.size).toBe(0);
  });

  it('yapı durumu en ağır bulguya göre puanlanır', () => {
    const out = interpret([r('alt', 250, 'high', undefined, 41), r('albumin', 3.0, 'low', 3.5, 5.2)]);
    const liver = out.structures.get('liver')!;
    expect(liver.score).toBe(3);
    expect(liver.direction).toBe('mixed');
    expect(out.overall.text).toMatch(/2 tanesi referans aralığı dışında/);
  });

  it('yorum metinlerinde teşhis ve ilaç talimatı dili yok', () => {
    const all = interpret(
      [
        r('hemoglobin', 9, 'low', 12, 15.5), r('mcv', 110, 'high', 80, 100), r('ferritin', 5, 'low', 13, 150), r('b12', 120, 'low', 197, 771),
        r('alt', 300, 'high', undefined, 41), r('ast', 700, 'high', undefined, 40), r('ck', 2000, 'high', undefined, 190), r('bilirubin-total', 3.5, 'high', undefined, 1.2),
        r('egfr', 25, 'low', 60), r('creatinine', 2.5, 'high', 0.7, 1.2), r('bun', 60, 'high', 6, 20), r('glucose', 260, 'high', 70, 100), r('hba1c', 9.4, 'high', 4, 5.6),
        r('tsh', 0.02, 'low', 0.27, 4.2), r('ft4', 3, 'high', 0.93, 1.7), r('anti-tpo', 300, 'high', undefined, 34), r('ldl', 210, 'high', undefined, 130),
        r('triglyceride', 620, 'high', undefined, 150), r('crp', 140, 'high', undefined, 5), r('sodium', 150, 'high', 136, 145), r('vitamin-d', 8, 'low', 30, 100),
        r('lipase', 400, 'high', 13, 60), r('platelet', 40, 'low', 150, 400), r('uric-acid', 10, 'high', 2.4, 7), r('psa', 12, 'high', undefined, 4),
      ],
      'male',
    );
    expect(all.patterns.length).toBeGreaterThan(12);
    const text = [...all.patterns.flatMap((p) => [p.title, p.text, ...(p.ask ?? [])]), ...all.findings.flatMap((x) => [x.headline, x.detail])].join(' ');
    expect(text.match(/(tanınız|kesin olarak|hastalığınız var|ilacı bırak|dozunu artır|şu ilacı kullan)/i)?.[0] ?? null).toBeNull();
    expect(text).not.toMatch(/undefined|NaN|null/);
  });
});

describe('hormonlar ve tek organa özgü olmayan testler', () => {
  it('düşük testosteron + yüksek LH/FSH: testis kaynaklı olabilir', () => {
    const out = interpret([r('testosterone', 180, 'low', 264, 916), r('lh', 14, 'high', 1.7, 8.6), r('fsh', 20, 'high', 1.5, 12.4)], 'male');
    const p = out.patterns.find((x) => x.id === 'testosterone-low')!;
    expect(p.text).toMatch(/testis kaynaklı/);
    expect(p.structures).toContain('testes');
    expect(out.patterns.map((x) => x.id)).not.toContain('sex-hormones');
  });

  it('kadında cinsiyet hormonları döngü gününe göre yorumlanır uyarısıyla gelir', () => {
    const out = interpret([r('estradiol', 520, 'high', 12.5, 498), r('lh', 40, 'high', 2.4, 12.6)], 'female');
    expect(out.patterns.find((x) => x.id === 'sex-hormones')!.text).toMatch(/adet döngüsünün gününe/);
  });

  it('beta-hCG, prolaktin ve kortizol paternleri', () => {
    expect(interpret([r('bhcg', 1200, 'high', undefined, 5)]).patterns.map((x) => x.id)).toEqual(['bhcg']);
    expect(interpret([r('prolactin', 45, 'high', 4, 15.2)], 'male').patterns.map((x) => x.id)).toEqual(['prolactin-high']);
    expect(interpret([r('cortisol', 3, 'low', 6.2, 19.4)]).patterns[0]!.title).toBe('Kortizol düşük');
  });

  it('CRP, lökosit ve ferritin "tek bir organa özgü değil" olarak işaretlenir', () => {
    const out = interpret([r('crp', 20, 'high', undefined, 5), r('wbc', 12, 'high', 4, 10.5), r('ferritin', 400, 'high', 30, 400), r('alt', 30, 'normal', undefined, 41)]);
    const byKey = Object.fromEntries(out.findings.map((f) => [f.testKey, f]));
    expect(byKey.crp!.nonSpecific).toMatch(/yerini göstermez/);
    expect(byKey.wbc!.nonSpecific).toBeTruthy();
    expect(byKey.ferritin!.nonSpecific).toBeTruthy();
    expect(byKey.alt!.nonSpecific).toBeUndefined();
  });
});
