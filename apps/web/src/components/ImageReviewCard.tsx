import { useEffect, useRef, useState } from 'react';
import { type ImageReview, borderValue, rotateImage } from '@kh/ingest';
import type { Bytes, FileInfo } from '@kh/vault';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type GrayImage, describeRegion, loadGray, runReview, toStored } from '../lib/imageReview';
import { type StoredReview, saveReview } from '../lib/imagingRecords';
import { userMessage } from '../lib/messages';
import { CheckIcon, SpinnerIcon } from './icons';

const BOX = ['#f472b6', '#fbbf24', '#38bdf8', '#a78bfa'];

const VERDICT_TONE = {
  calm: 'border-accent/30 bg-accent/5 text-fg',
  mild: 'border-caution/40 bg-caution/[0.07] text-caution-fg',
  strong: 'border-high/40 bg-high/[0.08] text-high',
  none: 'border-ink-600 bg-ink-850/60 text-fg-muted',
} as const;

/**
 * Tek satırlık ön değerlendirme: incelemenin ne bulduğunu sade dille söyler. "Normal" ya da
 * "hastalık var" demez; yalnızca sağ-sol farkının olup olmadığını ve ne yapılması gerektiğini söyler.
 */
function verdictOf(
  review: ImageReview,
  regions: Array<{ panel: number; areaPct: number; strength: number }>,
): { tone: keyof typeof VERDICT_TONE; title: string; text: string } {
  if (review.compared === 0)
    return {
      tone: 'none',
      title: 'Bu görüntüde karşılaştırılabilir kesit bulunamadı',
      text: 'Sağ-sol karşılaştırması yalnızca önden/üstten (eksenel, koronal) kesitlerde yapılabilir. Görüntüyü düz ve kesitleri tam görünecek şekilde yeniden çekmeyi dene.',
    };
  if (!regions.length)
    return {
      tone: 'calm',
      title: `Belirgin sağ-sol farkı görülmedi (${review.compared} kesit)`,
      text: 'Karşılaştırılan kesitlerde iki taraf birbirine benziyor. Bu, görüntünün normal olduğunu kanıtlamaz: iki tarafı eşit etkileyen ve küçük değişiklikler bu yöntemle görülmez. Kesin değerlendirme radyoloji raporundadır.',
    };
  const strong = regions.filter((g) => g.strength >= 3 || g.areaPct >= 3);
  const panels = [...new Set((strong.length ? strong : regions).map((g) => g.panel))];
  const where = panels.length === 1 ? `Kesit ${panels[0]}` : `${panels.length} kesit (${panels.join(', ')})`;
  return strong.length
    ? {
        tone: 'strong',
        title: `${where}: belirgin sağ-sol farkı var`,
        text: 'Bir tarafta karşı tarafta olmayan belirgin bir parlaklık farkı işaretlendi. Bu bir tanı değildir (normal yapılar da farklı görünebilir), ama görüntüyü ve bu işareti hekimine göstermen iyi olur.',
      }
    : {
        tone: 'mild',
        title: `${where}: hafif sağ-sol farkı var`,
        text: 'Küçük ya da zayıf bir fark işaretlendi. Sağlıklı kişilerde de sık görülür (baş eğikliği, kesit düzeyi, sinüsler). Önemini ancak hekim değerlendirebilir.',
      };
}

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
    p.regions.forEach((g, gi) => {
      ctx.strokeStyle = BOX[gi % BOX.length]!;
      ctx.lineWidth = lw * 1.4;
      ctx.strokeRect(g.x - lw * 2, g.y - lw * 2, g.w + lw * 4, g.h + lw * 4);
    });
  });
}

/**
 * Otomatik görüntü incelemesi kartı: kesitleri ayırır, sağ-sol farkını gösterir. Kullanıcı
 * isterse özeti "sonuçlarına" ekler (3B'de ilgili yapı vurgulanır). Tanı koymaz.
 */
export function ImageReviewCard({
  info,
  bytes,
  noteFileId,
  stored,
  onHeadLike,
}: {
  info: FileInfo;
  bytes: Bytes;
  noteFileId: string;
  stored?: StoredReview;
  /** Kesitler baş kesitine benziyorsa (bölge önerisi için). */
  onHeadLike?: () => void;
}) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<{ img: GrayImage; review: ImageReview } | 'running' | 'unsupported' | null>(null);
  const [heat, setHeat] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('running');
    // Arayüz önce çizilsin; inceleme bir sonraki karede başlar (küçük görüntüde < 1 sn).
    const t = setTimeout(() => {
      loadGray(info, bytes)
        .then((img) => {
          if (cancelled) return;
          if (!img) return setState('unsupported');
          const review = runReview(img);
          setState({ img, review });
          if (review.headLike) onHeadLike?.();
        })
        .catch(() => !cancelled && setState('unsupported'));
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // onHeadLike her çizimde yenilenir; yalnızca dosya değişince yeniden incelenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.id, bytes]);

  useEffect(() => {
    if (canvas.current && state && typeof state === 'object') draw(canvas.current, state.img, state.review, heat);
  }, [state, heat]);

  if (state === 'unsupported') return null;
  const review = typeof state === 'object' && state ? state.review : null;
  const regions = review ? review.panels.flatMap((p, i) => p.regions.map((g, j) => ({ ...g, panel: i + 1, n: j }))) : [];
  const confirmed = stored?.confirmed && stored.sourceId === info.id;
  const verdict = review ? verdictOf(review, regions) : null;

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
    <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Otomatik görüntü incelemesi">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-caps">Otomatik görüntü incelemesi · deneysel</p>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Görüntü cihazında incelenir: kesitler ayrılır, her kesitte orta hat bulunur ve sağ yarı sol yarının ayna görüntüsüyle karşılaştırılır. Karşı tarafa göre
            belirgin biçimde farklı kalan alanlar işaretlenir. <strong>Tanı değildir.</strong>
          </p>
        </div>
      </div>

      {state === 'running' || state === null ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={14} /> Görüntü inceleniyor…
        </p>
      ) : (
        review && (
          <>
            {verdict && (
              <div className={`rounded-xl border p-3 ${VERDICT_TONE[verdict.tone]}`} role="status">
                <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Ön değerlendirme · otomatik, kesin değil</p>
                <p className="mt-1 text-base font-semibold leading-snug">{verdict.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{verdict.text}</p>
              </div>
            )}
            <figure className="overflow-hidden rounded-xl border border-ink-600/60 bg-black" aria-label={`İnceleme görüntüsü: ${review.panels.length} kesit, ${regions.length} dikkat bölgesi`}>
              <canvas ref={canvas} className="block h-auto w-full" aria-hidden="true" />
            </figure>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
              <span>
                {review.panels.length} kesit bulundu · {review.compared} tanesinde sağ-sol karşılaştırması yapıldı
                {review.panels.length - review.compared > 0 ? ` · ${review.panels.length - review.compared} kesit simetrik olmadığı için (ör. yandan kesit) karşılaştırılmadı` : ''}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-accent)]" checked={heat} onChange={(e) => setHeat(e.target.checked)} />
                Fark haritası
              </label>
            </div>
            {review.compared === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-600 p-3 text-sm text-fg-muted">
                Bu görüntüde sağ-sol karşılaştırması yapılabilecek (eksenel ya da koronal, simetrik) bir kesit bulunamadı. Yandan (sagital) kesitlerde ve tek taraflı
                çekimlerde bu yöntem kullanılamaz.
              </p>
            ) : regions.length === 0 ? (
              <p className="rounded-xl border border-accent/25 bg-accent/5 p-3 text-sm text-fg-muted">
                Karşılaştırılan kesitlerde eşiği aşan belirgin bir sağ-sol farkı bulunmadı. Bu, görüntünün normal olduğu anlamına gelmez: iki tarafı eşit etkileyen
                değişiklikler ve küçük ayrıntılar bu yöntemle görülmez.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {regions.map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-xl border border-ink-600/60 px-3 py-2 text-sm">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: BOX[g.n % BOX.length] }} aria-hidden="true" />
                    <span>
                      <span className="text-fg">Kesit {g.panel}</span> <span className="text-fg-muted">· {describeRegion(g)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] leading-relaxed text-fg-faint">
              Nasıl okunur: işaretli alan yalnızca "iki taraf burada farklı görünüyor" demektir. Sağlıklı kişilerde de hafif farklar olur; baş eğikliği, kesit
              düzeyi, sinüsler, fotoğraf açısı ve ekran yansıması farkı büyütebilir. Radyolojik düzende görüntünün solu çoğunlukla hastanın sağıdır. Görüntüyü ve
              raporu hekimin değerlendirir.
            </p>
            {regions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {confirmed ? (
                  <>
                    <span className="flex items-center gap-1 text-xs text-accent">
                      <CheckIcon size={12} /> Sonuçlarına eklendi · 3B'de ilgili bölge işaretli
                    </span>
                    <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => void save(null)}>
                      Kaldır
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={() => void save(toStored(review, info.id, true))}>
                    Sonuçlarıma ekle ({regions.length} dikkat bölgesi)
                  </button>
                )}
              </div>
            )}
          </>
        )
      )}
      {error && <p className="text-xs text-high">{error}</p>}
    </section>
  );
}
