/**
 * Görüntü yarısı ↔ hastanın tarafı (radyolojik düzen: görüntünün solu hastanın SAĞIDIR).
 *
 * Bir fotoğraftaki/kesitteki piksel kutusunu bir beyin lobuna eşleyen tahmin kaldırıldı: kesit düzeyi,
 * çekim açısı ve yansıma bilinmeden "sağ alın lobu" gibi bir konum sahte kesinlik veriyordu. Anatomik
 * konum yalnızca gerçek bölütleme maskesinden (yerel model) ya da rapor metninden gelir.
 */
import { GRAPH } from './knowledge';
import type { PixelBox, Side } from './types';

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

/**
 * Beyin düğümüne genelden özele yol. Taraf yazılmışsa o yarıküre üzerinden (Beyin › Sol yarıküre › Alın
 * lobu); yazılmamışsa ya da "her iki" denmişse yarıküreler üzerinden (Beyin › Yarıküreler › Alın lobu) —
 * raporda olmayan bir taraf yola eklenmez.
 */
export function brainPath(nodeId: string, side?: Side): string[] {
  if (side === 'left' || side === 'right') return GRAPH.pathTo(nodeId, `brain.hemisphere-${side}`).map((n) => n.id);
  return GRAPH.pathTo(nodeId).map((n) => (n.id === 'brain.hemisphere-left' || n.id === 'brain.hemisphere-right' ? (n.id === nodeId ? n.id : 'brain.cerebrum') : n.id));
}
