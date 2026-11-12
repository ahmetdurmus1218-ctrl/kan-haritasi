/**
 * "Anatomi paketleri": ayrıntılı 3B modelleri (Z-Anatomy) dosyadan kurma, açma/kapama ve kaldırma.
 * Uygulama internete çıkmaz; paket dosyası ayrıca indirilir ve buradan seçilir. Kurulumda SHA-256
 * özeti uygulamaya gömülü resmi listeyle karşılaştırılır; eşleşmeyen paket kurulmaz.
 */
import { useRef, useState } from 'react';
import { PACK_ALIGNMENT, PACK_INDEX } from '../anatomy/packs.generated';
import { type PackIndexEntry, PackError, installPack, packKey, removePack, setPackEnabled, usePacks } from '../anatomy/packs';
import { forgetPack } from '../anatomy/models';
import { ADAPTED_NOTE } from '../anatomy/sources';
import { formatBytes } from '../lib/format';
import { SpinnerIcon, TrashIcon, UploadIcon } from './icons';

const BODY_TR = { male: 'Erkek', female: 'Kadın' } as const;

export function AnatomyPacks() {
  const packs = usePacks();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const installed = new Map(packs.installed.map((p) => [p.key, p]));

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    const done: string[] = [];
    const errors: string[] = [];
    for (const f of [...files]) {
      try {
        const p = await installPack(await f.arrayBuffer());
        forgetPack(p.key);
        done.push(`${p.manifest.title} (${BODY_TR[p.manifest.body]})`);
      } catch (e) {
        errors.push(`${f.name}: ${e instanceof PackError ? e.message : 'paket okunamadı'}`);
      }
    }
    setBusy(false);
    setMessage(errors.length ? { ok: false, text: [...(done.length ? [`Kuruldu: ${done.join(', ')}.`] : []), ...errors].join(' ') } : { ok: true, text: `Kuruldu ve doğrulandı: ${done.join(', ')}. 3B vücutta hemen görünür.` });
  };

  const rows: PackIndexEntry[] = [...PACK_INDEX];
  const total = (body: 'male' | 'female') => rows.filter((r) => r.body === body).reduce((n, r) => n + r.packBytes, 0);

  return (
    <div className="space-y-4 text-sm">
      <p className="text-fg-muted">
        Temel modeller uygulamayla gelir. Ayrıntılı modeller (tek tek kaslar, eklem ve bağlar, gerçek sinir ve damar yolları, lenf düğümleri, baş-boyun) isteğe bağlı paketlerdir: paket dosyasını (
        <span className="font-mono text-xs">anatomi-*.khpack</span>) indirip buradan kur. Kurulan paket cihazda saklanır, internetsiz çalışır. Uygulama paketleri
        kendisi indirmez.
      </p>
      <p className="text-xs text-fg-faint">
        Nereden: GitHub'daki proje sayfası → Releases → <span className="font-mono">apk-son</span> (ya da derlemenin "KanHaritasi-anatomi-paketleri" eki). Kurulumda
        dosyanın SHA-256 özeti bu uygulama sürümüne gömülü resmi listeyle karşılaştırılır; eşleşmeyen ya da lisans bilgisi eksik paket kurulmaz.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <SpinnerIcon size={15} /> : <UploadIcon size={15} />} Paket kur
        </button>
        <span className="text-xs text-fg-faint">
          Tüm paketler: erkek {formatBytes(total('male'))}, kadın {formatBytes(total('female'))}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept=".khpack,application/zip,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {message && (
        <p role="status" className={`rounded-xl border p-3 text-xs ${message.ok ? 'border-accent/50 text-fg' : 'border-danger/40 text-fg'}`}>
          {message.text}
        </p>
      )}

      {(['male', 'female'] as const).map((body) => (
        <div key={body}>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-fg-faint">{BODY_TR[body]} vücudu</p>
          <ul className="divide-y divide-ink-700/60 rounded-xl border border-ink-700/60">
            {rows
              .filter((r) => r.body === body)
              .map((r) => {
                const key = packKey(r.id, r.body);
                const inst = installed.get(key);
                const on = !!inst && !packs.disabled.has(key);
                return (
                  <li key={key} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-fg">
                        {r.title}
                        {r.adapted && <span className="ml-2 rounded border border-ink-600 px-1 text-[10px] text-fg-faint">{ADAPTED_NOTE.toLocaleLowerCase('tr')}</span>}
                      </p>
                      <p className="text-xs text-fg-muted">{r.summary}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-fg-faint">
                        {r.elements.toLocaleString('tr-TR')} yapı · {r.triangles.toLocaleString('tr-TR')} üçgen · {formatBytes(r.packBytes)} · {r.file} · SHA-256 {r.sha256.slice(0, 12)}…
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {inst ? (
                        <>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-muted">
                            <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={on} onChange={(e) => void setPackEnabled(key, e.target.checked)} />
                            {on ? 'Açık' : 'Kapalı'}
                          </label>
                          <button
                            type="button"
                            className="icon-btn h-8 w-8"
                            aria-label={`${r.title} paketini kaldır`}
                            onClick={() => {
                              forgetPack(key);
                              void removePack(key);
                            }}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-fg-faint">kurulu değil</span>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      <p className="text-[11px] leading-relaxed text-fg-faint">
        Kaynak: Z-Anatomy (CC BY-SA 4.0; BodyParts3D CC BY-SA 2.1 JP türevi; kafa sinirleri University of Dundee CC BY 4.0). Modeller uygulamanın vücut koordinatına{' '}
        {PACK_ALIGNMENT.pairs} kemik çifti üzerinden hizalandı (ortalama sapma {PACK_ALIGNMENT.meanResidualMm.toLocaleString('tr-TR')} mm, en büyük{' '}
        {PACK_ALIGNMENT.maxResidualMm.toLocaleString('tr-TR')} mm). Kadın paketleri erkek referansından uyarlanmıştır ve kadına özgü şekil farklarını taşımaz. İç kulak
        (ticari olmayan lisans) ve lisansı belirtilmemiş beyin yüzeyleri alınmadı.
      </p>
    </div>
  );
}
