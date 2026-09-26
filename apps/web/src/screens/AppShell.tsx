import type { ReactNode } from 'react';
import { useVault } from '../state/VaultContext';
import { type Route, hrefFor } from '../state/router';
import { BodyIcon, ChartIcon, DropIcon, FolderIcon, ListIcon, LockIcon, ShieldIcon } from '../components/icons';

type NavKey = 'documents' | 'results' | 'body' | 'timeline' | 'privacy';

const NAV: { key: NavKey; label: string; icon: (p: { size?: number }) => ReactNode; phase?: number }[] = [
  { key: 'documents', label: 'Belgeler', icon: FolderIcon },
  { key: 'results', label: 'Sonuçlar', icon: ListIcon, phase: 3 },
  { key: 'body', label: 'Vücut', icon: BodyIcon, phase: 4 },
  { key: 'timeline', label: 'Zaman', icon: ChartIcon, phase: 6 },
  { key: 'privacy', label: 'Gizlilik', icon: ShieldIcon },
];

function activeKey(route: Route): NavKey {
  return route.name === 'document' ? 'documents' : route.name;
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { lock, hidden } = useVault();
  const active = activeKey(route);

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Masaüstü / tablet kenar çubuğu */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900/70 md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
            <DropIcon size={19} />
          </div>
          <span className="font-semibold tracking-tight">Kan Haritası</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Ana gezinme">
          {NAV.map(({ key, label, icon: Icon, phase }) => {
            const isActive = key === active;
            return (
              <a
                key={key}
                href={hrefFor({ name: key } as Route)}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:bg-ink-800 hover:text-fg'
                }`}
              >
                <span className={isActive ? 'text-accent' : ''}>
                  <Icon size={17} />
                </span>
                <span className="flex-1">{label}</span>
                {phase && <span className="font-mono text-[10px] text-fg-faint">Faz {phase}</span>}
              </a>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-ink-700 p-4">
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Veriler bu cihazda, şifreli
          </div>
          <button type="button" className="btn-ghost w-full" onClick={lock}>
            <LockIcon size={16} /> Kilitle
          </button>
        </div>
      </aside>

      {/* Mobil üst çubuk */}
      <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-accent">
            <DropIcon size={20} />
          </span>
          <span className="font-semibold tracking-tight">Kan Haritası</span>
        </div>
        <button type="button" className="icon-btn" onClick={lock} aria-label="Kilitle">
          <LockIcon size={18} />
        </button>
      </header>

      <main className={`min-h-0 flex-1 overflow-y-auto transition ${hidden ? 'privacy-veil' : ''}`}>{children}</main>

      {/* Mobil alt gezinme */}
      <nav className="safe-bottom grid grid-cols-5 border-t border-ink-700 bg-ink-900/95 backdrop-blur md:hidden" aria-label="Ana gezinme">
        {NAV.map(({ key, label, icon: Icon, phase }) => {
          const isActive = key === active;
          return (
            <a
              key={key}
              href={hrefFor({ name: key } as Route)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? 'text-accent' : 'text-fg-muted'}`}
            >
              <Icon size={20} />
              {label}
              {phase && <span className="absolute right-[18%] top-1.5 h-1.5 w-1.5 rounded-full bg-ink-500" aria-hidden="true" />}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
