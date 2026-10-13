import { useEffect, useMemo, useRef, useState } from 'react';
import { type ResultStatus, STATUS_LABEL, formatNumber } from '@kh/catalog';
import { go } from '../state/router';
import { type ResultPoint, type TestSeries, buildSeries, reportDate, useReports } from '../lib/useReports';
import { formatDate } from '../lib/format';
import { Banner } from '../components/ui';
import { StatusPill } from '../components/results';
import { BodyIcon, ChartIcon, FileTextIcon, SpinnerIcon, UploadIcon } from '../components/icons';
import { useImagingStudies } from '../lib/imagingStudies';
import { CATEGORY_LABEL, CATEGORY_SHORT, regionByKey } from '../lib/imaging';
import { gradeFields, useHealthModel } from '../lib/analysisBridge';
import { labColor } from '../lib/tone';
import { whatChanged } from '../lib/summary';

/**
 * Zaman çizelgesi: bir testin raporlar boyunca değişimi ve rapor geçmişi.
 * Her ölçümün kendi raporundaki referans aralığı ayrı gösterilir (laboratuvarlar farklı aralık kullanabilir).
 */

/** Nokta rengi `tone.ts`'ten (tahlil listesiyle aynı kural); yön ayrıca ▲/▼ ve metinle söylenir. */
const pointColor = (r: ResultPoint['result']) => labColor({ status: r.status as ResultStatus, ...gradeFields(r) });

const GLYPH: Record<ResultStatus, string> = { high: '▲ ', low: '▼ ', normal: '', unknown: '' };

function pointValue(p: ResultPoint): number | null {
  return p.result.canonicalValue;
}

export function TimelinePage({ testKey }: { testKey?: string }) {
  const { reports, error } = useReports();
  const series = useMemo(() => (reports ? buildSeries(reports) : []), [reports]);
  const sorted = useMemo(
    () => [...series].sort((a, b) => b.points.length - a.points.length || a.test.nameTr.localeCompare(b.test.nameTr, 'tr')),
    [series],
  );
  const selected = sorted.find((s) => s.test.key === testKey) ?? sorted[0];
  const loadedStudies = useImagingStudies();
  const studies = useMemo(() => loadedStudies ?? [], [loadedStudies]);
  const { model } = useHealthModel();
  const changes = useMemo(() => (model ? whatChanged(model, studies, 5) : []), [model, studies]);
  const [charts, setCharts] = useState(false);
  const years = useMemo(() => {
    const events = [
      ...(reports ?? []).map((r) => ({ kind: 'lab' as const, date: reportDate(r), r })),
      ...studies.map((st) => ({ kind: 'imaging' as const, date: st.date, st })),
    ];
    const by = new Map<string, typeof events>();
    for (const e of events) (by.get(e.date.slice(0, 4)) ?? by.set(e.date.slice(0, 4), []).get(e.date.slice(0, 4))!).push(e);
    return [...by.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, items]) => ({
        year,
        items: items.sort((a, b) => b.date.localeCompare(a.date)),
        kinds: [...new Set(items.map((e) => (e.kind === 'lab' ? 'Kan' : CATEGORY_SHORT[e.st.category])))],
      }));
  }, [reports, studies]);

  if (error) return <div className="p-6"><Banner tone="error">Sonuçlar yüklenemedi.</Banner></div>;
  if (!reports) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Sonuçlar çözülüyor…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Zamanım</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {reports.length} tahlil raporu{studies.length ? ` · ${studies.length} görüntüleme` : ''}
        </p>
      </div>

      {changes.length > 0 && (
        <section className="mb-8" aria-labelledby="ne-degisti">
          <h2 id="ne-degisti" className="mb-3 text-sm font-medium text-fg-muted">
            Ne değişti?
          </h2>
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
          <p className="mt-2 text-[11px] text-fg-faint">Eğilim tek başına tanı koydurmaz; ölçümler farklı laboratuvarlarda yapılmış olabilir.</p>
        </section>
      )}

      {series.length > 0 && !testKey && !charts ? (
        <button type="button" className="btn-ghost mb-8 w-full justify-center" onClick={() => setCharts(true)}>
          Değer grafiklerini göster ({series.length} test)
        </button>
      ) : null}

      {series.length > 0 && !testKey && !charts ? null : series.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
          <p className="font-medium">Henüz sonuç yok</p>
          <p className="mt-1 text-sm text-fg-muted">Farklı tarihli raporlar yükledikçe değerlerin burada zaman çizgisinde görünür.</p>
          <button type="button" className="btn-primary mt-5" onClick={() => go({ name: 'add' })}>
            <UploadIcon size={16} /> Rapor yükle
          </button>
        </div>
      ) : (
        <section className="mb-2" aria-labelledby="grafikler">
        <h2 id="grafikler" className="mb-3 text-sm font-medium text-fg-muted">
          Sonuçların zaman içinde
        </h2>
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Testler" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:max-h-[70vh] lg:space-y-0.5 lg:overflow-y-auto lg:px-0">
            {sorted.map((s) => {
              const active = s.test.key === selected?.test.key;
              return (
                <button
                  key={s.test.key}
                  type="button"
                  onClick={() => go({ name: 'timeline', key: s.test.key })}
                  aria-current={active ? 'true' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition lg:w-full ${
                    active ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:bg-ink-800 hover:text-fg'
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pointColor(s.latest.result) }} aria-hidden="true" />
                  <span className="flex-1 truncate">{s.test.nameTr}</span>
                  <span className="font-mono text-[11px] text-fg-faint">{s.points.length}</span>
                </button>
              );
            })}
          </nav>
          <div className="min-w-0 space-y-6">{selected && <SeriesView key={selected.test.key} series={selected} />}</div>
        </div>
        </section>
      )}

      {reports.length + studies.length > 0 && (
        <section className="mt-10" aria-labelledby="gecmis">
          <h2 id="gecmis" className="mb-3 text-sm font-medium text-fg-muted">
            Rapor geçmişi
          </h2>
          {years.map(({ year, items, kinds }, yi) => (
          <details key={year} open={yi === 0} className="group mb-3 rounded-2xl border border-ink-600/60 bg-ink-850/40 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <span className="w-12 text-[15px] font-semibold tabular-nums text-fg">{year}</span>
            <span className="flex flex-1 flex-wrap gap-1.5">
              {kinds.map((k) => (
                <span key={k} className="rounded-full border border-ink-600 px-2 py-0.5 text-xs text-fg-muted">
                  {k}
                </span>
              ))}
            </span>
            <span className="text-xs text-fg-faint group-open:hidden">{items.length}</span>
          </summary>
          <ol className="relative mt-3 space-y-0 border-l border-ink-600 pl-5">
            {items
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => {
                if (e.kind === 'imaging') {
                  const { st } = e;
                  const region = st.region ? regionByKey.get(st.region)?.label : undefined;
                  return (
                    <li key={st.key} className="relative pb-5">
                      <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-sm border-2 border-ink-950 bg-high" aria-hidden="true" />
                      <button type="button" onClick={() => go({ name: 'document', id: st.head.id })} className="text-left">
                        <span className="block text-sm text-fg">
                          {formatDate(st.date)} · {CATEGORY_LABEL[st.category]}
                          {region ? ` · ${region}` : ''}
                        </span>
                        <span className="line-clamp-2 text-xs text-fg-muted">
                          {st.conclusion ? `Sonuç: ${st.conclusion}` : 'Görüntüleme · rapor metni yok'}
                          {st.dateKnown ? '' : ' · çekim tarihi girilmedi (yükleme tarihi)'}
                        </span>
                      </button>
                    </li>
                  );
                }
                const { r } = e;
                const abnormal = r.results.filter((x) => x.status === 'high' || x.status === 'low').length;
                return (
                  <li key={r.id} className="relative pb-5">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-ink-500" aria-hidden="true" />
                    <button type="button" onClick={() => go({ name: 'document', id: r.fileId })} className="text-left">
                      <span className="block text-sm text-fg">
                        {formatDate(reportDate(r))}
                        {r.labName ? ` · ${r.labName}` : ''}
                      </span>
                      <span className="text-xs text-fg-muted">
                        {r.results.length} sonuç{abnormal ? ` · ${abnormal} aralık dışı` : ''}
                        {r.reportDate ? '' : ' · rapor tarihi okunamadı (onay tarihi)'}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ol>
          </details>
          ))}
        </section>
      )}

      <p className="mt-6 text-xs leading-relaxed text-fg-faint">
        Eğilim bir tanı ya da gelecek tahmini değildir. Farklı laboratuvarlar farklı yöntem ve referans aralığı kullanabilir; iki ölçüm arasındaki fark
        ölçüm değişkenliğinden de kaynaklanabilir.
      </p>
    </div>
  );
}

function SeriesView({ series }: { series: TestSeries }) {
  const test = series.test;
  const plotted = series.points.filter((p) => pointValue(p) !== null);
  const skipped = series.points.length - plotted.length;
  const [sel, setSel] = useState<number>(plotted.length - 1);
  const point = plotted[sel] ?? plotted[plotted.length - 1];

  return (
    <>
      <section className="surface p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{test.nameTr}</h2>
            <p className="text-xs text-fg-muted">
              {test.unit} · {series.points.length} ölçüm
            </p>
          </div>
          <button type="button" className="text-xs text-accent underline-offset-4 hover:underline" onClick={() => go({ name: 'result', key: test.key })}>
            Test hakkında
          </button>
        </div>
        {plotted.length >= 2 ? (
          <Chart points={plotted} unit={test.unit} decimals={test.decimals} selected={sel} onSelect={setSel} />
        ) : (
          <div className="rounded-xl border border-ink-600/60 bg-ink-900/50 p-5">
            {point && (
              <p className="text-3xl font-light tabular-nums">
                {formatNumber(pointValue(point)!, test.decimals)} <span className="text-base text-fg-muted">{test.unit}</span>
              </p>
            )}
            <p className="mt-2 text-sm text-fg-muted">Tek ölçüm var. Eğilim görmek için bu testi içeren başka bir tarihli rapor yükle.</p>
          </div>
        )}
        {skipped > 0 && <p className="mt-3 text-xs text-fg-faint">{skipped} ölçüm birimi çevrilemediği için çizgide gösterilmiyor (tabloda var).</p>}
      </section>

      {point && (
        <section className="surface p-4 md:p-6" aria-live="polite">
          <p className="label-caps mb-2">Seçili ölçüm</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-light tabular-nums">
              {formatNumber(pointValue(point)!, test.decimals)} {test.unit}
            </span>
            <StatusPill status={point.result.status} size="md" />
          </div>
          <p className="mt-1.5 text-sm text-fg-muted">
            {formatDate(point.date)}
            {point.report.labName ? ` · ${point.report.labName}` : ''} · referans {point.result.refText || 'yok'}
            {point.result.refSource === 'catalog' ? ' (genel yaklaşık aralık)' : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => go({ name: 'document', id: point.report.fileId })}>
              <FileTextIcon size={16} /> Raporu aç
            </button>
            <button type="button" className="btn-ghost" onClick={() => go({ name: 'body', focus: test.key })}>
              <BodyIcon size={16} /> Vücutta göster
            </button>
          </div>
        </section>
      )}

      <section className="surface overflow-x-auto p-4 md:p-6">
        <p className="label-caps mb-3 flex items-center gap-2">
          <ChartIcon size={14} /> Tablo
        </p>
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-faint">
              <th className="pb-2 font-normal">Tarih</th>
              <th className="pb-2 font-normal">Değer</th>
              <th className="pb-2 font-normal">Referans</th>
              <th className="pb-2 font-normal">Durum</th>
            </tr>
          </thead>
          <tbody>
            {[...series.points].reverse().map((p) => (
              <tr key={`${p.report.id}-${p.result.rawName}`} className="border-t border-ink-700">
                <td className="py-2 tabular-nums">{formatDate(p.date)}</td>
                <td className="py-2 tabular-nums">
                  {p.result.qualifier ?? ''}
                  {formatNumber(p.result.canonicalValue ?? p.result.value, test.decimals)} {p.result.canonicalValue !== null ? test.unit : p.result.unit}
                </td>
                <td className="py-2 text-fg-muted">{p.result.refText || '—'}</td>
                <td className="py-2">
                  <span className="text-fg-muted">
                    {GLYPH[p.result.status]}
                    {STATUS_LABEL[p.result.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function Chart({
  points,
  unit,
  decimals,
  selected,
  onSelect,
}: {
  points: ResultPoint[];
  unit: string;
  decimals: number;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 260;
  const pad = { l: 48, r: 20, t: 16, b: 34 };
  const innerW = Math.max(120, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;

  const times = points.map((p) => Date.parse(p.date));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const values = points.map((p) => pointValue(p)!);
  // Referans aralığı rapor biriminde saklanır: yalnızca rapor birimi kanonik birimle aynıysa çizilir.
  const sameUnit = (p: ResultPoint) => p.result.canonicalValue === p.result.value;
  const bounds = points.filter(sameUnit).flatMap((p) => [p.result.refMin, p.result.refMax].filter((v): v is number => typeof v === 'number'));
  const lo = Math.min(...values, ...bounds);
  const hi = Math.max(...values, ...bounds);
  const spanV = hi - lo || Math.abs(hi) || 1;
  const yMin = lo - spanV * 0.15;
  const yMax = hi + spanV * 0.15;
  const x = (t: number) => pad.l + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const ticks = niceTicks(yMin, yMax);

  // Nokta başına referans bandı: komşu noktaların orta çizgisine kadar uzanan basamaklar
  const bands = points.map((p, i) => {
    const xi = x(times[i]!);
    const left = i === 0 ? pad.l : (x(times[i - 1]!) + xi) / 2;
    const right = i === points.length - 1 ? pad.l + innerW : (xi + x(times[i + 1]!)) / 2;
    const min = sameUnit(p) ? p.result.refMin : undefined;
    const max = sameUnit(p) ? p.result.refMax : undefined;
    if (min === undefined && max === undefined) return null;
    const top = y(max ?? yMax);
    const bottom = y(min ?? yMin);
    return { left, right, top, bottom };
  });

  const path = points.map((_, i) => `${i ? 'L' : 'M'}${x(times[i]!).toFixed(1)},${y(values[i]!).toFixed(1)}`).join(' ');
  const active = hover ?? selected;
  const ap = points[active];

  const nearest = (clientX: number) => {
    const el = ref.current;
    if (!el) return null;
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0;
    let bd = Infinity;
    times.forEach((t, i) => {
      const d = Math.abs(x(t) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  const labelIdx = new Set([0, points.length - 1, Math.floor((points.length - 1) / 2)]);

  return (
    <div ref={ref} className="relative select-none">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Zaman içinde değerler, ${points.length} ölçüm`}
        onPointerMove={(e) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const i = nearest(e.clientX);
          if (i !== null) onSelect(i);
        }}
        className="block cursor-crosshair touch-pan-y"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + innerW} y1={y(t)} y2={y(t)} stroke="var(--color-ink-600)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-fg-faint)" className="tabular-nums">
              {formatNumber(t, decimals)}
            </text>
          </g>
        ))}
        {bands.map((b, i) =>
          b ? <rect key={i} x={b.left} width={Math.max(0, b.right - b.left)} y={b.top} height={Math.max(0, b.bottom - b.top)} fill="var(--color-accent)" opacity={0.09} /> : null,
        )}
        <path d={path} fill="none" stroke="var(--color-fg-muted)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {ap && <line x1={x(times[active]!)} x2={x(times[active]!)} y1={pad.t} y2={pad.t + innerH} stroke="var(--color-ink-500)" strokeWidth={1} />}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(times[i]!)}
              cy={y(values[i]!)}
              r={i === active ? 6.5 : 5}
              fill={pointColor(p.result)}
              stroke="var(--color-ink-850)"
              strokeWidth={2}
              tabIndex={0}
              role="button"
              aria-label={`${formatDate(p.date)}: ${formatNumber(values[i]!, decimals)} ${unit}, ${STATUS_LABEL[p.result.status]}`}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(i);
                if (e.key === 'ArrowRight') onSelect(Math.min(points.length - 1, i + 1));
                if (e.key === 'ArrowLeft') onSelect(Math.max(0, i - 1));
              }}
              className="outline-none focus-visible:stroke-[var(--color-accent)]"
            />
            {labelIdx.has(i) && (
              <text x={x(times[i]!)} y={pad.t + innerH + 20} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--color-fg-faint)">
                {formatDate(p.date)}
              </text>
            )}
          </g>
        ))}
        {/* Son değere doğrudan etiket */}
        <text
          x={x(times[points.length - 1]!) - 8}
          y={y(values[points.length - 1]!) - 12}
          textAnchor="end"
          fontSize={12}
          fill="var(--color-fg)"
          className="tabular-nums"
        >
          {formatNumber(values[points.length - 1]!, decimals)}
        </text>
      </svg>
      {hover !== null && points[hover] && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-ink-600 bg-ink-950/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(Math.max(8, x(times[hover]!) + 12), width - 190), top: 8 }}
        >
          <p className="text-fg-muted">{formatDate(points[hover]!.date)}</p>
          <p className="mt-0.5 text-sm text-fg tabular-nums">
            {formatNumber(values[hover]!, decimals)} {unit}
          </p>
          <p className="text-fg-muted">
            {GLYPH[points[hover]!.result.status]}
            {STATUS_LABEL[points[hover]!.result.status]} · ref. {points[hover]!.result.refText || 'yok'}
          </p>
        </div>
      )}
      <p className="mt-2 flex items-center gap-2 text-[11px] text-fg-faint">
        <span className="inline-block h-2.5 w-4 rounded-sm bg-accent/20" aria-hidden="true" /> O raporun referans aralığı
      </p>
    </div>
  );
}

