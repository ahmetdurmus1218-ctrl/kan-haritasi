import { useEffect, useMemo, useRef, useState } from 'react';
import { PARTS, STRUCTURES, TESTS, structureById, systemById } from '@kh/catalog';
import { type Route, go } from '../state/router';
import { insidesOf } from '../anatomy/organs';
import { SearchIcon } from '../components/icons';
import { INSIDE, type InsideId } from './inside/registry';
import { MENU_SYSTEMS, systemColor } from './systems';
import { Caps } from './ui';

/**
 * Anatomik arama: organlar, organ bölümleri (Türkçe ve Latince), sistemler, iç sahneler ve tahliller.
 * Tamamen yerel; hiçbir arama ağa gitmez.
 */

type Kind = 'Yapı' | 'Bölüm' | 'Sistem' | 'Sahne' | 'Tahlil';

export interface SearchItem {
  kind: Kind;
  title: string;
  sub: string;
  latin?: string;
  color: string;
  route: Route;
  /** Cinsiyete özgü yapı: seçilince o vücuda geçilir. */
  sex?: 'male' | 'female';
  hay: string;
}

/** Türkçe karakterleri sadeleştirir: "Böbreküstü" → "bobrekustu". */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[âà]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[û]/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

let cached: SearchItem[] | null = null;

export function searchIndex(): SearchItem[] {
  if (cached) return cached;
  const out: SearchItem[] = [];
  const add = (i: Omit<SearchItem, 'hay'>, extra = '') => out.push({ ...i, hay: fold(`${i.title} ${i.latin ?? ''} ${extra}`) });
  for (const s of STRUCTURES) {
    if (!s.asset) continue;
    const sys = s.systems.map((x) => systemById.get(x)?.nameTr ?? '').join(' ');
    add({ kind: 'Yapı', title: s.nameTr, sub: sys, latin: s.latin, color: systemColor(s.systems[0]), route: { name: 'body', structure: s.id }, sex: s.sex }, `${s.id} ${sys}`);
  }
  for (const p of PARTS) {
    const s = structureById.get(p.structure);
    if (!s) continue;
    add(
      { kind: 'Bölüm', title: p.tr, sub: s.nameTr, latin: p.latin, color: systemColor(s.systems[0]), route: { name: 'body', structure: p.structure, part: p.key }, sex: s.sex },
      `${s.nameTr} ${p.key}`,
    );
  }
  for (const id of MENU_SYSTEMS) {
    const sys = systemById.get(id)!;
    add({ kind: 'Sistem', title: sys.nameTr, sub: 'Vücut sistemi', color: sys.color, route: { name: 'body', system: id } });
  }
  for (const sc of Object.values(INSIDE)) {
    const from = STRUCTURES.find((s) => insidesOf(s.id)[0] === sc.id)?.id ?? STRUCTURES.find((s) => insidesOf(s.id).includes(sc.id as InsideId))?.id;
    add(
      { kind: 'Sahne', title: sc.title, sub: `${sc.tissue} · ${sc.process}`, color: systemColor(sc.system), route: { name: 'simulation', id: sc.id, from } },
      `${sc.cell} ${sc.process} ${sc.tissue}`,
    );
  }
  for (const t of TESTS) {
    add({ kind: 'Tahlil', title: t.nameTr, sub: t.structures.map((x) => structureById.get(x)?.nameTr.split(' (')[0]).filter(Boolean).slice(0, 3).join(' · '), color: systemColor(t.systems[0]), route: { name: 'body', focus: t.key } }, `${t.key} ${t.aliases.join(' ')}`);
  }
  cached = out;
  return out;
}

const KIND_RANK: Record<Kind, number> = { Yapı: 0, Sistem: 1, Bölüm: 2, Sahne: 3, Tahlil: 4 };

export function searchAnatomy(query: string, limit = 40): SearchItem[] {
  const q = fold(query.trim());
  if (!q) return [];
  const words = q.split(/\s+/);
  const scored: [number, SearchItem][] = [];
  for (const item of searchIndex()) {
    let score = 0;
    let ok = true;
    for (const w of words) {
      const at = item.hay.indexOf(w);
      if (at < 0) {
        ok = false;
        break;
      }
      // Baştan eşleşme > kelime başı > kelime içi
      score += at === 0 ? 0 : item.hay[at - 1] === ' ' ? 1 : 3;
    }
    if (!ok) continue;
    const title = fold(item.title);
    if (title === q) score -= 3;
    else if (title.startsWith(q)) score -= 1;
    scored.push([score * 10 + KIND_RANK[item.kind], item]);
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title, 'tr'))
    .slice(0, limit)
    .map(([, i]) => i);
}

const SUGGEST = ['kalp', 'beyin', 'retina', 'nefron', 'hipofiz', 'hepar', 'sinaps', 'ferritin'];

export function SearchOverlay({ onClose, onBody }: { onClose: () => void; onBody: (sex: 'male' | 'female') => void }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const results = useMemo(() => searchAnatomy(q), [q]);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => setAt(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  const pick = (i: SearchItem | undefined) => {
    if (!i) return;
    if (i.sex) onBody(i.sex);
    onClose();
    go(i.route);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-ink-950/60 px-3 pt-16 backdrop-blur-sm md:pt-24" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kh-fade-in w-full max-w-xl overflow-hidden rounded-2xl border border-ink-600 bg-ink-900/95 shadow-2xl" role="dialog" aria-label="Anatomik arama" aria-modal="true">
        <div className="flex items-center gap-3 border-b border-ink-700 px-4">
          <SearchIcon size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAt((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAt((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pick(results[at]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder="Organ, bölüm, Latince ad, sahne ya da tahlil ara…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-faint focus:outline-none"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="kh-search-list"
            aria-activedescendant={results[at] ? `kh-s-${at}` : undefined}
            enterKeyHint="go"
          />
          <kbd className="hidden rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] text-fg-faint md:inline">Esc</kbd>
        </div>
        {q.trim() === '' ? (
          <div className="p-4">
            <Caps className="text-fg-faint">Örnek</Caps>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGEST.map((s) => (
                <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg-muted transition hover:text-fg">
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-fg-faint">Türkçe ya da Latince yazabilirsin (ör. “cor”, “hepar”, “ren”). Arama bu cihazda yapılır.</p>
          </div>
        ) : results.length === 0 ? (
          <p className="p-5 text-sm text-fg-muted">“{q}” için sonuç yok.</p>
        ) : (
          <ul ref={list} id="kh-search-list" role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
            {results.map((r, i) => (
              <li key={`${r.kind}-${r.title}-${r.sub}`} id={`kh-s-${i}`} role="option" aria-selected={i === at} data-i={i}>
                <button
                  type="button"
                  onMouseEnter={() => setAt(i)}
                  onClick={() => pick(r)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${i === at ? 'bg-ink-700/70' : ''}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      {r.title}
                      {r.latin && <span className="ml-2 font-mono text-[11px] italic text-fg-faint">{r.latin}</span>}
                    </span>
                    <span className="block truncate text-xs text-fg-faint">
                      {r.sub}
                      {r.sex ? ` · ${r.sex === 'female' ? 'kadın' : 'erkek'} vücudu` : ''}
                    </span>
                  </span>
                  <Caps className="shrink-0 text-[9.5px] text-fg-faint">{r.kind}</Caps>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
