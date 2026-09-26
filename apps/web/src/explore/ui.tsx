import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import type { SkinMode } from '../anatomy/BodyScene';
import { HIGHLIGHT } from '../anatomy/palette';
import { ChevronRightIcon, MinimizeIcon, RotateCcwIcon, XIcon, ZoomInIcon, ZoomOutIcon } from '../components/icons';

/** Küçük, aralıklı büyük harf etiket (bilimsel etiket dili). */
export function Caps({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[10.5px] tracking-[0.18em] uppercase ${className}`}>{children}</span>;
}

export interface Crumb {
  label: string;
  onClick?: () => void;
}

export function Breadcrumb({ items, accent }: { items: Crumb[]; accent: string }) {
  return (
    <nav aria-label="Keşif seviyesi" className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        // Dar ekranda yalnızca son üç seviye (ilk seviye her zaman "Vücut" düğmesiyle erişilebilir)
        const compact = items.length > 3 && i > 0 && i < items.length - 2;
        return (
          <span key={`${i}-${c.label}`} className={`items-center gap-1.5 ${compact ? 'hidden md:flex' : 'flex'}`}>
            {i > 0 && <span className="font-mono text-[10.5px] text-fg-faint">/</span>}
            {c.onClick && !last ? (
              <button type="button" onClick={c.onClick} className="rounded-sm text-fg-muted transition hover:text-fg">
                <Caps>{c.label}</Caps>
              </button>
            ) : (
              <span aria-current={last ? 'location' : undefined} style={last ? { color: accent } : undefined} className={last ? '' : 'text-fg-muted'}>
                <Caps>{c.label}</Caps>
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export type ViewName = 'front' | 'back' | 'left' | 'right';

export function ViewControls({ onView, onZoom, onReset }: { onView: (v: ViewName) => void; onZoom: (dir: 1 | -1) => void; onReset: () => void }) {
  const views: [ViewName, string][] = [
    ['front', 'Ön'],
    ['back', 'Arka'],
    ['left', 'Sol'],
    ['right', 'Sağ'],
  ];
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-ink-600/60 bg-ink-950/70 p-1 backdrop-blur" role="toolbar" aria-label="Kamera">
      {views.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onView(v)} className="rounded-full px-2.5 py-1.5 text-fg-muted transition hover:bg-ink-700 hover:text-fg" aria-label={`${label} görünüm`}>
          <Caps>{label}</Caps>
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-ink-600" aria-hidden="true" />
      <button type="button" className="icon-btn h-8 w-8 rounded-full" onClick={() => onZoom(1)} aria-label="Yakınlaştır">
        <ZoomInIcon size={16} />
      </button>
      <button type="button" className="icon-btn h-8 w-8 rounded-full" onClick={() => onZoom(-1)} aria-label="Uzaklaştır">
        <ZoomOutIcon size={16} />
      </button>
      <button type="button" className="icon-btn h-8 w-8 rounded-full" onClick={onReset} aria-label="Kamerayı sıfırla">
        <RotateCcwIcon size={16} />
      </button>
    </div>
  );
}

export interface Layers {
  skin: SkinMode;
  skeleton: boolean;
  cardio: boolean;
  organs: boolean;
  respiratory: boolean;
  nervous: boolean;
}

export const DEFAULT_LAYERS: Layers = { skin: 'xray', skeleton: true, cardio: true, organs: true, respiratory: true, nervous: true };

const LAYER_ROWS: { key: Exclude<keyof Layers, 'skin'> | 'muscles'; label: string; note?: string }[] = [
  { key: 'muscles', label: 'Kaslar', note: 'MODEL GEREKİR' },
  { key: 'skeleton', label: 'İskelet', note: 'omurga + pelvis' },
  { key: 'cardio', label: 'Kalp ve damarlar' },
  { key: 'respiratory', label: 'Solunum' },
  { key: 'organs', label: 'İç organlar' },
  { key: 'nervous', label: 'Sinir sistemi' },
];

export function LayersMenu({ layers, onChange, onClose }: { layers: Layers; onChange: (l: Layers) => void; onClose: () => void }) {
  return (
    <div className="pointer-events-auto w-64 rounded-2xl border border-ink-600/70 bg-ink-950/92 p-4 shadow-2xl backdrop-blur" role="dialog" aria-label="Katmanlar">
      <div className="mb-3 flex items-center justify-between">
        <Caps className="text-fg-faint">Katmanlar</Caps>
        <button type="button" className="icon-btn h-7 w-7" onClick={onClose} aria-label="Kapat">
          <XIcon size={14} />
        </button>
      </div>
      <p className="mb-1.5 text-xs text-fg-muted">Deri</p>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-ink-800 p-1" role="radiogroup" aria-label="Deri">
        {(
          [
            ['xray', 'Röntgen'],
            ['solid', 'Opak'],
            ['hidden', 'Gizli'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={layers.skin === m}
            onClick={() => onChange({ ...layers, skin: m })}
            className={`rounded-lg py-1.5 text-xs transition ${layers.skin === m ? 'bg-ink-600 text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="space-y-1">
        {LAYER_ROWS.map((row) => {
          const disabled = row.key === 'muscles';
          const on = !disabled && layers[row.key as Exclude<keyof Layers, 'skin'>];
          return (
            <li key={row.key}>
              <label className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-ink-800'}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-accent)]"
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...layers, [row.key]: e.target.checked })}
                />
                <span className="flex-1">{row.label}</span>
                {row.note && <Caps className="text-[9px] text-fg-faint">{row.note}</Caps>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** İmleci izleyen küçük etiket; içerik ve konum ref ile güncellenir (her harekette React çizimi yok). */
export function Tooltip({ ref }: { ref: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 z-30 hidden max-w-[260px] rounded-lg border border-ink-600/70 bg-ink-950/90 px-2.5 py-1.5 text-xs text-fg shadow-xl backdrop-blur"
      role="status"
      aria-live="off"
    />
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: HIGHLIGHT.high }} /> Yüksek sonuçla ilişkili
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: HIGHLIGHT.low }} /> Düşük sonuçla ilişkili
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: HIGHLIGHT.mixed }} /> İkisi birden
      </span>
    </div>
  );
}

export function LoadingLine({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20" aria-live="polite">
      <div className="h-px w-full bg-ink-700">
        <div className="h-px bg-accent transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="px-4 pt-2 text-right md:px-6">
        <Caps className="text-fg-faint">
          {label} · %{Math.round(progress * 100)}
        </Caps>
      </div>
    </div>
  );
}

/**
 * Bilgi paneli: masaüstünde sağda saydam bir sütun, mobilde alttan açılan sayfa.
 * `onSize` panelin kapattığı alanı bildirir (kamera nesneyi görünür alana kaydırır).
 */
export function ContextSheet({
  children,
  onSize,
  label,
  onClose,
}: {
  children: ReactNode;
  onSize: (cover: { right: number; bottom: number }) => void;
  label: string;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const onSizeRef = useRef(onSize);
  onSizeRef.current = onSize;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      const desktop = window.matchMedia('(min-width: 1024px)').matches;
      onSizeRef.current(desktop ? { right: r.width, bottom: 0 } : { right: 0, bottom: Math.min(r.height, window.innerHeight * 0.5) });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onSizeRef.current({ right: 0, bottom: 0 });
    };
  }, []);

  return (
    <aside
      ref={ref}
      aria-label={label}
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-3xl border-t border-ink-600/60 bg-ink-950/90 backdrop-blur-md transition-[max-height] duration-300 lg:inset-x-auto lg:bottom-0 lg:right-0 lg:top-0 lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0 lg:bg-gradient-to-l lg:from-ink-950 lg:via-ink-950/92 lg:to-ink-950/40 ${
        expanded ? 'max-h-[80%]' : 'max-h-[38%]'
      }`}
    >
      <div className="flex items-center justify-center pt-2 lg:hidden">
        <button
          type="button"
          className="flex h-6 w-16 items-center justify-center"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Paneli küçült' : 'Paneli genişlet'}
          aria-expanded={expanded}
        >
          <span className="h-1 w-10 rounded-full bg-ink-500" />
        </button>
      </div>
      {onClose && (
        <button type="button" className="icon-btn absolute right-3 top-3 z-10 lg:right-5 lg:top-5" onClick={onClose} aria-label="Kapat">
          {expanded ? <MinimizeIcon size={16} /> : <XIcon size={16} />}
        </button>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2 lg:px-9 lg:pb-10 lg:pt-24">{children}</div>
    </aside>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, accent }: { tabs: [T, string][]; value: T; onChange: (t: T) => void; accent: string }) {
  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto border-b border-ink-700 px-1" role="tablist">
      {tabs.map(([t, label]) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={`relative shrink-0 pb-2.5 pt-1 transition ${value === t ? 'text-fg' : 'text-fg-faint hover:text-fg-muted'}`}
        >
          <Caps>{label}</Caps>
          {value === t && <span className="absolute inset-x-0 -bottom-px h-px" style={{ background: accent }} />}
        </button>
      ))}
    </div>
  );
}

export function EnterButton({ onClick, label = 'İçeri gir', accent }: { onClick: () => void; label?: string; accent: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-full border px-5 py-3 text-left transition hover:bg-white/5"
      style={{ borderColor: `${accent}66` }}
    >
      <Caps className="text-fg">{label}</Caps>
      <span className="transition group-hover:translate-x-1" style={{ color: accent }}>
        <ChevronRightIcon size={18} />
      </span>
    </button>
  );
}
