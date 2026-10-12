import { describe, expect, it } from 'vitest';
import { analyzeEcg } from '../ecg';
import { documentImage, ecgImage } from './synthetic';

describe('EKG görüntüsünden ölçüm', () => {
  it('ızgarayı bulur ve 1 mm kalibrasyonunu çıkarır', () => {
    const e = ecgImage({ mm: 8, bpm: 75 });
    const r = analyzeEcg(e.rgba, e.width, e.height);
    expect(r.grid.detected).toBe(true);
    expect(r.grid.color).toBe('red');
    expect(r.grid.pxPerMm).toBeGreaterThan(7.5);
    expect(r.grid.pxPerMm).toBeLessThan(8.5);
  });

  it('75/dk düzenli ritimde kalp hızını ve RR aralığını ölçer', () => {
    const e = ecgImage({ mm: 8, bpm: 75 });
    const r = analyzeEcg(e.rgba, e.width, e.height);
    expect(r.failure).toBeUndefined();
    expect(r.heartRate).toBeGreaterThanOrEqual(72);
    expect(r.heartRate).toBeLessThanOrEqual(78);
    for (const rr of r.rrMs) expect(Math.abs(rr - 800)).toBeLessThan(40);
    expect(r.regularity).toBe('regular');
  });

  it('farklı hız ve çözünürlükte de doğru ölçer (110/dk, 1 mm = 6 px)', () => {
    const e = ecgImage({ mm: 6, bpm: 110, width: 1400 });
    const r = analyzeEcg(e.rgba, e.width, e.height);
    expect(r.heartRate).toBeGreaterThanOrEqual(104);
    expect(r.heartRate).toBeLessThanOrEqual(116);
  });

  it('düzensiz RR aralıklarını düzensiz olarak işaretler', () => {
    const e = ecgImage({ mm: 8, bpm: 70, jitter: 0.25 });
    const r = analyzeEcg(e.rgba, e.width, e.height);
    expect(r.regularity).not.toBe('regular');
  });

  it('çok sıralı (12 derivasyon benzeri) kâğıtta şeritleri ayırır', () => {
    const e = ecgImage({ mm: 6, bpm: 80, rows: 4 });
    const r = analyzeEcg(e.rgba, e.width, e.height);
    expect(r.strips.length).toBe(4);
    expect(r.heartRate).toBeGreaterThanOrEqual(76);
    expect(r.heartRate).toBeLessThanOrEqual(84);
  });

  it('ölçülemeyen değerleri (PR, QRS, QT, aks) uydurmaz, nedeniyle listeler', () => {
    const e = ecgImage();
    const r = analyzeEcg(e.rgba, e.width, e.height);
    const names = r.notMeasured.map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(['PR aralığı', 'QRS süresi', 'QT / QTc', 'Elektriksel aks']));
    expect(r).not.toHaveProperty('qtc');
  });

  it('EKG olmayan görüntüde ızgara bulamaz ve ölçüm vermez', () => {
    const d = documentImage();
    const r = analyzeEcg(d.rgba, d.width, d.height);
    expect(r.heartRate).toBeUndefined();
    expect(r.failure).toBeDefined();
  });
});

describe('küçültülmüş EKG fotoğrafı (alt piksel ızgara)', () => {
  it('1 mm tam sayı piksel olmadığında da (8 px × 0,853 = 6,83 px) kalibrasyon ve hız doğru', async () => {
    const { downsampleRgba } = await import('../image');
    const e = ecgImage({ mm: 8, bpm: 75 });
    for (const target of [1024, 900, 700]) {
      const s = downsampleRgba(e.rgba, e.width, e.height, target);
      const r = analyzeEcg(s.rgba, s.width, s.height);
      const expected = 8 * s.scale;
      expect(Math.abs(r.grid.pxPerMm! - expected) / expected, `${target}px`).toBeLessThan(0.04);
      expect(r.heartRate, `${target}px`).toBeGreaterThanOrEqual(71);
      expect(r.heartRate, `${target}px`).toBeLessThanOrEqual(79);
    }
  });
});
