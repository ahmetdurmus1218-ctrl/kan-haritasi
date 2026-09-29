/**
 * Görüntüleme raporundaki bulguları cümle cümle çıkarır: her bulgunun hangi anatomik yapıyla
 * (3B modeldeki yapı ve mümkünse bölümü), hangi tarafta ve omurga seviyesinde olduğunu, raporda
 * olağan mı yoksa dikkat çeken bir değişiklik mi diye yazıldığını belirler.
 *
 * Yalnızca raporda YAZANI yapılandırır: görüntüye bakıp bulgu üretmez, bulgunun ciddiyetini ya da
 * tanısını söylemez. Konum eşleşmesi sözcüklere dayanır; bulunamazsa belgenin bölgesi kullanılır ve
 * bu açıkça belirtilir ("konum: belgenin bölgesi").
 */
import { normalizeText, partsOf } from '@kh/catalog';
import { type GlossaryTerm, type ReportSection, findTerms, regionByKey, splitReport } from './imaging';

export type FindingStatus = 'abnormal' | 'uncertain' | 'normal';
export type Side = 'right' | 'left' | 'both';

export interface ImagingFinding {
  /** Rapordaki özgün cümle. */
  text: string;
  section: ReportSection['kind'];
  structure?: string;
  part?: string;
  /** Konum sözcükten mi bulundu, yoksa belgenin bölgesinden mi varsayıldı? */
  located: 'text' | 'region' | 'none';
  /** Konumun okunur adı (ör. "Sol frontal lob", "L4–L5 seviyesi"). */
  where?: string;
  side?: Side;
  /** Omurga seviyesi (ör. "L4–L5"). */
  level?: string;
  terms: GlossaryTerm[];
  status: FindingStatus;
  /** Kısa başlık (ör. "L4–L5 · Protrüzyon / bulging"). */
  label: string;
  /** Aynı yer ve terim için ortak anahtar (Bulgular ve Sonuç'ta tekrarlanan bulgu). */
  key: string;
}

type Context = 'head' | 'neck' | 'chest' | 'abdomen' | 'pelvis' | 'spine' | 'limb' | 'breast' | 'any';

interface Place {
  words: string[];
  structure: string;
  part?: string | ((side?: Side) => string | undefined);
  label: string;
  ctx: Context;
}

const sided = (base: string) => (side?: Side) => (side === 'left' ? `${base}-l` : side === 'right' ? `${base}-r` : undefined);
const lungLobe = (lobe: 'upper' | 'lower') => (side?: Side) => (side === 'left' ? `left-${lobe}` : side === 'right' ? `right-${lobe}` : undefined);

/**
 * Konum sözlüğü (normalize edilmiş, kelime başından eşleşen sözcükler). Özgül olanlar önce: "frontal
 * sinüs" "frontal"dan, "temporal kemik" "temporal"dan önce gelir.
 */
const PLACES: Place[] = [
  // Baş-boyun: kulak, sinüs, göz, hipofiz (beyin bölümlerinden önce)
  { words: ['temporal kemik', 'mastoid', 'ic kulak', 'orta kulak', 'dis kulak yolu', 'koklea', 'ic akustik', 'kulak'], structure: 'ear', label: 'Kulak / temporal kemik', ctx: 'head' },
  { words: ['frontal sinus', 'maksiller sinus', 'etmoid', 'sfenoid sinus', 'paranazal', 'sinuzit', 'nazal kavite', 'konka'], structure: 'airways', label: 'Paranazal sinüsler', ctx: 'head' },
  { words: ['retina'], structure: 'eyes', part: 'retina', label: 'Retina', ctx: 'head' },
  { words: ['optik sinir', 'optik kiazma', 'kiazma'], structure: 'eyes', part: 'optic-nerve', label: 'Optik sinir', ctx: 'head' },
  { words: ['lens'], structure: 'eyes', part: 'lens', label: 'Göz merceği', ctx: 'head' },
  { words: ['kornea'], structure: 'eyes', part: 'cornea', label: 'Kornea', ctx: 'head' },
  { words: ['orbita', 'glob', 'goz'], structure: 'eyes', label: 'Göz / orbita', ctx: 'head' },
  { words: ['hipofiz', 'sella', 'adenohipofiz', 'norohipofiz', 'pituiter'], structure: 'pituitary', label: 'Hipofiz', ctx: 'head' },
  // Beyin bölümleri
  { words: ['frontal'], structure: 'brain', part: 'frontal', label: 'Frontal lob', ctx: 'head' },
  { words: ['parietal'], structure: 'brain', part: 'parietal', label: 'Parietal lob', ctx: 'head' },
  { words: ['temporal'], structure: 'brain', part: 'temporal', label: 'Temporal lob', ctx: 'head' },
  { words: ['oksipital', 'occipital'], structure: 'brain', part: 'occipital', label: 'Oksipital lob', ctx: 'head' },
  { words: ['serebell', 'beyincik', 'vermis'], structure: 'brain', part: 'cerebellum', label: 'Beyincik', ctx: 'head' },
  { words: ['korpus kallozum', 'corpus callos', 'korpus kallosum'], structure: 'brain', part: 'corpus-callosum', label: 'Korpus kallozum', ctx: 'head' },
  { words: ['talamus', 'talamik'], structure: 'brain', part: 'thalamus', label: 'Talamus', ctx: 'head' },
  { words: ['hipokamp', 'mezial temporal'], structure: 'brain', part: 'hippocampus', label: 'Hipokampus', ctx: 'head' },
  { words: ['bazal gangli', 'lentiform', 'putamen', 'kaudat nukle', 'globus pallidus', 'kapsula interna'], structure: 'brain', part: 'basal-nuclei', label: 'Bazal çekirdekler', ctx: 'head' },
  { words: ['insula', 'insuler'], structure: 'brain', part: 'insula', label: 'İnsula', ctx: 'head' },
  { words: ['amigdal'], structure: 'brain', part: 'amygdala', label: 'Amigdala', ctx: 'head' },
  { words: ['pons', 'pontin'], structure: 'brain', part: 'pons', label: 'Pons', ctx: 'head' },
  { words: ['bulbus', 'medulla oblongata'], structure: 'brain', part: 'medulla', label: 'Omurilik soğanı', ctx: 'head' },
  { words: ['mezensefal', 'orta beyin', 'mesensefal'], structure: 'brain', part: 'midbrain', label: 'Orta beyin', ctx: 'head' },
  { words: ['ventrikul', 'lateral ventrikul', 'ventrikuler sistem'], structure: 'brain', part: 'ventricles', label: 'Beyin karıncıkları (ventriküller)', ctx: 'head' },
  { words: ['beyaz cevher', 'periventrikul', 'subkortikal', 'sentrum semiovale', 'derin beyaz'], structure: 'brain', part: 'white-matter', label: 'Beyaz cevher', ctx: 'head' },
  { words: ['beyin', 'serebral', 'intrakranial', 'supratentorial', 'infratentorial', 'kortikal sulkus', 'sulkus', 'sisterna'], structure: 'brain', label: 'Beyin', ctx: 'head' },
  // Boyun
  { words: ['tiroid'], structure: 'thyroid', label: 'Tiroid', ctx: 'neck' },
  { words: ['karotis', 'karotid'], structure: 'carotid-arteries', label: 'Karotis arterleri', ctx: 'neck' },
  { words: ['larinks', 'glottik', 'vokal kord'], structure: 'airways', label: 'Gırtlak', ctx: 'neck' },
  // Omurga (seviye ayrıca okunur)
  { words: ['servikal'], structure: 'spinal-cord', part: 'cervical', label: 'Boyun omurgası', ctx: 'spine' },
  { words: ['torakal', 'dorsal'], structure: 'spinal-cord', part: 'thoracic', label: 'Sırt omurgası', ctx: 'spine' },
  { words: ['lomber', 'lumbar', 'lumbosakral'], structure: 'spinal-cord', part: 'lumbar', label: 'Bel omurgası', ctx: 'spine' },
  { words: ['sakral', 'sakrum', 'koksiks', 'sakroiliak'], structure: 'spinal-cord', part: 'sacral', label: 'Sakrum', ctx: 'spine' },
  { words: ['omurilik', 'spinal kord', 'konus medullaris', 'kauda'], structure: 'spinal-cord', label: 'Omurilik', ctx: 'spine' },
  { words: ['disk', 'intervertebral', 'foramen', 'foraminal', 'spinal kanal', 'faset', 'vertebra', 'korpus', 'spondil', 'lordoz', 'kifoz', 'skolyoz', 'sinir kok'], structure: 'bones', part: 'spine', label: 'Omurga', ctx: 'spine' },
  // Göğüs
  { words: ['sag ust lob', 'sol ust lob', 'ust lob', 'lingula'], structure: 'lungs', part: lungLobe('upper'), label: 'Akciğer üst lobu', ctx: 'chest' },
  { words: ['orta lob'], structure: 'lungs', part: 'right-middle', label: 'Sağ akciğer orta lobu', ctx: 'chest' },
  { words: ['alt lob'], structure: 'lungs', part: lungLobe('lower'), label: 'Akciğer alt lobu', ctx: 'chest' },
  { words: ['hiler', 'hilus'], structure: 'lungs', part: 'hilum', label: 'Akciğer kökü (hilus)', ctx: 'chest' },
  { words: ['akciger', 'pulmoner', 'plevra', 'parankim', 'bronsiektazi', 'bronsiyal', 'bronkovaskuler', 'kostofrenik'], structure: 'lungs', label: 'Akciğer', ctx: 'chest' },
  { words: ['trakea'], structure: 'airways', label: 'Soluk borusu', ctx: 'chest' },
  { words: ['sol ventrikul'], structure: 'heart', part: 'left-ventricle', label: 'Sol karıncık', ctx: 'chest' },
  { words: ['sag ventrikul'], structure: 'heart', part: 'right-ventricle', label: 'Sağ karıncık', ctx: 'chest' },
  { words: ['sol atri', 'sol kulakcik'], structure: 'heart', part: 'left-atrium', label: 'Sol kulakçık', ctx: 'chest' },
  { words: ['sag atri', 'sag kulakcik'], structure: 'heart', part: 'right-atrium', label: 'Sağ kulakçık', ctx: 'chest' },
  { words: ['mitral'], structure: 'heart', part: 'mitral', label: 'Mitral kapak', ctx: 'chest' },
  { words: ['aort kapak', 'aortik kapak'], structure: 'heart', part: 'aortic-valve', label: 'Aort kapağı', ctx: 'chest' },
  { words: ['trikuspit', 'triküspit'], structure: 'heart', part: 'tricuspid', label: 'Triküspit kapak', ctx: 'chest' },
  { words: ['interventrikuler septum', 'septal'], structure: 'heart', part: 'septum', label: 'Karıncıklar arası bölme', ctx: 'chest' },
  { words: ['kalp', 'kardiyak', 'perikard', 'kardiyotorasik', 'kardiyomegali'], structure: 'heart', label: 'Kalp', ctx: 'chest' },
  { words: ['arkus aorta', 'aortik ark'], structure: 'aorta', part: 'aortic arch', label: 'Aort kavsi', ctx: 'chest' },
  { words: ['asendan aorta', 'cikan aorta'], structure: 'aorta', part: 'ascending aorta', label: 'Çıkan aort', ctx: 'chest' },
  { words: ['aort'], structure: 'aorta', label: 'Aort', ctx: 'any' },
  { words: ['mediasten'], structure: 'lungs', label: 'Mediasten', ctx: 'chest' },
  { words: ['aksiller'], structure: 'lymph-node', label: 'Koltuk altı lenf nodları', ctx: 'breast' },
  // Meme
  { words: ['meme', 'mamar', 'fibroglandular'], structure: 'breasts', label: 'Meme', ctx: 'breast' },
  // Karın
  { words: ['kaudat lob'], structure: 'liver', part: 'caudate', label: 'Karaciğer kaudat lobu', ctx: 'abdomen' },
  { words: ['karaciger sag lob', 'sag lob'], structure: 'liver', part: 'right-lobe', label: 'Karaciğer sağ lobu', ctx: 'abdomen' },
  { words: ['karaciger sol lob', 'sol lob'], structure: 'liver', part: 'left-lobe', label: 'Karaciğer sol lobu', ctx: 'abdomen' },
  { words: ['portal ven', 'porta hepatis'], structure: 'liver', part: 'porta', label: 'Karaciğer kapısı (porta)', ctx: 'abdomen' },
  { words: ['karaciger', 'hepatik', 'hepatosteatoz', 'hepatomegali', 'intrahepatik'], structure: 'liver', label: 'Karaciğer', ctx: 'abdomen' },
  { words: ['koledok', 'safra yol', 'safra kanal', 'duktus', 'mrcp'], structure: 'gallbladder', part: 'bile-ducts', label: 'Safra yolları', ctx: 'abdomen' },
  { words: ['safra kese', 'kolesist', 'kolelitiazis'], structure: 'gallbladder', part: 'gallbladder', label: 'Safra kesesi', ctx: 'abdomen' },
  { words: ['pankreas bas', 'unsinat'], structure: 'pancreas', part: 'head', label: 'Pankreas başı', ctx: 'abdomen' },
  { words: ['pankreas govde', 'pankreas korpus'], structure: 'pancreas', part: 'body', label: 'Pankreas gövdesi', ctx: 'abdomen' },
  { words: ['pankreas kuyruk'], structure: 'pancreas', part: 'tail', label: 'Pankreas kuyruğu', ctx: 'abdomen' },
  { words: ['pankrea', 'wirsung'], structure: 'pancreas', label: 'Pankreas', ctx: 'abdomen' },
  { words: ['dalak', 'splenik', 'splenomegali', 'aksesuar dalak'], structure: 'spleen', label: 'Dalak', ctx: 'abdomen' },
  { words: ['surrenal', 'adrenal', 'bobrekustu'], structure: 'adrenals', label: 'Böbreküstü bezi', ctx: 'abdomen' },
  { words: ['pelvikalisiyel', 'pelvikaliks', 'toplayici sistem', 'kaliks', 'renal pelvis', 'hidronefroz', 'pelvikaliektazi'], structure: 'urinary-tract', part: 'renal-pelvis', label: 'Böbrek toplayıcı sistemi', ctx: 'abdomen' },
  { words: ['bobrek', 'renal', 'nefrolitiazis', 'parankim kalinli'], structure: 'kidneys', label: 'Böbrek', ctx: 'abdomen' },
  { words: ['ureter', 'uvj', 'ureterovezikal'], structure: 'urinary-tract', part: 'ureter', label: 'Üreter', ctx: 'abdomen' },
  { words: ['mesane', 'vezika'], structure: 'urinary-tract', part: 'bladder', label: 'Mesane', ctx: 'pelvis' },
  { words: ['ozofag', 'yemek borusu'], structure: 'esophagus', label: 'Yemek borusu', ctx: 'chest' },
  { words: ['mide', 'gastrik', 'antrum', 'antral', 'fundus', 'pilor'], structure: 'stomach', label: 'Mide', ctx: 'abdomen' },
  { words: ['duoden', 'bulbus'], structure: 'small-intestine', part: 'duodenum', label: 'On iki parmak bağırsağı', ctx: 'abdomen' },
  { words: ['jejun'], structure: 'small-intestine', part: 'jejunum', label: 'Jejunum', ctx: 'abdomen' },
  { words: ['ileum', 'terminal ileum', 'ileal'], structure: 'small-intestine', part: 'ileum', label: 'İleum', ctx: 'abdomen' },
  { words: ['cekum', 'apendiks', 'apandis'], structure: 'large-intestine', part: 'cecum', label: 'Çekum / apendiks', ctx: 'abdomen' },
  { words: ['cikan kolon', 'asendan kolon'], structure: 'large-intestine', part: 'ascending', label: 'Çıkan kolon', ctx: 'abdomen' },
  { words: ['transvers kolon'], structure: 'large-intestine', part: 'transverse', label: 'Transvers kolon', ctx: 'abdomen' },
  { words: ['inen kolon', 'desendan kolon'], structure: 'large-intestine', part: 'descending', label: 'İnen kolon', ctx: 'abdomen' },
  { words: ['sigmoid'], structure: 'large-intestine', part: 'sigmoid', label: 'Sigmoid kolon', ctx: 'abdomen' },
  { words: ['rektum', 'rektal', 'anal kanal'], structure: 'large-intestine', part: 'rectum', label: 'Rektum', ctx: 'pelvis' },
  { words: ['kolon', 'kalin bagirsak', 'divertikul'], structure: 'large-intestine', label: 'Kalın bağırsak', ctx: 'abdomen' },
  { words: ['ince bagirsak', 'barsak ans', 'bagirsak ans'], structure: 'small-intestine', label: 'İnce bağırsak', ctx: 'abdomen' },
  { words: ['lenf nod', 'lenfadenopati', 'lap', 'lenf bez'], structure: 'lymph-node', label: 'Lenf nodu', ctx: 'any' },
  // Pelvis
  { words: ['endometri', 'myometri', 'miyometri', 'uterus', 'rahim', 'myom', 'miyom'], structure: 'uterus', part: 'body', label: 'Rahim', ctx: 'pelvis' },
  { words: ['serviks', 'servikal kanal'], structure: 'uterus', part: 'cervix', label: 'Rahim ağzı', ctx: 'pelvis' },
  { words: ['over', 'ovary', 'adneks', 'folikul'], structure: 'ovaries', label: 'Yumurtalık', ctx: 'pelvis' },
  { words: ['tuba', 'hidrosalpenks'], structure: 'fallopian-tubes', label: 'Fallop tüpü', ctx: 'pelvis' },
  { words: ['periferik zon'], structure: 'prostate', part: 'peripheral', label: 'Prostat periferik zon', ctx: 'pelvis' },
  { words: ['transizyonel zon', 'gecis zon'], structure: 'prostate', part: 'transition', label: 'Prostat geçiş zonu', ctx: 'pelvis' },
  { words: ['prostat'], structure: 'prostate', label: 'Prostat', ctx: 'pelvis' },
  { words: ['testis', 'epididim', 'skrotal', 'varikosel', 'hidrosel'], structure: 'testes', label: 'Testis', ctx: 'pelvis' },
  { words: ['seminal vezik', 'vezikula seminal'], structure: 'male-genitals', label: 'Seminal vezikül', ctx: 'pelvis' },
  // Eklemler ve kemikler
  { words: ['menisk'], structure: 'knee', part: 'meniscus', label: 'Menisküs', ctx: 'limb' },
  { words: ['on capraz', 'acl'], structure: 'knee', part: 'acl', label: 'Ön çapraz bağ', ctx: 'limb' },
  { words: ['arka capraz', 'pcl'], structure: 'knee', part: 'pcl', label: 'Arka çapraz bağ', ctx: 'limb' },
  { words: ['kollateral'], structure: 'knee', part: 'collateral', label: 'Yan bağ (kollateral)', ctx: 'limb' },
  { words: ['patellar tendon', 'patellar bag'], structure: 'knee', part: 'patellar', label: 'Diz kapağı bağı', ctx: 'limb' },
  { words: ['kikirdak', 'kondral', 'kondromalazi'], structure: 'knee', part: 'cartilage', label: 'Eklem kıkırdağı', ctx: 'limb' },
  { words: ['diz', 'suprapatellar', 'popliteal'], structure: 'knee', label: 'Diz', ctx: 'limb' },
  { words: ['femur', 'patella', 'uyluk'], structure: 'bones', part: sided('femur'), label: 'Uyluk kemiği', ctx: 'limb' },
  { words: ['tibia', 'fibula', 'kaval'], structure: 'bones', part: sided('leg'), label: 'Bacak kemikleri', ctx: 'limb' },
  { words: ['talus', 'kalkaneus', 'metatars', 'ayak bilegi', 'ayak'], structure: 'bones', part: sided('foot'), label: 'Ayak kemikleri', ctx: 'limb' },
  { words: ['humerus', 'rotator', 'supraspinatus', 'glenoid', 'omuz'], structure: 'bones', part: sided('humerus'), label: 'Omuz / kol kemiği', ctx: 'limb' },
  { words: ['radius', 'ulna', 'dirsek', 'onkol'], structure: 'bones', part: sided('forearm'), label: 'Ön kol kemikleri', ctx: 'limb' },
  { words: ['karpal', 'skafoid', 'el bilegi', 'metakarp', 'falanks'], structure: 'bones', part: sided('hand'), label: 'El kemikleri', ctx: 'limb' },
  { words: ['asetabul', 'kalca', 'iliak kanat', 'pubis', 'iskiyum'], structure: 'bones', part: 'pelvis', label: 'Kalça / leğen kemiği', ctx: 'pelvis' },
  { words: ['kosta', 'kaburga', 'sternum'], structure: 'bones', part: 'ribcage', label: 'Göğüs kafesi', ctx: 'chest' },
  { words: ['kalvaryum', 'kafatasi', 'kranium'], structure: 'bones', part: 'skull', label: 'Kafatası', ctx: 'head' },
];

/** Belge bölgesi → konum bağlamı (yalnızca bu bağlamdaki sözcükler kullanılır; "any" her yerde). */
const REGION_CTX: Record<string, Context[]> = {
  beyin: ['head'],
  hipofiz: ['head'],
  goz: ['head'],
  kulak: ['head'],
  sinus: ['head'],
  boyun: ['neck', 'head'],
  tiroid: ['neck'],
  servikal: ['spine', 'neck'],
  torakal: ['spine'],
  lomber: ['spine'],
  omurga: ['spine'],
  toraks: ['chest', 'breast'],
  kalp: ['chest'],
  meme: ['breast', 'chest'],
  batin: ['abdomen', 'pelvis'],
  karaciger: ['abdomen'],
  bobrek: ['abdomen', 'pelvis'],
  pelvis: ['pelvis', 'abdomen'],
  prostat: ['pelvis'],
  rahim: ['pelvis'],
  omuz: ['limb'],
  dirsek: ['limb'],
  el: ['limb'],
  kalca: ['limb', 'pelvis'],
  diz: ['limb'],
  ayak: ['limb'],
  kemik: ['limb', 'spine', 'chest', 'pelvis', 'head'],
  damar: ['chest', 'abdomen', 'neck', 'limb'],
  'yemek-borusu': ['chest', 'abdomen'],
  mide: ['abdomen', 'chest'],
  kolon: ['abdomen', 'pelvis'],
};

const NEGATION =
  /\b(izlenmedi|izlenmemis|izlenmemektedir|saptanmadi|saptanmamis|gorulmedi|gorulmemis|gozlenmedi|rastlanmadi|yoktur|bulunmamaktadir|mevcut degil|dikkati cekmedi|ekarte edildi|yok)\b/;
/** Olağan ifadeler (ekleriyle: "sağlamdır", "doğaldır", "korunmuştur"). */
const NORMAL = /\b(olagan|dogal|normal|korunmus|simetri|duzgun|sinirlar|intakt|saglam|mevcut degil)/;
const UNCERTAIN = /\b(supheli|olasi|olasilikla|dusundurur|dusundurmektedir|ekarte edilemedi|ayirici tani|lehine|ile uyumlu olabilir|dusunulmustur|belirsiz)\b|\?/;
const ABNORMAL =
  /\b(genis|genislemis|daralmis|daralma|kalinlasmis|kalinlasma|artmis|artis|azalmis|azalma|buyumus|bozulmus|kayb|duzlesme|egrilik|siddetli|belirgin|hafif|minimal|orta derece|ileri derece|odak|odaklar|alan|alanlar|patolojik|anormal|asimetri|yirtik|kopma|sivi|kist|kitle|nodul|tas)\b/;
/** Patoloji, endoskopi, EKG ve solunum/kemik testlerinde dikkat çeken ifadeler (ekleriyle: "erozyonlar", "bloğu"). */
const ABNORMAL_STEM =
  /\b(displazi|metaplazi|polip|ulser|erozyon|hiperemi|gastrit|kolit|ozofajit|duodenit|adenom|karsinom|malign|atipi|blok|blog|tasikardi|bradikardi|aritmi|fibrilasyon|ekstrasistol|obstrukti|obstruksiyon|restrikti|restriksiyon|osteopeni|osteoporoz|hipermetabolik)/;
/** Sözlükte "dikkat" anlamı taşımayan terimler. */
const NEUTRAL_TERMS = new Set(['dogal', 'klinik-korelasyon', 'sinus-ritmi']);
/** Yapı adı olan terimler: tek başına bulgu değildir ("ön çapraz bağ sağlamdır"). */
const STRUCTURAL_TERMS = new Set(['ligament', 'foramen', 'plevral', 'lenf', 'menisk', 'tendinit', 'kontrast', 'difuzyon', 'mukoza', 'qt', 'st', 'fev1', 'dlco', 't-skoru', 'birads', 'suv']);

/** Rapor başlığı, imza ve alt bilgi satırları bulgu değildir. */
const BOILERPLATE = /^(hasta|adi soyadi|protokol|tetkik tarihi|rapor tarihi|tarih|dr |uzm|prof|doc|imza|elektronik olarak|bu belge|sayfa \d)|test amacli|sentetik/;

const LETTER: Record<string, string> = {
  c: 'cervical',
  t: 'thoracic',
  d: 'thoracic',
  l: 'lumbar',
  s: 'sacral',
};
const LETTER_MAX: Record<string, number> = { c: 8, t: 12, d: 12, l: 5, s: 5 };

/** "L4-5", "L4-L5", "C5–C6", "L5-S1", "T11-12" gibi omurga seviyeleri. "T2" (MR sekansı) tek başına seviye sayılmaz. */
export function spineLevel(sentence: string): { level: string; part: string } | undefined {
  const re = /\b([CTDLS])\s?(\d{1,2})\s*[-–/]\s*([CTDLS])?\s?(\d{1,2})\b/gi;
  for (const m of sentence.matchAll(re)) {
    const a = m[1]!.toLowerCase();
    const b = (m[3] ?? m[1]!).toLowerCase();
    const n1 = Number(m[2]);
    const n2 = Number(m[4]);
    if (n1 < 1 || n1 > LETTER_MAX[a]! || n2 < 1 || n2 > LETTER_MAX[b]!) continue;
    // T1-T2 / T2-FLAIR gibi sekans adlarını ele: iki sayı ardışık olmalı ya da harf değişmeli (L5-S1)
    if (a === b && n2 !== n1 + 1) continue;
    if (a === 't' && /t1|t2/i.test(m[0]) && /(agirlikli|flair|sekans|stir|imaj)/i.test(normalizeText(sentence))) continue;
    const up = (x: string) => (x === 'd' ? 'T' : x.toUpperCase());
    return {
      level: `${up(a)}${n1}–${up(b)}${n2}`,
      part: LETTER[b === 's' ? a : b]!,
    };
  }
  // "L5 vertebra", "C2 korpusu" gibi tek seviye
  const single = /\b([CLS])\s?(\d)\s+(vertebra|korpus|omur)/i.exec(sentence);
  if (single) {
    const a = single[1]!.toLowerCase();
    return { level: `${a.toUpperCase()}${single[2]}`, part: LETTER[a]! };
  }
  return undefined;
}

function sideOf(norm: string): Side | undefined {
  if (/\b(bilateral|her iki|iki tarafli|bilateralde)\b/.test(norm)) return 'both';
  const r = /\bsag(da|daki|in|inda|dan|ta)?\b/.test(norm);
  const l = /\bsol(da|daki|un|unda|dan)?\b/.test(norm);
  if (r && l) return 'both';
  return r ? 'right' : l ? 'left' : undefined;
}

function sentences(section: ReportSection): string[] {
  return section.text
    .split(/\n+|(?<=[.;])\s+(?=[A-ZÇĞİÖŞÜ0-9-])|(?<=\.)\s+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((s) => s.split(/\s+/).length >= 2 && /[a-zçğıöşü]/i.test(s));
}

function statusOf(sentence: string): FindingStatus {
  // Virgülle ayrılmış yan cümlelerin her biri ayrı değerlendirilir: "protrüzyon izlendi, stenoz izlenmedi".
  // (normalizeText noktalama işaretlerini sildiği için bölme özgün cümlede yapılır.)
  const clauses = sentence
    .split(/[,;]|\s(?:ve|ile birlikte)\s/i)
    .map((c) => normalizeText(c))
    .filter(Boolean);
  let abnormal = false;
  let uncertain = false;
  for (const c of clauses) {
    const terms = findTerms(c).filter((t) => !NEUTRAL_TERMS.has(t.key));
    const strong = terms.some((t) => !STRUCTURAL_TERMS.has(t.key));
    const neg = NEGATION.test(c);
    const normal = NORMAL.test(c);
    if (UNCERTAIN.test(c) && !neg) uncertain = true;
    if (neg) continue;
    if (strong || ((terms.length || ABNORMAL.test(c) || ABNORMAL_STEM.test(c)) && !normal)) abnormal = true;
  }
  if (uncertain) return 'uncertain';
  return abnormal ? 'abnormal' : 'normal';
}

const STATUS_WORD: Record<FindingStatus, string> = {
  abnormal: 'dikkat çeken bulgu',
  uncertain: 'belirsiz / olasılık',
  normal: 'olağan',
};

/**
 * Rapor metninden bulgu listesi. `region`: belgenin bölgesi (konum sözcüğü yoksa varsayılan konum ve
 * sözcük bağlamı için).
 */
export function extractFindings(text: string, region?: string): ImagingFinding[] {
  const all = splitReport(text);
  // Başlıklı raporda yalnızca Bulgular ve Sonuç; başlıksız metinde tamamı (üst/alt bilgi satırları ayıklanır)
  const titled = all.some((s) => s.kind === 'bulgular' || s.kind === 'sonuc');
  const sections = all.filter((s) => s.kind === 'bulgular' || s.kind === 'sonuc' || (!titled && s.kind === 'diger'));
  const ctx = region ? (REGION_CTX[region] ?? null) : null;
  const allowed = (p: Place) => !ctx || p.ctx === 'any' || ctx.includes(p.ctx);
  const fallback = region ? regionByKey.get(region)?.structure : undefined;
  const out: ImagingFinding[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    for (const s of sentences(section)) {
      const norm = normalizeText(s);
      if (BOILERPLATE.test(norm)) continue;
      const padded = ` ${norm} `;
      const seenKey = `${section.kind}|${norm}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);
      const terms = findTerms(s);
      const status = statusOf(s);
      const side = sideOf(norm);
      const lvl = spineLevel(s);
      const place = PLACES.find((p) => allowed(p) && p.words.some((w) => padded.includes(` ${normalizeText(w)}`)));
      let structure = place?.structure;
      let part = typeof place?.part === 'function' ? place.part(side) : place?.part;
      let where = place?.label;
      if (lvl && (!place || place.ctx === 'spine')) {
        structure = 'spinal-cord';
        part = lvl.part;
        where = `${lvl.level} seviyesi`;
      }
      let located: ImagingFinding['located'] = structure ? 'text' : 'none';
      if (!structure && fallback) {
        structure = fallback;
        located = 'region';
      }
      // Bölüm modelde yoksa (ör. tiroid şematik) yalnızca yapı kullanılır
      if (structure && part && !partsOf(structure).some((d) => d.key === part) && structure !== 'aorta') part = undefined;
      if (where && side && side !== 'both' && !/^(sag|sol) /i.test(normalizeText(where)))
        where = `${side === 'right' ? 'Sağ' : 'Sol'} ${where.charAt(0).toLocaleLowerCase('tr')}${where.slice(1)}`;
      if (where && side === 'both') where = `${where} (iki taraf)`;
      const main = terms.find((t) => !NEUTRAL_TERMS.has(t.key));
      const label = `${where ?? 'Genel'} · ${main ? main.term : STATUS_WORD[status]}`;
      out.push({
        text: s,
        section: section.kind,
        structure,
        part,
        located,
        where,
        side,
        level: lvl?.level,
        terms,
        status,
        label,
        key: `${structure ?? '-'}|${part ?? '-'}|${lvl?.level ?? '-'}|${main?.key ?? status}`,
      });
    }
  }
  return out;
}

/** Bir yapının (ve bölümünün) normal işleyişi hakkında kısa bilgi: bölüm tanımı varsa o. */
export function normalInfo(structure: string, part?: string): string | undefined {
  const def = part ? partsOf(structure).find((d) => d.key === part) : undefined;
  return def?.info;
}
