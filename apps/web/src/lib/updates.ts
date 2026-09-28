/**
 * Web sürümünün güncellenmesi. Service worker uygulama kabuğunu önbellekten açar (çevrimdışı çalışma);
 * yeni sürüm yayınlanınca arka planda indirilir ve devralır, ama açık sayfa hâlâ eski koddur.
 * Bu modül yeni sürümün hazır olduğunu bildirir; arayüz kullanıcıya "Yenile" düğmesi gösterir.
 * Kendiliğinden yenilenmez: kilidi açık kasa ve yarım kalmış işler kaybolmasın.
 */
let ready = false;
const listeners = new Set<() => void>();

export function subscribeUpdate(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const updateReady = () => ready;

function announce() {
  if (ready) return;
  ready = true;
  for (const fn of listeners) fn();
}

export function registerServiceWorker(): void {
  // İlk kurulumda denetleyici yoktur; o zaman "güncelleme" sayılmaz.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) announce();
  });
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      // Ana ekrana eklenmiş uygulama günlerce açık kalabilir: öne her gelişte yeni sürüm var mı bak.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      });
    })
    .catch(() => undefined);
}
