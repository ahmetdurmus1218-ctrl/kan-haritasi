import { describe, expect, it } from 'vitest';
import { PARTS, STRUCTURES, testByKey } from '@kh/catalog';
import { EDGES, NODES } from '../knowledge/data';
import { GRAPH, KnowledgeGraph } from '../knowledge';

describe('bilgi grafiği bütünlüğü', () => {
  it('biyobelirteçler katalogdaki testlere, organlar 3B yapılara ve bölümlere bağlı', () => {
    for (const n of NODES) {
      if (n.testKey) expect(testByKey.has(n.testKey), n.id).toBe(true);
      if (n.structure) expect(STRUCTURES.some((s) => s.id === n.structure), n.id).toBe(true);
      if (n.part) expect(PARTS.some((p) => p.structure === n.structure && p.key === n.part), `${n.id} → ${n.structure}/${n.part}`).toBe(true);
      expect(n.summary.length, n.id).toBeGreaterThan(10);
    }
  });

  it('bilinmeyen düğüme kenar ve çift kimlik reddedilir', () => {
    expect(() => new KnowledgeGraph(NODES, [...EDGES, { from: 'brain', to: 'yok', rel: 'part_of' }])).toThrow();
    expect(() => new KnowledgeGraph([...NODES, NODES[0]!], [])).toThrow();
  });
});

describe('anatomi hiyerarşisi ve detay seviyeleri', () => {
  it('Beyin → yarıküre → lob yolu, tercih edilen üst düğümle', () => {
    expect(GRAPH.pathTo('brain.frontal', 'brain.hemisphere-left').map((n) => n.id)).toEqual(['brain', 'brain.hemisphere-left', 'brain.frontal']);
    expect(GRAPH.pathTo('brain.frontal', 'brain.hemisphere-right').map((n) => n.id)).toEqual(['brain', 'brain.hemisphere-right', 'brain.frontal']);
  });

  it('Beyin → beyaz cevher → miyelinli akson → oligodendrosit → miyelin oluşumu zincirine inilebilir', () => {
    const lvl1 = GRAPH.drill('brain.white-matter').map((x) => x.node.id);
    expect(lvl1).toContain('tissue.white-matter');
    const lvl2 = GRAPH.drill('tissue.white-matter').map((x) => x.node.id);
    expect(lvl2).toEqual(expect.arrayContaining(['cell.myelinated-axon', 'cell.oligodendrocyte']));
    expect(GRAPH.drill('cell.oligodendrocyte').map((x) => x.node.id)).toContain('proc.myelination');
  });

  it('frontal lobun işlevleri: planlama ve istemli hareket', () => {
    const f = GRAPH.functionsOf('brain.frontal').map((n) => n.id);
    expect(f).toEqual(expect.arrayContaining(['fn.executive', 'fn.motor']));
  });
});

describe('fizyoloji zincirleri ("Vücudumda neyi ne etkiliyor?")', () => {
  const chainIds = (id: string) => GRAPH.chains(id, 8, 50).map((c) => c.map((n) => n.id));

  it('Pankreas → beta hücresi → insülin → kan şekeri → hücrelerin glukoz kullanımı → enerji', () => {
    expect(chainIds('pancreas').some((c) => ['pancreas.endocrine', 'cell.beta', 'mol.insulin', 'proc.glucose-regulation', 'proc.glucose-uptake', 'proc.energy-metabolism'].every((x) => c.includes(x)))).toBe(true);
  });

  it('Böbrek → filtrasyon → sıvı-elektrolit → kan basıncı; kreatinin/eGFR ile ölçülür', () => {
    expect(chainIds('kidneys').some((c) => c.includes('proc.glomerular-filtration') && c.includes('proc.fluid-electrolyte') && c.includes('fn.blood-pressure'))).toBe(true);
    const m = GRAPH.biomarkersFor('kidneys').map((n) => n.testKey);
    expect(m).toEqual(expect.arrayContaining(['creatinine', 'egfr']));
  });

  it('Karaciğer → protein sentezi → albümin → sıvı dağılımı', () => {
    expect(chainIds('liver').some((c) => c.includes('proc.protein-synthesis') && c.includes('mol.albumin') && c.includes('proc.fluid-distribution'))).toBe(true);
  });

  it('testten organa: ALT → karaciğer, lipaz → pankreas', () => {
    expect(GRAPH.organsForTest('alt').map((n) => n.id)).toContain('liver');
    expect(GRAPH.organsForTest('lipase').map((n) => n.id)).toContain('pancreas');
  });

  it('pankreas biyobelirteçleri: glukoz, HbA1c, insülin, amilaz, lipaz; C-peptid katalogda yok diye işaretli', () => {
    const b = GRAPH.biomarkersFor('pancreas');
    expect(b.map((n) => n.testKey)).toEqual(expect.arrayContaining(['glucose', 'hba1c', 'insulin', 'amylase', 'lipase']));
    expect(b.find((n) => n.id === 'lab:c-peptide')?.note).toMatch(/kataloğ/);
  });
});
