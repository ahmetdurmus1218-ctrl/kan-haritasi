import type { HealthModel } from '@kh/analysis';
import { GRAPH, interiorFor, isPositiveReport } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { go } from '../state/router';
import { organName } from '../lib/summary';
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
  const off = st?.labs.filter((l) => labTone(l) !== 'normal') ?? [];
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
            <ul className="space-y-1">
              {off.slice(0, 3).map((l) => (
                <li key={l.testKey} className={`flex items-center gap-2 text-sm ${labStyle(l).text}`}>
                  <span className={`h-2 w-2 rounded-full ${labStyle(l).dot}`} aria-hidden="true" />
                  <span className="flex-1">{l.name}</span>
                  <span className="tabular-nums">
                    {l.value.toLocaleString('tr-TR')} {l.unit}
                  </span>
                  <span className="text-xs">{labStyle(l).statusLabel}</span>
                </li>
              ))}
            </ul>
          )}
          {summary && <p className="leading-relaxed">{summary}</p>}
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
