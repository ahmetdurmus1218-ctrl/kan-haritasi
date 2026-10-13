/**
 * Ana sayfa: tek bir soruya cevap verir — "Vücudum nasıl?". İlk ekranda yalnızca kısa özet, iki ana
 * eylem (Veri ekle, Vücudumu gör) ve en fazla üç "Son durum" kartı vardır. Veri yoksa boş durum ve
 * doğrudan yükleme alanı gösterilir; boş tablo veya sıfırlarla dolu kartlar gösterilmez.
 */
import { useMemo, useState } from 'react';
import { type Route, go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { bodySummary, organName, whatChanged } from '../lib/summary';
import { TONE } from '../lib/tone';
import { formatDate } from '../lib/format';
import { Uploader } from '../components/Uploader';
import { BodyIcon, ChevronRightIcon, PlusIcon, SpinnerIcon } from '../components/icons';

function Card({ title, detail, onClick, tone }: { title: string; detail?: string; onClick: () => void; tone?: keyof typeof TONE }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 px-4 py-3.5 text-left transition hover:border-ink-500">
        {tone && tone !== 'normal' && <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[tone].dot}`} aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-fg">{title}</span>
          {detail && <span className="block truncate text-xs text-fg-muted">{detail}</span>}
        </span>
        <span className="text-fg-faint">
          <ChevronRightIcon size={16} />
        </span>
      </button>
    </li>
  );
}

export function HomePage({ navigate }: { navigate: (r: Route) => void }) {
  const { model, studies } = useHealthModel();
  // Ana sayfa boş açıldıysa yükleme alanı bu ziyaret boyunca kalır: ilk dosya eklenince özet görünümüne
  // atlayıp yükleme satırını ("Aç ve oku") kaybettirmez.
  const [startedEmpty, setStartedEmpty] = useState<boolean | null>(null);
  const summary = useMemo(() => (model ? bodySummary(model) : null), [model]);
  const changes = useMemo(() => (model ? whatChanged(model, studies ?? [], 6) : []), [model, studies]);

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
          {hasAny ? 'Verin eklendi. “Aç ve oku” ile incele; özetin bir sonraki açılışta burada olacak.' : 'Henüz sağlık verisi eklemedin. İlk verini ekleyerek başlayabilirsin: tahlil, rapor ya da MR, EKG gibi bir görüntü.'}
        </p>
        <div className="mt-6">
          <Uploader navigate={navigate} />
        </div>
        <p className="mt-6 text-center text-xs text-fg-faint">Veriler yalnızca bu cihazda, şifreli durur. Kan Haritası tanı koymaz.</p>
      </div>
    );

  const organs = summary.organs;
  const headline = summary.urgent.length
    ? 'Acil değerlendirme gerektirebilecek bir sonucun var. Doktor değerlendirmesi gerekir.'
    : organs.length
      ? `${organs.length} organda dikkat çeken sonuç var${summary.follow.length ? ` · ${summary.follow.length} değer takipte` : ''}.`
      : summary.follow.length
        ? `Belirgin bir sorun görünmüyor; ${summary.follow.length} değer hafifçe aralık dışında (takip).`
        : 'Kayıtlı verilerinde dikkat çeken bir şey görünmüyor.';
  // En fazla üç kart: en önemli organ, son değişiklik, son eklenen.
  const cards: Array<{ title: string; detail?: string; route: Route; tone?: keyof typeof TONE }> = [];
  const urgent = summary.urgent[0];
  if (urgent) cards.push({ title: urgent.label, detail: `${urgent.detail} · acil değerlendirme gerektirebilir`, route: urgent.route, tone: 'urgent' });
  const top = organs[0];
  if (top)
    cards.push({
      title: `${organName(top.organ)}: ${top.reasons.length} konu`,
      detail: top.reasons.slice(0, 3).join(' · ') + (organs.length > 1 ? ` · +${organs.length - 1} organ daha` : ''),
      route: { name: 'organ', id: top.organ, view: 'benim' },
      tone: top.tone,
    });
  const changed = changes.filter((c) => c.icon !== '+');
  if (changed.length) cards.push({ title: changed.length === 1 ? changed[0]!.label : `${changed.length} sonuçta değişiklik var`, detail: changed.slice(0, 3).map((c) => `${c.icon} ${c.label}`).join(' · '), route: { name: 'timeline' } });
  const latest = changes.find((c) => c.icon === '+');
  if (latest) cards.push({ title: latest.label, detail: formatDate(latest.date), route: latest.route });
  else if (model.latestLabs.length) cards.push({ title: `${model.latestLabs.length} tahlil sonucu`, detail: 'Tüm sonuçları gör', route: { name: 'results' } });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Vücudum nasıl?</h1>
      <p className={`mt-2 text-[15px] leading-relaxed ${summary.urgent.length ? 'text-danger' : 'text-fg-muted'}`}>{headline}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => go({ name: 'add' })} className="btn-primary min-h-[52px] justify-center text-[15px]">
          <PlusIcon size={18} /> Veri ekle
        </button>
        <button type="button" onClick={() => go({ name: 'mybody' })} className="btn-ghost min-h-[52px] justify-center text-[15px]">
          <BodyIcon size={18} /> Vücudumu gör
        </button>
      </div>

      <section className="mt-10" aria-labelledby="son-durum">
        <h2 id="son-durum" className="mb-3 text-sm font-medium text-fg-muted">
          Son durum
        </h2>
        <ul className="space-y-2.5">
          {cards.slice(0, 3).map((c) => (
            <Card key={c.title} title={c.title} detail={c.detail} tone={c.tone} onClick={() => go(c.route)} />
          ))}
        </ul>
        {organs.length + summary.follow.length > 1 && (
          <button type="button" className="mt-3 text-sm text-accent hover:underline" onClick={() => go({ name: 'mybody' })}>
            Tüm bulgular →
          </button>
        )}
      </section>
    </div>
  );
}
