import type { TextItem } from './types';

/** PDF.js getTextContent() öğesinin ihtiyaç duyulan alanları. */
export interface PdfTextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** PDF.js PageViewport'un ihtiyaç duyulan alanları (scale: 1 önerilir). */
export interface ViewportLike {
  width: number;
  height: number;
  scale: number;
  transform: number[];
}

/**
 * PDF.js metin öğelerini sol-üst kökenli, görüntü alanı koordinatlı TextItem'lara çevirir.
 * Döndürülmüş sayfalar viewport dönüşümüyle doğru konumlanır.
 */
export function pdfTextToItems(items: PdfTextItemLike[], page: number, viewport: ViewportLike): TextItem[] {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = viewport.transform;
  const out: TextItem[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const [, , tc = 0, td = 0, tx = 0, ty = 0] = it.transform;
    const x = a * tx + c * ty + e;
    const yBase = b * tx + d * ty + f;
    const fontH = Math.hypot(tc, td) * viewport.scale || it.height * viewport.scale || 10;
    out.push({ text: it.str, x, y: yBase - fontH, w: Math.max(1, it.width * viewport.scale), h: fontH, page });
  }
  return out;
}
