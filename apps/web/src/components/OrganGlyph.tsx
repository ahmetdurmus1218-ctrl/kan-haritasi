import { useId } from 'react';

/**
 * Organ kartlarının küçük simgeleri (vektör, renkli). Şematik simgedir; anatomik model değildir —
 * modelin kendisi ana ekranın ortasındaki 3B vücuttadır.
 */
/** n: ilk kaç yol dolgulu (kalanlar çizgi). */
type Shape = { d: string[]; c0: string; c1: string; n?: number };

const SHAPES: Record<string, Shape> = {
  liver: { d: ['M3 9.5C5 6 11 5 17 5.5c2.6.2 4.3 1.6 3.8 3.6-.8 3.3-5.6 6.6-10.4 8.7-2.1.9-3.9-.1-4.6-1.9C5 13.5 2.4 12 3 9.5Z', 'M12 6l-.6 11'], c0: '#e0704f', c1: '#9c2f25' },
  kidneys: {
    d: ['M6.5 4C3.6 4 2.5 7.8 3 11.3c.5 3.5 2.6 6.4 5 5.8 1.8-.5 1.5-2.6.8-3.8-.7-1.2-.6-2.8.2-3.9.9-1.3 1.1-3.2.2-4.4C8.8 4.3 7.7 4 6.5 4Z', 'M17.5 4c2.9 0 4 3.8 3.5 7.3-.5 3.5-2.6 6.4-5 5.8-1.8-.5-1.5-2.6-.8-3.8.7-1.2.6-2.8-.2-3.9-.9-1.3-1.1-3.2-.2-4.4.4-.7 1.5-1 2.7-1Z', 'M9 11.5c1 .5 1.6 2.6 1.8 9M15 11.5c-1 .5-1.6 2.6-1.8 9'],
    c0: '#e0707a',
    c1: '#8e2a44',
    n: 2,
  },
  heart: { d: ['M12 20.5C6 16.6 3 13.2 3 9.4 3 6.6 5.1 4.5 7.6 4.5c1.8 0 3.3 1 4.4 2.6 1.1-1.6 2.6-2.6 4.4-2.6 2.5 0 4.6 2.1 4.6 4.9 0 3.8-3 7.2-9 11.1Z', 'M9 4.8V2.5M13.5 6V2.5'], c0: '#f0505c', c1: '#9b1830' },
  lungs: { d: ['M11 4v6.5c-1.2-1-2.5-2.2-4.3-2.2C4.4 8.3 3 11.6 3 15.2c0 2.8 1.2 4.8 3.4 4.8 2.6 0 4.6-2.2 4.6-5.4V10.5', 'M13 4v6.5c1.2-1 2.5-2.2 4.3-2.2 2.3 0 3.7 3.3 3.7 6.9 0 2.8-1.2 4.8-3.4 4.8-2.6 0-4.6-2.2-4.6-5.4V10.5'], c0: '#ff9aa8', c1: '#b8445a', n: 2 },
  brain: { d: ['M12 5.2C10.9 3.9 8.4 3.7 7.2 5.3 5 5 3.4 7 4 9c-1.5 1-1.6 3.6 0 4.6-.4 2.3 1.4 4.2 3.6 3.8.8 1.6 3.3 2 4.4.6 1.1 1.4 3.6 1 4.4-.6 2.2.4 4-1.5 3.6-3.8 1.6-1 1.5-3.6 0-4.6.6-2-1-4-3.2-3.7C15.6 3.7 13.1 3.9 12 5.2Z', 'M12 5.5v12.6M8 9c1 .8 1.5 2 1.2 3.4M16 9c-1 .8-1.5 2-1.2 3.4'], c0: '#f2a9c0', c1: '#a8577a' },
  stomach: { d: ['M9 3v4.5c0 2-3 2.6-3.8 5.4C4.3 16 6.4 20 11 20c4.4 0 8-2.6 8-6.6 0-3-2.4-4.4-4.6-3.8-1.8.5-2.7 2.2-4.4 1.4C8.8 10.2 12 8 12 3'], c0: '#f0a07a', c1: '#a8503a' },
  intestine: { d: ['M4 6.5C4 4.6 6 4 12 4s8 .6 8 2.5S18 9 12 9s-6 1-6 2.5S8 14 12 14s6 1 6 2.5-2 2.5-6 2.5-6-.5-6-2'], c0: '#f2a389', c1: '#a85a4a', n: 0 },
  thyroid: { d: ['M7 6c-2.3 0-3.5 2.6-3 6 .4 2.7 1.8 4.5 3.6 4.5 1.4 0 2.2-1 2.6-2.2h3.6c.4 1.2 1.2 2.2 2.6 2.2 1.8 0 3.2-1.8 3.6-4.5.5-3.4-.7-6-3-6-2 0-2.5 2.6-3 4.6h-4C9.5 8.6 9 6 7 6Z'], c0: '#c88bd0', c1: '#6c3a80' },
  pancreas: { d: ['M3 14c2-3 5.5-4 9-4.5 3-.4 5.8-1.6 7.4-3.5.9 1.3 1.6 3-.2 4.8-2 2-5.6 2.4-8.6 3.6-2.6 1-4.3 2.6-6.4 2.4C3 16.6 2.4 15 3 14Z'], c0: '#f2c27a', c1: '#a8703a' },
  spleen: { d: ['M6 6c4-3 11-2.5 13 1.5 1.7 3.4-1.2 8.3-5.6 10.4C9.3 20 5 18.3 4.2 14.6 3.6 11.4 3.8 7.7 6 6Z'], c0: '#b05a7a', c1: '#5c2440' },
  bones: { d: ['M7.5 4.5a2 2 0 1 0-2.8 2.8l-.2.2a2 2 0 1 0 2.8 2.8l8.4 8.4a2 2 0 1 0 2.8 2.8l.2-.2a2 2 0 1 0-2.8-2.8L7.3 10.1'], c0: '#f0ead8', c1: '#9a9280' },
  eyes: { d: ['M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'], c0: '#8fd0ff', c1: '#2a6aa8' },
  blood: { d: ['M12 3c-3 4.3-6 7.6-6 11a6 6 0 0 0 12 0c0-3.4-3-6.7-6-11Z'], c0: '#ff5a6a', c1: '#9b1830' },
};

const ALIAS: Record<string, string> = {
  kidney: 'kidneys',
  lung: 'lungs',
  'small-intestine': 'intestine',
  'large-intestine': 'intestine',
  colon: 'intestine',
  bone: 'bones',
  'bone-marrow': 'bones',
  marrow: 'bones',
  eye: 'eyes',
  'adrenal-glands': 'kidneys',
  gallbladder: 'liver',
  'bile-ducts': 'liver',
  'blood-vessels': 'blood',
  aorta: 'heart',
  'coronary-arteries': 'heart',
  pituitary: 'brain',
  hypothalamus: 'brain',
};

export function organShape(id: string): string {
  if (SHAPES[id]) return id;
  if (ALIAS[id]) return ALIAS[id]!;
  const head = id.split(/[.:]/)[0]!;
  return SHAPES[head] ? head : ALIAS[head] ?? 'blood';
}

export function OrganGlyph({ id, size = 40, className = '' }: { id: string; size?: number; className?: string }) {
  const s = SHAPES[organShape(id)]!;
  const gid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={s.c0} />
          <stop offset="1" stopColor={s.c1} />
        </linearGradient>
      </defs>
      {s.d.map((d, i) => (
        <path key={i} d={d} fill={i < (s.n ?? 1) ? `url(#${gid})` : 'none'} stroke={i < (s.n ?? 1) ? 'rgba(255,255,255,.35)' : s.n === 0 ? `url(#${gid})` : 'rgba(255,240,240,.75)'} strokeWidth={i < (s.n ?? 1) ? 0.6 : s.n === 0 ? 2.8 : 1.1} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
