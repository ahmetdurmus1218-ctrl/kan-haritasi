/**
 * Ham görüntü analizi kartı (rapordan bağımsız). Kaynakların durumu, kalite kontrolü, modalite ve bölge
 * tahmini, çalışan/çalışmayan yetenekler, görüntüden çıkan gözlemler (kaynak, güven, konum, model) ve
 * sınırlar. Model yoksa bunu açıkça söyler; bulgu uydurmaz.
 */
import { useEffect, useMemo, useRef } from 'react';
import { type HealthModel, type ImageAnalysisRun, MODALITY_LABEL, type RasterImage, type ReportFinding, SOURCE_LABEL, buildHealthModel } from '@kh/analysis';
import type { DicomInfo } from '@kh/ingest';
import type { Bytes, FileInfo } from '@kh/vault';
import { go } from '../state/router';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { contextFor, toStoredAnalysis, useImageAnalysis } from '../lib/analysisBridge';
import { type StoredAnalysis, saveAnalysis } from '../lib/imagingRecords';
import { BodyIcon, CheckIcon, SpinnerIcon } from './icons';
import { ConfidenceNote, LocationPath, SourceBadge, StatusPill, WhyButton } from './evidence';

const CAP_ICON = { done: '✓', 'not-possible': '—', 'not-implemented': '✗' } as const;
const CAP_TITLE = { done: 'Bu görüntüde çalıştı', 'not-possible': 'Uygulanmış ama bu görüntüde yapılamadı', 'not-implemented': 'Bu kurulumda yok' } as const;

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 w-4 shrink-0 text-center ${ok ? 'text-accent' : 'text-fg-faint'}`} aria-hidden="true">
        {ok ? '✓' : '✗'}
      </span>
      <span>
        <span className={ok ? 'text-fg' : 'text-fg-muted'}>{label}</span>
        {detail && <span className="block text-xs text-fg-faint">{detail}</span>}
      </span>
    </li>
  );
}

/** Piksel konumu olan gözlemleri (ör. EKG ritim şeridi) gerçek görüntü üzerinde çizer. */
function Overlay({ raster, run }: { raster: RasterImage; run: ImageAnalysisRun }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxes = useMemo(() => run.result.observations.flatMap((o) => (o.localization.kind === 'pixel' ? [o.localization.box] : [])), [run]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = raster.width;
    c.height = raster.height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(raster.width, raster.height);
    if (raster.rgba) img.data.set(raster.rgba);
    else {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < raster.gray.length; i += 7) {
        lo = Math.min(lo, raster.gray[i]!);
        hi = Math.max(hi, raster.gray[i]!);
      }
      const k = hi > lo ? 255 / (hi - lo) : 1;
      for (let p = 0; p < raster.gray.length; p++) {
        const v = (raster.gray[p]! - lo) * k;
        img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = v;
        img.data[p * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineWidth = Math.max(2, raster.width / 300);
    ctx.strokeStyle = '#a78bfa';
    for (const b of boxes) ctx.strokeRect(b.x, b.y, b.w, b.h);
  }, [raster, boxes]);
  if (!boxes.length) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-ink-600/60 bg-black">
      <canvas ref={ref} className="block h-auto w-full" aria-label="Gerçek görüntü üzerinde analiz edilen alan" />
      <figcaption className="px-3 py-1.5 text-[11px] text-fg-faint">Mor kutu: görüntü analizinin ölçüm yaptığı gerçek piksel alanı.</figcaption>
    </figure>
  );
}

export function AnalysisCard({
  info,
  bytes,
  dicom,
  noteFileId,
  stored,
  reportFindings,
  labsAvailable,
  previousAvailable,
  showOverlay,
}: {
  info: FileInfo;
  bytes: Bytes;
  dicom: DicomInfo | null;
  noteFileId: string;
  stored?: StoredAnalysis;
  /** Aynı çalışmanın raporundan okunan bulgular (ayrı kaynak). */
  reportFindings: ReportFinding[];
  labsAvailable: boolean;
  previousAvailable: boolean;
  /** Piksel konumlarını bu kartta çiz (kesitsel görüntülerde ayrı inceleme kartı çizer). */
  showOverlay: boolean;
}) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const context = useMemo(() => contextFor(info, dicom), [info, dicom]);
  const reportAvailable = reportFindings.length > 0;
  const { run, raster, state } = useImageAnalysis(info, bytes, context, reportAvailable, true);

  // Özet kasaya kaydedilir (Vücudum ve organ sayfaları için). Aynı sonuç tekrar yazılmaz.
  const savedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!run || run.route !== 'image-analysis') return;
    const next = toStoredAnalysis(run, info.id);
    const sig = JSON.stringify([next.modality, next.status, next.structure, next.model.version, next.observations.map((o) => o.text)]);
    const prev = stored ? JSON.stringify([stored.modality, stored.status, stored.structure, stored.model.version, stored.observations.map((o) => o.text)]) : null;
    if (sig === prev || savedFor.current === sig) return;
    savedFor.current = sig;
    void saveAnalysis(vault, noteFileId, next).then(bump, () => undefined);
  }, [run, stored, vault, noteFileId, info.id, bump]);

  // Bu çalışmanın görüntü + rapor uyumu (yalnızca bu belge için birleşik model).
  const local: HealthModel | null = useMemo(
    () => (run ? buildHealthModel({ images: [{ run, documentId: info.id, studyKey: 'this' }], reports: reportAvailable ? [{ findings: reportFindings, studyKey: 'this' }] : [], labs: [] }) : null),
    [run, reportFindings, reportAvailable, info.id],
  );

  if (state === 'unsupported') return null;

  return (
    <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Ham görüntü analizi">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label-caps">Ham görüntü analizi · rapordan bağımsız</p>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Görüntünün kendisi cihazında incelenir: kalite, görüntü türü, bölge ve bu tür için kurulu analiz yetenekleri. Rapor varsa ayrı kaynak olarak gösterilir.
          </p>
        </div>
        {run && <StatusPill status={run.result.status} />}
      </div>

      <ul className="grid gap-1 sm:grid-cols-2" aria-label="Kaynaklar">
        <Check ok label="Görüntü var" detail="Analiz bu görüntüye dayanıyor" />
        <Check ok={reportAvailable} label={reportAvailable ? 'Rapor var' : 'Rapor yok'} detail={reportAvailable ? 'Rapor bulguları ayrı kaynak (RAPOR)' : 'Sonuçlar yalnızca görüntünün kendisine dayanıyor'} />
        <Check ok={labsAvailable} label={labsAvailable ? 'Tahlil sonuçların var' : 'Tahlil sonucu yok'} detail={labsAvailable ? 'İlgili organ sayfasında birlikte gösterilir' : undefined} />
        <Check ok={previousAvailable} label={previousAvailable ? 'Önceki çalışma var' : 'Önceki çalışma yok'} detail={previousAvailable ? 'Zaman içindeki değişim organ sayfasında' : undefined} />
      </ul>

      {state === 'running' || state === 'idle' ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={14} /> Görüntü analiz ediliyor…
        </p>
      ) : state === 'error' || !run ? (
        <p className="text-sm text-fg-muted">Görüntü analiz edilemedi (dosya okunamadı ya da bozuk). Görüntüleyicide açmayı deneyebilirsin.</p>
      ) : (
        <>
          <ol className="space-y-2 text-sm">
            <li>
              <p className="label-caps">1 · Görüntü kalitesi</p>
              {run.quality.issues.length ? (
                <ul className="mt-1 space-y-1">
                  {run.quality.issues.map((q) => (
                    <li key={q.code} className={`text-[13px] ${q.severity === 'blocking' ? 'text-high' : 'text-caution-fg'}`}>
                      {q.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 flex items-center gap-1 text-[13px] text-fg-muted">
                  <CheckIcon size={12} /> Bulanıklık, parlama, kesilme ya da düşük çözünürlük saptanmadı.
                </p>
              )}
            </li>
            {run.modality && (
              <li>
                <p className="label-caps">2 · Görüntü türü (modalite)</p>
                <p className="mt-1 text-[13px] text-fg">
                  {MODALITY_LABEL[run.modality.primary.modality]} <span className="text-fg-faint">· {SOURCE_LABEL[run.modality.primary.source]}</span>
                </p>
                <p className="text-[12px] text-fg-faint">
                  {run.modality.medical.reason} İpuçları: {run.modality.candidates.find((c) => c.source === 'IMAGE_ANALYSIS')?.cues.join('; ') ?? '—'}
                </p>
                {run.modality.conflict && <p className="mt-1 text-[13px] text-caution-fg">{run.modality.conflict}</p>}
              </li>
            )}
            {run.anatomy && (
              <li>
                <p className="label-caps">3 · Anatomik bölge</p>
                {run.anatomy.location ? (
                  <div className="mt-1">
                    <LocationPath loc={run.anatomy.location} onOpen={(id) => go({ name: 'organ', id })} />
                    <p className="text-[11px] text-fg-faint">Kaynak: {run.anatomy.source ? SOURCE_LABEL[run.anatomy.source] : '—'} · {run.anatomy.cues.join('; ')}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-[13px] text-fg-muted">{run.anatomy.cues.join('; ')}. Belge için bölgeyi yukarıdan seçebilirsin.</p>
                )}
              </li>
            )}
            <li>
              <p className="label-caps">4 · Analiz yetenekleri ({run.result.model.name}{run.result.model.version !== '—' ? ` · sürüm ${run.result.model.version}` : ''}{run.result.model.local ? ' · cihazda' : ''})</p>
              <p className="mt-1 text-[13px] text-fg">{run.result.summary}</p>
              {run.result.capabilities.length > 0 && (
                <ul className="mt-1.5 grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
                  {run.result.capabilities.map((c) => (
                    <li key={c.key} className="flex items-start gap-1.5 text-[12px]" title={CAP_TITLE[c.status]}>
                      <span className={`w-3 shrink-0 text-center ${c.status === 'done' ? 'text-accent' : 'text-fg-faint'}`}>{CAP_ICON[c.status]}</span>
                      <span className={c.status === 'done' ? 'text-fg-muted' : 'text-fg-faint'}>
                        {c.label}
                        {c.detail && c.status !== 'not-implemented' ? ` (${c.detail})` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-[11px] text-fg-faint">✓ çalıştı · — bu görüntüde yapılamadı · ✗ bu kurulumda yok (uydurulmaz)</p>
            </li>
          </ol>

          {showOverlay && raster && <Overlay raster={raster} run={run} />}

          {run.result.observations.length > 0 && (
            <div className="space-y-2">
              <p className="label-caps">Görüntüden çıkan gözlemler ({run.result.observations.length})</p>
              <ul className="space-y-2">
                {run.result.observations.map((o) => {
                  const conc = local?.concordance.find((c) => c.observation.id === o.id);
                  return (
                    <li key={o.id} className="space-y-1.5 rounded-xl border border-ink-600/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <SourceBadge source="IMAGE_ANALYSIS" />
                        <ConfidenceNote c={o.confidence} />
                      </div>
                      <p className="text-sm text-fg">{o.text}</p>
                      {o.location && <LocationPath loc={o.location} onOpen={(id) => go({ name: 'organ', id })} />}
                      {conc && (
                        <p className={`text-[12px] ${conc.relation === 'supported-by-report' ? 'text-low' : conc.relation === 'report-says-normal' ? 'text-caution-fg' : 'text-fg-faint'}`}>
                          Rapor ile: {conc.text}
                        </p>
                      )}
                      <p className="text-[11px] text-fg-faint">
                        Model: {o.model.name} {o.model.version} · {o.localization.kind === 'pixel' ? 'gerçek görüntü üzerinde piksel konumu var' : 'piksel konumu yok'}
                      </p>
                      <details className="text-[12px] text-fg-faint">
                        <summary className="cursor-pointer">Sınırlar</summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {o.limitations.map((l, i) => (
                            <li key={i}>{l}</li>
                          ))}
                        </ul>
                      </details>
                      <div className="flex flex-wrap gap-1.5">
                        {o.location?.structure && (
                          <button
                            type="button"
                            className="btn-ghost px-2.5 py-1 text-xs"
                            onClick={() => go(o.location?.part ? { name: 'body', structure: o.location.structure!, part: o.location.part } : { name: 'body', structure: o.location!.structure! })}
                          >
                            <BodyIcon size={13} /> 3B anatomide göster (yaklaşık)
                          </button>
                        )}
                        {o.location?.path[0] && (
                          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => go({ name: 'organ', id: o.location!.path[o.location!.path.length - 1]! })}>
                            Bu bölge nedir?
                          </button>
                        )}
                        <WhyButton location={o.location} model={local} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-dashed border-ink-600 p-3">
            <p className="label-caps">Durum ve sınırlar</p>
            <ul className="mt-1 space-y-0.5 text-[12.5px] leading-relaxed text-fg-muted">
              {run.statements.map((s, i) => (
                <li key={`s${i}`}>{s}</li>
              ))}
              {run.result.limitations.map((s, i) => (
                <li key={`l${i}`} className="text-fg-faint">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
