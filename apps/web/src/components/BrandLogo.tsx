import { useId } from 'react';

/**
 * Kan Haritası logosu: üstü atardamar kırmızısı, altı toplardamar mavisi kan damlası ve nabız çizgisi
 * (resmî görsel kimlik). Vektör; her boyutta keskin, ağ isteği yok.
 */
export function BrandLogo({ size = 32, glow = false, className = '' }: { size?: number; glow?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size * (100 / 116)}
      height={size}
      viewBox="0 0 100 116"
      className={`${glow ? 'brand-glow' : ''} ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff3b4a" />
          <stop offset=".48" stopColor="#d0263c" />
          <stop offset=".52" stopColor="#2a5fe0" />
          <stop offset="1" stopColor="#1638a8" />
        </linearGradient>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb0b8" />
          <stop offset="1" stopColor="#9cc4ff" />
        </linearGradient>
      </defs>
      <path d="M50 4 C38 26 12 52 12 74 a38 38 0 0 0 76 0 C88 52 62 26 50 4z" fill={`url(#${id}f)`} stroke={`url(#${id}e)`} strokeWidth="2.5" />
      <path d="M50 4 C44 16 36 26 30 36" stroke="rgba(255,255,255,.35)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M20 78 H38 L44 66 L52 92 L58 72 L63 78 H80" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
