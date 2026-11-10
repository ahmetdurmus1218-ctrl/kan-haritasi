import { describe, expect, it } from 'vitest';
import { CURATED_EVIDENCE_KEYS, EVIDENCE_LABEL, TESTS, evidenceFor, structureById, testByKey, testsForStructure } from '../index';

describe('tahlil → organ ilişki kataloğu (kanıt düzeyli)', () => {
  it('katalogdaki HER testin kanıt kaydı var; her ilişkinin yapısı, düzeyi ve dayanağı tanımlı', () => {
    for (const t of TESTS) {
      const e = evidenceFor(t.key);
      expect(e, t.key).toBeTruthy();
      expect(e!.measures.length, t.key).toBeGreaterThan(3);
      expect(e!.cannotTell.length, t.key).toBeGreaterThan(10);
      expect(e!.source.length, t.key).toBeGreaterThan(5);
      for (const r of e!.relations) {
        expect(structureById.has(r.structure), `${t.key} → ${r.structure}`).toBe(true);
        expect(['established', 'possible', 'educational']).toContain(r.level);
        expect(r.basis.length, `${t.key} → ${r.structure}`).toBeGreaterThan(10);
      }
      for (const k of e!.complements) expect(testByKey.has(k), `${t.key} tamamlayıcı ${k}`).toBe(true);
      expect(new Set(e!.relations.map((r) => r.structure)).size, `${t.key}: yinelenen yapı`).toBe(e!.relations.length);
    }
  });
  it('elle yazılmış kayıtların hepsi katalogdaki bir teste ait ve en az 35 tane', () => {
    expect(CURATED_EVIDENCE_KEYS.length).toBeGreaterThanOrEqual(35);
    for (const k of CURATED_EVIDENCE_KEYS) {
      expect(testByKey.has(k), k).toBe(true);
      expect(evidenceFor(k)!.curated, k).toBe(true);
    }
  });
  it('CRP hiçbir organa "bilinen ilişki" ile bağlanmaz; yalnızca eğitimsel mekanizma', () => {
    const crp = evidenceFor('crp')!;
    expect(crp.relations.every((r) => r.level === 'educational')).toBe(true);
    expect(crp.cannotTell).toMatch(/organa atanamaz/);
    expect(testsForStructure('liver').find((x) => x.test.key === 'crp')!.relation.level).toBe('educational');
  });
  it('tek organa özgü olmayan testlerde (katalog: nonSpecific) kuralla türetilen hiçbir ilişki "bilinen" değildir', () => {
    for (const t of TESTS) {
      const e = evidenceFor(t.key)!;
      if (e.curated || !t.nonSpecific) continue;
      expect(e.relations.every((r) => r.level === 'possible'), t.key).toBe(true);
    }
  });
  it('örnek zincirler: HbA1c → pankreas (bilinen), böbrek/göz damarı (olası); ALT → karaciğer; kreatinin → böbrek + kas; TSH → tiroid + hipofiz', () => {
    const level = (test: string, s: string) => evidenceFor(test)!.relations.find((r) => r.structure === s)?.level;
    expect(level('hba1c', 'pancreas')).toBe('established');
    expect(level('hba1c', 'kidneys')).toBe('possible');
    expect(level('hba1c', 'liver')).toBe('educational');
    expect(level('alt', 'liver')).toBe('established');
    expect(level('creatinine', 'kidneys')).toBe('established');
    expect(level('creatinine', 'skeletal-muscle')).toBe('established');
    expect(level('tsh', 'thyroid')).toBe('established');
    expect(level('tsh', 'pituitary')).toBe('established');
    expect(level('ferritin', 'bones')).toBe('established');
    expect(evidenceFor('ferritin')!.cannotTell).toMatch(/iltihap/);
  });
  it('bir yapının testleri en güçlü ilişkiden zayıfa sıralanır; düzey adları tanımlı', () => {
    const liver = testsForStructure('liver');
    expect(liver.length).toBeGreaterThan(8);
    const ranks = liver.map((x) => ({ established: 3, possible: 2, educational: 1 })[x.relation.level]);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
    expect(Object.keys(EVIDENCE_LABEL)).toEqual(['measured', 'established', 'possible', 'educational', 'insufficient']);
  });
});
