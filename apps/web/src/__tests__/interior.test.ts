import { describe, expect, it } from 'vitest';
import { GRAPH, INTERIORS, PHYSIO_CHAINS, interiorFor } from '@kh/analysis';
import { STRUCTURES } from '@kh/catalog';
import { hrefFor, parseHash } from '../state/router';
import { INSIDE } from '../explore/inside/registry';
import { insideRoute, interiorForStructure } from '../lib/anatomyNav';
import { search } from '../lib/search';

describe('İçine gir — web bağları', () => {
  it('rotalar: #/ic/<iç dünya>/<basamak>/<mod> ve #/fizyoloji/<zincir> gidiş-dönüş', () => {
    expect(parseHash('#/ic/small-intestine')).toEqual({ name: 'interior', id: 'small-intestine' });
    expect(parseHash('#/ic/small-intestine/5/emilim')).toEqual({ name: 'interior', id: 'small-intestine', stage: 5, mode: 'emilim' });
    expect(parseHash('#/ic/ic.bone-marrow/2')).toEqual({ name: 'interior', id: 'ic.bone-marrow', stage: 2 });
    expect(parseHash('#/ic/<script>')).toEqual({ name: 'mybody' });
    // Kişisel organ (gerçek maske) → içi
    expect(parseHash('#/kisisel/liver')).toEqual({ name: 'personalOrgan', id: 'liver' });
    expect(parseHash('#/kisisel/large-intestine/ic')).toEqual({ name: 'personalOrgan', id: 'large-intestine', inside: true });
    expect(parseHash('#/kisisel/<x>')).toEqual({ name: 'mybody' });
    for (const r of [{ name: 'interior', id: 'liver', stage: 4 }, { name: 'interior', id: 'small-intestine', stage: 1, mode: 'sindirim' }, { name: 'physiology', id: 'b12' }, { name: 'physiology' }, { name: 'organ', id: 'stomach', view: 'doku' }, { name: 'personalOrgan', id: 'kidneys' }, { name: 'personalOrgan', id: 'urinary-tract.bladder', inside: true }] as const)
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

  it('3B kataloğundaki HER yapı bir iç dünyaya yönlenir (3B vücutta "İçine gir" hiçbir organda eksik değil)', () => {
    expect(STRUCTURES.filter((s) => !interiorForStructure(s.id)).map((s) => s.id)).toEqual([]);
    for (const id of ['heart', 'lungs', 'liver', 'kidneys', 'stomach', 'small-intestine', 'large-intestine', 'brain', 'eyes', 'ear', 'skin', 'aorta', 'veins', 'uterus', 'ovaries', 'testes', 'prostate', 'pancreas', 'thyroid', 'adrenals', 'pituitary', 'spinal-cord', 'nerves', 'bones', 'knee', 'skeletal-muscle', 'vagina', 'urinary-tract', 'gallbladder', 'esophagus', 'airways'])
      expect(interiorFor(id), id).toBeDefined();
  });

  it('"İçine gir" düğmeleri (model yapısı, bulgu, kişisel 3B) organın iç dünyasını açar — derin görünüme (doku/hücre) değil', () => {
    expect(insideRoute('large-intestine')).toEqual({ name: 'interior', id: 'large-intestine' });
    expect(insideRoute('liver')).toEqual({ name: 'interior', id: 'liver' });
    expect(insideRoute('kidneys')).toEqual({ name: 'interior', id: 'kidneys' });
    expect(insideRoute('heart')).toEqual({ name: 'interior', id: 'heart' });
    // Organın alt bölümü (segment, kapak) de organın içine girer; mikroanatomi düğümü de en yakın iç dünyaya
    expect(insideRoute('tissue.villus')).toEqual({ name: 'interior', id: 'small-intestine' });
    for (const n of GRAPH.nodes.values()) if (n.kind === 'organ' || n.kind === 'region') expect(insideRoute(n.id).name, n.id).toBe('interior');
  });

  it('arama: organın "İçine gir" bağlantısı iç dünyaya gider (duvar/doku adımlarına değil)', () => {
    const hit = search('kalın bağırsak').find((h) => h.kind === 'organ')!;
    const link = hit.links.find((l) => l.label === 'İçine gir')!;
    expect(link.route).toEqual({ name: 'interior', id: 'large-intestine' });
  });

  it('fizyoloji zincirleri boş değil', () => {
    expect(PHYSIO_CHAINS.length).toBeGreaterThanOrEqual(10);
  });
});
