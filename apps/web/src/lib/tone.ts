/**
 * Tek renk kaynağı (source of truth). Her durumun metin, kenar, arka plan ve simge sınıfı burada;
 * bir yerde turuncu olan "yüksek" başka yerde kırmızı olmaz.
 *
 * Laboratuvar: önem derecesi (tone) × yön (yüksek/düşük)
 *   normal     → nötr, sakin
 *   follow     → hafif referans dışı: yüksekse sarı/amber, düşükse mavi
 *   attention  → belirgin referans dışı: yüksekse turuncu, düşükse koyu mavi (kalın)
 *   urgent     → kritik düzey: kırmızı (yalnızca bu)
 * Anormal sonuçta yalnızca küçük bir rozet değil; test adı, değer, birim ve ▲/▼ etiketi aynı tonu
 * taşır (`labStyle`). Referans metni daha sakin kalır.
 *
 * Görüntüleme / rapor: abnormal (dikkat), uncertain (belirsiz), normal, not-assessed (değerlendirilemedi),
 * reported (raporda yazan), image-derived (görüntüden, kural tabanlı), report-derived (rapordan).
 */
import type { LabObservation } from '@kh/analysis';

export type Tone = 'normal' | 'follow' | 'attention' | 'urgent' | 'uncertain' | 'not-assessed' | 'reported' | 'image-derived' | 'report-derived';

export interface ToneStyle {
  label: string;
  /** Metin rengi (ad, değer, birim, durum). */
  text: string;
  border: string;
  bg: string;
  /** Kısa simge (erişilebilirlik için metinle birlikte kullanılır). */
  icon: string;
  /** Rozet (kenar + arka plan + metin). */
  chip: string;
  /** Küçük nokta. */
  dot: string;
}

export const TONE: Record<Tone, ToneStyle> = {
  normal: { label: 'Aralıkta', text: 'text-fg', border: 'border-ink-600', bg: '', icon: '•', chip: 'border-ink-600 text-fg-muted', dot: 'bg-ink-500' },
  follow: { label: 'Takip', text: 'text-caution-fg', border: 'border-caution/40', bg: 'bg-caution/[0.06]', icon: '!', chip: 'border-caution/40 bg-caution/[0.06] text-caution-fg', dot: 'bg-caution' },
  attention: { label: 'Dikkat', text: 'text-high', border: 'border-high/45', bg: 'bg-high/[0.07]', icon: '!!', chip: 'border-high/45 bg-high/[0.07] text-high', dot: 'bg-high' },
  urgent: { label: 'Acil değerlendirme', text: 'text-danger', border: 'border-danger/50', bg: 'bg-danger/[0.08]', icon: '!!!', chip: 'border-danger/50 bg-danger/[0.08] text-danger', dot: 'bg-danger' },
  uncertain: { label: 'Belirsiz', text: 'text-caution-fg', border: 'border-dashed border-caution/45', bg: 'bg-caution/[0.04]', icon: '?', chip: 'border-dashed border-caution/45 bg-caution/[0.04] text-caution-fg', dot: 'bg-caution/60' },
  'not-assessed': { label: 'Değerlendirilemedi', text: 'text-fg-muted', border: 'border-dashed border-ink-500', bg: '', icon: '—', chip: 'border-dashed border-ink-500 text-fg-muted', dot: 'bg-ink-600' },
  reported: { label: 'Raporda belirtilmiş', text: 'text-fg', border: 'border-ink-500', bg: 'bg-ink-800/50', icon: '§', chip: 'border-ink-500 bg-ink-800/50 text-fg-muted', dot: 'bg-fg-faint' },
  'image-derived': { label: 'Görüntüden (kural tabanlı)', text: 'text-[#a78bfa]', border: 'border-[#a78bfa]/45', bg: 'bg-[#a78bfa]/10', icon: '◇', chip: 'border-[#a78bfa]/45 bg-[#a78bfa]/10 text-[#a78bfa]', dot: 'bg-[#a78bfa]' },
  'report-derived': { label: 'Rapordan', text: 'text-low', border: 'border-low/40', bg: 'bg-low/10', icon: '§', chip: 'border-low/40 bg-low/10 text-low', dot: 'bg-low' },
};

export function labTone(l: Pick<LabObservation, 'status' | 'severity' | 'critical'>): Tone {
  if (l.critical) return 'urgent';
  if (l.status !== 'high' && l.status !== 'low') return 'normal';
  return l.severity === 'moderate' || l.severity === 'marked' ? 'attention' : 'follow';
}

/** Düşük değerler mavi tonda (hafif / belirgin); kritik düzey yöne bakılmaksızın kırmızı. */
const LOW: Record<'follow' | 'attention', Pick<ToneStyle, 'text' | 'chip' | 'dot' | 'border' | 'bg'>> = {
  follow: { text: 'text-low', chip: 'border-low/40 bg-low/[0.07] text-low', dot: 'bg-low', border: 'border-low/40', bg: 'bg-low/[0.07]' },
  attention: { text: 'text-low font-semibold', chip: 'border-low/60 bg-low/[0.12] text-low font-semibold', dot: 'bg-low', border: 'border-low/60', bg: 'bg-low/[0.12]' },
};

export interface LabStyle extends ToneStyle {
  tone: Tone;
  direction?: 'high' | 'low';
  /** "▲ Yüksek" / "▼ Düşük" / "Aralıkta". */
  statusLabel: string;
  /** Referans metni: her zaman daha sakin. */
  refText: string;
}

/**
 * Bir laboratuvar sonucunun tüm metin öğeleri için ortak stil: test adı, değer, birim ve ▲/▼ durum
 * aynı tonu taşır. Normal sonuç nötr kalır.
 */
export function labStyle(l: Pick<LabObservation, 'status' | 'severity' | 'critical'>): LabStyle {
  const tone = labTone(l);
  const direction = l.status === 'high' || l.status === 'low' ? l.status : undefined;
  const base = TONE[tone];
  const statusLabel = direction === 'high' ? '▲ Yüksek' : direction === 'low' ? '▼ Düşük' : l.status === 'unknown' ? 'Aralık yok' : 'Aralıkta';
  if (direction === 'low' && (tone === 'follow' || tone === 'attention')) return { ...base, ...LOW[tone], tone, direction, statusLabel, refText: 'text-fg-faint' };
  return { ...base, tone, ...(direction ? { direction } : {}), statusLabel, refText: 'text-fg-faint' };
}

/** Rapor cümlesi: "izlenmedi" nötr, şüphe belirsiz, değerlendirilemedi ayrı; kesin tanı anlamı taşımaz. */
export function reportTone(f: { status: 'abnormal' | 'uncertain' | 'normal' | 'not-assessed'; negated: boolean }): Tone {
  if (f.negated) return 'normal';
  if (f.status === 'abnormal') return 'attention';
  if (f.status === 'uncertain') return 'uncertain';
  if (f.status === 'not-assessed') return 'not-assessed';
  return 'normal';
}

export const TONE_RANK: Record<Tone, number> = { normal: 0, 'not-assessed': 0, reported: 1, 'report-derived': 1, 'image-derived': 1, uncertain: 1, follow: 2, attention: 3, urgent: 4 };
