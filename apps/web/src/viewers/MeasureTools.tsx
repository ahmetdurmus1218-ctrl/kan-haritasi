import { type PointerEvent, useMemo, useState } from 'react';
import { IMAGING_MEASURES, type ImagingMeasureDef, formatMeasure } from '@kh/catalog';
import { type Pt, lineLength, roiStats, toImagePoint } from '../lib/measureMath';
import { CheckIcon, XIcon } from '../components/icons';

/** Görüntü üzerinde çizilen ölçüm: çizgi (uzunluk) ya da daire (ortalama yoğunluk). Koordinatlar görüntü pikselidir. */
export interface Mark {
  id: string;
  kind: 'line' | 'roi';
  slice: number;
  a: Pt;
  b: Pt;
  /** Daire ölçümünde, çizildiği kesitteki değerler (kesit değişince yeniden hesaplanmasın). */
  stats?: { mean: number; sd: number; n: number };
}

export interface MeasureContext {
  /** DICOM PixelSpacing [satır, sütun] mm; fotoğrafta yok. */
  spacing?: [number, number];
  /** Gri tonlu kare (ROI için). */
  gray?: { data: Float32Array; width: number; height: number };
  isCt: boolean;
}

const fmt1 = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

export function lineValue(m: Mark, ctx: MeasureContext) {
  return lineLength(m.a, m.b, ctx.spacing);
}

export function roiValue(m: Mark, ctx: MeasureContext) {
  if (m.stats) return m.stats;
  if (!ctx.gray) return null;
  const r = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
  return roiStats(ctx.gray.data, ctx.gray.width, ctx.gray.height, m.a, r);
}

export function markLabel(m: Mark, ctx: MeasureContext, index: number): string {
  if (m.kind === 'line') {
    const l = lineValue(m, ctx);
    return `Ç${index} · ${fmt1(l.value)} ${l.unit === 'mm' ? 'mm' : 'px'}`;
  }
  const s = roiValue(m, ctx);
  if (!s || !s.n) return `B${index}`;
  return `B${index} · ort. ${Math.round(s.mean)}${ctx.isCt ? ' HU' : ''} (±${Math.round(s.sd)})`;
}

/** Ölçüm katmanı: görüntüyle aynı konum, boyut ve döndürmede bir SVG. */
export function MarksOverlay({
  marks,
  natural,
  scale,
  rotation,
  ctx,
  tool,
  slice,
  onAdd,
}: {
  marks: Mark[];
  natural: { w: number; h: number };
  scale: number;
  rotation: number;
  ctx: MeasureContext;
  tool: 'ruler' | 'roi' | null;
  slice: number;
  onAdd: (m: Mark) => void;
}) {
  const [draft, setDraft] = useState<Mark | null>(null);
  const shown = marks.filter((m) => m.slice === slice);
  const point = (e: PointerEvent<SVGSVGElement>): Pt => toImagePoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), rotation, scale, natural);
  const k = 1 / Math.max(scale, 1e-6);
  const all = draft ? [...shown, draft] : shown;
  // Etiket numaraları tüm kesitlerde aynı sırayı izler.
  const number = (m: Mark) => marks.filter((x) => x.kind === m.kind).indexOf(m) + 1 || marks.filter((x) => x.kind === m.kind).length + 1;

  return (
    <svg
      className="absolute left-1/2 top-1/2 max-w-none"
      viewBox={`0 0 ${natural.w} ${natural.h}`}
      preserveAspectRatio="none"
      style={{
        width: natural.w * scale,
        height: natural.h * scale,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        transition: 'transform 180ms ease',
        pointerEvents: tool ? 'auto' : 'none',
        cursor: tool ? 'crosshair' : undefined,
        touchAction: tool ? 'none' : undefined,
      }}
      aria-hidden={all.length === 0}
      role={all.length ? 'img' : undefined}
      aria-label={all.length ? `Ölçümler: ${all.map((m) => markLabel(m, ctx, number(m))).join(', ')}` : undefined}
      onPointerDown={(e) => {
        if (!tool || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const p = point(e);
        setDraft({ id: `${Date.now()}`, kind: tool === 'ruler' ? 'line' : 'roi', slice, a: p, b: p });
      }}
      onPointerMove={(e) => draft && setDraft({ ...draft, b: point(e) })}
      onPointerUp={() => {
        if (draft && Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]) * scale > 6) {
          onAdd(draft.kind === 'roi' ? { ...draft, stats: roiValue(draft, ctx) ?? undefined } : draft);
        }
        setDraft(null);
      }}
      onPointerCancel={() => setDraft(null)}
    >
      {all.map((m) => {
        const label = markLabel(m, ctx, number(m));
        const color = m === draft ? '#fbbf24' : '#5eead4';
        if (m.kind === 'line') {
          const mx = (m.a[0] + m.b[0]) / 2;
          const my = (m.a[1] + m.b[1]) / 2;
          return (
            <g key={m.id}>
              <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <circle cx={m.a[0]} cy={m.a[1]} r={3.5 * k} fill={color} />
              <circle cx={m.b[0]} cy={m.b[1]} r={3.5 * k} fill={color} />
              <text x={mx} y={my - 6 * k} fontSize={13 * k} fill="#fff" stroke="#000" strokeWidth={3 * k} paintOrder="stroke" textAnchor="middle">
                {label}
              </text>
            </g>
          );
        }
        const r = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
        return (
          <g key={m.id}>
            <circle cx={m.a[0]} cy={m.a[1]} r={r} fill={`${color}22`} stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <text x={m.a[0]} y={m.a[1] - r - 6 * k} fontSize={13 * k} fill="#fff" stroke="#000" strokeWidth={3 * k} paintOrder="stroke" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface SavePayload {
  key: string;
  value: number;
  site?: string;
  detail: string;
}

/** Çizilen ölçümü katalogdaki bir ölçüm olarak kaydetme formu (ör. Ç1 → "Dalak uzunluğu"). */
export function SaveMeasurePanel({
  marks,
  ctx,
  onSave,
  onClear,
  sliceLabel,
}: {
  marks: Mark[];
  ctx: MeasureContext;
  onSave: (p: SavePayload) => Promise<void>;
  onClear: () => void;
  sliceLabel: (slice: number) => string;
}) {
  const lines = marks.filter((m) => m.kind === 'line');
  const rois = marks.filter((m) => m.kind === 'roi');
  const defs = useMemo(
    () =>
      IMAGING_MEASURES.filter(
        (d) =>
          (d.manual === 'length' && ctx.spacing && lines.length > 0) ||
          (d.manual === 'hu' && ctx.isCt && rois.length > 0) ||
          (d.manual === 'ratio' && lines.length >= 2),
      ),
    [ctx.spacing, ctx.isCt, lines.length, rois.length],
  );
  const [key, setKey] = useState('');
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [site, setSite] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const def: ImagingMeasureDef | undefined = defs.find((d) => d.key === key);

  let value: number | null = null;
  let detail = '';
  if (def?.manual === 'length' && lines[a]) {
    const l = lineValue(lines[a]!, ctx);
    value = l.value;
    detail = `${sliceLabel(lines[a]!.slice)} · Ç${a + 1} çizgisi ${fmt1(l.value)} mm`;
  } else if (def?.manual === 'hu' && rois[a]) {
    const s = roiValue(rois[a]!, ctx);
    if (s && s.n) {
      value = s.mean;
      detail = `${sliceLabel(rois[a]!.slice)} · B${a + 1} bölgesi ortalama ${Math.round(s.mean)} HU (±${Math.round(s.sd)}, ${s.n} piksel)`;
    }
  } else if (def?.manual === 'ratio' && lines[a] && lines[b] && a !== b) {
    const x = lineValue(lines[a]!, ctx).value;
    const y = lineValue(lines[b]!, ctx).value;
    if (y > 0) {
      value = x / y;
      detail = `Ç${a + 1} / Ç${b + 1} = ${fmt1(x)} / ${fmt1(y)} ${ctx.spacing ? 'mm' : 'px'}`;
    }
  }

  const choose = (k: string) => {
    setKey(k);
    setState('idle');
    const d = defs.find((x) => x.key === k);
    if (d?.manual === 'ratio') {
      // Oranlarda pay çoğunlukla kısa çizgidir (kalp / göğüs kafesi, karıncıklar / kafatası).
      const byLen = lines.map((m, i) => [i, lineValue(m, ctx).value] as const).sort((p, q) => p[1] - q[1]);
      setA(byLen[0]?.[0] ?? 0);
      setB(byLen[byLen.length - 1]?.[0] ?? 1);
    } else {
      setA(Math.max(0, (d?.manual === 'hu' ? rois.length : lines.length) - 1));
    }
  };

  if (!marks.length) return null;
  const pickList = def?.manual === 'hu' ? rois : lines;
  const prefix = def?.manual === 'hu' ? 'B' : 'Ç';

  return (
    <div className="space-y-2 border-t border-ink-700 bg-ink-900/90 px-3 py-2.5 text-xs" aria-label="Ölçümü kaydet">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-fg-muted">Ölçümü kaydet:</span>
        <select className="h-8 min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-fg" value={key} onChange={(e) => choose(e.target.value)} aria-label="Ölçüm türü">
          <option value="">{defs.length ? 'Ne ölçtün? Seç…' : ctx.spacing ? 'Bu çizimle kaydedilebilecek ölçüm yok' : 'Ölçek yok: oran için iki çizgi çek'}</option>
          {defs.map((d) => (
            <option key={d.key} value={d.key}>
              {d.nameTr}
            </option>
          ))}
        </select>
        <button type="button" className="icon-btn h-8 w-8" onClick={onClear} aria-label="Çizimleri temizle" title="Çizimleri temizle">
          <XIcon size={14} />
        </button>
      </div>
      {def && (
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-8 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-fg" value={a} onChange={(e) => setA(Number(e.target.value))} aria-label="Kullanılacak çizim">
            {pickList.map((_, i) => (
              <option key={i} value={i}>
                {prefix}
                {i + 1}
              </option>
            ))}
          </select>
          {def.manual === 'ratio' && (
            <>
              <span className="text-fg-muted">/</span>
              <select className="h-8 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-fg" value={b} onChange={(e) => setB(Number(e.target.value))} aria-label="Paydaki çizgi">
                {lines.map((_, i) => (
                  <option key={i} value={i}>
                    Ç{i + 1}
                  </option>
                ))}
              </select>
            </>
          )}
          {def.sided && (
            <select className="h-8 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-fg" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Taraf">
              <option value="">Taraf…</option>
              <option value="Sağ">Sağ</option>
              <option value="Sol">Sol</option>
            </select>
          )}
          <span className="font-semibold tabular-nums text-fg">{value !== null && Number.isFinite(value) ? formatMeasure(def, value) : '—'}</span>
          <button
            type="button"
            className="btn-primary ml-auto px-3 py-1.5 text-xs"
            disabled={value === null || !Number.isFinite(value) || state === 'saving'}
            onClick={() => {
              if (value === null) return;
              setState('saving');
              onSave({ key: def.key, value: Number(value.toFixed(def.decimals + 1)), site: site || undefined, detail })
                .then(() => setState('saved'))
                .catch(() => setState('error'));
            }}
          >
            Kaydet
          </button>
        </div>
      )}
      {def?.note && def.manual === 'ratio' && <p className="text-[11px] text-fg-faint">{def.note}</p>}
      {state === 'saved' && (
        <p className="flex items-center gap-1 text-accent">
          <CheckIcon size={12} /> Kaydedildi — "Ölçümler" bölümünde genel referansla birlikte görünür.
        </p>
      )}
      {state === 'error' && <p className="text-danger">Kaydedilemedi.</p>}
      <p className="text-[11px] leading-relaxed text-fg-faint">
        Elle ölçüm yaklaşıktır: kesit seçimi ve çizginin yeri sonucu değiştirir. {ctx.spacing ? '' : 'Bu görüntüde milimetre ölçeği yok (fotoğraf ya da ölçek bilgisi olmayan dosya); yalnızca oranlar anlamlıdır.'}
      </p>
    </div>
  );
}
