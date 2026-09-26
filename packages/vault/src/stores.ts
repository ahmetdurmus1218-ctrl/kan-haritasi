import type { Bytes } from './bytes';
import type { WrappedMasterKey } from './kdf';

export const VAULT_FORMAT_VERSION = 2;

/**
 * Açık (şifresiz) tutulan tek kayıt: yalnızca sarılı ana anahtar(lar) ve biçim bilgisi.
 * Sürüm 2: birden fazla kilit açma yöntemi (`keys`). Sürüm 1: tek `wrapped`.
 */
export interface VaultMeta {
  formatVersion: number;
  createdAt: string;
  keys?: WrappedMasterKey[];
  wrapped?: WrappedMasterKey;
}

export function keysOf(meta: VaultMeta): WrappedMasterKey[] {
  if (Array.isArray(meta.keys)) return meta.keys;
  return meta.wrapped ? [meta.wrapped] : [];
}

/** 'file': belge; 'report': onaylanmış sonuçlar; 'alias': kullanıcının eşlediği test adları; 'profile': tercihler. */
export type RecordKind = 'file' | 'report' | 'alias' | 'profile';

/** Diskteki şifreli kayıt. Açık alanlar yalnızca rastgele kimlik ve kayıt türüdür. */
export interface EncryptedRecord {
  id: string;
  kind: RecordKind;
  iv: string;
  ct: string;
}

export interface RecordStore {
  getMeta(): Promise<VaultMeta | undefined>;
  putMeta(meta: VaultMeta): Promise<void>;
  deleteMeta(): Promise<void>;
  get(id: string): Promise<EncryptedRecord | undefined>;
  put(record: EncryptedRecord): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<EncryptedRecord[]>;
  clear(): Promise<void>;
}

/** Şifreli dosya gövdeleri. Anahtarlar rastgele UUID'dir; dosya adı veya kullanıcıyla ilişkisi yoktur. */
export interface BlobStore {
  put(key: string, data: Bytes): Promise<void>;
  get(key: string): Promise<Bytes | undefined>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Depolama anahtarları yalnızca UUID olabilir; yol ayırıcı, `..` vb. içeremez. */
export function assertStorageKey(key: string): void {
  if (!UUID_RE.test(key)) throw new Error('invalid storage key');
}

export class MemoryRecordStore implements RecordStore {
  meta: VaultMeta | undefined;
  readonly records = new Map<string, EncryptedRecord>();

  async getMeta() {
    return this.meta ? structuredClone(this.meta) : undefined;
  }
  async putMeta(meta: VaultMeta) {
    this.meta = structuredClone(meta);
  }
  async deleteMeta() {
    this.meta = undefined;
  }
  async get(id: string) {
    const r = this.records.get(id);
    return r ? { ...r } : undefined;
  }
  async put(record: EncryptedRecord) {
    this.records.set(record.id, { ...record });
  }
  async delete(id: string) {
    this.records.delete(id);
  }
  async list() {
    return [...this.records.values()].map((r) => ({ ...r }));
  }
  async clear() {
    this.records.clear();
  }
}

export class MemoryBlobStore implements BlobStore {
  readonly blobs = new Map<string, Bytes>();

  async put(key: string, data: Bytes) {
    assertStorageKey(key);
    this.blobs.set(key, new Uint8Array(data));
  }
  async get(key: string) {
    assertStorageKey(key);
    const b = this.blobs.get(key);
    return b ? new Uint8Array(b) : undefined;
  }
  async delete(key: string) {
    assertStorageKey(key);
    this.blobs.delete(key);
  }
  async keys() {
    return [...this.blobs.keys()];
  }
  async clear() {
    this.blobs.clear();
  }
}
