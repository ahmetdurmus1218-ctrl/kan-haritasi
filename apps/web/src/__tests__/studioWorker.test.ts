import { describe, expect, it } from 'vitest';
import { runStudioJob } from '../anatomy/studio.worker';

/** Küp (her yüz ayrı köşeli, 24 köşe): birleştirme 8 köşeye indirmeli. */
function cube(): { pos: Float32Array; index: Uint32Array } {
  const f = [
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
  ];
  const pos: number[] = [];
  const index: number[] = [];
  f.forEach((q, k) => {
    for (const v of q) pos.push(...v);
    const o = k * 4;
    index.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { pos: Float32Array.from(pos), index: Uint32Array.from(index) };
}

describe('Atlas stüdyosu işçisi (yumuşatma, normaller, şişirme, epikard yağı)', () => {
  it('aynı konumdaki köşeleri birleştirir, normaller dışa bakar ve birim uzunluktadır', () => {
    const { pos, index } = cube();
    const r = runStudioJob({ key: 'k', pos, index, iterations: 0, inflate: 0, fat: null });
    expect(r.pos.length / 3).toBe(8);
    expect(r.index.length).toBe(36);
    for (let i = 0; i < 8; i++) {
      const [x, y, z] = [r.pos[i * 3]!, r.pos[i * 3 + 1]!, r.pos[i * 3 + 2]!];
      const [nx, ny, nz] = [r.normal[i * 3]!, r.normal[i * 3 + 1]!, r.normal[i * 3 + 2]!];
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
      expect(x * nx + y * ny + z * nz).toBeGreaterThan(0);
    }
  });

  it('Taubin yumuşatması pürüzü giderir ama şekli küçültmez; şişirme yüzeyi dışa iter', () => {
    // Pürüzlü küre (enlem × boylam ızgarası, yarıçap 1 ± 0,05)
    const pos: number[] = [];
    const index: number[] = [];
    const LAT = 24;
    const LON = 32;
    for (let i = 0; i <= LAT; i++)
      for (let j = 0; j <= LON; j++) {
        const th = (i / LAT) * Math.PI;
        const ph = ((j % LON) / LON) * Math.PI * 2;
        const r = i === 0 || i === LAT ? 1 : 1 + 0.05 * ((i * 7 + j * 13) % 3 === 0 ? 1 : -1);
        pos.push(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph));
      }
    for (let i = 0; i < LAT; i++)
      for (let j = 0; j < LON; j++) {
        const a = i * (LON + 1) + j;
        const b = a + LON + 1;
        index.push(a, a + 1, b, b, a + 1, b + 1); // dışa bakan dolaşma yönü
      }
    const radii = (p: Float32Array) => Array.from({ length: p.length / 3 }, (_, i) => Math.hypot(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!));
    const spread = (r: number[]) => Math.max(...r) - Math.min(...r);
    const mean = (r: number[]) => r.reduce((x, y) => x + y, 0) / r.length;
    const r0 = radii(runStudioJob({ key: 'a', pos: Float32Array.from(pos), index: Uint32Array.from(index), iterations: 0, inflate: 0, fat: null }).pos);
    const r1 = radii(runStudioJob({ key: 'b', pos: Float32Array.from(pos), index: Uint32Array.from(index), iterations: 7, inflate: 0, fat: null }).pos);
    expect(spread(r1)).toBeLessThan(spread(r0) * 0.5);
    expect(mean(r1)).toBeGreaterThan(mean(r0) * 0.97);
    const r2 = radii(runStudioJob({ key: 'c', pos: Float32Array.from(pos), index: Uint32Array.from(index), iterations: 7, inflate: 0.1, fat: null }).pos);
    expect(mean(r2)).toBeGreaterThan(mean(r1) + 0.09);
  });

  it('epikard yağı: damara yakın köşede 1, uzak köşede 0 (dünya matrisiyle)', () => {
    const { pos, index } = cube();
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const r = runStudioJob({ key: 'f', pos, index, iterations: 0, inflate: 0, fat: { vessels: Float32Array.from([1, 1, 1]), matrix: identity, near: 0.1, far: 1 } });
    const at = (x: number, y: number, z: number) => {
      for (let i = 0; i < r.pos.length / 3; i++) if (r.pos[i * 3] === x && r.pos[i * 3 + 1] === y && r.pos[i * 3 + 2] === z) return r.fat![i]!;
      return NaN;
    };
    expect(at(1, 1, 1)).toBe(1);
    expect(at(-1, -1, -1)).toBe(0);
  });
});
