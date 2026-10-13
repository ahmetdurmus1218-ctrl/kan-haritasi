import { describe, expect, it } from 'vitest';
import { STRUCTURES, testByKey } from '@kh/catalog';
import { FLOWS, flowById, flowsForOrgan, organNeighbors, personalOverlay } from '../flows';
import { GRAPH } from '../knowledge';
import { type LabObservation, REPORTED } from '../types';
import { buildHealthModel } from '../fusion';

const lab = (testKey: string, value: number, status: LabObservation['status'], severity: LabObservation['severity'] = 'mild'): LabObservation => ({
  testKey,
  name: testByKey.get(testKey)?.nameTr ?? testKey,
  value,
  unit: testByKey.get(testKey)?.unit ?? '',
  status,
  severity: status === 'normal' ? 'normal' : severity,
  date: '2026-05-01',
  source: 'LAB',
  confidence: REPORTED,
});

describe('fizyoloji akışları (veri modeli)', () => {
  it('her akış: benzersiz basamaklar, önceki/sonraki bağları, geçerli anatomi ve test anahtarları', () => {
    const structures = new Set(STRUCTURES.map((s) => s.id));
    for (const f of FLOWS) {
      const ids = f.steps.map((s) => s.id);
      expect(new Set(ids).size, f.id).toBe(ids.length);
      f.steps.forEach((s, i) => {
        expect(s.previous).toBe(i ? f.steps[i - 1]!.id : undefined);
        expect(s.next).toBe(i < f.steps.length - 1 ? f.steps[i + 1]!.id : undefined);
        if (s.anatomyId) expect(GRAPH.node(s.anatomyId) || structures.has(s.anatomyId), `${f.id}/${s.id}: ${s.anatomyId}`).toBeTruthy();
        for (const o of s.relatedOrgans) expect(GRAPH.node(o) || structures.has(o), `${f.id}/${s.id}: ${o}`).toBeTruthy();
        for (const k of s.relatedBiomarkers) expect(testByKey.has(k), `${f.id}/${s.id}: ${k}`).toBe(true);
      });
    }
  });

  it('istenen akışlar var: sindirim, bağırsak emilimi, kalp, solunum, böbrek, pankreas (endokrin + ekzokrin), hormon ekseni, beyin', () => {
    for (const id of ['digestion', 'intestinal-absorption', 'circulation', 'respiration', 'kidney-filtration', 'glucose-insulin', 'pancreas-enzymes', 'endocrine-axis', 'nervous', 'immune', 'blood-cells', 'muscle', 'reproductive-cycle'])
      expect(flowById(id), id).toBeDefined();
    expect(flowById('intestinal-absorption')!.steps.map((s) => s.title)).toEqual([
      'Besin',
      'Mide',
      'Duodenum',
      'Safra + pankreas enzimleri',
      'Sindirim',
      'Villus',
      'Emilim (enterosit)',
      'Kılcal damar / lenf',
      'Portal ven',
      'Karaciğer',
      'Dolaşım',
    ]);
    expect(flowById('circulation')!.steps.map((s) => s.title)).toEqual(['Vena cava', 'Sağ atrium', 'Sağ ventrikül', 'Akciğer', 'Sol atrium', 'Sol ventrikül', 'Aort', 'Dokular']);
  });

  it('organın akışları en ilgili olandan başlar; organlar arası komşular tıklanabilir', () => {
    expect(flowsForOrgan('pancreas').slice(0, 2).map((f) => f.id)).toEqual(['pancreas-enzymes', 'glucose-insulin']);
    expect(flowsForOrgan('small-intestine')[0]!.id).toBe('intestinal-absorption');
    const n = organNeighbors('small-intestine').find((x) => x.flow.id === 'digestion');
    expect(n).toMatchObject({ before: 'stomach', after: 'large-intestine' });
  });

  it('kişisel katman: yalnızca verisi olan basamak işaretlenir, ilişki her zaman "olası"', () => {
    const flow = flowById('intestinal-absorption')!;
    const model = { latestLabs: [lab('ferritin', 8, 'low'), lab('b12', 150, 'low'), lab('albumin', 4.2, 'normal')] };
    const o = personalOverlay(flow, model);
    expect(o.flaggedSteps).toContain('absorption');
    expect(o.flaggedSteps).not.toContain('liver'); // albümin aralıkta → işaretlenmez
    expect(o.relations.every((r) => r.relation === 'POSSIBLE_RELATION')).toBe(true);
    expect(o.statement).toBe('Bu sonuçlar bağırsak emilimiyle ilişkili olabilir; ancak tek başına bağırsak emilim bozukluğunu kanıtlamaz.');
    expect(o.noDataSteps).toContain('portal');
    for (const r of o.relations) expect(r.text).not.toMatch(/bozulmuş|bozuk\b|hasta\b/);
  });

  it('veri yoksa hiçbir basamak "sorunlu" değildir', () => {
    const o = personalOverlay(flowById('circulation')!, { latestLabs: [] });
    expect(o.hasData).toBe(false);
    expect(o.flaggedSteps).toEqual([]);
    expect(o.noDataSteps.length).toBe(flowById('circulation')!.steps.length);
    expect(o.statement).toMatch(/sorunlu” sayılmaz/);
  });

  it('demir akışı: ferritin/Hb düşükse demir eksikliğiyle "uyumlu olabilir" der, bağırsağı suçlamaz', () => {
    const o = personalOverlay(flowById('iron-absorption')!, { latestLabs: [lab('ferritin', 6, 'low'), lab('hemoglobin', 10.8, 'low')] });
    expect(o.flaggedSteps).toEqual(['storage', 'hemoglobin']);
    expect(o.statement).toMatch(/uyumlu olabilir/);
    expect(o.statement).toMatch(/bağırsakta olduğunu göstermez/);
  });
});

describe('bağırsak bilgi grafiği ve "içine gir" yolu', () => {
  it('İnce bağırsak → duvar → mukoza → villus → enterosit (hücreye tek tıkla atlanmaz)', () => {
    expect(GRAPH.insidePath('small-intestine').map((n) => n.id)).toEqual(['tissue.intestinal-wall', 'tissue.intestinal-mucosa', 'tissue.villus', 'cell.enterocyte']);
    const villus = GRAPH.drill('tissue.villus').map((d) => d.node.id);
    expect(villus).toEqual(expect.arrayContaining(['cell.enterocyte', 'tissue.villus-capillary', 'tissue.lacteal']));
    const cell = GRAPH.drill('cell.enterocyte').map((d) => d.node.kind);
    expect(cell).toEqual(expect.arrayContaining(['process', 'molecule']));
  });

  it('İnce bağırsağın ilk işlevi emilim; B12/folat önce kemik iliğine (alyuvar yapımı) bağlanır', () => {
    expect(GRAPH.functionsOf('small-intestine')[0]!.id).toBe('proc.absorption');
    expect(GRAPH.organsForTest('b12')[0]!.id).toBe('bones');
    expect(GRAPH.organsForTest('b12').map((n) => n.id)).toContain('small-intestine');
    expect(GRAPH.organsForTest('albumin')[0]!.id).toBe('liver');
  });

  it('görüntü asimetrisi gözlemi organı "dikkat" durumuna geçirmez (gözlem ≠ anormallik)', () => {
    const run = {
      id: 'r',
      at: '2026-05-01T00:00:00Z',
      quality: { usable: true, score: 1, issues: [], metrics: { width: 1, height: 1, edgeWidth: 0, glareFraction: 0, contrast: null, median: null } },
      route: 'image-analysis' as const,
      kind: 'precheck' as const,
      coverage: { kind: 'photo' as const, frames: 2, label: '2 görüntü (fotoğraf)' },
      sequence: { source: 'none' as const, text: 'Sekans belirlenemedi.' },
      reportAvailable: false,
      statements: [],
      result: {
        adapterId: 'cross-sectional-symmetry',
        modality: 'MRI' as const,
        status: 'PARTIAL' as const,
        model: { id: 'kh-lr-symmetry', name: 'Sağ-sol ayna karşılaştırması', version: '1.0.0', kind: 'heuristic' as const, local: true },
        capabilities: [],
        observations: [
          {
            id: 'o1',
            source: 'IMAGE_ANALYSIS' as const,
            kind: 'asymmetry' as const,
            text: 'Görüntü asimetrisi gözlemi — Kesit 1',
            location: { path: ['brain', 'brain.frontal'], structure: 'brain', basis: 'pixel-mapped' as const, confidence: REPORTED },
            localization: { kind: 'none' as const },
            confidence: REPORTED,
            model: { id: 'kh-lr-symmetry', name: 'Sağ-sol ayna karşılaştırması', version: '1.0.0', kind: 'heuristic' as const, local: true },
            limitations: [],
          },
        ],
        limitations: [],
        summary: '',
      },
    };
    const m = buildHealthModel({ images: [{ run, documentId: 'd' }], reports: [], labs: [] });
    expect(m.organs.get('brain')?.imageObservations.length).toBe(1);
    expect(m.organs.get('brain')?.attention).toBe(false);
  });
});
