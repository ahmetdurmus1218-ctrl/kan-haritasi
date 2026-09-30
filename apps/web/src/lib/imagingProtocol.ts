/**
 * Sistematik değerlendirme şeması: bir radyoloğun o inceleme türünde sırayla baktığı başlıklar.
 *
 * Kullanıcı neye bakılacağını bilmek zorunda değildir: belge türü (MR, BT, ultrason…) ve bölge
 * (beyin, omurga, göğüs…) belli olunca ilgili başlık listesi kendiliğinden kurulur. Her başlığın durumu
 * YALNIZCA elimizdeki kaynaklardan belirlenir ve kaynağı açıkça yazılır:
 *
 *  - Rapor metni: raporda o başlıkla ilgili bir cümle varsa (olağan / dikkat / belirsiz).
 *  - Görüntü: şu an yalnızca basit sağ-sol parlaklık karşılaştırması yapılabilir (ayna simetrisi);
 *    başka hiçbir başlık görüntüden "değerlendirildi" sayılmaz.
 *  - Hiçbiri: "değerlendirilemedi". Bir başlığın raporda geçmemesi o bulgunun OLMADIĞI anlamına
 *    gelmez; sistem hiçbir başlık için kendiliğinden "yok" demez.
 *
 * Bir başlık özel bir sekans/yöntem gerektiriyorsa (ör. akut enfarkt için difüzyon, damar darlığı için
 * anjiyografik görüntü) ve raporda ya da seri adlarında bu sekans görünmüyorsa "uygun sekans görünmüyor"
 * denir. Teknik bilgisi hiç yoksa bu çıkarım yapılmaz.
 */
import { normalizeText } from '@kh/catalog';
import type { DocCategory } from '@kh/vault';
import type { FindingStatus, ImagingFinding } from './imagingFindings';

/** Değerlendirme için gereken görüntü / sekans. */
export type Requirement = 't2flair' | 'dwi' | 'swi' | 'contrast' | 'angio' | 'doppler' | 'mr' | 'thin';

export interface CheckItem {
  key: string;
  title: string;
  /** Bu başlıkta neye bakılır (kısa, eğitsel). */
  about: string;
  /** Normal anatomide beklenen görünüm (eğitsel, kişiye özel değil). */
  normal?: string;
  /** Rapor cümlesini bu başlığa bağlayan sözcük kökleri (normalize, kelime başı). */
  words: string[];
  requires?: Requirement[];
  /** 3B modelde gösterilecek yapı (yaklaşık yer). */
  structure?: string;
  part?: string;
  /** Görüntüden yapılan basit sağ-sol karşılaştırmasının ilgili olduğu başlık. */
  symmetry?: boolean;
}

export interface Protocol {
  key: string;
  title: string;
  items: CheckItem[];
}

const REQ_LABEL: Record<Requirement, string> = {
  t2flair: 'T2 / FLAIR sekansı',
  dwi: 'difüzyon (DWI/ADC) sekansı',
  swi: 'SWI / gradient eko (kanamaya duyarlı) sekansı',
  contrast: 'kontrast madde verilmiş çekim',
  angio: 'anjiyografik görüntü (MR/BT anjiyo, TOF)',
  doppler: 'Doppler incelemesi',
  mr: 'MR incelemesi',
  thin: 'ince kesitli çekim',
};

// ---------------------------------------------------------------------------------------------
// Başlık kütüphanesi (ortak başlıklar birden fazla şemada kullanılır)

const QUALITY: CheckItem = {
  key: 'kalite',
  title: 'Görüntü kalitesi ve inceleme kapsamı',
  about: 'Hareket, metal ya da solunum artefaktı; kesitlerin bölgeyi tam kapsayıp kapsamadığı; değerlendirmeyi sınırlayan etkenler.',
  words: ['artefakt', 'artifakt', 'hareket', 'kalite', 'sinirli degerlendir', 'suboptimal', 'yetersiz', 'kapsam', 'teknik'],
};

const BRAIN_MR: CheckItem[] = [
  {
    key: 'parankim',
    title: 'Beyin dokusunun genel görünümü ve yapısal bütünlüğü',
    about: 'Beyin loblarının şekli, kıvrım (girus) ve oluk (sulkus) yapısı, doku kaybı (atrofi) ya da gelişimsel farklılık.',
    normal: 'Loblar simetrik, kıvrım ve oluklar yaşa uygun genişlikte.',
    words: ['beyin parankim', 'parankim', 'serebral', 'atrofi', 'girus', 'giral', 'sulkus', 'sulkal', 'kortikal'],
    structure: 'brain',
  },
  {
    key: 'beyaz-gri',
    title: 'Beyaz cevher ve gri cevher',
    about: 'Gri cevher (korteks, derin çekirdekler) ile beyaz cevher (sinir lifleri) ayrımı; beyaz cevherde sinyal değişikliği.',
    normal: 'Gri-beyaz cevher ayrımı belirgin; beyaz cevherde yaşa göre beklenenden fazla sinyal değişikliği yok.',
    words: ['beyaz cevher', 'gri cevher', 'gri beyaz', 'periventrikuler', 'subkortikal', 'derin beyaz', 'lokomotor', 'bazal gangli', 'talamus', 'lokunar', 'gliozis', 'iskemik gliotik', 'mikroanjiyopati'],
    requires: ['t2flair'],
    structure: 'brain',
  },
  {
    key: 'demiyelinizan',
    title: 'Demiyelinizan plaklarla uyumlu olabilecek odaklar',
    about: 'Beyaz cevherde, özellikle ventrikül çevresi, korpus kallozum, beyin sapı ve beyincikte T2/FLAIR\'de parlak odaklar; sayısı, yeri ve dağılımı.',
    normal: 'Beyaz cevherde plak benzeri odak izlenmez.',
    words: ['demiyelin', 'plak', 'ms ', 'multipl skleroz', 'hiperintens odak', 'odaklar', 'dawson', 'juxtakortikal', 'jukstakortikal', 'infratentoryal', 'periventrikuler'],
    requires: ['t2flair'],
    structure: 'brain',
  },
  {
    key: 'lezyon',
    title: 'Lezyonların konumu, sayısı ve boyutu',
    about: 'Kitle, kist, nodül ya da odağın hangi lobda olduğu, kaç tane olduğu ve ölçüsü.',
    words: ['lezyon', 'kitle', 'kist', 'nodul', 'odak', 'tumor', 'metastaz'],
    structure: 'brain',
  },
  {
    key: 'ventrikul',
    title: 'Ventriküller ve beyin omurilik sıvısı (BOS) boşlukları',
    about: 'Ventriküllerin genişliği ve simetrisi, sisternalar, sulkuslar; hidrosefali bulgusu.',
    normal: 'Ventriküller orta hatta, simetrik ve normal genişlikte.',
    words: ['ventrikul', 'lateral ventrikul', 'ucuncu ventrikul', 'dorduncu ventrikul', 'sistern', 'bos ', 'beyin omurilik sivisi', 'hidrosefali', 'subaraknoid'],
    structure: 'brain',
  },
  {
    key: 'orta-hat',
    title: 'Orta hat kayması ve kitle etkisi',
    about: 'Beyin yapılarının orta hattan bir yana itilmesi, ventrikül basısı, fıtıklaşma (herniasyon).',
    normal: 'Orta hat yapıları ortada; kitle etkisi yok.',
    words: ['orta hat', 'kitle etkisi', 'shift', 'herniasyon', 'basi', 'efase', 'silinme'],
    structure: 'brain',
    symmetry: true,
  },
  {
    key: 'odem',
    title: 'Ödem ile uyumlu olabilecek bulgular',
    about: 'Lezyon çevresinde ya da yaygın olarak dokunun su içeriğinin artması.',
    words: ['odem', 'vazojenik', 'sitotoksik'],
    requires: ['t2flair'],
    structure: 'brain',
  },
  {
    key: 'kanama',
    title: 'Kanama ile uyumlu olabilecek bulgular',
    about: 'Beyin içi, beyin zarları arası (subdural/epidural/subaraknoid) kanama; eski kanama izleri (hemosiderin).',
    words: ['kanama', 'hemoraji', 'hematom', 'hemosiderin', 'mikrokanama', 'mikrohemoraji', 'subdural', 'epidural'],
    structure: 'brain',
  },
  {
    key: 'mikrokanama',
    title: 'Mikrokanama odakları',
    about: 'Kanamaya duyarlı sekansta (SWI/GRE) görülen noktasal eski kanama izleri.',
    words: ['mikrokanama', 'mikrohemoraji', 'hemosiderin', 'blooming', 'susseptibilite', 'suseptibilite'],
    requires: ['swi'],
    structure: 'brain',
  },
  {
    key: 'enfarkt',
    title: 'Enfarkt (inme) ile uyumlu olabilecek bulgular',
    about: 'Akut dönemde difüzyon kısıtlanması; eski enfarktlarda doku kaybı ve gliozis.',
    normal: 'Difüzyon kısıtlanması izlenmez.',
    words: ['enfarkt', 'infarkt', 'iskemi', 'iskemik', 'difuzyon kisitla', 'kisitlanma', 'akut', 'lakun'],
    requires: ['dwi'],
    structure: 'brain',
  },
  {
    key: 'beyin-sapi',
    title: 'Beyin sapı ve beyincik',
    about: 'Orta beyin, pons, omurilik soğanı ve beyinciğin şekli ve sinyali.',
    normal: 'Beyin sapı ve beyincik doğal görünümde.',
    words: ['beyin sapi', 'pons', 'mezensefalon', 'bulbus', 'medulla', 'serebell', 'beyincik', 'vermis', 'posterior fossa', 'arka cukur'],
    structure: 'brain',
    part: 'cerebellum',
  },
  {
    key: 'damar',
    title: 'Görüntüde değerlendirilebilen damar yapıları',
    about: 'Standart MR\'da büyük damarların "akım boşlukları"; darlık, tıkanıklık ya da anevrizma için anjiyografik görüntü gerekir.',
    words: ['damar', 'vaskuler', 'akim bosluk', 'arter', 'karotis', 'vertebral', 'baziler', 'anevrizma', 'stenoz', 'tikan', 'oklu', 'venoz', 'sinus ven'],
    requires: ['angio'],
    structure: 'carotid-arteries',
  },
  {
    key: 'kontrast',
    title: 'Kontrast tutulumu',
    about: 'Kontrast madde verildiyse bir alanın boya tutup tutmadığı (aktif plak, tümör, iltihap ayrımında kullanılır).',
    words: ['kontrast tutul', 'kontrastlanma', 'kontrast sonrasi', 'postkontrast', 'boyanma', 'tutulum', 'enhans'],
    requires: ['contrast'],
    structure: 'brain',
  },
  {
    key: 'cevre',
    title: 'Görüntüye giren çevre yapılar',
    about: 'Hipofiz ve sella, göz çukurları, sinüsler, kafa kemikleri ve orta kulak/mastoid.',
    words: ['hipofiz', 'sella', 'orbita', 'glob', 'sinus', 'paranazal', 'mastoid', 'kalvarium', 'kemik', 'kafa kemi'],
    structure: 'pituitary',
  },
  QUALITY,
];

const pick = (list: CheckItem[], key: string): CheckItem => list.find((i) => i.key === key)!;

const BRAIN_CT: CheckItem[] = [
  { ...pick(BRAIN_MR, 'parankim'), requires: undefined },
  {
    key: 'kanama',
    title: 'Kanama ile uyumlu olabilecek bulgular',
    about: 'BT kanamayı hızla gösterir: beyin içi, subdural, epidural ya da subaraknoid alanda yoğun (hiperdens) alan.',
    words: ['kanama', 'hemoraji', 'hematom', 'hiperdens', 'subdural', 'epidural', 'subaraknoid'],
    structure: 'brain',
  },
  {
    key: 'enfarkt',
    title: 'Enfarkt (inme) ile uyumlu olabilecek bulgular',
    about: 'Az yoğun (hipodens) alanlar; akut inme ilk saatlerde BT\'de görünmeyebilir, bu yüzden normal BT inmeyi dışlamaz.',
    words: ['enfarkt', 'infarkt', 'iskemi', 'iskemik', 'hipodens', 'lakun', 'ensefalomalazi'],
    structure: 'brain',
  },
  { ...pick(BRAIN_MR, 'lezyon') },
  { ...pick(BRAIN_MR, 'ventrikul') },
  { ...pick(BRAIN_MR, 'orta-hat') },
  { ...pick(BRAIN_MR, 'odem'), requires: undefined },
  { ...pick(BRAIN_MR, 'beyin-sapi') },
  {
    key: 'kemik',
    title: 'Kafa kemikleri',
    about: 'Kırık, kemikte yoğunluk değişikliği ya da kemik lezyonu (BT kemik penceresi).',
    words: ['kirik', 'fraktur', 'kalvarium', 'kemik', 'osteolitik', 'sklerotik'],
    structure: 'bones',
  },
  { ...pick(BRAIN_MR, 'cevre') },
  { ...pick(BRAIN_MR, 'kontrast'), words: ['kontrast', 'kontrastlanma', 'tutulum', 'boyanma'] },
  QUALITY,
];

const VESSELS: CheckItem[] = [
  {
    key: 'izlenebilirlik',
    title: 'Damarların izlenebilirliği',
    about: 'İncelenen arterlerin baştan sona görüntülenip görüntülenmediği; akımın sürekliliği.',
    words: ['izlen', 'akim', 'dolum', 'patent', 'acik', 'arter', 'karotis', 'vertebral', 'baziler', 'willis'],
    requires: ['angio'],
    structure: 'carotid-arteries',
  },
  {
    key: 'darlik',
    title: 'Darlık ya da tıkanıklık şüphesi',
    about: 'Damar çapının daralması (stenoz), yüzdesi ve yeri; tam tıkanıklık (oklüzyon).',
    words: ['darlik', 'stenoz', 'tikan', 'oklu', 'daralm', 'hemodinamik', 'akim hiz'],
    requires: ['angio'],
    structure: 'carotid-arteries',
  },
  {
    key: 'anevrizma',
    title: 'Anevrizma ya da damar genişlemesi şüphesi',
    about: 'Damar duvarının balon gibi dışa doğru genişlemesi; boyutu ve yeri.',
    words: ['anevrizma', 'ektazi', 'dilatasyon', 'genisle', 'infundibul'],
    requires: ['angio'],
    structure: 'carotid-arteries',
  },
  {
    key: 'plak',
    title: 'Damar duvarı ve plak',
    about: 'Duvar kalınlaşması ve aterom plağı; yalnızca uygun yöntemde (Doppler, BT anjiyo, damar duvarı MR) değerlendirilebilir.',
    words: ['plak', 'aterom', 'kalsifik', 'intima', 'duvar kalin', 'imt'],
    requires: ['angio'],
    structure: 'carotid-arteries',
  },
  {
    key: 'varyasyon',
    title: 'Anatomik varyasyonlar',
    about: 'Doğuştan gelen, genellikle zararsız dal ve seyir farklılıkları (ör. fetal tip arka serebral arter).',
    words: ['varyasyon', 'varyant', 'hipoplazi', 'fetal', 'dominant'],
    requires: ['angio'],
    structure: 'carotid-arteries',
  },
  QUALITY,
];

const HEART: CheckItem[] = [
  {
    key: 'odacik',
    title: 'Kalp odacıkları ve boyutları',
    about: 'Sağ-sol kulakçık ve karıncıkların genişliği; kalp boyutu.',
    normal: 'Odacık boyutları normal sınırlarda.',
    words: ['atri', 'kulakcik', 'ventrikul', 'karincik', 'odacik', 'kardiyomegali', 'kalp boyut', 'dilate'],
    structure: 'heart',
  },
  {
    key: 'duvar',
    title: 'Kalp kası ve duvar kalınlığı',
    about: 'Karıncık duvarlarının ve bölmenin (septum) kalınlığı, kas yapısı, skar ya da hareket bozukluğu.',
    words: ['duvar', 'septum', 'septal', 'hipertrofi', 'miyokard', 'kalinlik', 'hipokinez', 'akinez', 'skar'],
    structure: 'heart',
    part: 'septum',
  },
  {
    key: 'islev',
    title: 'Kalbin pompa işlevi',
    about: 'Ejeksiyon fraksiyonu (EF) gibi, yöntemin ölçebildiği işlev değerleri.',
    words: ['ef ', 'ejeksiyon', 'sistolik', 'diyastolik', 'fonksiyon', 'kasilma', 'relaksasyon'],
    structure: 'heart',
  },
  {
    key: 'kapak',
    title: 'Kalp kapakları',
    about: 'Mitral, aort, triküspit ve pulmoner kapakların yapısı; darlık ya da yetmezlik.',
    words: ['kapak', 'mitral', 'aort kapak', 'aortik', 'trikuspit', 'pulmoner kapak', 'yetmezlik', 'regurjitasyon', 'prolapsus'],
    structure: 'heart',
    part: 'mitral',
  },
  {
    key: 'perikard',
    title: 'Kalp zarı (perikard)',
    about: 'Kalbi saran zarda sıvı birikmesi ya da kalınlaşma.',
    words: ['perikard', 'perikardiyal', 'efuzyon', 'mayi'],
    structure: 'heart',
  },
  {
    key: 'koroner',
    title: 'Koroner damarlar',
    about: 'Kalbi besleyen damarlarda darlık ya da kireçlenme; yalnızca koroner anjiyografi veya koroner BT anjiyoda değerlendirilir.',
    words: ['koroner', 'lad', 'lcx', 'rca', 'sirkumfleks', 'kalsiyum skor'],
    requires: ['angio'],
    structure: 'heart',
  },
  QUALITY,
];

const CHEST_CT: CheckItem[] = [
  {
    key: 'akciger',
    title: 'Akciğer dokusu (parankim)',
    about: 'Her iki akciğerin havalanması, doku yapısı, amfizem ya da fibrozis.',
    normal: 'Her iki akciğer havalanması doğal.',
    words: ['akciger', 'parankim', 'havalan', 'amfizem', 'fibrozis', 'bronsiektazi', 'interstisyel'],
    structure: 'lungs',
  },
  {
    key: 'nodul',
    title: 'Nodül ya da kitle şüphesi',
    about: 'Akciğerde yuvarlak doku alanları: sayısı, boyutu (mm), yeri ve özellikleri.',
    words: ['nodul', 'mikronodul', 'kitle', 'lezyon', 'opasite'],
    structure: 'lungs',
  },
  {
    key: 'konsolidasyon',
    title: 'Konsolidasyon ve buzlu cam opasiteleri',
    about: 'Hava keseciklerinin sıvı veya hücreyle dolması (konsolidasyon) ya da hafif yoğunluk artışı (buzlu cam).',
    words: ['konsolidasyon', 'buzlu cam', 'infiltrasyon', 'pnomoni', 'atelektazi'],
    structure: 'lungs',
  },
  {
    key: 'plevra',
    title: 'Plevra (akciğer zarı)',
    about: 'Akciğer zarında sıvı (plevral efüzyon), kalınlaşma ya da hava (pnömotoraks).',
    words: ['plevra', 'plevral', 'efuzyon', 'mayi', 'pnomotoraks', 'kostofrenik'],
    structure: 'lungs',
  },
  {
    key: 'mediasten',
    title: 'Mediasten ve lenf bezleri',
    about: 'Göğüs ortasındaki yapılar: kalp, büyük damarlar, soluk borusu, yemek borusu ve lenf bezleri.',
    words: ['mediasten', 'hiler', 'hilus', 'lenf', 'lenfadenopati', 'trakea', 'ozofag', 'timus'],
    structure: 'lungs',
    part: 'hilum',
  },
  {
    key: 'damar',
    title: 'Görüntüde değerlendirilebilen damarlar',
    about: 'Aorta ve akciğer atardamarı çapları; pulmoner emboli için kontrastlı BT anjiyo gerekir.',
    words: ['aort', 'pulmoner arter', 'emboli', 'trombus', 'damar'],
    requires: ['contrast'],
    structure: 'aorta',
  },
  {
    key: 'kalp',
    title: 'Kalp ve perikard (görüntüye giren kısım)',
    about: 'Kalp boyutu, perikardda sıvı, koroner kireçlenme.',
    words: ['kalp', 'kardiyak', 'perikard', 'kardiyomegali', 'koroner'],
    structure: 'heart',
  },
  {
    key: 'kemik',
    title: 'Kemik yapılar ve göğüs duvarı',
    about: 'Kaburgalar, omurlar, göğüs kemiği; kırık ya da kemik lezyonu.',
    words: ['kemik', 'kosta', 'kaburga', 'vertebra', 'sternum', 'kirik', 'fraktur', 'litik', 'sklerotik', 'gogus duvari'],
    structure: 'bones',
  },
  { key: 'ust-batin', title: 'Görüntüye giren üst karın organları', about: 'Karaciğer, dalak, böbreküstü bezlerinin görüntüye giren kısımları.', words: ['karaciger', 'dalak', 'surrenal', 'adrenal', 'ust batin'], structure: 'liver' },
  QUALITY,
];

const CHEST_XRAY: CheckItem[] = [
  { ...pick(CHEST_CT, 'akciger'), about: 'Akciğer alanlarının havalanması; röntgen ayrıntıyı BT kadar göstermez.' },
  { ...pick(CHEST_CT, 'konsolidasyon') },
  { ...pick(CHEST_CT, 'nodul'), about: 'Belirgin yuvarlak gölge; küçük nodüller röntgende görünmeyebilir.' },
  { ...pick(CHEST_CT, 'plevra') },
  { key: 'kalp', title: 'Kalp gölgesi ve kardiyotorasik oran', about: 'Kalp genişliğinin göğüs genişliğine oranı (PA grafide yaklaşık 0,5\'in altı beklenir).', words: ['kalp', 'kardiyotorasik', 'kardiyomegali', 'kti'], structure: 'heart' },
  { key: 'mediasten', title: 'Mediasten ve hiler bölgeler', about: 'Göğüs ortası genişliği ve akciğer kökleri.', words: ['mediasten', 'hiler', 'hilus', 'trakea'], structure: 'lungs', part: 'hilum' },
  { key: 'diyafram', title: 'Diyafram ve kostofrenik açılar', about: 'Diyafram kubbelerinin yeri ve sinüslerin açıklığı.', words: ['diyafram', 'kostofrenik', 'sinus'], structure: 'diaphragm' },
  { ...pick(CHEST_CT, 'kemik') },
  QUALITY,
];

const SPINE: CheckItem[] = [
  {
    key: 'dizilim',
    title: 'Omurga dizilimi (hizalanma)',
    about: 'Boyun ve bel çukurluğu (lordoz), sırt kamburluğu (kifoz), yana eğrilik (skolyoz), omur kayması (listezis).',
    normal: 'Fizyolojik eğrilikler korunmuş, kayma yok.',
    words: ['lordoz', 'kifoz', 'skolyoz', 'dizilim', 'hizalan', 'listezis', 'kayma', 'duzles', 'egrilik'],
    structure: 'spinal-cord',
  },
  {
    key: 'korpus',
    title: 'Omur gövdeleri',
    about: 'Omur yükseklikleri, kemik iliği sinyali, çökme (kompresyon), kireçlenme çıkıntıları (osteofit), hemanjiyom.',
    words: ['korpus', 'vertebra', 'omur', 'osteofit', 'kompresyon', 'cokme', 'hemanjiyom', 'kemik iligi', 'modic', 'end plate', 'uc plak'],
    structure: 'spinal-cord',
  },
  {
    key: 'disk',
    title: 'Diskler',
    about: 'Omurlar arası disklerin yüksekliği ve su içeriği (dejenerasyon, "disk yorgunluğu").',
    normal: 'Disk yükseklikleri ve sinyalleri korunmuş.',
    words: ['disk', 'dejenerasyon', 'dehidrat', 'desikasyon', 'intervertebral'],
    structure: 'spinal-cord',
  },
  {
    key: 'fitik',
    title: 'Fıtıklaşma (protrüzyon, ekstrüzyon)',
    about: 'Diskin taşması: seviyesi, yönü (santral, paramedyan, foraminal) ve büyüklüğü.',
    words: ['herni', 'fitik', 'protruzyon', 'bulging', 'bombeles', 'ekstruzyon', 'sekestr'],
    structure: 'spinal-cord',
  },
  {
    key: 'kanal',
    title: 'Spinal kanal ve nöral foramenler',
    about: 'Omurilik kanalının ve sinir çıkış deliklerinin genişliği; daralma (stenoz).',
    words: ['spinal kanal', 'kanal', 'foramen', 'foraminal', 'stenoz', 'daralma', 'darlik', 'lateral resess'],
    structure: 'spinal-cord',
  },
  {
    key: 'kok',
    title: 'Sinir kökleri ve bası şüphesi',
    about: 'Taşan disk ya da kemik çıkıntısının sinir köküne ya da tekal keseye dokunması / basması.',
    words: ['kok', 'sinir kok', 'basi', 'tekal kese', 'dural kese', 'temas', 'itilme'],
    structure: 'spinal-cord',
  },
  {
    key: 'omurilik',
    title: 'Omurilik (konus dahil)',
    about: 'Omuriliğin kalınlığı ve sinyali, konus medullarisin seviyesi; omurilik ayrıntısı en iyi MR\'da görülür.',
    normal: 'Omurilik kalınlığı ve sinyali doğal.',
    words: ['omurilik', 'medulla spinalis', 'myelopati', 'konus', 'siringo', 'kord'],
    requires: ['mr'],
    structure: 'spinal-cord',
  },
  {
    key: 'faset',
    title: 'Faset eklemler ve bağlar',
    about: 'Omurlar arası küçük eklemlerde kireçlenme, sarı bağ (ligamentum flavum) kalınlaşması.',
    words: ['faset', 'ligamentum flavum', 'flavum', 'hipertrofi', 'artroz', 'ligament'],
    structure: 'spinal-cord',
  },
  { key: 'paravertebral', title: 'Omurga çevresi yumuşak dokular', about: 'Omurga yanındaki kaslar ve görüntüye giren organlar.', words: ['paravertebral', 'paraspinal', 'yumusak doku', 'psoas'], structure: 'spinal-cord' },
  QUALITY,
];

const ABDOMEN: CheckItem[] = [
  { key: 'karaciger', title: 'Karaciğer', about: 'Boyut, doku yapısı (ekojenite/yoğunluk), yağlanma, kitle ya da kist.', normal: 'Karaciğer boyutu ve parankimi doğal.', words: ['karaciger', 'hepat', 'steatoz', 'yaglanma'], structure: 'liver' },
  { key: 'safra', title: 'Safra kesesi ve safra yolları', about: 'Taş, çamur, duvar kalınlığı; safra yollarında genişleme.', words: ['safra', 'kolelitiazis', 'koledok', 'intrahepatik'], structure: 'gallbladder' },
  { key: 'pankreas', title: 'Pankreas', about: 'Boyut, doku yapısı, kanal genişliği; bağırsak gazı nedeniyle ultrasonda kısmen görülebilir.', words: ['pankreas', 'wirsung'], structure: 'pancreas' },
  { key: 'dalak', title: 'Dalak', about: 'Boyut (uzun eksen) ve doku yapısı.', normal: 'Dalak boyutu normal (yetişkinde uzun eksen yaklaşık 12–13 cm\'ye kadar).', words: ['dalak', 'splen'], structure: 'spleen' },
  { key: 'bobrek', title: 'Böbrekler', about: 'Boyut, doku (parankim) kalınlığı, taş, toplayıcı sistemde genişleme (hidronefroz), kist.', words: ['bobrek', 'renal', 'hidronefroz', 'pelvikaliksiyel', 'tas', 'kalikul'], structure: 'kidneys' },
  { key: 'mesane', title: 'Mesane ve pelvik organlar', about: 'Mesane duvarı ve içeriği; görüntüye giriyorsa rahim, yumurtalıklar ya da prostat.', words: ['mesane', 'prostat', 'uterus', 'over', 'douglas'], structure: 'urinary-tract' },
  { key: 'damar', title: 'Karın aortu ve büyük damarlar', about: 'Aort çapı (anevrizma), toplardamarlar.', words: ['aort', 'vena kava', 'portal ven', 'anevrizma'], structure: 'aorta' },
  { key: 'sivi', title: 'Serbest sıvı ve lenf bezleri', about: 'Karın içinde serbest sıvı (asit) ya da büyümüş lenf bezi.', words: ['serbest sivi', 'asit', 'mayi', 'lenf', 'lenfadenopati'], structure: 'liver' },
  { key: 'bagirsak', title: 'Mide ve bağırsaklar (görülebildiği kadarıyla)', about: 'Duvar kalınlaşması, genişleme; bağırsak ayrıntısı için genellikle BT ya da endoskopi gerekir.', words: ['barsak', 'bagirsak', 'kolon', 'mide', 'ileus', 'apendiks'], structure: 'large-intestine' },
  QUALITY,
];

const KNEE: CheckItem[] = [
  { key: 'menisk', title: 'Menisküsler', about: 'İç (medial) ve dış (lateral) menisküste yırtık, dejenerasyon.', words: ['menisk'], structure: 'knee', part: 'meniscus' },
  { key: 'capraz', title: 'Çapraz bağlar', about: 'Ön ve arka çapraz bağda yırtık ya da ödem.', words: ['capraz bag', 'on capraz', 'arka capraz', 'acl', 'pcl'], structure: 'knee', part: 'acl' },
  { key: 'yan-bag', title: 'Yan bağlar', about: 'İç ve dış yan bağlar.', words: ['yan bag', 'kollateral', 'mcl', 'lcl'], structure: 'knee' },
  { key: 'kikirdak', title: 'Eklem kıkırdağı', about: 'Kıkırdak incelmesi, defekt (kondromalazi).', words: ['kikirdak', 'kondral', 'kondromalazi', 'osteokondral'], structure: 'knee' },
  { key: 'kemik-iligi', title: 'Kemik iliği ödemi ve kemikler', about: 'Kemik içi ödem, çatlak, kontüzyon.', words: ['kemik iligi', 'odem', 'kontuzyon', 'fraktur', 'kirik'], structure: 'knee' },
  { key: 'efuzyon', title: 'Eklem sıvısı ve Baker kisti', about: 'Eklemde fazla sıvı; diz arkasında kist.', words: ['efuzyon', 'mayi', 'sivi', 'baker'], structure: 'knee' },
  { key: 'tendon', title: 'Tendonlar ve diz kapağı', about: 'Diz kapağı (patella) ve tendonları.', words: ['patella', 'tendon', 'kuadriseps'], structure: 'knee' },
  QUALITY,
];

const SHOULDER: CheckItem[] = [
  { key: 'rotator', title: 'Rotator manşet tendonları', about: 'Supraspinatus, infraspinatus, subskapularis, teres minör: tendinozis ya da yırtık.', words: ['rotator', 'supraspinat', 'infraspinat', 'subskapular', 'teres', 'tendinoz', 'tendinit', 'yirtik'], structure: 'bones' },
  { key: 'labrum', title: 'Labrum ve eklem kapsülü', about: 'Omuz yuvasını çevreleyen kıkırdak halka.', words: ['labrum', 'labral', 'kapsul', 'slap', 'bankart'], structure: 'bones' },
  { key: 'bursa', title: 'Bursa ve eklem sıvısı', about: 'Subakromiyal bursit, eklem sıvısı.', words: ['bursa', 'bursit', 'efuzyon', 'mayi'], structure: 'bones' },
  { key: 'akromiyon', title: 'Akromiyoklaviküler eklem ve sıkışma', about: 'Akromiyon şekli, AC eklemde kireçlenme, sıkışma (impingement).', words: ['akromiyon', 'akromiyoklavikuler', 'impingement', 'sikisma'], structure: 'bones' },
  { key: 'kemik', title: 'Kemik yapılar', about: 'Kemik iliği ödemi, kırık, kist.', words: ['kemik', 'humerus', 'odem', 'kirik', 'kist'], structure: 'bones' },
  QUALITY,
];

const THYROID: CheckItem[] = [
  { key: 'boyut', title: 'Tiroid bezi boyutu ve doku yapısı', about: 'Lob boyutları, ekojenite, tiroidit ile uyumlu yapı.', words: ['tiroid', 'lob', 'istmus', 'parankim', 'ekojenite', 'tiroidit', 'heterojen'], structure: 'thyroid' },
  { key: 'nodul', title: 'Nodüller', about: 'Sayısı, boyutu ve özellikleri (TI-RADS gibi sınıflamalar).', words: ['nodul', 'kist', 'tirads', 'ti rads', 'kalsifikasyon'], structure: 'thyroid' },
  { key: 'kanlanma', title: 'Kanlanma (Doppler)', about: 'Bezde ya da nodülde kan akımı.', words: ['vaskularite', 'kanlanma', 'doppler'], requires: ['doppler'], structure: 'thyroid' },
  { key: 'lenf', title: 'Boyun lenf bezleri', about: 'Büyümüş ya da yapısı değişmiş lenf bezleri.', words: ['lenf', 'lenfadenopati'], structure: 'thyroid' },
  QUALITY,
];

const BREAST: CheckItem[] = [
  { key: 'yogunluk', title: 'Meme dokusu yoğunluğu', about: 'Yağlı-dens doku oranı (A–D); yoğun dokuda küçük lezyonlar gizlenebilir.', words: ['yogunluk', 'dens', 'fibroglanduler', 'parankim', 'kompozisyon'], structure: 'breasts' },
  { key: 'kitle', title: 'Kitle ya da nodül', about: 'Yeri (saat kadranı), boyutu, sınırları.', words: ['kitle', 'nodul', 'lezyon', 'kist', 'fibroadenom'], structure: 'breasts' },
  { key: 'kalsifikasyon', title: 'Kalsifikasyonlar', about: 'Kireçlenmelerin şekli ve dağılımı.', words: ['kalsifik', 'mikrokalsifik'], structure: 'breasts' },
  { key: 'asimetri', title: 'Asimetri ve yapı bozukluğu', about: 'İki meme arasındaki farklılık, doku çekintisi (distorsiyon).', words: ['asimetri', 'distorsiyon'], structure: 'breasts' },
  { key: 'koltuk', title: 'Koltuk altı lenf bezleri', about: 'Aksiller lenf bezleri.', words: ['aksiller', 'aksilla', 'lenf'], structure: 'breasts' },
  { key: 'birads', title: 'BI-RADS kategorisi', about: 'Raporun özet sınıflaması ve önerilen takip.', words: ['bi rads', 'birads'], structure: 'breasts' },
  QUALITY,
];

const PROSTATE: CheckItem[] = [
  { key: 'boyut', title: 'Prostat hacmi', about: 'Bezin boyutu ve hacmi (büyüme).', words: ['hacim', 'volum', 'boyut', 'hipertrofi', 'bph'], structure: 'prostate' },
  { key: 'zon', title: 'Periferik ve transizyonel zon', about: 'Bölgelerde sinyal değişikliği ve odaklar.', words: ['periferik zon', 'transizyonel', 'zon', 'odak', 'lezyon'], structure: 'prostate' },
  { key: 'pirads', title: 'PI-RADS kategorisi', about: 'Odakların şüphe düzeyi sınıflaması.', words: ['pi rads', 'pirads'], structure: 'prostate' },
  { key: 'kapsul', title: 'Kapsül ve çevre yapılar', about: 'Kapsül bütünlüğü, seminal veziküller, lenf bezleri.', words: ['kapsul', 'seminal', 'lenf', 'ekstraprostatik'], structure: 'prostate' },
  QUALITY,
];

const EKG: CheckItem[] = [
  { key: 'ritim', title: 'Ritim', about: 'Kalbin doğal ritim merkezinden (sinüs) mi yönetildiği; düzensiz ritimler.', words: ['ritim', 'sinus', 'fibrilasyon', 'flutter', 'aritmi', 'ekstrasistol'], structure: 'heart' },
  { key: 'hiz', title: 'Kalp hızı', about: 'Dakikadaki atım sayısı; hızlı (taşikardi) ya da yavaş (bradikardi).', words: ['kalp hizi', 'hiz', 'tasikardi', 'bradikardi', 'dk'], structure: 'heart' },
  { key: 'aks', title: 'Elektriksel aks', about: 'Kalbin elektrik akımının genel yönü.', words: ['aks ', 'aksi ', 'deviasyon'], structure: 'heart' },
  { key: 'iletim', title: 'İletim aralıkları (PR, QRS, QT)', about: 'Uyarının kalpte yayılma süreleri; bloklar.', words: ['pr ', 'pr araligi', 'pr suresi', 'qrs', 'qt', 'blok', 'blog', 'iletim'], structure: 'heart' },
  { key: 'st-t', title: 'ST segmenti ve T dalgaları', about: 'Toparlanma evresindeki değişiklikler.', words: ['st ', 'st segment', 't dalga', 'repolarizasyon', 'depresyon', 'elevasyon'], structure: 'heart' },
  { key: 'hipertrofi', title: 'Odacık büyümesi bulguları', about: 'EKG\'de karıncık ya da kulakçık büyümesini düşündüren voltaj değişiklikleri.', words: ['hipertrofi', 'voltaj', 'buyume'], structure: 'heart' },
];

const PFT: CheckItem[] = [
  { key: 'fvc', title: 'Akciğer kapasitesi (FVC)', about: 'Derin nefesten sonra verilebilen toplam hava.', words: ['fvc', 'vital kapasite'], structure: 'lungs' },
  { key: 'fev1', title: 'Hava yolu akımı (FEV1, FEV1/FVC)', about: 'İlk saniyede verilen hava ve oranı; hava yolu daralması (obstrüksiyon) için.', words: ['fev1', 'obstruk', 'obstrukti'], structure: 'lungs' },
  { key: 'restriksiyon', title: 'Kısıtlayıcı (restriktif) patern', about: 'Akciğer hacimlerinin azalması.', words: ['restrikti', 'restriksiyon', 'tlc', 'hacim'], structure: 'lungs' },
  { key: 'reversibilite', title: 'Bronkodilatör yanıtı', about: 'Açıcı ilaç sonrası düzelme.', words: ['bronkodilator', 'reversib', 'geri donus'], structure: 'lungs' },
  { key: 'difuzyon', title: 'Difüzyon kapasitesi (DLCO)', about: 'Gazın kana geçme yeteneği.', words: ['dlco', 'difuzyon'], structure: 'lungs' },
];

const DEXA: CheckItem[] = [
  { key: 'bel', title: 'Bel omurları (L1–L4)', about: 'Bel omurlarında kemik yoğunluğu, T ve Z skoru.', words: ['lomber', 'l1', 'l2', 'l3', 'l4', 'vertebra'], structure: 'spinal-cord', part: 'lumbar' },
  { key: 'kalca', title: 'Kalça ve femur boynu', about: 'Uyluk kemiği boynu ve kalçada kemik yoğunluğu.', words: ['femur', 'kalca', 'boyun', 'total hip', 'trokanter'], structure: 'bones' },
  { key: 'skor', title: 'T skoru / Z skoru sınıflaması', about: 'Normal, osteopeni ya da osteoporoz sınıflaması (hekimle değerlendirilir).', words: ['t skor', 'z skor', 'osteopeni', 'osteoporoz', 'normal'], structure: 'bones' },
  { key: 'onkol', title: 'Ön kol (varsa)', about: 'Bazı durumlarda ön kol ölçümü eklenir.', words: ['onkol', 'radius'], structure: 'bones' },
];

const ENDOSCOPY: CheckItem[] = [
  { key: 'ozofagus', title: 'Yemek borusu (özofagus)', about: 'Mukoza, özofajit, varis, Z çizgisi (Barrett için).', words: ['ozofag', 'z cizgi', 'varis', 'barrett', 'hiatal'], structure: 'esophagus' },
  { key: 'mide', title: 'Mide', about: 'Mukoza, gastrit, ülser, erozyon, polip.', words: ['mide', 'antrum', 'antral', 'korpus', 'fundus', 'gastrit', 'ulser'], structure: 'stomach' },
  { key: 'duodenum', title: 'Onikiparmak bağırsağı', about: 'Bulbus ve ikinci kıta.', words: ['duoden', 'bulbus'], structure: 'small-intestine', part: 'duodenum' },
  { key: 'kolon', title: 'Kalın bağırsak (kolonoskopide)', about: 'Polip, divertikül, iltihap, hemoroid.', words: ['kolon', 'rektum', 'sigmoid', 'cekum', 'divertikul', 'hemoroid', 'polip', 'ileum'], structure: 'large-intestine' },
  { key: 'biyopsi', title: 'Alınan biyopsiler', about: 'Nereden parça alındığı; sonucu patoloji raporunda yazar.', words: ['biyopsi', 'parca', 'ornek'], structure: 'stomach' },
  QUALITY,
];

const PATHOLOGY: CheckItem[] = [
  { key: 'ornek', title: 'Örneğin yeri ve türü', about: 'Hangi organdan, nasıl (biyopsi, eksizyon) alındığı.', words: ['makroskop', 'ornek', 'parca', 'doku', 'biyopsi'] },
  { key: 'tani', title: 'Patolojik tanı', about: 'Raporun ana sonucu; anlamını hekiminle konuş.', words: ['tani', 'sonuc', 'benign', 'malign', 'karsinom', 'adenom', 'gastrit', 'kolit'] },
  { key: 'derece', title: 'Derece ve özellikler', about: 'Displazi derecesi, tümör derecesi (grade), yayılım bulguları.', words: ['displazi', 'grade', 'derece', 'invazyon', 'metaplazi'] },
  { key: 'sinir', title: 'Cerrahi sınırlar', about: 'Çıkarılan dokunun kenarlarında hastalıklı hücre olup olmadığı.', words: ['sinir', 'cerrahi sinir', 'marj'] },
  { key: 'ek', title: 'Ek boyamalar', about: 'İmmünohistokimya, H. pylori gibi ek incelemeler.', words: ['immunohistokimya', 'boyama', 'pylori', 'ki67', 'ki 67'] },
];

const GENERIC: CheckItem[] = [
  { key: 'genel', title: 'İncelenen bölgenin genel görünümü', about: 'Organların şekli, boyutu ve yapısı.', words: ['parankim', 'boyut', 'dogal', 'normal', 'olagan'] },
  { key: 'lezyon', title: 'Lezyon, kitle ya da kist', about: 'Varsa yeri, sayısı ve boyutu.', words: ['lezyon', 'kitle', 'kist', 'nodul', 'odak'] },
  { key: 'sivi', title: 'Sıvı, ödem ya da iltihap bulgusu', about: 'Doku ya da boşluklarda sıvı artışı.', words: ['sivi', 'mayi', 'efuzyon', 'odem', 'inflamasyon'] },
  { key: 'kemik', title: 'Kemik yapılar', about: 'Görüntüye giren kemiklerde kırık ya da değişiklik.', words: ['kemik', 'kirik', 'fraktur', 'osteofit', 'dejeneratif'], structure: 'bones' },
  { key: 'damar', title: 'Damarlar', about: 'Görüntüye giren damarlar.', words: ['damar', 'arter', 'ven', 'aort'] },
  QUALITY,
];

const HEAD_REGIONS = new Set(['beyin', 'hipofiz', 'goz', 'kulak', 'sinus']);
const SPINE_REGIONS = new Set(['servikal', 'torakal', 'lomber', 'omurga']);
const ABDOMEN_REGIONS = new Set(['batin', 'karaciger', 'bobrek', 'pelvis', 'rahim']);

const ANGIO_TEXT = /\b(mr anjiyo|mr anjiyografi|mra|tof|bt anjiyo|bt anjiyografi|bta|cta|anjiyografi|anjiografi|dsa|doppler)\b/;

/**
 * Belge türü, bölge ve (varsa) rapor/seri adlarından uygun şema. Uygun özel şema yoksa genel şema
 * döner; bu da başlıkta belirtilir.
 */
export function protocolFor(category: DocCategory, region: string | undefined, text = ''): Protocol {
  const t = ` ${normalizeText(text)} `;
  const angio = category === 'angio' || ANGIO_TEXT.test(t);
  if (category === 'ekg') return { key: 'ekg', title: 'EKG değerlendirmesi', items: EKG };
  if (category === 'pft') return { key: 'pft', title: 'Solunum fonksiyon testi değerlendirmesi', items: PFT };
  if (category === 'dexa') return { key: 'dexa', title: 'Kemik yoğunluğu (DEXA) değerlendirmesi', items: DEXA };
  if (category === 'endoscopy') return { key: 'endoscopy', title: 'Endoskopi / kolonoskopi değerlendirmesi', items: ENDOSCOPY };
  if (category === 'pathology') return { key: 'pathology', title: 'Patoloji raporu değerlendirmesi', items: PATHOLOGY };
  if (category === 'mammo' || region === 'meme') return { key: 'breast', title: 'Meme görüntülemesi değerlendirmesi', items: BREAST };
  if ((region === 'beyin' || region === 'boyun' || region === 'damar') && angio) return { key: 'vessels', title: 'Beyin ve boyun damarları değerlendirmesi', items: VESSELS };
  if (region && HEAD_REGIONS.has(region)) {
    if (category === 'ct') return { key: 'brain-ct', title: 'Beyin BT sistematik değerlendirmesi', items: BRAIN_CT };
    return { key: 'brain-mr', title: 'Beyin MR sistematik değerlendirmesi', items: BRAIN_MR };
  }
  if (region === 'kalp' || (category === 'angio' && /\bkoroner\b/.test(t))) return { key: 'heart', title: 'Kalp görüntülemesi değerlendirmesi', items: HEART };
  if (region === 'toraks') {
    if (category === 'xray') return { key: 'chest-xray', title: 'Akciğer grafisi sistematik değerlendirmesi', items: CHEST_XRAY };
    return { key: 'chest-ct', title: 'Göğüs / akciğer BT sistematik değerlendirmesi', items: CHEST_CT };
  }
  if (region && SPINE_REGIONS.has(region)) return { key: 'spine', title: 'Omurga sistematik değerlendirmesi', items: SPINE };
  if (region && ABDOMEN_REGIONS.has(region)) return { key: 'abdomen', title: 'Karın (batın) sistematik değerlendirmesi', items: ABDOMEN };
  if (region === 'diz') return { key: 'knee', title: 'Diz sistematik değerlendirmesi', items: KNEE };
  if (region === 'omuz') return { key: 'shoulder', title: 'Omuz sistematik değerlendirmesi', items: SHOULDER };
  if (region === 'tiroid') return { key: 'thyroid', title: 'Tiroid ultrasonu değerlendirmesi', items: THYROID };
  if (region === 'prostat') return { key: 'prostate', title: 'Prostat MR değerlendirmesi', items: PROSTATE };
  if (region === 'damar' || angio) return { key: 'vessels', title: 'Damar görüntülemesi değerlendirmesi', items: VESSELS };
  return { key: 'generic', title: 'Genel değerlendirme (bu bölge için özel şema yok)', items: GENERIC };
}

// ---------------------------------------------------------------------------------------------
// Teknik: sekanslar ve kalite

export interface Technique {
  /** Rapor ya da seri adlarında görülen sekans/yöntemler. */
  seen: Set<Requirement>;
  /** Kontrastsız olduğu açıkça yazıyor mu? */
  noContrast: boolean;
  /** Teknik hakkında hiç bilgi var mı (yoksa "sekans eksik" çıkarımı yapılmaz). */
  known: boolean;
  /** Raporda kaliteyi sınırlayan bir ifade (ör. "hareket artefaktı"). */
  quality?: string;
  labels: string[];
}

const SEQ: Array<[Requirement | 'other', RegExp, string]> = [
  ['t2flair', /\b(t2|t2a|t2w|flair|stir|t2 agirlikli)\b/, 'T2/FLAIR'],
  ['other', /\b(t1|t1a|t1w|t1 agirlikli)\b/, 'T1'],
  ['dwi', /\b(difuzyon|dwi|adc|dw)\b/, 'Difüzyon'],
  ['swi', /\b(swi|swan|gre|gradient eko|suseptibilite|susseptibilite)\b/, 'SWI/GRE'],
  ['contrast', /\b(kontrastli|kontrast madde|kontrast sonrasi|postkontrast|gadolin\w*|iv kontrast|kontrast verildi)/, 'Kontrastlı'],
  ['angio', /\b(tof|mra|mrv|anjiyo\w*|anjio\w*|bta|cta|dsa)\b/, 'Anjiyografik'],
  ['doppler', /\bdoppler\b/, 'Doppler'],
  ['thin', /\b(ince kesit|hrct|yrbt|1 mm)\b/, 'İnce kesit'],
];

const QUALITY_TEXT = /[^.\n]*(hareket artefakt|artefakt|artifakt|sinirli degerlendir|degerlendirme sinirli|suboptimal|kalitesi dusuk|teknik olarak yetersiz|yetersiz inceleme)[^.\n]*/;

/** Rapor metni ve seri adlarından çekim tekniği. Kaynaklar yalnızca sözcüklere göre okunur. */
export function techniqueOf(category: DocCategory, sources: string[]): Technique {
  const hay = ` ${normalizeText(sources.filter(Boolean).join(' \n '))} `;
  const seen = new Set<Requirement>();
  const labels: string[] = [];
  for (const [req, re, label] of SEQ) {
    if (re.test(hay)) {
      if (req !== 'other') seen.add(req);
      labels.push(label);
    }
  }
  const noContrast = /\bkontrastsiz\b|kontrast (madde )?verilmedi|kontrast uygulanmadi/.test(hay);
  if (noContrast) {
    seen.delete('contrast');
    const i = labels.indexOf('Kontrastlı');
    if (i >= 0) labels.splice(i, 1);
    labels.push('Kontrastsız');
  }
  if (category === 'mr') seen.add('mr');
  // Özgün (normalize edilmemiş) cümleyi göstermek için kaynaklarda aranır
  let quality: string | undefined;
  for (const s of sources) {
    for (const sentence of s.split(/(?<=[.;\n])/)) {
      if (QUALITY_TEXT.test(normalizeText(sentence))) {
        quality = sentence.trim();
        break;
      }
    }
    if (quality) break;
  }
  return { seen, noContrast, known: labels.length > 0 || category === 'ct' || category === 'us' || category === 'xray', quality, labels };
}

function satisfied(req: Requirement, tech: Technique, category: DocCategory): boolean {
  if (req === 'mr') return category === 'mr';
  if (req === 'angio') return tech.seen.has('angio') || category === 'angio' || (category === 'us' && tech.seen.has('doppler'));
  if (req === 'doppler') return tech.seen.has('doppler');
  if (req === 't2flair' && category !== 'mr') return true; // yalnızca MR için anlamlı
  if ((req === 'dwi' || req === 'swi') && category !== 'mr') return false;
  return tech.seen.has(req);
}

// ---------------------------------------------------------------------------------------------
// Durum

export type CheckStatus =
  /** Raporda bu başlıkla ilgili cümle var. */
  | 'report'
  /** Raporda ayrıca yazılmamış; ama genel bir "patolojik bulgu yok / olağan" ifadesi var. */
  | 'report-general'
  /** Görüntüden basit sağ-sol karşılaştırması yapıldı. */
  | 'image'
  | 'quality'
  | 'no-sequence'
  /** Görüntü var, rapor yok: otomatik analiz yapılamıyor. */
  | 'expert'
  | 'not-evaluated';

export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  report: 'Rapor metninden çıkarıldı',
  'report-general': 'Raporda genel ifade',
  image: 'Görüntüden değerlendirildi (basit)',
  quality: 'Görüntü kalitesi yetersiz',
  'no-sequence': 'Uygun sekans / görüntü eksik',
  expert: 'Uzman değerlendirmesi gerekli',
  'not-evaluated': 'Değerlendirilemedi',
};

export interface ImageEvidence {
  /** Sağ-sol karşılaştırması yapılabilen kesit sayısı. */
  compared: number;
  /** Belirgin fark bulunan kesit sayısı. */
  flagged: number;
}

export interface CheckResult {
  item: CheckItem;
  status: CheckStatus;
  /** Rapordan: en dikkat çekici ifadenin tonu. */
  tone?: FindingStatus;
  /** Bu başlığa bağlanan rapor cümleleri. */
  evidence: ImagingFinding[];
  /** Kullanıcıya gösterilecek kısa açıklama (neden bu durum). */
  note: string;
}

const RANK: Record<FindingStatus, number> = { abnormal: 2, uncertain: 1, normal: 0 };
const GENERAL_NORMAL = /(patolojik (bir )?(bulgu|ozellik) (saptanmadi|izlenmedi|gorulmedi)|olagan sinirlarda|normal sinirlarda|ozellik (arz etmemektedir|gostermemektedir)|dogal olarak izlendi|dogal gorunumde|normal (bulgular|inceleme)|olagandir)/;

const matches = (item: CheckItem, f: ImagingFinding) => {
  const hay = ` ${normalizeText(f.text)} `;
  return item.words.some((w) => hay.includes(` ${w}`));
};

/**
 * Şemadaki her başlığın durumu. `findings`: rapordan çıkarılan cümleler (yoksa boş), `image`: görüntüden
 * yapılan basit karşılaştırmanın özeti (yapılmadıysa undefined), `hasImage`: görüntü dosyası var mı.
 */
export function evaluate(
  protocol: Protocol,
  opts: { category: DocCategory; findings: ImagingFinding[]; hasReport: boolean; hasImage: boolean; technique: Technique; image?: ImageEvidence },
): CheckResult[] {
  const { category, findings, hasReport, hasImage, technique, image } = opts;
  const general = findings.find((f) => f.status === 'normal' && f.located !== 'text' && GENERAL_NORMAL.test(normalizeText(f.text)));
  return protocol.items.map((item): CheckResult => {
    const evidence = findings.filter((f) => matches(item, f));
    if (item.key === 'kalite') {
      if (technique.quality) return { item, status: 'quality', evidence, note: `Raporda: “${technique.quality}”` };
      if (hasReport) return { item, status: 'report-general', evidence, note: 'Raporda kaliteyi sınırlayan bir ifade bulunamadı (bu, kalitenin iyi olduğunu kesinleştirmez).' };
    }
    if (evidence.length) {
      const tone = evidence.reduce<FindingStatus>((a, f) => (RANK[f.status] > RANK[a] ? f.status : a), 'normal');
      return {
        item,
        status: 'report',
        tone,
        evidence,
        note: tone === 'normal' ? 'Raporda bu başlıkla ilgili olağan ifade var.' : tone === 'abnormal' ? 'Raporda bu başlıkla ilgili dikkat çeken ifade var.' : 'Raporda bu başlıkla ilgili belirsiz / olasılık bildiren ifade var.',
      };
    }
    // Teknik bilgisi yoksa yalnızca yöntemden kesin çıkan eksikler (ör. BT'de difüzyon, omurilik için MR) söylenir.
    const missing = (item.requires ?? []).filter((r) => !satisfied(r, technique, category));
    const certain = missing.filter((r) => r === 'mr' || ((r === 'dwi' || r === 'swi') && category !== 'mr'));
    const shown = technique.known ? missing : certain;
    if (shown.length)
      return {
        item,
        status: 'no-sequence',
        evidence,
        note: `Bu başlık için genellikle ${shown.map((r) => REQ_LABEL[r]).join(' ve ')} gerekir; ${shown.every((r) => certain.includes(r)) ? 'bu inceleme yönteminde yok' : 'raporda ve seri adlarında görünmüyor'}. Değerlendirilmediği için “yok” denemez.`,
      };
    if (item.symmetry && image && image.compared > 0) {
      return {
        item,
        status: 'image',
        evidence,
        note:
          image.flagged > 0
            ? `Görüntüde ${image.compared} kesitte basit sağ-sol karşılaştırması yapıldı; ${image.flagged} kesitte belirgin fark işaretlendi. Bu yalnızca parlaklık farkıdır, kitle etkisi ya da orta hat kayması ölçümü değildir.`
            : `Görüntüde ${image.compared} kesitte basit sağ-sol karşılaştırması yapıldı; belirgin fark işaretlenmedi. Bu yalnızca parlaklık karşılaştırmasıdır; orta hat kaymasını ölçmez ve kesin değildir.`,
      };
    }
    if (technique.quality && hasReport) return { item, status: 'quality', evidence, note: `Raporda kaliteyi sınırlayan ifade var (“${technique.quality}”); bu başlık ayrıca yazılmamış.` };
    if (general)
      return {
        item,
        status: 'report-general',
        evidence: [general],
        note: 'Bu başlık raporda ayrıca yazılmamış; raporun genel “olağan / patolojik bulgu yok” ifadesi kapsıyor olabilir. Emin olmak için raporu yazan hekime sorulabilir.',
      };
    if (!hasReport && hasImage)
      return {
        item,
        status: 'expert',
        evidence,
        note: 'Rapor metni yok. Bu başlık görüntüden otomatik değerlendirilemiyor; görüntüyü bir radyoloğun değerlendirmesi gerekir.',
      };
    return {
      item,
      status: 'not-evaluated',
      evidence,
      note: hasReport ? 'Raporda bu başlıkla ilgili bir ifade bulunamadı. Bu, bulgu olmadığı anlamına gelmez.' : 'Rapor ya da değerlendirilebilir görüntü yok.',
    };
  });
}
