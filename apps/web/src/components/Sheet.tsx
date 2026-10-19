import { useEffect, useRef, type ReactNode } from 'react';
import { XIcon } from './icons';

/**
 * Alt sayfa (telefon) / sağ panel (masaüstü). Basit bilgiler yeni sayfaya gitmeden burada açılır
 * ("Bu bölge nedir?", organ özeti, "Daha" menüsü). Yerel <dialog>: odak tuzağı ve Esc tarayıcıdan.
 */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Yerel <dialog> odağı ilk düğmeye (Kapat) verir; arama gibi alanlar data-autofocus ile odak alır.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
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
      onClick={(e) => {
        // Arka plana dokununca kapanır.
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="sheet-title"
      className="kh-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[28px] border border-ink-600/70 bg-ink-850 p-0 text-fg shadow-[var(--shadow-float)] backdrop:bg-black/40 backdrop:backdrop-blur-[2px] md:ml-auto md:mr-0 md:mt-0 md:h-full md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-[28px]"
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col md:h-full md:max-h-none">
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-600 md:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-2 pt-3 md:pt-6">
            <h2 id="sheet-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label="Kapat">
              <XIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 text-sm leading-relaxed text-fg-muted">{children}</div>
          {footer && <div className="safe-bottom flex shrink-0 flex-wrap gap-2 border-t border-ink-700 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
