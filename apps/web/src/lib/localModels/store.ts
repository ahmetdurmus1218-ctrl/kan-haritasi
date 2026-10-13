/**
 * Cihazda kurulu tıbbi görüntü modelleri (ONNX + manifest). Modeller hasta verisi değildir; kasadan
 * ayrı bir IndexedDB veritabanında tutulur ve hiçbir yere gönderilmez. Kurulumda manifest doğrulanır
 * ve model dosyasının SHA-256 özeti manifestle eşleşmezse model kabul edilmez.
 */
import { useSyncExternalStore } from 'react';
import { type ModelManifest, validateManifest } from '@kh/analysis';
import { readAppAsset, readAppJson } from '../appAssets';

export interface StoredModel {
  manifest: ModelManifest;
  size: number;
  importedAt: string;
  /** bundled: uygulamayla gelen (APK / web paketi); installed: kullanıcının cihaza kurduğu. */
  origin?: 'bundled' | 'installed';
}

export interface ModelBackend {
  list(): Promise<StoredModel[]>;
  bytes(id: string): Promise<ArrayBuffer | undefined>;
  put(meta: StoredModel, bytes: ArrayBuffer): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Bir model dosyası en fazla bu kadar olabilir (cihaz belleği). */
export const MAX_MODEL_BYTES = 600 * 1024 * 1024;

const DB = 'kh-local-models';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('indexeddb'));
  });
}

function openDb(): Promise<IDBDatabase> {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => {
    r.result.createObjectStore('meta');
    r.result.createObjectStore('bytes');
  };
  return req(r);
}

export const indexedDbBackend: ModelBackend = {
  async list() {
    const db = await openDb();
    try {
      return (await req(db.transaction('meta').objectStore('meta').getAll())) as StoredModel[];
    } finally {
      db.close();
    }
  },
  async bytes(id) {
    const db = await openDb();
    try {
      return (await req(db.transaction('bytes').objectStore('bytes').get(id))) as ArrayBuffer | undefined;
    } finally {
      db.close();
    }
  },
  async put(meta, bytes) {
    const db = await openDb();
    try {
      const tx = db.transaction(['meta', 'bytes'], 'readwrite');
      tx.objectStore('meta').put(meta, meta.manifest.id);
      tx.objectStore('bytes').put(bytes, meta.manifest.id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('indexeddb'));
      });
    } finally {
      db.close();
    }
  },
  async remove(id) {
    const db = await openDb();
    try {
      const tx = db.transaction(['meta', 'bytes'], 'readwrite');
      tx.objectStore('meta').delete(id);
      tx.objectStore('bytes').delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('indexeddb'));
      });
    } finally {
      db.close();
    }
  },
};

let backend: ModelBackend = typeof indexedDB === 'undefined' ? memoryBackend() : indexedDbBackend;

/** Testler için bellek içi depo. */
export function memoryBackend(): ModelBackend {
  const meta = new Map<string, StoredModel>();
  const blobs = new Map<string, ArrayBuffer>();
  return {
    list: async () => [...meta.values()],
    bytes: async (id) => blobs.get(id),
    put: async (m, b) => {
      meta.set(m.manifest.id, m);
      blobs.set(m.manifest.id, b);
    },
    remove: async (id) => {
      meta.delete(id);
      blobs.delete(id);
    },
  };
}

export function setModelBackend(b: ModelBackend) {
  backend = b;
  cache = null;
  emit();
}

let cache: StoredModel[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/* ------------------------------------------------------------------ Uygulamayla gelen modeller */

let bundledSource: () => Promise<StoredModel[]> = loadBundled;
let bundled: Promise<StoredModel[]> | null = null;

/** ai-models/index.json + her modelin manifesti (uygulamanın kendi dosyaları). Yoksa boş liste. */
async function loadBundled(): Promise<StoredModel[]> {
  if (typeof document === 'undefined') return [];
  try {
    const index = await readAppJson<{ schema: string; models: string[] }>('ai-models/index.json');
    const out: StoredModel[] = [];
    for (const id of index.models ?? []) {
      const v = validateManifest(await readAppJson<unknown>(`ai-models/${id}/manifest.json`));
      if (v.ok) out.push({ manifest: v.manifest, size: v.manifest.size ?? 0, importedAt: '', origin: 'bundled' });
    }
    return out;
  } catch {
    return [];
  }
}

/** Testler için: uygulamayla gelen modellerin kaynağını değiştir. */
export function setBundledSource(src: () => Promise<StoredModel[]>) {
  bundledSource = src;
  bundled = null;
  cache = null;
}

async function refresh() {
  try {
    bundled ??= bundledSource();
    const [b, mine] = await Promise.all([bundled, backend.list()]);
    const ids = new Set(b.map((m) => m.manifest.id));
    cache = [...b, ...mine.filter((m) => !ids.has(m.manifest.id)).map((m) => ({ ...m, origin: 'installed' as const }))].sort(
      (a, c) => (a.origin === c.origin ? a.manifest.name.localeCompare(c.manifest.name, 'tr') : a.origin === 'bundled' ? -1 : 1),
    );
  } catch {
    cache = [];
  }
  emit();
}

/** Kurulu modeller (yüklenene kadar null). */
export function useLocalModels(): StoredModel[] | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      if (cache === null) void refresh();
      return () => listeners.delete(l);
    },
    () => cache,
    () => null,
  );
}

export async function listModels(): Promise<StoredModel[]> {
  if (cache === null) await refresh();
  return cache ?? [];
}

/** Model dosyası: uygulamayla gelen modelde paketten okunur ve SHA-256 manifestle doğrulanır. */
export async function modelBytes(id: string): Promise<ArrayBuffer | undefined> {
  const b = (await (bundled ??= bundledSource())).find((m) => m.manifest.id === id);
  if (!b) return backend.bytes(id);
  const bytes = await readAppAsset(`ai-models/${id}/${b.manifest.file}`);
  if ((await sha256Hex(bytes)) !== b.manifest.sha256) throw new Error('Uygulamayla gelen model dosyası bozuk (SHA-256 uyuşmuyor).');
  return bytes;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type ImportResult = { ok: true; manifest: ModelManifest } | { ok: false; errors: string[] };

/** Manifest (.json) + model (.onnx) dosyalarını doğrular ve kurar. */
export async function importModelFiles(files: ReadonlyArray<Pick<File, 'name' | 'size' | 'arrayBuffer' | 'text'>>): Promise<ImportResult> {
  const json = files.find((f) => f.name.toLowerCase().endsWith('.json'));
  if (!json) return { ok: false, errors: ['Manifest (.json) dosyası seçilmedi.'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await json.text());
  } catch {
    return { ok: false, errors: ['Manifest geçerli JSON değil.'] };
  }
  const v = validateManifest(parsed);
  if (!v.ok) return v;
  const m = v.manifest;
  const file = files.find((f) => f.name === m.file) ?? (files.filter((f) => f !== json).length === 1 ? files.find((f) => f !== json) : undefined);
  if (!file) return { ok: false, errors: [`Model dosyası (${m.file}) seçilmedi.`] };
  if (file.size > MAX_MODEL_BYTES) return { ok: false, errors: [`Model dosyası çok büyük (en fazla ${MAX_MODEL_BYTES / 1024 / 1024} MB).`] };
  const bytes = await file.arrayBuffer();
  const digest = await sha256Hex(bytes);
  if (digest !== m.sha256) return { ok: false, errors: ['Model dosyası manifestteki SHA-256 özetiyle eşleşmiyor; dosya bozuk ya da farklı bir model.'] };
  await backend.put({ manifest: m, size: bytes.byteLength, importedAt: new Date().toISOString() }, bytes);
  await refresh();
  return { ok: true, manifest: m };
}

export async function removeModel(id: string): Promise<void> {
  if ((await (bundled ??= bundledSource())).some((m) => m.manifest.id === id)) throw new Error('Uygulamayla gelen model kaldırılamaz.');
  await backend.remove(id);
  await refresh();
}
