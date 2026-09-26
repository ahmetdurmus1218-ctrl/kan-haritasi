import type { TextItem } from '@kh/parser';

/** Tesseract çıktısının kullandığımız kısmı (tarayıcıdan bağımsız; testlerde de kullanılır). */
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
export interface OcrLine {
  baseline: { x0: number; y0: number; x1: number; y1: number };
  bbox: { x0: number; x1: number };
  words: OcrWord[];
}

/** Fotoğrafın eğimi: yeterince uzun satırların taban çizgisi açılarının ortancası (radyan). */
export function skewAngle(lines: Array<Pick<OcrLine, 'baseline' | 'bbox'>>): number {
  const angles = lines
    .filter((l) => l.baseline && l.baseline.x1 - l.baseline.x0 > Math.max(80, (l.bbox.x1 - l.bbox.x0) * 0.5))
    .map((l) => Math.atan2(l.baseline.y1 - l.baseline.y0, l.baseline.x1 - l.baseline.x0))
    .filter((a) => Math.abs(a) < 0.35)
    .sort((a, b) => a - b);
  if (!angles.length) return 0;
  return angles[Math.floor(angles.length / 2)]!;
}

/**
 * OCR satırlarını konumlu kelimelere çevirir. `scale`: görüntü pikseli → hedef birim
 * (PDF sayfasında görüntü alanı ölçeği; fotoğrafta ölçek). `offset`: kırpılan kenar (hedef birimde).
 */
export function ocrLinesToItems(lines: OcrLine[], page: number, scale: number, offset: { x: number; y: number } = { x: 0, y: 0 }): TextItem[] {
  const items: TextItem[] = [];
  const theta = skewAngle(lines);
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  for (const line of lines) {
    const words = line.words.filter((w) => w.text.trim());
    if (!words.length) continue;
    // Satırın eğimi düzeltilmiş dikey merkezi: aynı tablo satırının tüm kelimeleri aynı gruba düşer.
    const ys = words.map((w) => {
      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      return -cx * sin + cy * cos;
    });
    const lineCy = ys.reduce((a, b) => a + b, 0) / ys.length / scale + offset.y;
    for (const w of words) {
      items.push({
        text: w.text,
        x: w.bbox.x0 / scale + offset.x,
        y: w.bbox.y0 / scale + offset.y,
        w: (w.bbox.x1 - w.bbox.x0) / scale,
        h: (w.bbox.y1 - w.bbox.y0) / scale,
        page,
        conf: w.confidence,
        cy: lineCy,
      });
    }
  }
  return items;
}
