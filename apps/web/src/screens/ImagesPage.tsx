/**
 * Görüntüler: tüm görüntüleme çalışmaları tek listede. Her satır üç dürüst durumdan birini taşır
 * (yerel tıbbi AI modeli / ön inceleme / model yok), raporun ayrı bir kaynak olduğunu ve rapor ile
 * model arasında çelişki varsa bunu gösterir. Satıra dokununca görüntüleyici açılır.
 */
import { analysisState, ANALYSIS_STATE_TEXT, findingClass } from '@kh/analysis';
import { go } from '../state/router';
import { useHealthModel } from '../lib/analysisBridge';
import { CATEGORY_LABEL, regionByKey } from '../lib/imaging';
import { formatDate } from '../lib/format';
import { TONE } from '../lib/tone';
import { ChevronRightIcon, PlusIcon, ScanIcon, SpinnerIcon } from '../components/icons';

const STATE_STYLE = {
  model: { label: 'Yerel AI modeli', icon: '◆', cls: 'border-[#a78bfa]/50 bg-[#a78bfa]/10 text-[#a78bfa]' },
  precheck: { label: 'Ön inceleme · tıbbi model değil', icon: '◇', cls: `${TONE.uncertain.chip}` },
  none: { label: 'Görüntü analizi yok', icon: '○', cls: 'border-ink-600 text-fg-muted' },
} as const;

export function ImagesPage() {
  const { model, studies } = useHealthModel();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Görüntüler</h1>
          <p className="mt-1 text-sm text-fg-muted">MR, BT, röntgen, ultrason, EKG, patoloji… Görüntü ve rapor ayrı kaynaklar olarak gösterilir.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => go({ name: 'add' })}>
          <PlusIcon size={16} /> Görüntü ekle
        </button>
      </div>

      {studies === null ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <SpinnerIcon size={14} /> Yükleniyor…
        </p>
      ) : studies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 p-6 text-center" data-testid="no-images">
          <p className="text-[15px] text-fg">Henüz görüntüleme yok.</p>
          <p className="mt-1 text-sm text-fg-muted">DICOM klasörü, MR/BT fotoğrafı ya da görüntüleme raporu ekleyebilirsin. Her şey yalnızca bu cihazda işlenir.</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Görüntüleme çalışmaları">
          {studies.map((st) => {
            const a = st.note?.analysis;
            const vol = st.note?.volume;
            // Seri (3B) model sonuçları da sayılır: anatomi bölütlemesi + patoloji modellerinin bulguları
            const volN = [vol, ...(st.note?.pathology ?? [])].reduce((n, v) => n + (v?.structures.filter((x) => findingClass(x) === 'finding').length ?? 0), 0);
            const modelN = (a?.modelFindings?.length ?? 0) + volN;
            const state = a || vol ? analysisState({ modelRan: a?.kind === 'model' || modelN > 0 || Boolean(vol), precheckRan: Boolean(a) }) : 'none';
            const s = STATE_STYLE[state];
            const conflicts = model?.modelConcordance.filter((c) => c.relation === 'contradicted-by-report' && st.files.some((f) => f.id === c.finding.provenance.documentId)).length ?? 0;
            const region = st.region ? regionByKey.get(st.region)?.label : undefined;
            return (
              <li key={st.key}>
                <button type="button" className="flex w-full items-start gap-3 card p-3.5 text-left transition hover:border-accent/50" onClick={() => go({ name: 'document', id: st.head.id })} data-testid="image-study">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-high/25 bg-high/8 text-high">
                    <ScanIcon size={19} />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-[15px] font-medium text-fg">
                      {CATEGORY_LABEL[st.category]}
                      {region ? ` · ${region}` : ''}
                    </span>
                    <span className="block text-xs text-fg-muted">
                      {st.dateKnown ? formatDate(st.date) : `yüklendi ${formatDate(st.date)}`} · {st.files.length > 1 ? `${st.files.length} dosya` : st.head.displayName}
                    </span>
                    <span className="flex flex-wrap gap-1.5 pt-0.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${s.cls}`} title={a || vol ? ANALYSIS_STATE_TEXT[state] : 'Bu görüntü henüz incelenmedi.'} data-state={state}>
                        <span aria-hidden="true">{s.icon}</span> {s.label}
                        {modelN ? ` · ${modelN} bulgu` : ''}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${st.findings.length || st.linked ? TONE['report-derived'].chip : 'border-ink-600 text-fg-faint'}`}>
                        {st.findings.length ? `Rapor · ${st.findings.length} cümle` : st.linked ? 'Rapor (bağlı belge)' : 'Rapor yok'}
                      </span>
                      {conflicts > 0 && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE.attention.chip}`}>
                          <span aria-hidden="true">⚠</span> Rapor ↔ model çelişkisi
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRightIcon size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
