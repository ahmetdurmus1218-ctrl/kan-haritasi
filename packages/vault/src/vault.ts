import { type Bytes, fromBase64, fromUtf8, toBase64, utf8, wipe } from './bytes';
import { KEY_BYTES, importAesKey, open, randomBytes, randomId, seal, sha256Hex } from './crypto';
import { DEFAULT_CHUNK_SIZE, decryptChunks, encryptChunks } from './fileCrypto';
import { VaultError } from './errors';
import type { KeyWrapper, WrappedMasterKey } from './kdf';
import { type BlobStore, type EncryptedRecord, type RecordKind, type RecordStore, VAULT_FORMAT_VERSION, keysOf } from './stores';

export type FileKind = 'pdf' | 'jpeg' | 'png';

/** Arayüzün gördüğü dosya bilgisi. Anahtar ve depolama anahtarı içermez. */
export interface FileInfo {
  id: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  kind: FileKind;
  size: number;
  sha256: string;
  createdAt: string;
}

/** Şifreli kaydın içi: FileInfo + dosyanın veri anahtarı (DEK) ve gövde anahtarı. */
interface StoredFile extends FileInfo {
  blobKey: string;
  dek: string;
}

export interface NewFileInput {
  bytes: Bytes;
  originalFileName: string;
  displayName: string;
  mimeType: string;
  kind: FileKind;
  /** Yedekten geri yüklerken özgün yükleme tarihi korunur (ISO 8601). */
  createdAt?: string;
}

export interface VaultOptions {
  /** Yalnızca testler için; üretimde 1 MiB. */
  chunkSize?: number;
}

export const MAX_DISPLAY_NAME = 120;
const FILE_KINDS: readonly FileKind[] = ['pdf', 'jpeg', 'png'];
// Kontrol karakterleri ve yön değiştirme karakterleri ("gpj.exe" hilesi) görünen adlarda yasak.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_NAME_CHARS = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;

function recordAad(kind: RecordKind, id: string): Bytes {
  return utf8(`kh:rec:v1:${kind}:${id}`);
}

function checkDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_DISPLAY_NAME || FORBIDDEN_NAME_CHARS.test(trimmed)) {
    throw new VaultError('INVALID_INPUT', 'bad display name');
  }
  return trimmed;
}

function isStoredFile(v: unknown): v is StoredFile {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.displayName === 'string' &&
    typeof o.originalFileName === 'string' &&
    typeof o.mimeType === 'string' &&
    typeof o.kind === 'string' &&
    FILE_KINDS.includes(o.kind as FileKind) &&
    typeof o.size === 'number' &&
    typeof o.sha256 === 'string' &&
    typeof o.createdAt === 'string' &&
    typeof o.blobKey === 'string' &&
    typeof o.dek === 'string'
  );
}

function publicInfo(s: StoredFile): FileInfo {
  const { id, displayName, originalFileName, mimeType, kind, size, sha256, createdAt } = s;
  return { id, displayName, originalFileName, mimeType, kind, size, sha256, createdAt };
}

/**
 * Cihaz içi şifreli kasa.
 *
 * Anahtar hiyerarşisi: KEK (parola/Keystore) → MK (ana anahtar) → DEK (dosya başına).
 * - MK yalnızca kilit açıkken, dışa aktarılamayan bir CryptoKey olarak bellekte durur.
 * - Her kayıt MK ile, kaydın türü ve kimliği AAD'ye bağlanarak şifrelenir.
 * - Her dosya kendi DEK'iyle parçalı şifrelenir; DEK yalnızca şifreli kaydın içinde durur.
 */
export class Vault {
  #mk: CryptoKey | null;
  readonly #records: RecordStore;
  readonly #blobs: BlobStore;
  readonly #chunkSize: number;

  private constructor(records: RecordStore, blobs: BlobStore, mk: CryptoKey, options: VaultOptions) {
    this.#records = records;
    this.#blobs = blobs;
    this.#mk = mk;
    this.#chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  }

  static async isInitialized(records: RecordStore): Promise<boolean> {
    return (await records.getMeta()) !== undefined;
  }

  /** Kasada hangi kilit açma yöntemlerinin kayıtlı olduğu (ör. parola, Android cihaz kilidi). */
  static async schemes(records: RecordStore): Promise<string[]> {
    const meta = await records.getMeta();
    return meta ? keysOf(meta).map((k) => k.scheme) : [];
  }

  /**
   * Yeni kasa. Birden fazla sarmalayıcı verilebilir: Android'de cihaz kilidi (günlük kullanım)
   * + kurtarma parolası (cihaz kilidi kaldırılırsa veya anahtar geçersizleşirse).
   * Sarmalayıcılar sırayla çalışır; biyometrik istemler üst üste binmez.
   */
  static async create(records: RecordStore, blobs: BlobStore, wrappers: KeyWrapper | KeyWrapper[], options: VaultOptions = {}): Promise<Vault> {
    const list = Array.isArray(wrappers) ? wrappers : [wrappers];
    if (list.length === 0 || new Set(list.map((w) => w.scheme)).size !== list.length) throw new VaultError('INVALID_INPUT', 'bad wrappers');
    if (await Vault.isInitialized(records)) throw new VaultError('ALREADY_INITIALIZED');
    const raw = randomBytes(KEY_BYTES);
    try {
      const keys: WrappedMasterKey[] = [];
      for (const w of list) keys.push(await w.wrap(raw));
      await records.putMeta({ formatVersion: VAULT_FORMAT_VERSION, createdAt: new Date().toISOString(), keys });
      return new Vault(records, blobs, await importAesKey(raw), options);
    } finally {
      wipe(raw);
    }
  }

  /**
   * Kilidi açar. `rewrap` verilirse ana anahtar, kilit açılırken bu sarmalayıcılarla yeniden
   * sarılır (aynı türdeki eski kayıt değiştirilir). Kullanımlar: parola değiştirme, kurtarma
   * parolasıyla açıldıktan sonra cihaz kilidini yeniden bağlama. Yeniden sarma başarısız olursa
   * kilit yine açılır; sonuç `lastRewrap` alanındadır.
   */
  static async unlock(
    records: RecordStore,
    blobs: BlobStore,
    wrapper: KeyWrapper,
    options: VaultOptions & { rewrap?: KeyWrapper[] } = {},
  ): Promise<Vault> {
    const meta = await records.getMeta();
    if (!meta) throw new VaultError('NOT_INITIALIZED');
    if (meta.formatVersion !== 1 && meta.formatVersion !== VAULT_FORMAT_VERSION) throw new VaultError('UNSUPPORTED_VERSION');
    const keys = keysOf(meta);
    const entry = keys.find((k) => k.scheme === wrapper.scheme);
    if (!entry) throw new VaultError('NOT_FOUND', 'no key for this unlock method');
    const raw = await wrapper.unwrap(entry);
    try {
      const vault = new Vault(records, blobs, await importAesKey(raw), options);
      if (options.rewrap?.length) {
        try {
          const replaced = new Set(options.rewrap.map((w) => w.scheme));
          const fresh: WrappedMasterKey[] = [];
          for (const w of options.rewrap) fresh.push(await w.wrap(raw));
          await records.putMeta({
            formatVersion: VAULT_FORMAT_VERSION,
            createdAt: meta.createdAt,
            keys: [...keys.filter((k) => !replaced.has(k.scheme)), ...fresh],
          });
          vault.lastRewrap = 'ok';
        } catch {
          vault.lastRewrap = 'failed';
        }
      }
      return vault;
    } finally {
      wipe(raw);
    }
  }

  /** Son `unlock` çağrısındaki yeniden sarmanın sonucu. */
  lastRewrap: 'none' | 'ok' | 'failed' = 'none';

  /** Belirli bir kilit açma yöntemini kaldırır (en az bir yöntem kalmalıdır). */
  async removeUnlockMethod(scheme: string): Promise<void> {
    this.#key();
    const meta = await this.#records.getMeta();
    if (!meta) throw new VaultError('NOT_INITIALIZED');
    const keys = keysOf(meta).filter((k) => k.scheme !== scheme);
    if (keys.length === 0) throw new VaultError('INVALID_INPUT', 'last unlock method');
    await this.#records.putMeta({ formatVersion: VAULT_FORMAT_VERSION, createdAt: meta.createdAt, keys });
  }

  /**
   * Parolasını unutan kullanıcı için: kilidi açmadan her şeyi siler.
   * Önce sarılı ana anahtar silinir; bu adımdan sonra kalan her bayt okunamaz hale gelir.
   */
  static async destroyWithoutUnlock(records: RecordStore, blobs: BlobStore): Promise<void> {
    await records.deleteMeta();
    await records.clear();
    await blobs.clear();
  }

  get locked(): boolean {
    return this.#mk === null;
  }

  /** Ana anahtara olan referansı bırakır. Sonraki her işlem LOCKED fırlatır. */
  lock(): void {
    this.#mk = null;
  }

  #key(): CryptoKey {
    if (!this.#mk) throw new VaultError('LOCKED');
    return this.#mk;
  }

  async #sealRecord(kind: RecordKind, id: string, value: unknown): Promise<EncryptedRecord> {
    const { iv, ct } = await seal(this.#key(), utf8(JSON.stringify(value)), recordAad(kind, id));
    return { id, kind, iv: toBase64(iv), ct: toBase64(ct) };
  }

  async #openFileRecord(record: EncryptedRecord): Promise<StoredFile> {
    if (record.kind !== 'file') throw new VaultError('INTEGRITY', 'unexpected record kind');
    const plain = await open(this.#key(), fromBase64(record.iv), fromBase64(record.ct), recordAad('file', record.id));
    let value: unknown;
    try {
      value = JSON.parse(fromUtf8(plain));
    } catch {
      throw new VaultError('INTEGRITY', 'record not json');
    }
    if (!isStoredFile(value) || value.id !== record.id) throw new VaultError('INTEGRITY', 'record shape');
    return value;
  }

  async #getStored(id: string): Promise<StoredFile> {
    const record = await this.#records.get(id);
    if (!record) throw new VaultError('NOT_FOUND');
    return this.#openFileRecord(record);
  }

  /** Orijinal baytları değiştirmeden şifreleyip saklar. */
  async addFile(input: NewFileInput): Promise<FileInfo> {
    this.#key();
    if (!FILE_KINDS.includes(input.kind)) throw new VaultError('INVALID_INPUT', 'bad kind');
    if (input.bytes.length === 0) throw new VaultError('INVALID_INPUT', 'empty file');
    const displayName = checkDisplayName(input.displayName);

    const id = randomId();
    const blobKey = randomId();
    const dekRaw = randomBytes(KEY_BYTES);
    try {
      const dek = await importAesKey(dekRaw);
      const sha256 = await sha256Hex(input.bytes);
      const blob = await encryptChunks(dek, id, input.bytes, this.#chunkSize);
      const stored: StoredFile = {
        id,
        displayName,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        kind: input.kind,
        size: input.bytes.length,
        sha256,
        createdAt: input.createdAt && !Number.isNaN(Date.parse(input.createdAt)) ? new Date(input.createdAt).toISOString() : new Date().toISOString(),
        blobKey,
        dek: toBase64(dekRaw),
      };
      await this.#blobs.put(blobKey, blob);
      try {
        await this.#records.put(await this.#sealRecord('file', id, stored));
      } catch (e) {
        await this.#blobs.delete(blobKey).catch(() => undefined);
        throw e;
      }
      return publicInfo(stored);
    } finally {
      wipe(dekRaw);
    }
  }

  /** Tüm dosyalar, yeniden eskiye. Doğrulanamayan kayıtlar listeye girmez, kimlikleri ayrıca döner. */
  async listFiles(): Promise<{ files: FileInfo[]; corruptIds: string[] }> {
    this.#key();
    const files: FileInfo[] = [];
    const corruptIds: string[] = [];
    for (const record of await this.#records.list()) {
      if (record.kind !== 'file') continue;
      try {
        files.push(publicInfo(await this.#openFileRecord(record)));
      } catch (e) {
        if (e instanceof VaultError && e.code === 'LOCKED') throw e;
        corruptIds.push(record.id);
      }
    }
    files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { files, corruptIds };
  }

  async getFileInfo(id: string): Promise<FileInfo> {
    return publicInfo(await this.#getStored(id));
  }

  /** Dosyayı çözer ve SHA-256 ile orijinalle bayt bayt aynı olduğunu doğrular. */
  async readFile(id: string): Promise<{ info: FileInfo; bytes: Bytes }> {
    const stored = await this.#getStored(id);
    const blob = await this.#blobs.get(stored.blobKey);
    if (!blob) throw new VaultError('NOT_FOUND', 'blob missing');
    const dekRaw = fromBase64(stored.dek);
    let bytes: Bytes;
    try {
      bytes = await decryptChunks(await importAesKey(dekRaw), stored.id, blob);
    } finally {
      wipe(dekRaw);
    }
    if (bytes.length !== stored.size || (await sha256Hex(bytes)) !== stored.sha256) {
      throw new VaultError('INTEGRITY', 'checksum mismatch');
    }
    return { info: publicInfo(stored), bytes };
  }

  async findBySha256(sha256: string): Promise<FileInfo | undefined> {
    const { files } = await this.listFiles();
    return files.find((f) => f.sha256 === sha256);
  }

  async renameFile(id: string, displayName: string): Promise<FileInfo> {
    const stored = await this.#getStored(id);
    const updated: StoredFile = { ...stored, displayName: checkDisplayName(displayName) };
    await this.#records.put(await this.#sealRecord('file', id, updated));
    return publicInfo(updated);
  }

  /**
   * Silme sırası önemlidir: önce DEK'i taşıyan kayıt silinir (kripto-imha), sonra şifreli gövde.
   * Gövde silinemese bile anahtarı olmadığı için okunamaz; sonraki `sweepOrphans` onu temizler.
   */
  async deleteFile(id: string): Promise<void> {
    const stored = await this.#getStored(id);
    await this.#records.delete(id);
    await this.#blobs.delete(stored.blobKey);
  }

  /** Hiçbir kayda bağlı olmayan şifreli gövdeleri siler (yarım kalmış yükleme/silme). */
  async sweepOrphans(): Promise<number> {
    this.#key();
    const live = new Set<string>();
    for (const record of await this.#records.list()) {
      if (record.kind !== 'file') continue;
      try {
        live.add((await this.#openFileRecord(record)).blobKey);
      } catch {
        // Doğrulanamayan kaydın gövdesini tahminle silmeyiz.
        return 0;
      }
    }
    let removed = 0;
    for (const key of await this.#blobs.keys()) {
      if (!live.has(key)) {
        await this.#blobs.delete(key);
        removed++;
      }
    }
    return removed;
  }

  // ------------------------------------------------------------------ Genel şifreli kayıtlar

  /** Belge dışı kayıtlar (rapor, takma ad, profil). Değer JSON'a çevrilip MK ile şifrelenir. */
  async putRecord(kind: Exclude<RecordKind, 'file'>, id: string, value: unknown): Promise<void> {
    this.#key();
    if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new VaultError('INVALID_INPUT', 'bad record id');
    await this.#records.put(await this.#sealRecord(kind, id, value));
  }

  async getRecord<T>(kind: Exclude<RecordKind, 'file'>, id: string): Promise<T | undefined> {
    const record = await this.#records.get(id);
    if (!record) return undefined;
    if (record.kind !== kind) throw new VaultError('INTEGRITY', 'record kind mismatch');
    return this.#openJson<T>(record);
  }

  /** Doğrulanamayan kayıtlar atlanır ve kimlikleri ayrıca döner. */
  async listRecords<T>(kind: Exclude<RecordKind, 'file'>): Promise<{ items: Array<{ id: string; value: T }>; corruptIds: string[] }> {
    this.#key();
    const items: Array<{ id: string; value: T }> = [];
    const corruptIds: string[] = [];
    for (const record of await this.#records.list()) {
      if (record.kind !== kind) continue;
      try {
        items.push({ id: record.id, value: await this.#openJson<T>(record) });
      } catch (e) {
        if (e instanceof VaultError && e.code === 'LOCKED') throw e;
        corruptIds.push(record.id);
      }
    }
    return { items, corruptIds };
  }

  async deleteRecord(kind: Exclude<RecordKind, 'file'>, id: string): Promise<void> {
    this.#key();
    const record = await this.#records.get(id);
    if (!record) return;
    if (record.kind !== kind) throw new VaultError('INTEGRITY', 'record kind mismatch');
    await this.#records.delete(id);
  }

  async #openJson<T>(record: EncryptedRecord): Promise<T> {
    const plain = await open(this.#key(), fromBase64(record.iv), fromBase64(record.ct), recordAad(record.kind, record.id));
    try {
      return JSON.parse(fromUtf8(plain)) as T;
    } catch {
      throw new VaultError('INTEGRITY', 'record not json');
    }
  }

  async usage(): Promise<{ count: number; bytes: number }> {
    const { files } = await this.listFiles();
    return { count: files.length, bytes: files.reduce((n, f) => n + f.size, 0) };
  }

  /** Tüm veriyi siler: önce sarılı ana anahtar, sonra kayıtlar ve gövdeler. */
  async destroyAll(): Promise<void> {
    this.#mk = null;
    await Vault.destroyWithoutUnlock(this.#records, this.#blobs);
  }
}
