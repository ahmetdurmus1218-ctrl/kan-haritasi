import { describe, expect, it } from 'vitest';
import { type LabObservation, REPORTED, buildHealthModel } from '@kh/analysis';
import { bodySummary } from '../lib/summary';
import { affectedOrgans, organOfStructure, resultStats, structureOfOrgan } from '../lib/homeData';
import { GROUPS } from '../screens/AppShell';

const lab = (testKey: string, value: number, status: LabObservation['status'], severity: LabObservation['severity']): LabObservation => ({
  testKey,
  name: testKey,
  value,
  unit: 'u',
  status,
  severity,
  date: '2026-05-01',
  source: 'LAB',
  confidence: REPORTED,
});

describe('ana ekran verisi: yalnızca gerçek sonuçlardan, sağlık puanı yok', () => {
  it('veri yoksa gösterge (yüzde) üretilmez, etkilenen organ uydurulmaz', () => {
    const model = buildHealthModel({ images: [], reports: [], labs: [] });
    expect(resultStats(model)).toBeNull();
    expect(affectedOrgans(bodySummary(model), model)).toEqual([]);
  });

  it('referans durumu: aralıktaki sonuç sayısı; durumu bilinmeyen sonuç sayılmaz', () => {
    const model = buildHealthModel({
      images: [],
      reports: [],
      labs: [lab('alt', 20, 'normal', 'normal'), lab('creatinine', 0.9, 'normal', 'normal'), lab('ldl', 190, 'high', 'moderate'), lab('tsh', 2, 'unknown', 'unknown')],
    });
    const s = resultStats(model)!;
    expect(s.total).toBe(3);
    expect(s.inRange).toBe(2);
    expect(s.systems.reduce((n, x) => n + x.total, 0)).toBeLessThanOrEqual(3);
  });

  it('etkilenen organlar analiz motorunun çıktısından; önem sırasıyla', () => {
    const model = buildHealthModel({ images: [], reports: [], labs: [lab('alt', 200, 'high', 'marked'), lab('tsh', 4.9, 'high', 'mild')] });
    const organs = affectedOrgans(bodySummary(model), model);
    const liver = organs.find((o) => o.organ === 'liver');
    expect(liver?.tone).toBe('attention');
    expect(liver?.structure).toBe('liver');
    expect(organs.every((o, i) => i === 0 || ['urgent', 'attention', 'follow', 'uncertain'].indexOf(organs[i - 1]!.tone) <= ['urgent', 'attention', 'follow', 'uncertain'].indexOf(o.tone) || o.tone === 'uncertain')).toBe(true);
  });

  it('motorun organ saymadığı hafif sapma, birincil organına "izlem önerilir" olarak eklenir', () => {
    const model = buildHealthModel({ images: [], reports: [], labs: [lab('tsh', 4.9, 'high', 'mild')] });
    const organs = affectedOrgans({ urgent: [], organs: [], follow: [], hasData: true }, model);
    const thyroid = organs.find((o) => o.structure === 'thyroid');
    expect(thyroid?.tone).toBe('follow');
    expect(thyroid?.reasons[0]).toContain('hafif yüksek');
  });

  it('organ ↔ 3B yapı eşlemesi iki yönlü', () => {
    expect(structureOfOrgan('liver')).toBe('liver');
    expect(structureOfOrgan(organOfStructure('heart'))).toBe('heart');
  });

  it('gezinme: altı ana bölüm (referans tasarım)', () => {
    expect(GROUPS.map((g) => g.label)).toEqual(['Ana Ekran', 'Laboratuvar', 'Analizler', 'Raporlar', 'Serüven', 'Ayarlar']);
  });
});
