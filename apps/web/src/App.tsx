import { VaultProvider, useVault } from './state/VaultContext';
import { useRoute } from './state/router';
import { SetupScreen, UnlockScreen } from './screens/AuthScreens';
import { AppShell } from './screens/AppShell';
import { DocumentsPage } from './screens/DocumentsPage';
import { DocumentDetail } from './screens/DocumentDetail';
import { PrivacyPage } from './screens/PrivacyPage';
import { Suspense, lazy, useSyncExternalStore } from 'react';
import { subscribeUpdate, updateReady } from './lib/updates';
import { TimelinePage } from './screens/TimelinePage';
import { AboutPage } from './screens/AboutPage';
import { CoveragePage } from './screens/CoveragePage';
import { ResultDetail, ResultsPage } from './screens/ResultsPage';
import { Banner } from './components/ui';
import { SpinnerIcon } from './components/icons';

// 3D keşif ekranı (three.js) büyük olduğu için yalnızca açıldığında yüklenir.
const Explorer = lazy(() => import('./explore/Explorer').then((m) => ({ default: m.Explorer })));

function ExplorerFallback() {
  return (
    <div className="explore-bg flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
      <SpinnerIcon size={16} /> 3D sahne hazırlanıyor…
    </div>
  );
}

function Gate() {
  const { status } = useVault();
  const [route, navigate] = useRoute();

  switch (status.kind) {
    case 'loading':
      return (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={16} /> Hazırlanıyor…
        </div>
      );
    case 'unsupported':
      return (
        <div className="mx-auto max-w-md p-6">
          <Banner tone="error">{status.reason}</Banner>
        </div>
      );
    case 'setup':
      return <SetupScreen />;
    case 'locked':
      return <UnlockScreen />;
    case 'unlocked':
      return (
        <AppShell route={route}>
          {route.name === 'document' ? (
            <DocumentDetail key={route.id} id={route.id} navigate={navigate} />
          ) : route.name === 'privacy' ? (
            <PrivacyPage />
          ) : route.name === 'about' ? (
            <AboutPage />
          ) : route.name === 'coverage' ? (
            <CoveragePage />
          ) : route.name === 'results' ? (
            <ResultsPage />
          ) : route.name === 'result' ? (
            <ResultDetail key={route.key} testKey={route.key} />
          ) : route.name === 'body' || route.name === 'simulation' ? (
            <Suspense fallback={<ExplorerFallback />}>
              <Explorer route={route} />
            </Suspense>
          ) : route.name === 'timeline' ? (
            <TimelinePage testKey={route.key} />
          ) : (
            <DocumentsPage navigate={navigate} />
          )}
        </AppShell>
      );
  }
}

/** Yeni web sürümü indirildiğinde: kullanıcı istediği an yeniler (kasa yeniden kilitlenir). */
function UpdateNotice() {
  const ready = useSyncExternalStore(subscribeUpdate, updateReady, () => false);
  const { status } = useVault();
  if (!ready) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
      <div className="flex max-w-md items-center gap-3 rounded-2xl border border-accent/40 bg-ink-850 px-4 py-3 text-sm shadow-2xl shadow-black/40">
        <span className="min-w-0 flex-1">
          Uygulamanın yeni sürümü hazır.
          {status.kind === 'unlocked' ? <span className="block text-xs text-fg-muted">Yenileyince kasa kilitlenir; parolanla yeniden açarsın.</span> : null}
        </span>
        <button type="button" className="btn-primary shrink-0 px-3 py-1.5 text-xs" onClick={() => location.reload()}>
          Yenile
        </button>
      </div>
    </div>
  );
}

export function App() {
  return (
    <VaultProvider>
      <Gate />
      <UpdateNotice />
    </VaultProvider>
  );
}
