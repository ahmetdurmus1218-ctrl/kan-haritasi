import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BACKUP_EXTENSION, MIN_PASSPHRASE_LENGTH, createBackup, inspectBackup, restoreBackup, type RestoreResult } from '@kh/vault';
import { DEVICE_KEY_SCHEME } from '@kh/platform';
import type { Sex } from '@kh/catalog';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { AUTO_LOCK_OPTIONS, readSetting, writeSetting, type Settings } from '../state/settings';
import { go } from '../state/router';
import { platform } from '../platform';
import { formatBytes, formatDateTime } from '../lib/format';
import { userMessage } from '../lib/messages';
import { loadSex, saveSex } from '../lib/reports';
import { buildExport } from '../lib/exportData';
import { Banner, Dialog } from '../components/ui';
import { ThemePicker } from '../components/ThemeToggle';
import { useSetting } from '../state/settings';
import { CheckIcon, DownloadIcon, FingerprintIcon, LockIcon, ShieldIcon, SpinnerIcon, TrashIcon, UploadIcon } from '../components/icons';

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fact({ ok = true, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed">
      <span className={`mt-0.5 shrink-0 ${ok ? 'text-accent' : 'text-high'}`}>{ok ? <CheckIcon size={16} /> : <ShieldIcon size={16} />}</span>
      <span className="text-fg-muted">{children}</span>
    </li>
  );
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Modal = null | 'backup' | 'restore' | 'export' | 'passphrase' | 'link-device' | 'wipe';

export function PrivacyPage() {
  const vault = useUnlockedVault();
  const { stores, destroyAll, info, schemes, rewrap, unlinkDevice, bump } = useVault();
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [autoLock, setAutoLock] = useState<Settings['autoLockMinutes']>(() => readSetting('autoLockMinutes'));
  const [sex, setSex] = useState<Sex>('unspecified');
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [current, setCurrent] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [restoreFile, setRestoreFile] = useState<{ bytes: Uint8Array<ArrayBuffer>; name: string; createdAt: string } | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  const deviceLinked = schemes.includes(DEVICE_KEY_SCHEME);
  const deviceAvailable = info?.platform === 'android' && info.deviceAuth === 'available';

  useEffect(() => {
    vault.usage().then(setUsage, () => setUsage(null));
    navigator.storage?.estimate?.().then((e) => setQuota({ usage: e.usage ?? 0, quota: e.quota ?? 0 }), () => undefined);
    navigator.storage?.persisted?.().then(setPersisted, () => undefined);
    loadSex(vault).then(setSex, () => undefined);
  }, [vault]);

  const close = () => {
    if (busy) return;
    setModal(null);
    setPass1('');
    setPass2('');
    setCurrent('');
    setConfirmText('');
    setError(null);
    setRestoreFile(null);
    setProgress(null);
  };

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    try {
      const msg = await fn();
      setBusy(false);
      close();
      if (msg) setNotice(msg);
    } catch (e) {
      setBusy(false);
      setError(userMessage(e));
    } finally {
      setProgress(null);
    }
  };

  const passOk = pass1.normalize('NFKC').length >= MIN_PASSPHRASE_LENGTH && pass1 === pass2;

  const doBackup = () =>
    run(async () => {
      const { bytes, summary } = await createBackup(vault, pass1, { onProgress: (d, t) => setProgress(`Hazırlanıyor… ${d}/${t}`) });
      setProgress('Kaydediliyor…');
      const saved = await platform.files.save(`kan-haritasi-${stamp()}${BACKUP_EXTENSION}`, bytes, 'application/octet-stream');
      bytes.fill(0);
      if (!saved) return 'Yedek kaydedilmedi (kaydetme iptal edildi).';
      return `Şifreli yedek kaydedildi: ${summary.files} belge, ${summary.records} kayıt. Yedek parolanı güvenli bir yerde sakla; o olmadan yedek açılamaz.`;
    });

  const pickRestore = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      if (file.size > 1024 * 1024 * 1024) throw new Error('too large');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const meta = inspectBackup(bytes);
      setRestoreFile({ bytes, name: file.name, createdAt: meta.createdAt });
      setModal('restore');
    } catch (e) {
      setError(e instanceof Error && e.message === 'too large' ? 'Dosya çok büyük.' : userMessage(e));
      setModal('restore');
    }
  };

  const doRestore = () =>
    run(async () => {
      if (!restoreFile) return;
      setProgress('Şifre çözülüyor ve doğrulanıyor…');
      const r: RestoreResult = await restoreBackup(vault, restoreFile.bytes, pass1);
      restoreFile.bytes.fill(0);
      bump();
      vault.usage().then(setUsage, () => undefined);
      loadSex(vault).then(setSex, () => undefined);
      return `Geri yüklendi: ${r.filesAdded} yeni belge${r.filesSkipped ? `, ${r.filesSkipped} belge zaten vardı` : ''}, ${r.reportsAdded} rapor.`;
    });

  const doExport = () =>
    run(async () => {
      const { bytes, files, results } = await buildExport(vault, (d, t) => setProgress(`Hazırlanıyor… ${d}/${t}`));
      setProgress('Kaydediliyor…');
      const saved = await platform.files.save(`kan-haritasi-verilerim-${stamp()}.zip`, bytes, 'application/zip');
      bytes.fill(0);
      return saved ? `ZIP kaydedildi: ${files} belge, ${results} sonuç. Bu dosya şifresizdir.` : 'Dışa aktarma kaydedilmedi.';
    });

  const doChangePassphrase = () =>
    run(async () => {
      await rewrap(current, { newPassphrase: pass1 });
      return 'Parola değiştirildi. Eski parola artık kasayı açmaz.';
    });

  const doLinkDevice = () =>
    run(async () => {
      await rewrap(current, { linkDevice: true });
      return 'Cihaz kilidiyle açma etkinleştirildi.';
    });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <div className="mb-2">
        <p className="label-caps mb-1.5">Gizlilik ve Güvenlik</p>
        <h1 className="text-2xl font-semibold tracking-tight">Verilerin nerede ve nasıl duruyor</h1>
      </div>

      {notice && (
        <div role="status">
          <Banner tone="info">{notice}</Banner>
        </div>
      )}
      {error && !modal && <Banner tone="error">{error}</Banner>}

      <Section title="Veri akışı" aside={<span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Dışarı gönderim yok</span>}>
        <ul className="space-y-2.5">
          <Fact>
            Raporların {info?.platform === 'android' ? 'bu telefonda' : 'bu tarayıcıda'} işlenir (PDF okuma ve fotoğraf OCR dahil) ve hiçbir sunucuya gönderilmez.
            Güvenlik politikası (CSP) uygulamanın kendi dosyaları dışındaki adreslere bağlantıyı engeller
            {info?.platform === 'android' ? '; Android uygulamasının internet izni de yoktur.' : '.'}
          </Fact>
          <Fact>Reklam, analitik, takip veya çökme raporlama servisi kullanılmıyor.</Fact>
          <Fact>
            Açıklamalar uygulamanın içindeki, önceden yazılmış bilgi kataloğundan gelir. Harici yapay zekâ: <strong className="text-fg">BAĞLI DEĞİL</strong>. İleride
            eklenirse varsayılan kapalı olacak, ne gönderileceği önceden gösterilecek ve açık onayın istenecek.
          </Fact>
          {info?.platform !== 'android' && (
            <Fact>
              Uygulama dosyaları (kod ve 3D modeller) ilk açılışta barındırma sunucusundan indirilir; sunucu yalnızca IP adresini ve istenen dosya adlarını görür,
              sağlık verini görmez.
            </Fact>
          )}
          <Fact ok={false}>
            {info?.platform === 'android'
              ? 'Telefonun kendisi (ör. kötü amaçlı erişilebilirlik uygulamaları) ekranı okuyabilir; bu uygulama ekran görüntüsünü ve son uygulamalar önizlemesini engeller.'
              : 'Tarayıcı eklentileri açık sayfanın içeriğini görebilir; bu teknik olarak engellenemez. Güvenmediğin eklentileri bu sayfada kapatmanı öneririz.'}
          </Fact>
        </ul>
      </Section>

      <Section title="Depolama">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Belge" value={usage ? String(usage.count) : '–'} />
          <Stat label="Belge boyutu" value={usage ? formatBytes(usage.bytes) : '–'} />
          <Stat label="Toplam kullanım" value={quota ? formatBytes(quota.usage) : '–'} />
          <Stat label="Depo" value={stores?.blobBackend === 'opfs' ? 'OPFS' : 'IndexedDB'} />
        </dl>
        <ul className="mt-4 space-y-2.5">
          <Fact>Her belge kendi 256 bit anahtarıyla (AES-256-GCM) şifrelenir; anahtarlar da parolandan türetilen ana anahtarla (Argon2id) korunur.</Fact>
          <Fact ok={persisted === true || info?.platform === 'android'}>
            {persisted === true || info?.platform === 'android'
              ? 'Veriler kalıcı depolamada. Yine de cihaz kaybına karşı düzenli şifreli yedek almanı öneririz.'
              : 'Tarayıcı, depolama dolarsa verileri silebilir. Aşağıdan düzenli olarak şifreli yedek al.'}
          </Fact>
        </ul>
      </Section>

      <Section title="Kilit ve açma yöntemleri" aside={<LockIcon size={17} className="text-fg-muted" />}>
        <ul className="mb-4 divide-y divide-ink-700 rounded-xl border border-ink-600/60">
          <li className="flex items-center gap-3 px-4 py-3 text-sm">
            <LockIcon size={16} className="text-accent" />
            <span className="flex-1">Parola (Argon2id)</span>
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setModal('passphrase')}>
              Parolayı değiştir
            </button>
          </li>
          {info?.platform === 'android' && (
            <li className="flex items-center gap-3 px-4 py-3 text-sm">
              <FingerprintIcon size={16} className={deviceLinked ? 'text-accent' : 'text-fg-faint'} />
              <span className="flex-1">
                Cihaz kilidi (parmak izi / yüz / PIN)
                <span className="block text-xs text-fg-faint">
                  {deviceLinked ? 'Bağlı. Anahtar Android Keystore’da, her kullanımda doğrulama ister.' : deviceAvailable ? 'Bağlı değil.' : 'Bu cihazda ekran kilidi ayarlı değil.'}
                </span>
              </span>
              {deviceLinked ? (
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => run(async () => (await unlinkDevice(), 'Cihaz kilidiyle açma kaldırıldı; artık yalnızca parola ile açılır.'))}
                >
                  Kaldır
                </button>
              ) : (
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={!deviceAvailable} onClick={() => setModal('link-device')}>
                  Bağla
                </button>
              )}
            </li>
          )}
        </ul>
        <label htmlFor="autolock" className="mb-1.5 block text-sm text-fg-muted">
          Uygulama arka plana geçince kilitle
        </label>
        <select
          id="autolock"
          className="field max-w-xs"
          value={autoLock}
          onChange={(e) => {
            const v = Number(e.target.value) as Settings['autoLockMinutes'];
            setAutoLock(v);
            writeSetting('autoLockMinutes', v);
          }}
        >
          {AUTO_LOCK_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'Hemen' : `${m} dakika sonra`}
            </option>
          ))}
        </select>
        <p className="mt-3 text-sm text-fg-muted">Hesap, oturum ya da sunucu yoktur; kasa yalnızca bu cihazda açılır. Kilitlendiğinde ana anahtar bellekten bırakılır.</p>
      </Section>

      <Section title="Profil">
        <label htmlFor="sex" className="mb-1.5 block text-sm text-fg-muted">
          Referans aralıkları için cinsiyet
        </label>
        <select
          id="sex"
          className="field max-w-xs"
          value={sex}
          onChange={(e) => {
            const v = e.target.value as Sex;
            setSex(v);
            saveSex(vault, v).then(() => bump(), (err) => setError(userMessage(err)));
          }}
        >
          <option value="unspecified">Belirtmek istemiyorum</option>
          <option value="female">Kadın</option>
          <option value="male">Erkek</option>
        </select>
        <p className="mt-3 text-sm text-fg-muted">
          Raporda aralık yoksa kullanılan genel aralığı ve 3D modelde gösterilen yapıları etkiler. Kasada şifreli saklanır.
        </p>
      </Section>

      <AppearanceSection />

      <Section title="Telefon ve bilgisayar arasında">
        <p className="text-sm leading-relaxed text-fg-muted">
          Kan Haritası'nda hesap ve sunucu yok; bu yüzden verilerin kendiliğinden eşitlenmez. Bu bilinçli bir karar: sağlık verin hiçbir sunucuya,
          bizimkine de, gitmez. Telefondaki verileri bilgisayara (ya da tersine) taşımak için bir cihazda <strong className="text-fg">şifreli yedek</strong> al,
          dosyayı kendi yolunla (kablo, AirDrop, kendi bulut klasörün) öbür cihaza aktar ve orada <strong className="text-fg">yedekten geri yükle</strong>. Dosya
          yedek parolan olmadan okunamaz.
        </p>
      </Section>

      <Section title="Yedek ve dışa aktarma">
        <ul className="space-y-2.5">
          <Fact>
            <strong className="text-fg">Şifreli yedek ({BACKUP_EXTENSION})</strong>: tüm belgeler, onaylı sonuçlar ve ayarlar tek dosyada; ayrı bir yedek parolasıyla
            (Argon2id + AES-256-GCM) şifrelenir. Başka bir cihaza geri yüklenebilir.
          </Fact>
          <Fact ok={false}>
            <strong className="text-fg">Verilerimi indir</strong>: orijinal belgeler ve sonuçlar (JSON + CSV) <strong className="text-fg">şifresiz</strong> bir ZIP
            olarak kaydedilir. Yalnızca kendin kullanmak ya da hekiminle paylaşmak için.
          </Fact>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => setModal('backup')}>
            <ShieldIcon size={16} /> Şifreli yedek al
          </button>
          <button type="button" className="btn-ghost" onClick={() => restoreInput.current?.click()}>
            <UploadIcon size={16} /> Yedekten geri yükle
          </button>
          <button type="button" className="btn-ghost" onClick={() => setModal('export')}>
            <DownloadIcon size={16} /> Verilerimi indir
          </button>
          <input
            ref={restoreInput}
            type="file"
            accept={`${BACKUP_EXTENSION},application/octet-stream`}
            className="hidden"
            onChange={(e) => {
              void pickRestore(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </Section>

      <Section title="Hakkında ve lisanslar">
        <p className="text-sm text-fg-muted">Kullanılan açık kaynak bileşenler, 3D model kaynakları (HuBMAP CC BY 4.0, BodyParts3D CC BY-SA 2.1 JP) ve tıbbi uyarılar.</p>
        <button type="button" className="btn-ghost mt-3" onClick={() => go({ name: 'about' })}>
          Hakkında
        </button>
      </Section>

      <section className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
        <h2 className="font-semibold text-danger">Tüm verileri sil</h2>
        <p className="mt-2 text-sm text-fg-muted">
          Önce ana anahtar, sonra tüm belgeler ve kayıtlar bu cihazdan silinir. Ana anahtar silindiği için depoda iz kalsa bile okunamaz. Geri alınamaz.
        </p>
        <button type="button" className="btn-danger mt-4" onClick={() => setModal('wipe')}>
          <TrashIcon size={16} /> Tüm verileri sil
        </button>
      </section>

      {/* ------------------------------------------------ Diyaloglar */}
      <Dialog
        open={modal === 'backup'}
        onClose={close}
        title="Şifreli yedek al"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              Vazgeç
            </button>
            <button type="button" className="btn-primary" disabled={!passOk || busy} onClick={doBackup}>
              {busy && <SpinnerIcon size={16} />} Yedeği oluştur
            </button>
          </>
        }
      >
        <p>Yedek için bir parola belirle (en az {MIN_PASSPHRASE_LENGTH} karakter). Kasa parolandan farklı olabilir.</p>
        <PassFields a={pass1} b={pass2} setA={setPass1} setB={setPass2} />
        <p className="mt-3 text-xs text-fg-faint">Bu parolayı unutursan yedek hiçbir şekilde açılamaz; kurtarma yolu yoktur.</p>
        {progress && <p className="mt-3 text-xs text-fg-muted">{progress}</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Dialog>

      <Dialog
        open={modal === 'restore'}
        onClose={close}
        title="Yedekten geri yükle"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              Vazgeç
            </button>
            <button type="button" className="btn-primary" disabled={!restoreFile || pass1.length === 0 || busy} onClick={doRestore}>
              {busy && <SpinnerIcon size={16} />} Geri yükle
            </button>
          </>
        }
      >
        {restoreFile ? (
          <>
            <p>
              <strong className="text-fg">{restoreFile.name}</strong> · oluşturma {formatDateTime(restoreFile.createdAt)}
            </p>
            <p className="mt-2">Mevcut verilerin silinmez; yedekteki belgeler eklenir, aynı belgeler ikinci kez eklenmez.</p>
            <label htmlFor="restore-pass" className="mt-4 block text-fg">
              Yedek parolası
            </label>
            <input id="restore-pass" type="password" className="field mt-2" value={pass1} onChange={(e) => setPass1(e.target.value)} autoComplete="off" />
          </>
        ) : (
          <p>Bu dosya bir Kan Haritası yedeği olarak tanınmadı.</p>
        )}
        {progress && <p className="mt-3 text-xs text-fg-muted">{progress}</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Dialog>

      <Dialog
        open={modal === 'export'}
        onClose={close}
        title="Verilerimi indir (şifresiz)"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              Vazgeç
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={doExport}>
              {busy && <SpinnerIcon size={16} />} Anladım, indir
            </button>
          </>
        }
      >
        <p>
          ZIP dosyası <strong className="text-fg">şifresiz</strong> olacak: içindeki raporları ve sonuçları dosyaya erişen herkes görebilir. Paylaşmadan önce kime
          gönderdiğinden emin ol.
        </p>
        {progress && <p className="mt-3 text-xs text-fg-muted">{progress}</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Dialog>

      <Dialog
        open={modal === 'passphrase'}
        onClose={close}
        title="Parolayı değiştir"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              Vazgeç
            </button>
            <button type="button" className="btn-primary" disabled={!passOk || !current || busy} onClick={doChangePassphrase}>
              {busy && <SpinnerIcon size={16} />} Değiştir
            </button>
          </>
        }
      >
        <label htmlFor="cur-pass" className="block text-fg">
          Mevcut parola
        </label>
        <input id="cur-pass" type="password" className="field mt-2" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <PassFields a={pass1} b={pass2} setA={setPass1} setB={setPass2} label="Yeni parola" />
        <p className="mt-3 text-xs text-fg-faint">Belgeler yeniden şifrelenmez; yalnızca ana anahtar yeni parolayla sarılır (hızlıdır).</p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Dialog>

      <Dialog
        open={modal === 'link-device'}
        onClose={close}
        title="Cihaz kilidini bağla"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              Vazgeç
            </button>
            <button type="button" className="btn-primary" disabled={!current || busy} onClick={doLinkDevice}>
              {busy && <SpinnerIcon size={16} />} Bağla
            </button>
          </>
        }
      >
        <p>Onaylamak için parolanı gir; ardından cihaz kilidi doğrulaması istenecek. Parola, kurtarma yöntemi olarak kalır.</p>
        <label htmlFor="link-pass" className="mt-4 block text-fg">
          Parola
        </label>
        <input id="link-pass" type="password" className="field mt-2" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Dialog>

      <Dialog
        open={modal === 'wipe'}
        onClose={close}
        title="Tüm veriler silinsin mi?"
        tone="danger"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={close}>
              Vazgeç
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={confirmText.trim().toLocaleUpperCase('tr') !== 'SİL' || busy}
              onClick={async () => {
                setBusy(true);
                await destroyAll();
              }}
            >
              {busy ? <SpinnerIcon size={16} /> : null} Kalıcı olarak sil
            </button>
          </>
        }
      >
        <p>Bu cihazdaki {usage?.count ?? 0} belge, tüm sonuçlar ve ana anahtar silinecek.</p>
        <label htmlFor="wipe-confirm" className="mt-4 block text-fg">
          Onaylamak için <strong>SİL</strong> yaz
        </label>
        <input id="wipe-confirm" className="field mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
      </Dialog>

      <Banner tone="info">Kan Haritası teşhis koymaz ve tıbbi cihaz değildir. Sonuçlarınla ilgili kararları bir sağlık profesyoneliyle birlikte ver.</Banner>
    </div>
  );
}

function PassFields({ a, b, setA, setB, label = 'Yedek parolası' }: { a: string; b: string; setA: (v: string) => void; setB: (v: string) => void; label?: string }) {
  const short = a.length > 0 && a.normalize('NFKC').length < MIN_PASSPHRASE_LENGTH;
  const mismatch = b.length > 0 && a !== b;
  return (
    <div className="mt-4 space-y-3">
      <div>
        <label htmlFor="pf-a" className="block text-fg">
          {label}
        </label>
        <input id="pf-a" type="password" className="field mt-2" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" />
        {short && <p className="mt-1 text-xs text-high">En az {MIN_PASSPHRASE_LENGTH} karakter.</p>}
      </div>
      <div>
        <label htmlFor="pf-b" className="block text-fg">
          Tekrar
        </label>
        <input id="pf-b" type="password" className="field mt-2" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" />
        {mismatch && <p className="mt-1 text-xs text-high">Parolalar aynı değil.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-900/60 px-3 py-2.5">
      <dt className="text-xs text-fg-faint">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function AppearanceSection() {
  const [body, setBody] = useSetting('bodyModel');
  return (
    <Section title="Görünüm">
      <p className="mb-2 text-sm text-fg-muted">Tema (3D sahnenin ışığı ve arka planı da uyar)</p>
      <ThemePicker />
      <label htmlFor="body-model" className="mb-1.5 mt-5 block text-sm text-fg-muted">
        Keşfet ekranındaki vücut modeli
      </label>
      <select id="body-model" className="field max-w-xs" value={body} onChange={(e) => setBody(e.target.value as typeof body)}>
        <option value="auto">Profile göre (belirtilmemişse erkek)</option>
        <option value="female">Kadın</option>
        <option value="male">Erkek</option>
      </select>
      <p className="mt-3 text-sm text-fg-muted">Bu seçimler yalnızca bu cihazda, tercih olarak saklanır; sağlık verisi içermez.</p>
    </Section>
  );
}
