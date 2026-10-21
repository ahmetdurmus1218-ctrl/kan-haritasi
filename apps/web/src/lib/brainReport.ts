/**
 * Beyin haritası: radyoloji raporundaki cümleler → beynin bölgeleri → sade dil → adım adım yol.
 *
 * Kaynak YALNIZCA rapor metnidir (ImagingFinding): konum rapordaki anatomik sözcükten gelir
 * ("rapor metninden yaklaşık konum"), görüntü pikselinden değil. Fotoğraftan bölge tahmini yapılmaz.
 * Sade anlatım sözcüklerin genel anlamıdır; cümlenin kişi için ne anlama geldiğini hekim değerlendirir.
 */
import { BRAIN_REGIONS, GRAPH, brainPath } from '@kh/analysis';
import type { ImagingFinding } from './imagingFindings';
import type { ImagingStudy } from './imagingStudies';
import { type SentenceRef, allSentences } from './reportSteps';

/** Beyin haritasına giren yapılar (rapor bölgesi). */
export const BRAIN_STRUCTURES: ReadonlySet<string> = new Set(['brain', 'pituitary']);

/** Beyne yerleşen rapor cümlesi: düğüm her zaman vardır (bölüm yazmıyorsa "brain"). */
export interface BrainFinding extends SentenceRef {
  node: string;
}

export type RegionStatus = 'attention' | 'uncertain' | 'normal' | 'not-assessed' | 'none';

export const REGION_STATUS_TEXT: Record<RegionStatus, string> = {
  attention: 'Raporda dikkat çeken ifade',
  uncertain: 'Raporda kesin olmayan ifade',
  normal: 'Raporda olağan',
  'not-assessed': 'Değerlendirilememiş',
  none: 'Raporda geçmiyor',
};

/** Rapor bulgusunun beyin düğümü ve yolu (tarafı yazılmışsa o yarıküre üzerinden). */
export function brainNodeOf(f: Pick<ImagingFinding, 'structure' | 'part' | 'side'>): { node: string; path: string[] } | null {
  if (!f.structure || !BRAIN_STRUCTURES.has(f.structure)) return null;
  const n = GRAPH.nodeForStructure(f.structure, f.part) ?? GRAPH.node(f.structure);
  if (!n) return null;
  return { node: n.id, path: f.structure === 'brain' ? brainPath(n.id, f.side) : GRAPH.pathTo(n.id).map((x) => x.id) };
}

/** Tüm görüntüleme çalışmalarındaki beyinle ilgili rapor cümleleri (en yeni çalışma önce). */
export function brainFindings(studies: readonly ImagingStudy[]): BrainFinding[] {
  return allSentences(studies).filter((s): s is BrainFinding => Boolean(s.node) && BRAIN_STRUCTURES.has(s.finding.structure ?? ''));
}

/** Bu bölgeye (ya da alt bölümlerine) yerleşen cümleler. "brain" yalnızca bölüm yazmayan genel cümleleri alır. */
export function findingsAt(region: string, all: readonly BrainFinding[]): BrainFinding[] {
  if (region === 'brain') return all.filter((b) => b.node === 'brain');
  return all.filter((b) => b.path.includes(region));
}

const RANK: Record<RegionStatus, number> = { attention: 4, uncertain: 3, 'not-assessed': 2, normal: 1, none: 0 };

export function regionStatus(items: readonly BrainFinding[]): RegionStatus {
  let best: RegionStatus = 'none';
  for (const { finding: f } of items) {
    const s: RegionStatus = f.status === 'abnormal' ? 'attention' : f.status === 'uncertain' ? 'uncertain' : f.status === 'not-assessed' ? 'not-assessed' : 'normal';
    if (RANK[s] > RANK[best]) best = s;
  }
  return best;
}

/** Haritadaki bölgeler: bilgi grafiği adı, grup ve iç dünya. */
export function brainRegions(): Array<{ node: string; name: string; group: string; interior: string }> {
  return BRAIN_REGIONS.map((r) => ({ ...r, name: GRAPH.node(r.node)?.nameTr ?? r.node }));
}
