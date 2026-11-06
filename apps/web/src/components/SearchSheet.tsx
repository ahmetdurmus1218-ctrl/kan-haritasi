import { type ReactNode, useMemo, useState } from 'react';
import { type Route, go } from '../state/router';
import { search } from '../lib/search';
import { Sheet } from './Sheet';
import { ThemeToggle } from './ThemeToggle';
import { BodyIcon, BrainIcon, ChartIcon, FolderIcon, LayersIcon, ListIcon, ScanIcon, SearchIcon, ShieldIcon } from './icons';

/**
 * Menü yerine arama: organ, bölge ve test adlarıyla derin sayfalara tek adımda gider. Kutu boşken
 * uygulamanın tüm yerlerine kısayollar gösterir (alt sekme çubuğu ve "Daha" menüsü yoktur).
 */
const SHORTCUTS: Array<[string, (p: { size?: number }) => ReactNode, Route]> = [
  ['Dosyalarım', FolderIcon, { name: 'documents' }],
  ['Tüm sonuçlar', ListIcon, { name: 'results' }],
  ['Görüntüler', ScanIcon, { name: 'images' }],
  ['Zaman içinde', ChartIcon, { name: 'timeline' }],
  ['3B vücut', BodyIcon, { name: 'body' }],
  ['Tomografi görünümü', LayersIcon, { name: 'tomography' }],
  ['Beyin haritası', BrainIcon, { name: 'brain' }],
  ['Tüm organlar', BodyIcon, { name: 'mybody' }],
  ['Vücut nasıl çalışır?', LayersIcon, { name: 'flow' }],
  ['Ayarlar ve gizlilik', ShieldIcon, { name: 'privacy' }],
];

export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => search(q), [q]);
  // Kapanınca metin silinir: tekrar açıldığında kısayollar görünür.
  const close = () => {
    setQ('');
    onClose();
  };
  const pick = (r: Route) => {
    close();
    go(r);
  };
  const empty = q.trim().length < 2;
  return (
    <Sheet open={open} onClose={close} title="Ara">
      <label className="relative block">
        <span className="sr-only">Organ, bölge ya da test ara</span>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint">
          <SearchIcon size={16} />
        </span>
        <input
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // type=search'te ilk Esc yalnızca metni siler; Esc her zaman aramayı kapatsın.
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
          placeholder="ör. karaciğer, HbA1c, beyin"
          className="field pl-9"
          type="search"
        />
      </label>
      {!empty && !hits.length && <p className="mt-4 text-sm">“{q}” için sonuç yok.</p>}
      <ul className="mt-3 space-y-2">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.title}`} className="rounded-xl border border-ink-600/60 p-3">
            <button type="button" className="block w-full text-left" onClick={() => pick(h.route)}>
              <span className="block font-medium text-fg">{h.title}</span>
              {h.subtitle && <span className="block text-xs text-fg-faint">{h.subtitle}</span>}
            </button>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {h.links.map((l) => (
                <button key={l.label} type="button" className="text-xs text-accent hover:underline" onClick={() => pick(l.route)}>
                  {l.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {empty && (
        <div data-testid="search-shortcuts">
          <p className="label-caps mb-2 mt-1">Kısayollar</p>
          <ul className="flex flex-wrap gap-2">
            {SHORTCUTS.map(([label, Icon, r]) => (
              <li key={label}>
                <button type="button" className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-ink-600 px-3.5 text-[14px] text-fg transition hover:border-accent/60" onClick={() => pick(r)}>
                  <span className="text-accent">
                    <Icon size={16} />
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3">
            <span className="text-sm">Görünüm (telefona göre / açık / koyu)</span>
            <ThemeToggle className="btn-ghost px-3" />
          </div>
          <p className="mt-3 text-xs text-fg-faint">Bir organ (pankreas, beyin, böbrek), bölge (alın lobu) ya da test (glukoz, LDL) yaz.</p>
        </div>
      )}
    </Sheet>
  );
}
