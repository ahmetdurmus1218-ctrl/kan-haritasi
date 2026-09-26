import type { KeyWrapper } from '@kh/vault';

export type DeviceAuthState = 'available' | 'none_enrolled' | 'unavailable' | 'not_applicable';

export interface PlatformInfo {
  platform: 'web' | 'android';
  /** Android'de cihaz kilidi (biyometri/PIN) ile anahtar sarma kullanılabilir mi. */
  deviceAuth: DeviceAuthState;
  appVersion?: string;
}

/**
 * Platforma özgü her şey bu arayüzün arkasındadır. Çekirdek (arayüz, kasa, ayrıştırıcı, 3D)
 * yalnızca buna bağlıdır.
 *
 * - Web: parola + Argon2id, tarayıcı indirmesi, visibilitychange.
 * - Android: Keystore + BiometricPrompt (cihaz kilidi), SAF ile kaydetme, yaşam döngüsü olayları —
 *   hepsi yalnızca uygulamanın kendi kökenine açık bir WebView köprüsü üzerinden.
 */
export interface PlatformAdapter {
  readonly platform: 'web' | 'android';
  info(): Promise<PlatformInfo>;
  keys: {
    passphrase(secret: string): KeyWrapper;
    /** Cihaz kilidi sarmalayıcısı; platform desteklemiyorsa null. */
    device(): KeyWrapper | null;
    /** Tüm veriler silinirken cihazdaki anahtarı da siler. */
    forget(): Promise<void>;
  };
  files: {
    /** Orijinal baytları değiştirmeden kullanıcının seçtiği yere kaydeder. false: kullanıcı vazgeçti. */
    save(fileName: string, bytes: Uint8Array<ArrayBuffer>, mimeType: string): Promise<boolean>;
  };
  /** Uygulama arka plana/ön plana geçtiğinde çağrılır. Dönen fonksiyon aboneliği kaldırır. */
  onLifecycle(listener: (state: 'background' | 'foreground') => void): () => void;
}

export const DEVICE_KEY_SCHEME = 'android-keystore-v1';
