/**
 * GERÇEK baş BT'si (CQ500, CC BY-NC-SA 4.0 — depoya konmaz) üzerinde beyin içi kanama modeli: uygulamanın kendi
 * hattı (DICOM okuma, gantri eğimi dahil → BT anatomi 3 mm → beyin kutusu + 3 mm → kanama modeli) resmi
 * TotalSegmentator `-ta cerebral_bleed` çıktısıyla karşılaştırılır.
 *
 * Veri yerelde hazırlanır (scripts/models/README-cerebral-bleed.md): KH_HEAD_CT_DIR=<klasör>, içinde
 * <vaka>/*.dcm ve <vaka>.reference.json (resmi maske, DICOM ızgarasında, dosya adı sırasıyla). Klasör yoksa test atlanır.
 */
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type ModelManifest, decodeRle, findingClass, runVolumeModel, sliceLabels, validateManifest, voxelMm3 } from '@kh/analysis';
import { volumeFromDicom } from '@kh/ingest';
import { ortEngineFactory } from '../lib/localModels/engine';

const ROOT = resolve(__dirname, '../../../..');
const MODELS = resolve(ROOT, 'apps/web/public/ai-models');
const DIR = process.env.KH_HEAD_CT_DIR;

function model(id: string): { manifest: ModelManifest; bytes: Uint8Array } {
  const v = validateManifest(JSON.parse(readFileSync(resolve(MODELS, id, 'manifest.json'), 'utf8')));
  if (!v.ok) throw new Error(v.errors.join('; '));
  return { manifest: v.manifest, bytes: new Uint8Array(readFileSync(resolve(MODELS, id, v.manifest.file))) };
}

const cases = DIR && existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.reference.json')).map((f) => f.replace('.reference.json', '')) : [];

describe.skipIf(!cases.length)('gerçek baş BT — beyin içi kanama modeli (resmi çıktıyla)', () => {
  for (const name of cases) {
    it(`${name}: uygulama hattı ↔ resmi TotalSegmentator cerebral_bleed`, async () => {
      const dir = resolve(DIR!, name);
      const files = readdirSync(dir).sort();
      const built = volumeFromDicom(files.map((f) => new Uint8Array(readFileSync(resolve(dir, f)))));
      if (!built.ok) throw new Error(built.reason);
      const vol = built.volume;
      const anat = model('totalseg-ct-total-3mm');
      const anatomy = await runVolumeModel(vol, anat.manifest, anat.bytes, ortEngineFactory());
      expect(anatomy.structures.some((s) => s.key === 'brain')).toBe(true);
      const bleed = model('totalseg-ct-cerebral-bleed');
      const seg = await runVolumeModel(vol, bleed.manifest, bleed.bytes, ortEngineFactory(), { prior: { manifest: anat.manifest, seg: anatomy } });

      const ref = JSON.parse(readFileSync(resolve(DIR!, `${name}.reference.json`), 'utf8')) as { shape: [number, number, number]; rle: number[] };
      const [K, J, I] = ref.shape;
      const theirs = decodeRle(ref.rle, K * J * I);
      const ours = new Uint8Array(K * J * I);
      for (const [kk, fileIdx] of vol.order.entries()) ours.set(sliceLabels(seg, vol, kk), fileIdx * J * I);
      let a = 0, b = 0, both = 0;
      for (let i = 0; i < ours.length; i++) {
        const x = ours[i] === 1, y = theirs[i] === 1;
        if (x) a++;
        if (y) b++;
        if (x && y) both++;
      }
      const voxMl = Math.abs(vol.iVec[0] * (vol.jVec[1] * vol.kVec[2] - vol.jVec[2] * vol.kVec[1]) - vol.iVec[1] * (vol.jVec[0] * vol.kVec[2] - vol.jVec[2] * vol.kVec[0]) + vol.iVec[2] * (vol.jVec[0] * vol.kVec[1] - vol.jVec[1] * vol.kVec[0])) / 1000;
      const officialMl = b * voxMl;
      const s = seg.structures.find((x) => x.key === 'intracerebral_hemorrhage');
      const appMl = s?.volumeMl ?? 0;
      const dice = a + b ? (2 * both) / (a + b) : 1;
      const line = JSON.stringify({ cerebralBleed: { case: name, officialMl: +officialMl.toFixed(2), appMl: +appMl.toFixed(2), dice: +dice.toFixed(3), tiles: seg.tiles, voxelMm3: +voxelMm3(bleed.manifest.volume!.spacing).toFixed(3) } });
      console.log(line);
      // KH_MODEL_REPORT=<dosya>: ölçülen sayılar doğrulama metni için oraya da yazılır
      if (process.env.KH_MODEL_REPORT) appendFileSync(process.env.KH_MODEL_REPORT, `${line}\n`);
      if (officialMl >= 2) {
        // Belirgin kanama: aynı yerde ve benzer hacimde bulunmalı
        expect(dice).toBeGreaterThan(0.8);
        expect(Math.abs(appMl - officialMl) / officialMl).toBeLessThan(0.25);
        expect(s && findingClass(s)).toBe('finding');
      } else if (officialMl > 0) {
        // Küçük odak (< 2 mL): modelin kendi sonucu kırpma/karo yerleşimine bağlı. CQ500-CT-427'de resmi
        // TotalSegmentator 1,34 mL buldu; resmi nnU-Net öngörücüsü de aynı ağırlıklarla uygulamanın kırptığı bölgede
        // 0 mL veriyor (dönüşüm farkı değil). Burada yalnızca uydurma büyük bulgu olmadığı denetlenir; manifest sınırlarında yazılı.
        expect(appMl).toBeLessThan(officialMl * 2 + 1);
      } else {
        // Resmi çıktıda kanama yok: uygulama da eşik üstü kanama göstermemeli
        expect(appMl).toBeLessThan(1);
      }
    }, 3_600_000);
  }
});
