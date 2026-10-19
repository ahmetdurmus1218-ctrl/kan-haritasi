import { hrefFor } from '../state/router';

/** Sonuçlar bölümündeki iki görünüm: belgeler (dosyalar) ve tüm sonuçlar (tablo). */
export function DataTabs({ active }: { active: 'documents' | 'results' }) {
  const tab = (key: 'documents' | 'results', label: string) => (
    <a
      href={hrefFor({ name: key })}
      aria-current={active === key ? 'page' : undefined}
      className={`flex min-h-[44px] items-center rounded-full px-5 text-sm font-medium transition ${active === key ? 'bg-ink-850 text-fg shadow-[var(--shadow-card)]' : 'text-fg-muted hover:text-fg'}`}
    >
      {label}
    </a>
  );
  return (
    <nav aria-label="Sonuçlar ve belgeler" className="mb-5 inline-flex rounded-full bg-ink-700/70 p-1">
      {tab('documents', 'Belgeler')}
      {tab('results', 'Sonuçlar')}
    </nav>
  );
}
