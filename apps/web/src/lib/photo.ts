import { looksLikeDocumentImage, looksLikeFilmImage, looksLikeSliceImage } from '@kh/ingest';
import { imageFeatures, imageModalityCandidates, rasterFromRgba } from '@kh/analysis';

/** Açık zeminli olsa da yazılı belge değil, görüntünün kendisi analiz edilmesi gereken türler. */
const IMAGE_LIKE = new Set(['ECG', 'PATHOLOGY', 'ULTRASOUND', 'ENDOSCOPY', 'FUNDUS']);

/**
 * Fotoğrafın küçük bir kopyasına bakarak kaba sınıflandırma: rapor kâğıdı/ekran mı, film/görüntü mü.
 * Yalnızca bellekte, ~400 piksellik kopya üzerinde çalışır. Telefonla çekilmiş, renk kayması olan ya
 * da gri çerçeveli MR/BT fotoğrafları da simetrik kesit yapısından film olarak tanınır. EKG kâğıdı
 * (milimetrik ızgara) ve boyalı patoloji kesiti açık zeminli olsa da belge değil görüntü sayılır;
 * yoksa OCR'a gönderilir ve görüntünün kendisi hiç analiz edilmezdi.
 */
export async function classifyPhoto(bytes: Uint8Array, mimeType: string): Promise<'document' | 'film' | 'unknown'> {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: mimeType }), { imageOrientation: 'from-image' });
    const k = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'unknown';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    if (looksLikeFilmImage(data) || looksLikeSliceImage(data, width, height)) return 'film';
    const top = imageModalityCandidates(imageFeatures(rasterFromRgba(data, width, height)))[0];
    if (top && IMAGE_LIKE.has(top.modality)) return 'film';
    return looksLikeDocumentImage(data) ? 'document' : 'unknown';
  } catch {
    return 'unknown';
  }
}
