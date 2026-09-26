// Güvenlik: Trusted Types politikası her şeyden önce kurulmalı.
import './trustedTypes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isAndroidShell } from './platform/android';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Çevrimdışı çalışma: yalnızca üretim derlemesinde ve güvenli bağlamda.
// Android kabuğunda dosyalar zaten APK içinden gelir; service worker gerekmez (ve ağa çıkmaya çalışmamalı).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext && !isAndroidShell()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
  });
}
