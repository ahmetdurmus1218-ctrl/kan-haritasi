import { Suspense, lazy, useEffect, useState } from 'react';
import type { Bytes, FileInfo } from '@kh/vault';
import { useUnlockedVault } from '../state/VaultContext';
import type { Route } from '../state/router';
import { userMessage } from '../lib/messages';
import { formatBytes, formatDateTime, KIND_LABEL } from '../lib/format';
import { ImageViewer } from '../viewers/ImageViewer';
import { Banner, StatusTag } from '../components/ui';
import { ChevronLeftIcon, ChevronRightIcon, ListIcon, SpinnerIcon } from '../components/icons';
import { downloadOriginal } from './DocumentsPage';

// PDF.js büyük olduğu için yalnızca bir PDF açıldığında yüklenir.
const PdfViewer = lazy(() => import('../viewers/PdfViewer').then((m) => ({ default: m.PdfViewer })));

/**
 * Belge detayı: solda görüntüleyici, sağda çıkarılan sonuçlar.
 * Çözülmüş baytlar yalnızca bu ekran açıkken bellekte tutulur.
 */
export function DocumentDetail({ id, navigate }: { id: string; navigate: (r: Route) => void }) {
  const vault = useUnlockedVault();
  const [state, setState] = useState<{ info: FileInfo; bytes: Bytes } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    vault.readFile(id).then(
      (r) => !cancelled && setState(r),
      (e) => !cancelled && setError(userMessage(e)),
    );
    return () => {
      cancelled = true;
      setState(null);
    };
  }, [vault, id]);

  const back = () => navigate({ name: 'documents' });

  const download = () => {
    setDownloadError(null);
    downloadOriginal(vault, id).catch((e) => setDownloadError(userMessage(e)));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 px-2 py-2 md:px-4">
        <button type="button" className="icon-btn" onClick={back} aria-label="Belgelere dön">
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
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 flex-1">
            {state.info.kind === 'pdf' ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
                    <SpinnerIcon size={16} /> Görüntüleyici yükleniyor…
                  </div>
                }
              >
                <PdfViewer bytes={state.bytes} onDownload={download} />
              </Suspense>
            ) : (
              <ImageViewer bytes={state.bytes} mimeType={state.info.mimeType} onDownload={download} />
            )}
          </div>
          <ExtractedResultsPanel />
        </div>
      )}
    </div>
  );
}

/** Faz 3'te okuma hattı bağlanana kadar dürüstçe boş: sahte sonuç gösterilmez. Mobilde katlanır. */
function ExtractedResultsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <aside className="border-t border-ink-700 bg-ink-900/60 lg:w-[360px] lg:border-l lg:border-t-0" aria-label="Çıkarılan sonuçlar">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left lg:pointer-events-none lg:pt-5"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium">
          <ListIcon size={17} /> Çıkarılan sonuçlar
        </span>
        <span className="flex items-center gap-2">
          <StatusTag>NOT CONNECTED</StatusTag>
          <ChevronRightIcon size={16} className={`text-fg-muted transition lg:hidden ${open ? 'rotate-90' : ''}`} />
        </span>
      </button>
      <div className={`px-5 pb-5 ${open ? 'block' : 'hidden'} lg:block`}>
        <p className="text-sm leading-relaxed text-fg-muted">
          Rapor okuma hattı (PDF metni, OCR, test eşleme ve onay ekranı) Faz 3'te bağlanacak. Bu belgeden henüz hiçbir sonuç çıkarılmadı ve vücut modeline hiçbir şey
          uygulanmadı.
        </p>
        <div className="mt-5 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-dashed border-ink-600 px-3.5 py-3">
              <div className="space-y-1.5">
                <div className="h-2.5 w-16 rounded bg-ink-700" />
                <div className="h-2 w-24 rounded bg-ink-800" />
              </div>
              <div className="h-6 w-20 rounded-lg bg-ink-800" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
