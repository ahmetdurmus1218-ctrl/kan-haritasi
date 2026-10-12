/// <reference lib="webworker" />
/**
 * Ham görüntü analizini ana iş parçacığından ayrı çalıştırır (büyük görüntüde arayüz donmasın).
 * Yalnızca bellekteki pikselleri alır, sonucu döndürür; hiçbir yere veri göndermez.
 */
import { type ImageContext, type RasterImage, analyzeImage } from '@kh/analysis';

interface Request {
  id: number;
  image: RasterImage;
  context: ImageContext;
  reportAvailable: boolean;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, image, context, reportAvailable } = e.data;
  try {
    const run = analyzeImage(image, context, { reportAvailable });
    (self as unknown as Worker).postMessage({ id, run });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : 'analysis failed' });
  }
};
