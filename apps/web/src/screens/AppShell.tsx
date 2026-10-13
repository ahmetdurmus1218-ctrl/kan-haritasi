import { type ReactNode, useEffect, useState } from 'react';
import { useVault } from '../state/VaultContext';
import { useImmersive } from '../state/immersive';
import { type Route, go, hrefFor } from '../state/router';
import { ThemeToggle } from '../components/ThemeToggle';
import { Sheet } from '../components/Sheet';
import { SearchSheet } from '../components/SearchSheet';
import { BodyIcon, ChartIcon, DropIcon, FolderIcon, HomeIcon, LayersIcon, ListIcon, LockIcon, MoreIcon, PlusIcon, SearchIcon, ShieldIcon, UserIcon } from '../components/icons';

/**
 * Sade bilgi mimarisi: dört ana yer (Ana sayfa, Vücudum, Zamanım, Verilerim) ve tek giriş noktası
 * "+ Veri ekle". Ayarlar/gizlilik profil simgesinde; teknik araçlar ana gezinmede yok. Derin sayfalara
 * arama (Ctrl+K) ve sayfa içi "Daha fazla / İncele / Neden?" bağlantılarıyla ulaşılır.
 */
type NavKey = 'home' | 'mybody' | 'timeline' | 'documents' | 'more' | 'settings';

const NAV: Array<{ key: Exclude<NavKey, 'more' | 'settings'>; label: string; icon: (p: { size?: number }) => ReactNode; route: Route }> = [
  { key: 'home', label: 'Ana sayfa', icon: HomeIcon, route: { name: 'home' } },
  { key: 'mybody', label: 'Vücudum', icon: BodyIcon, route: { name: 'mybody' } },
  { key: 'timeline', label: 'Zamanım', icon: ChartIcon, route: { name: 'timeline' } },
  { key: 'documents', label: 'Verilerim', icon: FolderIcon, route: { name: 'documents' } },
];

function activeKey(route: Route): NavKey | 'add' {
  switch (route.name) {
    case 'home':
      return 'home';
    case 'add':
      return 'add';
    case 'mybody':
    case 'organ':
    case 'body':
    case 'simulation':
    case 'coverage':
      return 'mybody';
    case 'timeline':
      return 'timeline';
    case 'documents':
    case 'document':
    case 'results':
    case 'result':
      return 'documents';
    case 'privacy':
    case 'about':
      return 'settings';
  }
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { lock, hidden } = useVault();
  const active = activeKey(route);
  // Keşfet'te telefonun üst çubuğu gizlenir (3B sahne kendi gezinme yolunu gösterir); "yalnızca model"
  // kipinde ise tüm çerçeve gizlenir.
  const immersive = useImmersive();
  const explore = route.name === 'body' || route.name === 'simulation';
  const [searching, setSearching] = useState(false);
  const [more, setMore] = useState(false);

  // Ctrl/⌘+K: genel arama (3B ekranın kendi araması varken çakışmasın diye orada devre dışı).
  useEffect(() => {
    if (explore) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLocaleLowerCase('en') === 'k') {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [explore]);

  const moreGo = (r: Route) => {
    setMore(false);
    go(r);
  };

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Masaüstü / tablet kenar çubuğu */}
      <aside className={`hidden w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900/70 ${immersive ? '' : 'md:flex'}`}>
        <a href={hrefFor({ name: 'home' })} className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
            <DropIcon size={19} />
          </span>
          <span className="font-semibold tracking-tight">Kan Haritası</span>
        </a>
        <div className="px-3 pb-4">
          <a href={hrefFor({ name: 'add' })} className="btn-primary w-full justify-center" aria-current={active === 'add' ? 'page' : undefined}>
            <PlusIcon size={16} /> Veri ekle
          </a>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Ana gezinme">
          {NAV.map(({ key, label, icon: Icon, route: r }) => {
            const isActive = key === active;
            return (
              <a
                key={key}
                href={hrefFor(r)}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:bg-ink-800 hover:text-fg'}`}
              >
                <span className={isActive ? 'text-accent' : ''}>
                  <Icon size={17} />
                </span>
                <span className="flex-1">{label}</span>
              </a>
            );
          })}
          <button type="button" onClick={() => setSearching(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-fg-muted transition hover:bg-ink-800 hover:text-fg">
            <SearchIcon size={17} />
            <span className="flex-1 text-left">Ara</span>
            <kbd className="rounded border border-ink-600 px-1.5 text-[10px] text-fg-faint">Ctrl K</kbd>
          </button>
        </nav>
        <div className="space-y-2 border-t border-ink-700 p-3">
          <a
            href={hrefFor({ name: 'privacy' })}
            aria-current={active === 'settings' ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active === 'settings' ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:bg-ink-800 hover:text-fg'}`}
          >
            <UserIcon size={17} /> Ayarlar ve gizlilik
          </a>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={lock}>
              <LockIcon size={16} /> Kilitle
            </button>
            <ThemeToggle className="btn-ghost px-3" />
          </div>
          <p className="flex items-center gap-2 px-1 text-[11px] text-fg-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Veriler bu cihazda, şifreli
          </p>
        </div>
      </aside>

      {/* Mobil üst çubuk */}
      <header className={`items-center justify-between border-b border-ink-700 bg-ink-900/80 px-4 py-2.5 backdrop-blur md:hidden ${explore || immersive ? 'hidden' : 'flex'}`}>
        <a href={hrefFor({ name: 'home' })} className="flex items-center gap-2">
          <span className="text-accent">
            <DropIcon size={20} />
          </span>
          <span className="font-semibold tracking-tight">Kan Haritası</span>
        </a>
        <div className="flex items-center gap-0.5">
          <button type="button" className="icon-btn h-11 w-11" onClick={() => setSearching(true)} aria-label="Ara">
            <SearchIcon size={18} />
          </button>
          <button type="button" className="icon-btn h-11 w-11" onClick={lock} aria-label="Kilitle">
            <LockIcon size={18} />
          </button>
          <a href={hrefFor({ name: 'privacy' })} className="icon-btn h-11 w-11" aria-label="Ayarlar ve gizlilik">
            <UserIcon size={19} />
          </a>
        </div>
      </header>

      <main className={`min-h-0 flex-1 overflow-y-auto transition ${hidden ? 'privacy-veil' : ''}`}>{children}</main>

      {/* Mobil alt gezinme: 4 yer + ortada tek ekleme düğmesi */}
      <nav className={`safe-bottom grid-cols-5 border-t border-ink-700 bg-ink-900/95 backdrop-blur md:hidden ${immersive ? 'hidden' : 'grid'}`} aria-label="Ana gezinme">
        {[NAV[0]!, NAV[1]!].map(({ key, label, icon: Icon, route: r }) => (
          <a
            key={key}
            href={hrefFor(r)}
            aria-current={key === active ? 'page' : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] ${key === active ? 'text-accent' : 'text-fg-muted'}`}
          >
            <Icon size={21} />
            {label}
          </a>
        ))}
        <a href={hrefFor({ name: 'add' })} aria-current={active === 'add' ? 'page' : undefined} className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] text-fg">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-ink-950 shadow-lg shadow-accent/30">
            <PlusIcon size={24} />
          </span>
          Ekle
        </a>
        <a
          href={hrefFor(NAV[2]!.route)}
          aria-current={active === 'timeline' ? 'page' : undefined}
          className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] ${active === 'timeline' ? 'text-accent' : 'text-fg-muted'}`}
        >
          <ChartIcon size={21} />
          Zamanım
        </a>
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-haspopup="dialog"
          className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] ${active === 'documents' || active === 'settings' ? 'text-accent' : 'text-fg-muted'}`}
        >
          <MoreIcon size={21} />
          Daha
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Daha">
        <ul className="-mx-2 space-y-0.5">
          {(
            [
              ['Verilerim', 'Yüklediğin belgeler ve görüntüler', FolderIcon, { name: 'documents' }],
              ['Tüm sonuçlarım', 'Tahlil değerleri tablo hâlinde', ListIcon, { name: 'results' }],
              ['3B vücut', 'Organları döndür, içine gir', LayersIcon, { name: 'body' }],
              ['Ayarlar ve gizlilik', 'Kilit, yedek, verilerimi indir', ShieldIcon, { name: 'privacy' }],
            ] as const
          ).map(([label, hint, Icon, r]) => (
            <li key={label}>
              <button type="button" className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-ink-800" onClick={() => moreGo(r)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-fg-muted">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm text-fg">{label}</span>
                  <span className="block text-xs text-fg-faint">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-ink-700 pt-3">
          <span className="text-sm">Görünüm</span>
          <ThemeToggle className="btn-ghost px-3" />
        </div>
      </Sheet>
      <SearchSheet open={searching} onClose={() => setSearching(false)} />
    </div>
  );
}
