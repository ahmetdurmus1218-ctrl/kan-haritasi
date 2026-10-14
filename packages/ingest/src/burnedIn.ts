/**
 * Görüntünün PİKSELLERİNDE yazı (hasta adı, tarih, kurum) var mı? — kural tabanlı ön kontrol.
 *
 * DICOM başlığı temizlenebilir ama görüntüye yakılmış yazı silinemez; çoğu cihaz bu yazıları köşelere
 * ve üst/alt şeritlere, koyu zemin üzerine doymuş (en parlak) ince çizgilerle yazar. Bu kontrol yazıyı
 * OKUMAZ (OCR değildir); yalnızca yazıya benzeyen alanları (satır boyunca çok sayıda parlak↔koyu geçişi,
 * birkaç ardışık satır yüksekliğinde, koyu zeminde) bulur. Yanlış pozitif (cetvel, işaret) ve yanlış
 * negatif (soluk ya da görüntü içine gömülü yazı) olabilir; "bulunmadı" yazı olmadığını garanti etmez.
 */

import { type DicomInfo, canDecode, decodeFrame } from './dicom';

export interface TextRegion {
  /** Görüntü koordinatında yaklaşık kutu (piksel). */
  x: number;
  y: number;
  w: number;
  h: number;
  where: 'sol üst' | 'sağ üst' | 'sol alt' | 'sağ alt' | 'üst şerit' | 'alt şerit';
}

export interface PixelTextScan {
  /** detected: yazıya benzer alan var · none: bulunmadı (garanti değil) · not-assessed: piksel çözülemedi */
  status: 'detected' | 'none' | 'not-assessed';
  regions: TextRegion[];
  reason: string;
}

export const PIXEL_TEXT_WARNING = 'Görüntü içinde kişisel bilgi bulunabilir.';

/** Değer dizisinin yaklaşık yüzdelikleri (örnekleme ile). */
function percentiles(v: ArrayLike<number>, ps: number[]): number[] {
  const step = Math.max(1, Math.floor(v.length / 40000));
  const s: number[] = [];
  for (let i = 0; i < v.length; i += step) s.push(v[i]!);
  s.sort((a, b) => a - b);
  return ps.map((p) => s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]!);
}

/**
 * Gri piksel dizisi (satır satır, width × height) üzerinde tarama. Büyük görüntüler en fazla ~1024 piksel
 * genişliğe seyreltilerek incelenir (ince yazı çizgisi kaybolmasın diye en fazla 3× atlanır).
 */
export function scanBurnedInText(gray: ArrayLike<number>, width: number, height: number): PixelTextScan {
  if (!(width >= 64 && height >= 64) || gray.length < width * height) return { status: 'not-assessed', regions: [], reason: 'Görüntü çok küçük ya da çözülemedi; piksel kontrolü yapılamadı.' };
  const step = Math.min(3, Math.max(1, Math.floor(width / 1024)));
  const W = Math.floor(width / step);
  const H = Math.floor(height / step);
  const [lo, hi, top] = percentiles(gray, [0.01, 0.995, 1]);
  const range = Math.max(1e-6, (top ?? hi!) - lo!);
  // Yazı genellikle görüntünün en parlak değerlerindedir (doymuş beyaz): üst %3'lük dilim.
  const bright = (x: number, y: number) => (gray[y * step * width + x * step]! - lo!) / range >= 0.88;
  const dark = (x: number, y: number) => (gray[y * step * width + x * step]! - lo!) / range <= 0.25;

  const zones: Array<{ where: TextRegion['where']; x0: number; x1: number; y0: number; y1: number }> = [
    { where: 'sol üst', x0: 0, x1: Math.floor(W * 0.35), y0: 0, y1: Math.floor(H * 0.2) },
    { where: 'sağ üst', x0: Math.floor(W * 0.65), x1: W, y0: 0, y1: Math.floor(H * 0.2) },
    { where: 'sol alt', x0: 0, x1: Math.floor(W * 0.35), y0: Math.floor(H * 0.8), y1: H },
    { where: 'sağ alt', x0: Math.floor(W * 0.65), x1: W, y0: Math.floor(H * 0.8), y1: H },
    { where: 'üst şerit', x0: Math.floor(W * 0.35), x1: Math.floor(W * 0.65), y0: 0, y1: Math.floor(H * 0.08) },
    { where: 'alt şerit', x0: Math.floor(W * 0.35), x1: Math.floor(W * 0.65), y0: Math.floor(H * 0.92), y1: H },
  ];
  const regions: TextRegion[] = [];
  for (const z of zones) {
    const zw = z.x1 - z.x0;
    if (zw < 16 || z.y1 - z.y0 < 6) continue;
    let run = 0;
    let runStart = 0;
    let best: { y0: number; y1: number; xMin: number; xMax: number } | null = null;
    let xMin = Infinity;
    let xMax = -Infinity;
    for (let y = z.y0; y < z.y1; y++) {
      let transitions = 0;
      let nBright = 0;
      let nDark = 0;
      let prev = false;
      let rowMin = Infinity;
      let rowMax = -Infinity;
      for (let x = z.x0; x < z.x1; x++) {
        const b = bright(x, y);
        if (b) {
          nBright++;
          rowMin = Math.min(rowMin, x);
          rowMax = Math.max(rowMax, x);
        } else if (dark(x, y)) nDark++;
        if (x > z.x0 && b !== prev) transitions++;
        prev = b;
      }
      // Yazı satırı: koyu zemin baskın, az ama çok parçalı parlak piksel (harf çizgileri)
      const textRow = transitions >= 8 && nBright / zw >= 0.015 && nBright / zw <= 0.45 && nDark / zw >= 0.4;
      if (textRow) {
        if (run === 0) {
          runStart = y;
          xMin = Infinity;
          xMax = -Infinity;
        }
        run++;
        xMin = Math.min(xMin, rowMin);
        xMax = Math.max(xMax, rowMax);
      }
      if ((!textRow || y === z.y1 - 1) && run > 0) {
        // Harf yüksekliği: en az 3 satır (seyreltilmiş), en fazla bölgenin yarısı (dolu blok değil)
        if (run >= 3 && run <= Math.max(6, (z.y1 - z.y0) * 0.6) && !best) best = { y0: runStart, y1: runStart + run, xMin, xMax };
        run = 0;
      }
    }
    if (best) regions.push({ x: best.xMin * step, y: best.y0 * step, w: Math.max(1, best.xMax - best.xMin + 1) * step, h: (best.y1 - best.y0) * step, where: z.where });
  }
  return regions.length
    ? { status: 'detected', regions, reason: `${PIXEL_TEXT_WARNING} Piksel kontrolünde yazıya benzeyen alan: ${regions.map((r) => r.where).join(', ')} (yazı okunmadı; kural tabanlı kontrol).` }
    : { status: 'none', regions: [], reason: 'Piksel kontrolünde köşelerde ve kenar şeritlerinde yazıya benzeyen alan bulunmadı; bu, görüntüde yazı olmadığını garanti etmez.' };
}

/**
 * DICOM dosyasının ilk çerçevesinde piksel kontrolü. Sıkıştırılmış JPEG çerçeve burada çözülmez
 * (tarayıcı çözer) → "değerlendirilemedi" denir; uydurulmaz.
 */
export function scanDicomPixels(bytes: Uint8Array, info: DicomInfo): PixelTextScan {
  try {
    if (!canDecode(info) || info.frames < 1) return { status: 'not-assessed', regions: [], reason: 'Bu sıkıştırma türü cihazda çözülemediği için piksel kontrolü yapılamadı.' };
    const f = decodeFrame(bytes, info, 0);
    if (f.kind === 'gray') return scanBurnedInText(f.data, f.width, f.height);
    if (f.kind === 'rgba') {
      const g = new Float32Array(f.width * f.height);
      for (let i = 0; i < g.length; i++) g[i] = 0.299 * f.data[i * 4]! + 0.587 * f.data[i * 4 + 1]! + 0.114 * f.data[i * 4 + 2]!;
      return scanBurnedInText(g, f.width, f.height);
    }
    return { status: 'not-assessed', regions: [], reason: 'JPEG sıkıştırmalı çerçeve bu kontrolde çözülmedi; piksel kontrolü yapılamadı.' };
  } catch {
    return { status: 'not-assessed', regions: [], reason: 'Piksel verisi okunamadı; piksel kontrolü yapılamadı.' };
  }
}
