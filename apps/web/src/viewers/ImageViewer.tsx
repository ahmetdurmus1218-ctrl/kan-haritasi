import { useEffect, useRef, useState } from 'react';
import type { SourceBox } from '@kh/parser';
import { DownloadIcon, MaximizeIcon, RotateCcwIcon, RotateCwIcon, SpinnerIcon, ZoomInIcon, ZoomOutIcon } from '../components/icons';
import { Banner, ToolbarGroup } from '../components/ui';
import { clampZoom, useElementWidth, useFullscreen, usePinchZoom } from './hooks';

/**
 * Çözülmüş görseli yalnızca bu bileşenin ömrü boyunca bir blob: URL'si olarak gösterir;
 * bileşen kapanınca URL bırakılır. Boyut zaten yüklemede başlıktan doğrulandı.
 */
export function ImageViewer({
  bytes,
  mimeType,
  onDownload,
  highlight = null,
}: {
  bytes: Uint8Array<ArrayBuffer>;
  mimeType: string;
  onDownload: () => void;
  highlight?: SourceBox | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [failed, setFailed] = useState(false);

  const toggleFullscreen = useFullscreen(rootRef);
  useElementWidth(areaRef, (w, h) => setBox({ w, h }));
  usePinchZoom(areaRef, (f) => setZoom((z) => clampZoom(z * f)));

  useEffect(() => {
    const u = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes, mimeType]);

  const quarter = ((rotation % 360) + 360) % 360;
  const sideways = quarter === 90 || quarter === 270;
  const rw = natural ? (sideways ? natural.h : natural.w) : 0;
  const rh = natural ? (sideways ? natural.w : natural.h) : 0;
  const pad = 24;
  const fit = natural && box.w ? Math.min((box.w - pad) / rw, (box.h - pad) / rh, 1) : 0;
  const scale = fit * zoom;

  if (failed) return <div className="p-6"><Banner tone="error">Görsel gösterilemedi. Dosya bozuk olabilir.</Banner></div>;

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-ink-950">
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
        <ToolbarGroup>
          <button type="button" className="icon-btn" onClick={() => setRotation((r) => r - 90)} aria-label="Sola döndür">
            <RotateCcwIcon />
          </button>
          <button type="button" className="icon-btn" onClick={() => setRotation((r) => r + 90)} aria-label="Sağa döndür">
            <RotateCwIcon />
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

      <div ref={areaRef} className="relative min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto">
        {!url || !natural ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-fg-muted">
            <SpinnerIcon size={16} /> Görsel çözülüyor…
          </div>
        ) : null}
        {url && (
          <div className="relative mx-auto" style={{ width: Math.max(box.w, rw * scale + pad), height: Math.max(box.h, rh * scale + pad) }}>
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: natural ? natural.w * scale : undefined,
                height: natural ? natural.h * scale : undefined,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                visibility: natural ? 'visible' : 'hidden',
                transition: 'transform 180ms ease',
              }}
            >
              <img
                src={url}
                alt="Yüklenen rapor görseli"
                draggable={false}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onError={() => setFailed(true)}
                className="h-full w-full max-w-none select-none rounded-sm shadow-xl shadow-black/40"
              />
              {highlight && natural && (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-accent bg-accent/15"
                  style={{
                    left: (highlight.x * natural.w) / (highlight.pageW ?? natural.w) * scale - 3,
                    top: (highlight.y * natural.h) / (highlight.pageH ?? natural.h) * scale - 3,
                    width: (highlight.w * natural.w) / (highlight.pageW ?? natural.w) * scale + 6,
                    height: (highlight.h * natural.h) / (highlight.pageH ?? natural.h) * scale + 6,
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
