import { useEffect, useRef, type RefObject } from 'react';

/**
 * İki parmakla yakınlaştırma ve Ctrl/⌘ + tekerlek. Tek parmak kaydırması tarayıcıya bırakılır
 * (kapsayıcıda `touch-action: pan-x pan-y`), böylece yakınlaştırılmış içerikte gezinme doğal kalır.
 */
export function usePinchZoom(ref: RefObject<HTMLElement | null>, onScale: (factor: number) => void) {
  const cb = useRef(onScale);
  useEffect(() => {
    cb.current = onScale;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let lastDist = 0;

    const dist = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) lastDist = dist();
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const d = dist();
        if (lastDist > 0 && d > 0) {
          const f = d / lastDist;
          if (Math.abs(f - 1) > 0.02) {
            cb.current(f);
            lastDist = d;
          }
        }
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastDist = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      cb.current(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [ref]);
}

export function useElementWidth(ref: RefObject<HTMLElement | null>, onWidth: (w: number, h: number) => void) {
  const cb = useRef(onWidth);
  useEffect(() => {
    cb.current = onWidth;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) cb.current(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };
  return toggle;
}

export const clampZoom = (z: number) => Math.min(5, Math.max(0.25, z));
