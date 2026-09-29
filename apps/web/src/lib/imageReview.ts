/**
 * Görüntü incelemesinin tarayıcı tarafı: fotoğrafı ya da DICOM kesitini gri tonlu diziye çevirir
 * ve @kh/ingest'teki sağ-sol karşılaştırmasını çalıştırır. Her şey cihazda, bellekte yapılır.
 */
import { type ImageReview, canDecode, decodeFrame, parseDicom, reviewImage } from '@kh/ingest';
import type { Bytes, FileInfo } from '@kh/vault';
import type { StoredReview } from './imagingRecords';

/** İnceleme için yeterli çözünürlük (uzun kenar). */
const MAX_SIDE = 1024;

export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

async function bitmapGray(blob: Blob, orient = true): Promise<GrayImage> {
  const bitmap = await createImageBitmap(blob, orient ? { imageOrientation: 'from-image' } : undefined);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  const data = new Float32Array(img.width * img.height);
  for (let p = 0; p < data.length; p++) data[p] = 0.299 * img.data[p * 4]! + 0.587 * img.data[p * 4 + 1]! + 0.114 * img.data[p * 4 + 2]!;
  return { width: img.width, height: img.height, data };
}

/** Görüntü dosyasını gri tonlu diziye çevirir (DICOM'da ortadaki kare). Desteklenmiyorsa null. */
export async function loadGray(info: Pick<FileInfo, 'kind' | 'mimeType'>, bytes: Bytes): Promise<GrayImage | null> {
  if (info.kind === 'jpeg' || info.kind === 'png') return bitmapGray(new Blob([bytes.slice()], { type: info.mimeType }));
  if (info.kind !== 'dicom') return null;
  const dicom = parseDicom(bytes);
  if (!canDecode(dicom) || dicom.samplesPerPixel !== 1) return null;
  const frame = decodeFrame(bytes, dicom, Math.floor((dicom.frames - 1) / 2));
  if (frame.kind === 'encoded') return bitmapGray(new Blob([frame.data.slice()], { type: frame.mime }), false);
  if (frame.kind !== 'gray') return null;
  return { width: frame.width, height: frame.height, data: frame.data };
}

export function runReview(img: GrayImage): ImageReview {
  return reviewImage(img.data, img.width, img.height);
}

export function toStored(r: ImageReview, sourceId: string, confirmed: boolean): StoredReview {
  return {
    at: new Date().toISOString(),
    sourceId,
    panels: r.panels.length,
    compared: r.compared,
    headLike: r.headLike,
    confirmed,
    regions: r.panels.flatMap((p, i) => p.regions.map((g) => ({ panel: i + 1, side: g.side, vertical: g.vertical, brighter: g.brighter, areaPct: g.areaPct, strength: g.strength }))),
  };
}

const VERTICAL: Record<StoredReview['regions'][number]['vertical'], string> = { top: 'üst', middle: 'orta', bottom: 'alt' };

/** Bölgenin sade anlatımı (ör. "görüntünün sol üst kısmı · karşı tarafa göre daha parlak"). */
export function describeRegion(g: Pick<StoredReview['regions'][number], 'side' | 'vertical' | 'brighter' | 'areaPct'>): string {
  const side = g.side === 'left' ? 'sol' : 'sağ';
  return `görüntünün ${side} ${VERTICAL[g.vertical]} kısmı · karşı tarafa göre daha ${g.brighter ? 'parlak (açık)' : 'koyu'} · kesitin %${g.areaPct.toLocaleString('tr-TR')} kadarı`;
}
