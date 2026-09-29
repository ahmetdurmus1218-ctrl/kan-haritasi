import { describe, expect, it } from 'vitest';
import { ZipError, isZip, openZip } from '../zip';

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Test için küçük ZIP yazıcı (CRC doğrulanmadığı için 0 yazılır). */
async function makeZip(files: Array<{ path: string; data: Uint8Array; method?: 0 | 8; flags?: number; declared?: number }>): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path);
    const method = f.method ?? 8;
    const body = method === 8 ? await deflate(f.data) : f.data;
    const size = f.declared ?? f.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(6, f.flags ?? 0, true);
    local.setUint16(8, method, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(8, f.flags ?? 0, true);
    c.setUint16(10, method, true);
    c.setUint32(20, body.length, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, body);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
  let p = 0;
  for (const b of all) out.set(b, (p += b.length) - b.length);
  return out;
}

const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);

describe('ZIP arşivi', () => {
  it('imzayı tanır', async () => {
    expect(isZip(await makeZip([{ path: 'a', data: bytes(3) }]))).toBe(true);
    expect(isZip(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });

  it('stored ve deflate girdileri sırası gelince açar; klasör ve macOS dosyalarını atlar', async () => {
    const zip = await makeZip([
      { path: 'DICOM/', data: bytes(0), method: 0 },
      { path: 'DICOM/ST000/IM000001', data: bytes(2000, 1) },
      { path: 'DICOM/ST000/IM000002', data: bytes(50, 2), method: 0 },
      { path: '__MACOSX/DICOM/._IM000001', data: bytes(10) },
    ]);
    const { entries, skipped } = await openZip(new Blob([zip as BlobPart]));
    expect(skipped).toBe(0);
    expect(entries.map((e) => [e.name, e.path, e.size])).toEqual([
      ['IM000001', 'DICOM/ST000/IM000001', 2000],
      ['IM000002', 'DICOM/ST000/IM000002', 50],
    ]);
    expect(await entries[0]!.open()).toEqual(bytes(2000, 1));
    expect(await entries[1]!.open()).toEqual(bytes(50, 2));
  });

  it('şifreli, sınırdan büyük ve bildirilenden fazla açılan girdiyi kabul etmez', async () => {
    const zip = await makeZip([
      { path: 'gizli.dcm', data: bytes(10), flags: 1 },
      { path: 'buyuk.dcm', data: bytes(5000) },
      // Sıkıştırma bombası benzeri: küçük boyut bildirip çok daha fazla açılan girdi.
      { path: 'bomba.dcm', data: bytes(100_000, 0), declared: 100 },
    ]);
    const { entries, skipped } = await openZip(new Blob([zip as BlobPart]), { maxEntries: 10, maxEntryBytes: 4000 });
    expect(skipped).toBe(2);
    expect(entries.map((e) => e.name)).toEqual(['bomba.dcm']);
    await expect(entries[0]!.open()).rejects.toBeInstanceOf(ZipError);
  });

  it('ZIP olmayan ya da kesilmiş dosyada anlaşılır hata verir', async () => {
    await expect(openZip(new Blob([bytes(100)]))).rejects.toMatchObject({ code: 'NOT_ZIP' });
    const zip = await makeZip([{ path: 'a.dcm', data: bytes(100) }]);
    await expect(openZip(new Blob([zip.slice(20) as BlobPart]))).rejects.toBeInstanceOf(ZipError);
  });
});
