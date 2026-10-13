/**
 * Güvenlik gereksinimi: uygulama internet gerektirmez ve hasta verisini cihaz dışına göndermez.
 *  - Kaynak kodda ağ API'si (fetch, XHR, WebSocket, EventSource, sendBeacon) ve uzak adres yok.
 *  - Uzak tıbbi AI / analitik / telemetri / reklam / çökme raporlama paketi bağımlılıklarda yok.
 *  - Android: INTERNET ve ağ durumu izinleri kaldırılır, düz metin trafiği kapalı.
 *  - CSP: connect-src yalnızca 'self'.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const SOURCE_DIRS = ['apps/web/src', 'apps/web/vite-plugins', ...readdirSync(join(ROOT, 'packages')).map((p) => `packages/${p}/src`)];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') out.push(...files(p));
    } else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const sources = SOURCE_DIRS.flatMap((d) => files(join(ROOT, d))).map((p) => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') }));
/** Yorumlar hariç kod (adresler açıklamada geçebilir). */
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1');

describe('çevrimdışı / veri cihazdan çıkmaz', () => {
  it('kaynak kodda ağ API çağrısı yok', () => {
    expect(sources.length).toBeGreaterThan(50);
    const NET = /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew\s+WebSocket\b|\bEventSource\b|\bsendBeacon\b|\bimportScripts\s*\(/;
    // Tek istisna: uygulama kabuğunu (aynı köken) önbelleğe alan service worker — aşağıda ayrıca denetlenir.
    const hits = sources.filter((s) => s.path !== 'apps/web/vite-plugins/security.ts' && NET.test(code(s.text))).map((s) => s.path);
    expect(hits).toEqual([]);
  });

  it('service worker yalnızca aynı kökenden GET ile uygulama dosyalarını önbelleğe alır', () => {
    const sw = readFileSync(join(ROOT, 'apps/web/vite-plugins/security.ts'), 'utf8');
    expect(sw).toContain("if (req.method !== 'GET') return;");
    expect(sw).toContain('if (url.origin !== self.location.origin) return;');
  });

  it('kaynak kodda uzak adres (http/https) yok', () => {
    const URL = /\bhttps?:\/\/(?!localhost|127\.0\.0\.1|appassets\.androidplatform\.net|www\.w3\.org\/2000\/svg)/;
    const hits = sources.filter((s) => URL.test(code(s.text))).map((s) => s.path);
    expect(hits).toEqual([]);
  });

  it('uzak tıbbi AI, analitik, telemetri, reklam ya da çökme raporlama paketi yok', () => {
    const BANNED = /^(openai|@anthropic-ai\/|@google\/(generative-ai|genai)|@google-cloud\/|@azure\/|aws-sdk|@aws-sdk\/|firebase|@firebase\/|@sentry\/|sentry|bugsnag|@bugsnag\/|mixpanel|amplitude|@amplitude\/|posthog|@segment\/|analytics|react-ga|@datadog\/|newrelic|logrocket|hotjar|axios|socket\.io)/;
    const pkgs = ['package.json', 'apps/web/package.json', ...readdirSync(join(ROOT, 'packages')).map((p) => `packages/${p}/package.json`)];
    for (const p of pkgs) {
      const j = JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as Record<string, Record<string, string> | undefined>;
      const deps = Object.keys({ ...j.dependencies, ...j.devDependencies, ...j.optionalDependencies });
      expect(deps.filter((d) => BANNED.test(d)), p).toEqual([]);
    }
  });

  it('uzak sağlayıcı yapılandırması (API anahtarı / base URL) kodda yok', () => {
    const REMOTE = /MEDICAL_AI_API_KEY|MEDICAL_AI_BASE_URL|apiKey\s*[:=]|Authorization:\s*Bearer/;
    expect(sources.filter((s) => REMOTE.test(code(s.text))).map((s) => s.path)).toEqual([]);
  });

  it('ONNX çıkarım motoru yalnızca yerel WASM ile ve uzak yol olmadan yüklenir', () => {
    const engine = readFileSync(join(ROOT, 'apps/web/src/lib/localModels/engine.ts'), 'utf8');
    expect(engine).toContain("import('onnxruntime-web/wasm')");
    expect(code(engine)).not.toMatch(/wasmPaths|webgpu|webnn|https?:/);
  });

  it('Android: INTERNET izni kaldırılır, ağ durumu izni ve düz metin trafiği kapalı, yedekleme kapalı', () => {
    const m = readFileSync(join(ROOT, 'apps/android/app/src/main/AndroidManifest.xml'), 'utf8');
    expect(m).toMatch(/<uses-permission android:name="android\.permission\.INTERNET" tools:node="remove" \/>/);
    expect(m).toMatch(/<uses-permission android:name="android\.permission\.ACCESS_NETWORK_STATE" tools:node="remove" \/>/);
    const granted = [...m.matchAll(/<uses-permission\b[^>]*android:name="([^"]+)"[^>]*\/>/g)].filter((x) => !x[0].includes('tools:node="remove"')).map((x) => x[1]);
    expect(granted).not.toContain('android.permission.INTERNET');
    expect(m).toContain('android:usesCleartextTraffic="false"');
    expect(m).toContain('android:allowBackup="false"');
  });

  it("CSP: connect-src yalnızca 'self'; harici script yok", () => {
    const sec = readFileSync(join(ROOT, 'apps/web/vite-plugins/security.ts'), 'utf8');
    expect(sec).toMatch(/'connect-src': \["'self'"\]/);
    expect(sec).toMatch(/'script-src': \["'self'", "'wasm-unsafe-eval'"\]/);
  });
});
