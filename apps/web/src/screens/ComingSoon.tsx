import type { ReactNode } from 'react';
import { BodyIcon, ChartIcon, ListIcon } from '../components/icons';
import { StatusTag } from '../components/ui';

const PAGES = {
  results: {
    icon: ListIcon,
    phase: 3,
    title: 'Sonuçlarım',
    lead: 'Raporlarından okunan değerler, sisteme göre gruplanmış halde burada olacak.',
    items: [
      'PDF metin katmanı ve cihaz içi OCR (Türkçe) ile satır okuma',
      'Test adlarının LOINC koduna, birimlerin kanonik birime çevrilmesi',
      'Referans aralığı raporun kendisinden; durum: Düşük / Normal / Yüksek',
      'Onay ekranı: onaylamadığın hiçbir değer kaydedilmez',
    ],
  },
  body: {
    icon: BodyIcon,
    phase: 4,
    title: 'Vücut Gezgini',
    lead: 'Etkileşimli 3D insan anatomisi; sonuçların ilgili sistem ve yapılarda vurgulanacak.',
    items: [
      'Döndür, yakınlaştır, kaydır; ön, arka, sol, sağ görünümler',
      'Sistem katmanları: kalp-damar, solunum, sindirim, üriner, endokrin, sinir, kas-iskelet, bağışıklık',
      'Organdan dokuya, hücreye inen kamera geçişleri',
      'Faz 5: damar içi ve LDL eğitimsel simülasyonu',
    ],
  },
  timeline: {
    icon: ChartIcon,
    phase: 6,
    title: 'Zaman Çizelgesi',
    lead: 'Birden fazla raporun aynı testteki değişimi, her raporun kendi referans bandıyla birlikte.',
    items: ['Test seçimi ve trend grafiği', 'Her noktada o raporun referans aralığı', 'Şifreli yedek ve "Verilerimi indir" aynı fazda'],
  },
} satisfies Record<string, { icon: (p: { size?: number }) => ReactNode; phase: number; title: string; lead: string; items: string[] }>;

export function ComingSoon({ page }: { page: keyof typeof PAGES }) {
  const { icon: Icon, phase, title, lead, items } = PAGES[page];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8 md:py-16">
      <div className="surface grid-bg overflow-hidden p-6 md:p-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
            <Icon size={22} />
          </div>
          <StatusTag>FAZ {phase} · HENÜZ YOK</StatusTag>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 leading-relaxed text-fg-muted">{lead}</p>
        <ul className="mt-6 space-y-2.5">
          {items.map((t) => (
            <li key={t} className="flex gap-3 text-sm text-fg-muted">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-500" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-fg-faint">Bu ekranda şu an hiçbir veri işlenmiyor veya gösterilmiyor.</p>
      </div>
    </div>
  );
}
