/**
 * Simülasyon laboratuvarı (#/sim, #/sim/<model>[/<senaryo>]): matematiksel fizyoloji modelleri.
 *
 * Dürüstlük kuralları:
 *  - Her model EĞİTİMSELDİR ve tipik bir yetişkinin parametreleriyle çalışır; ekranda her zaman böyle etiketlenir.
 *  - Kişinin sonuçları modele kendiliğinden girmez. Yalnızca doğrudan ölçülen bir büyüklük (ör. hemoglobin),
 *    kullanıcı isterse, o parametrenin yerine konur; çıktı yine "eğitimsel hesap"tır, kişisel ölçüm değildir.
 *  - Ölçülen değerler eğrilerde ayrı bir işaretle (◆) ve kaynağıyla (rapor tarihi) gösterilir.
 *  - Varsayımlar, geçerlilik alanı, sınırlar, denklemler ve kaynaklar her modelde açılabilir.
 */
import { useEffect, useMemo, useState } from 'react';
import { GRAPH, interiorById } from '@kh/analysis';
import { testByKey } from '@kh/catalog';
import { DERIVED, type DerivedReport, type Params, SIM_MODELS, type SimModel, clampParams, computeDerived, defaultParams, sampleAt, scenarioParams, simModelById, simulate } from '@kh/physio';
import { go, hrefFor } from '../state/router';
import { useUnlockedVault } from '../state/VaultContext';
import { useHealthModel } from '../lib/analysisBridge';
import { reportDate, useReports } from '../lib/useReports';
import { type StoredReport, loadSex } from '../lib/reports';
import { formatDate } from '../lib/format';
import { CurvePlot, SimChart, fmt, timeLabel, usePlayer, viewWindow } from '../components/simlab';
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, PauseIcon, PlayIcon, RotateCcwIcon, ZoomInIcon } from '../components/icons';
import { LabRow, Section } from './organ/common';

export const SIM_EDU_LABEL = 'Eğitimsel matematiksel model — kişisel ölçüm ya da tahmin değildir.';

/** Raporlardan hesaplayıcılar için değerler: yalnızca kesin (niteliksiz) ve kanonik birimde olanlar. */
export function derivedReports(reports: StoredReport[]): DerivedReport[] {
  return reports.map((r) => ({
    id: r.id,
    date: reportDate(r),
    values: Object.fromEntries(r.results.filter((x) => !x.qualifier && x.canonicalValue !== null && Number.isFinite(x.canonicalValue)).map((x) => [x.testKey, x.canonicalValue as number])),
  }));
}

/** Modelin kişisel bağı: gerekli ölçümlerin HEPSİNİ içeren en yeni rapor (farklı günler karıştırılmaz). */
function personalBinding(model: SimModel, reports: DerivedReport[]) {
  if (!model.personal) return undefined;
  for (const r of [...reports].sort((a, b) => b.date.localeCompare(a.date))) {
    const b = model.personal(r.values);
    if (b.used.length) return { ...b, date: r.date, reportId: r.id, values: r.values };
  }
  return undefined;
}

function ModelCard({ m }: { m: SimModel }) {
  return (
    <a href={hrefFor({ name: 'simlab', id: m.id })} className="card group flex min-h-[112px] flex-col gap-1.5 p-4 transition hover:border-accent/60" data-testid="sim-card" data-model={m.id}>
      <span className="label-caps">{m.system}</span>
      <span className="text-[15px] font-semibold leading-snug text-fg">{m.title}</span>
      <span className="text-[12.5px] leading-relaxed text-fg-muted">{m.question}</span>
      <span className="mt-auto flex items-center gap-1 pt-1 text-[12px] font-medium text-accent">
        Simülasyonu aç <ChevronRightIcon size={13} />
      </span>
    </a>
  );
}

/** Hesaplanan değerler: aynı rapordaki ölçümlerden, formülüyle. */
export function DerivedPanel() {
  const { reports } = useReports();
  const vault = useUnlockedVault();
  const [sex, setSex] = useState<'female' | 'male' | undefined>();
  const [ageText, setAgeText] = useState('');
  useEffect(() => {
    let off = false;
    loadSex(vault).then((s) => !off && s !== 'unspecified' && setSex(s));
    return () => {
      off = true;
    };
  }, [vault]);
  const age = /^\d{1,3}$/.test(ageText) ? Number(ageText) : undefined;
  const results = useMemo(() => (reports ? computeDerived(derivedReports(reports), { age, sex }) : null), [reports, age, sex]);
  if (!results) return null;
  const ready = results.filter((r) => r.value !== null);
  const waiting = results.filter((r) => r.value === null);
  const name = (k: string) => testByKey.get(k)?.nameTr ?? k;
  return (
    <Section title="Hesaplanan değerler · senin ölçümlerinden" hint="Bu değerler ölçülmedi; aynı rapordaki ölçümlerinden yayımlanmış formüllerle hesaplandı. Farklı tarihlerin sonuçları birbirine karıştırılmaz. Tanı koymaz; anlamını hekim değerlendirir.">
      <div className="flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] text-fg-muted">Yaş (yalnızca eGFR için; saklanmaz)</span>
          <input className="field w-28 py-2" inputMode="numeric" value={ageText} onChange={(e) => setAgeText(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="ör. 45" aria-label="Yaş" data-testid="derived-age" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] text-fg-muted">Cinsiyet (eGFR denklemi için)</span>
          <select className="field w-36 py-2" value={sex ?? ''} onChange={(e) => setSex(e.target.value === 'female' || e.target.value === 'male' ? e.target.value : undefined)} aria-label="Cinsiyet" data-testid="derived-sex">
            <option value="">Seçilmedi</option>
            <option value="female">Kadın</option>
            <option value="male">Erkek</option>
          </select>
        </label>
      </div>
      {ready.length === 0 && <p className="text-sm text-fg-muted">Henüz hesaplanabilen bir değer yok. Bir hesap için gereken ölçümlerin hepsi aynı raporda bulunmalıdır.</p>}
      <ul className="space-y-2">
        {ready.map((r) => (
          <li key={r.def.id} className="rounded-xl border border-ink-600/60 px-3 py-2.5" data-testid={`derived-${r.def.id}`} data-value={r.value}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[15px] font-medium text-fg">{r.def.title}</span>
              <span className="tabular-nums text-[15px] text-fg">
                {fmt(r.value!, r.def.decimals)} {r.def.unit}
              </span>
              <span className="rounded-full border border-ink-500 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-fg-muted">HESAPLANDI · ÖLÇÜM DEĞİL</span>
            </div>
            <p className="mt-1 text-[12.5px] text-fg-muted">{r.def.meaning}</p>
            <details className="mt-1.5 text-[12px] text-fg-muted">
              <summary className="min-h-[32px] cursor-pointer select-none py-1 font-medium text-fg">Hangi veriye dayanıyor? Formül, sınırlar, kaynak</summary>
              <dl className="mt-1 space-y-1.5">
                <div>
                  <dt className="font-medium text-fg">Girdiler · {r.date ? formatDate(r.date) : ''} tarihli rapor</dt>
                  <dd>
                    {r.inputs.map((i) => (
                      <a key={i.key} href={hrefFor({ name: 'result', key: i.key })} className="mr-3 underline decoration-ink-500 underline-offset-2">
                        {name(i.key)} {i.value.toLocaleString('tr-TR')} {testByKey.get(i.key)?.unit ?? ''}
                      </a>
                    ))}
                    {r.def.needsAge && age !== undefined ? `Yaş ${age}` : ''} {r.def.needsSex && sex ? (sex === 'female' ? '· Kadın' : '· Erkek') : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-fg">Formül</dt>
                  <dd className="font-mono text-[11.5px]">{r.def.formula}</dd>
                </div>
                {r.def.typical && (
                  <div>
                    <dt className="font-medium text-fg">Kaynakta verilen tipik değer</dt>
                    <dd>{r.def.typical}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-fg">Sınırlar</dt>
                  <dd>
                    <ul className="list-disc pl-4">
                      {r.def.limits.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-fg">Kaynak</dt>
                  <dd>{r.def.source}</dd>
                </div>
              </dl>
            </details>
          </li>
        ))}
      </ul>
      {waiting.length > 0 && (
        <details className="text-[12.5px] text-fg-muted" data-testid="derived-waiting">
          <summary className="min-h-[40px] cursor-pointer select-none py-2 font-medium text-fg">Veri yetersiz: hesaplanamayan {waiting.length} değer</summary>
          <ul className="space-y-1.5">
            {waiting.map((r) => (
              <li key={r.def.id} data-testid={`derived-missing-${r.def.id}`}>
                <span className="font-medium text-fg">{r.def.title}:</span>{' '}
                {r.missing?.tests.length
                  ? `${r.missing.tests.map(name).join(', ')} ${r.def.needs.length > 1 ? 'aynı raporda ölçülmüş olmalı' : 'ölçülmemiş'}.`
                  : r.missing?.outOfRange
                    ? 'Bu değerlerle formül geçerli değil (bkz. sınırlar).'
                    : `${[r.missing?.age ? 'yaş' : '', r.missing?.sex ? 'cinsiyet' : ''].filter(Boolean).join(' ve ')} gerekli.`}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-[11px] text-fg-faint">{DERIVED.length} hesap tanımlı. Organ sağlığı puanı ya da risk yüzdesi üretilmez.</p>
    </Section>
  );
}

function SimList() {
  const groups = useMemo(() => {
    const m = new Map<string, SimModel[]>();
    for (const x of SIM_MODELS) m.set(x.system, [...(m.get(x.system) ?? []), x]);
    return [...m.entries()];
  }, []);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 md:px-8 md:py-10" data-testid="simlab-list">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Simülasyon laboratuvarı</h1>
        <p className="max-w-2xl text-[15px] text-fg-muted">Vücudu çalışan bir sistem olarak incele: her simülasyon yayımlanmış bir fizyoloji modelinin denklemlerini çözer. Başlat, durdur, hızı değiştir; normal çalışmayı eğitim amaçlı senaryolarla karşılaştır.</p>
        <p className="flex items-start gap-2 rounded-xl border border-caution/40 bg-caution/10 px-3 py-2 text-[12.5px] text-caution-fg">
          <InfoIcon size={15} className="mt-0.5 shrink-0" /> {SIM_EDU_LABEL} Modeller tipik bir yetişkinin değerleriyle çalışır; senin vücudunu ölçmez.
        </p>
      </header>
      {groups.map(([system, models]) => (
        <section key={system} className="space-y-2" aria-label={system}>
          <h2 className="label-caps">{system}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => (
              <ModelCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      ))}
      <DerivedPanel />
      <Section title="Diğer canlı görünümler">
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href={hrefFor({ name: 'body' })}>
            3B vücut ve hücre sahneleri
          </a>
          <a className="btn-ghost" href={hrefFor({ name: 'flow' })}>
            Vücut akışları (adım adım)
          </a>
          <a className="btn-ghost" href={hrefFor({ name: 'physiology' })}>
            Organlar arası süreç zincirleri
          </a>
        </div>
      </Section>
    </div>
  );
}

function SimView({ model, scenario }: { model: SimModel; scenario?: string }) {
  const { model: health } = useHealthModel();
  const { reports } = useReports();
  const base = useMemo(() => defaultParams(model), [model]);
  const active = model.scenarios.find((s) => s.id === scenario);
  const [params, setParams] = useState<Params>(() => scenarioParams(model, scenario));
  const [compare, setCompare] = useState(true);
  const [annotate, setAnnotate] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [mine, setMine] = useState(false);
  // Senaryo değişince parametreler o senaryonun değerlerine döner.
  useEffect(() => {
    setParams(scenarioParams(model, scenario));
    setMine(false);
  }, [model, scenario]);

  const binding = useMemo(() => (reports ? personalBinding(model, derivedReports(reports)) : undefined), [model, reports]);
  const effective = useMemo(() => clampParams(model, mine && binding ? { ...params, ...binding.params } : params), [model, params, mine, binding]);
  const result = useMemo(() => simulate(model, effective), [model, effective]);
  const normal = useMemo(() => simulate(model, base), [model, base]);
  const changed = model.params.some((d) => Math.abs(effective[d.key]! - d.value) > 1e-9);
  const metrics = useMemo(() => model.metrics(result.samples, effective), [model, result, effective]);
  const normalMetrics = useMemo(() => new Map(model.metrics(normal.samples, base).map((m) => [m.key, m.value])), [model, normal, base]);
  const curves = useMemo(() => model.curves?.(result.samples, effective) ?? [], [model, result, effective]);
  const player = usePlayer(model.duration, model.pace, !!model.loop, `${model.id}|${JSON.stringify(effective)}`);
  const win = viewWindow(model.duration, player.t, zoom);
  const now = sampleAt(result.samples, player.t);
  const labs = (health?.latestLabs ?? []).filter((l) => model.relatedTests.includes(l.testKey));
  const organs = model.organs.map((id) => GRAPH.node(id)).filter((n) => !!n);
  const interior = model.interior ? interiorById(model.interior) : undefined;
  const custom = !active && changed && !(mine && binding && model.params.every((d) => (d.key in binding.params ? true : params[d.key] === d.value)));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-8 md:py-8" data-testid="simlab" data-model={model.id} data-scenario={active?.id ?? (custom ? 'ozel' : 'normal')} data-playing={player.playing ? '1' : '0'} data-t={player.t.toFixed(3)} data-personal={mine && binding ? '1' : '0'}>
      <a href={hrefFor({ name: 'simlab' })} className="btn-ghost min-h-[40px] px-2.5 text-xs">
        <ChevronLeftIcon size={14} /> Simülasyon laboratuvarı
      </a>
      <header className="space-y-1.5">
        <p className="label-caps">{model.system}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{model.title}</h1>
        <p className="text-[15px] text-fg-muted">{model.question}</p>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-caution/40 bg-caution/10 px-3 py-1 text-[11.5px] font-medium text-caution-fg" data-testid="sim-edu-label">
          <InfoIcon size={13} /> {SIM_EDU_LABEL}
        </p>
      </header>

      {/* Senaryolar: normal çalışma + eğitim amaçlı değişiklikler */}
      <div className="space-y-2" role="group" aria-label="Senaryo">
        <div className="flex flex-wrap gap-1.5">
          {[{ id: undefined as string | undefined, label: 'Normal çalışma' }, ...model.scenarios].map((s) => {
            const on = (active?.id ?? undefined) === s.id && !custom;
            return (
              <button key={s.id ?? 'normal'} type="button" aria-pressed={on} onClick={() => go({ name: 'simlab', id: model.id, ...(s.id ? { scenario: s.id } : {}) })} className={`min-h-[40px] rounded-full border px-3.5 text-[13px] transition ${on ? 'border-accent bg-accent/15 font-medium text-fg' : 'border-ink-600 text-fg-muted hover:bg-ink-800 hover:text-fg'}`} data-testid="sim-scenario" data-id={s.id ?? 'normal'}>
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-fg-muted" data-testid="sim-scenario-note">
          {custom ? 'Özel ayar: parametreleri sen değiştirdin.' : active ? `Eğitim senaryosu — ${active.note}` : 'Tipik sağlıklı yetişkin değerleriyle normal çalışma.'}
        </p>
      </div>

      {result.unstable ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fg" role="alert">
          Bu parametrelerle model sayısal olarak kararsızlaştı; sonuç gösterilmiyor. Parametreleri tipik değerlere yaklaştır.
        </p>
      ) : (
        <>
          {/* Oynatıcı */}
          <div className="card flex flex-wrap items-center gap-2 p-3" role="group" aria-label="Simülasyon denetimleri">
            <button type="button" className="btn-primary min-h-[44px] px-4" onClick={() => (player.t >= model.duration && !model.loop ? (player.setT(0), player.setPlaying(true)) : player.setPlaying(!player.playing))} data-testid="sim-play" aria-label={player.playing ? 'Durdur' : 'Başlat'}>
              {player.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />} {player.playing ? 'Durdur' : 'Başlat'}
            </button>
            <button type="button" className="btn-ghost min-h-[44px] px-3" onClick={player.reset} data-testid="sim-reset">
              <RotateCcwIcon size={15} /> Sıfırla
            </button>
            <div className="flex items-center gap-1" role="group" aria-label="Hız">
              {[0.25, 0.5, 1, 2, 4].map((s) => (
                <button key={s} type="button" aria-pressed={player.speed === s} onClick={() => player.setSpeed(s)} className={`min-h-[40px] min-w-[44px] rounded-full border px-2 text-[12.5px] tabular-nums ${player.speed === s ? 'border-accent bg-accent/15 text-fg' : 'border-ink-600 text-fg-muted hover:bg-ink-800'}`} data-testid="sim-speed" data-speed={s}>
                  {s.toLocaleString('tr-TR')}×
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-[12.5px]" onClick={() => setZoom(zoom >= 8 ? 1 : zoom * 2)} data-testid="sim-zoom" data-zoom={zoom} aria-label={`Yakınlaştır (şu an ${zoom}×)`}>
              <ZoomInIcon size={15} /> {zoom}×
            </button>
            <label className="flex min-h-[40px] items-center gap-1.5 text-[12.5px] text-fg-muted">
              <input type="checkbox" checked={annotate} onChange={(e) => setAnnotate(e.target.checked)} data-testid="sim-annotate" /> Açıklamalar
            </label>
            <label className="flex min-h-[40px] items-center gap-1.5 text-[12.5px] text-fg-muted">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="sim-compare" /> Normalle karşılaştır
            </label>
            <div className="flex w-full items-center gap-3">
              <input type="range" className="sim-range" min={0} max={model.duration} step={model.sampleEvery} value={player.t} onChange={(e) => (player.setPlaying(false), player.setT(Number(e.target.value)))} aria-label="Zaman" data-testid="sim-scrub" />
              <span className="shrink-0 whitespace-nowrap text-right text-[12.5px] tabular-nums text-fg-muted">
                {timeLabel(player.t, model.timeUnit)} / {timeLabel(model.duration, model.timeUnit)}
              </span>
            </div>
            {annotate && now?.phase && (
              <p className="w-full text-[13px] text-fg" data-testid="sim-phase">
                Şu an: <b className="font-semibold">{now.phase}</b>
              </p>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {model.panels.map((title, i) => (
              <SimChart key={title} title={title} series={model.series.filter((s) => s.panel === i)} samples={result.samples} baseline={compare && changed ? normal.samples : undefined} t={player.t} window={win} unit={model.timeUnit} annotate={annotate} phase={now?.phase} />
            ))}
            {curves.map((c) => (
              <CurvePlot key={c.id} curve={c} markers={binding?.markers ?? []} />
            ))}
          </div>

          <Section title="Modelin hesapladıkları" hint="Bu sayılar modelin çıktısıdır (eğitimsel). “Tipik” sütunu genel yetişkin değerleridir; laboratuvar referans aralığı değildir.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13px]" data-testid="sim-metrics">
                <thead className="text-[11px] uppercase tracking-wide text-fg-faint">
                  <tr>
                    <th className="py-1.5 pr-3 font-semibold">Büyüklük</th>
                    <th className="py-1.5 pr-3 font-semibold">Bu senaryo</th>
                    {changed && <th className="py-1.5 pr-3 font-semibold">Normal çalışma</th>}
                    {annotate && <th className="py-1.5 font-semibold">Tipik</th>}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.key} className="border-t border-ink-600/50" data-testid={`metric-${m.key}`} data-value={Number.isFinite(m.value) ? m.value.toFixed(4) : ''}>
                      <td className="py-1.5 pr-3 text-fg-muted">{m.label}</td>
                      <td className="py-1.5 pr-3 font-medium tabular-nums text-fg">
                        {Number.isFinite(m.value) ? `${fmt(m.value, m.decimals)} ${m.unit}` : 'Bu sürede olmadı'}
                      </td>
                      {changed && (
                        <td className="py-1.5 pr-3 tabular-nums text-fg-muted">
                          {Number.isFinite(normalMetrics.get(m.key) ?? NaN) ? `${fmt(normalMetrics.get(m.key)!, m.decimals)} ${m.unit}` : '—'}
                        </td>
                      )}
                      {annotate && <td className="py-1.5 text-fg-faint">{m.typical ?? ''}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      <Section title="Parametreler" hint="Kaydırıcılar modelin girdileridir. Değiştirdiğinde çözüm yeniden hesaplanır.">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {model.params.map((d) => {
            const fromMe = mine && binding && d.key in binding.params;
            const dec = d.step >= 1 ? 0 : d.step >= 0.1 ? 1 : d.step >= 0.01 ? 2 : 3;
            return (
              <label key={d.key} className="block text-[13px]" data-testid={`param-${d.key}`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-fg">{d.label}</span>
                  <span className="tabular-nums text-fg-muted">
                    <b className="font-semibold text-fg">{fmt(effective[d.key]!, dec)}</b> {d.unit}
                    {fromMe ? ' · senin ölçümün' : Math.abs(effective[d.key]! - d.value) > 1e-9 ? ` · tipik ${fmt(d.value, dec)}` : ''}
                  </span>
                </span>
                <input type="range" className="sim-range mt-1.5" min={d.min} max={d.max} step={d.step} value={effective[d.key]} disabled={!!fromMe} onChange={(e) => setParams({ ...params, [d.key]: Number(e.target.value) })} aria-label={d.label} />
                {d.hint && <span className="mt-0.5 block text-[11px] text-fg-faint">{d.hint}</span>}
              </label>
            );
          })}
        </div>
        {changed && (
          <button type="button" className="btn-ghost min-h-[40px] text-[13px]" onClick={() => (setMine(false), active ? setParams(scenarioParams(model, active.id)) : setParams(base))} data-testid="sim-params-reset">
            {active ? 'Senaryo değerlerine dön' : 'Tipik değerlere dön'}
          </button>
        )}
      </Section>

      <Section title="Senin verilerin · bu süreçle ilişkili olabilecekler" hint="İlişki olasıdır: bir sonucun yüksek ya da düşük olması tek başına bu süreçte bir bozukluk olduğunu göstermez. Model senin değerlerinden sonuç çıkarmaz.">
        {binding && Object.keys(binding.params).length > 0 && (
          <div className="rounded-xl border border-ink-600/60 px-3 py-2.5" data-testid="sim-personal">
            <label className="flex min-h-[40px] items-center gap-2 text-[13.5px] text-fg">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} data-testid="sim-personal-toggle" />
              Ölçülen değerimi modele gir:{' '}
              {Object.keys(binding.params)
                .map((k) => {
                  const d = model.params.find((x) => x.key === k)!;
                  return `${d.label} ${binding.params[k]!.toLocaleString('tr-TR')} ${d.unit}`;
                })
                .join(', ')}{' '}
              ({formatDate(binding.date)})
            </label>
            {mine && <p className="text-[12px] text-fg-muted">Yalnızca bu parametre senin ölçümün; diğer bütün parametreler tipik değerlerdir. Çıkan sayılar “bu ölçüm tipik bir vücutta ne anlama gelir” sorusunun eğitimsel hesabıdır — senin için ölçüm ya da tahmin değildir.</p>}
          </div>
        )}
        {binding && binding.markers.length > 0 && (
          <p className="text-[13px] text-fg" data-testid="sim-personal-markers">
            ◆ {binding.markers.map((m) => m.label).join(' · ')} — {formatDate(binding.date)} tarihli rapordan, eğride işaretlendi (ölçülmüş veri).
          </p>
        )}
        {labs.length ? (
          <ul className="space-y-1.5">
            {labs.map((l) => (
              <LabRow key={l.testKey} l={l} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted" data-testid="sim-no-data">
            Bu süreçle ilişkili ölçülmüş bir sonucun yok. İlişkili olabilecek testler: {model.relatedTests.map((k) => testByKey.get(k)?.nameTr ?? k).join(', ')}.
          </p>
        )}
      </Section>

      <Section title="Bu model nasıl çalışır?">
        <details open className="text-[13px] text-fg-muted" data-testid="sim-about">
          <summary className="min-h-[40px] cursor-pointer select-none py-2 font-medium text-fg">Varsayımlar, geçerlilik alanı ve sınırlar</summary>
          <div className="space-y-2">
            <p>
              <b className="font-semibold text-fg">Geçerlilik alanı:</b> {model.validity}
            </p>
            <div>
              <b className="font-semibold text-fg">Varsayımlar</b>
              <ul className="list-disc pl-5">
                {model.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <b className="font-semibold text-fg">Sınırlar</b>
              <ul className="list-disc pl-5">
                {model.limits.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
        <details className="text-[13px] text-fg-muted">
          <summary className="min-h-[40px] cursor-pointer select-none py-2 font-medium text-fg">Denklemler</summary>
          <ul className="space-y-1 font-mono text-[12px]">
            {model.equations.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px]">
            Sayısal çözüm: 4. derece Runge–Kutta, adım {model.dt.toLocaleString('tr-TR')} {model.timeUnit}; toplam {timeLabel(model.duration, model.timeUnit)}.
          </p>
        </details>
        <details className="text-[13px] text-fg-muted">
          <summary className="min-h-[40px] cursor-pointer select-none py-2 font-medium text-fg">Kaynaklar</summary>
          <ul className="space-y-1">
            {model.sources.map((s) => (
              <li key={s.title}>
                <span className="text-fg">{s.title}</span> — {s.detail}
              </li>
            ))}
          </ul>
        </details>
      </Section>

      {(organs.length > 0 || interior) && (
        <Section title="Anatomide gör">
          <div className="flex flex-wrap gap-2">
            {organs.map((n) => (
              <a key={n!.id} className="btn-ghost" href={hrefFor({ name: 'organ', id: n!.id })}>
                {n!.nameTr}
              </a>
            ))}
            {interior && (
              <a className="btn-ghost" href={hrefFor({ name: 'interior', id: interior.organId })} data-testid="sim-interior">
                İçine gir · {interior.name}
              </a>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

export function SimLabPage({ id, scenario }: { id?: string; scenario?: string }) {
  const model = id ? simModelById.get(id) : undefined;
  if (!model) return <SimList />;
  return <SimView key={model.id} model={model} scenario={model.scenarios.some((s) => s.id === scenario) ? scenario : undefined} />;
}
