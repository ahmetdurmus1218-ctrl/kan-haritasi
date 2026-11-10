import { describe, expect, it } from 'vitest';
import { type MprGeometry, type Volume, VR_CT_PRESETS, VR_MAX_DIM, mipProjection, toRenderVolume, volumeWindow } from '../index';

function ball(columns: number, rows: number, depth: number, spacing: [number, number, number], center: [number, number, number], radiusMm: number, inside = 1000, outside = -1000): Volume {
  const geometry: MprGeometry = { order: Array.from({ length: depth }, (_, i) => i), rows, columns, pixelSpacing: [spacing[1], spacing[0]], sliceSpacing: spacing[2], acquired: 'axial', byColumn: 'sagittal', byRow: 'coronal' };
  const data = new Float32Array(columns * rows * depth);
  for (let z = 0; z < depth; z++)
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < columns; x++) {
        const d = Math.hypot((x - center[0]) * spacing[0], (y - center[1]) * spacing[1], (z - center[2]) * spacing[2]);
        data[(z * rows + y) * columns + x] = d <= radiusMm ? inside : outside;
      }
  return { geometry, data, min: outside, max: inside };
}

describe('3B hacim görüntüleme hazırlığı', () => {
  it('büyük hacim en büyük kenarı sınırı aşmayacak biçimde indirgenir; fiziksel boyut (mm) değişmez', () => {
    const vol = ball(400, 320, 90, [0.7, 0.7, 2.5], [200, 160, 45], 60);
    const rv = toRenderVolume(vol, { lo: -1000, hi: 1000 });
    expect(Math.max(rv.nx, rv.ny, rv.nz)).toBeLessThanOrEqual(VR_MAX_DIM);
    expect(rv.stride).toEqual([3, 2, 1]);
    expect(rv.data.length).toBe(rv.nx * rv.ny * rv.nz);
    expect(rv.sizeMm[0]).toBeCloseTo(280, 5);
    expect(rv.sizeMm[1]).toBeCloseTo(224, 5);
    expect(rv.sizeMm[2]).toBeCloseTo(225, 5);
    // Hacim küp varsayılmaz: voksel aralığı farklı olduğunda kutu oranı fizikseldir.
    expect(rv.sizeMm[0] / rv.sizeMm[2]).not.toBeCloseTo(rv.nx / rv.nz, 1);
  });
  it('küçük hacim indirgenmez; pencere doğrusal ve sınırlar kırpılır', () => {
    const vol = ball(20, 20, 12, [1, 1, 1], [10, 10, 6], 4, 300, -100);
    const rv = toRenderVolume(vol, { lo: 0, hi: 200 });
    expect([rv.nx, rv.ny, rv.nz]).toEqual([20, 20, 12]);
    expect(rv.data[(6 * 20 + 10) * 20 + 10]).toBe(255);
    expect(rv.data[0]).toBe(0);
    const half = toRenderVolume(vol, { lo: -100, hi: 700 });
    expect(half.data[(6 * 20 + 10) * 20 + 10]).toBe(128);
  });
  it('MIP: küre üç eksende de daire olarak, doğru yerde ve fiziksel oranla görünür', () => {
    const vol = ball(60, 60, 30, [1, 1, 2], [20, 40, 10], 12);
    const rv = toRenderVolume(vol, { lo: -1000, hi: 1000 });
    const axial = mipProjection(rv, 2);
    expect([axial.width, axial.height]).toEqual([60, 60]);
    expect(axial.data[40 * 60 + 20]).toBe(255);
    expect(axial.data[5 * 60 + 55]).toBe(0);
    const lit = (p: { data: Uint8Array }) => p.data.reduce((a, v) => a + (v > 127 ? 1 : 0), 0);
    // Alan ≈ π r² (piksel alanı 1 mm²)
    expect(lit(axial)).toBeGreaterThan(Math.PI * 144 * 0.9);
    expect(lit(axial)).toBeLessThan(Math.PI * 144 * 1.1);
    const side = mipProjection(rv, 0);
    expect([side.width, side.height]).toEqual([60, 30]);
    expect(side.pixelMm).toEqual([1, 2]);
    // Kesit ekseni yukarı: z = 10 → alttan 10. satır
    expect(side.data[(30 - 1 - 10) * 60 + 40]).toBe(255);
    expect(lit(side) * 2).toBeGreaterThan(Math.PI * 144 * 0.85);
    expect(lit(side) * 2).toBeLessThan(Math.PI * 144 * 1.15);
    expect(mipProjection(rv, 1).data[(30 - 1 - 10) * 60 + 20]).toBe(255);
  });
  it('otomatik pencere: arka plan (hava) saydam, parlak yapı görünür; düz hacimde bölme hatası yok', () => {
    const vol = ball(40, 40, 40, [1, 1, 1], [20, 20, 20], 16, 900, -1000);
    const w = volumeWindow(vol);
    expect(w.hi).toBeGreaterThan(w.lo);
    const rv = toRenderVolume(vol, w);
    expect(rv.data[0]).toBe(0);
    expect(rv.data[(20 * 40 + 20) * 40 + 20]).toBeGreaterThan(200);
    const flat: Volume = { ...vol, data: new Float32Array(vol.data.length).fill(5), min: 5, max: 5 };
    expect(volumeWindow(flat)).toEqual({ lo: 5, hi: 6 });
    expect(toRenderVolume(flat, volumeWindow(flat)).data.every((v) => v === 0)).toBe(true);
  });
  it('BT pencereleri Hounsfield biriminde ve artan sırada tanımlı', () => {
    for (const p of VR_CT_PRESETS) expect(p.hi).toBeGreaterThan(p.lo);
    expect(VR_CT_PRESETS.find((p) => p.key === 'kemik')!.lo).toBeGreaterThan(100);
    expect(VR_CT_PRESETS.find((p) => p.key === 'akciger')!.hi).toBeLessThan(0);
  });
});
