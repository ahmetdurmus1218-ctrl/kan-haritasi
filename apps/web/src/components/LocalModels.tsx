/**
 * "Yerel tıbbi görüntü modelleri": kullanıcı cihazındaki bir ONNX modelini manifestiyle kurar. Model
 * cihazda çalışır; görüntüler ve sağlık verisi hiçbir yere gönderilmez. Uygulamayla gelen doğrulanmış
 * modeller ayrıca listelenir; modeli olmayan her modalite için bu açıkça gösterilir.
 */
import { useEffect, useRef, useState } from 'react';
import { ADAPTER_GROUP_TR, CAPABILITY_MODALITIES, MODEL_RESEARCH, type ModelManifest, RESEARCH_ACCESS, RESEARCH_STATUSES, RESEARCH_STATUS_TR, capabilitiesFor, researchReport, spacingLabel } from '@kh/analysis';
import { formatBytes, formatDateTime } from '../lib/format';
import { type PackInfo, importModelFiles, loadPacks, removeModel, setModelEnabled, useAllModels } from '../lib/localModels/store';
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

/** Çalışma gereksinimleri (tahmini): disk, bellek, çalışma ortamı. Bellek, karo/girdi boyutu ve ağırlıktan hesaplanır. */
export function requirementsOf(mf: ModelManifest, size: number): { disk: string; ram: string; runtime: string } {
  const weights = size || mf.size || 0;
  let workBytes: number;
  if (mf.volume) {
    const [p0, p1, p2] = mf.volume.patch;
    const tile = p0 * p1 * p2;
    // karo girdisi + TopK çıktısı + birleştirme yuvaları (yaklaşık 4 karo büyüklüğünde hacim) + ara katmanlar
    workBytes = tile * (4 + mf.volume.topK * 8) + tile * 4 * (2 * mf.volume.topK * 5) + tile * 4 * 32;
  } else workBytes = mf.input.width * mf.input.height * mf.input.channels * 4 * 64;
  const ramMb = Math.round((weights * 2 + workBytes) / 1048576 / 50) * 50 + 100;
  return { disk: formatBytes(weights), ram: `≈ ${ramMb.toLocaleString('tr-TR')} MB`, runtime: 'ONNX Runtime Web · WASM · CPU (GPU/WebGPU kullanılmıyor)' };
}

export function LocalModels() {
  const models = useAllModels();
  const [packs, setPacks] = useState<PackInfo | null>(null);
  useEffect(() => {
    void loadPacks().then(setPacks);
  }, []);
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
            const req = requirementsOf(mf, m.size);
            return (
              <li key={mf.id} className={`rounded-xl border border-ink-600/60 p-3 text-sm ${m.enabled === false ? 'opacity-70' : ''}`} data-testid="model-card" data-model={mf.id} data-enabled={m.enabled === false ? 'false' : 'true'}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-fg">
                      {mf.name} <span className="font-normal text-fg-muted">{mf.version}</span>
                    </p>
                    <p className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full border border-accent/50 px-2 py-0.5 text-accent">✓ kurulu</span>
                      <span className={`rounded-full border px-2 py-0.5 ${m.enabled === false ? 'border-ink-500 text-fg-faint' : 'border-accent/50 text-accent'}`}>{m.enabled === false ? '○ devre dışı' : '● etkin'}</span>
                      {mf.volume?.cascade && <span className="rounded-full border border-ink-500 px-2 py-0.5 text-fg-muted">önce {mf.volume.cascade.model} gerekir</span>}
                      <span className="rounded-full border border-ink-500 px-2 py-0.5 text-fg-muted">{m.origin === 'bundled' ? 'uygulamayla gelir' : 'kullanıcı kurdu'}</span>
                      <span className="rounded-full border border-ink-500 px-2 py-0.5 text-fg-muted">{TASK_TR[mf.task]}</span>
                    </p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-1 text-xs">
                      <dt className="text-fg-faint">Modalite</dt>
                      <dd className="text-fg-muted">{mf.modalities.join(', ')}</dd>
                      <dt className="text-fg-faint">Girdi</dt>
                      <dd className="text-fg-muted">{mf.volume ? `DICOM serisi (≥ ${mf.volume.minSlices} kesit) → ${spacingLabel(mf.volume.spacing)} hacim` : `Görüntü → ${mf.input.width}×${mf.input.height} ${mf.input.channels === 1 ? 'gri' : 'renkli'}`}</dd>
                      <dt className="text-fg-faint">Çıktı</dt>
                      <dd className="text-fg-muted">
                        {mf.labels.length} {anatomyOnly ? 'anatomik yapı' : mf.labels.some((l) => l.kind === 'anatomy') ? 'sınıf (yapı + bulgu)' : 'bulgu'} · {OUTPUT_TR[mf.task]}
                      </dd>
                      <dt className="text-fg-faint">Disk</dt>
                      <dd className="text-fg-muted">{req.disk}</dd>
                      <dt className="text-fg-faint">Bellek</dt>
                      <dd className="text-fg-muted">{req.ram} (tahmini, çalışırken)</dd>
                      <dt className="text-fg-faint">Çalışma</dt>
                      <dd className="text-fg-muted">{req.runtime}</dd>
                      <dt className="text-fg-faint">Konum</dt>
                      <dd className="text-fg-muted">{mf.task === 'segmentation-3d' ? 'gerçek voksel maskesi → görüntü üzerinde maske ve kişisel 3B' : mf.task === 'segmentation' ? 'piksel maskesi' : mf.task === 'detection' ? 'kutu' : 'yok (yalnızca skor; sahte konum çizilmez)'}</dd>
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
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button type="button" className="btn-ghost px-2.5 py-1 text-xs" aria-pressed={m.enabled !== false} onClick={() => void setModelEnabled(mf.id, m.enabled === false)} data-testid="model-toggle">
                      {m.enabled === false ? 'Etkinleştir' : 'Devre dışı bırak'}
                    </button>
                    {m.origin !== 'bundled' && (
                      <button type="button" className="icon-btn h-10 w-10" aria-label={`${mf.name} modelini kaldır`} onClick={() => void removeModel(mf.id)}>
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {packs && packs.packs.length > 0 && (
        <details className="rounded-xl border border-ink-600/60 p-3 text-sm" data-testid="model-packs">
          <summary className="cursor-pointer font-medium text-fg">İsteğe bağlı model paketleri · {packs.packs.filter((p) => !models?.some((m) => m.manifest.id === p.id)).length} kurulu değil</summary>
          <p className="mt-1 text-xs text-fg-muted">
            Uygulamaya gömülmeyen (büyük ya da yalnızca masaüstünde makul sürede çalışan) gerçek modeller. Kurmak için projenin <code>{packs.folder}/&lt;model&gt;/</code> klasöründeki
            <code> manifest.json</code> ve <code>model.onnx</code> dosyalarını “Model kur” ile seç; SHA-256 doğrulanır. Uygulama internete çıkmaz.
          </p>
          <ul className="mt-2 space-y-1.5">
            {packs.packs.map((p) => {
              const installed = models?.some((m) => m.manifest.id === p.id);
              return (
                <li key={p.id} className="rounded-lg border border-ink-600/60 px-2.5 py-2 text-xs" data-testid="model-pack" data-installed={installed ? 'true' : 'false'}>
                  <p className="font-medium text-fg">
                    {p.name} <span className="font-normal text-fg-muted">{p.version}</span> · {installed ? '✓ kurulu' : 'kurulu değil'}
                  </p>
                  <p className="text-fg-muted">
                    {p.modalities.join(', ')} · {TASK_TR[p.task]} · {formatBytes(p.size ?? 0)} · {p.license}
                  </p>
                  <p className="text-fg-faint">{p.compatibleDevice}</p>
                  {p.validation && <p className="text-fg-faint">Doğrulama: {p.validation}</p>}
                  <p className="break-all font-mono text-[10px] text-fg-faint">
                    {packs.folder}/{p.id}/ · SHA-256 {p.sha256}
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <ModelResearch />
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
                {capabilitiesFor(modality, (models ?? []).filter((m) => m.enabled !== false).map((m) => m.manifest)).map((c) => (
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

const RESEARCH = researchReport();

/**
 * Model araştırma raporu (packages/analysis/src/modelRegistry): uygulamaya giren ve girmeyen her modelin durumu
 * ve nedeni. Geliştirme sırasında yapılan araştırmadır; uygulama bunun için internete çıkmaz.
 */
function ModelResearch() {
  const others = MODEL_RESEARCH.filter((r) => r.distribution !== 'bundled');
  return (
    <details className="rounded-xl border border-ink-600/60 p-3 text-sm" data-testid="model-inventory">
      <summary className="cursor-pointer font-medium text-fg">
        Model araştırması · {RESEARCH.total} model · {RESEARCH.counts.VERIFIED} doğrulandı · {RESEARCH.date}
      </summary>
      <p className="mt-1 text-xs text-fg-muted">
        Her modalite için gerçek modeller arandı ve tek tek denetlendi (ağırlık, sürüm, özet, lisans, görev, cihaz uygunluğu, resmi çıktıyla doğrulama). Yalnızca doğrulanan modeller
        çalışır; diğerleri için uygulama &quot;model yok&quot; der, sonuç uydurmaz.
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4" data-testid="research-counts">
        {RESEARCH_STATUSES.map((st) => (
          <li key={st} className="rounded-md border border-ink-600/60 px-2 py-1" data-status={st}>
            <span className="font-medium text-fg">{RESEARCH.counts[st]}</span> <span className="text-fg-muted">{RESEARCH_STATUS_TR[st]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fg-faint" data-testid="inventory-access-note">
        Eski {RESEARCH.rechecked} &quot;eklenemedi&quot; kaydı yeniden denetlendi, {RESEARCH.recheckChanged} kaydın durumu değişti. Araştırma ortamından erişilemedi: {RESEARCH_ACCESS.blocked.join(', ')}. Erişim
        engeli tek başına neden sayılmaz: ağırlığı yayımlanmış modeller &quot;{RESEARCH_STATUS_TR.AVAILABLE}&quot; olarak kayıtlı.
      </p>
      <ul className="mt-2 space-y-1.5">
        {others.map((r) => (
          <li key={r.id} className="rounded-lg border border-ink-600/60 px-2.5 py-2 text-xs" data-testid="inventory-entry" data-status={r.status} data-model={r.id}>
            <p className="font-medium text-fg">
              {r.modality.map((m) => ADAPTER_GROUP_TR[m]).join(', ')} · {r.name}{' '}
              <span className="font-normal text-fg-muted">
                — {RESEARCH_STATUS_TR[r.status]}
                {r.recheck ? ' · yeniden denetlendi' : ''}
                {r.distribution === 'pack' ? ' · isteğe bağlı paket' : ''}
              </span>
            </p>
            <p className="text-fg-muted">{r.status === 'VERIFIED' ? `Doğrulama: ${r.evidence}` : `Neden: ${r.failureReason}`}</p>
            <p className="text-fg-faint">Lisans: {r.license.license}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
