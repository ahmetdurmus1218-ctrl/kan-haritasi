/**
 * Beyin haritası (#/beyin, #/beyin/<bölge>): radyoloji raporundaki her cümle beynin ilgili bölgesine
 * yerleşir; her cümle adım adım açılır: Raporda ne yazıyor → Sade dille → Beyinde nerede → Bölge normalde
 * ne yapar → İçine gir → Daha derine in → Hekimine sor. Konum rapor metninden gelir (görüntüden değil).
 */
import { type ReactNode, useMemo, useState } from 'react';
import { GRAPH, brainPath, interiorById } from '@kh/analysis';
import { go } from '../state/router';
import { useImagingStudies } from '../lib/imagingStudies';
import { type BrainFinding, REGION_STATUS_TEXT, type RegionStatus, brainFindings, brainRegions, deeperTrail, doctorQuestions, findingsAt, interiorStep, plainReading, regionStatus } from '../lib/brainReport';
import { TONE, TONE_VAR, type Tone } from '../lib/tone';
import { formatDate } from '../lib/format';
import { BodyIcon, BrainIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../components/icons';

const STATUS_TONE: Record<RegionStatus, Tone | null> = { attention: 'attention', uncertain: 'uncertain', normal: 'normal', 'not-assessed': 'not-assessed', none: null };
const SECTION: Record<string, string> = { bulgular: 'Bulgular', sonuc: 'Sonuç', diger: 'Rapor' };
const name = (id: string) => (id === 'brain' ? 'Beyin (genel)' : (GRAPH.node(id)?.nameTr ?? id));
/** Yoldaki ad: "Beyin" (bölge başlığındaki "genel" eki yolda yazılmaz). */
const pathName = (id: string) => GRAPH.node(id)?.nameTr ?? id;

function StatusChip({ status }: { status: RegionStatus }) {
  const tone = STATUS_TONE[status];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${tone ? TONE[tone].chip : 'border-ink-600 text-fg-faint'}`}>{REGION_STATUS_TEXT[status]}</span>;
}

function findingStatus(b: BrainFinding): RegionStatus {
  return regionStatus([b]);
}

export function BrainMapPage({ region }: { region?: string }) {
  const studies = useImagingStudies();
  const all = useMemo(() => (studies ? brainFindings(studies) : []), [studies]);
  if (!studies)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-fg-muted">Raporların açılıyor…</p>
      </div>
    );
  return region ? <RegionView key={region} region={region} all={all} /> : <MapView all={all} />;
}

/* ------------------------------------------------------------------ harita */

function MapView({ all }: { all: BrainFinding[] }) {
  const regions = brainRegions();
  const statusOf = (node: string) => regionStatus(findingsAt(node, all));
  const flagged = all.filter((b) => b.finding.status === 'abnormal' || b.finding.status === 'uncertain');
  const calm = all.filter((b) => !flagged.includes(b));
  const docs = new Set(all.map((b) => b.fileId)).size;
  const groups = [...new Set(regions.map((r) => r.group))];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <nav aria-label="Şu anda neredeyim?" className="flex items-center gap-1 text-xs text-fg-muted">
        <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'mybody' })}>
          Vücut
        </button>
        <span className="text-fg-faint">›</span>
        <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'system', id: 'nervous' })}>
          Sinir sistemi
        </button>
        <span className="text-fg-faint">›</span>
        <span className="text-fg" aria-current="location">
          Beyin haritası
        </span>
      </nav>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <BrainIcon size={26} /> Beyin haritası
        </h1>
        <p className="text-[15px] text-fg-muted" data-testid="brain-summary">
          {all.length
            ? `${docs} rapordan ${all.length} cümle okundu: ${all.filter((b) => b.finding.status === 'abnormal').length} dikkat çeken, ${all.filter((b) => b.finding.status === 'uncertain').length} belirsiz, ${all.filter((b) => b.finding.status === 'normal').length} olağan.`
            : 'Henüz beyinle ilgili bir rapor cümlesi yok.'}
        </p>
      </header>

      {!all.length && (
        <div className="card space-y-2 p-4" data-testid="brain-empty">
          <p className="text-[15px] text-fg">Beyin MR/BT raporunu ekle: her cümle okunur, sade dille anlatılır ve buradaki bölgesine yerleşir.</p>
          <p className="text-sm text-fg-muted">Filmin ya da ekranın fotoğrafından bölge okunmaz; radyoloğun yazdığı raporun kendisi (kâğıdın fotoğrafı ya da PDF) gerekir.</p>
          <button type="button" className="btn-primary px-3.5 py-2 text-sm" onClick={() => go({ name: 'add' })}>
            <PlusIcon size={15} /> Raporu ekle
          </button>
        </div>
      )}

      <BrainSketch statusOf={statusOf} />

      {flagged.length > 0 && (
        <section aria-label="Raporundan okunanlar" className="space-y-2">
          <h2 className="text-sm font-medium text-fg-muted">Raporunda dikkat çekenler</h2>
          <ul className="space-y-2">
            {flagged.map((b, i) => (
              <FindingRow key={i} b={b} />
            ))}
          </ul>
        </section>
      )}
      {calm.length > 0 && (
        <details className="rounded-2xl border border-ink-600/60 p-3">
          <summary className="cursor-pointer text-sm text-fg-muted">Olağan ya da “yok” denilen cümleler ({calm.length})</summary>
          <ul className="mt-2 space-y-2">
            {calm.map((b, i) => (
              <FindingRow key={i} b={b} />
            ))}
          </ul>
        </details>
      )}

      <section aria-label="Beynin bütün bölgeleri" className="space-y-4">
        <h2 className="text-sm font-medium text-fg-muted">Bütün bölgeler · birine dokun, içine gir</h2>
        {groups.map((g) => (
          <div key={g}>
            <h3 className="mb-1.5 text-xs uppercase tracking-wide text-fg-faint">{g}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {regions
                .filter((r) => r.group === g)
                .map((r) => (
                  <li key={r.node}>
                    <button type="button" className="flex min-h-[56px] w-full items-center gap-3 card px-4 py-3 text-left hover:border-ink-500" onClick={() => go({ name: 'brain', region: r.node })} data-region={r.node}>
                      <span className="min-w-0 flex-1 text-[15px] text-fg">{r.name}</span>
                      {statusOf(r.node) !== 'none' && <StatusChip status={statusOf(r.node)} />}
                      <ChevronRightIcon size={16} />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
      <p className="text-xs text-fg-faint">
        Konumlar raporun metninden okunur (rapor metninden yaklaşık konum); görüntünün pikselinden ölçülmez. Bölge iç dünyaları genel anatomi bilgisidir, senin beyninin görüntüsü değildir. Tanı koymaz; raporunu
        hekiminle konuş.
      </p>
    </div>
  );
}

function FindingRow({ b }: { b: BrainFinding }) {
  const st = findingStatus(b);
  return (
    <li>
      <button type="button" className="flex w-full items-start gap-3 card p-3.5 text-left hover:border-ink-500" onClick={() => go({ name: 'brain', region: b.node })}>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-fg">{b.finding.where ?? name(b.node)}</span>
            <StatusChip status={st} />
          </span>
          <span className="mt-1 block text-sm text-fg-muted">“{b.finding.text}”</span>
          <span className="mt-1 block text-xs text-accent">Adım adım gör →</span>
        </span>
      </button>
    </li>
  );
}

/** Yandan bakış: lob, beyincik ve beyin sapı. Renk raporun o bölge için söylediğini gösterir (metin ve rozetle birlikte). */
function BrainSketch({ statusOf }: { statusOf: (node: string) => RegionStatus }) {
  const parts: Array<{ node: string; d: string; label: string; lx: number; ly: number }> = [
    { node: 'brain.frontal', d: 'M30 122 C16 82 40 30 100 22 L132 20 L140 96 L96 110 C70 113 46 126 30 122 Z', label: 'Alın', lx: 70, ly: 72 },
    { node: 'brain.parietal', d: 'M132 20 C176 14 216 26 242 52 L222 100 L140 96 Z', label: 'Yan kafa', lx: 182, ly: 58 },
    { node: 'brain.occipital', d: 'M242 52 C272 76 286 112 270 140 L230 140 L222 100 Z', label: 'Arka', lx: 250, ly: 108 },
    { node: 'brain.temporal', d: 'M96 110 L140 96 L222 100 L230 140 C200 158 150 166 120 158 C100 152 90 136 96 110 Z', label: 'Şakak', lx: 160, ly: 132 },
    { node: 'brain.cerebellum', d: 'M204 152 C232 142 276 148 272 172 C268 194 226 198 206 186 C196 176 196 162 204 152 Z', label: 'Beyincik', lx: 238, ly: 176 },
    { node: 'brain.brainstem', d: 'M166 160 L190 158 L196 214 L172 214 Z', label: 'Sap', lx: 181, ly: 192 },
  ];
  const fill = (s: RegionStatus) => {
    const t = STATUS_TONE[s];
    return t && t !== 'normal' ? TONE_VAR[t] : 'var(--color-ink-700)';
  };
  return (
    <figure className="card p-3" aria-label="Beynin yandan görünüşü">
      <svg viewBox="0 0 300 220" className="mx-auto block h-auto w-full max-w-md" role="group" aria-label="Bölgeye dokun">
        {parts.map((p) => {
          const s = statusOf(p.node);
          return (
            <g
              key={p.node}
              role="button"
              tabIndex={0}
              aria-label={`${name(p.node)}${s !== 'none' ? ` · ${REGION_STATUS_TEXT[s]}` : ''}`}
              className="cursor-pointer outline-none focus-visible:opacity-80"
              onClick={() => go({ name: 'brain', region: p.node })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go({ name: 'brain', region: p.node }))}
              data-region={p.node}
              data-status={s}
            >
              <path d={p.d} style={{ fill: fill(s), fillOpacity: s === 'none' || s === 'normal' ? 0.55 : 0.35, stroke: 'var(--color-fg-muted)', strokeWidth: 1.2 }} />
              <text x={p.lx} y={p.ly} textAnchor="middle" style={{ fill: 'var(--color-fg)', fontSize: 11 }}>
                {p.label}
                {s === 'attention' ? ' !' : s === 'uncertain' ? ' ?' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-fg-faint">Yandan bakış (yüz solda). ! raporda dikkat çeken ifade · ? kesin olmayan ifade. Derin yapılar aşağıdaki listede.</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ bölge */

function RegionView({ region, all }: { region: string; all: BrainFinding[] }) {
  const node = region === 'brain' ? GRAPH.node('brain') : GRAPH.node(region);
  const items = findingsAt(region, all);
  const status = regionStatus(items);
  const fns = GRAPH.functionsOf(region).slice(0, 4);
  const path = brainPath(region);
  const step0 = interiorStep(region, { path, finding: { text: '' } });
  const children = GRAPH.children(region).filter((c) => c.id.startsWith('brain.') && c.kind === 'region');
  const flagged = items.filter((b) => b.finding.status === 'abnormal' || b.finding.status === 'uncertain');
  const [open, setOpen] = useState<number>(0);
  const ordered = [...flagged, ...items.filter((b) => !flagged.includes(b))];
  if (!node)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-fg-muted">Bu bölge bulunamadı.</p>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <nav aria-label="Şu anda neredeyim?" className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
        <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'brain' })}>
          Beyin haritası
        </button>
        {path
          .filter((id) => id !== 'brain')
          .map((id) => (
            <span key={id} className="flex items-center gap-1">
              <span className="text-fg-faint">›</span>
              {id === region ? (
                <span className="text-fg" aria-current="location">
                  {name(id)}
                </span>
              ) : (
                <button type="button" className="min-h-[32px] hover:text-accent" onClick={() => go({ name: 'brain', region: id })}>
                  {name(id)}
                </button>
              )}
            </span>
          ))}
      </nav>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{name(region)}</h1>
          <StatusChip status={status} />
        </div>
        <p className="text-[15px] leading-relaxed text-fg">{node.summary}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {step0 && (
            <button type="button" className="btn-primary min-h-[44px] px-4 text-sm" data-testid="brain-enter" onClick={() => go({ name: 'interior', id: step0.interior })}>
              İçine gir
            </button>
          )}
          <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go(node.part ? { name: 'body', structure: 'brain', part: node.part } : { name: 'body', structure: 'brain' })}>
            <BodyIcon size={15} /> 3B'de göster
          </button>
        </div>
      </header>

      <section aria-label="Raporunda bu bölge" className="space-y-3">
        <h2 className="text-sm font-medium text-fg-muted">Raporunda bu bölge {items.length ? `(${items.length} cümle)` : ''}</h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-600 p-4 text-sm text-fg-muted">
            Raporunda bu bölgeyle ilgili bir cümle yok. Bu, bölgenin normal olduğu anlamına gelmez; yalnızca raporda adı geçmiyor. Yine de içine girip nasıl çalıştığını görebilirsin.
          </p>
        ) : (
          <ul className="space-y-3">
            {ordered.map((b, i) => (
              <li key={i} className="card overflow-hidden">
                <button type="button" className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium text-fg">{b.finding.where ?? name(b.node)}</span>
                      <StatusChip status={findingStatus(b)} />
                    </span>
                    <span className="mt-1 block text-sm text-fg-muted">“{b.finding.text}”</span>
                  </span>
                  <ChevronRightIcon size={16} className={`mt-1 shrink-0 transition ${open === i ? 'rotate-90' : ''}`} />
                </button>
                {open === i && <FindingSteps b={b} region={region} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {fns.length > 0 && (
        <section aria-label="Normalde ne yapar" className="card p-4">
          <h2 className="mb-1.5 text-sm font-medium text-fg-muted">Normalde ne yapar?</h2>
          <ul className="space-y-1 text-[15px] text-fg">
            {fns.map((f) => (
              <li key={f.id}>• {f.nameTr}</li>
            ))}
          </ul>
        </section>
      )}

      {children.length > 0 && (
        <section aria-label="Bu bölgenin içindekiler">
          <h2 className="mb-2 text-sm font-medium text-fg-muted">İçindeki bölümler</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {children.map((c) => {
              const s = regionStatus(findingsAt(c.id, all));
              return (
                <li key={c.id}>
                  <button type="button" className="flex min-h-[52px] w-full items-center gap-3 card px-4 py-3 text-left hover:border-ink-500" onClick={() => go({ name: 'brain', region: c.id })}>
                    <span className="min-w-0 flex-1 text-[15px] text-fg">{c.nameTr}</span>
                    {s !== 'none' && <StatusChip status={s} />}
                    <ChevronRightIcon size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ adım adım */

function FindingSteps({ b, region }: { b: BrainFinding; region: string }) {
  const [step, setStep] = useState(0);
  const plain = plainReading(b.finding);
  const target = GRAPH.node(b.node);
  const fns = GRAPH.functionsOf(b.node).slice(0, 4);
  const inside = interiorStep(region, b);
  const insideDef = inside ? interiorById(inside.interior) : undefined;
  const insideStage = insideDef?.stages[inside!.stage - 1];
  const deeperStage = inside?.deeperStage ? insideDef?.stages[inside.deeperStage - 1] : undefined;
  const deeper = deeperTrail(b);
  const questions = doctorQuestions(b.finding);
  const steps: Array<{ title: string; body: ReactNode }> = [
    {
      title: 'Raporda ne yazıyor?',
      body: (
        <>
          <blockquote className="border-l-2 border-ink-500 pl-3 text-[15px] italic text-fg">{b.finding.text}</blockquote>
          <p className="text-xs text-fg-faint">
            {SECTION[b.finding.section] ?? 'Rapor'} bölümü · {b.docName}
            {b.dateKnown ? ` · ${formatDate(b.date)}` : ''} · Kaynak: RAPOR (radyoloğun yazdığı metin)
          </p>
        </>
      ),
    },
    {
      title: 'Sade dille',
      body: (
        <>
          <p className="text-[15px] text-fg">{plain.headline}</p>
          {plain.lines.length > 0 && (
            <ul className="space-y-1.5 text-sm text-fg-muted">
              {plain.lines.map((l, i) => (
                <li key={i}>• {l}</li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    {
      title: 'Beyinde nerede?',
      body: (
        <>
          <p className="text-[15px] text-fg">{b.path.map(pathName).join(' › ')}</p>
          <ul className="space-y-1 text-sm text-fg-muted">
            {plain.side && <li>• Taraf: {plain.side}</li>}
            {plain.depth && <li>• Katman: {plain.depth.text}</li>}
            <li>• Konum rapor metninden okundu (yaklaşık); görüntü üzerinde ölçülmedi.</li>
          </ul>
          <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go(target?.part ? { name: 'body', structure: 'brain', part: target.part } : { name: 'body', structure: 'brain' })}>
            <BodyIcon size={15} /> 3B'de göster
          </button>
        </>
      ),
    },
    {
      title: 'Bu bölge normalde ne yapar?',
      body: (
        <>
          <p className="text-[15px] text-fg">{target?.summary}</p>
          {fns.length > 0 && (
            <ul className="space-y-1 text-sm text-fg-muted">
              {fns.map((f) => (
                <li key={f.id}>• {f.nameTr}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-fg-faint">Genel anatomi bilgisidir; bu cümlenin bu işlevleri etkileyip etkilemediğini hekimin değerlendirir.</p>
        </>
      ),
    },
    {
      title: 'İçine gir',
      body: insideDef ? (
        <>
          <p className="text-[15px] text-fg">
            {insideDef.name} iç dünyasında bu cümle “{insideStage?.title}” basamağında “Senin verin” olarak görünür.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-[44px] px-4 text-sm" data-testid="finding-enter" onClick={() => go({ name: 'interior', id: insideDef.organId, stage: inside!.stage })}>
              İçine gir
            </button>
            {deeperStage && (
              <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'interior', id: insideDef.organId, stage: inside!.deeperStage })}>
                {deeperStage.title}
              </button>
            )}
          </div>
          <p className="text-xs text-fg-faint">İç dünya eğitimsel normal anatomidir; senin beyninin görüntüsü değildir.</p>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Bu bölge için iç dünya yok.</p>
      ),
    },
    {
      title: 'Daha derine in',
      body: (
        <>
          <p className="text-[15px] text-fg">{deeper.label}</p>
          <p className="text-sm text-fg-muted">Bu katmanın dokusuna, hücresine ve molekülüne seviye seviye in.</p>
          <button type="button" className="btn-ghost min-h-[44px] px-3.5 text-sm" onClick={() => go({ name: 'organ', id: deeper.organ, view: 'derin', trail: deeper.trail })}>
            Derinlemesine incele
          </button>
          <p className="text-xs text-fg-faint">Genel anatomi; “bu hücrede şu var” denmez.</p>
        </>
      ),
    },
    {
      title: 'Hekimine sor',
      body: (
        <ul className="space-y-1.5 text-[15px] text-fg">
          {questions.map((q) => (
            <li key={q}>• {q}</li>
          ))}
        </ul>
      ),
    },
  ];
  const cur = steps[step]!;
  return (
    <div className="space-y-3 border-t border-ink-700 p-4" data-testid="finding-steps" data-step={step + 1}>
      <ol className="flex flex-wrap gap-1.5" aria-label="Adımlar">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              aria-current={i === step ? 'step' : undefined}
              aria-label={`${i + 1}. ${s.title}`}
              className={`flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs ${i === step ? 'border-accent bg-accent/10 text-accent' : i < step ? 'border-ink-500 text-fg-muted' : 'border-ink-600 text-fg-faint'}`}
              onClick={() => setStep(i)}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <h3 className="text-[15px] font-semibold text-fg">
        {step + 1}. {cur.title}
      </h3>
      <div className="space-y-2">{cur.body}</div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeftIcon size={15} /> Önceki
        </button>
        <span className="text-xs text-fg-faint">
          {step + 1} / {steps.length}
        </span>
        <button type="button" className="btn-primary min-h-[44px] px-3 text-sm" disabled={step === steps.length - 1} onClick={() => setStep((s) => s + 1)}>
          Sonraki <ChevronRightIcon size={15} />
        </button>
      </div>
    </div>
  );
}
