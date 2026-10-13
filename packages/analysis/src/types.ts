/**
 * Çok kipli (multimodal) analiz çekirdeğinin ortak tipleri.
 *
 * Temel kural: her gözlem ve bulgu KAYNAĞINI taşır. Görüntünün kendisinden çıkarılan gözlem
 * (IMAGE_ANALYSIS) ile rapordan okunan bulgu (RADIOLOGY_REPORT) asla aynı şey gibi saklanmaz ya da
 * gösterilmez. Rapor yoksa sistem durmaz; ham veriden ne çıkarılabiliyorsa onu, ne çıkarılamıyorsa
 * onu açıkça söyler.
 */

/** Bilginin nereden geldiği. Bir kaynaktan gelen bilgi başka bir kaynaktanmış gibi gösterilmez. */
export type EvidenceSource =
  /** Ham görüntünün piksellerinden, cihazda çalışan bir algoritmayla. */
  | 'IMAGE_ANALYSIS'
  /** DICOM başlığındaki (cihazın yazdığı) bilgiler: modalite, bölge, piksel aralığı… */
  | 'DICOM_METADATA'
  /** Radyoloji / patoloji / EKG raporunda yazan ifade. */
  | 'RADIOLOGY_REPORT'
  /** Görüntüdeki yazının OCR ile okunması (rapor kâğıdı fotoğrafı, ekran görüntüsü). */
  | 'OCR'
  /** Onaylanmış laboratuvar sonucu. */
  | 'LAB'
  /** Kullanıcının seçtiği/girdiği bilgi (bölge seçimi, elle ölçüm, dosya adı). */
  | 'USER_INPUT'
  /** Başka verilerden kural/hesapla türetilen (örüntü, eğilim, karşılaştırma). */
  | 'DERIVED'
  /** Genel anatomi/fizyoloji bilgisi (kişiye özel değil). */
  | 'KNOWLEDGE';

export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  IMAGE_ANALYSIS: 'Görüntü analizi (cihazda)',
  DICOM_METADATA: 'DICOM başlığı',
  RADIOLOGY_REPORT: 'Rapor',
  OCR: 'Görüntüden okunan yazı (OCR)',
  LAB: 'Laboratuvar sonucu',
  USER_INPUT: 'Senin girdiğin bilgi',
  DERIVED: 'Türetilmiş (kural / hesap)',
  KNOWLEDGE: 'Genel anatomi-fizyoloji bilgisi',
};

/**
 * Güven: "Algoritma/model bu GÖZLEMİ ne kadar güvenilir buluyor?" Hastalık olasılığı DEĞİLDİR.
 * `reported`: rapor ya da laboratuvar bunu yazıyor (sistem bir güven puanı üretmiyor).
 */
export type Confidence =
  | { kind: 'score'; value: number; basis: string }
  | { kind: 'reported' }
  | { kind: 'measured'; basis: string };

export function score(value: number, basis: string): Confidence {
  if (!Number.isFinite(value)) throw new RangeError('confidence must be finite');
  return { kind: 'score', value: Math.round(Math.min(1, Math.max(0, value)) * 100) / 100, basis };
}

export const REPORTED: Confidence = { kind: 'reported' };

/** Görüntü modaliteleri: mimaride hepsi var; hangisinin gerçekten analiz edildiği adaptörde yazar. */
export type Modality =
  | 'MRI'
  | 'CT'
  | 'XRAY'
  | 'ULTRASOUND'
  | 'DOPPLER'
  | 'MAMMOGRAPHY'
  | 'PET'
  | 'PET_CT'
  | 'SPECT'
  | 'FLUOROSCOPY'
  | 'ECHOCARDIOGRAPHY'
  | 'ENDOSCOPY'
  | 'COLONOSCOPY'
  | 'DERMOSCOPY'
  | 'DENTAL'
  | 'FUNDUS'
  | 'PATHOLOGY'
  | 'MICROSCOPY'
  | 'ECG'
  | 'DOCUMENT'
  | 'PHOTO'
  | 'UNKNOWN';

export const MODALITY_LABEL: Record<Modality, string> = {
  MRI: 'MR',
  CT: 'BT (tomografi)',
  XRAY: 'Röntgen',
  ULTRASOUND: 'Ultrason',
  DOPPLER: 'Doppler ultrason',
  MAMMOGRAPHY: 'Mamografi',
  PET: 'PET',
  PET_CT: 'PET/BT',
  SPECT: 'SPECT',
  FLUOROSCOPY: 'Floroskopi',
  ECHOCARDIOGRAPHY: 'Ekokardiyografi (EKO)',
  ENDOSCOPY: 'Endoskopi',
  COLONOSCOPY: 'Kolonoskopi',
  DERMOSCOPY: 'Dermatolojik görüntü',
  DENTAL: 'Diş görüntüsü',
  FUNDUS: 'Göz dibi (fundus)',
  PATHOLOGY: 'Patoloji kesiti',
  MICROSCOPY: 'Mikroskopi',
  ECG: 'EKG',
  DOCUMENT: 'Belge / rapor kâğıdı',
  PHOTO: 'Fotoğraf',
  UNKNOWN: 'Belirlenemedi',
};

/** Görüntü üzerinde gerçek konum (yalnızca piksel tabanlı bir algoritma verdiyse). */
export interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Konum türü. Rapordaki "sol frontal" ifadesi ASLA piksel konumu gibi gösterilmez:
 *  - pixel: algoritma görüntü üzerinde kutu/maske verdi.
 *  - report-approximate: rapor/metin tabanlı yaklaşık anatomik konum.
 *  - image-approximate: görüntüdeki kutunun anatomik karşılığı varsayımla tahmin edildi.
 *  - region-only: yalnızca belgenin bölgesi biliniyor.
 */
export type Localization =
  | { kind: 'pixel'; frame: number; box: PixelBox; imageSize: { width: number; height: number } }
  | { kind: 'report-approximate'; text: string }
  | { kind: 'region-only' }
  | { kind: 'none' };

export type Side = 'left' | 'right' | 'both';

/** Anatomik konum: bilgi grafiğindeki düğümler (genelden özele) + 3B modeldeki karşılığı. */
export interface AnatomicalLocation {
  /** Bilgi grafiği yolu, ör. ['brain', 'brain.hemisphere-right', 'brain.frontal']. */
  path: string[];
  /** 3B modeldeki yapı (catalog STRUCTURES) ve bölüm (catalog PARTS). */
  structure?: string;
  part?: string;
  /** Hastanın sağı/solu. */
  side?: Side;
  /** Konum nasıl belirlendi; arayüzde "yaklaşık" etiketi buna göre. */
  basis: 'pixel-mapped' | 'report-text' | 'region' | 'user' | 'knowledge';
  /** Aynı anda olası birden çok yapı (ör. kesit düzeyi bilinmediğinde temporal / parietal). */
  alternatives?: string[];
  confidence: Confidence;
  note?: string;
}

/** Bir modelin/algoritmanın adı ve sürümü: her otomatik çıkarım bunu taşır. */
export interface ModelVersion {
  id: string;
  name: string;
  version: string;
  /** Kural/sinyal işleme mi, öğrenilmiş model mi? (Şu an hiçbir öğrenilmiş model paketlenmiyor.) */
  kind: 'heuristic' | 'learned';
  /** Cihazda mı çalışıyor? Harici servis ise kullanıcıya önceden söylenmeli. */
  local: boolean;
}

/** Görüntünün kendisinden çıkarılan gözlem (rapor bulgusu DEĞİL). */
export interface ImageObservation {
  id: string;
  source: 'IMAGE_ANALYSIS';
  /** Ne tür bir gözlem. */
  kind:
    | 'asymmetry'
    | 'rhythm'
    | 'interval'
    | 'heart-rate'
    | 'tissue-feature'
    | 'sector-geometry'
    | 'quality'
    | 'structure-presence';
  /** Sade dille tek cümle. */
  text: string;
  location?: AnatomicalLocation;
  localization: Localization;
  confidence: Confidence;
  model: ModelVersion;
  /** Ölçülen değer (varsa). */
  measurement?: { name: string; value: number; unit: string; method: string };
  /** Bu gözlemin sınırları. */
  limitations: string[];
  /** Arka plandaki sayısal ipuçları (açıklanabilirlik). */
  cues?: Record<string, number | string | boolean>;
}

export type ReportStatus = 'abnormal' | 'uncertain' | 'normal';

/** Rapordan okunan bulgu (raporun kendisi bir kaynak; sistem bunu üretmedi). */
export interface ReportFinding {
  id: string;
  source: 'RADIOLOGY_REPORT' | 'OCR';
  text: string;
  status: ReportStatus;
  /** "İzlenmedi" gibi olumsuzlanmış ifade: bulgu YOK diye kaydedilir. */
  negated: boolean;
  location?: AnatomicalLocation;
  localization: Extract<Localization, { kind: 'report-approximate' | 'region-only' | 'none' }>;
  severity?: 'mild' | 'moderate' | 'severe';
  temporal?: 'new' | 'stable' | 'increased' | 'decreased' | 'resolved';
  recommendation?: boolean;
  size?: string;
  confidence: Confidence;
  date?: string;
  documentId?: string;
}

/** Onaylanmış laboratuvar sonucu (analiz çekirdeğinin girdisi). */
export interface LabObservation {
  testKey: string;
  name: string;
  value: number;
  unit: string;
  status: 'low' | 'normal' | 'high' | 'unknown';
  refMin?: number;
  refMax?: number;
  /** Referans aralığı nereden geldi (öncelik: rapor > laboratuvar > demografik > sistem). */
  refSource?: ReferenceSource;
  date: string;
  source: 'LAB';
  confidence: Confidence;
  /** Laboratuvar kritik değer listelerine göre acil değerlendirme gerektirebilecek düzey. */
  critical?: boolean;
  /** Sapma derecesi (referans sınırına göre): hafif sapma "takip", belirgin sapma "dikkat" olarak gösterilir. */
  severity?: 'normal' | 'borderline' | 'mild' | 'moderate' | 'marked' | 'unknown';
}

export type ReferenceSource = 'report' | 'laboratory' | 'demographic' | 'system';

/** Bir adaptörün bir yeteneği: gerçekten uygulanmış mı, bu çalıştırmada çalıştı mı? */
export interface Capability {
  key: string;
  label: string;
  implemented: boolean;
  /** Bu çalıştırmada: yapıldı / yapılamadı / uygulanmadı. */
  status: 'done' | 'not-possible' | 'not-implemented';
  detail?: string;
}

/** Genel görüntü analiz durumu: arayüz "IMAGE_ANALYSIS_STATUS" olarak gösterir. */
export type AnalysisStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';

export interface AdapterResult {
  adapterId: string;
  modality: Modality;
  status: AnalysisStatus;
  model: ModelVersion;
  capabilities: Capability[];
  observations: ImageObservation[];
  limitations: string[];
  /** Kullanıcıya gösterilecek tek cümle (ör. "Bu modalite için otomatik yorum bu kurulumda yok."). */
  summary: string;
}

/** Ham görüntü: gri ton (zorunlu) + renkli (varsa). */
export interface RasterImage {
  width: number;
  height: number;
  /** Gri ton, herhangi bir aralıkta (fotoğraf 0–255, DICOM HU olabilir). */
  gray: Float32Array;
  /** RGBA (fotoğraflarda); DICOM'da yok. */
  rgba?: Uint8ClampedArray;
}

/** Görüntünün yanında bilinen bağlam (rapor DEĞİL): kullanıcının seçimi, dosya adı, DICOM başlığı. */
export interface ImageContext {
  fileName?: string;
  /** Kullanıcının seçtiği belge türü (vault DocCategory). */
  declaredCategory?: string;
  /** Kullanıcının seçtiği bölge anahtarı (ör. "beyin"). */
  declaredRegion?: string;
  /** Seçilen bölgenin 3B yapısı (ör. "beyin" → "brain"). */
  declaredStructure?: string;
  dicom?: { modality?: string; bodyPart?: string; pixelSpacing?: [number, number]; sliceThickness?: number };
}
