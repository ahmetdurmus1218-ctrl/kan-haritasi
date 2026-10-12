import type { AnatomyEstimate, ImageFeatures } from '../modality';
import type { QualityReport } from '../quality';
import type { AdapterResult, Capability, ImageContext, ModelVersion, Modality, RasterImage } from '../types';

export interface AdapterInput {
  image: RasterImage;
  modality: Modality;
  context: ImageContext;
  quality: QualityReport;
  anatomy: AnatomyEstimate;
  features?: ImageFeatures;
}

/** Bir modalite (ya da modalite grubu) için görüntü analiz adaptörü. Yeni modalite = yeni adaptör. */
export interface ImageAnalysisAdapter {
  id: string;
  label: string;
  modalities: readonly Modality[];
  model: ModelVersion;
  /** Bildirilen yetenekler (uygulanmış olsun olmasın): arayüz neyin yapılıp neyin yapılamadığını buradan gösterir. */
  capabilities: ReadonlyArray<Pick<Capability, 'key' | 'label' | 'implemented'>>;
  analyze(input: AdapterInput): AdapterResult;
}

/** Bildirilen yeteneklerden bu çalıştırmanın durumunu üretir. */
export function capabilityStatus(adapter: Pick<ImageAnalysisAdapter, 'capabilities'>, done: Record<string, { ok: boolean; detail?: string }> = {}): Capability[] {
  return adapter.capabilities.map((c) => {
    if (!c.implemented) return { ...c, status: 'not-implemented' as const, detail: 'Bu kurulumda bu yetenek için model/algoritma yok.' };
    const d = done[c.key];
    return { ...c, status: d?.ok ? ('done' as const) : ('not-possible' as const), ...(d?.detail ? { detail: d.detail } : {}) };
  });
}

let counter = 0;
export const obsId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
