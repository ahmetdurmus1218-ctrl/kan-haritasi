/**
 * Fizyoloji grafiği: organ, doku, hücre, molekül, hormon, metabolit, kan bileşeni ve süreç düğümleri;
 * aralarında fiil taşıyan ilişkiler (üretir, taşır, emer, süzer, salgılar, düzenler, uyarır, baskılar,
 * değiş tokuş eder, metabolize eder, iletişim kurar, girer, depolar, salıverir).
 *
 *   PANKREAS —salgılar→ İNSÜLİN —düzenler→ GLUKOZ —girer→ HÜCRE —üretir→ ATP
 *
 * Zincirler (PhysioChain) bu kenarların sıralı dizisidir; her düğüm bir iç dünyaya ya da organ sayfasına
 * götürür ("Bunun devamı nerede?"). Kişisel katman yalnızca VERİSİ olan düğümlere sonucu yerleştirir;
 * ilişki her zaman "olası"dır. Geçmiş ölçüm yoksa eğilim üretilmez.
 *
 * İçerik genel eğitim bilgisidir (KNOWLEDGE); kişiye özel değildir.
 */
import type { HealthModel } from './fusion';
import type { LabObservation } from './types';

export type PhysioKind = 'organ' | 'tissue' | 'cell' | 'molecule' | 'hormone' | 'metabolite' | 'blood-component' | 'process';

export type PhysioRelation =
  | 'produces'
  | 'transports'
  | 'absorbs'
  | 'filters'
  | 'secretes'
  | 'regulates'
  | 'stimulates'
  | 'inhibits'
  | 'exchanges'
  | 'metabolizes'
  | 'communicates'
  | 'enters'
  | 'stores'
  | 'releases';

export const PHYSIO_REL_TR: Record<PhysioRelation, string> = {
  produces: 'üretir',
  transports: 'taşır',
  absorbs: 'emer',
  filters: 'süzer',
  secretes: 'salgılar',
  regulates: 'düzenler',
  stimulates: 'uyarır',
  inhibits: 'baskılar',
  exchanges: 'değiş tokuş eder',
  metabolizes: 'işler (metabolize eder)',
  communicates: 'sinyal iletir',
  enters: 'girer',
  stores: 'depolar',
  releases: 'kana bırakır',
};

export const PHYSIO_KIND_TR: Record<PhysioKind, string> = {
  organ: 'Organ',
  tissue: 'Doku',
  cell: 'Hücre',
  molecule: 'Molekül',
  hormone: 'Hormon',
  metabolite: 'Metabolit',
  'blood-component': 'Kan bileşeni',
  process: 'Süreç',
};

export interface PhysioNode {
  id: string;
  kind: PhysioKind;
  name: string;
  /** "Bunun devamı nerede?": iç dünya kimliği (interior.ts) — yoksa organ sayfası düğümü. */
  interior?: string;
  organ?: string;
  /** Bu düğümü ölçen laboratuvar testleri (katalog anahtarı). */
  testKeys?: string[];
}

export interface PhysioEdge {
  from: string;
  to: string;
  rel: PhysioRelation;
  note: string;
}

export interface PhysioChain {
  id: string;
  title: string;
  summary: string;
  /**
   * Sıralı kenarlar (basamaklar). Ardışık kenarlar çoğunlukla birbirine bağlanır; dallanma da olabilir
   * (ör. B12 → kemik iliği ve B12 → sinir sistemi): her kenar kendi "A —fiil→ B" basamağıdır.
   */
  edges: PhysioEdge[];
  /** Kişisel katmanın dürüst sınırı. */
  caution: string;
}

const N = (id: string, kind: PhysioKind, name: string, extra: Omit<PhysioNode, 'id' | 'kind' | 'name'> = {}): PhysioNode => ({ id, kind, name, ...extra });

export const PHYSIO_NODES: readonly PhysioNode[] = [
  // Organlar
  N('mouth', 'organ', 'Ağız', { interior: 'ic.mouth' }),
  N('stomach', 'organ', 'Mide', { interior: 'stomach', organ: 'stomach' }),
  N('duodenum', 'organ', 'Duodenum', { interior: 'small-intestine.duodenum', organ: 'small-intestine.duodenum' }),
  N('small-intestine', 'organ', 'İnce bağırsak', { interior: 'small-intestine', organ: 'small-intestine' }),
  N('ileum', 'organ', 'İleum', { interior: 'small-intestine.ileum', organ: 'small-intestine.ileum' }),
  N('large-intestine', 'organ', 'Kalın bağırsak', { interior: 'large-intestine', organ: 'large-intestine' }),
  N('liver', 'organ', 'Karaciğer', { interior: 'liver', organ: 'liver' }),
  N('pancreas', 'organ', 'Pankreas', { interior: 'pancreas', organ: 'pancreas' }),
  N('lungs', 'organ', 'Akciğer', { interior: 'lungs', organ: 'lungs' }),
  N('heart', 'organ', 'Kalp', { interior: 'heart', organ: 'heart' }),
  N('vessels', 'organ', 'Damarlar', { interior: 'ic.artery' }),
  N('kidneys', 'organ', 'Böbrek', { interior: 'kidneys', organ: 'kidneys' }),
  N('bone-marrow', 'organ', 'Kemik iliği', { interior: 'ic.bone-marrow', organ: 'bones' }),
  N('skin', 'organ', 'Deri', { interior: 'skin' }),
  N('bone', 'organ', 'Kemik', { interior: 'ic.bone', organ: 'bones' }),
  N('nervous-system', 'organ', 'Sinir sistemi', { interior: 'nerves' }),
  N('hypothalamus', 'organ', 'Hipotalamus', { organ: 'brain.hypothalamus' }),
  N('pituitary', 'organ', 'Hipofiz', { interior: 'pituitary', organ: 'pituitary' }),
  N('thyroid', 'organ', 'Tiroid', { interior: 'thyroid', organ: 'thyroid' }),
  N('portal-vein', 'organ', 'Portal ven', { interior: 'ic.vein', organ: 'vessel.portal-vein' }),
  N('bladder', 'organ', 'Mesane', { interior: 'urinary-tract.bladder', organ: 'urinary-tract.bladder' }),
  N('muscle', 'organ', 'Kas', { interior: 'skeletal-muscle', organ: 'skeletal-muscle' }),
  N('adipose', 'organ', 'Yağ dokusu', { organ: 'adipose' }),
  // Doku / hücre
  N('glomerulus', 'tissue', 'Glomerül', { interior: 'tissue.nephron', organ: 'tissue.glomerulus' }),
  N('tubule', 'tissue', 'Tübül', { interior: 'tissue.nephron', organ: 'tissue.proximal-tubule' }),
  N('alveolus', 'tissue', 'Alveol', { interior: 'tissue.alveolus', organ: 'tissue.alveolus' }),
  N('parietal-cell', 'cell', 'Parietal hücre', { interior: 'stomach', organ: 'cell.parietal' }),
  N('beta-cell', 'cell', 'Beta hücresi', { interior: 'pancreas.endocrine', organ: 'cell.beta' }),
  N('enterocyte', 'cell', 'Enterosit', { interior: 'small-intestine', organ: 'cell.enterocyte' }),
  N('hepatocyte', 'cell', 'Hepatosit', { interior: 'liver', organ: 'cell.hepatocyte' }),
  N('cell', 'cell', 'Vücut hücresi (kas, karaciğer, yağ)', { organ: 'proc.glucose-uptake' }),
  N('rbc', 'blood-component', 'Alyuvar (eritrosit)', { interior: 'ic.capillary', testKeys: ['rbc', 'hematocrit', 'mcv'] }),
  N('neuron', 'cell', 'Sinir hücresi', { interior: 'nerves', organ: 'cell.neuron' }),
  N('tissue-cells', 'cell', 'Doku hücreleri', { interior: 'ic.capillary' }),
  // Moleküller / hormonlar / metabolitler
  N('glucose', 'metabolite', 'Glukoz', { testKeys: ['glucose', 'hba1c'] }),
  N('insulin', 'hormone', 'İnsülin', { testKeys: ['insulin'] }),
  N('atp', 'molecule', 'ATP (enerji)'),
  N('hemoglobin', 'blood-component', 'Hemoglobin', { testKeys: ['hemoglobin'] }),
  N('oxygen', 'molecule', 'Oksijen (O₂)'),
  N('co2', 'molecule', 'Karbondioksit (CO₂)'),
  N('b12', 'molecule', 'B12 vitamini', { testKeys: ['b12'] }),
  N('intrinsic-factor', 'molecule', 'İç faktör'),
  N('transcobalamin', 'blood-component', 'Transkobalamin (B12 taşıyıcısı)'),
  N('myelin', 'molecule', 'Miyelin', { organ: 'mol.myelin' }),
  N('dna', 'process', 'DNA sentezi ve hücre bölünmesi', { testKeys: ['mcv', 'homocysteine'] }),
  N('iron', 'molecule', 'Demir', { testKeys: ['iron'] }),
  N('transferrin', 'blood-component', 'Transferrin', { testKeys: ['tibc', 'transferrin-saturation', 'uibc'] }),
  N('ferritin', 'molecule', 'Ferritin (depo demir)', { testKeys: ['ferritin'] }),
  N('alt-ast', 'molecule', 'ALT / AST (hücre içi enzimler)', { testKeys: ['alt', 'ast'] }),
  N('amino-transfer', 'process', 'Amino asit dönüşümü (transaminasyon)'),
  N('blood', 'blood-component', 'Kan (plazma)', { interior: 'ic.vein' }),
  N('filtrate', 'metabolite', 'Süzüntü (birincil idrar)', { testKeys: ['creatinine', 'egfr', 'urea'] }),
  N('urine', 'metabolite', 'İdrar'),
  N('electrolytes', 'molecule', 'Su ve elektrolitler', { testKeys: ['sodium', 'potassium', 'chloride'] }),
  N('blood-pressure', 'process', 'Kan basıncı', { organ: 'fn.blood-pressure' }),
  N('renin', 'hormone', 'Renin–anjiyotensin–aldosteron', { organ: 'proc.raas' }),
  N('food', 'metabolite', 'Besin'),
  N('chyme', 'metabolite', 'Kimus (yarı sindirilmiş içerik)'),
  N('enzymes', 'molecule', 'Sindirim enzimleri (amilaz, lipaz, proteaz)', { testKeys: ['amylase', 'lipase'] }),
  N('nutrients', 'metabolite', 'Emilen besinler (glukoz, amino asit, yağ asidi)', { testKeys: ['albumin', 'total-protein', 'triglyceride'] }),
  N('trh-tsh', 'hormone', 'TSH', { testKeys: ['tsh'] }),
  N('t4', 'hormone', 'T4 / T3', { testKeys: ['ft4', 'ft3'] }),
  N('metabolism', 'process', 'Hücrelerin enerji harcama hızı'),
  N('vitamin-d', 'hormone', 'D vitamini', { testKeys: ['vitamin-d'] }),
  N('calcium', 'molecule', 'Kalsiyum ve fosfor', { testKeys: ['calcium', 'phosphorus'] }),
  N('ldl', 'blood-component', 'LDL / HDL lipoproteinleri', { testKeys: ['ldl', 'hdl', 'cholesterol-total', 'triglyceride'] }),
  N('vessel-wall', 'tissue', 'Damar duvarı (endotel)', { interior: 'ic.artery', organ: 'tissue.endothelium' }),
  N('bilirubin', 'metabolite', 'Bilirubin', { testKeys: ['bilirubin-total', 'bilirubin-direct', 'bilirubin-indirect'] }),
  N('bile', 'metabolite', 'Safra', { interior: 'gallbladder', testKeys: ['alp', 'ggt'] }),
];

const E = (from: string, rel: PhysioRelation, to: string, note: string): PhysioEdge => ({ from, to, rel, note });

export const PHYSIO_CHAINS: readonly PhysioChain[] = [
  {
    id: 'glucose',
    title: 'Glukoz: bağırsaktan hücreye',
    summary: 'Besinden gelen glukozun kana geçmesi, insülinle hücrelere girmesi ve enerjiye dönüşmesi.',
    caution: 'Glukoz ve HbA1c bu zincirle ilişkili olabilir; tek başına bir tanı değildir. Değerlendirme hekime aittir.',
    edges: [
      E('small-intestine', 'absorbs', 'glucose', 'Nişasta ve şekerler glukoza parçalanır; enterositler SGLT1 ile içeri alır.'),
      E('glucose', 'stimulates', 'pancreas', 'Yükselen kan şekerini pankreas adacıkları algılar.'),
      E('pancreas', 'secretes', 'insulin', 'Beta hücreleri insülini kana bırakır.'),
      E('insulin', 'regulates', 'glucose', 'İnsülin kas, yağ ve karaciğer hücrelerinin glukoz almasını sağlar (GLUT4).'),
      E('glucose', 'enters', 'cell', 'Glukoz hücreye girer; fazlası glikojen ya da yağ olarak depolanır.'),
      E('cell', 'produces', 'atp', 'Hücre glukozu yakarak ATP üretir.'),
    ],
  },
  {
    id: 'oxygen',
    title: 'Oksijen: akciğerden dokuya',
    summary: 'Kemik iliğinde yapılan alyuvarların hemoglobinle oksijeni akciğerden dokulara taşıması.',
    caution: 'Hemoglobin düşüklüğü oksijen taşınmasıyla ilişkili olabilir; nedeni (demir, B12, kan kaybı vb.) bu zincirden çıkarılamaz.',
    edges: [
      E('bone-marrow', 'produces', 'rbc', 'Kök hücrelerden yaklaşık 120 gün yaşayan alyuvarlar yapılır (demir, B12, folat gerekir).'),
      E('rbc', 'transports', 'hemoglobin', 'Her alyuvar milyonlarca hemoglobin molekülü taşır.'),
      E('lungs', 'exchanges', 'oxygen', 'Alveolde oksijen kana, karbondioksit havaya geçer.'),
      E('oxygen', 'enters', 'hemoglobin', 'Oksijen hemoglobindeki demire bağlanır.'),
      E('hemoglobin', 'transports', 'heart', 'Oksijenli kan kalbin sol tarafından pompalanır.'),
      E('heart', 'transports', 'vessels', 'Aort ve dalları kanı vücuda dağıtır.'),
      E('vessels', 'exchanges', 'tissue-cells', 'Kılcallarda oksijen hücrelere geçer, CO₂ kana alınır.'),
    ],
  },
  {
    id: 'b12',
    title: 'B12: mideden hücreye',
    summary: 'B12 vitamininin mide asidi ve iç faktörle emilime hazırlanması, ileumdan emilip kemik iliği ve sinir sisteminde kullanılması.',
    caution: 'B12 sonucu bu zincirin bir basamağıyla ilişkili olabilir; nedenini (alım, mide, ileum, ilaçlar vb.) tek başına göstermez.',
    edges: [
      E('stomach', 'releases', 'b12', 'Mide asidi ve pepsin B12\'yi besin proteinlerinden ayırır.'),
      E('parietal-cell', 'secretes', 'intrinsic-factor', 'Mide parietal hücreleri iç faktör salgılar.'),
      E('intrinsic-factor', 'transports', 'ileum', 'B12–iç faktör birleşimi ince bağırsağın son bölümüne (ileum) taşınır.'),
      E('ileum', 'absorbs', 'b12', 'İleumdaki reseptörler (kubilin) B12–iç faktörü içeri alır.'),
      E('b12', 'enters', 'transcobalamin', 'Kanda transkobalamine bağlanır.'),
      E('transcobalamin', 'transports', 'bone-marrow', 'Hızla bölünen kemik iliği hücreleri DNA sentezi için B12 kullanır.'),
      E('bone-marrow', 'produces', 'dna', 'B12 ve folat DNA yapımı ve normal büyüklükte alyuvar için gereklidir.'),
      E('transcobalamin', 'transports', 'nervous-system', 'Sinir sistemi miyelin yapımı için B12 kullanır.'),
      E('nervous-system', 'produces', 'myelin', 'Miyelin sinir sinyalinin hızlı iletilmesini sağlar.'),
    ],
  },
  {
    id: 'iron',
    title: 'Demir: bağırsaktan hemoglobine',
    summary: 'Demirin duodenumdan emilmesi, transferrinle taşınması, ferritin olarak depolanması ve hemoglobin yapımında kullanılması.',
    caution: 'Bu sonuçlar demir eksikliğiyle uyumlu olabilir; nedenini (alım, emilim, kan kaybı vb.) tek başına belirlemez.',
    edges: [
      E('duodenum', 'absorbs', 'iron', 'Demir en çok on iki parmak bağırsağında DMT1 ile emilir.'),
      E('iron', 'enters', 'transferrin', 'Ferroportinle kana verilen demir transferrine bağlanır.'),
      E('transferrin', 'transports', 'liver', 'Fazla demir karaciğere taşınır.'),
      E('liver', 'stores', 'ferritin', 'Karaciğer ve dalak demiri ferritin olarak depolar.'),
      E('transferrin', 'transports', 'bone-marrow', 'Kemik iliği demiri alyuvar yapımında kullanır.'),
      E('bone-marrow', 'produces', 'hemoglobin', 'Demir hemoglobinin oksijen bağlayan merkezidir.'),
      E('hemoglobin', 'exchanges', 'lungs', 'Hemoglobin akciğerde oksijen yüklenir.'),
    ],
  },
  {
    id: 'liver-enzymes',
    title: 'ALT / AST: hepatositten kana',
    summary: 'Karaciğer hücrelerinin içinde çalışan enzimlerin hücre zarı zedelendiğinde kana geçmesi.',
    caution: 'ALT/AST yüksekliği tek başına belirli bir hastalık değildir; egzersiz, ilaçlar ve kas da etkileyebilir (AST kas ve kalpte de bulunur).',
    edges: [
      E('liver', 'metabolizes', 'nutrients', 'Karaciğer portal venle gelen besinleri işler.'),
      E('hepatocyte', 'metabolizes', 'amino-transfer', 'ALT ve AST hepatosit içinde amino asitleri dönüştürür.'),
      E('amino-transfer', 'produces', 'alt-ast', 'Enzimler normalde hücrenin içinde kalır; az bir kısmı kana geçer.'),
      E('alt-ast', 'enters', 'blood', 'Hücre zarı zedelenirse kandaki düzey yükselebilir (olası ilişki).'),
    ],
  },
  {
    id: 'kidney',
    title: 'Böbrek: kandan idrara ve dengeye',
    summary: 'Kanın süzülmesi, gerekli maddelerin geri alınması, idrar oluşumu ve sıvı–tuz–kan basıncı dengesi.',
    caution: 'Kreatinin/eGFR ve elektrolitler bu zincirle ilişkili olabilir; tek ölçüm böbrek işlevini kesin göstermez.',
    edges: [
      E('blood', 'enters', 'glomerulus', 'Kalbin pompaladığı kanın yaklaşık beşte biri böbreklere gelir.'),
      E('glomerulus', 'filters', 'filtrate', 'Glomerül dakikada ~90–120 mL plazma süzer; hücreler ve büyük proteinler kanda kalır.'),
      E('filtrate', 'enters', 'tubule', 'Süzüntü uzun tübül boyunca ilerler.'),
      E('tubule', 'absorbs', 'electrolytes', 'Su, sodyum, glukoz ve amino asitlerin çoğu kana geri alınır; potasyum ve asit salgılanır.'),
      E('tubule', 'produces', 'urine', 'Kalan sıvı idrar olarak mesaneye iner.'),
      E('kidneys', 'secretes', 'renin', 'Basınç düşünce böbrek renin salgılar.'),
      E('renin', 'regulates', 'blood-pressure', 'Anjiyotensin ve aldosteron tuz-su tutumunu ve damar tonusunu ayarlar.'),
    ],
  },
  {
    id: 'digestion',
    title: 'Sindirim: ağızdan kana',
    summary: 'Besinin ağızda başlayan sindirimi, midede kimusa dönüşmesi, bağırsakta emilip portal venle karaciğere gitmesi.',
    caution: 'Sindirim enzimleri ve protein düzeyleri bu zincirle ilişkili olabilir; tek başına sindirim bozukluğunu göstermez.',
    edges: [
      E('mouth', 'produces', 'food', 'Çiğneme besini küçültür; tükürük amilazı nişastayı parçalamaya başlar.'),
      E('food', 'enters', 'stomach', 'Lokma yemek borusuyla mideye iner.'),
      E('stomach', 'produces', 'chyme', 'Asit, pepsin ve kas hareketleri besini kimusa çevirir.'),
      E('chyme', 'enters', 'duodenum', 'Kimus az miktarlarda duodenuma geçer.'),
      E('pancreas', 'secretes', 'enzymes', 'Pankreas enzimleri ve bikarbonat duodenuma akar; safra yağları emülsiyon hâline getirir.'),
      E('enzymes', 'regulates', 'small-intestine', 'Besinler emilebilecek yapı taşlarına ayrılır.'),
      E('small-intestine', 'absorbs', 'nutrients', 'Villuslar ve mikrovilluslar besinleri kana ve lenfe alır.'),
      E('nutrients', 'enters', 'portal-vein', 'Bağırsaktan gelen kan önce portal venle karaciğere gider.'),
      E('portal-vein', 'transports', 'liver', 'Karaciğer besinleri işler, depolar, proteinler üretir.'),
    ],
  },
  {
    id: 'thyroid',
    title: 'Tiroid ekseni',
    summary: 'Hipotalamus ve hipofizin tiroidi uyarması, tiroid hormonunun metabolizmayı ayarlaması ve geri bildirim.',
    caution: 'TSH ve serbest T4 bu eksenle ilişkili olabilir; yorum ilaçlara, döneme ve klinik bulgulara bağlıdır.',
    edges: [
      E('hypothalamus', 'stimulates', 'pituitary', 'TRH hipofizi uyarır.'),
      E('pituitary', 'secretes', 'trh-tsh', 'Hipofiz TSH salgılar.'),
      E('trh-tsh', 'stimulates', 'thyroid', 'TSH tiroid foliküllerini uyarır.'),
      E('thyroid', 'secretes', 't4', 'Tiroid T4 (ve T3) salgılar.'),
      E('t4', 'regulates', 'metabolism', 'Tiroid hormonu hücrelerin enerji harcama hızını artırır.'),
      E('t4', 'inhibits', 'pituitary', 'Hormon yükselince hipofiz TSH\'yi azaltır (negatif geri bildirim).'),
    ],
  },
  {
    id: 'vitamin-d',
    title: 'D vitamini ve kalsiyum',
    summary: 'Deride üretilen D vitamininin karaciğer ve böbrekte etkinleşmesi, bağırsaktan kalsiyum emilimini ve kemiği düzenlemesi.',
    caution: 'D vitamini ve kalsiyum bu zincirle ilişkili olabilir; kemik sağlığı tek bir ölçümle değerlendirilemez.',
    edges: [
      E('skin', 'produces', 'vitamin-d', 'Güneşin UVB ışığı deride D vitamini yapımını başlatır.'),
      E('vitamin-d', 'enters', 'liver', 'Karaciğer 25-OH D vitaminine çevirir (kanda ölçülen biçim).'),
      E('liver', 'transports', 'kidneys', 'Böbrek etkin biçime (kalsitriol) dönüştürür.'),
      E('kidneys', 'regulates', 'calcium', 'Etkin D vitamini kalsiyum ve fosfor dengesini ayarlar.'),
      E('calcium', 'enters', 'small-intestine', 'Bağırsaktan kalsiyum emilimi artar.'),
      E('small-intestine', 'transports', 'bone', 'Kalsiyum ve fosfor kemik yapımında kullanılır.'),
    ],
  },
  {
    id: 'lipids',
    title: 'Kolesterol ve damar duvarı',
    summary: 'Karaciğerin lipoprotein üretmesi, LDL\'nin kolesterolü dokulara taşıması, HDL\'nin geri getirmesi.',
    caution: 'LDL/HDL damar sağlığıyla ilişkili olabilir; damarda plak olduğunu göstermez.',
    edges: [
      E('small-intestine', 'absorbs', 'nutrients', 'Yağlar lenf yoluyla, kolesterol bağırsaktan emilir.'),
      E('liver', 'produces', 'ldl', 'Karaciğer VLDL üretir; dolaşımda LDL\'ye dönüşür.'),
      E('ldl', 'transports', 'vessel-wall', 'LDL kolesterolü hücrelere taşır; fazlası damar duvarına girebilir.'),
      E('vessel-wall', 'communicates', 'heart', 'Koroner damarlar kalp kasını besler.'),
    ],
  },
  {
    id: 'bilirubin',
    title: 'Bilirubin: alyuvardan safraya',
    summary: 'Yaşlanan alyuvarların yıkımı, bilirubinin karaciğerde işlenmesi ve safrayla atılması.',
    caution: 'Bilirubin, ALP ve GGT bu zincirle ilişkili olabilir; nedeni ve yeri bu zincirden çıkarılamaz.',
    edges: [
      E('rbc', 'produces', 'bilirubin', 'Dalakta yıkılan alyuvarların hemoglobini bilirubine dönüşür.'),
      E('bilirubin', 'enters', 'hepatocyte', 'Hepatosit bilirubini bağlar (konjugasyon).'),
      E('hepatocyte', 'secretes', 'bile', 'Safra kanalcıklarından safra yollarına atılır.'),
      E('bile', 'enters', 'duodenum', 'Safra yağların sindirimine yardım eder ve dışkıyla atılır.'),
    ],
  },
];

const nodeById = new Map(PHYSIO_NODES.map((n) => [n.id, n]));
const chainById = new Map(PHYSIO_CHAINS.map((c) => [c.id, c]));

export function physioNode(id: string): PhysioNode | undefined {
  return nodeById.get(id);
}

export function physioChain(id: string): PhysioChain | undefined {
  return chainById.get(id);
}

/** Zincirin düğümleri, ilk göründükleri sırayla (her düğüm bir kez). */
export function chainNodes(c: PhysioChain): PhysioNode[] {
  const ids: string[] = [];
  for (const e of c.edges) for (const id of [e.from, e.to]) if (!ids.includes(id)) ids.push(id);
  return ids.map((id) => nodeById.get(id)).filter((n): n is PhysioNode => Boolean(n));
}

/** Bir test hangi zincirlerde, hangi düğümde? ("Hangi fizyolojik süreçte?") */
export function chainsForTest(testKey: string): Array<{ chain: PhysioChain; node: PhysioNode }> {
  const out: Array<{ chain: PhysioChain; node: PhysioNode }> = [];
  for (const c of PHYSIO_CHAINS) {
    const n = chainNodes(c).find((x) => x.testKeys?.includes(testKey));
    if (n) out.push({ chain: c, node: n });
  }
  return out;
}

/** Bir organın / iç dünyanın geçtiği zincirler. */
export function chainsForPlace(id: string): PhysioChain[] {
  return PHYSIO_CHAINS.filter((c) => chainNodes(c).some((n) => n.interior === id || n.organ === id || n.id === id));
}

const STATUS_TR: Record<LabObservation['status'], string> = { low: 'düşük', high: 'yüksek', normal: 'aralıkta', unknown: 'aralık yok' };

export interface PhysioMarker {
  nodeId: string;
  testKey: string;
  name: string;
  latest: LabObservation;
  /** Tarih sıralı geçmiş ölçümler (yalnızca gerçekten var olanlar). */
  history: Array<{ date: string; value: number; status: LabObservation['status'] }>;
  /** Yalnızca ≥ 2 ölçümde; aksi hâlde eğilim yoktur ("sahte trend üretme"). */
  trend?: string;
  relation: 'POSSIBLE_RELATION';
  text: string;
}

export interface PhysioOverlay {
  chainId: string;
  markers: PhysioMarker[];
  hasData: boolean;
  statement: string;
}

/**
 * Zincir üzerine kişinin sonuçları. Yalnızca ölçülen düğümler işaretlenir; ölçülmeyen düğüm "normal"
 * ya da "sorunlu" sayılmaz. `asOf` verilirse o tarihe kadarki ölçümler kullanılır (zaman kaydırıcısı).
 */
export function physioOverlay(c: PhysioChain, model: Pick<HealthModel, 'latestLabs'> & Partial<Pick<HealthModel, 'labHistory'>> | null, asOf?: string): PhysioOverlay {
  const markers: PhysioMarker[] = [];
  const seen = new Set<string>();
  for (const n of chainNodes(c))
    for (const key of n.testKeys ?? []) {
      if (seen.has(`${n.id}:${key}`)) continue;
      seen.add(`${n.id}:${key}`);
      const all = (model?.labHistory?.get(key) ?? model?.latestLabs.filter((l) => l.testKey === key) ?? []).filter((l) => !asOf || l.date <= asOf);
      const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      if (!latest) continue;
      const history = sorted.map((l) => ({ date: l.date, value: l.value, status: l.status }));
      const off = latest.status === 'high' || latest.status === 'low';
      const first = sorted[0]!;
      const trend =
        sorted.length >= 2
          ? `${first.date.slice(0, 7)} ${first.value.toLocaleString('tr-TR')} (${STATUS_TR[first.status]}) → ${latest.date.slice(0, 7)} ${latest.value.toLocaleString('tr-TR')} (${STATUS_TR[latest.status]})`
          : undefined;
      markers.push({
        nodeId: n.id,
        testKey: key,
        name: latest.name,
        latest,
        history,
        ...(trend ? { trend } : {}),
        relation: 'POSSIBLE_RELATION',
        text: off ? `${latest.name} ${STATUS_TR[latest.status]} — bu basamakla ilişkili olabilir (olası ilişki; neden kanıtlanmaz).` : `${latest.name} ${STATUS_TR[latest.status]}.`,
      });
    }
  const flagged = markers.some((m) => m.latest.status === 'high' || m.latest.status === 'low');
  return {
    chainId: c.id,
    markers,
    hasData: markers.length > 0,
    statement: !markers.length ? 'Bu zincirle ilişkili kişisel sonucun yok; normal fizyoloji gösteriliyor.' : flagged ? c.caution : 'Bu zincirle ilişkili sonuçların aralıkta. Bu, zincirin her basamağının değerlendirildiği anlamına gelmez.',
  };
}

/**
 * Sonuç ayrıntısı için biyobelirteç fizyolojisi: ne ölçer, normalde ne yapar, nerede üretilir, nerede
 * kullanılır. Genel bilgidir; kişinin değeri ayrıca ve kaynağıyla gösterilir.
 */
export interface BiomarkerPhysiology {
  role: string;
  producedIn: string[];
  usedIn: string[];
}

export const BIOMARKER_PHYSIOLOGY: Readonly<Record<string, BiomarkerPhysiology>> = {
  glucose: { role: 'Hücrelerin ana enerji kaynağı; kandaki düzeyi insülin ve glukagonla dar bir aralıkta tutulur.', producedIn: ['small-intestine', 'liver'], usedIn: ['cell', 'nervous-system', 'muscle'] },
  hba1c: { role: 'Alyuvardaki hemoglobine bağlanan şeker; son 2–3 ayın ortalama kan şekerini yansıtır.', producedIn: ['rbc'], usedIn: [] },
  insulin: { role: 'Hücrelerin glukoz almasını sağlayan, depolamayı yöneten hormon.', producedIn: ['pancreas'], usedIn: ['muscle', 'liver', 'adipose'] },
  hemoglobin: { role: 'Alyuvarların içindeki oksijen taşıyıcı protein.', producedIn: ['bone-marrow'], usedIn: ['lungs', 'tissue-cells'] },
  rbc: { role: 'Oksijen taşıyan kan hücreleri; ~120 gün yaşar.', producedIn: ['bone-marrow'], usedIn: ['vessels'] },
  hematocrit: { role: 'Kan hacminin alyuvarlardan oluşan yüzdesi.', producedIn: ['bone-marrow'], usedIn: ['vessels'] },
  mcv: { role: 'Alyuvarların ortalama büyüklüğü; demir, B12 ve folat durumuyla ilişkilidir.', producedIn: ['bone-marrow'], usedIn: [] },
  b12: { role: 'DNA yapımı (kan hücreleri) ve miyelin (sinir sistemi) için gerekli vitamin.', producedIn: ['stomach', 'ileum'], usedIn: ['bone-marrow', 'nervous-system'] },
  folate: { role: 'B12 ile birlikte DNA yapımında kullanılan vitamin.', producedIn: ['small-intestine'], usedIn: ['bone-marrow'] },
  iron: { role: 'Hemoglobinin oksijen bağlayan merkezinde bulunan mineral.', producedIn: ['duodenum'], usedIn: ['bone-marrow', 'muscle'] },
  ferritin: { role: 'Demirin depolanma biçimi; vücut demir depolarını yansıtır (inflamasyonda da yükselebilir).', producedIn: ['liver'], usedIn: ['bone-marrow'] },
  'transferrin-saturation': { role: 'Demir taşıyıcı proteinin ne kadarının demirle dolu olduğu.', producedIn: ['liver'], usedIn: ['bone-marrow'] },
  tibc: { role: 'Kanın demir bağlama kapasitesi (transferrin düzeyini yansıtır).', producedIn: ['liver'], usedIn: ['bone-marrow'] },
  alt: { role: 'Daha çok karaciğer hücrelerinde bulunan, amino asit dönüştüren enzim.', producedIn: ['hepatocyte'], usedIn: ['liver'] },
  ast: { role: 'Karaciğer, kalp ve iskelet kasında bulunan amino asit dönüştüren enzim.', producedIn: ['hepatocyte', 'muscle', 'heart'], usedIn: [] },
  creatinine: { role: 'Kasların sabit hızda ürettiği atık; böbreklerle süzülür. Süzme hızının dolaylı göstergesi.', producedIn: ['muscle'], usedIn: ['kidneys'] },
  egfr: { role: 'Kreatinin, yaş ve cinsiyetten hesaplanan tahmini süzme hızı.', producedIn: ['kidneys'], usedIn: [] },
  urea: { role: 'Protein yıkımından karaciğerde oluşan, böbrekle atılan atık.', producedIn: ['liver'], usedIn: ['kidneys'] },
  sodium: { role: 'Hücre dışı sıvının ana tuzu; su dengesini ve sinir iletimini belirler.', producedIn: ['small-intestine'], usedIn: ['kidneys', 'nervous-system'] },
  potassium: { role: 'Hücre içinin ana tuzu; kalp ve kas elektriği için kritiktir.', producedIn: ['small-intestine'], usedIn: ['kidneys', 'heart', 'muscle'] },
  tsh: { role: 'Hipofizin tiroidi uyaran hormonu.', producedIn: ['pituitary'], usedIn: ['thyroid'] },
  ft4: { role: 'Tiroidin salgıladığı, metabolizmayı ayarlayan hormonun serbest biçimi.', producedIn: ['thyroid'], usedIn: ['cell'] },
  ft3: { role: 'Tiroid hormonunun en etkin biçimi.', producedIn: ['thyroid'], usedIn: ['cell'] },
  'vitamin-d': { role: 'Kalsiyum ve fosfor dengesini, kemik yapımını düzenleyen hormon benzeri vitamin.', producedIn: ['skin', 'liver', 'kidneys'], usedIn: ['small-intestine', 'bone'] },
  calcium: { role: 'Kemik, kas kasılması, sinir iletimi ve pıhtılaşma için gerekli mineral.', producedIn: ['small-intestine', 'bone'], usedIn: ['bone', 'muscle', 'heart'] },
  ldl: { role: 'Kolesterolü karaciğerden dokulara taşıyan lipoprotein.', producedIn: ['liver'], usedIn: ['cell', 'vessel-wall'] },
  hdl: { role: 'Fazla kolesterolü dokulardan karaciğere geri taşıyan lipoprotein.', producedIn: ['liver', 'small-intestine'], usedIn: ['liver'] },
  triglyceride: { role: 'Kanda taşınan ve yağ dokusunda depolanan yağ biçimi.', producedIn: ['small-intestine', 'liver'], usedIn: ['adipose', 'muscle'] },
  amylase: { role: 'Nişastayı parçalayan sindirim enzimi (pankreas ve tükürük bezleri).', producedIn: ['pancreas', 'mouth'], usedIn: ['small-intestine'] },
  lipase: { role: 'Yağları parçalayan pankreas enzimi.', producedIn: ['pancreas'], usedIn: ['small-intestine'] },
  albumin: { role: 'Karaciğerin ürettiği ana kan proteini; sıvının damar içinde kalmasını sağlar.', producedIn: ['liver'], usedIn: ['vessels'] },
  'bilirubin-total': { role: 'Hemoglobin yıkım ürünü; karaciğerde işlenip safrayla atılır.', producedIn: ['rbc', 'liver'], usedIn: [] },
};
