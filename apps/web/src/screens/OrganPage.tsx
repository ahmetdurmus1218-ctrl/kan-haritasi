/**
 * Organ sayfası yönlendiricisi:
 *   #/organ/<id>          → OrganOverview (Ne? Nasıl çalışır? Bende ne var? İlişkiler · İç yapı · Derin)
 *   #/organ/<id>/benim    → kişisel ayrıntı (sonuçlar, görüntü gözlemleri, rapor, örüntüler, zaman, belirsizlik)
 *   #/organ/<id>/ic       → organın içi, adım adım
 *   #/organ/<id>/derin/…  → doku → hücre → süreç → molekül, seviye seviye
 * Organın ilk ekranında hiçbir zaman doğrudan hücre/molekül ağacı açılmaz.
 */
import { useEffect, useMemo } from 'react';
import { type KNode, type OrganView, buildOrganView, flowsForOrgan, interiorFor } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { type OrganViewMode, go, hrefFor } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { studiesForStructure } from '../lib/imagingStudies';
import { CATEGORY_LABEL } from '../lib/imaging';
import { formatDate } from '../lib/format';
import { TONE, TONE_RANK, labTone, reportTone } from '../lib/tone';
import { insideLinks } from '../anatomy/organs';
import { INSIDE } from '../explore/inside/registry';
import { BodyIcon, ChevronLeftIcon, ChevronRightIcon, SpinnerIcon } from '../components/icons';
import { ConfidenceNote, LocationPath, SourceBadge, WhyButton } from '../components/evidence';
import { LabRow, Breadcrumb, Section } from './organ/common';
import { OrganOverview } from './organ/OrganOverview';
import { OrganInside } from './organ/OrganInside';
import { DeepDive } from './organ/DeepDive';

function Chain({ nodes, overlay }: { nodes: KNode[]; overlay?: OrganView['relations'][number]['overlay'] }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-[12.5px]">
      {nodes.map((n, i) => {
        const o = overlay?.find((x) => x.nodeId === n.id);
        return (
          <span key={n.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-fg-faint">→</span>}
            <span
              className={`rounded-md border px-1.5 py-0.5 ${o ? (o.status === 'high' ? 'border-high/45 bg-high/[0.07] text-high' : o.status === 'low' ? 'border-low/45 bg-low/[0.07] text-low' : 'border-ink-500 text-fg') : 'border-ink-600 text-fg-muted'}`}
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

function PersonalView({ v, model, studies }: { v: OrganView; model: ReturnType<typeof useHealthModel>['model']; studies: ReturnType<typeof useHealthModel>['studies'] }) {
  const imaging = v.node.structure && studies ? studiesForStructure(v.node.structure, studies) : [];
  if (!v.personal.hasData && !imaging.length)
    return (
      <Section title="Benim durumum">
        <p className="text-sm text-fg-muted">Bu organla ilişkili tahlil, rapor ya da görüntü verin yok. “Veri ekle” ile yükleyebilirsin; rapor şart değildir.</p>
      </Section>
    );
  return (
    <div className="space-y-3">
      {v.personal.labs.length > 0 && (
        <Section title="Tahlil sonuçlarım" hint="Referans aralığı önceliği: raporun kendi aralığı > laboratuvar > yaş/cinsiyet > genel aralık.">
          <ul className="space-y-1.5" aria-label="Tahlil sonuçlarım">
            {[...v.personal.labs].sort((a, b) => TONE_RANK[labTone(b)] - TONE_RANK[labTone(a)]).map((l) => (
              <LabRow key={l.testKey} l={l}>
                <div className="mt-1 flex flex-wrap">
                  <WhyButton model={model} testKey={l.testKey} />
                </div>
              </LabRow>
            ))}
          </ul>
        </Section>
      )}
      {v.personal.modelFindings.length > 0 && (
        <Section title="Yerel tıbbi AI modelinin bulguları" hint="Cihazında kurulu bir tıbbi görüntü modeli bu bulguları görüntünün üzerinde konumlandırdı (model-derived). Tanı değildir; hekim değerlendirmesi gerekir.">
          <ul className="space-y-2" aria-label="Model bulguları">
            {v.personal.modelFindings.map((f) => {
              const c = model?.modelConcordance.find((x) => x.finding.id === f.id);
              const doc = f.provenance.documentId;
              return (
                <li key={f.id} className="space-y-1 rounded-lg border border-[#a78bfa]/40 p-2.5" data-testid="organ-model-finding">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge source="IMAGE_MODEL" />
                    <ConfidenceNote c={f.confidence} />
                    {f.provenance.model && (
                      <span className="text-[11px] text-fg-faint">
                        {f.provenance.model.name} {f.provenance.model.version}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-fg">{f.finding}</p>
                  {f.anatomicalStructure && <LocationPath loc={f.anatomicalStructure} onOpen={(id) => go({ name: 'organ', id })} />}
                  {c && c.relation !== 'no-report' && (
                    <p className={`text-[12.5px] ${c.relation === 'contradicted-by-report' ? 'font-medium text-high' : 'text-fg-muted'}`}>
                      {c.relation === 'contradicted-by-report' ? '⚠ ' : ''}
                      {c.text}
                    </p>
                  )}
                  {doc && (
                    <button type="button" className="text-[12.5px] text-accent hover:underline" onClick={() => go({ name: 'document', id: doc })}>
                      Görüntüyü aç
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {v.personal.modelStructures.length > 0 && (
        <Section title="Yerel modelin bölütlediği yapılar" hint="Cihazındaki gerçek bir bölütleme modeli bu yapıyı görüntünde buldu ve ölçtü. Bu normal anatomi bölütlemesidir; bir bulgu ya da hastalık göstergesi değildir. Hacim bir referans aralığıyla karşılaştırılmadı.">
          <ul className="space-y-1.5" aria-label="Model bölütlemeleri">
            {v.personal.modelStructures.map((s) => {
              const doc = s.provenance.documentId;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-600/60 p-2.5 text-sm" data-testid="organ-model-structure">
                  <SourceBadge source="IMAGE_MODEL" />
                  <span className="text-fg">{s.name}</span>
                  {s.measurements.map((m) => (
                    <span key={m.name} className="text-xs text-fg-muted">
                      {m.name}: {m.value.toLocaleString('tr-TR')} {m.unit}
                    </span>
                  ))}
                  <span className="text-[11px] text-fg-faint">{s.provenance.model?.name}</span>
                  {doc && (
                    <button type="button" className="ml-auto text-[12.5px] text-accent hover:underline" onClick={() => go({ name: 'document', id: doc })}>
                      Görüntüyü aç
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {v.personal.imageObservations.length > 0 && (
        <Section title="Görüntülerimden çıkan gözlemler" hint="Görüntünün kendisinden cihazda, kural tabanlı ön kontrolle çıkarıldı (tıbbi görüntü modeli değil); bir radyolog raporu değildir ve doğrulanmamıştır. Sağ-sol farkı bir görüntü asimetrisi gözlemidir, tıbbi bulgu değildir.">
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
              .filter((f) => f.status !== 'normal' || f.negated)
              .map((f) => (
                <li key={f.id} className="rounded-lg border border-ink-600/60 p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge source={f.source} />
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${TONE[reportTone(f)].chip}`}>
                      {f.negated ? 'Bulunmadı · raporda izlenmedi' : f.status === 'abnormal' ? 'Raporda dikkat çeken ifade' : f.status === 'uncertain' ? 'Belirsiz / olasılık' : f.status === 'not-assessed' ? 'Değerlendirilemedi' : 'Olağan'}
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
        <Section title="İlişkiler · vücudumda neyi ne etkiliyor?" hint="Renkli kutular: zincirin o noktasına bağlanan kendi sonucun (turuncu: yüksek, mavi: düşük, çerçeveli: aralıkta). Olası ilişkidir; kanıtlanmış etki değildir.">
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


/** Kişisel ayrıntı: "Sonuçlarımı gör". Akışlar "Benim durumuma göre göster" ile bağlanır. */
function PersonalDetail({ v, model, studies }: { v: OrganView; model: ReturnType<typeof useHealthModel>['model']; studies: ReturnType<typeof useHealthModel>['studies'] }) {
  const structure = v.node.structure;
  const flows = flowsForOrgan(v.node.id);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => go({ name: 'organ', id: v.node.id })}>
          <ChevronLeftIcon size={14} /> {v.node.nameTr}
        </button>
        <Breadcrumb organId={v.node.id} current="Benim durumum" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Benim durumum · {v.node.nameTr}</h1>
      <PersonalView v={v} model={model} studies={studies} />
      {flows.length > 0 && (
        <Section title="Fizyolojide nerede?" hint="Sonuçların normal akışın hangi basamaklarıyla ilişkili olabileceği. Olası ilişkidir; o basamağın bozulduğunu göstermez.">
          <div className="flex flex-col gap-2">
            {flows.slice(0, 3).map((f) => (
              <button key={f.id} type="button" className="btn-ghost min-h-[44px] justify-between px-3.5 text-sm" onClick={() => go({ name: 'flow', id: f.id, step: 1, personal: true })}>
                {f.title} · benim durumuma göre <ChevronRightIcon size={15} />
              </button>
            ))}
          </div>
        </Section>
      )}
      <DiffView v={v} />
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
          {model?.comparisons.some((c) => structure && c.changes.some((x) => x.key.includes(structure))) && (
            <Section title="Eski ↔ yeni görüntüleme">
              {(model?.comparisons ?? [])
                .filter((c) => structure && c.changes.some((x) => x.key.includes(structure)))
                .map((c, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-xs text-fg-muted">
                      {formatDate(c.previous.date)} → {formatDate(c.current.date)}
                    </p>
                    <ul className="space-y-0.5 text-[13px]">
                      {c.changes.map((x, j) => (
                        <li key={j} className="text-fg-muted">
                          <span className="text-fg">{CHANGE_TR[x.change]}</span>: {x.label} — {x.detail}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-fg-faint">{c.reliability.join(' ')}</p>
                  </div>
                ))}
            </Section>
          )}
          <Section title="Ne kesin, ne olasılık?">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-fg">Ölçülmüş / yazılı</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-fg-muted">{v.uncertainty.certain.length ? v.uncertainty.certain.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul>
              </div>
              <div>
                <p className="text-xs font-medium text-fg">Olasılıksal</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-fg-muted">{v.uncertainty.probabilistic.length ? v.uncertainty.probabilistic.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul>
              </div>
              <div>
                <p className="text-xs font-medium text-fg">Eksik bilgi</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-fg-faint">{v.uncertainty.missing.length ? v.uncertainty.missing.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-fg-faint">
              Kan Haritası tanı koymaz ve doktorun yerini tutmaz. Görüntü analizleri yanlış pozitif ya da yanlış negatif olabilir; eksik veriler değerlendirmeyi sınırlar.
            </p>
          </Section>
    </div>
  );
}

/** Bilgi grafiğinde ayrıntılı sayfası olmayan yapı (ör. yemek borusu): kısa tanım, akışlar, iç sahneler, 3B. */
function StructureFallback({ id }: { id: string }) {
  const s = structureById.get(id);
  const flows = flowsForOrgan(id);
  const scenes = s ? insideLinks(id).filter((l) => l.id !== 'hucre') : [];
  const interior = interiorFor(id);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8">
      <Breadcrumb organId={id} />
      <h1 className="text-2xl font-semibold">{s?.nameTr ?? id}</h1>
      <p className="text-[15px] text-fg-muted">{s?.blurb ?? 'Bu yapı için bilgi grafiğinde ayrıntılı sayfa henüz yok.'}</p>
      {flows.length > 0 && (
        <Section title="Nasıl çalışır?">
          {flows.slice(0, 3).map((f) => (
            <button key={f.id} type="button" className="btn-ghost min-h-[44px] w-full justify-between px-3.5 text-sm" onClick={() => go({ name: 'flow', id: f.id, step: 1 })}>
              {f.title} <ChevronRightIcon size={15} />
            </button>
          ))}
        </Section>
      )}
      <div className="flex flex-wrap gap-2">
        {interior && (
          <button type="button" className="btn-primary" onClick={() => go({ name: 'interior', id: interior.organId })} data-testid="organ-enter-interior">
            İçine gir · {interior.name}
          </button>
        )}
        {s && (
          <button type="button" className={interior ? 'btn-ghost' : 'btn-primary'} onClick={() => go({ name: 'body', structure: id })}>
            <BodyIcon size={16} /> 3B'de göster
          </button>
        )}
        {scenes.map((l) => (
          <button key={l.id} type="button" className="btn-ghost" onClick={() => go({ name: 'simulation', id: l.id, from: id, mode: 'temel' })}>
            Daha derine in · {INSIDE[l.id].title}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Eski "#/organ/<id>/ic" adresi: iç dünya artık 3B keşifte (#/ic/<iç dünya>) açılır. */
function InteriorRedirect({ id }: { id: string }) {
  useEffect(() => {
    history.replaceState(null, '', hrefFor({ name: 'interior', id }));
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [id]);
  return null;
}

export function OrganPage({ id, view, trail }: { id: string; view?: OrganViewMode; trail?: string[] }) {
  const { model, studies } = useHealthModel();
  const v = useMemo(() => buildOrganView(id, model), [id, model]);

  if (!model)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Hazırlanıyor…
      </div>
    );
  if (!v) return <StructureFallback id={id} />;
  if (view === 'benim' || view === 'fark') return <PersonalDetail v={v} model={model} studies={studies} />;
  if (view === 'ic') {
    // İçine gir: daima organın iç dünyası. Duvar → doku → hücre ("doku" görünümü) buraya asla yedek olarak açılmaz.
    const def = interiorFor(v.node.id);
    return def ? <InteriorRedirect id={def.organId} /> : <OrganOverview v={v} model={model} />;
  }
  if (view === 'doku') return <OrganInside v={v} model={model} />;
  if (view === 'derin') return <DeepDive v={v} model={model} trail={trail ?? []} />;
  return <OrganOverview v={v} model={model} />;
}

const CHANGE_TR = { new: 'Yeni', resolved: 'Artık kayıtlı değil', persisting: 'Devam ediyor', growing: 'Büyümüş', shrinking: 'Küçülmüş', 'stable-size': 'Boyut stabil', 'report-states': 'Rapor diyor ki' } as const;
