/**
 * İsteğe bağlı anatomi paketleri (.khpack): ayrıntılı Z-Anatomy modelleri (kaslar, eklemler, sinirler,
 * damarlar, lenf düğümleri, baş-boyun). Uygulama internete çıkmaz: paket dosyasını kullanıcı indirir ve
 * "Paket kur" ile seçer. Kurulumda:
 *   1. ZIP açılır; manifest.json, model.glb ve ATTRIBUTION.txt bulunmalıdır.
 *   2. Manifest biçimi, vücut (erkek/kadın) ve lisans bilgileri denetlenir.
 *   3. model.glb'nin SHA-256 özeti hem manifestle hem de uygulamaya gömülü resmi listeyle
 *      (packs.generated.ts) karşılaştırılır. Eşleşmeyen (bozuk, değiştirilmiş ya da bu sürümle
 *      yayımlanmamış) paket kurulmaz — doğrulanmamış model kullanılmaz.
 * Kurulan paket cihazda (IndexedDB) saklanır ve sonrasında internetsiz kullanılır. Model dosyaları
 * sağlık verisi değildir; kasada değil, ayrı bir veritabanında durur.
 */
import { useSyncExternalStore } from 'react';
import { strFromU8, unzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import type { BodyModel } from './assets.generated';
import { PACK_INDEX } from './packs.generated';

export type PackIndexEntry = (typeof PACK_INDEX)[number];

export interface PackManifest {
  format: string;
  version: number;
  id: string;
  body: BodyModel;
  title: string;
  summary: string;
  model: { path: string; sha256: string; bytes: number; triangles: number; elements: number };
  structures: Record<string, number>;
  replaces: string[];
  schematicReplaced: string[];
  adapted: boolean;
  sources: { src: string; name: string; license: string; url: string; commit?: string }[];
  credits?: string[];
  alignment?: { pairs: number; meanResidualMm: number; maxResidualMm: number };
}

export interface InstalledPack {
  /** "kimlik:vücut" (ör. "kaslar:male"). */
  key: string;
  manifest: PackManifest;
  attribution: string;
  installedAt: string;
}

export const PACK_FORMAT = 'kh-anatomy-pack';
/** Bir paket dosyası en fazla bu kadar olabilir (cihaz belleği). */
export const MAX_PACK_BYTES = 250 * 1024 * 1024;

export const packKey = (id: string, body: BodyModel) => `${id}:${body}`;
export const officialPack = (id: string, body: BodyModel): PackIndexEntry | undefined => PACK_INDEX.find((p) => p.id === id && p.body === body);

/* ------------------------------------------------------------------ depo */

export interface PackBackend {
  list(): Promise<InstalledPack[]>;
  glb(key: string): Promise<ArrayBuffer | undefined>;
  put(meta: InstalledPack, glb: ArrayBuffer): Promise<void>;
  remove(key: string): Promise<void>;
}

const DB = 'kh-anatomy-packs';
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
    r.result.createObjectStore('glb');
  };
  return req(r);
}
async function tx(stores: string[], fn: (t: IDBTransaction) => void): Promise<void> {
  const db = await openDb();
  try {
    const t = db.transaction(stores, 'readwrite');
    fn(t);
    await new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error ?? new Error('indexeddb'));
    });
  } finally {
    db.close();
  }
}

export const indexedDbPacks: PackBackend = {
  async list() {
    const db = await openDb();
    try {
      return (await req(db.transaction('meta').objectStore('meta').getAll())) as InstalledPack[];
    } finally {
      db.close();
    }
  },
  async glb(key) {
    const db = await openDb();
    try {
      return (await req(db.transaction('glb').objectStore('glb').get(key))) as ArrayBuffer | undefined;
    } finally {
      db.close();
    }
  },
  put: (meta, glb) =>
    tx(['meta', 'glb'], (t) => {
      t.objectStore('meta').put(meta, meta.key);
      t.objectStore('glb').put(glb, meta.key);
    }),
  remove: (key) =>
    tx(['meta', 'glb'], (t) => {
      t.objectStore('meta').delete(key);
      t.objectStore('glb').delete(key);
    }),
};

/** Testler için bellek içi depo. */
export function memoryPacks(): PackBackend {
  const meta = new Map<string, InstalledPack>();
  const blobs = new Map<string, ArrayBuffer>();
  return {
    list: async () => [...meta.values()],
    glb: async (k) => blobs.get(k),
    put: async (m, b) => {
      meta.set(m.key, m);
      blobs.set(m.key, b);
    },
    remove: async (k) => {
      meta.delete(k);
      blobs.delete(k);
    },
  };
}

let backend: PackBackend = typeof indexedDB === 'undefined' ? memoryPacks() : indexedDbPacks;
export function setPackBackend(b: PackBackend) {
  backend = b;
  void refresh();
}

/* ------------------------------------------------------------------ etkin / devre dışı (tercih) */
const DISABLED_KEY = 'kh-packs-disabled';
function readDisabled(): Set<string> {
  try {
    const v: unknown = JSON.parse(globalThis.localStorage?.getItem(DISABLED_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
let disabled = readDisabled();
export async function setPackEnabled(key: string, enabled: boolean) {
  disabled = new Set(disabled);
  if (enabled) disabled.delete(key);
  else disabled.add(key);
  try {
    globalThis.localStorage?.setItem(DISABLED_KEY, JSON.stringify([...disabled]));
  } catch {
    /* yalnız bu oturum */
  }
  await refresh();
}

/* ------------------------------------------------------------------ durum */
export interface PacksState {
  installed: InstalledPack[];
  disabled: Set<string>;
  ready: boolean;
}
let state: PacksState = { installed: [], disabled, ready: false };
const listeners = new Set<() => void>();
async function refresh() {
  let installed: InstalledPack[];
  try {
    installed = await backend.list();
  } catch {
    installed = [];
  }
  // Uygulama güncellenip resmi liste değiştiyse eski paket kullanılmaz (özet artık doğrulanamaz).
  installed = installed.filter((p) => officialPack(p.manifest.id, p.manifest.body)?.sha256 === p.manifest.model.sha256);
  installed.sort((a, b) => a.key.localeCompare(b.key));
  state = { installed, disabled, ready: true };
  for (const l of listeners) l();
}
let started = false;
export function usePacks(): PacksState {
  if (!started) {
    started = true;
    void refresh();
  }
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Seçili vücut için etkin paketler. */
export function activePacks(s: PacksState, body: BodyModel): InstalledPack[] {
  return s.installed.filter((p) => p.manifest.body === body && !s.disabled.has(p.key));
}

export async function packGlb(key: string): Promise<ArrayBuffer | undefined> {
  return backend.glb(key);
}

export async function removePack(key: string): Promise<void> {
  await backend.remove(key);
  await refresh();
}

/* ------------------------------------------------------------------ kurulum */

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class PackError extends Error {}

/** Paket dosyasını doğrular (kurmadan). Hata varsa PackError fırlatır. */
export async function verifyPack(data: ArrayBuffer): Promise<{ manifest: PackManifest; glb: ArrayBuffer; attribution: string }> {
  if (data.byteLength > MAX_PACK_BYTES) throw new PackError(`Paket çok büyük (${Math.round(data.byteLength / 1048576)} MB).`);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(data));
  } catch {
    throw new PackError('Dosya bir anatomi paketi değil (ZIP açılamadı).');
  }
  const m = files['manifest.json'];
  const g = files['model.glb'];
  const a = files['ATTRIBUTION.txt'];
  if (!m || !g) throw new PackError('Pakette manifest.json ya da model.glb yok.');
  if (!a) throw new PackError('Pakette ATTRIBUTION.txt (lisans ve atıf) yok; lisansı belirtilmemiş model kurulmaz.');
  let manifest: PackManifest;
  try {
    manifest = JSON.parse(strFromU8(m)) as PackManifest;
  } catch {
    throw new PackError('manifest.json okunamadı.');
  }
  if (manifest.format !== PACK_FORMAT || manifest.version !== 1) throw new PackError('Bu paket biçimi bu uygulama sürümünde desteklenmiyor.');
  if (manifest.body !== 'male' && manifest.body !== 'female') throw new PackError('Paketin vücut bilgisi (erkek/kadın) geçersiz.');
  if (!Array.isArray(manifest.sources) || !manifest.sources.length || manifest.sources.some((s) => !s.license || !s.url))
    throw new PackError('Paketin kaynak ve lisans bilgisi eksik; lisansı doğrulanmamış model kurulmaz.');
  const digest = await sha256Hex(g);
  if (digest !== manifest.model?.sha256) throw new PackError('model.glb manifestteki SHA-256 özetiyle eşleşmiyor: dosya bozuk ya da değiştirilmiş.');
  const official = officialPack(manifest.id, manifest.body);
  if (!official) throw new PackError(`"${manifest.id}" bu uygulama sürümünün resmi paket listesinde yok; doğrulanmamış model kurulmaz.`);
  if (official.sha256 !== digest)
    throw new PackError('Paket, bu uygulama sürümüyle yayımlanan resmi paketle eşleşmiyor (SHA-256 farklı). Uygulamayla aynı sürümdeki paketi indir.');
  return { manifest, glb: g.slice().buffer, attribution: strFromU8(a) };
}

/** Paketi doğrular ve cihaza kurar. */
export async function installPack(data: ArrayBuffer): Promise<InstalledPack> {
  const { manifest, glb, attribution } = await verifyPack(data);
  const meta: InstalledPack = { key: packKey(manifest.id, manifest.body), manifest, attribution, installedAt: new Date().toISOString() };
  await backend.put(meta, glb);
  disabled = new Set(disabled);
  disabled.delete(meta.key);
  await refresh();
  return meta;
}
