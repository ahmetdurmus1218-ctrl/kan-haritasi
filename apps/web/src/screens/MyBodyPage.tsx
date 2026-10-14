/**
 * "Vücudum": anatomik görünüm. Önce özet (kaç organda dikkat çeken sonuç var), 3B vücut girişi, dikkat
 * isteyen organlar (en fazla beş) ve son değişiklikler. Tüm organ listesi ve teknik "nasıl oluşturuldu"
 * bilgisi kapalı bölümlerde. Organa dokununca kısa özet alt sayfada açılır.
 */
import { useMemo, useState } from 'react';
import { GRAPH, type HealthModel, chainsForPlace, interiorFor, interiorProvenance, physioOverlay } from '@kh/analysis';
import { SYSTEMS, structureById } from '@kh/catalog';
import { go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { bodySummary, headlineOf, organName, whatChanged } from '../lib/summary';
import { TONE, labStyle, labTone } from '../lib/tone';
import { formatDate } from '../lib/format';
import { Banner } from '../components/ui';
import { OrganSheet } from '../components/OrganSheet';
import { ChevronRightIcon, LayersIcon, SpinnerIcon } from '../components/icons';

export { organName } from '../lib/summary';

/** Organları olan sistemler (sistem sayfası: organlar + akışlar). */
const SYSTEM_LINKS = SYSTEMS.filter((x) => x.id !== 'integumentary');

function systemsOf(id: string): string[] {
  const g = GRAPH.systemsOf(id).map((n) => n.id.replace('system:', ''));
  return g.length ? g : (structureById.get(id)?.systems ?? []);
}

/** Her zaman listelenen temel organlar (veri olmasa da "normalde" sayfası açılır). */
const CORE = ['brain', 'heart', 'lungs', 'liver', 'pancreas', 'kidneys', 'thyroid', 'bones'];

type Layer = 'normal' | 'labs' | 'imaging' | 'physiology';
const LAYER_TR: Record<Layer, string> = { normal: 'Normal insan', labs: 'Laboratuvar sonuçlarım', imaging: 'Görüntüleme bulgularım', physiology: 'İlişkili fizyoloji' };
const TYPE_SHORT = { hollow: 'içi boş (lümenli)', tubular: 'tüp (lümenli)', vascular: 'damar', solid: 'dolu (parankim)', compound: 'bileşik' } as const;
const LAYER_ORGANS = ['brain', 'heart', 'lungs', 'stomach', 'small-intestine', 'large-intestine', 'liver', 'pancreas', 'kidneys', 'thyroid', 'bones'];

/**
 * BENİM VÜCUDUM — aynı vücut üzerinde katmanlar: normal anatomi (her zaman) + benim laboratuvar
 * sonuçlarım + benim görüntüleme bulgularım + ilişkili fizyoloji. Katmanlar ayrı kalır, karışmaz;
 * kişisel katmanı olmayan organ "veri yok" der, "normal" demez.
 */
function BodyLayers({ model, onOrgan }: { model: HealthModel; onOrgan: (id: string) => void }) {
  const [on, setOn] = useState<Record<Layer, boolean>>({ normal: true, labs: true, imaging: true, physiology: true });
  const ids = useMemo(() => {
    const set = new Set(LAYER_ORGANS);
    for (const [id, st] of model.organs) if ((st.labs.length || st.reportFindings.length || st.modelFindings.length || st.modelStructures.length) && GRAPH.node(id)?.kind === 'organ') set.add(id);
    return [...set].filter((id) => GRAPH.node(id));
  }, [model]);
  return (
    <section aria-labelledby="katmanlar" className="space-y-3" data-testid="mybody-layers">
      <div>
        <h2 id="katmanlar" className="text-sm font-medium text-fg-muted">
          Benim vücudum · katmanlar
        </h2>
        <p className="text-[12px] text-fg-faint">Normal insan anatomisi her zaman görünür; kendi verilerin ayrı katmanlar olarak üstüne eklenir.</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Katmanlar">
        {(Object.keys(LAYER_TR) as Layer[]).map((k) => (
          <button key={k} type="button" aria-pressed={on[k]} className={`min-h-[40px] rounded-full border px-3 text-[13px] ${on[k] ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted'}`} onClick={() => setOn((x) => ({ ...x, [k]: !x[k] }))} data-layer={k}>
            {on[k] ? '✓ ' : ''}
            {LAYER_TR[k]}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-ink-700 rounded-2xl border border-ink-600/60 bg-ink-850/60">
        {ids.map((id) => {
          const st = model.organs.get(GRAPH.node(id)?.structure ?? id) ?? model.organs.get(id);
          const def = interiorFor(id);
          const labs = st?.labs ?? [];
          const off = labs.filter((l) => labTone(l) !== 'normal');
          const prov = def ? interiorProvenance(def, model) : null;
          const imaging = (st?.modelFindings.length ?? 0) + (st?.reportFindings.filter((f) => !f.negated && (f.status === 'abnormal' || f.status === 'uncertain')).length ?? 0);
          const chains = chainsForPlace(def?.organId ?? id)
            .map((c) => ({ c, ov: physioOverlay(c, model) }))
            .filter((x) => x.ov.hasData)
            .slice(0, 2);
          return (
            <li key={id} className="space-y-1.5 px-4 py-3" data-testid="layer-row" data-organ={id}>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="text-[15px] font-medium text-fg hover:text-accent" onClick={() => onOrgan(id)}>
                  {organName(id)}
                </button>
                {on.normal && def && (
                  <>
                    <span className="text-[11px] text-fg-faint">{TYPE_SHORT[def.type]}</span>
                    <button type="button" className="ml-auto text-[12.5px] text-accent hover:underline" onClick={() => go({ name: 'interior', id: def.organId })}>
                      İçine gir ›
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 text-[12px]">
                {on.labs &&
                  (labs.length ? (
                    (off.length ? off : labs).slice(0, 3).map((l) => {
                      const s = labStyle(l);
                      return (
                        <span key={l.testKey} className={`rounded-md border px-1.5 py-0.5 ${s.direction ? `${s.border} ${s.bg} ${s.text}` : 'border-ink-600 text-fg-muted'}`} data-layer-item="labs">
                          {l.name} {s.statusLabel}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-fg-faint" data-layer-item="labs-none">Tahlil yok</span>
                  ))}
                {on.imaging &&
                  (prov?.personal3D ? (
                    <span className="rounded-md border border-[#a78bfa]/40 px-1.5 py-0.5 text-fg" data-layer-item="imaging">
                      ◆ Senin görüntünden 3B (bölütleme)
                    </span>
                  ) : imaging ? (
                    <span className="rounded-md border border-caution/40 px-1.5 py-0.5 text-caution-fg" data-layer-item="imaging">
                      {imaging} görüntü/rapor bulgusu
                    </span>
                  ) : (
                    <span className="text-fg-faint">Görüntüleme yok</span>
                  ))}
                {on.physiology &&
                  chains.map(({ c, ov }) => (
                    <button key={c.id} type="button" className="rounded-md border border-ink-600 px-1.5 py-0.5 text-fg-muted hover:text-fg" onClick={() => go({ name: 'physiology', id: c.id })} data-layer-item="physiology">
                      {c.title.split(':')[0]}: {ov.markers.map((m) => `${m.name}${m.latest.status === 'high' ? ' ▲' : m.latest.status === 'low' ? ' ▼' : ''}`).join(', ')}
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="text-sm text-accent hover:underline" onClick={() => go({ name: 'physiology' })}>
        Vücudun süreçleri (organlar arası zincirler) →
      </button>
    </section>
  );
}

export function MyBodyPage() {
  const { model, studies } = useHealthModel();
  const [sheet, setSheet] = useState<string | null>(null);
  const summary = useMemo(() => (model ? bodySummary(model) : null), [model]);
  const changes = useMemo(() => (model ? whatChanged(model, studies ?? [], 3) : []), [model, studies]);
  const allOrgans = useMemo(() => {
    const ids = new Set<string>(CORE);
    for (const [id, st] of model?.organs ?? []) if (st.labs.length || st.reportFindings.length || st.imageObservations.length) ids.add(id);
    const groups = new Map<string, string[]>();
    for (const id of ids) {
      if (!GRAPH.node(id) && !structureById.has(id)) continue;
      const sys = systemsOf(id)[0] ?? 'other';
      (groups.get(sys) ?? groups.set(sys, []).get(sys)!).push(id);
    }
    return [...groups.entries()].sort((a, b) => SYSTEMS.findIndex((s) => s.id === a[0]) - SYSTEMS.findIndex((s) => s.id === b[0]));
  }, [model]);

  if (!model || !summary)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Vücut haritası hazırlanıyor…
      </div>
    );

  const organs = summary.organs.slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Vücudum</h1>
        <p className="mt-2 text-[15px] text-fg-muted">
          {summary.hasData ? headlineOf(summary) : 'Henüz verin yok. Organların normalde nasıl çalıştığını keşfedebilirsin.'}
        </p>
      </div>

      {summary.urgent.length > 0 && (
        <Banner tone="warn">
          <strong>Acil değerlendirme gerekebilir:</strong> {summary.urgent.map((u) => u.label).join(', ')}. Doktor değerlendirmesi gerekir; uygulama tanı koymaz.
        </Banner>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <button type="button" onClick={() => go({ name: 'body' })} className="flex w-full items-center gap-4 rounded-3xl border border-accent/30 bg-accent/5 p-5 text-left transition hover:border-accent/60">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <LayersIcon size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-medium text-fg">3B vücudu aç</span>
            <span className="block text-sm text-fg-muted">Organlara dokun, döndür, içine gir.</span>
          </span>
          <ChevronRightIcon size={18} />
        </button>
        <button type="button" onClick={() => go({ name: 'flow' })} className="flex w-full items-center gap-4 rounded-3xl border border-ink-600/60 bg-ink-850/60 p-5 text-left transition hover:border-ink-500">
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-medium text-fg">Vücudun nasıl çalıştığını keşfet</span>
            <span className="block text-sm text-fg-muted">Sindirim, dolaşım, solunum… adım adım.</span>
          </span>
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <BodyLayers model={model} onOrgan={setSheet} />

      <section aria-labelledby="sistemler">
        <h2 id="sistemler" className="mb-2 text-sm font-medium text-fg-muted">
          Sistemlere göre
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {SYSTEM_LINKS.map((sys) => (
            <li key={sys.id}>
              <button type="button" className="min-h-[44px] rounded-full border border-ink-600 px-3.5 text-sm text-fg-muted hover:text-fg" onClick={() => go({ name: 'system', id: sys.id })}>
                {sys.nameTr}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {organs.length > 0 && (
        <section aria-labelledby="dikkat">
          <h2 id="dikkat" className="mb-3 text-sm font-medium text-fg-muted">
            Dikkat çeken organlar
          </h2>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {organs.map((o) => (
              <li key={o.organ} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSheet(o.organ)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4 text-left transition hover:border-ink-500"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[o.tone].dot}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-fg">{organName(o.organ)}</span>
                    <span className="block truncate text-xs text-fg-muted">{o.reasons.slice(0, 2).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {summary.organs.length > organs.length && <p className="mt-2 text-xs text-fg-faint">+{summary.organs.length - organs.length} organ daha · aşağıdaki tüm organlar listesinde</p>}
        </section>
      )}

      {changes.length > 0 && (
        <section aria-labelledby="degisiklik">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="degisiklik" className="text-sm font-medium text-fg-muted">
              Son değişiklikler
            </h2>
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => go({ name: 'timeline' })}>
              Zamanım →
            </button>
          </div>
          <ul className="divide-y divide-ink-700 rounded-2xl border border-ink-600/60 bg-ink-850/60">
            {changes.map((c, i) => (
              <li key={i}>
                <button type="button" onClick={() => go(c.route)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="w-4 text-center text-fg-muted">{c.icon}</span>
                  <span className="flex-1 text-[15px] text-fg">{c.label}</span>
                  <span className="text-xs text-fg-faint">{formatDate(c.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="group rounded-2xl border border-ink-600/60 bg-ink-850/40 px-4 py-1">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-sm font-medium text-fg">
          Tüm organlar <span className="text-fg-faint group-open:hidden">↓</span>
        </summary>
        <div className="mb-3 mt-1 space-y-3">
          {allOrgans.map(([sys, ids]) => (
            <div key={sys}>
              <p className="mb-1 text-xs text-fg-faint">{SYSTEMS.find((s) => s.id === sys)?.nameTr ?? 'Diğer'}</p>
              <div className="flex flex-wrap gap-1.5">
                {ids.map((id) => (
                  <button key={id} type="button" onClick={() => setSheet(id)} className="min-h-[44px] rounded-full border border-ink-600 px-3 py-1 text-sm text-fg-muted hover:text-fg">
                    {organName(id)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-2xl border border-dashed border-ink-600 px-4 py-1 text-sm">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-fg-muted">Teknik detaylar · bu harita nasıl oluşturuldu?</summary>
        <ol className="mt-2 space-y-1 text-[13px] text-fg-muted">
          {model.steps.map((s) => (
            <li key={s.step}>
              <span className={s.ran ? 'text-accent' : 'text-fg-faint'}>{s.ran ? '✓' : '—'}</span> {s.detail}
            </li>
          ))}
        </ol>
        <p className="mb-3 mt-2 text-[12px] text-fg-faint">Rapor yoksa analiz durmaz; ham görüntü, tahlil ve önceki veriler ayrı ayrı işlenip kaynakları korunarak birleştirilir. {model.statements.join(' ')}</p>
      </details>

      <OrganSheet organ={sheet} model={model} onClose={() => setSheet(null)} />
    </div>
  );
}
