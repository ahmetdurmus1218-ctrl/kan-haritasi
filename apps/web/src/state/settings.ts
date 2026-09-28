import { useEffect, useState } from 'react';

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
  /** Görünüm teması: sistem ayarını izle ya da açık/koyu sabitle. 3D sahnenin ışığı ve arka planı da buna uyar. */
  theme: 'system' | 'light' | 'dark';
  /** Keşfet ekranındaki vücut modeli: auto = profildeki cinsiyete göre (belirtilmemişse erkek). */
  bodyModel: 'auto' | 'male' | 'female';
}

const DEFAULTS: Settings = { autoLockMinutes: 5, unlockFailures: 0, unlockBlockedUntil: 0, deviceUnlockWanted: false, profileSex: 'unspecified', theme: 'system', bodyModel: 'auto' };
const PREFIX = 'kh.setting.';

export const AUTO_LOCK_OPTIONS: Settings['autoLockMinutes'][] = [0, 1, 5, 15];

/** Depolama kapalıysa (gizli pencere vb.) değişiklikler oturum boyunca burada tutulur. */
const memory = new Map<keyof Settings, unknown>();

export function readSetting<K extends keyof Settings>(key: K): Settings[K] {
  if (memory.has(key)) return memory.get(key) as Settings[K];
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return DEFAULTS[key];
    const value = JSON.parse(raw) as unknown;
    if (key === 'autoLockMinutes') {
      return (AUTO_LOCK_OPTIONS.includes(value as Settings['autoLockMinutes']) ? value : DEFAULTS[key]) as Settings[K];
    }
    if (key === 'deviceUnlockWanted') return (typeof value === 'boolean' ? value : DEFAULTS[key]) as Settings[K];
    if (key === 'theme') return (['system', 'light', 'dark'].includes(value as string) ? value : DEFAULTS[key]) as Settings[K];
    if (key === 'bodyModel') return (['auto', 'male', 'female'].includes(value as string) ? value : DEFAULTS[key]) as Settings[K];
    if (key === 'profileSex') return (['unspecified', 'female', 'male'].includes(value as string) ? value : DEFAULTS[key]) as Settings[K];
    return (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : DEFAULTS[key]) as Settings[K];
  } catch {
    return DEFAULTS[key];
  }
}

export function writeSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  memory.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Depolama kapalıysa ayar yalnızca bu oturumda (bellekte) geçerli olur; uygulama yine çalışır.
  }
  window.dispatchEvent(new CustomEvent(SETTING_EVENT, { detail: key }));
}

/** Ayar değişince (aynı sekmede) gönderilen olay; ayrıntıda değişen anahtar bulunur. */
export const SETTING_EVENT = 'kh:setting';

/** Bir ayarı okuyup değişikliklerini izleyen kanca (tema, vücut modeli gibi görünüm tercihleri için). */
export function useSetting<K extends keyof Settings>(key: K): [Settings[K], (v: Settings[K]) => void] {
  const [value, setValue] = useState(() => readSetting(key));
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(readSetting(key));
    };
    window.addEventListener(SETTING_EVENT, on);
    return () => window.removeEventListener(SETTING_EVENT, on);
  }, [key]);
  return [value, (v) => writeSetting(key, v)];
}

/** Beş hatalı denemeden sonra artan bekleme: 30 sn, 1 dk, 2 dk ... en fazla 15 dk. */
export function nextBlockDelayMs(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(15 * 60_000, 30_000 * 2 ** (failures - 5));
}
