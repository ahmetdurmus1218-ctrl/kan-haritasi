import { useEffect, useRef, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { BodyIcon, BrainIcon, FileTextIcon, SparkIcon } from './icons';

/** Holografik insan figürü (vektör, prosedürel): platform halkaları üzerinde ışıyan siluet. */
function Hologram() {
  return (
    <div className="splash-holo" aria-hidden="true">
      <svg viewBox="0 0 120 230" className="splash-holo-fig">
        <defs>
          <linearGradient id="kh-holo-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9ff3ff" stopOpacity=".95" />
            <stop offset="1" stopColor="#1e8fff" stopOpacity=".55" />
          </linearGradient>
        </defs>
        <g fill="url(#kh-holo-g)" fillOpacity=".28" stroke="#7fe8ff" strokeWidth="1.4" strokeLinejoin="round">
          <ellipse cx="60" cy="20" rx="12" ry="15" />
          <path d="M53 34h14l1 7c10 2 19 5 22 12l5 40c1 9 2 22 6 36 1 4-3 5-5 2-6-13-9-25-11-36l-4-24-2 30c-1 9 1 16 1 24l-3 48c-1 10-1 20 0 28 1 4-6 4-8 1l-5-46-3-30h-2l-3 30-5 46c-2 3-9 3-8-1 1-8 1-18 0-28l-3-48c0-8 2-15 1-24l-2-30-4 24c-2 11-5 23-11 36-2 3-6 2-5-2 4-14 5-27 6-36l5-40c3-7 12-10 22-12Z" />
        </g>
        <g stroke="#bff6ff" strokeOpacity=".5" strokeWidth=".7" fill="none">
          <path d="M60 41v70M47 58c8 4 18 4 26 0M46 72c9 4 19 4 28 0M49 86c7 3 15 3 22 0" />
          <path d="M52 112l-4 50M68 112l4 50" />
        </g>
      </svg>
      <div className="splash-holo-rings">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

const FEATURES = [
  { label: 'Anatomi', Icon: BodyIcon },
  { label: 'Analiz', Icon: SparkIcon },
  { label: 'Rapor', Icon: FileTextIcon },
  { label: 'Serüven', Icon: BrainIcon },
];

/**
 * Açılış ekranı (resmî görsel kimlik): koyu lacivert zemin, dönen mavi DNA sarmalları, bilimsel ışık
 * parçacıkları, ortada kan damlası logosu, "Kan Haritası" başlığı ve neon turkuaz yükleme çubuğu.
 * Görseller prosedüreldir (tuval üzerinde çizilir; görüntü dosyası ve ağ isteği yok).
 *
 * Çubuk uygulamanın gerçekten hazırlanmasına bağlıdır: `ready` gelene kadar %90'da bekler. Ekran
 * dokunmaları engellemez (pointer-events: none) ve dokununca hemen kapanır. Hareket azaltma tercihinde
 * animasyon yoktur ve kısa gösterilir. Oturum başına bir kez.
 */

const SEEN = 'kh-splash-seen';
const MIN_MS = 2200;

interface Helix {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  amp: number;
  turns: number;
  width: number;
}

function draw(g: CanvasRenderingContext2D, W: number, H: number, t: number, helices: Helix[], dust: { x: number; y: number; r: number; a: number; v: number }[]) {
  g.clearRect(0, 0, W, H);
  for (const p of dust) {
    const y = (((p.y - t * p.v * 0.02) % H) + H) % H;
    const tw = 0.65 + 0.35 * Math.sin(t * 0.002 + p.x);
    const grd = g.createRadialGradient(p.x, y, 0, p.x, y, p.r * 4);
    grd.addColorStop(0, `rgba(170,230,255,${p.a * tw})`);
    grd.addColorStop(1, 'rgba(60,140,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(p.x, y, p.r * 4, 0, 7);
    g.fill();
  }
  const spin = t * 0.0012;
  for (const h of helices) {
    const L = Math.hypot(h.x1 - h.x0, h.y1 - h.y0);
    const ux = (h.x1 - h.x0) / L, uy = (h.y1 - h.y0) / L, nx = -uy, ny = ux;
    const N = 160;
    const pt = (s: number, ph: number): [number, number, number] => {
      const a = s * h.turns * Math.PI * 2 + ph + spin;
      const w = Math.sin(a);
      return [h.x0 + ux * L * s + nx * h.amp * w, h.y0 + uy * L * s + ny * h.amp * w, Math.cos(a)];
    };
    for (let i = 0; i <= N; i += 4) {
      const a = pt(i / N, 0), b = pt(i / N, Math.PI);
      g.strokeStyle = `rgba(90,170,255,${0.16 + 0.24 * Math.abs(a[2])})`;
      g.lineWidth = h.width * 0.35;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
    for (const ph of [0, Math.PI]) {
      for (let i = 0; i < N; i++) {
        const a = pt(i / N, ph), b = pt((i + 1) / N, ph), depth = 0.5 + 0.5 * a[2];
        g.strokeStyle = `rgba(${80 + 120 * depth | 0},${180 + 60 * depth | 0},255,${0.35 + 0.6 * depth})`;
        g.lineWidth = h.width * (0.6 + 0.8 * depth);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
        if (i % 7 === 0) {
          g.fillStyle = `rgba(200,240,255,${0.5 + 0.5 * depth})`;
          g.beginPath();
          g.arc(a[0], a[1], h.width * (0.7 + depth), 0, 7);
          g.fill();
        }
      }
    }
  }
}

function layout(W: number, H: number): Helix[] {
  const k = Math.min(W, H) / 800;
  return [
    { x0: -0.05 * W, y0: 0.3 * H, x1: 0.24 * W, y1: -0.05 * H, amp: 46 * k, turns: 3.2, width: 3 * k + 0.6 },
    { x0: 0.78 * W, y0: 1.05 * H, x1: 1.05 * W, y1: 0.47 * H, amp: 52 * k, turns: 3.4, width: 3.2 * k + 0.6 },
    { x0: 0.87 * W, y0: 0.15 * H, x1: 1.02 * W, y1: -0.03 * H, amp: 24 * k, turns: 1.6, width: 2 * k + 0.5 },
  ];
}

export function Splash({ ready }: { ready: boolean }) {
  const [show, setShow] = useState(() => {
    try {
      return globalThis.sessionStorage?.getItem(SEEN) !== '1';
    } catch {
      return true;
    }
  });
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = useRef(performance.now());
  const readyRef = useRef(ready);
  readyRef.current = ready;

  // Yükleme çubuğu: zamana ve gerçek hazır olmaya bağlı
  useEffect(() => {
    if (!show) return;
    const min = reduced ? 600 : MIN_MS;
    let raf = 0;
    const tick = () => {
      const el = performance.now() - start.current;
      const timeP = Math.min(1, el / min);
      const p = readyRef.current ? timeP : Math.min(0.9, timeP);
      setProgress(p);
      if (p >= 1) {
        setLeaving(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show, reduced]);

  useEffect(() => {
    if (!leaving) return;
    try {
      globalThis.sessionStorage?.setItem(SEEN, '1');
    } catch {
      /* yalnız bu oturum */
    }
    const id = setTimeout(() => setShow(false), reduced ? 0 : 450);
    return () => clearTimeout(id);
  }, [leaving, reduced]);

  // Dokununca kapat
  useEffect(() => {
    if (!show) return;
    const close = () => setLeaving(true);
    window.addEventListener('pointerdown', close, { once: true });
    window.addEventListener('keydown', close, { once: true });
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [show]);

  // DNA + parçacık animasyonu
  useEffect(() => {
    const c = canvas.current;
    if (!show || !c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth, H = c.clientHeight;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const dust = Array.from({ length: Math.round((W * H) / 6500) }, () => ({ x: r() * W, y: r() * H, r: r() < 0.12 ? 2 + r() * 4 : 0.6 + r() * 1.4, a: 0.25 + r() * 0.7, v: 0.3 + r() }));
    const helices = layout(W, H);
    if (reduced) {
      draw(g, W, H, 0, helices, dust);
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      draw(g, W, H, t, helices, dust);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [show, reduced]);

  if (!show) return null;
  const pct = Math.round(progress * 100);
  return (
    <div className={`splash ${leaving ? 'splash-leave' : ''}`} data-testid="splash" role="status" aria-live="polite" aria-label={`Kan Haritası yükleniyor, yüzde ${pct}`}>
      <canvas ref={canvas} className="splash-fx" aria-hidden="true" />
      <div className="splash-content">
        <BrandLogo size={128} glow className="splash-logo" />
        <h1 className="splash-title">Kan Haritası</h1>
        <p className="splash-sub">Kişisel Dijital Vücut ve Sağlık Analiz Platformu</p>
        <Hologram />
        <p className="splash-status">Sistem yükleniyor… %{pct}</p>
        <div className="splash-bar" aria-hidden="true">
          <i style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
        <ul className="splash-features" aria-hidden="true">
          {FEATURES.map(({ label, Icon }) => (
            <li key={label}>
              <span>
                <Icon size={24} />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
