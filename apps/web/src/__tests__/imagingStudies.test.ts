import { describe, expect, it } from 'vitest';
import type { FileInfo } from '@kh/vault';
import { buildStudies, relatedStudies, studiesForStructure } from '../lib/imagingStudies';
import type { ImagingNote } from '../lib/imagingRecords';

let n = 0;
const file = (p: Partial<FileInfo>): FileInfo => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  displayName: 'belge',
  originalFileName: 'x.pdf',
  mimeType: 'application/pdf',
  kind: 'pdf',
  size: 10,
  sha256: String(n),
  createdAt: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`,
  category: 'lab',
  ...p,
});
const note = (fileId: string, text: string): ImagingNote => ({ id: `n${fileId}`, fileId, text, method: 'text', updatedAt: '2026-09-20T00:00:00.000Z' });

describe('görüntüleme çalışmaları', () => {
  const slices = [3, 1, 2].map((i) => file({ kind: 'dicom', category: 'mr', region: 'beyin', studyDate: '2026-03-15', seriesUid: '1.2.3', sliceIndex: i }));
  const report = file({ category: 'mr', region: 'beyin', studyDate: '2026-03-18' });
  const ct = file({ category: 'ct', region: 'toraks', studyDate: '2025-12-01' });
  const lab = file({});
  const notes = [note(report.id, 'BULGULAR:\nBeyaz cevherde T2 hiperintens odak.\nSONUÇ: Nonspesifik odak.')];
  const studies = buildStudies([...slices, report, ct, lab], notes);

  it('seri tek çalışma; tahliller dışarıda; en yeni önce', () => {
    expect(studies).toHaveLength(3);
    expect(studies.map((s) => s.date)).toEqual(['2026-03-18', '2026-03-15', '2025-12-01']);
    const mr = studies.find((s) => s.files.length === 3)!;
    expect(mr.head.sliceIndex).toBe(1);
    expect(mr.conclusion).toBeUndefined();
    // Kendi raporu olmayan seri, aynı çekimin raporunun sonucunu gösterir.
    expect(mr.linked).toMatchObject({ conclusion: 'Nonspesifik odak.', fileId: report.id });
    expect(studies.find((s) => s.category === 'ct')!.linked).toBeUndefined();
  });

  it('raporun sonucu ve terimleri', () => {
    const r = studies.find((s) => s.head.id === report.id)!;
    expect(r.conclusion).toBe('Nonspesifik odak.');
    expect(r.terms.map((t) => t.key)).toContain('hiperintens');
  });

  it('aynı çekime ait görüntü ve rapor birbirine bağlanır (aynı bölge, 3 gün arayla)', () => {
    const mr = studies.find((s) => s.files.length === 3)!;
    expect(relatedStudies(mr, studies).map((s) => s.head.id)).toEqual([report.id]);
    const ctStudy = studies.find((s) => s.category === 'ct')!;
    expect(relatedStudies(ctStudy, studies)).toEqual([]);
  });

  it('3B yapıya göre', () => {
    expect(studiesForStructure('brain', studies)).toHaveLength(2);
    expect(studiesForStructure('lungs', studies)).toHaveLength(1);
    expect(studiesForStructure('liver', studies)).toHaveLength(0);
  });
});
