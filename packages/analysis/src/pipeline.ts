/**
 * Ham görüntü analiz hattı — RAPOR GEREKMEZ.
 *
 *   Görüntü → kalite kontrolü → (tıbbi görüntü mü?) → modalite → anatomik bölge
 *          → modaliteye uygun adaptör → gözlemler (kaynak: IMAGE_ANALYSIS, güven, konum, model, sınırlar)
 *
 * Belge fotoğrafı (tahlil kâğıdı, rapor) ise görüntü analizine değil OCR yoluna yönlendirilir.
 * Adaptör yoksa ya da bir şey yapamıyorsa durum açıkça UNAVAILABLE olur; hiçbir bulgu uydurulmaz.
 */
import { type AdapterRegistry, defaultRegistry } from './adapters/registry';
import { type AnatomyEstimate, type ImageFeatures, type ModalityEstimate, classifyModality, estimateAnatomy, imageFeatures } from './modality';
import { type QualityReport, assessQuality } from './quality';
import { type AdapterResult, type ImageContext, MODALITY_LABEL, type RasterImage } from './types';

export interface ImageAnalysisRun {
  id: string;
  at: string;
  quality: QualityReport;
  features?: ImageFeatures;
  modality?: ModalityEstimate;
  anatomy?: AnatomyEstimate;
  /** image-analysis: görüntü adaptörü çalıştı; ocr-document: belge fotoğrafı, yazı OCR ile okunmalı. */
  route: 'image-analysis' | 'ocr-document' | 'rejected';
  result: AdapterResult;
  reportAvailable: boolean;
  /** Kullanıcıya gösterilecek açık durum cümleleri ("Rapor yok…"). */
  statements: string[];
}

export interface AnalyzeOptions {
  registry?: AdapterRegistry;
  /** Aynı çalışmaya ait bir rapor kasada var mı (rapor yine AYRI kaynak olarak işlenir). */
  reportAvailable?: boolean;
  now?: () => Date;
}

let seq = 0;

export function analyzeImage(image: RasterImage, ctx: ImageContext = {}, opts: AnalyzeOptions = {}): ImageAnalysisRun {
  const registry = opts.registry ?? defaultRegistry();
  const at = (opts.now?.() ?? new Date()).toISOString();
  const id = `run-${at}-${(seq++).toString(36)}`;
  const reportAvailable = Boolean(opts.reportAvailable);
  const reportLine = reportAvailable
    ? 'Rapor: var. Rapordaki bulgular ayrı kaynak (RAPOR) olarak gösterilir; görüntü gözlemleriyle karıştırılmaz.'
    : 'Rapor: yok. Aşağıdaki sonuçlar yalnızca görüntünün kendisine dayanıyor.';

  const quality = assessQuality(image);
  if (!quality.usable) {
    const generic = registry.forModality('UNKNOWN');
    return {
      id,
      at,
      quality,
      route: 'rejected',
      reportAvailable,
      result: { ...generic.analyze({ image, modality: 'UNKNOWN', context: ctx, quality, anatomy: { cues: [] } }), summary: quality.issues[0]!.message },
      statements: ['Görüntü: açıldı, ancak analiz için kullanılamaz.', reportLine],
    };
  }

  const features = imageFeatures(image);
  const modality = classifyModality(features, ctx);
  const m = modality.primary.modality;
  const anatomy = estimateAnatomy(features, m, ctx);
  const statements = [`Görüntü: var · tür tahmini ${MODALITY_LABEL[m]} (${modality.primary.source === 'IMAGE_ANALYSIS' ? 'görüntüden' : modality.primary.source === 'DICOM_METADATA' ? 'DICOM başlığından' : 'senin seçiminden / dosya adından'}).`, reportLine];
  if (modality.conflict) statements.push(modality.conflict);
  if (!modality.medical.value) statements.push(modality.medical.reason);

  if (m === 'DOCUMENT') {
    return {
      id,
      at,
      quality,
      features,
      modality,
      anatomy,
      route: 'ocr-document',
      reportAvailable,
      result: {
        adapterId: 'document-ocr',
        modality: 'DOCUMENT',
        status: 'UNAVAILABLE',
        model: { id: 'tesseract-ocr', name: 'Cihazda OCR (Tesseract, Türkçe)', version: '5', kind: 'learned', local: true },
        capabilities: [],
        observations: [],
        limitations: ['Belge fotoğrafında görüntü analizi yapılmaz; yazı OCR ile okunur ve her değer onaydan geçer.'],
        summary: 'Bu bir belge/rapor fotoğrafı: içerik OCR ile okunur (test adı, değer, birim, referans aralığı yapılandırılır).',
      },
      statements: [...statements, 'Yönlendirme: OCR (yazı okuma) → yapılandırılmış veri → onay.'],
    };
  }

  const adapter = registry.forModality(m);
  const result = { ...adapter.analyze({ image, modality: m, context: ctx, quality, anatomy, features }), modality: m };
  if (result.status === 'UNAVAILABLE') statements.push(`Otomatik görüntü yorumu: bu modalite (${MODALITY_LABEL[m]}) için bu kurulumda mevcut değil ya da bu görüntüde yapılamadı.`);
  else statements.push(`Otomatik görüntü analizi: KISMİ — ${result.capabilities.filter((c) => c.status === 'done').length} yetenek çalıştı, ${result.capabilities.filter((c) => c.status === 'not-implemented').length} yetenek bu kurulumda yok.`);
  if (!reportAvailable && result.observations.length) statements.push('Bu gözlemler bir radyolog raporu değildir; rapor olmadığı için doğrulanamadı.');
  return { id, at, quality, features, modality, anatomy, route: 'image-analysis', result, reportAvailable, statements };
}
