/**
 * GERÇEK modeller, GERÇEK görüntüler: uygulamaya gömülü ONNX modelleri (TotalSegmentator BT/MR, TorchXRayVision NIH)
 * cihaz içi motorla (ONNX Runtime Web, WASM) çalıştırılır ve sonuç, aynı ağırlıklarla üretilmiş RESMİ çıktıyla
 * karşılaştırılır:
 *  - BT/MR: fixtures/imaging/totalseg-*-sm (TotalSegmentator örnek görüntüleri, DICOM'a çevrilmiş) ↔ resmi
 *    `TotalSegmentator --fast --ml` etiket haritası (fixtures/*.reference.json) — voksel uyumu ve Dice.
 *  - Röntgen: NIH ChestX-ray14 örneği ↔ TorchXRayVision'ın kendi (Python) skorları.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { type ModelManifest, cardiothoracicRatio, decodeRle, multilabelScores, preprocess, rasterFromRgba, runVolumeModel, sliceLabels, validateManifest } from '@kh/analysis';
import { volumeFromDicom } from '@kh/ingest';
import { ortEngineFactory } from '../lib/localModels/engine';

const ROOT = resolve(__dirname, '../../../..');
const MODELS = resolve(ROOT, 'apps/web/public/ai-models');
const IMG = resolve(ROOT, 'fixtures/imaging');

function model(id: string): { manifest: ModelManifest; bytes: Uint8Array } {
  const v = validateManifest(JSON.parse(readFileSync(resolve(MODELS, id, 'manifest.json'), 'utf8')));
  if (!v.ok) throw new Error(v.errors.join('; '));
  return { manifest: v.manifest, bytes: new Uint8Array(readFileSync(resolve(MODELS, id, v.manifest.file))) };
}

function series(dir: string): Uint8Array[] {
  return readdirSync(resolve(IMG, dir))
    .sort()
    .map((f) => new Uint8Array(readFileSync(resolve(IMG, dir, f))));
}

async function compareVolume(modelId: string, dir: string) {
  const { manifest, bytes } = model(modelId);
  const built = volumeFromDicom(series(dir));
  if (!built.ok) throw new Error(built.reason);
  const vol = built.volume;
  const progress: string[] = [];
  const seg = await runVolumeModel(vol, manifest, bytes, ortEngineFactory(), { onProgress: (p) => progress.push(p.stage) });
  const ref = JSON.parse(readFileSync(resolve(IMG, `${dir}.reference.json`), 'utf8')) as { shape: [number, number, number]; rle: number[] };
  const [K, J, I] = ref.shape;
  const refLabels = decodeRle(ref.rle, K * J * I);
  // Fikstür dosyaları IM0001.. = NIfTI k = 0..; hacim sırası `order` ile eşlenir.
  const ours = new Uint8Array(K * J * I);
  for (const [kk, fileIdx] of vol.order.entries()) ours.set(sliceLabels(seg, vol, kk), fileIdx * J * I);
  let same = 0;
  const inter = new Map<number, number>();
  const a = new Map<number, number>();
  const b = new Map<number, number>();
  for (let i = 0; i < ours.length; i++) {
    const x = ours[i]!;
    const y = refLabels[i]!;
    if (x === y) same++;
    if (x) a.set(x, (a.get(x) ?? 0) + 1);
    if (y) b.set(y, (b.get(y) ?? 0) + 1);
    if (x && x === y) inter.set(x, (inter.get(x) ?? 0) + 1);
  }
  const dice = [...b.keys()].map((l) => (2 * (inter.get(l) ?? 0)) / ((a.get(l) ?? 0) + b.get(l)!));
  return { seg, vol, manifest, agreement: same / ours.length, meanDice: dice.reduce((s, d) => s + d, 0) / dice.length, minDice: Math.min(...dice), classes: dice.length, progress };
}

describe('gerçek yerel modeller (cihaz içi motor) — resmi çıktıyla karşılaştırma', () => {
  it('BT: TotalSegmentator total (3 mm) — resmi --fast çıktısıyla aynı', async () => {
    const r = await compareVolume('totalseg-ct-total-3mm', 'totalseg-ct-sm');
    expect(r.classes).toBeGreaterThan(30);
    expect(r.agreement).toBeGreaterThan(0.995);
    expect(r.meanDice).toBeGreaterThan(0.98);
    expect(r.progress).toContain('inference');
    const liver = r.seg.structures.find((s) => s.key === 'liver')!;
    expect(liver).toMatchObject({ name: 'Karaciğer', structure: 'liver', node: 'liver', kind: 'anatomy' });
    expect(liver.volumeMl).toBeGreaterThan(100);
    expect(liver.sliceRange[0]).toBeLessThanOrEqual(liver.centroidSlice);
    expect(liver.sliceRange[1]).toBeGreaterThanOrEqual(liver.centroidSlice);
    // Karaciğer hastanın sağında (LPS'de x < 0), dalak solunda (x > 0)
    const spleen = r.seg.structures.find((s) => s.key === 'spleen')!;
    expect(liver.centroid[0]).toBeLessThan(spleen.centroid[0]);
    console.log(JSON.stringify({ ct: { agreement: r.agreement, meanDice: r.meanDice, minDice: r.minDice, classes: r.classes, tiles: r.seg.tiles } }));
  }, 600_000);

  it('MR: TotalSegmentator total_mr (3 mm) — resmi --fast çıktısıyla aynı', async () => {
    const r = await compareVolume('totalseg-mr-total-3mm', 'totalseg-mr-sm');
    expect(r.classes).toBeGreaterThan(15);
    expect(r.agreement).toBeGreaterThan(0.995);
    expect(r.meanDice).toBeGreaterThan(0.98);
    console.log(JSON.stringify({ mr: { agreement: r.agreement, meanDice: r.meanDice, minDice: r.minDice, classes: r.classes } }));
  }, 600_000);

  it('Röntgen: TorchXRayVision NIH sınıflandırıcı — kütüphanenin kendi skorlarıyla aynı', async () => {
    const { manifest, bytes } = model('xrv-densenet121-nih');
    const img = await loadImage(readFileSync(resolve(IMG, 'nih-cxr-00000001_000.png')));
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height);
    const raster = rasterFromRgba(new Uint8ClampedArray(d.data), img.width, img.height);
    const engine = await ortEngineFactory()(bytes, manifest);
    const out = await engine.run({ [manifest.input.name]: preprocess(raster, manifest) });
    engine.dispose();
    const scores = multilabelScores(out, manifest);
    // TorchXRayVision (Python, aynı görüntü): Kardiyomegali 0,667 en yüksek; efüzyon 0,566; pnömotoraks 0,172
    const py: Record<string, number> = { Atelectasis: 0.523, Consolidation: 0.502, Infiltration: 0.506, Pneumothorax: 0.172, Edema: 0.502, Emphysema: 0.511, Fibrosis: 0.525, Effusion: 0.566, Pneumonia: 0.501, Pleural_Thickening: 0.516, Cardiomegaly: 0.667, Nodule: 0.518, Mass: 0.532, Hernia: 0.503 };
    for (const s of scores) expect(Math.abs(s.score - py[s.key]!), s.key).toBeLessThan(0.03);
    expect(scores[0]!.key).toBe('Cardiomegaly');
    expect(cardiothoracicRatio(out, manifest)).toBeUndefined(); // sınıflandırıcıda maske yok
  }, 120_000);
});
