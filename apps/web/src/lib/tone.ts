/**
 * Sınırlı ve tutarlı renk dili: her referans dışı değer "kırmızı" değildir.
 *   normal  → renksiz          takip → hafif sapma (yumuşak sarı)
 *   dikkat  → belirgin sapma   acil  → kritik düzey (yalnızca bu kırmızı)
 */
import type { LabObservation } from '@kh/analysis';

export type Tone = 'normal' | 'follow' | 'attention' | 'urgent';

export function labTone(l: Pick<LabObservation, 'status' | 'severity' | 'critical'>): Tone {
  if (l.critical) return 'urgent';
  if (l.status !== 'high' && l.status !== 'low') return 'normal';
  return l.severity === 'moderate' || l.severity === 'marked' ? 'attention' : 'follow';
}

export const TONE: Record<Tone, { label: string; text: string; chip: string; dot: string }> = {
  normal: { label: 'Aralıkta', text: 'text-fg-muted', chip: 'border-ink-600 text-fg-muted', dot: 'bg-ink-500' },
  follow: { label: 'Takip', text: 'text-caution-fg', chip: 'border-caution/40 bg-caution/[0.06] text-caution-fg', dot: 'bg-caution' },
  attention: { label: 'Dikkat', text: 'text-high', chip: 'border-high/40 bg-high/[0.06] text-high', dot: 'bg-high' },
  urgent: { label: 'Acil değerlendirme', text: 'text-danger', chip: 'border-danger/50 bg-danger/[0.08] text-danger', dot: 'bg-danger' },
};
