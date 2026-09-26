import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { MIN_PASSPHRASE_LENGTH, isVaultError } from '@kh/vault';
import { useVault } from '../state/VaultContext';
import { nextBlockDelayMs, readSetting, writeSetting } from '../state/settings';
import { userMessage } from '../lib/messages';
import { Banner, Dialog } from '../components/ui';
import { DropIcon, EyeIcon, EyeOffIcon, LockIcon, ShieldIcon, SpinnerIcon } from '../components/icons';

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid-bg flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
            <DropIcon size={22} />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">Kan Haritası</div>
            <div className="text-xs text-fg-muted">Tahlilini vücudunda keşfet</div>
          </div>
        </div>
        {children}
        <p className="mt-6 text-center text-xs leading-relaxed text-fg-faint">
          Kan Haritası teşhis koymaz; sonuçlarını anlamana yardım eden eğitim amaçlı bir araçtır.
        </p>
      </div>
    </div>
  );
}

function PassphraseField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="field pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
        />
        <button
          type="button"
          className="icon-btn absolute right-1 top-1/2 -translate-y-1/2"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Parolayı gizle' : 'Parolayı göster'}
        >
          {show ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
        </button>
      </div>
    </div>
  );
}

export function SetupScreen() {
  const { create } = useVault();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = pass.normalize('NFKC').length;
  const tooShort = length < MIN_PASSPHRASE_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== pass;
  const canSubmit = !tooShort && confirm === pass && understood && !busy;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    // Argon2id ana iş parçacığında çalışır; önce döndürücünün çizilmesine izin ver.
    await new Promise((r) => setTimeout(r, 30));
    try {
      await create(pass);
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="surface space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kasanı oluştur</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Raporların ve sonuçların yalnızca bu cihazda, bu parolayla şifrelenmiş olarak saklanır. Hesap yok, sunucu yok.
          </p>
        </div>

        <PassphraseField id="pass" label="Parola" value={pass} onChange={setPass} autoComplete="new-password" autoFocus />
        <div className="-mt-3 flex items-center gap-2 text-xs">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
            <div
              className={`h-full rounded-full transition-all ${tooShort ? 'bg-high' : 'bg-accent'}`}
              style={{ width: `${Math.min(100, (length / 16) * 100)}%` }}
            />
          </div>
          <span className={tooShort ? 'text-fg-faint' : 'text-accent'}>
            {tooShort ? `en az ${MIN_PASSPHRASE_LENGTH} karakter` : 'uygun'}
          </span>
        </div>

        <PassphraseField id="confirm" label="Parolayı tekrar yaz" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {mismatch && <p className="-mt-3 text-xs text-danger">Parolalar aynı değil.</p>}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
          />
          <span className="text-fg-muted">
            Parolamı unutursam verilerimin <strong className="text-fg">kurtarılamayacağını</strong> anlıyorum. Kimse, uygulamayı yapanlar dahil,
            parolamı sıfırlayamaz.
          </span>
        </label>

        {error && <Banner tone="error">{error}</Banner>}

        <button type="submit" className="btn-primary w-full py-3" disabled={!canSubmit}>
          {busy ? (
            <>
              <SpinnerIcon size={16} /> Anahtar türetiliyor…
            </>
          ) : (
            <>
              <ShieldIcon size={16} /> Kasayı oluştur
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}

export function UnlockScreen() {
  const { unlock, destroyAll } = useVault();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(() => readSetting('unlockBlockedUntil'));
  const [now, setNow] = useState(() => Date.now());
  const [forgotOpen, setForgotOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);

  const waitSeconds = Math.max(0, Math.ceil((blockedUntil - now) / 1000));

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitSeconds]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pass || busy || waitSeconds > 0) return;
    setBusy(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      await unlock(pass);
      writeSetting('unlockFailures', 0);
      writeSetting('unlockBlockedUntil', 0);
    } catch (err) {
      if (isVaultError(err, 'WRONG_PASSPHRASE')) {
        const failures = readSetting('unlockFailures') + 1;
        writeSetting('unlockFailures', failures);
        const delay = nextBlockDelayMs(failures);
        if (delay > 0) {
          const until = Date.now() + delay;
          writeSetting('unlockBlockedUntil', until);
          setBlockedUntil(until);
          setNow(Date.now());
        }
      }
      setError(userMessage(err));
      setPass('');
      setBusy(false);
    }
  }

  async function wipe() {
    setWiping(true);
    await destroyAll();
    writeSetting('unlockFailures', 0);
    writeSetting('unlockBlockedUntil', 0);
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="surface space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-700 text-fg-muted">
            <LockIcon size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Kasa kilitli</h1>
            <p className="text-sm text-fg-muted">Devam etmek için parolanı gir.</p>
          </div>
        </div>
        <PassphraseField id="unlock" label="Parola" value={pass} onChange={setPass} autoComplete="current-password" autoFocus />
        {error && <Banner tone="error">{error}</Banner>}
        {waitSeconds > 0 && <Banner tone="warn">Çok sayıda hatalı deneme. {waitSeconds} saniye sonra tekrar dene.</Banner>}
        <button type="submit" className="btn-primary w-full py-3" disabled={!pass || busy || waitSeconds > 0}>
          {busy ? (
            <>
              <SpinnerIcon size={16} /> Açılıyor…
            </>
          ) : (
            'Kilidi aç'
          )}
        </button>
        <button type="button" className="w-full text-center text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline" onClick={() => setForgotOpen(true)}>
          Parolamı unuttum
        </button>
      </form>

      <Dialog
        open={forgotOpen}
        onClose={() => {
          setForgotOpen(false);
          setConfirmText('');
        }}
        title="Parola kurtarılamaz"
        tone="danger"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setForgotOpen(false)}>
              Vazgeç
            </button>
            <button type="button" className="btn-danger" disabled={confirmText.trim().toLocaleUpperCase('tr') !== 'SİL' || wiping} onClick={wipe}>
              {wiping ? <SpinnerIcon size={16} /> : null} Tüm verileri sil
            </button>
          </>
        }
      >
        <p>
          Veriler parolanla şifrelendiği için parola olmadan açılamaz. Yeniden başlamak için bu cihazdaki tüm belgeleri ve sonuçları silebilirsin.
          Bu işlem geri alınamaz.
        </p>
        <label htmlFor="confirm-wipe" className="mt-4 block text-fg">
          Onaylamak için <strong>SİL</strong> yaz
        </label>
        <input id="confirm-wipe" className="field mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
      </Dialog>
    </AuthLayout>
  );
}
