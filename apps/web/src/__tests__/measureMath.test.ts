import { describe, expect, it } from 'vitest';
import { lineLength, roiStats, toImagePoint } from '../lib/measureMath';

describe('görüntü ölçüm hesapları', () => {
  it('uzunluk: piksel aralığıyla mm, yoksa piksel', () => {
    expect(lineLength([0, 0], [30, 40], [0.5, 0.5])).toEqual({ value: 25, unit: 'mm' });
    expect(lineLength([0, 0], [10, 0], [1, 2]).value).toBe(20); // x yönünde sütun aralığı
    expect(lineLength([0, 0], [3, 4])).toEqual({ value: 5, unit: 'px' });
  });

  it('ROI: dairedeki ortalama ve sapma', () => {
    const w = 10;
    const data = new Float32Array(w * w).fill(40);
    data[0] = -1000; // daire dışında
    const s = roiStats(data, w, w, [5, 5], 3);
    expect(s.mean).toBe(40);
    expect(s.sd).toBe(0);
    expect(s.n).toBeGreaterThan(20);
  });

  it('döndürülmüş görüntüde tıklanan nokta', () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 };
    // döndürme yok, ölçek 2: ekran (150, 50) → görüntü (75, 25) (görüntü 100×50)
    expect(toImagePoint(150, 50, rect, 0, 2, { w: 100, h: 50 })).toEqual([75, 25]);
    // 90° döndürülmüş: ekran kutusu 100×200; ekranda merkezin 20 px sağı → görüntüde merkezin 10 px yukarısı
    const [x, y] = toImagePoint(70, 100, { left: 0, top: 0, width: 100, height: 200 }, 90, 2, { w: 100, h: 50 });
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(15);
  });
});
