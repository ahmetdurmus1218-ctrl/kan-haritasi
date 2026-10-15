/**
 * "İÇİNE GİR" motoru: organın fiziksel/işlevsel iç dünyası. "Daha derine in" (doku → hücre → molekül)
 * mikroanatomiye inmektir; "İçine gir" önce organın İÇİNE girer:
 *
 *   hollow / tubular  ORGAN → LÜMEN → İÇERİK → AKIŞ / HAREKET → İŞLEV → DUVAR → DOKU → HÜCRE → MOLEKÜL
 *   solid             ORGAN → PARANKİM → FONKSİYONEL BÖLGE → KANLANMA / AKIŞ → MİKROANATOMİ → HÜCRE → MOLEKÜL
 *   vascular          DAMAR → LÜMEN → KAN AKIŞI → KAN HÜCRELERİ → ENDOTEL → DÜZ KAS → DUVAR → MOLEKÜL
 *   compound          birden çok iç dünya (ör. kalp odacıkları, akciğer = hava yolu + parankim, göz, kulak)
 *
 * Tek bir genel motor tüm vücut için çalışır: her yapı bir OrganInteriorDefinition ile VERİDEN tanımlanır,
 * arayüz ve 3B sahne bu tanımdan çizilir. İçerik genel eğitim bilgisidir (normal anatomi/fizyoloji);
 * kişiye ait bilgi yalnızca kişisel katmanda, kaynağıyla gösterilir.
 */

export type InteriorType = 'hollow' | 'solid' | 'vascular' | 'tubular' | 'compound';

/**
 * Deneyim kalıbı (İçine gir'in ilk sahnesinin ne olacağı). Organın gerçek anatomisine göre seçilir;
 * kalıp değişse de deneyim mantığı aynıdır: önce organın KENDİ iç dünyası, sonra (isteğe bağlı) duvar → doku → hücre → molekül.
 *   hollow    lümen → içerik → hareket → işlev → duvar
 *   solid     parankim → fonksiyonel bölgeler → kan/işlev süreci → mikroanatomi
 *   vascular  lümen → kan akışı → kan hücreleri → damar duvarı
 *   chamber   odacıklar → akış → kapaklar → işlev → duvar (kalp)
 *   airway    hava yolu → hava akışı → gaz değişimi → doku
 *   sensory   uyaranın yolu (ışık / ses / denge) → algılayıcı hücre → sinir
 */
export type InteriorArchetype = 'hollow' | 'solid' | 'vascular' | 'chamber' | 'airway' | 'sensory';

/** Ölçek merdiveni (§43): WHOLE BODY → SYSTEM → ORGAN → ORGAN INTERIOR → REGION → TISSUE → CELL → MOLECULE. */
export type InteriorScale = 'interior' | 'region' | 'tissue' | 'cell' | 'molecule';
export const SCALE_LEVEL: Record<'body' | 'system' | 'organ' | InteriorScale, number> = { body: 0, system: 1, organ: 2, interior: 3, region: 4, tissue: 5, cell: 6, molecule: 7 };
export const SCALE_TR: Record<InteriorScale, string> = {
  interior: 'Organın içi',
  region: 'Bölge',
  tissue: 'Doku',
  cell: 'Hücre',
  molecule: 'Molekül / biyolojik süreç',
};

export type StageKind =
  | 'lumen'
  | 'content'
  | 'motion'
  | 'process'
  | 'flow'
  | 'parenchyma'
  | 'region'
  | 'wall'
  | 'tissue'
  | 'cell'
  | 'molecule';

/** 3B sahnede bu adımın vurguladığı şey. `path:N` → akış yolunun N. basamağı. */
export type SceneFocus = 'overview' | 'lumen' | 'contents' | 'motion' | 'absorb' | 'secrete' | 'wall' | 'flow' | 'units' | 'exchange' | `path:${number}`;

export interface InteriorStage {
  id: string;
  kind: StageKind;
  scale: InteriorScale;
  title: string;
  text: string;
  /** Bilgi grafiği düğümü (derin anatomiye geçiş ve kişisel konum eşleşmesi). */
  node?: string;
  /** Var olan eğitsel sahne (web: simülasyon / doku atlası kimliği). */
  scene?: string;
  focus?: SceneFocus;
  /** Bu basamakla ilişkili laboratuvar testleri (katalog anahtarı). */
  biomarkers?: string[];
  /** Fizyoloji grafiği zinciri (physiology.ts). */
  chain?: string;
  /** "Bunun devamı nerede?": başka bir iç dünyaya geçiş. */
  next?: Array<{ to: string; label: string }>;
}

export type Lining = 'villi' | 'folds' | 'rugae' | 'haustra' | 'smooth' | 'squamous' | 'cilia' | 'urothelium' | 'trabeculae' | 'mucosa' | 'skin';
export type ContentKind = 'chyme' | 'bolus' | 'saliva' | 'feces' | 'bile' | 'juice' | 'air' | 'urine' | 'blood' | 'mucus' | 'fluid' | 'sperm' | 'none';
export type UnitKind = 'lobule' | 'nephron' | 'follicle' | 'neuron' | 'acinus' | 'islet' | 'alveoli' | 'fibers' | 'layers' | 'osteon' | 'cells' | 'tubules' | 'fascicles';

export type SceneSpec =
  | { kind: 'lumen'; shape: 'tube' | 'sac' | 'canal'; lining: Lining; content: ContentKind; radius: number; wave: number; flow: number; color: string }
  | { kind: 'vessel'; caliber: 'large' | 'medium' | 'small' | 'capillary'; pulse: boolean; color: string }
  | { kind: 'chambers'; color: string }
  | { kind: 'parenchyma'; unit: UnitKind; color: string; inflow: string; outflow: string }
  | { kind: 'pathway'; signal: 'sound' | 'light' | 'air'; color: string };

export interface InteriorMode {
  id: string;
  name: string;
  text: string;
  /** 0–1: sahnedeki içerik yoğunluğu, hareket, sindirim ve emilim hızı (eğitimsel; kişiden türetilmez). */
  content: number;
  motion: number;
  digestion: number;
  absorption: number;
}

export interface InteriorRoute {
  title: string;
  steps: Array<{ label: string; to?: string; focus?: SceneFocus }>;
}

export interface OrganInteriorDefinition {
  organId: string;
  name: string;
  type: InteriorType;
  /** Deneyim kalıbı; verilmezse türden ve sahneden türetilir (interiorArchetype). */
  archetype?: InteriorArchetype;
  /** Katalog sistemi (sindirim, dolaşım…). */
  system: string;
  summary: string;
  /** Organ sayfasına bağlanan bilgi grafiği düğümü. */
  anchor?: string;
  /** 3B katalog yapısı: kişisel bölütleme ve "3B'de göster". */
  structure?: string;
  /** Bu kimliğe yönlenen diğer kimlikler (katalog yapısı, grafik düğümü). */
  aliases?: string[];
  /** Üst iç dünya (duodenum → ince bağırsak). */
  parent?: string;
  interiorScene: SceneSpec;
  lumen?: { enabled: boolean; contents?: string[]; flow?: string[] };
  functionalRegions?: Array<{ id: string; name: string; text: string; interior?: string; node?: string }>;
  /** Lümenden dışa doğru (hollow/tubular/vascular) ya da yüzeyden derine (solid). */
  wallLayers?: Array<{ id: string; name: string; text: string; node?: string }>;
  /** Akış yolları (kalpte kanın yolu, emilim yolu, safra yolu…). */
  routes?: InteriorRoute[];
  /** flows.ts akış kimlikleri. */
  physiologyFlows?: string[];
  /** physiology.ts zincir kimlikleri. */
  physiologyChains?: string[];
  /** "Daha derine in" başlangıç düğümü (bilgi grafiği). */
  deepAnatomyEntry?: string;
  relatedSystems?: string[];
  /** Kişisel veri bağları: laboratuvar test anahtarları. */
  personalDataBindings?: string[];
  /** Eğitimsel normal simülasyon modları (ör. boş / sindirim / emilim). Kişisel veri DEĞİLDİR. */
  modes?: InteriorMode[];
  stages: InteriorStage[];
}
