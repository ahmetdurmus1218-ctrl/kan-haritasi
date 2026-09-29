/**
 * Görüntüleme çalışmaları: her DICOM serisi ya da tek görüntüleme belgesi bir "çalışma"dır.
 * Sonuçlar, Zaman ve Keşfet ekranları görüntüleme raporlarını bu listeden gösterir; aynı çekime ait
 * görüntü ve rapor (ör. MR kesitleri + radyoloji raporu PDF'i) birbirine bağlanır.
 */
import { useEffect, useState } from 'react';
import type { FileInfo } from '@kh/vault';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type DocGroup, groupDocuments } from './documents';
import { CATEGORY_REGION, type GlossaryTerm, type ImagingCategory, type ReportSection, findTerms, isImaging, isReadableReport, regionByKey, splitReport } from './imaging';
import { type ImagingNote, type StoredReview, listImagingNotes } from './imagingRecords';
import { type MeasureResult, isAbnormal, measurementsOf } from './imagingMeasurements';
import { type ImagingFinding, extractFindings } from './imagingFindings';
import { loadSex } from './reports';
import type { Sex } from '@kh/catalog';

export interface ImagingStudy extends DocGroup {
  category: ImagingCategory;
  region?: string;
  /** Çekim tarihi, yoksa yükleme tarihi (YYYY-AA-GG). */
  date: string;
  dateKnown: boolean;
  note?: ImagingNote;
  sections: ReportSection[];
  /** Raporun "Sonuç" bölümü; yoksa bulgular ya da metnin başı. */
  conclusion?: string;
  terms: GlossaryTerm[];
  /** Kendi raporu yoksa: aynı çekime ait başka bir belgenin (ör. rapor PDF'i) sonucu ve o belge. */
  linked?: { conclusion: string; fileId: string; name: string };
  /** Rapordan okunan ve elle yapılan ölçümler, genel referansa göre değerlendirilmiş. */
  measures: MeasureResult[];
  abnormal: MeasureResult[];
  /** Kullanıcının sonuçlarına eklediği otomatik görüntü incelemesi (sağ-sol farkı). */
  review?: StoredReview;
  /** Rapor cümlelerinden çıkarılan bulgular (konum ve olağan/dikkat ayrımıyla). */
  findings: ImagingFinding[];
}

const CONCLUSION_MAX = 360;

function conclusionOf(sections: ReportSection[]): string | undefined {
  const pick = sections.find((s) => s.kind === 'sonuc') ?? sections.find((s) => s.kind === 'bulgular') ?? sections[sections.length - 1];
  if (!pick) return undefined;
  const t = pick.text.trim();
  return t.length > CONCLUSION_MAX ? `${t.slice(0, CONCLUSION_MAX).trimEnd()}…` : t;
}

export function buildStudies(files: FileInfo[], notes: ImagingNote[], sex: Sex = 'unspecified'): ImagingStudy[] {
  const byFile = new Map<string, ImagingNote>();
  for (const n of notes) {
    const prev = byFile.get(n.fileId);
    if (!prev || prev.updatedAt < n.updatedAt) byFile.set(n.fileId, n);
  }
  const studies: ImagingStudy[] = groupDocuments(files)
    .filter((g) => isImaging(g.head.category))
    .map((g) => {
      const groupNotes = g.files.map((f) => byFile.get(f.id)).filter((n): n is ImagingNote => Boolean(n));
      // Görüntüden okunmuş anlamsız metin (film fotoğrafında OCR) rapor sayılmaz.
      const readable = (n: ImagingNote) => n.text.trim() !== '' && ((n.method !== 'ocr' && n.method !== 'mixed') || isReadableReport(n.text));
      const note = groupNotes.find(readable) ?? groupNotes[0];
      const text = note && readable(note) ? note.text : '';
      const sections = text ? splitReport(text) : [];
      const measures = groupNotes.flatMap((n) => measurementsOf(n, g.head.region, sex));
      return {
        ...g,
        category: g.head.category as ImagingCategory,
        region: g.head.region,
        date: g.head.studyDate ?? g.head.createdAt.slice(0, 10),
        dateKnown: Boolean(g.head.studyDate),
        note,
        sections,
        conclusion: conclusionOf(sections),
        terms: text ? findTerms(text) : [],
        measures,
        abnormal: measures.filter(isAbnormal),
        review: groupNotes.find((n) => n.review?.confirmed)?.review,
        findings: text ? extractFindings(text, g.head.region ?? CATEGORY_REGION[g.head.category]) : [],
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.head.createdAt.localeCompare(a.head.createdAt));
  // Raporu olmayan görüntüler (ör. MR kesitleri) aynı çekimin raporunun sonucunu gösterir.
  for (const st of studies) {
    if (st.conclusion) continue;
    const src = relatedStudies(st, studies).find((o) => o.conclusion);
    if (src) st.linked = { conclusion: src.conclusion!, fileId: src.head.id, name: src.head.displayName };
  }
  return studies;
}

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;

/**
 * Aynı çekime ait olması muhtemel diğer belgeler: aynı tür ve aynı çekim tarihi; ya da aynı tür ve
 * aynı bölge, en fazla 7 gün arayla (rapor çoğu zaman çekimden birkaç gün sonra yazılır).
 */
export function relatedStudies(study: Pick<ImagingStudy, 'key' | 'category' | 'region' | 'date'>, all: ImagingStudy[]): ImagingStudy[] {
  return all.filter(
    (o) =>
      o.key !== study.key &&
      o.category === study.category &&
      (o.date === study.date || (study.region !== undefined && o.region === study.region && days(o.date, study.date) <= 7)),
  );
}

/** Sonuçlara eklenmiş, dikkat bölgesi içeren incelemeler ve ilgili 3B yapıları. */
export function reviewFlags(all: ImagingStudy[]): Array<{ structure: string; fileId: string; count: number }> {
  return all.flatMap((st) => {
    const structure = st.region ? regionByKey.get(st.region)?.structure : undefined;
    return st.review?.confirmed && st.review.regions.length && structure ? [{ structure, fileId: st.head.id, count: st.review.regions.length }] : [];
  });
}

/** Bir 3B yapıyla ilgili çalışmalar (bölgenin yapısı eşleşenler). */
export function studiesForStructure(structure: string, all: ImagingStudy[]): ImagingStudy[] {
  return all.filter(
    (s) =>
      (s.region && regionByKey.get(s.region)?.structure === structure) ||
      s.measures.some((m) => m.def.structure === structure) ||
      s.findings.some((f) => f.structure === structure && f.status !== 'normal'),
  );
}

export function useImagingStudies(): ImagingStudy[] | null {
  const vault = useUnlockedVault();
  const { revision } = useVault();
  const [studies, setStudies] = useState<ImagingStudy[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([vault.listFiles(), listImagingNotes(vault), loadSex(vault)]).then(
      ([{ files }, notes, sex]) => !cancelled && setStudies(buildStudies(files, notes, sex)),
      () => !cancelled && setStudies([]),
    );
    return () => {
      cancelled = true;
    };
  }, [vault, revision]);
  return studies;
}
