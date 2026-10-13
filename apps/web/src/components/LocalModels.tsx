/**
 * "Yerel tıbbi görüntü modelleri": kullanıcı cihazındaki bir ONNX modelini manifestiyle kurar. Model
 * cihazda çalışır; görüntüler ve sağlık verisi hiçbir yere gönderilmez. Uygulama kendi içinde gerçek
 * bir tıbbi model ağırlığı İÇERMEZ; kurulu model yoksa her modalite için bunu açıkça gösterir.
 */
import { useRef, useState } from 'react';
import { CAPABILITY_MODALITIES, capabilitiesFor } from '@kh/analysis';
import { formatBytes, formatDateTime } from '../lib/format';
import { importModelFiles, removeModel, useLocalModels } from '../lib/localModels/store';
import { SpinnerIcon, TrashIcon, UploadIcon } from './icons';

const TASK_TR: Record<string, string> = {
  'segmentation-3d': '3B bölütleme (seri)',
  segmentation: 'bölütleme (maske)',
  detection: 'tespit (kutu)',
  classification: 'sınıflandırma',
  multilabel: 'çok etiketli sınıflandırma',
};
const OUTPUT_TR: Record<string, string> = {
  'segmentation-3d': 'voksel maskesi, hacim, kesit aralığı',
  segmentation: 'piksel maskesi',
  detection: 'kutu + skor',
  classification: 'skor (konum yok)',
  multilabel: 'skor (konum yok)',
};

export function LocalModels() {
  const models = useLocalModels();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await importModelFiles([...files]);
      setMsg(r.ok ? { ok: true, lines: [`${r.manifest.name} ${r.manifest.version} kuruldu (SHA-256 doğrulandı).`] } : { ok: false, lines: r.errors });
    } catch {
      setMsg({ ok: false, lines: ['Model kurulamadı (dosya okunamadı ya da depolama dolu).'] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" aria-label="Yerel tıbbi görüntü modelleri">
      <p className="text-sm leading-relaxed text-fg-muted">
        Görüntüler yalnızca bu cihazda, yerel modellerle incelenir (ONNX, cihazda çalışır; internet gerekmez, hiçbir veri gönderilmez). Uygulamayla gelen gerçek, açık lisanslı
        modeller aşağıdadır. Ek bir model kurmak için modelin <code>.onnx</code> dosyasını ve manifestini (<code>.json</code>) birlikte seç; dosyanın SHA-256 özeti manifestle
        eşleşmezse model kabul edilmez. Bir analiz için gereken model yoksa bu açıkça yazılır.
      </p>
      {models === null ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={14} /> Yükleniyor…
        </p>
      ) : models.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-600 p-3 text-sm text-fg-muted" data-testid="no-local-models">
          Bu cihazda kurulu tıbbi görüntü modeli yok. Bu analiz için gerekli yerel model cihazda kurulu değil; görüntülerde yalnızca kural tabanlı ön inceleme yapılır.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Kurulu modeller">
          {models.map((m) => {
            const mf = m.manifest;
            const anatomyOnly = mf.labels.every((l) => l.kind === 'anatomy');
            return (
              <li key={mf.id} className="rounded-xl border border-ink-600/60 p-3 text-sm" data-testid="model-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-fg">
                      {mf.name} <span className="font-normal text-fg-muted">{mf.version}</span>
                    </p>
                    <p className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full border border-accent/50 px-2 py-0.5 text-accent">✓ kurulu</span>
                      <span className="rounded-full border border-ink-500 px-2 py-0.5 text-fg-muted">{m.origin === 'bundled' ? 'uygulamayla gelir' : 'kullanıcı kurdu'}</span>
                      <span className="rounded-full border border-ink-500 px-2 py-0.5 text-fg-muted">{TASK_TR[mf.task]}</span>
                    </p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-1 text-xs">
                      <dt className="text-fg-faint">Modalite</dt>
                      <dd className="text-fg-muted">{mf.modalities.join(', ')}</dd>
                      <dt className="text-fg-faint">Girdi</dt>
                      <dd className="text-fg-muted">{mf.volume ? `DICOM serisi (≥ ${mf.volume.minSlices} kesit) → ${mf.volume.spacing} mm izotropik hacim` : `Görüntü → ${mf.input.width}×${mf.input.height} ${mf.input.channels === 1 ? 'gri' : 'renkli'}`}</dd>
                      <dt className="text-fg-faint">Çıktı</dt>
                      <dd className="text-fg-muted">
                        {mf.labels.length} {anatomyOnly ? 'anatomik yapı' : mf.labels.some((l) => l.kind === 'anatomy') ? 'sınıf (yapı + bulgu)' : 'bulgu'} · {OUTPUT_TR[mf.task]}
                      </dd>
                      <dt className="text-fg-faint">Boyut</dt>
                      <dd className="text-fg-muted">{formatBytes(m.size || mf.size || 0)}</dd>
                      <dt className="text-fg-faint">Lisans</dt>
                      <dd className="text-fg-muted">{mf.license}</dd>
                      <dt className="text-fg-faint">Kaynak</dt>
                      <dd className="break-all text-fg-muted">{mf.source}</dd>
                      {mf.compatibleDevice && (
                        <>
                          <dt className="text-fg-faint">Cihaz</dt>
                          <dd className="text-fg-muted">{mf.compatibleDevice}</dd>
                        </>
                      )}
                      <dt className="text-fg-faint">SHA-256</dt>
                      <dd className="break-all font-mono text-[11px] text-fg-faint">{mf.sha256}</dd>
                    </dl>
                    <details className="pt-1 text-xs text-fg-muted">
                      <summary className="cursor-pointer text-fg">Kullanım amacı, doğrulama ve sınırlar</summary>
                      <p className="mt-1">{mf.intendedUse}</p>
                      {mf.validation && <p className="mt-1">Doğrulama: {mf.validation}</p>}
                      {mf.citation && <p className="mt-1">Atıf: {mf.citation}</p>}
                      <ul className="mt-1 list-disc pl-4">
                        {mf.limitations.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                      {m.importedAt && <p className="mt-1">Kuruldu: {formatDateTime(m.importedAt)}</p>}
                    </details>
                  </div>
                  {m.origin !== 'bundled' && (
                    <button type="button" className="icon-btn h-10 w-10 shrink-0" aria-label={`${mf.name} modelini kaldır`} onClick={() => void removeModel(mf.id)}>
                      <TrashIcon size={16} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <SpinnerIcon size={16} /> : <UploadIcon size={16} />} Model kur (.onnx + .json)
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".onnx,.json,application/json,application/octet-stream"
          className="hidden"
          aria-label="Model dosyaları"
          data-testid="model-input"
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {msg && (
        <ul className={`space-y-0.5 text-sm ${msg.ok ? 'text-accent' : 'text-high'}`} role="status">
          {msg.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <details className="rounded-xl border border-ink-600/60 p-3 text-sm">
        <summary className="cursor-pointer text-fg">Bu cihazda neler yapılabiliyor? (modalite başına)</summary>
        <div className="mt-2 space-y-3">
          {CAPABILITY_MODALITIES.map(({ modality, label }) => (
            <div key={modality}>
              <p className="font-medium text-fg">{label}</p>
              <ul className="mt-0.5 space-y-0.5 text-xs">
                {capabilitiesFor(modality, (models ?? []).map((m) => m.manifest)).map((c) => (
                  <li key={c.key} className="flex gap-2">
                    <span className={c.supported ? 'text-accent' : 'text-fg-faint'} aria-hidden="true">
                      {c.supported ? '✓' : '◻'}
                    </span>
                    <span className={c.supported ? 'text-fg' : 'text-fg-muted'}>
                      {c.label}
                      <span className="text-fg-faint"> — {c.supported ? '' : 'desteklenmiyor: '}{c.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
