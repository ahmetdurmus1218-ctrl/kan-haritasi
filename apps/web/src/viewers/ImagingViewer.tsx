import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type DecodedFrame,
  type DicomInfo,
  type Window,
  autoWindow,
  canDecode,
  decodeFrame,
  isNearlyGray,
  parseDicom,
  renderGray,
  renderRgba,
  rgbaToGray,
} from '@kh/ingest';
import type { FileInfo } from '@kh/vault';
import { useUnlockedVault } from '../state/VaultContext';
import { CT_PRESETS } from '../lib/imaging';
import { CircleDotIcon, ContrastIcon, DownloadIcon, MaximizeIcon, RotateCcwIcon, RotateCwIcon, RulerIcon, SpinnerIcon, ZoomInIcon, ZoomOutIcon } from '../components/icons';
import { type Mark, type MeasureContext, MarksOverlay, type SavePayload, SaveMeasurePanel } from './MeasureTools';
import { Banner, ToolbarGroup } from '../components/ui';
import { clampZoom, useElementWidth, useFullscreen, usePinchZoom } from './hooks';

type Gray = Extract<DecodedFrame, { kind: 'gray' }>;
type Rgba = Extract<DecodedFrame, { kind: 'rgba' }>;

/** Görüntüleyicinin ihtiyaç duyduğu ortak bilgiler (DICOM başlığından ya da fotoğraftan). */
interface ViewMeta {
  modality?: string;
  seriesDescription?: string;
  windowCenter?: number;
  windowWidth?: number;
  /** MONOCHROME1: düşük değer beyaz. */
  inverted: boolean;
  frames: number;
  /** Fotoğraf/ekran görüntüsü (DICOM değil). */
  photo: boolean;
  /** mm: [satır aralığı, sütun aralığı]; fotoğrafta yok. */
  pixelSpacing?: [number, number];
}

type Loaded = { kind: 'dicom'; info: DicomInfo; meta: ViewMeta; bytes: Uint8Array } | { kind: 'photo'; meta: ViewMeta; frame: Gray | Rgba };

const CACHE_SIZE = 24;
/** Çok büyük fotoğraflar ekran için küçültülür (bellek: gri kare başına 4 bayt/piksel). */
const MAX_PHOTO_SIDE = 4096;
const IDENTITY: Window = { center: 127.5, width: 255 };
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

/** JPG/PNG: EXIF yönüyle çöz; film/MR baskısı gibi gri görüntüler pencere/seviye için gri kareye çevrilir. */
async function decodePhoto(bytes: Uint8Array, mime: string): Promise<Gray | Rgba> {
  const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: mime }), { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  return isNearlyGray(img.data) ? rgbaToGray(img.data, img.width, img.height) : { kind: 'rgba', width: img.width, height: img.height, data: img.data };
}

const dicomMeta = (info: DicomInfo): ViewMeta => ({
  modality: info.modality,
  seriesDescription: info.seriesDescription,
  windowCenter: info.windowCenter,
  windowWidth: info.windowWidth,
  inverted: info.photometric === 'MONOCHROME1',
  frames: info.frames,
  photo: false,
  pixelSpacing: info.pixelSpacing,
});

/**
 * MR, BT, röntgen ve ultrason görüntüleyicisi: DICOM dosyaları ve fotoğrafı çekilmiş/taranmış
 * görüntüler (JPG, PNG) aynı araçlarla incelenir. Aynı seriye ait kesitler tek görüntüleyicide
 * kaydırılır; her kesit yalnızca gösterileceği zaman kasadan çözülür ve kısa bir önbellekte tutulur.
 *
 * - Pencere/seviye (WL/WW): sağ tık ile sürükle ya da "Kontrast" aracını açıp sürükle; BT için ön ayarlar.
 * - Kesit: kaydırma tekerleği, ok tuşları veya kaydırıcı.
 * - Yakınlaştırma: Ctrl/⌘ + tekerlek, iki parmak, düğmeler.
 */
export function ImagingViewer({
  ids,
  initial,
  onDownload,
  onSaveMeasurement,
}: {
  /** Seri içindeki dosyalar, kesit sırasıyla. */
  ids: string[];
  /** Açılan belge (zaten çözülmüş). */
  initial: { info: FileInfo; bytes: Uint8Array };
  onDownload: () => void;
  /** Elle yapılan ölçümü (ör. dalak uzunluğu) belgeye kaydeder. */
  onSaveMeasurement?: (p: SavePayload) => Promise<void>;
}) {
  const initialId = initial.info.id;
  const vault = useUnlockedVault();
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new Map<string, Promise<Loaded>>());
  const [pos, setPos] = useState(() => Math.max(0, ids.indexOf(initialId)));
  const [frameCount, setFrameCount] = useState(1);
  const [current, setCurrent] = useState<{ meta: ViewMeta; frame: Gray | Rgba } | null>(null);
  const [unsupported, setUnsupported] = useState<DicomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [win, setWin] = useState<Window | null>(null);
  const [preset, setPreset] = useState<string>('dosya');
  const [invert, setInvert] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [tool, setTool] = useState<'wl' | 'ruler' | 'roi' | null>(null);
  const wlMode = tool === 'wl';
  const [marks, setMarks] = useState<Mark[]>([]);
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
      const p = (id === initialId ? Promise.resolve(initial) : vault.readFile(id)).then(async ({ info: file, bytes }): Promise<Loaded> => {
        if (file.kind !== 'dicom') {
          return { kind: 'photo', meta: { inverted: false, frames: 1, photo: true }, frame: await decodePhoto(bytes, file.mimeType) };
        }
        const info = parseDicom(bytes);
        return { kind: 'dicom', info, meta: dicomMeta(info), bytes };
      });
      cache.current.set(id, p);
      p.catch(() => cache.current.delete(id));
      if (cache.current.size > CACHE_SIZE) {
        const oldest = cache.current.keys().next().value;
        if (oldest !== undefined && oldest !== id) cache.current.delete(oldest);
      }
      return p;
    },
    [vault, initialId, initial],
  );

  // Geçerli kesiti çöz; komşuları arka planda hazırla.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const loaded = await load(fileId);
      if (cancelled) return;
      const { meta } = loaded;
      if (!multiFile) setFrameCount(meta.frames);
      let frame: Gray | Rgba;
      if (loaded.kind === 'photo') frame = loaded.frame;
      else {
        if (!canDecode(loaded.info)) {
          setUnsupported(loaded.info);
          setCurrent(null);
          return;
        }
        const raw = decodeFrame(loaded.bytes, loaded.info, Math.min(frameIndex, meta.frames - 1));
        frame = raw.kind === 'encoded' ? await decodeEncoded(raw, loaded.info) : raw;
      }
      setUnsupported(null);
      if (cancelled) return;
      setCurrent({ meta, frame });
      // İlk kesitte pencere: dosyadaki değer, fotoğrafta özgün görünüm, yoksa otomatik.
      // Sonraki kesitlerde kullanıcının ayarı korunur.
      const fromFile = meta.windowWidth && meta.windowWidth > 0 ? { center: meta.windowCenter ?? 0, width: meta.windowWidth } : null;
      setWin((w) => w ?? fromFile ?? (meta.photo || frame.kind === 'rgba' ? IDENTITY : autoWindow((frame as Gray).data)));
      setPreset((p) => (p !== 'dosya' ? p : fromFile ? 'dosya' : meta.photo || frame.kind === 'rgba' ? 'orijinal' : 'oto'));
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
    const { frame, meta } = current;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(frame.width, frame.height);
    if (frame.kind === 'gray') {
      renderGray(frame.data, win ?? { center: (frame.min + frame.max) / 2, width: frame.max - frame.min || 1 }, meta.inverted !== invert, img.data);
    } else {
      renderRgba(frame.data, win ?? IDENTITY, invert, img.data);
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
  const range = current?.frame.kind === 'gray' ? Math.max(1, current.frame.max - current.frame.min) : 255;
  const onPointerDown = (e: PointerEvent) => {
    if (!current || !win) return;
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
    const meta = current?.meta;
    if (key === 'dosya' && meta?.windowWidth) setWin({ center: meta.windowCenter ?? 0, width: meta.windowWidth });
    else if (key === 'orijinal') setWin(IDENTITY);
    else if (key === 'oto' && current) {
      const f = current.frame;
      setWin(autoWindow(f.kind === 'gray' ? f.data : rgbaToGray(f.data, f.width, f.height).data));
    } else {
      const p = CT_PRESETS.find((x) => x.key === key);
      if (p) setWin({ center: p.center, width: p.width });
    }
  };

  const natural = current ? { w: current.frame.width, h: current.frame.height } : null;
  const quarter = ((rotation % 360) + 360) % 360;
  const sideways = quarter === 90 || quarter === 270;
  const rw = natural ? (sideways ? natural.h : natural.w) : 0;
  const rh = natural ? (sideways ? natural.w : natural.h) : 0;
  const pad = 16;
  const fit = natural && box.w ? Math.min((box.w - pad) / rw, (box.h - pad) / rh) : 0;
  const scale = fit * zoom;
  const photo = current?.meta.photo ?? false;
  const isCt = current?.meta.modality === 'CT';
  const title = useMemo(
    () => (current?.meta.photo ? 'Fotoğraf / taranmış görüntü' : [current?.meta.modality, current?.meta.seriesDescription].filter(Boolean).join(' · ')),
    [current],
  );

  const measureCtx: MeasureContext = {
    spacing: current?.meta.pixelSpacing,
    gray: current?.frame.kind === 'gray' ? current.frame : undefined,
    isCt,
  };

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
      aria-label="Görüntüleyici"
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
        {current && (
          <ToolbarGroup>
            <button
              type="button"
              className={`icon-btn ${wlMode ? 'bg-accent/15 text-accent' : ''}`}
              aria-pressed={wlMode}
              onClick={() => setTool((t) => (t === 'wl' ? null : 'wl'))}
              title="Kontrast (pencere/seviye): açıkken görüntü üzerinde sürükle. Sağ tıkla sürüklemek her zaman çalışır."
              aria-label="Kontrast ayarı"
            >
              <ContrastIcon />
            </button>
            <select className="h-8 rounded-md bg-transparent px-1.5 text-xs text-fg-muted hover:text-fg" value={preset} onChange={(e) => choosePreset(e.target.value)} aria-label="Pencere ön ayarı">
              {current?.meta.windowWidth ? <option value="dosya">Dosyadaki</option> : null}
              {(photo || current?.frame.kind === 'rgba') && <option value="orijinal">Orijinal</option>}
              <option value="oto">Otomatik kontrast</option>
              {isCt && CT_PRESETS.map((p) => <option key={p.key} value={p.key}>{`BT: ${p.label}`}</option>)}
              {preset === 'elle' && <option value="elle">Elle</option>}
            </select>
          </ToolbarGroup>
        )}
        <ToolbarGroup>
          <button type="button" className={`rounded-md px-2 py-1 text-xs ${invert ? 'text-accent' : 'text-fg-muted hover:text-fg'}`} aria-pressed={invert} onClick={() => setInvert((v) => !v)}>
            Negatif
          </button>
          <button type="button" className="icon-btn" onClick={() => setRotation((r) => r - 90)} aria-label="Sola döndür">
            <RotateCcwIcon />
          </button>
          <button type="button" className="icon-btn" onClick={() => setRotation((r) => r + 90)} aria-label="Sağa döndür">
            <RotateCwIcon />
          </button>
        </ToolbarGroup>
        {current && onSaveMeasurement && (
          <ToolbarGroup>
            <button
              type="button"
              className={`icon-btn ${tool === 'ruler' ? 'bg-accent/15 text-accent' : ''}`}
              aria-pressed={tool === 'ruler'}
              onClick={() => setTool((t) => (t === 'ruler' ? null : 'ruler'))}
              aria-label="Cetvel"
              title={current.meta.pixelSpacing ? 'Cetvel: iki nokta arası uzunluk (mm)' : 'Cetvel: ölçek yok, oran için iki çizgi çek'}
            >
              <RulerIcon />
            </button>
            {current.frame.kind === 'gray' && !current.meta.photo && (
              <button
                type="button"
                className={`icon-btn ${tool === 'roi' ? 'bg-accent/15 text-accent' : ''}`}
                aria-pressed={tool === 'roi'}
                onClick={() => setTool((t) => (t === 'roi' ? null : 'roi'))}
                aria-label="Yoğunluk ölçümü"
                title={isCt ? 'Yoğunluk: daire içindeki ortalama Hounsfield değeri' : 'Daire içindeki ortalama sinyal'}
              >
                <CircleDotIcon />
              </button>
            )}
          </ToolbarGroup>
        )}
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
        className={`relative min-h-0 flex-1 overflow-auto ${tool ? 'touch-none cursor-crosshair' : 'touch-pan-x touch-pan-y'}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {(loading && !current) || error ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 p-6 text-sm text-fg-muted">
            {error ? <Banner tone="error">{error}</Banner> : <><SpinnerIcon size={16} /> Görüntü çözülüyor…</>}
          </div>
        ) : null}
        {natural && (
          <div className="relative mx-auto" style={{ width: Math.max(box.w, rw * scale + pad), height: Math.max(box.h, rh * scale + pad) }}>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`${title || 'Görüntü'} — kesit ${pos + 1} / ${count}`}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: natural.w * scale,
                height: natural.h * scale,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                transition: 'transform 180ms ease',
                imageRendering: scale > 2 ? 'pixelated' : 'auto',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
            <MarksOverlay
              marks={marks}
              natural={natural}
              scale={scale}
              rotation={rotation}
              ctx={measureCtx}
              tool={tool === 'ruler' || tool === 'roi' ? tool : null}
              slice={pos}
              onAdd={(m) => setMarks((list) => [...list, m])}
            />
          </div>
        )}
        {current && (
          <>
            <p className="pointer-events-none absolute left-3 top-2 max-w-[70%] truncate font-mono text-[11px] text-white/80 drop-shadow">{title}</p>
            <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-white/80 drop-shadow">
              {count > 1 ? `Kesit ${pos + 1} / ${count}` : photo ? '' : 'Tek kesit'}
              {loading && ' …'}
            </p>
            {win && (
              <p className="pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] text-white/80 drop-shadow" title="Pencere seviyesi (WL) ve genişliği (WW)">
                WL {fmt(win.center)} · WW {fmt(win.width)}
                {isCt ? ' HU' : ''}
              </p>
            )}
          </>
        )}
      </div>

      {onSaveMeasurement && (
        <SaveMeasurePanel
          marks={marks}
          ctx={measureCtx}
          onSave={onSaveMeasurement}
          onClear={() => setMarks([])}
          sliceLabel={(sl) => (count > 1 ? `Kesit ${sl + 1}` : 'Görüntü')}
        />
      )}

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
