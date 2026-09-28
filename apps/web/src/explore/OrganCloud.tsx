import { type RefObject, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { XIcon } from '../components/icons';
import { Caps } from './ui';

/**
 * Organa dokununca açılan küçük "dijital bulut": kısa bilgi ve birkaç düğme. Alt paneldeki uzun
 * metinleri okumadan en sık yapılan işlere (sonucum, nasıl çalışır, içeri gir) tek dokunuşla gidilir.
 * Bulut, dokunulan noktaya ince bir çizgiyle bağlıdır ve kamera dönerken o noktayı izler.
 */

export interface CloudAction {
  key: string;
  label: string;
  sub?: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface CloudData {
  caps: string;
  title: string;
  latin?: string;
  status?: { color: string; text: string };
  note?: string;
  actions: CloudAction[];
  more?: { label: string; onClick: () => void };
}

export interface CloudRefs {
  root: RefObject<HTMLDivElement | null>;
  box: RefObject<HTMLDivElement | null>;
  line: RefObject<SVGLineElement | null>;
  dot: RefObject<HTMLDivElement | null>;
}

export function useCloudRefs(): CloudRefs {
  return { root: useRef(null), box: useRef(null), line: useRef(null), dot: useRef(null) };
}

const v = new Vector3();

/**
 * Canvas içinde: bağlantı noktasını her karede ekrana izdüşürür ve bulutu DOM'da doğrudan
 * konumlar (React yeniden çizimi olmadan). Alt panelin kapladığı alan `cover` ile bildirilir.
 */
export function CloudAnchor({ point, refs, cover }: { point: [number, number, number] | null; refs: CloudRefs; cover: RefObject<{ right: number; bottom: number }> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [point, invalidate]);
  useFrame(() => {
    const box = refs.box.current;
    const line = refs.line.current;
    const dot = refs.dot.current;
    if (!point || !box || !line || !dot) return;
    v.set(...point).project(camera);
    const behind = v.z > 1;
    const ax = ((v.x + 1) / 2) * size.width;
    const ay = ((1 - v.y) / 2) * size.height;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const right = size.width - (cover.current?.right ?? 0);
    const bottom = size.height - (cover.current?.bottom ?? 0);
    const gap = 34;
    // Önce sağ üst; sığmazsa sol üst; dikeyde görünür alana sıkıştır.
    let x = ax + gap;
    if (x + w > right - 8) x = ax - gap - w;
    x = Math.max(8, Math.min(right - w - 8, x));
    let y = ay - h - gap * 0.6;
    if (y < 64) y = ay + gap * 0.6;
    y = Math.max(64, Math.min(bottom - h - 8, y));
    box.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    box.style.visibility = behind ? 'hidden' : 'visible';
    dot.style.transform = `translate3d(${Math.round(ax)}px, ${Math.round(ay)}px, 0)`;
    dot.style.visibility = behind ? 'hidden' : 'visible';
    // Çizgi: noktadan bulutun en yakın köşesine
    const cx = ax < x ? x : ax > x + w ? x + w : ax;
    const cy = ay < y ? y : ay > y + h ? y + h : ay;
    line.setAttribute('x1', String(ax));
    line.setAttribute('y1', String(ay));
    line.setAttribute('x2', String(cx));
    line.setAttribute('y2', String(cy));
    line.style.visibility = behind ? 'hidden' : 'visible';
  });
  return null;
}

export function OrganCloud({ data, refs, accent, onClose }: { data: CloudData; refs: CloudRefs; accent: string; onClose: () => void }) {
  return (
    <div ref={refs.root} className="pointer-events-none absolute inset-0 z-30" style={{ ['--kh-accent' as string]: accent }}>
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line ref={refs.line} stroke={accent} strokeWidth="1" strokeDasharray="3 3" opacity="0.8" style={{ visibility: 'hidden' }} />
      </svg>
      <div ref={refs.dot} className="kh-holo-dot absolute left-0 top-0" style={{ visibility: 'hidden' }} aria-hidden="true" />
      <div ref={refs.box} className="absolute left-0 top-0 w-[min(272px,calc(100vw-16px))] will-change-transform" style={{ visibility: 'hidden' }}>
        <div className="kh-holo pointer-events-auto" role="dialog" aria-label={`${data.title} · hızlı bilgi`}>
          <div className="flex items-start gap-2 px-3.5 pt-3">
            <div className="min-w-0 flex-1">
              <Caps className="text-[9.5px] text-fg-faint">{data.caps}</Caps>
              <p className="mt-0.5 truncate text-[17px] font-light leading-tight text-fg">{data.title}</p>
              {data.latin && <p className="truncate font-mono text-[10.5px] italic text-fg-faint">{data.latin}</p>}
            </div>
            <button type="button" className="-mr-1.5 -mt-1 rounded-md p-1 text-fg-faint transition hover:text-fg" onClick={onClose} aria-label="Bulutu kapat">
              <XIcon size={14} />
            </button>
          </div>
          {data.status && (
            <p className="mx-3.5 mt-2 flex items-center gap-2 text-[12px] leading-snug text-fg">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: data.status.color, boxShadow: `0 0 8px ${data.status.color}` }} />
              <span className="min-w-0">{data.status.text}</span>
            </p>
          )}
          {data.note && <p className="mx-3.5 mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-fg-muted">{data.note}</p>}
          <div className="grid grid-cols-2 gap-1.5 p-3">
            {data.actions.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={a.disabled}
                onClick={a.onClick}
                className={`kh-holo-btn min-h-11 rounded-lg border px-2.5 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  a.primary ? 'border-[var(--kh-accent)] text-fg' : 'border-ink-600/80 text-fg-muted hover:text-fg'
                }`}
              >
                <span className="block text-[12.5px] leading-tight">{a.label}</span>
                {a.sub && <span className="mt-0.5 block text-[10px] leading-tight text-fg-faint">{a.sub}</span>}
              </button>
            ))}
          </div>
          {data.more && (
            <button type="button" onClick={data.more.onClick} className="flex w-full items-center justify-between border-t border-ink-600/60 px-3.5 py-2 text-left text-fg-muted transition hover:text-fg">
              <Caps className="text-[9.5px]">{data.more.label}</Caps>
              <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
