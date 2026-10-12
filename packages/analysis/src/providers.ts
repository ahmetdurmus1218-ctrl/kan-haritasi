/**
 * Yapay zekâ sağlayıcı soyutlaması: uygulama tek bir sağlayıcıya bağlı değildir.
 *
 * Şu an kayıtlı olan TEK sağlayıcı cihaz içi, kural tabanlı `LocalHeuristicVisionProvider`'dır.
 * Harici (bulut) bir sağlayıcı eklenirse `sendsDataOffDevice: true` olur ve arayüz, veri gönderilmeden
 * önce "Bu veri harici bir yapay zekâ servisine gönderilebilir" uyarısını gösterip onay ister. Web
 * sürümünün CSP'si (connect-src 'self') ve Android'in internet izni olmaması bugün bunu zaten engeller.
 */
import type { AdapterRegistry } from './adapters/registry';
import { defaultRegistry } from './adapters/registry';
import { type AnatomyEstimate, type ModalityEstimate, classifyModality, estimateAnatomy, imageFeatures } from './modality';
import { type ImageAnalysisRun, analyzeImage } from './pipeline';
import type { ImageContext, ImageObservation, Modality, RasterImage } from './types';

export type ProviderResult<T> = { status: 'ok'; value: T } | { status: 'unavailable'; reason: string };

export interface AIProvider {
  id: string;
  label: string;
  /** Veri cihazdan çıkıyor mu? true ise kullanıcı onayı zorunlu. */
  sendsDataOffDevice: boolean;
  /** Sağlayıcı şu an kullanılabilir mi (yapılandırılmış, izinli)? */
  available(): boolean;
}

/** Tıbbi görüntü sağlayıcısı: her yöntem desteklenmiyorsa dürüstçe `unavailable` döner. */
export interface MedicalVisionProvider extends AIProvider {
  classifyModality(image: RasterImage, ctx?: ImageContext): ProviderResult<ModalityEstimate>;
  estimateAnatomy(image: RasterImage, modality: Modality, ctx?: ImageContext): ProviderResult<AnatomyEstimate>;
  analyzeImage(image: RasterImage, ctx?: ImageContext, reportAvailable?: boolean): ProviderResult<ImageAnalysisRun>;
  detectFindings(image: RasterImage, modality: Modality): ProviderResult<ImageObservation[]>;
  localizeFinding(image: RasterImage, finding: ImageObservation): ProviderResult<ImageObservation>;
  segmentStructure(image: RasterImage, structure: string): ProviderResult<Uint8Array>;
}

export class LocalHeuristicVisionProvider implements MedicalVisionProvider {
  readonly id = 'local-heuristic';
  readonly label = 'Cihaz içi analiz (kural tabanlı sinyal işleme)';
  readonly sendsDataOffDevice = false;

  constructor(private readonly registry: AdapterRegistry = defaultRegistry()) {}

  available() {
    return true;
  }

  classifyModality(image: RasterImage, ctx: ImageContext = {}): ProviderResult<ModalityEstimate> {
    return { status: 'ok', value: classifyModality(imageFeatures(image), ctx) };
  }

  estimateAnatomy(image: RasterImage, modality: Modality, ctx: ImageContext = {}): ProviderResult<AnatomyEstimate> {
    const a = estimateAnatomy(imageFeatures(image), modality, ctx);
    return a.structure ? { status: 'ok', value: a } : { status: 'unavailable', reason: 'Görüntüden anatomik bölge belirlenemedi.' };
  }

  analyzeImage(image: RasterImage, ctx: ImageContext = {}, reportAvailable = false): ProviderResult<ImageAnalysisRun> {
    return { status: 'ok', value: analyzeImage(image, ctx, { registry: this.registry, reportAvailable }) };
  }

  detectFindings(): ProviderResult<ImageObservation[]> {
    return { status: 'unavailable', reason: 'Lezyon/bulgu tespit eden bir model bu kurulumda yok. Kesitsel görüntülerde yalnızca sağ-sol asimetri gözlemi üretilir (analyzeImage).' };
  }

  localizeFinding(): ProviderResult<ImageObservation> {
    return { status: 'unavailable', reason: 'Rapordaki bir bulguyu görüntü üzerinde bulan (görüntü–metin eşleştiren) bir model yok; rapor konumu yalnızca yaklaşık anatomik konum olarak gösterilir.' };
  }

  segmentStructure(): ProviderResult<Uint8Array> {
    return { status: 'unavailable', reason: 'Organ/yapı segmentasyon modeli bu kurulumda yok.' };
  }
}

export class ProviderRegistry {
  private readonly providers: AIProvider[] = [];
  register(p: AIProvider) {
    this.providers.push(p);
  }
  list(): readonly AIProvider[] {
    return this.providers;
  }
  /** Veriyi cihaz dışına gönderebilecek sağlayıcılar (bugün: yok). */
  external(): AIProvider[] {
    return this.providers.filter((p) => p.sendsDataOffDevice);
  }
  vision(): MedicalVisionProvider | undefined {
    return this.providers.find((p): p is MedicalVisionProvider => 'analyzeImage' in p && p.available());
  }
}

export const EXTERNAL_AI_DISCLOSURE = 'Bu veri harici bir yapay zekâ servisine gönderilebilir. Göndermeden önce onayın istenir; onay vermezsen analiz yalnızca cihazında yapılır.';

export function defaultProviders(): ProviderRegistry {
  const r = new ProviderRegistry();
  r.register(new LocalHeuristicVisionProvider());
  return r;
}
