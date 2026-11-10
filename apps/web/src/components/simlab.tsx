/**
 * Simülasyon laboratuvarının çizim parçaları: zaman serisi grafiği (tuval), statik bağıntı eğrisi (SVG) ve
 * oynatıcı. Model çözümü deterministik olarak önceden hesaplanır; oynatıcı yalnızca zaman imlecini ilerletir.
 */
import { useEffect, useRef, useState } from 'react';
import { type Curve, type Sample, type SeriesColor, type SeriesDef, type TimeUnit, sampleAt } from '@kh/physio';

export const SIM_COLOR: Record<SeriesColor, string> = { a: '--sim-a', b: '--sim-b', c: '--sim-c', d: '--sim-d' };

export const fmt = (v: number, decimals: number): string => (Number.isFinite(v) ? v.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—');

export function timeLabel(t: number, unit: TimeUnit): string {
  const d = unit === 'ms' || unit === 'sn' ? (t < 10 ? 2 : 1) : unit === 'saat' || unit === 'gün' ? (t < 10 ? 1 : 0) : 0;
  return `${fmt(t, d)} ${unit}`;
}

const cssVar = (el: Element, name: string): string => getComputedStyle(el).getPropertyValue(name).trim() || '#888';

export interface PlayerState {
  t: number;
  playing: boolean;
  speed: number;
  setT(t: number): void;
  setPlaying(p: boolean): void;
  setSpeed(s: number): void;
  reset(): void;
}

/** Zaman imleci: model zamanında ilerler; döngüsel modellerde başa sarar, diğerlerinde sonda durur. */
export function usePlayer(duration: number, pace: number, loop: boolean, resetKey: string): PlayerState {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Model ya da parametre değişince imleç başa döner (oynatma sürer).
  useEffect(() => setT(0), [resetKey]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((prev) => {
        const next = prev + dt * pace * speed;
        return next >= duration ? (loop ? next % duration : duration) : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, pace, speed, duration, loop]);
  useEffect(() => {
    if (!loop && playing && t >= duration) setPlaying(false);
  }, [t, duration, loop, playing]);
  return { t, playing, speed, setT, setPlaying, setSpeed, reset: () => (setPlaying(false), setT(0)) };
}

/** Görünen zaman penceresi: yakınlaştırma katsayısına göre imlecin çevresi. */
export function viewWindow(duration: number, t: number, zoom: number): [number, number] {
  if (zoom <= 1) return [0, duration];
  const w = duration / zoom;
  const x0 = Math.min(duration - w, Math.max(0, t - w / 2));
  return [x0, x0 + w];
}

function niceRange(lo: number, hi: number): [number, number] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (hi - lo < 1e-9) {
    const pad = Math.abs(hi) > 1e-9 ? Math.abs(hi) * 0.1 : 1;
    return [lo - pad, hi + pad];
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

/**
 * Bir panelin zaman serileri. `baseline` verilirse normal çalışma kesikli çizgiyle üst üste gösterilir.
 * `revealTo`: yalnızca bu ana kadarki çözüm çizilir (süreç canlı ilerliyormuş gibi); kalanı soluk.
 */
export function SimChart({ title, series, samples, baseline, t, window: win, unit, annotate, phase }: { title: string; series: SeriesDef[]; samples: Sample[]; baseline?: Sample[]; t: number; window: [number, number]; unit: TimeUnit; annotate: boolean; phase?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const height = 170;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width < 40) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    const [x0, x1] = win;
    const inWin = (s: Sample) => s.t >= x0 && s.t <= x1;
    let lo = Infinity;
    let hi = -Infinity;
    for (const set of baseline ? [samples, baseline] : [samples])
      for (const s of set) {
        if (!inWin(s)) continue;
        for (const d of series) {
          const v = s.v[d.key];
          if (v === undefined) continue;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    const [y0, y1] = niceRange(lo, hi);
    const L = 44;
    const R = 8;
    const T = 10;
    const B = 22;
    const px = (x: number) => L + ((x - x0) / (x1 - x0)) * (width - L - R);
    const py = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (height - T - B);
    const muted = cssVar(canvas, '--color-fg-faint');
    const grid = cssVar(canvas, '--color-ink-600');
    g.font = '10.5px "Inter Variable", system-ui, sans-serif';
    g.lineWidth = 1;
    g.strokeStyle = grid;
    g.fillStyle = muted;
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    const span = y1 - y0;
    const dec = span >= 20 ? 0 : span >= 2 ? 1 : span >= 0.2 ? 2 : 3;
    for (let k = 0; k <= 4; k++) {
      const y = y0 + (span * k) / 4;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.moveTo(L, py(y));
      g.lineTo(width - R, py(y));
      g.stroke();
      g.globalAlpha = 1;
      g.fillText(fmt(y, dec), L - 6, py(y));
    }
    g.textBaseline = 'alphabetic';
    for (let k = 0; k <= 4; k++) {
      const x = x0 + ((x1 - x0) * k) / 4;
      g.textAlign = k === 0 ? 'left' : k === 4 ? 'right' : 'center';
      g.fillText(timeLabel(x, unit), px(x), height - 6);
    }
    const draw = (set: Sample[], d: SeriesDef, dashed: boolean, until: number, alpha: number) => {
      g.beginPath();
      let started = false;
      for (const s of set) {
        if (s.t < x0 || s.t > Math.min(x1, until)) continue;
        const v = s.v[d.key];
        if (v === undefined) continue;
        if (started) g.lineTo(px(s.t), py(v));
        else {
          g.moveTo(px(s.t), py(v));
          started = true;
        }
      }
      g.strokeStyle = cssVar(canvas, SIM_COLOR[d.color]);
      g.globalAlpha = alpha;
      g.lineWidth = dashed ? 1.25 : 2;
      g.setLineDash(dashed ? [5, 4] : []);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    };
    for (const d of series) {
      if (baseline) draw(baseline, d, true, Infinity, 0.6);
      draw(samples, d, false, Infinity, 0.22);
      draw(samples, d, false, t, 1);
    }
    // Zaman imleci ve o andaki değer noktaları.
    if (t >= x0 && t <= x1) {
      g.strokeStyle = cssVar(canvas, '--color-fg-muted');
      g.globalAlpha = 0.7;
      g.beginPath();
      g.moveTo(px(t), T);
      g.lineTo(px(t), height - B);
      g.stroke();
      g.globalAlpha = 1;
      const now = sampleAt(samples, t);
      if (now)
        for (const d of series) {
          const v = now.v[d.key];
          if (v === undefined) continue;
          g.fillStyle = cssVar(canvas, SIM_COLOR[d.color]);
          g.beginPath();
          g.arc(px(now.t), py(v), 3.5, 0, Math.PI * 2);
          g.fill();
        }
      if (annotate && phase) {
        g.fillStyle = cssVar(canvas, '--color-fg-muted');
        g.textAlign = px(t) > width * 0.6 ? 'right' : 'left';
        g.fillText(phase, px(t) + (px(t) > width * 0.6 ? -6 : 6), T + 10);
      }
    }
  }, [series, samples, baseline, t, win, width, unit, annotate, phase]);
  const now = sampleAt(samples, t);
  return (
    <figure className="card overflow-hidden p-3" data-testid="sim-chart">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-medium text-fg">{title}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-fg-muted">
          {series.map((d) => (
            <span key={d.key} className="inline-flex items-center gap-1.5 tabular-nums" data-testid={`sim-now-${d.key}`}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: `var(${SIM_COLOR[d.color]})` }} />
              {d.label}: <b className="font-semibold text-fg">{fmt(now?.v[d.key] ?? NaN, d.decimals)}</b> {d.unit}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="w-full">
        <canvas ref={ref} style={{ width: '100%', height }} role="img" aria-label={`${title}: ${series.map((d) => d.label).join(', ')} zaman grafiği`} />
      </div>
      {baseline && <p className="mt-1 text-[11px] text-fg-faint">Kesikli çizgi: normal çalışma (tipik parametreler) · düz çizgi: seçili senaryo</p>}
    </figure>
  );
}

export interface UserMarker {
  curve: string;
  x: number;
  y: number;
  label: string;
}

/** Statik bağıntı eğrisi (ör. oksijen-hemoglobin eğrisi, basınç-hacim halkası) + modelin ve kişinin ölçülen noktası. */
export function CurvePlot({ curve, markers }: { curve: Curve; markers: UserMarker[] }) {
  const W = 320;
  const H = 200;
  const L = 40;
  const R = 10;
  const T = 10;
  const B = 30;
  const mine = markers.filter((m) => m.curve === curve.id);
  const pts = [...curve.lines.flatMap((l) => l.points), ...(curve.marker ? [curve.marker] : []), ...mine];
  if (!pts.length) return null;
  const [x0, x1] = [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))];
  const [y0, y1] = niceRange(Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)));
  const sx = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  const colors: SeriesColor[] = ['a', 'b', 'c', 'd'];
  const dec = (span: number) => (span >= 20 ? 0 : span >= 2 ? 1 : 2);
  return (
    <figure className="card p-3" data-testid="sim-curve" data-curve={curve.id}>
      <figcaption className="mb-1 text-[13px] font-medium text-fg">{curve.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${curve.title}: ${curve.xLabel} – ${curve.yLabel}`}>
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={sy(y0 + (y1 - y0) * k)} y2={sy(y0 + (y1 - y0) * k)} stroke="var(--color-ink-600)" strokeWidth={0.6} />
            <text x={L - 5} y={sy(y0 + (y1 - y0) * k) + 3} textAnchor="end" fontSize={9} fill="var(--color-fg-faint)">
              {fmt(y0 + (y1 - y0) * k, dec(y1 - y0))}
            </text>
            <text x={sx(x0 + (x1 - x0) * k)} y={H - B + 12} textAnchor={k === 0 ? 'start' : k === 1 ? 'end' : 'middle'} fontSize={9} fill="var(--color-fg-faint)">
              {fmt(x0 + (x1 - x0) * k, dec(x1 - x0))}
            </text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={9.5} fill="var(--color-fg-muted)">
          {curve.xLabel}
        </text>
        <text x={10} y={(T + H - B) / 2} textAnchor="middle" fontSize={9.5} fill="var(--color-fg-muted)" transform={`rotate(-90 10 ${(T + H - B) / 2})`}>
          {curve.yLabel}
        </text>
        {curve.lines.map((l, i) => {
          const solid = curve.lines.filter((x) => !x.dashed);
          const color = l.dashed ? 'var(--color-fg-faint)' : `var(${SIM_COLOR[colors[solid.indexOf(l) % 4]!]})`;
          return <polyline key={i} fill="none" stroke={color} strokeWidth={l.dashed ? 1 : 1.8} strokeDasharray={l.dashed ? '4 3' : undefined} points={l.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')} />;
        })}
        {curve.marker && <circle cx={sx(curve.marker.x)} cy={sy(curve.marker.y)} r={4.5} fill="var(--sim-a)" stroke="var(--color-ink-850)" strokeWidth={1.5} />}
        {mine.map((m, i) => (
          <path key={i} d={`M ${sx(m.x)} ${sy(m.y) - 6} l 6 6 l -6 6 l -6 -6 z`} fill="var(--sim-b)" stroke="var(--color-ink-850)" strokeWidth={1.5} data-testid="sim-user-marker" />
        ))}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-fg-muted">
        {curve.lines.map((l, i) => (
          <li key={i}>
            {l.dashed ? '┄' : '—'} {l.label}
          </li>
        ))}
        {curve.marker && <li>● {curve.marker.label} (eğitimsel)</li>}
        {mine.map((m, i) => (
          <li key={`m${i}`} className="font-medium text-fg">
            ◆ {m.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
