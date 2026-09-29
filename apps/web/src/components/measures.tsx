import { useState } from 'react';
import { MEASURE_UNIT_LABEL, formatMeasure, formatNumber } from '@kh/catalog';
import { go } from '../state/router';
import type { MeasureResult } from '../lib/imagingMeasurements';
import { RangeBar, StatusPill } from './results';
import { BodyIcon, ChevronRightIcon, TrashIcon } from './icons';

/**
 * Görüntüleme ölçümleri, tahlil sonuçları gibi: değer, genel referans aralığı, durum, aralık çubuğu;
 * açılınca ne ölçtüğü, olası nedenler, doktora sorulabilecekler, vücutta göster ve içeri gir.
 */
export function MeasureList({ measures, onRemove }: { measures: MeasureResult[]; onRemove?: (m: MeasureResult) => void }) {
  return (
    <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-850/60">
      {measures.map((m, i) => (
        <MeasureRow key={`${m.def.key}-${m.site ?? ''}-${m.manualId ?? i}`} m={m} onRemove={onRemove} />
      ))}
    </ul>
  );
}

function MeasureRow({ m, onRemove }: { m: MeasureResult; onRemove?: (m: MeasureResult) => void }) {
  const [open, setOpen] = useState(m.status === 'high' || m.status === 'low');
  const { def } = m;
  const causes = m.status === 'high' ? def.causesHigh : m.status === 'low' ? def.causesLow : undefined;
  const meaning = m.status === 'high' ? def.high : m.status === 'low' ? def.low : undefined;
  const unit = def.unit === 'percent' ? '%' : MEASURE_UNIT_LABEL[def.unit];
  return (
    <li>
      <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink-800/60" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">
            {def.nameTr}
            {m.site ? <span className="text-fg-muted"> · {m.site}</span> : null}
          </span>
          <span className="mt-0.5 block text-xs text-fg-muted">
            genel referans {m.range.text ? `${m.range.text}${unit ? ` ${unit}` : ''}` : 'yok'} · {m.source === 'report' ? 'rapordan' : 'senin ölçümün'}
          </span>
          {m.grade && <span className="mt-0.5 block text-[12px] text-fg">{m.grade}</span>}
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className={`text-sm font-semibold tabular-nums ${m.status === 'high' ? 'text-high' : m.status === 'low' ? 'text-low' : 'text-fg'}`}>{formatMeasure(def, m.value)}</span>
          <StatusPill status={m.status} />
        </span>
        <ChevronRightIcon size={16} className={`mt-1 shrink-0 text-fg-faint transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-fg-muted">
          <RangeBar value={m.value} min={m.range.min} max={m.range.max} decimals={def.decimals} />
          {m.text && (
            <p className="rounded-lg border border-ink-600/60 bg-ink-900/60 px-3 py-2 text-xs">
              <span className="text-fg-faint">{m.source === 'report' ? 'Rapordaki ifade: ' : 'Ölçüm: '}</span>“{m.text}”
            </p>
          )}
          <p>{def.what}</p>
          {meaning && <p className="text-fg">{meaning}</p>}
          {causes && causes.length > 0 && (
            <div>
              <p className="label-caps mb-1">Olası nedenler (kesin değil)</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {causes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {m.status === 'normal' && <p className="text-xs">Genel referans aralığında. Bu, ilgili yapıda hiçbir sorun olmadığı anlamına gelmez; görüntünün tamamını ve raporu hekim değerlendirir.</p>}
          <div>
            <p className="label-caps mb-1">Doktoruna sorabileceklerin</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {def.askDoctor.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          {def.note && <p className="text-xs text-fg-faint">{def.note}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => go({ name: 'body', structure: def.structure })}>
              <BodyIcon size={14} /> Vücutta göster
            </button>
            {def.inside && (
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => go({ name: 'simulation', id: def.inside!, from: def.structure, mode: 'temel' })}
              >
                ↘ İçeri gir
              </button>
            )}
            {m.source === 'manual' && onRemove && (
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs hover:text-danger" onClick={() => onRemove(m)}>
                <TrashIcon size={14} /> Ölçümü sil
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** Kısa rozet: "Dalak 135 mm ▲". */
export function MeasureChip({ m }: { m: MeasureResult }) {
  const tone = m.status === 'high' ? 'border-high/40 text-high' : m.status === 'low' ? 'border-low/40 text-low' : 'border-ink-600 text-fg-muted';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
      {m.def.short}
      {m.site ? ` (${m.site})` : ''} {m.def.unit === 'ratio' || m.def.unit === 'score' ? formatNumber(m.value, m.def.decimals) : formatMeasure(m.def, m.value)}
      {m.status === 'high' ? ' ▲' : m.status === 'low' ? ' ▼' : ''}
    </span>
  );
}
