import type { FileInfo } from '@kh/vault';

/** Aynı DICOM serisine ait dosyalar, kesit sırasıyla. */
export function seriesOf(files: FileInfo[], seriesUid: string): FileInfo[] {
  return files
    .filter((f) => f.seriesUid === seriesUid)
    .sort((a, b) => (a.sliceIndex ?? Number.POSITIVE_INFINITY) - (b.sliceIndex ?? Number.POSITIVE_INFINITY) || a.createdAt.localeCompare(b.createdAt));
}

export interface DocGroup {
  key: string;
  head: FileInfo;
  files: FileInfo[];
}

/** Listede her DICOM serisi tek satırdır; diğer belgeler tek tek. */
export function groupDocuments(files: FileInfo[]): DocGroup[] {
  const groups: DocGroup[] = [];
  const bySeries = new Map<string, DocGroup>();
  for (const f of files) {
    if (!f.seriesUid) {
      groups.push({ key: f.id, head: f, files: [f] });
      continue;
    }
    const g = bySeries.get(f.seriesUid);
    if (g) g.files.push(f);
    else {
      const ng = { key: `seri-${f.seriesUid}`, head: f, files: [f] };
      bySeries.set(f.seriesUid, ng);
      groups.push(ng);
    }
  }
  for (const g of bySeries.values()) {
    g.files = seriesOf(g.files, g.head.seriesUid!);
    g.head = g.files[0]!;
  }
  return groups;
}
