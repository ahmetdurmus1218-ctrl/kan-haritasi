// PDF.js'in çalışma zamanında ihtiyaç duyduğu dosyaları (CMap, standart fontlar, WASM
// görüntü çözücüleri, ICC profilleri) uygulamayla birlikte paketler. Böylece PDF.js
// hiçbir CDN'e istek atmaz; CSP `connect-src 'self'` ile uyumlu kalır.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('pdfjs-dist/package.json'));
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const src = join(pkgDir, dir);
  if (existsSync(src)) cpSync(src, join(outDir, dir), { recursive: true });
}
process.stdout.write(`pdfjs assets -> ${outDir}\n`);
