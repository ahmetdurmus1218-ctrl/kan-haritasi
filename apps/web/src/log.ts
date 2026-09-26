/**
 * Tek log noktası. Kurallar:
 * - Yalnızca olay adı ve sabit teknik kodlar loglanır ("upload.done", "INTEGRITY").
 * - Dosya adı, dosya içeriği, sonuç değeri, OCR metni ASLA buraya verilmez.
 *   İmza bunu zorlar: yalnızca string sabitler ve sayılar kabul edilir.
 * - Üretim derlemesinde hiçbir şey yazılmaz; üçüncü taraf log/çökme servisi yoktur.
 */
type Primitive = string | number | boolean;

export function logEvent(event: `${string}.${string}`, detail?: Record<string, Primitive>): void {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.debug(`[kh] ${event}`, detail ?? '');
}
