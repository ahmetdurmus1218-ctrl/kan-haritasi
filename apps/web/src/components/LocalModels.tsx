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
        Görüntüler yalnızca bu cihazda, kurduğun yerel bir modelle incelenebilir (ONNX, cihazda çalışır; internet gerekmez, hiçbir veri gönderilmez). Uygulama kendi içinde tıbbi
        görüntü modeli <strong>içermez</strong>. Model kurmak için modelin <code>.onnx</code> dosyasını ve manifestini (<code>.json</code>) birlikte seç; dosyanın SHA-256 özeti
        manifestle eşleşmezse model kabul edilmez.
      </p>
      {models === null ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={14} /> Yükleniyor…
        </p>
      ) : models.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-600 p-3 text-sm text-fg-muted" data-testid="no-local-models">
          Bu cihazda kurulu tıbbi görüntü modeli yok. Görüntülerde yalnızca kural tabanlı ön inceleme yapılır.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Kurulu modeller">
          {models.map((m) => (
            <li key={m.manifest.id} className="rounded-xl border border-ink-600/60 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-fg">
                    {m.manifest.name} <span className="font-normal text-fg-muted">{m.manifest.version}</span>
                  </p>
                  <p className="text-xs text-fg-muted">
                    {m.manifest.modalities.join(', ')} · {m.manifest.task} · {formatBytes(m.size)} · kuruldu {formatDateTime(m.importedAt)}
                  </p>
                  <p className="text-xs text-fg-faint">
                    Lisans: {m.manifest.license} · Amaç: {m.manifest.intendedUse}
                  </p>
                  <p className="break-all font-mono text-[11px] text-fg-faint">SHA-256 {m.manifest.sha256}</p>
                </div>
                <button type="button" className="icon-btn h-10 w-10 shrink-0" aria-label={`${m.manifest.name} modelini kaldır`} onClick={() => void removeModel(m.manifest.id)}>
                  <TrashIcon size={16} />
                </button>
              </div>
            </li>
          ))}
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
