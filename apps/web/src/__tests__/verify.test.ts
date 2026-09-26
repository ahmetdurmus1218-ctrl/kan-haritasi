import { describe, expect, it } from 'vitest';
import { type ReviewRow, type StoredResult, needsVerification, toStoredResult, verificationIssues } from '../lib/reports';

const base: StoredResult = {
  testKey: 'wbc',
  loinc: '6690-2',
  rawName: 'WBC',
  value: 7.1,
  unit: '10^9/L',
  unitKey: '10^9/l',
  canonicalValue: 7.1,
  refMin: 3.91,
  refMax: 8.77,
  refText: '3,91-8,77',
  refSource: 'report',
  status: 'normal',
  userEdited: false,
};

describe('okuma güvenilirliği', () => {
  it('düşük güvenli veya sorunlu okumalar doğrulama ister', () => {
    expect(needsVerification({ ...base, confidence: 0.95 })).toBe(false);
    expect(needsVerification({ ...base, confidence: 0.6 })).toBe(true);
    expect(needsVerification({ ...base, confidence: 0.9, issues: ['LOW_OCR_CONFIDENCE'] })).toBe(true);
    expect(verificationIssues({ ...base, confidence: 0.6 })).toEqual(['LOW_OCR_CONFIDENCE']);
    // Genel (katalog) aralık kullanımı tek başına doğrulama gerektirmez
    expect(needsVerification({ ...base, confidence: 0.9, issues: ['RANGE_MISSING'] })).toBe(false);
  });

  it('kullanıcı düzelttiyse veya "doğru" dediyse doğrulama istenmez', () => {
    expect(needsVerification({ ...base, confidence: 0.4, userEdited: true })).toBe(false);
    expect(needsVerification({ ...base, confidence: 0.4, verified: true })).toBe(false);
  });

  it('kaydederken okuma güveni ve sorunlar saklanır (elle düzeltilenlerde saklanmaz)', () => {
    const row = { ...base, valueText: '7,1', confidence: 0.61, issues: ['LOW_OCR_CONFIDENCE'], source: { page: 1, x: 0, y: 0, w: 1, h: 1 }, include: true } as unknown as ReviewRow;
    expect(toStoredResult(row)).toMatchObject({ confidence: 0.61, issues: ['LOW_OCR_CONFIDENCE'] });
    const edited = toStoredResult({ ...row, userEdited: true });
    expect(edited.confidence).toBeUndefined();
    expect(edited.issues).toBeUndefined();
  });
});
