/**
 * Yerel çıkarım motoru: ONNX Runtime Web (yalnızca WASM, tek iş parçacığı). Kütüphane ve WASM dosyası
 * ilk kullanımda yüklenir (lazy). WASM, derlemede uygulamanın kendi varlığı olarak paketlenir ve
 * `import.meta.url`'ye göre aynı kökenden yüklenir; ağ isteği / CDN yok (CSP connect-src 'self').
 */
import type { EngineFactory, InferenceEngine, Tensor } from '@kh/analysis';

type OrtModule = typeof import('onnxruntime-web/wasm');
let ortPromise: Promise<OrtModule> | null = null;

function loadOrt(): Promise<OrtModule> {
  ortPromise ??= import('onnxruntime-web/wasm').then((ort) => {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.logLevel = 'error';
    return ort;
  });
  ortPromise.catch(() => (ortPromise = null));
  return ortPromise;
}

const TYPE = (d: Tensor['data']) => (d instanceof Float32Array ? 'float32' : d instanceof Int32Array ? 'int32' : d instanceof BigInt64Array ? 'int64' : 'uint8');

export function ortEngineFactory(): EngineFactory {
  return async (bytes): Promise<InferenceEngine> => {
    const ort = await loadOrt();
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    return {
      async run(feeds) {
        const input = Object.fromEntries(Object.entries(feeds).map(([k, t]) => [k, new ort.Tensor(TYPE(t.data), t.data, t.dims)]));
        const out = await session.run(input);
        const result: Record<string, Tensor> = {};
        for (const [k, v] of Object.entries(out)) {
          result[k] = { data: v.data as Tensor['data'], dims: v.dims };
          v.dispose?.();
        }
        for (const t of Object.values(input)) t.dispose?.();
        return result;
      },
      dispose() {
        void session.release();
      },
    };
  };
}
