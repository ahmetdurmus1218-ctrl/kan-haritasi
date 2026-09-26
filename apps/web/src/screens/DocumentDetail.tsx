import { Suspense, lazy, useEffect, useState } from 'react';
import type { Bytes, FileInfo } from '@kh/vault';
import { useUnlockedVault } from '../state/VaultContext';
import type { Route } from '../state/router';
import { userMessage } from '../lib/messages';
import { formatBytes, formatDateTime, KIND_LABEL } from '../lib/format';
import { releaseOcr } from '../lib/ocr';
import { ImageViewer } from '../viewers/ImageViewer';
import { Banner } from '../components/ui';
import { ChevronLeftIcon, FileTextIcon, ListIcon, SpinnerIcon } from '../components/icons';
import { downloadOriginal } from './DocumentsPage';
import { type Highlight, ReportPanel } from './ReportPanel';

// PDF.js büyük olduğu için yalnızca bir PDF açıldığında yüklenir.
const PdfViewer = lazy(() => import('../viewers/PdfViewer').then((m) => ({ default: m.PdfViewer })));

/**
 * Belge detayı: solda görüntüleyici, sağda çıkarılan sonuçlar (mobilde iki sekme).
 * Çözülmüş baytlar yalnızca bu ekran açıkken bellekte tutulur.
 */
export function DocumentDetail({ id, navigate }: { id: string; navigate: (r: Route) => void }) {
  const vault = useUnlockedVault();
  const [state, setState] = useState<{ info: FileInfo; bytes: Bytes } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [tab, setTab] = useState<'doc' | 'results'>('results');

  useEffect(() => {
    let cancelled = false;
    vault.readFile(id).then(
      (r) => !cancelled && setState(r),
      (e) => !cancelled && setError(userMessage(e)),
    );
    return () => {
      cancelled = true;
      setState(null);
      void releaseOcr();
    };
  }, [vault, id]);

  const download = () => {
    setDownloadError(null);
    downloadOriginal(vault, id).catch((e) => setDownloadError(userMessage(e)));
  };

  const showSource = (h: Highlight) => {
    setHighlight(h);
    if (h) setTab('doc');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 px-2 py-2 md:px-4">
        <button type="button" className="icon-btn" onClick={() => navigate({ name: 'documents' })} aria-label="Belgelere dön">
          <ChevronLeftIcon />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{state?.info.displayName ?? (error ? 'Belge' : 'Açılıyor…')}</p>
          {state && (
            <p className="truncate text-xs text-fg-muted">
              {KIND_LABEL[state.info.kind]} · {formatBytes(state.info.size)} · yüklendi {formatDateTime(state.info.createdAt)}
            </p>
          )}
        </div>
      </div>

      {downloadError && (
        <div className="px-4 pt-3">
          <Banner tone="error">{downloadError}</Banner>
        </div>
      )}

      {error ? (
        <div className="p-6">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : !state ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={16} /> Şifre çözülüyor ve doğrulanıyor…
        </div>
      ) : (
        <>
          {/* Mobil: sekmeler */}
          <div className="grid grid-cols-2 border-b border-ink-700 lg:hidden" role="tablist">
            {(
              [
                ['results', 'Sonuçlar', ListIcon],
                ['doc', 'Belge', FileTextIcon],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`flex items-center justify-center gap-2 py-2.5 text-sm ${tab === key ? 'border-b-2 border-accent text-fg' : 'text-fg-muted'}`}
                onClick={() => setTab(key)}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1">
            <div className={`min-h-0 flex-1 ${tab === 'doc' ? 'block' : 'hidden'} lg:block`}>
              {state.info.kind === 'pdf' ? (
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
                      <SpinnerIcon size={16} /> Görüntüleyici yükleniyor…
                    </div>
                  }
                >
                  <PdfViewer bytes={state.bytes} onDownload={download} highlight={highlight?.box ?? null} />
                </Suspense>
              ) : (
                <ImageViewer bytes={state.bytes} mimeType={state.info.mimeType} onDownload={download} highlight={highlight?.box ?? null} />
              )}
            </div>
            <aside
              className={`min-h-0 w-full flex-col bg-ink-900/60 lg:flex lg:w-[440px] lg:border-l lg:border-ink-700 ${tab === 'results' ? 'flex' : 'hidden'}`}
              aria-label="Çıkarılan sonuçlar"
            >
              <ReportPanel info={state.info} bytes={state.bytes} highlight={highlight} onHighlight={showSource} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
