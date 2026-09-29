/**
 * ZIP arşivindeki dosyaları cihazda açar (ör. hastanenin verdiği "görüntüler.zip" içindeki DICOM serisi).
 *
 * Arşiv belleğe bir kerede alınmaz: merkez dizin dosyanın sonundan okunur, her girdi ancak sırası
 * geldiğinde (open) okunup açılır. Yalnızca "stored" (0) ve "deflate" (8) desteklenir; şifreli ya da
 * başka yöntemle sıkıştırılmış girdiler atlanır. Açılan veri, girdinin bildirdiği boyutu ve üst sınırı
 * aşarsa durdurulur (sıkıştırma bombasına karşı). Hiçbir şey ağa gönderilmez.
 */

export interface ZipLimits {
  /** Arşivde değerlendirilecek en fazla girdi. */
  maxEntries: number;
  /** Tek girdinin açılmış en büyük boyutu (bayt). */
  maxEntryBytes: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = { maxEntries: 5000, maxEntryBytes: 60 * 1024 * 1024 };

export interface ZipItem {
  /** Klasör yolu atılmış dosya adı. */
  name: string;
  /** Arşiv içindeki tam yol (yalnızca sıralama/gruplama için). */
  path: string;
  size: number;
  open(): Promise<Uint8Array<ArrayBuffer>>;
}

export class ZipError extends Error {
  constructor(readonly code: 'NOT_ZIP' | 'CORRUPT') {
    super(code === 'NOT_ZIP' ? 'ZIP arşivi değil.' : 'ZIP arşivi bozuk ya da eksik.');
    this.name = 'ZipError';
  }
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const SIG_END64 = 0x06064b50;
const SIG_END64_LOCATOR = 0x07064b50;
const MAX_COMMENT = 0xffff;

/** Baytlar ZIP imzasıyla (PK\x03\x04 veya boş arşiv PK\x05\x06) mı başlıyor? */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6));
}

async function read(blob: Blob, start: number, length: number): Promise<DataView> {
  if (start < 0 || start + length > blob.size) throw new ZipError('CORRUPT');
  return new DataView(await blob.slice(start, start + length).arrayBuffer());
}

const u64 = (v: DataView, at: number) => Number(v.getBigUint64(at, true));

async function locateCentralDirectory(blob: Blob): Promise<{ offset: number; size: number; count: number }> {
  const tailLen = Math.min(blob.size, 22 + MAX_COMMENT);
  const tailStart = blob.size - tailLen;
  const tail = await read(blob, tailStart, tailLen);
  let end = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError(blob.size >= 4 ? 'NOT_ZIP' : 'CORRUPT');
  let count = tail.getUint16(end + 10, true);
  let size = tail.getUint32(end + 12, true);
  let offset = tail.getUint32(end + 16, true);
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    // ZIP64: son kaydın hemen önünde yer gösterici bulunur.
    const locAt = tailStart + end - 20;
    const loc = await read(blob, locAt, 20);
    if (loc.getUint32(0, true) !== SIG_END64_LOCATOR) throw new ZipError('CORRUPT');
    const rec = await read(blob, u64(loc, 8), 56);
    if (rec.getUint32(0, true) !== SIG_END64) throw new ZipError('CORRUPT');
    count = u64(rec, 32);
    size = u64(rec, 40);
    offset = u64(rec, 48);
  }
  if (offset + size > blob.size) throw new ZipError('CORRUPT');
  return { offset, size, count };
}

async function inflate(data: Blob, expected: number, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const limit = Math.min(expected, max);
  const out = new Uint8Array(new ArrayBuffer(limit));
  let filled = 0;
  const reader = data.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (filled + value.length > limit) throw new ZipError('CORRUPT');
      out.set(value, filled);
      filled += value.length;
    }
  } catch (e) {
    void reader.cancel().catch(() => undefined);
    throw e instanceof ZipError ? e : new ZipError('CORRUPT');
  }
  if (filled !== expected) throw new ZipError('CORRUPT');
  return out;
}

/**
 * Arşivin dosya listesi. Klasörler ve macOS yan dosyaları (__MACOSX, ._*) sessizce atlanır; açılamayacak
 * (şifreli, desteklenmeyen yöntem, sınırdan büyük) ya da sınır dışında kalan girdiler `skipped`'e sayılır.
 */
export async function openZip(blob: Blob, limits: ZipLimits = DEFAULT_ZIP_LIMITS): Promise<{ entries: ZipItem[]; skipped: number }> {
  const cd = await locateCentralDirectory(blob);
  const dir = await read(blob, cd.offset, cd.size);
  const decoder = new TextDecoder('utf-8');
  const entries: ZipItem[] = [];
  let skipped = 0;
  let p = 0;
  for (let n = 0; n < cd.count; n++) {
    if (p + 46 > dir.byteLength || dir.getUint32(p, true) !== SIG_CENTRAL) throw new ZipError('CORRUPT');
    const flags = dir.getUint16(p + 8, true);
    const method = dir.getUint16(p + 10, true);
    let compressed = dir.getUint32(p + 20, true);
    let size = dir.getUint32(p + 24, true);
    const nameLen = dir.getUint16(p + 28, true);
    const extraLen = dir.getUint16(p + 30, true);
    const commentLen = dir.getUint16(p + 32, true);
    let local = dir.getUint32(p + 42, true);
    if (p + 46 + nameLen + extraLen > dir.byteLength) throw new ZipError('CORRUPT');
    const path = decoder.decode(new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLen));
    // ZIP64 ek alanı: yalnızca 0xFFFFFFFF olan alanlar sırayla burada yer alır.
    for (let e = p + 46 + nameLen; e + 4 <= p + 46 + nameLen + extraLen; ) {
      const id = dir.getUint16(e, true);
      const len = dir.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff && q + 8 <= e + 4 + len) {
          size = u64(dir, q);
          q += 8;
        }
        if (compressed === 0xffffffff && q + 8 <= e + 4 + len) {
          compressed = u64(dir, q);
          q += 8;
        }
        if (local === 0xffffffff && q + 8 <= e + 4 + len) local = u64(dir, q);
      }
      e += 4 + len;
    }
    p += 46 + nameLen + extraLen + commentLen;

    const name = path.split(/[\\/]/).pop() ?? '';
    if (!name || path.endsWith('/') || path.startsWith('__MACOSX/') || name.startsWith('._')) continue;
    if (entries.length >= limits.maxEntries || flags & 1 || (method !== 0 && method !== 8) || size > limits.maxEntryBytes || local + 30 > blob.size) {
      skipped++;
      continue;
    }
    const at = local;
    const csize = compressed;
    entries.push({
      name,
      path,
      size,
      async open() {
        const head = await read(blob, at, 30);
        if (head.getUint32(0, true) !== SIG_LOCAL) throw new ZipError('CORRUPT');
        const start = at + 30 + head.getUint16(26, true) + head.getUint16(28, true);
        if (start + csize > blob.size) throw new ZipError('CORRUPT');
        const data = blob.slice(start, start + csize);
        if (method === 0) {
          if (csize !== size) throw new ZipError('CORRUPT');
          return new Uint8Array(await data.arrayBuffer());
        }
        return inflate(data, size, limits.maxEntryBytes);
      },
    });
  }
  return { entries, skipped };
}
