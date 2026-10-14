import { describe, expect, it } from 'vitest';
import { INTERIORS, PHYSIO_CHAINS, interiorFor } from '@kh/analysis';
import { STRUCTURES } from '@kh/catalog';
import { hrefFor, parseHash } from '../state/router';
import { INSIDE } from '../explore/inside/registry';

describe('İçine gir — web bağları', () => {
  it('rotalar: #/ic/<iç dünya>/<basamak>/<mod> ve #/fizyoloji/<zincir> gidiş-dönüş', () => {
    expect(parseHash('#/ic/small-intestine')).toEqual({ name: 'interior', id: 'small-intestine' });
    expect(parseHash('#/ic/small-intestine/5/emilim')).toEqual({ name: 'interior', id: 'small-intestine', stage: 5, mode: 'emilim' });
    expect(parseHash('#/ic/ic.bone-marrow/2')).toEqual({ name: 'interior', id: 'ic.bone-marrow', stage: 2 });
    expect(parseHash('#/ic/<script>')).toEqual({ name: 'mybody' });
    for (const r of [{ name: 'interior', id: 'liver', stage: 4 }, { name: 'interior', id: 'small-intestine', stage: 1, mode: 'sindirim' }, { name: 'physiology', id: 'b12' }, { name: 'physiology' }, { name: 'organ', id: 'stomach', view: 'doku' }] as const)
      expect(parseHash(hrefFor(r))).toEqual(r);
  });

  it('her basamağın eğitsel sahnesi web kaydında var; ince bağırsak dışında villus sahnesi yok', () => {
    for (const d of INTERIORS)
      for (const s of d.stages) {
        if (!s.scene) continue;
        expect(s.scene in INSIDE, `${d.organId}/${s.id}: ${s.scene}`).toBe(true);
        if (s.scene === 'villus') expect(d.organId.startsWith('small-intestine'), `${d.organId}/${s.id}`).toBe(true);
      }
  });

  it('3B kataloğundaki ana yapıların çoğu bir iç dünyaya yönlenir', () => {
    const organs = STRUCTURES;
    const mapped = organs.filter((s) => interiorFor(s.id));
    expect(mapped.length / organs.length).toBeGreaterThan(0.6);
    for (const id of ['heart', 'lungs', 'liver', 'kidneys', 'stomach', 'small-intestine', 'large-intestine', 'brain', 'eyes', 'ear', 'skin', 'aorta', 'veins', 'uterus', 'ovaries', 'testes', 'prostate', 'pancreas', 'thyroid', 'adrenals', 'pituitary', 'spinal-cord', 'nerves', 'bones', 'knee', 'skeletal-muscle', 'vagina', 'urinary-tract', 'gallbladder', 'esophagus', 'airways'])
      expect(interiorFor(id), id).toBeDefined();
  });

  it('fizyoloji zincirleri boş değil', () => {
    expect(PHYSIO_CHAINS.length).toBeGreaterThanOrEqual(10);
  });
});
