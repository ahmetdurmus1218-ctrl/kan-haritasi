// Güvenlik: Trusted Types politikası her şeyden önce kurulmalı.
import './trustedTypes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isAndroidShell } from './platform/android';
import { initTheme } from './state/theme';
import { registerServiceWorker } from './lib/updates';
import './styles.css';

// Tema ilk çizimden önce uygulanır (açık temada koyu bir an görünmesin).
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Çevrimdışı çalışma: yalnızca üretim derlemesinde ve güvenli bağlamda.
// Android kabuğunda dosyalar zaten APK içinden gelir; service worker gerekmez (ve ağa çıkmaya çalışmamalı).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext && !isAndroidShell()) {
  window.addEventListener('load', registerServiceWorker);
}
