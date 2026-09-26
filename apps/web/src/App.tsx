import { VaultProvider, useVault } from './state/VaultContext';
import { useRoute } from './state/router';
import { SetupScreen, UnlockScreen } from './screens/AuthScreens';
import { AppShell } from './screens/AppShell';
import { DocumentsPage } from './screens/DocumentsPage';
import { DocumentDetail } from './screens/DocumentDetail';
import { PrivacyPage } from './screens/PrivacyPage';
import { ComingSoon } from './screens/ComingSoon';
import { ResultDetail, ResultsPage } from './screens/ResultsPage';
import { Banner } from './components/ui';
import { SpinnerIcon } from './components/icons';

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
          ) : route.name === 'privacy' || route.name === 'about' ? (
            <PrivacyPage />
          ) : route.name === 'results' ? (
            <ResultsPage />
          ) : route.name === 'result' ? (
            <ResultDetail key={route.key} testKey={route.key} />
          ) : route.name === 'body' || route.name === 'simulation' ? (
            <ComingSoon page="body" />
          ) : route.name === 'timeline' ? (
            <ComingSoon page="timeline" />
          ) : (
            <DocumentsPage navigate={navigate} />
          )}
        </AppShell>
      );
  }
}

export function App() {
  return (
    <VaultProvider>
      <Gate />
    </VaultProvider>
  );
}
