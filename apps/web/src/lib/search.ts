/**
 * Uygulama içi arama: organ/bölge (bilgi grafiği + 3B yapı kataloğu) ve testler. "pankreas" yazınca
 * Pankreas › Sonuçlar · Görüntüler · Bulgular · Fizyoloji · Zaman çizelgesi bağlantıları çıkar; derin
 * özelliklere ana gezinmeyi büyütmeden ulaşılır. Sağlık verisi aranmaz (yalnızca adlar).
 */
import { FLOWS, GRAPH, interiorFor } from '@kh/analysis';
import { STRUCTURES, TESTS, normalizeText } from '@kh/catalog';
import type { Route } from '../state/router';

export interface SearchLink {
  label: string;
  route: Route;
}

export interface SearchHit {
  kind: 'organ' | 'test' | 'flow';
  title: string;
  subtitle?: string;
  route: Route;
  links: SearchLink[];
  score: number;
}

interface Entry {
  kind: SearchHit['kind'];
  title: string;
  subtitle?: string;
  words: string[];
  build: () => Pick<SearchHit, 'route' | 'links'>;
}

let index: Entry[] | null = null;

function organEntry(id: string, title: string, subtitle: string | undefined, extra: string[]): Entry {
  return {
    kind: 'organ',
    title,
    subtitle,
    words: [title, ...extra].map(normalizeText),
    build: () => {
      const interior = interiorFor(id);
      return {
        route: { name: 'organ', id },
        links: [
          { label: 'Sonuçlar', route: { name: 'organ', id, view: 'benim' } },
          { label: 'Görüntüler ve bulgular', route: { name: 'organ', id, view: 'benim' } },
          { label: 'Normalde nasıl çalışır?', route: { name: 'organ', id } },
          ...(interior ? [{ label: 'İçine gir', route: { name: 'interior', id: interior.organId } as Route }] : []),
          { label: 'Zaman çizelgesi', route: { name: 'timeline' } },
        ],
      };
    },
  };
}

function buildIndex(): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const n of GRAPH.nodes.values()) {
    if (n.kind !== 'organ' && n.kind !== 'region') continue;
    seen.add(n.id);
    const parent = GRAPH.pathTo(n.id).slice(0, -1).map((x) => x.nameTr).join(' › ');
    out.push(organEntry(n.id, n.nameTr, parent || undefined, n.structure ? [n.structure] : []));
  }
  for (const s of STRUCTURES) {
    if (seen.has(s.id)) continue;
    out.push(organEntry(s.id, s.nameTr, s.latin, s.latin ? [s.latin] : []));
  }
  for (const f of FLOWS)
    out.push({
      kind: 'flow',
      title: f.title,
      subtitle: `Vücut akışı · ${f.steps.length} adım`,
      words: [f.title, ...f.steps.map((x) => x.title)].map(normalizeText),
      build: () => ({ route: { name: 'flow', id: f.id, step: 1 }, links: [{ label: 'Benim durumuma göre', route: { name: 'flow', id: f.id, step: 1, personal: true } }] }),
    });
  for (const t of TESTS)
    out.push({
      kind: 'test',
      title: t.nameTr,
      subtitle: 'Tahlil',
      words: [t.nameTr, ...t.aliases].map(normalizeText),
      build: () => ({ route: { name: 'result', key: t.key }, links: [{ label: 'Zaman içinde', route: { name: 'timeline', key: t.key } }] }),
    });
  return out;
}

export function search(query: string, limit = 8): SearchHit[] {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  index ??= buildIndex();
  const qTokens = q.split(' ');
  const hits: SearchHit[] = [];
  for (const e of index) {
    let best = 0;
    for (const w of e.words) {
      const tokens = w.split(' ');
      if (w === q) best = Math.max(best, 3);
      else if (w.startsWith(q)) best = Math.max(best, 2);
      else if (tokens.some((p) => p.startsWith(q))) best = Math.max(best, 1.5);
      // Çok sözcüklü arama: her sözcük bir sözcüğün başıyla eşleşmeli ("alin lobu" → "Alın (frontal) lobu").
      else if (qTokens.length > 1 && qTokens.every((t) => tokens.some((p) => p.startsWith(t)))) best = Math.max(best, 1.8);
      else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 1);
    }
    if (best > 0) hits.push({ kind: e.kind, title: e.title, subtitle: e.subtitle, score: best + (e.kind === 'organ' ? 0.2 : 0), ...e.build() });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.length - b.title.length).slice(0, limit);
}
