import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { MENU_SYSTEMS } from '../explore/systems';
import { systemById } from '@kh/catalog';
import { useVault } from '../state/VaultContext';
import { useImmersive } from '../state/immersive';
import { type Route, go, hrefFor } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { bodySummary, organName } from '../lib/summary';
import { TONE } from '../lib/tone';
import { ThemeToggle } from '../components/ThemeToggle';
import { Sheet } from '../components/Sheet';
import { SearchSheet } from '../components/SearchSheet';
import { BrandLogo } from '../components/BrandLogo';
import {
  BellIcon,
  BodyIcon,
  BrainIcon,
  ChartIcon,
  ChevronRightIcon,
  FlaskIcon,
  FolderIcon,
  GearIcon,
  HeartPulseIcon,
  HomeIcon,
  ListIcon,
  LockIcon,
  MicroscopeIcon,
  NetworkIcon,
  PlusIcon,
  PulseIcon,
  ScanIcon,
  SearchIcon,
  SparkIcon,
  FileTextIcon,
  UserIcon,
} from '../components/icons';

/**
 * Bilgi mimarisi (görsel kimlik referansı): altı ana bölüm, her bölümün kendi alt sayfaları.
 *   Ana Ekran · Laboratuvar (Anatomi Laboratuvarı, Simülasyon) · Analizler (Sonuçlarım, Vücudum, Zaman Çizelgem) ·
 *   Raporlar (Belgelerim, Görüntülerim) · Serüven (3B Vücut, Beyin haritası) · Ayarlar
 * Masaüstünde bölümler üst çubukta, alt sayfalar onun altında sekme olarak durur. Telefonda bölümler
 * logonun altında yatay kayar; altta sabit çubuk: Ana Ekran · Sistemler · (+ Dosya Yükle) · Sonuçlar · Ayarlar.
 */
type NavKey = 'home' | 'mybody' | 'anatomylab' | 'simlab' | 'results' | 'images' | 'timeline' | 'documents' | 'settings' | 'explore' | 'brain';
type GroupKey = 'home' | 'lab' | 'analyses' | 'reports' | 'journey' | 'settings';
type IconC = (p: { size?: number }) => ReactNode;

interface NavItem {
  key: NavKey;
  label: string;
  icon: IconC;
  route: Route;
}

const ITEMS: Record<NavKey, NavItem> = {
  home: { key: 'home', label: 'Ana Ekran', icon: HomeIcon, route: { name: 'home' } },
  anatomylab: { key: 'anatomylab', label: 'Anatomi Laboratuvarı', icon: MicroscopeIcon, route: { name: 'anatomylab' } },
  simlab: { key: 'simlab', label: 'Simülasyon', icon: PulseIcon, route: { name: 'simlab' } },
  results: { key: 'results', label: 'Sonuçlarım', icon: ListIcon, route: { name: 'results' } },
  mybody: { key: 'mybody', label: 'Vücudum', icon: BodyIcon, route: { name: 'mybody' } },
  timeline: { key: 'timeline', label: 'Zaman Çizelgem', icon: ChartIcon, route: { name: 'timeline' } },
  documents: { key: 'documents', label: 'Belgelerim', icon: FolderIcon, route: { name: 'documents' } },
  images: { key: 'images', label: 'Görüntülerim', icon: ScanIcon, route: { name: 'images' } },
  explore: { key: 'explore', label: '3B Vücut', icon: BodyIcon, route: { name: 'body' } },
  brain: { key: 'brain', label: 'Beyin haritası', icon: BrainIcon, route: { name: 'brain' } },
  settings: { key: 'settings', label: 'Ayarlar ve Gizlilik', icon: GearIcon, route: { name: 'privacy' } },
};

interface Group {
  key: GroupKey;
  label: string;
  icon: IconC;
  items: NavKey[];
}

export const GROUPS: Group[] = [
  { key: 'home', label: 'Ana Ekran', icon: HomeIcon, items: ['home'] },
  { key: 'lab', label: 'Laboratuvar', icon: FlaskIcon, items: ['anatomylab', 'simlab'] },
  { key: 'analyses', label: 'Analizler', icon: SparkIcon, items: ['results', 'mybody', 'timeline'] },
  { key: 'reports', label: 'Raporlar', icon: FileTextIcon, items: ['documents', 'images'] },
  { key: 'journey', label: 'Serüven', icon: HeartPulseIcon, items: ['explore', 'brain'] },
  { key: 'settings', label: 'Ayarlar', icon: GearIcon, items: ['settings'] },
];

export function activeKey(route: Route): NavKey | 'add' {
  switch (route.name) {
    case 'home':
      return 'home';
    case 'add':
      return 'add';
    case 'mybody':
    case 'organ':
    case 'system':
    case 'personalOrgan':
      return 'mybody';
    case 'brain':
      return 'brain';
    case 'body':
    case 'simulation':
    case 'interior':
      return 'explore';
    case 'anatomylab':
    case 'coverage':
      return 'anatomylab';
    case 'simlab':
    case 'flow':
    case 'physiology':
      return 'simlab';
    case 'timeline':
      return 'timeline';
    case 'documents':
    case 'document':
      return 'documents';
    case 'results':
    case 'result':
      return 'results';
    case 'images':
    case 'sentence':
      return 'images';
    case 'privacy':
    case 'about':
      return 'settings';
  }
}

/** Etkin alt sayfanın bölümü ("Dosya Yükle" Raporlar bölümündedir). */
export function groupOf(key: NavKey | 'add'): GroupKey {
  if (key === 'add') return 'reports';
  return GROUPS.find((g) => g.items.includes(key))!.key;
}

const groupRoute = (g: Group): Route => ITEMS[g.items[0]!].route;

/** Bildirimler: yalnızca gerçek verinden (kritik sonuçlar, dikkat isteyen organlar). Açılınca hesaplanır. */
function Notices({ onGo }: { onGo: (r: Route) => void }) {
  const { model } = useHealthModel();
  const summary = useMemo(() => (model ? bodySummary(model) : null), [model]);
  if (!summary) return <p className="text-sm text-fg-muted">Hazırlanıyor…</p>;
  const items = [
    ...summary.urgent.map((u) => ({ title: u.label, detail: `${u.detail ?? ''} · acil değerlendirme gerektirebilir`, route: u.route, tone: 'urgent' as const })),
    ...summary.organs.map((o) => ({ title: organName(o.organ), detail: o.reasons.slice(0, 3).join(' · '), route: { name: 'organ', id: o.organ, view: 'benim' } as Route, tone: o.tone })),
  ];
  if (!items.length) return <p className="text-sm text-fg-muted">Bildirim yok. Dikkat isteyen bir sonuç olursa burada görünür.</p>;
  return (
    <ul className="-mx-2 space-y-0.5" data-testid="notices">
      {items.slice(0, 12).map((it) => (
        <li key={it.title + it.detail}>
          <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-ink-800" onClick={() => onGo(it.route)}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE[it.tone].dot}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-fg">{it.title}</span>
              <span className="block truncate text-xs text-fg-faint">{it.detail}</span>
            </span>
            <ChevronRightIcon size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { lock, hidden } = useVault();
  const active = activeKey(route);
  const group = groupOf(active);
  const groupDef = GROUPS.find((g) => g.key === group)!;
  // Keşfet'te telefonun üst çubuğu gizlenir (3B sahne kendi gezinme yolunu gösterir); "yalnızca model"
  // kipinde ise tüm çerçeve gizlenir.
  const immersive = useImmersive();
  const explore = route.name === 'body' || route.name === 'simulation';
  const [searching, setSearching] = useState(false);
  const [sheet, setSheet] = useState<null | 'systems' | 'notices'>(null);

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

  const sheetGo = (r: Route) => {
    setSheet(null);
    go(r);
  };

  const subnav = groupDef.items.length > 1 && (
    <nav className="kh-subnav" aria-label={`${groupDef.label} sayfaları`}>
      {groupDef.items.map((k) => {
        const it = ITEMS[k];
        const on = k === active;
        return (
          <a key={k} href={hrefFor(it.route)} aria-current={on ? 'page' : undefined} className={`kh-subtab ${on ? 'is-active' : ''}`} data-nav={k}>
            <it.icon size={15} />
            {it.label}
          </a>
        );
      })}
    </nav>
  );

  // Alt çubuk öğesi
  const tab = (on: boolean) => `flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${on ? 'text-accent' : 'text-fg-muted'}`;
  const pill = (on: boolean) => `flex h-8 w-14 items-center justify-center rounded-full transition ${on ? 'bg-accent/15 shadow-[0_0_16px_-4px_var(--color-accent)]' : ''}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Masaüstü / tablet üst çubuğu: logo · bölümler · araçlar · çevrimdışı */}
      <header className={`kh-topbar hidden shrink-0 items-center gap-3 px-4 lg:gap-5 lg:px-6 ${immersive ? '' : 'md:flex'}`}>
        <a href={hrefFor({ name: 'home' })} className="flex shrink-0 items-center gap-3">
          <BrandLogo size={40} glow />
          <span className="hidden leading-tight lg:block">
            <span className="block text-[19px] font-bold tracking-tight">Kan Haritası</span>
            <span className="hidden text-[11px] text-fg-muted 2xl:block">Kişisel Dijital Vücut ve Sağlık Analiz Platformu</span>
          </span>
        </a>
        <nav className="kh-mainnav mx-auto" aria-label="Ana gezinme">
          {GROUPS.map((g) => {
            const on = g.key === group;
            return (
              <a key={g.key} href={hrefFor(groupRoute(g))} aria-current={on ? 'page' : undefined} className={`kh-maintab ${on ? 'is-active' : ''}`} data-nav={g.key} title={g.label}>
                <g.icon size={19} />
                <span>{g.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setSearching(true)} className="icon-btn h-10 w-10" aria-label="Ara (Ctrl K)" title="Ara (Ctrl K)">
            <SearchIcon size={18} />
          </button>
          <button type="button" onClick={() => setSheet('notices')} className="icon-btn h-10 w-10" aria-label="Bildirimler" title="Bildirimler">
            <BellIcon size={18} />
          </button>
          <a href={hrefFor({ name: 'add' })} className="btn-primary ml-1 px-3 py-2 xl:px-4" aria-current={active === 'add' ? 'page' : undefined} title="Dosya Yükle">
            <PlusIcon size={16} />
            <span className="hidden xl:inline">Dosya Yükle</span>
          </a>
          <button type="button" className="icon-btn h-10 w-10" onClick={lock} aria-label="Kilitle" title="Kilitle">
            <LockIcon size={17} />
          </button>
          <ThemeToggle className="icon-btn h-10 w-10" />
          <span className="kh-offline ml-1 hidden lg:inline-flex" title="İnternet kullanılmaz: veriler yalnızca bu cihazda, şifreli">
            <i aria-hidden="true" /> Çevrimdışı Mod
          </span>
        </div>
      </header>
      {!immersive && <div className="hidden md:block">{subnav}</div>}

      {/* Mobil üst: logo · arama · bildirim · profil; altında bölümler (yatay kayar) */}
      <header className={`kh-mtop shrink-0 md:hidden ${explore || immersive ? 'hidden' : 'block'}`}>
        <div className="flex items-center justify-between pb-1.5 pl-4 pr-2 pt-3">
          <a href={hrefFor({ name: 'home' })} className="flex items-center gap-2.5">
            <BrandLogo size={32} glow />
            <span className="text-[19px] font-bold tracking-tight">Kan Haritası</span>
          </a>
          <div className="flex items-center gap-0.5">
            <button type="button" className="icon-btn h-11 w-11" onClick={() => setSearching(true)} aria-label="Ara">
              <SearchIcon size={19} />
            </button>
            <button type="button" className="icon-btn h-11 w-11" onClick={() => setSheet('notices')} aria-label="Bildirimler">
              <BellIcon size={20} />
            </button>
            <button type="button" className="icon-btn h-11 w-11" onClick={lock} aria-label="Kilitle">
              <LockIcon size={19} />
            </button>
            <a href={hrefFor({ name: 'privacy' })} className="icon-btn h-11 w-11 rounded-full ring-1 ring-accent/50" aria-label="Profil, ayarlar ve gizlilik">
              <UserIcon size={19} />
            </a>
          </div>
        </div>
        <nav className="kh-mnav" aria-label="Bölümler">
          {GROUPS.filter((g) => g.key !== 'settings').map((g) => {
            const on = g.key === group;
            return (
              <a key={g.key} href={hrefFor(groupRoute(g))} aria-current={on ? 'page' : undefined} className={`kh-mtab ${on ? 'is-active' : ''}`} data-nav={g.key}>
                <g.icon size={20} />
                <span>{g.label}</span>
              </a>
            );
          })}
        </nav>
        {subnav}
      </header>

      <main className={`min-h-0 flex-1 overflow-y-auto transition ${hidden ? 'privacy-veil' : ''}`}>{children}</main>

      {/* Mobil alt çubuk: Ana Ekran · Sistemler · (+ Dosya Yükle) · Sonuçlar · Ayarlar */}
      <div className={`px-3 pb-2 pt-1 md:hidden ${immersive ? 'hidden' : 'block'}`}>
        <nav className="kh-bottombar safe-bottom grid grid-cols-5 px-1" aria-label="Ana gezinme">
          <a href={hrefFor({ name: 'home' })} aria-current={active === 'home' ? 'page' : undefined} className={tab(active === 'home')}>
            <span className={pill(active === 'home')}>
              <HomeIcon size={21} />
            </span>
            Ana Ekran
          </a>
          <button type="button" onClick={() => setSheet('systems')} aria-haspopup="dialog" className={tab(false)}>
            <span className={pill(false)}>
              <NetworkIcon size={21} />
            </span>
            Sistemler
          </button>
          <a href={hrefFor({ name: 'add' })} aria-current={active === 'add' ? 'page' : undefined} className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-fg">
            <span className="kh-fab -mt-7 flex h-[56px] w-[56px] items-center justify-center rounded-full">
              <PlusIcon size={26} />
            </span>
            Dosya Yükle
          </a>
          <a href={hrefFor({ name: 'results' })} aria-current={active === 'results' ? 'page' : undefined} className={tab(active === 'results')}>
            <span className={pill(active === 'results')}>
              <FileTextIcon size={21} />
            </span>
            Sonuçlar
          </a>
          <a href={hrefFor({ name: 'privacy' })} aria-current={active === 'settings' ? 'page' : undefined} className={tab(active === 'settings')}>
            <span className={pill(active === 'settings')}>
              <GearIcon size={21} />
            </span>
            Ayarlar
          </a>
        </nav>
      </div>

      <Sheet open={sheet === 'systems'} onClose={() => setSheet(null)} title="Sistemler">
        <p className="-mt-1 mb-3 text-xs text-fg-faint">Bir sistemi 3B vücutta aç: organları ve yapıları vurgulanır.</p>
        <ul className="grid grid-cols-2 gap-2" data-testid="systems-sheet">
          {MENU_SYSTEMS.map((id) => {
            const s = systemById.get(id)!;
            return (
              <li key={id}>
                <button type="button" className="kh-tile w-full" onClick={() => sheetGo({ name: 'body', system: id })} style={{ ['--kh-accent' as string]: s.color }}>
                  <span className="kh-tile-dot" aria-hidden="true" />
                  {s.nameTr}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn-ghost mt-4 w-full" onClick={() => sheetGo({ name: 'anatomylab' })}>
          <MicroscopeIcon size={16} /> Anatomi Laboratuvarı
        </button>
      </Sheet>
      <Sheet open={sheet === 'notices'} onClose={() => setSheet(null)} title="Bildirimler">
        {sheet === 'notices' && <Notices onGo={sheetGo} />}
      </Sheet>
      <SearchSheet open={searching} onClose={() => setSearching(false)} />
    </div>
  );
}
