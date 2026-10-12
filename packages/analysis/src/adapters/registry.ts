/**
 * Adaptör kaydı: yeni bir modalite modeli (ör. FundusAnalysisAdapter) eklemek mevcut kodu bozmadan
 * `register` ile yapılır; aynı modaliteyi destekleyen en son kaydedilen adaptör seçilir.
 */
import type { Modality } from '../types';
import { crossSectionalAdapter } from './crossSectional';
import { ecgAdapter } from './ecg';
import { pathologyAdapter } from './pathology';
import type { ImageAnalysisAdapter } from './types';
import { ultrasoundAdapter } from './ultrasound';
import { dentalAdapter, dermatologyAdapter, endoscopyAdapter, fundusAdapter, genericAdapter, mammographyAdapter, xrayAdapter } from './unavailable';

export class AdapterRegistry {
  private readonly adapters: ImageAnalysisAdapter[] = [];

  constructor(initial: readonly ImageAnalysisAdapter[] = []) {
    for (const a of initial) this.register(a);
  }

  register(adapter: ImageAnalysisAdapter): void {
    const i = this.adapters.findIndex((a) => a.id === adapter.id);
    if (i >= 0) this.adapters.splice(i, 1);
    this.adapters.push(adapter);
  }

  list(): readonly ImageAnalysisAdapter[] {
    return this.adapters;
  }

  forModality(modality: Modality): ImageAnalysisAdapter {
    for (let i = this.adapters.length - 1; i >= 0; i--) if (this.adapters[i]!.modalities.includes(modality)) return this.adapters[i]!;
    return genericAdapter;
  }

  /** Modalite başına destek düzeyi (README ve Kapsam ekranı için). */
  support(): Array<{ modality: Modality; adapter: string; implemented: string[]; missing: string[] }> {
    const all: Modality[] = ['MRI', 'CT', 'PET_CT', 'XRAY', 'ULTRASOUND', 'DOPPLER', 'MAMMOGRAPHY', 'ECHOCARDIOGRAPHY', 'ENDOSCOPY', 'COLONOSCOPY', 'DERMOSCOPY', 'DENTAL', 'FUNDUS', 'PATHOLOGY', 'MICROSCOPY', 'ECG'];
    return all.map((m) => {
      const a = this.forModality(m);
      return { modality: m, adapter: a.label, implemented: a.capabilities.filter((c) => c.implemented).map((c) => c.label), missing: a.capabilities.filter((c) => !c.implemented).map((c) => c.label) };
    });
  }
}

export const defaultRegistry = (): AdapterRegistry =>
  new AdapterRegistry([genericAdapter, xrayAdapter, mammographyAdapter, endoscopyAdapter, dermatologyAdapter, dentalAdapter, fundusAdapter, crossSectionalAdapter, ultrasoundAdapter, pathologyAdapter, ecgAdapter]);
