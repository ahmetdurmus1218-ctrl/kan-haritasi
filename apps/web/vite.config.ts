import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { securityPlugin, serviceWorkerPlugin } from './vite-plugins/security.ts';

export default defineConfig({
  // Göreli yollar: GitHub Pages alt dizini ve Android WebViewAssetLoader için.
  base: './',
  plugins: [react(), tailwindcss(), securityPlugin(), serviceWorkerPlugin()],
  define: {
    // Hakkında ekranında gösterilen derleme numarası (Actions çalıştırma numarası; yerelde "yerel").
    __KH_BUILD__: JSON.stringify(process.env.GITHUB_RUN_NUMBER ? `1.0.${process.env.GITHUB_RUN_NUMBER}` : 'yerel'),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 1500,
  },
  worker: { format: 'es' },
});
