import { useEffect, useRef, type ReactNode } from 'react';
import { AlertIcon, InfoIcon, XIcon } from './icons';

/** Yerel <dialog>: odak tuzağı, Esc ile kapanma ve üst katman tarayıcıdan gelir. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  tone = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,440px)] rounded-2xl border border-ink-600 bg-ink-850 p-0 text-fg shadow-2xl shadow-black/60 backdrop:bg-ink-950/75 backdrop:backdrop-blur-sm"
      aria-labelledby="dialog-title"
    >
      {open && (
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 id="dialog-title" className={`text-base font-semibold ${tone === 'danger' ? 'text-danger' : ''}`}>
              {title}
            </h2>
            <button type="button" className="icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Kapat">
              <XIcon />
            </button>
          </div>
          <div className="text-sm leading-relaxed text-fg-muted">{children}</div>
          {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const styles = {
    info: 'border-accent/25 bg-accent/5 text-fg',
    warn: 'border-high/30 bg-high/8 text-fg',
    error: 'border-danger/30 bg-danger/8 text-fg',
  }[tone];
  const color = { info: 'text-accent', warn: 'text-high', error: 'text-danger' }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border px-3.5 py-3 text-sm ${styles}`}>
      <span className={`mt-0.5 shrink-0 ${color}`}>{tone === 'info' ? <InfoIcon size={16} /> : <AlertIcon size={16} />}</span>
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

/** Henüz bağlanmamış veya sahte özellikleri açıkça işaretler (NOT CONNECTED / MOCK / PLACEHOLDER). */
export function StatusTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-high/35 bg-high/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-high">
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-ink-500 bg-ink-800 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">{children}</kbd>;
}

export function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5 rounded-xl border border-ink-600/70 bg-ink-850/90 p-0.5">{children}</div>;
}
