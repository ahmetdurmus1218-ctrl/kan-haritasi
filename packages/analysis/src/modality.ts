/**
 * Ham görüntüden modalite ve anatomik bölge TAHMİNİ (rapor gerekmez).
 *
 * Kaynaklar ayrı tutulur ve öncelik sırasıyla birleştirilir:
 *  1. DICOM başlığı (DICOM_METADATA) — cihazın yazdığı modalite, en güvenilir.
 *  2. Kullanıcının seçtiği belge türü / bölge (USER_INPUT).
 *  3. Görüntünün kendisi (IMAGE_ANALYSIS) — renk, doku, şekil, ızgara, kesit simetrisi ipuçları.
 *  4. Dosya adı (USER_INPUT, zayıf ipucu).
 *
 * Görüntü ipuçları kural tabanlıdır (öğrenilmiş model değil); güven en fazla 0,75 olarak verilir.
 * MR ile BT, fotoğraftan güvenilir biçimde ayırt edilemez ve bu açıkça yazılır.
 */
import { isGrayAfterCast, looksLikeDocumentImage, reviewImage } from '@kh/ingest';
import { ecgLikelihood } from './ecg';
import { downsample, downsampleRgba, hsv, percentile } from './image';
import { type AnatomicalLocation, type Confidence, type EvidenceSource, type ImageContext, type Modality, type RasterImage, score } from './types';

export interface ModalityCandidate {
  modality: Modality;
  confidence: Confidence;
  source: EvidenceSource;
  cues: string[];
}

export interface ImageFeatures {
  gray: boolean;
  colorfulness: number;
  darkFraction: number;
  brightFraction: number;
  document: boolean;
  ecgGrid: boolean;
  ecgStrength: number;
  /** Simetrik (eksenel/koronal) kesit sayısı ve baş benzerliği. */
  slicesCompared: number;
  slicePanels: number;
  headLike: boolean;
  /** Yelpaze (sektör) biçimi puanı (0–1). */
  sector: number;
  /** H&E boyası (pembe–mor) oranı. */
  stain: number;
  /** Kırmızı–turuncu mukoza/deri tonu oranı. */
  warm: number;
  /** Köşeler koyu, ortası aydınlık dairesel görüş alanı (endoskopi, fundus, dermoskopi). */
  circularField: number;
  aspect: number;
}

/** DICOM modalite kodu → modalite. */
export function dicomModality(code: string | undefined): Modality | undefined {
  switch ((code ?? '').toUpperCase()) {
    case 'MR':
      return 'MRI';
    case 'CT':
      return 'CT';
    case 'CR':
    case 'DX':
    case 'DR':
      return 'XRAY';
    case 'RF':
      return 'FLUOROSCOPY';
    case 'MG':
      return 'MAMMOGRAPHY';
    case 'US':
      return 'ULTRASOUND';
    case 'PT':
      return 'PET';
    case 'NM':
      return 'SPECT';
    case 'XA':
      return 'ANGIOGRAPHY';
    case 'OPT':
      return 'OCT';
    case 'BMD':
      return 'DEXA';
    case 'PX':
    case 'IO':
      return 'DENTAL';
    case 'ES':
      return 'ENDOSCOPY';
    case 'SM':
      return 'PATHOLOGY';
    case 'ECG':
      return 'ECG';
    case 'OP':
      return 'FUNDUS';
    case 'XC':
      return 'PHOTO';
    default:
      return undefined;
  }
}

/** Uygulamadaki belge türü (vault DocCategory) → modalite. */
export const CATEGORY_MODALITY: Record<string, Modality> = {
  mr: 'MRI',
  ct: 'CT',
  xray: 'XRAY',
  us: 'ULTRASOUND',
  mammo: 'MAMMOGRAPHY',
  pet: 'PET_CT',
  angio: 'ANGIOGRAPHY',
  dexa: 'DEXA',
  pathology: 'PATHOLOGY',
  endoscopy: 'ENDOSCOPY',
  ekg: 'ECG',
  lab: 'DOCUMENT',
};

/** Dosya adındaki ipuçları (normalize edilmiş, Türkçe/İngilizce). */
const NAME_HINTS: Array<[RegExp, Modality]> = [
  [/(^|[^a-z])(mri|mr|mrg|manyetik)([^a-z]|$)/, 'MRI'],
  [/(^|[^a-z])(ct|bt|tomografi|tomography)([^a-z]|$)/, 'CT'],
  [/(xray|x-ray|rontgen|grafi|radiograph)/, 'XRAY'],
  [/(ultrason|ultrasound|usg|sonografi|(^|[^a-z])us([^a-z]|$))/, 'ULTRASOUND'],
  [/doppler/, 'DOPPLER'],
  [/(mamografi|mammo)/, 'MAMMOGRAPHY'],
  [/(pet)/, 'PET_CT'],
  [/(ecg|ekg|elektrokardiyo)/, 'ECG'],
  [/(eko|echo)/, 'ECHOCARDIOGRAPHY'],
  [/(patoloji|pathology|biyopsi|biopsy|histo|slide)/, 'PATHOLOGY'],
  [/(mikroskop|microscop)/, 'MICROSCOPY'],
  [/(endoskop|gastroskop|endoscop)/, 'ENDOSCOPY'],
  [/(kolonoskop|colonoscop)/, 'COLONOSCOPY'],
  [/(dermo|derma|ben |nevus|skin)/, 'DERMOSCOPY'],
  [/(dental|dis |panoramik|panoramic)/, 'DENTAL'],
  [/(fundus|retina|gozdibi)/, 'FUNDUS'],
  [/(^|[^a-z])oct([^a-z]|$)/, 'OCT'],
  [/(dexa|dxa|kemik ?yogunlu)/, 'DEXA'],
  [/(anjiyo|angio)/, 'ANGIOGRAPHY'],
  [/(tahlil|lab|hemogram|biyokimya|kan )/, 'DOCUMENT'],
];

const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/[ç]/g, 'c')
    .replace(/[ğ]/g, 'g')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ş]/g, 's')
    .replace(/[ü]/g, 'u')
    .replace(/[_.-]+/g, ' ');

export function modalityFromName(name: string | undefined): Modality | undefined {
  if (!name) return undefined;
  const n = ` ${fold(name)} `;
  return NAME_HINTS.find(([re]) => re.test(n))?.[1];
}

/** Görüntünün ölçülebilir ipuçları. */
export function imageFeatures(image: RasterImage): ImageFeatures {
  const g = downsample(image.gray, image.width, image.height, 420);
  const lo = percentile(g.data, 0.01);
  const hi = percentile(g.data, 0.995);
  const k = hi > lo ? 255 / (hi - lo) : 1;
  let dark = 0;
  let bright = 0;
  for (const v of g.data) {
    const x = (v - lo) * k;
    if (x < 50) dark++;
    else if (x > 180) bright++;
  }
  const n = g.data.length;
  const features: ImageFeatures = {
    gray: true,
    colorfulness: 0,
    darkFraction: dark / n,
    brightFraction: bright / n,
    document: false,
    ecgGrid: false,
    ecgStrength: 0,
    slicesCompared: 0,
    slicePanels: 0,
    headLike: false,
    sector: 0,
    stain: 0,
    warm: 0,
    circularField: 0,
    aspect: image.width / image.height,
  };
  if (image.rgba) {
    const s = downsampleRgba(image.rgba, image.width, image.height, 420);
    features.gray = isGrayAfterCast(s.rgba);
    features.document = looksLikeDocumentImage(s.rgba);
    let colored = 0;
    let stain = 0;
    let warm = 0;
    const px = s.width * s.height;
    for (let p = 0; p < px; p++) {
      const [h, sat, val] = hsv(s.rgba[p * 4]!, s.rgba[p * 4 + 1]!, s.rgba[p * 4 + 2]!);
      if (sat > 0.25 && val > 0.2) {
        colored++;
        if ((h >= 270 || h <= 10) && val > 0.35) stain++;
        if (h > 0 && h <= 45 && val > 0.3) warm++;
      }
    }
    features.colorfulness = colored / px;
    // Renkli (boyalı doku, mukoza) görüntü yazılı belge sayılmaz.
    if (features.colorfulness > 0.15) features.document = false;
    features.stain = stain / px;
    features.warm = warm / px;
    const e = ecgLikelihood(image.rgba, image.width, image.height);
    features.ecgGrid = e.grid;
    features.ecgStrength = e.strength;
  }
  // Dairesel görüş alanı: köşeler koyu, merkez aydınlık.
  const cw = g.width;
  const ch = g.height;
  const corner = (x0: number, y0: number) => {
    const vals: number[] = [];
    const sz = Math.max(3, Math.round(Math.min(cw, ch) * 0.08));
    for (let y = y0; y < y0 + sz; y++) for (let x = x0; x < x0 + sz; x++) vals.push(((g.data[y * cw + x] ?? 0) - lo) * k);
    return percentile(vals, 0.5);
  };
  const sz = Math.max(3, Math.round(Math.min(cw, ch) * 0.08));
  const corners = [corner(0, 0), corner(cw - sz, 0), corner(0, ch - sz), corner(cw - sz, ch - sz)];
  const center: number[] = [];
  for (let y = Math.round(ch * 0.35); y < ch * 0.65; y++) for (let x = Math.round(cw * 0.35); x < cw * 0.65; x++) center.push((g.data[y * cw + x]! - lo) * k);
  const cMed = percentile(center, 0.5);
  features.circularField = Math.max(0, Math.min(1, (cMed - Math.max(...corners)) / 120));

  // Gri görüntüde: kesit simetrisi ve yelpaze biçimi.
  if (features.gray && !features.document) {
    const r = reviewImage(image.gray, image.width, image.height);
    features.slicesCompared = r.compared;
    features.slicePanels = r.panels.filter((p) => p.kind !== 'too-small').length;
    features.headLike = r.headLike;
    features.sector = sectorScore(g.data, cw, ch, lo, k);
  }
  return features;
}

/**
 * Yelpaze (ultrason sektörü) puanı: içerik genişliği üstten alta doğru düzenli artıyor, tepe noktası
 * üst-ortada, arka plan koyu. 0–1.
 */
export function sectorScore(data: Float32Array, w: number, h: number, lo: number, k: number): number {
  const widths: number[] = [];
  const centers: number[] = [];
  for (let y = 0; y < h; y++) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < w; x++)
      if ((data[y * w + x]! - lo) * k > 25) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    widths.push(x0 >= 0 ? x1 - x0 + 1 : 0);
    centers.push(x0 >= 0 ? (x0 + x1) / 2 : w / 2);
  }
  const rows = widths.map((v, y) => [y, v] as const).filter(([, v]) => v > w * 0.05);
  if (rows.length < h * 0.4) return 0;
  const top = rows[0]![0];
  const span = rows.slice(0, Math.max(3, Math.floor(rows.length * 0.6)));
  // İlk %60'lık bölümde genişlik derinlikle artmalı (doğrusal ilişki).
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const [y, v] of span) {
    sx += y;
    sy += v;
    sxx += y * y;
    sxy += y * v;
  }
  const m = span.length;
  const slope = (m * sxy - sx * sy) / Math.max(1e-6, m * sxx - sx * sx);
  const meanY = sy / m;
  let ssTot = 0;
  let ssRes = 0;
  const icpt = (sy - slope * sx) / m;
  for (const [y, v] of span) {
    ssTot += (v - meanY) ** 2;
    ssRes += (v - (icpt + slope * y)) ** 2;
  }
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  const topNarrow = widths[top]! < w * 0.35;
  const centered = Math.abs(centers[top]! - w / 2) < w * 0.15;
  if (slope <= 0.3 || !topNarrow || !centered) return 0;
  return Math.max(0, Math.min(1, r2));
}

/** Görüntü ipuçlarından aday modaliteler (yalnızca IMAGE_ANALYSIS kaynağı). */
export function imageModalityCandidates(f: ImageFeatures): ModalityCandidate[] {
  const out: ModalityCandidate[] = [];
  const add = (modality: Modality, value: number, cues: string[]) => out.push({ modality, confidence: score(Math.min(0.75, value), 'görüntü ipuçları (kural tabanlı)'), source: 'IMAGE_ANALYSIS', cues });
  if (f.ecgGrid && f.ecgStrength >= 0.2) add('ECG', 0.55 + f.ecgStrength * 0.4, ['milimetrik kâğıt ızgarası bulundu', `ızgara düzenliliği ${f.ecgStrength.toFixed(2)}`]);
  if (f.document && !f.ecgGrid) add('DOCUMENT', 0.7, ['açık zemin üzerinde koyu yazı satırları (belge/rapor kâğıdı)']);
  if (f.gray && f.slicesCompared > 0)
    add(f.headLike ? 'MRI' : 'CT', 0.45 + Math.min(0.2, f.slicesCompared * 0.05), [
      `${f.slicesCompared} simetrik kesit (eksenel/koronal) bulundu`,
      f.headLike ? 'kesit şekli baş kesitine benziyor' : 'gövde kesitine benziyor',
      'MR ile BT fotoğraftan güvenilir biçimde ayırt edilemez',
    ]);
  if (f.gray && f.slicesCompared > 0) add(f.headLike ? 'CT' : 'MRI', 0.35, ['kesitsel görüntü; MR/BT ayrımı belirsiz']);
  if (f.gray && f.sector > 0.75 && f.slicesCompared === 0) add('ULTRASOUND', 0.45 + f.sector * 0.25, ['yelpaze (sektör) biçimli görüntü alanı', 'koyu arka plan, derinlikle genişleyen içerik']);
  if (f.gray && !f.document && f.slicesCompared === 0 && f.sector <= 0.75 && f.darkFraction > 0.1) {
    if (f.aspect > 1.8) add('DENTAL', 0.3, ['gri tonlu, çok geniş (panoramik) görüntü']);
    add('XRAY', 0.3, ['gri tonlu tek görüntü; kesit ya da sektör yapısı yok']);
  }
  if (!f.gray && f.stain > 0.25 && f.brightFraction > 0.1) add('PATHOLOGY', 0.4 + Math.min(0.3, f.stain * 0.5), ['pembe–mor boyalı (H&E benzeri) doku', 'açık (cam) zemin']);
  if (!f.gray && f.warm > 0.3 && f.circularField > 0.4) {
    add('ENDOSCOPY', 0.35, ['kırmızı–pembe mukoza tonu', 'dairesel görüş alanı']);
    add('FUNDUS', 0.3, ['turuncu–kırmızı dairesel alan (göz dibi olabilir)']);
  }
  if (!f.gray && f.warm > 0.3 && f.circularField <= 0.4 && !f.document) add('DERMOSCOPY', 0.25, ['ten rengi baskın renkli fotoğraf']);
  if (!out.length) add(f.gray ? 'UNKNOWN' : 'PHOTO', 0.2, ['belirgin bir tıbbi görüntü ipucu bulunamadı']);
  return out.sort((a, b) => conf(b) - conf(a));
}

const conf = (c: ModalityCandidate) => (c.confidence.kind === 'score' ? c.confidence.value : 1);

export interface ModalityEstimate {
  primary: ModalityCandidate;
  candidates: ModalityCandidate[];
  /** Görüntünün tıbbi görüntü olup olmadığı (belge, EKG ya da görüntüleme). */
  medical: { value: boolean; confidence: Confidence; reason: string };
  /** Görüntü ipuçları bildirilen türle çelişiyorsa açıklama. */
  conflict?: string;
}

export function classifyModality(f: ImageFeatures, ctx: ImageContext = {}): ModalityEstimate {
  const fromImage = imageModalityCandidates(f);
  const candidates: ModalityCandidate[] = [];
  const dm = dicomModality(ctx.dicom?.modality);
  if (dm) candidates.push({ modality: dm, confidence: score(0.95, 'DICOM başlığındaki modalite kodu'), source: 'DICOM_METADATA', cues: [`DICOM Modality = ${ctx.dicom?.modality}`] });
  const declared = ctx.declaredCategory ? CATEGORY_MODALITY[ctx.declaredCategory] : undefined;
  if (declared) candidates.push({ modality: declared, confidence: score(0.8, 'kullanıcının seçtiği belge türü'), source: 'USER_INPUT', cues: ['yüklerken seçilen belge türü'] });
  const named = modalityFromName(ctx.fileName);
  if (named) candidates.push({ modality: named, confidence: score(0.5, 'dosya adındaki ipucu'), source: 'USER_INPUT', cues: [`dosya adı: ${ctx.fileName}`] });
  candidates.push(...fromImage);
  const primary = candidates[0]!;
  const top = fromImage[0];
  let conflict: string | undefined;
  if (top && (dm || declared) && top.modality !== primary.modality && conf(top) >= 0.5 && !(isCross(top.modality) && isCross(primary.modality)))
    conflict = `Görüntü ipuçları "${top.modality}" gösteriyor, ancak ${dm ? 'DICOM başlığı' : 'seçilen belge türü'} "${primary.modality}". Belge türünü kontrol et.`;
  const medicalImage = fromImage.some((c) => c.modality !== 'UNKNOWN' && c.modality !== 'PHOTO');
  return {
    primary,
    candidates,
    medical: {
      value: Boolean(dm) || medicalImage,
      confidence: dm ? score(0.95, 'DICOM dosyası') : score(medicalImage ? conf(fromImage[0]!) : 0.3, 'görüntü ipuçları'),
      reason: dm ? 'DICOM tıbbi görüntü dosyası.' : medicalImage ? `Görüntü ${fromImage[0]!.cues[0]} içeriyor.` : 'Görüntüde tıbbi görüntü ya da belge ipucu bulunamadı (sıradan fotoğraf olabilir).',
    },
    ...(conflict ? { conflict } : {}),
  };
}

const isCross = (m: Modality) => m === 'MRI' || m === 'CT' || m === 'PET' || m === 'PET_CT';

/* ---------------------------------------------------------------- anatomik bölge tahmini */

const NAME_REGION: Array<[RegExp, string]> = [
  [/(beyin|brain|kranial|cranial|head|kafa)/, 'brain'],
  [/(pankreas|pancreas)/, 'pancreas'],
  [/(karaciger|liver|hepat)/, 'liver'],
  [/(bobrek|kidney|renal)/, 'kidneys'],
  [/(tiroid|thyroid)/, 'thyroid'],
  [/(akciger|lung|chest|toraks|thorax|gogus)/, 'lungs'],
  [/(kalp|heart|cardiac|kardiyak)/, 'heart'],
  [/(meme|breast)/, 'breasts'],
  [/(diz|knee)/, 'knee'],
  [/(lomber|servikal|torakal|spine|omurga)/, 'spinal-cord'],
  [/(dalak|spleen)/, 'spleen'],
  [/(prostat|prostate)/, 'prostate'],
];

export function regionFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const n = fold(name);
  return NAME_REGION.find(([re]) => re.test(n))?.[1];
}

/** Modalitenin doğası gereği bölge (ör. EKG → kalp). */
const MODALITY_REGION: Partial<Record<Modality, string>> = { ECG: 'heart', ECHOCARDIOGRAPHY: 'heart', MAMMOGRAPHY: 'breasts', FUNDUS: 'eyes', COLONOSCOPY: 'large-intestine', ENDOSCOPY: 'stomach', DERMOSCOPY: 'skin', DENTAL: 'bones', OCT: 'eyes', DEXA: 'bones' };

export interface AnatomyEstimate {
  structure?: string;
  location?: AnatomicalLocation;
  source?: EvidenceSource;
  cues: string[];
}

export function estimateAnatomy(f: ImageFeatures, modality: Modality, ctx: ImageContext = {}): AnatomyEstimate {
  if (ctx.declaredRegion && ctx.declaredStructure)
    return { structure: ctx.declaredStructure, source: 'USER_INPUT', cues: ['kullanıcının seçtiği bölge'], location: { path: [ctx.declaredStructure], structure: ctx.declaredStructure, basis: 'user', confidence: score(0.85, 'kullanıcının seçtiği bölge') } };
  const body = ctx.dicom?.bodyPart ? regionFromName(ctx.dicom.bodyPart) : undefined;
  if (body) return { structure: body, source: 'DICOM_METADATA', cues: [`DICOM BodyPartExamined = ${ctx.dicom?.bodyPart}`], location: { path: [body], structure: body, basis: 'region', confidence: score(0.85, 'DICOM başlığı') } };
  const byModality = MODALITY_REGION[modality];
  if (byModality) return { structure: byModality, source: 'KNOWLEDGE', cues: [`${modality} bu organı inceler`], location: { path: [byModality], structure: byModality, basis: 'knowledge', confidence: score(0.7, 'modalitenin doğası') } };
  if (f.headLike && (modality === 'MRI' || modality === 'CT'))
    return { structure: 'brain', source: 'IMAGE_ANALYSIS', cues: ['kesitlerin dış şekli baş kesitine benziyor (oval, simetrik)'], location: { path: ['brain'], structure: 'brain', basis: 'pixel-mapped', confidence: score(0.6, 'kesit şekli') } };
  const byName = regionFromName(ctx.fileName);
  if (byName) return { structure: byName, source: 'USER_INPUT', cues: [`dosya adı: ${ctx.fileName}`], location: { path: [byName], structure: byName, basis: 'user', confidence: score(0.45, 'dosya adındaki ipucu') } };
  return { cues: ['görüntüden anatomik bölge belirlenemedi'] };
}
