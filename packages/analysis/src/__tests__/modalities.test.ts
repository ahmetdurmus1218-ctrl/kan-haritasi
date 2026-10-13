/**
 * Modalite başına dürüstlük: MR, BT, röntgen, ultrason, patoloji, EKG ve endoskopi görüntüleri için
 * kurulu model yokken sonuç "ön inceleme" ya da "model yok" olur — asla "tıbbi AI modeli". Hiçbir
 * modalitede lezyon/tümör/kitle gibi bulgu üretilmez; her gözlem kural tabanlı kökenlidir.
 */
import { describe, expect, it } from 'vitest';
import { analyzeImage } from '../pipeline';
import { rasterFromRgba } from '../image';
import { analysisState, capabilitiesFor } from '../localModel';
import { runMedicalImageModel } from '../medicalAI';
import { type Modality, provenanceOf } from '../types';
import { ecgImage, grayToRgba, headSlice, pathologyImage, ultrasoundImage } from './synthetic';

const raster = (r: { rgba: Uint8ClampedArray; width: number; height: number }) => rasterFromRgba(r.rgba, r.width, r.height);
const head = raster(grayToRgba(headSlice(240, 288, { x: 74, y: 100, r: 16, v: 245 }), 240, 288));
/** Endoskopi benzeri: pembe-kırmızı mukoza, ortada koyu lümen (renkli, dairesel). */
function endoscopyLike() {
  const w = 320;
  const h = 320;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2, y - h / 2);
      const i = (y * w + x) * 4;
      const inside = d < 150;
      const lumen = d < 40;
      rgba.set(inside ? (lumen ? [40, 10, 10, 255] : [200 - d / 3, 90 + ((x * 7 + y * 3) % 30), 80, 255]) : [0, 0, 0, 255], i);
    }
  return { rgba, width: w, height: h };
}
/** Röntgen benzeri: geniş gri gövde, açık kemik çizgileri. */
function xrayLike() {
  const w = 300;
  const h = 360;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const body = Math.abs(x - w / 2) < 120 ? 90 : 10;
      const rib = Math.abs(x - w / 2) < 110 && Math.abs(x - w / 2) > 20 && y % 40 < 6 ? 120 : 0;
      const spine = Math.abs(x - w / 2) < 12 ? 140 : 0;
      const v = Math.min(255, body + rib + spine);
      rgba.set([v, v, v, 255], (y * w + x) * 4);
    }
  return { rgba, width: w, height: h };
}

const CASES: Array<{ modality: Modality; category: string; image: ReturnType<typeof raster> }> = [
  { modality: 'MRI', category: 'mr', image: head },
  { modality: 'CT', category: 'ct', image: head },
  { modality: 'XRAY', category: 'xray', image: raster(xrayLike()) },
  { modality: 'ULTRASOUND', category: 'us', image: raster(ultrasoundImage()) },
  { modality: 'PATHOLOGY', category: 'pathology', image: raster(pathologyImage()) },
  { modality: 'ECG', category: 'ekg', image: raster(ecgImage()) },
  { modality: 'ENDOSCOPY', category: 'endoscopy', image: raster(endoscopyLike()) },
];

describe('modalite başına üç durum (kurulu model yok)', () => {
  for (const c of CASES)
    it(`${c.modality}: ön inceleme ya da "model yok" — tıbbi model iddiası yok, lezyon üretilmez`, async () => {
      const run = analyzeImage(c.image, { declaredCategory: c.category, fileName: `goruntu-${c.category}.jpg` });
      const state = analysisState({ modelRan: false, precheckRan: run.result.status !== 'UNAVAILABLE' });
      expect(state).not.toBe('model');
      expect(run.kind).toBe('precheck');
      expect(run.modelFindings).toBeUndefined();
      expect(run.result.model.kind).toBe('heuristic');
      for (const o of run.result.observations) {
        expect(provenanceOf(o).derivation, o.text).toBe('heuristic-derived');
        expect(o.text.toLowerCase(), o.text).not.toMatch(/lezyon (var|izlendi|tespit)|tümör|kitle|kanser|malign/);
      }
      const model = await runMedicalImageModel({ images: [c.image], modality: c.modality, context: {} });
      expect(model.status).toBe('unavailable');
      const cap = capabilitiesFor(c.modality).find((x) => x.key === 'local-model')!;
      expect(cap).toMatchObject({ supported: false, reason: 'Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.' });
      // Ön inceleme varsa yeteneklerde açıkça "tıbbi model değil" / ölçüm olarak adlandırılır.
      const pre = capabilitiesFor(c.modality).find((x) => x.key === 'precheck')!;
      expect(pre.supported).toBe(state === 'precheck');
    });

  it('beklenen durumlar: MR/BT/USG/patoloji/EKG ön inceleme; röntgen ve endoskopi için ön inceleme algoritması yok', () => {
    const states = Object.fromEntries(CASES.map((c) => [c.modality, analysisState({ modelRan: false, precheckRan: analyzeImage(c.image, { declaredCategory: c.category }).result.status !== 'UNAVAILABLE' })]));
    expect(states).toEqual({ MRI: 'precheck', CT: 'precheck', XRAY: 'none', ULTRASOUND: 'precheck', PATHOLOGY: 'precheck', ECG: 'precheck', ENDOSCOPY: 'none' });
  });
});
