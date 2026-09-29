import { useMemo, useState, type ReactNode } from 'react';
import { CONTENT, GROUP_LABEL, MEDICAL_DISCLAIMER, PROCESSES, type ResultStatus, structureById, systemById, formatNumber, testByKey } from '@kh/catalog';
import { go } from '../state/router';
import { type TestSeries, buildSeries, useReports } from '../lib/useReports';
import { formatDate } from '../lib/format';
import { Banner } from '../components/ui';
import { ISSUE_TEXT, RangeBar, STATUS_TEXT, StatusPill } from '../components/results';
import { markVerified, needsVerification, verificationIssues } from '../lib/reports';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { CriticalBanner, FindingBlock, PatternList, SeverityBar, SeverityChip, SystemGrid } from '../components/interpretation';
import { findingMap, useInterpretation, useSex } from '../lib/interpretation';
import { useImagingStudies } from '../lib/imagingStudies';
import { ImagingStudyList } from '../components/imaging';
import { AlertIcon, BodyIcon, ChartIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, FileTextIcon, SpinnerIcon, UploadIcon } from '../components/icons';

const ORDER: Record<ResultStatus, number> = { high: 0, low: 1, unknown: 2, normal: 3 };
const SEV_ORDER = { marked: 0, moderate: 1, mild: 2, borderline: 3, unknown: 4, normal: 5 } as const;

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
  const [filter, setFilter] = useState<'all' | 'abnormal' | 'borderline'>('all');
  const series = useMemo(() => (reports ? buildSeries(reports) : []), [reports]);
  const sex = useSex();
  const interp = useInterpretation(series, sex);
  const findings = useMemo(() => findingMap(interp), [interp]);
  const studies = useImagingStudies();

  if (error) return <div className="p-6"><Banner tone="error">Sonuçlar yüklenemedi.</Banner></div>;
  if (!reports) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-fg-muted">
        <SpinnerIcon size={16} /> Sonuçlar çözülüyor…
      </div>
    );
  }

  const abnormal = series.filter((s) => s.latest.result.status === 'high' || s.latest.result.status === 'low');
  const toVerify = series.filter((s) => needsVerification(s.latest.result));
  const involved = interp.systems.filter((x) => x.status !== 'ok');
  const borderline = series.filter((s) => findings.get(s.test.key)?.severity === 'borderline');
  const shown = filter === 'abnormal' ? abnormal : filter === 'borderline' ? borderline : series;
  const sevRank = (s: TestSeries) => SEV_ORDER[findings.get(s.test.key)?.severity ?? 'unknown'];
  const groups = new Map<string, TestSeries[]>();
  for (const s of [...shown].sort(
    (a, b) => ORDER[a.latest.result.status] - ORDER[b.latest.result.status] || sevRank(a) - sevRank(b) || a.test.nameTr.localeCompare(b.test.nameTr, 'tr'),
  )) {
    groups.set(s.test.group, [...(groups.get(s.test.group) ?? []), s]);
  }
  const lastDate = reports[0] ? (reports[0].reportDate ?? reports[0].createdAt.slice(0, 10)) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6">
        <p className="label-caps mb-1.5">Sonuçlarım</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{studies?.length ? 'Tahlil ve görüntüleme sonuçların' : 'Tahlil sonuçların'}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {series.length ? `${series.length} test · ${reports.length} rapor${lastDate ? ` · son rapor ${formatDate(lastDate)}` : ''}` : 'Henüz onaylanmış tahlil sonucu yok.'}
          {studies?.length ? ` · ${studies.length} görüntüleme` : ''}
        </p>
        {series.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Aralık dışı" value={abnormal.length} tone="text-high" />
            <SummaryTile label="Aralıkta" value={series.filter((s) => s.latest.result.status === 'normal').length} tone="text-accent" />
            <SummaryTile label="Doğrulaman gereken" value={toVerify.length} tone={toVerify.length ? 'text-[#f5b14c]' : 'text-fg-faint'} />
            <SummaryTile label="İlgili sistem" value={involved.length} tone="text-fg" />
          </div>
        )}
        {involved.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {involved.map((x) => (
              <button
                key={x.system}
                type="button"
                onClick={() => go({ name: 'body', system: x.system })}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-2.5 py-1 text-xs text-fg-muted transition hover:border-ink-500 hover:text-fg"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: systemById.get(x.system)?.color }} />
                {x.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {studies && studies.length > 0 && (
        <section className="mb-8" aria-labelledby="goruntuleme-sonuclari">
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 id="goruntuleme-sonuclari" className="label-caps">
              Görüntüleme raporların ({studies.length})
            </h2>
            <span className={`text-[11px] ${studies.some((x) => x.abnormal.length) ? 'text-high' : 'text-fg-faint'}`}>
              {(() => {
                const all = studies.flatMap((x) => x.measures);
                const out = all.filter((m) => m.status === 'high' || m.status === 'low').length;
                return all.length ? `${all.length} ölçüm · ${out} tanesi genel referans dışında` : 'MR · BT · röntgen · ultrason';
              })()}
            </span>
          </div>
          <ImagingStudyList studies={studies} />
          <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
            Raporun kendi "Sonuç" bölümü aynen gösterilir; Kan Haritası görüntüleri ve raporları yorumlamaz, derecelendirmez. Terimlerin genel anlamı belgenin içinde açıklanır.
          </p>
        </section>
      )}

      {series.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
          <p className="font-medium">{studies?.length ? 'Tahlil sonucu yok' : 'Sonuç yok'}</p>
          <p className="mt-1 text-sm text-fg-muted">Belgelerim ekranından bir tahlil raporu yükle; okunan değerleri onayladığında burada görünür.</p>
          <button type="button" className="btn-primary mt-5" onClick={() => go({ name: 'documents' })}>
            <UploadIcon size={16} /> Rapor yükle
          </button>
        </div>
      ) : (
        <>
          <div className="mb-8 space-y-4">
            <CriticalBanner critical={interp.critical} />
            {toVerify.length > 0 && <VerifyList series={toVerify} />}
            <section className="surface p-5" aria-labelledby="genel-degerlendirme">
              <p className="label-caps mb-1.5">Kişisel değerlendirme</p>
              <h2 id="genel-degerlendirme" className="text-lg font-semibold tracking-tight">
                Genel durum
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{interp.overall.text}</p>
              <div className="mt-4">
                <SeverityBar interp={interp} />
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-fg-faint">
                Her sonuç önce laboratuvarın kendi referans aralığına göre, sonra aralıktan ne kadar saptığına göre (hafif / orta / belirgin)
                derecelendirilir. Bazı testlerde yaygın kılavuz kategorileri de gösterilir. Kural tabanlıdır, cihazında hesaplanır; teşhis değildir.
              </p>
            </section>
            {interp.patterns.length > 0 && (
              <section aria-labelledby="birlikte">
                <h2 id="birlikte" className="label-caps mb-2">
                  Birlikte değerlendirme ({interp.patterns.length})
                </h2>
                <PatternList patterns={interp.patterns} />
              </section>
            )}
            {interp.systems.length > 0 && (
              <section aria-labelledby="sistemler">
                <h2 id="sistemler" className="label-caps mb-2">
                  Sistemlere göre
                </h2>
                <SystemGrid interp={interp} />
              </section>
            )}
          </div>

          <h2 className="mb-3 text-lg font-semibold tracking-tight">Tüm sonuçlar</h2>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(
              [
                ['all', 'Tümü'],
                ['abnormal', `Aralık dışı (${abnormal.length})`],
                ['borderline', `Sınırda (${borderline.length})`],
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
                  {list.map((s) => {
                    const f = findings.get(s.test.key);
                    return (
                      <li key={s.test.key} className="flex items-stretch">
                        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left transition hover:bg-ink-800/60" onClick={() => go({ name: 'result', key: s.test.key })}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium">{s.test.nameTr}</span>
                            <span className="block text-xs text-fg-muted">
                              {formatDate(s.latest.date)}
                              {s.latest.result.refText ? ` · aralık ${s.latest.result.refText}` : ''}
                              {s.latest.result.refSource === 'catalog' ? ' (genel)' : ''}
                            </span>
                            {f?.category && <span className="mt-0.5 block truncate text-[11px] text-fg-faint">{f.category}</span>}
                            {needsVerification(s.latest.result) && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#f5b14c]">
                                <AlertIcon size={11} /> Okuma doğrulanmadı
                              </span>
                            )}
                          </span>
                          <span className="flex flex-col items-end gap-1">
                            <span className={`text-right text-sm font-semibold tabular-nums ${STATUS_TEXT[s.latest.result.status]}`}>
                              {display(s)} <span className="text-fg-faint">{trend(s)}</span>
                            </span>
                            {f ? <SeverityChip finding={f} /> : <StatusPill status={s.latest.result.status} />}
                          </span>
                          <ChevronRightIcon size={16} className="shrink-0 text-fg-faint" />
                        </button>
                        <button
                          type="button"
                          className="flex w-12 shrink-0 items-center justify-center border-l border-ink-700 text-fg-faint transition hover:bg-ink-800/60 hover:text-accent"
                          onClick={() => go({ name: 'body', focus: s.test.key })}
                          aria-label={`${s.test.nameTr}: vücutta göster`}
                          title="Vücutta göster"
                        >
                          <BodyIcon size={17} />
                        </button>
                      </li>
                    );
                  })}
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

/** Okuma güveni düşük veya sorunlu olup kullanıcının henüz doğrulamadığı sonuçlar. */
function VerifyList({ series }: { series: TestSeries[] }) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border border-[#f5b14c]/40 bg-[#f5b14c]/[0.06] p-4" aria-labelledby="dogrula">
      <h2 id="dogrula" className="flex items-center gap-2 text-sm font-semibold text-fg">
        <AlertIcon size={16} className="text-[#f5b14c]" /> Doğrulaman gereken değerler ({series.length})
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">
        Bu değerler fotoğraftan/belgeden düşük güvenle okundu veya okurken bir sorun görüldü. Belgedeki değerle karşılaştır; yanlışsa belgeyi açıp düzelt.
        Yorumlar kaydedilen değere göre yapılır.
      </p>
      <ul className="mt-3 divide-y divide-ink-700/70">
        {series.map((s) => {
          const r = s.latest.result;
          return (
            <li key={s.test.key} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-fg">{s.test.nameTr}</span> <span className="tabular-nums text-fg-muted">{display(s)}</span>
                <span className="block text-[11px] text-fg-faint">{verificationIssues(r).map((i) => ISSUE_TEXT[i]).join(' ')}</span>
              </span>
              <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => go({ name: 'document', id: s.latest.report.fileId })}>
                <FileTextIcon size={13} /> Belgede kontrol et
              </button>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1 text-xs"
                disabled={busy === s.test.key}
                onClick={async () => {
                  setBusy(s.test.key);
                  try {
                    await markVerified(vault, s.latest.report.id, s.test.key);
                    bump();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <CheckIcon size={13} /> Doğru
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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
  const all = useMemo(() => (reports ? buildSeries(reports) : []), [reports]);
  const series = all.find((s) => s.test.key === testKey);
  const sex = useSex();
  const interp = useInterpretation(all, sex);
  const finding = interp.findings.find((f) => f.testKey === testKey);
  const related = interp.patterns.filter((p) => p.tests.includes(testKey));
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
            <button type="button" className="btn-ghost" onClick={() => go({ name: 'simulation', id: test.simulation!, from: test.structures[0] })}>
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

      {finding && (
        <section className="mt-4 space-y-3" aria-labelledby="senin-sonucun">
          {finding.critical && <CriticalBanner critical={[finding]} />}
          <h2 id="senin-sonucun" className="label-caps">
            Senin sonucun ne anlama geliyor?
          </h2>
          <FindingBlock finding={finding} />
          {related.length > 0 && (
            <>
              <h3 className="label-caps pt-2">Diğer sonuçlarınla birlikte</h3>
              <PatternList patterns={related} />
            </>
          )}
        </section>
      )}

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
