import type { HealthModel } from '@kh/analysis';
import { GRAPH, interiorFor, isPositiveReport } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { go } from '../state/router';
import { organName, primaryOrgan } from '../lib/summary';
import { labStyle, labTone } from '../lib/tone';
import { Sheet } from './Sheet';
import { BodyIcon } from './icons';

/**
 * Organa dokununca açılan kısa özet (yeni sayfaya gitmeden): kaç bulgu var, kısa tanım ve dört yol —
 * Bulgular ve sonuçlar · Normalde nasıl çalışır? · 3B'de göster · Detaylı incele.
 */
export function OrganSheet({ organ, model, onClose }: { organ: string | null; model: HealthModel | null; onClose: () => void }) {
  const st = organ ? model?.organs.get(organ) : undefined;
  const node = organ ? GRAPH.node(organ) : undefined;
  const summary = node?.summary ?? (organ ? structureById.get(organ)?.blurb : undefined);
  // Önce bu organa özgü sonuçlar (birincil organı bu olanlar), sonra ilişkili diğerleri.
  const off = (st?.labs.filter((l) => labTone(l) !== 'normal') ?? []).sort((a, b) => Number(primaryOrgan(b.testKey) === organ) - Number(primaryOrgan(a.testKey) === organ));
  const patterns = st?.patterns.map((p) => p.title) ?? [];
  const imaging = (st?.imageObservations.filter((o) => o.kind === 'asymmetry').length ?? 0) + (st?.reportFindings.filter(isPositiveReport).length ?? 0) + (st?.modelFindings.length ?? 0);
  const interior = organ ? interiorFor(organ) : undefined;
  const goTo = (r: Parameters<typeof go>[0]) => {
    onClose();
    go(r);
  };
  return (
    <Sheet
      open={organ !== null}
      onClose={onClose}
      title={organ ? organName(organ) : ''}
      footer={
        organ ? (
          <button type="button" className="btn-primary flex-1 justify-center" onClick={() => goTo({ name: 'organ', id: organ })}>
            Detaylı incele
          </button>
        ) : undefined
      }
    >
      {organ && (
        <div className="space-y-4">
          <p className="text-[15px] text-fg">
            {off.length || imaging ? [off.length && `${off.length} sonuç aralık dışında`, imaging && `${imaging} görüntüleme bulgusu`].filter(Boolean).join(' · ') : st?.labs.length ? 'İlişkili sonuçların aralıkta.' : 'Bu organla ilgili verin yok.'}
          </p>
          {off.length > 0 && (
            <ul>
              {off.slice(0, 8).map((l) => (
                <li key={l.testKey} className="border-b border-ink-700/60 last:border-0">
                  <button type="button" className={`flex min-h-[40px] w-full items-center gap-2 text-left text-sm ${labStyle(l).text}`} onClick={() => goTo({ name: 'result', key: l.testKey })}>
                    <span className={`h-2 w-2 rounded-full ${labStyle(l).dot}`} aria-hidden="true" />
                    <span className="flex-1">{l.name}</span>
                    <span className="tabular-nums">
                      {l.value.toLocaleString('tr-TR')} {l.unit}
                    </span>
                    <span className="text-xs">{labStyle(l).statusLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {off.length > 8 && <p className="text-xs text-fg-faint">+{off.length - 8} ilişkili sonuç daha · “Bulgular ve sonuçlar”da</p>}
          {summary && <p className="leading-relaxed">{summary}</p>}
          {patterns.length > 0 && (
            <p className="rounded-xl bg-ink-800 px-3 py-2 text-[13px] leading-relaxed">
              <span className="font-semibold text-accent">Birlikte bakınca: </span>
              {patterns.slice(0, 3).join(' · ')}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost justify-center" onClick={() => goTo({ name: 'organ', id: organ, view: 'benim' })}>
              Bulgular ve sonuçlar
            </button>
            <button type="button" className="btn-ghost justify-center" onClick={() => goTo({ name: 'organ', id: organ, view: 'normal' })}>
              Normalde nasıl çalışır?
            </button>
            {interior && (
              <button type="button" className="btn-ghost justify-center" onClick={() => goTo({ name: 'interior', id: interior.organId })}>
                İçine gir
              </button>
            )}
            {(node?.structure || structureById.has(organ)) && (
              <button type="button" className={`btn-ghost justify-center ${interior ? '' : 'col-span-2'}`} onClick={() => goTo({ name: 'body', structure: node?.structure ?? organ })}>
                <BodyIcon size={15} /> 3B'de göster
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
