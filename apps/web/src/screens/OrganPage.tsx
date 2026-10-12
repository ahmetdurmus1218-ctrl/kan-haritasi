/**
 * Organ / bölge sayfası: "Bu ne? Nerede? Normalde ne yapar? Bende ne var? Fark ne? Neyi etkiler?
 * Daha önce nasıldı? Hangi bilgi kesin, hangisi belirsiz?"
 *
 *   [Normal]  [Benim durumum]  [Karşılaştır]
 */
import { useMemo, useState } from 'react';
import { GRAPH, type KNode, LEVEL_LABEL, type OrganView, REF_TR, RELATION_LABEL, buildOrganView } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { type OrganViewMode, go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { studiesForStructure } from '../lib/imagingStudies';
import { CATEGORY_LABEL } from '../lib/imaging';
import { formatDate } from '../lib/format';
import { Banner } from '../components/ui';
import { BodyIcon, ChartIcon, ChevronLeftIcon, SpinnerIcon } from '../components/icons';
import { ConfidenceNote, LocationPath, SourceBadge, WhyButton } from '../components/evidence';

const TABS: Array<{ key: OrganViewMode; label: string }> = [
  { key: 'normal', label: 'Normal' },
  { key: 'benim', label: 'Benim durumum' },
  { key: 'fark', label: 'Karşılaştır' },
];

const STATUS_CLS = { high: 'text-high', low: 'text-low', normal: 'text-accent', unknown: 'text-fg-muted' } as const;
const STATUS_TR = { high: 'yüksek', low: 'düşük', normal: 'aralıkta', unknown: 'aralık yok' } as const;

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="space-y-2 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4">
      <p className="label-caps">{title}</p>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-fg-faint">{hint}</p>}
    </section>
  );
}

function NodeLink({ n }: { n: KNode }) {
  return (
    <button type="button" className="text-left underline decoration-ink-500 underline-offset-2 hover:text-accent" onClick={() => go({ name: 'organ', id: n.id })}>
      {n.nameTr}
    </button>
  );
}

/** "Detaylandır": organ → bölge → doku → hücre → süreç → molekül, istenen kadar derine. */
function DrillTree({ id, depth = 0 }: { id: string; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const items = GRAPH.drill(id);
  if (!items.length) return null;
  return (
    <ul className={depth ? 'ml-3 mt-1 space-y-1 border-l border-ink-600 pl-3' : 'space-y-1'}>
      {items.map(({ node, rel }) => {
        const more = GRAPH.drill(node.id).length > 0;
        return (
          <li key={`${rel}-${node.id}`}>
            <div className="flex flex-wrap items-baseline gap-1.5 text-[13px]">
              <span className="rounded border border-ink-600 px-1 text-[10px] text-fg-faint">{LEVEL_LABEL[node.kind]}</span>
              <span className="font-medium text-fg">{node.nameTr}</span>
              {more && (
                <button type="button" className="text-[11px] text-accent" aria-expanded={!!open[node.id]} onClick={() => setOpen((o) => ({ ...o, [node.id]: !o[node.id] }))}>
                  {open[node.id] ? 'kapat' : 'Detaylandır ↓'}
                </button>
              )}
            </div>
            <p className="text-[12px] leading-relaxed text-fg-muted">{node.summary}</p>
            {open[node.id] && depth < 6 && <DrillTree id={node.id} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

function Chain({ nodes, overlay }: { nodes: KNode[]; overlay?: OrganView['relations'][number]['overlay'] }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-[12.5px]">
      {nodes.map((n, i) => {
        const o = overlay?.find((x) => x.nodeId === n.id);
        return (
          <span key={n.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-fg-faint">→</span>}
            <span
              className={`rounded-md border px-1.5 py-0.5 ${o ? (o.status === 'high' || o.status === 'low' ? 'border-caution/50 bg-caution/10 text-caution-fg' : 'border-accent/40 bg-accent/10 text-accent') : 'border-ink-600 text-fg-muted'}`}
              title={o?.text}
            >
              {n.nameTr}
              {o ? ` · ${o.text}` : ''}
            </span>
          </span>
        );
      })}
    </p>
  );
}

function NormalView({ v }: { v: OrganView }) {
  return (
    <div className="space-y-3">
      <Section title="Bu nedir, nerededir?" hint="Genel anatomi-fizyoloji bilgisi (kişiye özel değil).">
        <div className="flex items-center gap-2">
          <SourceBadge source="KNOWLEDGE" />
          <span className="text-xs text-fg-faint">{LEVEL_LABEL[v.node.kind]}</span>
        </div>
        <p className="text-sm leading-relaxed text-fg">{v.normal.summary}</p>
        {v.systems.length > 0 && <p className="text-xs text-fg-muted">Ait olduğu sistem: {v.systems.map((s) => s.nameTr).join(', ')}</p>}
        {v.normal.parts.length > 0 && (
          <p className="text-xs text-fg-muted">
            Bölümleri:{' '}
            {v.normal.parts.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <NodeLink n={p} />
              </span>
            ))}
          </p>
        )}
      </Section>
      {v.normal.functions.length > 0 && (
        <Section title="Normalde ne işe yarar?">
          <ul className="space-y-1">
            {v.normal.functions.map((f) => (
              <li key={f.id} className="text-[13px] leading-relaxed text-fg-muted">
                <span className="font-medium text-fg">{f.nameTr}</span> — {f.summary}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {v.normal.physiology.length > 0 && (
        <Section title="Normal fizyoloji · neyi ne etkiler?" hint="Ok yönü: yürütür / üretir / düzenler / yol açar.">
          <div className="space-y-1.5">
            {v.normal.physiology.map((c, i) => (
              <Chain key={i} nodes={c} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Detaylandır · organdan moleküle">
        <DrillTree id={v.node.id} />
      </Section>
      {v.normal.biomarkers.length > 0 && (
        <Section title="Bu organla ilişkili ölçümler">
          <ul className="grid gap-1 sm:grid-cols-2">
            {v.normal.biomarkers.map((b) => (
              <li key={b.id} className="text-[13px] text-fg-muted">
                <span className="text-fg">{b.nameTr}</span> — {b.summary}
                {b.note && <span className="block text-[11px] text-fg-faint">{b.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function PersonalView({ v, model, studies }: { v: OrganView; model: ReturnType<typeof useHealthModel>['model']; studies: ReturnType<typeof useHealthModel>['studies'] }) {
  const imaging = v.node.structure && studies ? studiesForStructure(v.node.structure, studies) : [];
  if (!v.personal.hasData && !imaging.length)
    return (
      <Section title="Benim durumum">
        <p className="text-sm text-fg-muted">Bu organla ilişkili tahlil, rapor ya da görüntü verin yok. Belgeler ekranından yükleyebilirsin; rapor şart değildir — görüntünün kendisi de analiz edilir.</p>
      </Section>
    );
  return (
    <div className="space-y-3">
      {v.personal.labs.length > 0 && (
        <Section title="Tahlil sonuçlarım" hint="Referans aralığı önceliği: raporun kendi aralığı > laboratuvar > yaş/cinsiyet > genel aralık.">
          <ul className="space-y-1.5">
            {v.personal.labs.map((l) => (
              <li key={l.testKey} className="rounded-lg border border-ink-600/60 p-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <SourceBadge source="LAB" />
                  <button type="button" className="font-medium text-fg hover:text-accent" onClick={() => go({ name: 'result', key: l.testKey })}>
                    {l.name}
                  </button>
                  <span className="tabular-nums">
                    {l.value.toLocaleString('tr-TR')} {l.unit}
                  </span>
                  <span className={`text-xs ${STATUS_CLS[l.status]}`}>{STATUS_TR[l.status]}</span>
                  {l.critical && <span className="rounded border border-high/50 px-1 text-[10px] font-semibold text-high">ACİL DEĞERLENDİRME</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-fg-faint">
                  {l.refMin !== undefined || l.refMax !== undefined ? `Referans ${l.refMin ?? '…'}–${l.refMax ?? '…'}${l.refSource ? ` (${REF_TR[l.refSource]})` : ''} · ` : ''}
                  {formatDate(l.date)}
                </p>
                <div className="mt-1 flex flex-wrap">
                  <WhyButton model={model} testKey={l.testKey} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {v.personal.imageObservations.length > 0 && (
        <Section title="Görüntülerimden çıkan gözlemler" hint="Görüntünün kendisinden cihazda çıkarıldı; bir radyolog raporu değildir ve doğrulanmamıştır.">
          <ul className="space-y-2">
            {v.personal.imageObservations.map((o) => (
              <li key={o.id} className="space-y-1 rounded-lg border border-ink-600/60 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source="IMAGE_ANALYSIS" />
                  <ConfidenceNote c={o.confidence} />
                </div>
                <p className="text-sm text-fg">{o.text}</p>
                {o.location && <LocationPath loc={o.location} onOpen={(id) => go({ name: 'organ', id })} />}
                <WhyButton location={o.location} model={model} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {v.personal.reportFindings.length > 0 && (
        <Section title="Raporlarımda yazanlar" hint="Rapordan okunan cümleler; konum rapor/metin tabanlı yaklaşık konumdur, görüntü üzerinde piksel konumu değildir.">
          <ul className="space-y-1.5">
            {v.personal.reportFindings
              .filter((f) => f.status !== 'normal')
              .map((f) => (
                <li key={f.id} className="rounded-lg border border-ink-600/60 p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge source={f.source} />
                    <span className={`text-xs ${f.status === 'abnormal' ? 'text-high' : f.status === 'uncertain' ? 'text-caution-fg' : 'text-accent'}`}>
                      {f.negated ? 'yok / izlenmedi' : f.status === 'abnormal' ? 'dikkat' : f.status === 'uncertain' ? 'olasılık' : 'olağan'}
                    </span>
                    {f.date && <span className="text-[11px] text-fg-faint">{formatDate(f.date)}</span>}
                  </div>
                  <p className="mt-1 text-fg-muted">“{f.text}”</p>
                  {f.location && f.location.path.length > 0 && <LocationPath loc={f.location} onOpen={(id) => go({ name: 'organ', id })} />}
                </li>
              ))}
          </ul>
          {v.personal.reportFindings.some((f) => f.status === 'normal') && (
            <p className="text-[12px] text-fg-faint">
              Ayrıca {v.personal.reportFindings.filter((f) => f.status === 'normal').length} cümle olağan ya da “izlenmedi” (bulgu yok) olarak yazılmış; bunlar bulgu sayılmaz.
            </p>
          )}
        </Section>
      )}
      {v.personal.patterns.length > 0 && (
        <Section title="Örüntüler · kanıt paneli" hint="Örüntü güveni kanıtın tutarlılığını gösterir; hastalık olasılığı değildir.">
          {v.personal.patterns.map((p) => (
            <div key={p.id} className="rounded-lg border border-caution/30 p-3">
              <p className="text-sm font-medium text-fg">{p.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{p.meaning}</p>
              <ul className="mt-2 space-y-0.5 text-[12.5px]">
                {p.supporting.map((e, i) => (
                  <li key={`s${i}`} className="text-fg">
                    ✓ {e.label} <span className="text-fg-faint">· {e.detail}</span>
                  </li>
                ))}
                {p.contradictory.map((e, i) => (
                  <li key={`c${i}`} className="text-caution-fg">
                    ✗ {e.label} <span className="text-fg-faint">· {e.detail}</span>
                  </li>
                ))}
                {p.missing.map((m, i) => (
                  <li key={`m${i}`} className="text-fg-faint">
                    ? Eksik: {m}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12px] text-fg-muted">Olası açıklamalar (kesin değil): {p.possibleExplanations.join(' · ')}</p>
              <ConfidenceNote c={p.confidence} />
            </div>
          ))}
        </Section>
      )}
      {imaging.length > 0 && (
        <Section title="Görüntülemelerim">
          <ul className="space-y-1">
            {imaging.map((st) => (
              <li key={st.key}>
                <button type="button" className="text-left text-sm text-fg hover:text-accent" onClick={() => go({ name: 'document', id: st.head.id })}>
                  {CATEGORY_LABEL[st.category]} · {formatDate(st.date)}
                  <span className="block text-xs text-fg-muted">
                    {st.note?.analysis ? `Görüntü analizi: ${st.note.analysis.summary}` : 'Görüntü analizi yok'}
                    {st.findings.length ? ` · Rapor: ${st.findings.length} cümle` : ' · Rapor yok'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function DiffView({ v }: { v: OrganView }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Normalde">
          <p className="text-sm leading-relaxed text-fg-muted">{v.normal.summary}</p>
          {v.normal.functions.slice(0, 4).map((f) => (
            <p key={f.id} className="text-[12.5px] text-fg-muted">
              • {f.nameTr}
            </p>
          ))}
        </Section>
        <Section title="Bende (fark)">
          {v.difference.length ? (
            <ul className="space-y-1.5">
              {v.difference.map((d, i) => (
                <li key={i} className="text-[13px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SourceBadge source={d.source} />
                    <span className="font-medium text-fg">{d.label}</span>
                  </div>
                  <p className="text-fg-muted">{d.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">{v.personal.hasData ? 'Verilerinde normalden anlamlı bir fark görünmüyor.' : 'Karşılaştırılacak verin yok.'}</p>
          )}
        </Section>
      </div>
      {v.relations.length > 0 && (
        <Section title="İlişkiler · vücudumda neyi ne etkiliyor?" hint="Renkli kutular: zincirin o noktasına bağlanan kendi sonucun (sarı: aralık dışı, yeşil: aralıkta).">
          <div className="space-y-1.5">
            {v.relations.map((r, i) => (
              <Chain key={i} nodes={r.chain} overlay={r.overlay} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function OrganPage({ id, view = 'normal' }: { id: string; view?: OrganViewMode }) {
  const { model, studies } = useHealthModel();
  const v = useMemo(() => buildOrganView(id, model), [id, model]);
  const fallback = !GRAPH.node(id) ? structureById.get(id) : undefined;

  if (!model)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Hazırlanıyor…
      </div>
    );

  if (!v) {
    const st = model.organs.get(id);
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8">
        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => go({ name: 'mybody' })}>
          <ChevronLeftIcon size={13} /> Vücudum
        </button>
        <h1 className="text-xl font-semibold">{fallback?.nameTr ?? id}</h1>
        <p className="text-sm text-fg-muted">{fallback?.blurb ?? 'Bu yapı için bilgi grafiğinde ayrıntılı sayfa henüz yok.'}</p>
        {st && (st.labs.length > 0 || st.reportFindings.length > 0) && (
          <ul className="space-y-1 text-sm">
            {st.labs.map((l) => (
              <li key={l.testKey}>
                <SourceBadge source="LAB" /> {l.name} {l.value.toLocaleString('tr-TR')} {l.unit} ({STATUS_TR[l.status]})
              </li>
            ))}
            {st.reportFindings.map((f) => (
              <li key={f.id}>
                <SourceBadge source={f.source} /> {f.text}
              </li>
            ))}
          </ul>
        )}
        {fallback && (
          <button type="button" className="btn-primary" onClick={() => go({ name: 'body', structure: id })}>
            <BodyIcon size={16} /> 3B'de göster
          </button>
        )}
      </div>
    );
  }

  const critical = v.personal.labs.filter((l) => l.critical);
  const structure = v.node.structure;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-8">
      <nav aria-label="Konum" className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
        <button type="button" className="hover:text-accent" onClick={() => go({ name: 'mybody' })}>
          Vücudum
        </button>
        {v.path.map((n) => (
          <span key={n.id} className="flex items-center gap-1">
            <span className="text-fg-faint">›</span>
            {n.id === v.node.id ? <span className="text-fg">{n.nameTr}</span> : <NodeLink n={n} />}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">{LEVEL_LABEL[v.node.kind]}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{v.node.nameTr}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {structure && (
            <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => go(v.node.part ? { name: 'body', structure, part: v.node.part } : { name: 'body', structure })}>
              <BodyIcon size={15} /> 3B'de göster
            </button>
          )}
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => go({ name: 'timeline' })}>
            <ChartIcon size={15} /> Zaman
          </button>
        </div>
      </div>

      {critical.length > 0 && (
        <Banner tone="warn">
          <strong>ACİL DEĞERLENDİRME:</strong> {critical.map((l) => l.name).join(', ')} kritik kabul edilen düzeyde. Bu bulgu acil klinik değerlendirme gerektirebilecek bir durumla ilişkili
          olabilir. Doktor değerlendirmesi gerekir.
        </Banner>
      )}

      <div role="tablist" aria-label="Görünüm" className="inline-flex rounded-xl border border-ink-600 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${view === t.key ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:text-fg'}`}
            onClick={() => go({ name: 'organ', id, view: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'normal' ? <NormalView v={v} /> : view === 'benim' ? <PersonalView v={v} model={model} studies={studies} /> : <DiffView v={v} />}

      {v.time.length > 0 && (
        <Section title="Zaman içinde" hint={v.time[0]!.trend.caution}>
          <ul className="space-y-1">
            {v.time.map((t) => (
              <li key={t.testKey} className="text-[13px] text-fg-muted">
                <button type="button" className="text-left hover:text-accent" onClick={() => go({ name: 'timeline', key: t.testKey })}>
                  {t.trend.statement}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {model.comparisons.some((c) => c.changes.length > 0 && (structure ? c.changes.some((x) => x.key.includes(structure)) : false)) && (
        <Section title="Eski ↔ yeni görüntüleme">
          {model.comparisons
            .filter((c) => structure && c.changes.some((x) => x.key.includes(structure)))
            .map((c, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs text-fg-muted">
                  {formatDate(c.previous.date)} → {formatDate(c.current.date)}
                </p>
                <ul className="space-y-0.5 text-[13px]">
                  {c.changes.map((x, j) => (
                    <li key={j} className="text-fg-muted">
                      <SourceBadge source={x.source} /> <span className="text-fg">{CHANGE_TR[x.change]}</span>: {x.label} — {x.detail}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-fg-faint">{c.reliability.join(' ')}</p>
              </div>
            ))}
        </Section>
      )}
      <Section title="Belirsizlik · ne kesin, ne olasılık?">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-accent">Ölçülmüş / yazılı</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-fg-muted">{v.uncertainty.certain.length ? v.uncertainty.certain.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul>
          </div>
          <div>
            <p className="text-xs font-medium text-caution-fg">Olasılıksal</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-fg-muted">{v.uncertainty.probabilistic.length ? v.uncertainty.probabilistic.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul>
          </div>
          <div>
            <p className="text-xs font-medium text-fg-muted">Eksik bilgi</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-fg-faint">{v.uncertainty.missing.length ? v.uncertainty.missing.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-fg-faint">
          Kan Haritası tanı koymaz ve doktorun yerini tutmaz. Görüntü analizleri yanlış pozitif ya da yanlış negatif olabilir; eksik veriler değerlendirmeyi sınırlar.
        </p>
      </Section>
      <p className="text-[11px] text-fg-faint">İlişki türleri: {Object.values(RELATION_LABEL).join(' · ')}</p>
    </div>
  );
}

const CHANGE_TR = { new: 'Yeni', resolved: 'Artık kayıtlı değil', persisting: 'Devam ediyor', growing: 'Büyümüş', shrinking: 'Küçülmüş', 'stable-size': 'Boyut stabil', 'report-states': 'Rapor diyor ki' } as const;
