import { describe, expect, it } from 'vitest';
import { type EngineFactory, LocalModelProvider, type ModelManifest, type Tensor, capabilitiesFor, validateManifest } from '../localModel';
import { enforceLocalization } from '../medicalAI';
import { PATTERN_SIZE, headBox, patternPanels, patternTensor, refPercentile, squareAround } from '../patternModel';
import type { RasterImage } from '../types';

const manifest = (over: Partial<ModelManifest> = {}): ModelManifest => ({
  schema: 'kh-model-manifest/2',
  id: 'test-pattern',
  name: 'Test örüntü modeli',
  version: '1.0.0',
  modalities: ['MRI'],
  task: 'pattern-2d',
  format: 'onnx',
  file: 'model.onnx',
  sha256: 'b'.repeat(64),
  license: 'test',
  source: 'test',
  intendedUse: 'yalnızca test',
  input: { name: 'input', layout: 'NCHW', channels: 1, width: 160, height: 160, scale: 1, mean: [0], std: [1] },
  output: { logits: 'logits', mask: 'mask', refDist: 'ref', oodDist: 'ood' },
  pattern: { refQuantiles: [[0, 0.1], [50, 1], [90, 2], [99, 4], [100, 8]], oodThreshold: 5, maskThreshold: 0.5, maxPanels: 8, regions: ['brain'] },
  labels: [
    { id: 0, key: 'normal', finding: 'Sağlıklı referansa benzer' },
    { id: 1, key: 'glial_tumor', finding: 'Beyin içi kitle örüntüsü', structure: 'brain', node: 'brain' },
    { id: 2, key: 'cpa_tumor', finding: 'İç kulak yolu kitlesi örüntüsü', structure: 'brain' },
    { id: 3, key: 'chronic_lesion', finding: 'Kronik doku kaybı örüntüsü', structure: 'brain' },
  ],
  scoreThreshold: 0.5,
  limitations: ['Test.'],
  ...over,
});

/** Karanlık zemin üzerinde parlak elips ("kafa"); `bright` bölgesi daha parlak (lezyon gibi). */
function head(W: number, H: number, cx: number, cy: number, rx: number, ry: number, gray = new Float32Array(W * H).fill(8)): Float32Array {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) gray[y * W + x] = 120 + ((x * 7 + y * 3) % 17);
  return gray;
}

function raster(W: number, H: number, gray: Float32Array): RasterImage {
  return { width: W, height: H, gray };
}

/** Sahte motor: girdinin ortalamasına göre sınıf, sabit bir lezyon lekesi, verilen ref/ood. */
function fakeEngine(opts: { cls: number; ref: number; ood: number }): EngineFactory {
  return async () => ({
    run: async (feeds: Record<string, Tensor>) => {
      const x = feeds.input!;
      expect(x.dims).toEqual([1, 1, PATTERN_SIZE, PATTERN_SIZE]);
      const logits = new Float32Array(4).fill(-2);
      logits[opts.cls] = 3;
      const mask = new Float32Array(40 * 40);
      for (let y = 15; y < 22; y++) for (let x2 = 18; x2 < 26; x2++) mask[y * 40 + x2] = opts.cls ? 0.9 : 0.1;
      return { logits: { data: logits, dims: [1, 4] }, mask: { data: mask, dims: [1, 1, 40, 40] }, ref: { data: new Float32Array([opts.ref]), dims: [1] }, ood: { data: new Float32Array([opts.ood]), dims: [1] } };
    },
    dispose: () => undefined,
  });
}

describe('Örüntü modeli (pattern-2d): manifest ve ön işleme', () => {
  it('manifest doğrulaması: çıktılar, kalibrasyon ve "normal" etiketi zorunlu', () => {
    expect(validateManifest(manifest()).ok).toBe(true);
    const bad = validateManifest(manifest({ output: { logits: 'logits', mask: 'mask' }, pattern: undefined, labels: [{ id: 0, key: 'x', finding: 'x' }] }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join(' ')).toMatch(/refDist.*oodDist[\s\S]*refQuantiles[\s\S]*normal/);
  });

  it('kafa kutusu ve kare kırpma; tensör 160×160, %1–%99,5 yüzdelikle 0–1', () => {
    const W = 300;
    const H = 260;
    const g = head(W, H, 150, 130, 80, 100);
    const b = headBox(g, W, { x: 0, y: 0, w: W, h: H });
    expect(Math.abs(b.x - 70)).toBeLessThan(6);
    expect(Math.abs(b.w - 161)).toBeLessThan(10);
    const sq = squareAround(b);
    expect(sq.w).toBeCloseTo(sq.h);
    expect(sq.w).toBeGreaterThan(Math.max(b.w, b.h));
    const t = patternTensor(g, W, H, sq);
    expect(t.dims).toEqual([1, 1, 160, 160]);
    const d = t.data as Float32Array;
    expect(Math.min(...d)).toBe(0);
    expect(Math.max(...d)).toBe(1);
  });

  it('kolaj fotoğrafı kesitlere ayrılır (2 kesit)', () => {
    const W = 420;
    const H = 200;
    const g = new Float32Array(W * H).fill(0);
    head(W, H, 100, 100, 70, 85, g);
    head(W, H, 320, 100, 70, 85, g);
    const { boxes } = patternPanels(raster(W, H, g), 8);
    expect(boxes.length).toBe(2);
    expect(boxes[0]!.x + boxes[0]!.w).toBeLessThan(boxes[1]!.x + 5);
  });

  it('sağlıklı referans yüzdeliği ara değerle; uçlarda kırpılır', () => {
    const q: Array<[number, number]> = [[0, 0.1], [50, 1], [90, 2], [100, 8]];
    expect(refPercentile(1.5, q)).toBeCloseTo(70);
    expect(refPercentile(0, q)).toBe(0);
    expect(refPercentile(99, q)).toBe(100);
  });

  it('maskesiz piksel konumu örüntü görevinde kaldırılır (sahte konum yok)', () => {
    const f = enforceLocalization('pattern-2d', { localization: { kind: 'pixel', frame: 0, box: { x: 0, y: 0, w: 5, h: 5 }, imageSize: { width: 10, height: 10 } } });
    expect(f.localization.kind).toBe('region-only');
  });
});

describe('Örüntü modeli: sağlayıcı (sahte motorla uçtan uca)', () => {
  const img = raster(300, 260, head(300, 260, 150, 130, 80, 100));

  it('lezyon örüntüsü: bulgu, katkı haritası (piksel maskesi), sağlıklı referans yüzdeliği ve kesit bilgisi', async () => {
    const p = new LocalModelProvider(manifest(), async () => new Uint8Array(1), fakeEngine({ cls: 1, ref: 3, ood: 1 }));
    const r = await p.detectFindings({ images: [img], modality: 'MRI', context: {} });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.length).toBe(1);
    const f = r.value[0]!;
    expect(f.finding).toMatch(/Beyin içi kitle örüntüsü — kesit 1/);
    expect(f.localization.kind).toBe('pixel');
    if (f.localization.kind === 'pixel') {
      expect(f.localization.mask?.width).toBe(64);
      // Leke kafa kutusunun içinde
      expect(f.localization.box.x).toBeGreaterThan(60);
      expect(f.localization.box.x + f.localization.box.w).toBeLessThan(250);
    }
    const lead = p.lastExtras.pattern!.lead!;
    expect(lead.probs[0]!.key).toBe('glial_tumor');
    expect(lead.ood).toBe(false);
    expect(lead.refPercentile).toBeGreaterThan(90);
    expect(lead.refPercentile).toBeLessThan(99);
  });

  it('eğitim dağılımı dışı görüntüde örüntü söylenmez', async () => {
    const p = new LocalModelProvider(manifest(), async () => new Uint8Array(1), fakeEngine({ cls: 1, ref: 7, ood: 9 }));
    const r = await p.detectFindings({ images: [img], modality: 'MRI', context: {} });
    expect(r.status === 'ok' && r.value.length).toBe(0);
    expect(p.lastExtras.pattern!.panels.every((x) => x.ood)).toBe(true);
    expect(p.lastExtras.pattern!.lead).toBeUndefined();
  });

  it('sağlıklı referansa benzer kesit bulgu üretmez; yetenek kaydı modeli "örüntü benzerliği" diye anlatır', async () => {
    const p = new LocalModelProvider(manifest(), async () => new Uint8Array(1), fakeEngine({ cls: 0, ref: 0.5, ood: 1 }));
    const r = await p.detectFindings({ images: [img], modality: 'MRI', context: {} });
    expect(r.status === 'ok' && r.value.length).toBe(0);
    expect(p.lastExtras.pattern!.lead!.probs[0]!.key).toBe('normal');
    const caps = capabilitiesFor('MRI', [manifest()]);
    expect(caps.find((c) => c.key === 'local-model')!.reason).toMatch(/örüntü benzerliği/);
    expect(caps.find((c) => c.key === 'localization')!.supported).toBe(true);
  });
});
