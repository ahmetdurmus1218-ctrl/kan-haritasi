import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type BrowserStores, Vault, openBrowserStores } from '@kh/vault';
import { webPlatform } from '../platform-web';
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
  create(passphrase: string): Promise<void>;
  unlock(passphrase: string): Promise<void>;
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
  const [revision, setRevision] = useState(0);
  const [hidden, setHidden] = useState(false);
  const vaultRef = useRef<Vault | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
        setStatus({ kind: 'unsupported', reason: 'Bu sayfa güvenli bağlantı (HTTPS) üzerinden açılmalı.' });
        return;
      }
      try {
        const s = await openBrowserStores();
        if (cancelled) return;
        setStores(s);
        setStatus((await Vault.isInitialized(s.records)) ? { kind: 'locked' } : { kind: 'setup' });
      } catch {
        setStatus({ kind: 'unsupported', reason: 'Tarayıcı yerel depolamaya izin vermiyor (gizli sekme olabilir).' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lock = useCallback(() => {
    vaultRef.current?.lock();
    vaultRef.current = null;
    setStatus((s) => (s.kind === 'unlocked' ? { kind: 'locked' } : s));
    logEvent('vault.locked');
  }, []);

  const create = useCallback(
    async (passphrase: string) => {
      if (!stores) return;
      const vault = await Vault.create(stores.records, stores.blobs, webPlatform.keys.wrapper(passphrase));
      vaultRef.current = vault;
      // Tarayıcıdan verinin kendiliğinden silinmemesini iste (izin vermeyebilir).
      await navigator.storage?.persist?.().catch(() => false);
      setStatus({ kind: 'unlocked', vault });
    },
    [stores],
  );

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!stores) return;
      const vault = await Vault.unlock(stores.records, stores.blobs, webPlatform.keys.wrapper(passphrase));
      vaultRef.current = vault;
      void vault.sweepOrphans().catch(() => 0);
      setStatus({ kind: 'unlocked', vault });
    },
    [stores],
  );

  const destroyAll = useCallback(async () => {
    if (!stores) return;
    if (vaultRef.current) await vaultRef.current.destroyAll();
    else await Vault.destroyWithoutUnlock(stores.records, stores.blobs);
    vaultRef.current = null;
    setStatus({ kind: 'setup' });
  }, [stores]);

  // Otomatik kilit: sekme/uygulama arka plana gidince süre başlar; dönünce iptal edilir.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onVisibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      setHidden(isHidden);
      clearTimeout(timer);
      if (isHidden && vaultRef.current) {
        const minutes = readSetting('autoLockMinutes');
        if (minutes === 0) lock();
        else timer = setTimeout(lock, minutes * 60_000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timer);
    };
  }, [lock]);

  const api = useMemo<VaultApi>(
    () => ({ status, stores, create, unlock, lock, destroyAll, revision, bump: () => setRevision((r) => r + 1), hidden }),
    [status, stores, create, unlock, lock, destroyAll, revision, hidden],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export { readSetting, writeSetting };
