import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type BrowserStores, Vault, openBrowserStores } from '@kh/vault';
import { DEVICE_KEY_SCHEME, type PlatformInfo } from '@kh/platform';
import { platform } from '../platform';
import { logEvent } from '../log';
import { readSetting, writeSetting } from './settings';

type Status =
  | { kind: 'loading' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'setup' }
  | { kind: 'locked' }
  | { kind: 'unlocked'; vault: Vault };

interface VaultApi {
  status: Status;
  stores: BrowserStores | null;
  info: PlatformInfo | null;
  /** Kasada kayıtlı kilit açma yöntemleri. */
  schemes: string[];
  /** useDevice: Android'de cihaz kilidi + kurtarma parolası; aksi halde yalnızca parola. */
  create(passphrase: string, useDevice: boolean): Promise<void>;
  unlockWithPassphrase(passphrase: string): Promise<'ok' | 'device-relinked' | 'device-relink-failed'>;
  unlockWithDevice(): Promise<void>;
  /** Kilit açıkken: parola değiştirme veya cihaz kilidini bağlama (mevcut parola gerekir). */
  rewrap(currentPassphrase: string, change: { newPassphrase?: string; linkDevice?: boolean }): Promise<void>;
  unlinkDevice(): Promise<void>;
  lock(): void;
  destroyAll(): Promise<void>;
  /** Kilit açıkken belge listesi gibi türetilmiş durumların yenilenmesi için artan sayaç. */
  revision: number;
  bump(): void;
  hidden: boolean;
}

const Ctx = createContext<VaultApi | null>(null);

export function useVault(): VaultApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('VaultProvider missing');
  return v;
}

export function useUnlockedVault(): Vault {
  const { status } = useVault();
  if (status.kind !== 'unlocked') throw new Error('vault locked');
  return status.vault;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [stores, setStores] = useState<BrowserStores | null>(null);
  const [info, setInfo] = useState<PlatformInfo | null>(null);
  const [schemes, setSchemes] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [hidden, setHidden] = useState(false);
  const vaultRef = useRef<Vault | null>(null);

  const refreshSchemes = useCallback(async (s: BrowserStores) => setSchemes(await Vault.schemes(s.records)), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
        setStatus({ kind: 'unsupported', reason: 'Bu sayfa güvenli bağlantı (HTTPS) üzerinden açılmalı.' });
        return;
      }
      try {
        const [s, i] = await Promise.all([openBrowserStores(), platform.info()]);
        if (cancelled) return;
        setStores(s);
        setInfo(i);
        await refreshSchemes(s);
        setStatus((await Vault.isInitialized(s.records)) ? { kind: 'locked' } : { kind: 'setup' });
      } catch {
        setStatus({ kind: 'unsupported', reason: 'Tarayıcı yerel depolamaya izin vermiyor (gizli sekme olabilir).' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSchemes]);

  const opened = useCallback((vault: Vault) => {
    vaultRef.current = vault;
    void vault.sweepOrphans().catch(() => 0);
    setStatus({ kind: 'unlocked', vault });
  }, []);

  const lock = useCallback(() => {
    vaultRef.current?.lock();
    vaultRef.current = null;
    setStatus((s) => (s.kind === 'unlocked' ? { kind: 'locked' } : s));
    logEvent('vault.locked');
  }, []);

  const create = useCallback(
    async (passphrase: string, useDevice: boolean) => {
      if (!stores) return;
      const device = useDevice ? platform.keys.device() : null;
      const wrappers = device ? [device, platform.keys.passphrase(passphrase)] : [platform.keys.passphrase(passphrase)];
      const vault = await Vault.create(stores.records, stores.blobs, wrappers);
      // Tarayıcıdan verinin kendiliğinden silinmemesini iste (izin vermeyebilir).
      await navigator.storage?.persist?.().catch(() => false);
      await refreshSchemes(stores);
      opened(vault);
    },
    [stores, opened, refreshSchemes],
  );

  const unlockWithPassphrase = useCallback(
    async (passphrase: string) => {
      if (!stores) return 'ok' as const;
      // Android'de cihaz kilidi anahtarı yoksa (ör. ekran kilidi kaldırılıp geri eklendi) yeniden bağla.
      const device = info?.deviceAuth === 'available' ? platform.keys.device() : null;
      const current = await Vault.schemes(stores.records);
      const relink = device && !current.includes(DEVICE_KEY_SCHEME) && current.length > 0 && readSetting('deviceUnlockWanted');
      const vault = await Vault.unlock(stores.records, stores.blobs, platform.keys.passphrase(passphrase), relink ? { rewrap: [device] } : {});
      await refreshSchemes(stores);
      opened(vault);
      if (!relink) return 'ok' as const;
      return vault.lastRewrap === 'ok' ? ('device-relinked' as const) : ('device-relink-failed' as const);
    },
    [stores, info, opened, refreshSchemes],
  );

  const unlockWithDevice = useCallback(async () => {
    const device = platform.keys.device();
    if (!stores || !device) return;
    const vault = await Vault.unlock(stores.records, stores.blobs, device);
    opened(vault);
  }, [stores, opened]);

  const rewrap = useCallback(
    async (currentPassphrase: string, change: { newPassphrase?: string; linkDevice?: boolean }) => {
      if (!stores) return;
      const wrappers = [];
      if (change.newPassphrase) wrappers.push(platform.keys.passphrase(change.newPassphrase));
      const device = change.linkDevice ? platform.keys.device() : null;
      if (device) wrappers.push(device);
      const vault = await Vault.unlock(stores.records, stores.blobs, platform.keys.passphrase(currentPassphrase), { rewrap: wrappers });
      vaultRef.current?.lock();
      await refreshSchemes(stores);
      opened(vault);
      if (vault.lastRewrap !== 'ok') throw new Error('rewrap failed');
      if (device) writeSetting('deviceUnlockWanted', true);
    },
    [stores, opened, refreshSchemes],
  );

  const unlinkDevice = useCallback(async () => {
    if (!stores || !vaultRef.current) return;
    await vaultRef.current.removeUnlockMethod(DEVICE_KEY_SCHEME);
    await platform.keys.forget();
    writeSetting('deviceUnlockWanted', false);
    await refreshSchemes(stores);
  }, [stores, refreshSchemes]);

  const destroyAll = useCallback(async () => {
    if (!stores) return;
    if (vaultRef.current) await vaultRef.current.destroyAll();
    else await Vault.destroyWithoutUnlock(stores.records, stores.blobs);
    await platform.keys.forget();
    vaultRef.current = null;
    await refreshSchemes(stores);
    setStatus({ kind: 'setup' });
  }, [stores, refreshSchemes]);

  // Cihaz kilidi seçildiyse sonradan anahtar kaybolursa yeniden bağlamayı hatırla.
  useEffect(() => {
    if (schemes.includes(DEVICE_KEY_SCHEME)) writeSetting('deviceUnlockWanted', true);
  }, [schemes]);

  // Otomatik kilit. Android arka plandaki süreci dondurabildiği için zamanlayıcıya ek olarak
  // ön plana dönüşte geçen süre de kontrol edilir.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt = 0;
    const onChange = (state: 'background' | 'foreground') => {
      const isHidden = state === 'background';
      setHidden(isHidden);
      clearTimeout(timer);
      if (!vaultRef.current) return;
      const minutes = readSetting('autoLockMinutes');
      if (isHidden) {
        hiddenAt = Date.now();
        if (minutes === 0) lock();
        else timer = setTimeout(lock, minutes * 60_000);
      } else if (hiddenAt && Date.now() - hiddenAt >= minutes * 60_000) {
        lock();
      }
    };
    const unsubscribe = platform.onLifecycle(onChange);
    // Android'de WebView de visibilitychange üretebilir; ikisi birlikte zararsızdır.
    const onVisibility = () => onChange(document.visibilityState === 'hidden' ? 'background' : 'foreground');
    if (platform.platform === 'android') document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timer);
    };
  }, [lock]);

  const api = useMemo<VaultApi>(
    () => ({
      status,
      stores,
      info,
      schemes,
      create,
      unlockWithPassphrase,
      unlockWithDevice,
      rewrap,
      unlinkDevice,
      lock,
      destroyAll,
      revision,
      bump: () => setRevision((r) => r + 1),
      hidden,
    }),
    [status, stores, info, schemes, create, unlockWithPassphrase, unlockWithDevice, rewrap, unlinkDevice, lock, destroyAll, revision, hidden],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
