// Çalışma zamanında gereken üçüncü taraf dosyaları uygulamayla birlikte paketler:
// - PDF.js: CMap, standart fontlar, WASM görüntü çözücüleri, ICC profilleri
// - Tesseract.js (OCR): worker betiği, SIMD+LSTM çekirdeği, Türkçe ve İngilizce dil verisi
// Böylece hiçbir kütüphane CDN'e istek atmaz; CSP `connect-src 'self'` ile uyumlu kalır ve
// Android'de (internet izni yok) her şey APK içinden gelir.
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const pkg = (name) => dirname(require.resolve(`${name}/package.json`));

// PDF.js
const pdfOut = join(pub, 'pdfjs');
rmSync(pdfOut, { recursive: true, force: true });
mkdirSync(pdfOut, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const src = join(pkg('pdfjs-dist'), dir);
  if (existsSync(src)) cpSync(src, join(pdfOut, dir), { recursive: true });
}

// Tesseract.js
const ocrOut = join(pub, 'ocr');
rmSync(ocrOut, { recursive: true, force: true });
mkdirSync(ocrOut, { recursive: true });
copyFileSync(join(pkg('tesseract.js'), 'dist', 'worker.min.js'), join(ocrOut, 'worker.min.js'));
const coreDir = dirname(require.resolve('tesseract.js-core/package.json', { paths: [pkg('tesseract.js')] }));
copyFileSync(join(coreDir, 'tesseract-core-simd-lstm.wasm.js'), join(ocrOut, 'tesseract-core-simd-lstm.wasm.js'));
for (const lang of ['tur', 'eng']) {
  copyFileSync(join(pkg(`@tesseract.js-data/${lang}`), '4.0.0_best_int', `${lang}.traineddata.gz`), join(ocrOut, `${lang}.traineddata.gz`));
}

process.stdout.write(`vendor assets -> ${pub}/{pdfjs,ocr}\n`);
