import type { Plugin } from 'vite';

/**
 * Tek kaynak: CSP ve güvenlik başlıkları burada tanımlanır.
 * - Üretim derlemesinde index.html'e CSP meta etiketi eklenir (Android WebView ve statik barındırma için).
 * - Aynı politika `_headers` dosyası olarak da üretilir (Cloudflare Pages / Netlify biçimi);
 *   `frame-ancestors`, HSTS gibi yalnızca HTTP başlığıyla çalışan kurallar oradadır.
 * Geliştirme sunucusunda (HMR için) CSP uygulanmaz.
 */
const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  // wasm-unsafe-eval: yalnızca WebAssembly derlemesi (Argon2id, PDF.js görüntü çözücüleri). JS eval kapalı.
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'worker-src': ["'self'"],
  // Uygulama yalnızca kendi dosyalarını çekebilir; sağlık verisini gönderecek bir hedef yok.
  'connect-src': ["'self'"],
  'img-src': ["'self'", 'blob:', 'data:'],
  'style-src': ["'self'"],
  'font-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'require-trusted-types-for': ["'script'"],
  'trusted-types': ['default'],
};

export function buildCsp(extra: Record<string, string[]> = {}): string {
  return Object.entries({ ...CSP_DIRECTIVES, ...extra })
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

const HEADER_CSP = buildCsp({ 'frame-ancestors': ["'none'"] });

const HEADERS_FILE = `/*
  Content-Security-Policy: ${HEADER_CSP}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  X-Frame-Options: DENY
`;

export function securityPlugin(): Plugin {
  return {
    name: 'kh-security',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp() }, injectTo: 'head-prepend' },
      ],
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS_FILE });
    },
  };
}

/**
 * Basit, bağımlılıksız service worker: uygulama kabuğunu önbelleğe alır, çevrimdışı açılır.
 * Kullanıcı verisi ağdan gelmediği için SW'nin önbelleğine asla sağlık verisi girmez.
 */
export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'kh-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== '_headers');
      const precache = ['./', './index.html', ...files.map((f) => `./${f}`)];
      const version = Math.abs(
        [...precache.join('|')].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 7),
      ).toString(36);
      const source = `/* Kan Haritası service worker — otomatik üretildi */
const CACHE = 'kh-shell-${version}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kh-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
