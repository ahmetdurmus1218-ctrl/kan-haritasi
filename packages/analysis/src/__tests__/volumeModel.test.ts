/**
 * 3B hacim hattının birim testleri (sahte motor YALNIZCA testte): karo adımları, RLE, basamaklı kırpma,
 * yardımcı sınıfların silinmesi, kesit aralığının özgün seriye göre hesaplanması, bulgu eşikleri, manifest doğrulaması.
 * Gerçek modelle (resmi çıktıya karşı) doğrulama: apps/web/src/__tests__/realModels.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { type InferenceEngine, type ModelManifest, type Tensor, validateManifest } from '../localModel';
import { type SourceVolume, cascadeBox, cascadeInput, cropVolume, decodeRle, encodeRle, findingClass, rasGrid, roundHalfEven, segmentVolume, tileSteps } from '../volumeModel';

/** 1 mm izotropik, eksenleri LPS'ye hizalı kaynak hacim; değer fonksiyonu (i, j, k). */
function volume(n: [number, number, number], f: (i: number, j: number, k: number) => number): SourceVolume {
  const [cols, rows, slices] = n;
  const data = new Float32Array(cols * rows * slices);
  for (let k = 0, o = 0; k < slices; k++) for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++, o++) data[o] = f(i, j, k);
  return { cols, rows, slices, data, origin: [0, 0, 0], iVec: [1, 0, 0], jVec: [0, 1, 0], kVec: [0, 0, 1] };
}

const manifest = (over: Partial<NonNullable<ModelManifest['volume']>> = {}, labels: ModelManifest['labels'] = []): ModelManifest => ({
  schema: 'kh-model-manifest/2',
  id: 'test-3d',
  name: 'Test 3B',
  version: '1',
  modalities: ['CT'],
  task: 'segmentation-3d',
  format: 'onnx',
  file: 'model.onnx',
  sha256: 'a'.repeat(64),
  license: 'test',
  source: 'test',
  intendedUse: 'yalnızca test',
  input: { name: 'input', layout: 'NCDHW', channels: 1, width: 8, height: 8, scale: 1, mean: [0], std: [1] },
  output: { topkValues: 'topk_values', topkIndices: 'topk_indices' },
  volume: { spacing: 1, patch: [8, 8, 8], axisOrder: 'SAR', normalization: { scheme: 'ct', clip: [-1000, 1000], mean: 0, std: 1 }, tileStep: 0.8, topK: 2, cropNonzero: false, minSlices: 4, ...over },
  labels: labels.length ? labels : [
    { id: 1, key: 'bright', finding: 'Parlak', kind: 'finding' },
    { id: 2, key: 'aux', finding: 'Yardımcı', kind: 'anatomy' },
  ],
  scoreThreshold: 0.5,
  limitations: [],
});

/** Sahte motor (yalnızca test): girdi > 0 ise sınıf 1, değilse sınıf 2 (yardımcı); ikinci aday 0. */
const fakeEngine = (calls: number[][] = []): InferenceEngine => ({
  async run(feeds: Record<string, Tensor>) {
    const x = feeds.input!;
    calls.push([...x.dims]);
    const n = x.data.length;
    const v = new Float32Array(2 * n);
    const idx = new Int32Array(2 * n);
    for (let p = 0; p < n; p++) {
      const top = (x.data[p] as number) > 0 ? 1 : 2;
      v[p] = 5;
      idx[p] = top;
      v[n + p] = 1;
      idx[n + p] = 0;
    }
    return { topk_values: { data: v, dims: [1, 2, ...x.dims.slice(2)] }, topk_indices: { data: idx, dims: [1, 2, ...x.dims.slice(2)] } };
  },
  dispose() {},
});

describe('3B hacim hattı — temel adımlar', () => {
  it('karo adımları nnU-Net ile aynı; yarımlar çifte yuvarlanır', () => {
    expect(tileSteps(100, 128, 0.8)).toEqual([0]);
    expect(tileSteps(200, 128, 0.8)).toEqual([0, 72]);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
  });

  it('RLE gidiş-dönüş', () => {
    const a = Uint8Array.from([0, 0, 3, 3, 3, 0, 7]);
    expect(Array.from(decodeRle(encodeRle(a), a.length))).toEqual(Array.from(a));
  });

  it('bulgu eşikleri: eşik altı / fizyolojik sınırda / bulgu (veriyle)', () => {
    expect(findingClass({ kind: 'anatomy', volumeMl: 9 })).toBe('anatomy');
    expect(findingClass({ kind: 'finding', volumeMl: 0.3, minMl: 1 })).toBe('below');
    expect(findingClass({ kind: 'finding', volumeMl: 3, minMl: 1, normalMaxMl: 50 })).toBe('normal');
    expect(findingClass({ kind: 'finding', volumeMl: 120, minMl: 1, normalMaxMl: 50 })).toBe('finding');
    expect(findingClass({ kind: 'finding', volumeMl: 0.2 })).toBe('finding');
  });
});

describe('basamaklı (patoloji) model', () => {
  const vol = volume([20, 20, 20], (i, j, k) => (i >= 8 && i < 12 && j >= 8 && j < 12 && k >= 8 && k < 12 ? 100 : -100));
  // Önceki model: 2 mm ızgarada 7 numaralı yapı (ör. böbrek) i,j,k ≈ 8–11 mm
  const priorGrid = rasGrid(vol, 2);
  const priorLabels = new Uint8Array(priorGrid.shape[0] * priorGrid.shape[1] * priorGrid.shape[2]);
  const [S, A, R] = priorGrid.shape;
  for (let s = 0; s < S; s++)
    for (let a = 0; a < A; a++)
      for (let r = 0; r < R; r++) {
        // RAS → LPS: x = -(lo0 + 2r), y = -(lo1 + 2a), z = lo2 + 2s
        const x = -(priorGrid.lo[0] + 2 * r);
        const y = -(priorGrid.lo[1] + 2 * a);
        const z = priorGrid.lo[2] + 2 * s;
        if (x >= 8 && x <= 11 && y >= 8 && y <= 11 && z >= 8 && z <= 11) priorLabels[(s * A + a) * R + r] = 7;
      }
  const prior = { manifest: { labels: [{ id: 7, key: 'kidney_left', finding: 'Sol böbrek' }] }, seg: { grid: priorGrid, labels: priorLabels } };

  it('kırpma kutusu yapı + pay kadardır; özgün sınırlar aşılmaz', () => {
    const box = cascadeBox(vol, prior.seg, [7], 3)!;
    // yapı merkezleri 8..10 (2 mm adım), yarım adım (1 mm) yayılım ve 3 mm pay
    expect(box.i[0]).toBeLessThanOrEqual(5);
    expect(box.i[1]).toBeGreaterThanOrEqual(13);
    expect(box.i[1] - box.i[0]).toBeLessThan(20);
    const wide = cascadeBox(vol, prior.seg, [7], 200)!;
    expect(wide).toEqual({ i: [0, 20], j: [0, 20], k: [0, 20] });
    expect(cascadeBox(vol, prior.seg, [9], 3)).toBeNull();
  });

  it('kırpılmış hacmin kökeni kaydırılır, veri aynı noktadan gelir', () => {
    const c = cropVolume(vol, { i: [5, 15], j: [6, 14], k: [7, 13] });
    expect([c.cols, c.rows, c.slices]).toEqual([10, 8, 6]);
    expect(c.origin).toEqual([5, 6, 7]);
    expect(c.data[((9 - 7) * 8 + (9 - 6)) * 10 + (9 - 5)]).toBe(100);
  });

  it('önceki sonuç yoksa ya da yapı bulunamazsa açık hata (tahminle kırpılmaz)', () => {
    const m = manifest({ cascade: { model: 'anatomi', labels: ['kidney_left'], addonMm: 3 } });
    expect(() => cascadeInput(vol, m)).toThrow(/anatomi/);
    const missing = manifest({ cascade: { model: 'anatomi', labels: ['liver'], addonMm: 3 } });
    expect(() => cascadeInput(vol, missing, prior)).toThrow(/bulunamadı/);
    expect(cascadeInput(vol, m, prior).cols).toBeLessThan(vol.cols);
  });

  it('yardımcı sınıflar silinir; kesit aralığı özgün seriye göre', async () => {
    const m = manifest({ cascade: { model: 'anatomi', labels: ['kidney_left'], addonMm: 3 }, dropLabels: [2] });
    const input = cascadeInput(vol, m, prior);
    const calls: number[][] = [];
    const seg = await segmentVolume(input, m, fakeEngine(calls), { statsVolume: vol });
    expect(calls.length).toBe(seg.tiles);
    expect(calls[0]).toEqual([1, 1, 8, 8, 8]);
    expect(seg.structures.map((s) => s.labelId)).toEqual([1]);
    const bright = seg.structures[0]!;
    expect(bright.kind).toBe('finding');
    expect(bright.voxels).toBe(64);
    // 4×4×4 parlak küp k = 8..11 (özgün seride; kırpılmış hacimde değil)
    expect(bright.sliceRange).toEqual([8, 11]);
    expect(bright.centroid[2]).toBeCloseTo(9.5, 1);
  });
});

describe('manifest: basamaklı model alanları', () => {
  const base = manifest();
  it('geçerli cascade / dropLabels / eşikler kabul edilir', () => {
    const m = { ...base, volume: { ...base.volume!, cascade: { model: 'totalseg-ct-total-3mm', labels: ['kidney_left'], addonMm: 10 }, dropLabels: [3, 4] }, labels: [{ id: 1, finding: 'Kist', kind: 'finding' as const, minMl: 0.1, normalMaxMl: 50 }] };
    expect(validateManifest(m).ok).toBe(true);
  });
  it('bozuk cascade ve eşikler reddedilir', () => {
    const bad = { ...base, volume: { ...base.volume!, cascade: { model: '', labels: [], addonMm: -1 }, dropLabels: [0] }, labels: [{ id: 1, finding: 'Kist', minMl: -1 }] };
    const r = validateManifest(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join(' ')).toMatch(/cascade/);
      expect(r.errors.join(' ')).toMatch(/dropLabels/);
      expect(r.errors.join(' ')).toMatch(/minMl/);
    }
  });
});

describe('etiket hacminden 3B yüzey (surface nets)', () => {
  it('küre maskesi: kapalı yüzey, gerçek sınırlar içinde, mm koordinatında', async () => {
    const { labelSurface } = await import('../volumeSurface');
    const n = 24;
    const labels = new Uint8Array(n * n * n);
    for (let s = 0; s < n; s++) for (let a = 0; a < n; a++) for (let r = 0; r < n; r++) if ((s - 12) ** 2 + (a - 12) ** 2 + (r - 12) ** 2 <= 36) labels[(s * n + a) * n + r] = 5;
    const grid = { shape: [n, n, n] as [number, number, number], spacing: 2, lo: [100, -50, 10] as [number, number, number] };
    const m = labelSurface(labels, grid, 5)!;
    expect(m.indices.length % 3).toBe(0);
    expect(m.indices.length).toBeGreaterThan(300);
    // Her kenar tam iki üçgende kullanılır (kapalı yüzey)
    const edges = new Map<string, number>();
    for (let t = 0; t < m.indices.length; t += 3)
      for (const [x, y] of [[0, 1], [1, 2], [2, 0]] as const) {
        const a = m.indices[t + x]!, b = m.indices[t + y]!;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    expect([...edges.values()].every((c) => c === 2)).toBe(true);
    // Merkez ~ (lo + 12×2), yarıçap ~ 6 voksel × 2 mm
    for (let d = 0; d < 3; d++) {
      const c = [100, -50, 10][d]! + 24;
      expect((m.min[d]! + m.max[d]!) / 2).toBeCloseTo(c, 0);
      expect(m.max[d]! - m.min[d]!).toBeGreaterThan(18);
      expect(m.max[d]! - m.min[d]!).toBeLessThan(28);
    }
    expect(labelSurface(labels, grid, 9)).toBeNull();
  });
});
