import { type ReactNode, useEffect, useState } from 'react';
import { useVault } from '../state/VaultContext';
import { useImmersive } from '../state/immersive';
import { type Route, go, hrefFor } from '../state/router';
import { ThemeToggle } from '../components/ThemeToggle';
import { Sheet } from '../components/Sheet';
import { SearchSheet } from '../components/SearchSheet';
import { BodyIcon, BrainIcon, ChartIcon, DropIcon, FolderIcon, HomeIcon, LayersIcon, ListIcon, LockIcon, MoreIcon, PlusIcon, ScanIcon, SearchIcon, ShieldIcon, UserIcon } from '../components/icons';

/**
 * Sade bilgi mimarisi: beş ana yer (Özet, Vücudum, Sonuçlar, Görüntüler, Zamanım) ve tek giriş noktası
 * "+ Veri ekle". Ayarlar/gizlilik profil simgesinde; teknik araçlar ana gezinmede yok. Derin sayfalara
 * arama (Ctrl+K) ve sayfa içi "Daha fazla / İncele / Neden?" bağlantılarıyla ulaşılır.
 */
type NavKey = 'home' | 'mybody' | 'results' | 'images' | 'timeline' | 'more' | 'settings';

const NAV: Array<{ key: Exclude<NavKey, 'more' | 'settings'>; label: string; icon: (p: { size?: number }) => ReactNode; route: Route }> = [
  { key: 'home', label: 'Özet', icon: HomeIcon, route: { name: 'home' } },
  { key: 'mybody', label: 'Vücudum', icon: BodyIcon, route: { name: 'mybody' } },
  { key: 'results', label: 'Sonuçlar', icon: ListIcon, route: { name: 'results' } },
  { key: 'images', label: 'Görüntüler', icon: ScanIcon, route: { name: 'images' } },
  { key: 'timeline', label: 'Zamanım', icon: ChartIcon, route: { name: 'timeline' } },
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
    case 'flow':
    case 'system':
    case 'interior':
    case 'personalOrgan':
    case 'physiology':
    case 'brain':
      return 'mybody';
    case 'timeline':
      return 'timeline';
    case 'documents':
    case 'document':
    case 'results':
    case 'result':
      return 'results';
    case 'images':
      return 'images';
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

  // Alt gezinme öğesi: etkin olanın simgesi yumuşak bir hap içinde, rengi vurgu.
  const tab = (isActive: boolean) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${isActive ? 'text-accent' : 'text-fg-muted'}`;
  const pill = (isActive: boolean) => `flex h-8 w-14 items-center justify-center rounded-full transition ${isActive ? 'bg-accent/12' : ''}`;
  const side = (isActive: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${isActive ? 'bg-ink-850 font-medium text-fg shadow-[var(--shadow-card)] ring-1 ring-ink-600/70' : 'text-fg-muted hover:bg-ink-800 hover:text-fg'}`;

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
            <PlusIcon size={16} /> Veri ekle
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
          <a href={hrefFor({ name: 'documents' })} aria-current={route.name === 'documents' || route.name === 'document' ? 'page' : undefined} className={side(route.name === 'documents' || route.name === 'document')}>
            <FolderIcon size={18} /> Belgelerim
          </a>
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

      {/* Mobil üst çubuk */}
      <header className={`items-center justify-between bg-ink-950/85 px-4 pb-2 pt-3 backdrop-blur-xl md:hidden ${explore || immersive ? 'hidden' : 'flex'}`}>
        <a href={hrefFor({ name: 'home' })} className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-deep text-on-solid">
            <DropIcon size={17} />
          </span>
          <span className="text-[16px] font-semibold tracking-tight">Kan Haritası</span>
        </a>
        <div className="flex items-center gap-0.5">
          <button type="button" className="icon-btn h-11 w-11" onClick={() => setSearching(true)} aria-label="Ara">
            <SearchIcon size={19} />
          </button>
          <button type="button" className="icon-btn h-11 w-11" onClick={lock} aria-label="Kilitle">
            <LockIcon size={19} />
          </button>
          <a href={hrefFor({ name: 'privacy' })} className="icon-btn h-11 w-11" aria-label="Ayarlar ve gizlilik">
            <UserIcon size={20} />
          </a>
        </div>
      </header>

      <main className={`min-h-0 flex-1 overflow-y-auto transition ${hidden ? 'privacy-veil' : ''}`}>{children}</main>

      {/* Mobil alt gezinme (yüzen çubuk): Özet · Vücudum · (+) · Sonuçlar · Daha (Görüntüler, Zamanım, Belgeler…) */}
      <div className={`px-3 pb-2 pt-1 md:hidden ${immersive ? 'hidden' : 'block'}`}>
        <nav className="safe-bottom grid grid-cols-5 rounded-[26px] border border-ink-600/70 bg-ink-850/90 px-1 shadow-[var(--shadow-float)] backdrop-blur-xl" aria-label="Ana gezinme">
          {[NAV[0]!, NAV[1]!].map(({ key, label, icon: Icon, route: r }) => (
            <a key={key} href={hrefFor(r)} aria-current={key === active ? 'page' : undefined} className={tab(key === active)}>
              <span className={pill(key === active)}>
                <Icon size={21} />
              </span>
              {label}
            </a>
          ))}
          <a href={hrefFor({ name: 'add' })} aria-current={active === 'add' ? 'page' : undefined} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-fg">
            <span className="-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-deep text-on-solid shadow-[0_8px_20px_-6px_var(--color-accent)] ring-4 ring-ink-950">
              <PlusIcon size={24} />
            </span>
            Ekle
          </a>
          <a href={hrefFor(NAV[2]!.route)} aria-current={active === 'results' ? 'page' : undefined} className={tab(active === 'results')}>
            <span className={pill(active === 'results')}>
              <ListIcon size={21} />
            </span>
            Sonuçlar
          </a>
          <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={tab(active === 'images' || active === 'timeline' || active === 'settings')}>
            <span className={pill(active === 'images' || active === 'timeline' || active === 'settings')}>
              <MoreIcon size={21} />
            </span>
            Daha
          </button>
        </nav>
      </div>

      <Sheet open={more} onClose={() => setMore(false)} title="Daha">
        <ul className="-mx-2 space-y-0.5">
          {(
            [
              ['Görüntüler', 'MR, BT, röntgen, ultrason, EKG…', ScanIcon, { name: 'images' }],
              ['Zamanım', 'Sonuçların zaman içinde', ChartIcon, { name: 'timeline' }],
              ['Belgelerim', 'Yüklediğin tüm dosyalar', FolderIcon, { name: 'documents' }],
              ['Beyin haritası', 'Raporundaki her cümle beyinde nerede, adım adım', BrainIcon, { name: 'brain' }],
              ['3B vücut', 'Organları döndür, içine gir', LayersIcon, { name: 'body' }],
              ['Ayarlar ve gizlilik', 'Kilit, yedek, verilerimi indir', ShieldIcon, { name: 'privacy' }],
            ] as const
          ).map(([label, hint, Icon, r]) => (
            <li key={label}>
              <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-ink-800" onClick={() => moreGo(r)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-fg">{label}</span>
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
