import { describe, expect, it } from 'vitest';
import { STRUCTURES, testByKey } from '@kh/catalog';
import { buildHealthModel } from '../fusion';
import { GRAPH } from '../knowledge';
import {
  EDUCATIONAL_LABEL,
  INTERIORS,
  PERSONAL_LABEL,
  SCALE_LEVEL,
  type OrganInteriorDefinition,
  INTERIOR_ACCEPTANCE,
  NOT_FIRST,
  interiorArchetype,
  interiorById,
  interiorExperience,
  interiorFor,
  interiorModes,
  interiorProvenance,
  stagePersonal,
  validateAllInteriors,
  validateInterior,
} from '../interior';
import { PHYSIO_CHAINS, PHYSIO_NODES, chainNodes, chainsForTest, physioChain, physioOverlay } from '../physiology';
import { ALLOWED_LOCALIZATION, LOCALIZATION_REMOVED, enforceLocalization } from '../medicalAI';
import { type LabObservation, type MedicalFinding, type ModelStructure, REPORTED, score } from '../types';

const lab = (testKey: string, value: number, status: LabObservation['status'], date = '2026-05-01'): LabObservation => ({
  testKey,
  name: testByKey.get(testKey)?.nameTr ?? testKey,
  value,
  unit: testByKey.get(testKey)?.unit ?? '',
  status,
  severity: status === 'normal' ? 'normal' : 'mild',
  date,
  source: 'LAB',
  confidence: REPORTED,
});

const titles = (id: string) => interiorById(id)!.stages.map((s) => s.title);
const nodes = (id: string) => interiorById(id)!.stages.map((s) => s.node).filter(Boolean);

describe('İçine gir motoru — veri ve kurallar', () => {
  it('tüm tanımlar kurallara uyar (lümen, ölçek sırası, grafik düğümleri, akışlar, testler, geçişler)', () => {
    expect(validateAllInteriors()).toEqual([]);
    expect(INTERIORS.length).toBeGreaterThanOrEqual(85);
  });

  it('istenen yapıların her biri için iç dünya var (sindirim, dolaşım, solunum, üriner, sinir, endokrin, üreme, duyu, kas-iskelet, deri)', () => {
    const required = [
      'ic.mouth', 'ic.tongue', 'ic.pharynx', 'esophagus', 'stomach', 'small-intestine.duodenum', 'small-intestine.jejunum', 'small-intestine.ileum', 'large-intestine', 'large-intestine.rectum', 'ic.anal-canal', 'gallbladder', 'gallbladder.bile-ducts', 'pancreas', 'ic.pancreatic-ducts', 'liver',
      'heart', 'ic.atrium', 'ic.ventricle', 'heart.valves', 'vessel.aorta', 'ic.artery', 'ic.arteriole', 'ic.capillary', 'ic.venule', 'ic.vein',
      'ic.nose', 'ic.nasal-cavity', 'ic.larynx', 'airways.trachea', 'airways.main-bronchi', 'airways.bronchioles', 'tissue.alveolus', 'lungs',
      'kidneys', 'urinary-tract.renal-pelvis', 'urinary-tract.ureter', 'urinary-tract.bladder', 'urinary-tract.urethra', 'tissue.nephron',
      'brain', 'ic.cerebral-cortex', 'brain.white-matter', 'brain.brainstem', 'brain.cerebellum', 'spinal-cord', 'nerves', 'sub.synapse',
      'pituitary', 'thyroid', 'ic.parathyroid', 'adrenals', 'pancreas.endocrine', 'ic.gonads',
      'uterus', 'tissue.endometrium', 'tissue.myometrium', 'ovaries', 'fallopian-tubes', 'uterus.cervix', 'vagina', 'testes', 'ic.epididymis', 'ic.vas-deferens', 'prostate',
      'eyes', 'eyes.retina', 'ear', 'ear.canal', 'ear.eardrum', 'ear.middle', 'ear.cochlea', 'ear.vestibule',
      'ic.bone', 'ic.bone-marrow', 'ic.joint', 'ic.cartilage', 'ic.tendon', 'ic.ligament', 'skeletal-muscle', 'cell.skeletal-myocyte',
      'ic.epidermis', 'ic.dermis', 'ic.hypodermis', 'ic.hair-follicle', 'ic.sweat-gland', 'ic.sebaceous-gland',
    ];
    for (const id of required) expect(interiorById(id), id).toBeDefined();
  });

  it('organ, katalog yapısı ve alt düğüm doğru iç dünyaya yönlenir', () => {
    expect(interiorFor('small-intestine')!.organId).toBe('small-intestine');
    expect(interiorFor('aorta')!.organId).toBe('vessel.aorta');
    expect(interiorFor('urinary-tract')!.organId).toBe('urinary-tract.bladder');
    expect(interiorFor('bones')!.organId).toBe('ic.bone');
    // Alt düğüm → en yakın üst iç dünya
    expect(interiorFor('tissue.villus')!.organId).toBe('small-intestine');
    expect(interiorFor('liver.segment-7')!.organId).toBe('liver');
  });

  it('kurallar kod düzeyinde: solid organa lümen, organdan doğrudan hücreye atlama ve kalın bağırsakta villus reddedilir', () => {
    const liver = interiorById('liver')!;
    const fakeLumen: OrganInteriorDefinition = { ...liver, lumen: { enabled: true, contents: ['safra'] }, stages: [{ id: 'l', kind: 'lumen', scale: 'interior', title: 'Lümen', text: '' }, ...liver.stages] };
    expect(validateInterior(fakeLumen).map((i) => i.rule)).toContain('solid-no-lumen');
    const jump: OrganInteriorDefinition = { ...interiorById('stomach')!, stages: [{ id: 'c', kind: 'cell', scale: 'cell', title: 'Hücre', text: '' }] };
    expect(validateInterior(jump).map((i) => i.rule)).toContain('interior-first');
    const backwards: OrganInteriorDefinition = { ...interiorById('stomach')!, stages: [interiorById('stomach')!.stages[0]!, { id: 'c', kind: 'cell', scale: 'cell', title: 'Hücre', text: '' }, { id: 'r', kind: 'region', scale: 'region', title: 'Bölge', text: '' }] };
    expect(validateInterior(backwards).map((i) => i.rule)).toContain('scale-order');
    const colon = interiorById('large-intestine')!;
    const villusColon: OrganInteriorDefinition = { ...colon, stages: [...colon.stages, { id: 'v', kind: 'tissue', scale: 'tissue', title: 'Villus', text: '', node: 'tissue.villus' }] };
    expect(validateInterior(villusColon).map((i) => i.rule)).toContain('no-villus');
    const unknown: OrganInteriorDefinition = { ...colon, stages: [{ ...colon.stages[0]!, next: [{ to: 'ic.yok', label: 'x' }] }] };
    expect(validateInterior(unknown).map((i) => i.rule)).toContain('target');
  });

  it('solid organlar (karaciğer, böbrek, pankreas, beyin, yumurtalık) parankimle başlar; hollow/tubular lümenle', () => {
    for (const id of ['liver', 'kidneys', 'pancreas', 'brain', 'ovaries', 'prostate', 'thyroid']) {
      const d = interiorById(id)!;
      expect(d.type, id).toBe('solid');
      expect(d.lumen?.enabled ?? false, id).toBe(false);
      expect(d.stages[0]!.kind, id).toBe('parenchyma');
    }
    for (const id of ['stomach', 'esophagus', 'large-intestine', 'urinary-tract.bladder', 'gallbladder', 'airways.trachea']) {
      expect(interiorById(id)!.stages[0]!.kind, id).toBe('lumen');
      expect(interiorById(id)!.lumen?.contents?.length, id).toBeGreaterThan(0);
    }
    for (const d of INTERIORS.filter((x) => x.type === 'vascular')) {
      expect(d.interiorScene.kind).toBe('vessel');
      expect(d.stages[0]!.kind).toBe('lumen');
      expect(d.stages.some((s) => s.kind === 'flow' || s.id === 'exchange')).toBe(true);
    }
  });
});

describe('Kabul — bağırsak (İçine gir ≠ Daha derine in)', () => {
  it('İnce bağırsak: lümen → içerik → hareket → sindirim → emilim → bölge → duvar → mukoza → villus → enterosit → mikrovillus → moleküler taşıma', () => {
    expect(titles('small-intestine')).toEqual([
      'Lümen: bağırsak tüpünün içi',
      'İçerik: kimus, sıvı ve mukus',
      'Hareket: segmentasyon ve peristaltizm',
      'Sindirim',
      'Emilim',
      'Bölge seç: duodenum · jejunum · ileum',
      'Duvarı incele',
      'Mukoza',
      'Villus',
      'Enterosit',
      'Mikrovillus (fırçamsı kenar)',
      'Moleküler taşıma',
    ]);
    const d = interiorById('small-intestine')!;
    // İçine gir önce organın içindedir: ilk 5 basamak ölçek 3 (organın içi), hücre ölçeği sonra gelir.
    expect(d.stages.slice(0, 5).every((s) => s.scale === 'interior')).toBe(true);
    expect(d.stages.findIndex((s) => s.scale === 'cell')).toBeGreaterThan(5);
    expect(d.stages.map((s) => SCALE_LEVEL[s.scale])).toEqual([...d.stages.map((s) => SCALE_LEVEL[s.scale])].sort((a, b) => a - b));
    expect(d.functionalRegions!.map((r) => r.interior)).toEqual(['small-intestine.duodenum', 'small-intestine.jejunum', 'small-intestine.ileum']);
    expect(d.wallLayers!.map((l) => l.name)).toEqual(['Lümen (iç boşluk)', 'Mukus tabakası', 'Epitel', 'Lamina propria', 'Submukoza', 'Kas tabakası (muskularis)', 'Seroza']);
    expect(d.routes![0]!.steps.map((s) => s.label)).toEqual(['Lümen', 'Mikrovillus', 'Enterosit', 'Kılcal damar / lenf (lakteal)', 'Portal ven / lenf', 'Karaciğer / sistemik dolaşım']);
    expect(nodes('small-intestine')).toEqual(expect.arrayContaining(['tissue.intestinal-wall', 'tissue.intestinal-mucosa', 'tissue.villus', 'cell.enterocyte', 'sub.microvilli', 'mol.nutrient-transporters']));
  });

  it('eğitimsel içerik modları: boş / sindirim sırasında / emilim sırasında — alt bölümler üst tanımdan alır', () => {
    expect(interiorModes(interiorById('small-intestine')!).map((m) => m.name)).toEqual(['Boş / az içerikli', 'Sindirim sırasında', 'Emilim sırasında']);
    expect(interiorModes(interiorById('small-intestine.ileum')!).length).toBe(3);
  });

  it('kalın bağırsak ince bağırsakla aynı sahne değildir: villus yok, içerik → segmental/peristaltik hareket → su/elektrolit → mikrobiyota → yoğunlaşma → dışkı → rektum', () => {
    const c = interiorById('large-intestine')!;
    expect(c.interiorScene).toMatchObject({ kind: 'lumen', lining: 'haustra', content: 'feces' });
    expect(nodes('large-intestine')).not.toContain('tissue.villus');
    expect(c.stages.some((s) => s.scene === 'villus')).toBe(false);
    expect(c.stages.slice(0, 7).map((s) => s.id)).toEqual(['lumen', 'contents', 'motion', 'water', 'microbiota', 'concentration', 'feces']);
    expect(c.stages[1]!.text).toMatch(/su.*elektrolit.*sindirim artıkları.*mukus.*mikrobiyota/s);
    expect(c.stages.find((s) => s.id === 'feces')!.next![0]!.to).toBe('large-intestine.rectum');
  });

  it('mide: lümen → yemek → karıştırma → asit → pepsin → (iç faktör) → kimus → duodenum; duvar katmanları', () => {
    expect(interiorById('stomach')!.stages.slice(0, 7).map((s) => s.id)).toEqual(['lumen', 'food', 'mixing', 'acid', 'pepsin', 'if', 'chyme']);
    expect(interiorById('stomach')!.wallLayers!.map((l) => l.id)).toEqual(['lumen', 'mucus', 'epithelium', 'glands', 'submucosa', 'muscularis', 'serosa']);
  });
});

describe('Diğer referans iç dünyalar', () => {
  it('kalp: sağ atriyum → triküspit → sağ ventrikül → pulmoner → akciğer → sol atriyum → mitral → sol ventrikül → aort → sistemik dolaşım; sonra endokard → miyokard → epikard → hücre → sarkomer → aktin/miyozin → ATP', () => {
    expect(interiorById('heart')!.routes![0]!.steps.map((s) => s.label)).toEqual(['Sağ atriyum', 'Triküspit kapak', 'Sağ ventrikül', 'Pulmoner kapak', 'Akciğer', 'Sol atriyum', 'Mitral kapak', 'Sol ventrikül', 'Aort']);
    expect(titles('heart')[10]).toBe('Sistemik dolaşım');
    expect(titles('heart').slice(11)).toEqual(['Duvarı incele: endokard → miyokard → epikard', 'Endokard', 'Miyokard', 'Epikard', 'Kalp kas hücresi', 'Sarkomer', 'Aktin / miyozin', 'ATP']);
  });

  it('akciğer: hava → trakea → bronş → bronşiyol → alveol → alveol-kılcal; tip I/II pnömosit, sürfaktan, endotel', () => {
    expect(titles('lungs').slice(0, 6)).toEqual(['Hava', 'Trakea', 'Bronş', 'Bronşiyol', 'Alveol', 'Alveol–kılcal damar: gaz değişimi']);
    expect(nodes('lungs')).toEqual(expect.arrayContaining(['cell.pneumocyte-1', 'cell.pneumocyte-2', 'mol.surfactant', 'tissue.alveolar-capillary']));
  });

  it('böbrek: parankim (lümen yok) → kan → süzme → geri emilim → salgılama → idrar; korteks → medulla → nefron → glomerül → … → toplayıcı kanal', () => {
    expect(interiorById('kidneys')!.stages.slice(0, 6).map((s) => s.id)).toEqual(['parenchyma', 'blood', 'filtration', 'reabsorption', 'secretion', 'urine']);
    expect(interiorById('kidneys')!.stages.slice(6, 14).map((s) => s.id)).toEqual(['cortex', 'medulla', 'nephron', 'glomerulus', 'proximal', 'henle', 'distal', 'collecting']);
  });

  it('karaciğer: lümen yok; lobül → portal üçlü → sinüzoid → hepatosit → metabolizma; kan ve safra yolları ayrı', () => {
    const l = interiorById('liver')!;
    expect(l.lumen).toBeUndefined();
    expect(l.routes!.map((r) => r.steps.map((s) => s.label).join(' → '))).toEqual([
      'Portal ven + hepatik arter → Portal üçlü → Sinüzoid → Merkezi ven → Hepatik venler → vena kava',
      'Hepatosit → Safra kanalcığı → Safra kanalı (portal üçlü) → Safra yolları',
    ]);
  });

  it('beyin doğrudan hücreye açılmaz: parankim → BOS → kanlanma → hemisfer → lob → korteks → beyaz cevher → nöron ağı → sinaps → nörotransmitter → sinyal', () => {
    expect(interiorById('brain')!.stages.map((s) => s.scale)).toEqual(['interior', 'interior', 'interior', 'region', 'region', 'tissue', 'tissue', 'cell', 'cell', 'molecule', 'molecule']);
  });

  it('kulak ve göz: ses ve ışık yolu basamak basamak', () => {
    expect(titles('ear').slice(0, 11)).toEqual(['Dış kulak', 'Kulak yolu', 'Timpanik membran', 'Malleus', 'İnkus', 'Stapes', 'Koklea', 'Baziler membran', 'Corti organı', 'Tüy hücresi', 'İşitme siniri']);
    expect(titles('eyes').slice(0, 11)).toEqual(['Işık', 'Kornea', 'Ön kamara', 'Lens', 'Vitreus', 'Retina', 'Fotoreseptör', 'Bipolar hücre', 'Gangliyon hücresi', 'Optik sinir', 'Beyin']);
  });

  it('anatomi: yumurtalık bağırsağın çocuğu değildir; yumurtalık solid, bağırsak iç dünyalarında yumurtalığa geçiş yok', () => {
    expect(GRAPH.pathTo('ovaries').map((n) => n.id)).not.toContain('large-intestine');
    for (const id of ['small-intestine', 'large-intestine', 'large-intestine.rectum'])
      for (const s of interiorById(id)!.stages) {
        expect(s.node?.startsWith('ovar') ?? false, `${id}/${s.id}`).toBe(false);
        for (const n of s.next ?? []) expect(n.to.startsWith('ovar'), `${id}/${s.id}`).toBe(false);
      }
    expect(interiorById('ovaries')!.type).toBe('solid');
  });
});

describe('Kişisel veri, köken ve simülasyon ayrımı', () => {
  it('gerçek 3B: yalnızca voksel maskesi (volume) olan model yapısı "Senin görüntünden" olur; iç seviyeler eğitimsel kalır', () => {
    const kidney = interiorById('kidneys')!;
    const vol: ModelStructure = {
      id: 'ms-1', key: 'kidney_left', name: 'Sol böbrek', source: 'IMAGE_MODEL',
      provenance: { derivation: 'model-derived', source: 'IMAGE_MODEL', at: '2026-01-01T00:00:00Z' },
      localization: { kind: 'volume', labelId: 3, voxels: 1000, volumeMl: 150, centroid: [0, 0, 0], bboxMin: [0, 0, 0], bboxMax: [1, 1, 1], sliceRange: [1, 9], centroidSlice: 5 },
      measurements: [], confidence: score(0.9, 'test'), limitations: [],
    };
    const organs = new Map([['kidneys', { organ: 'kidneys', imageObservations: [], reportFindings: [], modelFindings: [], modelStructures: [vol], labs: [], patterns: [], attention: false }]]);
    const p = interiorProvenance(kidney, { organs });
    expect(p.personal3D).toBe(true);
    expect(p.organLabel.startsWith(PERSONAL_LABEL)).toBe(true);
    expect(p.interiorLabel).toBe(EDUCATIONAL_LABEL);
    // Sınıflandırma (konumsuz) yapı kişisel 3B sayılmaz
    const flat = new Map([['kidneys', { ...organs.get('kidneys')!, modelStructures: [{ ...vol, localization: { kind: 'region-only' as const } }] }]]);
    expect(interiorProvenance(kidney, { organs: flat }).personal3D).toBe(false);
    expect(interiorProvenance(kidney, null).organLabel).toContain('eğitimsel');
  });

  it('sınıflandırma bulgusu basamağa "burada" diye yerleşmez; gerçek konumlu bulgu yerleşir', () => {
    const stage = interiorById('liver')!.stages.find((s) => s.id === 'regions')!;
    const base: MedicalFinding = { id: 'f', source: 'IMAGE_MODEL', provenance: { derivation: 'model-derived', source: 'IMAGE_MODEL', at: '' }, finding: 'Test bulgusu', confidence: score(0.8, 't'), localization: { kind: 'region-only' }, anatomicalStructure: { path: ['liver', 'liver.right-lobe'], structure: 'liver', confidence: REPORTED, approximate: false } as never, limitations: [] };
    expect(stagePersonal(stage, { latestLabs: [], modelFindings: [base] }).findings).toEqual([]);
    const boxed = { ...base, localization: { kind: 'pixel' as const, frame: 0, box: { x: 1, y: 1, w: 2, h: 2 }, imageSize: { width: 10, height: 10 } } };
    expect(stagePersonal(stage, { latestLabs: [], modelFindings: [boxed] }).findings[0]!.localized).toBe('real-coordinate');
  });

  it('sınıflandırma modeli koordinat/kutu/maske/3B üretemez (kod düzeyinde zorunlu)', () => {
    expect(ALLOWED_LOCALIZATION.classification).toEqual(['region-only', 'none']);
    expect(ALLOWED_LOCALIZATION.multilabel).toEqual(['region-only', 'none']);
    const box = { localization: { kind: 'pixel' as const, frame: 0, box: { x: 0, y: 0, w: 5, h: 5 }, imageSize: { width: 10, height: 10 } }, limitations: [] as string[] };
    expect(enforceLocalization('classification', box).localization).toEqual({ kind: 'region-only' });
    expect(enforceLocalization('multilabel', box).limitations).toContain(LOCALIZATION_REMOVED);
    const vol = { localization: { kind: 'volume' as const, labelId: 1, voxels: 1, volumeMl: 1, centroid: [0, 0, 0] as [number, number, number], bboxMin: [0, 0, 0] as [number, number, number], bboxMax: [0, 0, 0] as [number, number, number], sliceRange: [0, 0] as [number, number], centroidSlice: 0 } };
    expect(enforceLocalization('classification', vol).localization.kind).toBe('region-only');
    expect(enforceLocalization('detection', vol).localization.kind).toBe('region-only');
    expect(enforceLocalization('segmentation-3d', vol).localization.kind).toBe('volume');
    expect(enforceLocalization('detection', box).localization.kind).toBe('pixel');
    // Maskesiz piksel kutusu bölütleme çıktısı sayılmaz
    expect(enforceLocalization('segmentation', box).localization.kind).toBe('region-only');
  });

  it('eğitimsel simülasyon modu kişisel veri değildir: modlar modelden bağımsızdır', () => {
    const m1 = interiorModes(interiorById('small-intestine')!);
    const model = buildHealthModel({ images: [], reports: [], labs: [lab('b12', 120, 'low'), lab('iron', 30, 'low')] });
    // Tanım sabittir; kişinin verisi modları değiştirmez (aynı nesne)
    expect(interiorModes(interiorById('small-intestine')!)).toBe(m1);
    const stage = interiorById('small-intestine.ileum')!.stages.find((s) => s.id === 'b12')!;
    expect(stagePersonal(stage, model).labs.map((l) => l.testKey)).toEqual(['b12']);
    expect(stagePersonal(stage, null).hasData).toBe(false);
  });
});

describe('Fizyoloji grafiği', () => {
  it('düğüm ve ilişki türleri tanımlı; her zincir geçerli düğümlerden oluşur ve testler katalogda', () => {
    const ids = new Set(PHYSIO_NODES.map((n) => n.id));
    expect(ids.size).toBe(PHYSIO_NODES.length);
    for (const c of PHYSIO_CHAINS) {
      for (const e of c.edges) {
        expect(ids.has(e.from), `${c.id}: ${e.from}`).toBe(true);
        expect(ids.has(e.to), `${c.id}: ${e.to}`).toBe(true);
      }
      for (const n of chainNodes(c)) {
        for (const k of n.testKeys ?? []) expect(testByKey.has(k), `${n.id}: ${k}`).toBe(true);
        if (n.interior) expect(interiorById(n.interior), `${n.id} → ${n.interior}`).toBeDefined();
        if (n.organ) expect(GRAPH.node(n.organ), `${n.id} → ${n.organ}`).toBeDefined();
      }
    }
    expect(new Set(PHYSIO_NODES.map((n) => n.kind))).toEqual(new Set(['organ', 'tissue', 'cell', 'molecule', 'hormone', 'metabolite', 'blood-component', 'process']));
  });

  it('çapraz sistem: glukoz → pankreas → insülin → hücre → ATP', () => {
    const g = physioChain('glucose')!;
    expect(g.edges.map((e) => `${e.from} ${e.rel} ${e.to}`)).toEqual([
      'small-intestine absorbs glucose',
      'glucose stimulates pancreas',
      'pancreas secretes insulin',
      'insulin regulates glucose',
      'glucose enters cell',
      'cell produces atp',
    ]);
  });

  it('B12: mide → iç faktör → ileum → emilim → kan → kemik iliği / sinir sistemi; "Bunun devamı nerede?" iç dünyaya götürür', () => {
    const c = physioChain('b12')!;
    expect(chainNodes(c).map((n) => n.id)).toEqual(['stomach', 'b12', 'parietal-cell', 'intrinsic-factor', 'ileum', 'transcobalamin', 'bone-marrow', 'dna', 'nervous-system', 'myelin']);
    expect(chainNodes(c).find((n) => n.id === 'ileum')!.interior).toBe('small-intestine.ileum');
    expect(chainNodes(c).find((n) => n.id === 'bone-marrow')!.interior).toBe('ic.bone-marrow');
    expect(chainsForTest('b12').map((x) => x.chain.id)).toContain('b12');
  });

  it('kişisel katman: yalnızca ölçülen düğüm işaretlenir, ilişki olasıdır; geçmiş yoksa eğilim üretilmez, varsa tarih sırasıyla', () => {
    const one = buildHealthModel({ images: [], reports: [], labs: [lab('b12', 150, 'low')] });
    const o1 = physioOverlay(physioChain('b12')!, one);
    expect(o1.markers.map((m) => m.nodeId)).toEqual(['b12']);
    expect(o1.markers[0]!.relation).toBe('POSSIBLE_RELATION');
    expect(o1.markers[0]!.trend).toBeUndefined();
    expect(o1.statement).toBe(physioChain('b12')!.caution);
    const hist = buildHealthModel({ images: [], reports: [], labs: [lab('hemoglobin', 11, 'low', '2026-01-10'), lab('hemoglobin', 10, 'low', '2026-03-10'), lab('hemoglobin', 13.5, 'normal', '2026-06-10')] });
    const o2 = physioOverlay(physioChain('oxygen')!, hist);
    const hb = o2.markers.find((m) => m.testKey === 'hemoglobin')!;
    expect(hb.history.map((h) => h.status)).toEqual(['low', 'low', 'normal']);
    expect(hb.trend).toContain('2026-01');
    // Zaman kaydırıcı: Mart itibarıyla son değer düşük
    expect(physioOverlay(physioChain('oxygen')!, hist, '2026-03-31').markers.find((m) => m.testKey === 'hemoglobin')!.latest.value).toBe(10);
    expect(physioOverlay(physioChain('oxygen')!, null).hasData).toBe(false);
  });
});

describe('Kabul — "İçine gir" her organda organın iç dünyasıdır (duvar / doku / hücre / molekül değil)', () => {
  const all = Object.values(INTERIOR_ACCEPTANCE).flat();

  it.each(all)('%s: ilk sahne iç dünya; kalıba uygun içerik; derine inmek ayrı adım', (id) => {
    const d = interiorById(id);
    expect(d, id).toBeDefined();
    const first = d!.stages[0]!;
    // §26: currentLevel === interior; currentNode ∉ {wall, tissue, cell, molecule}
    expect(first.scale).toBe('interior');
    expect(NOT_FIRST.has(first.kind)).toBe(false);
    const { inside, deeper } = interiorExperience(d!);
    expect(inside.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(inside.map((s) => s.kind));
    expect(['motion', 'flow', 'process'].some((k) => kinds.has(k as never)), `${id}: organın nasıl çalıştığı`).toBe(true);
    switch (interiorArchetype(d!)) {
      case 'hollow':
        expect(kinds.has('lumen') && kinds.has('content'), `${id}: lümen + içerik`).toBe(true);
        expect(d!.lumen?.enabled).toBe(true);
        break;
      case 'solid':
        expect(first.kind).toBe('parenchyma');
        expect(d!.lumen?.enabled ?? false).toBe(false);
        expect(Boolean(d!.functionalRegions?.length) || d!.stages.some((s) => s.kind === 'region'), `${id}: fonksiyonel bölgeler`).toBe(true);
        break;
      case 'vascular':
        expect(kinds.has('lumen') && (kinds.has('flow') || kinds.has('content')), `${id}: lümen + kan akışı`).toBe(true);
        expect(d!.lumen?.contents?.some((c) => c.includes('kan'))).toBe(true);
        break;
      case 'chamber':
        expect(kinds.has('flow'), `${id}: odacıklarda akış`).toBe(true);
        break;
      case 'airway':
        expect(kinds.has('flow') || kinds.has('process'), `${id}: hava akışı`).toBe(true);
        break;
      case 'sensory':
        expect(kinds.has('flow') || kinds.has('motion'), `${id}: uyaranın yolu`).toBe(true);
        break;
    }
    // Duvar ya da mikroanatomi varsa iç dünyadan SONRA gelir.
    for (const s of deeper) expect(s.scale).not.toBe('interior');
  });

  it('kalıplar organın anatomisine göre: bağırsak lümen, böbrek/karaciğer/beyin parankim, kalp odacık, damar damar, akciğer hava yolu, göz/kulak duyu yolu', () => {
    const a = (id: string) => interiorArchetype(interiorById(id)!);
    expect(['large-intestine', 'small-intestine', 'stomach', 'esophagus', 'urinary-tract.bladder', 'uterus'].map(a)).toEqual(Array(6).fill('hollow'));
    expect(['kidneys', 'liver', 'brain', 'ic.bone', 'skeletal-muscle', 'skin', 'thyroid', 'spleen'].map(a)).toEqual(Array(8).fill('solid'));
    expect(['heart', 'ic.atrium', 'ic.ventricle', 'heart.valves'].map(a)).toEqual(Array(4).fill('chamber'));
    expect(['vessel.aorta', 'ic.artery', 'ic.capillary', 'ic.vein', 'ic.pulmonary-vessels'].map(a)).toEqual(Array(5).fill('vascular'));
    expect(['lungs', 'airways.trachea', 'airways.bronchioles', 'tissue.alveolus'].map(a)).toEqual(Array(4).fill('airway'));
    expect(['eyes', 'ear', 'ear.cochlea', 'ear.middle'].map(a)).toEqual(Array(4).fill('sensory'));
  });

  it('kalın bağırsak: ilk sahne lümen (duvar / mukoza / kript / epitel değil); duvar ancak "Duvarı incele" ile', () => {
    const { inside, deeper } = interiorExperience(interiorById('large-intestine')!);
    expect(inside[0]!.kind).toBe('lumen');
    expect(inside.map((s) => s.kind)).not.toContain('wall');
    expect(deeper.find((s) => s.kind === 'wall')!.title).toBe('Duvarı incele');
  });

  it('ince bağırsak: villus ilk ekran değil, duvardan sonra', () => {
    const st = interiorById('small-intestine')!.stages;
    expect(st[0]!.kind).toBe('lumen');
    expect(st.findIndex((s) => s.node === 'tissue.villus')).toBeGreaterThan(st.findIndex((s) => s.kind === 'wall'));
  });

  it('kalp: odacıklar → kanın yolu → aort → sistemik dolaşım; duvar sonra', () => {
    const { inside } = interiorExperience(interiorById('heart')!);
    expect(inside.map((s) => s.title).slice(-2)).toEqual(['Aort', 'Sistemik dolaşım']);
  });

  it('katalogdaki HER 3B yapı ve bilgi grafiğindeki HER organ/bölge bir iç dünyaya bağlanır (boş "İçine gir" yok)', () => {
    expect(STRUCTURES.filter((s) => !interiorFor(s.id)).map((s) => s.id)).toEqual([]);
    const nodes = [...GRAPH.nodes.values()].filter((n) => n.kind === 'organ' || n.kind === 'region');
    expect(nodes.filter((n) => !interiorFor(n.id)).map((n) => n.id)).toEqual([]);
    // Embriyonik yapı uydurulmaz: ondan gelişen yetişkin organın iç dünyası açılır.
    expect(interiorFor('dev.neural-tube')!.organId).toBe('brain');
    expect(interiorFor('vessel.portal-vein')!.organId).toBe('ic.vein');
    expect(interiorFor('nerve.vagus')!.organId).toBe('nerves');
    expect(interiorFor('thymus')!.organId).toBe('ic.thymus');
  });
});
