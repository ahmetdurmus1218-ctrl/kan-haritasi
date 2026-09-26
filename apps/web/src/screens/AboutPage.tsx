import type { ReactNode } from 'react';
import { MEDICAL_DISCLAIMER } from '@kh/catalog';
import { go } from '../state/router';
import { ChevronLeftIcon } from '../components/icons';

/** Hakkında: sürüm, tıbbi uyarı, veri kaynakları ve açık kaynak lisansları. */

const BUILD = typeof __KH_BUILD__ === 'string' ? __KH_BUILD__ : 'yerel';

const LICENSES: { name: string; use: string; license: string }[] = [
  { name: 'React 19', use: 'Arayüz', license: 'MIT' },
  { name: 'three.js 0.186', use: '3D çizim', license: 'MIT' },
  { name: 'React Three Fiber 9 · drei 10', use: '3D sahne bileşenleri', license: 'MIT' },
  { name: 'camera-controls 3', use: 'Kamera geçişleri', license: 'MIT' },
  { name: 'meshoptimizer (three.js içinde)', use: '3D model sıkıştırma çözücüsü', license: 'MIT' },
  { name: 'PDF.js 6 (pdfjs-dist)', use: 'PDF görüntüleme ve metin okuma', license: 'Apache-2.0' },
  { name: 'Tesseract.js 7 · tesseract.js-core', use: 'Fotoğraftan metin okuma (OCR), cihazda', license: 'Apache-2.0' },
  { name: 'Tesseract eğitim verileri (tur, eng · tessdata_best)', use: 'OCR dil modelleri', license: 'Apache-2.0' },
  { name: 'hash-wasm', use: 'Argon2id anahtar türetme', license: 'MIT' },
  { name: 'Tailwind CSS 4', use: 'Stil (derleme zamanı)', license: 'MIT' },
  { name: 'AndroidX, Jetpack Compose, Kotlin', use: 'Android kabuğu', license: 'Apache-2.0' },
];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
      <button type="button" className="mb-2 flex items-center gap-1 text-sm text-fg-muted hover:text-fg" onClick={() => go({ name: 'privacy' })}>
        <ChevronLeftIcon size={16} /> Gizlilik
      </button>
      <div className="mb-2">
        <p className="label-caps mb-1.5">Hakkında</p>
        <h1 className="text-2xl font-semibold tracking-tight">Kan Haritası</h1>
        <p className="mt-1 text-sm text-fg-muted">Sürüm {BUILD} · kaynak kodu GitHub’da · veriler yalnızca bu cihazda</p>
      </div>

      <Block title="Tıbbi uyarı">
        <p className="text-sm leading-relaxed text-fg-muted">{MEDICAL_DISCLAIMER}</p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          Uygulama bir tıbbi cihaz değildir; tanı koymaz, tedavi ya da ilaç önermez. 3D modeldeki vurgular yalnızca bir testin genel olarak hangi yapı ve
          süreçlerle ilişkili olduğunu gösterir. Simülasyonlar eğitimseldir ve senin vücudundan bir görüntü değildir.
        </p>
      </Block>

      <Block title="3D anatomi modeli">
        <p className="text-sm leading-relaxed text-fg-muted">
          HuBMAP İnsan Referans Atlası (HRA), 3D Referans Nesne Kütüphanesi — Visible Human erkek referans organları. Lisans: Creative Commons Atıf 4.0 (CC BY 4.0).
          Kaynak: github.com/hubmapconsortium/ccf-3d-reference-object-library (commit f1a3a63).
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          Yapılan değişiklikler: sahne düzleştirildi, parçalar yapıya göre birleştirildi, ağlar sadeleştirildi, nicemlendi ve sıkıştırıldı. Tiroid, hipofiz,
          hipotalamus ve böbreküstü bezleri bu kaynakta olmadığından uygulamada şematik şekillerle gösterilir. Kas ve mide modelleri yoktur (“MODEL GEREKİR”).
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          Doku ve hücre sahneleri (damar içi, alveol, nefron, lobül, adacık, folikül, kemik iliği) bu uygulama için prosedürel olarak üretilmiş temsili
          görsellerdir; ölçekler anlaşılırlık için değiştirilmiştir.
        </p>
      </Block>

      <Block title="Açık kaynak bileşenler">
        <ul className="divide-y divide-ink-700">
          {LICENSES.map((l) => (
            <li key={l.name} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
              <span>
                <span className="text-fg">{l.name}</span>
                <span className="block text-xs text-fg-faint">{l.use}</span>
              </span>
              <span className="font-mono text-xs text-fg-muted">{l.license}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-faint">Lisans metinleri ilgili projelerin depolarında yer alır. Uygulama çalışırken bu bileşenlerin hiçbiri ağa bağlanmaz.</p>
      </Block>

      <Block title="Test verisi">
        <p className="text-sm leading-relaxed text-fg-muted">
          Depodaki örnek raporlar tamamen sentetiktir; gerçek bir kişiye ait değildir. Kimlik numarası benzeri desenler otomatik testlerle engellenir.
        </p>
      </Block>
    </div>
  );
}
