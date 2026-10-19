/**
 * "İÇİNE GİR": bilgi grafiğinde bulunduğun düğüm, soru soru.
 *
 *   Burada ne var?            → düğümün anatomisi ve seviyesi
 *   Daha içinde ne var?        → bölümler (part_of), doku/hücre/hücre içi yapı (made_of)
 *   Bu nasıl çalışıyor?        → yürüttüğü süreçler ve ürettikleri; neyi etkilediği
 *   Yanında ne var?            → komşuluk/bağlantı ve aynı vücut bölgesi (hiyerarşi değil)
 *   Nasıl beslenir/sinirlenir? → kanlanma, boşaltım, sinirlenme, gelişim kökeni
 *   Bende ne görülmüş?         → yalnızca gerçek veri (tahlil, model bulgusu/yapısı, rapor), kaynağıyla
 *   Gerçek görüntüde / 3B'de   → yalnızca gerçek konum varsa
 *
 * GENEL ANATOMİ (herkes için) ile KİŞİSEL VERİ (yalnızca bu kişiye ait kayıtlar) ayrı gösterilir.
 */
import { GRAPH, type HealthModel, INSIDE_DEPTH_TR, type KNode, LEVEL, type OrganView, RELATION_LABEL, insideCapability } from '@kh/analysis';
import { go } from '../../state/router';
import { INSIDE } from '../../explore/inside/registry';
import { personalHere, routeForNode } from '../../lib/anatomyNav';
import { SourceBadge } from '../../components/evidence';
import { BodyIcon, ChevronLeftIcon, ChevronRightIcon, LayersIcon, ScanIcon } from '../../components/icons';
import { Breadcrumb, LabRow, LevelBadge, deeperLabel, sceneFor } from './common';

const GROUP: Array<{ title: string; rels: string[] }> = [
  { title: 'Bölümleri', rels: ['part_of'] },
  { title: 'Dokusu, hücreleri ve hücre içi yapıları', rels: ['made_of'] },
  { title: 'Bu nasıl çalışıyor? (yürüttüğü süreçler)', rels: ['performs'] },
  { title: 'Ürettikleri', rels: ['produces'] },
];

const ml = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} L` : `${v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL`);

/** Düğümü ya da 3B yapısı olan en yakın üst düğümü 3B'de göster. */
function bodyRouteFor(node: KNode, organ: KNode) {
  const withStructure = [...GRAPH.pathTo(node.id)].reverse().find((n) => n.structure) ?? (organ.structure ? organ : undefined);
  if (!withStructure?.structure) return undefined;
  return withStructure.part ? { name: 'body' as const, structure: withStructure.structure, part: withStructure.part } : { name: 'body' as const, structure: withStructure.structure };
}

export function DeepDive({ v, model, trail }: { v: OrganView; model: HealthModel | null; trail: string[] }) {
  const valid = trail.filter((t) => GRAPH.node(t));
  const current: KNode = valid.length ? GRAPH.node(valid[valid.length - 1]!)! : v.node;
  const children = GRAPH.drill(current.id).filter((d) => d.node.kind !== 'biomarker');
  const effects = GRAPH.edgesFrom(current.id)
    .filter((e) => e.rel === 'leads_to' || e.rel === 'regulates' || e.rel === 'affects')
    .map((e) => ({ node: GRAPH.node(e.to)!, rel: e.rel, note: e.note }));
  const neighbors = GRAPH.neighbors(current.id);
  // Hücre/süreç/molekül seviyesinde: düğümden başlayan kısa fizyoloji zincirleri (ör. granüloza → östradiol → döngü)
  const chains = LEVEL[current.kind] >= LEVEL.tissue ? GRAPH.chains(current.id, 4, 30).filter((c) => c.length >= 3 && c.every((n) => n.kind !== 'biomarker')).sort((a, b) => b.length - a.length).slice(0, 5) : [];
  const regionMembers = current.kind === 'body-region' ? GRAPH.regionMembers(current.id) : [];
  const regions = current.kind === 'body-region' ? [] : GRAPH.regionsOf(current.id);
  const sameRegion = current.kind === 'organ' ? regions.flatMap((r) => GRAPH.regionMembers(r.id)).filter((n, i, a) => n.id !== current.id && n.kind === 'organ' && a.findIndex((x) => x.id === n.id) === i).slice(0, 12) : [];
  const supply = GRAPH.supply(current.id);
  const markers = GRAPH.edgesFrom(current.id, 'measured_by').map((e) => GRAPH.node(e.to)!);
  const labs = model?.latestLabs ?? [];
  const scene = sceneFor(current.id, v.node.structure);
  const mine = personalHere(current, v, model);
  const hasMine = mine.labs.length + mine.modelFindings.length + mine.modelStructures.length + mine.reportFindings.length > 0;
  const body3d = bodyRouteFor(current, v.node);
  const up = valid.length ? { name: 'organ' as const, id: v.node.id, view: 'derin' as const, trail: valid.slice(0, -1) } : { name: 'organ' as const, id: v.node.id };
  const into = (n: KNode) => (valid.length < 8 ? go({ name: 'organ', id: v.node.id, view: 'derin', trail: [...valid, n.id] }) : go(routeForNode(n.id)));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8 md:py-10" data-testid="deep-dive" data-node={current.id}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => go(up)}>
          <ChevronLeftIcon size={14} /> Bir seviye yukarı
        </button>
        <Breadcrumb organId={v.node.id} trail={valid} current={valid.length ? undefined : 'İçine gir'} />
      </div>

      <section className="space-y-3 card p-4" aria-label="Burada ne var?">
        <div className="flex flex-wrap items-center gap-2">
          <LevelBadge node={current} />
          <span className="rounded-md border border-ink-600 px-1.5 py-0.5 text-[11px] text-fg-faint">GENEL ANATOMİ</span>
          {regions.length > 0 && <span className="text-[11px] text-fg-faint">Bölge: {regions.map((r) => r.nameTr).join(', ')}</span>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{current.nameTr}</h1>
        <p className="text-[15px] leading-relaxed text-fg">{current.summary}</p>
        <div className="flex flex-wrap gap-2">
          {scene && (
            <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'simulation', id: scene, from: v.node.structure, mode: 'temel' })}>
              <LayersIcon size={15} /> Görsel iç sahne · {INSIDE[scene].title}
            </button>
          )}
          {body3d && (
            <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go(body3d)} data-testid="deep-3d">
              <BodyIcon size={15} /> 3B anatomide göster
            </button>
          )}
        </div>
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
          </div>
        )}
      </section>

      {regionMembers.length > 0 && (
        <section className="space-y-2" aria-label="Bu bölgede ne var?" data-testid="region-members">
          <h2 className="label-caps">Bu bölgede ne var?</h2>
          <p className="text-xs text-fg-muted">Aynı boşlukta bulunurlar; birbirlerinin parçası değildirler — komşudurlar.</p>
          <ul className="flex flex-wrap gap-1.5">
            {regionMembers.map((n) => (
              <li key={n.id}>
                <button type="button" className="min-h-[40px] rounded-full border border-ink-600 px-3 py-1 text-sm text-fg hover:border-accent" onClick={() => go(routeForNode(n.id))}>
                  {n.nameTr}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children.length > 0 ? (
        GROUP.map(({ title, rels }) => {
          const items = children.filter((c) => rels.includes(c.rel));
          if (!items.length) return null;
          return (
            <section key={title} className="space-y-2" aria-label={title} data-testid="deep-children">
              <h2 className="label-caps">{title === 'Bölümleri' || title.startsWith('Dokusu') ? `Daha içinde ne var? · ${title}` : title}</h2>
              <ul className="space-y-2">
                {items.map(({ node, rel, note }) => (
                  <li key={`${rel}-${node.id}`} className="card p-3.5" data-testid="deep-child" data-node={node.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <LevelBadge node={node} />
                      <span className="text-[11px] text-fg-faint">
                        {current.nameTr} {RELATION_LABEL[rel]}
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] font-medium text-fg">{node.nameTr}</p>
                    <p className="text-[13px] leading-relaxed text-fg-muted">{note ?? node.summary}</p>
                    <button type="button" className="btn-ghost mt-2 min-h-[40px] px-3 text-sm" onClick={() => into(node)}>
                      {deeperLabel(node)} <ChevronRightIcon size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      ) : (
        <p className="rounded-2xl border border-dashed border-ink-600 p-4 text-sm text-fg-muted" data-testid="deep-leaf">
          Bu, bilgi grafiğinde bu dalın en alt seviyesi.
        </p>
      )}

      {effects.length > 0 && (
        <section className="space-y-2" aria-label="Neyi etkiler">
          <h2 className="label-caps">Bu neyi etkiler? (fizyoloji)</h2>
          <ul className="flex flex-wrap gap-1.5">
            {effects.map((e) => (
              <li key={`${e.rel}-${e.node.id}`}>
                <button type="button" className="min-h-[36px] rounded-full border border-ink-600 px-3 py-1 text-sm text-fg-muted hover:text-fg" title={e.note} onClick={() => (e.node.kind === 'organ' ? go(routeForNode(e.node.id)) : into(e.node))}>
                  {RELATION_LABEL[e.rel]} → {e.node.nameTr}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {chains.length > 0 && (
        <section className="space-y-1.5" aria-label="Fizyoloji zinciri" data-testid="deep-chains">
          <h2 className="label-caps">Bu hangi zincirin parçası? (normal fizyoloji)</h2>
          <ul className="space-y-1 text-sm">
            {chains.map((c) => (
              <li key={c.map((n) => n.id).join('>')} className="text-fg-muted">
                {c.map((n, i) => (
                  <span key={n.id}>
                    {i > 0 && <span className="text-fg-faint"> → </span>}
                    <span className={i === 0 ? 'text-fg' : ''}>{n.nameTr}</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(neighbors.length > 0 || sameRegion.length > 0) && (
        <section className="space-y-2" aria-label="Yanında ne var?" data-testid="deep-neighbors">
          <h2 className="label-caps">Yanında ne var? (komşuluk ve bağlantılar)</h2>
          <ul className="space-y-1.5">
            {neighbors.map((n) => (
              <li key={`${n.rel}-${n.node.id}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[11px] text-fg-faint">{n.rel === 'adjacent_to' ? 'komşu' : n.rel === 'connected_to' ? 'bağlantılı' : 'birlikte çalışır'}</span>
                <button type="button" className="text-accent underline" onClick={() => go(routeForNode(n.node.id))} data-testid="neighbor-link" data-node={n.node.id}>
                  {n.node.nameTr}
                </button>
                {n.note && <span className="text-xs text-fg-muted">— {n.note}</span>}
              </li>
            ))}
          </ul>
          {sameRegion.length > 0 && (
            <p className="text-xs text-fg-muted">
              Aynı bölgede ({regions.map((r) => r.nameTr).join(', ')}):{' '}
              {sameRegion.map((n, i) => (
                <span key={n.id}>
                  {i > 0 && ', '}
                  <button type="button" className="text-accent underline" onClick={() => go(routeForNode(n.id))}>
                    {n.nameTr}
                  </button>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {supply.length > 0 && (
        <section className="space-y-1.5" aria-label="Nasıl beslenir ve yönetilir?" data-testid="deep-supply">
          <h2 className="label-caps">Nasıl beslenir, sinirlenir, nereden gelişir?</h2>
          <ul className="space-y-1 text-sm">
            {supply.map((s) => (
              <li key={`${s.rel}-${s.node.id}`}>
                <span className="text-fg-muted">{s.inherited ? `${s.inherited} ` : ''}{RELATION_LABEL[s.rel]}: </span>
                <button type="button" className="text-accent underline" onClick={() => go(routeForNode(s.node.id))}>
                  {s.node.nameTr}
                </button>
                {s.note && <span className="text-xs text-fg-muted"> — {s.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 rounded-2xl border border-[#a78bfa]/30 p-4" aria-label="Bende bununla ilgili ne görülmüş?" data-testid="deep-personal">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="label-caps">Bende bununla ilgili ne görülmüş?</h2>
          <span className="rounded-md border border-[#a78bfa]/40 px-1.5 py-0.5 text-[11px] text-[#a78bfa]">KİŞİSEL VERİ</span>
        </div>
        {!hasMine && <p className="text-sm text-fg-muted" data-testid="deep-personal-none">Bu seviyeye bağlanan bir sonucun, görüntü bulgun ya da rapor cümlen yok. Yukarıdaki bilgiler genel anatomidir.</p>}
        {mine.labs.length > 0 && (
          <ul className="space-y-1">
            {mine.labs.map((l) => (
              <LabRow key={l.testKey} l={l} compact />
            ))}
          </ul>
        )}
        {[...mine.modelFindings, ...mine.modelStructures].map((f) => {
          const cap = insideCapability(f);
          const name = 'finding' in f ? f.finding : f.name;
          const vol = f.localization.kind === 'volume' ? f.localization : undefined;
          return (
            <div key={f.id} className="rounded-xl border border-ink-600/60 px-3 py-2 text-sm" data-testid="deep-personal-item" data-depth={cap.depth}>
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source="IMAGE_MODEL" />
                <span className="font-medium text-fg">{'finding' in f ? '◆ ' : '◇ '}{name}</span>
                {vol && <span className="text-xs text-fg-muted">{ml(vol.volumeMl)} · kesit {vol.sliceRange[0] + 1}–{vol.sliceRange[1] + 1}</span>}
              </div>
              <p className="mt-0.5 text-[11px] text-fg-faint">{INSIDE_DEPTH_TR[cap.depth]}. {cap.limit}</p>
              <span className="mt-1 flex flex-wrap gap-3">
                {cap.sourceImage && (
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-accent underline" onClick={() => go({ name: 'document', id: cap.sourceImage! })}>
                    <ScanIcon size={12} /> Gerçek görüntüde nerede?
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {mine.reportFindings.map((f) => (
          <div key={f.id} className="rounded-xl border border-ink-600/60 px-3 py-2 text-sm" data-testid="deep-personal-item" data-depth="REPORT">
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={f.source} />
              <span className="text-fg">{f.text}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-fg-faint">RAPOR KAYNAKLI LOKALİZASYON: konum rapordaki ifadeden eşleştirildi; görüntü koordinatı değildir.</p>
          </div>
        ))}
        {hasMine && <p className="text-[11px] text-fg-faint">Kişisel bilgi yalnızca kaydın gerçekten bağlandığı seviyede gösterilir; daha alt seviyeler (doku, hücre) genel anatomidir — "bu hücrede şu var" denmez.</p>}
      </section>
    </div>
  );
}
