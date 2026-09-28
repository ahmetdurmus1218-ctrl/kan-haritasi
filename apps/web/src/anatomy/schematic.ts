import { Box3, Vector3 } from 'three';
import type { ModelPart } from './models';

/**
 * Şematik yapılar: kullanılan açık model kaynaklarında (HRA, BodyParts3D) tiroid bezi ve kulak yok.
 * Konumlarını göstermek için basit şekiller çizilir; arayüz bunları "şematik" olarak etiketler.
 * Konum, seçili vücudun (erkek/kadın) komşu yapılarından türetilir: tiroid gırtlak ve trakeadan,
 * kulak kafatası ve gözlerden.
 */
export type SchematicShape = 'sphere' | 'cone' | 'torus' | 'spiral' | 'cylinder' | 'disc';

export interface SchematicPart {
  id: string;
  structure: string;
  label: string | null;
  shape: SchematicShape;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  box: Box3;
}

function part(
  id: string,
  structure: string,
  label: string,
  shape: SchematicShape,
  position: SchematicPart['position'],
  scale: SchematicPart['scale'],
  rotation?: SchematicPart['rotation'],
): SchematicPart {
  const c = new Vector3(...position);
  const r = Math.max(...scale) * 1.3;
  return { id, structure, label, shape, position, scale, rotation, box: new Box3(c.clone().subScalar(r), c.clone().addScalar(r)) };
}

function boxOfParts(parts: ModelPart[], structure: string, label?: string): Box3 | null {
  const b = new Box3();
  for (const p of parts) if (p.structure === structure && (label === undefined || p.label === label)) b.union(p.box);
  return b.isEmpty() ? null : b;
}

/** Yüklenen modellere göre şematik parçalar (komşu yapı henüz yüklenmediyse o parça çizilmez). */
export function schematicParts(parts: ModelPart[]): SchematicPart[] {
  const out: SchematicPart[] = [];
  const body = parts[0]?.body ?? 'male';

  // Tiroid: tiroid kıkırdağının altında, trakeanın önünde iki lob ve aradaki köprü (istmus)
  const larynx = boxOfParts(parts, 'airways', 'larynx');
  const trachea = boxOfParts(parts, 'airways', 'trachea');
  if (larynx && trachea) {
    const x = (larynx.min.x + larynx.max.x) / 2;
    const y = larynx.min.y - 0.012;
    const z = trachea.max.z - 0.002;
    out.push(part(`${body}:thyroid-l`, 'thyroid', 'left-lobe', 'sphere', [x + 0.018, y, z - 0.004], [0.008, 0.02, 0.009]));
    out.push(part(`${body}:thyroid-r`, 'thyroid', 'right-lobe', 'sphere', [x - 0.018, y, z - 0.004], [0.008, 0.02, 0.009]));
    out.push(part(`${body}:thyroid-i`, 'thyroid', 'isthmus', 'sphere', [x, y - 0.008, z + 0.003], [0.013, 0.005, 0.004]));
  }

  // Kulak: dış kulak yolu, kulak zarı, kemikçikler, iç kulak (koklea, yarım daire kanalları, vestibül)
  const skull = boxOfParts(parts, 'bones', 'skull');
  const eyes = boxOfParts(parts, 'eyes');
  if (skull && eyes) {
    const cx = (skull.min.x + skull.max.x) / 2;
    const half = (skull.max.x - skull.min.x) / 2;
    const eyeC = eyes.getCenter(new Vector3());
    const y = eyeC.y - 0.028;
    const z = eyeC.z - 0.085;
    for (const [side, sx] of [
      ['l', 1],
      ['r', -1],
    ] as const) {
      const outer = cx + sx * half * 0.93;
      const drum = cx + sx * (half * 0.93 - 0.024);
      const inner = drum - sx * 0.01;
      out.push(part(`${body}:ear-canal-${side}`, 'ear', 'canal', 'cylinder', [(outer + drum) / 2, y, z], [0.0045, 0.012, 0.0045], [0, 0, Math.PI / 2]));
      out.push(part(`${body}:ear-drum-${side}`, 'ear', 'eardrum', 'disc', [drum, y, z], [0.0048, 0.0048, 0.0006], [0, Math.PI / 2, 0]));
      out.push(part(`${body}:ear-ossicles-${side}`, 'ear', 'ossicles', 'sphere', [drum - sx * 0.004, y + 0.001, z], [0.0028, 0.0035, 0.0022]));
      out.push(part(`${body}:ear-vestibule-${side}`, 'ear', 'vestibule', 'sphere', [inner, y, z - 0.002], [0.0035, 0.0035, 0.0035]));
      out.push(part(`${body}:ear-cochlea-${side}`, 'ear', 'cochlea', 'spiral', [inner, y - 0.002, z + 0.007], [0.0055, 0.0055, 0.0055], [0, (sx * Math.PI) / 2, 0]));
      out.push(part(`${body}:ear-canals-a-${side}`, 'ear', 'canals', 'torus', [inner, y + 0.006, z - 0.005], [0.0045, 0.0045, 0.0045], [0, 0, 0]));
      out.push(part(`${body}:ear-canals-b-${side}`, 'ear', 'canals', 'torus', [inner - sx * 0.002, y + 0.004, z - 0.008], [0.0042, 0.0042, 0.0042], [0, Math.PI / 2, 0]));
      out.push(part(`${body}:ear-canals-c-${side}`, 'ear', 'canals', 'torus', [inner + sx * 0.002, y + 0.001, z - 0.006], [0.004, 0.004, 0.004], [Math.PI / 2, 0, 0]));
    }
  }
  return out;
}
