/**
 * Fizyoloji zinciri görünümü: "A —fiil→ B" basamakları, kişinin ölçülen sonuçları (renk + metin + ▲/▼),
 * geçmiş ölçümler ve "Bunun devamı nerede?" geçişleri. Ölçülmeyen düğüm "normal" ya da "sorunlu"
 * gösterilmez; ilişki her zaman olasıdır. Geçmiş ölçüm yoksa eğilim çizilmez.
 */
import { useMemo, useState } from 'react';
import { BIOMARKER_PHYSIOLOGY, GRAPH, PATTERNS, type HealthModel, PHYSIO_KIND_TR, PHYSIO_REL_TR, type PhysioChain, type PhysioMarker, type PhysioNode, chainNodes, chainsForTest, organsForLab, physioNode, physioOverlay } from '@kh/analysis';
import { structureById, testByKey } from '@kh/catalog';
import { type Route, go } from '../state/router';
import { labStyle } from '../lib/tone';
import { formatDate } from '../lib/format';
import { ChevronRightIcon } from './icons';

export function routeForPhysioNode(n: PhysioNode): Route | undefined {
  if (n.interior) return { name: 'interior', id: n.interior };
  if (n.organ) return { name: 'organ', id: n.organ };
  return undefined;
}

function Marker({ m }: { m: PhysioMarker }) {
  const st = labStyle(m.latest);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] ${st.direction ? `${st.border} ${st.bg} ${st.text}` : 'border-ink-600 text-fg-muted'}`} data-testid="physio-marker" data-test={m.testKey} data-status={m.latest.status}>
      <button type="button" className="font-medium hover:underline" onClick={() => go({ name: 'result', key: m.testKey })}>
        {m.name}
      </button>
      <span className="tabular-nums">
        {m.latest.value.toLocaleString('tr-TR')} {m.latest.unit}
      </span>
      <span>{st.statusLabel}</span>
    </span>
  );
}

function NodeChip({ n, markers, here }: { n: PhysioNode; markers: PhysioMarker[]; here?: string }) {
  const r = routeForPhysioNode(n);
  const isHere = here && (n.interior === here || n.organ === here);
  return (
    <span className="inline-flex flex-col gap-1">
      {r && !isHere ? (
        <button type="button" className="rounded-lg border border-ink-600 px-2 py-1 text-left text-[13px] text-fg hover:border-accent hover:text-accent" onClick={() => go(r)} title="Bunun devamı nerede? — buraya git" data-testid="physio-node" data-node={n.id}>
          {n.name} <span className="text-[10.5px] text-fg-faint">· {PHYSIO_KIND_TR[n.kind]} ›</span>
        </button>
      ) : (
        <span className={`rounded-lg border px-2 py-1 text-[13px] ${isHere ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600 text-fg'}`} data-testid="physio-node" data-node={n.id}>
          {n.name} <span className="text-[10.5px] text-fg-faint">· {PHYSIO_KIND_TR[n.kind]}</span>
        </span>
      )}
      {markers.map((m) => (
        <Marker key={m.testKey} m={m} />
      ))}
    </span>
  );
}

/** Tarih seçici: yalnızca gerçekten ölçüm olan tarihler (sahte zaman noktası yok). */
function useTimeline(markers: PhysioMarker[]) {
  return useMemo(() => [...new Set(markers.flatMap((m) => m.history.map((h) => h.date)))].sort(), [markers]);
}

export function PhysioChainView({ chain, model, here, compact = false }: { chain: PhysioChain; model: HealthModel | null; here?: string; compact?: boolean }) {
  const full = useMemo(() => physioOverlay(chain, model), [chain, model]);
  const dates = useTimeline(full.markers);
  const [asOf, setAsOf] = useState<string | undefined>(undefined);
  const ov = useMemo(() => (asOf ? physioOverlay(chain, model, asOf) : full), [asOf, chain, model, full]);
  const byNode = (id: string) => ov.markers.filter((m) => m.nodeId === id);
  const edges = compact ? chain.edges.slice(0, 6) : chain.edges;
  return (
    <div className="space-y-2" data-testid="physio-chain" data-chain={chain.id}>
      <ol className="space-y-1.5">
        {edges.map((e, i) => {
          const from = physioNode(e.from)!;
          const to = physioNode(e.to)!;
          const showFrom = i === 0 || chain.edges[i - 1]!.to !== e.from;
          return (
            <li key={i} className="flex flex-wrap items-start gap-1.5">
              {showFrom ? <NodeChip n={from} markers={byNode(from.id)} here={here} /> : <span className="w-3 text-fg-faint">↳</span>}
              <span className="mt-1 text-[11.5px] text-fg-faint" title={e.note}>
                —{PHYSIO_REL_TR[e.rel]}→
              </span>
              <NodeChip n={to} markers={byNode(to.id)} here={here} />
              {!compact && <span className="basis-full pl-4 text-[11.5px] leading-snug text-fg-muted">{e.note}</span>}
            </li>
          );
        })}
      </ol>
      {compact && chain.edges.length > edges.length && (
        <button type="button" className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline" onClick={() => go({ name: 'physiology', id: chain.id })}>
          Zincirin tamamı ({chain.edges.length} basamak) <ChevronRightIcon size={12} />
        </button>
      )}
      <p className="text-[12px] text-fg-muted" data-testid="physio-statement">
        {ov.statement}
      </p>
      {dates.length >= 2 && (
        <div className="space-y-1 rounded-xl border border-ink-600/60 p-2.5" data-testid="physio-time">
          <p className="text-[11.5px] font-medium text-fg-muted">Zaman içinde (yalnızca gerçek ölçüm tarihleri):</p>
          <div className="flex flex-wrap gap-1">
            {dates.map((d) => (
              <button key={d} type="button" aria-pressed={(asOf ?? dates[dates.length - 1]) === d} className={`min-h-[32px] rounded-full border px-2.5 text-[11.5px] ${(asOf ?? dates[dates.length - 1]) === d ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600 text-fg-muted'}`} onClick={() => setAsOf(d === dates[dates.length - 1] ? undefined : d)}>
                {formatDate(d)}
              </button>
            ))}
          </div>
          {full.markers
            .filter((m) => m.trend)
            .map((m) => (
              <p key={m.testKey} className="text-[11.5px] text-fg-muted">
                {m.name}: {m.history.map((h) => `${formatDate(h.date)} ${h.value.toLocaleString('tr-TR')}${h.status === 'low' ? ' ▼' : h.status === 'high' ? ' ▲' : ''}`).join(' → ')}
              </p>
            ))}
          <p className="text-[11px] text-fg-faint">Eğilim tek başına tanı koydurmaz.</p>
        </div>
      )}
    </div>
  );
}

const placeName = (id: string) => physioNode(id)?.name ?? id;

/**
 * Sonuç ayrıntısı · "Vücutta": normalde ne yapıyor, nerede üretiliyor/kullanılıyor, hangi organlar ve
 * süreçler, destekleyen / çelişen / eksik kanıt ve ilişkili sonuçlar. Kişinin değeri olası ilişki olarak.
 */
export function ResultPhysiology({ testKey, model }: { testKey: string; model: HealthModel | null }) {
  const info = BIOMARKER_PHYSIOLOGY[testKey];
  const chains = chainsForTest(testKey);
  const organs = organsForLab(testKey);
  // Bu testi ölçüt olarak kullanan örüntüler (veriyle tanımlı; hastalık adı sabit kodlanmaz)
  const patternIds = new Set(PATTERNS.filter((d) => [...d.supporting, ...(d.contradicting ?? [])].some((c) => c.kind === 'lab' && c.test === testKey)).map((d) => d.id));
  const patterns = (model?.patterns ?? []).filter((p) => patternIds.has(p.id));
  const relatedKeys = [...new Set(chains.flatMap(({ chain }) => chainNodes(chain).flatMap((n) => n.testKeys ?? [])))].filter((k) => k !== testKey);
  const related = (model?.latestLabs ?? []).filter((l) => relatedKeys.includes(l.testKey));
  const [showRelated, setShowRelated] = useState(false);
  if (!info && !chains.length && !organs.length) return null;
  const place = (id: string) => {
    const n = physioNode(id);
    const r = n ? routeForPhysioNode(n) : undefined;
    return r ? (
      <button key={id} type="button" className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg hover:border-accent hover:text-accent" onClick={() => go(r)}>
        {placeName(id)} ›
      </button>
    ) : (
      <span key={id} className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg-muted">
        {placeName(id)}
      </span>
    );
  };
  const organName = (id: string) => GRAPH.node(id)?.nameTr ?? structureById.get(id)?.nameTr ?? id;
  return (
    <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4 text-sm" aria-label="Vücutta" data-testid="result-physiology">
      <h2 className="font-semibold text-fg">Vücutta: normalde ne yapıyor, bende ne söylüyor?</h2>
      {info && (
        <>
          <div>
            <h3 className="label-caps">Normalde vücutta ne yapıyor?</h3>
            <p className="mt-1 text-fg-muted">{info.role}</p>
          </div>
          {info.producedIn.length > 0 && (
            <div>
              <h3 className="label-caps">Nerede üretiliyor / vücuda giriyor?</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">{info.producedIn.map(place)}</div>
            </div>
          )}
          {info.usedIn.length > 0 && (
            <div>
              <h3 className="label-caps">Nerede kullanılıyor?</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">{info.usedIn.map(place)}</div>
            </div>
          )}
        </>
      )}
      {organs.length > 0 && (
        <div>
          <h3 className="label-caps">Hangi organlarla ilişkili?</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {organs.slice(0, 8).map((o) => (
              <button key={o} type="button" className="rounded-full border border-accent/30 px-2.5 py-1 text-xs text-fg hover:border-accent" onClick={() => go({ name: 'organ', id: o })}>
                {organName(o)}
              </button>
            ))}
          </div>
        </div>
      )}
      {chains.length > 0 && (
        <div className="space-y-2">
          <h3 className="label-caps">Hangi fizyolojik süreçte?</h3>
          {chains.slice(0, 2).map(({ chain }) => (
            <div key={chain.id} className="rounded-xl border border-ink-600/60 p-3">
              <p className="mb-1.5 text-[13px] font-medium text-fg">{chain.title}</p>
              <PhysioChainView chain={chain} model={model} compact />
            </div>
          ))}
        </div>
      )}
      {patterns.length > 0 && (
        <div className="space-y-1.5" data-testid="result-evidence">
          <h3 className="label-caps">Hangi sonuçlar destekliyor, hangileri çelişiyor, ne eksik?</h3>
          {patterns.slice(0, 2).map((p) => (
            <div key={p.id} className="rounded-lg border border-caution/30 p-2.5 text-[12.5px]">
              <p className="font-medium text-fg">{p.title}</p>
              {p.supporting.slice(0, 4).map((e, i) => (
                <p key={`s${i}`} className="text-fg">
                  ✓ Destekler: {e.label} <span className="text-fg-faint">· {e.detail}</span>
                </p>
              ))}
              {p.contradictory.slice(0, 3).map((e, i) => (
                <p key={`c${i}`} className="text-caution-fg">
                  ✗ Desteklemez: {e.label} <span className="text-fg-faint">· {e.detail}</span>
                </p>
              ))}
              {p.missing.slice(0, 3).map((m, i) => (
                <p key={`m${i}`} className="text-fg-faint">
                  ? Eksik: {m}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {organs[0] && (
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'organ', id: organs[0]! })}>
            İlgili organı gör
          </button>
        )}
        {chains[0] && (
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => go({ name: 'physiology', id: chains[0]!.chain.id })}>
            Normal fizyolojiyi gör
          </button>
        )}
        {relatedKeys.length > 0 && (
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" aria-expanded={showRelated} onClick={() => setShowRelated((x) => !x)}>
            İlişkili sonuçları gör
          </button>
        )}
      </div>
      {showRelated && (
        <ul className="space-y-1" data-testid="result-related">
          {related.length ? (
            related.map((l) => {
              const st = labStyle(l);
              return (
                <li key={l.testKey}>
                  <button type="button" className={`text-left text-[13px] hover:underline ${st.direction ? st.text : 'text-fg'}`} onClick={() => go({ name: 'result', key: l.testKey })}>
                    {l.name} {l.value.toLocaleString('tr-TR')} {l.unit} · {st.statusLabel}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="text-[12.5px] text-fg-muted">Bu süreçle ilişkili başka sonucun yok. Eksik: {relatedKeys.slice(0, 5).map((k) => testByKey.get(k)?.nameTr ?? k).join(', ')}.</li>
          )}
        </ul>
      )}
      <p className="text-[11px] text-fg-faint">Sonucun yüksek ya da düşük olması tek başına belirli bir hastalık anlamına gelmez; değerlendirme hekime aittir.</p>
    </section>
  );
}
