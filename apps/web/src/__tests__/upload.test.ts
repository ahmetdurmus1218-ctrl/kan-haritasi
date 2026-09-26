import { describe, expect, it, vi } from 'vitest';
import { MemoryBlobStore, MemoryRecordStore, PassphraseKeyWrapper, Vault } from '@kh/vault';
import { DEFAULT_LIMITS } from '@kh/ingest';
import { processUpload } from '../lib/upload';

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
    expect(await processUpload(v, html, deps())).toMatchObject({ phase: 'error', message: 'Dosyanın içeriği PDF, JPG veya PNG değil.' });
    v.lock();
    const r = await processUpload(v, new File([pdfBytes('d')], 'a.pdf'), deps());
    expect(r).toMatchObject({ phase: 'error', message: 'Kasa kilitlendi. Devam etmek için kilidi aç.' });
  });
});
