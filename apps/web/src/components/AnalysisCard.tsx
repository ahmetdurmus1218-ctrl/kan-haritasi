/**
 * Görüntü kartı (rapordan bağımsız) — tek kart, üç dürüst durum:
 *   1. Yerel tıbbi AI modeli çalıştı  → "Yerel tıbbi AI modeli ile analiz edildi" (bulgu, güven, kutu/maske,
 *      anatomi, model kökeni). Model cihazdadır; görüntü hiçbir yere gönderilmez.
 *   2. Yalnızca kural tabanlı ön inceleme → "Görüntü ön incelemesi yapıldı. Bu sonuç tıbbi AI modeli
 *      sonucu değildir." Sağ-sol farkı "görüntü asimetrisi gözlemi"dir; lezyon/tanı/anormallik değildir.
 *   3. Hiçbiri yok → "Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor."
 * Kesitsel görüntülerde sağ-sol ön kontrolün görüntü üzerindeki gösterimi (SymmetryView) bu kartın
 * içindedir; ayrı bir kart yoktur. Ayrıntılar "Nasıl analiz edildi?" bölümündedir.
 */
import { PatternResult } from './PatternResult';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANALYSIS_STATE_TEXT,
  GRAPH,
  type HealthModel,
  type ImageAnalysisRun,
  type ImageObservation,
  MODALITY_LABEL,
  type MedicalFinding,
  type ModelDisagreement,
  type ModelExtras,
  type ModelRun,
  type PixelBox,
  type RasterImage,
  type ReportFinding,
  SOURCE_LABEL,
  analysisState,
  buildHealthModel,
  modelDisagreements,
  INSIDE_DEPTH_TR,
  insideCapability,
} from '@kh/analysis';
import { Sheet } from './Sheet';
import type { DicomInfo } from '@kh/ingest';
import type { Bytes, DocCategory, FileInfo } from '@kh/vault';
import { go } from '../state/router';
import { insideRoute } from '../lib/anatomyNav';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type ModelProgress, contextFor, modelRaster, runLocalModel, toStoredAnalysis, useImageAnalysis } from '../lib/analysisBridge';
import { type StoredAnalysis, type StoredReview, saveAnalysis } from '../lib/imagingRecords';
import { type StoredModel, useLocalModels } from '../lib/localModels/store';
import { BodyIcon, CheckIcon, SpinnerIcon } from './icons';
import { ConfidenceNote, LocationPath, SourceBadge, StatusPill, WhyButton } from './evidence';
import { BOX_COLORS, SymmetryView } from './SymmetryView';
import { TONE } from '../lib/tone';

const CAP_ICON = { done: '✓', 'not-possible': '—', 'not-implemented': '◻' } as const;
/** Model bulgularının kutu rengi (ön kontrol kutularından ayrı). */
const MODEL_COLOR = '#22d3ee';
const STRUCTURE_COLOR = '#a78bfa';

/** Bilginin nereden geldiği, kullanıcı diliyle ("Kullanıcı seçimi" ≠ "görüntüden"). */
const ORIGIN: Partial<Record<string, string>> = { USER_INPUT: 'kullanıcı seçimi', DICOM_METADATA: 'DICOM başlığı', IMAGE_ANALYSIS: 'görüntüden', IMAGE_MODEL: 'tıbbi görüntü modeli' };

type RunInfo = { model: StoredModel; result: ModelRun; extras?: ModelExtras };
type ModelState =
  | { status: 'idle' | 'none' }
  /** Bu modalite için yalnızca 3B (seri) model var: tek görüntüde çalıştırılmaz. */
  | { status: 'volume-only'; model: StoredModel }
  | { status: 'loading' | 'inference'; model: StoredModel; index: number; total: number }
  | { status: 'done'; model: StoredModel; result: ModelRun; runs: RunInfo[]; disagreements: ModelDisagreement[] }
  | { status: 'cancelled'; model: StoredModel };

/**
 * Yetenek paneli: ✓ yapılanlar, ◻ yapılamayanlar ve nedeni. Yerel model satırı her zaman görünür:
 * kuruluysa adıyla, değilse "Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor".
 */
export function ImageCapabilityPanel({ run, model }: { run: ImageAnalysisRun; model?: { name: string; ran: boolean; task?: string } }) {
  const caps = run.result.capabilities;
  const done = caps.filter((c) => c.status === 'done');
  const notPossible = caps.filter((c) => c.status === 'not-possible');
  // Gerçek bir model bulgu tespiti/segmentasyon yaptıysa, kural tabanlı yöntemin "yapamıyorum" satırları yerine modelin satırı görünür.
  const coveredByModel = new Set(model?.ran ? (model.task === 'segmentation' ? ['lesion-detection', 'segmentation'] : model.task === 'detection' ? ['lesion-detection'] : []) : []);
  const missing = caps.filter((c) => c.status === 'not-implemented' && !coveredByModel.has(c.key) && !(c.key === 'sequence' && run.sequence.source === 'DICOM_METADATA'));
  const mri = run.result.modality === 'MRI';
  return (
    <ul className="space-y-1 text-sm" aria-label="Görüntü ön incelemesi adımları">
      <li className="flex items-start gap-2">
        <span className="w-4 shrink-0 text-center text-accent">✓</span>
        <span className="text-fg">Görüntü okundu</span>
      </li>
      <li className="flex items-start gap-2">
        <span className={`w-4 shrink-0 text-center ${run.quality.issues.length ? 'text-caution-fg' : 'text-accent'}`}>{run.quality.issues.length ? '!' : '✓'}</span>
        <span className="text-fg">Görüntü kalitesi {run.quality.issues.length ? <span className="text-caution-fg">· {run.quality.issues[0]!.message}</span> : null}</span>
      </li>
      {done.map((c) => (
        <li key={c.key} className="flex items-start gap-2">
          <span className="w-4 shrink-0 text-center text-accent">{CAP_ICON.done}</span>
          <span className="text-fg">
            {c.label}
            {c.detail ? <span className="text-fg-muted"> · {c.detail}</span> : null}
          </span>
        </li>
      ))}
      {notPossible.map((c) => (
        <li key={c.key} className="flex items-start gap-2">
          <span className="w-4 shrink-0 text-center text-fg-faint">{CAP_ICON['not-possible']}</span>
          <span className="text-fg-muted">
            {c.label}
            {c.detail ? ` · ${c.detail}` : ' · bu görüntüde yapılamadı'}
          </span>
        </li>
      ))}
      {mri && run.sequence.source === 'DICOM_METADATA' && (
        <li className="flex items-start gap-2">
          <span className="w-4 shrink-0 text-center text-accent">✓</span>
          <span className="text-fg">
            MR sekansı: {run.sequence.value} <span className="text-fg-muted">· DICOM başlığından</span>
          </span>
        </li>
      )}
      <li className="flex items-start gap-2" data-testid="local-model-row">
        <span className={`w-4 shrink-0 text-center ${model ? 'text-accent' : 'text-fg-faint'}`}>{model ? '✓' : CAP_ICON['not-implemented']}</span>
        <span className={model ? 'text-fg' : 'text-fg-muted'}>
          Yerel tıbbi AI modeli
          <span className="block text-xs text-fg-faint">{model ? `${model.name}${model.ran ? ' · bu görüntüde çalıştı (cihazda)' : ''}` : 'Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor.'}</span>
        </span>
      </li>
      {missing.map((c) => (
        <li key={c.key} className="flex items-start gap-2">
          <span className="w-4 shrink-0 text-center text-fg-faint">{CAP_ICON['not-implemented']}</span>
          <span className="text-fg-muted">
            {c.key === 'sequence' ? 'MR sekansı' : c.label}
            <span className="block text-xs text-fg-faint">{c.key === 'sequence' ? 'Belirlenemedi.' : c.key === 'lesion-detection' ? 'Bu görüntü türü için kurulu doğrulanmış lezyon modeli yok.' : 'Bu modalite için kurulu doğrulanmış model yok.'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

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

interface Mark {
  box: PixelBox;
  color: string;
  label?: string;
  mask?: { width: number; height: number; data: number[] };
}

/** Gerçek görüntü üzerinde kutular / maskeler (model bulguları ya da ölçüm alanları). */
function Overlay({ raster, marks, caption, testId }: { raster: RasterImage; marks: Mark[]; caption: string; testId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
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
    const lw = Math.max(2, raster.width / 300);
    ctx.lineWidth = lw;
    ctx.font = `${Math.max(12, raster.width / 40)}px system-ui, sans-serif`;
    for (const m of marks) {
      if (m.mask) {
        // Maske görüntünün tamamının küçültülmüş hâlidir (modelin çıktı ızgarası): görüntü ölçeğinde çizilir.
        ctx.fillStyle = `${m.color}55`;
        const sx = raster.width / m.mask.width;
        const sy = raster.height / m.mask.height;
        for (let y = 0; y < m.mask.height; y++) for (let x = 0; x < m.mask.width; x++) if (m.mask.data[y * m.mask.width + x]) ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
      }
      ctx.strokeStyle = m.color;
      ctx.strokeRect(m.box.x, m.box.y, m.box.w, m.box.h);
      if (m.label) {
        ctx.fillStyle = m.color;
        ctx.fillText(m.label, m.box.x + lw, Math.max(12, m.box.y - lw * 2));
      }
    }
  }, [raster, marks]);
  if (!marks.length) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-ink-600/60 bg-black" data-testid={testId}>
      <canvas ref={ref} className="block h-auto w-full" aria-label={`Gerçek görüntü üzerinde ${marks.length} işaret`} />
      <figcaption className="px-3 py-1.5 text-[11px] text-fg-faint">{caption}</figcaption>
    </figure>
  );
}

const pct = (c: MedicalFinding['confidence']) => (c.kind === 'score' ? (c.value >= 0.995 ? '%99+' : `%${Math.round(c.value * 100)}`) : '—');

/** Yerel modelin bulguları: gerçek görüntüde konum, anatomi, rapor uyumu ve model kökeni. */
function ModelFindings({
  result,
  runs,
  disagreements,
  raster,
  concordance,
  onRegion,
}: {
  result: Extract<ModelRun, { status: 'ran' }>;
  runs: RunInfo[];
  disagreements: ModelDisagreement[];
  raster: RasterImage | null;
  concordance: HealthModel['modelConcordance'];
  onRegion: (id: string) => void;
}) {
  const marks: Mark[] = result.findings.flatMap((f, i) =>
    f.localization.kind === 'pixel'
      ? [{ box: f.localization.box, color: MODEL_COLOR, label: String(i + 1), ...(f.localization.mask ? { mask: f.localization.mask } : {}) }]
      : f.localization.kind === 'point'
        ? [{ box: { x: f.localization.x - 4, y: f.localization.y - 4, w: 8, h: 8 }, color: MODEL_COLOR, label: String(i + 1) }]
        : [],
  );
  const structures = result.structures ?? [];
  const structureMarks: Mark[] = structures.flatMap((st) =>
    st.localization.kind === 'pixel' ? [{ box: st.localization.box, color: STRUCTURE_COLOR, label: st.name, ...(st.localization.mask ? { mask: st.localization.mask } : {}) }] : [],
  );
  const scored = runs.filter((r) => r.extras?.scores?.length);
  // Röntgen fotoğrafı / ekran görüntüsü: modelin baktığı alan (röntgene kırpıldıysa) ve ölçülen güvenilirlik
  const framed = runs.find((r) => r.extras?.xrayFrame);
  const frameMarks: Mark[] = framed ? [{ box: { x: framed.extras!.xrayFrame!.x, y: framed.extras!.xrayFrame!.y, w: framed.extras!.xrayFrame!.w, h: framed.extras!.xrayFrame!.h }, color: '#94a3b8', label: 'Modelin baktığı alan' }] : [];
  const photo = framed?.model.manifest.photoMetrics;
  const patterned = runs.filter((r) => r.extras?.pattern);
  const ctr = runs.find((r) => r.extras?.ctr)?.extras?.ctr;
  const anyClassOnly = result.findings.some((f) => f.localization.kind === 'region-only');
  return (
    <section className="space-y-3 rounded-xl border border-[#22d3ee]/40 p-3" aria-label="Yerel tıbbi AI modeli">
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge source="IMAGE_MODEL" />
        <span className="text-sm text-fg">
          {runs.map((r) => r.model.manifest.name).join(' + ')} <span className="text-fg-muted">· cihazda</span>
        </span>
      </div>
      {disagreements.length > 0 && (
        <div className={`space-y-1 rounded-lg border px-3 py-2 text-sm ${TONE.attention.chip}`} data-testid="model-disagreement" role="note">
          {disagreements.map((d) => (
            <p key={d.id}>⚠ {d.text}</p>
          ))}
        </div>
      )}
      {raster && (marks.length > 0 || structureMarks.length > 0) && (
        <Overlay raster={raster} marks={[...structureMarks, ...marks]} testId="model-overlay" caption={`${marks.length ? 'Turkuaz: modelin işaretlediği bulgu alanı. ' : ''}${structureMarks.length ? 'Mor: modelin bölütlediği anatomik yapılar.' : ''} Konumlar modelin çıktısıdır.`} />
      )}
      {framed && (
        <div className={`space-y-1 rounded-lg border px-3 py-2 text-sm ${TONE.attention.chip}`} role="note" data-testid="xray-photo-caution">
          <p>
            ⚠ Bu bir ekran görüntüsü ya da fotoğraf gibi görünüyor. Röntgenin kapladığı alan bulundu; model yalnızca o alana baktı (gri çerçeve).
            {photo ? ` Ölçümde ekranın ya da filmin fotoğrafında en az bir bulgunun kararı değişen görüntü oranı %${Math.round(Math.max(photo.conditions.monitorPhoto?.anyFlagChanged ?? 0, photo.conditions.filmPhoto?.anyFlagChanged ?? 0) * 100)} oldu.` : ''} Kesin değerlendirme için orijinal dosyayı (DICOM ya da PNG) yükle.
          </p>
        </div>
      )}
      {raster && framed && <Overlay raster={raster} marks={frameMarks} testId="xray-frame" caption="Gri çerçeve: modelin baktığı röntgen alanı (fotoğraf/ekran görüntüsünden bulundu)." />}
      {patterned.map((r) => (
        <PatternResult key={r.model.manifest.id} extras={r.extras!} manifest={r.model.manifest} />
      ))}
      {anyClassOnly && <p className="text-xs text-fg-faint">Bu model görüntü düzeyinde sınıflandırır: bulgunun görüntüdeki yerini vermez; yalnızca ilgili organ gösterilir.</p>}
      {ctr && (
        <p className="text-sm text-fg" data-testid="model-ctr">
          Kardiyotorasik oran (model maskelerinden, yaklaşık): <strong>{ctr.ratio.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</strong>{' '}
          <span className="text-xs text-fg-muted">· kalp en geniş {ctr.heartWidth} px / akciğerler {ctr.thoraxWidth} px · genel eşik 0,50; tanı değildir</span>
        </p>
      )}
      {result.findings.length === 0 ? (
        patterned.length ? null : <p className="text-sm text-fg-muted">Model bu görüntüde eşik üstü bir bulgu bildirmedi. Bu, görüntünün normal olduğunu göstermez.</p>
      ) : (
        <ul className="space-y-2" aria-label="Model bulguları">
          {result.findings.map((f, i) => {
            const last = f.anatomicalStructure?.path[f.anatomicalStructure.path.length - 1];
            const organ = f.anatomicalStructure?.path[0];
            const conc = concordance.find((c) => c.finding.id === f.id);
            return (
              <li key={f.id} className="rounded-lg border border-ink-600/60 p-3" data-testid="model-finding">
                <p className="text-[15px] font-medium text-fg">
                  <span className="mr-1.5 inline-block rounded px-1 text-xs" style={{ background: `${MODEL_COLOR}33`, color: MODEL_COLOR }}>
                    {i + 1}
                  </span>
                  {f.finding} <span className="text-sm font-normal text-fg-muted">· güven {pct(f.confidence)}</span>
                </p>
                {f.anatomicalStructure && (
                  <div className="mt-1">
                    <LocationPath loc={f.anatomicalStructure} onOpen={(id) => go({ name: 'organ', id })} />
                  </div>
                )}
                {conc && conc.relation !== 'no-report' && (
                  <p className={`mt-1 text-xs ${conc.relation === 'contradicted-by-report' ? `rounded-lg border px-2 py-1 font-medium ${TONE.attention.chip}` : 'text-fg-muted'}`} data-testid={conc.relation === 'contradicted-by-report' ? 'model-conflict' : undefined}>
                    {conc.relation === 'contradicted-by-report' ? '⚠ ' : ''}
                    {conc.text}
                  </p>
                )}
                <details className="mt-1 text-[11px] text-fg-faint">
                  <summary className="cursor-pointer">Teknik ayrıntı</summary>
                <p className="mt-0.5">
                  Konum: {f.localization.kind === 'pixel' ? `model kaynaklı · kesit/kare ${f.localization.frame + 1} · x ${f.localization.box.x}, y ${f.localization.box.y}, ${f.localization.box.w}×${f.localization.box.h} px${f.localization.mask ? ' · maske' : ''}` : f.localization.kind === 'point' ? 'model kaynaklı · nokta' : 'konum yok (yalnızca sınıf)'}
                </p>
                <p className="mt-0.5" data-testid="inside-depth" data-depth={insideCapability(f).depth}>
                  İçine gir derinliği: {INSIDE_DEPTH_TR[insideCapability(f).depth]}
                </p>
                </details>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {insideCapability(f).node && (
                    <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => go(insideRoute(insideCapability(f).node!.id))} data-testid="inside-button">
                      İçine gir · {insideCapability(f).node!.nameTr}
                    </button>
                  )}
                  {organ && GRAPH.node(organ) && (
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => go({ name: 'organ', id: organ })}>
                      Organ sayfası · {GRAPH.node(organ)!.nameTr}
                    </button>
                  )}
                  {f.anatomicalStructure?.structure && (
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => go(f.anatomicalStructure?.part ? { name: 'body', structure: f.anatomicalStructure.structure!, part: f.anatomicalStructure.part } : { name: 'body', structure: f.anatomicalStructure!.structure! })}
                    >
                      <BodyIcon size={13} /> 3B anatomide göster
                    </button>
                  )}
                  {last && GRAPH.node(last) && (
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onRegion(last)}>
                      Bu bölge ne?
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {structures.length > 0 && (
        <div aria-label="Modelin bölütlediği yapılar">
          <p className="text-sm font-medium text-fg">Bölütlenen yapılar (normal anatomi; bulgu değildir)</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {structures.map((st) => (
              <li key={st.id} data-testid="model-structure">
                <button type="button" className="rounded-full border border-[#a78bfa]/50 px-2.5 py-0.5 text-xs text-fg hover:border-[#a78bfa]" onClick={() => st.anatomicalStructure && go({ name: 'organ', id: st.anatomicalStructure.path[0] ?? st.anatomicalStructure.structure! })}>
                  {st.name}
                  {st.measurements[0] ? <span className="text-fg-muted"> · {st.measurements[0].value}{st.measurements[0].unit}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {scored.map((r) => (
        <details key={r.model.manifest.id} className="text-xs text-fg-muted">
          <summary className="cursor-pointer text-fg">Tüm model skorları · {r.model.manifest.name}</summary>
          <p className="mt-1">Skorlar modelin çalışma noktasına göre ölçeklidir (0,50 ≈ çalışma noktası); ≥ {r.model.manifest.scoreThreshold.toLocaleString('tr-TR')} olanlar “modelin işaret ettiği” diye listelenir. Olasılık ya da tanı değildir.</p>
          {r.model.manifest.photoMetrics && (
            <div className="mt-1" data-testid="photo-metrics">
              <p className="text-fg">Fotoğrafta ve ekran görüntüsünde ne kadar güvenilir? (ölçüm: {r.model.manifest.photoMetrics.n} etiketli grafi, pnömoni ↔ bulgusuz)</p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                {Object.entries(r.model.manifest.photoMetrics.conditions).map(([k, c]) => (
                  <li key={k}>
                    {c.name}: ayırıcılık AUC {c.auc.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ({c.aucCi95.map((v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })).join('–')})
                    {k !== 'original' ? ` · orijinale göre skor farkı ${c.meanAbsDiff.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} · en az bir bulgunun kararı değişen görüntü %${Math.round(c.anyFlagChanged * 100)}` : ''}
                    {c.aucWithoutRegion !== undefined && k !== 'original' ? ` · röntgen alanı bulunmadan AUC ${c.aucWithoutRegion.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : ''}
                  </li>
                ))}
              </ul>
              <p className="mt-0.5 text-fg-faint">{r.model.manifest.photoMetrics.source}</p>
            </div>
          )}
          <ul className="mt-1 space-y-0.5" aria-label="Model skorları" data-testid="model-scores">
            {r.extras!.scores!.map((sc) => (
              <li key={sc.key} className="flex items-center gap-2">
                <span className="w-56 shrink-0 truncate text-fg">{sc.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <span className="block h-full" style={{ width: `${Math.round(sc.score * 100)}%`, background: sc.score >= r.model.manifest.scoreThreshold ? MODEL_COLOR : 'var(--color-ink-500)' }} />
                </span>
                <span className="w-10 text-right tabular-nums">{sc.score.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <details className="text-xs text-fg-muted">
        <summary className="cursor-pointer text-fg">Model kökeni (provenance)</summary>
        {runs.map(({ model }) => {
          const m = model.manifest;
          return (
            <div key={m.id} className="mt-1.5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" aria-label="Model kökeni">
                <dt className="text-fg-faint">Model</dt>
                <dd>
                  {m.name} · {m.version} ({m.id}){model.origin === 'bundled' ? ' · uygulamayla gelir' : ' · kullanıcı kurdu'}
                </dd>
                <dt className="text-fg-faint">Görev</dt>
                <dd>{m.task}</dd>
                <dt className="text-fg-faint">SHA-256</dt>
                <dd className="break-all font-mono">{m.sha256}</dd>
                <dt className="text-fg-faint">Lisans</dt>
                <dd>{m.license}</dd>
                <dt className="text-fg-faint">Kaynak</dt>
                <dd className="break-all">{m.source}</dd>
                <dt className="text-fg-faint">Kullanım amacı</dt>
                <dd>{m.intendedUse}</dd>
                {m.validation && (
                  <>
                    <dt className="text-fg-faint">Doğrulama</dt>
                    <dd>{m.validation}</dd>
                  </>
                )}
                <dt className="text-fg-faint">Çalıştığı yer</dt>
                <dd>Bu cihaz (ONNX Runtime, WASM); görüntü hiçbir yere gönderilmedi</dd>
              </dl>
              {m.limitations.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {m.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </details>
    </section>
  );
}

export function AnalysisCard({
  info,
  bytes,
  dicom,
  noteFileId,
  stored,
  storedReview,
  reportFindings,
  labsAvailable,
  previousAvailable,
  files = 1,
  onHeadLike,
  onReview,
  onCategory,
}: {
  info: FileInfo;
  bytes: Bytes;
  dicom: DicomInfo | null;
  noteFileId: string;
  stored?: StoredAnalysis;
  /** Sağ-sol ön kontrolün kullanıcının sonuçlarına eklenmiş özeti. */
  storedReview?: StoredReview;
  /** Aynı çalışmanın raporundan okunan bulgular (ayrı kaynak). */
  reportFindings: ReportFinding[];
  labsAvailable: boolean;
  previousAvailable: boolean;
  /** Aynı seriden yüklenen dosya sayısı (DICOM). */
  files?: number;
  /** Kesitler baş kesitine benziyorsa (bölge önerisi için). */
  onHeadLike?: () => void;
  /** Belge türünü değiştir (ör. otomatik "MR" sanılan röntgen ekran görüntüsü → Röntgen). */
  onCategory?: (c: DocCategory) => void;
  /** Ön kontrol özeti (sistematik değerlendirme için). */
  onReview?: (r: { compared: number; flagged: number; panels: number }) => void;
}) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const context = useMemo(() => contextFor(info, dicom, files), [info, dicom, files]);
  const reportAvailable = reportFindings.length > 0;
  const { run, raster, state } = useImageAnalysis(info, bytes, context, reportAvailable, true);
  const [regionInfo, setRegion] = useState<string | null>(null);
  const models = useLocalModels();
  const modality = run?.result.modality;
  // Orkestrasyon: bu modaliteye uygun TÜM 2B yerel modeller sırayla çalışır (ör. sınıflandırıcı + anatomi);
  // 3B hacim modelleri tek görüntüde değil, DICOM serisinde (SeriesModelPanel) çalışır.
  // Örüntü modelleri yalnızca kendi bölgelerinde (ör. beyin) çalışır; bölge bilinmiyorsa çalışır (eğitim dışı kapısı korur).
  const region = run?.anatomy?.structure;
  const headLike = run?.result.extent?.headLike === true;
  const models2d = useMemo(
    () =>
      modality && models
        ? models.filter((m) => {
            if (m.manifest.task === 'segmentation-3d' || !m.manifest.modalities.includes(modality)) return false;
            const regions = m.manifest.pattern?.regions;
            return !regions?.length || !region || regions.includes(region) || (headLike && regions.includes('brain'));
          })
        : [],
    [models, modality, region, headLike],
  );
  const volumeModel = useMemo(() => (modality && models ? models.find((m) => m.manifest.task === 'segmentation-3d' && m.manifest.modalities.includes(modality)) : undefined), [models, modality]);
  const candidate = models2d[0];
  const [modelState, setModelState] = useState<ModelState>({ status: 'idle' });
  const [runKey, setRunKey] = useState(0);
  const cancel = useRef<() => void>(() => undefined);

  // Kurulu bir yerel model varsa bu görüntüde (işçide, cihazda) çalıştırılır; iptal edilebilir.
  useEffect(() => {
    if (!run || !raster || run.route !== 'image-analysis' || models === null) return;
    if (!models2d.length) {
      setModelState(volumeModel ? { status: 'volume-only', model: volumeModel } : { status: 'none' });
      return;
    }
    const ctrl = new AbortController();
    cancel.current = () => ctrl.abort();
    const input = modelRaster(raster, dicom);
    void (async () => {
      const runs: RunInfo[] = [];
      for (const [index, m] of models2d.entries()) {
        setModelState({ status: 'loading', model: m, index, total: models2d.length });
        const result = await runLocalModel(m.manifest, input, run.result.modality, context, {
          documentId: info.id,
          signal: ctrl.signal,
          onProgress: (p: ModelProgress) => !ctrl.signal.aborted && setModelState({ status: p, model: m, index, total: models2d.length }),
        });
        if (ctrl.signal.aborted) return;
        runs.push({ model: m, result, ...(result.extras ? { extras: result.extras } : {}) });
      }
      const ran = runs.filter((r): r is RunInfo & { result: Extract<ModelRun, { status: 'ran' }> } => r.result.status === 'ran');
      const merged: ModelRun = ran.length
        ? { status: 'ran', provider: ran.map((r) => r.result.provider).join(' + '), model: ran[0]!.result.model, findings: ran.flatMap((r) => r.result.findings), structures: ran.flatMap((r) => r.result.structures ?? []) }
        : runs[0]!.result;
      const disagreements = modelDisagreements(
        ran.map((r) => ({
          modelId: r.model.manifest.id,
          modelName: r.model.manifest.name,
          findings: r.result.findings,
          structures: r.result.structures ?? [],
          ...(r.extras?.scores ? { scores: r.extras.scores } : {}),
          ...(r.extras?.ctr ? { measures: { ctr: r.extras.ctr.ratio } } : {}),
          segmentable: [...new Set(r.model.manifest.labels.filter((l) => l.kind === 'anatomy' && l.structure).map((l) => l.structure!))],
        })),
      );
      setModelState({ status: 'done', model: models2d[0]!, result: merged, runs, disagreements });
    })();
    return () => ctrl.abort();
  }, [run, raster, models2d, volumeModel, models, context, info.id, runKey, dicom]);

  const modelRan = modelState.status === 'done' && modelState.result.status === 'ran' ? modelState.result : null;

  // Ön inceleme + (varsa) model bulguları tek kayıt: Vücudum, organ sayfaları ve akışlar buradan okur.
  const fullRun: ImageAnalysisRun | null = useMemo(() => {
    if (!run) return null;
    if (!modelRan || modelState.status !== 'done') return run;
    const m = modelState.model.manifest;
    return {
      ...run,
      kind: 'model',
      modelFindings: modelRan.findings,
      ...(modelRan.structures?.length ? { modelStructures: modelRan.structures } : {}),
      modelInfo: { id: m.id, name: m.name, version: m.version, sha256: m.sha256, license: m.license, at: new Date().toISOString() },
    };
  }, [run, modelRan, modelState]);

  const savedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!fullRun || fullRun.route !== 'image-analysis') return;
    if (modelState.status === 'loading' || modelState.status === 'inference' || modelState.status === 'idle') return;
    const base = toStoredAnalysis(fullRun, info.id);
    const next: StoredAnalysis =
      modelState.status === 'done'
        ? {
            ...base,
            models: modelState.runs.filter((r) => r.result.status === 'ran').map((r) => ({ id: r.model.manifest.id, name: r.model.manifest.name, version: r.model.manifest.version, sha256: r.model.manifest.sha256, license: r.model.manifest.license })),
            ...(modelState.disagreements.length ? { disagreements: modelState.disagreements.map((d) => d.text) } : {}),
          }
        : base;
    const key = (a: StoredAnalysis) => JSON.stringify([a.modality, a.status, a.structure, a.model.version, a.observations.map((o) => o.text), a.modelInfo?.sha256, (a.modelFindings ?? []).map((f) => f.finding)]);
    const sig = key(next);
    if ((stored && key(stored) === sig) || savedFor.current === sig) return;
    savedFor.current = sig;
    void saveAnalysis(vault, noteFileId, next).then(bump, () => undefined);
  }, [fullRun, modelState, stored, vault, noteFileId, info.id, bump]);

  // Bu çalışmanın görüntü + rapor uyumu (yalnızca bu belge için birleşik model).
  const local: HealthModel | null = useMemo(
    () => (fullRun ? buildHealthModel({ images: [{ run: fullRun, documentId: info.id, studyKey: 'this' }], reports: reportAvailable ? [{ findings: reportFindings, studyKey: 'this' }] : [], labs: [] }) : null),
    [fullRun, reportFindings, reportAvailable, info.id],
  );
  const gray = useMemo(() => (raster ? { width: raster.width, height: raster.height, data: raster.gray } : null), [raster]);

  if (state === 'unsupported') return null;

  const running = state === 'idle' || state === 'reading' || state === 'analyzing';
  const findings = run ? run.result.observations.filter((o) => o.kind !== 'quality' && o.kind !== 'structure-presence') : [];
  const technical = run ? run.result.observations.filter((o) => o.kind === 'quality' || o.kind === 'structure-presence') : [];
  const anatomyName = run?.anatomy?.location ? GRAPH.node(run.anatomy.location.path[run.anatomy.location.path.length - 1] ?? '')?.nameTr ?? run.anatomy.structure : undefined;
  const modalityLabel = run?.modality ? MODALITY_LABEL[run.modality.primary.modality] : undefined;
  const asym = findings.filter((o) => o.kind === 'asymmetry').length;
  const hr = findings.find((o) => o.kind === 'heart-rate')?.measurement;
  const symmetry = run?.result.adapterId === 'cross-sectional-symmetry';
  const precheckRan = Boolean(run && run.result.status !== 'UNAVAILABLE');
  const st = analysisState({ modelRan: Boolean(modelRan), precheckRan });
  // MR/BT fotoğrafı ya da tek kesit, yerel model çalışmadı: görüntüden bölge/bulgu söylenmez; okuma yolu gösterilir.
  const photoOnly = symmetry && !modelRan;
  // Örüntü modeli fotoğrafta da çalışır; yine de kesin okumanın yolu rapor ve DICOM serisidir (rehber görünür kalır).
  const patternRan = modelState.status === 'done' && modelState.runs.some((r) => r.extras?.pattern);
  // Tür görüntüden tahmin edildi ve beyin MR modeli görüntüyü "beyin MR'ı değil" diye reddetti: göğüs röntgeninin
  // ekran görüntüsü olabilir (simetrik göğüs, koyu arayüz) → türü Röntgen yapmayı öner.
  const patternRejected = modelState.status === 'done' && modelState.runs.some((r) => r.extras?.pattern && r.extras.pattern.panels.length > 0 && r.extras.pattern.panels.every((p) => p.ood));
  const suggestXray = Boolean(onCategory && patternRejected && run?.modality?.primary.source === 'IMAGE_ANALYSIS' && info.category !== 'xray');
  const brainStudy = run?.anatomy?.structure === 'brain' || run?.result.extent?.headLike === true;
  const outcome = !run
    ? ''
    : asym
      ? `Sağ-sol parlaklık karşılaştırması: ${asym} görüntü asimetrisi gözlemi (tıbbi bulgu değil; bir beyin bölgesine eşlenmez).`
      : hr
        ? `Kalp hızı yaklaşık ${hr.value}/dk`
        : findings.length
          ? `${findings.length} ölçüm`
          : symmetry && precheckRan
            ? 'Sağ-sol simetri ön kontrolünde belirgin fark görülmedi.'
            : precheckRan
              ? 'Görüntüden ölçüm çıkarılamadı.'
              : 'Görüntü saklandı; görüntüleyicide açıp inceleyebilir, ölçebilirsin.';
  const obsMarks: Mark[] = run && !symmetry ? run.result.observations.flatMap((o) => (o.localization.kind === 'pixel' ? [{ box: o.localization.box, color: '#a78bfa' }] : [])) : [];
  const modelBusy = modelState.status === 'loading' || modelState.status === 'inference';

  return (
    <section className="space-y-4 card p-4 md:p-5" aria-label="Ham görüntü analizi">
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
              <p className="text-[15px] font-medium text-fg" data-testid="analysis-state" data-state={st}>
                {st === 'model' ? 'Yerel tıbbi AI modeli ile analiz edildi' : st === 'precheck' ? 'Görüntü ön incelemesi yapıldı' : 'Bu modalite için bu cihazda tıbbi AI modeli bulunmuyor'}
              </p>
              {st === 'none' ? (
                <StatusPill status="UNAVAILABLE" />
              ) : st === 'precheck' ? (
                <span className="rounded-full border border-ink-500 px-2 py-0.5 text-[11px] text-fg-muted">ön inceleme · tıbbi model değil</span>
              ) : (
                <span className="rounded-full border border-[#22d3ee]/50 px-2 py-0.5 text-[11px] text-[#22d3ee]">yerel model · cihazda</span>
              )}
            </div>
            <p className="mt-1 text-[15px] text-fg">
              {modalityLabel ? `Bu bir ${modalityLabel} görüntüsü gibi görünüyor` : 'Görüntü türü belirlenemedi'}
              {anatomyName ? ` · ${anatomyName}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-fg-faint">
              {run.modality ? `Tür: ${ORIGIN[run.modality.primary.source] ?? SOURCE_LABEL[run.modality.primary.source]}` : ''}
              {run.anatomy?.source ? ` · Bölge: ${ORIGIN[run.anatomy.source] ?? SOURCE_LABEL[run.anatomy.source]}` : ''}
              {` · İnceleme kapsamı: ${run.coverage.label}`}
            </p>
            {run.modality?.conflict && <p className="mt-1 text-sm text-caution-fg">{run.modality.conflict}</p>}
            {modelBusy && (
              <div className="mt-2 flex items-center gap-2 text-sm text-fg-muted" aria-live="polite" data-testid="model-progress">
                <SpinnerIcon size={14} /> {modelState.status === 'loading' ? `${modelState.model.manifest.name} yükleniyor…` : `${modelState.model.manifest.name} görüntüyü inceliyor (cihazda)…`}
                {modelState.total > 1 ? ` (${modelState.index + 1}/${modelState.total})` : ''}
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-1 text-xs"
                  onClick={() => {
                    cancel.current();
                    if (modelState.status === 'loading' || modelState.status === 'inference') setModelState({ status: 'cancelled', model: modelState.model });
                  }}
                >
                  İptal
                </button>
              </div>
            )}
            {modelState.status === 'cancelled' && (
              <p className="mt-2 text-sm text-fg-muted">
                Model çalıştırma iptal edildi.{' '}
                <button type="button" className="text-accent underline" onClick={() => setRunKey((k) => k + 1)}>
                  Yeniden çalıştır
                </button>
              </p>
            )}
            {modelState.status === 'done' && modelState.result.status === 'unavailable' && <p className="mt-2 text-sm text-caution-fg">Yerel model çalıştırılamadı: {modelState.result.reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {((findings.length > 0 && !photoOnly) || (modelRan?.findings.length ?? 0) > 0) && (
                <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => document.getElementById(`bulgular-${info.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  {modelRan?.findings.length ? 'Bulguları gör' : asym ? 'Gözlemleri gör' : 'Ölçümleri gör'}
                </button>
              )}
              {run.anatomy?.structure && (
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => {
                    const l = modelRan?.findings[0]?.anatomicalStructure ?? findings[0]?.location ?? run.anatomy?.location;
                    go(l?.part ? { name: 'body', structure: l.structure ?? run.anatomy!.structure!, part: l.part } : { name: 'body', structure: run.anatomy!.structure! });
                  }}
                >
                  <BodyIcon size={15} /> Vücudumda göster
                </button>
              )}
            </div>
          </div>


          <div id={`bulgular-${info.id}`} className="scroll-mt-4 space-y-3">
            {modelRan && modelState.status === 'done' && (
              <ModelFindings result={modelRan} runs={modelState.runs} disagreements={modelState.disagreements} raster={raster} concordance={local?.modelConcordance ?? []} onRegion={setRegion} />
            )}
            {suggestXray && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-600/60 px-3 py-2 text-sm text-fg" data-testid="suggest-xray">
                <span>Bu görüntü beyin MR kesitine benzemiyor. Bir göğüs röntgeni (ya da ekran görüntüsü) ise röntgen modeliyle incelenebilir.</span>
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onCategory?.('xray')}>
                  Röntgen olarak incele
                </button>
              </div>
            )}
            {modelState.status === 'volume-only' && (
              <p className="rounded-lg border border-ink-600/60 px-3 py-2 text-sm text-fg-muted" data-testid="volume-only">
                {modelState.model.manifest.name} bu cihazda kurulu, ancak 3B bir modeldir: yalnızca DICOM serisinde (en az {modelState.model.manifest.volume?.minSlices ?? 10} kesit) çalışır. {files > 1 ? 'Seri analizi yukarıda.' : 'Bu görüntüde (fotoğraf / tek kesit) çalıştırılmadı.'}
              </p>
            )}
            {symmetry ? (
              // Sağ-sol ön kontrolü bir sonuç değil, teknik bir kontroldür: kapalı bölümde durur.
              <details className="rounded-xl border border-dashed border-ink-600 p-3" data-testid="symmetry-details">
                <summary className="cursor-pointer text-sm text-fg-muted">
                  Teknik ön kontrol: sağ-sol parlaklık karşılaştırması{asym ? ` (${asym} fark)` : ''} · tanı değildir
                </summary>
                <div className="mt-3 space-y-3">
                  {gray && <SymmetryView gray={gray} sourceId={info.id} noteFileId={noteFileId} {...(storedReview ? { stored: storedReview } : {})} {...(onHeadLike ? { onHeadLike } : {})} {...(onReview ? { onReview } : {})} />}
                  {findings.length > 0 && (
                    <ul className="space-y-2" aria-label="Görüntüden çıkan gözlemler">
                      {findings.map((o, i) => (
                        <FindingCard key={o.id} o={o} swatch={o.kind === 'asymmetry' ? BOX_COLORS[i % BOX_COLORS.length] : undefined} modality={modalityLabel} concordance={local?.concordance.find((c) => c.observation.id === o.id)?.text} model={local} onRegion={setRegion} />
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            ) : (
              <>
                {raster && <Overlay raster={raster} marks={obsMarks} caption="Mor kutu: ön incelemenin ölçüm yaptığı gerçek piksel alanı." />}
                {findings.length > 0 && (
                  <ul className="space-y-2" aria-label="Görüntüden çıkan gözlemler">
                    {findings.map((o) => (
                      <FindingCard key={o.id} o={o} modality={modalityLabel} concordance={local?.concordance.find((c) => c.observation.id === o.id)?.text} model={local} onRegion={setRegion} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Görüntü hakkında notlar: kapsam, ön inceleme, rapor durumu — cevabın (model bulguları) arkasında. */}
          <div className="space-y-1" data-testid="analysis-notes">
            {run.coverage.limited && <p className="text-sm text-fg-muted">{run.coverage.limited}</p>}
            {modelRan && <p className="text-[15px] text-fg">{modelRan.findings.length ? `Model ${modelRan.findings.length} bulgu bildirdi.` : 'Model eşik üstü bulgu bildirmedi.'}</p>}
            {(precheckRan || st !== 'model') && <p className="text-[15px] text-fg">{st === 'model' && precheckRan ? `Ön inceleme: ${outcome}` : outcome}</p>}
            {symmetry && !asym && precheckRan && <p className="text-sm text-fg-muted">Bu sonuç görüntünün normal olduğunu göstermez.</p>}
            <p className="text-sm text-fg-muted">
              {reportAvailable ? 'Rapor da var: rapordaki bulgular ayrı kaynak olarak gösterilir.' : 'Rapor yok: sonuçlar yalnızca görüntünün kendisine dayanıyor.'}
              {st === 'precheck' ? ` ${ANALYSIS_STATE_TEXT.precheck.split('. ')[1]}` : ''}
              {st === 'precheck' ? ' Bu bir tıbbi görüntü tanı modeli değildir.' : ''}
            </p>
          </div>
          {precheckRan && run.result.capabilities.length > 0 && (
            <ImageCapabilityPanel
              run={run}
              {...(candidate
                ? { model: { name: models2d.map((m) => `${m.manifest.name} ${m.manifest.version}`).join(' + '), ran: Boolean(modelRan), task: candidate.manifest.task } }
                : volumeModel
                  ? { model: { name: `${volumeModel.manifest.name} — yalnızca DICOM serisinde (3B); bu görüntüde çalıştırılmadı`, ran: false, task: volumeModel.manifest.task } }
                  : {})}
            />
          )}
          {/* Okuma rehberi cevabın ARKASINDA: önce modelin söylediği, sonra kesin okuma için ne eklenmeli. */}
          {(photoOnly || (symmetry && patternRan)) && <ReadGuide brain={brainStudy} reportAvailable={reportAvailable} patternRan={patternRan} {...(volumeModel ? { volumeModel: volumeModel.manifest.name } : {})} />}
          <details className="rounded-xl border border-dashed border-ink-600 p-3">
            <summary className="cursor-pointer text-sm text-fg-muted">Nasıl analiz edildi?</summary>
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
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" aria-label="Model durumu">
                <dt className="text-fg-faint">Model</dt>
                <dd className="text-fg">{run.result.model.name}</dd>
                <dt className="text-fg-faint">Tür</dt>
                <dd className="text-fg-muted">{run.result.model.kind === 'heuristic' ? 'Heuristic (kural tabanlı; tıbbi AI modeli değil)' : 'Öğrenilmiş model'}</dd>
                <dt className="text-fg-faint">Versiyon</dt>
                <dd className="text-fg-muted">{run.result.model.version}</dd>
                <dt className="text-fg-faint">Cihazda</dt>
                <dd className="text-fg-muted">{run.result.model.local ? 'Evet' : 'Hayır (harici servis)'}</dd>
                <dt className="text-fg-faint">Yerel tıbbi AI modeli</dt>
                <dd className="text-fg-muted">{candidate ? `${candidate.manifest.name} ${candidate.manifest.version} (${candidate.manifest.task})` : 'Bu modalite için bu cihazda kurulu değil'}</dd>
                <dt className="text-fg-faint">Sekans</dt>
                <dd className="text-fg-muted">{run.sequence.text}</dd>
              </dl>
              <p className="text-fg-muted">{run.result.summary}</p>
              {symmetry && (
                <p className="text-fg-faint">
                  Ön kontrol nasıl okunur: işaretli alan yalnızca "iki taraf burada farklı görünüyor" demektir. Sağlıklı kişilerde de hafif farklar olur; baş eğikliği, kesit düzeyi,
                  sinüsler, fotoğraf açısı ve ekran yansıması farkı büyütebilir. Radyolojik düzende görüntünün solu çoğunlukla hastanın sağıdır.
                </p>
              )}
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
      <RegionSheet id={regionInfo} onClose={() => setRegion(null)} />
    </section>
  );
}

/**
 * MR/BT fotoğrafında (model yok) sonucun nasıl GERÇEKTEN okunacağı: rapor metni (cümle cümle, sade dil,
 * beyin haritası) ya da DICOM serisi (yerel 3B model). Görüntüden bölge/bulgu uydurulmaz.
 */
function ReadGuide({ brain, reportAvailable, volumeModel, patternRan = false }: { brain: boolean; reportAvailable: boolean; volumeModel?: string; patternRan?: boolean }) {
  return (
    <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-3.5" data-testid="read-guide" data-pattern={patternRan ? 'ran' : 'none'}>
      <p className="text-[15px] font-medium text-fg">{patternRan ? 'Model ön bilgi verdi; kesin okuma rapordan ve DICOM serisinden yapılır' : 'Bu fotoğraftan “şurada şu var” diye sonuç çıkarılmaz'}</p>
      <p className="mt-1 text-sm text-fg-muted">
        {patternRan
          ? 'Yerel örüntü modeli bu kesitleri sağlıklı referans kesitleriyle karşılaştırdı ve hangi örüntüye benzediğini olasılıklarla gösterdi (aşağıda). Bu bir ön bilgidir, kesin sonuç değildir; model yalnızca eğitildiği birkaç örüntüyü tanır.'
          : 'Bu cihazda bu tür görüntüde hastalık okuyan doğrulanmış bir model yok. Fotoğraftan bölge ya da bulgu söylemek uydurma olur; bu yüzden söylemiyoruz.'}
      </p>
      <p className="mt-2 text-sm font-medium text-fg">Sonucunu okuyabilmemiz için:</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-fg">
        <li>
          {reportAvailable ? 'Raporun okundu' : 'Radyoloji raporunu ekle (kâğıdın fotoğrafı ya da PDF)'}: her cümle sade dille anlatılır ve {brain ? 'beynin ilgili bölgesine' : 'vücudunda ilgili organa'} yerleşir.
        </li>
        <li>CD/DVD'deki DICOM klasörünü ya da ZIP'ini ekle: {volumeModel ?? 'yerel 3B model'} cihazda çalışır ve organları senin görüntünden 3B çıkarır.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {reportAvailable ? (
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => go(brain ? { name: 'brain' } : { name: 'mybody' })}>
            {brain ? 'Raporumu beyin haritasında gör' : 'Raporumu vücudumda gör'}
          </button>
        ) : (
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => go({ name: 'add' })}>
            Raporu ekle
          </button>
        )}
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => go({ name: 'add' })}>
          DICOM / ZIP ekle
        </button>
      </div>
    </div>
  );
}

function confidenceWords(c: ImageObservation['confidence']): string {
  if (c.kind === 'measured') return 'ölçüm';
  if (c.kind === 'reported') return 'raporda yazıyor';
  return c.value >= 0.6 ? 'güven: orta-yüksek' : c.value >= 0.4 ? 'güven: orta' : 'güven: düşük';
}

/** Basit bulgu kartı: yer, ne görüldü, kaynak, [İncele]. Ayrıntılar (güven, konum varsayımları, sınırlar) açılınca. */
function FindingCard({ o, swatch, modality, concordance, model, onRegion }: { o: ImageObservation; swatch?: string; modality?: string; concordance?: string; model: HealthModel | null; onRegion: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const last = o.location?.path[o.location.path.length - 1];
  const title = o.kind === 'asymmetry' ? o.text.replace(/^Görüntü asimetrisi gözlemi — /, '') : o.measurement ? `${o.measurement.name}: ${o.measurement.value}${o.measurement.unit}` : o.text;
  const what = o.kind === 'asymmetry' ? 'Görüntü asimetrisi gözlemi (karşı tarafa göre farklı parlaklık) · tıbbi bulgu değil' : o.kind === 'rhythm' ? o.text.split('.')[0] : undefined;
  return (
    <li className="rounded-xl border border-ink-600/60 bg-ink-900/30 p-3.5">
      <p className="text-[15px] font-medium text-fg">
        {swatch && <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: swatch }} aria-hidden="true" />}
        {title}
      </p>
      {what && <p className="mt-0.5 text-sm text-fg-muted">{what}</p>}
      <p className="mt-1 text-xs text-fg-faint">Kaynak: {modality ?? 'görüntü'} görüntüsü (kural tabanlı ön kontrol) · {confidenceWords(o.confidence)}</p>
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
