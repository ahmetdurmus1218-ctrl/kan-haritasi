import { DEVICE_KEY_SCHEME, type DeviceAuthState, type PlatformAdapter, type PlatformInfo } from '@kh/platform';
import { type Bytes, type KeyWrapper, PassphraseKeyWrapper, VaultError, type WrappedMasterKey, fromBase64, toBase64, wipe } from '@kh/vault';

/**
 * Android kabuğuyla konuşan köprü istemcisi.
 *
 * Native taraf `khNative` nesnesini yalnızca https://appassets.androidplatform.net kökenine
 * ve yalnızca ana çerçeveye enjekte eder (WebViewCompat.addWebMessageListener). Mesajlar JSON
 * dizesidir; her istek bir kimlik taşır ve native taraf aynı kimlikle yanıt verir.
 */
interface NativeObject {
  postMessage(message: string): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

type Reply = { id: string; ok: true; result: Record<string, unknown> } | { id: string; ok: false; code: string };
type Event = { event: 'background' | 'foreground' };

const nativeObject = (globalThis as { khNative?: NativeObject }).khNative;

export function isAndroidShell(): boolean {
  return nativeObject !== undefined;
}

const pending = new Map<string, { resolve: (v: Record<string, unknown>) => void; reject: (e: unknown) => void; timer?: ReturnType<typeof setTimeout> }>();
const lifecycleListeners = new Set<(s: 'background' | 'foreground') => void>();
let counter = 0;

if (nativeObject) {
  nativeObject.onmessage = (e: MessageEvent) => {
    if (typeof e.data !== 'string') return;
    let msg: Reply | Event;
    try {
      msg = JSON.parse(e.data) as Reply | Event;
    } catch {
      return;
    }
    if ('event' in msg) {
      if (msg.event === 'background' || msg.event === 'foreground') lifecycleListeners.forEach((l) => l(msg.event));
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.result ?? {});
    else p.reject(mapError(msg.code));
  };
}

function mapError(code: string): VaultError {
  switch (code) {
    case 'CANCELLED':
      return new VaultError('AUTH_CANCELLED');
    case 'KEY_INVALIDATED':
    case 'KEY_MISSING':
      return new VaultError('KEY_INVALIDATED');
    case 'LOCKOUT':
    case 'UNAVAILABLE':
    case 'FAILED':
      return new VaultError('AUTH_UNAVAILABLE');
    default:
      return new VaultError('STORAGE', `native: ${code}`);
  }
}

/** timeoutMs = 0: süresiz (kullanıcı biyometrik istemde veya dosya seçicide bekliyor olabilir). */
function call(type: string, payload: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<Record<string, unknown>> {
  if (!nativeObject) return Promise.reject(new VaultError('AUTH_UNAVAILABLE'));
  const id = `m${++counter}-${Math.random().toString(36).slice(2, 10)}`;
  return new Promise((resolve, reject) => {
    const entry: { resolve: typeof resolve; reject: typeof reject; timer?: ReturnType<typeof setTimeout> } = { resolve, reject };
    if (timeoutMs > 0) {
      entry.timer = setTimeout(() => {
        pending.delete(id);
        reject(new VaultError('STORAGE', 'native timeout'));
      }, timeoutMs);
    }
    pending.set(id, entry);
    nativeObject.postMessage(JSON.stringify({ id, type, payload }));
  });
}

/** Ana anahtarı Android Keystore'daki, cihaz kilidi doğrulaması gerektiren bir AES anahtarıyla sarar. */
class DeviceKeyWrapper implements KeyWrapper {
  readonly scheme = DEVICE_KEY_SCHEME;

  async wrap(masterKey: Bytes): Promise<WrappedMasterKey> {
    const r = await call('keys.wrap', { mk: toBase64(masterKey) }, 0);
    if (typeof r.iv !== 'string' || typeof r.ct !== 'string') throw new VaultError('INTEGRITY', 'bad native reply');
    return { scheme: this.scheme, iv: r.iv, ct: r.ct };
  }

  async unwrap(wrapped: WrappedMasterKey): Promise<Bytes> {
    if (typeof wrapped.iv !== 'string' || typeof wrapped.ct !== 'string') throw new VaultError('INTEGRITY', 'malformed wrapped key');
    const r = await call('keys.unwrap', { iv: wrapped.iv, ct: wrapped.ct }, 0);
    if (typeof r.mk !== 'string') throw new VaultError('INTEGRITY', 'bad native reply');
    const mk = fromBase64(r.mk);
    if (mk.length !== 32) {
      wipe(mk);
      throw new VaultError('INTEGRITY', 'bad key length');
    }
    return mk;
  }
}

let infoCache: Promise<PlatformInfo> | null = null;

export const androidPlatform: PlatformAdapter = {
  platform: 'android',
  info() {
    infoCache ??= call('hello').then(
      (r): PlatformInfo => ({
        platform: 'android',
        deviceAuth: (['available', 'none_enrolled', 'unavailable'].includes(r.deviceAuth as string) ? r.deviceAuth : 'unavailable') as DeviceAuthState,
        appVersion: typeof r.appVersion === 'string' ? r.appVersion : undefined,
      }),
      (): PlatformInfo => ({ platform: 'android', deviceAuth: 'unavailable' }),
    );
    return infoCache;
  },
  keys: {
    passphrase: (secret) => new PassphraseKeyWrapper(secret),
    device: () => new DeviceKeyWrapper(),
    forget: async () => {
      await call('keys.delete').catch(() => undefined);
    },
  },
  files: {
    async save(fileName, bytes, mimeType) {
      const r = await call('file.save', { name: fileName, mime: mimeType, data: toBase64(bytes) }, 0);
      return r.saved === true;
    },
  },
  onLifecycle(listener) {
    lifecycleListeners.add(listener);
    return () => lifecycleListeners.delete(listener);
  },
};
