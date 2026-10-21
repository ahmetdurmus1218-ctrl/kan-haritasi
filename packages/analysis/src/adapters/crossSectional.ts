/**
 * Kesitsel görüntüler (MR, BT, PET/BT, SPECT): GÖRÜNTÜ GEOMETRİSİ / SAĞ-SOL SİMETRİ ÖN KONTROLÜ
 * (@kh/ingest reviewImage). Bu bir tıbbi görüntü tanı modeli DEĞİLDİR: yaptığı tek şey kesitleri
 * ayırmak, orta hattı bulmak ve iki yarıyı ayna görüntüsüyle karşılaştırmaktır. Çıktısı "görüntü
 * asimetrisi gözlemi"dir (ImageObservation), asla lezyon/bulgu (MedicalFinding) değildir. Gözlem bir
 * beyin bölgesine (lob, yarıküre) EŞLENMEZ: fotoğraftaki parlaklık farkının hangi loba düştüğü kesit düzeyi,
 * açı ve yansıma bilinmeden söylenemez; "sağ alın lobu" gibi bir konum sahte kesinlik verir. Bu yüzden
 * gözlem organ durumuna, özete ve 3B vurgulara da katılmaz. Lezyon
 * analizi, organ segmentasyonu ve sekans tanıma gerçek bir model gerektirir (medicalAI.ts) ve yetenek
 * listesinde "bu kurulumda yok" olarak görünür.
 */
import { reviewImage } from '@kh/ingest';
import { type AdapterResult, type ImageObservation, type ModelVersion, score } from '../types';
import { type ImageAnalysisAdapter, capabilityStatus, obsId } from './types';

export const SYMMETRY_MODEL: ModelVersion = { id: 'kh-lr-symmetry', name: 'Sağ-sol ayna karşılaştırması', version: '1.1.0', kind: 'heuristic', local: true };

const VERTICAL_TR = { top: 'üst', middle: 'orta', bottom: 'alt' } as const;

export const crossSectionalAdapter: ImageAnalysisAdapter = {
  id: 'cross-sectional-symmetry',
  label: 'Kesitsel görüntü (MR / BT / PET) — görüntü geometrisi / sağ-sol simetri ön kontrolü',
  modalities: ['MRI', 'CT', 'PET', 'PET_CT', 'SPECT'],
  model: SYMMETRY_MODEL,
  capabilities: [
    { key: 'panels', label: 'Kesitleri ayırma', implemented: true },
    { key: 'midline', label: 'Orta hat ve eğiklik bulma (geometri)', implemented: true },
    { key: 'asymmetry', label: 'Sağ-sol simetri ön kontrolü', implemented: true },
    { key: 'anatomy', label: 'Gözlem alanını bir beyin bölgesine (lob) eşleme', implemented: false },
    { key: 'lesion-detection', label: 'Lezyon analizi', implemented: false },
    { key: 'segmentation', label: 'Organ segmentasyonu', implemented: false },
    { key: 'sequence', label: 'MR sekansı tanıma (T1, T2, FLAIR…) ve kontrast tanıma', implemented: false },
    { key: 'bilateral', label: 'İki tarafı eşit etkileyen değişiklikleri görme', implemented: false },
  ],
  analyze({ image, quality }) {
    const r = reviewImage(image.gray, image.width, image.height);
    const qf = Math.sqrt(quality.score);
    const observations: ImageObservation[] = [];
    r.panels.forEach((p, pi) => {
      for (const g of p.regions) {
        const value = (0.3 + Math.min(0.25, (g.strength - 1.8) * 0.1) + Math.min(0.15, g.areaPct * 0.02)) * qf * (0.7 + 0.3 * p.symmetry);
        observations.push({
          id: obsId('img'),
          source: 'IMAGE_ANALYSIS',
          kind: 'asymmetry',
          text: `Görüntü asimetrisi gözlemi — Kesit ${pi + 1}: görüntünün ${g.side === 'left' ? 'sol' : 'sağ'} ${VERTICAL_TR[g.vertical]} kısmı karşı tarafa göre daha ${g.brighter ? 'parlak' : 'koyu'} (kesitin %${g.areaPct.toLocaleString('tr-TR')} kadarı).`,
          localization: { kind: 'pixel', frame: pi, box: { x: g.x, y: g.y, w: g.w, h: g.h }, imageSize: { width: image.width, height: image.height } },
          confidence: score(Math.min(0.75, value), 'fark gücü, alan, kesit simetrisi ve görüntü kalitesi'),
          model: SYMMETRY_MODEL,
          limitations: [
            'Bu bir tıbbi bulgu değil, görüntü asimetrisi gözlemidir: yalnızca "bu iki taraf farklı görünüyor" demektir; farkın nedeni (normal varyant, eğiklik, lezyon) bilinmez.',
            'Sağlıklı kişilerde de hafif asimetri olur; fotoğraf açısı ve yansıma yanlış işarete yol açabilir.',
            'Farkın beynin hangi bölgesine (lob) düştüğü söylenemez: kesit düzeyi ve çekim açısı bilinmiyor.',
          ],
          cues: { strength: g.strength, areaPct: g.areaPct, brighter: g.brighter, panelSymmetry: p.symmetry, angle: r.angle, panel: pi + 1, side: g.side, vertical: g.vertical, headLike: r.headLike },
        });
      }
    });
    const status: AdapterResult['status'] = r.compared > 0 ? 'PARTIAL' : 'UNAVAILABLE';
    return {
      adapterId: this.id,
      modality: 'MRI',
      status,
      model: SYMMETRY_MODEL,
      capabilities: capabilityStatus(this, {
        panels: { ok: r.panels.length > 0, detail: `${r.panels.length} kesit` },
        midline: { ok: r.compared > 0, detail: r.angle ? `fotoğraf ${r.angle.toFixed(1)}° eğik; düzeltildi` : undefined },
        asymmetry: { ok: r.compared > 0, detail: r.compared ? `${r.compared} kesit karşılaştırıldı, ${observations.length} asimetri gözlemi` : 'simetrik (eksenel/koronal) kesit yok' },
      }),
      observations,
      frames: r.panels.length,
      extent: { panels: r.panels.length, compared: r.compared, headLike: r.headLike },
      limitations: [
        'Bu bir tıbbi görüntü tanı modeli değildir. Lezyon tespit eden, organ bölen ya da sekans tanıyan bir model bu kurulumda YOK; görüntüden yalnızca sağ-sol simetri ön kontrolü yapılır.',
        'İki tarafı eşit etkileyen ve çok küçük değişiklikler bu yöntemle görülmez (yanlış negatif).',
        'Normal asimetriler, baş eğikliği, kesit düzeyi ve fotoğraf açısı yanlış işarete yol açabilir (yanlış pozitif).',
      ],
      summary:
        r.compared === 0
          ? 'Sağ-sol simetri ön kontrolü yapılabilecek simetrik (eksenel/koronal) kesit bulunamadı; bu görüntüden gözlem üretilemedi.'
          : observations.length
            ? `Sağ-sol simetri ön kontrolü: ${r.compared} kesitte ${observations.length} görüntü asimetrisi gözlemi. Bu bir lezyon tespiti değildir.`
            : 'Sağ-sol simetri ön kontrolünde belirgin fark görülmedi. Bu sonuç görüntünün normal olduğunu göstermez.',
    };
  },
};
