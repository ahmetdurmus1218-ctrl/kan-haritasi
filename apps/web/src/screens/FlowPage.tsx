/**
 * "Vücudun nasıl çalıştığını keşfet": sistem seç → akışı adım adım izle (← Önceki · 3 / 8 · Sonraki →).
 * Bu mod eğitseldir (normal fizyoloji). "Benim durumuma göre göster" açılınca kişinin sonuçları ilgili
 * basamaklara bağlanır; verisi olmayan basamak "sorunlu" gösterilmez, ilişki her zaman "olası"dır.
 */
import { useEffect, useMemo } from 'react';
import { FLOWS, FLOW_SYSTEM_LABEL, type FlowSystem, GRAPH, flowById, personalOverlay } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { type Route, go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { TONE, labStyle } from '../lib/tone';
import { INSIDE, type InsideId } from '../explore/inside/registry';
import { BodyIcon, ChevronLeftIcon, ChevronRightIcon, LayersIcon } from '../components/icons';
import { SourceBadge } from '../components/evidence';
import { LabRow } from './organ/common';

const nameOf = (id: string) => GRAPH.node(id)?.nameTr ?? structureById.get(id)?.nameTr ?? id;

function anatomyRoute(id: string): Route | undefined {
  const n = GRAPH.node(id);
  if (n) {
    const organ = GRAPH.pathTo(id).find((x) => x.kind === 'organ');
    if (n.kind === 'organ' || n.kind === 'region') return { name: 'organ', id: organ?.id ?? id };
    if (organ) return { name: 'organ', id: organ.id, view: 'derin', trail: [id] };
    return undefined;
  }
  return structureById.has(id) ? { name: 'organ', id } : undefined;
}

function FlowList() {
  const systems = [...new Set(FLOWS.map((f) => f.system))] as FlowSystem[];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Vücudun nasıl çalıştığını keşfet</h1>
        <p className="mt-2 text-[15px] text-fg-muted">Bir sistem seç; akışı adım adım, “Sonraki” ile izle. Genel fizyoloji bilgisidir.</p>
      </div>
      {systems.map((s) => (
        <section key={s} aria-label={FLOW_SYSTEM_LABEL[s]}>
          <h2 className="mb-2 text-sm font-medium text-fg-muted">{FLOW_SYSTEM_LABEL[s]}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {FLOWS.filter((f) => f.system === s).map((f) => (
              <li key={f.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4 text-left hover:border-ink-500" onClick={() => go({ name: 'flow', id: f.id, step: 1 })}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-fg">{f.title}</span>
                    <span className="block text-xs text-fg-muted">
                      {f.steps.length} adım · {f.summary}
                    </span>
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function FlowPage({ id, step = 1, personal = false }: { id?: string; step?: number; personal?: boolean }) {
  const { model } = useHealthModel();
  const flow = id ? flowById(id) : undefined;
  const overlay = useMemo(() => (flow && personal ? personalOverlay(flow, model) : null), [flow, personal, model]);
  const total = flow?.steps.length ?? 0;
  const index = Math.min(Math.max(1, step), Math.max(1, total)) - 1;

  // Klavye: ← / → ile önceki / sonraki adım.
  useEffect(() => {
    if (!flow) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' && index < total - 1) go({ name: 'flow', id: flow.id, step: index + 2, personal });
      if (e.key === 'ArrowLeft' && index > 0) go({ name: 'flow', id: flow.id, step: index, personal });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flow, index, total, personal]);

  if (!flow) return <FlowList />;
  const s = flow.steps[index]!;
  const rel = overlay?.relations.filter((r) => r.stepId === s.id) ?? [];
  const stepFindings = overlay?.findings.filter((f) => f.stepId === s.id) ?? [];
  const labs = rel.map((r) => model?.latestLabs.find((l) => l.testKey === r.testKey)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const anatomy = s.anatomyId ? anatomyRoute(s.anatomyId) : undefined;
  const scene = s.inside && s.inside in INSIDE ? (s.inside as InsideId) : undefined;
  const structure = s.anatomyId ? (GRAPH.node(s.anatomyId)?.structure ?? (structureById.has(s.anatomyId) ? s.anatomyId : undefined)) : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <nav aria-label="Şu anda neredeyim?" className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
        <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'mybody' })}>
          Vücut
        </button>
        <span className="text-fg-faint">›</span>
        <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'flow' })}>
          {FLOW_SYSTEM_LABEL[flow.system]}
        </button>
        <span className="text-fg-faint">›</span>
        <span className="text-fg" aria-current="location">
          {flow.title}
        </span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{flow.title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{flow.summary}</p>
        </div>
        <button
          type="button"
          aria-pressed={personal}
          className={`min-h-[44px] rounded-xl border px-3.5 text-sm ${personal ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
          onClick={() => go({ name: 'flow', id: flow.id, step: index + 1, personal: !personal })}
        >
          {personal ? 'Benim durumum gösteriliyor' : 'Benim durumuma göre göster'}
        </button>
      </div>

      {/* Akışın tamamı: her basamak tıklanabilir; kişisel modda yalnızca verisi olan basamaklar renklenir. */}
      <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Akışın basamakları">
        {flow.steps.map((x, k) => {
          const flagged = overlay?.relations.filter((r) => r.stepId === x.id && (r.status === 'high' || r.status === 'low')) ?? [];
          const found = overlay?.findings.some((f) => f.stepId === x.id) ?? false;
          const worst = flagged.map((r) => labStyle(r)).sort((a, b) => (b.tone === 'urgent' ? 3 : b.tone === 'attention' ? 2 : 1) - (a.tone === 'urgent' ? 3 : a.tone === 'attention' ? 2 : 1))[0];
          return (
            <li key={x.id} className="flex items-center gap-1">
              {k > 0 && <span className="text-fg-faint">↓</span>}
              <button
                type="button"
                aria-current={k === index ? 'step' : undefined}
                className={`min-h-[32px] rounded-full border px-2.5 ${k === index ? 'border-accent/60 bg-accent/10 text-accent' : worst ? `${worst.chip}` : found ? TONE.uncertain.chip : 'border-ink-600 text-fg-muted hover:text-fg'}`}
                onClick={() => go({ name: 'flow', id: flow.id, step: k + 1, personal })}
              >
                {x.title}
                {worst ? ` ${worst.direction === 'high' ? '▲' : '▼'}` : ''}
                {found ? ' ◆' : ''}
              </button>
            </li>
          );
        })}
      </ol>

      <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4 md:p-5" aria-label="Bu basamak">
        <p className="text-xs text-fg-faint">
          {index + 1} / {total} · Normalde
        </p>
        <h2 className="text-xl font-semibold">{s.title}</h2>
        <p className="text-[15px] leading-relaxed text-fg">{s.normalExplanation}</p>
        <div className="flex flex-wrap gap-2">
          {anatomy && (
            <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go(anatomy)}>
              {s.anatomyId ? nameOf(s.anatomyId) : 'Anatomi'} <ChevronRightIcon size={14} />
            </button>
          )}
          {scene && (
            <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'simulation', id: scene, ...(structure ? { from: structure } : {}), mode: personal ? 'benim' : 'temel' })}>
              <LayersIcon size={15} /> İçeri gir · {INSIDE[scene].title}
            </button>
          )}
          {structure && (
            <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'body', structure })}>
              <BodyIcon size={15} /> 3B
            </button>
          )}
        </div>
        {s.relatedOrgans.filter((o) => o !== (s.anatomyId ? GRAPH.pathTo(s.anatomyId).find((n) => n.kind === 'organ')?.id ?? s.anatomyId : '')).length > 0 && (
          <p className="text-[13px] text-fg-muted">
            İlgili organlar:{' '}
            {s.relatedOrgans.map((o, k) => {
              const r = anatomyRoute(o);
              return (
                <span key={o}>
                  {k > 0 && ', '}
                  {r ? (
                    <button type="button" className="underline decoration-ink-500 underline-offset-2 hover:text-accent" onClick={() => go(r)}>
                      {nameOf(o)}
                    </button>
                  ) : (
                    nameOf(o)
                  )}
                </span>
              );
            })}
          </p>
        )}

        {personal && (
          <div className="space-y-2 border-t border-ink-700 pt-3" aria-label="Benim verilerim">
            <p className="text-xs font-medium text-fg-muted">Benim verilerimde</p>
            {labs.length > 0 && (
              <ul className="space-y-1.5">
                {labs.map((l) => (
                  <LabRow key={l.testKey} l={l} compact />
                ))}
              </ul>
            )}
            {stepFindings.length > 0 && (
              <ul className="space-y-1.5" aria-label="Bu basamakla ilişkili görüntü/rapor bulguları">
                {stepFindings.map((f, k) => (
                  <li key={k} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[13px] ${f.source === 'IMAGE_MODEL' ? 'border-[#a78bfa]/40' : TONE['report-derived'].border}`} data-testid="flow-finding">
                    <SourceBadge source={f.source} />
                    <span className="text-fg">{f.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {!labs.length && !stepFindings.length && (
              <p className="text-sm text-fg-muted">Bu basamakla ilişkili bir sonucun yok. Verisi olmayan basamak “sorunlu” sayılmaz.</p>
            )}
            {rel.some((r) => r.status === 'high' || r.status === 'low') && <p className={`text-[13px] ${TONE.uncertain.text}`}>Bu sonuç bu basamağı etkileyebilir (olası ilişki); basamağın bozulduğunu göstermez.</p>}
          </div>
        )}
      </section>

      {personal && overlay && <p className="rounded-xl border border-ink-600/60 px-3 py-2 text-[13px] text-fg-muted">{overlay.statement}</p>}

      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" disabled={index === 0} onClick={() => go({ name: 'flow', id: flow.id, step: index, personal })}>
          <ChevronLeftIcon size={15} /> Önceki
        </button>
        <span className="text-sm text-fg-muted" aria-live="polite">
          {index + 1} / {total}
        </span>
        {index < total - 1 ? (
          <button type="button" className="btn-primary min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'flow', id: flow.id, step: index + 2, personal })}>
            Sonraki <ChevronRightIcon size={15} />
          </button>
        ) : (
          <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'flow' })}>
            Başka akış seç
          </button>
        )}
      </div>
      <p className="text-[11px] text-fg-faint">Eğitsel, genel fizyoloji. Kan Haritası tanı koymaz.</p>
    </div>
  );
}
