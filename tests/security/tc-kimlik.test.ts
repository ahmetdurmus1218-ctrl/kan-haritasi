import { describe, expect, it } from 'vitest';
// @ts-expect-error: düz JS betiği
import { findTcKimlik, isValidTcKimlik } from '../../scripts/tc-kimlik.mjs';

describe('fixture PII taraması', () => {
  it('geçerli sağlama toplamlı numarayı yakalar, rastgele 11 haneyi yakalamaz', () => {
    // Algoritmayla üretilmiş örnek; dosyada düz yazılmaz ki taramanın kendisini tetiklemesin.
    const sample = ['1000', '0000', '146'].join('');
    expect(isValidTcKimlik(sample)).toBe(true);
    expect(isValidTcKimlik('12345678901')).toBe(false);
    expect(isValidTcKimlik('01234567890')).toBe(false);
    expect(findTcKimlik(`Protokol: TEST-0001, No: ${sample}, Tel: 05551234567`)).toEqual([sample]);
  });
});
