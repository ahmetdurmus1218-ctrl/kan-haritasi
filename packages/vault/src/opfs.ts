import type { Bytes } from './bytes';
import { IndexedDbBlobStore, IndexedDbRecordStore, openVaultDb } from './idb';
import { type BlobStore, type RecordStore, assertStorageKey } from './stores';

const DIR = 'kh-blobs';

/** Origin Private File System: kullanıcıya ve diğer sitelere görünmeyen, uygulamaya özel dosya alanı. */
export class OpfsBlobStore implements BlobStore {
  private constructor(private readonly dir: FileSystemDirectoryHandle) {}

  static async open(): Promise<OpfsBlobStore> {
    const root = await navigator.storage.getDirectory();
    return new OpfsBlobStore(await root.getDirectoryHandle(DIR, { create: true }));
  }

  /** `createWritable` desteklenmiyorsa (bazı Safari sürümleri) false döner. */
  static async isSupported(): Promise<boolean> {
    try {
      if (!navigator.storage?.getDirectory) return false;
      const root = await navigator.storage.getDirectory();
      const probe = await root.getFileHandle('.kh-probe', { create: true });
      const ok = typeof (probe as FileSystemFileHandle & { createWritable?: unknown }).createWritable === 'function';
      await root.removeEntry('.kh-probe');
      return ok;
    } catch {
      return false;
    }
  }

  async put(key: string, data: Bytes) {
    assertStorageKey(key);
    const handle = await this.dir.getFileHandle(key, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(data);
      await writable.close();
    } catch (e) {
      await writable.abort().catch(() => undefined);
      throw e;
    }
  }

  async get(key: string) {
    assertStorageKey(key);
    try {
      const file = await (await this.dir.getFileHandle(key)).getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') return undefined;
      throw e;
    }
  }

  async delete(key: string) {
    assertStorageKey(key);
    try {
      await this.dir.removeEntry(key);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e;
    }
  }

  async keys() {
    const out: string[] = [];
    for await (const name of this.dir.keys()) out.push(name);
    return out;
  }

  async clear() {
    for (const name of await this.keys()) await this.dir.removeEntry(name);
  }
}

export interface BrowserStores {
  records: RecordStore;
  blobs: BlobStore;
  blobBackend: 'opfs' | 'indexeddb';
}

/**
 * OPFS'e yazar; okurken ve silerken IndexedDB yedeğine de bakar. Böylece tarayıcı
 * sonradan OPFS desteği kazanırsa eski gövdeler kaybolmaz ve silme her iki yerde yapılır.
 */
class LayeredBlobStore implements BlobStore {
  constructor(private readonly primary: BlobStore, private readonly legacy: BlobStore) {}
  put(key: string, data: Bytes) {
    return this.primary.put(key, data);
  }
  async get(key: string) {
    return (await this.primary.get(key)) ?? (await this.legacy.get(key));
  }
  async delete(key: string) {
    await this.primary.delete(key);
    await this.legacy.delete(key);
  }
  async keys() {
    return [...new Set([...(await this.primary.keys()), ...(await this.legacy.keys())])];
  }
  async clear() {
    await this.primary.clear();
    await this.legacy.clear();
  }
}

export async function openBrowserStores(): Promise<BrowserStores> {
  const db = await openVaultDb();
  const records = new IndexedDbRecordStore(db);
  const idbBlobs = new IndexedDbBlobStore(db);
  if (await OpfsBlobStore.isSupported()) {
    return { records, blobs: new LayeredBlobStore(await OpfsBlobStore.open(), idbBlobs), blobBackend: 'opfs' };
  }
  return { records, blobs: idbBlobs, blobBackend: 'indexeddb' };
}
