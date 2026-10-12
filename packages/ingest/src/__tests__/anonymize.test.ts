import { describe, expect, it } from 'vitest';
import { anonymizeDicom, parseDicom } from '../dicom';
import { type El, imageElements, writeDicom } from './dicomWriter';

const has = (b: Uint8Array, s: string) => new TextDecoder('latin1').decode(b).includes(s);

const ID: El[] = [
  { g: 0x0010, e: 0x0010, vr: 'PN', value: 'YILMAZ^AYSE' },
  { g: 0x0010, e: 0x0020, vr: 'LO', value: '12345678901' },
  { g: 0x0010, e: 0x0030, vr: 'DA', value: '19800101' },
  { g: 0x0010, e: 0x0040, vr: 'CS', value: 'F' },
  { g: 0x0008, e: 0x0050, vr: 'SH', value: 'ACC998877' },
  { g: 0x0008, e: 0x0080, vr: 'LO', value: 'ORNEK HASTANESI' },
  { g: 0x0008, e: 0x1030, vr: 'LO', value: 'BEYIN MR' },
  // İç içe dizide de kimlik bilgisi
  { g: 0x0008, e: 0x1110, vr: 'SQ', value: [[{ g: 0x0010, e: 0x0010, vr: 'PN', value: 'GIZLI^AD' }]] },
];

describe('DICOM anonimleştirme', () => {
  for (const [name, ts] of [
    ['açık VR', '1.2.840.10008.1.2.1'],
    ['örtük VR', '1.2.840.10008.1.2'],
  ] as const) {
    it(`${name}: hasta adı, kimlik, doğum tarihi, erişim no ve kurum temizlenir; görüntü ve klinik alanlar korunur`, () => {
      const pixels = new Uint8Array(16 * 16 * 2).map((_, i) => i % 251);
      const src = writeDicom(imageElements({ rows: 16, cols: 16, bits: 16, pixels, extra: ID }), { transferSyntax: ts });
      for (const s of ['YILMAZ^AYSE', '12345678901', '19800101', 'ACC998877', 'ORNEK HASTANESI', 'GIZLI^AD']) expect(has(src, s)).toBe(true);
      const { bytes, cleared } = anonymizeDicom(src);
      for (const s of ['YILMAZ^AYSE', '12345678901', '19800101', 'ACC998877', 'ORNEK HASTANESI', 'GIZLI^AD']) expect(has(bytes, s), s).toBe(false);
      expect(cleared).toEqual(expect.arrayContaining(['PatientName', 'PatientID', 'PatientBirthDate', 'AccessionNumber', 'InstitutionName']));
      expect(bytes.length).toBe(src.length);
      const before = parseDicom(src);
      const after = parseDicom(bytes);
      expect(after.modality).toBe('MR');
      expect(after.studyDescription).toBe('BEYIN MR');
      expect(after.rows).toBe(before.rows);
      expect(after.pixel).toEqual(before.pixel);
      expect(Array.from(bytes.subarray(before.pixel!.native!.offset, before.pixel!.native!.offset + 32))).toEqual(Array.from(pixels.subarray(0, 32)));
      // Cinsiyet korunur
      expect(has(bytes, 'F ')).toBe(true);
      // Özgün dizi değişmez
      expect(has(src, 'YILMAZ^AYSE')).toBe(true);
    });
  }

  it('DICOM olmayan dosyayı reddeder', () => {
    expect(() => anonymizeDicom(new Uint8Array(200))).toThrow();
  });
});
