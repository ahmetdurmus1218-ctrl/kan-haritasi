/**
 * "İÇİNE GİR": bir bulgudan ne kadar derine GERÇEKTEN inilebileceği, verinin ne desteklediğine göre belirlenir.
 *
 *   FULL           görüntü → bulgu → gerçek konum (voksel/maske/kutu) → 3B → organ → doku → hücre → fizyoloji
 *   PARTIAL        görüntü → bulgu → anatomi (konum yalnızca bölge) → fizyoloji
 *   CLASSIFICATION görüntü → bulgu skoru → ilgili organ → normal anatomi → fizyoloji (sahte konum YOK)
 *   REPORT         rapor → bulgu → anatomi (rapor kaynaklı konum) → fizyoloji
 *
 * Genel anatomi her zaman derinleşebilir; kişiye ait "burada şu var" yalnızca gerçek konum varsa söylenir.
 */
import { GRAPH, type KNode } from './knowledge';
import type { MedicalFinding, ModelStructure, ReportFinding } from './types';

export type InsideDepth = 'FULL' | 'PARTIAL' | 'CLASSIFICATION' | 'REPORT';

export interface InsideCapability {
  depth: InsideDepth;
  sourceImage?: string;
  sourceSeries?: string;
  sourceFrame?: number;
  coordinates?: { kind: 'voxel-lps-mm' | 'pixel'; value: number[] };
  localizationAvailable: boolean;
  segmentationAvailable: boolean;
  anatomyAvailable: boolean;
  threeDAvailable: boolean;
  physiologyAvailable: boolean;
  deepDiveAvailable: boolean;
  /** İçine gir hedefi: bilgi grafiğindeki en özel düğüm. */
  node?: KNode;
  /** Bu düğümden genel anatomide kaç seviye daha inilebilir. */
  generalDepth: number;
  /** Kullanıcıya gösterilecek zincir (dürüst). */
  chain: string[];
  /** Neden daha derine kişisel olarak inilemediği. */
  limit?: string;
}

const DEPTH_TR: Record<InsideDepth, string> = {
  FULL: 'Gerçek konum: görüntü → bulgu → konum → 3B → organ → doku → hücre → fizyoloji',
  PARTIAL: 'Bölge düzeyinde: görüntü → bulgu → anatomi → fizyoloji',
  CLASSIFICATION: 'Skor düzeyinde: görüntü → bulgu skoru → ilgili organ → fizyoloji (konum yok)',
  REPORT: 'Rapor düzeyinde: rapor → bulgu → anatomi → fizyoloji (rapor kaynaklı konum)',
};
export const INSIDE_DEPTH_TR = DEPTH_TR;

function targetNode(loc: { path?: string[]; structure?: string; part?: string } | undefined): KNode | undefined {
  if (!loc) return undefined;
  for (const id of [...(loc.path ?? [])].reverse()) {
    const n = GRAPH.node(id);
    if (n) return n;
  }
  return loc.structure ? GRAPH.nodeForStructure(loc.structure, loc.part) : undefined;
}

function physiologyOf(n: KNode | undefined): boolean {
  if (!n) return false;
  return GRAPH.functionsOf(n.id, 3).length > 0 || GRAPH.pathTo(n.id).some((p) => GRAPH.functionsOf(p.id, 3).length > 0);
}

/** Model ya da rapor bulgusu / model yapısı için içine girme yeteneği. */
export function insideCapability(f: MedicalFinding | ModelStructure | ReportFinding): InsideCapability {
  const isReport = 'negated' in f || ('source' in f && f.source === 'RADIOLOGY_REPORT' && !('model' in f));
  const loc = 'anatomicalStructure' in f ? f.anatomicalStructure : 'location' in f ? f.location : undefined;
  const node = targetNode(loc);
  const L = f.localization;
  const doc = 'provenance' in f ? f.provenance.documentId : 'documentId' in f ? f.documentId : undefined;
  const frame = 'provenance' in f ? f.provenance.frame : undefined;
  const generalDepth = node ? GRAPH.depthOf(node.id) : 0;
  const base = {
    sourceImage: doc,
    sourceFrame: frame,
    anatomyAvailable: Boolean(node),
    physiologyAvailable: physiologyOf(node),
    deepDiveAvailable: generalDepth > 0,
    node,
    generalDepth,
  };
  if (isReport)
    return {
      ...base,
      depth: 'REPORT',
      localizationAvailable: false,
      segmentationAvailable: false,
      threeDAvailable: Boolean(node?.structure),
      chain: ['Rapor', 'Bulgu', 'Anatomi (rapor kaynaklı konum)', 'Fizyoloji'],
      limit: 'Konum rapordaki anatomik ifadeden eşleştirildi; gerçek görüntü koordinatı değildir.',
    };
  if (L.kind === 'volume')
    return {
      ...base,
      depth: 'FULL',
      coordinates: { kind: 'voxel-lps-mm', value: L.centroid },
      sourceFrame: L.centroidSlice,
      localizationAvailable: true,
      segmentationAvailable: true,
      threeDAvailable: true,
      chain: ['Görüntü (seri)', 'Bulgu / yapı', 'Gerçek konum (voksel maskesi)', 'Kişisel 3B', 'Organ', 'Doku', 'Hücre', 'Fizyoloji'],
      limit: 'Kişiye ait bilgi voksel düzeyinde biter; doku ve hücre seviyeleri genel anatomidir (bu hücrede şu var denmez).',
    };
  if (L.kind === 'pixel' || L.kind === 'point')
    return {
      ...base,
      depth: 'FULL',
      coordinates: { kind: 'pixel', value: L.kind === 'pixel' ? [L.box.x, L.box.y, L.box.w, L.box.h] : [L.x, L.y] },
      sourceFrame: L.frame,
      localizationAvailable: true,
      segmentationAvailable: L.kind === 'pixel' && Boolean(L.mask),
      threeDAvailable: Boolean(node?.structure),
      chain: ['Görüntü', 'Bulgu', 'Gerçek konum (görüntü üzerinde)', 'Organ', 'Doku', 'Hücre', 'Fizyoloji'],
      limit: '2B görüntüdeki konumdur; 3B karşılığı yalnızca seride hesaplanabilir (3B\'de organ düzeyinde gösterilir).',
    };
  if (node && L.kind === 'region-only')
    return { ...base, depth: 'PARTIAL', localizationAvailable: false, segmentationAvailable: false, threeDAvailable: Boolean(node.structure), chain: ['Görüntü', 'Bulgu', 'Anatomi (bölge)', 'Fizyoloji'], limit: 'Model bulguyu yalnızca bölge/organ düzeyinde verdi; görüntüde konum yok.' };
  return {
    ...base,
    depth: 'CLASSIFICATION',
    localizationAvailable: false,
    segmentationAvailable: false,
    threeDAvailable: false,
    chain: ['Görüntü', 'Bulgu skoru', 'İlgili organ (normal anatomi)', 'Fizyoloji'],
    limit: 'Sınıflandırma modeli konum vermez: görüntüde ya da 3B\'de sahte kutu/maske çizilmez.',
  };
}
