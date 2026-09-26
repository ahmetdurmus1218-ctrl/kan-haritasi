/**
 * Organ keşif verisi: her yapı için konum/işlev metni, kamera açısı ve "içeri gir" sahnesi.
 * Veri odaklıdır; yeni organ veya sahne eklemek bileşen değiştirmeyi gerektirmez.
 * Metinler genel eğitim bilgisidir; kişisel bulgu değildir.
 */
import type { InsideId } from '../explore/inside/registry';

export interface OrganInfo {
  /** Nerede? (kısa) */
  location: string;
  /** Ne yapar? (2–3 cümle) */
  function: string;
  /** Adı geçen alt yapılar (modelde ayrı parça olmayabilir). */
  anatomy?: string[];
  /** Kamera: [azimut°, yükseklik°]; azimut 0 = önden, +90 = kişinin sol yanı. */
  view: [number, number];
  inside?: InsideId;
}

export const ORGANS: Record<string, OrganInfo> = {
  heart: {
    location: 'Göğüs kafesinin ortasında, iki akciğerin arasında, hafif sola yatık.',
    function:
      'Dört odacıklı bir kas pompasıdır. Sağ taraf oksijeni azalmış kanı akciğerlere, sol taraf oksijenlenmiş kanı aort yoluyla tüm vücuda gönderir. Kapakçıklar kanın tek yönde akmasını sağlar.',
    anatomy: ['Sağ ve sol kulakçık', 'Sağ ve sol karıncık', 'Karıncıklar arası bölme', 'Triküspit, pulmoner, mitral ve aort kapakları', 'Miyokard (kalp kası)'],
    view: [20, 10],
    inside: 'damar',
  },
  'coronary-arteries': {
    location: 'Kalbin yüzeyinde, aortun hemen çıkışından başlayarak kalbi saran damarlar.',
    function:
      'Kalp kasının kendi oksijen ve besin ihtiyacını karşılar. Damar duvarında zamanla lipid birikmesi ve inflamasyon (ateroskleroz) bu damarlarda özellikle önem kazanır.',
    anatomy: ['Sol ana koroner arter', 'Sol ön inen arter (LAD)', 'Diyagonal dallar', 'Sağ koroner arter', 'Arka inen arter', 'Marjinal dallar'],
    view: [25, 12],
    inside: 'damar',
  },
  aorta: {
    location: 'Kalbin sol karıncığından çıkar, göğüste kavis yapıp omurganın önünden karına iner.',
    function: 'Vücudun en büyük atardamarıdır; kalbin pompaladığı oksijenli kanı tüm organlara dağıtan ana yoldur.',
    anatomy: ['Çıkan aort', 'Aort kavsi', 'İnen göğüs aortu', 'Karın aortu'],
    view: [60, 6],
    inside: 'damar',
  },
  'carotid-arteries': {
    location: 'Boynun iki yanında, nefes borusunun yanında yukarı doğru uzanır.',
    function: 'Beyne, yüze ve boyna kan taşır. Aort kavsinden ayrılan dallardır.',
    anatomy: ['Brakiyosefalik arter', 'Sol ortak karotis', 'Sol köprücükaltı arter'],
    view: [20, 5],
    inside: 'damar',
  },
  'pulmonary-vessels': {
    location: 'Kalp ile akciğerler arasında.',
    function:
      'Pulmoner arterler oksijeni azalmış kanı akciğere götürür; pulmoner venler oksijenlenmiş kanı kalbe geri getirir. Vücutta arter–ven renk kuralının tersine döndüğü tek yerdir.',
    view: [0, 10],
  },
  veins: {
    location: 'Vücudun her yerinde; büyükleri kalbe yakın ve karın arka duvarında.',
    function: 'Dokulardan gelen kanı kalbe geri taşır. Ana toplardamarlar (üst ve alt vena kava) sağ kulakçığa açılır.',
    view: [-20, 5],
    inside: 'damar',
  },
  'renal-vessels': {
    location: 'Karın arka duvarında, aort ve alt vena kava ile böbrekler arasında.',
    function: 'Böbrekler her dakika kalbin pompaladığı kanın yaklaşık beşte birini alır; bu damarlar o kanı getirip götürür.',
    view: [0, 5],
    inside: 'damar',
  },
  'abdominal-vessels': {
    location: 'Karın boşluğunda, sindirim organlarının çevresinde.',
    function: 'Mide, bağırsaklar, karaciğer, dalak ve pankreası besler. Bağırsaktan emilen besinler portal ven ile önce karaciğere taşınır.',
    anatomy: ['Çölyak gövde', 'Üst ve alt mezenter arter', 'Portal ven', 'Karaciğer atardamarları'],
    view: [0, 10],
    inside: 'damar',
  },
  'eye-vessels': {
    location: 'Göz küresi ve göz çukurunda.',
    function: 'Retinayı ve gözü besleyen çok ince damarlardır. Kan şekeri ve kan basıncıyla ilişkili değişiklikler bu damarlarda göz muayenesiyle görülebilir.',
    view: [0, 5],
    inside: 'damar',
  },
  lungs: {
    location: 'Göğüs boşluğunda, kalbin iki yanında.',
    function: 'Havadaki oksijen, alveol adı verilen milyonlarca küçük kesecikte kana geçer; karbondioksit kandan havaya atılır.',
    anatomy: ['Sağ akciğer: 3 lob', 'Sol akciğer: 2 lob', 'Bronkopulmoner segmentler', 'Alveoller'],
    view: [0, 5],
    inside: 'alveol',
  },
  airways: {
    location: 'Boyundan göğse iner, göğüste iki ana bronşa ayrılır.',
    function: 'Havayı akciğerlere iletir, ısıtır ve nemlendirir. Kıkırdak halkalar yolun açık kalmasını sağlar.',
    anatomy: ['Nefes borusu (trakea)', 'Ana bronşlar', 'Lob ve segment bronşları'],
    view: [0, 5],
    inside: 'alveol',
  },
  liver: {
    location: 'Karnın sağ üst bölümünde, diyaframın altında.',
    function:
      'Albumin ve pıhtılaşma faktörlerini üretir, kolesterolü yapar ve işler, ilaç ve atıkları dönüştürür, safra üretir. Hücreleri zorlandığında ALT/AST gibi enzimler kana daha fazla geçer.',
    anatomy: ['Sağ ve sol lob', 'Kaudat ve kuadrat lob', 'Lobüller', 'Hepatositler'],
    view: [-35, 10],
    inside: 'lobul',
  },
  gallbladder: {
    location: 'Karaciğerin alt yüzeyinde.',
    function: 'Karaciğerin ürettiği safrayı depolar ve yoğunlaştırır; yağlı yemekten sonra bağırsağa bırakır.',
    view: [-30, 5],
  },
  pancreas: {
    location: 'Midenin arkasında, karın arka duvarına yakın, yatay uzanır.',
    function:
      'Sindirim enzimleri (amilaz, lipaz) üretir. Langerhans adacıklarındaki beta hücreleri insülin, alfa hücreleri glukagon salgılayarak kan şekerini düzenler.',
    anatomy: ['Baş, gövde ve kuyruk', 'Pankreas kanalı', 'Langerhans adacıkları'],
    view: [0, 15],
    inside: 'adacik',
  },
  'small-intestine': {
    location: 'Karnın orta ve alt bölümünde, kıvrımlar halinde.',
    function: 'Besinlerin büyük kısmı burada emilir. Demir en çok on iki parmak bağırsağında, B12 vitamini ince bağırsağın son kısmında (ileum) emilir.',
    anatomy: ['Duodenum', 'Jejunum', 'İleum'],
    view: [0, 5],
  },
  'large-intestine': {
    location: 'İnce bağırsağı çerçeve gibi çevreler.',
    function: 'Su ve tuzları geri emer, dışkıyı oluşturur. Bağırsak mikrobiyotasının büyük kısmı buradadır.',
    anatomy: ['Çekum', 'Çıkan, transvers, inen kolon', 'Sigmoid kolon', 'Rektum'],
    view: [0, 5],
  },
  kidneys: {
    location: 'Karın arka duvarında, omurganın iki yanında; sağ böbrek biraz daha aşağıda.',
    function:
      'Her böbrekte yaklaşık bir milyon nefron kanı süzer. Kreatinin ve üre gibi atıklar idrarla atılır; sıvı, tuz ve asit–baz dengesi ayarlanır.',
    anatomy: ['Korteks (kabuk)', 'Medulla ve piramitler', 'Nefron', 'Glomerül'],
    view: [180, 10],
    inside: 'nefron',
  },
  'urinary-tract': {
    location: 'Böbreklerden leğen kemiğine iner.',
    function: 'Üreterler idrarı böbreklerden mesaneye taşır; mesane idrarı depolar.',
    view: [0, 5],
  },
  prostate: {
    location: 'Erkeklerde mesanenin hemen altında.',
    function: 'Meni sıvısının bir kısmını üretir. PSA bu bezin hücrelerince üretilen bir proteindir.',
    view: [0, 0],
  },
  brain: {
    location: 'Kafatası içinde.',
    function: 'Düşünme, hareket, duyu ve hormon düzenlemesinin merkezidir. Vücut enerjisinin önemli bir kısmını, çoğunlukla glukoz olarak kullanır.',
    anatomy: ['Beyin yarıküreleri', 'Beyincik', 'Beyin sapı', 'Hipotalamus ve hipofiz (tabanda)'],
    view: [35, 15],
  },
  'spinal-cord': {
    location: 'Omurga kanalı içinde, beyin sapından bel bölgesine kadar.',
    function: 'Beyin ile vücut arasındaki sinyalleri taşır; bazı refleksler doğrudan omurilikte işlenir. B12 eksikliği omurilik yollarını etkileyebilir.',
    view: [180, 5],
  },
  bones: {
    location: 'Tüm vücut: kafatası, omurga, göğüs kafesi, leğen kemiği, kol ve bacak kemikleri.',
    function: 'Vücudu taşır, organları korur ve kasların tutunduğu kaldıraçları oluşturur. Yetişkinde kan hücrelerinin büyük kısmı omurga, pelvis, kaburgalar ve göğüs kemiğindeki kemik iliğinde yapılır. Kemik ayrıca kalsiyum ve fosfor deposudur; D vitamini, kalsiyum ve ALP kemik sağlığıyla ilişkilidir.',
    anatomy: ['Kafatası', 'Omurga (33 omur, diskler)', 'Göğüs kafesi (kaburgalar, göğüs kemiği)', 'Leğen kemiği', 'Kol, önkol ve el kemikleri', 'Uyluk, bacak ve ayak kemikleri', 'Kemik iliği'],
    view: [20, 8],
    inside: 'ilik',
  },
  stomach: {
    location: 'Karnın sol üst bölümünde, diyaframın altında; karaciğerin sol lobunun ve dalağın komşusu.',
    function: 'Besinleri asit ve pepsin enzimiyle sindirmeye başlar, karıştırır ve bağırsağa azar azar iletir. B12 vitamininin emilmesi için gereken iç faktörü üretir; mide asidini baskılayan ilaçlar ve mide iltihabı B12 ve demir emilimini etkileyebilir.',
    anatomy: ['Kardiya (giriş)', 'Fundus', 'Gövde', 'Pilor (çıkış)'],
    view: [10, 8],
  },
  esophagus: {
    location: 'Boğazdan başlayıp nefes borusunun ve kalbin arkasından geçerek mideye uzanır.',
    function: 'Kas dalgalarıyla (peristaltizm) yutulan lokmayı mideye taşır; alt ucundaki büzücü kas mide içeriğinin geri kaçmasını önler.',
    view: [60, 5],
  },
  eyes: {
    location: 'Kafatasındaki göz çukurlarında.',
    function: 'Işığı retinada sinir sinyaline çevirir. Retinanın küçük damarları uzun süreli yüksek kan şekeri ve yüksek tansiyondan etkilenebilir; bu yüzden diyabette düzenli göz muayenesi önerilir.',
    anatomy: ['Kornea', 'Lens', 'Retina', 'Görme siniri'],
    view: [0, 5],
  },
  testes: {
    location: 'Skrotum (torba) içinde, vücudun dışında; üstlerinde epididim bulunur.',
    function: 'Sperm üretir ve testosteronun büyük kısmını salgılar. Hipofizden gelen LH testosteron yapımını, FSH sperm yapımını uyarır.',
    anatomy: ['Testis', 'Epididim'],
    view: [0, 10],
  },
  'male-genitals': {
    location: 'Pelvis ve dış genital bölge.',
    function: 'Spermi testislerden taşıyan kanallar (duktus deferens), sıvı üreten seminal veziküller ve prostat birlikte meni oluşturur.',
    anatomy: ['Duktus deferens', 'Seminal veziküller', 'Penis'],
    view: [30, 10],
  },
  ovaries: {
    location: 'Kadında pelvis içinde, rahmin iki yanında (bu modelde yok).',
    function: 'Yumurta hücrelerini olgunlaştırır; östrojen ve progesteron üretir. Hipofizden gelen FSH ve LH ile yönetilir.',
    view: [0, 10],
  },
  uterus: {
    location: 'Kadında pelvis içinde, mesanenin arkasında (bu modelde yok).',
    function: 'Gebeliğin geliştiği organ; iç tabakası her adet döngüsünde hormonlara göre kalınlaşıp dökülür.',
    view: [0, 10],
  },
  'limb-vessels': {
    location: 'Kollar ve bacaklar boyunca, kemiklere ve kaslara eşlik ederek.',
    function: 'Atardamarlar oksijenli kanı kaslara ve dokulara taşır; toplardamarlar kanı kalbe geri getirir. Bacak toplardamarlarındaki kapakçıklar kanın yerçekimine karşı yukarı akmasına yardım eder. Uzun süre hareketsizlik bacak toplardamarlarında pıhtı riskini artırabilir.',
    anatomy: ['Aksiller ve brakiyal arter', 'Radyal ve ulnar arter', 'Femoral ve popliteal arter', 'Ön ve arka tibial arter', 'Büyük ve küçük safen ven', 'Sefalik ve bazilik ven'],
    view: [20, 5],
    inside: 'damar',
  },
  'skeletal-muscle': {
    location: 'Tüm vücut: baş, boyun, gövde, kollar ve bacaklar. Kemiklere kirişlerle tutunur.',
    function: 'Kasılarak hareketi ve duruşu sağlar, ısı üretir ve kan şekerinin büyük kısmını kullanır. Kas hasarında CK kana geçer; kreatinin kas metabolizmasının atığıdır, bu yüzden kas kütlesi kreatinin değerini etkiler.',
    anatomy: ['Baş ve boyun kasları', 'Göğüs, karın ve sırt kasları', 'Omuz, kol ve önkol kasları', 'Kalça, uyluk ve bacak kasları'],
    view: [20, 8],
  },
  spleen: {
    location: 'Karnın sol üst bölümünde, midenin arkasında.',
    function: 'Yaşlanmış alyuvarları kandan ayıklar, bağışıklık hücrelerini barındırır ve kanı süzer.',
    view: [120, 10],
  },
  thymus: {
    location: 'Göğüs kemiğinin arkasında, kalbin üstünde.',
    function: 'T lenfositlerinin olgunlaştığı bezdir; çocuklukta büyüktür, yetişkinlikte büyük ölçüde yağ dokusuna dönüşür.',
    view: [0, 5],
  },
  thyroid: {
    location: 'Boynun önünde, nefes borusunun iki yanında (kelebek biçimli).',
    function: 'T4 ve T3 hormonlarını üretir; bu hormonlar vücudun metabolizma hızını ayarlar. Hipofizden gelen TSH ile yönetilir.',
    anatomy: ['Sağ ve sol lob', 'İstmus', 'Foliküller'],
    view: [0, 0],
    inside: 'folikul',
  },
  pituitary: {
    location: 'Beynin tabanında, kafatasındaki küçük bir çukurda (sella tursika).',
    function: 'TSH, ACTH, prolaktin, büyüme hormonu gibi hormonlarla birçok bezi yönetir; hipotalamustan komut alır.',
    view: [90, 0],
  },
  hypothalamus: {
    location: 'Beynin tabanında, hipofizin hemen üstünde.',
    function: 'Vücut ısısı, açlık, susuzluk ve hormon eksenlerini yönetir; hipofize salgılatıcı hormonlarla sinyal verir.',
    view: [90, 0],
  },
  adrenals: {
    location: 'Her iki böbreğin üst kutbunda.',
    function: 'Kortizol, aldosteron ve adrenalin üretir. Kortizolün günlük bir ritmi vardır, sabah yüksektir.',
    view: [180, 10],
  },
  skin: {
    location: 'Vücudun dış yüzeyi.',
    function: 'Vücudu korur, ısıyı düzenler. Güneş ışığı alındığında D vitamini yapımının ilk adımı deride gerçekleşir.',
    view: [0, 0],
  },
};

export function organInfo(structure: string): OrganInfo | undefined {
  return ORGANS[structure];
}
