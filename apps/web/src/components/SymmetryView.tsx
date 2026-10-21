import { useEffect, useMemo, useRef, useState } from 'react';
import { type ImageReview, borderValue, rotateImage } from '@kh/ingest';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type GrayImage, describeRegion, runReview } from '../lib/imageReview';
import { type StoredReview, saveReview } from '../lib/imagingRecords';
import { userMessage } from '../lib/messages';

const BOX = ['#f472b6', '#fbbf24', '#38bdf8', '#a78bfa'];

function draw(canvas: HTMLCanvasElement, source: GrayImage, r: ImageReview, heat: boolean) {
  // Eğik fotoğraf incelemede düzeltildi: kutular düzeltilmiş görüntüye göre, görüntü de aynı açıyla çizilir.
  const img = r.angle ? { ...source, data: rotateImage(source.data, source.width, source.height, r.angle, borderValue(source.data, source.width, source.height)) } : source;
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Gri görüntü (1.–99,5. yüzdelik arası gerilir).
  const sorted = Float32Array.from(img.data.filter((_, i) => i % 7 === 0)).sort();
  const lo = sorted[Math.floor(sorted.length * 0.01)] ?? 0;
  const hi = sorted[Math.floor(sorted.length * 0.995)] ?? 255;
  const k = hi > lo ? 255 / (hi - lo) : 1;
  const out = ctx.createImageData(img.width, img.height);
  for (let p = 0; p < img.data.length; p++) {
    const v = Math.max(0, Math.min(255, (img.data[p]! - lo) * k));
    out.data[p * 4] = out.data[p * 4 + 1] = out.data[p * 4 + 2] = v;
    out.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const lw = Math.max(1.5, img.width / 300);
  // Renkler bulgu kartlarındaki ve açıklamadaki sırayla aynı (kesitler boyunca tek sayaç).
  let box = 0;
  r.panels.forEach((p, pi) => {
    if (heat && p.heat) {
      const hc = document.createElement('canvas');
      hc.width = p.heat.w;
      hc.height = p.heat.h;
      const hx = hc.getContext('2d');
      if (hx) {
        const hd = hx.createImageData(p.heat.w, p.heat.h);
        for (let i = 0; i < p.heat.data.length; i++) {
          const v = p.heat.data[i]!;
          hd.data[i * 4] = 255;
          hd.data[i * 4 + 1] = 40;
          hd.data[i * 4 + 2] = 150;
          hd.data[i * 4 + 3] = Math.min(200, v * 0.8);
        }
        hx.putImageData(hd, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(hc, p.x, p.y, p.w, p.h);
      }
      hc.width = 0;
    }
    ctx.lineWidth = lw;
    ctx.strokeStyle = p.kind === 'symmetric' ? 'rgba(94,234,212,0.55)' : 'rgba(148,163,184,0.45)';
    ctx.setLineDash([lw * 3, lw * 2]);
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.setLineDash([]);
    if (p.midline) {
      ctx.strokeStyle = 'rgba(94,234,212,0.9)';
      ctx.beginPath();
      ctx.moveTo(p.midline[0], p.midline[1]);
      ctx.lineTo(p.midline[2], p.midline[3]);
      ctx.stroke();
    }
    ctx.font = `${Math.max(11, img.width / 45)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.fillText(String(pi + 1), p.x + lw * 3, p.y + Math.max(12, img.width / 40));
    p.regions.forEach((g) => {
      ctx.strokeStyle = BOX[box++ % BOX.length]!;
      ctx.lineWidth = lw * 1.4;
      ctx.strokeRect(g.x - lw * 2, g.y - lw * 2, g.w + lw * 4, g.h + lw * 4);
    });
  });
}

/** Kutuların rengi (bulgu kartlarındaki renk karesiyle aynı sırada). */
export const BOX_COLORS = BOX;

/**
 * Sağ-sol simetri ön kontrolünün görüntü üzerindeki gösterimi (Görüntü kartının içinde; ayrı bir kart
 * DEĞİL): kesit çerçeveleri, orta hat, asimetri gözlemi kutuları ve isteğe bağlı fark haritası.
 * Kullanıcı isterse gözlemleri "sonuçlarına" ekler (3B'de ilgili yapı vurgulanır). Tanı koymaz.
 */
export function SymmetryView({
  gray,
  sourceId,
  noteFileId,
  stored,
  onHeadLike,
  onReview,
}: {
  gray: GrayImage;
  sourceId: string;
  noteFileId: string;
  stored?: StoredReview;
  onHeadLike?: () => void;
  onReview?: (r: { compared: number; flagged: number; panels: number }) => void;
}) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const canvas = useRef<HTMLCanvasElement>(null);
  const review = useMemo(() => runReview(gray), [gray]);
  const [heat, setHeat] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (review.headLike) onHeadLike?.();
    onReview?.({ compared: review.compared, flagged: review.flagged, panels: review.panels.length });
    // Yalnızca inceleme değişince bildirilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review]);

  useEffect(() => {
    if (canvas.current) draw(canvas.current, gray, review, heat);
  }, [gray, review, heat]);

  const regions = review.panels.flatMap((p, i) => p.regions.map((g, j) => ({ ...g, panel: i + 1, n: j })));
  const confirmed = stored?.confirmed && stored.sourceId === sourceId;

  const save = async (next: StoredReview | null) => {
    setBusy(true);
    setError(null);
    try {
      await saveReview(vault, noteFileId, next);
      bump();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" aria-label="Sağ-sol simetri ön kontrolü">
      <figure className="overflow-hidden rounded-xl border border-ink-600/60 bg-black" aria-label={`Ön kontrol görüntüsü: ${review.panels.length} kesit, ${regions.length} asimetri gözlemi`}>
        <canvas ref={canvas} className="block h-auto w-full" aria-hidden="true" />
      </figure>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
        <span>
          {review.panels.length} kesit bulundu · {review.compared} tanesinde sağ-sol karşılaştırması yapıldı
          {review.panels.length - review.compared > 0 ? ` · ${review.panels.length - review.compared} kesit simetrik olmadığı için (ör. yandan kesit) karşılaştırılmadı` : ''}
        </span>
        <label className="flex min-h-[32px] cursor-pointer items-center gap-1.5">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-accent)]" checked={heat} onChange={(e) => setHeat(e.target.checked)} />
          Fark haritası
        </label>
      </div>
      {regions.length > 0 && (
        <ul className="space-y-1 text-xs text-fg-muted" aria-label="Kutu açıklaması">
          {regions.map((g, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: BOX[i % BOX.length] }} aria-hidden="true" />
              <span>
                Kesit {g.panel} · {describeRegion(g)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {confirmed && (
        // Eski sürümde "Sonuçlarıma ekle" ile kaydedilmiş ön kontrol: artık sonuçlara/3B'ye katılmıyor; kaldırılabilir.
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <span>Bu ön kontrol eski bir sürümde sonuçlarına eklenmişti; artık sonuç sayılmıyor.</span>
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => void save(null)}>
            Kaydı kaldır
          </button>
        </div>
      )}
      {error && <p className="text-xs text-high">{error}</p>}
    </div>
  );
}
