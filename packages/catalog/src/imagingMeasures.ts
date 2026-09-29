/**
 * Görüntüleme ölçümleri kataloğu: MR, BT, röntgen, ultrason, ekokardiyografi ve kemik yoğunluğu
 * raporlarında sık geçen, genel yetişkin referans değeri olan ölçümler.
 *
 * İlkeler (tahlil kataloğuyla aynı):
 * - Değerler yaklaşık, genel yetişkin referanslarıdır; yaşa, cinsiyete, vücut ölçüsüne, cihaza ve
 *   ölçüm tekniğine göre değişir. Arayüzde "genel referans" diye etiketlenir.
 * - Referans dışı bir ölçüm tanı değildir; referans içinde olması da hastalık olmadığını göstermez.
 *   Görüntünün kendisi (şekil, yapı, sinyal) sayıyla ifade edilemeyen bilgiler içerir.
 * - "Olası nedenler" genel bilgidir; kişiye özel değerlendirme hekime aittir.
 * - Kaynak yaklaşımı: radyoloji ve ekokardiyografi ders kitaplarında ve derneklerin
 *   kılavuzlarında (ör. ASE, WHO kemik yoğunluğu sınıflaması, Fleischner) geçen yaygın eşikler.
 *   Yayından önce bir hekimin gözden geçirmesi önerilir.
 */
import type { RangeDef } from './tests';
import { type RangeValue, type ResultStatus, type Sex, formatNumber, rangeText, statusFor } from './evaluate';

export type MeasureUnit = 'mm' | 'ml' | 'hu' | 'ratio' | 'percent' | 'mmhg' | 'score';

export const MEASURE_UNIT_LABEL: Record<MeasureUnit, string> = {
  mm: 'mm',
  ml: 'ml',
  hu: 'HU',
  ratio: '',
  percent: '%',
  mmhg: 'mmHg',
  score: '',
};

export type ImagingModalityKey = 'mr' | 'ct' | 'xray' | 'us' | 'other';

export interface MeasureGrade {
  /** Bu değere kadar (dahil) bu derece geçerli; son derecede tanımsız. */
  upTo?: number;
  label: string;
}

export interface ImagingMeasureDef {
  key: string;
  nameTr: string;
  /** Kısa ad (rozet, bulut). */
  short: string;
  /** Rapor metninde aranan ifadeler: küçük harf, Türkçe karakterler katlanmış (ş→s, ı→i…). */
  aliases: string[];
  unit: MeasureUnit;
  decimals: number;
  ranges: RangeDef[];
  /** Fizyolojik olarak mümkün aralık; dışındaki sayılar bu ölçüm sayılmaz (ör. karaciğerdeki 12 mm kist). */
  plausible: [number, number];
  /** Birden çok boyut verilirse: 'max' en büyüğü; 'volume' elipsoid hacmi (0,52 × a × b × c). */
  dims?: 'max' | 'volume';
  /** Sayı ifadeden önce yazılır ("8 mm nodül"). */
  numberBefore?: boolean;
  /** Sağ/sol ayrı ölçülür (ör. böbrek). */
  sided?: boolean;
  /** Yalnızca bu bölgelerdeki belgelerde aranır (ör. akciğer nodülü yalnızca göğüs incelemesinde). */
  onlyRegions?: string[];
  /** Bu bölgelerde aranmaz. */
  exceptRegions?: string[];
  /** 3B modeldeki yapı. */
  structure: string;
  /** "İçeri gir" sahnesi. */
  inside?: string;
  /** Görüntü üzerinde elle ölçülebilir mi, nasıl? */
  manual?: 'length' | 'hu' | 'ratio';
  /** Ölçüm değerine göre ek sınıflama (ör. T-skoru: normal / osteopeni / osteoporoz). */
  grades?: MeasureGrade[];
  what: string;
  high?: string;
  low?: string;
  causesHigh?: string[];
  causesLow?: string[];
  askDoctor: string[];
  /** Ölçüme özgü uyarı (ör. yaşla değişir). */
  note?: string;
}

const ASK = ['Bu ölçüm önceki çekimlerimle karşılaştırıldığında değişmiş mi?', 'Kontrol çekimi ya da ek tetkik gerekir mi, ne zaman?'];

export const IMAGING_MEASURES: ImagingMeasureDef[] = [
  // ---------------------------------------------------------------- Karın
  {
    key: 'dalak-boyu',
    nameTr: 'Dalak uzunluğu',
    short: 'Dalak',
    aliases: ['dalak boyutu', 'dalak uzunlugu', 'dalak boyu', 'dalak', 'dalag', 'splenik uzunluk'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ max: 120 }],
    plausible: [50, 300],
    dims: 'max',
    structure: 'spleen',
    inside: 'kan',
    manual: 'length',
    what: 'Dalağın en uzun boyu. Dalak eskiyen kan hücrelerini ayıklar ve bağışıklıkta görev alır.',
    high: 'Dalağın büyük olmasına splenomegali denir. Tek başına tanı değildir; nedeni diğer bulgu ve tahlillerle birlikte araştırılır.',
    causesHigh: ['Viral enfeksiyonlar (ör. mononükleoz)', 'Karaciğer hastalıkları ve portal ven basıncının artması', 'Kan hastalıkları (ör. hemolitik anemi)', 'Uzun boylu, iri yapılı kişilerde normal varyasyon'],
    askDoctor: ['Dalak büyüklüğü tahlillerimle (hemogram, karaciğer testleri) birlikte nasıl değerlendiriliyor?', ...ASK],
    note: 'Sınır çoğu kaynakta 12 cm (bazılarında 13 cm); boy ve cinsiyete göre değişir.',
  },
  {
    key: 'karaciger-boyu',
    nameTr: 'Karaciğer boyu',
    short: 'Karaciğer',
    aliases: ['karaciger boyutu', 'karaciger boyu', 'karaciger kraniokaudal', 'karaciger uzunlugu', 'karaciger'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ max: 160 }],
    plausible: [90, 300],
    dims: 'max',
    structure: 'liver',
    inside: 'lobul',
    manual: 'length',
    what: 'Karaciğerin orta köprücük kemiği hizasında yukarıdan aşağıya boyu.',
    high: 'Karaciğerin büyük olmasına hepatomegali denir. Yağlanma, iltihap, dolaşım veya depolanma hastalıklarıyla ilişkili olabilir.',
    causesHigh: ['Yağlı karaciğer (hepatosteatoz)', 'Hepatit (viral, ilaç, alkol)', 'Kalp yetmezliğine bağlı karaciğer konjesyonu', 'Uzun boylu kişilerde normal varyasyon'],
    askDoctor: ['Karaciğer büyüklüğü ALT, AST, GGT gibi tahlillerimle birlikte nasıl değerlendiriliyor?', ...ASK],
    note: 'Ölçüm tekniğine ve boya göre değişir; genelde 15–16 cm üst sınır kabul edilir.',
  },
  {
    key: 'karaciger-hu',
    nameTr: 'Karaciğer yoğunluğu (kontrastsız BT)',
    short: 'Karaciğer HU',
    aliases: ['karaciger dansitesi', 'karaciger atenuasyonu', 'karaciger yogunlugu', 'karaciger hu', 'karaciger parankim dansitesi'],
    unit: 'hu',
    decimals: 0,
    ranges: [{ min: 40, max: 75 }],
    plausible: [-100, 200],
    structure: 'liver',
    inside: 'lobul',
    manual: 'hu',
    what: 'Kontrast verilmeden çekilen BT\'de karaciğer dokusunun Hounsfield birimi cinsinden yoğunluğu. Yağ, dokuyu koyulaştırır (yoğunluğu düşürür).',
    low: '40 HU\'nun altı karaciğer yağlanmasıyla uyumlu olabilir. Yağlanmanın derecesi ultrason veya MR ile de değerlendirilebilir.',
    high: 'Normalden yüksek yoğunluk; demir birikimi veya bazı ilaçlarla (ör. amiodaron) ilişkili olabilir.',
    causesLow: ['Karaciğer yağlanması (metabolik, alkol)', 'Fazla kilo, insülin direnci, yüksek trigliserid'],
    causesHigh: ['Demir birikimi (hemokromatoz)', 'Amiodaron gibi bazı ilaçlar', 'Glikojen depo hastalıkları'],
    askDoctor: ['Yağlanma var mı, derecesi nedir?', 'Tahlillerim (ALT, trigliserid, açlık şekeri) bununla uyumlu mu?', ...ASK],
    note: 'Yalnızca kontrastsız BT için geçerlidir; kontrastlı çekimde değerler yüksek çıkar.',
  },
  {
    key: 'koledok',
    nameTr: 'Koledok (ana safra kanalı) çapı',
    short: 'Koledok',
    aliases: ['koledok capi', 'koledok', 'ana safra kanali', 'cbd'],
    unit: 'mm',
    decimals: 1,
    ranges: [{ max: 6 }],
    plausible: [1, 30],
    structure: 'gallbladder',
    inside: 'lobul',
    manual: 'length',
    what: 'Safrayı karaciğer ve safra kesesinden bağırsağa taşıyan ana kanalın genişliği.',
    high: 'Kanalın genişlemesi (dilatasyon), safranın akışında bir yavaşlama ya da engel olabileceğini düşündürebilir; yaş ve geçirilmiş safra kesesi ameliyatı da genişliği artırır.',
    causesHigh: ['Safra kanalında taş', 'Safra kesesi ameliyatı sonrası (normal olarak genişleyebilir)', 'İleri yaş (her 10 yılda yaklaşık 1 mm)', 'Kanalda darlık veya bası'],
    askDoctor: ['Genişlemenin bir nedeni görüldü mü?', 'Karaciğer tahlillerim (ALP, GGT, bilirubin) bununla uyumlu mu?', ...ASK],
    note: '60 yaş üstünde ve safra kesesi alınmış kişilerde sınır daha yüksektir (≈8–10 mm).',
  },
  {
    key: 'safra-kesesi-duvari',
    nameTr: 'Safra kesesi duvar kalınlığı',
    short: 'Safra kesesi duvarı',
    aliases: ['safra kesesi duvar kalinligi', 'safra kesesi duvari', 'kese duvar kalinligi', 'kese duvari'],
    unit: 'mm',
    decimals: 1,
    ranges: [{ max: 3 }],
    plausible: [0.5, 20],
    structure: 'gallbladder',
    inside: 'lobul',
    what: 'Safra kesesi duvarının kalınlığı; aç karnına ölçülür.',
    high: 'Duvar kalınlaşması safra kesesi iltihabı ile ilişkili olabileceği gibi, tok karnına çekim veya kesenin dışındaki nedenlerle de görülebilir.',
    causesHigh: ['Safra kesesi iltihabı (kolesistit)', 'Tok karnına yapılan çekim', 'Karaciğer hastalığı, sıvı birikimi (asit)', 'Kalp veya böbrek yetmezliği'],
    askDoctor: ['Kesede taş veya iltihap bulgusu var mı?', ...ASK],
  },
  {
    key: 'portal-ven',
    nameTr: 'Portal ven çapı',
    short: 'Portal ven',
    aliases: ['portal ven capi', 'portal ven', 'vena porta'],
    unit: 'mm',
    decimals: 1,
    ranges: [{ max: 13 }],
    plausible: [4, 30],
    structure: 'abdominal-vessels',
    inside: 'lobul',
    manual: 'length',
    what: 'Bağırsak ve dalaktan gelen kanı karaciğere taşıyan ana toplardamarın genişliği.',
    high: 'Genişleme portal ven basıncının artmasıyla (portal hipertansiyon) ilişkili olabilir; derin nefes sırasında normalde biraz genişler.',
    causesHigh: ['Karaciğer sirozu', 'Portal ven içinde pıhtı', 'Kalp yetmezliği'],
    askDoctor: ['Portal basınç artışına ait başka bir bulgu (dalak büyümesi, sıvı) var mı?', ...ASK],
  },
  {
    key: 'bobrek-boyu',
    nameTr: 'Böbrek uzunluğu',
    short: 'Böbrek',
    aliases: ['bobrek boyutlari', 'bobrek boyutu', 'bobrek uzunlugu', 'bobrek', 'bobreg'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ min: 90, max: 125 }],
    plausible: [50, 180],
    dims: 'max',
    sided: true,
    structure: 'kidneys',
    inside: 'nefron',
    manual: 'length',
    what: 'Böbreğin üst ucundan alt ucuna uzunluğu. İki böbreğin boyları birbirine yakın olmalıdır (fark genelde 2 cm\'den az).',
    low: 'Küçük böbrek; uzun süreli böbrek hastalığı, damar darlığı ya da doğuştan küçük böbrekle ilişkili olabilir.',
    high: 'Büyük böbrek; idrar akışında yavaşlama (hidronefroz), kistler, iltihap ya da tek böbrekte telafi amaçlı büyümeyle ilişkili olabilir.',
    causesLow: ['Kronik böbrek hastalığı', 'Böbrek atardamarında darlık', 'Geçirilmiş enfeksiyonlara bağlı skar', 'Doğuştan küçük böbrek'],
    causesHigh: ['İdrar yolunda tıkanıklık (hidronefroz)', 'Polikistik böbrek', 'Akut böbrek iltihabı', 'Diğer böbrek yoksa telafi büyümesi'],
    askDoctor: ['Böbrek boyutları kreatinin ve eGFR değerlerimle birlikte nasıl değerlendiriliyor?', 'İki böbrek arasında belirgin fark var mı?', ...ASK],
  },
  {
    key: 'bobrek-parankim',
    nameTr: 'Böbrek parankim kalınlığı',
    short: 'Böbrek parankimi',
    aliases: ['parankim kalinligi', 'parankim kalinliklari', 'kortikal kalinlik'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ min: 15 }],
    plausible: [4, 35],
    sided: true,
    exceptRegions: ['karaciger', 'tiroid', 'beyin'],
    structure: 'kidneys',
    inside: 'nefron',
    what: 'Böbreğin süzme işini yapan dış dokusunun (parankim) kalınlığı.',
    low: 'Parankimin incelmesi uzun süreli böbrek hasarıyla ilişkili olabilir.',
    causesLow: ['Kronik böbrek hastalığı', 'Uzun süreli yüksek tansiyon veya şeker hastalığı', 'Tekrarlayan böbrek enfeksiyonları', 'İleri yaş'],
    askDoctor: ['Böbrek fonksiyon tahlillerim (kreatinin, eGFR) bununla uyumlu mu?', ...ASK],
  },
  {
    key: 'abdominal-aort',
    nameTr: 'Karın aortu çapı',
    short: 'Karın aortu',
    aliases: ['abdominal aort capi', 'abdominal aorta capi', 'abdominal aort', 'abdominal aorta', 'karin aortu', 'infrarenal aort'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ max: 30 }],
    plausible: [8, 120],
    dims: 'max',
    structure: 'aorta',
    inside: 'damar',
    manual: 'length',
    what: 'Karın bölgesindeki ana atardamarın (aort) dış çapı.',
    high: '30 mm ve üzeri çap karın aortu anevrizması (genişlemesi) olarak adlandırılır. Takip sıklığını ve gerekirse tedaviyi çapın büyüklüğü belirler.',
    causesHigh: ['Damar sertliği (ateroskleroz)', 'Sigara', 'Yüksek tansiyon', 'Aile öyküsü, ileri yaş, erkek cinsiyet'],
    askDoctor: ['Genişleme varsa ne sıklıkla kontrol edilmeli?', 'Tansiyon ve kolesterol kontrolüm yeterli mi?', ...ASK],
  },
  {
    key: 'prostat-hacmi',
    nameTr: 'Prostat hacmi',
    short: 'Prostat',
    aliases: ['prostat hacmi', 'prostat volumu', 'prostat boyutlari', 'prostat agirligi', 'prostat'],
    unit: 'ml',
    decimals: 0,
    ranges: [{ sex: 'male', max: 30 }],
    plausible: [5, 400],
    dims: 'volume',
    structure: 'prostate',
    what: 'Prostat bezinin hacmi (yaklaşık gram ile aynı). Genç erişkinde yaklaşık 20–25 ml\'dir, yaşla artar.',
    high: 'Büyümüş prostat; en sık iyi huylu prostat büyümesidir (BPH). İdrar yapma şikâyetleri ve PSA değeriyle birlikte değerlendirilir.',
    causesHigh: ['İyi huylu prostat büyümesi (yaşla sıklaşır)', 'Prostat iltihabı (prostatit)'],
    askDoctor: ['PSA değerim prostat hacmine göre nasıl yorumlanıyor (PSA yoğunluğu)?', 'İdrar yapma şikâyetlerimle ilişkili mi?', ...ASK],
    note: 'Hacim ölçümü raporda verilmemişse üç boyuttan (0,52 × uzunluk × genişlik × yükseklik) hesaplanır.',
  },
  {
    key: 'tiroid-hacmi',
    nameTr: 'Tiroid hacmi (toplam)',
    short: 'Tiroid',
    aliases: ['total tiroid hacmi', 'toplam tiroid hacmi', 'tiroid hacmi', 'tiroid volumu', 'tiroid bezi hacmi'],
    unit: 'ml',
    decimals: 1,
    ranges: [
      { sex: 'female', max: 18 },
      { sex: 'male', max: 25 },
    ],
    plausible: [2, 300],
    structure: 'thyroid',
    inside: 'folikul',
    what: 'Tiroid bezinin iki lobunun toplam hacmi.',
    high: 'Büyümüş tiroide guatr denir. Hormon tahlilleri (TSH, sT4) ve varsa nodüllerle birlikte değerlendirilir.',
    low: 'Küçük tiroid; uzun süreli tiroid iltihabı (Hashimoto) veya ameliyat sonrası görülebilir.',
    causesHigh: ['İyot eksikliği', 'Hashimoto tiroiditi', 'Graves hastalığı', 'Nodüler guatr'],
    causesLow: ['Uzun süreli Hashimoto tiroiditi (atrofik evre)', 'Geçirilmiş ameliyat veya radyoaktif iyot tedavisi'],
    askDoctor: ['TSH ve sT4 değerlerim bununla uyumlu mu?', 'Nodül varsa takip planı nedir?', ...ASK],
  },

  // ---------------------------------------------------------------- Göğüs ve kalp
  {
    key: 'kardiyotorasik-oran',
    nameTr: 'Kardiyotorasik oran (PA akciğer grafisi)',
    short: 'Kalp/göğüs oranı',
    aliases: ['kardiyotorasik oran', 'kardiotorasik oran', 'kardiyo torasik oran', 'kto', 'ctr'],
    unit: 'ratio',
    decimals: 2,
    ranges: [{ max: 0.5 }],
    plausible: [0.2, 0.9],
    structure: 'heart',
    inside: 'kalpkasi',
    manual: 'ratio',
    what: 'Önden-arkaya çekilen akciğer grafisinde kalbin en geniş yeri ile göğüs kafesinin en geniş iç çapının oranı.',
    high: '0,50\'nin üstü kalp gölgesinin büyük göründüğünü (kardiyomegali) düşündürebilir. Yatarak ya da arkadan-öne değil önden-arkaya çekimde kalp olduğundan büyük görünür; kalbin gerçek boyutu ekokardiyografiyle değerlendirilir.',
    causesHigh: ['Kalp kasının büyümesi veya genişlemesi', 'Kalp zarında sıvı (perikardiyal efüzyon)', 'Çekim tekniği (yatarak, AP çekim, yetersiz nefes)', 'Kilo nedeniyle diyaframın yüksek olması'],
    askDoctor: ['Kalp boyutunun ekokardiyografiyle değerlendirilmesi gerekir mi?', ...ASK],
    note: 'Görüntü üzerinde elle ölçmek için iki çizgi çek: kalbin en geniş yeri ve göğüs kafesinin en geniş iç çapı.',
  },
  {
    key: 'asendan-aort',
    nameTr: 'Çıkan aort çapı',
    short: 'Çıkan aort',
    aliases: ['asendan aort capi', 'asendan aorta capi', 'asendan aort', 'asendan aorta', 'cikan aort', 'aort koku'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ max: 40 }],
    plausible: [15, 100],
    structure: 'aorta',
    inside: 'damar',
    manual: 'length',
    what: 'Kalpten çıkan ana atardamarın ilk bölümünün çapı.',
    high: 'Genişleme (dilatasyon, anevrizma); takip aralığını çapın büyüklüğü ve hızı belirler.',
    causesHigh: ['Yüksek tansiyon', 'Damar sertliği', 'Aort kapağı hastalıkları (ör. iki yapraklı kapak)', 'Bağ dokusu hastalıkları (ör. Marfan)'],
    askDoctor: ['Genişleme varsa ne sıklıkla kontrol edilmeli?', 'Tansiyonum hedefte mi?', ...ASK],
    note: 'Vücut ölçüsüne göre değişir; 40 mm üstü genişleme kabul edilir.',
  },
  {
    key: 'pulmoner-arter',
    nameTr: 'Ana pulmoner arter çapı',
    short: 'Pulmoner arter',
    aliases: ['ana pulmoner arter capi', 'pulmoner arter capi', 'ana pulmoner arter', 'pulmoner trunkus'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ max: 29 }],
    plausible: [10, 70],
    structure: 'pulmonary-vessels',
    inside: 'alveol',
    manual: 'length',
    what: 'Kalpten akciğerlere kan götüren ana atardamarın BT\'deki çapı.',
    high: 'Genişleme akciğer damarlarındaki basıncın artmasıyla (pulmoner hipertansiyon) ilişkili olabilir; ekokardiyografiyle birlikte değerlendirilir.',
    causesHigh: ['Pulmoner hipertansiyon', 'Kronik akciğer hastalıkları (KOAH)', 'Akciğer damarlarında pıhtı öyküsü', 'Sol kalp hastalıkları'],
    askDoctor: ['Pulmoner arter basıncının ekokardiyografiyle ölçülmesi gerekir mi?', ...ASK],
  },
  {
    key: 'akciger-nodulu',
    nameTr: 'Akciğer nodülü boyutu (en büyük)',
    short: 'Akciğer nodülü',
    aliases: ['nodul', 'nodulu', 'noduler lezyon'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ max: 6 }],
    plausible: [1, 60],
    dims: 'max',
    numberBefore: true,
    onlyRegions: ['toraks'],
    structure: 'lungs',
    inside: 'alveol',
    what: 'Akciğerdeki küçük yuvarlak odağın en büyük boyu. Nodüllerin büyük çoğunluğu iyi huyludur (eski enfeksiyon izi, lenf nodu gibi).',
    high: '6 mm ve üzerindeki nodüller için takip çekimi planlanır; aralığı nodülün boyutu, görünümü ve kişinin risk durumu (sigara, yaş) belirler. 6 mm altındakiler düşük riskli kişilerde çoğu zaman rutin takip gerektirmez.',
    causesHigh: ['Geçirilmiş enfeksiyon izi (granülom)', 'Akciğer içi lenf nodu', 'İyi huylu doku artışları', 'Daha az sıklıkla kötü huylu oluşumlar — bu yüzden takip önerilir'],
    askDoctor: ['Bu nodül için takip çekimi gerekiyor mu, ne zaman?', 'Önceki çekimlerimde var mıydı, büyümüş mü?', 'Sigara öyküm takip planını değiştirir mi?'],
    note: 'Takip planı Fleischner Derneği kılavuzu gibi kılavuzlara göre hekim tarafından belirlenir.',
  },
  {
    key: 'ejeksiyon-fraksiyonu',
    nameTr: 'Ejeksiyon fraksiyonu (EF)',
    short: 'EF',
    aliases: ['ejeksiyon fraksiyonu', 'ejection fraction', 'lvef', 'ef'],
    unit: 'percent',
    decimals: 0,
    ranges: [
      { sex: 'male', min: 52, max: 72 },
      { sex: 'female', min: 54, max: 74 },
    ],
    plausible: [5, 95],
    structure: 'heart',
    inside: 'kalpkasi',
    what: 'Sol karıncığın her atımda içindeki kanın yüzde kaçını pompaladığı. Kalbin pompa gücünün en sık kullanılan ölçüsüdür.',
    low: 'Düşük EF kalbin pompa gücünün azaldığını gösterir (%41–51 hafif, %40 ve altı belirgin azalma). Nedeni ve tedavisi kardiyolog tarafından değerlendirilir.',
    high: 'Yüksek EF (hiperdinamik kalp) çoğu zaman önemsizdir; bazen susuzluk, kansızlık veya kalp kasının kalınlaşmasıyla görülür.',
    causesLow: ['Koroner arter hastalığı, geçirilmiş kalp krizi', 'Kalp kası hastalıkları (kardiyomiyopati)', 'Uzun süreli yüksek tansiyon', 'Kapak hastalıkları'],
    causesHigh: ['Susuzluk, kansızlık', 'Tiroid bezinin fazla çalışması', 'Kalp kasının kalınlaşması'],
    askDoctor: ['EF değerim önceki ekokardiyografilerimle karşılaştırıldığında nasıl?', 'Kalp yetmezliği açısından ek tetkik gerekir mi?', ...ASK],
  },
  {
    key: 'sol-ventrikul-capi',
    nameTr: 'Sol karıncık diyastol sonu çapı (LVEDD)',
    short: 'Sol karıncık',
    aliases: ['sol ventrikul diyastol sonu capi', 'sol ventrikul diyastolik capi', 'lvedd', 'lvidd', 'lvdd', 'lvedc'],
    unit: 'mm',
    decimals: 0,
    ranges: [
      { sex: 'male', min: 42, max: 58 },
      { sex: 'female', min: 38, max: 52 },
    ],
    plausible: [20, 90],
    structure: 'heart',
    inside: 'kalpkasi',
    what: 'Sol karıncığın kanla dolduğu andaki iç çapı (ekokardiyografi).',
    high: 'Genişlemiş sol karıncık; kalp kası hastalığı veya kapak yetmezliğiyle ilişkili olabilir. Sporcularda da hafif genişleme görülebilir.',
    causesHigh: ['Kalp kası hastalığı (dilate kardiyomiyopati)', 'Mitral veya aort kapak yetmezliği', 'Düzenli yoğun egzersiz (sporcu kalbi)'],
    askDoctor: ['EF ve kapak bulgularımla birlikte nasıl değerlendiriliyor?', ...ASK],
  },
  {
    key: 'sol-atriyum',
    nameTr: 'Sol kulakçık çapı',
    short: 'Sol kulakçık',
    aliases: ['sol atriyum capi', 'sol atrium capi', 'sol atriyum', 'sol atrium', 'la capi'],
    unit: 'mm',
    decimals: 0,
    ranges: [
      { sex: 'male', min: 30, max: 40 },
      { sex: 'female', min: 27, max: 38 },
    ],
    plausible: [15, 90],
    structure: 'heart',
    inside: 'kalpkasi',
    what: 'Sol kulakçığın ön-arka çapı (ekokardiyografi).',
    high: 'Büyümüş sol kulakçık; uzun süreli yüksek tansiyon, mitral kapak hastalığı veya ritim bozukluğuyla ilişkili olabilir.',
    causesHigh: ['Yüksek tansiyon', 'Mitral kapak darlığı veya yetmezliği', 'Atriyal fibrilasyon', 'Kalbin gevşeme bozukluğu (diyastolik disfonksiyon)'],
    askDoctor: ['Ritim bozukluğu açısından takip gerekir mi?', ...ASK],
  },
  {
    key: 'pulmoner-basinc',
    nameTr: 'Sistolik pulmoner arter basıncı (sPAB)',
    short: 'Pulmoner basınç',
    aliases: ['sistolik pulmoner arter basinci', 'pulmoner arter basinci', 'spab', 'pab', 'spap'],
    unit: 'mmhg',
    decimals: 0,
    ranges: [{ max: 35 }],
    plausible: [10, 150],
    structure: 'pulmonary-vessels',
    inside: 'alveol',
    what: 'Akciğer atardamarlarındaki basıncın ekokardiyografiyle yapılan tahmini.',
    high: 'Yüksek değer akciğer damarlarında basınç artışını (pulmoner hipertansiyon) düşündürebilir; kesin ölçüm kalp kateteriyle yapılır.',
    causesHigh: ['Sol kalp hastalıkları', 'Kronik akciğer hastalıkları, uyku apnesi', 'Akciğer damarlarında pıhtı öyküsü', 'İleri yaş ve fazla kilo'],
    askDoctor: ['Bu değer ek değerlendirme gerektiriyor mu?', ...ASK],
  },
  {
    key: 'karotis-imt',
    nameTr: 'Karotis intima-media kalınlığı',
    short: 'Karotis IMT',
    aliases: ['intima media kalinligi', 'intima-media kalinligi', 'imt', 'ikk'],
    unit: 'mm',
    decimals: 2,
    ranges: [{ max: 0.9 }],
    plausible: [0.2, 4],
    sided: true,
    structure: 'carotid-arteries',
    inside: 'damar',
    what: 'Boyun atardamarının (karotis) iç iki katmanının toplam kalınlığı; damar sertliğinin erken bir göstergesidir.',
    high: 'Kalınlaşma damar sertliği (ateroskleroz) sürecinin başladığını düşündürebilir. Uygulamadaki LDL–ateroskleroz simülasyonu bu süreci eğitimsel olarak gösterir.',
    causesHigh: ['Yüksek LDL kolesterol', 'Yüksek tansiyon', 'Şeker hastalığı', 'Sigara, ileri yaş'],
    askDoctor: ['Kolesterol ve tansiyon hedeflerim ne olmalı?', 'Plak var mı?', ...ASK],
    note: 'Yaşla artar; 0,9 mm üstü çoğu kaynakta artmış kabul edilir.',
  },

  // ---------------------------------------------------------------- Beyin ve omurga
  {
    key: 'evans-indeksi',
    nameTr: 'Evans indeksi',
    short: 'Evans indeksi',
    aliases: ['evans indeksi', 'evans index', 'evans'],
    unit: 'ratio',
    decimals: 2,
    ranges: [{ max: 0.3 }],
    plausible: [0.1, 0.7],
    structure: 'brain',
    inside: 'noron',
    manual: 'ratio',
    what: 'Beyin karıncıklarının (ventrikül) ön boynuzları arası en geniş mesafenin, aynı kesitte kafatası iç çapına oranı.',
    high: '0,30 üstü karıncıkların genişlediğini düşündürebilir; beyin dokusunun azalması (atrofi) ya da beyin omurilik sıvısının akışındaki sorunlarla (hidrosefali) ilişkili olabilir.',
    causesHigh: ['Yaşa bağlı beyin hacmi azalması', 'Normal basınçlı hidrosefali', 'Beyin omurilik sıvısı akışında engel'],
    askDoctor: ['Karıncıklardaki genişleme yaşımla uyumlu mu?', ...ASK],
    note: 'Elle ölçmek için iki çizgi çek: ön boynuzlar arası en geniş mesafe ve kafatasının iç çapı.',
  },
  {
    key: 'orta-hat-sifti',
    nameTr: 'Orta hat kayması',
    short: 'Orta hat kayması',
    aliases: ['orta hat sifti', 'orta hat kaymasi', 'orta hatta kayma', 'midline shift'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ max: 2 }],
    plausible: [0, 40],
    structure: 'brain',
    inside: 'noron',
    manual: 'length',
    what: 'Beynin iki yarısını ayıran orta çizginin olması gereken yerden kayma miktarı.',
    high: 'Orta hat kayması beyin içinde yer kaplayan bir durumun (kanama, ödem, kitle) basısını gösterebilir; hızla değerlendirilmesi gereken bir bulgudur.',
    causesHigh: ['Beyin içi veya zar altı kanama', 'Beyin ödemi', 'Yer kaplayan oluşumlar'],
    askDoctor: ['Kaymanın nedeni ne, acil değerlendirme gerekiyor mu?', ...ASK],
  },
  {
    key: 'lomber-kanal',
    nameTr: 'Bel omurga kanalı ön-arka çapı',
    short: 'Bel kanalı',
    aliases: ['spinal kanal on-arka capi', 'spinal kanal ap capi', 'kanal on-arka capi', 'spinal kanal capi', 'spinal kanal'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ min: 12 }],
    plausible: [4, 30],
    exceptRegions: ['servikal', 'torakal', 'beyin'],
    structure: 'spinal-cord',
    inside: 'noron',
    manual: 'length',
    grades: [{ upTo: 9.99, label: 'Belirgin (mutlak) darlık aralığında' }, { upTo: 11.99, label: 'Hafif (göreceli) darlık aralığında' }, { label: 'Normal genişlikte' }],
    what: 'Bel bölgesinde sinirlerin geçtiği omurga kanalının ön-arka genişliği.',
    low: 'Kanalın daralması (spinal stenoz) sinirlere bası yapabilir; yürürken bacak ağrısı veya uyuşma ile ilişkili olabilir. Şikâyetlerle birlikte değerlendirilir.',
    causesLow: ['Disk taşması veya fıtığı', 'Eklem ve bağlarda yaşa bağlı kalınlaşma', 'Omur kayması', 'Doğuştan dar kanal'],
    askDoctor: ['Daralma şikâyetlerimle (bel, bacak ağrısı, uyuşma) uyumlu mu?', 'Fizik tedavi veya başka bir tedavi gerekir mi?', ...ASK],
  },
  {
    key: 'servikal-kanal',
    nameTr: 'Boyun omurga kanalı ön-arka çapı',
    short: 'Boyun kanalı',
    aliases: ['spinal kanal on-arka capi', 'spinal kanal ap capi', 'kanal on-arka capi', 'spinal kanal capi', 'spinal kanal'],
    unit: 'mm',
    decimals: 0,
    ranges: [{ min: 13 }],
    plausible: [4, 30],
    onlyRegions: ['servikal'],
    structure: 'spinal-cord',
    inside: 'noron',
    manual: 'length',
    grades: [{ upTo: 9.99, label: 'Belirgin (mutlak) darlık aralığında' }, { upTo: 12.99, label: 'Hafif (göreceli) darlık aralığında' }, { label: 'Normal genişlikte' }],
    what: 'Boyun bölgesinde omuriliğin geçtiği kanalın ön-arka genişliği.',
    low: 'Kanalın daralması omuriliğe veya sinir köklerine bası yapabilir; kol ağrısı, uyuşma veya el becerisinde azalma ile ilişkili olabilir.',
    causesLow: ['Disk taşması veya fıtığı', 'Kemik çıkıntıları (osteofit)', 'Bağ kalınlaşması', 'Doğuştan dar kanal'],
    askDoctor: ['Omurilikte bası bulgusu var mı?', 'Şikâyetlerim bununla uyumlu mu?', ...ASK],
  },

  // ---------------------------------------------------------------- Kemik
  {
    key: 't-skoru',
    nameTr: 'Kemik yoğunluğu T-skoru',
    short: 'T-skoru',
    aliases: ['t skoru', 't-skoru', 't score', 't-score', 'tskoru'],
    unit: 'score',
    decimals: 1,
    ranges: [{ min: -1 }],
    plausible: [-7, 5],
    sided: false,
    structure: 'bones',
    inside: 'osteon',
    grades: [{ upTo: -2.5, label: 'Osteoporoz aralığında' }, { upTo: -1.01, label: 'Osteopeni (düşük kemik kütlesi) aralığında' }, { label: 'Normal aralıkta' }],
    what: 'Kemik yoğunluğunun (DEXA) genç sağlıklı erişkin ortalamasından kaç standart sapma uzak olduğu. Bel omurları ve kalçada ayrı ayrı ölçülür; en düşük değer esas alınır.',
    low: '−1 ile −2,5 arası osteopeni, −2,5 ve altı osteoporoz olarak sınıflanır (Dünya Sağlık Örgütü). Kırık riski yaş, önceki kırıklar ve diğer risk etkenleriyle birlikte değerlendirilir.',
    causesLow: ['Menopoz ve ileri yaş', 'D vitamini ve kalsiyum eksikliği', 'Uzun süreli kortizon kullanımı', 'Hareketsizlik, sigara, düşük kilo', 'Tiroid veya paratiroid bezinin fazla çalışması'],
    askDoctor: ['Kırık riskim (ör. FRAX) nedir?', 'D vitamini ve kalsiyum düzeylerim yeterli mi?', 'Tedavi veya kontrol ölçümü gerekir mi?'],
    note: 'Menopoz öncesi kadınlarda ve 50 yaş altı erkeklerde T-skoru yerine Z-skoru kullanılır.',
  },
];

export const imagingMeasureByKey = new Map(IMAGING_MEASURES.map((m) => [m.key, m]));

// ---------------------------------------------------------------------------------------------
// Değerlendirme

export function measureRange(def: ImagingMeasureDef, sex: Sex): RangeValue {
  const specific = sex !== 'unspecified' ? def.ranges.find((r) => r.sex === sex) : undefined;
  const generic = def.ranges.find((r) => !r.sex);
  let r = specific ?? generic;
  if (!r) {
    const sexed = def.ranges.filter((x) => x.sex);
    if (!sexed.length) return { source: 'none' };
    // Cinsiyet bilinmiyorsa iki aralığın birleşimi (daha geniş, daha az yanlış alarm).
    const mins = sexed.map((x) => x.min).filter((v): v is number => v !== undefined);
    const maxs = sexed.map((x) => x.max).filter((v): v is number => v !== undefined);
    r = { min: mins.length ? Math.min(...mins) : undefined, max: maxs.length ? Math.max(...maxs) : undefined };
  }
  return { min: r.min, max: r.max, source: 'catalog', text: rangeText(r.min, r.max, def.decimals) };
}

export function formatMeasure(def: ImagingMeasureDef, value: number): string {
  const u = MEASURE_UNIT_LABEL[def.unit];
  const n = formatNumber(value, def.decimals);
  return def.unit === 'percent' ? `%${n}` : u ? `${n} ${u}` : n;
}

export function measureGrade(def: ImagingMeasureDef, value: number): string | undefined {
  if (!def.grades) return undefined;
  for (const g of def.grades) if (g.upTo === undefined || value <= g.upTo) return g.label;
  return undefined;
}

export interface MeasureEvaluation {
  status: ResultStatus;
  range: RangeValue;
  grade?: string;
}

export function evaluateMeasure(def: ImagingMeasureDef, value: number, sex: Sex): MeasureEvaluation {
  const range = measureRange(def, sex);
  return { status: statusFor(value, range), range, grade: measureGrade(def, value) };
}

/** Belgenin bölgesine göre bu ölçüm aranır mı? */
export function measureApplies(def: ImagingMeasureDef, region: string | undefined): boolean {
  if (def.onlyRegions) return region !== undefined && def.onlyRegions.includes(region);
  if (def.exceptRegions && region && def.exceptRegions.includes(region)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Rapor metninden ölçüm okuma

export interface FoundMeasure {
  key: string;
  value: number;
  /** "Sağ", "Sol", "Bel (L1–L4)", "Kalça" gibi. */
  site?: string;
  /** Rapordaki ifade (gösterim ve doğrulama için). */
  text: string;
}

const FOLD: Record<string, string> = { ş: 's', ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', â: 'a', î: 'i', û: 'u', é: 'e' };

/** Uzunluğu koruyarak küçük harfe çevirir ve Türkçe harfleri katlar (konumlar orijinal metinle aynı kalır). */
export function foldKeepLength(s: string): string {
  let out = '';
  for (const ch of s) {
    const lower = ch.toLocaleLowerCase('tr');
    const one = lower.length === 1 ? lower : ch.toLowerCase().length === 1 ? ch.toLowerCase() : ch;
    const folded = FOLD[one] ?? one;
    // Çok baytlı (UTF-16 çift) karakterlerde uzunluk korunur.
    out += folded.length === ch.length ? folded : ch;
  }
  return out;
}

const NUM = String.raw`[-−–]?\s?\d+(?:[.,]\d+)?`;
const DIM = String.raw`\s*[x×*]\s*`;
const UNIT = String.raw`mm\s*hg|mmhg|mm|cm3|cm³|cm|ml|cc|gr|g|hu|%`;
const VALUE_RE = new RegExp(String.raw`(%\s*)?(${NUM})(?:${DIM}(${NUM}))?(?:${DIM}(${NUM}))?\s*(${UNIT})?(?![a-z0-9])`, 'g');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const toNum = (s: string) => Number.parseFloat(s.replace(/\s/g, '').replace(/[−–]/g, '-').replace(',', '.'));

/** Birimi kanonik birime çevirir; uyumsuz birim null döner. */
function canonical(def: ImagingMeasureDef, nums: number[], unitRaw: string | undefined, percentPrefix: boolean): number | null {
  const unit = (unitRaw ?? '').replace(/\s/g, '');
  const pick = () => (def.dims === 'max' ? Math.max(...nums) : nums[0]!);
  switch (def.unit) {
    case 'mm': {
      if (unit === 'mm') return pick();
      if (unit === 'cm') return pick() * 10;
      return null; // birimsiz uzunluk belirsizdir (cm mi mm mi?)
    }
    case 'ml': {
      if (['ml', 'cc', 'cm3', 'cm³', 'gr', 'g'].includes(unit)) return nums[0]!;
      if (def.dims === 'volume' && nums.length === 3 && (unit === 'mm' || unit === 'cm')) {
        const k = unit === 'mm' ? 0.1 : 1;
        return 0.52 * nums[0]! * k * nums[1]! * k * nums[2]! * k;
      }
      return null;
    }
    case 'hu':
      return unit === 'hu' || unit === '' ? nums[0]! : null;
    case 'percent':
      return unit === '%' || percentPrefix || unit === '' ? nums[0]! : null;
    case 'mmhg':
      return unit === 'mmhg' || unit === '' ? nums[0]! : null;
    case 'ratio': {
      if (unit === '%' || percentPrefix) return nums[0]! / 100;
      if (unit !== '') return null;
      const v = nums[0]!;
      return v > 1 && v < 100 ? v / 100 : v;
    }
    case 'score':
      return unit === '' ? nums[0]! : null;
  }
}

const SIDE_RE = /(?<![a-z])(sag|sol)(?:da|dan|daki|de)?(?![a-z])/g;

function siteFor(def: ImagingMeasureDef, before: string, between: string): string | undefined {
  if (def.key === 't-skoru') {
    const ctx = `${before} ${between}`;
    if (/femur|kalca|total hip|boyun/.test(ctx)) return 'Kalça';
    if (/l1|l2|l3|l4|lomber|omurga|spine/.test(ctx)) return 'Bel omurları';
    if (/radius|onkol/.test(ctx)) return 'Önkol';
    return undefined;
  }
  if (!def.sided) return undefined;
  const all = [...`${before.slice(-24)} ${between}`.matchAll(SIDE_RE)];
  const last = all[all.length - 1]?.[1];
  return last === 'sag' ? 'Sağ' : last === 'sol' ? 'Sol' : undefined;
}

/**
 * Radyoloji/eko/DEXA rapor metninden katalogdaki ölçümleri bulur. Her eşleşmede ifadeden sonraki
 * kısa pencerede (aynı cümle) ilk uygun sayı + birim alınır. Birimi uymayan ya da fizyolojik
 * aralık dışındaki sayılar (ör. karaciğerdeki 12 mm kist) bu ölçüm sayılmaz.
 */
export function findMeasurements(text: string, opts: { region?: string } = {}): FoundMeasure[] {
  const folded = foldKeepLength(text);
  const out: FoundMeasure[] = [];
  const seen = new Set<string>();
  // Aynı ifade birden çok ölçümde (bel/boyun kanalı) geçebilir; uzun ifadeler önce.
  for (const def of IMAGING_MEASURES) {
    if (!measureApplies(def, opts.region)) continue;
    const aliases = [...def.aliases].sort((a, b) => b.length - a.length);
    const taken: Array<[number, number]> = [];
    for (const alias of aliases) {
      // Kısa kısaltmalar (EF, KTO, IMT) tam kelime; diğerlerinde Türkçe ekler serbest ("böbreğin", "dalağı").
      const suffix = alias.length <= 3 ? '(?![a-z])' : '[a-z]{0,5}(?![a-z])';
      const re = new RegExp(String.raw`(?<![a-z0-9])${escapeRe(alias)}${suffix}`, 'g');
      for (const m of folded.matchAll(re)) {
        const start = m.index!;
        const end = start + m[0].length;
        if (taken.some(([a, b]) => start < b && end > a)) continue;
        taken.push([start, end]);
        // Pencere: cümle sonuna (nokta + boşluk/satır, noktalı virgül) ya da 90 karaktere kadar.
        let stop = folded.length;
        const tail = folded.slice(end);
        const sentence = /(\.\s|\n|;)/.exec(tail);
        if (sentence) stop = end + sentence.index;
        stop = Math.min(stop, end + 90);
        let windowText = folded.slice(end, stop);
        const before = folded.slice(Math.max(0, start - 40), start);
        let windowStart = end;
        if (def.numberBefore) {
          // "sağ alt lobda 8 mm nodül": aynı cümlede ifadeden hemen önceki kısım
          const from = Math.max(0, start - 30, folded.lastIndexOf('.', start - 1) + 1, folded.lastIndexOf('\n', start - 1) + 1);
          windowText = folded.slice(from, start);
          windowStart = from;
        }
        VALUE_RE.lastIndex = 0;
        const matches = [...windowText.matchAll(VALUE_RE)];
        let emitted = 0;
        for (const v of matches) {
          const nums = [v[2], v[3], v[4]].filter((x): x is string => x !== undefined).map(toNum);
          if (nums.some((n) => Number.isNaN(n))) continue;
          const value = canonical(def, nums, v[5], Boolean(v[1]));
          if (value === null || value < def.plausible[0] || value > def.plausible[1]) continue;
          const between = windowText.slice(0, v.index);
          const site = siteFor(def, before, between);
          const id = `${def.key}|${site ?? ''}`;
          if (!seen.has(id)) {
            seen.add(id);
            const rounded = Number(value.toFixed(def.decimals + 1));
            const a = Math.min(start, windowStart + (v.index ?? 0));
            const b = Math.max(end, windowStart + (v.index ?? 0) + v[0].length);
            out.push({ key: def.key, value: rounded, site, text: text.slice(a, b).replace(/\s+/g, ' ').trim() });
            emitted++;
          }
          // Sağ/sol ayrı ölçülenlerde (ör. "sağ 110 mm, sol 95 mm") aynı cümlede devam et.
          if (!def.sided && def.key !== 't-skoru') break;
          if (emitted >= 2) break;
        }
      }
    }
  }
  return out;
}
