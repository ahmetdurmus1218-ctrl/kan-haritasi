import type { Bytes } from './bytes';
import { type BlobStore, type EncryptedRecord, type RecordStore, type VaultMeta, assertStorageKey } from './stores';

const DB_NAME = 'kan-haritasi';
const DB_VERSION = 1;
const META = 'meta';
const RECORDS = 'records';
const BLOBS = 'blobs';
const META_KEY = 'vault';

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('idb tx aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('idb tx failed'));
  });
}

export function openVaultDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb open failed'));
    req.onblocked = () => reject(new Error('idb blocked'));
  });
}

async function run<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const tx = db.transaction(store, mode);
  const [result] = await Promise.all([promisify(fn(tx.objectStore(store))), done(tx)]);
  return result;
}

export class IndexedDbRecordStore implements RecordStore {
  constructor(private readonly db: IDBDatabase) {}

  getMeta() {
    return run<VaultMeta | undefined>(this.db, META, 'readonly', (s) => s.get(META_KEY));
  }
  async putMeta(meta: VaultMeta) {
    await run(this.db, META, 'readwrite', (s) => s.put(meta, META_KEY));
  }
  async deleteMeta() {
    await run(this.db, META, 'readwrite', (s) => s.delete(META_KEY));
  }
  get(id: string) {
    return run<EncryptedRecord | undefined>(this.db, RECORDS, 'readonly', (s) => s.get(id));
  }
  async put(record: EncryptedRecord) {
    await run(this.db, RECORDS, 'readwrite', (s) => s.put(record));
  }
  async delete(id: string) {
    await run(this.db, RECORDS, 'readwrite', (s) => s.delete(id));
  }
  list() {
    return run<EncryptedRecord[]>(this.db, RECORDS, 'readonly', (s) => s.getAll());
  }
  async clear() {
    await run(this.db, RECORDS, 'readwrite', (s) => s.clear());
  }
}

/** OPFS olmayan tarayıcılar için yedek gövde deposu. */
export class IndexedDbBlobStore implements BlobStore {
  constructor(private readonly db: IDBDatabase) {}

  async put(key: string, data: Bytes) {
    assertStorageKey(key);
    const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    await run(this.db, BLOBS, 'readwrite', (s) => s.put(copy, key));
  }
  async get(key: string) {
    assertStorageKey(key);
    const buf = await run<ArrayBuffer | undefined>(this.db, BLOBS, 'readonly', (s) => s.get(key));
    return buf ? new Uint8Array(buf) : undefined;
  }
  async delete(key: string) {
    assertStorageKey(key);
    await run(this.db, BLOBS, 'readwrite', (s) => s.delete(key));
  }
  async keys() {
    return (await run(this.db, BLOBS, 'readonly', (s) => s.getAllKeys())).map(String);
  }
  async clear() {
    await run(this.db, BLOBS, 'readwrite', (s) => s.clear());
  }
}
