import { useState } from 'react';
import { PROCESSES, type ProcessId, type SystemId, TESTS, formatNumber, structureById, systemById, testByKey } from '@kh/catalog';
import type { TestSeries } from '../lib/useReports';
import type { StructureHighlight } from '../anatomy/highlight';
import { ORGANS } from '../anatomy/organs';
import { vesselLabel, isVein } from '../anatomy/names';
import { HIGHLIGHT } from '../anatomy/palette';
import { go } from '../state/router';
import { StatusPill } from '../components/results';
import { INSIDE, type InsideId } from './inside/registry';
import { SYSTEM_TEXT, structuresOfSystem, systemColor } from './systems';
import { Caps, EnterButton, Legend, Tabs } from './ui';

export type SeriesMap = Map<string, TestSeries>;

function valueText(s: TestSeries): string {
  const r = s.latest.result;
  const v = r.canonicalValue ?? r.value;
  return `${formatNumber(v, s.test.decimals)} ${r.canonicalValue !== null ? s.test.unit : r.unit}`;
}

function Title({ caps, title, accent, note }: { caps: string; title: string; accent: string; note?: string }) {
  return (
    <header className="mb-5">
      <Caps className="text-fg-faint">
        <span style={{ color: accent }}>●</span> {caps}
      </Caps>
      <h2 className="mt-2 text-[32px] font-light leading-[1.02] tracking-[-0.02em] text-fg lg:text-[44px]">{title}</h2>
      {note && <p className="mt-2 text-xs text-fg-faint">{note}</p>}
    </header>
  );
}

function TestRow({ testKey, series }: { testKey: string; series?: TestSeries }) {
  const test = testByKey.get(testKey);
  if (!test) return null;
  return (
    <li>
      <button
        type="button"
        onClick={() => go({ name: 'result', key: testKey })}
        className="flex w-full items-center gap-3 border-b border-ink-700/70 py-2.5 text-left transition hover:bg-white/[0.03]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{test.nameTr}</span>
          {series ? (
            <span className="text-xs tabular-nums text-fg-muted">{valueText(series)}</span>
          ) : (
            <span className="text-xs text-fg-faint">Sonucun yok</span>
          )}
        </span>
        {series && <StatusPill status={series.latest.result.status} />}
      </button>
    </li>
  );
}

function relatedTests(structure: string): string[] {
  return TESTS.filter((t) => t.structures.includes(structure)).map((t) => t.key);
}

function sortTests(keys: string[], series: SeriesMap): string[] {
  const rank = (k: string) => {
    const st = series.get(k)?.latest.result.status;
    return st === 'high' || st === 'low' ? 0 : st ? 1 : 2;
  };
  return [...new Set(keys)].sort((a, b) => rank(a) - rank(b));
}

/* ---------------------------------------------------------------- Vücut (başlangıç) */

export function BodyIntroPanel({ highlights, series, hasReports }: { highlights: Map<string, StructureHighlight>; series: SeriesMap; hasReports: boolean }) {
  const marked = [...highlights.entries()];
  return (
    <div>
      <Title caps="Seviye 1 · Vücut" title="İnsan vücudu" accent="#37d6c4" />
      <p className="text-sm leading-relaxed text-fg-muted">
        Döndürmek için sürükle, yakınlaşmak için kaydır veya iki parmakla sıkıştır. Bir organa dokunduğunda kamera ona gider; oradan dokuya, hücreye ve
        süreçlere inebilirsin.
      </p>
      {marked.length > 0 ? (
        <section className="mt-7">
          <Caps className="text-fg-faint">Sonuçlarına göre işaretli yapılar</Caps>
          <ul className="mt-3">
            {marked.map(([sid, h]) => {
              const s = structureById.get(sid);
              if (!s) return null;
              return (
                <li key={sid}>
                  <button
                    type="button"
                    onClick={() => go({ name: 'body', structure: sid })}
                    className="flex w-full items-center gap-3 border-b border-ink-700/70 py-2.5 text-left transition hover:bg-white/[0.03]"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: HIGHLIGHT[h.status] }} />
                    <span className="flex-1 text-sm">{s.nameTr}</span>
                    <span className="truncate text-xs text-fg-faint">
                      {h.tests
                        .map((t) => `${testByKey.get(t.key)?.nameTr.split(' (')[0] ?? t.key} ${t.status === 'high' ? '▲' : t.status === 'low' ? '▼' : ''}`)
                        .slice(0, 2)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <Legend />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
            Renk, bir sonucun hangi yapı ve süreçlerle ilişkili olduğunu gösterir. O yapıda bir sorun bulunduğu anlamına gelmez.
          </p>
        </section>
      ) : (
        <p className="mt-6 text-sm text-fg-faint">
          {hasReports ? 'Onaylı sonuçlarının tamamı rapordaki aralık içinde; işaretli yapı yok.' : 'Rapor yükleyip sonuçları onayladığında ilgili yapılar burada işaretlenir.'}
          {series.size === 0 && !hasReports && (
            <button type="button" className="mt-3 block text-accent underline-offset-4 hover:underline" onClick={() => go({ name: 'documents' })}>
              Rapor yükle
            </button>
          )}
        </p>
      )}
      <p className="mt-8 text-[11px] leading-relaxed text-fg-faint">
        Model: HuBMAP İnsan Referans Atlası, erkek referans vücudu (CC BY 4.0). Senin vücudunun taraması değildir. Tiroid, hipofiz, hipotalamus ve
        böbreküstü bezleri şematiktir.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- Sistem */

export function SystemPanel({ system, highlights, series }: { system: SystemId; highlights: Map<string, StructureHighlight>; series: SeriesMap }) {
  const accent = systemColor(system);
  const structures = structuresOfSystem(system);
  const tests = sortTests(
    TESTS.filter((t) => t.systems.includes(system)).map((t) => t.key),
    series,
  ).filter((k) => series.has(k));
  return (
    <div>
      <Title caps="Seviye 2 · Sistem" title={systemById.get(system)?.nameTr ?? system} accent={accent} />
      <p className="text-sm leading-relaxed text-fg-muted">{SYSTEM_TEXT[system]}</p>
      <section className="mt-7">
        <Caps className="text-fg-faint">Yapılar</Caps>
        <ul className="mt-2">
          {structures.map((sid) => {
            const s = structureById.get(sid);
            const h = highlights.get(sid);
            return (
              <li key={sid}>
                <button
                  type="button"
                  onClick={() => go({ name: 'body', structure: sid })}
                  className="flex w-full items-center gap-3 border-b border-ink-700/70 py-2.5 text-left text-sm transition hover:bg-white/[0.03]"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: h ? HIGHLIGHT[h.status] : 'transparent', border: h ? 'none' : `1px solid ${accent}` }} />
                  <span className="flex-1">{s?.nameTr ?? sid}</span>
                  {s?.schematic && <Caps className="text-[9px] text-fg-faint">Şematik</Caps>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {tests.length > 0 && (
        <section className="mt-7">
          <Caps className="text-fg-faint">Bu sistemle ilişkili sonuçların</Caps>
          <ul className="mt-2">
            {tests.map((k) => (
              <TestRow key={k} testKey={k} series={series.get(k)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Organ */

type OrganTab = 'anatomy' | 'function' | 'labs' | 'processes';

export interface VesselPart {
  /** Grubun ilk parçası (seçim anahtarı). */
  id: string;
  /** Aynı ada sahip tüm parçalar (ör. alt ana toplardamarın iki bölümü). */
  ids: string[];
  label: string;
  /** Kaynak (HRA) adı. */
  raw: string;
  vein: boolean;
}

export function OrganPanel({
  structure,
  highlights,
  series,
  vessels,
  selectedPart,
  onSelectPart,
  onEnter,
}: {
  structure: string;
  highlights: Map<string, StructureHighlight>;
  series: SeriesMap;
  vessels: VesselPart[];
  selectedPart: string | null;
  onSelectPart: (id: string | null) => void;
  onEnter: (scene: InsideId) => void;
}) {
  const [tab, setTab] = useState<OrganTab>('anatomy');
  const s = structureById.get(structure);
  const info = ORGANS[structure];
  const system = s?.systems[0];
  const accent = systemColor(system);
  const h = highlights.get(structure);
  const tests = sortTests(relatedTests(structure), series);
  const processes = [...new Set(tests.flatMap((k) => testByKey.get(k)?.processes ?? []))] as ProcessId[];
  const part = vessels.find((v) => v.id === selectedPart);
  const inside = info?.inside;

  if (!s) return <p className="text-sm text-fg-muted">Bilinmeyen yapı.</p>;

  return (
    <div>
      <Title
        caps={`${part ? 'Seviye 4 · Yapı' : 'Seviye 3 · Organ'} · ${systemById.get(system!)?.nameTr ?? ''}`}
        title={part ? part.label : s.nameTr}
        accent={accent}
        note={part ? `${s.nameTr} · ${part.vein ? 'toplardamar' : 'atardamar'}` : s.schematic ? 'Bu bez modelde yok; konumu şematik bir şekille gösteriliyor.' : undefined}
      />

      {h && (
        <div className="mb-5 flex items-start gap-2.5 text-sm">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: HIGHLIGHT[h.status] }} />
          <p className="text-fg-muted">
            {h.tests.map((t) => testByKey.get(t.key)?.nameTr).join(', ')} sonucun bu yapıyla ilişkili süreçlerle bağlantılı. Bu, yapıda bir sorun olduğunu
            göstermez.
          </p>
        </div>
      )}

      {inside && (
        <div className="mb-6">
          <EnterButton accent={accent} label={`İçeri gir · ${INSIDE[inside].title}`} onClick={() => onEnter(inside)} />
        </div>
      )}

      {part ? (
        <div className="space-y-4 text-sm leading-relaxed text-fg-muted">
          <p>{part.vein ? 'Toplardamarlar kanı dokulardan kalbe geri taşır; duvarları atardamarlardan incedir.' : 'Atardamarlar kanı kalpten dokulara taşır; duvarları kalın ve esnektir.'}</p>
          <p className="text-xs text-fg-faint">Kaynak adı (HRA): {part.raw}</p>
          <button type="button" className="text-xs text-accent underline-offset-4 hover:underline" onClick={() => onSelectPart(null)}>
            ← {s.nameTr}
          </button>
        </div>
      ) : (
        <>
          <Tabs<OrganTab>
            accent={accent}
            value={tab}
            onChange={setTab}
            tabs={[
              ['anatomy', 'Anatomi'],
              ['function', 'İşlev'],
              ['labs', 'İlgili tahliller'],
              ['processes', 'Süreçler'],
            ]}
          />
          <div className="pt-5" role="tabpanel">
            {tab === 'anatomy' && (
              <div className="space-y-4 text-sm leading-relaxed text-fg-muted">
                <p>{info?.location ?? s.blurb}</p>
                {info?.anatomy && (
                  <ul className="space-y-1">
                    {info.anatomy.map((a) => (
                      <li key={a} className="flex gap-2">
                        <span style={{ color: accent }}>—</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
                {vessels.length > 0 && (
                  <div>
                    <Caps className="text-fg-faint">Modeldeki damarlar ({vessels.length})</Caps>
                    <ul className="mt-2 max-h-72 overflow-y-auto pr-1">
                      {vessels.map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => onSelectPart(v.id)}
                            className="flex w-full items-center gap-2.5 border-b border-ink-700/60 py-2 text-left text-[13px] text-fg transition hover:bg-white/[0.03]"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: v.vein ? '#4a6fd6' : '#d4454f' }} />
                            {v.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {tab === 'function' && <p className="text-sm leading-relaxed text-fg-muted">{info?.function ?? s.blurb}</p>}
            {tab === 'labs' && (
              <ul>
                {tests.length === 0 && <li className="text-sm text-fg-faint">Katalogda bu yapıyla ilişkilendirilmiş test yok.</li>}
                {tests.map((k) => (
                  <TestRow key={k} testKey={k} series={series.get(k)} />
                ))}
              </ul>
            )}
            {tab === 'processes' && (
              <ul className="space-y-4">
                {processes.length === 0 && <li className="text-sm text-fg-faint">Bu yapı için tanımlı süreç yok.</li>}
                {processes.map((p) => (
                  <li key={p}>
                    <p className="text-sm text-fg">{PROCESSES[p].nameTr}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{PROCESSES[p].summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Tahlil odağı */

/** Test → süreç → yapı → içeri gir yolu (örn. LDL → koroner arterler → damar içi → simülasyon). */
export function explorePath(testKey: string): { structure: string; inside?: InsideId; simulation?: string } | null {
  const test = testByKey.get(testKey);
  if (!test) return null;
  const withInside = test.structures.find((sid) => ORGANS[sid]?.inside);
  const structure = withInside ?? test.structures.find((sid) => structureById.get(sid)?.asset) ?? test.structures[0];
  if (!structure) return null;
  return { structure, inside: ORGANS[structure]?.inside, simulation: test.simulation };
}

export function TestPanel({ testKey, series, onEnter }: { testKey: string; series: SeriesMap; onEnter: (scene: string, from: string) => void }) {
  const test = testByKey.get(testKey);
  if (!test) return <p className="text-sm text-fg-muted">Bilinmeyen test.</p>;
  const s = series.get(testKey);
  const system = test.systems[0];
  const accent = systemColor(system);
  const path = explorePath(testKey);
  return (
    <div>
      <Title caps="Tahlil · Vücutta göster" title={test.nameTr} accent={accent} />
      {s ? (
        <div className="mb-5 flex items-center gap-3">
          <span className="text-2xl font-light tabular-nums">{valueText(s)}</span>
          <StatusPill status={s.latest.result.status} size="md" />
        </div>
      ) : (
        <p className="mb-5 text-sm text-fg-faint">Bu test için onaylı sonucun yok; ilişkili yapılar gösteriliyor.</p>
      )}

      <Caps className="text-fg-faint">Keşif yolu</Caps>
      <ol className="mt-3 space-y-0">
        <PathStep n={1} label={test.nameTr} sub="Tahlil sonucu (senin verin)" />
        {test.processes.slice(0, 2).map((p, i) => (
          <PathStep key={p} n={2 + i} label={PROCESSES[p].nameTr} sub="Biyolojik süreç (genel bilgi)" />
        ))}
        <li className="border-l border-ink-600 pb-3 pl-4">
          <p className="text-xs text-fg-faint">İlişkili yapılar</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {test.structures.map((sid) => (
              <button
                key={sid}
                type="button"
                onClick={() => go({ name: 'body', structure: sid })}
                className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg transition hover:border-ink-500 hover:bg-white/5"
              >
                {structureById.get(sid)?.nameTr ?? sid}
              </button>
            ))}
          </div>
        </li>
      </ol>

      {path?.inside && (
        <div className="mt-5 space-y-2">
          {path.simulation && (
            <EnterButton accent={accent} label="Eğitimsel simülasyonu başlat" onClick={() => onEnter(path.simulation!, path.structure)} />
          )}
          <EnterButton accent={accent} label={`İçeri gir · ${INSIDE[path.inside].title}`} onClick={() => onEnter(path.inside!, path.structure)} />
        </div>
      )}
      <p className="mt-6 text-[11px] leading-relaxed text-fg-faint">
        Bu eşleştirme, testin genel olarak hangi süreç ve yapılarla ilişkili olduğunu gösterir. Bir tahlil sonucu, vücutta belirli bir noktadaki bir
        bulguyu göstermez.
      </p>
    </div>
  );
}

function PathStep({ n, label, sub }: { n: number; label: string; sub: string }) {
  return (
    <li className="relative border-l border-ink-600 pb-3 pl-4">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-ink-500 bg-ink-950" aria-hidden="true" />
      <p className="text-sm text-fg">
        <span className="sr-only">{n}. </span>
        {label}
      </p>
      <p className="text-xs text-fg-faint">{sub}</p>
    </li>
  );
}

export function vesselParts(parts: { id: string; structure: string; label: string | null }[], structure: string): VesselPart[] {
  const byLabel = new Map<string, VesselPart>();
  for (const p of parts) {
    if (p.structure !== structure || !p.label) continue;
    const label = vesselLabel(p.label);
    const g = byLabel.get(label);
    if (g) g.ids.push(p.id);
    else byLabel.set(label, { id: p.id, ids: [p.id], label, raw: p.label, vein: isVein(p.label) });
  }
  return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}
