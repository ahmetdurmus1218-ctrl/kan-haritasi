import { describe, expect, it, vi } from 'vitest';
import {
  ANALYSIS_STATE_TEXT,
  CAPABILITY_MODALITIES,
  type EngineFactory,
  LocalModelProvider,
  type ModelManifest,
  type Tensor,
  analysisState,
  capabilitiesFor,
  postprocess,
  preprocess,
  validateManifest,
} from '../localModel';
import { defaultMedicalImageProviders, runMedicalImageModel } from '../medicalAI';
import { buildHealthModel } from '../fusion';
import { flowById, personalOverlay } from '../flows';
import { DERIVATION_LABEL, type ImageObservation, type LabObservation, REPORTED, type RasterImage, type ReportFinding, provenanceOf } from '../types';
import type { ImageAnalysisRun } from '../pipeline';

const SHA = 'a'.repeat(64);

const manifest = (over: Partial<ModelManifest> = {}): ModelManifest => ({
  schema: 'kh-model-manifest/1',
  id: 'test-detector',
  name: 'Test dedektörü',
  version: '1.0.0',
  modalities: ['MRI', 'CT'],
  task: 'detection',
  format: 'onnx',
  file: 'model.onnx',
  sha256: SHA,
  license: 'test',
  source: 'test',
  intendedUse: 'yalnızca test',
  input: { name: 'image', layout: 'NCHW', channels: 1, width: 4, height: 4, scale: 255, mean: [0.5], std: [0.5] },
  output: { boxes: 'boxes', scores: 'scores', labels: 'labels', boxFormat: 'xywh-normalized' },
  labels: [{ id: 0, finding: 'Test bulgusu', structure: 'brain.frontal' }],
  scoreThreshold: 0.5,
  limitations: ['Test modeli.'],
  ...over,
});

const gray = (w: number, h: number, v: (x: number, y: number) => number): RasterImage => {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = v(x, y);
  return { width: w, height: h, gray: g } as RasterImage;
};

const t = (data: number[], dims: number[]): Tensor => ({ data: Float32Array.from(data), dims });

describe('model manifesti', () => {
  it('geçerli manifest kabul edilir', () => {
    const r = validateManifest(manifest());
    expect(r.ok).toBe(true);
  });

  it('eksik/yanlış alanlar tek tek listelenir; doğrulanmamış model kabul edilmez', () => {
    const r = validateManifest({ ...manifest(), schema: 'x', sha256: 'kısa', format: 'pt', modalities: ['UZAY'], task: 'detection', output: { boxes: 'b' }, scoreThreshold: 2, id: 'Büyük Harf' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const all = r.errors.join(' | ');
    for (const s of ['schema', 'sha256', 'format', 'modalities', 'detection için', 'scoreThreshold', 'id yalnızca']) expect(all).toContain(s);
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest({ ...manifest(), input: { ...manifest().input, mean: [0.5, 0.5] } }).ok).toBe(false);
    expect(validateManifest({ ...manifest(), task: 'segmentation', output: {} }).ok).toBe(false);
    expect(validateManifest({ ...manifest(), task: 'classification', output: { logits: 'y' } }).ok).toBe(true);
  });
});

describe('ön işleme', () => {
  it('yeniden boyutlandırır, ölçekler ve normalize eder (NCHW)', () => {
    const img = gray(8, 8, () => 255);
    const out = preprocess(img, manifest());
    expect(out.dims).toEqual([1, 1, 4, 4]);
    expect([...out.data].every((v) => Math.abs(Number(v) - 1) < 1e-6)).toBe(true); // (1 - 0.5) / 0.5
    const half = preprocess(gray(8, 8, (x) => (x < 4 ? 0 : 255)), manifest());
    expect(Number(half.data[0])).toBeCloseTo(-1);
    expect(Number(half.data[3])).toBeCloseTo(1);
  });

  it('3 kanallı modelde RGBA kanalları ayrı okunur', () => {
    const img = gray(2, 2, () => 0);
    const rgba = new Uint8ClampedArray(16);
    for (let i = 0; i < 4; i++) rgba.set([255, 0, 0, 255], i * 4);
    const out = preprocess({ ...img, rgba } as RasterImage, manifest({ input: { name: 'image', layout: 'NCHW', channels: 3, width: 2, height: 2, scale: 255, mean: [0, 0, 0], std: [1, 1, 1] } }));
    expect(out.dims).toEqual([1, 3, 2, 2]);
    expect([...out.data.slice(0, 4)].map(Number)).toEqual([1, 1, 1, 1]);
    expect([...out.data.slice(4)].every((v) => v === 0)).toBe(true);
  });
});

describe('son işleme', () => {
  const size = { width: 200, height: 100 };

  it('tespit: eşik üstü kutular özgün piksel koordinatına çevrilir, eşik altı atılır', () => {
    const out = postprocess({ boxes: t([0.1, 0.2, 0.3, 0.4, 0, 0, 1, 1], [2, 4]), scores: t([0.9, 0.2], [2]), labels: t([0, 0], [2]) }, manifest(), size, 3);
    expect(out).toHaveLength(1);
    expect(out[0]!.finding).toBe('Test bulgusu');
    expect(out[0]!.structure).toBe('brain.frontal');
    expect(out[0]!.localization).toEqual({ kind: 'pixel', frame: 3, box: { x: 20, y: 20, w: 60, h: 40 }, imageSize: size });
    expect(out[0]!.confidence).toMatchObject({ kind: 'score', value: 0.9 });
  });

  it('tespit: xyxy biçimi ve bilinmeyen etiket', () => {
    const m = manifest({ output: { boxes: 'boxes', scores: 'scores', labels: 'labels', boxFormat: 'xyxy-normalized' } });
    const out = postprocess({ boxes: t([0.5, 0.5, 1, 1, 0, 0, 1, 1], [2, 4]), scores: t([0.8, 0.99], [2]), labels: t([0, 7], [2]) }, m, size);
    expect(out).toHaveLength(1);
    expect(out[0]!.localization).toMatchObject({ box: { x: 100, y: 50, w: 100, h: 50 } });
    expect(() => postprocess({}, m, size)).toThrow(/boxes/);
  });

  it('segmentasyon: maske → kutu + küçük maske; boş maske bulgu üretmez', () => {
    const m = manifest({ task: 'segmentation', output: { mask: 'mask' } });
    const data = new Array(16).fill(-5);
    data[5] = 5; // (1,1)
    data[6] = 5; // (2,1)
    const out = postprocess({ mask: t(data, [1, 1, 4, 4]) }, m, { width: 40, height: 40 });
    expect(out).toHaveLength(1);
    const loc = out[0]!.localization;
    expect(loc.kind).toBe('pixel');
    if (loc.kind !== 'pixel') return;
    expect(loc.box).toEqual({ x: 10, y: 10, w: 20, h: 10 });
    expect(loc.mask?.data.filter(Boolean)).toHaveLength(2);
    expect(postprocess({ mask: t(new Array(16).fill(-5), [1, 1, 4, 4]) }, m, size)).toHaveLength(0);
  });

  it('sınıflandırma: softmax; konum uydurulmaz (yalnızca bölge)', () => {
    const m = manifest({ task: 'classification', output: { logits: 'y' }, labels: [{ id: 0, finding: 'Normal' }, { id: 1, finding: 'Anormal' }] });
    const out = postprocess({ y: t([0, 3], [1, 2]) }, m, size);
    expect(out.map((f) => f.finding)).toEqual(['Anormal']);
    expect(out[0]!.localization).toEqual({ kind: 'region-only' });
  });
});

describe('LocalModelProvider (sahte motorla — yalnızca testte)', () => {
  const engineFor = (scores: number[]) => {
    const run = vi.fn(async (): Promise<Record<string, Tensor>> => ({ boxes: t([0.1, 0.1, 0.2, 0.2], [1, 4]), scores: t(scores, [1]), labels: t([0], [1]) }));
    const dispose = vi.fn();
    const factory: EngineFactory = vi.fn(async () => ({ run, dispose }));
    return { run, dispose, factory };
  };

  it('model tembel yüklenir, bir kez; modalite dışı girdi reddedilir; dispose belleği bırakır', async () => {
    const { run, dispose, factory } = engineFor([0.9]);
    const load = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const p = new LocalModelProvider(manifest(), load, factory);
    expect(p.sendsDataOffDevice).toBe(false);
    expect(load).not.toHaveBeenCalled();
    const img = gray(10, 10, () => 100);
    const a = await p.detectFindings({ images: [img, img], modality: 'MRI', context: {} });
    await p.detectFindings({ images: [img], modality: 'MRI', context: {} });
    expect(load).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(3);
    expect(a.status === 'ok' && a.value.map((f) => (f.localization.kind === 'pixel' ? f.localization.frame : -1))).toEqual([0, 1]);
    expect((await p.detectFindings({ images: [img], modality: 'XRAY', context: {} })).status).toBe('unavailable');
    p.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('model → bulgu → konum → anatomi zinciri; köken model-derived + SHA-256 + lisans', async () => {
    const { factory } = engineFor([0.86]);
    const m = manifest();
    const reg = defaultMedicalImageProviders();
    reg.register(new LocalModelProvider(m, async () => new Uint8Array(1), factory));
    const run = await runMedicalImageModel({ images: [gray(100, 100, () => 50)], modality: 'MRI', context: {} }, reg, {
      documentId: 'doc-1',
      identity: { id: m.id, name: m.name, version: m.version, kind: 'learned', local: true, sha256: m.sha256, license: m.license },
      now: () => new Date('2026-05-01T00:00:00Z'),
    });
    expect(run.status).toBe('ran');
    if (run.status !== 'ran') return;
    const f = run.findings[0]!;
    expect(f.source).toBe('IMAGE_MODEL');
    expect(f.localization).toMatchObject({ kind: 'pixel', box: { x: 10, y: 10, w: 20, h: 20 } });
    expect(f.anatomicalStructure?.path).toEqual(['brain', 'brain.hemisphere-left', 'brain.frontal']);
    expect(f.provenance).toMatchObject({ derivation: 'model-derived', source: 'IMAGE_MODEL', documentId: 'doc-1', model: { sha256: SHA, license: 'test' } });
    expect(provenanceOf(f).derivation).toBe('model-derived');
  });

  it('model yoksa bulgu yok; motor hatası sahte sonuçla örtülmez', async () => {
    const none = await runMedicalImageModel({ images: [gray(4, 4, () => 0)], modality: 'MRI', context: {} });
    expect(none.status).toBe('unavailable');
    const reg = defaultMedicalImageProviders();
    reg.register(new LocalModelProvider(manifest(), async () => new Uint8Array(1), async () => Promise.reject(new Error('bozuk model'))));
    const r = await runMedicalImageModel({ images: [gray(4, 4, () => 0)], modality: 'MRI', context: {} }, reg);
    expect(r.status).not.toBe('ran');
  });
});

describe('modalite yetenekleri ve üç durum', () => {
  it('model kurulu değilken 12 modalitenin hiçbirinde "yerel model" desteklenmez ve nedeni yazılıdır', () => {
    expect(CAPABILITY_MODALITIES.map((m) => m.modality)).toEqual(['MRI', 'CT', 'XRAY', 'ULTRASOUND', 'DOPPLER', 'ECHOCARDIOGRAPHY', 'MAMMOGRAPHY', 'PATHOLOGY', 'ECG', 'ENDOSCOPY', 'FUNDUS', 'DENTAL']);
    for (const { modality } of CAPABILITY_MODALITIES) {
      const caps = capabilitiesFor(modality);
      const lm = caps.find((c) => c.key === 'local-model')!;
      expect(lm.supported, modality).toBe(false);
      expect(lm.reason).toBe('Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.');
      for (const c of caps) expect(c.reason.length, `${modality}/${c.key}`).toBeGreaterThan(3);
    }
  });

  it('kurulu model yalnızca kendi modalitelerinde yetenek açar', () => {
    const m = manifest();
    expect(capabilitiesFor('MRI', [m]).find((c) => c.key === 'local-model')).toMatchObject({ supported: true, reason: 'Test dedektörü 1.0.0' });
    expect(capabilitiesFor('MRI', [m]).find((c) => c.key === 'localization')?.supported).toBe(true);
    expect(capabilitiesFor('XRAY', [m]).find((c) => c.key === 'local-model')?.supported).toBe(false);
    expect(capabilitiesFor('XRAY', [m]).find((c) => c.key === 'localization')?.supported).toBe(false);
  });

  it('üç durum karıştırılmaz', () => {
    expect(analysisState({ modelRan: true, precheckRan: true })).toBe('model');
    expect(analysisState({ modelRan: false, precheckRan: true })).toBe('precheck');
    expect(analysisState({ modelRan: false, precheckRan: false })).toBe('none');
    expect(ANALYSIS_STATE_TEXT.model).toBe('Yerel tıbbi AI modeli ile analiz edildi.');
    expect(ANALYSIS_STATE_TEXT.precheck).toBe('Görüntü ön incelemesi yapıldı. Bu sonuç tıbbi AI modeli sonucu değildir.');
    expect(ANALYSIS_STATE_TEXT.none).toBe('Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.');
  });
});

/* ---------------------------------------------------------------- Köken + rapor/görüntü çelişkisi */

const SYM = { id: 'kh-lr-symmetry', name: 'Sağ-sol ayna karşılaştırması', version: '1.0.0', kind: 'heuristic' as const, local: true };

const reportFinding = (text: string, structure: string, over: Partial<ReportFinding> = {}): ReportFinding => ({
  id: text,
  source: 'RADIOLOGY_REPORT',
  text,
  status: 'normal',
  negated: true,
  location: { path: ['brain', 'brain.hemisphere-left', structure], structure, basis: 'report-text', confidence: REPORTED },
  localization: { kind: 'region-only' },
  confidence: REPORTED,
  documentId: 'rapor-1',
  date: '2026-05-01',
  ...over,
});

async function modelRun(): Promise<ImageAnalysisRun> {
  const reg = defaultMedicalImageProviders();
  const m = manifest();
  reg.register(new LocalModelProvider(m, async () => new Uint8Array(1), async () => ({ run: async () => ({ boxes: t([0.1, 0.1, 0.2, 0.2], [1, 4]), scores: t([0.9], [1]), labels: t([0], [1]) }), dispose() {} })));
  const r = await runMedicalImageModel({ images: [gray(100, 100, () => 50)], modality: 'MRI', context: {} }, reg, { documentId: 'goruntu-1' });
  if (r.status !== 'ran') throw new Error('model çalışmadı');
  return {
    id: 'r',
    at: '2026-05-01T00:00:00Z',
    quality: { usable: true, score: 1, issues: [], metrics: { width: 100, height: 100, edgeWidth: 0, glareFraction: 0, contrast: null, median: null } },
    route: 'image-analysis',
    kind: 'precheck',
    coverage: { kind: 'photo', frames: 1, label: '1 görüntü (fotoğraf)' },
    sequence: { source: 'none', text: 'Sekans belirlenemedi.' },
    reportAvailable: true,
    statements: [],
    result: { adapterId: 'cross-sectional-symmetry', modality: 'MRI', status: 'PARTIAL', model: SYM, capabilities: [], observations: [], limitations: [], summary: '' },
    modelFindings: r.findings,
  } as ImageAnalysisRun;
}

describe('köken (provenance) türetimi', () => {
  it('rapor → report-derived, kural tabanlı gözlem → heuristic-derived, laboratuvar → lab', () => {
    const obs = { id: 'o', source: 'IMAGE_ANALYSIS', kind: 'asymmetry', text: 'x', localization: { kind: 'none' }, confidence: REPORTED, model: SYM, limitations: [] } as ImageObservation;
    const lab = { testKey: 'ldl', name: 'LDL', value: 190, unit: 'mg/dL', status: 'high', date: '2026-05-01', source: 'LAB', confidence: REPORTED } as LabObservation;
    expect(provenanceOf(reportFinding('Frontal lob olağan', 'brain.frontal'))).toEqual({ derivation: 'report-derived', source: 'RADIOLOGY_REPORT', documentId: 'rapor-1', at: '2026-05-01' });
    expect(provenanceOf(obs).derivation).toBe('heuristic-derived');
    expect(provenanceOf({ ...obs, model: { ...SYM, kind: 'learned' } }).derivation).toBe('model-derived');
    expect(provenanceOf(lab)).toEqual({ derivation: 'lab', source: 'LAB', at: '2026-05-01' });
    expect(DERIVATION_LABEL['heuristic-derived']).toMatch(/tıbbi model değil/);
  });
});

describe('rapor + görüntü ayrı kaynaklar; çelişki gizlenmez', () => {
  it('rapor yapıyı olağan derken model bulgu bildirirse ÇELİŞKİ işaretlenir, iki kaynak ayrı kalır', async () => {
    const run = await modelRun();
    const hm = buildHealthModel({ images: [{ run, documentId: 'goruntu-1', studyKey: 'mr-beyin' }], reports: [{ findings: [reportFinding('Sol frontal lobda patoloji izlenmedi', 'brain.frontal')], documentId: 'rapor-1', studyKey: 'mr-beyin' }], labs: [] });
    expect(hm.modelFindings).toHaveLength(1);
    expect(hm.modelConcordance[0]?.relation).toBe('contradicted-by-report');
    expect(hm.modelConcordance[0]?.text).toMatch(/^ÇELİŞKİ/);
    expect(hm.reportFindings[0]?.source).toBe('RADIOLOGY_REPORT');
    expect(hm.modelFindings[0]?.source).toBe('IMAGE_MODEL');
    expect(hm.organs.get('brain')?.modelFindings).toHaveLength(1);
    expect(hm.organs.get('brain')?.attention).toBe(true);
  });

  it('rapor aynı yapıda bulgu bildirirse "destekleniyor", rapor yoksa "rapor yok"', async () => {
    const run = await modelRun();
    const sup = buildHealthModel({ images: [{ run, studyKey: 'mr-beyin' }], reports: [{ findings: [reportFinding('Sol frontal lobda 8 mm lezyon', 'brain.frontal', { status: 'abnormal', negated: false })], studyKey: 'mr-beyin' }], labs: [] });
    expect(sup.modelConcordance[0]?.relation).toBe('supported-by-report');
    const alone = buildHealthModel({ images: [{ run }], reports: [], labs: [] });
    expect(alone.modelConcordance[0]?.relation).toBe('no-report');
    // Başka bir çalışmanın raporu bu görüntünün bulgusunu doğrulamaz/çürütmez.
    const other = buildHealthModel({ images: [{ run, studyKey: 'mr-beyin' }], reports: [{ findings: [reportFinding('Frontal lob olağan', 'brain.frontal')], studyKey: 'bt-toraks' }], labs: [] });
    expect(other.modelConcordance[0]?.relation).toBe('no-report');
    // Aynı çalışma, kardeş bölge: sağ temporal lob raporu sol frontal bulguyla ilişkilendirilmez.
    const sibling = reportFinding('Sağ temporal lob olağan', 'brain.temporal', { location: { path: ['brain', 'brain.hemisphere-right', 'brain.temporal'], structure: 'brain', basis: 'report-text', confidence: REPORTED } });
    const sib = buildHealthModel({ images: [{ run, studyKey: 'mr-beyin' }], reports: [{ findings: [sibling], studyKey: 'mr-beyin' }], labs: [] });
    expect(sib.modelConcordance[0]?.relation).toBe('not-mentioned-in-report');
    // Organ düzeyinde "beyin olağan" ise bulguyu kapsar → çelişki.
    const organWide = reportFinding('Beyin parankimi olağan', 'brain', { location: { path: ['brain'], structure: 'brain', basis: 'report-text', confidence: REPORTED } });
    const ow = buildHealthModel({ images: [{ run, studyKey: 'mr-beyin' }], reports: [{ findings: [organWide], studyKey: 'mr-beyin' }], labs: [] });
    expect(ow.modelConcordance[0]?.relation).toBe('contradicted-by-report');
  });

  it('model bulgusu fizyoloji akışında ilgili basamağa "olası ilişki" olarak bağlanır (tanı değil)', async () => {
    const run = await modelRun();
    const hm = buildHealthModel({ images: [{ run }], reports: [], labs: [] });
    const o = personalOverlay(flowById('nervous')!, hm);
    const f = o.findings.find((x) => x.stepId === 'processing');
    expect(f).toMatchObject({ source: 'IMAGE_MODEL', derivation: 'model-derived', relation: 'POSSIBLE_RELATION' });
    expect(f?.text).toMatch(/tanı değildir/);
    expect(o.flaggedSteps).toContain('processing');
    expect(o.hasData).toBe(true);
  });
});
