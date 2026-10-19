import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INTERIORS, interiorById } from '@kh/analysis';
import { ATLAS_SECTIONS, splitRef } from '../explore/inside/atlas';
import { levelView } from '../explore/interiorNav';
import { lumenLook, tissueLook } from '../anatomy/tissue';

/** Uygulamayla gelen 3B atlas dosyalarındaki "yapı|bölüm" düğüm adları (GLB'nin JSON bölümünden). */
function nodeNames(body: 'm' | 'f'): Set<string> {
  const dir = resolve(__dirname, '../../public/models', body);
  const out = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.glb'))) {
    const b = readFileSync(resolve(dir, f));
    const len = b.readUInt32LE(12);
    const json = JSON.parse(b.subarray(20, 20 + len).toString('utf8')) as { nodes?: Array<{ name?: string; mesh?: number }> };
    for (const n of json.nodes ?? []) if (n.mesh !== undefined && n.name) out.add(n.name);
  }
  return out;
}

const has = (names: Set<string>, ref: string) => {
  const [s, l] = splitRef(ref);
  return l === null ? [...names].some((n) => n === s || n.startsWith(`${s}|`)) : names.has(`${s}|${l}`);
};

describe('Atlas kesiti — gerçek insan atlas ağlarından organın iç yapısı', () => {
  const male = nodeNames('m');
  const female = nodeNames('f');

  it('her kesit basamağı o iç dünyada var ve organın İÇİ seviyesindedir (duvar/doku/hücre/molekül değil)', () => {
    for (const def of Object.values(ATLAS_SECTIONS)) {
      const d = interiorById(def.organ)!;
      expect(d, def.organ).toBeTruthy();
      for (const stage of Object.keys(def.stages)) {
        const i = d.stages.findIndex((s) => s.id === stage);
        expect(i, `${def.organ}/${stage}`).toBeGreaterThanOrEqual(0);
        const v = levelView(d, i);
        expect(['interior', 'region'], `${def.organ}/${stage}`).toContain(v.level);
        expect(v.scene.kind === 'interior' && v.scene.atlas, `${def.organ}/${stage}`).toBe(stage);
        expect(v.sceneKey).toBe(`ic:${def.organ}:kesit`);
      }
    }
  });

  it('kesitte kullanılan her bölüm erkek atlas dosyalarında gerçekten var; ana yapılar kadın atlasında da var', () => {
    for (const def of Object.values(ATLAS_SECTIONS)) {
      const refs = [
        ...def.structures,
        ...(def.context ?? []),
        ...(def.ghost ?? []),
        ...(def.labels ?? []),
        ...(def.flow ?? []).map((f) => f.at),
        ...Object.values(def.stages).flatMap((s) => [...(s.focus ?? []), ...(s.labels ?? [])]),
        ...Object.entries(def.only ?? {}).flatMap(([s, ls]) => ls.map((l) => `${s}|${l}`)),
      ];
      for (const r of refs) expect(has(male, r), `${def.organ}: ${r}`).toBe(true);
      for (const s of def.structures) expect(has(female, s), `kadın: ${def.organ}: ${s}`).toBe(true);
    }
  });

  it('kalp: İçine gir odacıklara (gerçek atlas kesiti) girer; kan yolu sağ atriyumdan aorta', () => {
    const d = interiorById('heart')!;
    const v = levelView(d, 0);
    expect(v.level).toBe('interior');
    expect(v.scene.kind === 'interior' && v.scene.atlas).toBe('inside');
    const flow = ATLAS_SECTIONS.heart!.flow!.map((f) => f.at);
    expect(flow.indexOf('heart|right-atrium')).toBeLessThan(flow.indexOf('heart|tricuspid'));
    expect(flow.indexOf('heart|tricuspid')).toBeLessThan(flow.indexOf('heart|right-ventricle'));
    expect(flow.indexOf('heart|pulmonary-valve')).toBeLessThan(flow.indexOf('heart|left-atrium'));
    expect(flow.indexOf('heart|mitral')).toBeLessThan(flow.indexOf('heart|left-ventricle'));
    expect(flow.indexOf('heart|left-ventricle')).toBeLessThan(flow.indexOf('heart|aortic-valve'));
    // Oksijenlenme (mavi → kırmızı) akciğerden dönen kanla, sol atriyumdan önce
    expect(ATLAS_SECTIONS.heart!.oxygenAt!).toBeLessThanOrEqual(flow.indexOf('heart|left-atrium'));
  });

  it('kalın bağırsak: İçine gir → LÜMEN (duvara atlamaz); lümen kesit değil, organın içinden bakıştır', () => {
    const d = interiorById('large-intestine')!;
    expect(ATLAS_SECTIONS['large-intestine']).toBeUndefined();
    const v = levelView(d, 0);
    expect(v.stage.id).toBe('lumen');
    expect(v.level).toBe('interior');
    expect(v.scene).toMatchObject({ kind: 'interior', focus: 'lumen' });
    expect(v.sceneKey).toBe('ic:large-intestine');
    // Lümen → içerik → hareket duvardan ÖNCE gelir
    const order = d.stages.map((s) => s.id);
    expect(order.indexOf('contents')).toBeLessThan(order.indexOf('wall'));
    expect(order.indexOf('motion')).toBeLessThan(order.indexOf('wall'));
  });

  it('ana organlarda İçine gir organın kendi içinde başlar (duvar, doku, hücre ya da molekül değil)', () => {
    const main = ['heart', 'lungs', 'kidneys', 'liver', 'brain', 'stomach', 'small-intestine', 'large-intestine', 'pancreas', 'eyes', 'ear', 'spleen', 'urinary-tract.bladder', 'thyroid', 'prostate', 'uterus', 'ovaries', 'testes', 'skin'];
    for (const id of main) {
      const d = interiorById(id);
      expect(d, id).toBeTruthy();
      expect(levelView(d!, 0).level, id).toBe('interior');
    }
    for (const d of INTERIORS) expect(['interior'], d.organId).toContain(levelView(d, 0).level);
  });

  it('doku görünümleri: gerçekçi renk ve ıslak mukoza (lümen) tanımlı; bilinmeyen yapı palete düşer', () => {
    expect(tissueLook('heart', null).color).not.toBe(tissueLook('liver', null).color);
    expect(tissueLook('heart', 'mitral').color).not.toBe(tissueLook('heart', 'left-ventricle').color);
    expect(tissueLook('veins', 'superior vena cava').color).toBe(tissueLook('veins', 'inferior vena cava a').color);
    expect(tissueLook('bilinmeyen-yapi', null).color).toMatch(/^#/);
    const colon = lumenLook('haustra', '#b97a6a');
    expect(colon.clearcoat).toBeGreaterThan(0.8);
    expect(colon.veinAmount).toBeGreaterThan(0.3);
  });
});
