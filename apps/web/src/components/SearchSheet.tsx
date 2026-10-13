import { useMemo, useState } from 'react';
import { go } from '../state/router';
import { search } from '../lib/search';
import { Sheet } from './Sheet';
import { SearchIcon } from './icons';

/** Global arama: organ, bölge ve test adlarıyla derin sayfalara tek adımda gider. */
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => search(q), [q]);
  const pick = (r: Parameters<typeof go>[0]) => {
    onClose();
    setQ('');
    go(r);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Ara">
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
              onClose();
            }
          }}
          placeholder="ör. pankreas, beyin, HbA1c"
          className="field pl-9"
          type="search"
        />
      </label>
      {q.trim().length >= 2 && !hits.length && <p className="mt-4 text-sm">“{q}” için sonuç yok.</p>}
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
      {q.trim().length < 2 && <p className="mt-4 text-xs text-fg-faint">Bir organ (pankreas, beyin, böbrek), bölge (alın lobu) ya da test (glukoz, LDL) yaz.</p>}
    </Sheet>
  );
}
