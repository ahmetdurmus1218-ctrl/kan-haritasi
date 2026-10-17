/**
 * İsteğe bağlı paket: DepthPolyp (kolonoskopi polip bölütleme). Paket dosyası depoya konmaz; yerelde
 * `python scripts/models/build_models.py <iş> --packs model-packs --only depthpolyp …` ile üretilir.
 * KH_DEPTHPOLYP_SAMPLES=<klasör>: içinde <ad>.jpg ve yazarın resmi çıkarım betiğinin maskesi <ad>.mask.png
 * (DepthPolyp deposundaki samples/kvasir). Paket ya da örnekler yoksa test atlanır.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { LocalModelProvider, type ModelManifest, rasterFromRgba, validateManifest } from '@kh/analysis';
import { ortEngineFactory } from '../lib/localModels/engine';

const ROOT = resolve(__dirname, '../../../..');
const PACK = resolve(ROOT, 'model-packs/depthpolyp-kvasir');
const SAMPLES = process.env.KH_DEPTHPOLYP_SAMPLES;
const ready = existsSync(resolve(PACK, 'manifest.json')) && !!SAMPLES && existsSync(SAMPLES);

async function rgba(path: string) {
  const img = await loadImage(readFileSync(path));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, img.width, img.height).data) };
}

describe.skipIf(!ready)('isteğe bağlı paket — DepthPolyp polip bölütleme (resmi maskeyle)', () => {
  it('uygulamanın 2B hattı (ön işleme → ONNX → maske → bulgu) yazarın resmi maskesiyle örtüşür', async () => {
    const v = validateManifest(JSON.parse(readFileSync(resolve(PACK, 'manifest.json'), 'utf8')));
    if (!v.ok) throw new Error(v.errors.join('; '));
    const manifest: ModelManifest = v.manifest;
    const bytes = new Uint8Array(readFileSync(resolve(PACK, manifest.file)));
    const provider = new LocalModelProvider(manifest, () => Promise.resolve(bytes), ortEngineFactory());
    for (const f of readdirSync(SAMPLES!).filter((x) => x.endsWith('.jpg'))) {
      const img = await rgba(resolve(SAMPLES!, f));
      const raster = rasterFromRgba(img.data, img.width, img.height);
      const out = await provider.detectFindings({ images: [raster], modality: 'COLONOSCOPY', context: {} });
      if (out.status !== 'ok') throw new Error(out.reason);
      const findings = out.value;
      expect(findings, f).toHaveLength(1);
      const loc = findings[0]!.localization;
      if (loc?.kind !== 'pixel' || !loc.mask) throw new Error('piksel maskesi bekleniyordu');
      // Resmi maskenin sınırlayıcı kutusu ile modelin kutusu örtüşmeli (IoU)
      const ref = await rgba(resolve(SAMPLES!, f.replace('.jpg', '.mask.png')));
      let x0 = ref.width, y0 = ref.height, x1 = -1, y1 = -1;
      for (let y = 0; y < ref.height; y++)
        for (let x = 0; x < ref.width; x++)
          if (ref.data[(y * ref.width + x) * 4]! > 127) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      const b = loc.box;
      const ix = Math.max(0, Math.min(x1 + 1, b.x + b.w) - Math.max(x0, b.x));
      const iy = Math.max(0, Math.min(y1 + 1, b.y + b.h) - Math.max(y0, b.y));
      const inter = ix * iy;
      const iou = inter / ((x1 - x0 + 1) * (y1 - y0 + 1) + b.w * b.h - inter);
      console.log(JSON.stringify({ depthpolyp: { sample: f, iou: +iou.toFixed(3), areaFraction: findings[0]!.areaFraction } }));
      expect(iou, f).toBeGreaterThan(0.9);
      expect(findings[0]!.structure).toBe('large-intestine');
    }
  }, 120_000);
});
