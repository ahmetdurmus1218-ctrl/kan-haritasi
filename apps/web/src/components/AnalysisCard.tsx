/**
 * Ham görüntü analizi kartı (rapordan bağımsız). Önce özet ("Analiz tamamlandı · Bu bir MR görüntüsü
 * gibi görünüyor · 1 dikkat çeken alan"), sonra basit bulgu kartları ([İncele] ile güven, konum
 * varsayımları, sınırlar). Kalite, modalite ipuçları, yetenek listesi, model sürümü "Teknik detaylar"da.
 * Model yoksa bunu açıkça söyler; bulgu uydurmaz.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { GRAPH, type HealthModel, type ImageAnalysisRun, type ImageObservation, MODALITY_LABEL, type RasterImage, type ReportFinding, SOURCE_LABEL, buildHealthModel } from '@kh/analysis';
import { Sheet } from './Sheet';
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
  const [region, setRegion] = useState<string | null>(null);

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

  const running = state === 'idle' || state === 'reading' || state === 'analyzing';
  const findings = run ? run.result.observations.filter((o) => o.kind !== 'quality' && o.kind !== 'structure-presence') : [];
  const technical = run ? run.result.observations.filter((o) => o.kind === 'quality' || o.kind === 'structure-presence') : [];
  const anatomyName = run?.anatomy?.location ? GRAPH.node(run.anatomy.location.path[run.anatomy.location.path.length - 1] ?? '')?.nameTr ?? run.anatomy.structure : undefined;
  const modality = run?.modality ? MODALITY_LABEL[run.modality.primary.modality] : undefined;
  const asym = findings.filter((o) => o.kind === 'asymmetry').length;
  const hr = findings.find((o) => o.kind === 'heart-rate')?.measurement;
  const outcome = !run
    ? ''
    : run.result.status === 'UNAVAILABLE'
      ? 'Bu görüntü türü için otomatik yorum bu kurulumda yok. Görüntü saklandı; görüntüleyicide açıp inceleyebilir, ölçebilirsin.'
      : asym
        ? `${asym} dikkat çeken alan`
        : hr
          ? `Kalp hızı yaklaşık ${hr.value}/dk`
          : findings.length
            ? `${findings.length} ölçüm`
            : 'Belirgin bir fark bulunmadı (bu, görüntünün normal olduğunu kanıtlamaz).';

  return (
    <section className="space-y-4 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4 md:p-5" aria-label="Ham görüntü analizi">
      {running ? (
        <div aria-live="polite">
          <p className="text-[15px] font-medium text-fg">Görüntün inceleniyor…</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(
              [
                ['Dosya okundu', state === 'analyzing'],
                ['Görüntü türü ve bölge belirleniyor', false],
                ['Görüntü analiz ediliyor', false],
              ] as const
            ).map(([label, done], i) => (
              <li key={label} className={`flex items-center gap-2 ${done ? 'text-fg' : 'text-fg-muted'}`}>
                {done ? <CheckIcon size={14} /> : (i === 0 ? state !== 'analyzing' : state === 'analyzing') ? <SpinnerIcon size={14} /> : <span className="w-3.5" />}
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : state === 'error' || !run ? (
        <p className="text-sm text-fg-muted">Görüntü analiz edilemedi (dosya okunamadı ya da bozuk). Görüntüleyicide açmayı deneyebilirsin.</p>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-medium text-fg">Analiz tamamlandı</p>
              <StatusPill status={run.result.status} />
            </div>
            <p className="mt-1 text-[15px] text-fg">
              {modality ? `Bu bir ${modality} görüntüsü gibi görünüyor` : 'Görüntü türü belirlenemedi'}
              {anatomyName ? ` · ${anatomyName}` : ''}
            </p>
            {run.modality?.conflict && <p className="mt-1 text-sm text-caution-fg">{run.modality.conflict}</p>}
            <p className="mt-2 text-[15px] text-fg">{outcome}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {reportAvailable ? 'Rapor da var: rapordaki bulgular ayrıca gösterilir.' : 'Rapor yok: sonuçlar yalnızca görüntünün kendisine dayanıyor.'}
            </p>
            {run.quality.issues[0] && <p className="mt-2 text-sm text-caution-fg">{run.quality.issues[0].message}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {findings.length > 0 && (
                <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => document.getElementById(`bulgular-${info.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  Bulguları gör
                </button>
              )}
              {run.anatomy?.structure && (
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => {
                    const l = findings[0]?.location ?? run.anatomy?.location;
                    go(l?.part ? { name: 'body', structure: l.structure ?? run.anatomy!.structure!, part: l.part } : { name: 'body', structure: run.anatomy!.structure! });
                  }}
                >
                  <BodyIcon size={15} /> Vücudumda göster
                </button>
              )}
            </div>
          </div>

          {showOverlay && raster && <Overlay raster={raster} run={run} />}

          {findings.length > 0 && (
            <ul id={`bulgular-${info.id}`} className="scroll-mt-4 space-y-2" aria-label="Görüntüden çıkan gözlemler">
              {findings.map((o) => (
                <FindingCard key={o.id} o={o} modality={modality} concordance={local?.concordance.find((c) => c.observation.id === o.id)?.text} model={local} onRegion={setRegion} />
              ))}
            </ul>
          )}

          <details className="rounded-xl border border-dashed border-ink-600 p-3">
            <summary className="cursor-pointer text-sm text-fg-muted">Teknik detaylar</summary>
            <div className="mt-3 space-y-3 text-[13px]">
              <ul className="grid gap-1 sm:grid-cols-2" aria-label="Kaynaklar">
                <Check ok label="Görüntü var" detail="Analiz bu görüntüye dayanıyor" />
                <Check ok={reportAvailable} label={reportAvailable ? 'Rapor var' : 'Rapor yok'} detail={reportAvailable ? 'Rapor bulguları ayrı kaynak (RAPOR)' : 'Sonuçlar yalnızca görüntünün kendisine dayanıyor'} />
                <Check ok={labsAvailable} label={labsAvailable ? 'Tahlil sonuçların var' : 'Tahlil sonucu yok'} />
                <Check ok={previousAvailable} label={previousAvailable ? 'Önceki çalışma var' : 'Önceki çalışma yok'} />
              </ul>
              <div>
                <p className="font-medium text-fg">Görüntü kalitesi</p>
                {run.quality.issues.length ? (
                  <ul className="mt-0.5 space-y-0.5 text-fg-muted">
                    {run.quality.issues.map((q) => (
                      <li key={q.code}>{q.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-fg-muted">Bulanıklık, parlama, kesilme ya da düşük çözünürlük saptanmadı.</p>
                )}
              </div>
              {run.modality && (
                <div>
                  <p className="font-medium text-fg">Görüntü türü</p>
                  <p className="text-fg-muted">
                    {MODALITY_LABEL[run.modality.primary.modality]} · {SOURCE_LABEL[run.modality.primary.source]} · {run.modality.medical.reason}
                  </p>
                  <p className="text-fg-faint">İpuçları: {run.modality.candidates.find((c) => c.source === 'IMAGE_ANALYSIS')?.cues.join('; ') ?? '—'}</p>
                </div>
              )}
              {run.anatomy?.location && (
                <div>
                  <p className="font-medium text-fg">Anatomik bölge</p>
                  <LocationPath loc={run.anatomy.location} onOpen={(id) => go({ name: 'organ', id })} />
                  <p className="text-fg-faint">Kaynak: {run.anatomy.source ? SOURCE_LABEL[run.anatomy.source] : '—'} · {run.anatomy.cues.join('; ')}</p>
                </div>
              )}
              <div>
                <p className="font-medium text-fg">
                  Analiz yetenekleri · {run.result.model.name}
                  {run.result.model.version !== '—' ? ` · sürüm ${run.result.model.version}` : ''}
                  {run.result.model.local ? ' · cihazda' : ''}
                </p>
                <p className="text-fg-muted">{run.result.summary}</p>
                {run.result.capabilities.length > 0 && (
                  <ul className="mt-1 grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
                    {run.result.capabilities.map((c) => (
                      <li key={c.key} className="flex items-start gap-1.5" title={CAP_TITLE[c.status]}>
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
              </div>
              {technical.map((o) => (
                <p key={o.id} className="text-fg-muted">
                  {o.text}
                </p>
              ))}
              <ul className="space-y-0.5 text-fg-faint">
                {run.statements.map((x, i) => (
                  <li key={`s${i}`}>{x}</li>
                ))}
                {run.result.limitations.map((x, i) => (
                  <li key={`l${i}`}>{x}</li>
                ))}
              </ul>
            </div>
          </details>
        </>
      )}
      <RegionSheet id={region} onClose={() => setRegion(null)} />
    </section>
  );
}

function confidenceWords(c: ImageObservation['confidence']): string {
  if (c.kind === 'measured') return 'ölçüm';
  if (c.kind === 'reported') return 'raporda yazıyor';
  return c.value >= 0.6 ? 'güven: orta-yüksek' : c.value >= 0.4 ? 'güven: orta' : 'güven: düşük';
}

/** Basit bulgu kartı: yer, ne görüldü, kaynak, [İncele]. Ayrıntılar (güven, konum varsayımları, sınırlar) açılınca. */
function FindingCard({ o, modality, concordance, model, onRegion }: { o: ImageObservation; modality?: string; concordance?: string; model: HealthModel | null; onRegion: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const last = o.location?.path[o.location.path.length - 1];
  const place = o.location ? o.location.path.slice(1).map((id) => GRAPH.node(id)?.nameTr ?? id).join(' · ') || GRAPH.node(o.location.path[0] ?? '')?.nameTr : undefined;
  const title = o.kind === 'asymmetry' ? (place ?? 'Görüntüde bir alan') : o.measurement ? `${o.measurement.name}: ${o.measurement.value}${o.measurement.unit}` : o.text;
  const what = o.kind === 'asymmetry' ? 'Görüntüde dikkat çeken alan (karşı tarafa göre farklı)' : o.kind === 'rhythm' ? o.text.split('.')[0] : undefined;
  return (
    <li className="rounded-xl border border-ink-600/60 bg-ink-900/30 p-3.5">
      <p className="text-[15px] font-medium text-fg">
        {title}
        {o.kind === 'asymmetry' && o.location?.basis === 'pixel-mapped' ? <span className="font-normal text-fg-faint"> (yaklaşık)</span> : null}
      </p>
      {what && <p className="mt-0.5 text-sm text-fg-muted">{what}</p>}
      <p className="mt-1 text-xs text-fg-faint">Kaynak: {modality ?? 'görüntü'} görüntüsü (otomatik analiz) · {confidenceWords(o.confidence)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Kapat' : 'İncele'}
        </button>
        {o.location?.structure && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => go(o.location?.part ? { name: 'body', structure: o.location.structure!, part: o.location.part } : { name: 'body', structure: o.location!.structure! })}
          >
            <BodyIcon size={13} /> Vücudumda göster
          </button>
        )}
        {last && GRAPH.node(last) && (
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onRegion(last)}>
            Bu bölge ne?
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-ink-700 pt-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source="IMAGE_ANALYSIS" />
            <ConfidenceNote c={o.confidence} />
          </div>
          <p className="text-fg">{o.text}</p>
          {o.location && <LocationPath loc={o.location} onOpen={(id) => go({ name: 'organ', id })} />}
          {concordance && <p className="text-fg-muted">Rapor ile: {concordance}</p>}
          <p className="text-fg-faint">
            Model: {o.model.name} {o.model.version} · {o.localization.kind === 'pixel' ? 'gerçek görüntü üzerinde piksel konumu var' : 'piksel konumu yok'}
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-fg-faint">
            {o.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <WhyButton location={o.location} model={model} />
        </div>
      )}
    </li>
  );
}

/** "Bu bölge ne?": yeni sayfaya gitmeden kısa tanım ve normal işlev; "Ayrıntılı incele" organ sayfasına. */
function RegionSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const node = id ? GRAPH.node(id) : undefined;
  const fns = id ? GRAPH.functionsOf(id) : [];
  return (
    <Sheet
      open={Boolean(node)}
      onClose={onClose}
      title={node?.nameTr ?? ''}
      footer={
        id ? (
          <button
            type="button"
            className="btn-primary flex-1 justify-center"
            onClick={() => {
              onClose();
              go({ name: 'organ', id });
            }}
          >
            Ayrıntılı incele
          </button>
        ) : undefined
      }
    >
      {node && (
        <div className="space-y-3">
          <p className="text-[15px] leading-relaxed text-fg">{node.summary}</p>
          {fns.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-fg-muted">Normalde</p>
              <ul className="space-y-0.5">
                {fns.slice(0, 4).map((f) => (
                  <li key={f.id}>• {f.nameTr}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-fg-faint">Genel anatomi bilgisidir; görüntündeki bulgunun anlamını hekimin değerlendirir.</p>
        </div>
      )}
    </Sheet>
  );
}
