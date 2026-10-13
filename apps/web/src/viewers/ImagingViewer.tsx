import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type DecodedFrame,
  type DicomInfo,
  PLANE_LABEL,
  type Volume,
  type Window,
  autoWindow,
  buildVolume,
  mprGeometry,
  reslice,
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
  // Çok düzlemli yeniden yapılandırma (MPR): yalnızca istenince ve seri güvenilirse.
  const [mpr, setMpr] = useState<null | { status: 'loading'; done: number; total: number } | { status: 'error'; reason: string } | { status: 'ready'; volume: Volume }>(null);
  const [plane, setPlane] = useState<'acq' | 'column' | 'row'>('acq');
  const [mprPos, setMprPos] = useState({ column: 0, row: 0 });
  const mprCancel = useRef(false);
  useEffect(
    () => () => {
      mprCancel.current = true;
    },
    [],
  );

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

  const volume = mpr?.status === 'ready' ? mpr.volume : null;
  const mprPlane = plane !== 'acq' && volume ? plane : null;
  const sliceCount = mprPlane ? (mprPlane === 'column' ? volume!.geometry.columns : volume!.geometry.rows) : count;
  const slicePos = mprPlane ? mprPos[mprPlane] : pos;
  const setSlice = useCallback(
    (f: (p: number) => number) => {
      if (mprPlane) setMprPos((m) => ({ ...m, [mprPlane]: Math.min(sliceCount - 1, Math.max(0, f(m[mprPlane]))) }));
      else setPos((p) => Math.min(count - 1, Math.max(0, f(p))));
    },
    [mprPlane, sliceCount, count],
  );
  const step = useCallback((d: number) => setSlice((p) => p + d), [setSlice]);

  /** Görüntülenen kare: çekim düzlemi ya da hacimden yeniden yapılandırılmış düzlem. */
  const view = useMemo(() => {
    if (!current || !mprPlane || !volume) return current;
    const r = reslice(volume, mprPlane, mprPos[mprPlane]);
    const frame: Gray = { kind: 'gray', width: r.width, height: r.height, data: r.data, min: r.min, max: r.max };
    return { meta: { ...current.meta, pixelSpacing: r.pixelSpacing, frames: 1 }, frame, plane: r.plane };
  }, [current, mprPlane, volume, mprPos]);

  // Çizim
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view) return;
    const { frame, meta } = view;
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
  }, [view, win, invert]);

  const startMpr = async () => {
    mprCancel.current = false;
    setMpr({ status: 'loading', done: 0, total: ids.length });
    try {
      const infos: DicomInfo[] = [];
      const bytesList: Uint8Array[] = [];
      for (const [i, id] of ids.entries()) {
        if (mprCancel.current) return;
        const l = await load(id);
        if (l.kind !== 'dicom') return setMpr({ status: 'error', reason: 'Seride DICOM olmayan dosya var.' });
        infos.push(l.info);
        bytesList.push(l.bytes);
        if (i % 8 === 0) setMpr({ status: 'loading', done: i + 1, total: ids.length });
      }
      const g = mprGeometry(infos);
      if (!g.ok) return setMpr({ status: 'error', reason: g.reason });
      const slices: Float32Array[] = [];
      for (const [i, info] of infos.entries()) {
        if (mprCancel.current) return;
        if (!canDecode(info) || info.samplesPerPixel !== 1) return setMpr({ status: 'error', reason: 'Seride çözülemeyen ya da renkli kesit var.' });
        const raw = decodeFrame(bytesList[i]!, info, 0);
        const f = raw.kind === 'encoded' ? await decodeEncoded(raw, info) : raw;
        if (f.kind !== 'gray') return setMpr({ status: 'error', reason: 'Renkli seride yeniden yapılandırma yapılmaz.' });
        slices.push(f.data);
      }
      if (mprCancel.current) return;
      const vol = buildVolume(g.geometry, slices);
      setMpr({ status: 'ready', volume: vol });
      setMprPos({ column: Math.floor(g.geometry.columns / 2), row: Math.floor(g.geometry.rows / 2) });
      setTool(null);
      setMarks([]);
      setPlane('column');
    } catch {
      setMpr({ status: 'error', reason: 'Seri okunamadı.' });
    }
  };

  // Tekerlek: kesit değiştir (Ctrl/⌘ ile yakınlaştırma usePinchZoom'da).
  useEffect(() => {
    const el = areaRef.current;
    if (!el || sliceCount <= 1) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      step(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [sliceCount, step]);

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

  const natural = view ? { w: view.frame.width, h: view.frame.height } : null;
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
    () =>
      current?.meta.photo
        ? 'Fotoğraf / taranmış görüntü'
        : [current?.meta.modality, current?.meta.seriesDescription, view && 'plane' in view ? `${PLANE_LABEL[view.plane]} (yeniden yapılandırma)` : ''].filter(Boolean).join(' · '),
    [current, view],
  );

  const measureCtx: MeasureContext = {
    spacing: view?.meta.pixelSpacing,
    gray: view?.frame.kind === 'gray' ? view.frame : undefined,
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
        else if (e.key === 'Home') setSlice(() => 0);
        else if (e.key === 'End') setSlice(() => sliceCount - 1);
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
        {current && onSaveMeasurement && !mprPlane && (
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
        {multiFile && current && !current.meta.photo && (
          <ToolbarGroup>
            {volume ? (
              <select className="h-8 rounded-md bg-transparent px-1.5 text-xs text-fg-muted hover:text-fg" value={plane} onChange={(e) => setPlane(e.target.value as typeof plane)} aria-label="Düzlem" data-testid="mpr-plane">
                <option value="acq">{PLANE_LABEL[volume.geometry.acquired]} (çekim)</option>
                <option value="column">{PLANE_LABEL[volume.geometry.byColumn]} (MPR)</option>
                <option value="row">{PLANE_LABEL[volume.geometry.byRow]} (MPR)</option>
              </select>
            ) : (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                disabled={mpr?.status === 'loading'}
                onClick={() => void startMpr()}
                title="Düzenli aralıklı seriden diğer düzlemleri (sagital / koronal / eksenel) yeniden yapılandır"
              >
                {mpr?.status === 'loading' ? `Hacim hazırlanıyor ${mpr.done}/${mpr.total}` : 'Diğer düzlemler (MPR)'}
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

      {mpr?.status === 'error' && (
        <p className="border-b border-ink-700 bg-ink-900/80 px-3 py-1.5 text-xs text-fg-muted" role="status" data-testid="mpr-unavailable">
          Diğer düzlemler bu seride yapılamıyor: {mpr.reason}
        </p>
      )}
      {mprPlane && (
        <p className="border-b border-ink-700 bg-ink-900/80 px-3 py-1.5 text-xs text-caution-fg" role="note">
          Yeniden yapılandırılmış görüntü: kesitler arası değerler enterpolasyonla doldurulur; ölçüm ve tanı için çekim düzlemini kullan.
        </p>
      )}
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
              aria-label={`${title || 'Görüntü'} — kesit ${slicePos + 1} / ${sliceCount}`}
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
            {!mprPlane && <MarksOverlay
              marks={marks}
              natural={natural}
              scale={scale}
              rotation={rotation}
              ctx={measureCtx}
              tool={tool === 'ruler' || tool === 'roi' ? tool : null}
              slice={pos}
              onAdd={(m) => setMarks((list) => [...list, m])}
            />}
          </div>
        )}
        {current && (
          <>
            <p className="pointer-events-none absolute left-3 top-2 max-w-[70%] truncate font-mono text-[11px] text-white/80 drop-shadow">{title}</p>
            <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-white/80 drop-shadow">
              {sliceCount > 1 ? `Kesit ${slicePos + 1} / ${sliceCount}` : photo ? '' : 'Tek kesit'}
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

      {onSaveMeasurement && !mprPlane && (
        <SaveMeasurePanel
          marks={marks}
          ctx={measureCtx}
          onSave={onSaveMeasurement}
          onClear={() => setMarks([])}
          sliceLabel={(sl) => (count > 1 ? `Kesit ${sl + 1}` : 'Görüntü')}
        />
      )}

      {sliceCount > 1 && (
        <div className="flex items-center gap-3 border-t border-ink-700 bg-ink-900/80 px-3 py-2">
          <span className="text-xs tabular-nums text-fg-muted">{slicePos + 1}</span>
          <input type="range" min={0} max={sliceCount - 1} value={slicePos} onChange={(e) => setSlice(() => Number(e.target.value))} className="flex-1 accent-accent" aria-label="Kesit" />
          <span className="text-xs tabular-nums text-fg-muted">{sliceCount}</span>
        </div>
      )}
    </div>
  );
}
