import { argon2id } from 'hash-wasm';
import { type Bytes, concat, fromBase64, fromUtf8, readU32be, toBase64, u32be, utf8, wipe } from './bytes';
import { importAesKey, randomBytes, randomId, sha256Hex } from './crypto';
import { VaultError } from './errors';
import { type Argon2Params, DEFAULT_ARGON2, MIN_PASSPHRASE_LENGTH } from './kdf';
import { decryptChunks, encryptChunks } from './fileCrypto';
import type { FileInfo, Vault } from './vault';

/**
 * Şifreli yedek (.khyedek)
 *
 *   "KHYEDEK1" | u32 başlıkUzunluğu | başlık (JSON) | KHB1 şifreli gövde
 *
 * Anahtar, yedek parolasından Argon2id ile türetilir (kasa parolasından bağımsız olabilir).
 * Başlığın tamamı her parçanın doğrulama verisine (AAD) girer: başlık değiştirilirse çözme başarısız olur.
 * Gövde (açık hali):
 *
 *   "KHPACK1" | u32 manifestUzunluğu | manifest (JSON) | dosya baytları art arda
 *
 * Yedek, kasadaki şifreli baytların kopyası değildir: dosyalar çözülür, yedek anahtarıyla yeniden şifrelenir.
 * Böylece yedek başka bir cihazdaki yeni bir kasaya geri yüklenebilir.
 */

export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = '.khyedek';
const MAGIC = utf8('KHYEDEK1');
const PACK = utf8('KHPACK1');
const MAX_HEADER = 4096;
const BACKUP_KINDS = ['report', 'alias', 'profile', 'imaging'] as const;
type BackupKind = (typeof BACKUP_KINDS)[number];

interface BackupHeader {
  format: 'kan-haritasi-backup';
  version: number;
  id: string;
  createdAt: string;
  kdf: { scheme: 'argon2id'; salt: string } & Argon2Params;
}

interface ManifestFile extends Omit<FileInfo, 'id'> {
  id: string;
  offset: number;
  length: number;
}

interface Manifest {
  version: number;
  files: ManifestFile[];
  records: Record<BackupKind, Array<{ id: string; value: unknown }>>;
}

export interface BackupSummary {
  files: number;
  records: number;
  bytes: number;
}

async function deriveKey(passphrase: string, salt: Bytes, p: Argon2Params): Promise<CryptoKey> {
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

export interface CreateBackupOptions {
  params?: Argon2Params;
  onProgress?: (done: number, total: number) => void;
}

/** Kasanın tamamını (dosyalar + raporlar + takma adlar + profil) tek bir şifreli yedek dosyasına yazar. */
export async function createBackup(vault: Vault, passphrase: string, opts: CreateBackupOptions = {}): Promise<{ bytes: Bytes; summary: BackupSummary }> {
  if (passphrase.normalize('NFKC').length < MIN_PASSPHRASE_LENGTH) throw new VaultError('INVALID_INPUT', 'passphrase too short');
  const { files } = await vault.listFiles();
  const parts: Bytes[] = [];
  const manifestFiles: ManifestFile[] = [];
  let offset = 0;
  const total = files.length + 1;
  for (let i = 0; i < files.length; i++) {
    const { info, bytes } = await vault.readFile(files[i]!.id);
    manifestFiles.push({ ...info, offset, length: bytes.length });
    parts.push(bytes);
    offset += bytes.length;
    opts.onProgress?.(i + 1, total);
  }
  const records = {} as Manifest['records'];
  let recordCount = 0;
  for (const kind of BACKUP_KINDS) {
    records[kind] = (await vault.listRecords<unknown>(kind)).items;
    recordCount += records[kind].length;
  }
  const manifest: Manifest = { version: BACKUP_VERSION, files: manifestFiles, records };
  const manifestBytes = utf8(JSON.stringify(manifest));
  const plain = concat(PACK, u32be(manifestBytes.length), manifestBytes, ...parts);
  for (const p of parts) wipe(p);

  const params = opts.params ?? DEFAULT_ARGON2;
  const salt = randomBytes(16);
  const header: BackupHeader = {
    format: 'kan-haritasi-backup',
    version: BACKUP_VERSION,
    id: randomId(),
    createdAt: new Date().toISOString(),
    kdf: { scheme: 'argon2id', salt: toBase64(salt), ...params },
  };
  const headerText = JSON.stringify(header);
  const key = await deriveKey(passphrase, salt, params);
  const body = await encryptChunks(key, `backup:${headerText}`, plain);
  wipe(plain);
  const headerBytes = utf8(headerText);
  opts.onProgress?.(total, total);
  return {
    bytes: concat(MAGIC, u32be(headerBytes.length), headerBytes, body),
    summary: { files: files.length, records: recordCount, bytes: offset },
  };
}

function parseHeader(data: Bytes): { header: BackupHeader; headerText: string; body: Bytes } {
  if (data.length < MAGIC.length + 4) throw new VaultError('INTEGRITY', 'not a backup');
  for (let i = 0; i < MAGIC.length; i++) if (data[i] !== MAGIC[i]) throw new VaultError('INTEGRITY', 'not a backup');
  const len = readU32be(data, MAGIC.length);
  if (len <= 0 || len > MAX_HEADER || MAGIC.length + 4 + len > data.length) throw new VaultError('INTEGRITY', 'bad header');
  const headerText = fromUtf8(data.subarray(MAGIC.length + 4, MAGIC.length + 4 + len));
  let header: BackupHeader;
  try {
    header = JSON.parse(headerText) as BackupHeader;
  } catch {
    throw new VaultError('INTEGRITY', 'bad header');
  }
  if (header?.format !== 'kan-haritasi-backup') throw new VaultError('INTEGRITY', 'not a backup');
  if (typeof header.version !== 'number' || header.version > BACKUP_VERSION) throw new VaultError('UNSUPPORTED_VERSION', 'newer backup');
  if (header.kdf?.scheme !== 'argon2id' || typeof header.kdf.salt !== 'string') throw new VaultError('INTEGRITY', 'bad kdf');
  return { header, headerText, body: data.slice(MAGIC.length + 4 + len) };
}

/** Yedeğin başlığını (şifre çözmeden) okur: dosya gerçekten yedek mi, sürümü destekleniyor mu. */
export function inspectBackup(data: Bytes): { createdAt: string; version: number } {
  const { header } = parseHeader(data);
  return { createdAt: header.createdAt, version: header.version };
}

export interface RestoreResult {
  filesAdded: number;
  filesSkipped: number;
  reportsAdded: number;
  aliasesMerged: number;
  profileRestored: boolean;
}

const ARGON_LIMITS = { memoryKiB: [8 * 1024, 1024 * 1024], iterations: [1, 20], parallelism: [1, 8] } as const;

/**
 * Yedeği açık kasaya geri yükler. Aynı içerikteki (SHA-256) dosyalar yeniden eklenmez;
 * raporlar yeni dosya kimliklerine bağlanır; takma adlar birleştirilir; profil yalnızca yoksa yazılır.
 */
export async function restoreBackup(vault: Vault, data: Bytes, passphrase: string): Promise<RestoreResult> {
  const { header, headerText, body } = parseHeader(data);
  const k = header.kdf;
  for (const [name, [lo, hi]] of Object.entries(ARGON_LIMITS)) {
    const v = (k as unknown as Record<string, number>)[name];
    if (!Number.isInteger(v) || v! < lo || v! > hi) throw new VaultError('INTEGRITY', 'bad kdf params');
  }
  const key = await deriveKey(passphrase, fromBase64(k.salt), k);
  let plain: Bytes;
  try {
    plain = await decryptChunks(key, `backup:${headerText}`, body);
  } catch (e) {
    if (e instanceof VaultError && e.code === 'INTEGRITY') throw new VaultError('WRONG_PASSPHRASE');
    throw e;
  }
  try {
    for (let i = 0; i < PACK.length; i++) if (plain[i] !== PACK[i]) throw new VaultError('INTEGRITY', 'bad pack');
    const mlen = readU32be(plain, PACK.length);
    const start = PACK.length + 4;
    const manifest = JSON.parse(fromUtf8(plain.subarray(start, start + mlen))) as Manifest;
    if (!manifest || manifest.version > BACKUP_VERSION || !Array.isArray(manifest.files)) throw new VaultError('UNSUPPORTED_VERSION');
    const dataStart = start + mlen;

    const idMap = new Map<string, string>();
    let filesAdded = 0;
    let filesSkipped = 0;
    for (const f of manifest.files) {
      const bytes = plain.slice(dataStart + f.offset, dataStart + f.offset + f.length);
      if (bytes.length !== f.length || (await sha256Hex(bytes)) !== f.sha256) throw new VaultError('INTEGRITY', 'file hash mismatch');
      const existing = await vault.findBySha256(f.sha256);
      if (existing) {
        idMap.set(f.id, existing.id);
        filesSkipped++;
      } else {
        const added = await vault.addFile({
          bytes,
          originalFileName: f.originalFileName,
          displayName: f.displayName,
          mimeType: f.mimeType,
          kind: f.kind,
          createdAt: f.createdAt,
          category: f.category,
          region: f.region,
          studyDate: f.studyDate,
          seriesUid: f.seriesUid,
          sliceIndex: f.sliceIndex,
        });
        idMap.set(f.id, added.id);
        filesAdded++;
      }
      wipe(bytes);
    }

    // Raporlar: dosya kimliğini yeni kimliğe çevir; aynı dosyaya ait rapor zaten varsa atla.
    const existingReports = (await vault.listRecords<{ fileId?: string }>('report')).items;
    const haveReportFor = new Set(existingReports.map((r) => r.value.fileId));
    let reportsAdded = 0;
    for (const r of manifest.records.report ?? []) {
      const value = r.value as { fileId?: string; id?: string };
      const fileId = value.fileId ? idMap.get(value.fileId) : undefined;
      if (!fileId || haveReportFor.has(fileId)) continue;
      const id = randomId();
      await vault.putRecord('report', id, { ...value, id, fileId });
      haveReportFor.add(fileId);
      reportsAdded++;
    }

    // Görüntüleme raporu metinleri: raporlarla aynı kural.
    const haveImagingFor = new Set((await vault.listRecords<{ fileId?: string }>('imaging')).items.map((r) => r.value.fileId));
    for (const r of manifest.records.imaging ?? []) {
      const value = r.value as { fileId?: string };
      const fileId = value.fileId ? idMap.get(value.fileId) : undefined;
      if (!fileId || haveImagingFor.has(fileId)) continue;
      const id = randomId();
      await vault.putRecord('imaging', id, { ...value, id, fileId });
      haveImagingFor.add(fileId);
    }

    let aliasesMerged = 0;
    for (const r of manifest.records.alias ?? []) {
      const incoming = r.value as Record<string, string>;
      if (typeof incoming !== 'object' || incoming === null) continue;
      const current = (await vault.getRecord<Record<string, string>>('alias', r.id)) ?? {};
      const merged = { ...incoming, ...current };
      aliasesMerged += Object.keys(merged).length - Object.keys(current).length;
      await vault.putRecord('alias', r.id, merged);
    }

    let profileRestored = false;
    for (const r of manifest.records.profile ?? []) {
      if ((await vault.getRecord('profile', r.id)) === undefined) {
        await vault.putRecord('profile', r.id, r.value);
        profileRestored = true;
      }
    }
    return { filesAdded, filesSkipped, reportsAdded, aliasesMerged, profileRestored };
  } catch (e) {
    if (e instanceof VaultError) throw e;
    throw new VaultError('INTEGRITY', 'bad backup contents');
  } finally {
    wipe(plain);
  }
}

