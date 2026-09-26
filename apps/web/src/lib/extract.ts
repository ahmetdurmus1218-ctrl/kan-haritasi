import type { FileInfo } from '@kh/vault';
import type { Sex } from '@kh/catalog';
import { type ReportDraft, type TextItem, parseReport, pdfTextToItems } from '@kh/parser';
import { openPdf } from './pdf';
import { type OcrStage, looksLikeScreenshot, prepareImage, recognizeCanvas } from './ocr';

export interface ExtractProgress {
  phase: 'text' | 'ocr' | 'parse';
  page: number;
  pages: number;
  /** OCR aşaması (motor, dil verisi, tanıma…). */
  stage?: OcrStage;
  /** 0–1, OCR sırasında aşama içi ilerleme. */
  fraction?: number;
}

const MIN_TEXT_CHARS = 40;
const OCR_TARGET_WIDTH = 2200;

/**
 * Raporu cihazda okur:
 * 1. PDF'in metin katmanı (doğru, hızlı). Metni olmayan (taranmış) sayfa OCR'a gider.
 * 2. Fotoğraf: EXIF yönü, gri ton, kontrast → OCR.
 * Ara çıktılar (metin, görüntü) yalnızca bellekte; hiçbir şey diske veya ağa yazılmaz.
 */
export async function extractDraft(
  info: FileInfo,
  bytes: Uint8Array<ArrayBuffer>,
  options: { sex: Sex; userAliases?: Record<string, string>; onProgress?: (p: ExtractProgress) => void },
): Promise<ReportDraft> {
  const items: TextItem[] = [];
  const pageSizes = new Map<number, { w: number; h: number }>();
  let usedOcr = false;
  let usedText = false;
  let pageCount = 1;

  if (info.kind === 'pdf') {
    const task = openPdf(bytes);
    try {
      const doc = await task.promise;
      pageCount = doc.numPages;
      for (let p = 1; p <= doc.numPages; p++) {
        options.onProgress?.({ phase: 'text', page: p, pages: pageCount });
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        pageSizes.set(p, { w: viewport.width, h: viewport.height });
        const content = await page.getTextContent();
        const pageItems = pdfTextToItems(content.items as never, p, viewport);
        const chars = pageItems.reduce((n, it) => n + it.text.replace(/\s/g, '').length, 0);
        if (chars >= MIN_TEXT_CHARS) {
          items.push(...pageItems);
          usedText = true;
          continue;
        }
        // Taranmış sayfa: görüntüye çiz ve OCR'dan geçir.
        usedOcr = true;
        const scale = OCR_TARGET_WIDTH / viewport.width;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        await page.render({ canvas, viewport: vp }).promise;
        items.push(
          ...(await recognizeCanvas(canvas, p, scale, (o) => options.onProgress?.({ phase: 'ocr', page: p, pages: pageCount, stage: o.stage, fraction: o.fraction }))),
        );
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      void task.destroy();
    }
  } else {
    // Görüntü: önce kâğıt fotoğrafı gibi işle; az sonuç çıkarsa ekran görüntüsü kipiyle bir kez daha
    // dene ve daha çok değer okunan sonucu al (ör. e-Nabız ekran görüntüleri açık gri yazı içerir).
    const ocrImage = async (mode: 'document' | 'screen') => {
      options.onProgress?.({ phase: 'ocr', page: 1, pages: 1, stage: 'prepare', fraction: 0 });
      const img = await prepareImage(bytes, info.mimeType, mode);
      pageSizes.set(1, { w: img.width, h: img.height });
      const got = await recognizeCanvas(
        img.canvas,
        1,
        img.scale,
        (o) => options.onProgress?.({ phase: 'ocr', page: 1, pages: 1, stage: o.stage, fraction: o.fraction }),
        img.offset,
      );
      img.canvas.width = 0;
      img.canvas.height = 0;
      return got;
    };
    const parse = (list: TextItem[]) => parseReport(list, { sex: options.sex, method: 'ocr', pageSizes, pageCount: 1, userAliases: options.userAliases });
    const order: Array<'document' | 'screen'> = (await looksLikeScreenshot(bytes, info.mimeType)) ? ['screen', 'document'] : ['document', 'screen'];
    let best = parse(await ocrImage(order[0]!));
    if (best.rows.length < 4) {
      const second = parse(await ocrImage(order[1]!));
      if (draftScore(second) > draftScore(best)) best = second;
    }
    options.onProgress?.({ phase: 'parse', page: 1, pages: 1 });
    return best;
  }

  options.onProgress?.({ phase: 'parse', page: pageCount, pages: pageCount });
  return parseReport(items, {
    sex: options.sex,
    method: usedOcr && usedText ? 'mixed' : usedOcr ? 'ocr' : 'text',
    pageSizes,
    pageCount,
    userAliases: options.userAliases,
  });
}

/** İki okuma denemesini karşılaştırmak için: okunan değer sayısı, güven; sorunlu satırlar (birim/aralık okunamadı…) eksi. */
function draftScore(d: ReportDraft): number {
  return d.rows.reduce((s, r) => s + 10 + r.confidence * 5 - r.issues.length * 3, 0) + d.missing.length * 2;
}
