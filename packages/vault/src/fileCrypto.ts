import { type Bytes, concat, readU32be, u32be, utf8 } from './bytes';
import { IV_BYTES, TAG_BYTES, open, seal } from './crypto';
import { VaultError } from './errors';

/**
 * Parçalı dosya şifreleme biçimi (KHB1):
 *
 *   "KHB1" | u32 chunkSize | (iv[12] | ct[len+16])*
 *
 * Her parça kendi rastgele IV'si ve şu ek doğrulama verisiyle (AAD) şifrelenir:
 *   "kh:chunk:v1:" | fileId | u32 chunkSize | u32 parçaNo | u8 sonParça
 *
 * Böylece parçaların sırası değiştirilirse, sona parça eklenir/çıkarılırsa ya da
 * gövde başka bir dosyanın kaydına taşınırsa şifre çözme başarısız olur.
 */
export const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const MAGIC = utf8('KHB1');
const HEADER_BYTES = MAGIC.length + 4;
const MIN_CHUNK = 1024;
const MAX_CHUNK = 16 * 1024 * 1024;

function chunkAad(fileId: string, chunkSize: number, index: number, final: boolean): Bytes {
  return concat(utf8('kh:chunk:v1:'), utf8(fileId), u32be(chunkSize), u32be(index), Uint8Array.of(final ? 1 : 0));
}

export async function encryptChunks(key: CryptoKey, fileId: string, plain: Bytes, chunkSize = DEFAULT_CHUNK_SIZE): Promise<Bytes> {
  if (!Number.isInteger(chunkSize) || chunkSize < MIN_CHUNK || chunkSize > MAX_CHUNK) {
    throw new VaultError('INVALID_INPUT', 'bad chunk size');
  }
  const count = Math.max(1, Math.ceil(plain.length / chunkSize));
  const parts: Uint8Array[] = [MAGIC, u32be(chunkSize)];
  for (let i = 0; i < count; i++) {
    const slice = plain.subarray(i * chunkSize, Math.min(plain.length, (i + 1) * chunkSize));
    const { iv, ct } = await seal(key, slice, chunkAad(fileId, chunkSize, i, i === count - 1));
    parts.push(iv, ct);
  }
  return concat(...parts);
}

export async function decryptChunks(key: CryptoKey, fileId: string, blob: Bytes): Promise<Bytes> {
  if (blob.length < HEADER_BYTES + IV_BYTES + TAG_BYTES) throw new VaultError('INTEGRITY', 'blob too short');
  for (let i = 0; i < MAGIC.length; i++) {
    if (blob[i] !== MAGIC[i]) throw new VaultError('INTEGRITY', 'bad magic');
  }
  const chunkSize = readU32be(blob, MAGIC.length);
  if (chunkSize < MIN_CHUNK || chunkSize > MAX_CHUNK) throw new VaultError('INTEGRITY', 'bad chunk size');

  const fullSegment = IV_BYTES + chunkSize + TAG_BYTES;
  const out: Uint8Array[] = [];
  let offset = HEADER_BYTES;
  let index = 0;
  while (offset < blob.length) {
    const remaining = blob.length - offset;
    const final = remaining <= fullSegment;
    const segment = final ? remaining : fullSegment;
    if (segment < IV_BYTES + TAG_BYTES) throw new VaultError('INTEGRITY', 'truncated segment');
    const iv = blob.slice(offset, offset + IV_BYTES);
    const ct = blob.slice(offset + IV_BYTES, offset + segment);
    out.push(await open(key, iv, ct, chunkAad(fileId, chunkSize, index, final)));
    offset += segment;
    index++;
  }
  return concat(...out);
}
