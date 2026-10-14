/**
 * DICOM serisinde 3B yerel tıbbi model (ör. TotalSegmentator BT/MR): seri hacim olarak cihazda analiz edilir.
 * Dakikalar sürebileceği için kullanıcı başlatır; ilerleme ve iptal vardır. Sonuç: bölütlenen yapılar (hacim,
 * kesit aralığı), modelin bulgu sınıfları (ör. böbrek kisti), görüntü üzerinde maske, organ sayfası ve 3B
 * bağlantıları, model kökeni. Model yoksa ya da seri geometrisi güvenilir değilse nedeni açıkça yazılır.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { structureGroup } from '../lib/volumeResults';
import { GRAPH, type ModelManifest, type Spacing, encodeRle, findingClass, spacing3, spacingLabel, type Modality } from '@kh/analysis';
import type { DicomInfo } from '@kh/ingest';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { go } from '../state/router';
import { insideRoute } from '../lib/anatomyNav';
import { type VolumeJobProgress, runVolumeAnalysis } from '../lib/analysisBridge';
import { type StoredVolume, savePathologyVolume, saveVolume } from '../lib/imagingRecords';
import { type StoredModel, useLocalModels } from '../lib/localModels/store';
import { labelColor, setSeriesOverlay, updateSeriesOverlay, useSeriesOverlay } from '../lib/seriesOverlay';
import { TONE } from '../lib/tone';
import { BodyIcon, SpinnerIcon } from './icons';
import { SourceBadge } from './evidence';

const MODALITY: Record<string, Modality> = { CT: 'CT', MR: 'MRI' };
const SECONDS_PER_TILE: Record<string, number> = { CT: 45, MRI: 30 };

const group = structureGroup;
const PersonalVolume3D = lazy(() => import('./PersonalVolume3D'));

const ml = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} L` : `${v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL`);

type Job = { status: 'idle' } | { status: 'reading'; modelId: string; done: number } | { status: 'running'; modelId: string; p: VolumeJobProgress } | { status: 'error'; modelId: string; reason: string };

export function SeriesModelPanel({ seriesIds, dicom, stored, pathology = [], noteFileId }: { seriesIds: string[]; dicom: DicomInfo; stored: StoredVolume | undefined; pathology?: StoredVolume[]; noteFileId: string }) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const models = useLocalModels();
  const modality = dicom.modality ? MODALITY[dicom.modality] : undefined;
  const volumeModels = useMemo(() => models?.filter((m) => m.manifest.task === 'segmentation-3d' && modality && m.manifest.modalities.includes(modality)) ?? [], [models, modality]);
  // Anatomi modeli: kırpma gerektirmeyen; patoloji modelleri: anatomi sonucuna göre kırpılan (basamaklı) modeller.
  const model = volumeModels.find((m) => !m.manifest.volume?.cascade);
  const pathologyModels = volumeModels.filter((m) => m.manifest.volume?.cascade);
  const [job, setJob] = useState<Job>({ status: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const overlay = useSeriesOverlay(seriesIds[0]);
  const [showAll, setShowAll] = useState(false);
  const [show3d, setShow3d] = useState(false);
  const volumes3d = useMemo(() => (stored ? [stored, ...pathology.filter((p) => p.cascadeFrom?.at === stored.at)] : []), [stored, pathology]);

  // Kayıtlı sonuç görüntüleyiciye bağlanır (maske katmanı).
  useEffect(() => {
    if (stored && seriesIds[0]) setSeriesOverlay({ headId: seriesIds[0], volume: stored, visible: true, highlight: null, goto: null });
    return () => setSeriesOverlay(null);
  }, [stored, seriesIds]);
  useEffect(() => () => abort.current?.abort(), []);

  if (!modality) return null;
  const minSlices = model?.manifest.volume?.minSlices ?? 10;
  const tilesEstimate = (() => {
    const sp = Math.min(...spacing3(model?.manifest.volume?.spacing ?? 3));
    const patch = model?.manifest.volume?.patch ?? [128, 112, 112];
    const fovX = (dicom.columns * (dicom.pixelSpacing?.[1] ?? 1)) / sp;
    const fovY = (dicom.rows * (dicom.pixelSpacing?.[0] ?? 1)) / sp;
    const fovZ = (seriesIds.length * (dicom.sliceThickness ?? sp)) / sp;
    const step = model?.manifest.volume?.tileStep ?? 0.8;
    const n = (size: number, p: number) => (size <= p ? 1 : Math.ceil((size - p) / (p * step)) + 1);
    return n(fovZ, patch[0]) * n(fovY, patch[1]) * n(fovX, patch[2]);
  })();
  const minutes = Math.max(1, Math.round((tilesEstimate * (SECONDS_PER_TILE[modality] ?? 45)) / 60));

  const start = async (target: StoredModel | undefined) => {
    if (!target) return;
    const modelId = target.manifest.id;
    const cascade = target.manifest.volume?.cascade;
    const priorModel = cascade ? models?.find((x) => x.manifest.id === cascade.model) : undefined;
    if (cascade && (!stored || stored.model.id !== cascade.model || !priorModel)) {
      setJob({ status: 'error', modelId, reason: 'Bu model önce aynı seride anatomi bölütlemesinin çalışmasını gerektirir.' });
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setJob({ status: 'reading', modelId, done: 0 });
    const files: Uint8Array[] = [];
    for (const [i, id] of seriesIds.entries()) {
      if (ctrl.signal.aborted) return;
      files.push((await vault.readFile(id)).bytes);
      if (i % 10 === 0) setJob({ status: 'reading', modelId, done: i + 1 });
    }
    setJob({ status: 'running', modelId, p: { stage: 'loading', done: 0, total: 1 } });
    const prior = cascade && stored && priorModel ? { labels: priorModel.manifest.labels, grid: stored.grid, labelsRle: stored.labelsRle } : undefined;
    const r = await runVolumeAnalysis(target.manifest, files, { signal: ctrl.signal, prior, onProgress: (p) => !ctrl.signal.aborted && setJob({ status: 'running', modelId, p }) });
    if (ctrl.signal.aborted) return;
    if (!r.ok) {
      setJob({ status: 'error', modelId, reason: r.reason });
      return;
    }
    const m = target.manifest;
    const result: StoredVolume = {
      at: new Date().toISOString(),
      model: { id: m.id, name: m.name, version: m.version, sha256: m.sha256, license: m.license, source: m.source },
      fileIds: r.geometry.order.map((i) => seriesIds[i]!),
      geometry: { rows: r.geometry.rows, cols: r.geometry.cols, slices: r.geometry.slices, origin: r.geometry.origin, iVec: r.geometry.iVec, jVec: r.geometry.jVec, kVec: r.geometry.kVec },
      grid: r.grid,
      labelsRle: encodeRle(r.labels),
      structures: r.structures,
      tiles: r.tiles,
      seconds: r.seconds,
      modality,
      ...(cascade && stored ? { cascadeFrom: { model: stored.model.id, at: stored.at } } : {}),
    };
    if (cascade) await savePathologyVolume(vault, noteFileId, m.id, result);
    else await saveVolume(vault, noteFileId, result);
    setJob({ status: 'idle' });
    bump();
  };

  const cancel = () => {
    abort.current?.abort();
    setJob({ status: 'idle' });
  };

  const busy = job.status === 'reading' || job.status === 'running';
  const findings = stored?.structures.filter((s) => findingClass(s) === 'finding') ?? [];
  const anatomy = stored?.structures.filter((s) => s.kind === 'anatomy') ?? [];
  const groups = (['Organlar', 'Damarlar', 'Kemikler', 'Kaslar'] as const).map((g) => ({ g, items: anatomy.filter((s) => group(s.structure) === g) })).filter((x) => x.items.length);
  const show = (v: StoredVolume, fileId: string | undefined, labelId: number) => {
    if (!fileId || !seriesIds[0]) return;
    setSeriesOverlay({ headId: seriesIds[0], volume: v, visible: true, highlight: labelId, goto: { fileId, nonce: Date.now() } });
  };
  const running = (id: string | undefined) => busy && id !== undefined && 'modelId' in job && job.modelId === id;
  const progress = (spacing: Spacing) =>
    busy && (
      <div className="space-y-2" aria-live="polite" data-testid="series-progress">
        <p className="flex items-center gap-2 text-sm text-fg">
          <SpinnerIcon size={14} />
          {job.status === 'reading'
            ? `Kesitler kasadan okunuyor (${job.done}/${seriesIds.length})…`
            : job.p.stage === 'loading'
              ? 'Model yükleniyor…'
              : job.p.stage === 'resample'
                ? `Hacim ${spacingLabel(spacing)} ızgaraya hazırlanıyor…`
                : job.p.stage === 'inference'
                  ? `Model çalışıyor: karo ${job.p.done + 1}/${job.p.total}`
                  : 'Sonuçlar birleştiriliyor…'}
        </p>
        {job.status === 'running' && job.p.stage === 'inference' && (
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full bg-[#a78bfa]" style={{ width: `${Math.round((job.p.done / Math.max(1, job.p.total)) * 100)}%` }} />
          </div>
        )}
        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={cancel}>
          İptal
        </button>
      </div>
    );
  const errorText = (id: string | undefined) =>
    job.status === 'error' && job.modelId === id ? (
      <p className="text-sm text-caution-fg" role="status" data-testid="series-error">
        {/geometri|kesit|aralık|yönelim|konum|boyut|çok kareli|sıkıştırılmış/i.test(job.reason) ? `Bu seri güvenilir 3B analiz için uygun değil: ${job.reason}` : job.reason}
      </p>
    ) : null;

  return (
    <section className="space-y-3 rounded-2xl border border-[#a78bfa]/40 bg-ink-850/60 p-4" aria-label="Seri analizi (3B yerel model)" data-testid="series-model-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-medium text-fg" data-testid="series-state" data-state={stored ? 'model' : model ? 'ready' : 'none'}>
            {stored ? 'Seri yerel tıbbi AI modeli ile analiz edildi' : model ? 'Seri 3B yerel modelle analiz edilebilir' : 'Bu analiz için gerekli yerel model cihazda kurulu değil.'}
          </p>
          <p className="text-xs text-fg-muted">{stored ? `${stored.model.name} · ${stored.structures.length} yapı · ${stored.tiles} karo · ${stored.seconds} sn` : model ? model.manifest.name : `${modality === 'CT' ? 'BT' : 'MR'} serisi için 3B bölütleme modeli yok.`}</p>
        </div>
        {(stored || model) && <span className="shrink-0 rounded-full border border-[#a78bfa]/50 px-2 py-0.5 text-[11px] text-[#a78bfa]">yerel model · cihazda</span>}
      </div>

      {!stored && model && seriesIds.length < minSlices && <p className="text-sm text-fg-muted">Seride {seriesIds.length} kesit var; bu model için en az {minSlices} kesit gerekir. Seri analizi yapılmadı.</p>}

      {!stored && model && seriesIds.length >= minSlices && !running(model.manifest.id) && (
        <div className="space-y-2">
          <p className="text-sm text-fg-muted">
            Tüm seri cihazda, {model.manifest.name} ile bölütlenir (organlar, damarlar, kemikler, kaslar{model.manifest.labels.some((l) => l.kind === 'finding') ? ' ve modelin bulgu sınıfları' : ''}). Yaklaşık {tilesEstimate} karo · masaüstünde ~{minutes} dk, telefonda daha uzun sürebilir. Görüntü cihazdan çıkmaz.
          </p>
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={busy} onClick={() => void start(model)} data-testid="run-series-model">
            Seriyi analiz et
          </button>
        </div>
      )}

      {running(model?.manifest.id) && progress(model?.manifest.volume?.spacing ?? 3)}
      {errorText(model?.manifest.id)}

      {stored && (
        <>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={overlay?.visible ?? true} onChange={(e) => updateSeriesOverlay({ visible: e.target.checked })} />
            Görüntü üzerinde bölütlemeyi göster
          </label>

          {findings.length > 0 && (
            <div className="space-y-1.5" aria-label="Model bulguları (seri)">
              <p className="text-sm font-medium text-fg">Model bulguları</p>
              {findings.map((f) => (
                <div key={f.labelId} className={`rounded-lg border px-2.5 py-2 text-sm ${TONE.attention.border} ${TONE.attention.bg}`} data-testid="series-finding">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge source="IMAGE_MODEL" />
                    <span className={`font-medium ${TONE.attention.text}`}>◆ {f.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {ml(f.volumeMl)} · kesit {f.sliceRange[0] + 1}–{f.sliceRange[1] + 1} · modelin sınıfıdır, tanı değildir
                  </p>
                  <button type="button" className="mt-1 text-xs text-accent underline" onClick={() => show(stored, stored.fileIds[f.centroidSlice], f.labelId)}>
                    Görüntüde göster
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <button type="button" className="btn-ghost px-3 py-1.5 text-sm" aria-expanded={show3d} onClick={() => setShow3d((x) => !x)} data-testid="personal-3d-toggle">
              {show3d ? 'Kişisel 3B görünümü kapat' : 'Kişisel 3B (senin maskelerinden)'}
            </button>
            {show3d && seriesIds[0] && (
              <Suspense fallback={<p className="text-sm text-fg-muted">3B görünüm yükleniyor…</p>}>
                <PersonalVolume3D volumes={volumes3d} headId={seriesIds[0]} />
              </Suspense>
            )}
          </div>

          <div className="space-y-2" aria-label="Bölütlenen yapılar">
            <p className="text-sm font-medium text-fg">Bölütlenen yapılar (normal anatomi; bulgu değildir)</p>
            {groups.map(({ g, items }) => (
              <div key={g}>
                <p className="text-xs font-medium uppercase tracking-wide text-fg-faint">
                  {g} · {items.length}
                </p>
                <ul className="mt-1 space-y-1">
                  {(showAll ? items : items.slice(0, 6)).map((s) => {
                    const [r, gg, b] = labelColor(stored, s.labelId);
                    const node = s.node && GRAPH.node(s.node) ? s.node : undefined;
                    return (
                      <li key={s.labelId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="series-structure">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: `rgb(${r},${gg},${b})` }} aria-hidden="true" />
                        <span className="text-fg">{s.name}</span>
                        <span className="text-xs text-fg-muted">
                          {ml(s.volumeMl)} · kesit {s.sliceRange[0] + 1}–{s.sliceRange[1] + 1}
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-2">
                          <button type="button" className="text-xs text-accent underline" onClick={() => show(stored, stored.fileIds[s.centroidSlice], s.labelId)}>
                            Görüntüde
                          </button>
                          {node && (
                            <button type="button" className="text-xs text-accent underline" onClick={() => go(insideRoute(node))} data-testid="structure-inside">
                              İçine gir
                            </button>
                          )}
                          {s.structure && (
                            <button type="button" className="inline-flex items-center gap-0.5 text-xs text-accent underline" aria-label={`${s.name}: 3B anatomide göster`} onClick={() => go(s.part ? { name: 'body', structure: s.structure!, part: s.part } : { name: 'body', structure: s.structure! })}>
                              <BodyIcon size={12} /> 3B
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {anatomy.length > 24 && !showAll && (
              <button type="button" className="text-xs text-accent underline" onClick={() => setShowAll(true)}>
                Tümünü göster ({anatomy.length})
              </button>
            )}
          </div>

          <Provenance v={stored} manifest={model?.manifest} />
          {model && (
            <button type="button" className="text-xs text-fg-muted underline" onClick={() => void saveVolume(vault, noteFileId, null).then(bump)}>
              Sonucu sil (yeniden analiz için)
            </button>
          )}
        </>
      )}

      {pathologyModels.length > 0 && (
        <div className="space-y-2 border-t border-ink-700 pt-3" aria-label="Patoloji modelleri (seri)" data-testid="pathology-models">
          <p className="text-sm font-medium text-fg">Ek modeller (patoloji ve ayrıntılı anatomi)</p>
          <p className="text-xs text-fg-muted">Her biri ayrı bir yerel modeldir; anatomi bölütlemesindeki ilgili organların çevresinde, daha ince ızgarada çalışır. Sonuç tanı değildir.</p>
          {pathologyModels.map((pm) => {
            const res = pathology.find((v) => v.model.id === pm.manifest.id && stored && v.cascadeFrom?.at === stored.at);
            const found = res?.structures.filter((x) => findingClass(x) === 'finding') ?? [];
            const normal = res?.structures.filter((x) => findingClass(x) === 'normal') ?? [];
            const below = res?.structures.filter((x) => findingClass(x) === 'below') ?? [];
            const parts = res?.structures.filter((x) => x.kind === 'anatomy') ?? [];
            const findsAnything = pm.manifest.labels.some((l) => l.kind === 'finding');
            const needs = !stored;
            return (
              <div key={pm.manifest.id} className="space-y-1.5 rounded-lg border border-ink-700 px-2.5 py-2" data-testid="pathology-model" data-model={pm.manifest.id} data-state={res ? 'done' : needs ? 'needs-anatomy' : 'ready'}>
                <p className="text-sm text-fg">{pm.manifest.name}</p>
                {needs && <p className="text-xs text-fg-muted">Önce yukarıdaki anatomi analizi çalışmalı (model, ilgili organların bulunduğu bölgeye bakar).</p>}
                {!needs && !res && !running(pm.manifest.id) && (
                  <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => void start(pm)} data-testid="run-pathology-model">
                    Bu modeli çalıştır
                  </button>
                )}
                {running(pm.manifest.id) && progress(pm.manifest.volume?.spacing ?? 1.5)}
                {errorText(pm.manifest.id)}
                {res && parts.length > 0 && (
                  <ul className="space-y-1" aria-label={`${pm.manifest.name}: bölütlenen bölümler`}>
                    {parts.map((x) => (
                      <li key={x.labelId} className="flex flex-wrap items-center gap-2 text-sm" data-testid="cascade-structure">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgb(${labelColor(res, x.labelId).join(',')})` }} aria-hidden="true" />
                        <span className="text-fg">{x.name}</span>
                        <span className="text-xs text-fg-muted">
                          {ml(x.volumeMl)} · kesit {x.sliceRange[0] + 1}–{x.sliceRange[1] + 1}
                        </span>
                        <button type="button" className="ml-auto text-xs text-accent underline" onClick={() => show(res, res.fileIds[x.centroidSlice], x.labelId)}>
                          Görüntüde
                        </button>
                        {x.node && GRAPH.node(x.node) && (
                          <button type="button" className="text-xs text-accent underline" onClick={() => go(insideRoute(x.node!))}>
                            İçine gir
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {res && findsAnything && found.length === 0 && (
                  <p className="text-sm text-fg-muted" data-testid="pathology-none">
                    ✓ Modelin bulgu sınıfı ({pm.manifest.labels.filter((l) => l.kind === 'finding').map((l) => l.finding).join(', ')}) bu seride {normal.length ? 'fizyolojik sınırın üstünde ' : ''}bulunmadı. Bu, bulgunun olmadığını kesinleştirmez.
                  </p>
                )}
                {normal.map((f) => (
                  <div key={f.labelId} className="rounded-lg border border-ink-700 px-2.5 py-2 text-sm" data-testid="pathology-normal">
                    <p className="text-fg">✓ {f.name}: normal sınırda</p>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      Normal: ≤ {ml(f.normalMaxMl ?? 0)}{f.normalNote ? ` (${f.normalNote})` : ''} · Sende (modelin ölçtüğü): {ml(f.volumeMl)}
                    </p>
                    <button type="button" className="mt-1 text-xs text-accent underline" onClick={() => show(res!, res!.fileIds[f.centroidSlice], f.labelId)}>
                      Görüntüde göster
                    </button>
                  </div>
                ))}
                {below.length > 0 && (
                  <p className="text-xs text-fg-muted" data-testid="pathology-below">
                    Eşik altı (bulgu olarak gösterilmedi; çok küçük alan, model belirsizliği olabilir): {below.map((f) => `${f.name} ${ml(f.volumeMl)}`).join(', ')}.
                  </p>
                )}
                {found.map((f) => (
                  <div key={f.labelId} className={`rounded-lg border px-2.5 py-2 text-sm ${TONE.attention.border} ${TONE.attention.bg}`} data-testid="pathology-finding">
                    <div className="flex flex-wrap items-center gap-2">
                      <SourceBadge source="IMAGE_MODEL" />
                      <span className={`font-medium ${TONE.attention.text}`}>◆ {f.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {ml(f.volumeMl)} · kesit {f.sliceRange[0] + 1}–{f.sliceRange[1] + 1} · modelin bölütlemesidir, tanı değildir
                    </p>
                    <span className="mt-1 flex flex-wrap gap-3">
                      <button type="button" className="text-xs text-accent underline" onClick={() => show(res!, res!.fileIds[f.centroidSlice], f.labelId)}>
                        Görüntüde göster
                      </button>
                      {f.node && GRAPH.node(f.node) && (
                        <button type="button" className="text-xs text-accent underline" onClick={() => go(insideRoute(f.node!))} data-testid="pathology-inside">
                          İçine gir
                        </button>
                      )}
                      {f.structure && (
                        <button type="button" className="inline-flex items-center gap-0.5 text-xs text-accent underline" onClick={() => go({ name: 'body', structure: f.structure! })}>
                          <BodyIcon size={12} /> 3B
                        </button>
                      )}
                    </span>
                  </div>
                ))}
                {res && <Provenance v={res} manifest={pm.manifest} />}
                {res && (
                  <button type="button" className="text-xs text-fg-muted underline" onClick={() => void savePathologyVolume(vault, noteFileId, pm.manifest.id, null).then(bump)}>
                    Bu sonucu sil
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Provenance({ v, manifest }: { v: StoredVolume; manifest: ModelManifest | undefined }) {
  return (
    <details className="text-xs text-fg-muted">
      <summary className="cursor-pointer text-fg">Analiz ayrıntıları ve model kökeni</summary>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" aria-label="Seri modeli kökeni">
        <dt className="text-fg-faint">Model</dt>
        <dd>
          {v.model.name} · {v.model.version} ({v.model.id})
        </dd>
        <dt className="text-fg-faint">SHA-256</dt>
        <dd className="break-all font-mono">{v.model.sha256}</dd>
        <dt className="text-fg-faint">Lisans</dt>
        <dd>{v.model.license}</dd>
        <dt className="text-fg-faint">Kaynak</dt>
        <dd className="break-all">{v.model.source}</dd>
        <dt className="text-fg-faint">Girdi</dt>
        <dd>
          DICOM seri · {v.geometry.slices} kesit · {spacingLabel(v.grid.spacing)} ızgara ({v.grid.shape.join('×')}){v.cascadeFrom ? ` · anatomi sonucuna (${v.cascadeFrom.model}) göre kırpılmış bölge` : ''}
        </dd>
        <dt className="text-fg-faint">Çalışma</dt>
        <dd>
          {v.tiles} karo · {v.seconds} sn · {new Date(v.at).toLocaleString('tr-TR')} · cihazda
        </dd>
      </dl>
      {manifest?.validation && <p className="mt-1">Doğrulama: {manifest.validation}</p>}
      {manifest && (
        <ul className="mt-1 list-disc pl-4">
          {manifest.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
