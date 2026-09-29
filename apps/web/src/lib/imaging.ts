/**
 * Görüntüleme belgeleri (MR, BT/tomografi, röntgen, ultrason): tür ve bölge adları, dosya adından
 * ve DICOM başlığından tahmin, rapor metnini bölümlere ayırma ve radyoloji terimleri sözlüğü.
 *
 * Kan Haritası görüntüleri YORUMLAMAZ: hiçbir bulgu üretmez, rapordaki bir ifadenin "iyi" ya da "kötü"
 * olduğunu söylemez. Sözlük, raporda geçen terimlerin genel anlamını açıklar; kişisel değerlendirme değildir.
 */
import { normalizeText } from '@kh/catalog';
import type { DocCategory } from '@kh/vault';

export type ImagingCategory = Exclude<DocCategory, 'lab'>;

export const isImaging = (c: DocCategory | undefined): c is ImagingCategory => c !== undefined && c !== 'lab';

export const CATEGORY_LABEL: Record<DocCategory, string> = {
  lab: 'Tahlil',
  mr: 'MR',
  ct: 'Tomografi (BT)',
  xray: 'Röntgen',
  us: 'Ultrason',
  mammo: 'Mamografi',
  pet: 'PET / PET-BT',
  angio: 'Anjiyografi',
  dexa: 'Kemik yoğunluğu (DEXA)',
  pathology: 'Patoloji / biyopsi',
  endoscopy: 'Endoskopi / kolonoskopi',
  ekg: 'EKG',
  pft: 'Solunum fonksiyon testi',
  other: 'Diğer tıbbi belge',
};

/** Belge listesindeki kısa rozet. */
export const CATEGORY_SHORT: Record<DocCategory, string> = {
  lab: 'Tahlil',
  mr: 'MR',
  ct: 'BT',
  xray: 'Röntgen',
  us: 'USG',
  mammo: 'Mamografi',
  pet: 'PET',
  angio: 'Anjiyo',
  dexa: 'DEXA',
  pathology: 'Patoloji',
  endoscopy: 'Endoskopi',
  ekg: 'EKG',
  pft: 'SFT',
  other: 'Belge',
};

/** Radyoloji yöntemleri (görüntü dosyası olabilir); diğerleri yalnızca rapordur. */
export const RADIOLOGY: ReadonlySet<DocCategory> = new Set(['mr', 'ct', 'xray', 'us', 'mammo', 'pet', 'angio', 'dexa', 'other']);

export const CATEGORY_UPLOAD_TITLE: Record<DocCategory, string> = {
  lab: 'Laboratuvar Raporunu Yükle',
  mr: 'MR Görüntüsü veya Raporu Yükle',
  ct: 'Tomografi (BT) Görüntüsü veya Raporu Yükle',
  xray: 'Röntgen Görüntüsü veya Raporu Yükle',
  us: 'Ultrason Görüntüsü veya Raporu Yükle',
  mammo: 'Mamografi Görüntüsü veya Raporu Yükle',
  pet: 'PET / PET-BT Görüntüsü veya Raporu Yükle',
  angio: 'Anjiyografi Görüntüsü veya Raporu Yükle',
  dexa: 'Kemik Yoğunluğu (DEXA) Raporu Yükle',
  pathology: 'Patoloji / Biyopsi Raporu Yükle',
  endoscopy: 'Endoskopi / Kolonoskopi Raporu Yükle',
  ekg: 'EKG Raporu Yükle',
  pft: 'Solunum Fonksiyon Testi Raporu Yükle',
  other: 'Tıbbi Belge Yükle',
};

/** Yöntemin temelde nasıl çalıştığı: genel eğitim bilgisi. */
export const CATEGORY_ABOUT: Record<ImagingCategory, { name: string; how: string; radiation: string }> = {
  mr: {
    name: 'Manyetik rezonans görüntüleme',
    how: 'Güçlü bir mıknatıs ve radyo dalgalarıyla vücuttaki su (hidrojen) moleküllerinin sinyali ölçülür. Beyin, omurilik, eklem, bağ ve kas gibi yumuşak dokuları çok ayrıntılı gösterir. Aynı çekimde T1, T2, FLAIR, difüzyon gibi farklı "sekanslar" alınır; her biri dokuları farklı parlaklıkta gösterir.',
    radiation: 'İyonlaştırıcı radyasyon içermez.',
  },
  ct: {
    name: 'Bilgisayarlı tomografi',
    how: 'Vücudun etrafında dönen röntgen tüpüyle çok sayıda açıdan ölçüm alınır ve bilgisayar bunları ince kesitlere çevirir. Kemik, akciğer, kanama ve karın organlarını hızlıca gösterir. Değerler Hounsfield birimidir (su 0, hava −1000, kemik +400 ve üzeri).',
    radiation: 'İyonlaştırıcı radyasyon içerir; doz, çekilen bölgeye ve protokole göre değişir.',
  },
  xray: {
    name: 'Röntgen (direkt grafi)',
    how: 'X ışını vücuttan geçer; kemik gibi yoğun dokular ışını daha çok tuttuğu için beyaz, hava içeren akciğer koyu görünür. Tek yönden çekilmiş iki boyutlu bir gölge görüntüsüdür.',
    radiation: 'Düşük dozda iyonlaştırıcı radyasyon içerir.',
  },
  us: {
    name: 'Ultrasonografi',
    how: 'Probdan gönderilen yüksek frekanslı ses dalgalarının dokulardan yansıması ölçülür. Karın organları, tiroid, meme, gebelik ve damarlar (Doppler) için kullanılır. Görüntü, çekimi yapan kişinin probu tuttuğu açıya bağlıdır.',
    radiation: 'Radyasyon içermez.',
  },
  mammo: {
    name: 'Mamografi',
    how: 'Meme dokusunun düşük dozlu röntgen görüntüsüdür; meme iki plaka arasında hafifçe sıkıştırılarak iki yönden çekilir. Kitle, mikrokalsifikasyon ve yapı bozukluğu aranır. Sonuç BI-RADS kategorisiyle (0–6) özetlenir.',
    radiation: 'Düşük dozda iyonlaştırıcı radyasyon içerir.',
  },
  pet: {
    name: 'PET / PET-BT',
    how: 'Damardan verilen az miktarda radyoaktif işaretli madde (çoğunlukla glukoz benzeri FDG) hücrelerin metabolik etkinliğine göre birikir; PET bu birikimi, BT de anatomik konumu gösterir. Birikim SUV değeriyle ölçülür. Yüksek birikim iltihapta da görülebilir; tek başına tanı değildir.',
    radiation: 'İyonlaştırıcı radyasyon içerir (radyoaktif madde + BT).',
  },
  angio: {
    name: 'Anjiyografi',
    how: 'Damarlar kontrast madde ile görünür hâle getirilerek röntgen (klasik veya BT anjiyo) ya da MR ile görüntülenir. Darlık, tıkanıklık ve genişleme (anevrizma) değerlendirilir.',
    radiation: 'Röntgen ve BT anjiyografi iyonlaştırıcı radyasyon içerir; MR anjiyografi içermez.',
  },
  dexa: {
    name: 'Kemik mineral yoğunluğu (DEXA)',
    how: 'İki farklı enerjide düşük dozlu X ışınıyla bel omurları ve kalçada kemik mineral yoğunluğu ölçülür. Sonuç genç erişkin ortalamasına göre T-skoru ve yaşıtlara göre Z-skoru olarak verilir (T ≤ −2,5 osteoporoz, −1 ile −2,5 arası osteopeni).',
    radiation: 'Çok düşük dozda iyonlaştırıcı radyasyon içerir.',
  },
  pathology: {
    name: 'Patoloji / biyopsi',
    how: 'Alınan doku ya da hücre örneği işlenip boyanır ve mikroskopla incelenir. Rapor genellikle makroskopi (gözle görünüm), mikroskopi (hücre düzeyi) ve tanı bölümlerinden oluşur. Patoloji raporu kesin tanıya en yakın belgedir; anlamını seni takip eden hekim açıklar.',
    radiation: 'Radyasyon içermez.',
  },
  endoscopy: {
    name: 'Endoskopi / kolonoskopi',
    how: 'Ucunda kamera olan ince bir tüple yemek borusu, mide ve on iki parmak bağırsağı (gastroskopi) ya da kalın bağırsak (kolonoskopi) içeriden incelenir. Gerekirse biyopsi alınır; biyopsinin sonucu ayrı bir patoloji raporunda yazar.',
    radiation: 'Radyasyon içermez.',
  },
  ekg: {
    name: 'Elektrokardiyografi (EKG)',
    how: 'Göğse ve kollara-bacaklara yapıştırılan elektrotlarla kalbin elektriksel etkinliği kaydedilir. Ritim, hız, iletim süreleri (PR, QRS, QT) ve ST-T değişiklikleri değerlendirilir.',
    radiation: 'Radyasyon içermez.',
  },
  pft: {
    name: 'Solunum fonksiyon testi (spirometri)',
    how: 'Derin nefes alıp cihaza olabildiğince hızlı üflendiğinde akciğer hacimleri ve hava akımı ölçülür. FEV1 (ilk saniyede atılan hava), FVC (toplam) ve FEV1/FVC oranı daralma (obstrüksiyon) ya da genişleyememe (restriksiyon) hakkında bilgi verir.',
    radiation: 'Radyasyon içermez.',
  },
  other: {
    name: 'Diğer tıbbi belge',
    how: 'Sintigrafi, epikriz, konsültasyon notu gibi belgeler bu grupta yer alır. Her yöntem farklı bir ilkeyle çalışır; belgedeki açıklama ve doktorun yorumu esastır.',
    radiation: 'Yönteme göre değişir.',
  },
};

// ---------------------------------------------------------------------------------------------
// Bölgeler

export interface Region {
  key: string;
  label: string;
  /** Keşfet (3D) ekranında gösterilecek yapı. */
  structure?: string;
  /** Normalize edilmiş anahtar kelimeler (Türkçe, İngilizce, DICOM BodyPartExamined). */
  words: string[];
}

export const REGIONS: Region[] = [
  { key: 'beyin', label: 'Beyin / kafa', structure: 'brain', words: ['beyin', 'kranial', 'kraniyal', 'kafa', 'brain', 'head', 'skull', 'cranium', 'serebral'] },
  { key: 'hipofiz', label: 'Hipofiz', structure: 'pituitary', words: ['hipofiz', 'pituitary', 'sella', 'sellar'] },
  { key: 'goz', label: 'Göz / orbita', structure: 'eyes', words: ['orbita', 'goz', 'orbit', 'eye'] },
  { key: 'kulak', label: 'Kulak / temporal kemik', structure: 'ear', words: ['temporal', 'kulak', 'iac', 'ear', 'mastoid'] },
  { key: 'sinus', label: 'Sinüs / burun', structure: 'airways', words: ['sinus', 'paranazal', 'paranasal', 'burun', 'nazal', 'nasal'] },
  { key: 'boyun', label: 'Boyun', structure: 'carotid-arteries', words: ['boyun', 'neck', 'servikal yumusak', 'karotis', 'karotid', 'carotid'] },
  { key: 'tiroid', label: 'Tiroid', structure: 'thyroid', words: ['tiroid', 'thyroid'] },
  { key: 'servikal', label: 'Boyun omurgası (servikal)', structure: 'spinal-cord', words: ['servikal', 'cervical', 'cspine', 'c spine', 'boyun omurga'] },
  { key: 'torakal', label: 'Sırt omurgası (torakal)', structure: 'spinal-cord', words: ['torakal', 'dorsal', 'thoracic', 'tspine', 't spine'] },
  { key: 'lomber', label: 'Bel omurgası (lomber)', structure: 'spinal-cord', words: ['lomber', 'lumbar', 'lumbosakral', 'lspine', 'l spine', 'bel'] },
  { key: 'omurga', label: 'Omurga (tüm)', structure: 'spinal-cord', words: ['omurga', 'spine', 'vertebra', 'tum spinal', 'spinal'] },
  { key: 'toraks', label: 'Göğüs / akciğer', structure: 'lungs', words: ['toraks', 'akciger', 'gogus', 'thorax', 'chest', 'lung', 'pa akciger', 'hrct', 'yrbt'] },
  { key: 'kalp', label: 'Kalp', structure: 'heart', words: ['kalp', 'kardiyak', 'kardiak', 'cardiac', 'heart', 'koroner', 'coronary'] },
  { key: 'meme', label: 'Meme', structure: 'breasts', words: ['meme', 'mamografi', 'breast', 'mammo', 'mammography'] },
  { key: 'batin', label: 'Karın (batın)', structure: 'liver', words: ['batin', 'abdomen', 'karin', 'abdominal', 'ust batin', 'tum batin'] },
  { key: 'karaciger', label: 'Karaciğer / safra', structure: 'liver', words: ['karaciger', 'liver', 'hepatik', 'mrcp', 'safra', 'biliary'] },
  { key: 'bobrek', label: 'Böbrek / üriner sistem', structure: 'kidneys', words: ['bobrek', 'renal', 'kidney', 'uriner', 'urinary', 'mesane', 'bladder', 'bus'] },
  { key: 'pelvis', label: 'Pelvis (leğen)', structure: 'urinary-tract', words: ['pelvis', 'pelvik', 'pelvic', 'alt batin'] },
  { key: 'prostat', label: 'Prostat', structure: 'prostate', words: ['prostat', 'prostate', 'multiparametrik'] },
  { key: 'rahim', label: 'Rahim / yumurtalık', structure: 'uterus', words: ['uterus', 'rahim', 'over', 'ovary', 'jinekolojik', 'transvajinal'] },
  { key: 'mide', label: 'Mide / onikiparmak bağırsağı', structure: 'stomach', words: ['mide', 'gastrik', 'gastroskopi', 'stomach', 'duodenum', 'bulbus', 'antrum', 'ozofagogastroduodenoskopi'] },
  { key: 'yemek-borusu', label: 'Yemek borusu', structure: 'esophagus', words: ['ozofagus', 'yemek borusu', 'esophagus', 'oesophagus'] },
  { key: 'kolon', label: 'Kalın bağırsak', structure: 'large-intestine', words: ['kolon', 'kolonoskopi', 'rektum', 'sigmoid', 'rektosigmoidoskopi', 'cekum', 'colon', 'colonoscopy'] },
  { key: 'omuz', label: 'Omuz', structure: 'bones', words: ['omuz', 'shoulder'] },
  { key: 'dirsek', label: 'Dirsek / kol', structure: 'bones', words: ['dirsek', 'elbow', 'humerus', 'onkol', 'forearm'] },
  { key: 'el', label: 'El / el bileği', structure: 'bones', words: ['el bilegi', 'bilek', 'wrist', 'hand', 'parmak', 'finger'] },
  { key: 'kalca', label: 'Kalça', structure: 'bones', words: ['kalca', 'hip', 'femur basi'] },
  { key: 'diz', label: 'Diz', structure: 'knee', words: ['diz', 'knee', 'menisk'] },
  { key: 'ayak', label: 'Ayak / ayak bileği', structure: 'bones', words: ['ayak bilegi', 'ayak', 'ankle', 'foot', 'topuk'] },
  { key: 'kemik', label: 'Kemik (genel)', structure: 'bones', words: ['kemik', 'bone', 'iskelet', 'skeletal'] },
  { key: 'damar', label: 'Damarlar (anjiyo)', structure: 'aorta', words: ['anjiyo', 'anjiyografi', 'angio', 'aort', 'aorta', 'doppler', 'venoz', 'arteriyel'] },
];

export const regionByKey = new Map(REGIONS.map((r) => [r.key, r]));

const padded = (s: string) => ` ${normalizeText(s)} `;

/** Metinde geçen ilk (en özgül) bölge. Özgül bölgeler listede genel olanlardan önce gelir. */
export function guessRegion(...texts: Array<string | undefined>): string | undefined {
  const hay = padded(texts.filter(Boolean).join(' ').replace(/[_]/g, ' '));
  if (!hay.trim()) return undefined;
  for (const r of REGIONS) if (r.words.some((w) => hay.includes(` ${w} `))) return r.key;
  return undefined;
}

/** Önce özgül türler: "PET BT" BT'den, "mamografi" röntgenden, "BT anjiyo" BT'den önce gelir. */
const CATEGORY_WORDS: Array<[ImagingCategory, string[]]> = [
  ['pathology', ['patoloji', 'histopatoloji', 'histopatolojik', 'biyopsi', 'sitoloji', 'sitolojik', 'makroskopi', 'mikroskopi', 'frozen', 'immunohistokimya', 'pathology', 'biopsy']],
  ['endoscopy', ['endoskopi', 'gastroskopi', 'kolonoskopi', 'ozofagogastroduodenoskopi', 'rektosigmoidoskopi', 'sigmoidoskopi', 'ercp', 'egd', 'endoscopy', 'colonoscopy']],
  ['ekg', ['ekg', 'elektrokardiyografi', 'elektrokardiyogram', 'ecg', 'ritim holter', 'efor testi']],
  ['pft', ['spirometri', 'solunum fonksiyon', 'sft', 'fev1', 'fvc', 'dlco', 'spirometry']],
  ['dexa', ['dexa', 'dxa', 'densitometri', 'kemik mineral yogunlugu', 'kemik dansitometri', 'bmd']],
  ['pet', ['pet', 'pet bt', 'pet ct', 'fdg', 'suvmax', 'suv max', 'sintigrafi']],
  ['mammo', ['mamografi', 'mammografi', 'mammography', 'mamogram', 'tomosentez']],
  ['angio', ['anjiyografi', 'anjiografi', 'anjiyo', 'anjio', 'angiography', 'koroner anjiyo', 'dsa']],
  ['mr', ['mr', 'mri', 'mrg', 'manyetik', 'rezonans', 'mrcp', 'mra', 'mrv']],
  ['ct', ['bt', 'ct', 'tomografi', 'tomography', 'bilgisayarli', 'hrct', 'yrbt', 'bta', 'cta']],
  ['us', ['usg', 'ultrason', 'ultrasonografi', 'ultrasound', 'doppler', 'eko', 'ekokardiyografi']],
  ['xray', ['rontgen', 'grafi', 'grafisi', 'xray', 'x ray', 'direkt', 'pa', 'dx', 'cr']],
];

/** Tür için varsayılan bölge (belgede bölge yazmıyorsa). */
export const CATEGORY_REGION: Partial<Record<DocCategory, string>> = { ekg: 'kalp', pft: 'toraks', mammo: 'meme', dexa: 'kemik', angio: 'damar', endoscopy: 'mide' };

/**
 * Metinden belge türü tahmini (tahlil tablosu bulunamadığında). Her türün güçlü (yöntem adı, 2 puan) ve
 * destekleyici (yönteme özgü terim, 1 puan) işaretleri vardır; en az 2 puan gerekir. Kısa ve belirsiz
 * kısaltmalar ("PA", "direkt") burada kullanılmaz: tahlil raporlarında da geçerler.
 */
const TYPE_SIGNS: Array<[ImagingCategory, string[], string[]]> = [
  ['pathology', ['patoloji raporu', 'histopatoloji', 'histopatolojik', 'biyopsi', 'sitoloji', 'sitolojik', 'makroskopi', 'mikroskopi', 'makroskopik', 'mikroskopik', 'immunohistokimya', 'immunohistokimyasal'], ['patolojik tani', 'doku ornegi', 'boyama', 'displazi', 'metaplazi', 'karsinom', 'grade']],
  ['endoscopy', ['endoskopi', 'endoskopik', 'gastroskopi', 'kolonoskopi', 'ozofagogastroduodenoskopi', 'rektosigmoidoskopi', 'sigmoidoskopi', 'ercp'], ['ozofagus', 'bulbus', 'antrum', 'cekum', 'terminal ileum', 'mukoza', 'polip', 'z cizgisi', 'skop']],
  ['ekg', ['ekg', 'elektrokardiyografi', 'elektrokardiyogram', 'ecg'], ['sinus ritmi', 'pr araligi', 'qrs', 'qt', 'qtc', 'st segment', 't dalgasi', 'kalp hizi']],
  ['pft', ['spirometri', 'solunum fonksiyon testi', 'solunum fonksiyon testleri', 'solunum fonksiyon'], ['fev1', 'fvc', 'fev1 fvc', 'pef', 'dlco', 'mef', 'bronkodilator']],
  ['dexa', ['dexa', 'dxa', 'kemik mineral yogunlugu', 'densitometri', 'dansitometri', 'kemik dansitometrisi'], ['t skoru', 't skor', 'z skoru', 'bmd', 'osteopeni', 'osteoporoz', 'femur boynu']],
  ['pet', ['pet', 'pet bt', 'pet ct', 'fdg', 'suvmax', 'suv max'], ['metabolik aktivite', 'hipermetabolik', 'hipometabolik', 'tutulum']],
  ['mammo', ['mamografi', 'mammografi', 'tomosentez'], ['bi rads', 'birads', 'meme parankimi', 'mikrokalsifikasyon', 'kranyokaudal', 'mlo']],
  ['angio', ['anjiyografi', 'anjiografi', 'koroner anjiyografi'], ['stenoz', 'darlik', 'okluzyon', 'lad', 'lcx', 'rca', 'kollateral']],
  ['mr', ['manyetik rezonans', 'mr', 'mrg', 'mri', 'mr goruntuleme'], ['flair', 't1a', 't2a', 'difuzyon', 'sekans', 'sekanslar', 'sekansta', 'sekanslarda', 'hiperintens', 'hipointens', 'stir', 'sinyal']],
  ['ct', ['bilgisayarli tomografi', 'tomografi', 'bt', 'hrct', 'yrbt'], ['hounsfield', 'hiperdens', 'hipodens', 'dansite', 'dansitede', 'aksiyel kesit', 'kontrast madde']],
  ['us', ['ultrasonografi', 'usg', 'ultrason', 'doppler', 'ekokardiyografi'], ['hiperekoik', 'hipoekoik', 'anekoik', 'ekojenite', 'ekojenitesi', 'parankim ekojenitesi']],
  ['xray', ['rontgen', 'radyografi', 'grafi', 'grafisi', 'grafide'], ['kostofrenik', 'kardiyotorasik', 'opasite', 'hiler']],
];

export interface DocTypeGuess {
  category: ImagingCategory;
  /** Metinde bulunan işaretler (kullanıcıya "neden" olarak gösterilir). */
  signs: string[];
}

/** Rapor metninden en olası belge türü; yeterli işaret yoksa undefined. */
export function detectDocType(text: string | undefined): DocTypeGuess | undefined {
  const hay = padded(text ?? '');
  if (hay.trim().length < 8) return undefined;
  let best: (DocTypeGuess & { score: number }) | undefined;
  for (const [category, strong, weak] of TYPE_SIGNS) {
    const s = strong.filter((w) => hay.includes(` ${w} `));
    const w = weak.filter((x) => hay.includes(` ${x} `));
    const score = s.length * 2 + w.length;
    if (score >= 2 && s.length + w.length >= 1 && (!best || score > best.score)) best = { category, signs: [...s, ...w].slice(0, 4), score };
  }
  if (!best) return undefined;
  // Gerekçe, metindeki özgün yazımıyla gösterilir ("özofagus", "Z çizgisi").
  const tokens = (text ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const norm = tokens.map((t) => normalizeText(t));
  const original = (sign: string) => {
    const n = sign.split(' ').length;
    for (let i = 0; i + n <= tokens.length; i++) if (norm.slice(i, i + n).join(' ') === sign) return tokens.slice(i, i + n).join(' ').toLocaleLowerCase('tr');
    return sign;
  };
  return { category: best.category, signs: best.signs.map(original) };
}

/** Dosya adı veya rapor metninden görüntüleme türü; bulunamazsa undefined. */
export function guessCategory(text: string | undefined): ImagingCategory | undefined {
  const hay = padded((text ?? '').replace(/[_]/g, ' '));
  if (!hay.trim()) return undefined;
  for (const [cat, words] of CATEGORY_WORDS) if (words.some((w) => hay.includes(` ${w} `))) return cat;
  // "beyinmr", "torakst" gibi bitişik yazımlar
  const compact = hay.replace(/\s/g, '');
  if (/mr$|mri/.test(compact) && /beyin|lomber|servikal|diz|omuz|kalca|hipofiz/.test(compact)) return 'mr';
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Rapor metni

export interface ReportSection {
  /** Normalize başlık: teknik, klinik, bulgular, sonuc, oneri, diger */
  kind: 'klinik' | 'teknik' | 'karsilastirma' | 'bulgular' | 'sonuc' | 'oneri' | 'diger';
  title: string;
  text: string;
}

const HEADINGS: Array<[ReportSection['kind'], string, RegExp]> = [
  // "Klinik korelasyon önerilir" bir öneri cümlesidir, "Klinik bilgi" başlığı değildir
  ['klinik', 'Klinik bilgi', /^(klinik(?! korelasyon| ile| degerlendirme)( bilgi(ler)?| oyku| tani)?|endikasyon|on tani|istem nedeni|clinical( information| history)?|indication)\b/],
  ['teknik', 'Teknik', /^(teknik|inceleme teknigi|yontem|protokol|technique|protocol)\b/],
  ['karsilastirma', 'Karşılaştırma', /^(karsilastirma|onceki tetkik(ler)?|comparison)\b/],
  ['bulgular', 'Bulgular', /^(bulgu(lar)?|rapor|degerlendirme|findings)\b/],
  ['sonuc', 'Sonuç', /^(sonuc|kanaat|izlenim|yorum|tani|ozet|impression|conclusion|opinion)\b/],
  ['oneri', 'Öneri', /^(oneri(ler)?|tavsiye|recommendation(s)?)\b/],
];

/**
 * Radyoloji raporunu başlıklarına göre ayırır ("KLİNİK BİLGİ:", "BULGULAR", "SONUÇ:" …).
 * Başlık bulunamazsa tüm metin tek bir bölüm olarak döner.
 */
export function splitReport(text: string): ReportSection[] {
  const sections: ReportSection[] = [];
  let current: ReportSection = { kind: 'diger', title: 'Rapor', text: '' };
  const push = () => {
    current.text = current.text.trim();
    if (current.text || current.kind !== 'diger') sections.push(current);
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const norm = normalizeText(line);
    const hit = HEADINGS.find(([, , re]) => re.test(norm));
    // Başlık satırı kısa olmalı ya da başlıktan sonra ":" gelmeli ("SONUÇ: Normal.").
    const colon = /^[^:]{2,40}:/.exec(line);
    if (hit && (norm.split(' ').length <= 4 || colon)) {
      push();
      const rest = colon ? line.slice(colon[0].length).trim() : '';
      current = { kind: hit[0], title: hit[1], text: rest ? `${rest}\n` : '' };
      continue;
    }
    current.text += `${line}\n`;
  }
  push();
  return sections.filter((s) => s.text.length > 0);
}

// ---------------------------------------------------------------------------------------------
// Sözlük

export interface GlossaryTerm {
  key: string;
  term: string;
  /** Normalize edilmiş kök(ler); metinde kelime başı olarak aranır. `$` ile biten kök yalnızca tam kelimedir. */
  roots: string[];
  meaning: string;
}

/**
 * Raporlarda sık geçen terimlerin genel anlamı. Bir terimin raporda geçmesi, önemini veya
 * ne anlama geldiğini kişi için belirlemez; bunu raporu yazan hekim ve seni takip eden doktor değerlendirir.
 */
export const GLOSSARY: GlossaryTerm[] = [
  { key: 'hiperintens', term: 'Hiperintens / hipointens', roots: ['hiperintens', 'hipointens', 'izointens'], meaning: 'MR\'da bir alanın çevresine göre daha parlak (hiper), daha koyu (hipo) ya da aynı (izo) sinyal vermesi. Tek başına hastalık adı değildir; hangi sekansta görüldüğüyle birlikte değerlendirilir.' },
  { key: 'hiperdens', term: 'Hiperdens / hipodens', roots: ['hiperdens', 'hipodens', 'izodens', 'dansite'], meaning: 'BT\'de bir alanın çevresine göre daha yoğun/beyaz (hiper) ya da daha az yoğun/koyu (hipo) görünmesi.' },
  { key: 'ekojen', term: 'Hiperekoik / hipoekoik', roots: ['hiperekoik', 'hipoekoik', 'anekoik', 'izoekoik', 'ekojen', 'ekojenite'], meaning: 'Ultrasonda dokunun ses dalgasını daha çok (parlak) ya da daha az (koyu) yansıtması. Anekoik: hiç yansıtmayan, genellikle sıvı içeren alan.' },
  { key: 'lezyon', term: 'Lezyon', roots: ['lezyon'], meaning: 'Normal dokudan farklı görünen herhangi bir alan için kullanılan genel bir terimdir; iyi ya da kötü huylu olduğunu belirtmez.' },
  { key: 'nodul', term: 'Nodül', roots: ['nodul', 'mikronodul'], meaning: 'Küçük, yuvarlakça, sınırlı doku alanı. Boyutu, şekli ve zaman içindeki değişimi önemlidir; çoğu zararsızdır ama takibi doktor belirler.' },
  { key: 'kist', term: 'Kist', roots: ['kist', 'kistik'], meaning: 'İçi genellikle sıvı dolu, zarla çevrili kese. Basit kistler sıktır ve çoğunlukla zararsızdır.' },
  { key: 'kitle', term: 'Kitle', roots: ['kitle'], meaning: 'Belirgin boyutta yer kaplayan doku alanı. Ne olduğu görüntüden her zaman anlaşılmaz; ek tetkik gerekebilir.' },
  { key: 'odem', term: 'Ödem', roots: ['odem', 'odemi'], meaning: 'Dokuda normalden fazla sıvı birikmesi. Travma, iltihap, dolaşım sorunları gibi birçok nedeni olabilir.' },
  { key: 'efuzyon', term: 'Efüzyon / sıvı', roots: ['efuzyon', 'mayi', 'effuzyon'], meaning: 'Eklem, akciğer zarı (plevra) veya kalp zarı gibi boşluklarda sıvı toplanması.' },
  { key: 'herniasyon', term: 'Fıtıklaşma (herniasyon)', roots: ['herni', 'herniasyon', 'fitik', 'ekstruzyon', 'sekestre'], meaning: 'Omurlar arasındaki diskin iç kısmının dış halkadan taşarak arkaya ya da yana doğru çıkması. Sinir köküne bası yapıp yapmadığı raporda ayrıca belirtilir.' },
  { key: 'protruzyon', term: 'Protrüzyon / bulging', roots: ['protruzyon', 'bulging', 'bombeleşme', 'bombelesme'], meaning: 'Diskin geniş tabanlı, hafif taşması. Özellikle yetişkinlerde sık görülen bir bulgudur; belirtilerle birlikte değerlendirilir.' },
  { key: 'dejeneratif', term: 'Dejeneratif değişiklik', roots: ['dejeneratif', 'dejenerasyon', 'spondiloz', 'artroz', 'osteoartrit'], meaning: 'Yaşa ve kullanıma bağlı yıpranma değişiklikleri. Yaş ilerledikçe çoğu insanda görülür.' },
  { key: 'osteofit', term: 'Osteofit', roots: ['osteofit'], meaning: 'Eklem kenarlarında oluşan küçük kemik çıkıntıları; genellikle yıpranmayla ilişkilidir.' },
  { key: 'stenoz', term: 'Stenoz (daralma)', roots: ['stenoz', 'darlik', 'daralma'], meaning: 'Bir kanalın ya da damarın daralması (ör. spinal kanal, nöral foramen, damar). Derecesi raporda hafif/orta/ileri diye belirtilebilir.' },
  { key: 'foramen', term: 'Nöral foramen', roots: ['foramen', 'foraminal', 'noral'], meaning: 'Omurlar arasında sinir köklerinin omurga kanalından çıktığı delik.' },
  { key: 'menisk', term: 'Menisküs yırtığı / dejenerasyonu', roots: ['menisk', 'meniskus'], meaning: 'Dizde uyluk ve kaval kemiği arasında yastık görevi gören kıkırdak. MR\'da "grade 1–2" iç sinyal değişikliği yıpranmayı, yüzeye ulaşan "grade 3" ise yırtığı tarif eder.' },
  { key: 'ligament', term: 'Bağ (ligament)', roots: ['ligament', 'capraz bag', 'kollateral'], meaning: 'Kemikleri birbirine bağlayan sağlam doku (ör. ön çapraz bağ). Raporda sağlam, gerilmiş (sprain), kısmi ya da tam yırtık olarak tanımlanabilir.' },
  { key: 'tendinit', term: 'Tendinopati / tendinit', roots: ['tendinopati', 'tendinit', 'tendinoz', 'tendon'], meaning: 'Kası kemiğe bağlayan tendonda aşırı kullanım veya iltihapla ilişkili değişiklikler.' },
  { key: 'kontrast', term: 'Kontrast tutulumu', roots: ['kontrast tutulumu', 'kontrast tutan', 'kontrastlanma', 'kontrastlanan', 'tutulum', 'enhancement'], meaning: 'Damardan verilen ilacın (kontrast madde) bir alanda birikmesi. Dokunun kanlanması veya bariyer bozulması hakkında bilgi verir; anlamı bölgeye göre değişir.' },
  { key: 'difuzyon', term: 'Difüzyon kısıtlanması', roots: ['difuzyon', 'dwi', 'adc'], meaning: 'MR\'da su moleküllerinin serbest hareketinin azalması. Akut inme başta olmak üzere çeşitli durumlarda görülür; mutlaka hekim tarafından yorumlanır.' },
  { key: 'gliozis', term: 'Gliozis', roots: ['glioz', 'gliozis', 'gliotik'], meaning: 'Beyinde eski bir hasar alanında destek hücrelerinin oluşturduğu iz dokusu.' },
  { key: 'iskemik', term: 'İskemik / mikroanjiyopatik değişiklik', roots: ['iskemi', 'iskemik', 'mikroanjiyopati', 'mikroanjiopatik', 'enfarkt', 'infarkt'], meaning: 'Beyin veya organın bir bölümüne yetersiz kan gitmesiyle ilişkili değişiklikler. Beyin beyaz cevherindeki küçük noktasal alanlar yaşla birlikte sık görülür.' },
  { key: 'atrofi', term: 'Atrofi', roots: ['atrofi', 'atrofik'], meaning: 'Dokunun hacminin azalması (küçülme). Beyinde belli ölçüde yaşla birlikte beklenir.' },
  { key: 'konsolidasyon', term: 'Konsolidasyon', roots: ['konsolidasyon'], meaning: 'Akciğerde normalde hava dolu olan alanların sıvı, iltihap veya başka bir maddeyle dolması; zatürrede sık görülür.' },
  { key: 'buzlu-cam', term: 'Buzlu cam opasitesi', roots: ['buzlu', 'opasite', 'opasiteler', 'dansite artisi'], meaning: 'Akciğer BT\'sinde damarların hâlâ seçilebildiği hafif yoğunluk artışı. Enfeksiyon, iltihap gibi birçok nedeni olabilir.' },
  { key: 'atelektazi', term: 'Atelektazi', roots: ['atelektazi', 'atelektatik'], meaning: 'Akciğerin bir bölümünün tam açılmaması, sönmesi. Küçük "lineer atelektazi"ler sıktır.' },
  { key: 'amfizem', term: 'Amfizem', roots: ['amfizem', 'amfizematoz', 'bulla', 'bul$', 'buller$'], meaning: 'Akciğer hava keseciklerinin kalıcı olarak genişlemesi ve duvarlarının yıkılması.' },
  { key: 'plevral', term: 'Plevra', roots: ['plevra', 'plevral'], meaning: 'Akciğeri saran ince zar. "Plevral efüzyon", bu zar yaprakları arasında sıvı olduğunu anlatır.' },
  { key: 'lenf', term: 'Lenf nodu / lenfadenopati', roots: ['lenf', 'lap$'], meaning: 'Bağışıklık sisteminin küçük istasyonları. Enfeksiyon sırasında büyüyebilir; boyut ve şekli raporda belirtilir.' },
  { key: 'steatoz', term: 'Hepatosteatoz (yağlanma)', roots: ['steatoz', 'hepatosteatoz', 'yaglanma'], meaning: 'Karaciğer hücrelerinde yağ birikmesi. Derecesi (grade 1–3) ultrason veya BT\'de tahmin edilebilir.' },
  { key: 'hepatomegali', term: 'Organ büyümesi (-megali)', roots: ['hepatomegali', 'splenomegali', 'megali', 'kardiyomegali'], meaning: 'Organın normal ölçülerden büyük olması: karaciğer (hepato-), dalak (spleno-), kalp (kardiyo-).' },
  { key: 'tas', term: 'Taş (kalkül)', roots: ['tas$', 'tasi$', 'taslar$', 'kalkul', 'litiazis', 'kolelitiazis', 'nefrolitiazis'], meaning: 'Safra kesesi, böbrek veya idrar yollarında sertleşmiş birikinti.' },
  { key: 'hidronefroz', term: 'Hidronefroz / pelvikaliektazi', roots: ['hidronefroz', 'pelvikaliektazi', 'ektazi'], meaning: 'Böbreğin idrar toplayan bölümünün genişlemesi; akışın bir yerde yavaşladığını gösterebilir.' },
  { key: 'kalsifikasyon', term: 'Kalsifikasyon', roots: ['kalsifikasyon', 'kalsifik', 'kalsifiye', 'kireclenme'], meaning: 'Dokuda kalsiyum birikmesi. Damar duvarı, lenf nodu, meme gibi birçok yerde görülebilir; çoğu zararsızdır.' },
  { key: 'plak', term: 'Plak (ateroskleroz)', roots: ['plak', 'ateroskleroz', 'aterosklerotik', 'ateromatoz'], meaning: 'Damar duvarında yağ, kalsiyum ve iltihap hücrelerinden oluşan birikinti. Uygulamadaki LDL–ateroskleroz simülasyonu bu süreci eğitimsel olarak gösterir.' },
  { key: 'anevrizma', term: 'Anevrizma', roots: ['anevrizma', 'anevrizmatik'], meaning: 'Bir damarın duvarının zayıflayıp balon gibi genişlemesi.' },
  { key: 'fraktur', term: 'Fraktür (kırık)', roots: ['fraktur', 'kirik', 'fissur'], meaning: 'Kemikte kırık ya da çatlak (fissür).' },
  { key: 'kontuzyon', term: 'Kontüzyon / kemik iliği ödemi', roots: ['kontuzyon', 'ezilme', 'ilik odemi'], meaning: 'Darbe sonrası kemik ya da dokuda ezilme; MR\'da ödem olarak görülür.' },
  { key: 'skolyoz', term: 'Skolyoz / lordoz / kifoz', roots: ['skolyoz', 'lordoz', 'kifoz', 'duzlesme'], meaning: 'Omurganın eğrilikleri. "Lordozda düzleşme" boyun ya da bel çukurunun azalmasıdır; kas spazmı veya duruşla ilişkili olabilir.' },
  { key: 'bi-rads', term: 'BI-RADS / TI-RADS / PI-RADS', roots: ['birads', 'bi rads', 'tirads', 'ti rads', 'pirads', 'pi rads', 'lirads'], meaning: 'Meme (BI-), tiroid (TI-), prostat (PI-) ve karaciğer (LI-) için standart değerlendirme ölçekleri. Kategori numarası, radyoloğun önerdiği takip ya da ek inceleme düzeyini anlatır; ne yapılacağına doktorun karar verir.' },
  { key: 'dogal', term: 'Olağan / doğal / normal sınırlarda', roots: ['olagan', 'dogal', 'normal sinirlarda', 'patoloji saptanmadi', 'patolojik bulgu saptanmadi'], meaning: 'Raporda o yapı için dikkat çeken bir değişiklik tarif edilmediğini anlatır.' },
  { key: 'klinik-korelasyon', term: 'Klinik korelasyon önerilir', roots: ['klinik korelasyon', 'klinik ile korelasyon', 'klinik degerlendirme', 'korelasyon'], meaning: 'Radyoloğun, görüntüdeki bulgunun hastanın şikâyetleri, muayenesi ve diğer tetkiklerle birlikte değerlendirilmesini istemesi. Rutin bir ifadedir.' },
  // Mamografi, PET, DEXA
  { key: 'birads', term: 'BI-RADS', roots: ['bi rads', 'birads'], meaning: 'Meme görüntülemesinde bulguların ortak bir dille sınıflandırıldığı sistem (0–6). Sayı, önerilen takip ya da ek inceleme adımını belirtmek için kullanılır; hangi adımın uygun olduğunu hekimin değerlendirir.' },
  { key: 'suv', term: 'SUV / SUVmax', roots: ['suv', 'suvmax'], meaning: 'PET\'te bir alanın işaretli şekeri (FDG) ne kadar tuttuğunun ölçüsü. Yüksek tutulum iltihap, iyileşme ya da başka nedenlerle de olabilir; tek başına tanı değildir.' },
  { key: 'metabolik', term: 'Hipermetabolik / hipometabolik', roots: ['hipermetabolik', 'hipometabolik', 'metabolik aktivite'], meaning: 'PET\'te bir alanın çevresine göre daha fazla (hiper) ya da daha az (hipo) işaretli madde tutması.' },
  { key: 't-skoru', term: 'T skoru / Z skoru', roots: ['t skor', 'z skor'], meaning: 'Kemik yoğunluğu ölçümünde kişinin değerinin genç yetişkin ortalamasıyla (T) ya da kendi yaş grubuyla (Z) karşılaştırılması. Eşikler ve anlamı hekimle değerlendirilir.' },
  { key: 'osteopeni', term: 'Osteopeni / osteoporoz', roots: ['osteopeni', 'osteoporoz'], meaning: 'Kemik yoğunluğunun beklenenden düşük olması (osteopeni) ya da kırık riskini artıracak ölçüde azalması (osteoporoz).' },
  // Patoloji ve endoskopi
  { key: 'displazi', term: 'Displazi', roots: ['displazi'], meaning: 'Hücrelerin normalden farklı görünüm ve dizilim göstermesi. Raporda derecesi (düşük/yüksek ya da hafif/orta/ağır) yazılır; anlamını ve takibi hekimin belirler.' },
  { key: 'metaplazi', term: 'Metaplazi', roots: ['metaplazi'], meaning: 'Bir doku tipinin başka bir doku tipine dönüşmesi; çoğu zaman uzun süreli tahrişe verilen bir uyum yanıtıdır.' },
  { key: 'hiperplazi', term: 'Hiperplazi', roots: ['hiperplazi'], meaning: 'Bir dokudaki hücre sayısının artması. Hormonlar ya da tahriş gibi pek çok nedeni olabilir.' },
  { key: 'benign', term: 'Benign / malign', roots: ['benign', 'malign'], meaning: 'Benign: iyi huylu, çevreye yayılmayan. Malign: kötü huylu. Raporda hangisinin yazdığını ve ne anlama geldiğini hekiminle konuş.' },
  { key: 'inflamasyon', term: 'İnflamasyon / -it eki', roots: ['inflamasyon', 'inflamatuar', 'gastrit', 'kolit', 'ozofajit', 'duodenit'], meaning: 'Dokuda iltihaplanma (yangı). "Gastrit" midenin, "kolit" kalın bağırsağın, "özofajit" yemek borusunun iltihabı demektir.' },
  { key: 'polip', term: 'Polip', roots: ['polip'], meaning: 'Bağırsak ya da mide iç yüzeyinden kabarık doku çıkıntısı. Çoğu iyi huyludur; türü genellikle alınan parçanın patoloji incelemesiyle belirlenir.' },
  { key: 'mukoza', term: 'Mukoza', roots: ['mukoza', 'mukozal'], meaning: 'Sindirim ve solunum yollarının iç yüzeyini örten, nemli doku tabakası.' },
  // EKG ve solunum testi
  { key: 'sinus-ritmi', term: 'Sinüs ritmi', roots: ['sinus ritm', 'normal sinus'], meaning: 'Kalbin kendi doğal ritim merkezinden (sinüs düğümü) yönetilen ritmi. EKG\'de beklenen temel ritimdir.' },
  { key: 'qt', term: 'PR, QRS, QT/QTc', roots: ['qrs', 'qt', 'qtc', 'pr araligi', 'pr suresi'], meaning: 'EKG\'deki elektriksel sürelerin adları: PR kulakçıktan karıncığa iletim, QRS karıncıkların uyarılması, QT uyarılma ile toparlanmanın toplam süresi (QTc kalp hızına göre düzeltilmiş hali).' },
  { key: 'st', term: 'ST segmenti / T dalgası', roots: ['st segment', 'st depresyon', 'st elevasyon', 't dalga'], meaning: 'EKG\'de karıncıkların toparlanma evresini gösteren bölümler. Bu bölümlerdeki değişikliklerin anlamı belirtiler ve diğer tetkiklerle birlikte değerlendirilir.' },
  { key: 'blok', term: 'Dal bloğu / blok', roots: ['dal blogu', 'blok'], meaning: 'Kalpteki elektrik uyarısının iletim yollarından birinde gecikme ya da iletilmeme. Sağlıklı kişilerde de görülebilen türleri vardır.' },
  { key: 'fev1', term: 'FEV1 / FVC', roots: ['fev1', 'fvc'], meaning: 'Solunum testinde FVC: derin nefesten sonra zorlu olarak verilebilen toplam hava; FEV1: bunun ilk saniyede verilen kısmı. FEV1/FVC oranı hava yolu daralmasını değerlendirmede kullanılır.' },
  { key: 'dlco', term: 'DLCO', roots: ['dlco'], meaning: 'Akciğerlerin havadaki gazı kana geçirme yeteneğinin ölçüsü (difüzyon kapasitesi).' },
];

/** Metinde geçen sözlük terimleri (her terim bir kez). */
export function findTerms(text: string): GlossaryTerm[] {
  const hay = padded(text);
  return GLOSSARY.filter((t) =>
    t.roots.some((r) => (r.endsWith('$') ? hay.includes(` ${normalizeText(r.slice(0, -1))} `) : hay.includes(` ${normalizeText(r)}`))),
  );
}

/** Görüntülemeyle ilgili, doktora sorulabilecek genel sorular. */
export const IMAGING_QUESTIONS = [
  'Raporda geçen bulgular şikâyetlerimle ilişkili mi?',
  'Kontrol çekimi gerekiyor mu, gerekiyorsa ne zaman?',
  'Önceki çekimlerimle karşılaştırıldı mı? Yanımda getirmem gereken eski görüntü var mı?',
  'Ek bir tetkik (kan tahlili, farklı bir görüntüleme, biyopsi) gerekiyor mu?',
  'Bu sonuca göre günlük yaşamımda dikkat etmem gereken bir şey var mı?',
];

// ---------------------------------------------------------------------------------------------
// BT pencere ön ayarları (Hounsfield)

export const CT_PRESETS: Array<{ key: string; label: string; center: number; width: number }> = [
  { key: 'yumusak', label: 'Yumuşak doku', center: 40, width: 400 },
  { key: 'akciger', label: 'Akciğer', center: -600, width: 1500 },
  { key: 'kemik', label: 'Kemik', center: 400, width: 1800 },
  { key: 'beyin', label: 'Beyin', center: 40, width: 80 },
  { key: 'karaciger', label: 'Karaciğer', center: 60, width: 160 },
];

/** Rapor metinlerinde sık geçen sözcükler (okunan metnin gerçek bir rapor olup olmadığını anlamak için). */
const REPORT_WORDS = new Set(
  (
    'bulgu bulgular sonuc sonuç rapor inceleme tetkik teknik klinik yorum görüş gorus kanaat normal olağan olagan doğal dogal ' +
    'izlenmedi izlenmektedir izlendi izlenmiştir saptanmadı saptanmadi saptandı saptandi mevcut yoktur ' +
    'beyin serebral serebellum ventrikül ventrikul sulkus sisterna kalvarium orbita sinüs sinus ' +
    'sekans sekanslar kesit kesitler aksiyel koronal sagital kontrast kontrastsız kontrastsiz flair difüzyon difuzyon ' +
    'sinyal intensite hiperintens hipointens odak odakları cevher cevherde lezyon patolojik patoloji boyut boyutu ölçüm olcum sağ sag sol bilateral ' +
    'hasta tarih doktor radyoloji uzman dr ve ile olarak bir bu ile de da için icin göre gore ' +
    'karaciğer karaciger dalak böbrek bobrek akciğer akciger kalp diz omurga disk lomber servikal torakal'
  ).split(' '),
);

const VOWEL = /[aeıioöuüâîû]/;

/**
 * OCR ile okunan metin gerçekten okunabilir bir rapor mu? Film ya da MR fotoğrafında OCR genellikle
 * "ERAS Gn" gibi anlamsız harf öbekleri üretir; bunlar rapor diye kaydedilmez. Ölçüt: yeterince sözcük,
 * sözcüklerin çoğu okunabilir biçimde (ünlü içeren, uzun ünsüz öbeği olmayan) ve bilinen rapor
 * sözcüklerinden birkaçı ya da uzun, düzgün bir metin.
 */
export function isReadableReport(text: string): boolean {
  const words = text
    .toLocaleLowerCase('tr')
    .split(/[^a-zçğıöşüâîû0-9]+/i)
    .filter((w) => w.length >= 2 && /[a-zçğıöşü]/.test(w));
  const long = words.filter((w) => w.length >= 3);
  if (long.length < 4) return false;
  const plausible = long.filter((w) => VOWEL.test(w) && !/[^aeıioöuüâîû0-9]{5,}/.test(w) && !/(.)\1\1/.test(w)).length / long.length;
  const known = words.filter((w) => REPORT_WORDS.has(w)).length;
  if (known >= 2 && plausible >= 0.6) return true;
  return long.length >= 8 && plausible >= 0.8 && known >= 1;
}
