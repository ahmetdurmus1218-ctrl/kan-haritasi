/**
 * Görüntü kalite kontrolü (cihazda, gerçek ölçüm): düşük çözünürlük, bulanıklık, parlama (yansıma),
 * kesilmiş kenar, düşük kontrast, çok karanlık / çok parlak görüntü.
 *
 * Kalite kötü olduğunda analiz durdurulmaz (yalnızca kullanılamayacak kadar küçük görüntüde durur);
 * sonuçların güveni düşürülür ve kullanıcıya ne yapması gerektiği söylenir.
 */
import { downsample, normalize01, percentile } from './image';
import type { RasterImage } from './types';

export type QualityIssueCode = 'low-resolution' | 'too-small' | 'blur' | 'glare' | 'cropped' | 'low-contrast' | 'too-dark' | 'too-bright' | 'unreadable-text';

export interface QualityIssue {
  code: QualityIssueCode;
  severity: 'warning' | 'blocking';
  message: string;
}

export interface QualityReport {
  /** Engelleyici sorun yok mu? */
  usable: boolean;
  /** 0 (çok kötü) … 1 (sorun görülmedi). Analiz güvenini ölçeklemek için kullanılır. */
  score: number;
  issues: QualityIssue[];
  metrics: {
    width: number;
    height: number;
    /** Kuvvetli kenarlarda tahmini kenar genişliği (piksel, 512 piksellik kopyada). Büyükse bulanık. */
    edgeWidth: number;
    glareFraction: number;
    /** 1.–99. yüzdelik arası fark (0–255 ölçeğinde; DICOM'da hesaplanmaz). */
    contrast: number | null;
    median: number | null;
  };
}

const MESSAGES: Record<QualityIssueCode, string> = {
  'too-small': 'Görüntü çok küçük (kısa kenar 64 pikselden az); analiz edilemez. Orijinal dosyayı ya da daha yakından çekilmiş bir fotoğrafı yükle.',
  'low-resolution': 'Çözünürlük düşük: küçük ayrıntılar görülemeyebilir, ölçümler daha az güvenilir.',
  blur: 'Görüntü bulanık görünüyor (kenarlar yayılmış). Telefonu sabit tutarak, odaklanmasını bekleyip yeniden çekmek sonuçları iyileştirir.',
  glare: 'Görüntünün bir bölümünde parlama/yansıma var: o alandaki ayrıntı kaybolmuş olabilir. Ekran ya da film fotoğrafını ışığı yandan alarak çek.',
  cropped: 'Görüntünün kenarı kesilmiş olabilir: içerik çerçevenin kenarına dayanıyor. Görüntünün tamamını kadraja al.',
  'low-contrast': 'Kontrast düşük: açık ve koyu alanlar birbirine yakın, ayrıntılar seçilemeyebilir.',
  'too-dark': 'Görüntü çok karanlık.',
  'too-bright': 'Görüntü çok parlak (beyaza doymuş).',
  'unreadable-text': 'Görüntüdeki yazı okunamadı.',
};

export function qualityIssue(code: QualityIssueCode, severity: QualityIssue['severity'] = 'warning'): QualityIssue {
  return { code, severity, message: MESSAGES[code] };
}

/** Kenar genişliği tahmini: kuvvetli kenarlarda |Laplas| / |gradyan| oranı ≈ 0,5 / σ. */
export function edgeWidth(img: Float32Array, w: number, h: number): number {
  const grads: number[] = [];
  const pairs: Array<[number, number]> = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (img[i + 1]! - img[i - 1]!) / 2;
      const gy = (img[i + w]! - img[i - w]!) / 2;
      const g = Math.hypot(gx, gy);
      if (g < 0.02) continue;
      const lap = Math.abs(img[i + 1]! + img[i - 1]! + img[i + w]! + img[i - w]! - 4 * img[i]!);
      grads.push(g);
      pairs.push([g, lap]);
    }
  if (pairs.length < 50) return 0;
  const t = percentile(grads, 0.9);
  let sg = 0;
  let sl = 0;
  for (const [g, l] of pairs)
    if (g >= t) {
      sg += g;
      sl += l;
    }
  // Çok keskin kenarlarda (tek piksel) oran ~2; sınırla.
  const ratio = sg ? sl / sg : 0;
  return ratio > 0 ? Math.round((0.5 / ratio) * 100) / 100 : 99;
}

export function assessQuality(image: RasterImage): QualityReport {
  const { width, height } = image;
  const issues: QualityIssue[] = [];
  const minSide = Math.min(width, height);
  if (minSide < 64) {
    issues.push(qualityIssue('too-small', 'blocking'));
    return { usable: false, score: 0, issues, metrics: { width, height, edgeWidth: 0, glareFraction: 0, contrast: null, median: null } };
  }
  if (minSide < 200) issues.push(qualityIssue('low-resolution'));

  // Bulanıklık: 512 piksellik normalleştirilmiş kopyada kenar genişliği.
  const small = downsample(image.gray, width, height, 512);
  const norm = normalize01(small.data);
  const ew = edgeWidth(norm, small.width, small.height);
  // Kenar genişliği yaklaşık σ; 512 pikselde σ > 2,6 belirgin bulanıklık.
  if (ew > 2.6) issues.push(qualityIssue('blur'));

  // 8 bit fotoğraf istatistikleri (DICOM ham değerlerinde anlamsız).
  let contrast: number | null = null;
  let median: number | null = null;
  let glareFraction = 0;
  if (image.rgba) {
    const step = Math.max(1, Math.floor(image.gray.length / 60000));
    const sample: number[] = [];
    for (let i = 0; i < image.gray.length; i += step) sample.push(image.gray[i]!);
    const p1 = percentile(sample, 0.01);
    const p99 = percentile(sample, 0.99);
    median = percentile(sample, 0.5);
    contrast = Math.round(p99 - p1);
    if (contrast < 40) issues.push(qualityIssue('low-contrast'));
    if (median < 25 && p99 < 80) issues.push(qualityIssue('too-dark'));
    if (median > 245 && p1 > 200) issues.push(qualityIssue('too-bright'));
    // Parlama: beyaza doymuş, renksiz pikseller; beyaz kâğıt (ortanca çok açık) hariç.
    let sat = 0;
    let seen = 0;
    const rgba = image.rgba;
    for (let p = 0; p < image.gray.length; p += step) {
      const r = rgba[p * 4]!;
      const g = rgba[p * 4 + 1]!;
      const b = rgba[p * 4 + 2]!;
      seen++;
      if (Math.min(r, g, b) >= 250) sat++;
    }
    glareFraction = seen ? Math.round((sat / seen) * 1000) / 1000 : 0;
    if (median < 200 && glareFraction > 0.015 && glareFraction < 0.4) issues.push(qualityIssue('glare'));
  }

  // Kesilmiş kenar: koyu arka planlı görüntüde (film, kesit, ekran) parlak içerik kenara dayanıyorsa.
  const border: number[] = [];
  const sw = small.width;
  const sh = small.height;
  for (let x = 0; x < sw; x++) border.push(norm[x]!, norm[(sh - 1) * sw + x]!);
  for (let y = 0; y < sh; y++) border.push(norm[y * sw]!, norm[y * sw + sw - 1]!);
  const borderMedian = percentile(border, 0.5);
  if (borderMedian < 0.15) {
    const side = (get: (k: number) => number, n: number) => {
      let lit = 0;
      for (let k = 0; k < n; k++) if (get(k) > 0.35) lit++;
      return lit / n;
    };
    const touches = [
      side((k) => norm[k]!, sw),
      side((k) => norm[(sh - 1) * sw + k]!, sw),
      side((k) => norm[k * sw]!, sh),
      side((k) => norm[k * sw + sw - 1]!, sh),
    ];
    if (touches.some((t) => t > 0.25)) issues.push(qualityIssue('cropped'));
  }

  const penalty: Record<QualityIssueCode, number> = {
    'too-small': 1,
    'low-resolution': 0.15,
    blur: 0.25,
    glare: 0.2,
    cropped: 0.15,
    'low-contrast': 0.2,
    'too-dark': 0.2,
    'too-bright': 0.2,
    'unreadable-text': 0.1,
  };
  const score = Math.max(0.1, Math.round((1 - issues.reduce((s, i) => s + penalty[i.code], 0)) * 100) / 100);
  return { usable: true, score, issues, metrics: { width, height, edgeWidth: ew, glareFraction, contrast, median } };
}
