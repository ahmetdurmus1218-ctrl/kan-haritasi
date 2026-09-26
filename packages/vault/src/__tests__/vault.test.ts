import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  IndexedDbBlobStore,
  IndexedDbRecordStore,
  MemoryBlobStore,
  MemoryRecordStore,
  PassphraseKeyWrapper,
  Vault,
  VaultError,
  fromBase64,
  openVaultDb,
  toBase64,
  utf8,
  type Argon2Params,
  type Bytes,
  type KeyWrapper,
  type WrappedMasterKey,
} from '../index';

// Testlerde hızlı ama sınırlar içinde Argon2 parametreleri.
const FAST: Argon2Params = { memoryKiB: 8 * 1024, iterations: 1, parallelism: 1 };
const PASS = 'doğru-parola-123';
const CHUNK = 1024;

function stores() {
  return { records: new MemoryRecordStore(), blobs: new MemoryBlobStore() };
}

function bytesOf(length: number, seed = 7): Bytes {
  const b = new Uint8Array(length);
  for (let i = 0; i < length; i++) b[i] = (i * 31 + seed) & 0xff;
  return b;
}

async function newVault() {
  const s = stores();
  const vault = await Vault.create(s.records, s.blobs, new PassphraseKeyWrapper(PASS, FAST), { chunkSize: CHUNK });
  return { ...s, vault };
}

async function addPdf(vault: Vault, bytes: Bytes = bytesOf(3000), name = 'Kan Tahlili.pdf') {
  return vault.addFile({ bytes, originalFileName: name, displayName: 'Kan Tahlili', mimeType: 'application/pdf', kind: 'pdf' });
}

async function expectCode(p: Promise<unknown>, code: VaultError['code']) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof VaultError && e.code === code);
}

function containsSubsequence(hay: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

describe('kasa kurulumu ve kilit', () => {
  it('doğru parolayla açılır, yanlış parolayla açılmaz', async () => {
    const { records, blobs, vault } = await newVault();
    const info = await addPdf(vault);
    vault.lock();

    await expectCode(Vault.unlock(records, blobs, new PassphraseKeyWrapper('yanlış-parola-99', FAST)), 'WRONG_PASSPHRASE');

    const reopened = await Vault.unlock(records, blobs, new PassphraseKeyWrapper(PASS, FAST), { chunkSize: CHUNK });
    expect((await reopened.readFile(info.id)).info.displayName).toBe('Kan Tahlili');
  });

  it('parola Unicode normalizasyonundan bağımsızdır (NFC/NFD)', async () => {
    const s = stores();
    const nfc = 'şifre-çözüm-ğüı'.normalize('NFC');
    await Vault.create(s.records, s.blobs, new PassphraseKeyWrapper(nfc, FAST));
    await expect(Vault.unlock(s.records, s.blobs, new PassphraseKeyWrapper(nfc.normalize('NFD'), FAST))).resolves.toBeInstanceOf(Vault);
  });

  it('kısa parolayı reddeder', async () => {
    const s = stores();
    await expectCode(Vault.create(s.records, s.blobs, new PassphraseKeyWrapper('kisa', FAST)), 'INVALID_INPUT');
    expect(await Vault.isInitialized(s.records)).toBe(false);
  });

  it('ikinci kez kurulamaz', async () => {
    const { records, blobs } = await newVault();
    await expectCode(Vault.create(records, blobs, new PassphraseKeyWrapper(PASS, FAST)), 'ALREADY_INITIALIZED');
  });

  it('kilitlendikten sonra hiçbir işlem yapılamaz', async () => {
    const { vault } = await newVault();
    const info = await addPdf(vault);
    vault.lock();
    expect(vault.locked).toBe(true);
    await expectCode(vault.readFile(info.id), 'LOCKED');
    await expectCode(vault.listFiles(), 'LOCKED');
    await expectCode(addPdf(vault), 'LOCKED');
    await expectCode(vault.deleteFile(info.id), 'LOCKED');
  });

  it('meta verisinde devasa Argon2 parametreleri kabul edilmez (DoS koruması)', async () => {
    const { records, blobs } = await newVault();
    const meta = (await records.getMeta())!;
    (meta.keys![0] as unknown as { params: Argon2Params }).params.memoryKiB = 64 * 1024 * 1024;
    await records.putMeta(meta);
    await expectCode(Vault.unlock(records, blobs, new PassphraseKeyWrapper(PASS, FAST)), 'INVALID_INPUT');
  });
});

describe('dosya saklama ve indirme', () => {
  it('orijinal dosya bayt bayt aynı geri döner (çok parçalı)', async () => {
    const { vault } = await newVault();
    const original = bytesOf(CHUNK * 3 + 17);
    const info = await addPdf(vault, original);
    const { bytes } = await vault.readFile(info.id);
    expect(bytes).toEqual(original);
    expect(info.size).toBe(original.length);
    expect(info.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('boyutu parça boyutunun tam katı olan dosya da doğru döner', async () => {
    const { vault } = await newVault();
    const original = bytesOf(CHUNK * 2);
    expect((await vault.readFile((await addPdf(vault, original)).id)).bytes).toEqual(original);
  });

  it('depoda açık metin, dosya adı veya görünen ad bulunmaz', async () => {
    const { vault, records, blobs } = await newVault();
    const marker = utf8('LDL 178 mg/dL HASTA-ADI-ORNEK');
    const content = new Uint8Array(4096);
    content.set(marker, 100);
    await addPdf(vault, content, 'ozel-rapor-ismi.pdf');

    for (const blob of blobs.blobs.values()) expect(containsSubsequence(blob, marker)).toBe(false);
    for (const r of records.records.values()) {
      const serialized = JSON.stringify(r);
      expect(serialized).not.toContain('ozel-rapor-ismi');
      expect(serialized).not.toContain('Kan Tahlili');
      expect(containsSubsequence(fromBase64(r.ct), utf8('ozel-rapor-ismi'))).toBe(false);
    }
  });

  it('aynı içerik SHA-256 ile bulunur (çift yükleme kontrolü)', async () => {
    const { vault } = await newVault();
    const info = await addPdf(vault, bytesOf(500, 3));
    const again = await vault.findBySha256(info.sha256);
    expect(again?.id).toBe(info.id);
  });

  it('yeniden adlandırma çalışır; kontrol ve yön karakterleri reddedilir', async () => {
    const { vault } = await newVault();
    const info = await addPdf(vault);
    expect((await vault.renameFile(info.id, '  Eylül Check-up  ')).displayName).toBe('Eylül Check-up');
    await expectCode(vault.renameFile(info.id, 'rapor\u202efdp.exe'), 'INVALID_INPUT');
    await expectCode(vault.renameFile(info.id, 'a\u0000b'), 'INVALID_INPUT');
    await expectCode(vault.renameFile(info.id, '   '), 'INVALID_INPUT');
    await expectCode(vault.renameFile(info.id, 'x'.repeat(121)), 'INVALID_INPUT');
  });
});

describe('kurcalama tespiti', () => {
  it('şifreli gövdede tek bayt değişirse dosya açılmaz', async () => {
    const { vault, blobs } = await newVault();
    const info = await addPdf(vault, bytesOf(CHUNK * 2 + 5));
    const [key, blob] = [...blobs.blobs.entries()][0]!;
    blob[blob.length - 40]! ^= 0x01;
    blobs.blobs.set(key, blob);
    await expectCode(vault.readFile(info.id), 'INTEGRITY');
  });

  it('parçaların sırası değiştirilirse dosya açılmaz', async () => {
    const { vault, blobs } = await newVault();
    const info = await addPdf(vault, bytesOf(CHUNK * 3 + 10));
    const [key, blob] = [...blobs.blobs.entries()][0]!;
    const seg = 12 + CHUNK + 16;
    const header = 8;
    const swapped = new Uint8Array(blob);
    swapped.set(blob.subarray(header + seg, header + 2 * seg), header);
    swapped.set(blob.subarray(header, header + seg), header + seg);
    blobs.blobs.set(key, swapped);
    await expectCode(vault.readFile(info.id), 'INTEGRITY');
  });

  it('son parça kesilirse (truncation) dosya açılmaz', async () => {
    const { vault, blobs } = await newVault();
    const info = await addPdf(vault, bytesOf(CHUNK * 3 + 10));
    const [key, blob] = [...blobs.blobs.entries()][0]!;
    const seg = 12 + CHUNK + 16;
    blobs.blobs.set(key, blob.slice(0, 8 + 3 * seg));
    await expectCode(vault.readFile(info.id), 'INTEGRITY');
  });

  it('bir dosyanın gövdesi başka dosyanın kaydına taşınırsa açılmaz', async () => {
    const { vault, records, blobs } = await newVault();
    const a = await addPdf(vault, bytesOf(2000, 1));
    const b = await addPdf(vault, bytesOf(2000, 2));
    const [keyA, keyB] = [...blobs.blobs.keys()];
    const blobA = blobs.blobs.get(keyA!)!;
    blobs.blobs.set(keyB!, blobA);
    const results = await Promise.allSettled([vault.readFile(a.id), vault.readFile(b.id)]);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(records.records.size).toBe(2);
  });

  it('şifreli kayıt değişirse veya başka kimliğe taşınırsa listede görünmez', async () => {
    const { vault, records } = await newVault();
    const a = await addPdf(vault, bytesOf(100, 1));
    const b = await addPdf(vault, bytesOf(100, 2));

    const recA = records.records.get(a.id)!;
    const ct = fromBase64(recA.ct);
    ct[5]! ^= 0xff;
    records.records.set(a.id, { ...recA, ct: toBase64(ct) });

    const recB = records.records.get(b.id)!;
    records.records.set('11111111-2222-4333-8444-555555555555', { ...recB, id: '11111111-2222-4333-8444-555555555555' });

    const { files, corruptIds } = await vault.listFiles();
    expect(files.map((f) => f.id)).toEqual([b.id]);
    expect(corruptIds.sort()).toEqual([a.id, '11111111-2222-4333-8444-555555555555'].sort());
    await expectCode(vault.readFile(a.id), 'INTEGRITY');
  });
});

describe('silme', () => {
  it('silinen dosyanın kaydı, anahtarı ve gövdesi kalmaz', async () => {
    const { vault, records, blobs } = await newVault();
    const keep = await addPdf(vault, bytesOf(1500, 1));
    const gone = await addPdf(vault, bytesOf(1500, 2));

    await vault.deleteFile(gone.id);

    expect(records.records.has(gone.id)).toBe(false);
    expect(blobs.blobs.size).toBe(1);
    await expectCode(vault.readFile(gone.id), 'NOT_FOUND');
    expect((await vault.listFiles()).files.map((f) => f.id)).toEqual([keep.id]);
  });

  it('kayıt silinip gövde kalsa bile (yarım silme) gövde okunamaz ve temizlenir', async () => {
    const { vault, records, blobs } = await newVault();
    const info = await addPdf(vault);
    const staleBlob = [...blobs.blobs.values()][0]!;
    await records.delete(info.id); // gövde silinmeden önce süreç öldü gibi

    await expectCode(vault.readFile(info.id), 'NOT_FOUND');
    // Anahtar kayıtla birlikte gitti; eski gövde hiçbir kayda bağlı değil.
    expect([...blobs.blobs.values()][0]).toEqual(staleBlob);

    await vault.putRecord('profile', 'profile', { sex: 'male' });
    expect(await vault.sweepOrphans()).toBe(1);
    expect(blobs.blobs.size).toBe(0);
  });

  it('tüm verileri sil: ana anahtar dahil her şey gider, kasa yeniden kurulabilir', async () => {
    const { vault, records, blobs } = await newVault();
    await addPdf(vault);
    await vault.destroyAll();
    expect(vault.locked).toBe(true);
    expect(await Vault.isInitialized(records)).toBe(false);
    expect(records.records.size).toBe(0);
    expect(blobs.blobs.size).toBe(0);
    await expect(Vault.create(records, blobs, new PassphraseKeyWrapper('yeni-parola-456', FAST))).resolves.toBeInstanceOf(Vault);
  });

  it('parolayı unutan kullanıcı kilidi açmadan her şeyi silebilir', async () => {
    const { vault, records, blobs } = await newVault();
    await addPdf(vault);
    vault.lock();
    await Vault.destroyWithoutUnlock(records, blobs);
    expect(await Vault.isInitialized(records)).toBe(false);
    expect(blobs.blobs.size).toBe(0);
  });
});

describe('IndexedDB deposu', () => {
  it('gerçek IndexedDB arayüzüyle uçtan uca çalışır', async () => {
    const db = await openVaultDb();
    const records = new IndexedDbRecordStore(db);
    const blobs = new IndexedDbBlobStore(db);
    const vault = await Vault.create(records, blobs, new PassphraseKeyWrapper(PASS, FAST), { chunkSize: CHUNK });
    const original = bytesOf(CHUNK * 2 + 99);
    const info = await addPdf(vault, original);
    expect((await vault.readFile(info.id)).bytes).toEqual(original);
    await vault.deleteFile(info.id);
    expect(await blobs.keys()).toEqual([]);
    await vault.destroyAll();
    expect(await records.getMeta()).toBeUndefined();
    db.close();
  });

  it('depolama anahtarı olarak yol ifadeleri kabul edilmez', async () => {
    const blobs = new MemoryBlobStore();
    await expect(blobs.put('../../etc/passwd', new Uint8Array(1))).rejects.toThrow();
    await expect(blobs.get('user123/report.pdf')).rejects.toThrow();
  });
});

/** Android Keystore yerine geçen test sarmalayıcısı: anahtarı sabit bir maskeyle "sarar". */
class FakeDeviceWrapper implements KeyWrapper {
  readonly scheme = 'test-device-v1';
  constructor(private readonly behaviour: 'ok' | 'cancel' = 'ok') {}
  async wrap(mk: Bytes): Promise<WrappedMasterKey> {
    if (this.behaviour === 'cancel') throw new VaultError('AUTH_CANCELLED');
    return { scheme: this.scheme, data: toBase64(mk.map((b) => b ^ 0x5a)) };
  }
  async unwrap(w: WrappedMasterKey): Promise<Bytes> {
    if (this.behaviour === 'cancel') throw new VaultError('AUTH_CANCELLED');
    return fromBase64(w.data as string).map((b) => b ^ 0x5a);
  }
}

describe('birden fazla kilit açma yöntemi', () => {
  it('cihaz kilidi + kurtarma parolası: ikisi de aynı kasayı açar', async () => {
    const s = stores();
    const v = await Vault.create(s.records, s.blobs, [new FakeDeviceWrapper(), new PassphraseKeyWrapper(PASS, FAST)], { chunkSize: CHUNK });
    const info = await addPdf(v);
    expect(await Vault.schemes(s.records)).toEqual(['test-device-v1', 'argon2id-aesgcm-v1']);
    const a = await Vault.unlock(s.records, s.blobs, new FakeDeviceWrapper(), { chunkSize: CHUNK });
    const b = await Vault.unlock(s.records, s.blobs, new PassphraseKeyWrapper(PASS, FAST), { chunkSize: CHUNK });
    expect((await a.readFile(info.id)).bytes).toEqual((await b.readFile(info.id)).bytes);
  });

  it('kurulumda cihaz doğrulaması iptal edilirse kasa oluşmaz', async () => {
    const s = stores();
    await expectCode(Vault.create(s.records, s.blobs, [new FakeDeviceWrapper('cancel'), new PassphraseKeyWrapper(PASS, FAST)]), 'AUTH_CANCELLED');
    expect(await Vault.isInitialized(s.records)).toBe(false);
  });

  it('parola değiştirme: eski parola artık açmaz, yenisi açar, veriler korunur', async () => {
    const { records, blobs, vault } = await newVault();
    const info = await addPdf(vault);
    const reopened = await Vault.unlock(records, blobs, new PassphraseKeyWrapper(PASS, FAST), {
      chunkSize: CHUNK,
      rewrap: [new PassphraseKeyWrapper('yepyeni-parola-777', FAST)],
    });
    expect(reopened.lastRewrap).toBe('ok');
    await expectCode(Vault.unlock(records, blobs, new PassphraseKeyWrapper(PASS, FAST)), 'WRONG_PASSPHRASE');
    const v2 = await Vault.unlock(records, blobs, new PassphraseKeyWrapper('yepyeni-parola-777', FAST), { chunkSize: CHUNK });
    expect((await v2.readFile(info.id)).info.id).toBe(info.id);
  });

  it('kurtarma parolasıyla açılıp cihaz kilidi yeniden bağlanabilir; yeniden bağlama iptal edilse de kilit açılır', async () => {
    const { records, blobs } = await newVault();
    const failed = await Vault.unlock(records, blobs, new PassphraseKeyWrapper(PASS, FAST), { rewrap: [new FakeDeviceWrapper('cancel')] });
    expect(failed.locked).toBe(false);
    expect(failed.lastRewrap).toBe('failed');
    expect(await Vault.schemes(records)).toEqual(['argon2id-aesgcm-v1']);

    const ok = await Vault.unlock(records, blobs, new PassphraseKeyWrapper(PASS, FAST), { rewrap: [new FakeDeviceWrapper()] });
    expect(ok.lastRewrap).toBe('ok');
    expect(await Vault.schemes(records)).toEqual(['argon2id-aesgcm-v1', 'test-device-v1']);
    await expect(Vault.unlock(records, blobs, new FakeDeviceWrapper())).resolves.toBeInstanceOf(Vault);

    await ok.removeUnlockMethod('test-device-v1');
    expect(await Vault.schemes(records)).toEqual(['argon2id-aesgcm-v1']);
    await expectCode(ok.removeUnlockMethod('argon2id-aesgcm-v1'), 'INVALID_INPUT');
  });

  it('kayıtlı olmayan yöntemle açma denemesi reddedilir', async () => {
    const { records, blobs } = await newVault();
    await expectCode(Vault.unlock(records, blobs, new FakeDeviceWrapper()), 'NOT_FOUND');
  });

  it('sürüm 1 meta (tek anahtar) hâlâ açılır', async () => {
    const { records, blobs, vault } = await newVault();
    const info = await addPdf(vault);
    const meta = (await records.getMeta())!;
    await records.putMeta({ formatVersion: 1, createdAt: meta.createdAt, wrapped: meta.keys![0] });
    const v = await Vault.unlock(records, blobs, new PassphraseKeyWrapper(PASS, FAST), { chunkSize: CHUNK });
    expect((await v.readFile(info.id)).info.id).toBe(info.id);
  });
});

describe('genel şifreli kayıtlar', () => {
  it('rapor kaydı şifreli saklanır, türü ve kimliği AAD ile bağlıdır', async () => {
    const { vault, records } = await newVault();
    const id = '11111111-2222-4333-8444-555555555555';
    await vault.putRecord('report', id, { fileId: 'x', results: [{ testKey: 'ldl', value: 178 }] });
    expect(await vault.getRecord('report', id)).toEqual({ fileId: 'x', results: [{ testKey: 'ldl', value: 178 }] });
    expect(JSON.stringify(records.records.get(id))).not.toContain('ldl');

    // Başka türmüş gibi okunamaz
    await expectCode(vault.getRecord('alias', id), 'INTEGRITY');
    // Kayıt başka türe etiketlenirse AAD tutmaz
    const r = records.records.get(id)!;
    records.records.set(id, { ...r, kind: 'alias' });
    await expectCode(vault.getRecord('alias', id), 'INTEGRITY');
    records.records.set(id, r);

    const list = await vault.listRecords('report');
    expect(list.items.map((i) => i.id)).toEqual([id]);
    await vault.deleteRecord('report', id);
    expect(await vault.getRecord('report', id)).toBeUndefined();
  });

  it('geçersiz kayıt kimliği reddedilir; kilitliyken kayıt işlemi yapılamaz', async () => {
    const { vault } = await newVault();
    await expectCode(vault.putRecord('report', '../x', {}), 'INVALID_INPUT');
    vault.lock();
    await expectCode(vault.putRecord('report', 'a', {}), 'LOCKED');
    await expectCode(vault.listRecords('report'), 'LOCKED');
  });

  it('dosya listesi yalnızca dosya kayıtlarını döndürür', async () => {
    const { vault } = await newVault();
    await addPdf(vault);
    await vault.putRecord('profile', 'profile', { sex: 'female' });
    const { files, corruptIds } = await vault.listFiles();
    expect(files).toHaveLength(1);
    expect(corruptIds).toEqual([]);
  });
});
