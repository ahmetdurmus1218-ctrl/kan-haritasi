import { useEffect, useState, type ReactNode } from 'react';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { AUTO_LOCK_OPTIONS, readSetting, writeSetting, type Settings } from '../state/settings';
import { formatBytes } from '../lib/format';
import { Banner, Dialog, StatusTag } from '../components/ui';
import { CheckIcon, LockIcon, ShieldIcon, SpinnerIcon, TrashIcon } from '../components/icons';

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

export function PrivacyPage() {
  const vault = useUnlockedVault();
  const { stores, destroyAll } = useVault();
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [autoLock, setAutoLock] = useState<Settings['autoLockMinutes']>(() => readSetting('autoLockMinutes'));
  const [wipeOpen, setWipeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    vault.usage().then(setUsage, () => setUsage(null));
    navigator.storage?.estimate?.().then((e) => setQuota({ usage: e.usage ?? 0, quota: e.quota ?? 0 }), () => undefined);
    navigator.storage?.persisted?.().then(setPersisted, () => undefined);
  }, [vault]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <div className="mb-2">
        <p className="label-caps mb-1.5">Gizlilik ve Güvenlik</p>
        <h1 className="text-2xl font-semibold tracking-tight">Verilerin nerede ve nasıl duruyor</h1>
      </div>

      <Section title="Veri akışı" aside={<span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Dışarı gönderim yok</span>}>
        <ul className="space-y-2.5">
          <Fact>Raporların bu tarayıcıda işlenir ve hiçbir sunucuya gönderilmez. Uygulamanın dışarıya veri gönderebileceği bir uç nokta yoktur; güvenlik politikası (CSP) başka adreslere bağlantıyı engeller.</Fact>
          <Fact>Reklam, analitik, takip veya çökme raporlama servisi kullanılmıyor.</Fact>
          <Fact>Harici yapay zekâya veri gönderimi: <strong className="text-fg">yok</strong>. Bu sürümde AI özelliği bağlı değil; ileride eklenirse varsayılan kapalı olacak ve ne gönderileceği önceden gösterilecek.</Fact>
          <Fact>Uygulama dosyaları (kod) ilk açılışta barındırma sunucusundan indirilir; sunucu yalnızca IP adresini ve istenen dosya adlarını görür, sağlık verini görmez. Sonrasında uygulama çevrimdışı çalışır.</Fact>
          <Fact ok={false}>Tarayıcı eklentileri açık sayfanın içeriğini görebilir; bu teknik olarak engellenemez. Güvenmediğin eklentileri bu sayfada kapatmanı öneririz.</Fact>
        </ul>
      </Section>

      <Section title="Depolama">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Belge" value={usage ? String(usage.count) : '–'} />
          <Stat label="Belge boyutu" value={usage ? formatBytes(usage.bytes) : '–'} />
          <Stat label="Tarayıcı kullanımı" value={quota ? formatBytes(quota.usage) : '–'} />
          <Stat label="Depo" value={stores?.blobBackend === 'opfs' ? 'OPFS' : 'IndexedDB'} />
        </dl>
        <ul className="mt-4 space-y-2.5">
          <Fact>Her belge kendi 256 bit anahtarıyla (AES-256-GCM) şifrelenir; anahtarlar da parolandan türetilen ana anahtarla (Argon2id) korunur.</Fact>
          <Fact ok={persisted === true}>
            {persisted === true
              ? 'Tarayıcı bu verileri kalıcı olarak saklamayı kabul etti.'
              : 'Tarayıcı, depolama dolarsa verileri silebilir. Yedek alma Faz 6\'da geliyor; o zamana kadar önemli raporların orijinallerini ayrıca sakla.'}
          </Fact>
        </ul>
      </Section>

      <Section title="Kilit" aside={<LockIcon size={17} className="text-fg-muted" />}>
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
        <p className="mt-3 text-sm text-fg-muted">Hesap ve oturum yoktur; kasa yalnızca bu cihazda, parolanla açılır. Kilitlendiğinde ana anahtar bellekten bırakılır.</p>
      </Section>

      <Section title="Yedek ve dışa aktarma" aside={<StatusTag>FAZ 6</StatusTag>}>
        <p className="text-sm text-fg-muted">Şifreli yedek (.khyedek) ve "Verilerimi indir" henüz bağlı değil. Şimdilik her belgenin orijinalini Belgelerim ekranından tek tek indirebilirsin.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled>
            Şifreli yedek al
          </button>
          <button type="button" className="btn-ghost" disabled>
            Yedekten geri yükle
          </button>
          <button type="button" className="btn-ghost" disabled>
            Verilerimi indir
          </button>
        </div>
      </Section>

      <section className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
        <h2 className="font-semibold text-danger">Tüm verileri sil</h2>
        <p className="mt-2 text-sm text-fg-muted">
          Önce ana anahtar, sonra tüm belgeler ve kayıtlar bu cihazdan silinir. Ana anahtar silindiği için depoda iz kalsa bile okunamaz. Geri alınamaz.
        </p>
        <button type="button" className="btn-danger mt-4" onClick={() => setWipeOpen(true)}>
          <TrashIcon size={16} /> Tüm verileri sil
        </button>
      </section>

      <Dialog
        open={wipeOpen}
        onClose={() => {
          setWipeOpen(false);
          setConfirmText('');
        }}
        title="Tüm veriler silinsin mi?"
        tone="danger"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setWipeOpen(false)}>
              Vazgeç
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={confirmText.trim().toLocaleUpperCase('tr') !== 'SİL' || wiping}
              onClick={async () => {
                setWiping(true);
                await destroyAll();
              }}
            >
              {wiping ? <SpinnerIcon size={16} /> : null} Kalıcı olarak sil
            </button>
          </>
        }
      >
        <p>Bu cihazdaki {usage?.count ?? 0} belge ve ana anahtar silinecek.</p>
        <label htmlFor="wipe-confirm" className="mt-4 block text-fg">
          Onaylamak için <strong>SİL</strong> yaz
        </label>
        <input id="wipe-confirm" className="field mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
      </Dialog>

      <Banner tone="info">Kan Haritası teşhis koymaz. Sonuçlarınla ilgili kararları bir sağlık profesyoneliyle birlikte ver.</Banner>
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
