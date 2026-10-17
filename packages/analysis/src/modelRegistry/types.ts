/**
 * Merkezi model araştırma kaydı: uygulamaya giren ya da girmeyen her tıbbi görüntü/sinyal modelinin gerçeklik
 * denetimi (kaynak, ağırlık, sürüm, özet, lisans, görev, çalışma ortamı, doğrulama, durum ve nedeni).
 *
 * Bu kayıt GELİŞTİRME sırasında yapılan araştırmanın sonucudur; uygulama çalışırken internete çıkıp kayıt
 * güncellemez ve hasta verisi hiçbir yere gönderilmez. Çıkarım her zaman cihazda, uygulamayla gelen ya da
 * kullanıcının elle kurduğu (SHA-256 doğrulanan) modelle yapılır.
 */

/**
 * - VERIFIED: ağırlık indirildi, SHA-256 kaydedildi, ONNX'e çevrildi (ya da resmi ONNX), resmi çıktıyla aynı
 *   girdide karşılaştırıldı ve uygulamaya bağlandı (gömülü ya da isteğe bağlı paket).
 * - AVAILABLE: resmi, sürümlü ağırlık yayımlanmış ve lisans kullanıma izin veriyor; bu ortamda henüz
 *   dönüştürülüp doğrulanmadı (neden: `failureReason`).
 * - PARTIALLY_AVAILABLE: yalnızca bir kısmı (ör. kapılı erişim, bazı alt modeller, yalnızca kodlayıcı) erişilebilir.
 * - CONVERSION_REQUIRED: ağırlık indirildi ama ONNX dönüşümü/doğrulaması henüz yapılmadı ya da özel işlem gerektiriyor.
 * - HEAVY_RUNTIME: çalışır ama telefonda/tarayıcıda bellek veya süre olarak kullanılamayacak kadar ağır.
 * - RESEARCH_ONLY: lisans ticari kullanıma ya da yeniden dağıtıma izin vermiyor; uygulamaya gömülmez.
 * - UNAVAILABLE: kontrol edilen kaynakların hiçbirinde yayımlanmış ağırlık bulunamadı.
 * - FAILED_VALIDATION: dönüştürüldü ve gerçek veride denendi; güvenilir sonuç vermedi.
 */
export type ResearchStatus = 'VERIFIED' | 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'CONVERSION_REQUIRED' | 'HEAVY_RUNTIME' | 'RESEARCH_ONLY' | 'UNAVAILABLE' | 'FAILED_VALIDATION';

export const RESEARCH_STATUSES: readonly ResearchStatus[] = ['VERIFIED', 'AVAILABLE', 'PARTIALLY_AVAILABLE', 'CONVERSION_REQUIRED', 'HEAVY_RUNTIME', 'RESEARCH_ONLY', 'UNAVAILABLE', 'FAILED_VALIDATION'];

export const RESEARCH_STATUS_TR: Record<ResearchStatus, string> = {
  VERIFIED: 'Doğrulandı',
  AVAILABLE: 'Ağırlık mevcut (henüz doğrulanmadı)',
  PARTIALLY_AVAILABLE: 'Kısmen erişilebilir',
  CONVERSION_REQUIRED: 'Dönüştürme gerekiyor',
  HEAVY_RUNTIME: 'Cihaz için çok ağır',
  RESEARCH_ONLY: 'Yalnızca araştırma lisansı',
  UNAVAILABLE: 'Ağırlık bulunamadı',
  FAILED_VALIDATION: 'Doğrulamadan geçemedi',
};

/** Modalite adaptör grupları (packages/analysis adaptörleri bu gruplara göre ayrışır). */
export type AdapterGroup = 'CT' | 'MRI' | 'XRAY' | 'ULTRASOUND' | 'ECHO' | 'ECG' | 'PATHOLOGY' | 'OCT' | 'FUNDUS' | 'ENDOSCOPY' | 'PET' | 'DEXA' | 'ANGIO' | 'DENTAL' | 'MAMMOGRAPHY';

export const ADAPTER_GROUPS: readonly AdapterGroup[] = ['CT', 'MRI', 'XRAY', 'ULTRASOUND', 'ECHO', 'ECG', 'PATHOLOGY', 'OCT', 'FUNDUS', 'ENDOSCOPY', 'PET', 'DEXA', 'ANGIO', 'DENTAL', 'MAMMOGRAPHY'];

export const ADAPTER_GROUP_TR: Record<AdapterGroup, string> = {
  CT: 'BT',
  MRI: 'MR',
  XRAY: 'Röntgen',
  ULTRASOUND: 'Ultrason / Doppler',
  ECHO: 'EKO',
  ECG: 'EKG',
  PATHOLOGY: 'Patoloji',
  OCT: 'OCT',
  FUNDUS: 'Fundus',
  ENDOSCOPY: 'Endoskopi / kolonoskopi',
  PET: 'PET / PET-BT',
  DEXA: 'DEXA',
  ANGIO: 'Anjiyografi / floroskopi',
  DENTAL: 'Diş / CBCT',
  MAMMOGRAPHY: 'Mamografi',
};

/** Evet / hayır / kaynakta belirtilmemiş. */
export type Tri = boolean | 'unknown';

export interface LicenseUse {
  /** Lisansın adı ve kapsamı (kod / ağırlık / eğitim verisi ayrı ayrı belirtilir). */
  license: string;
  commercial: Tri;
  research: boolean;
  redistribution: Tri;
  weightsRedistribution: Tri;
  attribution: boolean;
  note?: string;
}

export interface RuntimeFit {
  framework: string;
  onnxPossible: Tri;
  /** ONNX Runtime (Web/WASM) ile bu uygulamada çalıştırıldı. */
  onnxRuntime: boolean;
  web: boolean;
  android: boolean;
  cpu: boolean;
  gpu: boolean;
  memoryEstimate: string;
}

export interface Capabilities {
  classification: boolean;
  detection: boolean;
  segmentation: boolean;
  /**
   * Modelin GERÇEKTEN verdiği konum: sınıflandırıcı için her zaman 'none' (konum uydurulmaz);
   * 'prompt' = konumu kullanıcının verdiği kutu/nokta belirler (etkileşimli bölütleme).
   */
  localization: 'voxel' | 'pixel' | 'box' | 'prompt' | 'none';
  dims: '1D' | '2D' | '3D' | 'video';
  /** Gerçek voksel maskesi verdiği için kişisel 3B (hastanın kendi anatomisi) üretmeye uygun. */
  personal3D: boolean;
}

export interface ModelResearchRecord {
  id: string;
  name: string;
  family: string;
  officialRepository: string;
  /**
   * Resmi ağırlık adresi (şemasız, ör. github.com/…/model.zip; yalnızca gösterim ve geliştirme betikleri için —
   * uygulama bu adrese bağlanmaz); yoksa null.
   */
  weightsUrl: string | null;
  /** İndirilen dosyanın boyutu (bayt), ölçüldüyse. */
  weightsBytes?: number;
  version: string;
  /** 'sha256:<hex>' (bu araştırmada indirilip hesaplandı) ya da 'sha1:<hex>' (resmi katalogdaki). */
  checksum: string | null;
  modality: AdapterGroup[];
  inputFormat: string;
  outputFormat: string;
  task: string;
  capabilities: Capabilities;
  runtime: RuntimeFit;
  license: LicenseUse;
  status: ResearchStatus;
  verified: boolean;
  verificationDate: string | null;
  /** Ne yapıldı / ne ölçüldü (sayılarla). */
  evidence: string;
  /** VERIFIED değilse: neden (ve sonra nasıl eklenebilir). */
  failureReason?: string;
  /** Kontrol edilen kaynaklar (resmi depo, sürümler, model sayfası, katalog, Zenodo, makale eki…). */
  sourcesChecked: string[];
  /** Bu derleme ortamından erişimi engellenen alan adları (yalnız başına "eklenmeme" nedeni sayılmaz). */
  blockedHosts?: string[];
  distribution: 'bundled' | 'pack' | 'not-distributed';
  /** Uygulamadaki manifest kimliği (ai-models/<id> ya da isteğe bağlı paket). */
  manifestId?: string;
  /** Eski "eklenemeyen" envanterinden yeniden denetlenen kayıt. */
  recheck?: { previousEntry: string; previousStatus: 'UNAVAILABLE'; previousReason: string; date: string };
  /** Bu görev için kullanılan / önerilen alternatif modelin kimliği. */
  replacedBy?: string;
}
