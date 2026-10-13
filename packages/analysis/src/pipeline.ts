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
import { type AdapterResult, type ImageContext, type MedicalFinding, type Modality, MODALITY_LABEL, type ModelStructure, type RasterImage } from './types';

/**
 * İnceleme kapsamı: tek bir fotoğraf (birkaç kesit) ile yüzlerce kesitlik DICOM serisi aynı şey
 * değildir. Fotoğrafta "tüm çalışma değerlendirildi" izlenimi verilmez.
 */
export interface StudyCoverage {
  kind: 'photo' | 'dicom-series' | 'dicom-single';
  /** Görüntüde ayırt edilen ya da seride bulunan kesit sayısı. */
  frames: number;
  /** Kısa etiket: "2 görüntü (fotoğraf)", "DICOM seri · 180 kesit". */
  label: string;
  /** Sınırlı kapsam uyarısı (yoksa undefined). */
  limited?: string;
}

/** MR sekansı: yalnızca DICOM başlığından (ya da gerçek bir modelden) okunur; dosya adından ya da fotoğraftan ASLA. */
export interface SequenceInfo {
  value?: string;
  source: 'DICOM_METADATA' | 'none';
  text: string;
}

const SEQ: Array<[RegExp, string]> = [
  [/\bflair\b/i, 'FLAIR'],
  [/\b(dwi|diff|difuzyon|trace)\b/i, 'DWI'],
  [/\badc\b/i, 'ADC'],
  [/\b(swi|swan|susc)/i, 'SWI'],
  [/\bstir\b/i, 'STIR'],
  [/\bpd\b/i, 'PD'],
  [/\bt2\b|t2[_\s-]?w|\bt2\*/i, 'T2'],
  [/\bt1\b|t1[_\s-]?w|mprage|spgr|\bvibe\b/i, 'T1'],
];
const CONTRAST = /(\+c\b|\bpost\b|\bgad|kontrast|contrast|\bce\b)/i;

export function sequenceFrom(ctx: ImageContext, modality: Modality): SequenceInfo {
  if (modality !== 'MRI') return { source: 'none', text: 'Sekans bilgisi yalnızca MR için geçerli.' };
  const desc = [ctx.dicom?.seriesDescription, ctx.dicom?.studyDescription].filter(Boolean).join(' ');
  if (!ctx.dicom) return { source: 'none', text: 'Sekans belirlenemedi: fotoğrafta sekans bilgisi yok ve görüntüden sekans tanıyan bir model bu kurulumda yok.' };
  const found = SEQ.filter(([re]) => re.test(desc)).map(([, v]) => v);
  if (!found.length) return { source: 'none', text: 'Sekans belirlenemedi: DICOM başlığında sekans adı yok.' };
  const value = `${found[0]}${CONTRAST.test(desc) ? ' (kontrastlı)' : ''}`;
  return { value, source: 'DICOM_METADATA', text: `MR sekansı: ${value} (DICOM başlığından: “${desc.trim().slice(0, 60)}”)` };
}

const SECTIONAL: ReadonlySet<string> = new Set(['MRI', 'CT', 'PET', 'PET_CT', 'SPECT']);

/**
 * İnceleme kapsamı. "Kapsam sınırlı / N kesit" uyarısı yalnızca kesitsel incelemeler (MR, BT, PET) içindir;
 * tek bir röntgen, EKG ya da patoloji görüntüsü zaten incelemenin kendisidir.
 */
export function coverageOf(ctx: ImageContext, frames: number | undefined, modality?: Modality): StudyCoverage {
  const c = coverageRaw(ctx, frames);
  if (modality && !SECTIONAL.has(modality)) {
    const { limited: _l, ...rest } = c;
    return rest;
  }
  return c;
}

function coverageRaw(ctx: ImageContext, frames: number | undefined): StudyCoverage {
  if (ctx.dicom) {
    const n = Math.max(ctx.dicom.frames ?? 1, ctx.files ?? 1);
    return n > 1
      ? { kind: 'dicom-series', frames: n, label: `DICOM seri · ${n} kesit`, ...(n < 20 ? { limited: `Seride ${n} kesit var; tüm çalışmanın değerlendirildiği söylenemez.` } : {}) }
      : { kind: 'dicom-single', frames: 1, label: 'Tek DICOM kesiti', limited: 'Görüntü kapsamı sınırlı: yalnızca 1 kesit mevcut.' };
  }
  const n = Math.max(1, frames ?? 1);
  return {
    kind: 'photo',
    frames: n,
    label: `${n} görüntü (fotoğraf)`,
    limited: `Görüntü kapsamı sınırlı: ${n} kesit mevcut. Bu yükleme yalnızca mevcut görüntüleri içeriyor; tüm inceleme değerlendirilmiş sayılmaz.`,
  };
}

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
  /**
   * precheck: yalnızca kural tabanlı ön kontrol çalıştı (bugün her zaman); model: gerçek bir tıbbi
   * görüntü modeli çalıştı. Arayüz "Analiz tamamlandı" yerine "Görüntü ön incelemesi tamamlandı" der.
   */
  kind: 'precheck' | 'model';
  /** Yerel tıbbi model çalıştıysa bulguları (kaynak IMAGE_MODEL, model-derived). Ön kontrol asla buraya yazmaz. */
  modelFindings?: MedicalFinding[];
  /** Yerel modelin bölütlediği anatomik yapılar (bulgu değil; organı "dikkat" durumuna geçirmez). */
  modelStructures?: ModelStructure[];
  modelInfo?: { id: string; name: string; version: string; sha256?: string; license?: string; at: string };
  coverage: StudyCoverage;
  sequence: SequenceInfo;
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
      kind: 'precheck',
      coverage: coverageOf(ctx, 1),
      sequence: { source: 'none', text: 'Sekans belirlenemedi.' },
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
      kind: 'precheck',
      coverage: coverageOf(ctx, 1),
      sequence: { source: 'none', text: 'Belge fotoğrafı.' },
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
  // Uyarlayıcılar kural tabanlıdır: "model" durumu YALNIZCA gerçek bir yerel model çalıştığında
  // (runMedicalImageModel → modelFindings) verilir; burada asla.
  const kind = 'precheck' as const;
  if (result.status === 'UNAVAILABLE') statements.push(`Otomatik görüntü yorumu: bu modalite (${MODALITY_LABEL[m]}) için bu kurulumda mevcut değil ya da bu görüntüde yapılamadı.`);
  else statements.push(`Görüntü ön incelemesi: ${result.capabilities.filter((c) => c.status === 'done').length} kural tabanlı kontrol çalıştı; ${result.capabilities.filter((c) => c.status === 'not-implemented').length} yetenek tıbbi görüntü modeli gerektirdiği için bu kurulumda yok.`);
  if (!reportAvailable && result.observations.length) statements.push('Bu gözlemler bir radyolog raporu değildir; rapor olmadığı için doğrulanamadı.');
  return { id, at, quality, features, modality, anatomy, route: 'image-analysis', result, kind, coverage: coverageOf(ctx, result.frames, m), sequence: sequenceFrom(ctx, m), reportAvailable, statements };
}
