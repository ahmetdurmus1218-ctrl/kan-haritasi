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

describe('derin anatomi grafiği: hiyerarşi, komşuluk, derinlik', () => {
  const ids = (xs: Array<{ node: { id: string } } | { id: string }>) => xs.map((x) => ('node' in x ? x.node.id : x.id));
  const subtree = (id: string): Set<string> => {
    const out = new Set<string>();
    const walk = (n: string) => {
      for (const d of GRAPH.drill(n))
        if (!out.has(d.node.id)) {
          out.add(d.node.id);
          walk(d.node.id);
        }
    };
    walk(id);
    return out;
  };

  it('vücut → bölge → organ: pelvis organları komşudur, birbirinin parçası değildir', () => {
    expect(ids(GRAPH.pathTo('region:pelvis'))).toEqual(['body', 'region:pelvis']);
    const pelvis = ids(GRAPH.regionMembers('region:pelvis'));
    expect(pelvis).toEqual(expect.arrayContaining(['ovaries', 'uterus', 'fallopian-tubes', 'urinary-tract.bladder', 'large-intestine.rectum', 'large-intestine.sigmoid', 'prostate']));
    // Yumurtalık bağırsağın içinde DEĞİL: ne üst yolunda ne alt ağacında bağırsak var
    expect(ids(GRAPH.pathTo('ovaries')).some((x) => x.includes('intestine'))).toBe(false);
    expect([...subtree('large-intestine')].some((x) => x.startsWith('ovar'))).toBe(false);
    expect([...subtree('small-intestine')].some((x) => x.startsWith('ovar'))).toBe(false);
    // ama komşuluk ile ulaşılır
    expect(ids(GRAPH.neighbors('ovaries.left'))).toContain('large-intestine.sigmoid');
    expect(ids(GRAPH.neighbors('ovaries.right'))).toContain('large-intestine.cecum');
    expect(ids(GRAPH.neighbors('large-intestine.sigmoid'))).toContain('ovaries.left');
    expect(GRAPH.regionsOf('ovaries.left').map((n) => n.id)).toContain('region:pelvis');
  });

  it('bağırsak: bölüm → duvar katmanları → epitel → hücreler → hücre içi yapı → süreç', () => {
    expect(ids(GRAPH.drill('small-intestine'))).toEqual(expect.arrayContaining(['small-intestine.duodenum', 'small-intestine.jejunum', 'small-intestine.ileum', 'tissue.intestinal-wall']));
    expect(ids(GRAPH.drill('tissue.intestinal-wall'))).toEqual(expect.arrayContaining(['tissue.intestinal-mucosa', 'tissue.submucosa', 'tissue.muscularis-externa', 'tissue.serosa']));
    expect(ids(GRAPH.drill('tissue.intestinal-epithelium'))).toEqual(expect.arrayContaining(['cell.enterocyte', 'cell.goblet', 'cell.enteroendocrine', 'proc.intestinal-barrier']));
    expect(ids(GRAPH.drill('tissue.crypt'))).toEqual(expect.arrayContaining(['cell.intestinal-stem', 'cell.paneth']));
    const si = subtree('small-intestine');
    for (const p of ['proc.absorption', 'proc.intestinal-barrier', 'proc.intestinal-motility', 'proc.mucosal-immunity', 'sub.microvilli', 'sub.tight-junction']) expect(si.has(p), p).toBe(true);
    // Kalın bağırsakta villus yoktur
    expect(subtree('large-intestine').has('tissue.villus')).toBe(false);
    expect(subtree('large-intestine').has('proc.microbiome')).toBe(true);
  });

  it('yumurtalık: korteks → foliküller → evreler → oosit, granüloza, teka → hormonlar → döngü ve eksen', () => {
    const o = subtree('ovaries');
    for (const x of ['ovary.cortex', 'ovary.medulla', 'ovary.follicle-primordial', 'ovary.follicle-primary', 'ovary.follicle-secondary', 'ovary.follicle-antral', 'cell.oocyte', 'cell.granulosa', 'cell.theca', 'mol.estradiol', 'mol.progesterone', 'proc.folliculogenesis', 'proc.ovulation']) expect(o.has(x), x).toBe(true);
    expect(GRAPH.chains('cell.granulosa', 5, 40).some((c) => c.some((n) => n.id === 'proc.menstrual-cycle'))).toBe(true);
    expect(GRAPH.edgesFrom('proc.hpo-axis', 'produces').map((e) => e.to)).toEqual(expect.arrayContaining(['mol.fsh', 'mol.lh']));
    expect(GRAPH.biomarkersFor('ovaries', 6).map((n) => n.testKey)).toEqual(expect.arrayContaining(['estradiol', 'fsh', 'lh', 'progesterone']));
  });

  it('kulak: kulak yolu → zar → kemikçikler → koklea → tüy hücreleri → mekanik dönüşüm → işitme yolu', () => {
    expect(ids(GRAPH.drill('ear'))).toEqual(expect.arrayContaining(['ear.outer', 'ear.middle', 'ear.inner']));
    expect(ids(GRAPH.drill('ear.middle'))).toEqual(expect.arrayContaining(['ear.eardrum', 'ear.ossicles', 'ear.eustachian']));
    expect(ids(GRAPH.drill('ear.ossicles'))).toEqual(expect.arrayContaining(['ear.malleus', 'ear.incus', 'ear.stapes']));
    expect(ids(GRAPH.neighbors('ear.eardrum'))).toEqual(expect.arrayContaining(['ear.canal', 'ear.malleus']));
    expect(ids(GRAPH.insidePath('ear.cochlea', 6))).toEqual(['tissue.organ-of-corti', 'cell.inner-hair', 'sub.stereocilia', 'sub.mechanotransduction-channel', 'proc.mechanotransduction']);
    expect(GRAPH.chains('proc.mechanotransduction', 4, 20).some((c) => c.some((n) => n.id === 'fn.hearing'))).toBe(true);
    expect(ids(GRAPH.drill('ear.semicircular-canals'))).toContain('tissue.crista-ampullaris');
  });

  it('böbrek, kalp, akciğer, karaciğer, beyin: istenen derin zincirler grafikte', () => {
    const k = subtree('kidneys');
    for (const x of ['kidneys.cortex', 'kidneys.medulla', 'tissue.nephron', 'tissue.glomerulus', 'cell.podocyte', 'sub.slit-diaphragm', 'tissue.proximal-tubule', 'tissue.loop-of-henle', 'tissue.distal-tubule', 'tissue.collecting-duct', 'proc.glomerular-filtration', 'proc.tubular-reabsorption', 'proc.tubular-secretion', 'proc.acid-base']) expect(k.has(x), x).toBe(true);
    const h = subtree('heart');
    for (const x of ['heart.right-atrium', 'heart.left-ventricle', 'heart.mitral', 'heart.aortic-valve', 'tissue.myocardium', 'tissue.endocardium', 'heart.pericardium', 'heart.sa-node', 'heart.purkinje', 'cell.cardiomyocyte', 'sub.sarcomere', 'proc.cardiac-cycle']) expect(h.has(x), x).toBe(true);
    const l = subtree('lungs');
    for (const x of ['lungs.right-upper', 'tissue.alveolus', 'tissue.alveolar-wall', 'cell.pneumocyte-1', 'cell.pneumocyte-2', 'mol.surfactant', 'proc.gas-exchange', 'lungs.pleura']) expect(l.has(x), x).toBe(true);
    const lv = subtree('liver');
    for (const x of ['liver.right-lobe', 'tissue.liver-lobule', 'tissue.portal-triad', 'tissue.sinusoid', 'cell.hepatocyte', 'cell.kupffer', 'sub.bile-canaliculi', 'proc.detoxification', 'proc.bile-metabolism']) expect(lv.has(x), x).toBe(true);
    const b = subtree('brain');
    for (const x of ['brain.cerebrum', 'brain.frontal', 'brain.thalamus', 'brain.hypothalamus', 'brain.brainstem', 'brain.cerebellum', 'brain.ventricles', 'brain.meninges', 'cell.neuron', 'cell.astrocyte', 'sub.synapse', 'proc.neurotransmission']) expect(b.has(x), x).toBe(true);
    for (const organ of ['small-intestine', 'ovaries', 'ear', 'kidneys', 'heart', 'lungs', 'liver', 'brain']) expect(GRAPH.depthOf(organ), organ).toBeGreaterThanOrEqual(4);
  });

  it('organlar arası fizyoloji: böbrek ↔ kalp ↔ kan basıncı, pankreas ↔ kas/yağ/karaciğer, bağırsak ↔ karaciğer', () => {
    expect(ids(GRAPH.neighbors('kidneys'))).toEqual(expect.arrayContaining(['heart', 'lungs']));
    expect(ids(GRAPH.neighbors('pancreas'))).toEqual(expect.arrayContaining(['skeletal-muscle', 'adipose', 'liver']));
    expect(GRAPH.supply('small-intestine').map((s) => s.node.id)).toEqual(expect.arrayContaining(['vessel.sma', 'vessel.portal-vein']));
    expect(GRAPH.chains('mol.insulin', 4, 40).some((c) => c.some((n) => n.id === 'proc.glucose-uptake'))).toBe(true);
  });

  it('hiyerarşide döngü yok; her organ bir vücut bölgesinde', () => {
    for (const n of GRAPH.nodes.values()) {
      const p = GRAPH.pathTo(n.id);
      expect(new Set(p.map((x) => x.id)).size, n.id).toBe(p.length);
    }
    for (const n of GRAPH.nodes.values()) if (n.kind === 'organ') expect(GRAPH.regionsOf(n.id).length, n.id).toBeGreaterThan(0);
    const s = GRAPH.stats();
    expect(s.nodes).toBeGreaterThan(450);
    expect(s.byRelation.adjacent_to).toBeGreaterThan(20);
  });
});
