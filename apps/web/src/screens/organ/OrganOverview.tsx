/**
 * Organın ilk ekranı. Sıra bilinçlidir: önce organın kendisi, sonra kişinin durumu, sonra ilişkiler;
 * iç yapı ve doku → hücre → molekül yalnızca kullanıcı isterse.
 *
 *   ← Geri · Vücut › Sistem › Organ
 *   Organ adı · kısa açıklama · [Vücudumda göster]
 *   1. Nasıl çalışır?      normal anatomi + işlev · [Fizyolojiyi adım adım incele]
 *   2. Benim durumum       renkli sonuçlar · görüntüleme · [Neden?] · [Sonuçlarımı gör]
 *   3. Bunlar nasıl ilişkili?  organlar arası akış (tıklanabilir)
 *   4. İç yapı            [Organın içine gir]
 *   5. Daha derine in      Doku · Hücre · Molekül
 */
import { useState } from 'react';
import { GRAPH, type HealthModel, type OrganView, flowsForOrgan, isPositiveReport, organNeighbors } from '@kh/analysis';
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

      <Section title="1. Nasıl çalışır?" id="nasil-calisir">
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
        {v.normal.parts.length > 0 && (
          <p className="text-[13px] text-fg-muted">
            Bölümleri: {v.normal.parts.map((p) => p.nameTr).join(', ')}
          </p>
        )}
        {flows.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {flows.slice(0, 3).map((f, i) => (
              <StepButton key={f.id} label={i === 0 ? `Fizyolojiyi adım adım incele · ${f.title}` : f.title} onClick={() => go({ name: 'flow', id: f.id, step: 1 })} />
            ))}
          </div>
        )}
      </Section>

      <Section title="2. Benim durumum" id="benim-durumum">
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

      {neighbors.length > 0 && (
        <Section title="3. Bunlar nasıl ilişkili?" hint="Organlar arası akış: bir organa dokunarak ona geçebilirsin.">
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
        </Section>
      )}

      <Section title="4. İç yapı">
        <p className="text-sm text-fg-muted">
          {inside.length ? `Organın içi adım adım: ${inside.map((n) => n.nameTr).join(' → ')}.` : 'Organın iç dokusunu eğitsel sahnede görebilirsin.'}
        </p>
        <StepButton label="Organın içine gir" icon={<LayersIcon size={15} />} onClick={() => go({ name: 'organ', id: v.node.id, view: 'ic' })} />
      </Section>

      <Section title="5. Daha derine in">
        <p className="text-sm text-fg-muted">Doku · Hücre · Biyolojik süreç · Molekül — her seviye ayrı açılır.</p>
        <StepButton label="Derinlemesine incele" onClick={() => go({ name: 'organ', id: v.node.id, view: 'derin', trail: [] })} />
      </Section>
    </div>
  );
}
