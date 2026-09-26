import { argon2id } from 'hash-wasm';
import { type Bytes, fromBase64, toBase64, utf8, wipe } from './bytes';
import { importAesKey, open, seal, randomBytes } from './crypto';
import { VaultError, isVaultError } from './errors';

/**
 * Ana anahtarın (MK) nasıl sarıldığını soyutlar.
 * - Web: parola + Argon2id  → PassphraseKeyWrapper
 * - Android (Faz 2): Keystore'daki biyometrik anahtar → köprü üzerinden native sarmalayıcı
 */
export interface WrappedMasterKey {
  scheme: string;
  [field: string]: unknown;
}

export interface KeyWrapper {
  readonly scheme: string;
  wrap(masterKey: Bytes): Promise<WrappedMasterKey>;
  /** Yanlış parola/biyometri durumunda VaultError('WRONG_PASSPHRASE') fırlatır. */
  unwrap(wrapped: WrappedMasterKey): Promise<Bytes>;
}

export interface Argon2Params {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/** OWASP'ın Argon2id önerileriyle uyumlu başlangıç değerleri; telefonda ~0,5–1 sn. */
export const DEFAULT_ARGON2: Argon2Params = { memoryKiB: 64 * 1024, iterations: 3, parallelism: 1 };

// Depodaki meta verisi kurcalanıp devasa parametrelerle cihazı kilitlemesin diye sınırlar.
const LIMITS = { memoryKiB: [8 * 1024, 1024 * 1024], iterations: [1, 20], parallelism: [1, 4] } as const;

export const MIN_PASSPHRASE_LENGTH = 10;
const SCHEME = 'argon2id-aesgcm-v1';
const AAD = utf8('kh:mk:v1');

function checkParams(p: Argon2Params): Argon2Params {
  const within = (v: unknown, [lo, hi]: readonly [number, number]) =>
    typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  if (!within(p.memoryKiB, LIMITS.memoryKiB) || !within(p.iterations, LIMITS.iterations) || !within(p.parallelism, LIMITS.parallelism)) {
    throw new VaultError('INVALID_INPUT', 'argon2 params out of bounds');
  }
  return p;
}

async function deriveKek(passphrase: string, salt: Bytes, p: Argon2Params): Promise<CryptoKey> {
  const raw = await argon2id({
    password: passphrase.normalize('NFKC'),
    salt,
    parallelism: p.parallelism,
    iterations: p.iterations,
    memorySize: p.memoryKiB,
    hashLength: 32,
    outputType: 'binary',
  });
  const bytes = new Uint8Array(raw);
  try {
    return await importAesKey(bytes);
  } finally {
    wipe(bytes);
    wipe(raw);
  }
}

export class PassphraseKeyWrapper implements KeyWrapper {
  readonly scheme = SCHEME;
  readonly #passphrase: string;
  readonly #params: Argon2Params;

  constructor(passphrase: string, params: Argon2Params = DEFAULT_ARGON2) {
    this.#passphrase = passphrase;
    this.#params = checkParams(params);
  }

  async wrap(masterKey: Bytes): Promise<WrappedMasterKey> {
    if (this.#passphrase.normalize('NFKC').length < MIN_PASSPHRASE_LENGTH) {
      throw new VaultError('INVALID_INPUT', 'passphrase too short');
    }
    const salt = randomBytes(16);
    const kek = await deriveKek(this.#passphrase, salt, this.#params);
    const { iv, ct } = await seal(kek, masterKey, AAD);
    return { scheme: SCHEME, params: { ...this.#params }, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct) };
  }

  async unwrap(wrapped: WrappedMasterKey): Promise<Bytes> {
    if (wrapped.scheme !== SCHEME) throw new VaultError('UNSUPPORTED_VERSION', 'unknown key scheme');
    const { params, salt, iv, ct } = wrapped as Record<string, unknown>;
    if (typeof salt !== 'string' || typeof iv !== 'string' || typeof ct !== 'string' || typeof params !== 'object' || params === null) {
      throw new VaultError('INTEGRITY', 'malformed wrapped key');
    }
    const kek = await deriveKek(this.#passphrase, fromBase64(salt), checkParams(params as Argon2Params));
    try {
      return await open(kek, fromBase64(iv), fromBase64(ct), AAD);
    } catch (e) {
      // GCM doğrulaması başarısız: parola yanlış (ya da meta verisi kurcalanmış; ikisi ayırt edilemez).
      if (isVaultError(e, 'INTEGRITY')) throw new VaultError('WRONG_PASSPHRASE');
      throw e;
    }
  }
}
