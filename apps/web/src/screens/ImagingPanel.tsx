import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DicomInfo, parseDicom } from '@kh/ingest';
import { type Bytes, DOC_CATEGORIES, type DocCategory, type FileInfo } from '@kh/vault';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { go } from '../state/router';
import type { ExtractProgress } from '../lib/extract';
import { OcrError, cancelOcr } from '../lib/ocr';
import { CATEGORY_ABOUT, CATEGORY_LABEL, IMAGING_QUESTIONS, REGIONS, findTerms, guessRegion, isImaging, regionByKey, splitReport } from '../lib/imaging';
import { type ImagingNote, MAX_NOTE_CHARS, noteForFile, removeManualMeasurement, saveImagingNote } from '../lib/imagingRecords';
import { isAbnormal, measurementsOf } from '../lib/imagingMeasurements';
import { loadSex } from '../lib/reports';
import { MeasureList } from '../components/measures';
import type { Sex } from '@kh/catalog';
import { userMessage } from '../lib/messages';
import { formatDate } from '../lib/format';
import { Banner } from '../components/ui';
import { BodyIcon, CheckIcon, PencilIcon, RefreshIcon, ScanIcon, SpinnerIcon } from '../components/icons';
import { ExtractingView, ocrMessage } from './ReportPanel';
import { relatedStudies, useImagingStudies } from '../lib/imagingStudies';
import { classifyPhoto } from '../lib/photo';
import { ImagingStudyList } from '../components/imaging';
import { ImageReviewCard } from '../components/ImageReviewCard';

const METHOD_TEXT: Record<ImagingNote['method'], string> = {
  text: 'PDF metninden okundu',
  ocr: 'Görüntüden okundu (OCR) — hatalı harfler olabilir',
  mixed: 'PDF metni ve OCR',
  manual: 'Elle girildi',
};

/**
 * Görüntüleme belgesi (MR, BT, röntgen, ultrason) paneli. Tahlillerden farklı olarak sayısal sonuç
 * çıkarılmaz: belge türü, bölge ve tarih düzenlenir; rapor metni okunup bölümlerine ayrılır ve
 * geçen terimlerin genel anlamı gösterilir. Görüntü veya rapor YORUMLANMAZ.
 */
export function ImagingPanel({ info, bytes, seriesIds, onInfoChange }: { info: FileInfo; bytes: Bytes; seriesIds: string[]; onInfoChange: (f: FileInfo) => void }) {
  const vault = useUnlockedVault();
  const { bump, revision } = useVault();
  // DICOM serisinde not ve ölçümler serinin ilk kesitine bağlanır (hangi kesit açılırsa açılsın aynı).
  const noteFileId = seriesIds.length > 1 ? seriesIds[0]! : info.id;
  const [note, setNote] = useState<ImagingNote | null | undefined>(undefined);
  const [sex, setSex] = useState<Sex>('unspecified');
  const autoTried = useRef(false);
  const [mode, setMode] = useState<'idle' | 'reading' | 'editing'>('idle');
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [suggested, setSuggested] = useState<{ region?: string; date?: string; from: 'report' | 'image' | 'shape' } | null>(null);
  const [pickRegion, setPickRegion] = useState(false);
  /** Film/ekran fotoğrafının üstündeki yazılar (ör. "MR BEYIN", tarih) yalnızca bölge önerisi için okunur. */
  const [overlay, setOverlay] = useState<'idle' | 'reading' | 'done'>('idle');
  /** Fotoğraf bir rapor kâğıdı/ekranı mı (kendiliğinden okunur) yoksa film mi? */
  const [photoKind, setPhotoKind] = useState<'document' | 'film' | 'unknown' | null>(null);
  const studies = useImagingStudies();
  const related = useMemo(() => {
    const self = studies?.find((st) => st.files.some((f) => f.id === info.id));
    return self && studies ? relatedStudies(self, studies) : [];
  }, [studies, info.id]);

  useEffect(() => {
    if (info.kind !== 'jpeg' && info.kind !== 'png') return;
    let cancelled = false;
    void classifyPhoto(bytes, info.mimeType).then((k) => !cancelled && setPhotoKind(k));
    return () => {
      cancelled = true;
    };
  }, [info.kind, info.mimeType, bytes]);

  const dicom = useMemo<DicomInfo | null>(() => {
    if (info.kind !== 'dicom') return null;
    try {
      return parseDicom(bytes);
    } catch {
      return null;
    }
  }, [info.kind, bytes]);

  useEffect(() => {
    let cancelled = false;
    noteForFile(vault, noteFileId).then(
      (n) => !cancelled && setNote(n ?? null),
      () => !cancelled && setNote(null),
    );
    void loadSex(vault).then((x) => !cancelled && setSex(x));
    return () => {
      cancelled = true;
    };
    // revision: görüntüleyicide ölçüm kaydedilince yenilenir
  }, [vault, noteFileId, revision]);

  /** Seri içindeki tüm kesitlere uygulanır: tür, bölge ve tarih serinin ortak bilgisidir. */
  const updateMeta = async (patch: { category?: DocCategory; region?: string | null; studyDate?: string | null }) => {
    setError(null);
    try {
      let updated = info;
      for (const id of seriesIds.length ? seriesIds : [info.id]) {
        const f = await vault.updateFileMeta(id, patch);
        if (id === info.id) updated = f;
      }
      onInfoChange(updated);
      bump();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(userMessage(e));
    }
  };

  const read = useCallback(async () => {
    setMode('reading');
    setError(null);
    setProgress(null);
    try {
      const { extractReportText } = await import('../lib/extract');
      const got = await extractReportText(info, bytes as Uint8Array<ArrayBuffer>, setProgress);
      if (!got.text.trim()) {
        setError('Belgede okunabilir metin bulunamadı. Rapor metnini elle yazabilirsin.');
        setMode('idle');
        return;
      }
      const n = await saveImagingNote(vault, noteFileId, got.text, got.method);
      setNote(n);
      bump();
      const head = got.text.slice(0, 400);
      const region = info.region ? undefined : guessRegion(head);
      const date = info.studyDate ? undefined : got.date;
      setSuggested(region || date ? { region, date, from: 'report' } : null);
      setMode('idle');
    } catch (e) {
      setError(e instanceof OcrError ? ocrMessage(e) : userMessage(e));
      setMode('idle');
    }
  }, [vault, info, bytes, bump, noteFileId]);

  // Rapor kendiliğinden okunur: PDF her zaman; fotoğraf ise kâğıt/ekran görüntüsüne benziyorsa.
  // Film/MR baskısı fotoğrafında OCR çalışmaz (metin yoktur); düğmeyle istenebilir.
  const autoRead = info.kind === 'pdf' || photoKind === 'document';
  const hasText = Boolean(note && note.text.trim());
  useEffect(() => {
    if (note === undefined || hasText || !autoRead || mode !== 'idle' || error || autoTried.current) return;
    autoTried.current = true;
    void read();
  }, [note, hasText, autoRead, mode, error, read]);

  // Film fotoğrafında bölge seçilmemişse: görüntünün köşelerindeki yazılardan (görüntüleyici etiketleri,
  // ör. "MR BEYIN", "DIZ AP", çekim tarihi) bölge ve tarih önerilir. Metin kaydedilmez, rapor sayılmaz;
  // görüntünün kendisi yorumlanmaz.
  const overlayFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isImaging(info.category) || photoKind !== 'film' || info.region || mode !== 'idle' || note === undefined || hasText) return;
    if (overlayFor.current === info.id) return; // her belge için bir kez
    overlayFor.current = info.id;
    const id = info.id;
    setOverlay('reading');
    void (async () => {
      try {
        const { extractReportText } = await import('../lib/extract');
        const got = await extractReportText(info, bytes as Uint8Array<ArrayBuffer>);
        if (overlayFor.current !== id) return;
        const region = guessRegion(got.text.slice(0, 600));
        const date = info.studyDate ? undefined : got.date;
        if (region || date) setSuggested({ region, date, from: 'image' });
      } catch {
        // Okunamazsa kullanıcı bölgeyi listeden seçer.
      } finally {
        if (overlayFor.current === id) setOverlay('done');
      }
    })();
    // info nesnesi her kayıtta yenilenir; yalnızca kimlik ve ilgili alanlar izlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.id, info.category, info.region, photoKind, note, hasText, mode]);

  const saveManual = async () => {
    try {
      setNote(await saveImagingNote(vault, noteFileId, draft, 'manual'));
      setMode('idle');
      bump();
    } catch (e) {
      setError(userMessage(e));
    }
  };

  const category = info.category;
  const about = isImaging(category) ? CATEGORY_ABOUT[category] : null;
  const region = info.region ? regionByKey.get(info.region) : undefined;
  const sections = useMemo(() => (note && hasText ? splitReport(note.text) : []), [note, hasText]);
  const terms = useMemo(() => (note && hasText ? findTerms(note.text) : []), [note, hasText]);
  const measures = useMemo(() => measurementsOf(note ?? undefined, info.region, sex), [note, info.region, sex]);
  const abnormal = measures.filter(isAbnormal);
  const spacing = Boolean(dicom?.pixelSpacing);
  const canRead = info.kind === 'pdf' || info.kind === 'jpeg' || info.kind === 'png';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-5 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-low/25 bg-low/8 text-low">
            <ScanIcon size={20} />
          </span>
          <div className="min-w-0">
            <p className="label-caps">Görüntüleme</p>
            <h2 className="text-lg font-semibold tracking-tight">
              {CATEGORY_LABEL[category]}
              {region ? ` · ${region.label}` : ''}
            </h2>
            {info.studyDate && <p className="text-xs text-fg-muted">Çekim: {formatDate(info.studyDate)}</p>}
          </div>
        </div>

        {/* Vücutta göster: bölge biliniyorsa doğrudan; bilinmiyorsa önce bölge sorulur. */}
        <div className="space-y-2">
          <button
            type="button"
            className="btn-primary w-full justify-center"
            onClick={() => (region?.structure ? go({ name: 'body', structure: region.structure }) : setPickRegion((v) => !v))}
          >
            <BodyIcon size={16} /> {region?.structure ? `Vücutta göster · ${region.label}` : 'Vücutta göster'}
          </button>
          {!region?.structure && pickRegion && (
            <label className="block rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs text-fg-muted">
              Görüntülenen bölgeyi seç; seçince 3B vücutta açılır ve belgeye kaydedilir.
              <select
                className="field mt-2 py-2 text-sm"
                defaultValue=""
                aria-label="Vücutta gösterilecek bölge"
                onChange={(e) => {
                  const r = regionByKey.get(e.target.value);
                  if (!r) return;
                  void updateMeta({ region: r.key }).then(() => r.structure && go({ name: 'body', structure: r.structure }));
                }}
              >
                <option value="" disabled>
                  Bölge seç…
                </option>
                {REGIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-[11px] leading-relaxed text-fg-faint">3B model, görüntülenen bölgenin vücuttaki genel yerini gösterir; görüntüdeki bir bulgunun yerini göstermez.</p>
        </div>

        <Banner tone="info">
          Kan Haritası görüntüye bakıp <strong>teşhis koymaz</strong>. Rapordaki ve senin görüntü üzerinde yaptığın ölçümleri, tahlillerdeki gibi genel referans
          aralıklarıyla karşılaştırır; terimleri açıklar; görüntünün kendisinde yalnızca basit bir sağ-sol karşılaştırması yapar. Değerlendirme, raporu yazan ve seni
          takip eden hekime aittir.
        </Banner>

        {isImaging(category) && (info.kind === 'dicom' || ((info.kind === 'jpeg' || info.kind === 'png') && photoKind !== null && photoKind !== 'document')) && (
          <ImageReviewCard
            info={info}
            bytes={bytes}
            noteFileId={noteFileId}
            stored={note?.review}
            onHeadLike={() => {
              if (!info.region) setSuggested((s) => s ?? { region: 'beyin', from: 'shape' });
            }}
          />
        )}

        {/* Ölçümler: tahlil sonuçları gibi genel referansa göre */}
        <section className="space-y-2" aria-label="Ölçümler">
          <div className="flex items-end justify-between gap-2">
            <p className="label-caps">Ölçümler{measures.length ? ` (${measures.length})` : ''}</p>
            {measures.length > 0 && (
              <span className={`text-xs ${abnormal.length ? 'text-high' : 'text-accent'}`}>
                {abnormal.length ? `${abnormal.length} tanesi genel referans dışında` : 'Hepsi genel referans içinde'}
              </span>
            )}
          </div>
          {measures.length > 0 ? (
            <>
              <MeasureList
                measures={measures}
                onRemove={(m) =>
                  m.manualId &&
                  void removeManualMeasurement(vault, noteFileId, m.manualId)
                    .then(() => bump())
                    .catch((e) => setError(userMessage(e)))
                }
              />
              <p className="text-[11px] leading-relaxed text-fg-faint">
                Değerler genel yetişkin referanslarıyla karşılaştırılır; yaşa, cinsiyete, vücut ölçüsüne ve ölçüm tekniğine göre değişir. Referans dışı bir ölçüm tanı değildir;
                referans içinde olması da sorun olmadığını göstermez. Görüntünün kendisini ve raporu hekimin değerlendirir.
              </p>
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-600 p-4 text-sm text-fg-muted">
              {hasText ? 'Raporda referans değeri olan bir ölçüm bulunamadı (ör. dalak 13 cm, EF %55, T skoru −2,1). ' : 'Rapor metni okununca içindeki ölçümler (ör. dalak boyu, aort çapı, EF, T-skoru) burada tahlil sonuçları gibi değerlendirilir. '}
              {info.kind === 'dicom'
                ? spacing
                  ? 'Görüntü üzerinde kendin ölçmek için görüntüleyicideki cetvel ya da yoğunluk aracını kullanabilirsin.'
                  : ''
                : info.kind !== 'pdf'
                  ? 'Fotoğrafta milimetre ölçeği olmadığı için yalnızca oranlar (ör. kalp/göğüs oranı) cetvelle ölçülebilir.'
                  : ''}
            </p>
          )}
        </section>

        {/* Belge bilgileri */}
        <section className="space-y-3 rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Belge bilgileri">
          <div className="flex items-center justify-between">
            <p className="label-caps">Belge bilgileri</p>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-accent">
                <CheckIcon size={12} /> Kaydedildi
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-fg-muted">
              Tür
              <select className="field mt-1 py-2 text-sm" value={category} onChange={(e) => void updateMeta({ category: e.target.value as DocCategory })}>
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-fg-muted">
              Bölge
              <select id="imaging-region" className="field mt-1 py-2 text-sm" value={info.region ?? ''} onChange={(e) => void updateMeta({ region: e.target.value || null })}>
                <option value="">Belirtilmemiş</option>
                {REGIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-fg-muted sm:col-span-2">
              Çekim tarihi
              <input
                type="date"
                className="field mt-1 py-2 text-sm"
                value={info.studyDate ?? ''}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => void updateMeta({ studyDate: e.target.value || null })}
              />
            </label>
          </div>
          {seriesIds.length > 1 && <p className="text-xs text-fg-faint">Değişiklikler serideki {seriesIds.length} kesitin hepsine uygulanır.</p>}
          {suggested && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-xs">
              <span className="text-fg-muted">
                {suggested.from === 'image' ? 'Görüntüdeki yazılardan önerilen:' : suggested.from === 'shape' ? 'Kesitlerin şeklinden önerilen (kesin değil):' : 'Rapordan önerilen:'}
              </span>
              {suggested.region && <span>{regionByKey.get(suggested.region)?.label}</span>}
              {suggested.date && <span>{formatDate(suggested.date)}</span>}
              <button
                type="button"
                className="btn-primary ml-auto px-2.5 py-1 text-xs"
                onClick={() => {
                  void updateMeta({ ...(suggested.region ? { region: suggested.region } : {}), ...(suggested.date ? { studyDate: suggested.date } : {}) });
                  setSuggested(null);
                }}
              >
                Uygula
              </button>
              {suggested.region && regionByKey.get(suggested.region)?.structure && (
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-1 text-xs"
                  onClick={async () => {
                    const r = regionByKey.get(suggested.region!)!;
                    await updateMeta({ region: r.key, ...(suggested.date ? { studyDate: suggested.date } : {}) });
                    setSuggested(null);
                    go({ name: 'body', structure: r.structure });
                  }}
                >
                  <BodyIcon size={14} /> Uygula ve vücutta göster
                </button>
              )}
            </div>
          )}
          {isImaging(category) && !region?.structure && !suggested?.region && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-ink-600 px-3 py-2 text-xs text-fg-muted">
              <BodyIcon size={15} />
              <span className="flex-1">
                {overlay === 'reading' ? 'Görüntüdeki yazılardan bölge aranıyor…' : 'Vücutta göstermek için bölgeyi seç.'}
              </span>
              {overlay === 'reading' ? (
                <SpinnerIcon size={14} />
              ) : (
                <button type="button" className="text-accent underline-offset-4 hover:underline" onClick={() => document.getElementById('imaging-region')?.focus()}>
                  Bölge seç
                </button>
              )}
            </div>
          )}
        </section>

        {error && <Banner tone="error">{error}</Banner>}

        {/* DICOM bilgileri */}
        {dicom && (
          <section className="rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Görüntü bilgileri">
            <p className="label-caps mb-2">Görüntü bilgileri (DICOM)</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {(
                [
                  ['Modalite', dicom.modality],
                  ['Çalışma', dicom.studyDescription],
                  ['Seri', dicom.seriesDescription],
                  ['İncelenen bölge', dicom.bodyPart],
                  ['Kesit', seriesIds.length > 1 ? `${seriesIds.length} dosya` : dicom.frames > 1 ? `${dicom.frames} kare` : 'Tek görüntü'],
                  ['Boyut', `${dicom.columns} × ${dicom.rows} piksel`],
                  ['Piksel aralığı', dicom.pixelSpacing ? `${dicom.pixelSpacing.map((v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 3 })).join(' × ')} mm` : undefined],
                  ['Kesit kalınlığı', dicom.sliceThickness ? `${dicom.sliceThickness.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} mm` : undefined],
                  ['Kodlama', dicom.codec === 'native' ? 'Sıkıştırmasız' : dicom.codec === 'rle' ? 'RLE (kayıpsız)' : dicom.codec === 'jpeg-baseline' ? 'JPEG' : 'Desteklenmeyen sıkıştırma'],
                ] as Array<[string, string | undefined]>
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
              Hasta adı, kimlik numarası ve doğum tarihi gibi alanlar okunmaz ve burada gösterilmez; özgün dosya kasada değiştirilmeden, şifreli durur.
            </p>
          </section>
        )}

        {/* Rapor metni */}
        <section className="space-y-3" aria-label="Rapor metni">
          <div className="flex items-center justify-between gap-2">
            <p className="label-caps">Rapor metni</p>
            {hasText && note && mode === 'idle' && (
              <div className="flex gap-1">
                {canRead && (
                  <button type="button" className="icon-btn h-8 w-8" onClick={() => void read()} aria-label="Yeniden oku" title="Yeniden oku">
                    <RefreshIcon size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn h-8 w-8"
                  onClick={() => {
                    setDraft(note.text);
                    setMode('editing');
                  }}
                  aria-label="Metni düzenle"
                  title="Metni düzenle"
                >
                  <PencilIcon size={15} />
                </button>
              </div>
            )}
          </div>

          {mode === 'reading' ? (
            <div className="rounded-2xl border border-ink-600/60 bg-ink-850/60">
              <ExtractingView progress={progress} kind={info.kind} onCancel={cancelOcr} />
            </div>
          ) : mode === 'editing' ? (
            <div className="space-y-2">
              <textarea
                className="field min-h-56 font-mono text-[13px] leading-relaxed"
                value={draft}
                maxLength={MAX_NOTE_CHARS}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={'Ör.\nBULGULAR: …\nSONUÇ: …'}
                aria-label="Rapor metni"
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setMode('idle')}>
                  Vazgeç
                </button>
                <button type="button" className="btn-primary" onClick={() => void saveManual()} disabled={!draft.trim()}>
                  Kaydet
                </button>
              </div>
            </div>
          ) : note === undefined ? (
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              <SpinnerIcon size={14} /> Yükleniyor…
            </div>
          ) : hasText && note ? (
            <div className="space-y-3">
              {sections.map((s, i) => (
                <div
                  key={`${s.kind}-${i}`}
                  className={`rounded-2xl border p-4 ${s.kind === 'sonuc' ? 'border-accent/30 bg-accent/5' : 'border-ink-600/60 bg-ink-850/60'}`}
                >
                  <p className={`label-caps mb-1.5 ${s.kind === 'sonuc' ? 'text-accent' : ''}`}>{s.title}</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{s.text}</p>
                </div>
              ))}
              <p className="text-[11px] text-fg-faint">
                {METHOD_TEXT[note.method]} · {formatDate(note.updatedAt)}
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed border-ink-600 p-4 text-sm">
              <p className="text-fg-muted">
                {canRead
                  ? photoKind === 'film'
                    ? 'Bu fotoğraf bir görüntüye (film) benziyor; üzerinde okunacak rapor metni olmayabilir. Raporun kendisini ayrıca yükleyebilir ya da metnini buraya yazabilirsin.'
                    : 'Bu belge radyoloji raporunun kendisiyse metnini cihazında okuyabilirsin. Okunan metin kasada şifreli saklanır.'
                  : 'Görüntü dosyasında rapor metni bulunmaz. Radyoloji raporunu ayrıca PDF ya da fotoğraf olarak yükleyebilir veya metnini buraya yazabilirsin.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {canRead && (
                  <button type="button" className="btn-primary" disabled={overlay === 'reading'} onClick={() => void read()}>
                    <ScanIcon size={16} /> Rapor metnini oku
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setDraft('');
                    setMode('editing');
                  }}
                >
                  <PencilIcon size={16} /> Elle yaz
                </button>
              </div>
            </div>
          )}
        </section>

        {related.length > 0 && (
          <section className="space-y-2" aria-label="Aynı çekime ait belgeler">
            <p className="label-caps">Aynı çekime ait belgeler</p>
            <p className="text-xs leading-relaxed text-fg-faint">Aynı tür ve tarihli (ya da aynı bölge, birkaç gün arayla) görüntü ve raporlar. Tarih veya bölge yanlışsa yukarıdan düzelt.</p>
            <ImagingStudyList studies={related} compact />
          </section>
        )}

        {/* Sözlük */}
        {terms.length > 0 && mode === 'idle' && (
          <section className="space-y-2" aria-label="Raporda geçen terimler">
            <p className="label-caps">Raporda geçen terimler</p>
            <p className="text-xs leading-relaxed text-fg-faint">Genel anlamlarıdır. Bir terimin senin raporunda ne ifade ettiğini ve önemini hekimin değerlendirir.</p>
            <ul className="space-y-2">
              {terms.map((t) => (
                <li key={t.key} className="rounded-xl border border-ink-600/60 bg-ink-850/60 px-3.5 py-2.5">
                  <p className="text-sm font-medium">{t.term}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{t.meaning}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {about && (
          <section className="rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Yöntem hakkında">
            <p className="label-caps mb-1.5">{about.name} — temelde nasıl çalışır</p>
            <p className="text-sm leading-relaxed text-fg-muted">{about.how}</p>
            <p className="mt-2 text-xs text-fg-faint">{about.radiation}</p>
          </section>
        )}

        <section className="rounded-2xl border border-ink-600/60 bg-ink-850/60 p-4" aria-label="Doktora sorulabilecekler">
          <p className="label-caps mb-2">Doktoruna sorabileceklerin</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted">
            {IMAGING_QUESTIONS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
