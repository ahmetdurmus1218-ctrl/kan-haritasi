/**
 * Küçük bayt yardımcıları. Tüm fonksiyonlar `Bytes` (ArrayBuffer tabanlı Uint8Array)
 * döndürür; WebCrypto'ya doğrudan verilebilir.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export function utf8(text: string): Bytes {
  return encoder.encode(text);
}

export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function concat(...parts: Uint8Array[]): Bytes {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function u32be(n: number): Bytes {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError('u32 out of range');
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, false);
  return out;
}

export function readU32be(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) throw new RangeError('read past end');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Bytes {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** Bellekteki anahtar baytlarını sıfırlar. JS dizelerine uygulanamaz; bu yüzden ham anahtarlar dize olarak tutulmaz. */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}

/** Kopya: ArrayBufferLike tabanlı bir diziyi WebCrypto'nun kabul ettiği `Bytes`a çevirir. */
export function toBytes(data: Uint8Array | ArrayBuffer): Bytes {
  return data instanceof ArrayBuffer ? new Uint8Array(data.slice(0)) : new Uint8Array(data);
}
