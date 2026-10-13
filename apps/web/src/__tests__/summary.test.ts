import { describe, expect, it } from 'vitest';
import { type LabObservation, REPORTED, buildHealthModel } from '@kh/analysis';
import { bodySummary, primaryOrgan, whatChanged } from '../lib/summary';
import { labTone } from '../lib/tone';
import { search } from '../lib/search';

const lab = (testKey: string, value: number, status: LabObservation['status'], severity: LabObservation['severity'], date = '2026-05-01', extra: Partial<LabObservation> = {}): LabObservation => ({
  testKey,
  name: testKey,
  value,
  unit: 'u',
  status,
  severity,
  date,
  source: 'LAB',
  confidence: REPORTED,
  ...extra,
});

describe('renk dili: her referans dışı değer kırmızı değildir', () => {
  it('hafif sapma takip, belirgin sapma dikkat, yalnızca kritik düzey acil', () => {
    expect(labTone(lab('alt', 45, 'high', 'mild'))).toBe('follow');
    expect(labTone(lab('alt', 200, 'high', 'marked'))).toBe('attention');
    expect(labTone(lab('potassium', 7, 'high', 'marked', undefined, { critical: true }))).toBe('urgent');
    expect(labTone(lab('alt', 20, 'normal', 'normal'))).toBe('normal');
  });
});

describe('Vücudum özeti', () => {
  it('her tahlil yalnızca birincil organına sayılır; tek organa özgü olmayan test organ saymaz', () => {
    expect(primaryOrgan('alt')).toBe('liver');
    expect(primaryOrgan('creatinine')).toBe('kidneys');
    expect(primaryOrgan('crp')).toBeUndefined();
    const model = buildHealthModel({ images: [], reports: [], labs: [lab('creatinine', 2.4, 'high', 'marked'), lab('crp', 80, 'high', 'marked'), lab('alt', 45, 'high', 'mild')] });
    const s = bodySummary(model);
    expect(s.organs.map((o) => o.organ)).toContain('kidneys');
    expect(s.organs.some((o) => o.reasons.some((r) => r.startsWith('crp')))).toBe(false);
    expect(s.follow.map((f) => f.label)).toContain('alt yüksek');
  });

  it('boş modelde veri yok der', () => {
    expect(bodySummary(buildHealthModel({ images: [], reports: [], labs: [] })).hasData).toBe(false);
  });

  it('"Ne değişti?" eğilimleri en yeni önce listeler', () => {
    const model = buildHealthModel({ images: [], reports: [], labs: [lab('hba1c', 5.4, 'normal', 'normal', '2024-01-01'), lab('hba1c', 6.3, 'high', 'mild', '2026-01-01')] });
    const c = whatChanged(model);
    expect(c[0]).toMatchObject({ icon: '↑', route: { name: 'timeline', key: 'hba1c' } });
  });
});

describe('global arama', () => {
  it('"pankreas" organ sayfasına ve alt bağlantılara götürür', () => {
    const h = search('pankreas');
    expect(h[0]).toMatchObject({ kind: 'organ', title: 'Pankreas', route: { name: 'organ', id: 'pancreas' } });
    expect(h[0]!.links.map((l) => l.label)).toEqual(expect.arrayContaining(['Sonuçlar', 'Normalde nasıl çalışır?', 'Zaman çizelgesi']));
  });

  it('bölge ve test adlarını bulur; Türkçe karakter duyarsız', () => {
    expect(search('alin lobu')[0]?.route).toEqual({ name: 'organ', id: 'brain.frontal' });
    expect(search('hba1c').some((h) => h.kind === 'test')).toBe(true);
    expect(search('x')).toEqual([]);
  });
});
