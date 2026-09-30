import { useState } from 'react';
import { structureById } from '@kh/catalog';
import { go } from '../state/router';
import { type CheckResult, type CheckStatus, CHECK_STATUS_LABEL, type Protocol } from '../lib/imagingProtocol';
import type { FindingStatus } from '../lib/imagingFindings';
import { BodyIcon } from './icons';

type Tone = { label: string; cls: string };

const REPORT_TONE: Record<FindingStatus, Tone> = {
  abnormal: { label: 'Dikkat', cls: 'border-high/40 bg-high/10 text-high' },
  uncertain: { label: 'Belirsiz', cls: 'border-caution/40 bg-caution/10 text-caution-fg' },
  normal: { label: 'Olağan', cls: 'border-accent/30 bg-accent/5 text-accent' },
};

const STATUS_TONE: Record<Exclude<CheckStatus, 'report'>, Tone> = {
  'report-general': { label: 'Genel ifade', cls: 'border-accent/20 text-accent/80' },
  image: { label: 'Görüntü · basit', cls: 'border-low/35 bg-low/10 text-low' },
  quality: { label: 'Kalite sınırlı', cls: 'border-caution/40 bg-caution/10 text-caution-fg' },
  'no-sequence': { label: 'Sekans eksik', cls: 'border-ink-500 text-fg-muted' },
  expert: { label: 'Uzman gerekli', cls: 'border-ink-500 text-fg-muted' },
  'not-evaluated': { label: 'Değerlendirilemedi', cls: 'border-dashed border-ink-500 text-fg-faint' },
};

const toneOf = (r: CheckResult): Tone => (r.status === 'report' ? REPORT_TONE[r.tone ?? 'normal'] : STATUS_TONE[r.status]);

const SECTION: Record<string, string> = { bulgular: 'Bulgular', sonuc: 'Sonuç', diger: 'Rapor' };

function CheckRow({ r, index }: { r: CheckResult; index: number }) {
  const [open, setOpen] = useState(false);
  const tone = toneOf(r);
  const s = r.item.structure ? structureById.get(r.item.structure) : undefined;
  return (
    <li className="rounded-xl border border-ink-600/60 bg-ink-850/60">
      <button type="button" className="flex w-full items-start gap-2.5 p-3 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[11px] text-fg-faint">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">{r.item.title}</span>
          <span className="mt-0.5 block text-[11px] text-fg-faint">{CHECK_STATUS_LABEL[r.status]}</span>
        </span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.cls}`}>{tone.label}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-ink-700/60 px-3 pb-3 pt-2.5 text-[13px] leading-relaxed">
          <p className="text-fg-muted">
            <span className="label-caps mr-1.5">Neye bakılır</span>
            {r.item.about}
          </p>
          {r.item.normal && (
            <p className="text-fg-muted">
              <span className="label-caps mr-1.5 text-accent">Normalde</span>
              {r.item.normal}
            </p>
          )}
          {r.evidence.length > 0 && (
            <ul className="space-y-1.5">
              {r.evidence.map((f, i) => (
                <li key={i} className="rounded-lg border border-ink-600/60 bg-ink-900/40 px-2.5 py-1.5">
                  <p className="text-fg">“{f.text}”</p>
                  <p className="mt-0.5 text-[11px] text-fg-faint">
                    Rapor · {SECTION[f.section] ?? 'Rapor'} bölümü{f.size ? ` · ölçü ${f.size}` : ''} · {REPORT_TONE[f.status].label.toLocaleLowerCase('tr')}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-fg-muted">{r.note}</p>
          {s && r.item.structure && (
            <button
              type="button"
              className="btn-ghost px-2.5 py-1 text-xs"
              onClick={() => go(r.item.part ? { name: 'body', structure: r.item.structure!, part: r.item.part } : { name: 'body', structure: r.item.structure! })}
            >
              <BodyIcon size={13} /> 3B'de göster · {s.nameTr} (eğitsel, yaklaşık yer)
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export interface ReviewSteps {
  method: string;
  region?: string;
  technique: string[];
  quality?: string;
  report: string;
  image: string;
}

/**
 * Sistematik değerlendirme kartı: inceleme türüne göre kendiliğinden kurulan başlıklar ve her başlığın
 * kaynağı (rapor, görüntü, değerlendirilemedi). Üç bilgi kaynağı ayrı gösterilir: rapor metni, görüntünün
 * kendisi ve eğitsel 3B model.
 */
export function SystematicReview({ protocol, results, steps }: { protocol: Protocol; results: CheckResult[]; steps: ReviewSteps }) {
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const count = (f: (r: CheckResult) => boolean) => results.filter(f).length;
  const flagged = count((r) => r.status === 'report' && r.tone !== 'normal');
  const normal = count((r) => r.status === 'report' && r.tone === 'normal');
  const open = count((r) => r.status !== 'report' && r.status !== 'image');
  const shown = onlyFlagged ? results.filter((r) => r.status === 'report' && r.tone !== 'normal') : results;
  const mapped = count((r) => Boolean(r.item.structure));
  return (
    <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/40 p-4" aria-label="Sistematik değerlendirme">
      <div>
        <p className="label-caps">Sistematik değerlendirme</p>
        <h3 className="mt-0.5 text-base font-semibold">{protocol.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          Bu inceleme türünde bakılan {results.length} başlık kendiliğinden oluşturuldu. Her başlığın durumu yalnızca elimizdeki kaynaktan belirlenir; raporda geçmeyen
          bir başlık “yok” sayılmaz.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full border border-high/40 bg-high/10 px-2 py-0.5 text-high">{flagged} dikkat / belirsiz</span>
        <span className="rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-accent">{normal} olağan</span>
        <span className="rounded-full border border-dashed border-ink-500 px-2 py-0.5 text-fg-muted">{open} değerlendirilemedi / eksik</span>
      </div>

      {/* Bilgi kaynakları: rapor, görüntü, eğitsel 3B ayrı */}
      <dl className="grid gap-1.5 text-xs sm:grid-cols-3" aria-label="Bilgi kaynakları">
        <div className="rounded-lg border border-ink-600/60 p-2">
          <dt className="label-caps">A · Rapor metni</dt>
          <dd className="mt-0.5 text-fg-muted">{steps.report}</dd>
        </div>
        <div className="rounded-lg border border-ink-600/60 p-2">
          <dt className="label-caps">B · Görüntünün kendisi</dt>
          <dd className="mt-0.5 text-fg-muted">{steps.image}</dd>
        </div>
        <div className="rounded-lg border border-ink-600/60 p-2">
          <dt className="label-caps">C · 3B model</dt>
          <dd className="mt-0.5 text-fg-muted">Eğitsel, temsili normal anatomi; senin görüntün değildir. {mapped} başlık yaklaşık yerinde gösterilebilir.</dd>
        </div>
      </dl>

      <details className="rounded-lg border border-ink-600/60 px-3 py-2 text-xs text-fg-muted">
        <summary className="cursor-pointer text-fg">Nasıl değerlendirildi? (8 adım)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Dosya ve yöntem: {steps.method}</li>
          <li>Anatomik bölge: {steps.region ?? 'belirlenemedi — bölge seçilirse başlıklar bölgeye göre özelleşir'}</li>
          <li>
            Kalite ve kapsam: {steps.technique.length ? `raporda / seri adlarında ${steps.technique.join(', ')}` : 'çekim tekniği (sekanslar) bilgisi yok'}
            {steps.quality ? ` · kalite sınırlaması: “${steps.quality}”` : ''}
          </li>
          <li>Başlıklar: “{protocol.title}” şemasından {results.length} başlık</li>
          <li>Her başlık için rapor cümleleri ve (varsa) görüntü karşılaştırması tarandı</li>
          <li>
            Sonuç: {flagged} başlıkta dikkat çeken ya da belirsiz ifade, {normal} başlıkta olağan ifade, {open} başlık değerlendirilemedi ya da uygun sekans yok
          </li>
          <li>3B eşleşme: {mapped} başlık modelde yaklaşık yerinde gösterilebilir</li>
          <li>Sınırlar: sözcük eşleşmesi hatalı olabilir; görüntüden yalnızca basit sağ-sol parlaklık karşılaştırması yapılır. Değerlendirme hekime aittir.</li>
        </ol>
      </details>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">Başlığa dokun: neye bakıldığı, rapordaki cümle ve 3B yer.</p>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} className="accent-accent" />
          Yalnızca dikkat
        </label>
      </div>
      <ol className="space-y-1.5">
        {shown.map((r) => (
          <CheckRow key={r.item.key} r={r} index={results.indexOf(r)} />
        ))}
      </ol>
    </section>
  );
}
