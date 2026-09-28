import { useEffect, useState } from 'react';
import { SETTING_EVENT, type Settings, readSetting } from './settings';

export type ResolvedTheme = 'light' | 'dark';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function resolveTheme(pref: Settings['theme']): ResolvedTheme {
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark';
}

/** Temayı belgeye uygular: CSS değişkenleri `data-theme` ile değişir; tarayıcı çubuğu rengi de güncellenir. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f7fb' : '#070a0f');
}

/** Uygulama açılırken bir kez çağrılır; ayar ya da sistem teması değişince belgeyi günceller. */
export function initTheme(): void {
  const update = () => applyTheme(resolveTheme(readSetting('theme')));
  update();
  window.matchMedia?.(LIGHT_QUERY).addEventListener('change', update);
  window.addEventListener(SETTING_EVENT, (e) => {
    if ((e as CustomEvent<string>).detail === 'theme') update();
  });
}

/** Etkin tema (3D sahnenin ışığı ve arka planı için). */
export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(readSetting('theme')));
  useEffect(() => {
    const update = () => setTheme(resolveTheme(readSetting('theme')));
    const mq = window.matchMedia?.(LIGHT_QUERY);
    mq?.addEventListener('change', update);
    const onSetting = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'theme') update();
    };
    window.addEventListener(SETTING_EVENT, onSetting);
    return () => {
      mq?.removeEventListener('change', update);
      window.removeEventListener(SETTING_EVENT, onSetting);
    };
  }, []);
  return theme;
}
