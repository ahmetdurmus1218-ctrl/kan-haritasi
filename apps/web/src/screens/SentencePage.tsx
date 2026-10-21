/**
 * Bir rapor cümlesi adım adım (#/cumle/<belge>/<n>): her organ için aynı 7 adım. Beyin MR'ı, bel MR'ı,
 * karın ultrasonu… raporundaki her cümle buradan açılır; cümleler arasında ileri/geri gidilir.
 */
import { useMemo } from 'react';
import { go } from '../state/router';
import { useImagingStudies } from '../lib/imagingStudies';
import { sentencesOf } from '../lib/reportSteps';
import { BRAIN_STRUCTURES } from '../lib/brainReport';
import { findingTone } from '../components/findings';
import { ReportSteps } from '../components/ReportSteps';
import { BrainIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/icons';

export function SentencePage({ file, n }: { file: string; n: number }) {
  const studies = useImagingStudies();
  const list = useMemo(() => (studies ? sentencesOf(studies, file) : []), [studies, file]);
  if (!studies)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-fg-muted">Rapor açılıyor…</p>
      </div>
    );
  const s = list[n - 1];
  if (!s)
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-8">
        <p className="text-sm text-fg-muted">Bu cümle bulunamadı (belge silinmiş ya da rapor metni değişmiş olabilir).</p>
        <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => go({ name: 'images' })}>
          Görüntülere dön
        </button>
      </div>
    );
  const tone = findingTone(s.finding);
  const brain = BRAIN_STRUCTURES.has(s.finding.structure ?? '');
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <nav aria-label="Şu anda neredeyim?" className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
        <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'images' })}>
          Görüntüler
        </button>
        <span className="text-fg-faint">›</span>
        <button type="button" className="min-h-[32px] max-w-[45vw] truncate hover:text-accent" onClick={() => go({ name: 'document', id: s.fileId })}>
          {s.docName}
        </button>
        <span className="text-fg-faint">›</span>
        <span className="text-fg" aria-current="location">
          Cümle {n} / {list.length}
        </span>
      </nav>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{s.finding.where ?? 'Rapor cümlesi'}</h1>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.cls}`}>{tone.label}</span>
        </div>
        {brain && s.node && (
          <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'brain', region: s.node === 'brain' ? undefined : s.node })}>
            <BrainIcon size={15} /> Beyin haritasında gör
          </button>
        )}
      </header>
      <section className="card overflow-hidden" aria-label="Adım adım">
        <ReportSteps key={`${file}/${n}`} s={s} />
      </section>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" disabled={n <= 1} onClick={() => go({ name: 'sentence', file, n: n - 1 })}>
          <ChevronLeftIcon size={15} /> Önceki cümle
        </button>
        <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" disabled={n >= list.length} onClick={() => go({ name: 'sentence', file, n: n + 1 })} data-testid="next-sentence">
          Sonraki cümle <ChevronRightIcon size={15} />
        </button>
      </div>
      <p className="text-xs text-fg-faint">Cümle radyoloğun raporundan okunur; konumu rapor metninden yaklaşıktır. Tanı koymaz; anlamını hekimin değerlendirir.</p>
    </div>
  );
}
