/**
 * Ana ekran (B + C): "Vücudum nasıl?" sorusuna vücut şemasıyla cevap verir. Üstte arama (menünün yerini
 * alır), ortada dikkat gerektiren organlar şema üzerinde; organa dokununca kısa özet alt pencerede açılır.
 * Altında "Tüm değerler · 3B · Tomografi" ve "Son eklenenler" kartları. Veri yoksa boş durum ve doğrudan
 * yükleme alanı gösterilir; boş tablo veya sıfırlarla dolu kartlar gösterilmez.
 */
import { useMemo, useState } from 'react';
import { findingClass } from '@kh/analysis';
import { type Route, go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { bodySummary, headlineOf, whatChanged } from '../lib/summary';
import { formatDate } from '../lib/format';
import { labTone } from '../lib/tone';
import { brainFindings } from '../lib/brainReport';
import { CATEGORY_SHORT, regionByKey } from '../lib/imaging';
import type { ImagingStudy } from '../lib/imagingStudies';
import { Uploader } from '../components/Uploader';
import { BodySchema } from '../components/BodySchema';
import { OrganSheet } from '../components/OrganSheet';
import { Banner } from '../components/ui';
import { BrainIcon, ChartIcon, ChevronRightIcon, FileTextIcon, LayersIcon, ScanIcon, SearchIcon, SpinnerIcon } from '../components/icons';

function studyLine(st: ImagingStudy): string {
  const a = st.note?.analysis;
  const vol = st.note?.volume;
  const volN = [vol, ...(st.note?.pathology ?? [])].reduce((n, v) => n + (v?.structures.filter((x) => findingClass(x) === 'finding').length ?? 0), 0);
  const modelN = (a?.modelFindings?.length ?? 0) + volN;
  if (modelN) return `Yerel AI modeli: ${modelN} bulgu · ön bilgi`;
  if (a?.kind === 'model' || vol) return 'Yerel AI modeli: belirgin bulgu yok';
  if (st.conclusion) return st.conclusion;
  return 'Görüntü kaydedildi';
}

export function HomePage({ navigate }: { navigate: (r: Route) => void }) {
  const { model, studies } = useHealthModel();
  // Ana sayfa boş açıldıysa yükleme alanı bu ziyaret boyunca kalır: ilk dosya eklenince özet görünümüne
  // atlayıp yükleme satırını ("Aç ve oku") kaybettirmez; "Vücut haritamı göster" ile özete geçilir.
  const [startedEmpty, setStartedEmpty] = useState<boolean | null>(null);
  const [organ, setOrgan] = useState<string | null>(null);
  const summary = useMemo(() => (model ? bodySummary(model) : null), [model]);
  const changes = useMemo(() => (model ? whatChanged(model, studies ?? [], 6) : []), [model, studies]);
  const brain = useMemo(() => (studies ? brainFindings(studies) : []), [studies]);

  if (model && summary && startedEmpty === null) setStartedEmpty(!(summary.hasData || (studies?.length ?? 0) > 0));

  if (!model || !summary)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Hazırlanıyor…
      </div>
    );

  const hasAny = summary.hasData || (studies?.length ?? 0) > 0;

  if (!hasAny || startedEmpty)
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Vücudum nasıl?</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          {hasAny ? 'Verin eklendi. “Aç ve oku” ile incele; sonra vücut haritan burada.' : 'Henüz sağlık verisi eklemedin. İlk verini ekleyerek başlayabilirsin: tahlil, rapor ya da MR, EKG gibi bir görüntü.'}
        </p>
        {hasAny && (
          <button type="button" className="btn-ghost mt-4" onClick={() => setStartedEmpty(false)}>
            Vücut haritamı göster
          </button>
        )}
        <div className="mt-6">
          <Uploader navigate={navigate} />
        </div>
        <p className="mt-6 text-center text-xs text-fg-faint">Veriler yalnızca bu cihazda, şifreli durur. Kan Haritası tanı koymaz.</p>
      </div>
    );

  const organs = summary.organs;
  // Etiketteki sayı = organ penceresinde listelenen aralık dışı sonuç sayısı (iki yer aynı sayıyı gösterir).
  const counts = Object.fromEntries(organs.map((o) => [o.organ, model.organs.get(o.organ)?.labs.filter((l) => labTone(l) !== 'normal').length ?? 0]));
  const headline = headlineOf(summary);
  const labs = model.latestLabs;
  const high = labs.filter((l) => l.status === 'high').length;
  const low = labs.filter((l) => l.status === 'low').length;
  const normal = labs.filter((l) => l.status === 'normal').length;
  const labDate = labs.reduce((d, l) => (l.date > d ? l.date : d), '');
  const latestStudies = [...(studies ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const brainFlagged = brain.filter((b) => b.finding.status === 'abnormal' || b.finding.status === 'uncertain');
  const changed = changes.filter((c) => c.icon !== '+');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-3 md:px-8 md:py-12">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('kh:search'))}
        className="flex h-12 w-full items-center gap-2.5 rounded-2xl border border-ink-600 bg-ink-850 px-4 text-left text-[15px] text-fg-faint transition hover:border-accent/60"
        data-testid="home-search"
      >
        <SearchIcon size={18} /> Değer, organ ya da konu ara…
      </button>

      <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight">Vücudum nasıl?</h1>
      <p className={`mt-1 text-[15px] leading-relaxed ${summary.urgent.length ? 'text-danger' : 'text-fg-muted'}`}>
        {headline}
        {organs.length > 0 && <span className="text-fg-faint"> Bir organa dokun.</span>}
      </p>

      {summary.urgent.length > 0 && (
        <div className="mt-3">
          <Banner tone="error">
            <button type="button" className="text-left" onClick={() => go(summary.urgent[0]!.route)}>
              <span className="font-medium">{summary.urgent[0]!.label}</span> · {summary.urgent[0]!.detail} · acil değerlendirme gerektirebilir →
            </button>
          </Banner>
        </div>
      )}

      <div className="mt-3">
        <BodySchema organs={organs} counts={counts} onOrgan={setOrgan} />
        {!organs.length && <p className="mt-1 text-center text-sm text-fg-muted">Organlarla ilişkili dikkat çeken sonuç yok.</p>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" className="btn-ghost min-h-[44px] justify-center rounded-full px-2 text-[13px]" onClick={() => go({ name: 'results' })}>
          Tüm değerler
        </button>
        <button type="button" className="btn-ghost min-h-[44px] justify-center rounded-full px-2 text-[13px]" onClick={() => go({ name: 'body' })}>
          <LayersIcon size={15} /> 3B
        </button>
        <button type="button" className="btn-ghost min-h-[44px] justify-center rounded-full px-2 text-[13px]" onClick={() => go({ name: 'tomography' })}>
          Tomografi
        </button>
      </div>

      <section className="mt-7" aria-labelledby="son-eklenenler">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 id="son-eklenenler" className="label-caps">
            Son eklenenler
          </h2>
          <a href="#/belgeler" className="text-[13px] font-medium text-accent hover:underline">
            Tüm dosyalar
          </a>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2" data-testid="recent">
          {labs.length > 0 && (
            <button type="button" className="flex flex-col gap-2 card p-3.5 text-left transition hover:border-accent/50" onClick={() => go({ name: 'results' })} data-testid="recent-labs">
              <span className="flex items-center justify-between gap-2 text-[14px] font-semibold text-fg">
                <span className="flex items-center gap-2">
                  <FileTextIcon size={16} /> Kan tahlili
                </span>
                <span className="text-xs font-normal text-fg-faint">{labDate ? formatDate(labDate) : ''}</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className={`text-[26px] font-bold leading-none ${high + low ? 'text-high' : 'text-accent'}`}>{high + low}</span>
                <span className="text-xs text-fg-muted">/ {labs.length} değer aralık dışında</span>
              </span>
              <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {high > 0 && <span className="bg-high" style={{ flex: high }} />}
                {low > 0 && <span className="bg-low" style={{ flex: low }} />}
                {normal > 0 && <span className="bg-accent" style={{ flex: normal }} />}
              </span>
            </button>
          )}
          {latestStudies.map((st) => {
            const region = st.region ? regionByKey.get(st.region)?.label : undefined;
            return (
              <button key={st.key} type="button" className="flex items-start gap-3 card p-3.5 text-left transition hover:border-accent/50" onClick={() => go({ name: 'document', id: st.head.id })} data-testid="recent-study">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <ScanIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-fg">
                    {CATEGORY_SHORT[st.category]}
                    {region ? ` · ${region}` : ''}
                  </span>
                  <span className="line-clamp-2 block text-xs text-fg-muted">{studyLine(st)}</span>
                  <span className="block text-[11px] text-fg-faint">{formatDate(st.date)}</span>
                </span>
              </button>
            );
          })}
          {brain.length > 0 && (
            <button type="button" className="flex items-center gap-3 card p-3.5 text-left transition hover:border-accent/50" onClick={() => go({ name: 'brain' })}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <BrainIcon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-fg">{brainFlagged.length ? `Beyin raporun: ${brainFlagged.length} dikkat çeken cümle` : 'Beyin raporun: dikkat çeken cümle yok'}</span>
                <span className="block text-xs text-fg-muted">Beyin haritasında bölge bölge gör</span>
              </span>
              <ChevronRightIcon size={16} className="text-fg-faint" />
            </button>
          )}
          {changed.length > 0 && (
            <button type="button" className="flex items-center gap-3 card p-3.5 text-left transition hover:border-accent/50" onClick={() => go({ name: 'timeline' })}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <ChartIcon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-fg">{changed.length === 1 ? changed[0]!.label : `${changed.length} sonuçta değişiklik var`}</span>
                <span className="block truncate text-xs text-fg-muted">{changed.slice(0, 3).map((c) => `${c.icon} ${c.label}`).join(' · ')}</span>
              </span>
              <ChevronRightIcon size={16} className="text-fg-faint" />
            </button>
          )}
        </div>
      </section>
      <p className="mt-6 text-center text-xs text-fg-faint">Veriler yalnızca bu cihazda, şifreli · Kan Haritası tanı koymaz.</p>

      <OrganSheet organ={organ} model={model} onClose={() => setOrgan(null)} />
    </div>
  );
}
