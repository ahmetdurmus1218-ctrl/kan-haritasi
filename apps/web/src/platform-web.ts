import type { PlatformAdapter } from '@kh/platform';
import { PassphraseKeyWrapper } from '@kh/vault';

/** Web kabuğu: parola + Argon2id, tarayıcı indirmesi. Android kabuğu Faz 2'de aynı arayüzü uygular. */
export const webPlatform: PlatformAdapter = {
  platform: 'web',
  keys: {
    method: 'passphrase',
    wrapper(secret) {
      return new PassphraseKeyWrapper(secret ?? '');
    },
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
      } finally {
        // İndirme başlasın diye kısa süre sonra bırakılır; çözülmüş veri bellekte kalmaz.
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    },
  },
  screen: {
    setSecure() {
      // Web'de karşılığı yok; sekme gizlenince içerik arayüzde bulanıklaştırılır.
    },
  },
};
