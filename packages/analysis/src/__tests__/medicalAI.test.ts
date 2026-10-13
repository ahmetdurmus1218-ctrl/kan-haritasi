import { describe, expect, it } from 'vitest';
import {
  GROUP_MODALITIES,
  type MedicalImageAIProvider,
  MedicalImageProviderRegistry,
  type ModelFinding,
  type ProviderOutput,
  UnavailableImageProvider,
  defaultMedicalImageProviders,
  readMedicalAIConfig,
  runMedicalImageModel,
} from '../medicalAI';
import { analyzeImage, coverageOf, sequenceFrom } from '../pipeline';
import { rasterFromRgba } from '../image';
import { type ModelVersion, score } from '../types';
import { grayToRgba, headSlice } from './synthetic';

const input = { images: [], modality: 'MRI' as const, context: {} };

describe('tıbbi görüntü modeli sağlayıcıları (gerçek model yok)', () => {
  it('her modalite grubu için sağlayıcı var ve hepsi dürüstçe "yok" der', async () => {
    const r = defaultMedicalImageProviders();
    for (const ms of Object.values(GROUP_MODALITIES))
      for (const m of ms) {
        const p = r.forModality(m)!;
        expect(p.available()).toBe(false);
        const out = await p.detectFindings({ ...input, modality: m });
        expect(out.status).toBe('unavailable');
      }
    const run = await runMedicalImageModel(input, r);
    expect(run).toEqual({ status: 'unavailable', reason: 'Bu kurulumda tıbbi görüntü modeli yok.' });
  });

  it('yapılandırma API anahtarını ön yüze vermez; tanımsız istemci için bulgu üretmez', async () => {
    const cfg = readMedicalAIConfig({ MEDICAL_AI_PROVIDER: 'acme', MEDICAL_AI_API_KEY: 'gizli-anahtar', MRI_MODEL: 'brain-v2' });
    expect(cfg).toEqual({ provider: 'acme', baseUrl: undefined, hasApiKey: true, models: { mri: 'brain-v2' } });
    expect(JSON.stringify(cfg)).not.toContain('gizli-anahtar');
    const run = await runMedicalImageModel(input, new MedicalImageProviderRegistry(cfg));
    expect(run.status).toBe('unavailable');
    expect(run.status === 'unavailable' && run.reason).toMatch(/istemci yok/);
  });

  it('gerçek bir model eklenirse: bulgu → konum → anatomi zinciri çalışır ve "model-derived" kaydedilir', async () => {
    const MODEL: ModelVersion = { id: 'test-mri', name: 'Test MR modeli', version: '2.1.0', kind: 'learned', local: true };
    const finding: ModelFinding = { finding: 'Lezyon adayı', localization: { kind: 'pixel', frame: 0, box: { x: 10, y: 10, w: 5, h: 5 }, imageSize: { width: 100, height: 100 } }, confidence: score(0.8, 'model'), structure: 'brain.frontal' };
    const ok = <T>(value: T): Promise<ProviderOutput<T>> => Promise.resolve({ status: 'ok', value, source: 'IMAGE_MODEL', model: MODEL, confidence: score(0.8, 'model'), limitations: ['Test modeli.'] });
    // Yalnızca bu testte: arayüzü uygulayan bir test sağlayıcısı (uygulamada kayıtlı DEĞİL).
    const fake: MedicalImageAIProvider = Object.assign(new UnavailableImageProvider('test', 'mri'), { id: 'test-mri', available: () => true, detectFindings: () => ok([finding]), localizeFindings: (_: unknown, f: ModelFinding[]) => ok(f) });
    const reg = defaultMedicalImageProviders();
    reg.register(fake);
    const run = await runMedicalImageModel(input, reg);
    expect(run.status).toBe('ran');
    if (run.status !== 'ran') return;
    expect(run.findings).toHaveLength(1);
    const f = run.findings[0]!;
    expect(f.source).toBe('IMAGE_MODEL');
    expect(f.model).toEqual(MODEL);
    expect(f.anatomicalStructure?.path).toEqual(['brain', 'brain.hemisphere-left', 'brain.frontal']);
    expect(f.anatomicalStructure?.basis).toBe('pixel-mapped');
    expect(f.limitations).toContain('Test modeli.');
  });

  it('veriyi cihaz dışına gönderen sağlayıcı onaysız çalışmaz; zaman aşımında bulgu üretmez', async () => {
    const remote: MedicalImageAIProvider = Object.assign(new UnavailableImageProvider('remote', 'mri'), { id: 'remote', sendsDataOffDevice: true, available: () => true });
    const reg = defaultMedicalImageProviders();
    reg.register(remote);
    expect((await runMedicalImageModel(input, reg)).status).toBe('unavailable');
    const slow: MedicalImageAIProvider = Object.assign(new UnavailableImageProvider('slow', 'mri'), { id: 'slow', available: () => true, detectFindings: () => new Promise<never>(() => undefined) });
    const reg2 = defaultMedicalImageProviders();
    reg2.register(slow);
    const run = await runMedicalImageModel(input, reg2, { timeoutMs: 20 });
    expect(run).toEqual({ status: 'unavailable', reason: 'Model 0 saniyede yanıt vermedi.' });
  });
});

describe('görüntü ön incelemesi: dürüst adlandırma, kapsam ve sekans', () => {
  const photo = rasterFromRgba(grayToRgba(headSlice(240, 288, { x: 74, y: 100, r: 16, v: 245 }), 240, 288).rgba, 240, 288);

  it('yalnızca kural tabanlı ön kontrol çalıştıysa "precheck"; lezyon/segmentasyon/sekans "bu kurulumda yok"', () => {
    const run = analyzeImage(photo, { declaredCategory: 'mr', fileName: 'T1_FLAIR_beyin.jpg' });
    expect(run.kind).toBe('precheck');
    const caps = Object.fromEntries(run.result.capabilities.map((c) => [c.key, c.status]));
    expect(caps['lesion-detection']).toBe('not-implemented');
    expect(caps.segmentation).toBe('not-implemented');
    expect(caps.sequence).toBe('not-implemented');
    // Dosya adı "T1_FLAIR" olsa da sekans uydurulmaz.
    expect(run.sequence).toEqual({ source: 'none', text: 'Sekans belirlenemedi: fotoğrafta sekans bilgisi yok ve görüntüden sekans tanıyan bir model bu kurulumda yok.' });
    expect(run.coverage.kind).toBe('photo');
    expect(run.coverage.limited).toMatch(/Görüntü kapsamı sınırlı/);
    for (const o of run.result.observations) {
      expect(o.text).toMatch(/^Görüntü asimetrisi gözlemi/);
      expect(o.text).not.toMatch(/lezyon|tümör|kitle/i);
    }
    expect(run.statements.join(' ')).not.toMatch(/Otomatik görüntü analizi/);
  });

  it('sekans yalnızca DICOM başlığından; kapsam DICOM serisinde kesit sayısıyla', () => {
    expect(sequenceFrom({ dicom: { modality: 'MR', seriesDescription: 'AX FLAIR' } }, 'MRI')).toMatchObject({ value: 'FLAIR', source: 'DICOM_METADATA' });
    expect(sequenceFrom({ dicom: { modality: 'MR', seriesDescription: 'T1 MPRAGE POST GAD' } }, 'MRI').value).toBe('T1 (kontrastlı)');
    expect(sequenceFrom({ dicom: { modality: 'MR', seriesDescription: 'Seri 3' } }, 'MRI').source).toBe('none');
    expect(coverageOf({ dicom: { frames: 180 } }, undefined)).toEqual({ kind: 'dicom-series', frames: 180, label: 'DICOM seri · 180 kesit' });
    expect(coverageOf({}, 2).label).toBe('2 görüntü (fotoğraf)');
  });
});
