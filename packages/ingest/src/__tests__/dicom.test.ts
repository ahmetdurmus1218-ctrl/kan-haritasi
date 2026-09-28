import { describe, expect, it } from 'vitest';
import {
  DICOM_TS,
  MEDIA_DIRECTORY_SOP,
  autoWindow,
  canDecode,
  decodeFrame,
  modalityCategory,
  parseDicom,
  isNearlyGray,
  looksLikeDocumentImage,
  looksLikeFilmImage,
  renderGray,
  renderRgba,
  rgbaToGray,
  validateUpload,
} from '../index';
import { type El, encapsulated, imageElements, rleFrame, u16Pixels, writeDicom } from './dicomWriter';

const PATIENT: El[] = [
  { g: 0x0010, e: 0x0010, vr: 'PN', value: 'YILMAZ^AYSE' },
  { g: 0x0010, e: 0x0020, vr: 'LO', value: '12345678901' },
];

function mrSlice(extra: El[] = [], ts?: string) {
  const values = [0, 100, 200, 300, 400, 500];
  return writeDicom(
    imageElements({
      rows: 2,
      cols: 3,
      pixels: u16Pixels(values, ts !== DICOM_TS.explicitBE),
      extra: [
        ...PATIENT,
        { g: 0x0008, e: 0x0005, vr: 'CS', value: 'ISO_IR 192' },
        { g: 0x0008, e: 0x0020, vr: 'DA', value: '20260315' },
        { g: 0x0008, e: 0x1030, vr: 'LO', value: 'BEYİN MR KONTRASTSIZ' },
        { g: 0x0018, e: 0x0015, vr: 'CS', value: 'BRAIN' },
        { g: 0x0020, e: 0x000e, vr: 'UI', value: '1.2.3.4.5' },
        { g: 0x0020, e: 0x0013, vr: 'IS', value: '7' },
        { g: 0x0028, e: 0x1050, vr: 'DS', value: '250\\300' },
        { g: 0x0028, e: 0x1051, vr: 'DS', value: '500' },
        ...extra,
      ],
    }),
    { transferSyntax: ts },
  );
}

describe('DICOM okuyucu', () => {
  it('açık VR little endian: bilgiler ve pikseller', () => {
    const bytes = mrSlice();
    const info = parseDicom(bytes);
    expect(info).toMatchObject({
      modality: 'MR',
      bodyPart: 'BRAIN',
      studyDescription: 'BEYİN MR KONTRASTSIZ',
      studyDate: '2026-03-15',
      seriesUid: '1.2.3.4.5',
      instanceNumber: 7,
      rows: 2,
      columns: 3,
      frames: 1,
      windowCenter: 250,
      windowWidth: 500,
      codec: 'native',
    });
    // Kimlik bilgileri okunmaz.
    expect(JSON.stringify(info)).not.toContain('YILMAZ');
    expect(JSON.stringify(info)).not.toContain('12345678901');
    const frame = decodeFrame(bytes, info);
    expect(frame.kind).toBe('gray');
    if (frame.kind !== 'gray') return;
    expect([...frame.data]).toEqual([0, 100, 200, 300, 400, 500]);
    expect(frame.min).toBe(0);
    expect(frame.max).toBe(500);
  });

  it('örtük VR ve big endian', () => {
    for (const ts of [DICOM_TS.implicitLE, DICOM_TS.explicitBE]) {
      const bytes = mrSlice([], ts);
      const info = parseDicom(bytes);
      expect(info.rows).toBe(2);
      expect(info.modality).toBe('MR');
      const frame = decodeFrame(bytes, info);
      expect(frame.kind === 'gray' && [...frame.data]).toEqual([0, 100, 200, 300, 400, 500]);
    }
  });

  it('tanımsız uzunluklu dizileri atlar', () => {
    const seq: El = {
      g: 0x0008,
      e: 0x1140,
      vr: 'SQ',
      value: [[{ g: 0x0008, e: 0x1150, vr: 'UI', value: '1.2' }], [{ g: 0x0008, e: 0x1155, vr: 'UI', value: '1.3' }]],
    };
    for (const ts of [DICOM_TS.explicitLE, DICOM_TS.implicitLE]) {
      const bytes = mrSlice([seq], ts);
      const info = parseDicom(bytes);
      expect(info.studyDescription).toBe('BEYİN MR KONTRASTSIZ');
      expect(canDecode(info)).toBe(true);
    }
  });

  it('BT: işaretli pikseller, eğim/kesişim → Hounsfield', () => {
    const raw = [-1000, 0, 40, 1000];
    const bytes = writeDicom(
      imageElements({
        rows: 2,
        cols: 2,
        signed: true,
        modality: 'CT',
        pixels: u16Pixels(raw.map((v) => v + 1024)),
        extra: [
          { g: 0x0028, e: 0x1052, vr: 'DS', value: '-1024' },
          { g: 0x0028, e: 0x1053, vr: 'DS', value: '1' },
        ],
      }),
    );
    const info = parseDicom(bytes);
    expect(modalityCategory(info.modality)).toBe('ct');
    const f = decodeFrame(bytes, info);
    expect(f.kind === 'gray' && [...f.data]).toEqual(raw);
  });

  it('BitsStored maskesi ve işaret genişletme (12 bit)', () => {
    const els = imageElements({ rows: 1, cols: 2, signed: true, pixels: u16Pixels([0xf000 | 0x0fff, 0x0005]) });
    const stored = els.find((e) => e.g === 0x28 && e.e === 0x101)!;
    stored.value = 12;
    const bytes = writeDicom(els);
    const f = decodeFrame(bytes, parseDicom(bytes));
    expect(f.kind === 'gray' && [...f.data]).toEqual([-1, 5]);
  });

  it('çok kareli (multi-frame) dosyada kare seçimi', () => {
    const bytes = writeDicom(imageElements({ rows: 1, cols: 2, bits: 8, frames: 3, pixels: Uint8Array.from([1, 2, 3, 4, 5, 6]) }));
    const info = parseDicom(bytes);
    expect(info.frames).toBe(3);
    const f = decodeFrame(bytes, info, 2);
    expect(f.kind === 'gray' && [...f.data]).toEqual([5, 6]);
    expect(() => decodeFrame(bytes, info, 3)).toThrow();
  });

  it('RLE Lossless: 16 bit gri', () => {
    const values = [0, 0, 0, 0, 258, 513, 1000, 65535];
    const hi = Uint8Array.from(values.map((v) => v >> 8));
    const lo = Uint8Array.from(values.map((v) => v & 0xff));
    const bytes = writeDicom([...imageElements({ rows: 2, cols: 4 }), encapsulated([rleFrame([hi, lo])])], { transferSyntax: DICOM_TS.rle });
    const info = parseDicom(bytes);
    expect(info.codec).toBe('rle');
    const f = decodeFrame(bytes, info);
    expect(f.kind === 'gray' && [...f.data]).toEqual(values);
  });

  it('RLE Lossless: RGB ultrason', () => {
    const r = Uint8Array.from([255, 0]);
    const g = Uint8Array.from([0, 255]);
    const b = Uint8Array.from([0, 0]);
    const bytes = writeDicom([...imageElements({ rows: 1, cols: 2, bits: 8, spp: 3, photometric: 'RGB', modality: 'US' }), encapsulated([rleFrame([r, g, b])])], {
      transferSyntax: DICOM_TS.rle,
    });
    const info = parseDicom(bytes);
    const f = decodeFrame(bytes, info);
    expect(f.kind === 'rgba' && [...f.data]).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
  });

  it('JPEG Baseline: kare tarayıcıya çözülmek üzere verilir', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);
    const bytes = writeDicom([...imageElements({ rows: 1, cols: 1, bits: 8, modality: 'CR' }), encapsulated([jpeg])], { transferSyntax: DICOM_TS.jpegBaseline });
    const info = parseDicom(bytes);
    const f = decodeFrame(bytes, info);
    expect(f.kind).toBe('encoded');
    expect(f.kind === 'encoded' && [...f.data]).toEqual([...jpeg]);
    expect(modalityCategory(info.modality)).toBe('xray');
  });

  it('JPEG 2000 gibi desteklenmeyen sıkıştırma: bilgiler okunur, çözülmez', () => {
    const bytes = writeDicom([...imageElements({ rows: 1, cols: 1 }), encapsulated([Uint8Array.from([1, 2])])], { transferSyntax: '1.2.840.10008.1.2.4.90' });
    const info = parseDicom(bytes);
    expect(info.codec).toBe('unsupported');
    expect(canDecode(info)).toBe(false);
    expect(() => decodeFrame(bytes, info)).toThrow();
  });

  it('kesik dosya bozuk sayılır', () => {
    const bytes = mrSlice();
    expect(() => {
      const info = parseDicom(bytes.subarray(0, bytes.length - 4));
      decodeFrame(bytes.subarray(0, bytes.length - 4), info);
    }).toThrow();
  });

  it('pencere: dosyadaki değer, otomatik ve çizim', () => {
    const data = Float32Array.from({ length: 1000 }, (_, i) => i);
    const w = autoWindow(data);
    expect(w.center).toBeGreaterThan(400);
    expect(w.center).toBeLessThan(600);
    const out = new Uint8ClampedArray(3 * 4);
    renderGray(Float32Array.from([0, 50, 100]), { center: 50, width: 100 }, false, out);
    expect([out[0], out[8], out[3]]).toEqual([0, 255, 255]);
    expect(Math.abs(out[4]! - 127.5)).toBeLessThanOrEqual(1);
    renderGray(Float32Array.from([0, 50, 100]), { center: 50, width: 100 }, true, out);
    expect([out[0], out[8]]).toEqual([255, 0]);
  });
});

describe('DICOM yükleme doğrulaması', () => {
  it('uzantısız CD dosyası kabul edilir; özet kimlik içermez', () => {
    const v = validateUpload({ bytes: mrSlice(), fileName: 'IM000001', declaredMime: '' });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.kind).toBe('dicom');
    expect(v.mimeType).toBe('application/dicom');
    expect(v.fileName).toBe('IM000001.dcm');
    expect(v.dicom).toMatchObject({ modality: 'MR', bodyPart: 'BRAIN', studyDate: '2026-03-15', seriesUid: '1.2.3.4.5', instanceNumber: 7, decodable: true });
    expect(JSON.stringify(v)).not.toContain('YILMAZ');
  });

  it('UID biçimli adlar ve .dcm uzantısı', () => {
    const a = validateUpload({ bytes: mrSlice(), fileName: '1.2.840.113619.2.55.1' });
    expect(a.ok && a.fileName).toBe('1.2.840.113619.2.55.1.dcm');
    const b = validateUpload({ bytes: mrSlice(), fileName: 'beyin.dcm' });
    expect(b.ok && b.displayName).toBe('beyin');
  });

  it('PDF/görsel uzantılı DICOM reddedilir', () => {
    expect(validateUpload({ bytes: mrSlice(), fileName: 'rapor.pdf' })).toEqual({ ok: false, code: 'EXTENSION_MISMATCH' });
  });

  it('.dcm uzantılı PDF reddedilir', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    expect(validateUpload({ bytes: pdf, fileName: 'x.dcm' })).toEqual({ ok: false, code: 'EXTENSION_MISMATCH' });
  });

  it('DICOMDIR (görüntüsüz dizin) reddedilir', () => {
    const bytes = writeDicom([{ g: 0x0004, e: 0x1130, vr: 'CS', value: 'CD' }], { sopClass: MEDIA_DIRECTORY_SOP });
    expect(validateUpload({ bytes, fileName: 'DICOMDIR' })).toEqual({ ok: false, code: 'DICOM_NO_IMAGE' });
  });

  it('çok büyük boyut başlıktan reddedilir', () => {
    const bytes = writeDicom(imageElements({ rows: 9000, cols: 9000, pixels: new Uint8Array(4) }));
    expect(validateUpload({ bytes, fileName: 'x.dcm' })).toEqual({ ok: false, code: 'IMAGE_TOO_LARGE' });
  });

  it('bozuk başlık reddedilir', () => {
    const bytes = mrSlice().slice(0, 200);
    expect(validateUpload({ bytes, fileName: 'x.dcm' }).ok).toBe(false);
  });

  it('çözülemeyen sıkıştırma uyarıyla kabul edilir', () => {
    const bytes = writeDicom([...imageElements({ rows: 1, cols: 1 }), encapsulated([Uint8Array.from([1, 2])])], { transferSyntax: '1.2.840.10008.1.2.4.90' });
    const v = validateUpload({ bytes, fileName: 'x.dcm' });
    expect(v.ok && v.warnings).toContain('DICOM_NOT_VIEWABLE');
  });
});

describe('fotoğraf olarak yüklenen görüntüler', () => {
  const px = (list: number[][]) => Uint8ClampedArray.from(list.flatMap(([r, g, b]) => [r!, g!, b!, 255]));

  it('renkli pencere: kimlik ayarı görüntüyü değiştirmez, dar pencere kontrastı artırır', () => {
    const src = px([[10, 128, 250]]);
    const out = new Uint8ClampedArray(4);
    renderRgba(src, { center: 127.5, width: 255 }, false, out);
    expect([...out]).toEqual([10, 128, 250, 255]);
    renderRgba(src, { center: 128, width: 64 }, false, out);
    expect([out[0], out[2]]).toEqual([0, 255]);
    renderRgba(src, { center: 127.5, width: 255 }, true, out);
    expect([...out]).toEqual([245, 127, 5, 255]);
  });

  it('gri film fotoğrafı ile renkli fotoğraf ayrılır', () => {
    expect(isNearlyGray(px([[20, 22, 21], [200, 199, 203], [90, 90, 90]]))).toBe(true);
    expect(isNearlyGray(px([[200, 30, 30], [20, 22, 21]]))).toBe(false);
    const g = rgbaToGray(px([[0, 0, 0], [255, 255, 255]]), 2, 1);
    expect([g.min, Math.round(g.max)]).toEqual([0, 255]);
  });

  it('rapor fotoğrafı (açık zemin) ile film (koyu) ayrılır', () => {
    const paper = px([...Array(90).fill([240, 238, 235]), ...Array(10).fill([30, 30, 30])]);
    const film = px([...Array(70).fill([15, 15, 15]), ...Array(30).fill([180, 180, 180])]);
    expect(looksLikeDocumentImage(paper)).toBe(true);
    expect(looksLikeDocumentImage(film)).toBe(false);
    expect(looksLikeFilmImage(film)).toBe(true);
    expect(looksLikeFilmImage(paper)).toBe(false);
    // Koyu ama renkli (ör. karanlık modda renkli ekran görüntüsü) film sayılmaz.
    expect(looksLikeFilmImage(px([...Array(70).fill([10, 20, 60]), ...Array(30).fill([200, 60, 60])]))).toBe(false);
  });
});
