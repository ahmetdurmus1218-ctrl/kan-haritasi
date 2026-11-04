/**
 * GERÇEK eğitilmiş model, GERÇEK görüntüler: uygulamaya gömülü beyin MR örüntü modeli (kh-brain-mri-pattern)
 * cihaz içi motorla (ONNX Runtime Web, WASM) çalıştırılır.
 *
 *  - TS ↔ Python eşdeğerliği: hasta bazlı TEST kümesinden (eğitimde görülmemiş) her örüntüden bir gerçek kesit;
 *    uygulamadaki ön işleme (kesit ayırma, kafa kutusu, kare kırpma, yüzdelik normalizasyon) Python eşiyle aynı
 *    olasılıkları verir (fixtures/imaging/beyin-mr-gercek/expected.json).
 *  - Telefonla çekilmiş film kolajı benzetimi: 4 kesit ayrılır, her biri ayrı değerlendirilir.
 *  - Eğitim dışı (OOD) kapısı: beyin MR'ı olmayan gerçek görüntülerde (göğüs röntgeni, belge fotoğrafı) örüntü
 *    söylenmez; kapıyı geçebilen çizim fantomlarda bulgu eşiği (%70) aşılmaz.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { LocalModelProvider, type ModelManifest, type RasterImage, rasterFromRgba, validateManifest } from '@kh/analysis';
import { ortEngineFactory } from '../lib/localModels/engine';

const ROOT = resolve(__dirname, '../../../..');
const DIR = resolve(ROOT, 'apps/web/public/ai-models/kh-brain-mri-pattern');
const FIX = resolve(ROOT, 'fixtures/imaging/beyin-mr-gercek');
const IMG = resolve(ROOT, 'fixtures/imaging');

const v = validateManifest(JSON.parse(readFileSync(resolve(DIR, 'manifest.json'), 'utf8')));
if (!v.ok) throw new Error(v.errors.join('; '));
const manifest: ModelManifest = v.manifest;
const bytes = new Uint8Array(readFileSync(resolve(DIR, manifest.file)));
const expected = JSON.parse(readFileSync(resolve(FIX, 'expected.json'), 'utf8')) as {
  sha256: string;
  images: Record<string, { file: string; probs: number[]; ref: number; ood: number; gate: number }>;
};

async function raster(path: string): Promise<RasterImage> {
  const img = await loadImage(readFileSync(path));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height);
  return rasterFromRgba(new Uint8ClampedArray(d.data), img.width, img.height);
}

const provider = new LocalModelProvider(manifest, async () => bytes, ortEngineFactory());

async function analyze(path: string) {
  const r = await provider.detectFindings({ images: [await raster(path)], modality: 'MRI', context: {} });
  if (r.status !== 'ok') throw new Error('model çalışmadı');
  return { findings: r.value, pattern: provider.lastExtras.pattern! };
}

describe('Beyin MR örüntü modeli (gerçek veriyle eğitildi) — gömülü model', () => {
  it('manifest: pattern-2d, SHA-256 dosyayla aynı, hasta bazlı test başarımı ve veri kaynakları yazılı', () => {
    expect(manifest.task).toBe('pattern-2d');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
    expect(expected.sha256).toBe(manifest.sha256);
    const m = manifest.pattern!.metrics!;
    expect(m.patients.test).toBeGreaterThan(100);
    expect(m.test.abnormal_auc).toBeGreaterThan(0.85);
    expect(manifest.pattern!.data!.length).toBeGreaterThanOrEqual(5);
    expect(manifest.limitations.join(' ')).toMatch(/TANIMAZ/);
  });

  it('TS ↔ Python: her örüntüden bir gerçek test kesitinde olasılıklar aynı (±0,05)', async () => {
    for (const [cls, e] of Object.entries(expected.images)) {
      const { pattern } = await analyze(resolve(FIX, e.file));
      const p = pattern.panels[0]!;
      const got = manifest.labels.map((l) => p.probs.find((x) => x.key === l.key)!.p);
      for (let i = 0; i < got.length; i++) expect(Math.abs(got[i]! - e.probs[i]!), `${cls} sınıf ${i}: ${got} ↔ ${e.probs}`).toBeLessThan(0.05);
      expect(p.ood).toBe(e.ood > manifest.pattern!.oodThreshold || e.gate > manifest.pattern!.gateThreshold!);
      expect(p.ood, `${cls}: gerçek beyin MR kesiti eğitim dışı sayılmamalı`).toBe(false);
      expect(Math.abs(p.gate! - e.gate)).toBeLessThan(0.05);
      expect(Math.abs(p.refDistance - e.ref) / Math.max(1, e.ref)).toBeLessThan(0.1);
    }
  }, 120_000);

  it('Telefonla çekilmiş film kolajı: 4 kesit ayrılır; her biri ayrı değerlendirilir, eğitim dışı sayılmaz', async () => {
    const { pattern } = await analyze(resolve(FIX, 'kolaj-foto.jpg'));
    expect(pattern.panels.length).toBe(4);
    const ood = pattern.panels.filter((p) => p.ood).length;
    console.log(JSON.stringify(pattern.panels.map((p) => ({ panel: p.panel, top: p.probs[0], ref: p.refPercentile, ood: p.ood }))));
    expect(ood).toBeLessThanOrEqual(1);
    expect(pattern.lead).toBeDefined();
  }, 120_000);

  it('Eğitim dışı kapısı: gerçek beyin MR dışı görüntülerde (göğüs röntgeni, BT rapor fotoğrafı, tahlil kâğıdı, e-Nabız ekranı, MR baskısı kolajı) örüntü söylenmez', async () => {
    for (const f of ['nih-cxr-00000001_000.png', 'toraks-bt-raporu-foto.png', '../reports/hemogram-foto.jpg', '../reports/enabiz-ekran.png', 'mr-kolaj-foto.jpg']) {
      const { findings, pattern } = await analyze(resolve(IMG, f));
      expect(pattern.panels.every((p) => p.ood), f).toBe(true);
      expect(findings, f).toEqual([]);
    }
  }, 120_000);

  it('Çizim fantomlar (sentetik röntgen filmi, MR ekranı çizimi): kapıyı geçse bile bulgu eşiğinin (%70) altında kalır — bulgu yok', async () => {
    // Bilinen sınır (manifest.limitations): çizimler kapıyı her zaman geçemez; bu yüzden bulgu eşiği yüksek tutuldu.
    for (const f of ['rontgen-film-foto.jpg', 'mr-ekran-foto.jpg']) {
      const { findings, pattern } = await analyze(resolve(IMG, f));
      expect(findings, f).toEqual([]);
      for (const p of pattern.panels) if (!p.ood && p.probs[0]!.key !== 'normal') expect(p.probs[0]!.p, f).toBeLessThan(manifest.scoreThreshold);
    }
  }, 120_000);

  it('Bulgu eşiği ve test başarımı manifestte yazılı (kullanıcıya gösterilir)', () => {
    const f = manifest.pattern!.metrics!.finding!;
    expect(f.threshold).toBe(manifest.scoreThreshold);
    expect(f.lesionReported).toBeGreaterThan(0.7);
    expect(f.normalFalse).toBeLessThan(0.15);
    expect(manifest.pattern!.metrics!.gate!.brainPass).toBeGreaterThan(0.95);
  });
});
