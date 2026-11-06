import { type ReactNode, useEffect, useState } from 'react';
import { useVault } from '../state/VaultContext';
import { useImmersive } from '../state/immersive';
import { type Route, hrefFor } from '../state/router';
import { ThemeToggle } from '../components/ThemeToggle';
import { SearchSheet } from '../components/SearchSheet';
import { DropIcon, FolderIcon, HomeIcon, ListIcon, LockIcon, PlusIcon, SearchIcon, UserIcon } from '../components/icons';

/**
 * Sade bilgi mimarisi (B + C): telefonda alt sekme çubuğu yoktur. Ana ekran vücut şemasıdır; her şey
 * şemadaki organdan, "Son eklenenler" kartlarından ya da aramadan açılır. Altta tek bir "Ekle" düğmesi,
 * üstte arama · kilit · profil. Menü yerine arama: boşken kısayolları (Dosyalarım, 3B, Tomografi, Beyin
 * haritası, Zaman içinde, Ayarlar) gösterir. Masaüstünde kenar çubuğu aynı dört yeri listeler.
 */
type NavKey = 'home' | 'results' | 'documents' | 'settings' | 'add' | 'other';

const NAV: Array<{ key: Exclude<NavKey, 'settings' | 'add' | 'other'>; label: string; icon: (p: { size?: number }) => ReactNode; route: Route }> = [
  { key: 'home', label: 'Vücudum', icon: HomeIcon, route: { name: 'home' } },
  { key: 'results', label: 'Sonuçlar', icon: ListIcon, route: { name: 'results' } },
  { key: 'documents', label: 'Dosyalar', icon: FolderIcon, route: { name: 'documents' } },
];

function activeKey(route: Route): NavKey {
  switch (route.name) {
    case 'home':
    case 'mybody':
    case 'organ':
    case 'personalOrgan':
      return 'home';
    case 'add':
      return 'add';
    case 'results':
    case 'result':
    case 'timeline':
      return 'results';
    case 'documents':
    case 'document':
    case 'images':
    case 'sentence':
      return 'documents';
    case 'privacy':
    case 'about':
      return 'settings';
    default:
      return 'other';
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

  // Ctrl/⌘+K: genel arama (3B ekranın kendi araması varken çakışmasın diye orada devre dışı).
  useEffect(() => {
    if (explore) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLocaleLowerCase('en') === 'k') {
        e.preventDefault();
        setSearching(true);
      }
    };
    // Ana ekrandaki arama kutusu da aynı aramayı açar.
    const onOpen = () => setSearching(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('kh:search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('kh:search', onOpen);
    };
  }, [explore]);

  const side = (isActive: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${isActive ? 'bg-ink-850 font-medium text-fg shadow-[var(--shadow-card)] ring-1 ring-ink-600/70' : 'text-fg-muted hover:bg-ink-800 hover:text-fg'}`;
  const showFab = !immersive && !explore && route.name !== 'add';

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Masaüstü / tablet kenar çubuğu */}
      <aside className={`hidden w-64 shrink-0 flex-col border-r border-ink-600/60 bg-ink-900/60 ${immersive ? '' : 'md:flex'}`}>
        <a href={hrefFor({ name: 'home' })} className="flex items-center gap-3 px-5 pb-6 pt-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep text-on-solid shadow-[var(--shadow-card)]">
            <DropIcon size={20} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Kan Haritası</span>
        </a>
        <div className="px-4 pb-5">
          <a href={hrefFor({ name: 'add' })} className="btn-primary w-full justify-center py-3" aria-current={active === 'add' ? 'page' : undefined}>
            <PlusIcon size={16} /> Ekle
          </a>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Ana gezinme">
          {NAV.map(({ key, label, icon: Icon, route: r }) => {
            const isActive = key === active;
            return (
              <a key={key} href={hrefFor(r)} aria-current={isActive ? 'page' : undefined} className={side(isActive)}>
                <span className={isActive ? 'text-accent' : ''}>
                  <Icon size={18} />
                </span>
                <span className="flex-1">{label}</span>
              </a>
            );
          })}
          <button type="button" onClick={() => setSearching(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-fg-muted transition hover:bg-ink-800 hover:text-fg">
            <SearchIcon size={18} />
            <span className="flex-1 text-left">Ara</span>
            <kbd className="rounded-md border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-sans text-[10px] text-fg-faint">Ctrl K</kbd>
          </button>
        </nav>
        <div className="space-y-1 p-3">
          <a href={hrefFor({ name: 'privacy' })} aria-current={active === 'settings' ? 'page' : undefined} className={side(active === 'settings')}>
            <UserIcon size={18} /> Ayarlar ve gizlilik
          </a>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-ghost flex-1" onClick={lock}>
              <LockIcon size={16} /> Kilitle
            </button>
            <ThemeToggle className="btn-ghost px-3" />
          </div>
          <p className="flex items-center gap-2 px-1 pt-1 text-[11px] text-fg-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Veriler bu cihazda, şifreli
          </p>
        </div>
      </aside>

      {/* Mobil üst çubuk: logo (ana ekran) · ara · kilit · profil */}
      <header className={`items-center justify-between bg-ink-950/85 px-4 pb-2 pt-3 backdrop-blur-xl md:hidden ${explore || immersive ? 'hidden' : 'flex'}`}>
        <a href={hrefFor({ name: 'home' })} className="flex items-center gap-2.5" aria-label="Kan Haritası · ana ekran">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-deep text-on-solid">
            <DropIcon size={17} />
          </span>
          <span className="text-[16px] font-semibold tracking-tight">Kan Haritası</span>
        </a>
        <div className="flex items-center gap-0.5">
          {route.name !== 'home' && (
            <button type="button" className="icon-btn h-11 w-11" onClick={() => setSearching(true)} aria-label="Ara">
              <SearchIcon size={19} />
            </button>
          )}
          <button type="button" className="icon-btn h-11 w-11" onClick={lock} aria-label="Kilitle">
            <LockIcon size={19} />
          </button>
          <a href={hrefFor({ name: 'privacy' })} className="icon-btn h-11 w-11" aria-label="Ayarlar ve gizlilik">
            <UserIcon size={20} />
          </a>
        </div>
      </header>

      <main className={`min-h-0 flex-1 overflow-y-auto transition ${showFab ? 'pb-24 md:pb-0' : ''} ${hidden ? 'privacy-veil' : ''}`}>{children}</main>

      {/* Mobil: alt sekme çubuğu yok; tek yüzen "Ekle" düğmesi */}
      {showFab && (
        <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:hidden" aria-label="Ana gezinme">
          <a
            href={hrefFor({ name: 'add' })}
            className="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-accent to-accent-deep px-7 text-[16px] font-semibold text-on-solid shadow-[0_10px_28px_-8px_var(--color-accent)]"
          >
            <PlusIcon size={20} /> Ekle
          </a>
        </nav>
      )}
      <SearchSheet open={searching} onClose={() => setSearching(false)} />
    </div>
  );
}
