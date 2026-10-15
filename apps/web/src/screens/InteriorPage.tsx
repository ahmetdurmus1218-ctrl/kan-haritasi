/**
 * "İÇİNE GİR" ekranı (#/ic/<iç dünya>/<basamak>/<mod>): organın fiziksel/işlevsel iç dünyası.
 *
 *   Vücut › Sistem › Organ › İçerisi › basamak
 *   [3B iç sahne]  — eğitimsel normal anatomi/fizyoloji (kişisel görüntü değildir)
 *   İçerik modu (varsa): Boş · Sindirim sırasında · Emilim sırasında — eğitimsel simülasyon
 *   Basamaklar: Organın içi → Bölge → Doku → Hücre → Molekül (ölçek merdiveni)
 *   Bu basamak: açıklama · benim verim (yalnızca gerçekten bağlı olan) · fizyoloji zinciri · "Bunun devamı nerede?"
 *   Duvarı incele · Bölge seç · Akış yolları · Benim durumum (kişisel 3B varsa "Senin görüntünden")
 *   Son basamaktan sonra: Daha derine in (bilgi grafiği)
 *
 * Kişisel veri yoksa iç dünya yine çalışır ve "Bu organla ilişkili kişisel veri bulunamadı." yazar.
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import {
  ARCHETYPE_TR,
  EDUCATIONAL_LABEL,
  GRAPH,
  INTERIOR_TYPE_TR,
  type OrganInteriorDefinition,
  SCALE_TR,
  SIMULATION_LABEL,
  interiorArchetype,
  interiorById,
  interiorExperience,
  interiorFor,
  interiorModes,
  interiorPersonal,
  interiorProvenance,
  interiorTrail,
  physioChain,
  stagePersonal,
} from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { type Route, go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { useResolvedTheme } from '../state/theme';
import { INSIDE, type InsideId } from '../explore/inside/registry';
import { PhysioChainView } from '../components/physiology';
import { SourceBadge } from '../components/evidence';
import { Banner } from '../components/ui';
import { BodyIcon, ChevronLeftIcon, ChevronRightIcon, LayersIcon, SpinnerIcon } from '../components/icons';
import { LabRow, Section, systemOf } from './organ/common';

const InteriorScene = lazy(() => import('../explore/inside/InteriorScene'));

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function useReduced(): boolean {
  return useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
}

const nameOfInterior = (id: string) => interiorById(id)?.name ?? id;

/** Organ sayfası rotası: grafik düğümü varsa organ sayfası, yoksa katalog yapısı (StructureFallback). */
function organRoute(def: OrganInteriorDefinition): Route | undefined {
  if (def.anchor && GRAPH.node(def.anchor)) return { name: 'organ', id: def.anchor };
  if (def.structure && structureById.has(def.structure)) return { name: 'organ', id: def.structure };
  return undefined;
}

/**
 * "Şu anda neredeyim?": Vücut › Sistem › Organ › İçerisi › geçilen basamaklar (İçerik › Hareket › … › Duvar › Mukoza).
 * Kullanıcı içeride mi, duvarda mı, hücrede mi — her an görür; her basamak tıklanabilir.
 */
function Trail({ def, idx, at }: { def: OrganInteriorDefinition; idx: number; at: (n: number) => void }) {
  const sys = systemOf(def.anchor ?? def.structure ?? def.organId);
  const chain = interiorTrail(def);
  const items: Array<{ label: string; route?: Route; stage?: number }> = [
    { label: 'Vücut', route: { name: 'mybody' } },
    ...(sys ? [{ label: sys.name, route: { name: 'system', id: sys.id } as Route }] : []),
    ...chain.slice(0, -1).map((d) => ({ label: d.name, route: { name: 'interior', id: d.organId } as Route })),
    { label: def.name, route: organRoute(def) },
    { label: 'İçerisi', stage: 0 },
    ...def.stages.slice(1, idx + 1).map((x, k) => ({ label: x.title, stage: k + 1 })),
  ];
  return (
    <nav aria-label="Şu anda neredeyim?" className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-fg-faint">›</span>}
          {(it.route || it.stage !== undefined) && i < items.length - 1 ? (
            <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => (it.route ? go(it.route) : at(it.stage!))}>
              {it.label}
            </button>
          ) : (
            <span className={i === items.length - 1 ? 'text-fg' : ''} aria-current={i === items.length - 1 ? 'location' : undefined}>
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function InteriorPage({ id, stage, mode }: { id: string; stage?: number; mode?: string }) {
  const def = interiorById(id) ?? interiorFor(id);
  const { model } = useHealthModel();
  const theme = useResolvedTheme();
  const reduced = useReduced();
  const [playing, setPlaying] = useState(!reduced);
  const [layer, setLayer] = useState<number | undefined>(undefined);
  const webgl = useMemo(hasWebGL, []);

  if (!def)
    return (
      <div className="mx-auto max-w-lg p-6">
        <Banner tone="warn">Bu yapı için iç dünya tanımı yok. Organ sayfasından genel anatomiyi inceleyebilirsin.</Banner>
      </div>
    );

  const modes = interiorModes(def);
  const curMode = modes.find((m) => m.id === mode) ?? modes[0];
  const idx = Math.min(def.stages.length, Math.max(1, stage ?? 1)) - 1;
  const st = def.stages[idx]!;
  const focus = layer !== undefined ? 'wall' : (st.focus ?? (st.kind === 'wall' ? 'wall' : 'overview'));
  const prov = interiorProvenance(def, model);
  const mine = stagePersonal(st, model);
  const organLabs = interiorPersonal(def, model);
  const chainId = st.chain ?? (st.kind === 'process' || st.kind === 'flow' ? def.physiologyChains?.[0] : undefined);
  const chain = chainId ? physioChain(chainId) : undefined;
  const scene = st.scene && st.scene in INSIDE ? (st.scene as InsideId) : undefined;
  const at = (n: number, m = curMode?.id) => go({ name: 'interior', id: def.organId, stage: n + 1, ...(m && modes.length ? { mode: m } : {}) });
  const deep = (node: string) => go({ name: 'organ', id: node, view: 'derin', trail: [] });
  const last = idx === def.stages.length - 1;
  const stations = def.routes?.[0]?.steps.length;
  const organR = organRoute(def);
  const archetype = interiorArchetype(def);
  const insideCount = interiorExperience(def).inside.length;
  const crossing = idx === insideCount - 1 && !last;

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-8"
      data-testid="interior"
      data-interior={def.organId}
      data-type={def.type}
      data-archetype={archetype}
      data-current-level={st.scale}
      data-current-node={st.kind}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => (organR ? go(organR) : history.back())}>
          <ChevronLeftIcon size={14} /> {def.name}
        </button>
        <Trail def={def} idx={idx} at={(n) => (setLayer(undefined), at(n))} />
      </div>

      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{def.name} · içerisi</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-fg-muted" data-testid="interior-type">
            {INTERIOR_TYPE_TR[def.type]}
          </span>
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-fg-muted" data-testid="interior-archetype">
            {ARCHETYPE_TR[archetype]}
          </span>
          <span className="rounded-full border border-accent/40 bg-accent/[0.06] px-2 py-0.5 text-accent" data-testid="interior-label">
            {EDUCATIONAL_LABEL}
          </span>
        </div>
        <p className="text-[14.5px] leading-relaxed text-fg-muted">{def.summary}</p>
        {def.lumen?.enabled ? (
          <p className="text-[12.5px] text-fg-muted">
            <span className="text-fg">Lümende:</span> {def.lumen.contents?.join(', ')} {def.lumen.flow?.length ? <span className="text-fg-faint">· Akış: {def.lumen.flow.join('; ')}</span> : null}
          </p>
        ) : (
          <p className="text-[12.5px] text-fg-muted" data-testid="interior-no-lumen">
            Bu yapının lümeni yoktur; içi {def.type === 'solid' ? 'parankim (doku) ile doludur' : 'farklı boşluklardan oluşur'} — sahte iç boşluk gösterilmez.
          </p>
        )}
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-900" style={{ height: 'min(52vh, 420px)' }} data-testid="interior-scene" data-kind={def.interiorScene.kind} data-focus={focus} data-mode={curMode?.id ?? ''}>
        {webgl ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
                <SpinnerIcon size={16} /> 3B iç sahne hazırlanıyor…
              </div>
            }
          >
            <InteriorScene spec={def.interiorScene} focus={focus} mode={curMode} layers={def.wallLayers} highlightLayer={layer} stations={stations} playing={playing} reducedMotion={reduced} theme={theme} />
          </Suspense>
        ) : (
          <p className="p-4 text-sm text-fg-muted">Bu cihazda 3B grafik (WebGL) yok; aşağıdaki basamaklar aynı bilgiyi yazılı olarak verir.</p>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <span className="pointer-events-auto rounded-md bg-ink-950/75 px-2 py-1 text-[11px] text-fg-muted" data-testid="interior-scene-label">
            {prov.personal3D ? 'Organ: senin görüntünden · içerisi eğitimsel' : 'Eğitimsel · Temsili anatomi'}
          </span>
          <button type="button" className="pointer-events-auto btn-ghost min-h-[32px] bg-ink-950/75 px-2 text-[11px]" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Duraklat' : 'Oynat'}
          </button>
        </div>
      </div>

      {prov.personal3D && (
        <div className="space-y-1 rounded-xl border border-[#a78bfa]/40 p-3" data-testid="interior-personal-3d">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source="IMAGE_MODEL" />
            <span className="text-sm font-medium text-fg">{prov.organLabel}</span>
          </div>
          <p className="text-[12.5px] text-fg-muted">
            {prov.structures.map((s) => `${s.name}${s.localization.kind === 'volume' ? ` · ${s.localization.volumeMl.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL` : ''}`).join(' · ')}. Organın kendisi senin serinden; içerideki seviyeler (ör. nefron, villus, lobül) eğitimseldir.
          </p>
          {prov.structures[0]?.provenance.documentId && (
            <button type="button" className="text-[12.5px] text-accent hover:underline" onClick={() => go({ name: 'document', id: prov.structures[0]!.provenance.documentId! })}>
              Gerçek görüntüyü ve kişisel 3B'yi aç
            </button>
          )}
        </div>
      )}

      {modes.length > 0 && (
        <div className="space-y-1.5" data-testid="interior-modes">
          <p className="text-[11.5px] text-fg-faint">{SIMULATION_LABEL}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="İçerik modu">
            {modes.map((m) => (
              <button key={m.id} type="button" aria-pressed={m.id === curMode?.id} className={`min-h-[40px] rounded-full border px-3 text-[13px] ${m.id === curMode?.id ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted hover:text-fg'}`} onClick={() => at(idx, m.id)}>
                {m.name}
              </button>
            ))}
          </div>
          {curMode && <p className="text-[12.5px] text-fg-muted">{curMode.text}</p>}
        </div>
      )}

      <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="İçine gir basamakları">
        {def.stages.map((s, k) => (
          <li key={s.id} className="flex items-center gap-1">
            {k === insideCount && (
              <span className="ml-1 rounded-md bg-ink-800 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-fg-faint" data-testid="interior-deeper-divider">
                Daha derine in
              </span>
            )}
            {k > 0 && <span className={`text-fg-faint ${def.stages[k - 1]!.scale !== s.scale ? 'font-semibold' : ''}`}>{def.stages[k - 1]!.scale !== s.scale ? '⟩' : '→'}</span>}
            <button type="button" aria-current={k === idx ? 'step' : undefined} className={`min-h-[32px] rounded-full border px-2.5 ${k === idx ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted hover:text-fg'}`} onClick={() => (setLayer(undefined), at(k))} data-testid="interior-step" data-scale={s.scale} data-kind={s.kind}>
              {s.title}
            </button>
          </li>
        ))}
      </ol>

      <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Bu basamak" data-testid="interior-stage" data-stage={st.id} data-scale={st.scale} data-kind={st.kind}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md border border-ink-600 px-1.5 py-0.5 text-[11px] text-fg-muted">Ölçek: {SCALE_TR[st.scale]}</span>
          <span className="text-xs text-fg-faint">
            {idx + 1} / {def.stages.length}
          </span>
        </div>
        <h2 className="text-xl font-semibold">{st.title}</h2>
        <p className="text-[15px] leading-relaxed text-fg">{st.text}</p>
        {st.scale !== 'interior' && <p className="text-[11.5px] text-fg-faint">Bu seviye eğitimsel modeldir; senin görüntünden görülmedi.</p>}

        {mine.hasData && (
          <div className="space-y-1.5 rounded-xl border border-ink-600/60 p-3" data-testid="interior-stage-personal">
            <p className="text-xs font-medium text-fg-muted">KİŞİSEL VERİ · bu basamakla ilişkili olabilir (olası ilişki; neden kanıtlanmaz):</p>
            {mine.labs.length > 0 && (
              <ul className="space-y-1">
                {mine.labs.map((l) => (
                  <LabRow key={l.testKey} l={l} compact />
                ))}
              </ul>
            )}
            {mine.findings.map((f, i) => (
              <p key={i} className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg">
                <SourceBadge source={f.source} />
                {f.text} <span className="text-fg-faint">· {f.localized === 'real-coordinate' ? 'gerçek görüntü konumu' : 'rapor metninden yaklaşık konum'}</span>
              </p>
            ))}
          </div>
        )}

        {chain && (
          <details className="rounded-xl border border-ink-600/60 p-3" open={st.kind === 'process' || st.kind === 'flow'}>
            <summary className="cursor-pointer text-[13px] font-medium text-fg">Fizyoloji zinciri · {chain.title}</summary>
            <div className="mt-2">
              <PhysioChainView chain={chain} model={model} here={def.organId} compact />
            </div>
          </details>
        )}

        {(st.next?.length ?? 0) > 0 && (
          <div className="space-y-1" data-testid="interior-next">
            <p className="text-xs font-medium text-fg-muted">Bunun devamı nerede?</p>
            <div className="flex flex-wrap gap-1.5">
              {st.next!.map((n) => (
                <button key={n.to + n.label} type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'interior', id: n.to })} data-to={n.to}>
                  {n.label} <ChevronRightIcon size={14} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {scene && (
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'simulation', id: scene, ...(def.structure ? { from: def.structure } : {}), mode: 'temel' })}>
              <LayersIcon size={15} /> Eğitsel sahnede gör · {INSIDE[scene].title}
            </button>
          )}
          {st.node && GRAPH.node(st.node) && (
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => deep(st.node!)} data-testid="interior-deep-node">
              Bilgi grafiğinde incele · {GRAPH.node(st.node)!.nameTr}
            </button>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" disabled={idx === 0} onClick={() => (setLayer(undefined), at(idx - 1))}>
          <ChevronLeftIcon size={15} /> Önceki
        </button>
        {!last ? (
          <button type="button" className="btn-primary min-h-[44px] px-3.5 text-sm" onClick={() => (setLayer(undefined), at(idx + 1))} data-testid="interior-next-stage" data-crossing={crossing ? 'deeper' : undefined}>
            {crossing ? `Daha derine in · ${def.stages[idx + 1]!.title}` : `Sonraki · ${def.stages[idx + 1]!.title}`} <ChevronRightIcon size={15} />
          </button>
        ) : def.deepAnatomyEntry ? (
          <button type="button" className="btn-primary min-h-[44px] px-3.5 text-sm" onClick={() => deep(def.deepAnatomyEntry!)}>
            Daha derine in (bilgi grafiği) <ChevronRightIcon size={15} />
          </button>
        ) : (
          <span />
        )}
      </div>

      {def.wallLayers && def.wallLayers.length > 0 && (
        <Section title={def.lumen?.enabled ? 'Duvarı incele (lümenden dışa)' : 'Katmanlar (yüzeyden derine)'}>
          <ol className="space-y-1" data-testid="interior-layers">
            {def.wallLayers.map((l, i) => (
              <li key={l.id}>
                <button type="button" aria-pressed={layer === i} className={`w-full rounded-lg border px-3 py-2 text-left text-[13px] ${layer === i ? 'border-accent/60 bg-accent/10' : 'border-ink-600/60 hover:border-ink-500'}`} onClick={() => setLayer(layer === i ? undefined : i)}>
                  <span className="font-medium text-fg">
                    {i + 1}. {l.name}
                  </span>
                  <span className="block text-fg-muted">{l.text}</span>
                </button>
                {layer === i && l.node && GRAPH.node(l.node) && (
                  <button type="button" className="mt-1 text-[12px] text-accent hover:underline" onClick={() => deep(l.node!)}>
                    Bu katmana derin anatomide in ›
                  </button>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {def.functionalRegions && def.functionalRegions.length > 0 && (
        <Section title="Bölge seç · fonksiyonel bölgeler">
          <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="interior-regions">
            {def.functionalRegions.map((r) => (
              <li key={r.id} className="rounded-lg border border-ink-600/60 p-2.5 text-[13px]">
                {r.interior ? (
                  <button type="button" className="font-medium text-fg hover:text-accent" onClick={() => go({ name: 'interior', id: r.interior! })} data-to={r.interior}>
                    {r.name} ›
                  </button>
                ) : r.node && GRAPH.node(r.node) ? (
                  <button type="button" className="font-medium text-fg hover:text-accent" onClick={() => deep(r.node!)}>
                    {r.name} ›
                  </button>
                ) : (
                  <span className="font-medium text-fg">{r.name}</span>
                )}
                <span className="block text-fg-muted">{r.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {def.routes && def.routes.length > 0 && (
        <Section title="Akış yolları">
          {def.routes.map((r) => (
            <div key={r.title} className="space-y-1" data-testid="interior-route">
              <p className="text-xs text-fg-faint">{r.title}</p>
              <p className="flex flex-wrap items-center gap-1 text-[13px]">
                {r.steps.map((s, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-fg-faint">→</span>}
                    {s.to && s.to !== def.organId ? (
                      <button type="button" className="rounded-md border border-ink-600 px-1.5 py-0.5 hover:border-accent hover:text-accent" onClick={() => go({ name: 'interior', id: s.to! })}>
                        {s.label}
                      </button>
                    ) : s.focus?.startsWith('path:') ? (
                      <button type="button" className="rounded-md border border-ink-600/60 px-1.5 py-0.5 text-fg-muted hover:text-fg" onClick={() => {
                        const k = def.stages.findIndex((x) => x.focus === s.focus);
                        if (k >= 0) at(k);
                      }}>
                        {s.label}
                      </button>
                    ) : (
                      <span className="rounded-md border border-ink-600/60 px-1.5 py-0.5 text-fg-muted">{s.label}</span>
                    )}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </Section>
      )}

      <Section title="Benim durumum · bu organ">
        {organLabs.length ? (
          <ul className="space-y-1.5" data-testid="interior-mine">
            {organLabs.map((l) => (
              <LabRow key={l.testKey} l={l} compact />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted" data-testid="interior-mine-none">
            Bu organla ilişkili kişisel veri bulunamadı. Normal anatomi ve fizyoloji yine de gösteriliyor.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {organR && (
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go(organR)}>
              Organ sayfası
            </button>
          )}
          {def.structure && structureById.has(def.structure) && (
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'body', structure: def.structure! })}>
              <BodyIcon size={15} /> 3B vücutta göster
            </button>
          )}
          {def.parent && (
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'interior', id: def.parent! })}>
              Üst yapı: {nameOfInterior(def.parent)}
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}
