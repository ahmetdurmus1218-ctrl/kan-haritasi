import { describe, expect, it } from 'vitest';
import { STRUCTURES } from '@kh/catalog';
import { hrefFor, parseHash } from '../state/router';
import { fold, searchAnatomy } from '../explore/SearchOverlay';
import { CONNECTIONS, ORGANS, insidesOf } from '../anatomy/organs';
import { INSIDE } from '../explore/inside/registry';
import { INSIDE_CONTENT } from '../explore/inside/content';
import { MODEL_COVERAGE } from '../anatomy/coverage.generated';
import { inBody } from '../explore/systems';

describe('keşif rotaları', () => {
  it('bölüm ve simülasyon kipi rotada gidip gelir', () => {
    const routes = [
      { name: 'body', structure: 'heart', part: 'left-ventricle' },
      { name: 'simulation', id: 'noron', from: 'brain', mode: 'temel' },
      { name: 'simulation', id: 'nefron', from: 'kidneys', mode: 'benim' },
      { name: 'simulation', id: 'hucre', mode: 'temel' },
      { name: 'simulation', id: 'alveol', from: 'lungs' },
      { name: 'coverage' },
    ] as const;
    for (const r of routes) expect(parseHash(hrefFor(r))).toEqual(r);
  });

  it('bozuk kip ya da bölüm yok sayılır', () => {
    expect(parseHash('#/simulasyon/noron/brain/HACK')).toEqual({ name: 'simulation', id: 'noron', from: 'brain' });
    expect(parseHash('#/vucut/yapi/heart/<script>')).toEqual({ name: 'body', structure: 'heart' });
  });
});

describe('anatomik arama', () => {
  it('Türkçe karakterleri sadeleştirir', () => {
    expect(fold('Böbreküstü BEZLERİ')).toBe('bobrekustu bezleri');
    expect(fold('Işık')).toBe('isik');
  });

  it('Türkçe, Latince ve bölüm adıyla bulur', () => {
    expect(searchAnatomy('kalp')[0]?.title).toBe('Kalp');
    expect(searchAnatomy('hepar').some((r) => r.route.name === 'body' && 'structure' in r.route && r.route.structure === 'liver')).toBe(true);
    const lv = searchAnatomy('sol karıncık');
    expect(lv.some((r) => r.kind === 'Bölüm' && r.route.name === 'body' && 'part' in r.route && r.route.part === 'left-ventricle')).toBe(true);
    expect(searchAnatomy('yumurtalik').find((r) => r.kind === 'Yapı')?.sex).toBe('female');
    expect(searchAnatomy('nöron').some((r) => r.kind === 'Sahne')).toBe(true);
    expect(searchAnatomy('')).toEqual([]);
  });
});

describe('yapılar, sahneler ve modeller tutarlı', () => {
  const modelled = STRUCTURES.filter((s) => s.asset);

  it('her 3D yapının bilgi metni ve en az bir iç sahnesi var', () => {
    for (const s of modelled) {
      expect(ORGANS[s.id], s.id).toBeTruthy();
      const list = insidesOf(s.id);
      expect(list.length, s.id).toBeGreaterThan(0);
      for (const id of list) {
        expect(INSIDE[id], id).toBeTruthy();
        expect(INSIDE_CONTENT[id].stages.length, id).toBeGreaterThan(1);
      }
    }
  });

  it('bağlantılar var olan yapılara işaret eder', () => {
    const ids = new Set(STRUCTURES.map((s) => s.id));
    for (const [k, v] of Object.entries(CONNECTIONS)) {
      expect(ids.has(k), k).toBe(true);
      for (const c of v) expect(ids.has(c), `${k} → ${c}`).toBe(true);
    }
  });

  it('şematik olmayan her yapı kendi vücudunda gerçekten modelde bulunuyor', () => {
    for (const s of modelled) {
      if (s.schematic) continue;
      for (const body of ['male', 'female'] as const) {
        if (!inBody(s.id, body)) {
          expect(MODEL_COVERAGE[body][s.id], `${body}:${s.id} olmamalı`).toBeUndefined();
          continue;
        }
        expect(MODEL_COVERAGE[body][s.id], `${body}:${s.id}`).toBeDefined();
      }
    }
  });
});
