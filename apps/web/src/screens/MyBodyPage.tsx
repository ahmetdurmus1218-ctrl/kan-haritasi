/**
 * "Vücudum": uygulamanın vücut merkezli ana ekranı. Raporlar değil organlar merkezdedir: hangi organ
 * için hangi kaynaktan (tahlil, rapor, görüntü analizi) veri var, hangi örüntüler etkin, zaman içinde
 * ne olmuş. Her organ kendi sayfasına (Normal / Benim durumum / Karşılaştır) açılır.
 */
import { useMemo } from 'react';
import { GRAPH, type HealthModel, type OrganState } from '@kh/analysis';
import { SYSTEMS, structureById } from '@kh/catalog';
import { go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { Banner } from '../components/ui';
import { BodyIcon, LayersIcon, SpinnerIcon } from '../components/icons';
import { SourceBadge } from '../components/evidence';

/** Organ adı: bilgi grafiğinde varsa oradan, yoksa 3B yapı kataloğundan. */
export function organName(id: string): string {
  return GRAPH.node(id)?.nameTr ?? structureById.get(id)?.nameTr ?? id;
}

/** Organın sistemleri (grafik ya da katalog). */
function systemsOf(id: string): string[] {
  const g = GRAPH.systemsOf(id).map((n) => n.id.replace('system:', ''));
  return g.length ? g : (structureById.get(id)?.systems ?? []);
}

/** Her zaman gösterilen temel organlar (veri olmasa da "normalde" sayfası açılır). */
const CORE = ['brain', 'heart', 'lungs', 'liver', 'pancreas', 'kidneys', 'thyroid', 'bones'];

function OrganTile({ id, state }: { id: string; state?: OrganState }) {
  const labs = state?.labs.length ?? 0;
  const reports = state?.reportFindings.filter((f) => !f.negated && f.status !== 'normal').length ?? 0;
  const images = state?.imageObservations.length ?? 0;
  const off = state?.labs.filter((l) => l.status === 'high' || l.status === 'low').length ?? 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => go({ name: 'organ', id })}
        className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition hover:border-accent/50 ${state?.attention ? 'border-caution/40 bg-caution/[0.05]' : 'border-ink-600/60 bg-ink-850/60'}`}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-fg">
          {state?.attention && <span className="h-2 w-2 rounded-full bg-caution" aria-label="dikkat çeken veri var" />}
          {organName(id)}
        </span>
        <span className="text-[11px] leading-relaxed text-fg-muted">
          {labs || reports || images
            ? [labs && `${labs} tahlil${off ? ` (${off} aralık dışı)` : ''}`, reports && `${reports} rapor bulgusu`, images && `${images} görüntü gözlemi`].filter(Boolean).join(' · ')
            : 'Verin yok · normal anatomi ve fizyoloji'}
        </span>
      </button>
    </li>
  );
}

function YearTimeline({ model }: { model: HealthModel }) {
  const years = useMemo(() => {
    const m = new Map<string, { lab: number; report: number; image: number; abnormal: number }>();
    for (const e of model.timeline) {
      const y = e.date.slice(0, 4);
      const v = m.get(y) ?? { lab: 0, report: 0, image: 0, abnormal: 0 };
      if (e.type === 'lab') v.lab++;
      else if (e.type === 'imaging-report') v.report++;
      else v.image++;
      if (e.status && e.status !== 'normal') v.abnormal++;
      m.set(y, v);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [model]);
  if (!years.length) return <p className="text-sm text-fg-muted">Henüz tarihli veri yok.</p>;
  return (
    <ol className="space-y-1.5">
      {years.map(([y, v]) => (
        <li key={y} className="flex items-center gap-3 rounded-lg border border-ink-600/60 px-3 py-2 text-sm">
          <span className="w-12 font-semibold tabular-nums text-fg">{y}</span>
          <span className="flex-1 text-xs text-fg-muted">
            {[v.lab && `${v.lab} tahlil sonucu`, v.report && `${v.report} rapor bulgusu`, v.image && `${v.image} görüntü gözlemi`].filter(Boolean).join(' · ')}
          </span>
          {v.abnormal > 0 && <span className="text-xs text-caution-fg">{v.abnormal} dikkat</span>}
        </li>
      ))}
    </ol>
  );
}

export function MyBodyPage() {
  const { model } = useHealthModel();
  const organIds = useMemo(() => {
    const ids = new Set<string>(CORE);
    for (const [id, st] of model?.organs ?? []) if (st.labs.length || st.reportFindings.length || st.imageObservations.length) ids.add(id);
    return [...ids].filter((id) => GRAPH.node(id) || structureById.has(id));
  }, [model]);
  const bySystem = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const id of organIds) {
      const sys = systemsOf(id)[0] ?? 'other';
      (groups.get(sys) ?? groups.set(sys, []).get(sys)!).push(id);
    }
    return [...groups.entries()].sort((a, b) => SYSTEMS.findIndex((s) => s.id === a[0]) - SYSTEMS.findIndex((s) => s.id === b[0]));
  }, [organIds]);

  if (!model)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Vücut haritası hazırlanıyor…
      </div>
    );

  const critical = model.latestLabs.filter((l) => l.critical);
  const attention = [...model.organs.values()].filter((s) => s.attention);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div>
        <p className="label-caps mb-1.5">Dijital vücudum</p>
        <h1 className="text-2xl font-semibold tracking-tight">Vücudumda ne var, ne oluyor?</h1>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          Tahlillerin, raporların ve görüntülerinin kendisinden çıkarılan bilgiler organlara bağlanır. Her bilginin kaynağı ayrı gösterilir; kesin tanı konmaz.
        </p>
      </div>

      {critical.length > 0 && (
        <Banner tone="warn">
          <strong>Acil değerlendirme gerekebilir:</strong> {critical.map((l) => l.name).join(', ')} kritik olarak kabul edilen düzeyde. Bu sonuç acil klinik değerlendirme gerektirebilecek
          bir durumla ilişkili olabilir; doktor değerlendirmesi gerekir. Uygulama tanı koymaz.
        </Banner>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => go({ name: 'body' })} className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-left transition hover:border-accent/60">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <LayersIcon size={22} />
          </span>
          <span>
            <span className="block font-medium text-fg">3B vücut modeli</span>
            <span className="block text-xs text-fg-muted">Organ seç, döndür, sistemleri aç-kapat; veri olan organlar vurgulu.</span>
          </span>
        </button>
        <div className="rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4">
          <p className="label-caps">Elindeki kaynaklar</p>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <li className="flex items-center gap-1.5">
              <SourceBadge source="LAB" /> {model.latestLabs.length} test
            </li>
            <li className="flex items-center gap-1.5">
              <SourceBadge source="RADIOLOGY_REPORT" /> {model.reportFindings.filter((f) => !f.negated).length} cümle
            </li>
            <li className="flex items-center gap-1.5">
              <SourceBadge source="IMAGE_ANALYSIS" /> {model.imageObservations.length} gözlem
            </li>
          </ul>
          {model.statements.length > 0 && <p className="mt-2 text-[12px] leading-relaxed text-fg-faint">{model.statements.join(' ')}</p>}
        </div>
      </section>

      {(model.patterns.length > 0 || attention.length > 0) && (
        <section className="space-y-2" aria-label="Bulgular">
          <p className="label-caps">Bulgular ve örüntüler</p>
          <ul className="space-y-2">
            {model.patterns.map((p) => (
              <li key={p.id} className="rounded-xl border border-caution/30 bg-caution/[0.05] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source="DERIVED" />
                  <span className="text-sm font-medium text-fg">{p.title}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{p.explanation}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.organs.map((o) => (
                    <button key={o} type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => go({ name: 'organ', id: o, view: 'benim' })}>
                      {organName(o)} →
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-label="Organlarım">
        <div className="flex items-end justify-between">
          <p className="label-caps">Vücudum · organlar</p>
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => go({ name: 'body' })}>
            <BodyIcon size={13} /> 3B'de aç
          </button>
        </div>
        {bySystem.map(([sys, ids]) => (
          <div key={sys}>
            <p className="mb-1.5 text-xs font-medium text-fg-muted">{SYSTEMS.find((s) => s.id === sys)?.nameTr ?? 'Diğer'}</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ids.map((id) => (
                <OrganTile key={id} id={id} state={model.organs.get(id)} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2" aria-label="Zaman çizelgesi">
        <div className="flex items-end justify-between">
          <p className="label-caps">Zaman çizelgesi</p>
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => go({ name: 'timeline' })}>
            Grafikler →
          </button>
        </div>
        <YearTimeline model={model} />
      </section>

      <details className="rounded-xl border border-dashed border-ink-600 p-3 text-sm">
        <summary className="cursor-pointer text-fg-muted">Bu harita nasıl oluşturuldu?</summary>
        <ol className="mt-2 space-y-1 text-[13px] text-fg-muted">
          {model.steps.map((s) => (
            <li key={s.step}>
              <span className={s.ran ? 'text-accent' : 'text-fg-faint'}>{s.ran ? '✓' : '—'}</span> <code className="text-[12px]">{s.step}</code>: {s.detail}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[12px] text-fg-faint">Rapor yoksa analiz durmaz; ham görüntü, tahlil ve önceki veriler ayrı ayrı işlenip kaynakları korunarak birleştirilir.</p>
      </details>
    </div>
  );
}
