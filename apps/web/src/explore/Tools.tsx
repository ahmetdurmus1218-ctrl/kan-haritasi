import type { ReactNode } from 'react';
import { EyeIcon, EyeOffIcon, KeyboardIcon, LayersIcon, ScissorsIcon, SearchIcon, TargetIcon } from '../components/icons';
import { Caps } from './ui';

export type ClipAxis = 'x' | 'y' | 'z';

export interface ClipState {
  on: boolean;
  axis: ClipAxis;
  /** 0..1, kesilen yapının sınır kutusu içinde */
  at: number;
}

export const CLIP_OFF: ClipState = { on: false, axis: 'z', at: 0.5 };

function ToolButton({ label, keyHint, active, disabled, onClick, children }: { label: string; keyHint?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={keyHint ? `${label} (${keyHint})` : label}
      title={keyHint ? `${label} · ${keyHint}` : label}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? 'bg-[var(--kh-accent)]/20 text-fg ring-1 ring-[var(--kh-accent)]' : 'text-fg-muted hover:bg-ink-700 hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

/** Keşif araçları: arama, izole, gizle, kesit, iç anatomi, kısayollar. */
export function ToolBar({
  canFocusTools,
  hasInner,
  isolate,
  inner,
  clip,
  hiddenCount,
  onSearch,
  onIsolate,
  onHide,
  onRestore,
  onClip,
  onInner,
  onHelp,
}: {
  canFocusTools: boolean;
  hasInner: boolean;
  isolate: boolean;
  inner: boolean;
  clip: boolean;
  hiddenCount: number;
  onSearch: () => void;
  onIsolate: () => void;
  onHide: () => void;
  onRestore: () => void;
  onClip: () => void;
  onInner: () => void;
  onHelp: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-ink-600/60 bg-ink-950/70 p-1 backdrop-blur" role="toolbar" aria-label="Keşif araçları">
      <ToolButton label="Ara" keyHint="Ctrl+K veya /" onClick={onSearch}>
        <SearchIcon size={16} />
      </ToolButton>
      <span className="mx-0.5 h-4 w-px bg-ink-600" aria-hidden="true" />
      <ToolButton label="İzole et" keyHint="I" active={isolate} disabled={!canFocusTools} onClick={onIsolate}>
        <TargetIcon size={16} />
      </ToolButton>
      <ToolButton label="Seçili yapıyı gizle" keyHint="H" disabled={!canFocusTools} onClick={onHide}>
        <EyeOffIcon size={16} />
      </ToolButton>
      {hiddenCount > 0 && (
        <button type="button" onClick={onRestore} className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs text-fg-muted transition hover:bg-ink-700 hover:text-fg" title="Gizlenenleri göster · Shift+H">
          <EyeIcon size={15} /> {hiddenCount}
        </button>
      )}
      <ToolButton label="Kesit görünümü" keyHint="X" active={clip} onClick={onClip}>
        <ScissorsIcon size={16} />
      </ToolButton>
      <ToolButton label="İç anatomi" keyHint="T" active={inner} disabled={!hasInner} onClick={onInner}>
        <LayersIcon size={16} />
      </ToolButton>
      <span className="mx-0.5 hidden h-4 w-px bg-ink-600 md:block" aria-hidden="true" />
      <span className="hidden md:block">
        <ToolButton label="Klavye kısayolları" keyHint="?" onClick={onHelp}>
          <KeyboardIcon size={16} />
        </ToolButton>
      </span>
    </div>
  );
}

const AXES: [ClipAxis, string][] = [
  ['z', 'Önden'],
  ['x', 'Yandan'],
  ['y', 'Üstten'],
];

export function ClipPanel({ clip, onChange }: { clip: ClipState; onChange: (c: ClipState) => void }) {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-ink-600/60 bg-ink-950/80 px-3 py-2 backdrop-blur">
      <Caps className="text-fg-faint">Kesit</Caps>
      <div className="flex rounded-full border border-ink-600 p-0.5" role="radiogroup" aria-label="Kesit yönü">
        {AXES.map(([a, label]) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={clip.axis === a}
            onClick={() => onChange({ ...clip, axis: a })}
            className={`rounded-full px-2.5 py-1 text-xs transition ${clip.axis === a ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={clip.at}
        onChange={(e) => onChange({ ...clip, at: Number(e.target.value) })}
        className="w-36 accent-[var(--kh-accent)] md:w-48"
        aria-label="Kesit derinliği"
      />
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl + K  /  /', 'Ara (organ, bölüm, Latince ad, sahne, tahlil)'],
  ['Esc', 'Bir üst seviyeye çık / kapat'],
  ['R', 'Görünümü sıfırla'],
  ['I', 'Seçili yapıyı izole et'],
  ['H', 'Seçili yapıyı gizle'],
  ['Shift + H', 'Gizlenenleri geri getir'],
  ['X', 'Kesit görünümü aç/kapat'],
  ['[  ]', 'Kesiti ilerlet / geri al'],
  ['T', 'İç anatomi (dış bölümler saydam)'],
  ['L', 'Katmanlar'],
  ['1  2  3  4', 'Ön · Arka · Sol · Sağ görünüm'],
  ['+  −', 'Yakınlaş / uzaklaş'],
  ['G', 'Vücut modeli: erkek ↔ kadın'],
  ['?', 'Bu liste'],
];

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kh-fade-in w-full max-w-md rounded-2xl border border-ink-600 bg-ink-900/95 p-5 shadow-2xl" role="dialog" aria-label="Klavye kısayolları" aria-modal="true">
        <div className="mb-3 flex items-center justify-between">
          <Caps className="text-fg-muted">Klavye kısayolları</Caps>
          <button type="button" className="text-xs text-fg-faint hover:text-fg" onClick={onClose}>
            Kapat
          </button>
        </div>
        <dl className="divide-y divide-ink-700/70">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="flex items-center gap-4 py-2 text-sm">
              <dt className="w-28 shrink-0 font-mono text-xs text-fg">{k}</dt>
              <dd className="text-fg-muted">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-fg-faint">Fare: sürükle = döndür, sağ tık sürükle = kaydır, tekerlek = yakınlaş. Dokunmatik: tek parmak döndür, iki parmak kaydır ve yakınlaş.</p>
      </div>
    </div>
  );
}
