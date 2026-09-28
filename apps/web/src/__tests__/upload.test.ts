import { describe, expect, it, vi } from 'vitest';
import { MemoryBlobStore, MemoryRecordStore, PassphraseKeyWrapper, Vault } from '@kh/vault';
import { DEFAULT_LIMITS } from '@kh/ingest';
import { processUpload } from '../lib/upload';
import { imageElements, u16Pixels, writeDicom } from '../../../../packages/ingest/src/__tests__/dicomWriter';

const FAST = { memoryKiB: 8 * 1024, iterations: 1, parallelism: 1 };
const pdfBytes = (tag = 'a') => new TextEncoder().encode(`%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj % ${tag}\n%%EOF`);

async function vault() {
  return Vault.create(new MemoryRecordStore(), new MemoryBlobStore(), new PassphraseKeyWrapper('test-parolasi-123', FAST));
}

const deps = (pages: number | null = 2) => ({ countPdfPages: vi.fn(async () => pages) });

describe('yükleme hattı', () => {
  it('geçerli PDF şifrelenip kaydedilir; aynısı ikinci kez yüklenmez', async () => {
    const v = await vault();
    const file = new File([pdfBytes()], 'Kan Tahlili.pdf', { type: 'application/pdf' });
    const phases: string[] = [];
    const first = await processUpload(v, file, deps(), (p) => phases.push(p));
    expect(first).toMatchObject({ phase: 'done', file: { displayName: 'Kan Tahlili', kind: 'pdf' } });
    expect(phases).toEqual(['checking', 'encrypting']);

    const again = await processUpload(v, new File([pdfBytes()], 'kopya.pdf'), deps());
    expect(again).toMatchObject({ phase: 'duplicate', file: { id: first.file!.id } });
    expect((await v.listFiles()).files).toHaveLength(1);
  });

  it('20 MB üstü dosya içeriği okunmadan reddedilir', async () => {
    const v = await vault();
    const huge = { name: 'dev.pdf', type: 'application/pdf', size: DEFAULT_LIMITS.maxBytes + 1, arrayBuffer: vi.fn() } as unknown as File;
    const r = await processUpload(v, huge, deps());
    expect(r.phase).toBe('error');
    expect(huge.arrayBuffer).not.toHaveBeenCalled();
  });

  it('30 sayfadan uzun PDF reddedilir, bozuk PDF anlaşılır hata verir', async () => {
    const v = await vault();
    expect((await processUpload(v, new File([pdfBytes('b')], 'uzun.pdf'), deps(31))).message).toMatch(/En fazla 30 sayfa/);
    const broken = { countPdfPages: vi.fn(async () => Promise.reject(new Error('InvalidPDF'))) };
    expect((await processUpload(v, new File([pdfBytes('c')], 'bozuk.pdf'), broken)).message).toBe('Dosya bozuk veya okunamıyor.');
    expect((await v.listFiles()).files).toHaveLength(0);
  });

  it('içeriği desteklenmeyen dosya ve kilitli kasa kullanıcıya iç ayrıntı sızdırmaz', async () => {
    const v = await vault();
    const html = new File(['<script>alert(1)</script>'], 'rapor.pdf', { type: 'application/pdf' });
    expect(await processUpload(v, html, deps())).toMatchObject({ phase: 'error', message: 'Dosyanın içeriği PDF, JPG, PNG veya desteklenen bir DICOM değil.' });
    v.lock();
    const r = await processUpload(v, new File([pdfBytes('d')], 'a.pdf'), deps());
    expect(r).toMatchObject({ phase: 'error', message: 'Kasa kilitlendi. Devam etmek için kilidi aç.' });
  });

  it('MR kesiti (DICOM): tür, bölge, tarih ve seri başlıktan gelir', async () => {
    const v = await vault();
    const dcm = (n: number) =>
      writeDicom(
        imageElements({
          rows: 2,
          cols: 2,
          pixels: u16Pixels([n, 1, 2, 3]),
          extra: [
            { g: 0x0008, e: 0x0020, vr: 'DA', value: '20260102' },
            { g: 0x0008, e: 0x1030, vr: 'LO', value: 'LOMBER MR' },
            { g: 0x0008, e: 0x103e, vr: 'LO', value: 'T2 SAG' },
            { g: 0x0018, e: 0x0015, vr: 'CS', value: 'LSPINE' },
            { g: 0x0020, e: 0x000e, vr: 'UI', value: '1.2.826.0.1' },
            { g: 0x0020, e: 0x0013, vr: 'IS', value: String(n) },
          ],
        }),
      );
    const r = await processUpload(v, new File([dcm(3)], 'IM000003'), deps(), undefined, { category: 'lab' });
    expect(r.phase).toBe('done');
    expect(r.file).toMatchObject({ kind: 'dicom', category: 'mr', region: 'lomber', studyDate: '2026-01-02', seriesUid: '1.2.826.0.1', sliceIndex: 3, displayName: 'LOMBER MR · T2 SAG' });
    expect(r.notes[0]).toMatch(/MR · Bel omurgası/);

    // Aynı seriden ikinci kesit; çoklu yüklemede kasa listesi dışarıdan verilir.
    const findExisting = vi.fn(async () => undefined);
    const r2 = await processUpload(v, new File([dcm(4)], 'IM000004'), { ...deps(), findExisting }, undefined, {});
    expect(findExisting).toHaveBeenCalledTimes(1);
    expect(r2.file).toMatchObject({ seriesUid: '1.2.826.0.1', sliceIndex: 4 });
  });

  it('görüntüleme türü seçilince PDF rapor MR olarak kaydedilir; dosya adından tahmin', async () => {
    const v = await vault();
    const a = await processUpload(v, new File([pdfBytes('mr')], 'rapor.pdf'), deps(), undefined, { category: 'mr' });
    expect(a.file).toMatchObject({ category: 'mr' });
    const b = await processUpload(v, new File([pdfBytes('bt')], 'Toraks BT raporu.pdf'), deps());
    expect(b.file).toMatchObject({ category: 'ct', region: 'toraks' });
    const c = await processUpload(v, new File([pdfBytes('kan')], 'Kan Tahlili Mart.pdf'), deps());
    expect(c.file).toMatchObject({ category: 'lab' });
    expect(c.file!.region).toBeUndefined();
  });

  it('DICOMDIR anlaşılır mesajla reddedilir', async () => {
    const v = await vault();
    const dir = writeDicom([{ g: 0x0004, e: 0x1130, vr: 'CS', value: 'CD' }], { sopClass: '1.2.840.10008.1.3.10' });
    const r = await processUpload(v, new File([dir], 'DICOMDIR'), deps());
    expect(r).toMatchObject({ phase: 'error' });
    expect(r.message).toMatch(/DICOMDIR/);
  });
});
