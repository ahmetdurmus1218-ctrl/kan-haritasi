import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GROUP_LABEL,
  type LabTestDef,
  type Sex,
  TESTS,
  formatNumber,
  normalizeUnit,
  testByKey,
} from '@kh/catalog';
import { type MissingValue, type ReportDraft, type SourceBox, type UnrecognizedRow, needsReview, parseRange } from '@kh/parser';
import type { Bytes, DocCategory, FileInfo } from '@kh/vault';
import { CATEGORY_LABEL, type ImagingCategory } from '../lib/imaging';
import { classifyPhoto } from '../lib/photo';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { go } from '../state/router';
import type { ExtractProgress } from '../lib/extract';
import { OcrError, type OcrStage, cancelOcr } from '../lib/ocr';
import {
  type ReviewRow,
  type StoredReport,
  addAlias,
  draftToReview,
  isSavable,
  loadAliases,
  loadSex,
  reevaluate,
  reportForFile,
  saveReport,
  saveSex,
  toStoredResult,
  unitLabel,
} from '../lib/reports';
import { userMessage } from '../lib/messages';
import { formatDate } from '../lib/format';
import { Banner, StatusTag } from '../components/ui';
import { ISSUE_TEXT, StatusPill } from '../components/results';
import { AlertIcon, BodyIcon, CheckIcon, ChevronRightIcon, EyeIcon, RefreshIcon, SpinnerIcon, TrashIcon } from '../components/icons';

export type Highlight = { key: string; box: SourceBox } | null;

function canonicalKey(test: LabTestDef): string {
  return Object.entries(test.conversions).find(([, c]) => c[0] === 1 && !c[1])?.[0] ?? Object.keys(test.conversions)[0] ?? '';
}

function editOf(row: ReviewRow): NonNullable<ReviewRow['edit']> {
  const test = testByKey.get(row.testKey);
  // Aralık düzenleme kutuları rapor biriminde gösterilir; kayıtlı değerler kanonik birimdedir.
  const conv = test && row.unitKey ? test.conversions[row.unitKey] : undefined;
  const fmt = (v: number) => v.toLocaleString('tr-TR', { useGrouping: false, maximumFractionDigits: 6 });
  const back = (v: number | undefined) => (v === undefined ? '' : fmt(conv ? Number(((v - (conv[1] ?? 0)) / conv[0]).toPrecision(6)) : v));
  return {
    value: row.valueText || (Number.isFinite(row.value) ? fmt(row.value) : ''),
    unitKey: row.unitKey ?? (test ? canonicalKey(test) : null),
    refMin: row.refSource === 'report' ? back(row.refMin) : '',
    refMax: row.refSource === 'report' ? back(row.refMax) : '',
  };
}

const rowId = (r: ReviewRow, i: number) => `${r.testKey}-${i}`;

// ---------------------------------------------------------------------------------------------

const IMAGING_CHOICES: ImagingCategory[] = ['mr', 'ct', 'xray', 'us', 'other'];

/** Tahlil olarak yüklenmiş bir görüntüleme belgesini tek dokunuşla doğru türe taşır. */
function ImagingChoice({ text, onChoose, onLab }: { text: string; onChoose: (c: DocCategory) => void; onLab?: () => void }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-high/30 bg-high/8 p-3.5 text-sm">
      <p className="leading-relaxed">{text}</p>
      <div className="flex flex-wrap gap-1.5">
        {IMAGING_CHOICES.map((c) => (
          <button key={c} type="button" className="rounded-full border border-ink-500 px-3 py-1 text-xs hover:border-accent/50 hover:text-fg" onClick={() => onChoose(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {onLab && (
        <button type="button" className="text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline" onClick={onLab}>
          Hayır, tahlil raporu olarak oku
        </button>
      )}
    </div>
  );
}

export function ReportPanel({
  info,
  bytes,
  highlight,
  onHighlight,
  onCategoryChange,
}: {
  info: FileInfo;
  bytes: Bytes;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
  /** Belge aslında bir görüntüleme (MR, röntgen…) ise türünü değiştirir. */
  onCategoryChange?: (c: DocCategory) => void;
}) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const [mode, setMode] = useState<'loading' | 'saved' | 'extracting' | 'review' | 'error' | 'film'>('loading');
  const [saved, setSaved] = useState<StoredReport | null>(null);
  const [draft, setDraft] = useState<{ rows: ReviewRow[]; unrecognized: UnrecognizedRow[]; missing?: MissingValue[]; meta: Pick<ReportDraft, 'reportDate' | 'labName' | 'method'> } | null>(null);
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sex, setSex] = useState<Sex>('unspecified');

  const analyze = useCallback(async () => {
    setMode('extracting');
    setError(null);
    setProgress(null);
    try {
      const [s, aliases] = await Promise.all([loadSex(vault), loadAliases(vault)]);
      setSex(s);
      // PDF.js ve OCR yalnızca okuma gerektiğinde yüklenir.
      const { extractDraft } = await import('../lib/extract');
      const d = await extractDraft(info, bytes, { sex: s, userAliases: aliases, onProgress: setProgress });
      setDraft({ rows: draftToReview(d), unrecognized: d.unrecognized, missing: d.missing, meta: { reportDate: d.reportDate, labName: d.labName, method: d.method } });
      setMode('review');
    } catch (e) {
      setError(e instanceof OcrError ? ocrMessage(e) : userMessage(e));
      setMode('error');
    }
  }, [vault, info, bytes]);

  /** Okuma yapılamadığında değerler elle girilebilir (onay ekranı boş açılır). */
  const manual = () => {
    setDraft({ rows: [], unrecognized: [], meta: { reportDate: undefined, labName: undefined, method: 'text' } });
    setMode('review');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [existing, s] = await Promise.all([reportForFile(vault, info.id), loadSex(vault)]);
      if (cancelled) return;
      setSex(s);
      if (existing) {
        setSaved(existing);
        setMode('saved');
      } else if (info.kind !== 'pdf' && onCategoryChange && (await classifyPhoto(bytes, info.mimeType)) === 'film') {
        // Koyu, gri bir fotoğraf büyük olasılıkla film/görüntüdür: uzun OCR'dan önce sor.
        if (!cancelled) setMode('film');
      } else {
        void analyze();
      }
    })().catch((e) => {
      if (!cancelled) {
        setError(userMessage(e));
        setMode('error');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, info.id, analyze]);

  const editSaved = () => {
    if (!saved) return;
    const rows: ReviewRow[] = saved.results.map((r) => ({
      testKey: r.testKey,
      loinc: r.loinc,
      rawName: r.rawName,
      valueText: formatNumber(r.value, 6),
      value: r.value,
      qualifier: r.qualifier,
      unit: r.unit,
      unitKey: r.unitKey,
      canonicalValue: r.canonicalValue,
      refMin: r.refMin,
      refMax: r.refMax,
      refMinExclusive: r.refMinExclusive,
      refMaxExclusive: r.refMaxExclusive,
      refText: r.refText,
      refSource: r.refSource,
      status: r.status,
      reportFlag: r.reportFlag,
      confidence: r.userEdited || r.verified ? 1 : (r.confidence ?? 1),
      issues: r.userEdited || r.verified ? [] : (r.issues ?? []),
      source: r.source ?? { page: 1, x: 0, y: 0, w: 0, h: 0 },
      include: true,
      userEdited: r.userEdited,
    }));
    setDraft({ rows, unrecognized: [], meta: { reportDate: saved.reportDate, labName: saved.labName, method: saved.method === 'manual' ? 'text' : saved.method } });
    setMode('review');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mode === 'loading' && (
        <div className="flex items-center gap-2 p-5 text-sm text-fg-muted">
          <SpinnerIcon size={16} /> Yükleniyor…
        </div>
      )}
      {mode === 'extracting' && <ExtractingView progress={progress} kind={info.kind} onCancel={cancelOcr} />}
      {mode === 'film' && onCategoryChange && (
        <div className="p-5">
          <ImagingChoice
            text="Bu fotoğraf bir tahlil raporundan çok bir görüntüye (röntgen, MR veya tomografi filmi) benziyor. Görüntüleme olarak işaretlersen kontrast, negatif ve döndürme araçlarıyla incelenir."
            onChoose={onCategoryChange}
            onLab={() => void analyze()}
          />
        </div>
      )}
      {(mode === 'error' || (mode === 'review' && draft && draft.rows.length === 0 && !saved)) && onCategoryChange && (
        <div className="px-5 pt-5">
          <ImagingChoice text="Tahlil değeri bulunamadı. Bu belge bir görüntüleme (MR, tomografi, röntgen, ultrason) görüntüsü ya da raporu mu?" onChoose={onCategoryChange} />
        </div>
      )}
      {mode === 'error' && (
        <div className="space-y-3 p-5">
          <Banner tone="error">{error ?? 'Rapor okunamadı.'}</Banner>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={analyze}>
              <RefreshIcon size={16} /> Tekrar dene
            </button>
            <button type="button" className="btn-ghost" onClick={manual}>
              Değerleri elle gir
            </button>
          </div>
          <p className="text-xs leading-relaxed text-fg-faint">
            Fotoğraf için ipucu: kâğıdı düz bir yüzeye koy, gölge düşmesin, yalnızca sonuç tablosunu kadraja al ve yakından çek.
          </p>
        </div>
      )}
      {mode === 'review' && draft && (
        <ReviewPanel
          key={draft.rows.length + (draft.meta.reportDate ?? '')}
          fileId={info.id}
          initial={draft}
          sex={sex}
          onSexChange={async (s) => {
            setSex(s);
            await saveSex(vault, s);
          }}
          highlight={highlight}
          onHighlight={onHighlight}
          onCancel={saved ? () => setMode('saved') : undefined}
          onSaved={(r) => {
            setSaved(r);
            setMode('saved');
            onHighlight(null);
            bump();
          }}
        />
      )}
      {mode === 'saved' && saved && <SavedResults report={saved} highlight={highlight} onHighlight={onHighlight} onReanalyze={analyze} onEdit={editSaved} />}
    </div>
  );
}

const STAGE_TEXT: Record<OcrStage, string> = {
  prepare: 'Fotoğraf hazırlanıyor (kâğıt kırpılıyor, netleştiriliyor)',
  core: 'Okuma motoru başlatılıyor (ilk seferde birkaç saniye sürebilir)',
  lang: 'Türkçe dil verisi yükleniyor',
  init: 'Okuma motoru hazırlanıyor',
  recognize: 'Metin tanınıyor',
};

export function ocrMessage(e: OcrError): string {
  const where = STAGE_TEXT[e.stage].split(' (')[0]!.toLocaleLowerCase('tr');
  if (e.code === 'CANCELLED') return 'Okuma iptal edildi.';
  if (e.code === 'STALLED') return `Görüntüden okuma "${where}" aşamasında uzun süre ilerlemedi ve durduruldu. Telefonun belleği yetmemiş olabilir; uygulamayı kapatıp açarak tekrar dene ya da daha yakından çekilmiş bir fotoğraf kullan.`;
  return `Görüntüden okuma "${where}" aşamasında başarısız oldu${e.detail ? ` (${e.detail})` : ''}. Tekrar deneyebilir ya da değerleri elle girebilirsin.`;
}

export function ExtractingView({ progress, kind, onCancel }: { progress: ExtractProgress | null; kind: FileInfo['kind']; onCancel: () => void }) {
  const [started] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.round((Date.now() - started) / 1000);
  const ocr = progress?.phase === 'ocr';
  const pct = ocr && (progress?.stage === 'recognize' || progress?.stage === 'lang') ? Math.round((progress.fraction ?? 0) * 100) : null;
  const label = ocr
    ? `${STAGE_TEXT[progress!.stage ?? 'core']}${progress!.pages > 1 ? ` · sayfa ${progress!.page}/${progress!.pages}` : ''}`
    : progress?.phase === 'parse'
      ? 'Sonuçlar eşleniyor'
      : kind === 'pdf'
        ? `PDF metni okunuyor${progress ? ` · sayfa ${progress.page}/${progress.pages}` : ''}`
        : 'Fotoğraf hazırlanıyor';
  return (
    <div className="space-y-4 p-5" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <SpinnerIcon size={16} className="text-accent" /> {label}…{pct !== null ? ` %${pct}` : ''}
      </div>
      {ocr && (
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{
              width: `${
                progress?.stage === 'recognize' ? 35 + (pct ?? 0) * 0.65 : progress?.stage === 'init' ? 30 : progress?.stage === 'lang' ? 15 + (pct ?? 0) * 0.15 : progress?.stage === 'core' ? 10 : 4
              }%`,
            }}
          />
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-fg-faint">
        <span>{seconds} sn</span>
        {ocr && (
          <button type="button" className="text-fg-muted underline-offset-4 hover:text-fg hover:underline" onClick={onCancel}>
            İptal
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-fg-faint">Okuma tamamen bu cihazda yapılıyor. Metin ve görüntü diske yazılmıyor, hiçbir yere gönderilmiyor.</p>
      {ocr && seconds > 25 && (
        <p className="text-xs leading-relaxed text-fg-faint">Telefonlarda fotoğraftan okuma 30–90 saniye sürebilir. Uygulamayı açık tut.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

interface ReviewProps {
  fileId: string;
  initial: { rows: ReviewRow[]; unrecognized: UnrecognizedRow[]; missing?: MissingValue[]; meta: Pick<ReportDraft, 'reportDate' | 'labName' | 'method'> };
  sex: Sex;
  onSexChange: (s: Sex) => void;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
  onSaved: (r: StoredReport) => void;
  onCancel?: () => void;
}

type UnrecState = UnrecognizedRow & { linkKey: string; remember: boolean; linked: boolean };

function ReviewPanel({ fileId, initial, sex, onSexChange, highlight, onHighlight, onSaved, onCancel }: ReviewProps) {
  const vault = useUnlockedVault();
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    initial.rows.map((r) => {
      const test = testByKey.get(r.testKey);
      // Birimi okunamayan satırda varsayılan (kanonik) birim seçili gelir; kullanıcı doğrular.
      if (!r.unitKey && test && r.canonicalValue !== null) return { ...r, unitKey: canonicalKey(test), unit: unitLabel(test.key, canonicalKey(test)) };
      return r;
    }),
  );
  const [unrec, setUnrec] = useState<UnrecState[]>(() => initial.unrecognized.map((u) => ({ ...u, linkKey: '', remember: true, linked: false })));
  const [date, setDate] = useState(initial.meta.reportDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const included = rows.filter((r) => r.include);
  const invalid = included.filter((r) => !isSavable(r));
  const reviewCount = rows.filter((r) => r.include && needsReview(r)).length;
  const needsSex = rows.some((r) => r.issues.includes('RANGE_SEX_SPECIFIC') || (r.refSource === 'catalog' && (testByKey.get(r.testKey)?.ranges.some((x) => x.sex) ?? false)));

  const update = (i: number, next: ReviewRow) => setRows((rs) => rs.map((r, j) => (j === i ? next : r)));

  const applySex = (s: Sex) => {
    onSexChange(s);
    setRows((rs) =>
      rs.map((r) => {
        if (r.issues.includes('RANGE_SEX_SPECIFIC')) {
          const { range } = parseRange(r.refText, s);
          if (range.min === undefined && range.max === undefined) return r;
          const f = (v: number | undefined) => (v === undefined ? '' : v.toLocaleString('tr-TR', { useGrouping: false, maximumFractionDigits: 6 }));
          return reevaluate(r, { ...editOf(r), refMin: f(range.min), refMax: f(range.max) }, s);
        }
        if (r.refSource === 'catalog') return reevaluate(r, { ...editOf(r), refMin: '', refMax: '' }, s);
        return r;
      }),
    );
  };

  const [missing, setMissing] = useState<MissingValue[]>(() => initial.missing ?? []);

  const addManual = (testKey = 'hemoglobin', source?: SourceBox, rawName = '') => {
    const test = testByKey.get(testKey) ?? testByKey.get('hemoglobin')!;
    setMissing((ms) => ms.filter((m) => m.testKey !== testKey));
    setRows((rs) => [
      ...rs,
      {
        testKey: test.key,
        loinc: test.loinc,
        rawName,
        valueText: '',
        value: Number.NaN,
        unit: unitLabel(test.key, canonicalKey(test)),
        unitKey: canonicalKey(test),
        canonicalValue: null,
        refText: '',
        refSource: 'none',
        status: 'unknown',
        confidence: 1,
        issues: [],
        source: source ?? { page: 1, x: 0, y: 0, w: 0, h: 0 },
        include: true,
        userEdited: true,
        edit: { value: '', unitKey: canonicalKey(test), refMin: '', refMax: '' },
      },
    ]);
  };

  const linkUnrecognized = (idx: number) => {
    const u = unrec[idx];
    const test = u ? testByKey.get(u.linkKey) : undefined;
    if (!u || !test) return;
    const unitKey = normalizeUnit(u.unit);
    const useUnit = unitKey && unitKey in test.conversions ? unitKey : canonicalKey(test);
    const { range } = parseRange(u.refText, sex);
    const base: ReviewRow = {
      testKey: test.key,
      loinc: test.loinc,
      rawName: u.rawName,
      valueText: u.valueText,
      value: Number.NaN,
      unit: '',
      unitKey: useUnit,
      canonicalValue: null,
      refText: '',
      refSource: 'none',
      status: 'unknown',
      confidence: 1,
      issues: [],
      source: u.source,
      include: true,
      userEdited: true,
    };
    const f = (v: number | undefined) => (v === undefined ? '' : v.toLocaleString('tr-TR', { useGrouping: false, maximumFractionDigits: 6 }));
    const row = reevaluate(base, { value: u.valueText, unitKey: useUnit, refMin: f(range.min), refMax: f(range.max) }, sex);
    setRows((rs) => [...rs, row]);
    setUnrec((us) => us.map((x, j) => (j === idx ? { ...x, linked: true } : x)));
  };

  async function save() {
    if (!included.length || invalid.length) return;
    setSaving(true);
    setError(null);
    try {
      for (const u of unrec) if (u.linked && u.remember && u.linkKey) await addAlias(vault, u.rawName, u.linkKey);
      const report = await saveReport(vault, {
        fileId,
        reportDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
        labName: initial.meta.labName,
        method: initial.rows.length === 0 ? 'manual' : initial.meta.method,
        results: included.map(toStoredResult),
      });
      onSaved(report);
    } catch (e) {
      setError(userMessage(e));
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-ink-700 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Sonuçları onayla</h2>
          <StatusTag>ONAY BEKLİYOR</StatusTag>
        </div>
        <p className="text-sm leading-relaxed text-fg-muted">
          {rows.length} sonuç okundu{reviewCount ? `, ${reviewCount} tanesi kontrol istiyor` : ''}
          {missing.length ? `, ${missing.length} testin değeri okunamadı` : ''}
          {unrec.filter((u) => !u.linked).length ? `, ${unrec.filter((u) => !u.linked).length} satır tanınmadı` : ''}. Değerleri belgeyle karşılaştır; onaylamadığın hiçbir şey kaydedilmez veya vücut modeline uygulanmaz.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-fg-muted">
            Rapor tarihi{!date && <span className="text-high"> · bulunamadı, gir</span>}
            <input type="date" className="field mt-1 w-40 py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {needsSex && (
            <label className="text-xs text-fg-muted">
              Cinsiyet (aralık seçimi)
              <select className="field mt-1 w-40 py-1.5 text-sm" value={sex} onChange={(e) => applySex(e.target.value as Sex)}>
                <option value="unspecified">Belirtilmedi</option>
                <option value="female">Kadın</option>
                <option value="male">Erkek</option>
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {rows.length === 0 && (
          <Banner tone="warn">
            Bu belgeden test sonucu okunamadı. Tanınmayan satırları aşağıdan bir teste bağlayabilir veya sonuçları elle ekleyebilirsin.
          </Banner>
        )}
        {rows.map((row, i) => (
          <ReviewRowCard
            key={rowId(row, i)}
            row={row}
            sex={sex}
            active={highlight?.key === rowId(row, i)}
            onChange={(r) => update(i, r)}
            onRemove={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            onShow={() => (row.source.w > 0 ? onHighlight({ key: rowId(row, i), box: row.source }) : undefined)}
          />
        ))}
        <button type="button" className="btn-ghost w-full border-dashed" onClick={() => addManual()}>
          + Sonuç ekle
        </button>

        {missing.length > 0 && (
          <section className="mt-4 space-y-2">
            <p className="label-caps">Değeri okunamayan testler</p>
            <p className="text-xs leading-relaxed text-fg-muted">
              Bu testlerin adı bulundu ama sonucu okunamadı (fotoğrafta silik ya da gölgede kalmış olabilir). Belgeye bakıp değeri elle ekle.
            </p>
            {missing.map((m) => (
              <div key={m.testKey} className="flex items-center gap-2 rounded-xl border border-high/30 bg-high/5 p-3 text-sm">
                <span className="flex-1">{testByKey.get(m.testKey)?.nameTr ?? m.rawName}</span>
                {m.source.w > 0 && (
                  <button type="button" className="icon-btn h-8 w-8" onClick={() => onHighlight({ key: `m-${m.testKey}`, box: m.source })} aria-label="Belgede göster">
                    <EyeIcon size={16} />
                  </button>
                )}
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => addManual(m.testKey, m.source, m.rawName)}>
                  Değeri gir
                </button>
              </div>
            ))}
          </section>
        )}

        {unrec.some((u) => !u.linked) && (
          <section className="mt-4 space-y-2">
            <p className="label-caps">Tanınmayan satırlar</p>
            {unrec.map((u, idx) =>
              u.linked ? null : (
                <div key={`${u.rawName}-${idx}`} className="rounded-xl border border-ink-600/70 bg-ink-850/70 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.rawName}</p>
                      <p className="text-xs text-fg-muted">
                        {u.valueText} {u.unit} {u.refText && `· ${u.refText}`}
                      </p>
                    </div>
                    <button type="button" className="icon-btn h-8 w-8" onClick={() => onHighlight({ key: `u-${idx}`, box: u.source })} aria-label="Belgede göster">
                      <EyeIcon size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <TestSelect value={u.linkKey} onChange={(k) => setUnrec((us) => us.map((x, j) => (j === idx ? { ...x, linkKey: k } : x)))} />
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={!u.linkKey} onClick={() => linkUnrecognized(idx)}>
                      Bağla
                    </button>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
                    <input type="checkbox" className="accent-[var(--color-accent)]" checked={u.remember} onChange={(e) => setUnrec((us) => us.map((x, j) => (j === idx ? { ...x, remember: e.target.checked } : x)))} />
                    Bu adı hatırla (bu laboratuvarın sonraki raporlarında otomatik tanınır)
                  </label>
                </div>
              ),
            )}
          </section>
        )}
      </div>

      <div className="space-y-2 border-t border-ink-700 p-3">
        {invalid.length > 0 && <Banner tone="warn">{invalid.length} satırda geçerli değer veya birim yok; düzelt ya da çıkar.</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Vazgeç
            </button>
          )}
          <button type="button" className="btn-primary flex-1" disabled={!included.length || invalid.length > 0 || saving} onClick={save}>
            {saving ? <SpinnerIcon size={16} /> : <CheckIcon size={16} />} Onayla ve kaydet ({included.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function TestSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, LabTestDef[]>();
    for (const t of TESTS) m.set(t.group, [...(m.get(t.group) ?? []), t]);
    return [...m.entries()];
  }, []);
  return (
    <select className="field w-auto min-w-0 flex-1 py-1.5 text-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Test seç">
      <option value="">Test seç…</option>
      {groups.map(([g, tests]) => (
        <optgroup key={g} label={GROUP_LABEL[g as keyof typeof GROUP_LABEL]}>
          {tests.map((t) => (
            <option key={t.key} value={t.key}>
              {t.nameTr}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function ReviewRowCard({
  row,
  sex,
  active,
  onChange,
  onRemove,
  onShow,
}: {
  row: ReviewRow;
  sex: Sex;
  active: boolean;
  onChange: (r: ReviewRow) => void;
  onRemove: () => void;
  onShow: () => void;
}) {
  const test = testByKey.get(row.testKey);
  const edit = row.edit ?? editOf(row);
  const warn = needsReview(row) && row.include;
  const set = (patch: Partial<typeof edit>) => onChange(reevaluate(row, { ...edit, ...patch }, sex));

  const changeTest = (key: string) => {
    const t = testByKey.get(key);
    if (!t) return;
    const unitKey = edit.unitKey && edit.unitKey in t.conversions ? edit.unitKey : canonicalKey(t);
    onChange(reevaluate({ ...row, testKey: t.key, loinc: t.loinc }, { ...edit, unitKey }, sex));
  };

  return (
    <div
      className={`rounded-xl border p-3 transition ${active ? 'border-accent/60 bg-accent/5' : warn ? 'border-high/35 bg-high/5' : 'border-ink-600/70 bg-ink-850/70'} ${row.include ? '' : 'opacity-55'}`}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          checked={row.include}
          onChange={(e) => onChange({ ...row, include: e.target.checked })}
          aria-label="Bu sonucu kaydet"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {row.rawName ? (
                <p className="truncate font-medium">{test?.nameTr ?? row.testKey}</p>
              ) : (
                <TestSelect value={row.testKey} onChange={changeTest} />
              )}
              {row.rawName && (
                <p className="truncate text-xs text-fg-faint">
                  raporda: “{row.rawName}”{row.confidence < 1 ? ` · güven %${Math.round(row.confidence * 100)}` : ''}
                </p>
              )}
            </div>
            <StatusPill status={row.status} />
          </div>

          <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
            <label className="text-[11px] text-fg-faint">
              Değer
              <input className="field mt-0.5 py-1.5 text-sm tabular-nums" inputMode="decimal" value={edit.value} onChange={(e) => set({ value: e.target.value })} />
            </label>
            <label className="text-[11px] text-fg-faint">
              Birim
              <select className="field mt-0.5 w-auto py-1.5 text-sm" value={edit.unitKey ?? ''} onChange={(e) => set({ unitKey: e.target.value || null })}>
                {test &&
                  Object.keys(test.conversions).map((k) => (
                    <option key={k} value={k}>
                      {unitLabel(test.key, k)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="col-span-2 text-[11px] text-fg-faint">
              Referans aralığı {row.refSource === 'catalog' && <span className="text-high">(genel)</span>}
              <div className="mt-0.5 flex items-center gap-1">
                <input className="field py-1.5 text-sm tabular-nums" inputMode="decimal" placeholder="en az" value={edit.refMin} onChange={(e) => set({ refMin: e.target.value })} />
                <span className="text-fg-faint">–</span>
                <input className="field py-1.5 text-sm tabular-nums" inputMode="decimal" placeholder="en çok" value={edit.refMax} onChange={(e) => set({ refMax: e.target.value })} />
              </div>
            </div>
          </div>
          {row.refSource === 'catalog' && row.refText && <p className="mt-1 text-[11px] text-fg-faint">Genel referans: {row.refText} {test?.unit}</p>}

          {row.include && row.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.issues.map((i) => (
                <li key={i} className="flex gap-1.5 text-xs text-high">
                  <AlertIcon size={13} className="mt-0.5 shrink-0" /> {ISSUE_TEXT[i]}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex items-center gap-1">
            {row.source.w > 0 && (
              <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={onShow}>
                <EyeIcon size={14} /> Belgede göster
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="icon-btn h-8 w-8 hover:text-danger" onClick={onRemove} aria-label="Satırı kaldır">
              <TrashIcon size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function SavedResults({
  report,
  highlight,
  onHighlight,
  onReanalyze,
  onEdit,
}: {
  report: StoredReport;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
  onReanalyze: () => void;
  onEdit: () => void;
}) {
  const abnormal = report.results.filter((r) => r.status === 'high' || r.status === 'low').length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-1 border-b border-ink-700 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Sonuçlar</h2>
          <span className="text-xs text-fg-muted">{report.reportDate ? formatDate(report.reportDate) : 'tarih yok'}</span>
        </div>
        <p className="text-sm text-fg-muted">
          {report.results.length} sonuç{abnormal ? ` · ${abnormal} tanesi aralık dışı` : ' · hepsi aralık içinde'}
          {report.labName ? ` · ${report.labName}` : ''}
        </p>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-ink-700 overflow-y-auto">
        {report.results.map((r, i) => {
          const test = testByKey.get(r.testKey);
          const key = `${r.testKey}-${i}`;
          return (
            <li key={key} className={`flex items-center gap-2 px-4 py-2.5 ${highlight?.key === key ? 'bg-accent/5' : ''}`}>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => (r.source && r.source.w > 0 ? onHighlight({ key, box: r.source }) : undefined)}
                aria-label={`${test?.nameTr ?? r.testKey}: kaynağı göster`}
              >
                <span className="block truncate text-sm font-medium">{test?.nameTr ?? r.testKey}</span>
                <span className="block text-xs tabular-nums text-fg-muted">
                  {formatNumber(r.value, 4)} {r.unit} {r.refText && <span className="text-fg-faint">· {r.refText}</span>}
                </span>
              </button>
              <StatusPill status={r.status} />
              <button type="button" className="icon-btn h-8 w-8" onClick={() => go({ name: 'result', key: r.testKey })} aria-label="Ayrıntı ve açıklama">
                <ChevronRightIcon size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-ink-700 p-3">
        <button type="button" className="btn-primary flex-1" onClick={() => go({ name: 'body' })}>
          <BodyIcon size={16} /> Vücutta göster
        </button>
        <button type="button" className="btn-ghost" onClick={onEdit}>
          Düzenle
        </button>
        <button type="button" className="btn-ghost" onClick={onReanalyze} title="Belgeyi yeniden oku">
          <RefreshIcon size={16} /> Yeniden oku
        </button>
      </div>
    </div>
  );
}
