/**
 * Görüntüdeki bir kutunun (piksel konumu) anatomik karşılığının TAHMİNİ.
 *
 * Eksenel beyin kesitinde varsayımlar (arayüzde açıkça yazılır):
 *  - Radyolojik düzen: görüntünün solu hastanın SAĞIDIR.
 *  - Ön taraf (yüz) görüntünün üstündedir.
 *  - Kesit düzeyi bilinmez: aynı konum farklı düzeylerde farklı loba düşer; bu yüzden alternatifler
 *    verilir ve güven düşük tutulur.
 */
import { GRAPH } from './knowledge';
import { type AnatomicalLocation, type PixelBox, type Side, score } from './types';

export interface PanelGeometry extends PixelBox {
  /** Orta hat (x1,y1,x2,y2) varsa. */
  midline?: [number, number, number, number];
}

export interface ImageRegion extends PixelBox {
  side: 'left' | 'right';
  vertical: 'top' | 'middle' | 'bottom';
}

/** Görüntünün yarısı → hastanın tarafı (radyolojik düzen). */
export const patientSide = (imageSide: 'left' | 'right'): Exclude<Side, 'both'> => (imageSide === 'left' ? 'right' : 'left');

export function brainLocation(region: ImageRegion, panel: PanelGeometry): AnatomicalLocation {
  const side = patientSide(region.side);
  const cx = region.x + region.w / 2;
  const mid = panel.midline ? (panel.midline[0] + panel.midline[2]) / 2 : panel.x + panel.w / 2;
  const lateral = Math.min(1, Math.abs(cx - mid) / (panel.w / 2));
  let lobe: string;
  let alternatives: string[];
  if (region.vertical === 'top') {
    lobe = 'frontal';
    alternatives = lateral < 0.3 ? ['white-matter', 'corpus-callosum'] : ['parietal'];
  } else if (region.vertical === 'bottom') {
    lobe = 'occipital';
    alternatives = ['cerebellum', 'parietal'];
  } else if (lateral < 0.3) {
    lobe = 'basal-nuclei';
    alternatives = ['thalamus', 'ventricles', 'white-matter'];
  } else {
    lobe = 'temporal';
    alternatives = ['parietal', 'insula'];
  }
  return {
    // Derin yapılar da (bazal çekirdekler, talamus) iki tarafta ayrıdır: yol yarıküre üzerinden gösterilir.
    path: ['brain', `brain.hemisphere-${side}`, `brain.${lobe}`],
    structure: 'brain',
    part: lobe,
    side,
    basis: 'pixel-mapped',
    alternatives: alternatives.map((a) => `brain.${a}`).filter((id) => GRAPH.node(id)),
    confidence: score(0.35, 'kutunun kesit içindeki yeri + varsayımlar (radyolojik düzen, ön taraf yukarıda, kesit düzeyi bilinmiyor)'),
    note: 'Yaklaşık anatomik konum: görüntünün solu hastanın sağı, ön taraf yukarıda kabul edildi; kesit düzeyi bilinmediği için alternatif bölgeler de olası.',
  };
}
