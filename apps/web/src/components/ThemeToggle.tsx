import { useSetting } from '../state/settings';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const ORDER = ['system', 'light', 'dark'] as const;
const LABEL = { system: 'Sistem teması', light: 'Açık tema', dark: 'Koyu tema' } as const;

/** Tek düğme: sistem → açık → koyu. Seçim cihazda saklanır (sağlık verisi değildir). */
export function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const [theme, setTheme] = useSetting('theme');
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon;
  return (
    <button type="button" className={className} onClick={() => setTheme(next)} aria-label={`${LABEL[theme]} (değiştir: ${LABEL[next]})`} title={`${LABEL[theme]} · değiştirmek için dokun`}>
      <Icon size={17} />
    </button>
  );
}

/** Ayarlar için üç seçenekli seçici. */
export function ThemePicker() {
  const [theme, setTheme] = useSetting('theme');
  return (
    <div className="inline-flex rounded-xl border border-ink-600 p-1" role="radiogroup" aria-label="Tema">
      {ORDER.map((t) => {
        const Icon = t === 'light' ? SunIcon : t === 'dark' ? MoonIcon : MonitorIcon;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={theme === t}
            onClick={() => setTheme(t)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${theme === t ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            <Icon size={15} /> {t === 'system' ? 'Sistem' : t === 'light' ? 'Açık' : 'Koyu'}
          </button>
        );
      })}
    </div>
  );
}
