/**
 * Patoloji / mikroskopi: boyalı doku alanı, çekirdek sayımı ve yoğunluğu gerçek ölçümdür. Doku tipini
 * tanıma, hücre morfolojisini sınıflama, normal histolojiyle karşılaştırma ve tanı bu kurulumda YOK.
 *
 *   Görüntü → doku alanı → çekirdekler → ölçülen özellikler → [yorum: model yok]
 */
import { downsampleRgba, hsv } from '../image';
import { type ImageObservation, type ModelVersion, score } from '../types';
import { type ImageAnalysisAdapter, capabilityStatus, obsId } from './types';

export const PATH_MODEL: ModelVersion = { id: 'kh-he-features', name: 'H&E boyalı kesit: doku ve çekirdek ölçümü (kural tabanlı)', version: '1.0.0', kind: 'heuristic', local: true };

export interface StainFeatures {
  tissueFraction: number;
  nuclei: number;
  /** 10 000 doku pikseli başına çekirdek. */
  density: number;
  meanNucleusArea: number;
  nuclearFraction: number;
}

export function stainFeatures(rgba: Uint8ClampedArray, width: number, height: number): StainFeatures {
  const s = downsampleRgba(rgba, width, height, 800);
  const w = s.width;
  const h = s.height;
  const nuc = new Uint8Array(w * h);
  let tissue = 0;
  let nucPx = 0;
  for (let p = 0; p < w * h; p++) {
    const r = s.rgba[p * 4]!;
    const g = s.rgba[p * 4 + 1]!;
    const b = s.rgba[p * 4 + 2]!;
    const [hue, sat, val] = hsv(r, g, b);
    if (sat > 0.12 && val < 0.97) tissue++;
    // Hematoksilen: koyu mor–mavi
    if (hue >= 220 && hue <= 300 && val < 0.65 && sat > 0.25) {
      nuc[p] = 1;
      nucPx++;
    }
  }
  // Bağlı bileşenler (çekirdekler)
  const seen = new Uint8Array(w * h);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < nuc.length; i++) {
    if (!nuc[i] || seen[i]) continue;
    let n = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      n++;
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
        if (q >= 0 && q < nuc.length && nuc[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
    }
    if (n >= 4) sizes.push(n);
  }
  const k = 1 / (s.scale * s.scale);
  return {
    tissueFraction: Math.round((tissue / (w * h)) * 100) / 100,
    nuclei: sizes.length,
    density: tissue ? Math.round((sizes.length / tissue) * 10000 * 10) / 10 : 0,
    meanNucleusArea: sizes.length ? Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * k) : 0,
    nuclearFraction: tissue ? Math.round((nucPx / tissue) * 1000) / 1000 : 0,
  };
}

export const pathologyAdapter: ImageAnalysisAdapter = {
  id: 'pathology',
  label: 'Patoloji / mikroskopi — doku ve çekirdek ölçümü',
  modalities: ['PATHOLOGY', 'MICROSCOPY'],
  model: PATH_MODEL,
  capabilities: [
    { key: 'tissue', label: 'Boyalı doku alanını bulma', implemented: true },
    { key: 'nuclei', label: 'Çekirdek sayımı, yoğunluk ve ortalama büyüklük', implemented: true },
    { key: 'tissue-type', label: 'Doku tipini tanıma', implemented: false },
    { key: 'morphology', label: 'Hücre morfolojisini sınıflama (atipi, mitoz…)', implemented: false },
    { key: 'normal-compare', label: 'Normal histolojiyle karşılaştırma', implemented: false },
    { key: 'diagnosis', label: 'Patolojik tanı', implemented: false },
  ],
  analyze({ image, quality }) {
    if (!image.rgba)
      return { adapterId: this.id, modality: 'PATHOLOGY', status: 'UNAVAILABLE', model: PATH_MODEL, capabilities: capabilityStatus(this), observations: [], limitations: ['Renkli görüntü gerekir.'], summary: 'Bu dosyada renkli mikroskop görüntüsü yok.' };
    const f = stainFeatures(image.rgba, image.width, image.height);
    const ok = f.tissueFraction > 0.05;
    const qf = Math.sqrt(quality.score);
    const observations: ImageObservation[] = ok
      ? [
          {
            id: obsId('path'),
            source: 'IMAGE_ANALYSIS',
            kind: 'tissue-feature',
            text: `Boyalı doku görüntünün yaklaşık %${Math.round(f.tissueFraction * 100)}'ini kaplıyor.`,
            localization: { kind: 'none' },
            confidence: score(0.65 * qf, 'renk doygunluğu eşiği'),
            model: PATH_MODEL,
            measurement: { name: 'Doku alanı', value: Math.round(f.tissueFraction * 100), unit: '%', method: 'renk doygunluğu' },
            limitations: ['Boyama ve beyaz dengesi değişirse oran kayar.'],
          },
          {
            id: obsId('path'),
            source: 'IMAGE_ANALYSIS',
            kind: 'tissue-feature',
            text: `${f.nuclei} çekirdek benzeri koyu mor odak sayıldı (10 000 doku pikseli başına ${f.density.toLocaleString('tr-TR')}; ortalama ${f.meanNucleusArea} piksel).`,
            localization: { kind: 'none' },
            confidence: score(0.5 * qf, 'hematoksilen renk eşiği + bağlı bileşen sayımı'),
            model: PATH_MODEL,
            measurement: { name: 'Çekirdek yoğunluğu', value: f.density, unit: '/10⁴ px', method: 'bağlı bileşen sayımı' },
            limitations: ['Büyütme bilinmediği için değerler mikrometreye çevrilemez ve normal değerlerle karşılaştırılamaz.', 'Üst üste binen çekirdekler tek sayılabilir.'],
            cues: { ...f },
          },
        ]
      : [];
    return {
      adapterId: this.id,
      modality: 'PATHOLOGY',
      status: ok ? 'PARTIAL' : 'UNAVAILABLE',
      model: PATH_MODEL,
      capabilities: capabilityStatus(this, { tissue: { ok, detail: `%${Math.round(f.tissueFraction * 100)}` }, nuclei: { ok: ok && f.nuclei > 0, detail: `${f.nuclei} çekirdek` } }),
      observations,
      limitations: [
        'Doku tipini, hücre morfolojisini (atipi, mitoz) tanıyan ya da normal histolojiyle karşılaştıran bir patoloji modeli bu kurulumda YOK; tanı üretilmez.',
        'Patolojik tanı yalnızca patoloğun raporunda yazar.',
      ],
      summary: ok
        ? 'Boyalı doku ve çekirdekler ölçüldü. Doku tipi, hücre morfolojisi ve olası yorum için model yok; tanı üretilmedi.'
        : 'Görüntüde boyalı doku bulunamadı.',
    };
  },
};
