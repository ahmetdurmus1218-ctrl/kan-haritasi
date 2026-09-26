import { VaultProvider, useVault } from './state/VaultContext';
import { useRoute } from './state/router';
import { SetupScreen, UnlockScreen } from './screens/AuthScreens';
import { AppShell } from './screens/AppShell';
import { DocumentsPage } from './screens/DocumentsPage';
import { DocumentDetail } from './screens/DocumentDetail';
import { PrivacyPage } from './screens/PrivacyPage';
import { ComingSoon } from './screens/ComingSoon';
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
          ) : route.name === 'privacy' ? (
            <PrivacyPage />
          ) : route.name === 'results' || route.name === 'body' || route.name === 'timeline' ? (
            <ComingSoon page={route.name} />
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
