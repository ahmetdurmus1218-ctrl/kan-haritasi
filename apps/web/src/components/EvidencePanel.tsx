/**
 * "Bu değerlendirme neye dayanıyor?" — bir tahlil sonucunun kişisel değerlendirmesinin sekiz sorusu:
 * hangi veri · nereden geldi · hangi organ/sistem · ilişki ne kadar güçlü · ne eksik · ne kesin ·
 * ne yalnızca olasılık/eğitimsel · ne zaman sağlık profesyoneli.
 *
 * Zincir: Veri → Parametre → Biyolojik süreç → Organ → Anatomik yapı. Her organ bağlantısı kanıt düzeyini
 * ve dayanağını taşır (packages/catalog/src/relations.ts); hiçbir bağlantı tanı değildir.
 */
import type { ReactNode } from 'react';
import { EVIDENCE_HINT, EVIDENCE_LABEL, type EvidenceLevel, type LabTestDef, PROCESSES, type ResultStatus, evidenceFor, formatNumber, structureById, testByKey } from '@kh/catalog';
import { SIM_MODELS } from '@kh/physio';
import { hrefFor } from '../state/router';
import type { ResultPoint } from '../lib/useReports';
import { formatDate } from '../lib/format';

const LEVEL_STYLE: Record<EvidenceLevel, string> = {
  measured: 'border-accent/50 bg-accent/10 text-fg',
  established: 'border-accent/40 text-fg',
  possible: 'border-ink-500 text-fg-muted',
  educational: 'border-ink-600 border-dashed text-fg-faint',
  insufficient: 'border-ink-600 border-dashed text-fg-faint',
};
/** Renk tek başına anlam taşımaz: her düzeyin simgesi de var. */
const LEVEL_MARK: Record<EvidenceLevel, string> = { measured: '●', established: '◆', possible: '◇', educational: '○', insufficient: '–' };

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide ${LEVEL_STYLE[level]}`} title={EVIDENCE_HINT[level]} data-level={level}>
      <span aria-hidden="true">{LEVEL_MARK[level]}</span> {EVIDENCE_LABEL[level]}
    </span>
  );
}

function Q({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3" data-testid={`evidence-q${n}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-700 text-[11.5px] font-semibold text-fg-muted">{n}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
        <div className="space-y-1.5 text-[13px] leading-relaxed text-fg-muted">{children}</div>
      </div>
    </div>
  );
}

const STATUS_TR: Record<ResultStatus, string> = { high: 'referans aralığının üstünde', low: 'referans aralığının altında', normal: 'referans aralığında', unknown: 'referans aralığıyla karşılaştırılamadı' };
const REF_TR = { report: 'raporun kendi referans aralığı', catalog: 'genel yaklaşık aralık (raporda aralık yoktu)', none: 'referans aralığı yok' } as const;

export function EvidencePanel({ test, point, critical, measured }: { test: LabTestDef; point?: ResultPoint; critical: boolean; measured: ReadonlySet<string> }) {
  const ev = evidenceFor(test.key);
  if (!ev) return null;
  const r = point?.result;
  const value = r ? (r.canonicalValue ?? r.value) : null;
  const unit = r ? (r.canonicalValue !== null ? test.unit : r.unit) : test.unit;
  const status: ResultStatus = r?.status ?? 'unknown';
  const off = status === 'high' || status === 'low';
  const missing = ev.complements.filter((k) => !measured.has(k));
  const have = ev.complements.filter((k) => measured.has(k));
  const sims = SIM_MODELS.filter((m) => m.relatedTests.includes(test.key));
  const name = (k: string) => testByKey.get(k)?.nameTr ?? k;
  const read = r ? (r.userEdited ? 'elle girildi ya da düzeltildi' : r.verified ? 'belgeden okundu, belgeyle karşılaştırıp onayladın' : 'belgeden cihazda okundu ve onayladın') : '';

  return (
    <section className="rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-labelledby="dayanak" data-testid="evidence-panel" data-test={test.key} data-has-data={r ? '1' : '0'}>
      <h2 id="dayanak" className="mb-1 font-semibold text-fg">
        Bu değerlendirme neye dayanıyor?
      </h2>
      <p className="mb-3 text-[12px] text-fg-faint">Veri → biyolojik süreç → organ → anatomik yapı. Her bağlantının gücü ayrı gösterilir; hiçbiri tanı değildir.</p>
      <div className="space-y-4">
        <Q n={1} title="Hangi veriye dayanıyor?">
          <p>{ev.measures}</p>
          {r && value !== null ? (
            <p className="flex flex-wrap items-center gap-2 text-fg">
              <EvidenceBadge level="measured" />
              <span className="tabular-nums">
                {r.qualifier ?? ''}
                {formatNumber(value, test.decimals)} {unit}
              </span>
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-2">
              <EvidenceBadge level="insufficient" /> Bu test sende ölçülmemiş; aşağıdaki ilişkiler genel bilgidir.
            </p>
          )}
        </Q>

        <Q n={2} title="Veri nereden geldi?">
          {r && point ? (
            <p>
              {formatDate(point.date)} tarihli rapor · {read} · karşılaştırma: {REF_TR[r.refSource]}
              {r.refText ? ` (${r.refText})` : ''}.{' '}
              <a className="underline decoration-ink-500 underline-offset-2 hover:text-fg" href={hrefFor({ name: 'document', id: point.report.fileId })}>
                Belgeyi aç
              </a>
            </p>
          ) : (
            <p>Henüz bir rapordan okunmuş değer yok.</p>
          )}
        </Q>

        <Q n={3} title="Hangi organ ya da sistemle ilişkili? İlişki ne kadar güçlü?">
          {test.processes.length > 0 && (
            <p>
              Süreç:{' '}
              {test.processes.map((p) => (
                <span key={p} className="mr-1.5 inline-block rounded-full border border-ink-600 px-2 py-0.5 text-[11.5px]" title={PROCESSES[p].summary}>
                  {PROCESSES[p].nameTr}
                </span>
              ))}
            </p>
          )}
          {ev.relations.length === 0 ? (
            <p>Bu test belirli bir anatomik yapıya bağlanmıyor.</p>
          ) : (
            <ul className="space-y-1.5">
              {ev.relations.map((rel) => (
                <li key={rel.structure} className="rounded-xl border border-ink-600/50 px-3 py-2" data-testid="evidence-rel" data-structure={rel.structure} data-level={r ? rel.level : rel.level === 'educational' ? 'educational' : 'insufficient'}>
                  <div className="flex flex-wrap items-center gap-2">
                    <a className="text-[14px] font-medium text-fg underline decoration-ink-500 underline-offset-2" href={hrefFor({ name: 'body', structure: rel.structure })}>
                      {structureById.get(rel.structure)?.nameTr ?? rel.structure}
                    </a>
                    <EvidenceBadge level={rel.level} />
                    {!r && rel.level !== 'educational' && <EvidenceBadge level="insufficient" />}
                  </div>
                  <p className="mt-0.5 text-[12.5px]">{rel.basis}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11.5px] text-fg-faint">
            ◆ bilinen ilişki: test bu yapının kabul görmüş göstergesidir · ◇ olası: başka etkenler de aynı sonucu verir · ○ eğitimsel: yapının fizyolojideki rolü; değerin bu yapı hakkında bilgi vermez.
            {ev.curated ? '' : ' Bu testin ilişkileri katalog verisinden kuralla türetildi.'}
          </p>
        </Q>

        <Q n={4} title="Hangi bilgiler eksik?">
          {ev.complements.length === 0 ? (
            <p>Bu test için tanımlı tamamlayıcı test yok; klinik bağlam (belirtiler, ilaçlar, öykü) uygulamada bulunmaz.</p>
          ) : (
            <>
              {missing.length > 0 && (
                <p data-testid="evidence-missing">
                  Birlikte değerlendirildiğinde anlam kazandıran ama sende <b className="font-semibold text-fg">ölçülmemiş</b>: {missing.map(name).join(', ')}.
                </p>
              )}
              {have.length > 0 && (
                <p>
                  Ölçülmüş olanlar:{' '}
                  {have.map((k) => (
                    <a key={k} className="mr-2 underline decoration-ink-500 underline-offset-2 hover:text-fg" href={hrefFor({ name: 'result', key: k })}>
                      {name(k)}
                    </a>
                  ))}
                </p>
              )}
              <p>Belirtiler, kullanılan ilaçlar, örneğin alınma koşulu (açlık, saat) ve muayene bulguları uygulamada yoktur.</p>
            </>
          )}
        </Q>

        <Q n={5} title="Ne kesin olarak söylenebilir?">
          {r && value !== null ? (
            <p>
              {formatDate(point!.date)} tarihinde {test.nameTr} {r.qualifier ?? ''}
              {formatNumber(value, test.decimals)} {unit} ölçüldü; bu değer {STATUS_TR[status]}
              {status !== 'unknown' ? ` (${REF_TR[r.refSource]})` : ''}. Kesin olan yalnızca budur.
            </p>
          ) : (
            <p>Ölçülmüş bir değer olmadığı için kişisel hiçbir şey söylenemez.</p>
          )}
        </Q>

        <Q n={6} title="Ne yalnızca olasılık ya da eğitimsel açıklama?">
          <p>{ev.cannotTell}</p>
          <p>Yukarıdaki organ bağlantıları, 3B vücuttaki vurgular ve simülasyonlar genel fizyolojiyi anlatır; vücudunda bir bulgunun yerini ya da bir organın durumunu göstermez.</p>
        </Q>

        <Q n={7} title="Hangi durumda sağlık profesyoneli değerlendirmesi gerekli?">
          {critical ? (
            <p className="font-medium text-danger" data-testid="evidence-urgent">
              Bu değer, laboratuvarların “kritik değer” saydığı düzeyde. Gecikmeden bir sağlık kuruluşuna başvurman ya da hekimini araman gerekebilir; belirtin varsa acil servise başvur.
            </p>
          ) : off ? (
            <p>Referans dışı bir sonucu, onu isteyen hekimle değerlendir. Yeni ya da kötüleşen bir belirtin varsa randevuyu bekleme.</p>
          ) : r ? (
            <p>Sonuç referans aralığında olsa da belirtilerin sürüyorsa hekime danış: tek bir normal değer bir durumu dışlamaz.</p>
          ) : (
            <p>Bu testin gerekip gerekmediğine hekim karar verir.</p>
          )}
        </Q>

        <Q n={8} title="Kaynak">
          <p>{ev.source}</p>
          {sims.length > 0 && (
            <p className="flex flex-wrap gap-2 pt-1">
              {sims.map((m) => (
                <a key={m.id} className="btn-ghost min-h-[40px] px-3 text-[12.5px]" href={hrefFor({ name: 'simlab', id: m.id })} data-testid="evidence-sim">
                  Simülasyon: {m.title}
                </a>
              ))}
            </p>
          )}
        </Q>
      </div>
    </section>
  );
}
