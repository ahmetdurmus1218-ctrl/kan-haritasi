import { Box3, Vector3 } from 'three';

/**
 * Şematik yapılar: HRA erkek referans kütüphanesinde bu bezlerin modeli yok. Konumlarını
 * göstermek için basit şekiller çizilir; arayüz bunları "şematik" olarak etiketler.
 * Konumlar, aynı koordinat sistemindeki komşu yapılardan (trakea, beyin, böbrekler) türetildi.
 */
export interface SchematicPart {
  id: string;
  structure: string;
  label: null;
  shape: 'sphere' | 'cone';
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  box: Box3;
}

function part(id: string, structure: string, shape: SchematicPart['shape'], position: SchematicPart['position'], scale: SchematicPart['scale'], rotation?: SchematicPart['rotation']): SchematicPart {
  const c = new Vector3(...position);
  const r = Math.max(...scale) * 1.2;
  return { id, structure, label: null, shape, position, scale, rotation, box: new Box3(c.clone().subScalar(r), c.clone().addScalar(r)) };
}

export const SCHEMATIC_PARTS: SchematicPart[] = [
  // Tiroid: trakeanın önünde iki lob ve aradaki köprü (istmus)
  part('schematic:thyroid-l', 'thyroid', 'sphere', [0.016, 0.612, 0.036], [0.008, 0.02, 0.008]),
  part('schematic:thyroid-r', 'thyroid', 'sphere', [-0.023, 0.612, 0.036], [0.008, 0.02, 0.008]),
  part('schematic:thyroid-i', 'thyroid', 'sphere', [-0.0035, 0.602, 0.044], [0.013, 0.005, 0.004]),
  // Hipofiz ve hipotalamus: beyin tabanında
  part('schematic:pituitary', 'pituitary', 'sphere', [0, 0.786, 0.012], [0.0055, 0.0045, 0.0055]),
  part('schematic:hypothalamus', 'hypothalamus', 'sphere', [0, 0.801, 0.006], [0.008, 0.0065, 0.009]),
  // Böbreküstü bezleri: böbreklerin üst iç kutbunda
  part('schematic:adrenal-l', 'adrenals', 'cone', [0.062, 0.366, -0.028], [0.014, 0.018, 0.008], [0, 0.4, -0.25]),
  part('schematic:adrenal-r', 'adrenals', 'cone', [-0.058, 0.35, -0.022], [0.013, 0.019, 0.008], [0, -0.4, 0.25]),
];
