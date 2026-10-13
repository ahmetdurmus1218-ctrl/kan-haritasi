import { describe, expect, it } from 'vitest';
import { DICOM_TS, MPR_MIN_SLICES, SECONDARY_CAPTURE_SOP, anonymizeDicom, buildVolume, burnedInRisk, decodeFrame, mprGeometry, parseDicom, reslice } from '../index';
import { type El, imageElements, u16Pixels, writeDicom } from './dicomWriter';

const AXIAL: [number, number, number, number, number, number] = [1, 0, 0, 0, 1, 0];

/** Eksenel seri: z = i * gap; piksel değeri = 100 * z-sırası + x (sütun) — konum doğrulanabilsin. */
function axialSeries(n: number, opts: { gap?: number; rows?: number; cols?: number; jitter?: (i: number) => number } = {}) {
  const rows = opts.rows ?? 4;
  const cols = opts.cols ?? 5;
  const gap = opts.gap ?? 2;
  return Array.from({ length: n }, (_, i) => ({
    rows,
    columns: cols,
    frames: 1,
    pixelSpacing: [1, 1] as [number, number],
    imageOrientation: AXIAL,
    imagePosition: [0, 0, i * gap + (opts.jitter?.(i) ?? 0)] as [number, number, number],
  }));
}

describe('görüntüye yakılmış yazı (burned-in annotation)', () => {
  const slice = (extra: El[]) => parseDicom(writeDicom(imageElements({ rows: 2, cols: 2, pixels: u16Pixels([1, 2, 3, 4]), extra })));

  it('(0028,0301) YES → kesin uyarı; başlık temizliği pikseldeki yazıyı silmez', () => {
    const info = slice([{ g: 0x0028, e: 0x0301, vr: 'CS', value: 'YES' }, { g: 0x0010, e: 0x0010, vr: 'PN', value: 'YILMAZ^AYSE' }]);
    expect(info.burnedInAnnotation).toBe('YES');
    expect(burnedInRisk(info).level).toBe('yes');
    const bytes = writeDicom(imageElements({ rows: 2, cols: 2, pixels: u16Pixels([1, 2, 3, 4]), extra: [{ g: 0x0028, e: 0x0301, vr: 'CS', value: 'YES' }, { g: 0x0010, e: 0x0010, vr: 'PN', value: 'YILMAZ^AYSE' }] }));
    const anon = anonymizeDicom(bytes);
    expect(anon.cleared).toContain('PatientName');
    // Pikseller aynen kalır: yakılmış yazı varsa hâlâ oradadır (bu yüzden ayrıca uyarılır).
    const a = decodeFrame(anon.bytes, parseDicom(anon.bytes));
    const b = decodeFrame(bytes, parseDicom(bytes));
    expect(a.kind === 'gray' && b.kind === 'gray' && [...a.data]).toEqual(b.kind === 'gray' ? [...b.data] : null);
  });

  it('ikincil yakalama / DERIVED\\SECONDARY → olası; NO → yok; bilgi yoksa bilinmiyor', () => {
    expect(burnedInRisk({ sopClassUid: SECONDARY_CAPTURE_SOP }).level).toBe('possible');
    expect(burnedInRisk(slice([{ g: 0x0008, e: 0x0008, vr: 'CS', value: 'DERIVED\\SECONDARY' }])).level).toBe('possible');
    expect(burnedInRisk(slice([{ g: 0x0028, e: 0x0301, vr: 'CS', value: 'NO' }])).level).toBe('no');
    expect(burnedInRisk(slice([])).level).toBe('unknown');
  });

  it('yönelim ve görüntü türü başlıktan okunur', () => {
    const info = slice([
      { g: 0x0020, e: 0x0037, vr: 'DS', value: '1\\0\\0\\0\\1\\0' },
      { g: 0x0020, e: 0x0032, vr: 'DS', value: '-120\\-100\\35.5' },
      { g: 0x0008, e: 0x0008, vr: 'CS', value: 'ORIGINAL\\PRIMARY\\AXIAL' },
    ]);
    expect(info.imageOrientation).toEqual([1, 0, 0, 0, 1, 0]);
    expect(info.imagePosition).toEqual([-120, -100, 35.5]);
    expect(info.imageType).toBe('ORIGINAL\\PRIMARY\\AXIAL');
  });

  it('büyük endian dosyada da yönelim okunur', () => {
    const info = parseDicom(writeDicom(imageElements({ rows: 1, cols: 2, pixels: u16Pixels([1, 2], false), extra: [{ g: 0x0020, e: 0x0037, vr: 'DS', value: '0\\1\\0\\0\\0\\-1' }] }), { transferSyntax: DICOM_TS.explicitBE }));
    expect(info.imageOrientation).toEqual([0, 1, 0, 0, 0, -1]);
  });
});

describe('MPR (eksenel / sagital / koronal)', () => {
  it('düzenli eksenel seri: geometri, düzlem adları, baş yukarıda', () => {
    const r = mprGeometry(axialSeries(12));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.geometry;
    expect(g.acquired).toBe('axial');
    expect(g.byColumn).toBe('sagittal');
    expect(g.byRow).toBe('coronal');
    expect(g.sliceSpacing).toBeCloseTo(2);
    expect(g.order[0]).toBe(11); // en üstteki (en büyük z) kesit önce
    // Sıra karışık verilse de konuma göre sıralanır
    const shuffled = axialSeries(12).reverse();
    const r2 = mprGeometry(shuffled);
    expect(r2.ok && r2.geometry.order[0]).toBe(0);
  });

  it('yeniden yapılandırılan düzlem doğru vokselleri gerçek mm oranıyla verir', () => {
    const series = axialSeries(12, { gap: 2, rows: 4, cols: 5 });
    const r = mprGeometry(series);
    if (!r.ok) throw new Error(r.reason);
    const slices = series.map((_, i) => Float32Array.from({ length: 20 }, (_, p) => 100 * i + (p % 5)));
    const vol = buildVolume(r.geometry, slices);
    const sag = reslice(vol, 'column', 3);
    expect(sag.plane).toBe('sagittal');
    expect(sag.width).toBe(4); // satırlar
    expect(sag.height).toBe(23); // (12-1)*2mm / 1mm + 1
    expect(sag.pixelSpacing).toEqual([1, 1]);
    expect(sag.data[0]).toBe(1100 + 3); // üst = en büyük z (kesit 11), sütun 3
    expect(sag.data[(sag.height - 1) * sag.width]).toBe(3); // alt = kesit 0
    expect(sag.data[1 * sag.width]).toBeCloseTo(1050 + 3); // iki kesit arası doğrusal enterpolasyon
    const cor = reslice(vol, 'row', 0);
    expect(cor.plane).toBe('coronal');
    expect(cor.width).toBe(5);
    expect([...cor.data.slice(0, 5)]).toEqual([1100, 1101, 1102, 1103, 1104]);
  });

  it('güvenilir değilse nedeniyle reddedilir (uydurma görüntü yok)', () => {
    const reason = (s: Parameters<typeof mprGeometry>[0]) => {
      const r = mprGeometry(s);
      return r.ok ? '' : r.reason;
    };
    expect(reason(axialSeries(MPR_MIN_SLICES - 1))).toMatch(/en az/);
    expect(reason(axialSeries(12, { jitter: (i) => (i === 5 ? 1.5 : 0) }))).toMatch(/düzensiz/);
    expect(reason(axialSeries(12, { gap: 0 }))).toMatch(/aynı konumda/);
    expect(reason(axialSeries(12).map((s, i) => (i === 3 ? { ...s, imageOrientation: [1, 0, 0, 0, 0.9, 0.43] as typeof AXIAL } : s)))).toMatch(/yönelimi/);
    expect(reason(axialSeries(12).map((s) => ({ ...s, pixelSpacing: undefined })))).toMatch(/Piksel aralığı/);
    expect(reason(axialSeries(12).map((s, i) => (i ? s : { ...s, rows: 8 })))).toMatch(/boyut/);
    expect(reason(axialSeries(12).map((s) => ({ ...s, frames: 30 })))).toMatch(/çok kareli/i);
    expect(reason(axialSeries(12).map((s, i) => (i === 2 ? { ...s, imagePosition: undefined } : s)))).toMatch(/konumu/);
    expect(reason(axialSeries(12, { rows: 2048, cols: 2048 }))).toMatch(/bellek/);
  });

  it('sagital çekilmiş seriden eksenel ve koronal üretilir', () => {
    // Sagital: satır yönü +y (ön→arka), sütun yönü -z (baş→ayak), normal x.
    const series = Array.from({ length: 10 }, (_, i) => ({ rows: 3, columns: 3, frames: 1, pixelSpacing: [1, 1] as [number, number], imageOrientation: [0, 1, 0, 0, 0, -1] as typeof AXIAL, imagePosition: [i * 1.5, 0, 0] as [number, number, number] }));
    const r = mprGeometry(series);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.geometry.acquired).toBe('sagittal');
    expect(r.geometry.byColumn).toBe('coronal');
    expect(r.geometry.byRow).toBe('axial');
  });
});
