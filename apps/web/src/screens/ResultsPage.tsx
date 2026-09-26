import { useMemo, useState, type ReactNode } from 'react';
import { CONTENT, GROUP_LABEL, MEDICAL_DISCLAIMER, PROCESSES, type ResultStatus, structureById, systemById, formatNumber, testByKey } from '@kh/catalog';
import { go } from '../state/router';
import { type TestSeries, buildSeries, useReports } from '../lib/useReports';
import { formatDate } from '../lib/format';
import { Banner } from '../components/ui';
import { RangeBar, STATUS_TEXT, StatusPill } from '../components/results';
import { BodyIcon, ChartIcon, ChevronLeftIcon, ChevronRightIcon, SpinnerIcon, UploadIcon } from '../components/icons';

const ORDER: Record<ResultStatus, number> = { high: 0, low: 1, unknown: 2, normal: 3 };

function display(series: TestSeries) {
  const r = series.latest.result;
  const value = r.canonicalValue ?? r.value;
  return `${formatNumber(value, series.test.decimals)} ${r.canonicalValue !== null ? series.test.unit : r.unit}`;
}

function trend(series: TestSeries): '↑' | '↓' | '' {
  const a = series.previous?.result.canonicalValue;
  const b = series.latest.result.canonicalValue;
  if (a == null || b == null || a === b) return '';
  return b > a ? '↑' : '↓';
}

export function ResultsPage() {
  const { reports, error } = useReports();
  const [filter, setFilter] = useState<'all' | 'abnormal'>('all');
  const series = useMemo(() => (reports ? buildSeries(reports) : []), [reports]);

  if (error) return <div className="p-6"><Banner tone="error">Sonuçlar yüklenemedi.</Banner></div>;
  if (!reports) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Sonuçlar çözülüyor…
      </div>
    );
  }

  const abnormal = series.filter((s) => s.latest.result.status === 'high' || s.latest.result.status === 'low');
  const shown = filter === 'abnormal' ? abnormal : series;
  const groups = new Map<string, TestSeries[]>();
  for (const s of [...shown].sort((a, b) => ORDER[a.latest.result.status] - ORDER[b.latest.result.status] || a.test.nameTr.localeCompare(b.test.nameTr, 'tr'))) {
    groups.set(s.test.group, [...(groups.get(s.test.group) ?? []), s]);
  }
  const lastDate = reports[0] ? (reports[0].reportDate ?? reports[0].createdAt.slice(0, 10)) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6">
        <p className="label-caps mb-1.5">Sonuçlarım</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Tahlil sonuçların</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {series.length ? `${series.length} test · ${reports.length} rapor${lastDate ? ` · son rapor ${formatDate(lastDate)}` : ''}` : 'Henüz onaylanmış sonuç yok.'}
        </p>
      </div>

      {series.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
          <p className="font-medium">Sonuç yok</p>
          <p className="mt-1 text-sm text-fg-muted">Belgelerim ekranından bir rapor yükle; okunan değerleri onayladığında burada görünür.</p>
          <button type="button" className="btn-primary mt-5" onClick={() => go({ name: 'documents' })}>
            <UploadIcon size={16} /> Rapor yükle
          </button>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-md">
            <SummaryTile label="Yüksek" value={series.filter((s) => s.latest.result.status === 'high').length} tone="text-high" />
            <SummaryTile label="Düşük" value={series.filter((s) => s.latest.result.status === 'low').length} tone="text-low" />
            <SummaryTile label="Normal" value={series.filter((s) => s.latest.result.status === 'normal').length} tone="text-accent" />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(
              [
                ['all', 'Tümü'],
                ['abnormal', `Aralık dışı (${abnormal.length})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm transition ${filter === k ? 'border-accent/50 bg-accent/10 text-fg' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
                onClick={() => setFilter(k)}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => go({ name: 'body' })}>
              <BodyIcon size={16} /> Vücutta gör
            </button>
          </div>

          <div className="space-y-6">
            {[...groups.entries()].map(([group, list]) => (
              <section key={group}>
                <h2 className="label-caps mb-2">{GROUP_LABEL[group as keyof typeof GROUP_LABEL]}</h2>
                <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-850/60">
                  {list.map((s) => (
                    <li key={s.test.key}>
                      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-800/60" onClick={() => go({ name: 'result', key: s.test.key })}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{s.test.nameTr}</span>
                          <span className="block text-xs text-fg-muted">
                            {formatDate(s.latest.date)}
                            {s.latest.result.refText ? ` · aralık ${s.latest.result.refText}` : ''}
                            {s.latest.result.refSource === 'catalog' ? ' (genel)' : ''}
                          </span>
                        </span>
                        <span className={`text-right text-sm font-semibold tabular-nums ${STATUS_TEXT[s.latest.result.status]}`}>
                          {display(s)} <span className="text-fg-faint">{trend(s)}</span>
                        </span>
                        <StatusPill status={s.latest.result.status} />
                        <ChevronRightIcon size={16} className="text-fg-faint" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-8 text-xs leading-relaxed text-fg-faint">{MEDICAL_DISCLAIMER}</p>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-850/70 px-3 py-2.5">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-fg-muted">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export function ResultDetail({ testKey }: { testKey: string }) {
  const { reports } = useReports();
  const test = testByKey.get(testKey);
  const series = useMemo(() => (reports ? buildSeries(reports).find((s) => s.test.key === testKey) : undefined), [reports, testKey]);
  const content = CONTENT[testKey];

  if (!test) return <div className="p-6"><Banner tone="error">Bilinmeyen test.</Banner></div>;
  const latest = series?.latest.result;
  const status = latest?.status ?? 'unknown';
  const value = latest ? (latest.canonicalValue ?? latest.value) : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 md:px-8 md:py-8">
      <button type="button" className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg" onClick={() => go({ name: 'results' })}>
        <ChevronLeftIcon size={16} /> Sonuçlarım
      </button>

      <div className="surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-caps mb-1">{GROUP_LABEL[test.group]}</p>
            <h1 className="text-xl font-semibold tracking-tight">{test.nameTr}</h1>
            <p className="mt-0.5 text-xs text-fg-faint">LOINC {test.loinc}</p>
          </div>
          {latest && <StatusPill status={status} size="md" />}
        </div>
        {latest && value !== null ? (
          <>
            <div className="mt-4 flex items-baseline gap-2">
              <span className={`text-4xl font-semibold tabular-nums ${STATUS_TEXT[status]}`}>{formatNumber(value, test.decimals)}</span>
              <span className="text-fg-muted">{latest.canonicalValue !== null ? test.unit : latest.unit}</span>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {series && formatDate(series.latest.date)} · referans {latest.refText || 'yok'}
              {latest.refSource === 'catalog' ? ' (raporda aralık yoktu; genel yaklaşık aralık)' : ''}
            </p>
            <div className="mt-4 max-w-md">
              <RangeBar value={value} min={latest.refMin} max={latest.refMax} decimals={test.decimals} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">Bu test için henüz onaylanmış sonuç yok.</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => go({ name: 'body', focus: test.key })}>
            <BodyIcon size={16} /> Vücutta göster
          </button>
          {test.simulation && (
            <button type="button" className="btn-ghost" onClick={() => go({ name: 'simulation', id: test.simulation! })}>
              Eğitimsel simülasyon
            </button>
          )}
          {series && series.points.length > 1 && (
            <button type="button" className="btn-ghost" onClick={() => go({ name: 'timeline', key: test.key })}>
              <ChartIcon size={16} /> Zaman içinde
            </button>
          )}
        </div>
      </div>

      {content && (
        <div className="mt-4 space-y-4">
          <LearnSection title="Bu test neyi ölçer?">
            <p>{content.what}</p>
          </LearnSection>
          {(status === 'high' && content.high) || (status === 'low' && content.low) ? (
            <LearnSection title="Neden önemli?" accent>
              <p>{status === 'high' ? content.high : content.low}</p>
            </LearnSection>
          ) : (
            (content.high || content.low) && (
              <LearnSection title="Neden önemli?">
                {content.high && (
                  <p>
                    <strong className="text-fg">Yüksek olduğunda: </strong>
                    {content.high}
                  </p>
                )}
                {content.low && (
                  <p className="mt-2">
                    <strong className="text-fg">Düşük olduğunda: </strong>
                    {content.low}
                  </p>
                )}
              </LearnSection>
            )
          )}
          <LearnSection title="Sonucu etkileyebilenler">
            <Bullets items={content.factors} />
          </LearnSection>
          <LearnSection title="Ne yapabilirim? (genel öneriler)">
            <Bullets items={content.actions} />
            <p className="mt-2 text-xs text-fg-faint">İlaç başlatma, bırakma veya doz değişikliği için mutlaka hekimine danış.</p>
          </LearnSection>
          <LearnSection title="Doktoruna sorabileceklerin">
            <Bullets items={content.askDoctor} />
          </LearnSection>
          <LearnSection title="Vücutta nereyle ilişkili?">
            <div className="flex flex-wrap gap-1.5">
              {test.processes.map((p) => (
                <span key={p} className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg-muted" title={PROCESSES[p].summary}>
                  {PROCESSES[p].nameTr}
                </span>
              ))}
              {test.structures.map((sid) => (
                <span key={sid} className="rounded-full border border-accent/30 bg-accent/8 px-2.5 py-1 text-xs text-fg">
                  {structureById.get(sid)?.nameTr ?? sid}
                </span>
              ))}
              {test.systems.map((sid) => (
                <span key={sid} className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg-faint">
                  {systemById.get(sid)?.nameTr}
                </span>
              ))}
            </div>
          </LearnSection>
          <p className="text-xs leading-relaxed text-fg-faint">{MEDICAL_DISCLAIMER}</p>
        </div>
      )}

      {series && series.points.length > 0 && (
        <div className="surface mt-4 p-5">
          <h2 className="mb-3 font-semibold">Geçmiş</h2>
          <ul className="divide-y divide-ink-700 text-sm">
            {[...series.points].reverse().map((p) => (
              <li key={`${p.report.id}-${p.date}`} className="flex items-center justify-between gap-3 py-2">
                <span className="text-fg-muted">{formatDate(p.date)}</span>
                <span className={`tabular-nums ${STATUS_TEXT[p.result.status]}`}>
                  {formatNumber(p.result.canonicalValue ?? p.result.value, test.decimals)} {p.result.canonicalValue !== null ? test.unit : p.result.unit}
                </span>
                <StatusPill status={p.result.status} />
                <button type="button" className="text-xs text-fg-muted hover:text-fg" onClick={() => go({ name: 'document', id: p.report.fileId })}>
                  Belge
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LearnSection({ title, children, accent }: { title: string; children: ReactNode; accent?: boolean }) {
  return (
    <section className={`rounded-2xl border p-4 text-sm leading-relaxed text-fg-muted ${accent ? 'border-high/30 bg-high/5' : 'border-ink-600/60 bg-ink-850/60'}`}>
      <h2 className="mb-2 font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
