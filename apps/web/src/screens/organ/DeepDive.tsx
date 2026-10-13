/**
 * Derinlemesine inceleme: bulunduğun düğüm ve bir alt seviye. Ağacın tamamı açılmaz; her seviye
 * "Bir seviye daha" ile açılır ve yol (Vücut › Sistem › Organ › … ) ile seviye ("Seviye 4 / Hücre")
 * her an görünür. Geri dönüş breadcrumb ya da tarayıcının geri tuşuyla.
 */
import { GRAPH, type HealthModel, type KNode, type OrganView, RELATION_LABEL } from '@kh/analysis';
import { go } from '../../state/router';
import { INSIDE } from '../../explore/inside/registry';
import { ChevronLeftIcon, ChevronRightIcon, LayersIcon } from '../../components/icons';
import { Breadcrumb, LabRow, LevelBadge, deeperLabel, sceneFor } from './common';

export function DeepDive({ v, model, trail }: { v: OrganView; model: HealthModel | null; trail: string[] }) {
  const valid = trail.filter((t) => GRAPH.node(t));
  const current: KNode = valid.length ? GRAPH.node(valid[valid.length - 1]!)! : v.node;
  const children = GRAPH.drill(current.id).filter((d) => d.node.kind !== 'biomarker');
  const effects = GRAPH.edgesFrom(current.id)
    .filter((e) => e.rel === 'leads_to' || e.rel === 'regulates' || e.rel === 'affects')
    .map((e) => ({ node: GRAPH.node(e.to)!, rel: e.rel, note: e.note }))
    .filter((x) => x.node.kind !== 'organ');
  const markers = GRAPH.edgesFrom(current.id, 'measured_by').map((e) => GRAPH.node(e.to)!);
  const labs = model?.latestLabs ?? [];
  const scene = sceneFor(current.id, v.node.structure);
  const up = valid.length ? { name: 'organ' as const, id: v.node.id, view: 'derin' as const, trail: valid.slice(0, -1) } : { name: 'organ' as const, id: v.node.id };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => go(up)}>
          <ChevronLeftIcon size={14} /> Bir seviye yukarı
        </button>
        <Breadcrumb organId={v.node.id} trail={valid} current={valid.length ? undefined : 'Derinlemesine'} />
      </div>

      <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Bulunduğun seviye">
        <LevelBadge node={current} />
        <h1 className="text-2xl font-semibold tracking-tight">{current.nameTr}</h1>
        <p className="text-[15px] leading-relaxed text-fg">{current.summary}</p>
        {scene && (
          <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'simulation', id: scene, from: v.node.structure, mode: 'temel' })}>
            <LayersIcon size={15} /> İçeri gir · {INSIDE[scene].title}
          </button>
        )}
        {markers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-fg-muted">Bu seviye şu testlerle izlenir:</p>
            <ul className="space-y-1">
              {markers.map((m) => {
                const l = m.testKey ? labs.find((x) => x.testKey === m.testKey) : undefined;
                return l ? (
                  <LabRow key={m.id} l={l} compact />
                ) : (
                  <li key={m.id} className="rounded-xl border border-ink-600/60 px-3 py-2 text-sm text-fg-muted">
                    {m.nameTr} <span className="text-xs text-fg-faint">· sonucun yok</span>
                  </li>
                );
              })}
            </ul>
            {markers.some((m) => m.testKey && labs.some((x) => x.testKey === m.testKey && x.status !== 'normal')) && (
              <p className="text-[11px] text-fg-faint">Sonuç bu süreçle ilişkili olabilir (olası ilişki); sürecin bozulduğunu göstermez.</p>
            )}
          </div>
        )}
      </section>

      {children.length > 0 ? (
        <section className="space-y-2" aria-label="Bir alt seviye">
          <h2 className="label-caps">Bir seviye daha</h2>
          <ul className="space-y-2">
            {children.map(({ node, rel, note }) => (
              <li key={`${rel}-${node.id}`} className="rounded-2xl border border-ink-600/60 bg-ink-850/40 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge node={node} />
                  <span className="text-[11px] text-fg-faint">{current.nameTr} {RELATION_LABEL[rel]}</span>
                </div>
                <p className="mt-1 text-[15px] font-medium text-fg">{node.nameTr}</p>
                <p className="text-[13px] leading-relaxed text-fg-muted">{note ?? node.summary}</p>
                <button type="button" className="btn-ghost mt-2 min-h-[40px] px-3 text-sm" onClick={() => go({ name: 'organ', id: v.node.id, view: 'derin', trail: [...valid, node.id] })}>
                  {deeperLabel(node)} <ChevronRightIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-ink-600 p-4 text-sm text-fg-muted">Bu, bilgi grafiğinde bu dalın en alt seviyesi.</p>
      )}

      {effects.length > 0 && (
        <section className="space-y-2" aria-label="Neyi etkiler">
          <h2 className="label-caps">Bu neyi etkiler?</h2>
          <ul className="flex flex-wrap gap-1.5">
            {effects.map((e) => (
              <li key={e.node.id}>
                <button type="button" className="min-h-[36px] rounded-full border border-ink-600 px-3 py-1 text-sm text-fg-muted hover:text-fg" title={e.note} onClick={() => go({ name: 'organ', id: v.node.id, view: 'derin', trail: [...valid, e.node.id] })}>
                  {RELATION_LABEL[e.rel]} → {e.node.nameTr}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[11px] text-fg-faint">Genel anatomi ve fizyoloji bilgisidir (kişiye özel değil).</p>
    </div>
  );
}
