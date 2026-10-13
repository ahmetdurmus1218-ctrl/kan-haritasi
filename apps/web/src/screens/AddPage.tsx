import type { Route } from '../state/router';
import { Uploader } from '../components/Uploader';

/** "+ Veri ekle": tek giriş noktası. Türünü seçmek gerekmez; sistem dosyanın ne olduğunu kendisi algılar. */
export function AddPage({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Veri ekle</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">Dosyayı seç ya da fotoğrafını çek. Tahlil mi, rapor mu, MR mı, EKG mi olduğunu sistem kendisi anlar ve analiz eder.</p>
      <div className="mt-6">
        <Uploader navigate={navigate} />
      </div>
    </div>
  );
}
