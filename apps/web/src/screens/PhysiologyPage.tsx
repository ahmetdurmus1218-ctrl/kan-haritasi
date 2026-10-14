/**
 * Fizyoloji grafiği (#/fizyoloji, #/fizyoloji/<zincir>): organlar arası süreçler (glukoz, oksijen, B12,
 * demir, ALT/AST, böbrek, sindirim, tiroid, D vitamini, lipidler, bilirubin). Her düğüm "Bunun devamı
 * nerede?" ile iç dünyaya ya da organ sayfasına götürür; kişinin ölçülen sonuçları olası ilişki olarak işaretlenir.
 */
import { PHYSIO_CHAINS, physioChain, physioOverlay } from '@kh/analysis';
import { go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { PhysioChainView } from '../components/physiology';
import { ChevronLeftIcon, ChevronRightIcon, SpinnerIcon } from '../components/icons';
import { Section } from './organ/common';

export function PhysiologyPage({ id }: { id?: string }) {
  const { model } = useHealthModel();
  const chain = id ? physioChain(id) : undefined;
  if (!model)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Hazırlanıyor…
      </div>
    );
  if (chain)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => go({ name: 'physiology' })}>
          <ChevronLeftIcon size={14} /> Fizyoloji zincirleri
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">{chain.title}</h1>
        <p className="text-[15px] text-fg-muted">{chain.summary}</p>
        <p className="text-[11.5px] text-fg-faint">Genel eğitim bilgisi (normal fizyoloji). Senin sonuçların yalnızca ölçüldükleri basamakta, olası ilişki olarak gösterilir.</p>
        <Section title="Zincir · organlar arası">
          <PhysioChainView chain={chain} model={model} />
        </Section>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Vücudun süreçleri</h1>
      <p className="text-[15px] text-fg-muted">Organlar birbirinden bağımsız çalışmaz. Bir sürece dokun; her basamaktan o organın içine geçebilirsin.</p>
      <ul className="space-y-2">
        {PHYSIO_CHAINS.map((c) => {
          const ov = physioOverlay(c, model);
          const off = ov.markers.filter((m) => m.latest.status === 'high' || m.latest.status === 'low').length;
          return (
            <li key={c.id}>
              <button type="button" className="btn-ghost min-h-[56px] w-full justify-between px-3.5 text-left" onClick={() => go({ name: 'physiology', id: c.id })} data-testid="physio-chain-link" data-chain={c.id}>
                <span>
                  <span className="block text-sm font-medium text-fg">{c.title}</span>
                  <span className="block text-xs text-fg-muted">
                    {c.summary}
                    {ov.hasData ? ` · ${ov.markers.length} sonucun bu zincirde${off ? ` (${off} referans dışı)` : ''}` : ''}
                  </span>
                </span>
                <ChevronRightIcon size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
