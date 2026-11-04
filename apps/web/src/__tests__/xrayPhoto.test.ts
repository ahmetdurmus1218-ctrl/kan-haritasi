/**
 * Röntgen fotoğrafı ve ekran görüntüsü: gömülü TorchXRayVision modeli (gerçek ONNX, cihaz içi motor) bilgisayar
 * görüntüleyicisi ekran görüntüsünde, telefonda dikey e-Nabız benzeri ekran görüntüsünde, ekranın telefonla
 * fotoğrafında ve negatoskoptaki filmin fotoğrafında (fixtures/imaging/rontgen-foto, benzetim; kaynak NIH örneği).
 *
 *  - Röntgen alanı bulma (xrayRegion) Python eşiyle (scripts/models/xray_photo) aynı kutuyu bulur.
 *  - Uygulamadaki tüm hat (alan → merkez kare → 224 → model) Python eşiyle aynı skorları verir.
 *  - Dijital röntgende alan bulma hiçbir şeyi değiştirmez (aynı skorlar).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { type ModelManifest, type RasterImage, multilabelScores, preprocess, rasterFromRgba, validateManifest, xrayFrame, xrayRegion } from '@kh/analysis';
import { ortEngineFactory } from '../lib/localModels/engine';

const ROOT = resolve(__dirname, '../../../..');
const DIR = resolve(ROOT, 'apps/web/public/ai-models/xrv-densenet121-nih');
const FIX = resolve(ROOT, 'fixtures/imaging/rontgen-foto');

const v = validateManifest(JSON.parse(readFileSync(resolve(DIR, 'manifest.json'), 'utf8')));
if (!v.ok) throw new Error(v.errors.join('; '));
const manifest: ModelManifest = v.manifest;
const plain: ModelManifest = { ...manifest, input: { ...manifest.input, region: undefined } };
const regional: ModelManifest = { ...manifest, input: { ...manifest.input, region: 'xray' } };
const bytes = new Uint8Array(readFileSync(resolve(DIR, manifest.file)));
const expected = JSON.parse(readFileSync(resolve(FIX, 'expected.json'), 'utf8')) as {
  keys: string[];
  original: number[];
  images: Record<string, { size: [number, number]; region: [number, number, number, number]; scoresA: number[]; scoresB: number[] }>;
};

async function raster(path: string): Promise<RasterImage> {
  const img = await loadImage(readFileSync(path));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height);
  return rasterFromRgba(new Uint8ClampedArray(d.data), img.width, img.height);
}

async function scores(r: RasterImage, m: ModelManifest): Promise<Record<string, number>> {
  const engine = await ortEngineFactory()(bytes, m);
  const out = await engine.run({ [m.input.name]: preprocess(r, m) });
  engine.dispose();
  return Object.fromEntries(multilabelScores(out, m).map((s) => [s.key, s.score]));
}

describe('Röntgen fotoğrafı / ekran görüntüsü — röntgen alanı ve gömülü model', () => {
  it('manifest: röntgen alanı açık (fotoğraf ve ekran görüntüsünde röntgene kırpılır)', () => {
    expect(manifest.input.region).toBe('xray');
    expect(manifest.input.crop).toBe('center-square');
  });

  it('röntgen alanı Python eşiyle aynı (en çok bir blok fark; JPEG çözücüleri farklı)', async () => {
    for (const [name, e] of Object.entries(expected.images)) {
      const r = await raster(resolve(FIX, name));
      expect([r.width, r.height], name).toEqual(e.size);
      const b = xrayRegion(r.gray, r.width, r.height);
      const B = Math.ceil(Math.max(r.width, r.height) / 128);
      const got = [b.x, b.y, b.w, b.h];
      for (let i = 0; i < 4; i++) expect(Math.abs(got[i]! - e.region[i]!), `${name} ${got} ↔ ${e.region}`).toBeLessThanOrEqual(B);
      // ekran/fotoğrafta röntgen alanı görüntünün küçük bir bölümüdür → kırpılır
      const f = xrayFrame(r.gray, r.width, r.height);
      expect(f.w * f.h, name).toBeLessThan(0.8 * r.width * r.height);
    }
  });

  it('tüm hat (alan → merkez kare → model) Python eşiyle aynı skorlar (±0,03); alan olmadan da (±0,03)', async () => {
    for (const [name, e] of Object.entries(expected.images)) {
      const r = await raster(resolve(FIX, name));
      const sb = await scores(r, regional);
      const sa = await scores(r, plain);
      expected.keys.forEach((k, i) => {
        expect(Math.abs(sb[k]! - e.scoresB[i]!), `${name} B ${k}`).toBeLessThan(0.03);
        expect(Math.abs(sa[k]! - e.scoresA[i]!), `${name} A ${k}`).toBeLessThan(0.03);
      });
    }
  }, 240_000);

  it('dijital röntgende alan bulma bir şey değiştirmez (aynı skorlar)', async () => {
    const r = await raster(resolve(ROOT, 'fixtures/imaging/nih-cxr-00000001_000.png'));
    const f = xrayFrame(r.gray, r.width, r.height);
    expect([f.x, f.y, f.w, f.h]).toEqual([0, 0, r.width, r.height]);
    const sb = await scores(r, regional);
    expected.keys.forEach((k, i) => expect(Math.abs(sb[k]! - expected.original[i]!), k).toBeLessThan(0.03));
  }, 120_000);
});
