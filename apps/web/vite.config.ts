import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { securityPlugin, serviceWorkerPlugin } from './vite-plugins/security.ts';

export default defineConfig({
  // Göreli yollar: GitHub Pages alt dizini ve Android WebViewAssetLoader için.
  base: './',
  plugins: [react(), tailwindcss(), securityPlugin(), serviceWorkerPlugin()],
  build: {
    target: 'es2022',
    sourcemap: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 1500,
  },
  worker: { format: 'es' },
});
