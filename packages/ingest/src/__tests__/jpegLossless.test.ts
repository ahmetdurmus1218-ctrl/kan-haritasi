import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canDecode, decodeFrame, parseDicom, volumeFromDicom } from '../index';
import { JpegLosslessError, decodeJpegLossless } from '../jpegLossless';

const FIX = resolve(__dirname, '../../../../fixtures/imaging');
const read = (p: string) => new Uint8Array(readFileSync(resolve(FIX, p)));

/** fixtures/make_jpeg_lossless_vectors.py ile aynı kaynak görüntü (12 bit). */
const W = 61;
const H = 37;
const source = (x: number, y: number) => (x * 37 + y * 101 + ((x * y) % 17) * 13) & 0xfff;

describe('JPEG Lossless (süreç 14) çözücü', () => {
  // Test vektörleri bağımsız bir çözücüyle (libjpeg) doğrulanarak üretildi.
  const vectors = readdirSync(resolve(FIX, 'jpeg-lossless/vectors')).filter((f) => f.endsWith('.jpg'));

  it('7 öngörü × yeniden başlatma aralıkları: kaynak görüntüyle bit bit aynı', () => {
    expect(vectors).toHaveLength(21);
    for (const f of vectors) {
      const img = decodeJpegLossless(read(`jpeg-lossless/vectors/${f}`));
      expect([img.width, img.height, img.precision], f).toEqual([W, H, 12]);
      let bad = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img.samples[y * W + x] !== source(x, y)) bad++;
      expect(bad, f).toBe(0);
    }
  });

  it('DICOM 1.2.840.10008.1.2.4.70 ve .57: özgün sıkıştırmasız kesitle aynı HU değerleri (işaretli 16 bit)', () => {
    const native = parseDicom(read('totalseg-ct-sm/IM0015'));
    const ref = decodeFrame(read('totalseg-ct-sm/IM0015'), native);
    for (const f of ['IM0015-sv1.dcm', 'IM0015-p14.dcm']) {
      const bytes = read(`jpeg-lossless/${f}`);
      const info = parseDicom(bytes);
      expect(info.codec, f).toBe('jpeg-lossless');
      expect(canDecode(info)).toBe(true);
      const got = decodeFrame(bytes, info);
      if (got.kind !== 'gray' || ref.kind !== 'gray') throw new Error('gri bekleniyordu');
      expect(got.min).toBe(ref.min);
      expect(got.max).toBe(ref.max);
      expect(got.min).toBeLessThan(-1000); // işaret genişletme doğru
      expect(Array.from(got.data)).toEqual(Array.from(ref.data));
    }
  });

  it('JPEG Lossless seri 3B hacim olarak kurulabilir (önceden "çözülemeyen sıkıştırma" diye reddediliyordu)', () => {
    const files = [read('jpeg-lossless/IM0015-sv1.dcm'), ...readdirSync(resolve(FIX, 'totalseg-ct-sm')).filter((f) => f !== 'IM0015').sort().map((f) => read(`totalseg-ct-sm/${f}`))];
    const v = volumeFromDicom(files);
    expect(v.ok).toBe(true);
  });

  it('bozuk/eksik akış ve desteklenmeyen biçimler açık hatayla reddedilir', () => {
    expect(() => decodeJpegLossless(new Uint8Array([0, 1, 2]))).toThrow(JpegLosslessError);
    const v = read('jpeg-lossless/vectors/p1-ri0.jpg');
    expect(() => decodeJpegLossless(v.subarray(0, v.length / 2))).toThrow(JpegLosslessError);
    // SOF3 yerine SOF0 (kayıplı JPEG) → bu çözücünün işi değil
    const sof0 = v.slice();
    const i = sof0.findIndex((b, k) => b === 0xff && sof0[k + 1] === 0xc3);
    sof0[i + 1] = 0xc0;
    expect(() => decodeJpegLossless(sof0)).toThrow(/SOF3/);
  });
});
