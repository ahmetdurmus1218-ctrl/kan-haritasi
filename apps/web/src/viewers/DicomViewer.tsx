import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DecodedFrame, type DicomInfo, type Window, autoWindow, canDecode, decodeFrame, parseDicom, renderGray } from '@kh/ingest';
import { useUnlockedVault } from '../state/VaultContext';
import { CT_PRESETS } from '../lib/imaging';
import { ContrastIcon, DownloadIcon, MaximizeIcon, SpinnerIcon, ZoomInIcon, ZoomOutIcon } from '../components/icons';
import { Banner, ToolbarGroup } from '../components/ui';
import { clampZoom, useElementWidth, useFullscreen, usePinchZoom } from './hooks';

type Loaded = { info: DicomInfo; bytes: Uint8Array };
type Gray = Extract<DecodedFrame, { kind: 'gray' }>;
type Rgba = Extract<DecodedFrame, { kind: 'rgba' }>;

const CACHE_SIZE = 24;
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR', { useGrouping: false });

/** Sıkıştırılmış (JPEG) kareyi tarayıcıda çözer; gri görüntüde kırmızı kanal değer olarak alınır. */
async function decodeEncoded(f: Extract<DecodedFrame, { kind: 'encoded' }>, info: DicomInfo): Promise<Gray | Rgba> {
  const bitmap = await createImageBitmap(new Blob([f.data.slice()], { type: f.mime }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  if (info.samplesPerPixel !== 1) return { kind: 'rgba', width: img.width, height: img.height, data: img.data };
  const data = new Float32Array(img.width * img.height);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < data.length; i++) {
    const v = img.data[i * 4]! * info.rescaleSlope + info.rescaleIntercept;
    data[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { kind: 'gray', width: img.width, height: img.height, data, min, max };
}

/**
 * MR, BT, röntgen ve ultrason görüntüleyicisi (DICOM). Aynı seriye ait kesitler tek görüntüleyicide
 * kaydırılır; her kesit yalnızca gösterileceği zaman kasadan çözülür ve kısa bir önbellekte tutulur.
 *
 * - Pencere/seviye (WL/WW): sağ tık ile sürükle ya da "Kontrast" aracını açıp sürükle; BT için ön ayarlar.
 * - Kesit: kaydırma tekerleği, ok tuşları veya kaydırıcı.
 * - Yakınlaştırma: Ctrl/⌘ + tekerlek, iki parmak, düğmeler.
 */
export function DicomViewer({
  ids,
  initialId,
  initialBytes,
  onDownload,
}: {
  /** Seri içindeki dosyalar, kesit sırasıyla. */
  ids: string[];
  initialId: string;
  initialBytes: Uint8Array;
  onDownload: () => void;
}) {
  const vault = useUnlockedVault();
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new Map<string, Promise<Loaded>>());
  const [pos, setPos] = useState(() => Math.max(0, ids.indexOf(initialId)));
  const [frameCount, setFrameCount] = useState(1);
  const [current, setCurrent] = useState<{ info: DicomInfo; frame: Gray | Rgba } | null>(null);
  const [unsupported, setUnsupported] = useState<DicomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [win, setWin] = useState<Window | null>(null);
  const [preset, setPreset] = useState<string>('dosya');
  const [invert, setInvert] = useState(false);
  const [wlMode, setWlMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const toggleFullscreen = useFullscreen(rootRef);
  useElementWidth(areaRef, (w, h) => setBox({ w, h }));
  usePinchZoom(areaRef, (f) => setZoom((z) => clampZoom(z * f)));

  const multiFile = ids.length > 1;
  const count = multiFile ? ids.length : frameCount;
  const fileId = multiFile ? ids[pos]! : ids[0]!;
  const frameIndex = multiFile ? 0 : pos;

  const load = useCallback(
    (id: string): Promise<Loaded> => {
      const hit = cache.current.get(id);
      if (hit) return hit;
      const p = (id === initialId ? Promise.resolve(initialBytes) : vault.readFile(id).then((r) => r.bytes)).then((bytes) => ({ info: parseDicom(bytes), bytes }));
      cache.current.set(id, p);
      p.catch(() => cache.current.delete(id));
      if (cache.current.size > CACHE_SIZE) {
        const oldest = cache.current.keys().next().value;
        if (oldest !== undefined && oldest !== id) cache.current.delete(oldest);
      }
      return p;
    },
    [vault, initialId, initialBytes],
  );

  // Geçerli kesiti çöz; komşuları arka planda hazırla.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { info, bytes } = await load(fileId);
      if (cancelled) return;
      if (!multiFile) setFrameCount(info.frames);
      if (!canDecode(info)) {
        setUnsupported(info);
        setCurrent(null);
        return;
      }
      setUnsupported(null);
      const raw = decodeFrame(bytes, info, Math.min(frameIndex, info.frames - 1));
      const frame = raw.kind === 'encoded' ? await decodeEncoded(raw, info) : raw;
      if (cancelled) return;
      setCurrent({ info, frame });
      if (frame.kind === 'gray') {
        // İlk kesitte pencere: dosyadaki değer ya da otomatik. Sonraki kesitlerde kullanıcının ayarı korunur.
        setWin((w) => w ?? (info.windowWidth && info.windowWidth > 0 ? { center: info.windowCenter ?? 0, width: info.windowWidth } : autoWindow(frame.data)));
        setPreset((p) => (p === 'dosya' && !(info.windowWidth && info.windowWidth > 0) ? 'oto' : p));
      }
    })()
      .catch(() => !cancelled && setError('Bu kesit çözülemedi. Dosya bozuk olabilir.'))
      .finally(() => !cancelled && setLoading(false));
    if (multiFile) for (const d of [1, -1, 2]) if (ids[pos + d]) void load(ids[pos + d]!).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fileId, frameIndex, multiFile, ids, pos, load]);

  // Çizim
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !current) return;
    const { frame, info } = current;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(frame.width, frame.height);
    if (frame.kind === 'gray') {
      const mono1 = info.photometric === 'MONOCHROME1';
      renderGray(frame.data, win ?? { center: (frame.min + frame.max) / 2, width: frame.max - frame.min || 1 }, mono1 !== invert, img.data);
    } else {
      img.data.set(frame.data);
      if (invert) {
        for (let i = 0; i < img.data.length; i += 4) {
          img.data[i] = 255 - img.data[i]!;
          img.data[i + 1] = 255 - img.data[i + 1]!;
          img.data[i + 2] = 255 - img.data[i + 2]!;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [current, win, invert]);

  const step = useCallback((d: number) => setPos((p) => Math.min(count - 1, Math.max(0, p + d))), [count]);

  // Tekerlek: kesit değiştir (Ctrl/⌘ ile yakınlaştırma usePinchZoom'da).
  useEffect(() => {
    const el = areaRef.current;
    if (!el || count <= 1) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      step(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [count, step]);

  // Pencere/seviye sürükleme
  const drag = useRef<{ x: number; y: number; win: Window; id: number } | null>(null);
  const range = current?.frame.kind === 'gray' ? Math.max(1, current.frame.max - current.frame.min) : 1;
  const onPointerDown = (e: PointerEvent) => {
    if (current?.frame.kind !== 'gray' || !win) return;
    if (!(wlMode || e.button === 2)) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, win, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const k = range / 600;
    setWin({ width: Math.max(1, d.win.width + (e.clientX - d.x) * k), center: d.win.center - (e.clientY - d.y) * k });
    setPreset('elle');
  };
  const endDrag = () => {
    drag.current = null;
  };

  const choosePreset = (key: string) => {
    setPreset(key);
    const info = current?.info;
    if (key === 'dosya' && info?.windowWidth) setWin({ center: info.windowCenter ?? 0, width: info.windowWidth });
    else if (key === 'oto' && current?.frame.kind === 'gray') setWin(autoWindow(current.frame.data));
    else {
      const p = CT_PRESETS.find((x) => x.key === key);
      if (p) setWin({ center: p.center, width: p.width });
    }
  };

  const natural = current ? { w: current.frame.width, h: current.frame.height } : null;
  const pad = 16;
  const fit = natural && box.w ? Math.min((box.w - pad) / natural.w, (box.h - pad) / natural.h) : 0;
  const scale = fit * zoom;
  const isCt = current?.info.modality === 'CT';
  const gray = current?.frame.kind === 'gray';
  const title = useMemo(() => [current?.info.modality, current?.info.seriesDescription].filter(Boolean).join(' · '), [current]);

  if (unsupported) {
    return (
      <div className="space-y-3 p-6">
        <Banner tone="warn">
          Bu görüntü, uygulamanın çözemediği bir sıkıştırmayla kaydedilmiş ({unsupported.codec === 'unsupported' ? 'ör. JPEG 2000 / JPEG-LS' : unsupported.photometric}). Dosya ve bilgileri güvende; görüntüyü hastanenin verdiği
          DICOM görüntüleyicisiyle açabilirsin.
        </Banner>
        <button type="button" className="btn-ghost" onClick={onDownload}>
          <DownloadIcon size={16} /> Orijinal dosyayı indir
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col bg-black outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') step(-1);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') step(1);
        else if (e.key === 'Home') setPos(0);
        else if (e.key === 'End') setPos(count - 1);
        else return;
        e.preventDefault();
      }}
      aria-label="DICOM görüntüleyici"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-900/80 px-3 py-2">
        <ToolbarGroup>
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => clampZoom(z / 1.25))} aria-label="Uzaklaştır">
            <ZoomOutIcon />
          </button>
          <button type="button" className="min-w-12 rounded-md px-1.5 text-xs tabular-nums text-fg-muted hover:text-fg" onClick={() => setZoom(1)} title="Ekrana sığdır">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => clampZoom(z * 1.25))} aria-label="Yakınlaştır">
            <ZoomInIcon />
          </button>
        </ToolbarGroup>
        {gray && (
          <ToolbarGroup>
            <button
              type="button"
              className={`icon-btn ${wlMode ? 'bg-accent/15 text-accent' : ''}`}
              aria-pressed={wlMode}
              onClick={() => setWlMode((m) => !m)}
              title="Kontrast (pencere/seviye): açıkken görüntü üzerinde sürükle. Sağ tıkla sürüklemek her zaman çalışır."
              aria-label="Kontrast ayarı"
            >
              <ContrastIcon />
            </button>
            <select className="h-8 rounded-md bg-transparent px-1.5 text-xs text-fg-muted hover:text-fg" value={preset} onChange={(e) => choosePreset(e.target.value)} aria-label="Pencere ön ayarı">
              {current?.info.windowWidth ? <option value="dosya">Dosyadaki</option> : null}
              <option value="oto">Otomatik</option>
              {isCt && CT_PRESETS.map((p) => <option key={p.key} value={p.key}>{`BT: ${p.label}`}</option>)}
              {preset === 'elle' && <option value="elle">Elle</option>}
            </select>
          </ToolbarGroup>
        )}
        <ToolbarGroup>
          <button type="button" className={`rounded-md px-2 py-1 text-xs ${invert ? 'text-accent' : 'text-fg-muted hover:text-fg'}`} aria-pressed={invert} onClick={() => setInvert((v) => !v)}>
            Negatif
          </button>
        </ToolbarGroup>
        <div className="flex-1" />
        <ToolbarGroup>
          <button type="button" className="icon-btn" onClick={toggleFullscreen} aria-label="Tam ekran">
            <MaximizeIcon />
          </button>
          <button type="button" className="icon-btn" onClick={onDownload} aria-label="Orijinal dosyayı indir">
            <DownloadIcon />
          </button>
        </ToolbarGroup>
      </div>

      <div
        ref={areaRef}
        className={`relative min-h-0 flex-1 overflow-auto ${wlMode ? 'touch-none cursor-crosshair' : 'touch-pan-x touch-pan-y'}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {(loading && !current) || error ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 p-6 text-sm text-fg-muted">
            {error ? <Banner tone="error">{error}</Banner> : <><SpinnerIcon size={16} /> Görüntü çözülüyor…</>}
          </div>
        ) : null}
        {natural && (
          <div className="relative mx-auto" style={{ width: Math.max(box.w, natural.w * scale + pad), height: Math.max(box.h, natural.h * scale + pad) }}>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`${title || 'Görüntü'} — kesit ${pos + 1} / ${count}`}
              className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
              style={{ width: natural.w * scale, height: natural.h * scale, imageRendering: scale > 2 ? 'pixelated' : 'auto' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </div>
        )}
        {current && (
          <>
            <p className="pointer-events-none absolute left-3 top-2 max-w-[70%] truncate font-mono text-[11px] text-white/80 drop-shadow">{title}</p>
            <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-white/80 drop-shadow">
              {count > 1 ? `Kesit ${pos + 1} / ${count}` : 'Tek kesit'}
              {loading && ' …'}
            </p>
            {gray && win && (
              <p className="pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] text-white/80 drop-shadow" title="Pencere seviyesi (WL) ve genişliği (WW)">
                WL {fmt(win.center)} · WW {fmt(win.width)}
                {isCt ? ' HU' : ''}
              </p>
            )}
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex items-center gap-3 border-t border-ink-700 bg-ink-900/80 px-3 py-2">
          <span className="text-xs tabular-nums text-fg-muted">{pos + 1}</span>
          <input type="range" min={0} max={count - 1} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="flex-1 accent-accent" aria-label="Kesit" />
          <span className="text-xs tabular-nums text-fg-muted">{count}</span>
        </div>
      )}
    </div>
  );
}
