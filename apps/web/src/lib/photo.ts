import { looksLikeDocumentImage, looksLikeFilmImage } from '@kh/ingest';

/**
 * Fotoğrafın küçük bir kopyasına bakarak kaba sınıflandırma: rapor kâğıdı/ekran mı, film/görüntü mü.
 * Yalnızca bellekte, ~200 piksellik kopya üzerinde çalışır.
 */
export async function classifyPhoto(bytes: Uint8Array, mimeType: string): Promise<'document' | 'film' | 'unknown'> {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: mimeType }), { imageOrientation: 'from-image' });
    const k = Math.min(1, 200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'unknown';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    if (looksLikeFilmImage(data)) return 'film';
    return looksLikeDocumentImage(data) ? 'document' : 'unknown';
  } catch {
    return 'unknown';
  }
}
