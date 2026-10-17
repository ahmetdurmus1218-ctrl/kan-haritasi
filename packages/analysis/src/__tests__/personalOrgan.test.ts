import { describe, expect, it } from 'vitest';
import { deepestPoint, interiorCavity, labelSurface, meshVolumeMm3, personalInteriorNote, personalOrganPlan, smoothSurface } from '../index';

/** [S][A][R] etiket hacmi; f(s, a, r) → etiket. */
function volume(shape: [number, number, number], f: (s: number, a: number, r: number) => number): Uint8Array {
  const [S, A, R] = shape;
  const out = new Uint8Array(S * A * R);
  for (let s = 0, o = 0; s < S; s++) for (let a = 0; a < A; a++) for (let r = 0; r < R; r++, o++) out[o] = f(s, a, r);
  return out;
}

describe('kişisel organ: maskeden içine gir', () => {
  const shape: [number, number, number] = [24, 24, 24];
  const grid = { shape, spacing: 3 as const, lo: [-30, -40, 100] as [number, number, number] };
  const d = (s: number, a: number, r: number) => Math.hypot(s - 12, a - 12, r - 12);

  it('dolu küre: iç boşluk yok, en derin nokta merkez', () => {
    const labels = volume(shape, (s, a, r) => (d(s, a, r) <= 8 ? 4 : 0));
    expect(interiorCavity(labels, grid, [4]).voxels).toBe(0);
    const deep = deepestPoint(labels, grid, 4)!;
    // Merkez vokseli (12,12,12) → RAS lo + 12 × 3 mm
    expect(deep.point).toEqual([-30 + 36, -40 + 36, 100 + 36]);
    expect(deep.depthMm).toBeGreaterThan(20);
  });

  it('içi boş küre (lümen): kapalı boşluk gerçek hacmiyle bulunur', () => {
    const labels = volume(shape, (s, a, r) => (d(s, a, r) <= 9 && d(s, a, r) > 6 ? 7 : 0));
    const cav = interiorCavity(labels, grid, [7]);
    let expected = 0;
    for (let s = 0; s < 24; s++) for (let a = 0; a < 24; a++) for (let r = 0; r < 24; r++) if (d(s, a, r) <= 6) expected++;
    expect(cav.voxels).toBe(expected);
    expect(cav.volumeMl).toBeCloseTo((expected * 27) / 1000, 5);
    // Boşluğun en derin noktası boşluğun merkezidir (kamera lümenin içinde durur)
    expect(deepestPoint(cav.mask, grid, 1)!.point).toEqual([6, -4, 136]);
  });

  it('açık tüp: dışarıya açılan iç kısım boşluk sayılmaz (uydurma lümen yok)', () => {
    const labels = volume(shape, (s, a, r) => {
      const rr = Math.hypot(a - 12, r - 12);
      return rr <= 7 && rr > 4 ? 3 : 0;
    });
    expect(interiorCavity(labels, grid, [3]).voxels).toBe(0);
  });

  it('yumuşatma: yer değiştirme yarım vokselle sınırlı, hacim korunur', () => {
    const labels = volume(shape, (s, a, r) => (d(s, a, r) <= 8 ? 4 : 0));
    const raw = labelSurface(labels, grid, 4)!;
    const smooth = smoothSurface(raw, 1.5);
    let maxShift = 0;
    for (let i = 0; i < raw.positions.length; i += 3) maxShift = Math.max(maxShift, Math.hypot(smooth.positions[i]! - raw.positions[i]!, smooth.positions[i + 1]! - raw.positions[i + 1]!, smooth.positions[i + 2]! - raw.positions[i + 2]!));
    expect(maxShift).toBeLessThanOrEqual(1.5 + 1e-4);
    expect(maxShift).toBeGreaterThan(0);
    const v0 = meshVolumeMm3(raw);
    expect(Math.abs(meshVolumeMm3(smooth) - v0) / v0).toBeLessThan(0.03);
    // Maskenin voksel hacmine yakın (gerçek geometri)
    expect(Math.abs(v0 - raw.voxels * 27) / (raw.voxels * 27)).toBeLessThan(0.15);
    // Girdi değiştirilmedi
    expect(raw.positions).not.toBe(smooth.positions);
  });

  it('plan: organın etiketleri + yakın komşular; maske yoksa null', () => {
    const st = (labelId: number, structure: string, c: number, size = 30) => ({ labelId, name: structure, kind: 'anatomy' as const, structure, voxels: 1000, volumeMl: size, centroid: [c, 0, 0] as [number, number, number], bboxMin: [c - 20, -20, -20] as [number, number, number], bboxMax: [c + 20, 20, 20] as [number, number, number] });
    const src = { key: 'ct', grid, structures: [st(1, 'kidneys', 0), st(2, 'kidneys', 60), st(3, 'liver', 100), st(4, 'spleen', 400), { ...st(9, 'kidneys', 0), kind: 'finding' as const }] };
    const plan = personalOrganPlan([src], { structure: 'kidneys' })!;
    expect(plan.target.sort()).toEqual([1, 2]);
    expect(plan.neighbors).toEqual([3]);
    expect(plan.volumeMl).toBe(60);
    expect(personalOrganPlan([src], { structure: 'heart' })).toBeNull();
  });

  it('etiketler: lümen yalnızca gerçek boşluk varsa "senin görüntünden"', () => {
    expect(personalInteriorNote('hollow', 'kalın bağırsak', 0).lumen).toBe('educational');
    expect(personalInteriorNote('hollow', 'kalın bağırsak', 0).educational).toContain('iç lümen eğitimsel anatomi olarak gösteriliyor');
    expect(personalInteriorNote('hollow', 'mesane', 120).lumen).toBe('real');
    const solid = personalInteriorNote('solid', 'karaciğer', 50);
    expect(solid.lumen).toBe('none');
    expect(solid.real).toContain('segmentasyon maskesinden oluşturuldu');
    expect(solid.educational).toContain('eğitimsel');
  });
});
