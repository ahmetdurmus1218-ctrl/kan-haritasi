import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Legacy derleme: Android WebView ve daha eski tarayıcılarda eksik olan yeni JS API'leri için
// (ör. Map.getOrInsertComputed) polyfill içerir.
GlobalWorkerOptions.workerSrc = workerUrl;

const assetBase = new URL('./pdfjs/', document.baseURI).href;

/**
 * PDF.js'i güvenli ayarlarla açar:
 * - Tüm yardımcı dosyalar uygulamanın kendi kökeninden (CDN yok).
 * - XFA formları kapalı; PDF içindeki JavaScript zaten hiç çalıştırılmaz (scripting yüklenmez).
 * - Baytlar kopyalanarak verilir; PDF.js tamponu worker'a aktarıp boşaltır.
 */
export function openPdf(bytes: Uint8Array): PDFDocumentLoadingTask {
  return getDocument({
    data: bytes.slice(),
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    wasmUrl: `${assetBase}wasm/`,
    iccUrl: `${assetBase}iccs/`,
    enableXfa: false,
    stopAtErrors: false,
  });
}

/** Yükleme sırasında sayfa sınırını kontrol etmek için. Parola korumalı PDF'te null döner. */
export async function countPdfPages(bytes: Uint8Array): Promise<number | null> {
  const task = openPdf(bytes);
  let needsPassword = false;
  task.onPassword = () => {
    needsPassword = true;
    void task.destroy();
  };
  try {
    const doc = await task.promise;
    return doc.numPages;
  } catch (e) {
    if (needsPassword) return null;
    throw e;
  } finally {
    void task.destroy();
  }
}
