import { type Bytes, toHex } from './bytes';
import { VaultError } from './errors';

export const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new VaultError('STORAGE', 'WebCrypto unavailable (insecure context?)');
  return s;
}

export function randomBytes(length: number): Bytes {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomId(): string {
  return globalThis.crypto.randomUUID();
}

/** Ham anahtardan, dışa aktarılamayan (non-extractable) bir AES-GCM anahtarı üretir. */
export async function importAesKey(raw: Bytes): Promise<CryptoKey> {
  if (raw.length !== KEY_BYTES) throw new VaultError('INTEGRITY', 'bad key length');
  return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface Sealed {
  iv: Bytes;
  ct: Bytes;
}

/** AES-256-GCM ile şifreler. Her çağrıda yeni rastgele 96 bit IV kullanılır. */
export async function seal(key: CryptoKey, plaintext: Bytes, aad: Bytes): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: TAG_BYTES * 8 },
    key,
    plaintext,
  );
  return { iv, ct: new Uint8Array(ct) };
}

/**
 * Şifre çözer ve doğrular. Anahtar, IV, AAD veya şifreli metin tek bir bit bile
 * farklıysa INTEGRITY hatası fırlatır; kısmi veri asla döndürülmez.
 */
export async function open(key: CryptoKey, iv: Bytes, ct: Bytes, aad: Bytes): Promise<Bytes> {
  if (iv.length !== IV_BYTES || ct.length < TAG_BYTES) throw new VaultError('INTEGRITY', 'malformed ciphertext');
  try {
    const pt = await subtle().decrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: TAG_BYTES * 8 },
      key,
      ct,
    );
    return new Uint8Array(pt);
  } catch {
    throw new VaultError('INTEGRITY', 'authentication failed');
  }
}

export async function sha256Hex(data: Bytes): Promise<string> {
  return toHex(new Uint8Array(await subtle().digest('SHA-256', data)));
}
