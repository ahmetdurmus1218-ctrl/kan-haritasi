import type { ResultStatus } from '@kh/catalog';
import { STATUS_LABEL, formatNumber } from '@kh/catalog';
import type { IssueCode } from '@kh/parser';

const PILL: Record<ResultStatus, string> = {
  high: 'border-high/35 bg-high/12 text-high',
  low: 'border-low/35 bg-low/12 text-low',
  normal: 'border-accent/25 bg-accent/8 text-accent',
  unknown: 'border-ink-500 bg-ink-800 text-fg-muted',
};

export function StatusPill({ status, size = 'sm' }: { status: ResultStatus; size?: 'sm' | 'md' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${PILL[status]} ${size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'}`}>
      {status === 'high' ? '▲' : status === 'low' ? '▼' : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

export const STATUS_TEXT: Record<ResultStatus, string> = {
  high: 'text-high',
  low: 'text-low',
  normal: 'text-fg',
  unknown: 'text-fg-muted',
};

/**
 * Değerin aralık içindeki konumunu gösteren çubuk. Aralığın dışı da görünür olsun diye
 * eksen, aralığın iki yanında pay bırakır.
 */
export function RangeBar({ value, min, max, decimals = 1 }: { value: number | null; min?: number; max?: number; decimals?: number }) {
  if (value === null || (min === undefined && max === undefined)) return null;
  const lo = min ?? 0;
  const hi = max ?? (min !== undefined ? min * 2 : 1);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1 || 1);
  const axisMin = Math.min(lo - span * 0.5, value);
  const axisMax = Math.max(hi + span * 0.5, value);
  const pct = (v: number) => ((v - axisMin) / (axisMax - axisMin)) * 100;
  const inside = (min === undefined || value >= min) && (max === undefined || value <= max);
  return (
    <div className="w-full" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-ink-700">
        <div
          className="absolute inset-y-0 rounded-full bg-accent/35"
          style={{ left: `${min !== undefined ? pct(lo) : 0}%`, right: `${max !== undefined ? 100 - pct(hi) : 0}%` }}
        />
        <div
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-950 ${inside ? 'bg-accent' : value > (max ?? Infinity) ? 'bg-high' : 'bg-low'}`}
          style={{ left: `${Math.min(100, Math.max(0, pct(value)))}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-fg-faint">
        <span>{min !== undefined ? formatNumber(min, decimals) : ''}</span>
        <span>{max !== undefined ? formatNumber(max, decimals) : ''}</span>
      </div>
    </div>
  );
}

export const ISSUE_TEXT: Record<IssueCode, string> = {
  NAME_FUZZY: 'Test adı tam eşleşmedi; doğru test olduğundan emin ol.',
  UNIT_MISSING: 'Birim okunamadı; varsayılan birim seçildi.',
  UNIT_UNKNOWN: 'Birim bu testle uyumlu değil; doğru birimi seç.',
  RANGE_MISSING: 'Raporda referans aralığı bulunamadı; genel (yaklaşık) aralık kullanıldı.',
  RANGE_SEX_SPECIFIC: 'Aralık cinsiyete göre veriliyor; cinsiyet seçersen doğru aralık uygulanır.',
  OCR_DISAGREE: 'Görüntü iki farklı yöntemle okundu ve bu değer farklı çıktı. Belgedeki değerle karşılaştır.',
  PERCENT_GUESSED: 'Görüntüde “%” işareti okunamadı (başka bir karakter sanıldı); testin adına göre yüzde varsayıldı. Adı ve birimi kontrol et.',
  RANGE_CATEGORIES: 'Raporda normal aralık yerine risk/eksiklik kategorileri yazıyor; değerlendirme genel referans aralığıyla yapıldı.',
  RANGE_PHASE_SPECIFIC: 'Aralık döngü evresine, menopoza veya gebeliğe göre veriliyor. Hangisinin sana uyduğunu bilemeyiz; rapordaki uygun aralığı elle gir.',
  FLAG_CONFLICT: 'Rapordaki H/L işareti hesaplanan durumla çelişiyor; değeri ve aralığı kontrol et.',
  IMPLAUSIBLE: 'Değer bu test için olağandışı; okuma veya birim hatası olabilir.',
  AMBIGUOUS_DECIMAL: 'Ondalık ayırıcı belirsiz (ör. 1,234); değeri belgeyle karşılaştır.',
  LOW_OCR_CONFIDENCE: 'Fotoğraftan okuma güveni düşük; değeri belgeyle karşılaştır.',
  DUPLICATE: 'Bu test raporda birden fazla kez ve farklı değerlerle geçiyor.',
};
