/**
 * Uygulamanın KENDİ paketlenmiş dosyalarını (ör. ai-models/ altındaki model ve manifestler) okur.
 *
 * Ağ kuralının tek istisnası budur ve bilinçlidir: yalnızca uygulamayla aynı kökenden, göreli bir yol okunur
 * (Android'de APK içindeki varlık, web'de uygulamanın kendi sunucusu). Hiçbir veri gönderilmez; istek gövdesi
 * yoktur, yalnızca GET. CSP `connect-src 'self'` başka bir kökene isteği zaten engeller; burada ayrıca denetlenir.
 */
const SAFE_PATH = /^[a-z0-9][a-z0-9._/-]{0,200}$/;

export function appAssetUrl(path: string): URL {
  if (!SAFE_PATH.test(path) || path.includes('..') || path.includes('//')) throw new Error('Geçersiz uygulama dosyası yolu.');
  const url = new URL(path, document.baseURI);
  if (url.origin !== location.origin) throw new Error('Uygulama dosyası yalnızca aynı kökenden okunabilir.');
  return url;
}

export async function readAppAsset(path: string): Promise<ArrayBuffer> {
  const url = appAssetUrl(path);
  // eslint-disable-next-line no-restricted-globals -- yalnızca aynı kökenden, uygulamanın kendi dosyası (yukarıdaki açıklama)
  const res = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'force-cache' });
  if (!res.ok) throw new Error(`Uygulama dosyası okunamadı: ${path}`);
  return res.arrayBuffer();
}

export async function readAppJson<T>(path: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await readAppAsset(path))) as T;
}
