/**
 * Atlas kesiti: "İçine gir"in organ düzeyindeki iç yapısı GERÇEK insan anatomisi ağlarından çizilir.
 *
 * Uygulamanın 3B vücudu HuBMAP İnsan Referans Atlası'ndan (VH Male / VH Female: gerçek bir insan
 * bedeninin kesitlerinden üretilmiş referans organlar, CC BY 4.0) gelir ve bu ağlar organların İÇ
 * bölümlerini de içerir: kalbin dört odacığı, dört kapağı ve papiller kasları; böbreğin kapsülü, korteksi,
 * piramitleri, papillaları, hilusu ve havuzu; beynin ak maddesi, karıncıkları, bazal çekirdekleri ve
 * talamusu; gözün korneası, lensi, vitreusu, retinası, koroidi ve optik siniri; akciğerin bronş ağacı…
 *
 * Bu modül hangi iç dünya basamağının hangi kesitle ve hangi bölümün vurgusuyla çizileceğini VERİYLE
 * tanımlar (saf modül; React yok). Kesit KİŞİNİN görüntüsü değildir: referans atlas = eğitimsel anatomi.
 * Kişiye ait 3B (gerçek BT/MR bölütlemesi) ayrı ekrandadır (`#/kisisel/<organ>`) ve "Gerçek görüntü
 * verisi" diye etiketlenir; iki kaynak aynı sahnede karıştırılmaz.
 */

/** Kameranın bakış yönü (nesneden kameraya; HRA: +X kişinin solu, +Y yukarı, +Z ön). */
export type AtlasView = 'anterior' | 'right-lateral' | 'left-lateral' | 'superior';

export const VIEW_DIR: Record<AtlasView, [number, number, number]> = {
  anterior: [0, 0, 1],
  'right-lateral': [-1, 0, 0],
  'left-lateral': [1, 0, 0],
  superior: [0, 1, 0],
};

/** Bölüm başvurusu: "yapı" ya da "yapı|bölüm" (ör. "heart|mitral"). */
export type PartRef = string;

/** Akış yolu noktası: bölümün merkezi + organ yarıçapı biriminde kaydırma. */
export interface FlowPoint {
  at: PartRef;
  off?: [number, number, number];
}

export interface AtlasStage {
  /** Vurgulanan bölümler; kamera ve kesit düzlemi bunların merkezine gider. Boş: bütün organ. */
  focus?: PartRef[];
  /** Kesit açık mı (varsayılan: tanımdaki kesit). false: organın dış yüzü (loblar, yüzey). */
  cut?: boolean;
  /** Kesitin derinliği (organ yarıçapı biriminde, bakış yönünde; 0 = merkez). Verilmezse odağın merkezi. */
  depth?: number;
  /** Kadraj genişliği (1 = organın tamamı); odakta varsayılan 0,55. */
  zoom?: number;
  /** Kan / hava akışı parçacıkları gösterilsin mi. */
  flow?: boolean;
  /** Etiketlenecek bölümler (en fazla 6; verilmezse odak). */
  labels?: PartRef[];
}

export interface AtlasSectionDef {
  /** İç dünya kimliği. */
  organ: string;
  /** Organın kendisi (HRA yapıları); ilk yapı ana yapıdır (ölçek ve kadraj buna göre). */
  structures: string[];
  /** Ana yapının yalnızca bu bölümleri (verilmezse hepsi). */
  only?: Record<string, string[]>;
  /** Organın çevresindeki yapılar (yakınlık süzgeciyle): damarlar, havuz, üreter… */
  context?: PartRef[];
  /** Saydam çizilen, kesilmeyen yapılar (ör. akciğer dokusu içinde bronş ağacı). */
  ghost?: PartRef[];
  /** Çift organda hangi taraf (kişinin sağı: x < 0). */
  side?: 'right' | 'left';
  view: AtlasView;
  /** Akış yolu (kalpte kanın yolu). Mavi → kırmızı geçişinin olduğu nokta: `oxygenAt`. */
  flow?: FlowPoint[];
  oxygenAt?: number;
  /** Basamak kimliği → kesit görünümü. Burada olmayan basamaklar prosedürel iç dünyayla çizilir. */
  stages: Record<string, AtlasStage>;
  /** Genel bakışta etiketlenen bölümler. */
  labels?: PartRef[];
}

const HEART_FLOW: FlowPoint[] = [
  { at: 'veins|superior vena cava', off: [0, 0.2, 0] },
  { at: 'veins|superior vena cava' },
  { at: 'heart|right-atrium' },
  { at: 'heart|tricuspid' },
  { at: 'heart|right-ventricle' },
  { at: 'heart|pulmonary-valve' },
  { at: 'heart|pulmonary-valve', off: [0.1, 0.55, -0.2] },
  { at: 'heart|left-atrium', off: [0.15, 0.35, -0.45] },
  { at: 'heart|left-atrium' },
  { at: 'heart|mitral' },
  { at: 'heart|left-ventricle' },
  { at: 'heart|aortic-valve' },
  { at: 'aorta|ascending aorta' },
  { at: 'aorta|aortic arch' },
];

export const ATLAS_SECTIONS: Record<string, AtlasSectionDef> = {
  heart: {
    organ: 'heart',
    structures: ['heart'],
    context: [
      'aorta|ascending aorta',
      'aorta|aortic arch',
      'coronary-arteries',
      'pulmonary-vessels',
      'veins|superior vena cava',
      'veins|coronary sinus',
      'veins|great cardiac vein',
      'veins|middle cardiac vein',
      'veins|small cardiac vein',
      'veins|anterior cardiac vein',
    ],
    view: 'anterior',
    flow: HEART_FLOW,
    oxygenAt: 7,
    labels: ['heart|right-atrium', 'heart|right-ventricle', 'heart|left-atrium', 'heart|left-ventricle', 'heart|mitral', 'heart|septum'],
    stages: {
      inside: { flow: true },
      ra: { focus: ['heart|right-atrium'], flow: true },
      tricuspid: { focus: ['heart|tricuspid'], flow: true, labels: ['heart|tricuspid', 'heart|papillary'] },
      rv: { focus: ['heart|right-ventricle'], flow: true },
      pulmonary: { focus: ['heart|pulmonary-valve'], flow: true },
      lungs: { focus: ['pulmonary-vessels'], zoom: 1.15, flow: true, labels: ['pulmonary-vessels', 'heart|left-atrium'] },
      la: { focus: ['heart|left-atrium'], flow: true },
      mitral: { focus: ['heart|mitral'], flow: true, labels: ['heart|mitral', 'heart|papillary', 'heart|left-ventricle'] },
      lv: { focus: ['heart|left-ventricle'], flow: true, labels: ['heart|left-ventricle', 'heart|septum', 'heart|papillary'] },
      aorta: { focus: ['heart|aortic-valve'], flow: true, labels: ['heart|aortic-valve', 'aorta|ascending aorta'] },
      systemic: { focus: ['aorta|aortic arch'], zoom: 1.05, flow: true, labels: ['aorta|aortic arch', 'heart|left-ventricle'] },
    },
  },
  kidneys: {
    organ: 'kidneys',
    structures: ['kidneys'],
    side: 'right',
    context: ['urinary-tract|renal-pelvis', 'urinary-tract|calyces', 'urinary-tract|ureter', 'renal-vessels|right renal artery', 'renal-vessels|renal vein R'],
    view: 'anterior',
    labels: ['kidneys|capsule', 'kidneys|cortex', 'kidneys|pyramid', 'kidneys|column', 'kidneys|papilla', 'urinary-tract|renal-pelvis'],
    stages: {
      parenchyma: {},
      blood: { focus: ['renal-vessels|right renal artery', 'renal-vessels|renal vein R'], zoom: 0.8, labels: ['renal-vessels|right renal artery', 'renal-vessels|renal vein R', 'kidneys|cortex', 'kidneys|column'] },
      urine: { focus: ['urinary-tract|renal-pelvis'], zoom: 0.75, labels: ['kidneys|papilla', 'urinary-tract|calyces', 'urinary-tract|renal-pelvis', 'urinary-tract|ureter'] },
    },
  },
  brain: {
    organ: 'brain',
    structures: ['brain'],
    view: 'anterior',
    labels: ['brain|white-matter', 'brain|ventricles', 'brain|basal-nuclei', 'brain|thalamus', 'brain|corpus-callosum', 'brain|insula'],
    stages: {
      parenchyma: { depth: -0.05 },
      csf: { focus: ['brain|ventricles'], zoom: 0.7, labels: ['brain|ventricles', 'brain|corpus-callosum', 'brain|thalamus'] },
      hemisphere: { cut: false, zoom: 1, labels: ['brain|frontal', 'brain|parietal', 'brain|temporal', 'brain|occipital', 'brain|cerebellum'] },
      lobe: { cut: false, focus: ['brain|frontal'], zoom: 0.8, labels: ['brain|frontal', 'brain|motor', 'brain|temporal'] },
    },
  },
  eyes: {
    organ: 'eyes',
    structures: ['eyes'],
    side: 'right',
    // Optik sinir kafatası içine kadar uzanır; kadraj göz küresine göre kalsın diye yalnızca diskle gösterilir.
    only: { eyes: ['sclera', 'cornea', 'iris', 'lens', 'zonule', 'ciliary', 'aqueous', 'vitreous', 'retina', 'macula', 'optic-disc', 'choroid'] },
    view: 'right-lateral',
    labels: ['eyes|cornea', 'eyes|iris', 'eyes|lens', 'eyes|vitreous', 'eyes|retina', 'eyes|optic-disc'],
    stages: {
      p0: {},
      p1: { focus: ['eyes|cornea'], zoom: 0.75, labels: ['eyes|cornea', 'eyes|aqueous'] },
      p2: { focus: ['eyes|aqueous'], zoom: 0.75, labels: ['eyes|aqueous', 'eyes|iris', 'eyes|cornea'] },
      p3: { focus: ['eyes|lens'], zoom: 0.75, labels: ['eyes|lens', 'eyes|zonule', 'eyes|ciliary'] },
      p4: { focus: ['eyes|vitreous'], zoom: 0.8, labels: ['eyes|vitreous', 'eyes|lens', 'eyes|retina'] },
      p5: { focus: ['eyes|macula'], zoom: 0.8, labels: ['eyes|retina', 'eyes|macula', 'eyes|choroid'] },
      p9: { focus: ['eyes|optic-disc'], zoom: 0.8, labels: ['eyes|optic-disc', 'eyes|retina', 'eyes|choroid'] },
    },
  },
  lungs: {
    organ: 'lungs',
    structures: ['airways'],
    context: ['pulmonary-vessels'],
    ghost: ['lungs'],
    view: 'anterior',
    labels: ['airways|trachea', 'airways|main-bronchi', 'airways|lobar-bronchi', 'airways|segmental-bronchi'],
    stages: {
      air: { cut: false, zoom: 1, labels: ['airways|larynx', 'airways|trachea', 'lungs|right-upper', 'lungs|left-upper'] },
      trachea: { cut: false, focus: ['airways|trachea'], labels: ['airways|trachea', 'airways|tracheal-rings'] },
      bronchus: { cut: false, focus: ['airways|main-bronchi'], zoom: 0.7, labels: ['airways|main-bronchi', 'airways|lobar-bronchi'] },
      bronchiole: { cut: false, focus: ['airways|segmental-bronchi'], zoom: 0.8, labels: ['airways|segmental-bronchi', 'airways|lobar-bronchi'] },
      lobes: { cut: false, zoom: 1, labels: ['lungs|right-upper', 'lungs|right-middle', 'lungs|right-lower', 'lungs|left-upper', 'lungs|left-lower'] },
    },
  },
  liver: {
    organ: 'liver',
    structures: ['liver'],
    context: [
      'gallbladder',
      'abdominal-vessels|portal vein',
      'abdominal-vessels|hepatic portal vein',
      'abdominal-vessels|right branch of portal vein',
      'abdominal-vessels|left branch of portal vein',
      'abdominal-vessels|proper hepatic artery',
      'abdominal-vessels|right hepatic artery',
      'abdominal-vessels|left hepatic artery',
      'abdominal-vessels|right hepatic vein',
      'abdominal-vessels|middle hepatic vein',
      'abdominal-vessels|left hepatic vein',
      'abdominal-vessels|cystic artery',
      'veins|inferior vena cava b',
    ],
    view: 'anterior',
    labels: ['liver|right-lobe', 'liver|left-lobe', 'liver|caudate', 'liver|porta', 'gallbladder'],
    stages: {
      parenchyma: { depth: 0.1 },
      'blood-in': { focus: ['abdominal-vessels|portal vein', 'abdominal-vessels|proper hepatic artery'], zoom: 0.75, labels: ['abdominal-vessels|portal vein', 'abdominal-vessels|proper hepatic artery', 'abdominal-vessels|middle hepatic vein', 'veins|inferior vena cava b'] },
      regions: { cut: false, labels: ['liver|right-lobe', 'liver|left-lobe', 'liver|quadrate', 'liver|caudate', 'liver|ligaments', 'gallbladder'] },
    },
  },
  pancreas: {
    organ: 'pancreas',
    structures: ['pancreas'],
    context: ['small-intestine|duodenum', 'abdominal-vessels|splenic vein', 'abdominal-vessels|superior mesenteric vein', 'abdominal-vessels|superior mesenteric artery'],
    view: 'anterior',
    labels: ['pancreas|head', 'pancreas|body', 'pancreas|tail', 'pancreas|ducts'],
    stages: {
      parenchyma: { focus: ['pancreas|ducts'], zoom: 1 },
      regions: { cut: false, labels: ['pancreas|head', 'pancreas|body', 'pancreas|tail', 'small-intestine|duodenum'] },
    },
  },
};

/** Bu basamak atlas kesitiyle mi çizilir? */
export function atlasStage(organ: string, stage: string): AtlasStage | null {
  return ATLAS_SECTIONS[organ]?.stages[stage] ?? null;
}

export function splitRef(ref: PartRef): [string, string | null] {
  const i = ref.indexOf('|');
  return i < 0 ? [ref, null] : [ref.slice(0, i), ref.slice(i + 1)];
}

/** Bir bölüm bu başvuruya uyuyor mu? */
export function matchesRef(structure: string, label: string | null, ref: PartRef): boolean {
  const [s, l] = splitRef(ref);
  return s === structure && (l === null || l === label);
}

/** Kesitte kullanılan bütün yapılar (yüklenmesi beklenen parçalar). */
export function atlasStructures(def: AtlasSectionDef): Set<string> {
  return new Set([...def.structures, ...(def.context ?? []), ...(def.ghost ?? [])].map((r) => splitRef(r)[0]));
}

/** Katalogda bölüm adı olmayan atlas parçalarının Türkçe adları. */
export const LABEL_TR: Record<string, string> = {
  'aorta|ascending aorta': 'Çıkan aort',
  'aorta|aortic arch': 'Aort kavsi',
  'pulmonary-vessels': 'Akciğer damarları',
  'renal-vessels|right renal artery': 'Böbrek arteri',
  'renal-vessels|renal vein R': 'Böbrek veni',
  'veins|superior vena cava': 'Üst ana toplardamar',
  'veins|inferior vena cava b': 'Alt ana toplardamar',
  'abdominal-vessels|portal vein': 'Kapı (portal) ven',
  'abdominal-vessels|proper hepatic artery': 'Hepatik arter',
  'abdominal-vessels|middle hepatic vein': 'Hepatik venler',
  'coronary-arteries': 'Koroner arterler',
  gallbladder: 'Safra kesesi',
  spleen: 'Dalak',
  'small-intestine|duodenum': 'Duodenum',
};
