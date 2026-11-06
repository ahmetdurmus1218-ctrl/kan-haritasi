import type { OrganAttention } from '../lib/summary';
import { organName } from '../lib/summary';

/**
 * Ana ekrandaki 2B vücut şeması: dikkat gerektiren organlar şema üzerinde noktayla, yanlarında adı ve
 * konu sayısıyla işaretlenir. Etikete dokununca organın kısa özeti (alt pencere) açılır. Şemada yeri
 * olmayan organlar şemanın altında aynı biçimde listelenir. Konumlar şematiktir, anatomik ölçü değildir.
 */
const W = 358;
const H = 320;
const S = 0.8889;
const OX = (W - 200 * S) / 2;

/** Organ → şemadaki nokta(lar) (200 × 360 gövde koordinatı). */
const SPOTS: Record<string, Array<[number, number]>> = {
  brain: [[100, 28]],
  pituitary: [[100, 42]],
  thyroid: [[100, 66]],
  lungs: [[80, 108], [120, 108]],
  heart: [[110, 114]],
  aorta: [[100, 124]],
  liver: [[83, 140]],
  gallbladder: [[92, 150]],
  stomach: [[116, 140]],
  spleen: [[130, 144]],
  pancreas: [[110, 154]],
  'adrenal-glands': [[86, 162]],
  kidneys: [[84, 172], [116, 172]],
  'small-intestine': [[100, 192]],
  'large-intestine': [[124, 196]],
  bladder: [[100, 226]],
  uterus: [[100, 220]],
  ovaries: [[86, 214], [114, 214]],
  prostate: [[100, 232]],
  testes: [[100, 248]],
  bones: [[83, 268]],
};

const TONE_CLASS: Record<OrganAttention['tone'], { text: string; chip: string }> = {
  urgent: { text: 'text-danger', chip: 'border-danger/50' },
  attention: { text: 'text-high', chip: 'border-high/45' },
  follow: { text: 'text-caution-fg', chip: 'border-caution/45' },
  uncertain: { text: 'text-caution-fg', chip: 'border-dashed border-caution/45' },
};

/** Şemadaki kısa adlar (etiket alanı dar). */
const SHORT: Record<string, string> = { bones: 'Kemik iliği', thyroid: 'Tiroid', 'small-intestine': 'İnce bağırsak', 'large-intestine': 'Kalın bağırsak', 'adrenal-glands': 'Böbreküstü', gallbladder: 'Safra kesesi' };
const short = (id: string) => SHORT[id] ?? organName(id);

const at = (x: number, y: number) => [OX + x * S, y * S] as const;

interface Placed {
  o: OrganAttention;
  dots: Array<readonly [number, number]>;
  side: 'left' | 'right';
  top: number;
}

function place(organs: OrganAttention[]): { placed: Placed[]; rest: OrganAttention[] } {
  const placed: Placed[] = [];
  const rest: OrganAttention[] = [];
  for (const o of organs) {
    const spots = SPOTS[o.organ];
    if (!spots) {
      rest.push(o);
      continue;
    }
    const dots = spots.map(([x, y]) => at(x, y));
    const side = spots[0]![0] < 100 ? 'left' : spots[0]![0] > 100 ? 'right' : placed.filter((p) => p.side === 'left').length <= placed.filter((p) => p.side === 'right').length ? 'left' : 'right';
    placed.push({ o, dots, side, top: dots[0]![1] - 14 });
  }
  // Aynı taraftaki etiketler üst üste binmesin: y'ye göre sırala, en az 32 px aralık.
  for (const side of ['left', 'right'] as const) {
    const list = placed.filter((p) => p.side === side).sort((a, b) => a.top - b.top);
    let prev = -Infinity;
    for (const p of list) {
      p.top = Math.max(p.top, prev + 32, 0);
      prev = p.top;
    }
    const over = (list[list.length - 1]?.top ?? 0) + 28 - H;
    if (over > 0) for (const p of list) p.top -= over;
  }
  return { placed, rest };
}

export function BodySchema({ organs, counts = {}, onOrgan }: { organs: OrganAttention[]; counts?: Record<string, number>; onOrgan: (id: string) => void }) {
  const { placed, rest } = place(organs);
  const n = (o: OrganAttention) => counts[o.organ] || o.reasons.length;
  const label = (o: OrganAttention) => `${organName(o.organ)}: ${n(o)} sonuç`;
  return (
    <div data-testid="body-schema">
      <div className="relative mx-auto w-full max-w-[358px]" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img" aria-label={organs.length ? `Vücut şeması; ${placed.length} organ işaretli` : 'Vücut şeması'}>
          <g transform={`translate(${OX} 0) scale(${S})`} className="fill-ink-700">
            <ellipse cx="100" cy="34" rx="21" ry="25" />
            <rect x="91" y="54" width="18" height="18" rx="7" />
            <path d="M60 76 Q100 64 140 76 Q150 80 151 96 Q152 150 141 196 Q137 222 132 238 L68 238 Q63 222 59 196 Q48 150 49 96 Q50 80 60 76 Z" />
            <rect x="28" y="82" width="18" height="128" rx="9" transform="rotate(9 37 82)" />
            <rect x="154" y="82" width="18" height="128" rx="9" transform="rotate(-9 163 82)" />
            <rect x="70" y="228" width="27" height="126" rx="13" />
            <rect x="103" y="228" width="27" height="126" rx="13" />
          </g>
          {placed.map((p) => {
            const lx = p.side === 'left' ? W * 0.29 : W * 0.72;
            const ly = p.top + 14;
            const [x0, y0] = p.dots[0]!;
            return (
              <g key={p.o.organ} className={TONE_CLASS[p.o.tone].text}>
                <path d={`M${x0} ${y0} L${(x0 + lx) / 2} ${ly} L${lx} ${ly}`} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" />
                {p.dots.map(([x, y]) => (
                  <g key={`${x}-${y}`} fill="currentColor">
                    <circle cx={x} cy={y} r="11" opacity="0.2" />
                    <circle cx={x} cy={y} r="5.5" />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
        {placed.map((p) => (
          <button
            key={p.o.organ}
            type="button"
            onClick={() => onOrgan(p.o.organ)}
            aria-label={label(p.o)}
            data-testid="schema-organ"
            data-organ={p.o.organ}
            className={`absolute flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border bg-ink-850 px-2.5 text-[12px] font-semibold text-fg shadow-[var(--shadow-card)] transition hover:border-accent ${TONE_CLASS[p.o.tone].chip}`}
            style={{ top: `${(p.top / H) * 100}%`, ...(p.side === 'left' ? { right: '71%' } : { left: '72%' }) }}
          >
            {short(p.o.organ)} <span className={TONE_CLASS[p.o.tone].text}>{n(p.o)}</span>
          </button>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {rest.map((o) => (
            <button key={o.organ} type="button" onClick={() => onOrgan(o.organ)} aria-label={label(o)} data-testid="schema-organ" data-organ={o.organ} className={`inline-flex h-8 items-center gap-1.5 rounded-full border bg-ink-850 px-3 text-[12px] font-semibold text-fg ${TONE_CLASS[o.tone].chip}`}>
              {organName(o.organ)} <span className={TONE_CLASS[o.tone].text}>{n(o)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
