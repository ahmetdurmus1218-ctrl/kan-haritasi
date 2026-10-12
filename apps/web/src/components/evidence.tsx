/**
 * Kaynak, güven, konum ve "Neden?" gösterimleri: her bilgi nereden geldiğini taşır. Görüntü
 * analizi, rapor, tahlil ve genel bilgi asla aynı biçimde gösterilmez.
 */
import { useState } from 'react';
import { type AnatomicalLocation, type Confidence, type EvidenceSource, GRAPH, type HealthModel, explainWhy } from '@kh/analysis';

const SOURCE_STYLE: Record<EvidenceSource, { label: string; cls: string }> = {
  IMAGE_ANALYSIS: { label: 'GÖRÜNTÜ ANALİZİ', cls: 'border-[#a78bfa]/50 bg-[#a78bfa]/10 text-[#a78bfa]' },
  DICOM_METADATA: { label: 'DICOM BAŞLIĞI', cls: 'border-ink-500 bg-ink-800 text-fg-muted' },
  RADIOLOGY_REPORT: { label: 'RAPOR', cls: 'border-low/40 bg-low/10 text-low' },
  OCR: { label: 'RAPOR (OCR)', cls: 'border-low/40 bg-low/10 text-low' },
  LAB: { label: 'TAHLİL', cls: 'border-accent/40 bg-accent/10 text-accent' },
  USER_INPUT: { label: 'SENİN GİRDİN', cls: 'border-ink-500 bg-ink-800 text-fg-muted' },
  DERIVED: { label: 'TÜRETİLMİŞ', cls: 'border-caution/40 bg-caution/10 text-caution-fg' },
  KNOWLEDGE: { label: 'GENEL BİLGİ', cls: 'border-ink-500 bg-ink-800 text-fg-muted' },
};

export function SourceBadge({ source }: { source: EvidenceSource }) {
  const s = SOURCE_STYLE[source];
  return <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${s.cls}`}>{s.label}</span>;
}

/** Güven: "algoritmanın bu gözleme güveni" — hastalık olasılığı DEĞİL. */
export function confidenceText(c: Confidence): string {
  if (c.kind === 'reported') return 'raporda/sonuçta yazıyor';
  if (c.kind === 'measured') return `ölçüm · ${c.basis}`;
  return `güven ${c.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} · ${c.basis}`;
}

export function ConfidenceNote({ c }: { c: Confidence }) {
  return (
    <span className="text-[11px] text-fg-faint" title="Güven, algoritmanın bu gözlemi ne kadar güvenilir bulduğudur; hastalık olasılığı değildir.">
      {confidenceText(c)}
    </span>
  );
}

const BASIS_TR: Record<AnatomicalLocation['basis'], string> = {
  'pixel-mapped': 'yaklaşık · görüntüdeki konumdan tahmin',
  'report-text': 'yaklaşık · rapor/metin tabanlı',
  region: 'belgenin bölgesi',
  user: 'senin seçimin',
  knowledge: 'genel bilgi',
};

/** Beyin › Sağ yarıküre › Alın lobu (+ alternatifler). */
export function LocationPath({ loc, onOpen }: { loc: AnatomicalLocation; onOpen?: (id: string) => void }) {
  const nodes = loc.path.map((id) => ({ id, name: GRAPH.node(id)?.nameTr ?? id }));
  const alts = (loc.alternatives ?? []).map((id) => GRAPH.node(id)?.nameTr ?? id);
  return (
    <div className="text-xs">
      <p className="flex flex-wrap items-center gap-1 text-fg">
        {nodes.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-fg-faint">›</span>}
            {onOpen && GRAPH.node(n.id) ? (
              <button type="button" className="underline decoration-ink-500 underline-offset-2 hover:text-accent" onClick={() => onOpen(n.id)}>
                {n.name}
              </button>
            ) : (
              <span>{n.name}</span>
            )}
          </span>
        ))}
        <span className="ml-1 rounded border border-ink-600 px-1 text-[10px] text-fg-muted">{BASIS_TR[loc.basis]}</span>
      </p>
      {alts.length > 0 && <p className="mt-0.5 text-[11px] text-fg-faint">Olası diğer bölgeler: {alts.join(', ')}</p>}
      {loc.note && <p className="mt-0.5 text-[11px] text-fg-faint">{loc.note}</p>}
    </div>
  );
}

/** "Neden?" düğmesi ve zinciri: bulgu → anatomi → normal işlev → süreçler → senin verilerin → sınırlar. */
export function WhyButton({ location, model, testKey }: { location?: AnatomicalLocation; model: HealthModel | null; testKey?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost px-2.5 py-1 text-xs" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Zinciri kapat' : 'Neden? / Neyi etkiler?'}
      </button>
      {open && (
        <ol className="mt-2 w-full space-y-2 rounded-xl border border-ink-600/60 bg-ink-900/40 p-3">
          {explainWhy(location, model, GRAPH, testKey).map((s, i) => (
            <li key={i}>
              <p className="label-caps">
                {i + 1}. {s.title}
              </p>
              <ul className="mt-1 space-y-0.5">
                {s.items.map((it, j) => (
                  <li key={j} className="text-[13px] leading-relaxed text-fg-muted">
                    {it}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function StatusPill({ status }: { status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' }) {
  const s = {
    AVAILABLE: ['MEVCUT', 'border-accent/40 bg-accent/10 text-accent'],
    PARTIAL: ['KISMİ', 'border-caution/40 bg-caution/10 text-caution-fg'],
    UNAVAILABLE: ['MEVCUT DEĞİL', 'border-ink-500 bg-ink-800 text-fg-muted'],
  }[status];
  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${s[1]}`}>{s[0]}</span>;
}
