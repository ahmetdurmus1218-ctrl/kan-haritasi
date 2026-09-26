import type { FileInfo } from '@kh/vault';
import type { Sex } from '@kh/catalog';
import { type ReportDraft, type TextItem, draftScore, mergeOcrDrafts, parseReport, pdfTextToItems } from '@kh/parser';
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
  /** Taranmış sayfaların ikinci (farklı bölütlemeli) OCR okuması; metin katmanı iki listede de aynı. */
  const altItems: TextItem[] = [];
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
          altItems.push(...pageItems);
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
        const [block, auto] = await recognizeCanvas(canvas, p, scale, (o) => options.onProgress?.({ phase: 'ocr', page: p, pages: pageCount, stage: o.stage, fraction: o.fraction }));
        items.push(...block!);
        altItems.push(...auto!);
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      void task.destroy();
    }
  } else {
    // Görüntü: kâğıt fotoğrafı ya da ekran görüntüsü için uygun ön işleme; çok az sonuç çıkarsa diğer
    // ön işleme kipiyle bir kez daha dene (ör. e-Nabız ekran görüntüleri açık gri yazı içerir).
    const ocrImage = async (mode: 'document' | 'screen', segmentations: Array<'block' | 'auto'>) => {
      options.onProgress?.({ phase: 'ocr', page: 1, pages: 1, stage: 'prepare', fraction: 0 });
      const img = await prepareImage(bytes, info.mimeType, mode);
      pageSizes.set(1, { w: img.width, h: img.height });
      const got = await recognizeCanvas(
        img.canvas,
        1,
        img.scale,
        (o) => options.onProgress?.({ phase: 'ocr', page: 1, pages: 1, stage: o.stage, fraction: o.fraction }),
        img.offset,
        segmentations,
      );
      img.canvas.width = 0;
      img.canvas.height = 0;
      return got;
    };
    const parse = (list: TextItem[]) => parseReport(list, { sex: options.sex, method: 'ocr', pageSizes, pageCount: 1, userAliases: options.userAliases });
    const order: Array<'document' | 'screen'> = (await looksLikeScreenshot(bytes, info.mimeType)) ? ['screen', 'document'] : ['document', 'screen'];
    // Aynı görüntü iki bölütleme kipinde okunur; uyuşmayan değerler doğrulamaya düşer.
    const [block, auto] = await ocrImage(order[0]!, ['block', 'auto']);
    let best = mergeOcrDrafts(parse(block!), parse(auto!));
    if (best.rows.length < 4) {
      // Çok az sonuç: diğer ön işleme kipiyle (ör. ekran görüntüsü) bir kez daha dene.
      const [second] = await ocrImage(order[1]!, ['block']);
      const alt = parse(second!);
      if (draftScore(alt) > draftScore(best)) best = alt;
    }
    options.onProgress?.({ phase: 'parse', page: 1, pages: 1 });
    return best;
  }

  options.onProgress?.({ phase: 'parse', page: pageCount, pages: pageCount });
  const opts = {
    sex: options.sex,
    method: (usedOcr && usedText ? 'mixed' : usedOcr ? 'ocr' : 'text') as ReportDraft['method'],
    pageSizes,
    pageCount,
    userAliases: options.userAliases,
  };
  const draft = parseReport(items, opts);
  return usedOcr ? mergeOcrDrafts(draft, parseReport(altItems, opts)) : draft;
}
