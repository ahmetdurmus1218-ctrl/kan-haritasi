import { describe, expect, it } from 'vitest';
import { DERIVED, ckdEpi2021, computeDerived, derivedById, o2Saturation, alveolarPo2, glomerulus, lengthTension, hillForce, eK } from '../index';

describe('kapalı biçimli bağıntılar', () => {
  it('oksijen-hemoglobin eğrisi: P50 ≈ 26,8 mmHg; 100 mmHg\'de ≈ %97,5; asidozda sağa kayar (Bohr)', () => {
    expect(o2Saturation(26.8)).toBeCloseTo(0.5, 1);
    expect(o2Saturation(100)).toBeGreaterThan(0.97);
    expect(o2Saturation(40)).toBeCloseTo(0.75, 1);
    expect(o2Saturation(40, 7.2)).toBeLessThan(o2Saturation(40, 7.4));
    expect(o2Saturation(0)).toBe(0);
  });
  it('alveol gaz denklemi: oda havası, deniz düzeyi, pCO₂ 40 → ≈ 100 mmHg', () => {
    expect(alveolarPo2(0.21, 760, 40)).toBeCloseTo(99.7, 0);
  });
  it('glomerül: Kf sıfıra giderken GFR sıfıra gider; onkotik basınç düşünce GFR artar', () => {
    const base = { map: 93, ra: 1, re: 1, kf: 10, pia: 25, prod: 1 };
    expect(glomerulus({ ...base, kf: 1 }).gfr).toBeLessThan(20);
    expect(glomerulus({ ...base, pia: 18 }).gfr).toBeGreaterThan(glomerulus(base).gfr);
  });
  it('boy–gerim platosu 2,0–2,25 µm; Hill: hız 0 → F₀, en yüksek hız → 0; Nernst kayması', () => {
    expect(lengthTension(2.1)).toBe(1);
    expect(lengthTension(1.2)).toBe(0);
    expect(lengthTension(3.7)).toBe(0);
    expect(hillForce(0)).toBeCloseTo(1, 6);
    expect(hillForce(1)).toBeCloseTo(0, 6);
    expect(eK(4.5)).toBeCloseTo(-77, 6);
    expect(eK(9)).toBeGreaterThan(-62);
  });
});

describe('hesaplanan değerler (yalnızca aynı rapordan)', () => {
  it('CKD-EPI 2021: yayımlanan denklemle aynı (K 60 y, Kr 1,0 → 64; E 40 y, Kr 0,9 → 111)', () => {
    expect(Math.round(ckdEpi2021(1.0, 60, 'female'))).toBe(64);
    expect(Math.round(ckdEpi2021(0.9, 40, 'male'))).toBe(111);
  });
  it('her hesap formül, anlam, sınır ve kaynak taşır', () => {
    for (const d of DERIVED) {
      expect(d.formula.length, d.id).toBeGreaterThan(5);
      expect(d.limits.length, d.id).toBeGreaterThanOrEqual(1);
      expect(d.source.length, d.id).toBeGreaterThan(10);
      expect(d.needs.length, d.id).toBeGreaterThanOrEqual(1);
    }
    expect(derivedById.size).toBe(DERIVED.length);
  });
  const get = (rs: ReturnType<typeof computeDerived>, id: string) => rs.find((r) => r.def.id === id)!;
  it('anyon açığı, ozmolalite, düzeltilmiş kalsiyum, Friedewald, doygunluk', () => {
    const rs = computeDerived(
      [{ id: 'r1', date: '2026-03-01', values: { sodium: 140, chloride: 104, hco3: 24, glucose: 90, bun: 14, calcium: 8, albumin: 3, 'cholesterol-total': 200, hdl: 50, triglyceride: 150, iron: 60, tibc: 300 } }],
      {},
    );
    expect(get(rs, 'anion-gap').value).toBe(12);
    expect(get(rs, 'osmolality').value).toBeCloseTo(290, 0);
    expect(get(rs, 'corrected-calcium').value).toBeCloseTo(8.8, 5);
    expect(get(rs, 'ldl-friedewald').value).toBe(120);
    expect(get(rs, 'tsat').value).toBe(20);
    expect(get(rs, 'anion-gap').inputs.map((i) => i.key)).toEqual(['sodium', 'chloride', 'hco3']);
    expect(get(rs, 'anion-gap').reportId).toBe('r1');
  });
  it('farklı raporlardaki değerler KARIŞTIRILMAZ: sodyum bir raporda, klor ve bikarbonat başka raporda → hesap yok', () => {
    const rs = computeDerived(
      [
        { id: 'a', date: '2026-01-01', values: { sodium: 140 } },
        { id: 'b', date: '2026-02-01', values: { chloride: 100, hco3: 24 } },
      ],
      {},
    );
    const ag = get(rs, 'anion-gap');
    expect(ag.value).toBeNull();
    expect(ag.missing?.tests).toEqual(['sodium', 'chloride', 'hco3']);
  });
  it('hiç ölçülmemiş girdi adıyla bildirilir; en yeni TAM rapor kullanılır', () => {
    const rs = computeDerived(
      [
        { id: 'old', date: '2025-01-01', values: { iron: 50, tibc: 400 } },
        { id: 'new', date: '2026-01-01', values: { iron: 90, tibc: 300 } },
        { id: 'newest', date: '2026-05-01', values: { iron: 70 } },
      ],
      {},
    );
    expect(get(rs, 'tsat').value).toBe(30);
    expect(get(rs, 'tsat').reportId).toBe('new');
    expect(get(rs, 'homa-ir').missing?.tests).toEqual(['glucose', 'insulin']);
  });
  it('eGFR yaş ve cinsiyet olmadan hesaplanmaz; trigliserid ≥ 400 iken Friedewald hesaplanmaz; HCO₃⁻ normalken beklenen pCO₂ yok', () => {
    const reports = [{ id: 'r', date: '2026-01-01', values: { creatinine: 1, 'cholesterol-total': 260, hdl: 40, triglyceride: 450, hco3: 24 } }];
    expect(get(computeDerived(reports, {}), 'egfr-ckdepi').missing).toEqual({ tests: [], age: true, sex: true });
    expect(get(computeDerived(reports, { age: 60 }), 'egfr-ckdepi').missing).toEqual({ tests: [], sex: true });
    expect(Math.round(get(computeDerived(reports, { age: 60, sex: 'female' }), 'egfr-ckdepi').value!)).toBe(64);
    expect(get(computeDerived(reports, { age: 12, sex: 'female' }), 'egfr-ckdepi').missing?.outOfRange).toBe(true);
    expect(get(computeDerived(reports, {}), 'ldl-friedewald').missing?.outOfRange).toBe(true);
    expect(get(computeDerived(reports, {}), 'winter').value).toBeNull();
    expect(get(computeDerived([{ id: 'x', date: '2026-01-01', values: { hco3: 12 } }], {}), 'winter').value).toBe(26);
  });
});
