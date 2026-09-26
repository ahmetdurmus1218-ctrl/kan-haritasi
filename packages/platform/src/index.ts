import type { KeyWrapper } from '@kh/vault';

/**
 * Platforma özgü her şey bu arayüzün arkasındadır. Çekirdek (arayüz, kasa, ayrıştırıcı, 3D)
 * yalnızca buna bağlıdır; Web ve Android kabukları kendi uygulamalarını verir.
 *
 * - Web (Faz 1): parola + Argon2id, tarayıcı indirmesi.
 * - Android (Faz 2): Keystore + BiometricPrompt, SAF ile kaydetme, FLAG_SECURE — köprü üzerinden.
 */
export interface PlatformAdapter {
  readonly platform: 'web' | 'android';
  keys: {
    /** 'passphrase': arayüz parola sorar. 'biometric': native istem gösterilir. */
    readonly method: 'passphrase' | 'biometric';
    wrapper(secret?: string): KeyWrapper;
  };
  files: {
    /** Orijinal baytları değiştirmeden kullanıcının seçtiği yere kaydeder. */
    save(fileName: string, bytes: Uint8Array<ArrayBuffer>, mimeType: string): Promise<void>;
  };
  screen: {
    /** Android'de FLAG_SECURE; web'de sekme gizlenince bulanıklaştırma arayüzde yapılır. */
    setSecure(on: boolean): void;
  };
}
