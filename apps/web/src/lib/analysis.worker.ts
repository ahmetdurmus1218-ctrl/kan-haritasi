/// <reference lib="webworker" />
/**
 * Ham görüntü analizi ve yerel tıbbi model çıkarımı ana iş parçacığından ayrı çalışır (arayüz
 * donmasın). Yalnızca bellekteki pikselleri ve cihazdaki model dosyasını kullanır; hiçbir yere veri
 * göndermez. Model oturumu SHA-256 ile önbelleğe alınır; iptal için ana iş parçacığı bu işçiyi sonlandırır.
 */
import {
  type ImageContext,
  type ModelManifest,
  type Modality,
  type RasterImage,
  LocalModelProvider,
  analyzeImage,
  defaultMedicalImageProviders,
  modelVersionOf,
  runMedicalImageModel,
} from '@kh/analysis';
import { ortEngineFactory } from './localModels/engine';

type Request =
  | { kind?: 'analyze'; id: number; image: RasterImage; context: ImageContext; reportAvailable: boolean }
  | { kind: 'model'; id: number; manifest: ModelManifest; bytes?: ArrayBuffer; image: RasterImage; modality: Modality; context: ImageContext; documentId?: string };

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
const providers = new Map<string, LocalModelProvider>();

self.onmessage = async (e: MessageEvent<Request>) => {
  const msg = e.data;
  if (msg.kind !== 'model') {
    try {
      post({ id: msg.id, run: analyzeImage(msg.image, msg.context, { reportAvailable: msg.reportAvailable }) });
    } catch (err) {
      post({ id: msg.id, error: err instanceof Error ? err.message : 'analysis failed' });
    }
    return;
  }
  try {
    let provider = providers.get(msg.manifest.sha256);
    if (!provider) {
      if (!msg.bytes) {
        post({ id: msg.id, needBytes: true });
        return;
      }
      const bytes = new Uint8Array(msg.bytes);
      provider = new LocalModelProvider(msg.manifest, async () => bytes, ortEngineFactory());
      providers.set(msg.manifest.sha256, provider);
    }
    post({ id: msg.id, progress: 'inference' });
    const registry = defaultMedicalImageProviders();
    registry.register(provider);
    const result = await runMedicalImageModel({ images: [msg.image], modality: msg.modality, context: msg.context }, registry, {
      identity: modelVersionOf(msg.manifest),
      timeoutMs: 180000,
      ...(msg.documentId ? { documentId: msg.documentId } : {}),
    });
    post({ id: msg.id, model: result });
  } catch (err) {
    providers.delete(msg.manifest.sha256);
    post({ id: msg.id, error: err instanceof Error ? err.message : 'model failed' });
  }
};
