import { describe, expect, it } from 'vitest';
import {
  MemoryBlobStore,
  MemoryRecordStore,
  PassphraseKeyWrapper,
  Vault,
  VaultError,
  createBackup,
  inspectBackup,
  restoreBackup,
  type Argon2Params,
  type Bytes,
} from '../index';

const FAST: Argon2Params = { memoryKiB: 8 * 1024, iterations: 1, parallelism: 1 };
const BACKUP_PASS = 'yedek-parolasi-2026';

function bytesOf(length: number, seed = 7): Bytes {
  const b = new Uint8Array(length);
  for (let i = 0; i < length; i++) b[i] = (i * 31 + seed) & 0xff;
  return b;
}

async function newVault(pass = 'kasa-parolasi-123') {
  return Vault.create(new MemoryRecordStore(), new MemoryBlobStore(), new PassphraseKeyWrapper(pass, FAST), { chunkSize: 1024 });
}

async function seeded() {
  const vault = await newVault();
  const a = await vault.addFile({ bytes: bytesOf(5000, 1), originalFileName: 'a.pdf', displayName: 'Rapor A', mimeType: 'application/pdf', kind: 'pdf' });
  const b = await vault.addFile({ bytes: bytesOf(3000, 2), originalFileName: 'b.png', displayName: 'Rapor B', mimeType: 'image/png', kind: 'png' });
  await vault.putRecord('report', 'r1', { id: 'r1', fileId: a.id, createdAt: '2026-09-01T00:00:00.000Z', results: [{ testKey: 'ldl', value: 178 }] });
  await vault.putRecord('alias', 'aliases', { 'ldl-k': 'ldl' });
  await vault.putRecord('profile', 'profile', { sex: 'male' });
  return { vault, a, b };
}

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(VaultError);
  expect((err as VaultError).code).toBe(code);
}

describe('şifreli yedek (.khyedek)', () => {
  it('yedek alınır ve yeni bir kasaya eksiksiz geri yüklenir', async () => {
    const { vault, a } = await seeded();
    const { bytes, summary } = await createBackup(vault, BACKUP_PASS, { params: FAST });
    expect(summary).toEqual({ files: 2, records: 3, bytes: 8000 });
    expect(inspectBackup(bytes).version).toBe(1);

    const target = await newVault('baska-cihaz-parolasi');
    const result = await restoreBackup(target, bytes, BACKUP_PASS);
    expect(result).toEqual({ filesAdded: 2, filesSkipped: 0, reportsAdded: 1, aliasesMerged: 1, profileRestored: true });

    const { files } = await target.listFiles();
    expect(files.map((f) => f.displayName).sort()).toEqual(['Rapor A', 'Rapor B']);
    const restoredA = files.find((f) => f.sha256 === a.sha256)!;
    expect(restoredA.createdAt).toBe(a.createdAt);
    expect((await target.readFile(restoredA.id)).bytes).toEqual(bytesOf(5000, 1));
    const reports = (await target.listRecords<{ fileId: string }>('report')).items;
    expect(reports).toHaveLength(1);
    expect(reports[0]!.value.fileId).toBe(restoredA.id);
    expect(await target.getRecord('profile', 'profile')).toEqual({ sex: 'male' });
  });

  it('görüntüleme belgesinin türü ve rapor metni yedekte korunur', async () => {
    const vault = await newVault();
    const mr = await vault.addFile({
      bytes: bytesOf(4000, 9),
      originalFileName: 'IM1.dcm',
      displayName: 'Beyin MR',
      mimeType: 'application/dicom',
      kind: 'dicom',
      category: 'mr',
      region: 'beyin',
      studyDate: '2026-03-15',
      seriesUid: '1.2.3',
      sliceIndex: 2,
    });
    await vault.putRecord('imaging', 'i1', { id: 'i1', fileId: mr.id, text: 'SONUÇ: Normal.' });
    const { bytes } = await createBackup(vault, BACKUP_PASS, { params: FAST });

    const target = await newVault('baska-cihaz-parolasi');
    await restoreBackup(target, bytes, BACKUP_PASS);
    const [restored] = (await target.listFiles()).files;
    expect(restored).toMatchObject({ kind: 'dicom', category: 'mr', region: 'beyin', studyDate: '2026-03-15', seriesUid: '1.2.3', sliceIndex: 2 });
    const imaging = (await target.listRecords<{ fileId: string; text: string }>('imaging')).items;
    expect(imaging).toHaveLength(1);
    expect(imaging[0]!.value).toMatchObject({ fileId: restored!.id, text: 'SONUÇ: Normal.' });
  });

  it('aynı kasaya tekrar yüklemek kopya oluşturmaz', async () => {
    const { vault } = await seeded();
    const { bytes } = await createBackup(vault, BACKUP_PASS, { params: FAST });
    const result = await restoreBackup(vault, bytes, BACKUP_PASS);
    expect(result.filesAdded).toBe(0);
    expect(result.filesSkipped).toBe(2);
    expect(result.reportsAdded).toBe(0);
    expect(result.profileRestored).toBe(false);
    expect((await vault.listFiles()).files).toHaveLength(2);
  });

  it('yanlış parola ve kurcalanmış yedek reddedilir', async () => {
    const { vault } = await seeded();
    const { bytes } = await createBackup(vault, BACKUP_PASS, { params: FAST });
    const target = await newVault();
    await expectCode(restoreBackup(target, bytes, 'yanlis-parola-123'), 'WRONG_PASSPHRASE');

    const tampered = bytes.slice();
    tampered[tampered.length - 40]! ^= 1;
    await expectCode(restoreBackup(target, tampered, BACKUP_PASS), 'WRONG_PASSPHRASE');

    // Başlık da doğrulanır (AAD): tarihi değiştirmek çözmeyi bozar
    const text = new TextDecoder().decode(bytes.subarray(12, 400));
    const at = text.indexOf('"createdAt":"') + 13 + 12;
    const headerEdit = bytes.slice();
    headerEdit[at] = headerEdit[at] === 0x31 ? 0x32 : 0x31;
    await expectCode(restoreBackup(target, headerEdit, BACKUP_PASS), 'WRONG_PASSPHRASE');
    expect((await target.listFiles()).files).toHaveLength(0);
  });

  it('yedek olmayan dosyalar ve yeni sürümler anlaşılır hatayla reddedilir', async () => {
    const target = await newVault();
    await expectCode(restoreBackup(target, bytesOf(100), BACKUP_PASS), 'INTEGRITY');
    const header = JSON.stringify({ format: 'kan-haritasi-backup', version: 99, id: 'x', createdAt: '', kdf: { scheme: 'argon2id', salt: 'AA==' } });
    const enc = new TextEncoder();
    const h = enc.encode(header);
    const len = new Uint8Array([0, 0, (h.length >> 8) & 0xff, h.length & 0xff]);
    const fake = new Uint8Array([...enc.encode('KHYEDEK1'), ...len, ...h, 0, 0, 0]);
    await expectCode(restoreBackup(target, fake, BACKUP_PASS), 'UNSUPPORTED_VERSION');
  });

  it('kısa yedek parolası kabul edilmez', async () => {
    const { vault } = await seeded();
    await expectCode(createBackup(vault, 'kisa', { params: FAST }), 'INVALID_INPUT');
  });
});
