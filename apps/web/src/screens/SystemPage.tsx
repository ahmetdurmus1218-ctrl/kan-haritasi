/**
 * Sistem sayfası (Vücut › Sindirim sistemi): sistemin organları ve akışları. Organ seçimi organın
 * genel bakışına gider (ağaç değil).
 */
import { FLOWS, FLOW_SYSTEM_LABEL, GRAPH, type FlowSystem } from '@kh/analysis';
import { STRUCTURES } from '@kh/catalog';
import { go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { bodySummary } from '../lib/summary';
import { TONE } from '../lib/tone';
import { BodyIcon, ChevronRightIcon } from '../components/icons';
import { systemName } from './organ/common';

export function SystemPage({ id }: { id: string }) {
  const { model } = useHealthModel();
  const summary = model ? bodySummary(model) : null;
  const graphOrgans = [...GRAPH.nodes.values()].filter((n) => n.kind === 'organ' && GRAPH.systemsOf(n.id).some((s) => s.id === `system:${id}`));
  const seen = new Set(graphOrgans.map((n) => n.structure ?? n.id));
  const catalogOnly = STRUCTURES.filter((s) => s.systems.includes(id as never) && !seen.has(s.id));
  const flows = FLOWS.filter((f) => f.system === id);
  const organs = [...graphOrgans.map((n) => ({ id: n.id, name: n.nameTr, rich: true })), ...catalogOnly.map((s) => ({ id: s.id, name: s.nameTr, rich: false }))];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <nav aria-label="Şu anda neredeyim?" className="flex items-center gap-1 text-xs text-fg-muted">
        <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'mybody' })}>
          Vücut
        </button>
        <span className="text-fg-faint">›</span>
        <span className="text-fg" aria-current="location">
          {systemName(id)}
        </span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{systemName(id)}</h1>
        <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'body', system: id })}>
          <BodyIcon size={15} /> 3B'de gör
        </button>
      </div>
      <section aria-label="Organlar">
        <h2 className="mb-2 text-sm font-medium text-fg-muted">Organlar</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {organs.map((o) => {
            const att = summary?.organs.find((x) => x.organ === o.id);
            return (
              <li key={o.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4 text-left hover:border-ink-500" onClick={() => go({ name: 'organ', id: o.id })}>
                  {att && <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[att.tone].dot}`} aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-fg">{o.name}</span>
                    {att && <span className="block truncate text-xs text-fg-muted">{att.reasons.slice(0, 2).join(' · ')}</span>}
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {flows.length > 0 && (
        <section aria-label="Nasıl çalışır">
          <h2 className="mb-2 text-sm font-medium text-fg-muted">Nasıl çalışır? · {FLOW_SYSTEM_LABEL[id as FlowSystem]}</h2>
          <ul className="space-y-2">
            {flows.map((f) => (
              <li key={f.id}>
                <button type="button" className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ink-600/60 p-4 text-left hover:border-ink-500" onClick={() => go({ name: 'flow', id: f.id, step: 1 })}>
                  <span>
                    <span className="block text-[15px] text-fg">{f.title}</span>
                    <span className="block text-xs text-fg-muted">{f.steps.length} adım · adım adım izle</span>
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
