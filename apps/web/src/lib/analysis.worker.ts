/// <reference lib="webworker" />
/**
 * Ham görüntü analizi ve yerel tıbbi model çıkarımı ana iş parçacığından ayrı çalışır (arayüz
 * donmasın). Yalnızca bellekteki pikselleri ve cihazdaki model dosyasını kullanır; hiçbir yere veri
 * göndermez. Model oturumu SHA-256 ile önbelleğe alınır; iptal için ana iş parçacığı bu işçiyi sonlandırır.
 */
import {
  type ImageContext,
  type InferenceEngine,
  type ModelManifest,
  type Modality,
  type RasterImage,
  LocalModelProvider,
  analyzeImage,
  defaultMedicalImageProviders,
  modelVersionOf,
  runMedicalImageModel,
  type RasGrid,
  cascadeInput,
  decodeRle,
  segmentVolume,
} from '@kh/analysis';
import { volumeFromDicom } from '@kh/ingest';
import { ortEngineFactory } from './localModels/engine';

type Request =
  | { kind?: 'analyze'; id: number; image: RasterImage; context: ImageContext; reportAvailable: boolean }
  | { kind: 'model'; id: number; manifest: ModelManifest; bytes?: ArrayBuffer; image: RasterImage; modality: Modality; context: ImageContext; documentId?: string }
  | {
      kind: 'volume';
      id: number;
      manifest: ModelManifest;
      bytes?: ArrayBuffer;
      files: ArrayBuffer[];
      /** Basamaklı model için aynı serideki önceki (anatomi) sonucu. */
      prior?: { labels: ModelManifest['labels']; grid: RasGrid; labelsRle: number[] };
    };

const post = (m: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);
const providers = new Map<string, LocalModelProvider>();
/** 3B hacim modeli oturumu: bellek için aynı anda yalnızca bir tane açık tutulur. */
let volumeEngine: { sha: string; engine: InferenceEngine } | null = null;

async function runVolume(msg: Extract<Request, { kind: 'volume' }>) {
  if (volumeEngine?.sha !== msg.manifest.sha256) {
    if (!msg.bytes) {
      post({ id: msg.id, needBytes: true });
      return;
    }
    volumeEngine?.engine.dispose();
    volumeEngine = null;
    post({ id: msg.id, progress: { stage: 'loading', done: 0, total: 1 } });
    volumeEngine = { sha: msg.manifest.sha256, engine: await ortEngineFactory()(new Uint8Array(msg.bytes), msg.manifest) };
  }
  const built = volumeFromDicom(msg.files.map((b) => new Uint8Array(b)));
  if (!built.ok) {
    post({ id: msg.id, volume: { ok: false, reason: built.reason } });
    return;
  }
  const vol = built.volume;
  const t0 = performance.now();
  const prior = msg.prior ? { manifest: { labels: msg.prior.labels }, seg: { grid: msg.prior.grid, labels: decodeRle(msg.prior.labelsRle, msg.prior.grid.shape[0] * msg.prior.grid.shape[1] * msg.prior.grid.shape[2]) } } : undefined;
  const input = cascadeInput(vol, msg.manifest, prior);
  const seg = await segmentVolume(input, msg.manifest, volumeEngine.engine, { onProgress: (p) => post({ id: msg.id, progress: p }), statsVolume: vol });
  const { data: _data, ...geometry } = vol;
  post(
    {
      id: msg.id,
      volume: { ok: true, grid: seg.grid, labels: seg.labels, structures: seg.structures, tiles: seg.tiles, seconds: Math.round((performance.now() - t0) / 1000), geometry },
    },
    [seg.labels.buffer],
  );
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const msg = e.data;
  if (msg.kind === 'volume') {
    try {
      await runVolume(msg);
    } catch (err) {
      volumeEngine?.engine.dispose();
      volumeEngine = null;
      post({ id: msg.id, error: err instanceof Error ? err.message : 'volume model failed' });
    }
    return;
  }
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
    post({ id: msg.id, model: result, extras: provider.lastExtras });
  } catch (err) {
    providers.delete(msg.manifest.sha256);
    post({ id: msg.id, error: err instanceof Error ? err.message : 'model failed' });
  }
};
