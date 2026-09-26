import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PasswordResponses, Util, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { openPdf } from '../lib/pdf';
import { Banner, ToolbarGroup } from '../components/ui';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  LockIcon,
  MaximizeIcon,
  SearchIcon,
  SpinnerIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../components/icons';
import { clampZoom, useElementWidth, useFullscreen, usePinchZoom } from './hooks';

const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFC');

export function PdfViewer({ bytes, onDownload }: { bytes: Uint8Array; onDownload: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pwCallback = useRef<((pw: string) => void) | null>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<{ retry: boolean; value: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(false);

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [matches, setMatches] = useState<number[] | null>(null);
  const [searching, setSearching] = useState(false);

  const toggleFullscreen = useFullscreen(rootRef);
  useElementWidth(scrollRef, (w) => setWidth(Math.floor(w)));
  usePinchZoom(scrollRef, (f) => setZoom((z) => clampZoom(z * f)));

  // Belgeyi aç
  useEffect(() => {
    const task = openPdf(bytes);
    task.onPassword = (update: (pw: string) => void, reason: number) => {
      pwCallback.current = update;
      setPassword({ retry: reason === PasswordResponses.INCORRECT_PASSWORD, value: '' });
    };
    task.promise.then(
      (d) => {
        setDoc(d);
        setPassword(null);
      },
      () => setError('PDF açılamadı. Dosya bozuk veya desteklenmeyen bir biçimde olabilir.'),
    );
    return () => {
      void task.destroy();
      setDoc(null);
    };
  }, [bytes]);

  const numPages = doc?.numPages ?? 0;

  const goTo = useCallback(
    (p: number) => {
      if (!numPages) return;
      const next = Math.min(numPages, Math.max(1, p));
      setPage(next);
      setPageInput(String(next));
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [numPages],
  );

  // Geçerli sayfayı çiz (+ arama eşleşmelerini vurgula)
  useEffect(() => {
    if (!doc || width === 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    setRendering(true);
    (async () => {
      const p = await doc.getPage(page);
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.max(0.1, (width - 24) / base.width);
      const viewport = p.getViewport({ scale: fit * zoom });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = p.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await task.promise;
      if (cancelled || !activeQuery) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const q = norm(activeQuery);
      const content = await p.getTextContent();
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = 'rgba(245, 177, 76, 0.38)';
      for (const item of content.items) {
        if (!('str' in item) || !norm(item.str).includes(q)) continue;
        const tx = Util.transform(viewport.transform, item.transform);
        const h = Math.hypot(tx[2], tx[3]);
        ctx.fillRect(tx[4], tx[5] - h, Math.max(4, item.width * viewport.scale), h * 1.15);
      }
      ctx.restore();
    })()
      .catch((e: unknown) => {
        if (!(e instanceof Error && e.name === 'RenderingCancelledException') && !cancelled) setError('Sayfa çizilemedi.');
      })
      .finally(() => !cancelled && setRendering(false));
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, zoom, width, activeQuery]);

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    const q = norm(query.trim());
    if (!doc || !q) {
      setActiveQuery('');
      setMatches(null);
      return;
    }
    setSearching(true);
    const found: number[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      const text = norm(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
      if (text.includes(q)) found.push(i);
    }
    setSearching(false);
    setActiveQuery(query.trim());
    setMatches(found);
    if (found[0] !== undefined) goTo(found.find((p) => p >= page) ?? found[0]);
  }

  const matchPos = matches ? matches.indexOf(page) : -1;
  const stepMatch = (dir: 1 | -1) => {
    if (!matches?.length) return;
    const next = dir === 1 ? (matches.find((p) => p > page) ?? matches[0]!) : ([...matches].reverse().find((p) => p < page) ?? matches[matches.length - 1]!);
    goTo(next);
  };

  if (error) return <div className="p-6"><Banner tone="error">{error}</Banner></div>;

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-ink-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-900/80 px-3 py-2">
        <ToolbarGroup>
          <button type="button" className="icon-btn" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Önceki sayfa">
            <ChevronLeftIcon />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goTo(Number(pageInput) || page);
            }}
            className="flex items-center gap-1 px-1 text-sm text-fg-muted"
          >
            <input
              aria-label="Sayfa numarası"
              inputMode="numeric"
              className="w-9 rounded-md bg-ink-800 py-1 text-center text-fg focus:outline-none focus:ring-1 focus:ring-accent/50"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              onBlur={() => goTo(Number(pageInput) || page)}
            />
            <span>/ {numPages || '–'}</span>
          </form>
          <button type="button" className="icon-btn" onClick={() => goTo(page + 1)} disabled={!numPages || page >= numPages} aria-label="Sonraki sayfa">
            <ChevronRightIcon />
          </button>
        </ToolbarGroup>

        <ToolbarGroup>
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => clampZoom(z / 1.25))} aria-label="Uzaklaştır">
            <ZoomOutIcon />
          </button>
          <button type="button" className="min-w-12 rounded-md px-1.5 text-xs tabular-nums text-fg-muted hover:text-fg" onClick={() => setZoom(1)} title="Genişliğe sığdır">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => clampZoom(z * 1.25))} aria-label="Yakınlaştır">
            <ZoomInIcon />
          </button>
        </ToolbarGroup>

        <form onSubmit={runSearch} className="flex min-w-[180px] flex-1 items-center gap-1 rounded-xl border border-ink-600/70 bg-ink-850/90 pl-2.5 pr-0.5">
          <SearchIcon size={15} className="shrink-0 text-fg-faint" />
          <input
            aria-label="Belgede ara"
            placeholder="Belgede ara (ör. LDL)"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && <SpinnerIcon size={15} className="text-fg-muted" />}
          {matches && !searching && (
            <>
              <span className="whitespace-nowrap px-1 text-xs tabular-nums text-fg-muted">
                {matches.length ? `${matchPos + 1 || '–'}/${matches.length} sayfa` : 'bulunamadı'}
              </span>
              <button type="button" className="icon-btn h-8 w-8" onClick={() => stepMatch(-1)} disabled={!matches.length} aria-label="Önceki eşleşme">
                <ChevronLeftIcon size={15} />
              </button>
              <button type="button" className="icon-btn h-8 w-8" onClick={() => stepMatch(1)} disabled={!matches.length} aria-label="Sonraki eşleşme">
                <ChevronRightIcon size={15} />
              </button>
              <button
                type="button"
                className="icon-btn h-8 w-8"
                onClick={() => {
                  setQuery('');
                  setActiveQuery('');
                  setMatches(null);
                }}
                aria-label="Aramayı temizle"
              >
                <XIcon size={14} />
              </button>
            </>
          )}
        </form>

        <ToolbarGroup>
          <button type="button" className="icon-btn" onClick={toggleFullscreen} aria-label="Tam ekran">
            <MaximizeIcon />
          </button>
          <button type="button" className="icon-btn" onClick={onDownload} aria-label="Orijinal dosyayı indir">
            <DownloadIcon />
          </button>
        </ToolbarGroup>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto p-3">
        {password ? (
          <PasswordForm
            retry={password.retry}
            onSubmit={(pw) => {
              pwCallback.current?.(pw);
              setPassword(null);
            }}
          />
        ) : !doc ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
            <SpinnerIcon size={16} /> PDF açılıyor…
          </div>
        ) : (
          <div className="flex min-w-fit justify-center">
            <canvas ref={canvasRef} className={`rounded-md bg-white shadow-xl shadow-black/40 transition-opacity ${rendering ? 'opacity-80' : ''}`} />
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordForm({ retry, onSubmit }: { retry: boolean; onSubmit: (pw: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="surface mx-auto mt-10 max-w-sm space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onSubmit(value);
      }}
    >
      <div className="flex items-center gap-2 font-medium">
        <LockIcon size={17} /> Bu PDF parola korumalı
      </div>
      <p className="text-sm text-fg-muted">Parola yalnızca bu belgeyi açmak için kullanılır, saklanmaz.</p>
      {retry && <Banner tone="error">Parola yanlış.</Banner>}
      <input type="password" className="field" value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-label="PDF parolası" autoComplete="off" />
      <button type="submit" className="btn-primary w-full" disabled={!value}>
        Aç
      </button>
    </form>
  );
}
