/**
 * Hassas olmayan cihaz ayarları (localStorage). Buraya asla sağlık verisi, dosya adı
 * veya parola ile ilgili bir şey yazılmaz; yalnızca tercih ve deneme sayacı.
 */
export interface Settings {
  autoLockMinutes: 0 | 1 | 5 | 15;
  unlockFailures: number;
  unlockBlockedUntil: number;
  /** Android: kullanıcı cihaz kilidiyle açmayı seçti (anahtar kaybolursa yeniden bağlanır). */
  deviceUnlockWanted: boolean;
  /** Sonuçlarda gösterilecek cinsiyet (yalnızca raporda aralık yoksa genel aralık seçimi için). */
  profileSex: 'unspecified' | 'female' | 'male';
}

const DEFAULTS: Settings = { autoLockMinutes: 5, unlockFailures: 0, unlockBlockedUntil: 0, deviceUnlockWanted: false, profileSex: 'unspecified' };
const PREFIX = 'kh.setting.';

export const AUTO_LOCK_OPTIONS: Settings['autoLockMinutes'][] = [0, 1, 5, 15];

export function readSetting<K extends keyof Settings>(key: K): Settings[K] {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return DEFAULTS[key];
    const value = JSON.parse(raw) as unknown;
    if (key === 'autoLockMinutes') {
      return (AUTO_LOCK_OPTIONS.includes(value as Settings['autoLockMinutes']) ? value : DEFAULTS[key]) as Settings[K];
    }
    if (key === 'deviceUnlockWanted') return (typeof value === 'boolean' ? value : DEFAULTS[key]) as Settings[K];
    if (key === 'profileSex') return (['unspecified', 'female', 'male'].includes(value as string) ? value : DEFAULTS[key]) as Settings[K];
    return (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : DEFAULTS[key]) as Settings[K];
  } catch {
    return DEFAULTS[key];
  }
}

export function writeSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Depolama kapalıysa ayar yalnızca bu oturumda geçerli olmaz; uygulama yine çalışır.
  }
}

/** Beş hatalı denemeden sonra artan bekleme: 30 sn, 1 dk, 2 dk ... en fazla 15 dk. */
export function nextBlockDelayMs(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(15 * 60_000, 30_000 * 2 ** (failures - 5));
}
