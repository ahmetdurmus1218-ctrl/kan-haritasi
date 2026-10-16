import { describe, expect, it } from 'vitest';
import { INTERIORS, interiorById } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { INSIDE } from '../explore/inside/registry';
import { INSIDE_CONTENT } from '../explore/inside/content';
import { LEVEL_DEPTH, levelActions, levelCrumbs, levelView, resolveScenes, structureOfInterior } from '../explore/interiorNav';

const def = (id: string) => interiorById(id)!;
const ids = (id: string) => def(id).stages.map((s) => s.id);
/** Bir basamaktan eylemle gidilen basamak (yalnızca basamak hedefleri). */
const go = (id: string, idx: number, action: string) => {
  const a = levelActions(levelView(def(id), idx)).find((x) => x.id === action);
  return a?.to && 'stage' in a.to ? a.to.stage : undefined;
};

describe('İçine gir — kademeli 3B gezinme seviyeleri', () => {
  it('kalın bağırsak: İlerle ile lümen → içerik → hareket → su/elektrolit → mikrobiyota → dışkı; Duvarı incele → duvar → mukoza → kript → epitel → hücre → molekül', () => {
    const d = def('large-intestine');
    const seen: string[] = [];
    let i = 0;
    for (;;) {
      seen.push(d.stages[i]!.id);
      const n = go('large-intestine', i, 'forward');
      if (n === undefined) break;
      i = n;
    }
    expect(seen.slice(0, 7)).toEqual(['lumen', 'contents', 'motion', 'water', 'microbiota', 'concentration', 'feces']);
    const wall = go('large-intestine', 0, 'wall')!;
    expect(d.stages[wall]!.kind).toBe('wall');
    const deep = [d.stages[wall]!.id];
    for (let k = wall; ; ) {
      const n = go('large-intestine', k, 'deeper');
      if (n === undefined) break;
      deep.push(d.stages[n]!.id);
      k = n;
    }
    expect(deep).toEqual(['wall', 'mucosa', 'crypt', 'epithelium', 'colonocyte', 'scfa']);
    expect(deep.map((s) => levelView(d, ids('large-intestine').indexOf(s)).level)).toEqual(['wall', 'tissue', 'tissue', 'tissue', 'cell', 'molecule']);
  });

  it('her seviye ayrı 3B sahne/kamera durumu: iç dünya bir sahne, duvar ayrı sahne, doku/hücre eğitsel sahneler', () => {
    const d = def('large-intestine');
    const at = (s: string) => levelView(d, ids('large-intestine').indexOf(s));
    expect(at('lumen').sceneKey).toBe('ic:large-intestine');
    expect(at('motion').sceneKey).toBe('ic:large-intestine');
    // aynı sahnede kamera ilerler (İlerle = lümende ileri)
    const p = (s: string) => (at(s).scene as { progress: number }).progress;
    expect(p('contents')).toBeGreaterThan(p('lumen'));
    expect(p('feces')).toBeGreaterThan(p('motion'));
    expect(at('wall').sceneKey).toBe('ic:large-intestine:duvar');
    expect(at('mucosa').sceneKey).toBe('in:kalin-bagirsak');
    // ardışık doku basamakları aynı sahnede epitel katmanına giderek yaklaşır (kas katmanına kaymaz)
    const sc = (s: string) => at(s).scene as { selected: string | null; depth: number };
    expect(sc('mucosa').selected).toBeNull();
    expect(sc('crypt').selected).toBe('kriptler');
    expect([sc('crypt').depth, sc('epithelium').depth, sc('colonocyte').depth, sc('scfa').depth]).toEqual([0, 1, 2, 3]);
    expect(sc('colonocyte').selected).toBe('kriptler');
    // ince bağırsakta villus sahnesinin aşamaları ilerler (genel → enterosit → emilim)
    const si = def('small-intestine');
    const vs = (s: string) => levelView(si, si.stages.findIndex((x) => x.id === s)).scene as { id: string; stage: number };
    expect(vs('villus').stage).toBeGreaterThan(vs('mucosa').stage);
    expect(vs('enterocyte').stage).toBeGreaterThan(vs('villus').stage);
  });

  it('organın içindeyken yalnızca o seviyenin eylemleri (en fazla 5), bütün ağaç listelenmez; organdan duvara/hücreye "İlerle" yok', () => {
    for (const d of INTERIORS) {
      for (let i = 0; i < d.stages.length; i++) {
        const v = levelView(d, i);
        const acts = levelActions(v);
        expect(acts.length, `${d.organId}/${i}`).toBeLessThanOrEqual(5);
        expect(acts.some((a) => a.id === 'back'), `${d.organId}/${i} geri`).toBe(true);
        if (v.level === 'interior') {
          const f = acts.find((a) => a.id === 'forward');
          if (f?.to && 'stage' in f.to) expect(['interior', 'region']).toContain(d.stages[f.to.stage]!.scale);
        }
      }
      // İçine gir'in ilk seviyesi her zaman organın içi
      expect(levelView(d, 0).level, d.organId).toBe('interior');
    }
  });

  it('geri: her seviyeden bir üst seviyeye; ilk iç basamaktan organa (3B vücut) çıkılır', () => {
    const d = def('large-intestine');
    for (let i = 1; i < d.stages.length; i++) expect(go('large-intestine', i, 'back')).toBe(i - 1);
    const back = levelActions(levelView(d, 0)).find((a) => a.id === 'back')!;
    expect(back.to).toEqual({ body: 'large-intestine' });
    expect(levelActions(levelView(def('large-intestine.rectum'), 0)).find((a) => a.id === 'back')!.to).toEqual({ interior: 'large-intestine' });
  });

  it('breadcrumb: içeride geçilen iç basamaklar, derinde duvardan itibaren', () => {
    const d = def('large-intestine');
    const labels = (s: string) => levelCrumbs(levelView(d, ids('large-intestine').indexOf(s))).map((c) => c.label);
    expect(labels('motion')).toEqual(['Kalın bağırsak', 'İçerisi', 'İçerik', 'Hareket']);
    expect(labels('crypt')).toEqual(['Kalın bağırsak', 'İçerisi', 'Duvar', 'Kalın bağırsak mukozası', 'Kript']);
  });

  it('kabul organları: ince bağırsak, kalp, akciğer, böbrek, karaciğer, beyin akışları ve derinlik sırası', () => {
    const path = (id: string) => def(id).stages.map((s) => s.id);
    expect(path('small-intestine').slice(0, 5)).toEqual(['lumen', 'contents', 'motion', 'digestion', 'absorption']);
    expect(path('small-intestine').indexOf('villus')).toBeGreaterThan(path('small-intestine').indexOf('wall'));
    expect(path('heart')).toEqual(expect.arrayContaining(['ra', 'tricuspid', 'rv', 'lv', 'aorta', 'wall', 'myocardium', 'cardiomyocyte']));
    expect(path('lungs').slice(0, 6)).toEqual(['air', 'trachea', 'bronchus', 'bronchiole', 'alveolus', 'exchange']);
    expect(path('kidneys')).toEqual(expect.arrayContaining(['parenchyma', 'cortex', 'medulla', 'nephron', 'filtration']));
    expect(path('liver')).toEqual(expect.arrayContaining(['parenchyma', 'blood-in', 'sinusoid', 'hepatocyte', 'bile']));
    expect(path('brain')).toEqual(expect.arrayContaining(['parenchyma', 'cortex', 'white-matter', 'network', 'synapse']));
    for (const id of INTERIORS.map((d) => d.organId)) {
      const d = def(id);
      const depth = d.stages.map((_, i) => LEVEL_DEPTH[levelView(d, i).level]);
      // ölçek geri gitmez (duvar = doku ölçeğinde ilk basamak)
      for (let i = 1; i < depth.length; i++) if (d.stages[i]!.kind !== 'wall' && d.stages[i - 1]!.kind !== 'wall') expect(depth[i]!, `${id}/${i}`).toBeGreaterThanOrEqual(depth[i - 1]!);
    }
  });

  it('her basamağın sahnesi gerçekten var (eğitsel sahne kaydı ve aşama aralığı); organların 3B yapısı bulunur', () => {
    for (const d of INTERIORS) {
      resolveScenes(d).forEach((sc, i) => {
        if (sc.kind !== 'inside') return;
        expect(sc.id in INSIDE, `${d.organId}/${i}`).toBe(true);
        expect(sc.stage, `${d.organId}/${i}`).toBeLessThan(INSIDE_CONTENT[sc.id].stages.length);
      });
      const s = structureOfInterior(d);
      if (s) expect(structureById.has(s)).toBe(true);
    }
    for (const id of ['large-intestine', 'small-intestine', 'stomach', 'heart', 'lungs', 'kidneys', 'liver', 'brain', 'eyes', 'ear']) expect(structureOfInterior(def(id)), id).toBeTruthy();
  });
});
