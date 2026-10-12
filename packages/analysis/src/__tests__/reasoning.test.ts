import { describe, expect, it } from 'vitest';
import { evaluatePattern, evaluatePatterns, PATTERNS } from '../patterns';
import { computeTrend } from '../trend';
import { compareStudies, parseSizeMm } from '../temporal';
import { resolveReference, statusAgainst, latestByTest } from '../labs';
import type { LabObservation, ReportFinding } from '../types';
import { REPORTED } from '../types';

const lab = (testKey: string, value: number, status: LabObservation['status'], date = '2026-01-10', refMin?: number, refMax?: number): LabObservation => ({
  testKey,
  name: testKey.toUpperCase(),
  value,
  unit: 'u',
  status,
  date,
  source: 'LAB',
  confidence: REPORTED,
  ...(refMin !== undefined ? { refMin } : {}),
  ...(refMax !== undefined ? { refMax } : {}),
  refSource: 'report',
});

const finding = (text: string, structure: string, status: ReportFinding['status'], negated = false, size?: string): ReportFinding => ({
  id: text,
  source: 'RADIOLOGY_REPORT',
  text,
  status,
  negated,
  location: { path: [structure], structure, basis: 'report-text', confidence: REPORTED },
  localization: { kind: 'report-approximate', text: structure },
  confidence: REPORTED,
  ...(size ? { size } : {}),
});

describe('örüntü motoru', () => {
  const def = (id: string) => PATTERNS.find((p) => p.id === id)!;

  it('destekleyen, çelişen ve eksik bilgileri ayrı üretir; tanı koymaz', () => {
    const r = evaluatePattern(def('hepatocellular'), { labs: [lab('alt', 120, 'high'), lab('ast', 30, 'normal'), lab('ck', 900, 'high')], reportFindings: [], imageObservations: [] });
    expect(r.active).toBe(true);
    expect(r.supporting.map((s) => s.label)).toContain('ALT yüksek');
    expect(r.contradictory.map((s) => s.label)).toEqual(expect.arrayContaining(['AST: aralıkta', 'CK yüksek (AST kas kaynaklı olabilir)']));
    expect(r.missing.join(' ')).toMatch(/Karaciğer/);
    expect(r.explanation).toMatch(/tanı değildir/);
    expect(r.confidence.kind).toBe('score');
  });

  it('tüm değerler normalse örüntü etkin olmaz', () => {
    const out = evaluatePatterns({ labs: [lab('alt', 20, 'normal'), lab('glucose', 85, 'normal'), lab('creatinine', 0.9, 'normal')], reportFindings: [], imageObservations: [] });
    expect(out).toHaveLength(0);
  });

  it('rapordaki olumsuzlanmış ifade ("kitle izlenmedi") bulgu sayılmaz', () => {
    const r = evaluatePattern(def('pancreatic-enzymes'), { labs: [], reportFindings: [finding('Pankreasta kitle izlenmedi', 'pancreas', 'normal', true)], imageObservations: [] });
    expect(r.active).toBe(false);
  });

  it('görüntü ve laboratuvar kanıtını kaynaklarıyla birlikte birleştirir', () => {
    const r = evaluatePattern(def('pancreatic-enzymes'), { labs: [lab('lipase', 300, 'high')], reportFindings: [finding('Pankreas başında 2 cm hipoekoik lezyon', 'pancreas', 'abnormal')], imageObservations: [] });
    expect(r.supporting.map((s) => s.source)).toEqual(expect.arrayContaining(['LAB', 'RADIOLOGY_REPORT']));
  });
});

describe('eğilim motoru', () => {
  it('HbA1c 5,4 → 6,3: artan, monoton, aralık dışına çıkmış; tanı uyarısı', () => {
    const t = computeTrend(
      [
        { date: '2023-03-01', value: 5.4, refMax: 5.7 },
        { date: '2024-03-01', value: 5.8, refMax: 5.7 },
        { date: '2025-03-01', value: 6.1, refMax: 5.7 },
        { date: '2026-03-01', value: 6.3, refMax: 5.7 },
      ],
      'HbA1c',
    );
    expect(t.direction).toBe('rising');
    expect(t.monotonic).toBe(true);
    expect(t.crossing).toBe('became-high');
    expect(t.slopePerYear!).toBeGreaterThan(0.25);
    expect(t.slopePerYear!).toBeLessThan(0.35);
    expect(t.statement).toMatch(/2023 → 5,4/);
    expect(t.caution).toMatch(/tanı koydurmaz/);
  });

  it('küçük değişim kararlı sayılır; tek ölçümde eğilim çıkarılmaz', () => {
    expect(computeTrend([{ date: '2025-01-01', value: 100 }, { date: '2026-01-01', value: 102 }]).direction).toBe('stable');
    expect(computeTrend([{ date: '2025-01-01', value: 100 }]).direction).toBe('insufficient');
  });
});

describe('eski ↔ yeni çalışma karşılaştırması', () => {
  it('yeni, kaybolan ve büyüyen bulguları ayırır; çakıştırma olmadığını söyler', () => {
    const c = compareStudies(
      { date: '2024-05-01', modality: 'MRI', items: [
        { key: 'brain|frontal|left', label: 'sol frontal 6 mm odak', source: 'RADIOLOGY_REPORT', status: 'abnormal', sizeMm: 6 },
        { key: 'brain|temporal|right', label: 'sağ temporal odak', source: 'RADIOLOGY_REPORT', status: 'abnormal' },
      ] },
      { date: '2026-05-01', modality: 'MRI', items: [
        { key: 'brain|frontal|left', label: 'sol frontal 9 mm odak', source: 'RADIOLOGY_REPORT', status: 'abnormal', sizeMm: 9 },
        { key: 'brain|occipital|left', label: 'sol oksipital yeni odak', source: 'RADIOLOGY_REPORT', status: 'abnormal' },
      ] },
    );
    const kinds = Object.fromEntries(c.changes.map((x) => [x.key, x.change]));
    expect(kinds['brain|frontal|left']).toBe('growing');
    expect(kinds['brain|occipital|left']).toBe('new');
    expect(kinds['brain|temporal|right']).toBe('resolved');
    expect(c.reliability.join(' ')).toMatch(/registration/);
  });

  it('ölçüleri mm cinsine çevirir', () => {
    expect(parseSizeMm('12 x 8 mm')).toBe(12);
    expect(parseSizeMm('1,5 cm kist')).toBe(15);
    expect(parseSizeMm('ölçü yok')).toBeUndefined();
  });
});

describe('referans aralığı önceliği', () => {
  it('raporun aralığı varsa sistem aralığı kullanılmaz', () => {
    const r = resolveReference({ report: { min: 70, max: 100 }, system: { min: 74, max: 106 } })!;
    expect(r.source).toBe('report');
    expect(statusAgainst(118, r)).toBe('high');
    expect(resolveReference({ laboratory: {}, demographic: { max: 5 }, system: { max: 9 } })!.source).toBe('demographic');
    expect(resolveReference({})).toBeUndefined();
  });

  it('test başına en güncel sonuç seçilir', () => {
    const l = latestByTest([lab('alt', 10, 'normal', '2024-01-01'), lab('alt', 90, 'high', '2026-01-01')]);
    expect(l).toHaveLength(1);
    expect(l[0]!.value).toBe(90);
  });
});
