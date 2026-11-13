import { type Box3, Color, Plane, Vector3 } from 'three';

/**
 * "İçine gir"in ilk adımı: organın GERÇEK 3B modeli bir kesit düzlemiyle açılır (anatomi atlasındaki
 * kesit gibi). Modelin kesilen tarafı gizlenir; içeride görünen yüzler dokunun kesit rengiyle çizilir.
 * Prosedürel (temsili) iç dünya sahneleri yalnız gerçek modeli olmayan yapılarda ve "Daha derine in"de
 * kullanılır.
 *
 *   frontal     önden (koronal) kesit: ön yarı kaldırılır, kamera önden bakar (kalp, akciğer, böbrek…)
 *   sagittal    orta hat (sagital) kesit: sol yarı kaldırılır, kamera soldan iç yüze bakar (beyin)
 *   horizontal  yatay kesit: üst yarı kaldırılır, kamera üstten bakar (göz)
 */
export type SectionKind = 'frontal' | 'sagittal' | 'horizontal';

interface SectionSpec {
  kind: SectionKind;
  /** Kesitin merkezden kayması (kutunun ilgili eksen boyunun oranı; + = kameraya doğru). */
  offset?: number;
  /** Kamera açısı [azimut, yükseklik] (derece). */
  view?: [number, number];
}

const SPECS: Record<string, SectionSpec> = {
  brain: { kind: 'sagittal', offset: 0.01, view: [90, 8] },
  'spinal-cord': { kind: 'sagittal', view: [90, 5] },
  eyes: { kind: 'horizontal', view: [0, 72] },
  heart: { kind: 'frontal', offset: 0.04, view: [8, 12] },
  pituitary: { kind: 'sagittal', view: [90, 5] },
  hypothalamus: { kind: 'sagittal', view: [90, 5] },
  pineal: { kind: 'sagittal', view: [90, 5] },
};

export function sectionSpec(structure: string): Required<SectionSpec> {
  const s = SPECS[structure];
  const kind = s?.kind ?? 'frontal';
  const view: [number, number] = s?.view ?? (kind === 'sagittal' ? [90, 6] : kind === 'horizontal' ? [0, 70] : [10, 10]);
  return { kind, offset: s?.offset ?? 0, view };
}

/** Kesit düzlemi: düzlemin kameraya bakan tarafı kesilir. */
export function sectionPlane(structure: string, box: Box3): Plane {
  const { kind, offset } = sectionSpec(structure);
  const c = box.getCenter(new Vector3());
  const s = box.getSize(new Vector3());
  // three.js: n·p + d < 0 olan noktalar kırpılır
  if (kind === 'sagittal') return new Plane(new Vector3(-1, 0, 0), c.x + s.x * offset); // +X kişinin solu → sol yarı gider
  if (kind === 'horizontal') return new Plane(new Vector3(0, -1, 0), c.y + s.y * offset); // üst yarı gider
  return new Plane(new Vector3(0, 0, -1), c.z + s.z * offset); // ön yarı gider
}

/** Tüm vücuda yayılan yapılar: kesitle "içine girmek" anlamsız (iskelet, kaslar, deri, sinirler, damar ağları). */
const NO_SECTION = new Set(['bones', 'skeletal-muscle', 'skin', 'nerves', 'veins', 'limb-vessels', 'lymph-node', 'joints']);
export function sectionable(structure: string | undefined): structure is string {
  return !!structure && !NO_SECTION.has(structure);
}

/**
 * Kesit görünümünde basamağın öne çıkardığı bölüm(ler): basamak kimliği ya da düğümü (ör. kidneys.medulla)
 * modeldeki bölüm adına çevrilir. Kamera o bölüme yaklaşır, diğerleri soluklaşır.
 */
const STAGE_PARTS: Record<string, Record<string, string[]>> = {
  heart: {
    ra: ['right-atrium'],
    tricuspid: ['tricuspid'],
    rv: ['right-ventricle'],
    pulmonary: ['pulmonary-valve'],
    la: ['left-atrium'],
    mitral: ['mitral', 'papillary'],
    lv: ['left-ventricle'],
    aorta: ['aortic-valve'],
  },
  kidneys: { cortex: ['cortex', 'column'], medulla: ['pyramid', 'papilla'] },
  brain: { csf: ['ventricles'], hemisphere: ['corpus-callosum', 'cingulate'], deep: ['thalamus', 'basal-nuclei', 'hippocampus', 'amygdala'] },
};
export function stageParts(structure: string, stageId: string, node: string | undefined): string[] {
  const byId = STAGE_PARTS[structure]?.[stageId];
  if (byId) return byId;
  if (node?.startsWith(`${structure}.`)) return [node.slice(structure.length + 1)];
  return [];
}

const CUT: Record<string, string> = {
  'brain|white-matter': '#ece2d2',
  'brain|corpus-callosum': '#efe6d6',
  'brain|ventricles': '#4a3f3c',
  heart: '#8e2a26',
  bones: '#e3d6b8',
  joints: '#dfe6e8',
  lungs: '#d79aa0',
  liver: '#7a2a20',
  kidneys: '#8a2e26',
  'kidneys|pyramid': '#b0584a',
  spleen: '#6e2032',
  'skeletal-muscle': '#a8322a',
  'eyes|vitreous': '#dfeef4',
  // İçi boş organlar: iç yüz mukoza (kırmızımsı), damarlarda iç zar (soluk pembe)
  stomach: '#b04a4a',
  esophagus: '#a84646',
  'small-intestine': '#bb5650',
  'large-intestine': '#ad5a50',
  'urinary-tract': '#cf9286',
  gallbladder: '#4c7a32',
  uterus: '#a84a58',
  airways: '#c46a6a',
  mouth: '#b8585e',
  aorta: '#d49a98',
  'coronary-arteries': '#d49a98',
  'carotid-arteries': '#d49a98',
  'pulmonary-vessels': '#c8a0a8',
  'abdominal-vessels': '#d49a98',
  'renal-vessels': '#d49a98',
  'eyes|lens': '#efe2b0',
};
const cache = new Map<string, string>();
/** Kesit yüzü rengi: dokuya özgü (beyaz cevher, karıncık, kalp kası…) ya da yüzey renginin biraz açığı. */
export function cutColor(structure: string, label: string | null, base: string): string {
  const k = `${structure}|${label ?? ''}|${base}`;
  let out = cache.get(k);
  if (!out) {
    out = (label && CUT[`${structure}|${label}`]) || CUT[structure] || `#${new Color(base).lerp(new Color('#ffffff'), 0.16).getHexString()}`;
    cache.set(k, out);
  }
  return out;
}
