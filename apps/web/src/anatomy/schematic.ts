import { Box3, Vector3 } from 'three';

/**
 * Şematik yapılar: kullanılan model kaynaklarında (HRA, BodyParts3D) tiroid bezinin modeli yok.
 * Konumunu göstermek için basit şekiller çizilir; arayüz bunu "şematik" olarak etiketler.
 * Konum, aynı koordinat sistemindeki komşu yapılardan (trakea, gırtlak) türetildi.
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
];
