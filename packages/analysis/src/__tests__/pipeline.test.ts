import { describe, expect, it } from 'vitest';
import { analyzeImage } from '../pipeline';
import { assessQuality } from '../quality';
import { classifyModality, imageFeatures } from '../modality';
import { rasterFromRgba } from '../image';
import { GRAPH } from '../knowledge';
import { defaultRegistry } from '../adapters/registry';
import { documentImage, ecgImage, gaussianBlur, grayToRgba, headSlice, pathologyImage, ultrasoundImage } from './synthetic';

const raster = (r: { rgba: Uint8ClampedArray; width: number; height: number }) => rasterFromRgba(r.rgba, r.width, r.height);
const brainPhoto = (lesion = true) => raster(grayToRgba(headSlice(240, 288, lesion ? { x: 74, y: 100, r: 16, v: 245 } : undefined), 240, 288));

describe('kalite kontrolü', () => {
  it('keskin görüntüde bulanıklık işaretlemez, bulanıklaştırılmışta işaretler', () => {
    const sharp = headSlice(400, 480);
    const q1 = assessQuality(raster(grayToRgba(sharp, 400, 480)));
    expect(q1.issues.map((i) => i.code)).not.toContain('blur');
    const blurred = gaussianBlur(sharp, 400, 480, 6);
    const q2 = assessQuality(raster(grayToRgba(blurred, 400, 480)));
    expect(q2.issues.map((i) => i.code)).toContain('blur');
    expect(q2.score).toBeLessThan(q1.score);
  });

  it('çok küçük görüntüyü engeller, düşük çözünürlüğü uyarır', () => {
    const tiny = assessQuality(raster(grayToRgba(headSlice(50, 60), 50, 60)));
    expect(tiny.usable).toBe(false);
    const small = assessQuality(raster(grayToRgba(headSlice(150, 180), 150, 180)));
    expect(small.usable).toBe(true);
    expect(small.issues.map((i) => i.code)).toContain('low-resolution');
  });

  it('parlama (beyaza doymuş alan) ve kesilmiş kenarı bulur', () => {
    const img = headSlice(300, 360);
    for (let y = 60; y < 120; y++) for (let x = 100; x < 180; x++) img[y * 300 + x] = 255;
    const q = assessQuality(raster(grayToRgba(img, 300, 360)));
    expect(q.issues.map((i) => i.code)).toContain('glare');
    // Kafa çerçevenin dışına taşıyor (kırpılmış)
    const crop = headSlice(300, 360).slice(0, 300 * 120);
    const q2 = assessQuality(raster(grayToRgba(crop, 300, 120)));
    expect(q2.issues.map((i) => i.code)).toContain('cropped');
  });
});

describe('modalite sınıflandırması (rapor yok, yalnızca görüntü)', () => {
  it('baş kesiti fotoğrafı → kesitsel görüntü (MR/BT) ve beyin', () => {
    const f = imageFeatures(brainPhoto(false));
    const m = classifyModality(f);
    expect(['MRI', 'CT']).toContain(m.primary.modality);
    expect(m.primary.source).toBe('IMAGE_ANALYSIS');
    expect(m.medical.value).toBe(true);
    expect(f.headLike).toBe(true);
  });

  it('EKG kâğıdı → EKG', () => {
    const m = classifyModality(imageFeatures(raster(ecgImage())));
    expect(m.primary.modality).toBe('ECG');
  });

  it('laboratuvar kâğıdı fotoğrafı → belge', () => {
    const m = classifyModality(imageFeatures(raster(documentImage())));
    expect(m.primary.modality).toBe('DOCUMENT');
  });

  it('yelpaze biçimli gri görüntü → ultrason', () => {
    const m = classifyModality(imageFeatures(raster(ultrasoundImage())));
    expect(m.primary.modality).toBe('ULTRASOUND');
  });

  it('H&E benzeri renkli kesit → patoloji', () => {
    const m = classifyModality(imageFeatures(raster(pathologyImage())));
    expect(m.primary.modality).toBe('PATHOLOGY');
  });

  it('DICOM başlığı ve kullanıcı seçimi görüntü tahmininden önce gelir; kaynak ayrı tutulur', () => {
    const f = imageFeatures(brainPhoto(false));
    const d = classifyModality(f, { dicom: { modality: 'CT' } });
    expect(d.primary.modality).toBe('CT');
    expect(d.primary.source).toBe('DICOM_METADATA');
    const u = classifyModality(f, { declaredCategory: 'mr' });
    expect(u.primary.source).toBe('USER_INPUT');
  });

  it('görüntü bildirilen türle çelişince uyarır', () => {
    const m = classifyModality(imageFeatures(raster(ecgImage())), { declaredCategory: 'mr' });
    expect(m.conflict).toMatch(/ECG/);
  });
});

describe('analiz hattı', () => {
  it('rapor olmadan beyin MR fotoğrafından kaynaklı, güvenli, konumlu gözlem üretir', () => {
    const run = analyzeImage(brainPhoto(), { fileName: 'brain_mri.jpg' });
    expect(run.route).toBe('image-analysis');
    expect(run.reportAvailable).toBe(false);
    expect(run.statements.join(' ')).toMatch(/Rapor: yok/);
    expect(run.result.status).toBe('PARTIAL');
    const o = run.result.observations[0]!;
    expect(o.source).toBe('IMAGE_ANALYSIS');
    expect(o.localization.kind).toBe('pixel');
    expect(o.confidence.kind).toBe('score');
    expect(o.model.version).toBe('1.0.0');
    // Görüntünün solu → hastanın sağı (radyolojik düzen); üst kısım → frontal
    expect(o.location?.path).toEqual(['brain', 'brain.hemisphere-right', 'brain.frontal']);
    expect(o.location?.basis).toBe('pixel-mapped');
    // Uygulanmamış yetenekler dürüstçe listelenir
    const lesion = run.result.capabilities.find((c) => c.key === 'lesion-detection')!;
    expect(lesion.status).toBe('not-implemented');
  });

  it('simetrik normal kesitte gözlem uydurmaz', () => {
    const run = analyzeImage(brainPhoto(false));
    expect(run.result.observations).toHaveLength(0);
    expect(run.result.summary).toMatch(/kanıtlamaz/);
  });

  it('belge fotoğrafını görüntü analizine değil OCR yoluna yönlendirir', () => {
    const run = analyzeImage(raster(documentImage()));
    expect(run.route).toBe('ocr-document');
    expect(run.result.observations).toHaveLength(0);
  });

  it('modeli olmayan modalitede UNAVAILABLE der ve bulgu üretmez', () => {
    const run = analyzeImage(brainPhoto(), { declaredCategory: 'xray' });
    expect(run.result.modality).toBe('XRAY');
    expect(run.result.status).toBe('UNAVAILABLE');
    expect(run.result.observations).toHaveLength(0);
    expect(run.result.summary).toMatch(/bu kurulumda yok/);
  });

  it('kullanılamayacak kadar küçük görüntüde çökmeden reddeder', () => {
    const run = analyzeImage(raster(grayToRgba(new Float32Array(40 * 40), 40, 40)));
    expect(run.route).toBe('rejected');
    expect(run.result.status).toBe('UNAVAILABLE');
  });
});

describe('adaptör kaydı', () => {
  it('her modalite bir adaptöre gider; olmayanlar genel adaptöre düşer', () => {
    const r = defaultRegistry();
    expect(r.forModality('MRI').id).toBe('cross-sectional-symmetry');
    expect(r.forModality('ECG').id).toBe('ecg-image');
    expect(r.forModality('FUNDUS').id).toBe('fundus');
    expect(r.forModality('UNKNOWN').id).toBe('generic');
  });

  it('yeni adaptör mevcut sistemi bozmadan eklenir ve öncelik kazanır', () => {
    const r = defaultRegistry();
    r.register({
      id: 'fundus-v2',
      label: 'Test fundus modeli',
      modalities: ['FUNDUS'],
      model: { id: 't', name: 't', version: '0.1.0', kind: 'learned', local: true },
      capabilities: [{ key: 'disc', label: 'Optik disk', implemented: true }],
      analyze: () => ({ adapterId: 'fundus-v2', modality: 'FUNDUS', status: 'PARTIAL', model: { id: 't', name: 't', version: '0.1.0', kind: 'learned', local: true }, capabilities: [], observations: [], limitations: [], summary: '' }),
    });
    expect(r.forModality('FUNDUS').id).toBe('fundus-v2');
    expect(r.forModality('MRI').id).toBe('cross-sectional-symmetry');
  });

  it('destek tablosu uygulanan ve eksik yetenekleri ayırır', () => {
    const s = defaultRegistry().support();
    const ecg = s.find((x) => x.modality === 'ECG')!;
    expect(ecg.implemented.length).toBeGreaterThan(0);
    expect(ecg.missing).toContain('QT / QTc');
    expect(s.find((x) => x.modality === 'MAMMOGRAPHY')!.implemented).toHaveLength(0);
  });
});

describe('bilgi grafiği bağlantısı', () => {
  it('gözlem yolu grafikte geçerli düğümlere bağlanır', () => {
    for (const id of ['brain', 'brain.hemisphere-right', 'brain.frontal']) expect(GRAPH.node(id)).toBeDefined();
  });
});
