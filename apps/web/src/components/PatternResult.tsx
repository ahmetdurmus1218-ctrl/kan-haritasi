import type { ModelExtras, ModelManifest, PatternPanelResult } from '@kh/analysis';
import { go } from '../state/router';

const fmtPct = (p: number) => `%${Math.round(p * 100)}`;
/** Model olasılığı: uçlar kesinlik izlenimi vermesin diye %99+ / <%1 yazılır (ölçülmüş oranlar için fmtPct). */
const fmtProb = (p: number) => (p >= 0.995 ? '%99+' : p < 0.005 ? '<%1' : `%${Math.round(p * 100)}`);
const GATE_KIND: Record<string, string> = { xray: 'röntgen', headct: 'beyin BT', ct: 'gövde BT', bodymr: 'beyin dışı MR', doc: 'belge/ekran', phantom: 'çizim kafa fantomu', drawing: 'şema/karikatür çizimi', texture: 'doku/desen' };
const tr = (x: number, d = 0) => x.toLocaleString('tr-TR', { maximumFractionDigits: d });

/** Yüzdelik → sade cümle (sağlıklı referans kesitleriyle karşılaştırma). */
export function refSentence(p: PatternPanelResult): string {
  if (p.refPercentile >= 99) return 'Sağlıklı referans kesitlerinin neredeyse tamamından daha farklı görünüyor.';
  if (p.refPercentile >= 90) return `Sağlıklı referans kesitlerinin yaklaşık %${tr(p.refPercentile)}'ından daha farklı görünüyor.`;
  if (p.refPercentile >= 50) return `Sağlıklı referans kesitlerinin çoğuna benziyor (%${tr(p.refPercentile)} düzeyinde farklılık).`;
  return 'Sağlıklı referans kesitlerine yakın görünüyor.';
}

/**
 * Örüntü modeli sonucu: sağlıklı referansla karşılaştırma, en çok benzediği örüntü (olasılıklarla), eğitim
 * dışı görüntü uyarısı, kesit kesit liste, modelin test başarımı, bilmediği durumlar ve sorumluluk notu.
 */
export function PatternResult({ extras, manifest }: { extras: ModelExtras; manifest: ModelManifest }) {
  const pat = extras.pattern;
  if (!pat) return null;
  const lead = pat.lead;
  const allOod = pat.panels.length > 0 && pat.panels.every((p) => p.ood);
  const top = lead?.probs[0];
  const abnormal = Boolean(top && top.key !== 'normal' && top.p >= manifest.scoreThreshold);
  const m = manifest.pattern?.metrics;
  const state = allOod ? 'ood' : !lead ? 'none' : abnormal ? top!.key : 'normal';
  return (
    <section className="space-y-2 rounded-xl border border-[#22d3ee]/40 bg-[#22d3ee]/[0.04] p-3" aria-label="Sağlıklı referansla karşılaştırma" data-testid="pattern-result" data-state={state}>
      <p className="text-[15px] font-semibold text-fg">Sağlıklı referansla karşılaştırma ve örüntü benzerliği</p>
      {allOod ? (
        <p className="text-sm text-fg" data-testid="pattern-ood">
          Bu görüntü, modelin eğitildiği beyin MR kesitlerine benzemiyor (eğitim dağılımı dışında). Bu yüzden bir örüntü benzerliği söylenmedi. Başka bir bölge, başka bir çekim türü ya da çok bozuk bir fotoğraf olabilir.
        </p>
      ) : lead && top ? (
        <>
          <p className="text-sm text-fg" data-testid="pattern-ref">
            <strong>Kesit {lead.panel + 1}:</strong> {refSentence(lead)}
          </p>
          <p className="text-sm text-fg" data-testid="pattern-lead">
            {abnormal ? (
              <>
                En çok benzediği örüntü: <strong>{top.name}</strong> ({fmtProb(top.p)}).{lead.mask ? ' Örüntüye katkı veren alan görüntüde turkuazla gösterildi.' : ''}
              </>
            ) : (
              <>Model bu kesitlerde bildiği hastalık örüntülerinden birine belirgin benzerlik bulmadı. Bu, görüntünün normal olduğunu göstermez.</>
            )}
          </p>
          <ul className="space-y-1" aria-label="Örüntü olasılıkları" data-testid="pattern-probs">
            {lead.probs.map((x) => (
              <li key={x.key} className="flex items-center gap-2 text-xs">
                <span className="w-60 shrink-0 text-fg">{x.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <span className="block h-full" style={{ width: `${Math.round(x.p * 100)}%`, background: x.key === 'normal' ? 'var(--color-accent)' : '#22d3ee' }} />
                </span>
                <span className="w-11 text-right tabular-nums">{fmtProb(x.p)}</span>
              </li>
            ))}
          </ul>
          {abnormal && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => go({ name: 'brain' })}>
                Beyin haritası
              </button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => go({ name: 'interior', id: 'brain' })}>
                Beynin içine gir
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-fg-muted">Değerlendirilebilen kesit bulunamadı.</p>
      )}
      {pat.panels.length > 1 && (
        <details className="text-xs text-fg-muted">
          <summary className="cursor-pointer text-fg">Kesit kesit ({pat.panels.length})</summary>
          <ul className="mt-1 space-y-0.5" data-testid="pattern-panels">
            {pat.panels.map((p) => (
              <li key={p.panel}>
                Kesit {p.panel + 1}: {p.ood ? 'eğitim dışı görüntü — değerlendirilmedi' : `${p.probs[0]!.name} ${fmtProb(p.probs[0]!.p)} · sağlıklı referansa göre %${tr(p.refPercentile)} düzeyinde farklılık`}
              </li>
            ))}
          </ul>
        </details>
      )}
      {m && (
        <details className="text-xs text-fg-muted" data-testid="pattern-metrics">
          <summary className="cursor-pointer text-fg">Bu model ne kadar doğru? (hasta bazlı ayrık test)</summary>
          <p className="mt-1">
            {m.patients.train} hastanın {tr(m.slices.train)} kesitiyle eğitildi; daha önce hiç görmediği {m.patients.test} hastanın {tr(m.slices.test)} kesitinde denendi.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              Normal ↔ lezyonlu kesit ayrımı: AUC {tr(m.test.abnormal_auc, 3)} · duyarlılık {fmtPct(m.test.abnormal_sens_at_0_5)} · özgüllük {fmtPct(m.test.abnormal_spec_at_0_5)}
            </li>
            <li>Dört örüntü doğruluğu: {fmtPct(m.test.accuracy)} (makro F1 {tr(m.test.macro_f1, 2)})</li>
            {Object.entries(m.test.per_class).map(([k, v]) => (
              <li key={k}>
                {manifest.labels.find((l) => l.key === k)?.finding ?? k}: duyarlılık {fmtPct(v.sensitivity)} · özgüllük {fmtPct(v.specificity)}
              </li>
            ))}
            <li>
              Telefon fotoğrafı benzetimi (eğik çekim, bulanıklık, ekran deseni, yazılar): doğruluk {fmtPct(m.photo.accuracy)} · normal ↔ lezyonlu AUC {tr(m.photo.abnormal_auc, 3)}
            </li>
            <li>Sağlıklı referansa uzaklığın tek başına ayırıcılığı: AUC {tr(m.refAuc, 3)} · katkı haritası (lezyon maskesiyle) ortanca Dice {tr(m.lesionMapDice, 2)}</li>
            {m.finding && (
              <li data-testid="pattern-finding">
                Örüntü yalnızca olasılığı {fmtPct(m.finding.threshold)} ve üzerindeyse söylenir. Bu eşikte test kümesinde: lezyonlu kesitlerde örüntü söylenme oranı {fmtPct(m.finding.lesionReported)}
                (doğru örüntü {fmtPct(m.finding.correctPattern)}) · lezyonsuz kesitlerde yanlışlıkla söylenme oranı {fmtPct(m.finding.normalFalse)} · telefon fotoğrafı benzetiminde{' '}
                {fmtPct(m.finding.lesionReportedPhoto)} / {fmtPct(m.finding.normalFalsePhoto)}
              </li>
            )}
            {m.gate && (
              <li data-testid="pattern-gate">
                Eğitim dışı kapısı: değerlendirmeye alınan beyin MR test kesitleri {fmtPct(m.gate.brainPass)} · reddedilen beyin MR dışı görüntüler —{' '}
                {Object.entries(m.gate.rejected)
                  .map(([k, r]) => `${GATE_KIND[k] ?? k} ${fmtPct(r)}`)
                  .join(' · ')}
              </li>
            )}
          </ul>
          {manifest.pattern?.data && (
            <>
              <p className="mt-2 text-fg">Eğitim verisi (açık lisanslı, gerçek hastalar):</p>
              <ul className="list-disc pl-4">
                {manifest.pattern.data.map((d) => (
                  <li key={d.name}>
                    {d.name} — {d.role} · {d.patients} kişi · {tr(d.slices)} kesit · {d.license}
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      )}
      <details className="text-xs text-fg-muted">
        <summary className="cursor-pointer text-fg">Modelin bilmediği durumlar ve sınırlar</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {manifest.limitations.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
      <p className="text-[11px] text-fg-faint">
        Bu bir ön bilgi ve referanstır, kesin sonuç değildir; tanı koymaz ve radyolog raporunun yerini tutmaz. Değerlendirme hekime aittir.
      </p>
    </section>
  );
}
