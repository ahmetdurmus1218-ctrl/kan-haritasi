/**
 * Organın ilk ekranı. Sıra bilinçlidir (ilerleyen açıklama — her şey aynı anda gösterilmez):
 *
 *   ← Geri · Vücut › Sistem › Organ
 *   Organ adı · kısa açıklama · [Vücudumda göster]
 *   1. Genel görünüm                 organ nedir, bölümleri, yapı türü (lümenli / dolu / damar / bileşik)
 *   2. Normalde nasıl çalışır?       normal fizyoloji · [Fizyolojiyi adım adım incele] · organlar arası akış
 *   3. İÇİNE GİR                     ana düğme → organın fiziksel/işlevsel iç dünyası (lümen, içerik, akış…)
 *   4. Benim durumum                 renkli sonuçlar · görüntüleme · [Neden?] · [Sonuçlarımı gör]
 *   5. Bende ne değişmiş olabilir?   kanıt (destekleyen / çelişen / eksik) ve fizyolojik ilişkiler
 *   6. Daha derine in                doku → hücre → molekül (İçine gir'den ayrı: mikroanatomi)
 */
import { useState } from 'react';
import { GRAPH, type HealthModel, INTERIOR_TYPE_TR, type OrganView, chainsForPlace, flowsForOrgan, interiorFor, isPositiveReport, organNeighbors, physioOverlay } from '@kh/analysis';
import { structureById } from '@kh/catalog';
import { type Route, go } from '../../state/router';
import { TONE, TONE_RANK, labTone } from '../../lib/tone';
import { Banner } from '../../components/ui';
import { BodyIcon, ChevronLeftIcon, ChevronRightIcon, LayersIcon, PlusIcon } from '../../components/icons';
import { Breadcrumb, LabRow, Section, organStatus } from './common';

const nameOf = (id: string) => GRAPH.node(id)?.nameTr ?? structureById.get(id)?.nameTr ?? id;
const organRoute = (id: string): Route => (GRAPH.node(id) || structureById.has(id) ? { name: 'organ', id } : { name: 'mybody' });

function StepButton({ label, onClick, icon }: { label: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button type="button" className="btn-ghost min-h-[44px] justify-between gap-2 px-3.5 text-sm" onClick={onClick}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ChevronRightIcon size={15} />
    </button>
  );
}

/** "Neden?" — bu değerlendirme hangi verilere dayanıyor, ne eksik? */
function EvidenceWhy({ v, model }: { v: OrganView; model: HealthModel | null }) {
  const [open, setOpen] = useState(false);
  const used = [
    ...v.personal.labs.map((l) => l.name),
    ...(v.time.length ? ['Önceki sonuç (zaman içindeki değişim)'] : []),
    ...(v.personal.imageObservations.some((o) => o.kind === 'asymmetry') ? ['Görüntü ön kontrolü gözlemi'] : []),
    ...(v.personal.reportFindings.some(isPositiveReport) ? ['Rapor cümlesi'] : []),
    ...(v.personal.modelFindings.length ? ['Yerel tıbbi AI modeli bulgusu'] : []),
    ...(v.personal.patterns.length ? [`Örüntü: ${v.personal.patterns[0]!.title}`] : []),
  ];
  const missing = [
    ...v.uncertainty.missing.filter((m) => m.endsWith('sonucu yok')).slice(0, 3),
    ...(model?.comparisons.length ? [] : ['Karşılaştırılacak önceki görüntü']),
  ];
  return (
    <div>
      <button type="button" className="btn-ghost min-h-[40px] px-3 text-xs" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
        Neden?
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-ink-600/60 p-3 text-[13px]">
          <p className="font-medium text-fg">Bu değerlendirme şu verilere dayanıyor:</p>
          <ul className="space-y-0.5">
            {used.length ? (
              used.map((u) => (
                <li key={u} className="text-fg">
                  <span className="text-accent">✓</span> {u}
                </li>
              ))
            ) : (
              <li className="text-fg-muted">Bu organla ilişkili verin yok.</li>
            )}
          </ul>
          {missing.length > 0 && (
            <>
              <p className="font-medium text-fg">Eksik bilgi:</p>
              <ul className="space-y-0.5 text-fg-muted">
                {missing.map((m) => (
                  <li key={m}>— {m}</li>
                ))}
              </ul>
            </>
          )}
          <p className="text-[11px] text-fg-faint">Bu bir tanı değildir; sonuçların bu organla ilişkisini gösterir.</p>
        </div>
      )}
    </div>
  );
}

export function OrganOverview({ v, model }: { v: OrganView; model: HealthModel | null }) {
  const structure = v.node.structure;
  const flows = flowsForOrgan(v.node.id);
  const neighbors = organNeighbors(v.node.id).slice(0, 3);
  const status = organStatus(v);
  const labs = [...v.personal.labs].sort((a, b) => TONE_RANK[labTone(b)] - TONE_RANK[labTone(a)]);
  const critical = labs.filter((l) => l.critical);
  const imgN = v.personal.imageObservations.filter((o) => o.kind === 'asymmetry').length;
  const repN = v.personal.reportFindings.filter((f) => !f.negated && (f.status === 'abnormal' || f.status === 'uncertain')).length;
  const modelN = v.personal.modelFindings.length;
  const inside = GRAPH.insidePath(v.node.id);
  const interior = interiorFor(v.node.id);
  const chains = chainsForPlace(interior?.organId ?? v.node.id).slice(0, 4);
  const personalChains = chains.map((c) => ({ c, ov: physioOverlay(c, model) })).filter((x) => x.ov.hasData);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-xs" onClick={() => (history.length > 1 ? history.back() : go({ name: 'mybody' }))}>
          <ChevronLeftIcon size={14} /> Geri
        </button>
        <Breadcrumb organId={v.node.id} />
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{v.node.nameTr}</h1>
          {structure && (
            <button type="button" className="btn-primary min-h-[44px] px-3.5 py-2 text-sm" onClick={() => go(v.node.part ? { name: 'body', structure, part: v.node.part } : { name: 'body', structure })}>
              <BodyIcon size={15} /> Vücudumda göster
            </button>
          )}
        </div>
        <p className="text-[15px] leading-relaxed text-fg-muted">{v.node.summary}</p>
        {v.personal.hasData && (
          <p className={`flex items-start gap-2 text-sm ${TONE[status.tone].text}`} data-testid="organ-status">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[status.tone].dot}`} aria-hidden="true" />
            <span>{status.sentence}</span>
          </p>
        )}
      </header>

      {critical.length > 0 && (
        <Banner tone="warn">
          <strong>Acil değerlendirme gerekebilir:</strong> {critical.map((l) => l.name).join(', ')} kritik kabul edilen düzeyde. Doktor değerlendirmesi gerekir.
        </Banner>
      )}

      <Section title="1. Genel görünüm" id="genel">
        <p className="text-[14px] leading-relaxed text-fg">{v.node.summary}</p>
        {v.normal.parts.length > 0 && <p className="text-[13px] text-fg-muted">Bölümleri: {v.normal.parts.map((p) => p.nameTr).join(', ')}</p>}
        {interior && (
          <p className="text-[12.5px] text-fg-muted" data-testid="organ-interior-type">
            Yapı türü: {INTERIOR_TYPE_TR[interior.type]}
          </p>
        )}
      </Section>

      <Section title="2. Normalde nasıl çalışır?" id="nasil-calisir">
        {v.normal.functions.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-fg-muted">Normalde ne işe yarar?</p>
            <ul className="space-y-0.5">
              {v.normal.functions.slice(0, 3).map((f) => (
                <li key={f.id} className="text-[14px] text-fg">
                  • {f.nameTr}
                </li>
              ))}
            </ul>
          </div>
        )}
        {flows.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {flows.slice(0, 3).map((f, i) => (
              <StepButton key={f.id} label={i === 0 ? `Fizyolojiyi adım adım incele · ${f.title}` : f.title} onClick={() => go({ name: 'flow', id: f.id, step: 1 })} />
            ))}
          </div>
        )}
        {neighbors.length > 0 && (
          <div className="space-y-2 pt-1" aria-label="Organlar arası akış">
            <p className="text-xs font-medium text-fg-muted">Bunlar nasıl ilişkili? (organlar arası akış — bir organa dokunarak ona geç)</p>
            <ul className="space-y-2">
              {neighbors.map((n) => (
                <li key={n.flow.id} className="text-sm">
                  <p className="mb-1 text-xs text-fg-faint">{n.flow.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {n.before && (
                      <>
                        <button type="button" className="rounded-full border border-ink-600 px-2.5 py-1 hover:border-accent" onClick={() => go(organRoute(n.before!))}>
                          {nameOf(n.before)}
                        </button>
                        <span className="text-fg-faint">→</span>
                      </>
                    )}
                    <span className="rounded-full border border-accent/50 bg-accent/10 px-2.5 py-1 text-accent">{v.node.nameTr}</span>
                    {n.after && (
                      <>
                        <span className="text-fg-faint">→</span>
                        <button type="button" className="rounded-full border border-ink-600 px-2.5 py-1 hover:border-accent" onClick={() => go(organRoute(n.after!))}>
                          {nameOf(n.after)}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {chains.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 pt-1 text-[12.5px] text-fg-muted">
            Vücudun süreçleri:{' '}
            {chains.map((c) => (
              <button key={c.id} type="button" className="rounded-full border border-ink-600 px-2.5 py-1 hover:border-accent hover:text-accent" onClick={() => go({ name: 'physiology', id: c.id })}>
                {c.title}
              </button>
            ))}
          </p>
        )}
      </Section>

      <Section title="3. İçine gir" id="icine-gir">
        {interior ? (
          <>
            <p className="text-sm text-fg-muted">
              {interior.type === 'solid' ? 'Organın içi dolu bir dokudur (lümen yok): ' : 'Organın içindeymiş gibi gör: '}
              {interior.stages
                .filter((x) => x.scale === 'interior')
                .slice(0, 6)
                .map((x) => x.title)
                .join(' → ')}
              .
            </p>
            <button type="button" className="btn-primary min-h-[48px] w-full justify-between px-4 text-[15px]" onClick={() => go({ name: 'interior', id: interior.organId })} data-testid="organ-enter-interior">
              <span className="flex items-center gap-2">
                <LayersIcon size={16} /> İçine gir
              </span>
              <ChevronRightIcon size={16} />
            </button>
            <p className="text-[11px] text-fg-faint">Eğitimsel normal anatomi/fizyoloji — kişisel görüntü değildir.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-fg-muted">Bu yapının ayrı bir iç dünyası yok (embriyonik ya da soyut yapı). Mikroanatomisi “Daha derine in” bölümündedir.</p>
          </>
        )}
      </Section>

      <Section title="4. Benim durumum" id="benim-durumum">
        {!v.personal.hasData ? (
          <div className="rounded-xl border border-dashed border-ink-600 p-4 text-center">
            <p className="text-[15px] text-fg">Bu organla ilgili verin yok.</p>
            <p className="mt-1 text-sm text-fg-muted">Bir tahlil, rapor ya da görüntü eklediğinde burada özetlenir.</p>
            <button type="button" className="btn-primary mt-3" onClick={() => go({ name: 'add' })}>
              <PlusIcon size={16} /> Veri ekle
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-fg-muted">
              Durum: <span className={TONE[status.tone].text}>{status.label}</span>
            </p>
            {labs.length > 0 && (
              <ul className="space-y-1.5" aria-label="İlişkili sonuçlar">
                {labs.slice(0, imgN || repN || modelN ? 3 : 4).map((l) => (
                  <LabRow key={l.testKey} l={l} compact />
                ))}
              </ul>
            )}
            {v.personal.modelStructures.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-ink-600/60 px-3 py-2 text-sm text-fg" data-testid="organ-model-structure-summary">
                <span aria-hidden="true">◇</span>
                <span>
                  Yerel model görüntünde bu organı bölütledi
                  {(() => {
                    const vol = v.personal.modelStructures.flatMap((s) => s.measurements.filter((m) => m.unit === 'mL')).reduce((a, m) => a + m.value, 0);
                    return vol ? ` · hacim ${vol >= 1000 ? `${(vol / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} L` : `${vol.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL`}` : '';
                  })()}{' '}
                  <span className="text-fg-muted">(normal anatomi bölütlemesi; bulgu değil)</span>
                </span>
              </p>
            )}
            {modelN > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-high/40 bg-high/[0.06] px-3 py-2 text-sm text-high" data-testid="organ-model-summary">
                <span aria-hidden="true">◆</span>
                <span>
                  Yerel tıbbi AI modeli: {v.personal.modelFindings.map((f) => f.finding).join(', ')} <span className="text-fg-muted">(model-derived; tanı değildir)</span>
                </span>
              </p>
            )}
            {(imgN > 0 || repN > 0) && (
              <p className="rounded-xl border border-dashed border-caution/45 px-3 py-2 text-sm text-caution-fg">
                {[imgN && `${imgN} görüntü asimetrisi gözlemi (tıbbi bulgu değil)`, repN && `${repN} rapor ifadesi`].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="flex flex-wrap items-start gap-2 pt-1">
              <button type="button" className="btn-primary min-h-[40px] px-3 text-sm" onClick={() => go({ name: 'organ', id: v.node.id, view: 'benim' })}>
                Sonuçlarımı gör
              </button>
              {flows[0] && (
                <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={() => go({ name: 'flow', id: flows[0]!.id, step: 1, personal: true })}>
                  Benim durumuma göre göster
                </button>
              )}
              <EvidenceWhy v={v} model={model} />
            </div>
          </>
        )}
      </Section>

      <Section title="5. Bende ne değişmiş olabilir?" id="bende-ne-degismis">
        {!v.personal.hasData ? (
          <p className="text-sm text-fg-muted" data-testid="organ-changes-none">
            Bu organla ilişkili kişisel veri bulunamadı. Normal anatomi ve fizyoloji yukarıda ve “İçine gir”de çalışmaya devam eder.
          </p>
        ) : (
          <div className="space-y-2" data-testid="organ-changes">
            {v.personal.patterns.slice(0, 2).map((p) => (
              <div key={p.id} className="rounded-lg border border-caution/30 p-2.5 text-[13px]">
                <p className="font-medium text-fg">{p.title}</p>
                <ul className="mt-1 space-y-0.5 text-[12.5px]">
                  {p.supporting.slice(0, 3).map((e, i) => (
                    <li key={`s${i}`} className="text-fg">
                      ✓ Destekler: {e.label}
                    </li>
                  ))}
                  {p.contradictory.slice(0, 2).map((e, i) => (
                    <li key={`c${i}`} className="text-caution-fg">
                      ✗ Desteklemez: {e.label}
                    </li>
                  ))}
                  {p.missing.slice(0, 2).map((m, i) => (
                    <li key={`m${i}`} className="text-fg-faint">
                      ? Eksik: {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {personalChains.map(({ c, ov }) => (
              <button key={c.id} type="button" className="btn-ghost min-h-[44px] w-full justify-between px-3 text-left text-[13px]" onClick={() => go({ name: 'physiology', id: c.id })}>
                <span>
                  {c.title}
                  <span className="block text-[11.5px] text-fg-muted">{ov.markers.map((m) => `${m.name} ${m.latest.status === 'high' ? '▲' : m.latest.status === 'low' ? '▼' : '·'}`).join(', ')} — ilişkili olabilir (olası ilişki)</span>
                </span>
                <ChevronRightIcon size={15} />
              </button>
            ))}
            {!v.personal.patterns.length && !personalChains.length && <p className="text-sm text-fg-muted">Verilerinde bu organın süreçleriyle ilişkili belirgin bir sapma görünmüyor; bu, her şeyin değerlendirildiği anlamına gelmez.</p>}
            <p className="text-[11px] text-fg-faint">“Olabilir”, “ilişkili olabilir”, “destekler / desteklemez” kanıt düzeyini anlatır; bu bir tanı değildir, değerlendirme hekime aittir.</p>
          </div>
        )}
      </Section>

      <Section title="6. Daha derine in" id="daha-derine">
        <p className="text-sm text-fg-muted">Mikroanatomi: doku · hücre · biyolojik süreç · molekül — her seviye ayrı açılır. (İçine gir organın iç dünyasıdır; burası mikroanatomidir.)</p>
        <StepButton label="Derinlemesine incele" onClick={() => go({ name: 'organ', id: v.node.id, view: 'derin', trail: [] })} />
        {inside.length > 0 && <StepButton label="Duvarı ve dokuyu adım adım incele" onClick={() => go({ name: 'organ', id: v.node.id, view: 'doku' })} />}
      </Section>
    </div>
  );
}
