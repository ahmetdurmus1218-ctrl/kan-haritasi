/** Görüntü üzerindeki ölçüm hesapları (saf fonksiyonlar; testlenebilir). */
export type Pt = [number, number];

/**
 * İki nokta arası uzunluk. `spacing` DICOM PixelSpacing: [satır aralığı (y), sütun aralığı (x)] mm.
 * Ölçek yoksa piksel cinsinden döner.
 */
export function lineLength(a: Pt, b: Pt, spacing?: [number, number]): { value: number; unit: 'mm' | 'px' } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (spacing) return { value: Math.hypot(dx * spacing[1], dy * spacing[0]), unit: 'mm' };
  return { value: Math.hypot(dx, dy), unit: 'px' };
}

/** Dairesel bölge (ROI) içindeki değerlerin ortalaması, standart sapması ve piksel sayısı. */
export function roiStats(data: Float32Array, width: number, height: number, center: Pt, radius: number): { mean: number; sd: number; n: number } {
  const r = Math.max(0.5, radius);
  const x0 = Math.max(0, Math.floor(center[0] - r));
  const x1 = Math.min(width - 1, Math.ceil(center[0] + r));
  const y0 = Math.max(0, Math.floor(center[1] - r));
  const y1 = Math.min(height - 1, Math.ceil(center[1] + r));
  let n = 0;
  let sum = 0;
  let sq = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x + 0.5 - center[0]) ** 2 + (y + 0.5 - center[1]) ** 2 > r * r) continue;
      const v = data[y * width + x]!;
      n++;
      sum += v;
      sq += v * v;
    }
  }
  if (!n) return { mean: NaN, sd: NaN, n: 0 };
  const mean = sum / n;
  return { mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)), n };
}

/**
 * Ekrandaki (döndürülmüş, ölçeklenmiş) görüntüde tıklanan noktanın görüntü pikseli koordinatı.
 * `rect`: görüntü öğesinin ekrandaki sınır kutusu (döndürme sonrası), `scale`: ekran pikseli / görüntü pikseli.
 */
export function toImagePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  rotationDeg: number,
  scale: number,
  natural: { w: number; h: number },
): Pt {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const t = (-rotationDeg * Math.PI) / 180;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const rx = dx * Math.cos(t) - dy * Math.sin(t);
  const ry = dx * Math.sin(t) + dy * Math.cos(t);
  return [rx / scale + natural.w / 2, ry / scale + natural.h / 2];
}
