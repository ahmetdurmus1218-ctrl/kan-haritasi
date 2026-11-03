import { describe, expect, it } from 'vitest';
import { testByKey } from '@kh/catalog';
import {
  CONDITIONS,
  LAB_EFFECTS,
  differential,
  directionEffect,
  effectKey,
  effectsAtInterior,
  entriesForTest,
  labEffect,
  normalAtInterior,
  notMeaningful,
  rankCauses,
  sceneShiftFor,
  testsForInterior,
  validateLabEffects,
} from '../labEffects';
import { type LabObservation, REPORTED } from '../types';

const lab = (testKey: string, status: LabObservation['status'], value = 1, extra: Partial<LabObservation> = {}): LabObservation => ({
  testKey,
  name: testByKey.get(testKey)?.nameTr ?? testKey,
  value,
  unit: testByKey.get(testKey)?.unit ?? '',
  status,
  date: '2026-10-01',
  source: 'LAB',
  confidence: REPORTED,
  ...extra,
});

describe('Tahlil → vücut etkisi bilgi tabanı: bütünlük', () => {
  it('her katalog testi, iç dünya, basamak, neden ve imza testi gerçekten var', () => {
    expect(validateLabEffects()).toEqual([]);
  });

  it('katalogdaki 100 testin hepsi kapsanıyor (akyuvar alt türleri sayı/yüzde ortak)', () => {
    expect(testByKey.size).toBeGreaterThanOrEqual(100);
    for (const k of testByKey.keys()) expect(labEffect(k), k).toBeTruthy();
    expect(effectKey('neutrophil-abs')).toBe('neutrophil');
    expect(effectKey('lymphocyte-pct')).toBe('lymphocyte');
  });

  it('her yön ya bir etki (yer + mekanizma + neden) ya da "anlam taşımaz" gerekçesi taşır', () => {
    for (const e of LAB_EFFECTS)
      for (const d of ['high', 'low'] as const) {
        const eff = directionEffect(e.test, d);
        if (eff) {
          expect(eff.sites.length, `${e.test}/${d}`).toBeGreaterThan(0);
          expect(eff.causes.length, `${e.test}/${d}`).toBeGreaterThan(0);
        } else expect(notMeaningful(e.test, d), `${e.test}/${d}`).toMatch(/\S{3,}/);
      }
  });

  it('geniş neden kataloğu: hastalık, ilaç, beslenme, fizyolojik, kalıtsal ve örnek kaynaklı nedenler', () => {
    expect(CONDITIONS.length).toBeGreaterThanOrEqual(130);
    const kinds = new Set(CONDITIONS.map((c) => c.kind));
    for (const k of ['disease', 'medication', 'nutrition', 'physiological', 'genetic', 'sample', 'lifestyle']) expect(kinds.has(k as never), k).toBe(true);
    // Türkiye'de sık görülen durumlar
    for (const id of ['thalassemia-trait', 'g6pd', 'brucellosis', 'cchf']) expect(CONDITIONS.some((c) => c.id === id), id).toBe(true);
  });
});

describe('Olası nedenler: diğer sonuçlara göre sıralama (tanı değil)', () => {
  it('düşük hemoglobin + düşük MCV + düşük ferritin → demir eksikliği önde; talasemi taşıyıcılığı ferritin düşükken geride', () => {
    const labs = [lab('hemoglobin', 'low', 10.1), lab('mcv', 'low', 72), lab('ferritin', 'low', 6), lab('rdw', 'high', 17)];
    const r = rankCauses('hemoglobin', 'low', labs);
    expect(r[0]!.condition.id).toBe('iron-deficiency');
    expect(r[0]!.supporting.map((s) => s.clue.test)).toEqual(expect.arrayContaining(['ferritin', 'mcv']));
    const thal = r.find((x) => x.condition.id === 'thalassemia-trait')!;
    expect(thal.contradicting.some((c) => c.clue.test === 'ferritin')).toBe(true);
    expect(thal.fit).toBeLessThan(r[0]!.fit);
  });

  it('düşük MCV + yüksek RBC + normal ferritin → talasemi taşıyıcılığı demir eksikliğinin önüne geçer', () => {
    const labs = [lab('hemoglobin', 'low', 11.6), lab('mcv', 'low', 64), lab('rbc', 'high', 6.1), lab('ferritin', 'normal', 80), lab('rdw', 'normal', 13)];
    const r = rankCauses('mcv', 'low', labs);
    expect(r[0]!.condition.id).toBe('thalassemia-trait');
  });

  it('yüksek potasyum, kreatinin normal ve LDH yüksek → örnek hemolizi açıkça "örnek kaynaklı" olarak üst sıralarda', () => {
    const labs = [lab('potassium', 'high', 6.2), lab('creatinine', 'normal', 0.8), lab('ldh', 'high', 400), lab('hemoglobin', 'normal', 14)];
    const r = rankCauses('potassium', 'high', labs);
    expect(r[0]!.condition.id).toBe('sample-hemolysis');
    expect(r[0]!.condition.kind).toBe('sample');
  });

  it('ölçülmeyen test "eksik" sayılır, asla normal ya da anormal sayılmaz', () => {
    const r = rankCauses('alt', 'high', [lab('alt', 'high', 120)]);
    for (const x of r) {
      expect(x.supporting.every((s) => s.clue.test === 'alt')).toBe(true);
      expect(x.contradicting).toEqual([]);
    }
    expect(r[0]!.missing.length).toBeGreaterThan(0);
  });

  it('cinsiyete özgü nedenler cinsiyet biliniyorsa süzülür', () => {
    const r = rankCauses('psa', 'high', [lab('psa', 'high', 6)], { sex: 'female' });
    expect(r.every((x) => x.condition.sex !== 'male')).toBe(true);
  });

  it('tüm sonuçlara birlikte bakış: en az iki referans dışı sonucun desteklediği nedenler', () => {
    const labs = [lab('tsh', 'high', 9), lab('ft4', 'low', 0.6), lab('cholesterol-total', 'high', 260), lab('ck', 'high', 400)];
    const d = differential(labs);
    expect(d[0]!.condition.id).toBe('hypothyroid');
    expect(differential([lab('glucose', 'normal', 90)])).toEqual([]);
  });
});

describe('İçine gir bağı: normal ↔ senin sonucun', () => {
  it('düşük hemoglobin kemik iliğinin alyuvar yapım basamağını ve kılcalı etkiler; sahne soluk ve seyrek alyuvar gösterir', () => {
    const labs = [lab('hemoglobin', 'low', 8.5, { severity: 'marked' })];
    const fx = effectsAtInterior('ic.bone-marrow', 'erythropoiesis', labs);
    expect(fx[0]!.exact).toBe(true);
    expect(fx[0]!.site.text).toMatch(/Üretim/);
    const { shift, from } = sceneShiftFor('ic.capillary', labs);
    expect(shift.rbc).toBeLessThan(1);
    expect(shift.pale).toBeGreaterThan(0.4);
    expect(from[0]!.lab.testKey).toBe('hemoglobin');
  });

  it('hafif sapma görsel etkiyi yarıya indirir', () => {
    const strong = sceneShiftFor('ic.artery', [lab('ldl', 'high', 220, { severity: 'marked' })]).shift.plaque!;
    const mild = sceneShiftFor('ic.artery', [lab('ldl', 'high', 135, { severity: 'mild' })]).shift.plaque!;
    expect(mild).toBeLessThan(strong);
  });

  it('normal yol: karaciğer hepatositinden geçen testler "burada normalde ne olur" diye listelenir', () => {
    const here = normalAtInterior('liver', 'hepatocyte').map((n) => n.testKey);
    expect(here).toEqual(expect.arrayContaining(['alt', 'albumin', 'ferritin']));
  });

  it('nereden nereye girilir: B12 midede başlar, ileumdan emilir, iliği ve miyelini etkiler', () => {
    const e = entriesForTest('b12');
    expect(e.normal.map((s) => s.interior)).toEqual(['stomach', 'stomach', 'small-intestine.ileum', 'liver', 'ic.bone-marrow', 'brain.white-matter']);
    expect(e.low.map((s) => s.interior)).toEqual(expect.arrayContaining(['nerves', 'brain.white-matter', 'ic.bone-marrow']));
    expect(testsForInterior('small-intestine.ileum')).toContain('b12');
  });

  it('referans içi sonuç iç dünyada etki üretmez', () => {
    expect(effectsAtInterior('ic.bone-marrow', undefined, [lab('hemoglobin', 'normal', 14)])).toEqual([]);
    expect(sceneShiftFor('ic.capillary', [lab('hemoglobin', 'normal', 14)]).shift).toEqual({});
  });
});
