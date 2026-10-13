/**
 * Gerçek tıbbi görüntü modelleri için sağlayıcı mimarisi.
 *
 *   Görüntü → MedicalImageAIProvider → gerçek tıbbi görüntü modeli → bulgu (MedicalFinding)
 *          → konum (piksel/voksel) → anatomi (bilgi grafiği) → fizyoloji
 *
 * BUGÜN BU DEPODA GERÇEK BİR TIBBİ GÖRÜNTÜ MODELİ YOKTUR. Her modalite için kayıtlı sağlayıcı
 * `UnavailableImageProvider`'dır: tüm yöntemleri `status: 'unavailable'` ve nedenini döndürür. Kural
 * tabanlı sağ-sol simetri ön kontrolü (adapters/crossSectional) bir sağlayıcı DEĞİLDİR ve buradan
 * bulgu üretmez.
 *
 * Gerçek bir model eklemek: kullanıcı cihazına ONNX modeli + manifest kurar (localModel.ts,
 * `LocalModelProvider`) ve `MedicalImageProviderRegistry.register()` ile kaydedilir. `runMedicalImageModel` sağlayıcının
 * bulgularını kaynağı "IMAGE_MODEL" (model-derived) olarak kaydeder, konumunu anatomiye bağlar.
 * Veriyi cihaz dışına gönderen (`sendsDataOffDevice`) sağlayıcı kaydedilmez ve çalıştırılmaz — onayla bile.
 */
import { GRAPH } from './knowledge';
import type { AnatomicalLocation, Confidence, ImageContext, Localization, MedicalFinding, Modality, ModelVersion, RasterImage } from './types';

/** Modelin dosya düzeyindeki kimliği (yerel modellerde manifestten). */
export type ModelIdentity = ModelVersion & { sha256?: string; license?: string };

/** Sağlayıcının bir çıktısı: her sonuç kaynağını, modelini, güvenini ve sınırlarını taşır. */
export type ProviderOutput<T> =
  | { status: 'ok'; value: T; source: 'IMAGE_MODEL'; model: ModelVersion; confidence: Confidence; limitations: string[] }
  | { status: 'unavailable'; reason: string };

export type MRSequence = 'T1' | 'T2' | 'FLAIR' | 'DWI' | 'ADC' | 'SWI' | 'STIR' | 'PD' | 'T1+C';

export interface StudyInput {
  images: RasterImage[];
  modality: Modality;
  context: ImageContext;
}

export interface DetectedStructure {
  /** Bilgi grafiği düğümü ya da 3B yapı kimliği. */
  structure: string;
  localization: Localization;
  confidence: Confidence;
}

export interface StructureMeasurement {
  structure: string;
  name: string;
  value: number;
  unit: string;
  confidence: Confidence;
}

export interface ModelComparison {
  change: 'new' | 'resolved' | 'growing' | 'shrinking' | 'stable';
  finding: string;
  confidence: Confidence;
}

/** Modelin bir bulgu adayı (henüz anatomiye bağlanmamış). */
export interface ModelFinding {
  finding: string;
  localization: Localization;
  confidence: Confidence;
  /** Model bir anatomik yapı adı verdiyse (bilgi grafiği düğümü ya da 3B yapı kimliği). */
  structure?: string;
  limitations?: string[];
}

export interface StudyAnalysis {
  findings: ModelFinding[];
  structures: DetectedStructure[];
  measurements: StructureMeasurement[];
}

export interface MedicalImageAIProvider {
  id: string;
  label: string;
  modalities: readonly Modality[];
  /** Veri cihaz dışına gidiyor mu? Her zaman false olmalı; true olan sağlayıcı reddedilir. */
  sendsDataOffDevice: boolean;
  /** Yapılandırılmış ve kullanılabilir mi? */
  available(): boolean;
  analyzeStudy(input: StudyInput): Promise<ProviderOutput<StudyAnalysis>>;
  classifyModality(image: RasterImage, ctx: ImageContext): Promise<ProviderOutput<Modality>>;
  classifySequence(image: RasterImage, ctx: ImageContext): Promise<ProviderOutput<MRSequence>>;
  detectStructures(input: StudyInput): Promise<ProviderOutput<DetectedStructure[]>>;
  segmentStructures(input: StudyInput, structures: string[]): Promise<ProviderOutput<Array<{ structure: string; mask: Uint8Array; width: number; height: number }>>>;
  detectFindings(input: StudyInput): Promise<ProviderOutput<ModelFinding[]>>;
  localizeFindings(input: StudyInput, findings: ModelFinding[]): Promise<ProviderOutput<ModelFinding[]>>;
  measureStructures(input: StudyInput, structures: string[]): Promise<ProviderOutput<StructureMeasurement[]>>;
  compareStudies(previous: StudyInput, current: StudyInput): Promise<ProviderOutput<ModelComparison[]>>;
}

export type ProviderGroup = 'mri' | 'ct' | 'xray' | 'ultrasound' | 'mammography' | 'pathology' | 'ecg' | 'endoscopy';

export const GROUP_MODALITIES: Record<ProviderGroup, readonly Modality[]> = {
  mri: ['MRI'],
  ct: ['CT', 'PET_CT'],
  xray: ['XRAY', 'FLUOROSCOPY'],
  ultrasound: ['ULTRASOUND', 'DOPPLER', 'ECHOCARDIOGRAPHY'],
  mammography: ['MAMMOGRAPHY'],
  pathology: ['PATHOLOGY', 'MICROSCOPY'],
  ecg: ['ECG'],
  endoscopy: ['ENDOSCOPY', 'COLONOSCOPY'],
};

const GROUP_LABEL: Record<ProviderGroup, string> = {
  mri: 'MR analiz modeli (lezyon, beyin segmentasyonu, sekans)',
  ct: 'BT analiz modeli (lezyon, organ segmentasyonu)',
  xray: 'Röntgen analiz modeli',
  ultrasound: 'Ultrason organ / bulgu modeli',
  mammography: 'Mamografi modeli',
  pathology: 'Patoloji morfoloji modeli',
  ecg: 'EKG yorum modeli',
  endoscopy: 'Endoskopi modeli',
};

/** Gerçek modeli olmayan modalite grubu: her yöntem dürüstçe "yok" der, hiçbir şey uydurmaz. */
export class UnavailableImageProvider implements MedicalImageAIProvider {
  readonly sendsDataOffDevice = false;
  readonly modalities: readonly Modality[];
  readonly label: string;
  constructor(
    readonly id: string,
    group: ProviderGroup,
    private readonly reason = 'Bu kurulumda tıbbi görüntü modeli yok.',
  ) {
    this.modalities = GROUP_MODALITIES[group];
    this.label = GROUP_LABEL[group];
  }
  available() {
    return false;
  }
  private none<T>(): Promise<ProviderOutput<T>> {
    return Promise.resolve({ status: 'unavailable', reason: this.reason });
  }
  analyzeStudy() {
    return this.none<StudyAnalysis>();
  }
  classifyModality() {
    return this.none<Modality>();
  }
  classifySequence() {
    return this.none<MRSequence>();
  }
  detectStructures() {
    return this.none<DetectedStructure[]>();
  }
  segmentStructures() {
    return this.none<Array<{ structure: string; mask: Uint8Array; width: number; height: number }>>();
  }
  detectFindings() {
    return this.none<ModelFinding[]>();
  }
  localizeFindings() {
    return this.none<ModelFinding[]>();
  }
  measureStructures() {
    return this.none<StructureMeasurement[]>();
  }
  compareStudies() {
    return this.none<ModelComparison[]>();
  }
}

/** Modalite grubu başına sağlayıcı türleri (hepsi aynı arayüz; gerçek model eklenince yerine geçer). */
export type MRIAnalysisProvider = MedicalImageAIProvider;
export type CTAnalysisProvider = MedicalImageAIProvider;
export type XRayAnalysisProvider = MedicalImageAIProvider;
export type UltrasoundAnalysisProvider = MedicalImageAIProvider;
export type MammographyAnalysisProvider = MedicalImageAIProvider;
export type PathologyAnalysisProvider = MedicalImageAIProvider;
export type ECGAnalysisProvider = MedicalImageAIProvider;
export type EndoscopyAnalysisProvider = MedicalImageAIProvider;

export class MedicalImageProviderRegistry {
  private readonly providers: MedicalImageAIProvider[] = [];

  /** Varsayılan: her modalite grubu için "model yok" (uzak sağlayıcı, API anahtarı, yapılandırma yok). */
  constructor() {
    for (const g of Object.keys(GROUP_MODALITIES) as ProviderGroup[]) this.providers.push(new UnavailableImageProvider(`none-${g}`, g));
  }

  /**
   * Cihazda çalışan bir sağlayıcıyı kaydeder; aynı modaliteyi destekleyen önceki kaydın yerine geçer.
   * Veriyi cihaz dışına gönderen sağlayıcı KAYDEDİLMEZ (güvenlik gereksinimi: uzak tıbbi AI yok).
   */
  register(provider: MedicalImageAIProvider): void {
    if (provider.sendsDataOffDevice) throw new Error('Uzak (cihaz dışına veri gönderen) sağlayıcılar desteklenmiyor.');
    for (let i = this.providers.length - 1; i >= 0; i--) if (this.providers[i]!.modalities.some((m) => provider.modalities.includes(m))) this.providers.splice(i, 1);
    this.providers.push(provider);
  }

  forModality(modality: Modality): MedicalImageAIProvider | undefined {
    for (let i = this.providers.length - 1; i >= 0; i--) if (this.providers[i]!.modalities.includes(modality)) return this.providers[i];
    return undefined;
  }

  list(): readonly MedicalImageAIProvider[] {
    return this.providers;
  }
}

export const defaultMedicalImageProviders = (): MedicalImageProviderRegistry => new MedicalImageProviderRegistry();

let fseq = 0;

/** Modelin verdiği yapı adını bilgi grafiğindeki yola bağlar (yoksa 3B yapı kimliği olarak). */
export function anatomyFor(structure: string | undefined, localization: Localization, confidence: Confidence): AnatomicalLocation | undefined {
  if (!structure) return undefined;
  const node = GRAPH.node(structure) ?? GRAPH.nodeForStructure(structure);
  const path = node ? GRAPH.pathTo(node.id).map((n) => n.id) : [structure];
  return {
    path,
    structure: node?.structure ?? structure,
    ...(node?.part ? { part: node.part } : {}),
    basis: localization.kind === 'pixel' || localization.kind === 'point' ? 'pixel-mapped' : 'region',
    confidence,
    note: localization.kind === 'pixel' || localization.kind === 'point' ? 'Konum, modelin görüntü üzerindeki koordinatından eşleştirildi.' : 'Model konum vermedi; yalnızca yapı adı.',
  };
}

export type ModelRun = { status: 'ran'; provider: string; model: ModelVersion; findings: MedicalFinding[] } | { status: 'unavailable'; reason: string };

/**
 * Bir çalışmayı modalitenin gerçek modeline gönderir. Sağlayıcı yoksa ya da kullanılamıyorsa
 * hiçbir bulgu üretmez ve nedenini döndürür. Varsa: bulgu → konum → anatomi zinciri kurulur ve her
 * bulgu "IMAGE_MODEL" (model-derived) kaynağıyla, modelin adı/sürümü ve güveniyle kaydedilir.
 */
export async function runMedicalImageModel(
  input: StudyInput,
  registry: MedicalImageProviderRegistry = defaultMedicalImageProviders(),
  opts: { timeoutMs?: number; documentId?: string; identity?: ModelIdentity; now?: () => Date } = {},
): Promise<ModelRun> {
  const provider = registry.forModality(input.modality);
  if (!provider || !provider.available()) {
    const reason = provider ? ((await provider.detectFindings(input)) as Extract<ProviderOutput<unknown>, { status: 'unavailable' }>).reason : undefined;
    return { status: 'unavailable', reason: reason ?? 'Bu modalite için tıbbi görüntü modeli yok.' };
  }
  // İkinci savunma hattı: kayıt dışı yollarla gelse bile uzak sağlayıcı asla çalıştırılmaz.
  if (provider.sendsDataOffDevice) return { status: 'unavailable', reason: 'Uzak sağlayıcılar desteklenmiyor: hasta verisi cihaz dışına gönderilmez.' };
  const timeout = opts.timeoutMs ?? 30000;
  const withTimeout = <T>(p: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([p.finally(() => clearTimeout(timer)), new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), timeout)))]);
  };
  try {
    const detected = await withTimeout(provider.detectFindings(input));
    if (detected.status !== 'ok') return { status: 'unavailable', reason: detected.reason };
    const localized = await withTimeout(provider.localizeFindings(input, detected.value));
    const list = localized.status === 'ok' ? localized.value : detected.value;
    const findings: MedicalFinding[] = list.map((f) => {
      const anatomicalStructure = anatomyFor(f.structure, f.localization, f.confidence);
      const frame = f.localization.kind === 'pixel' || f.localization.kind === 'point' ? f.localization.frame : undefined;
      return {
        id: `mf-${(fseq++).toString(36)}`,
        source: 'IMAGE_MODEL',
        provenance: {
          derivation: 'model-derived',
          source: 'IMAGE_MODEL',
          model: { ...detected.model, ...(opts.identity?.sha256 ? { sha256: opts.identity.sha256 } : {}), ...(opts.identity?.license ? { license: opts.identity.license } : {}) },
          ...(opts.documentId ? { documentId: opts.documentId } : {}),
          ...(frame !== undefined ? { frame } : {}),
          at: (opts.now?.() ?? new Date()).toISOString(),
        },
        finding: f.finding,
        model: detected.model,
        confidence: f.confidence,
        localization: f.localization,
        ...(anatomicalStructure ? { anatomicalStructure } : {}),
        limitations: [...detected.limitations, ...(f.limitations ?? [])],
      };
    });
    return { status: 'ran', provider: provider.id, model: detected.model, findings };
  } catch (e) {
    return { status: 'unavailable', reason: e instanceof Error && e.message === 'timeout' ? `Model ${Math.round(timeout / 1000)} saniyede yanıt vermedi.` : 'Model çalıştırılırken hata oluştu; bulgu üretilmedi.' };
  }
}
