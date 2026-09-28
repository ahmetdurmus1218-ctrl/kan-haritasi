import { go } from '../state/router';
import { CATEGORY_LABEL, CATEGORY_SHORT, regionByKey } from '../lib/imaging';
import type { ImagingStudy } from '../lib/imagingStudies';
import { formatDate, KIND_LABEL } from '../lib/format';
import { BodyIcon, ChevronRightIcon, ScanIcon } from './icons';

/** Görüntüleme çalışması kartı: tür, bölge, tarih, raporun sonucu ve raporda geçen terimler. */
export function ImagingStudyCard({ study, compact = false }: { study: ImagingStudy; compact?: boolean }) {
  const region = study.region ? regionByKey.get(study.region) : undefined;
  const kind = study.files.length > 1 ? `${study.files.length} kesit` : KIND_LABEL[study.head.kind];
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-2 text-left transition hover:bg-ink-800/60"
        onClick={() => go({ name: 'document', id: study.head.id })}
        aria-label={`${CATEGORY_LABEL[study.category]}${region ? ` · ${region.label}` : ''}, ${formatDate(study.date)}: aç`}
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-high/25 bg-high/8 text-high">
          <ScanIcon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="shrink-0 rounded-md border border-high/30 bg-high/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-high">{CATEGORY_SHORT[study.category]}</span>
            <span className="truncate text-[15px] font-medium">
              {CATEGORY_LABEL[study.category]}
              {region ? ` · ${region.label}` : ''}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-fg-muted">
            {formatDate(study.date)}
            {study.dateKnown ? '' : ' (yükleme tarihi)'} · {kind} · {study.head.displayName}
          </span>
          {study.conclusion ? (
            <span className={`mt-1.5 block whitespace-pre-line text-[13px] leading-snug text-fg ${compact ? 'line-clamp-2' : 'line-clamp-4'}`}>
              <span className="font-medium text-accent">{study.sections.some((s) => s.kind === 'sonuc') ? 'Sonuç: ' : 'Rapor: '}</span>
              {study.conclusion}
            </span>
          ) : study.linked ? (
            <span className={`mt-1.5 block whitespace-pre-line text-[13px] leading-snug text-fg ${compact ? 'line-clamp-2' : 'line-clamp-4'}`}>
              <span className="font-medium text-accent">Sonuç </span>
              <span className="text-fg-muted">(aynı çekimin raporundan: {study.linked.name})</span>
              <span className="font-medium text-accent">: </span>
              {study.linked.conclusion}
            </span>
          ) : (
            <span className="mt-1 block text-[12px] text-fg-faint">Rapor metni yok — belgeyi açıp okuyabilir ya da yazabilirsin.</span>
          )}
          {!compact && study.terms.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {study.terms.slice(0, 5).map((t) => (
                <span key={t.key} className="rounded-full border border-ink-600 px-2 py-0.5 text-[11px] text-fg-muted">
                  {t.term}
                </span>
              ))}
              {study.terms.length > 5 && <span className="px-1 text-[11px] text-fg-faint">+{study.terms.length - 5}</span>}
            </span>
          )}
        </span>
        <ChevronRightIcon size={16} className="mt-2 shrink-0 text-fg-faint" />
      </button>
      {region?.structure && (
        <button
          type="button"
          className="flex w-12 shrink-0 items-center justify-center border-l border-ink-700 text-fg-faint transition hover:bg-ink-800/60 hover:text-accent"
          onClick={() => go({ name: 'body', structure: region.structure })}
          aria-label={`${region.label}: vücutta göster`}
          title="Vücutta göster"
        >
          <BodyIcon size={17} />
        </button>
      )}
    </li>
  );
}

export function ImagingStudyList({ studies, compact }: { studies: ImagingStudy[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-850/60">
      {studies.map((s) => (
        <ImagingStudyCard key={s.key} study={s} compact={compact} />
      ))}
    </ul>
  );
}
