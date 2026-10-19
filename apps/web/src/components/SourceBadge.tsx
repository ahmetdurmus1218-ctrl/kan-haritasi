/**
 * Sahnenin kaynağı — her 3B seviyede, sahnenin ÜZERİNDE (yalnızca açıklama metninde değil):
 *   🟢 Gerçek görüntü verisi: kişinin kendi BT/MR serisinden bölütleme → yüzey.
 *   🔵 Eğitimsel anatomi: normal insan anatomisini anlatan model (referans atlas ya da temsili sahne).
 * Kullanıcı kendi hücresini, nefronunu ya da iç yüzeyini gördüğünü sanmasın diye iki kaynak hiç karışmaz.
 */
export type SceneSource = 'real' | 'educational';

export function SourceBadge({ kind, label, detail, className = '' }: { kind: SceneSource; label?: string; detail?: string; className?: string }) {
  const real = kind === 'real';
  return (
    <span
      data-testid="scene-source"
      data-source={kind}
      className={`pointer-events-none inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] leading-tight backdrop-blur ${real ? 'border-emerald-400/40 bg-black/60 text-emerald-100' : 'border-sky-400/40 bg-black/60 text-sky-100'} ${className}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${real ? 'bg-emerald-400' : 'bg-sky-400'}`} />
      <span className="font-semibold tracking-wide">{label ?? (real ? 'GERÇEK GÖRÜNTÜ VERİSİ' : 'EĞİTİMSEL ANATOMİ')}</span>
      {detail && <span className="truncate opacity-80">· {detail}</span>}
    </span>
  );
}
