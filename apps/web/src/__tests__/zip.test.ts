import { describe, expect, it } from 'vitest';
import { crc32, makeZip, safeEntryName } from '../lib/zip';

describe('ZIP yazıcı', () => {
  it('CRC-32 bilinen değeri üretir', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
  });

  it('geçerli yerel başlıklar, merkez dizin ve bitiş kaydı yazar', () => {
    const zip = makeZip([
      { name: 'belgeler/rapor.pdf', data: new Uint8Array([1, 2, 3]) },
      { name: 'sonuçlar.csv', data: new TextEncoder().encode('a;b') },
    ]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    expect(v.getUint16(eocd + 10, true)).toBe(2);
    const cdOffset = v.getUint32(eocd + 16, true);
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50);
    // UTF-8 ad bayrağı
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800);
  });

  it('dosya adlarından yol ve denetim karakterlerini temizler', () => {
    expect(safeEntryName('../../etc/passwd', 'x')).toBe('_.._etc_passwd');
    expect(safeEntryName('rapor‮gpj.pdf', 'x')).toBe('rapor_gpj.pdf');
    expect(safeEntryName('...', 'yedek')).toBe('yedek');
  });
});
