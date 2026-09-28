import { describe, expect, it } from 'vitest';
import { PARTS, STRUCTURES, cleanNodeName, partDef, partFor, partsOf, structureById } from '../index';

describe('organ bölümleri kataloğu', () => {
  it('her bölüm var olan bir yapıya bağlı, anahtarı yapı içinde tekil ve rota için güvenli', () => {
    const seen = new Set<string>();
    for (const p of PARTS) {
      expect(structureById.has(p.structure), p.structure).toBe(true);
      expect(p.key).toMatch(/^[a-z0-9-]{1,40}$/);
      const k = `${p.structure}|${p.key}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
      expect(p.tr.length).toBeGreaterThan(1);
    }
  });

  it('kaynak düğüm adları sadeleştirilir', () => {
    expect(cleanNodeName('VH_M_left_cardiac_atrium')).toBe('left cardiac atrium');
    expect(cleanNodeName('VH_F__Renal__Pyramid')).toBe('renal pyramid');
  });

  it('kalp ve böbrek düğümleri doğru bölüme eşlenir; kuralı olmayan ad "other" olur', () => {
    expect(partFor('heart', 'VH_M_left_ventricle')).toBe('left-ventricle');
    expect(partFor('heart', 'VH_F_mitral_valve')).toBe('mitral');
    expect(partFor('kidneys', 'VH_M_renal_pyramid_L_a')).toBe('pyramid');
    expect(partFor('heart', 'VH_M_bilinmeyen')).toBe('other');
    expect(partFor('spleen-yok', 'x')).toBeNull();
  });

  it('bölüm tanımı anahtarla bulunur; iç bölümler işaretli', () => {
    expect(partDef('heart', 'mitral')?.inner).toBe(true);
    expect(partDef('heart', null)).toBeUndefined();
    expect(partsOf('brain').length).toBeGreaterThanOrEqual(20);
  });

  it('cinsiyete özgü yapılar işaretli ve Latince adlar dolu', () => {
    for (const id of ['ovaries', 'uterus', 'fallopian-tubes', 'vagina', 'breasts']) expect(structureById.get(id)?.sex).toBe('female');
    for (const id of ['prostate', 'testes', 'male-genitals']) expect(structureById.get(id)?.sex).toBe('male');
    for (const s of STRUCTURES) if (s.asset) expect(s.latin, s.id).toBeTruthy();
  });
});
