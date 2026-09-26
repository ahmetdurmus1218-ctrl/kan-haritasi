import type { PlatformAdapter } from '@kh/platform';
import { PassphraseKeyWrapper } from '@kh/vault';

/** Web kabuğu: parola + Argon2id, tarayıcı indirmesi, sekme görünürlüğü. */
export const webPlatform: PlatformAdapter = {
  platform: 'web',
  async info() {
    return { platform: 'web', deviceAuth: 'not_applicable' };
  },
  keys: {
    passphrase: (secret) => new PassphraseKeyWrapper(secret),
    device: () => null,
    forget: async () => undefined,
  },
  files: {
    async save(fileName, bytes, mimeType) {
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.append(a);
        a.click();
        a.remove();
        return true;
      } finally {
        // İndirme başlasın diye kısa süre sonra bırakılır; çözülmüş veri bellekte kalmaz.
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    },
  },
  onLifecycle(listener) {
    const handler = () => listener(document.visibilityState === 'hidden' ? 'background' : 'foreground');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  },
};
