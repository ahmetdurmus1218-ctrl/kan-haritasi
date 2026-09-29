import type { SystemId } from '@kh/catalog';

/**
 * Doku atlası: kendi özel simülasyon sahnesi olmayan organların duvar/doku katmanları, veriyle
 * tanımlanır ve tek bir prosedürel sahneyle (TissueScene) çizilir. Yeni bir organ eklemek için
 * buraya bir profil eklemek yeterlidir.
 *
 * Dürüstlük: bunlar ŞEMATİK doku katmanlarıdır (histoloji ders kitabı düzeyinde katman sırası ve
 * hücre tipleri). Hücre sayıları, kalınlık oranları ve renkler temsilidir; mikroskop görüntüsü ya da
 * kişinin dokusu değildir. Süreç adımları basitleştirilmiş animasyonlarla anlatılır; sayısal bir
 * fizyoloji simülasyonu değildir. Arayüz bu sahneleri "Doku atlası · şematik" diye etiketler.
 */

export type LayerKind =
  | 'lumen'
  | 'epi-squamous'
  | 'epi-columnar'
  | 'epi-ciliated'
  | 'epi-transitional'
  | 'epi-cuboidal'
  | 'endothelium'
  | 'connective'
  | 'smooth-muscle'
  | 'glands'
  | 'crypts'
  | 'lymphoid'
  | 'cartilage'
  | 'bone'
  | 'fat'
  | 'serosa'
  | 'capsule'
  | 'cords'
  | 'sinusoids'
  | 'neural'
  | 'dense-cells';

export type LayerMotion = 'peristalsis' | 'cilia' | 'secretion' | 'flow' | 'contract';

export interface TissueLayer {
  key: string;
  name: string;
  kind: LayerKind;
  /** Göreli kalınlık (sahne ölçeği; gerçek oran değildir). */
  thickness: number;
  color: string;
  text: string;
  /** Gerçek boyut notu. */
  size?: string;
  motion?: LayerMotion;
  /** Düz kas/kordon yönü; kıkırdakta hücre dizilimi. */
  arrangement?: 'circular' | 'longitudinal' | 'clusters' | 'columns' | 'network' | 'flat' | 'random';
  /** Epitelde goblet (mukus) hücreleri; bağ dokusunda kılcal damar; bezde salgı. */
  goblet?: boolean;
  vessels?: boolean;
  /** Lümen içeriği parçacık rengi. */
  particle?: string;
}

export interface TissueStage {
  title: string;
  text: string;
  /** Kameranın odaklanacağı katman. */
  focus?: string;
}

export interface TissueProfile {
  id: string;
  title: string;
  tissue: string;
  cell: string;
  process: string;
  system: SystemId;
  summary: string;
  /** Bu dokunun ait olduğu 3B yapılar. */
  structures: string[];
  /** Üstten (lümen tarafı) alta doğru katmanlar. */
  layers: TissueLayer[];
  /** Katman turundan sonra anlatılan süreç adımları (basitleştirilmiş animasyon). */
  process_stages: TissueStage[];
  tests: string[];
  caution: string;
  background: string;
}

const CAUTION =
  'Bu bir DOKU ATLASI şemasıdır: katman sırası ve hücre tipleri ders kitabı düzeyindedir; hücre sayıları, kalınlıklar ve renkler temsilidir. Senin dokunun görüntüsü değildir ve bir bulgu göstermez.';

export const TISSUES = {
  'yemek-borusu': {
    id: 'yemek-borusu',
    title: 'Yemek borusu duvarı',
    tissue: 'Yemek borusu duvarı',
    cell: 'Çok katlı yassı epitel',
    process: 'Yutma ve peristaltizm',
    system: 'digestive',
    summary: 'Lokmayı ağızdan mideye taşıyan kaslı tüp; iç yüzü sürtünmeye dayanıklı çok katlı yassı epitelle döşelidir.',
    structures: ['esophagus'],
    background: '#12070a',
    layers: [
      { key: 'lumen', name: 'Lümen', kind: 'lumen', thickness: 0.8, color: '#3a1a22', particle: '#f0c9a0', text: 'Yutulan lokmanın geçtiği boşluk. Boş yemek borusunda duvar katlanır ve lümen kapanır.' },
      { key: 'epitel', name: 'Çok katlı yassı epitel', kind: 'epi-squamous', thickness: 0.9, color: '#e8a7b2', text: 'Keratinsiz, çok katlı yassı epitel. En alttaki hücreler bölünür, yüzeye çıktıkça yassılaşıp dökülür; bu yapı lokmanın sürtünmesine dayanıklıdır. Mide asidine karşı ise korumasızdır.', size: 'Kalınlık ≈ 0,3–0,5 mm' },
      { key: 'lamina', name: 'Lamina propria', kind: 'connective', thickness: 0.5, color: '#caa0a8', vessels: true, text: 'Epitelin altındaki gevşek bağ dokusu; kılcal damarlar ve bağışıklık hücreleri içerir.' },
      { key: 'mm', name: 'Muskularis mukoza', kind: 'smooth-muscle', thickness: 0.3, color: '#b85c6e', arrangement: 'longitudinal', text: 'Mukozayı hareket ettiren ince düz kas tabakası.' },
      { key: 'submukoza', name: 'Submukoza ve özofagus bezleri', kind: 'glands', thickness: 0.9, color: '#d8b8a8', goblet: true, text: 'Damar ve sinirlerden zengin bağ dokusu. İçindeki küçük bezler kayganlaştırıcı mukus salgılar. Alt uçtaki toplardamarlar karaciğer hastalığında genişleyebilir (varis).' },
      { key: 'ic-kas', name: 'İç dairesel kas', kind: 'smooth-muscle', thickness: 0.8, color: '#a6485a', arrangement: 'circular', motion: 'peristalsis', text: 'Halka biçimli kas lifleri; kasılınca tüpü daraltır. Üst üçte bir çizgili (istemli), alt kısımlar düz kastır.' },
      { key: 'dis-kas', name: 'Dış uzunlamasına kas', kind: 'smooth-muscle', thickness: 0.7, color: '#943a4c', arrangement: 'longitudinal', motion: 'peristalsis', text: 'Boylamasına kas lifleri; tüpü kısaltır. İki kas tabakasının sıralı kasılması peristaltik dalgayı oluşturur.' },
      { key: 'adventisya', name: 'Adventisya', kind: 'connective', thickness: 0.4, color: '#b89a90', text: 'Yemek borusunu çevre dokulara bağlayan dış bağ dokusu. Karın içindeki kısa bölüm dışında seroza yoktur.' },
    ],
    process_stages: [
      { title: 'Peristaltik dalga', focus: 'ic-kas', text: 'Yutmadan sonra lokmanın hemen üstündeki dairesel kas kasılır, önündeki gevşer. Bu dalga yukarıdan aşağıya ilerleyerek lokmayı yaklaşık 5–8 saniyede mideye iter; baş aşağıyken bile çalışır.' },
      { title: 'Alt sfinkter ve reflü', focus: 'epitel', text: 'Yemek borusunun mideyle birleştiği yerdeki kas halkası (alt özofagus sfinkteri) lokma geçince gevşer, sonra kapanır. Yeterince kapanmazsa mide asidi geri kaçar (reflü) ve asite dayanıksız yassı epiteli tahriş eder.' },
    ],
    tests: [],
    caution: CAUTION,
  },
  'kalin-bagirsak': {
    id: 'kalin-bagirsak',
    title: 'Kalın bağırsak duvarı',
    tissue: 'Kolon mukozası',
    cell: 'Emici ve goblet hücreleri',
    process: 'Su emilimi ve mukus',
    system: 'digestive',
    summary: 'Kalın bağırsakta villus yoktur; düz yüzeyden derine uzanan kriptler (Lieberkühn bezleri) vardır. Başlıca görevleri su ve tuz emilimi ile dışkının kayganlaştırılmasıdır.',
    structures: ['large-intestine'],
    background: '#0f0a06',
    layers: [
      { key: 'lumen', name: 'Lümen', kind: 'lumen', thickness: 0.8, color: '#3a2a14', particle: '#b08a4a', text: 'Sindirilmemiş besin artıkları, su ve trilyonlarca bakteriden (bağırsak mikrobiyotası) oluşan içerik.' },
      { key: 'kriptler', name: 'Mukoza: kriptler', kind: 'crypts', thickness: 1.5, color: '#c9a67a', goblet: true, motion: 'secretion', text: 'Düz yüzeyden derine uzanan tüp biçimli bezler. Emici hücreler su ve tuzu geri alır; çok sayıdaki goblet hücresi dışkıyı kayganlaştıran mukusu salgılar. Kriptin dibindeki kök hücreler epiteli birkaç günde bir yeniler.', size: 'Kript derinliği ≈ 0,4–0,6 mm' },
      { key: 'lamina', name: 'Lamina propria', kind: 'connective', thickness: 0.4, color: '#b89070', vessels: true, text: 'Kriptler arasındaki bağ dokusu; bol bağışıklık hücresi içerir.' },
      { key: 'mm', name: 'Muskularis mukoza', kind: 'smooth-muscle', thickness: 0.25, color: '#a86a4a', arrangement: 'longitudinal', text: 'İnce düz kas tabakası.' },
      { key: 'submukoza', name: 'Submukoza', kind: 'connective', thickness: 0.7, color: '#d0b090', vessels: true, text: 'Büyük damarlar, lenf damarları ve sinir ağı (Meissner pleksusu).' },
      { key: 'ic-kas', name: 'İç dairesel kas', kind: 'smooth-muscle', thickness: 0.6, color: '#9a5a3c', arrangement: 'circular', motion: 'peristalsis', text: 'Bağırsağı halka biçiminde daraltan kas; içeriği karıştırır ve ilerletir.' },
      { key: 'tenya', name: 'Dış uzunlamasına kas (tenya koli)', kind: 'smooth-muscle', thickness: 0.5, color: '#8a4a30', arrangement: 'longitudinal', motion: 'peristalsis', text: 'Kalın bağırsakta uzunlamasına kas üç şerit (tenya koli) hâlinde toplanır; kolona boğumlu görünümünü verir.' },
      { key: 'seroza', name: 'Seroza', kind: 'serosa', thickness: 0.2, color: '#e0c8b0', text: 'Karın zarının bağırsağı saran ince yaprağı.' },
    ],
    process_stages: [
      { title: 'Su emilimi', focus: 'kriptler', text: 'Kalın bağırsağa günde yaklaşık 1–1,5 litre sıvı içerik gelir; bunun çoğu emici hücrelerce geri alınır ve dışkı katılaşır. İshalde bu emilim yetersiz kalır ya da salgı artar.' },
      { title: 'Mukus ve mikrobiyota', focus: 'kriptler', text: 'Goblet hücrelerinin mukusu, bakterilerle epitel arasında koruyucu bir tabaka oluşturur. Bağırsak bakterileri lifleri mayalayarak epitelin besini olan kısa zincirli yağ asitlerini üretir.' },
      { title: 'Kütle hareketleri', focus: 'tenya', text: 'Kalın bağırsak günde birkaç kez güçlü kasılmalarla içeriği ilerletir; bunlar genellikle yemekten sonra (gastrokolik refleks) olur.' },
    ],
    tests: [],
    caution: CAUTION,
  },
  'safra-kesesi': {
    id: 'safra-kesesi',
    title: 'Safra kesesi duvarı',
    tissue: 'Safra kesesi mukozası',
    cell: 'Silindirik epitel',
    process: 'Safranın yoğunlaştırılması',
    system: 'digestive',
    summary: 'Karaciğerde üretilen safrayı depolayan ve suyunu geri emerek yoğunlaştıran kese; yağlı yemekten sonra kasılır.',
    structures: ['gallbladder'],
    background: '#0a0c05',
    layers: [
      { key: 'lumen', name: 'Lümen (safra)', kind: 'lumen', thickness: 0.9, color: '#3a4a10', particle: '#9ab83a', text: 'Karaciğerde üretilen safra burada depolanır. Safra; safra tuzları, kolesterol, fosfolipit ve bilirubin içerir.' },
      { key: 'epitel', name: 'Basit silindirik epitel', kind: 'epi-columnar', thickness: 0.9, color: '#d8c890', motion: 'secretion', text: 'Tek sıra uzun hücreler; mikrovillusları suyu ve tuzu geri emerek safrayı 5–10 kat yoğunlaştırır. Mukoza boş kesede derin katlantılar yapar.', size: 'Hücre boyu ≈ 30 µm' },
      { key: 'lamina', name: 'Lamina propria', kind: 'connective', thickness: 0.5, color: '#c0b080', vessels: true, text: 'Kılcal damarlardan zengin gevşek bağ dokusu. Safra kesesinde muskularis mukoza ve submukoza yoktur.' },
      { key: 'kas', name: 'Düz kas tabakası', kind: 'smooth-muscle', thickness: 0.7, color: '#9a8a40', arrangement: 'random', motion: 'contract', text: 'Farklı yönlerde uzanan düz kas demetleri. Kolesistokinin (CCK) hormonuyla kasılarak safrayı bağırsağa gönderir.' },
      { key: 'perimuskuler', name: 'Perimusküler bağ dokusu', kind: 'connective', thickness: 0.6, color: '#b8a878', vessels: true, text: 'Damar, sinir ve lenf damarlarını taşıyan kalın bağ dokusu.' },
      { key: 'seroza', name: 'Seroza', kind: 'serosa', thickness: 0.2, color: '#e0d8b8', text: 'Karaciğere yapışık olmayan yüzeyi saran karın zarı.' },
    ],
    process_stages: [
      { title: 'Yoğunlaştırma', focus: 'epitel', text: 'Açken safra keseye dolar; epitel suyu geri emer. Safradaki kolesterol ile safra tuzlarının dengesi bozulursa kolesterol çökebilir ve taş oluşabilir.' },
      { title: 'Kasılma', focus: 'kas', text: 'Yağlı besin on iki parmak bağırsağına gelince CCK salınır; kese kasılır ve safra koledok yoluyla bağırsağa akar. Safra tuzları yağları sindirilebilir küçük damlacıklara ayırır.' },
      { title: 'Tahlillerle ilişki', focus: 'lumen', text: 'Safra akışı bir yerde engellenirse (ör. taş) direkt bilirubin, ALP ve GGT kanda yükselebilir. Bu tahliller engelin yerini göstermez; görüntüleme ile değerlendirilir.' },
    ],
    tests: ['bilirubin-direct', 'bilirubin-total', 'alp', 'ggt'],
    caution: CAUTION,
  },
  mesane: {
    id: 'mesane',
    title: 'Mesane duvarı',
    tissue: 'Mesane duvarı',
    cell: 'Ürotelyum (şemsiye hücreleri)',
    process: 'İdrarın depolanması ve boşaltılması',
    system: 'urinary',
    summary: 'İdrar yollarının iç yüzü, gerildiğinde yassılaşabilen özel bir epitelle (ürotelyum) döşelidir; mesane duvarındaki detrusor kası idrarı boşaltır.',
    structures: ['urinary-tract'],
    background: '#0c0a04',
    layers: [
      { key: 'lumen', name: 'Lümen (idrar)', kind: 'lumen', thickness: 0.9, color: '#3a3410', particle: '#f0e06a', text: 'Böbreklerde oluşan idrar üreterlerle gelir ve burada depolanır. Yetişkin mesanesi genellikle 300–500 ml alır.' },
      { key: 'urotel', name: 'Ürotelyum (değişici epitel)', kind: 'epi-transitional', thickness: 0.8, color: '#e0c8a0', text: 'Yüzeydeki iri, kubbe biçimli "şemsiye hücreleri" idrarın dokuya sızmasını engeller. Mesane dolunca hücreler yassılaşır ve epitel incelir; boşalınca yeniden kalınlaşır.', size: 'Şemsiye hücresi çapı ≈ 50–120 µm' },
      { key: 'lamina', name: 'Lamina propria', kind: 'connective', thickness: 0.5, color: '#c8b088', vessels: true, text: 'Esnek bağ dokusu ve damarlar.' },
      { key: 'detrusor', name: 'Detrusor kası', kind: 'smooth-muscle', thickness: 1.3, color: '#a88848', arrangement: 'random', motion: 'contract', text: 'Birbirine karışan üç düz kas tabakası. İşeme sırasında parasempatik sinirlerle kasılarak idrarı boşaltır.' },
      { key: 'seroza', name: 'Seroza / adventisya', kind: 'serosa', thickness: 0.25, color: '#e0d0b0', text: 'Üst yüzde karın zarı, diğer yüzlerde bağ dokusu.' },
    ],
    process_stages: [
      { title: 'Dolma', focus: 'urotel', text: 'Mesane dolarken detrusor gevşek kalır, epitel yassılaşarak yüzey genişler. Duvardaki gerilme alıcıları doluluk bilgisini omuriliğe ve beyne iletir.' },
      { title: 'Boşaltma', focus: 'detrusor', text: 'İşeme kararıyla detrusor kasılır, iç ve dış sfinkterler gevşer ve idrar üretradan dışarı akar.' },
    ],
    tests: [],
    caution: CAUTION,
  },
  prostat: {
    id: 'prostat',
    title: 'Prostat bezi',
    tissue: 'Prostat dokusu',
    cell: 'Bez epiteli',
    process: 'Prostat salgısı (PSA)',
    system: 'reproductive',
    summary: 'Üretrayı saran bez; meni sıvısının bir kısmını ve PSA (prostata özgü antijen) enzimini üretir.',
    structures: ['prostate'],
    background: '#0e0806',
    layers: [
      { key: 'bezler', name: 'Tübüloalveoler bezler', kind: 'glands', thickness: 1.8, color: '#e0b890', motion: 'secretion', text: 'Katlantılı bez boşlukları; iki sıra hücreyle döşelidir: salgı yapan uzun luminal hücreler ve altta bazal hücreler. Yaşla birlikte bez içinde "korpora amilasea" denen katmanlı cisimcikler birikebilir.', size: 'Bez boşluğu ≈ 0,1–1 mm' },
      { key: 'stroma', name: 'Fibromüsküler stroma', kind: 'smooth-muscle', thickness: 1.0, color: '#b07a5a', arrangement: 'random', motion: 'contract', text: 'Bezlerin arasındaki düz kas ve bağ dokusu. Boşalma sırasında kasılarak salgıyı üretraya iter.' },
      { key: 'kapsul', name: 'Kapsül', kind: 'capsule', thickness: 0.35, color: '#c8a888', text: 'Prostatı saran yoğun bağ dokusu ve düz kas kılıfı.' },
    ],
    process_stages: [
      { title: 'PSA salgısı', focus: 'bezler', text: 'Luminal hücreler PSA\'yı bez boşluğuna salgılar; PSA meniyi sıvılaştıran bir enzimdir. Normalde çok az bir kısmı kana geçer. Prostat büyümesi, iltihabı ve kanseri kandaki PSA\'yı artırabilir; PSA tek başına tanı koydurmaz.' },
      { title: 'Yaşla büyüme', focus: 'stroma', text: 'Testosteronun dokudaki güçlü biçimi (DHT) etkisiyle üretrayı saran bölgedeki bez ve stroma yaşla çoğalır (iyi huylu prostat büyümesi); idrar akımını zorlaştırabilir.' },
    ],
    tests: ['psa', 'testosterone'],
    caution: CAUTION,
  },
  rahim: {
    id: 'rahim',
    title: 'Rahim duvarı',
    tissue: 'Endometrium ve miyometrium',
    cell: 'Endometrium bezleri',
    process: 'Adet döngüsü',
    system: 'reproductive',
    summary: 'Rahim iç zarı (endometrium) her döngüde östrojenle kalınlaşır, progesteronla gebeliğe hazırlanır; gebelik olmazsa dökülür.',
    structures: ['uterus'],
    background: '#12060a',
    layers: [
      { key: 'lumen', name: 'Rahim boşluğu', kind: 'lumen', thickness: 0.6, color: '#3a1420', particle: '#f0a0b8', text: 'Endometriumla çevrili, gebelikte embriyonun yerleştiği boşluk.' },
      { key: 'epitel', name: 'Yüzey epiteli', kind: 'epi-columnar', thickness: 0.4, color: '#f0b8c8', text: 'Endometriumu örten tek sıra silindirik epitel; bazı hücreleri sillidir.' },
      { key: 'fonksiyonel', name: 'Fonksiyonel tabaka', kind: 'glands', thickness: 1.4, color: '#e090a8', motion: 'secretion', vessels: true, text: 'Döngü boyunca kalınlaşan ve adette dökülen tabaka. Bezler ve kıvrımlı spiral arterler içerir; salgı evresinde bezler besleyici salgı üretir.', size: 'Kalınlık ≈ 1–7 mm (döngüye göre)' },
      { key: 'bazal', name: 'Bazal tabaka', kind: 'connective', thickness: 0.5, color: '#c87890', text: 'Dökülmeyen derin tabaka; her döngüde fonksiyonel tabaka buradan yeniden oluşur.' },
      { key: 'miyometrium', name: 'Miyometrium', kind: 'smooth-muscle', thickness: 1.5, color: '#a84868', arrangement: 'random', motion: 'contract', text: 'Rahmin kalın düz kas duvarı. Adette hafif, doğumda (oksitosinle) güçlü kasılır.' },
      { key: 'perimetrium', name: 'Perimetrium', kind: 'serosa', thickness: 0.2, color: '#e8c8d0', text: 'Rahmi dıştan saran karın zarı.' },
    ],
    process_stages: [
      { title: 'Çoğalma evresi', focus: 'fonksiyonel', text: 'Adetten sonra yumurtalıktaki gelişen folikülün salgıladığı östrojenle fonksiyonel tabaka ve bezler çoğalır, endometrium kalınlaşır.' },
      { title: 'Salgı evresi', focus: 'fonksiyonel', text: 'Yumurtlamadan sonra sarı cisimciğin progesteronu bezleri kıvrımlı ve salgılı hâle getirir; doku embriyonun yerleşmesine hazırlanır. Gebelikte hCG sarı cisimciği korur.' },
      { title: 'Adet', focus: 'bazal', text: 'Gebelik olmazsa progesteron düşer, spiral arterler büzülür ve fonksiyonel tabaka dökülür; bazal tabaka kalır ve yeni döngü başlar.' },
    ],
    tests: ['estradiol', 'progesterone', 'bhcg', 'fsh', 'lh'],
    caution: CAUTION,
  },
  tuba: {
    id: 'tuba',
    title: 'Fallop tüpü',
    tissue: 'Tüp mukozası',
    cell: 'Silli hücreler',
    process: 'Yumurtanın taşınması',
    system: 'reproductive',
    summary: 'Yumurtalıktan çıkan yumurtayı yakalayıp rahme taşıyan tüp; döllenme genellikle burada (ampulla) olur.',
    structures: ['fallopian-tubes'],
    background: '#10060c',
    layers: [
      { key: 'lumen', name: 'Lümen', kind: 'lumen', thickness: 0.8, color: '#3a1830', particle: '#f8d0e0', text: 'Yumurta ve spermlerin karşılaştığı dar, katlantılı boşluk.' },
      { key: 'epitel', name: 'Silli silindirik epitel', kind: 'epi-ciliated', thickness: 0.8, color: '#f0b0cc', motion: 'cilia', text: 'Silli hücrelerin kamçı benzeri uzantıları rahme doğru çırpar; aradaki salgı (peg) hücreleri yumurtayı besleyen sıvıyı üretir. Östrojen silleri artırır.' },
      { key: 'lamina', name: 'Lamina propria (katlantılar)', kind: 'connective', thickness: 0.6, color: '#d098b0', vessels: true, text: 'Özellikle ampullada çok katlantılı mukozanın bağ dokusu.' },
      { key: 'kas', name: 'Düz kas', kind: 'smooth-muscle', thickness: 0.7, color: '#a85a80', arrangement: 'circular', motion: 'peristalsis', text: 'İç dairesel, dış uzunlamasına kas; peristaltik kasılmalar sillere yardım eder.' },
      { key: 'seroza', name: 'Seroza', kind: 'serosa', thickness: 0.2, color: '#e8c8d8', text: 'Tüpü saran karın zarı.' },
    ],
    process_stages: [
      { title: 'Taşıma', focus: 'epitel', text: 'Sillerin çırpması ve kas kasılmaları yumurtayı birkaç günde rahme doğru ilerletir. Tüpte hasar (ör. geçirilmiş enfeksiyon) bu taşımayı bozabilir.' },
    ],
    tests: ['estradiol', 'progesterone'],
    caution: CAUTION,
  },
  vajina: {
    id: 'vajina',
    title: 'Vajina duvarı',
    tissue: 'Vajina mukozası',
    cell: 'Çok katlı yassı epitel',
    process: 'Östrojen ve koruyucu asidik ortam',
    system: 'reproductive',
    summary: 'Çok katlı yassı epitelle döşeli, esnek kaslı kanal; bezi yoktur, nemi damarlardan sızan sıvı ve rahim ağzı mukusu sağlar.',
    structures: ['vagina'],
    background: '#12060a',
    layers: [
      { key: 'lumen', name: 'Lümen', kind: 'lumen', thickness: 0.7, color: '#3a1822', particle: '#f0c0d0', text: 'Laktobasillerin baskın olduğu, asidik (pH ≈ 3,8–4,5) ortam.' },
      { key: 'epitel', name: 'Çok katlı yassı epitel', kind: 'epi-squamous', thickness: 1.0, color: '#f0b0c0', text: 'Östrojen epiteli kalınlaştırır ve hücrelerde glikojen biriktirir; laktobasiller glikojenden laktik asit üretir. Menopozda östrojen azalınca epitel incelir.' },
      { key: 'lamina', name: 'Lamina propria', kind: 'connective', thickness: 0.8, color: '#d08898', vessels: true, text: 'Elastik liflerden ve geniş toplardamar ağından zengin bağ dokusu.' },
      { key: 'kas', name: 'Düz kas', kind: 'smooth-muscle', thickness: 0.8, color: '#a85068', arrangement: 'longitudinal', text: 'Dairesel ve uzunlamasına düz kas demetleri.' },
      { key: 'adventisya', name: 'Adventisya', kind: 'connective', thickness: 0.4, color: '#c8a0a8', text: 'Çevre dokulara bağlanan dış bağ dokusu.' },
    ],
    process_stages: [
      { title: 'Östrojen etkisi', focus: 'epitel', text: 'Östrojen yüksekken epitel kalın ve glikojenden zengindir; asidik ortam zararlı mikropların çoğalmasını zorlaştırır.' },
    ],
    tests: ['estradiol'],
    caution: CAUTION,
  },
  meme: {
    id: 'meme',
    title: 'Meme dokusu',
    tissue: 'Meme bezi',
    cell: 'Luminal ve miyoepitel hücreler',
    process: 'Süt yapımı ve hormonlar',
    system: 'reproductive',
    summary: 'Süt kanalları ve lobüllerden oluşan bez dokusu, yağ ve bağ dokusu içinde yer alır; gelişimi ve çalışması hormonlarla düzenlenir.',
    structures: ['breasts'],
    background: '#12080a',
    layers: [
      { key: 'kanal', name: 'Süt kanalı', kind: 'epi-cuboidal', thickness: 0.6, color: '#f0c0c8', text: 'İki sıra hücre: içte salgı yapan luminal hücreler, dışta kasılabilen miyoepitel hücreleri. Kanallar meme başına açılır.' },
      { key: 'lobul', name: 'Lobül (asinuslar)', kind: 'glands', thickness: 1.2, color: '#f0a8b8', motion: 'secretion', text: 'Terminal duktal lobüler birim: sütün yapıldığı küçük kesecikler. Gebelik ve emzirmede sayıları ve boyutları çok artar.' },
      { key: 'stroma', name: 'Lobül çevresi stroma', kind: 'connective', thickness: 0.6, color: '#d8a8a8', vessels: true, text: 'Lobülleri saran gevşek bağ dokusu ve damarlar.' },
      { key: 'yag', name: 'Yağ dokusu', kind: 'fat', thickness: 1.4, color: '#f5e0a8', text: 'Memenin hacminin büyük kısmını yağ dokusu oluşturur; oranı kişiden kişiye ve yaşla değişir.' },
    ],
    process_stages: [
      { title: 'Hormonların etkisi', focus: 'kanal', text: 'Östrojen kanalların, progesteron lobüllerin gelişimini uyarır; bu yüzden döngü içinde meme dokusu hafif değişir.' },
      { title: 'Süt yapımı ve akışı', focus: 'lobul', text: 'Doğumdan sonra hipofizin prolaktini luminal hücrelere süt yaptırır; emzirmede salınan oksitosin miyoepitel hücrelerini kasarak sütü kanallara iter. Gebelik dışı yüksek prolaktin de süt gelmesine yol açabilir.' },
    ],
    tests: ['prolactin', 'estradiol', 'progesterone'],
    caution: CAUTION,
  },
  'eklem-kikirdagi': {
    id: 'eklem-kikirdagi',
    title: 'Eklem kıkırdağı',
    tissue: 'Hiyalin kıkırdak',
    cell: 'Kondrositler',
    process: 'Yük taşıma ve kıkırdak aşınması',
    system: 'musculoskeletal',
    summary: 'Diz eklemindeki kemik uçlarını kaplayan, damarsız ve çok kaygan kıkırdak; yükü yayar, sürtünmeyi azaltır.',
    structures: ['knee'],
    background: '#070a10',
    layers: [
      { key: 'sivi', name: 'Eklem sıvısı', kind: 'lumen', thickness: 0.7, color: '#1a2a3a', particle: '#e0f0ff', text: 'Eklem zarının (sinovyum) ürettiği kaygan sıvı; kıkırdağı besler ve yağlar.' },
      { key: 'yuzeyel', name: 'Yüzeyel bölge', kind: 'cartilage', thickness: 0.5, color: '#bcd4f0', arrangement: 'flat', text: 'Yüzeye paralel yassı kondrositler ve kolajen lifleri; kaymayı sağlar ve çekme kuvvetlerine direnir.' },
      { key: 'orta', name: 'Orta bölge', kind: 'cartilage', thickness: 0.8, color: '#a8c4e8', arrangement: 'random', text: 'Yuvarlak kondrositler ve çapraz uzanan lifler; basıncı karşılar.' },
      { key: 'derin', name: 'Derin bölge', kind: 'cartilage', thickness: 0.9, color: '#94b4e0', arrangement: 'columns', text: 'Sütunlar hâlinde dizilmiş kondrositler; kemiğe dik lifler basıncı alttaki kemiğe aktarır.' },
      { key: 'kalsifiye', name: 'Kalsifiye kıkırdak', kind: 'cartilage', thickness: 0.3, color: '#c8c0a8', arrangement: 'random', text: 'Kıkırdağı kemiğe bağlayan mineralli ince bölge ("tidemark" çizgisinin altı).' },
      { key: 'kemik', name: 'Subkondral kemik', kind: 'bone', thickness: 0.8, color: '#e8e0c8', text: 'Kıkırdağı taşıyan kemik tabakası. Kemik iç yapısı Osteon sahnesinde anlatılır.' },
    ],
    process_stages: [
      { title: 'Yük altında', focus: 'orta', text: 'Adım atarken kıkırdak bir sünger gibi sıkışır, sıvı dışarı çıkar; yük kalkınca geri emer. Kıkırdağın damarı yoktur, beslenmesi bu sıvı hareketine bağlıdır.' },
      { title: 'Aşınma (osteoartrit)', focus: 'yuzeyel', text: 'Yıllar içinde yüzey lifleri aşınabilir, kondrositler kaybolur ve kıkırdak incelir. Kıkırdak kendini çok sınırlı onardığı için bu değişiklikler yavaş ilerler. Menisküsler (fibrokıkırdak) ve bağlar 3B modelde ayrı parçalar olarak görülebilir.' },
    ],
    tests: ['uric-acid', 'crp'],
    caution: CAUTION,
  },
  'solunum-yolu': {
    id: 'solunum-yolu',
    title: 'Bronş duvarı',
    tissue: 'Solunum yolu mukozası',
    cell: 'Silli ve goblet hücreleri',
    process: 'Mukosiliyer temizlik',
    system: 'respiratory',
    summary: 'Nefes borusu ve bronşların iç yüzü silli hücreler ve mukus salgılayan hücrelerle döşelidir; soluduğumuz tozu ve mikropları yakalayıp dışarı taşır.',
    structures: ['airways'],
    background: '#06090f',
    layers: [
      { key: 'lumen', name: 'Hava yolu', kind: 'lumen', thickness: 0.8, color: '#10203a', particle: '#c8d8f0', text: 'Solunan havanın geçtiği boşluk. Hava burada ısınır ve nemlenir.' },
      { key: 'epitel', name: 'Silli yalancı çok katlı epitel', kind: 'epi-ciliated', thickness: 0.8, color: '#a8c0f0', goblet: true, motion: 'cilia', text: 'Her silli hücrede ~200 sil vardır; saniyede 10–20 kez çırparak mukusu gırtlağa doğru taşır. Aradaki goblet hücreleri yapışkan mukus salgılar. Sigara dumanı silleri felç eder.' },
      { key: 'lamina', name: 'Lamina propria', kind: 'connective', thickness: 0.4, color: '#90a8d0', vessels: true, text: 'Damar ve bağışıklık hücrelerinden zengin bağ dokusu.' },
      { key: 'kas', name: 'Düz kas', kind: 'smooth-muscle', thickness: 0.4, color: '#7088c0', arrangement: 'circular', motion: 'contract', text: 'Bronşu saran düz kas; astım atağında kasılarak hava yolunu daraltır.' },
      { key: 'bezler', name: 'Submukozal bezler', kind: 'glands', thickness: 0.7, color: '#b0c0e0', motion: 'secretion', text: 'Mukus ve sulu salgı yapan bezler.' },
      { key: 'kikirdak', name: 'Kıkırdak halka / plak', kind: 'cartilage', thickness: 0.7, color: '#c0d4f0', arrangement: 'random', text: 'Hava yolunun kapanmasını önleyen hiyalin kıkırdak; nefes borusunda C biçimli halkalar, bronşlarda düzensiz plaklar.' },
    ],
    process_stages: [
      { title: 'Mukosiliyer temizlik', focus: 'epitel', text: 'Toz ve mikroplar mukusa yapışır; siller bu mukus tabakasını dakikada birkaç milimetre hızla yukarı taşır. Yutulur ya da öksürükle atılır.' },
      { title: 'Bronş daralması', focus: 'kas', text: 'Alerji veya tahriş düz kası kastırıp mukus salgısını artırabilir; bu hava akımını zorlaştırır (hırıltı).' },
    ],
    tests: [],
    caution: CAUTION,
  },
  timus: {
    id: 'timus',
    title: 'Timus lobülü',
    tissue: 'Timus dokusu',
    cell: 'T hücresi öncülleri (timositler)',
    process: 'T hücresi eğitimi',
    system: 'immune',
    summary: 'T lenfositlerinin olgunlaştığı ve "kendine saldırmamayı" öğrendiği organ; çocuklukta büyük, yetişkinlikte giderek yağ dokusuna dönüşür.',
    structures: ['thymus'],
    background: '#0a0612',
    layers: [
      { key: 'kapsul', name: 'Kapsül ve bölmeler', kind: 'capsule', thickness: 0.35, color: '#c0b0d8', text: 'Timusu lobüllere ayıran bağ dokusu.' },
      { key: 'korteks', name: 'Korteks', kind: 'lymphoid', thickness: 1.6, color: '#8a70d0', text: 'Yoğun paketlenmiş genç T hücreleri (timositler) ve onları eğiten epitel retiküler hücreler. Burada T hücreleri antijen tanıma yeteneğine göre seçilir.' },
      { key: 'medulla', name: 'Medulla', kind: 'lymphoid', thickness: 1.2, color: '#b0a0e0', text: 'Daha seyrek hücreli iç bölge. Vücudun kendi proteinlerine saldıracak T hücreleri burada elenir. Hassall cisimcikleri bu bölgeye özgüdür.' },
    ],
    process_stages: [
      { title: 'Seçilim', focus: 'korteks', text: 'Kemik iliğinden gelen öncül hücrelerin yalnızca küçük bir kısmı (≈ %2–5) seçilimi geçip olgun T hücresi olarak kana çıkar; diğerleri ölür.' },
      { title: 'Yaşla küçülme', focus: 'medulla', text: 'Ergenlikten sonra timus giderek küçülür ve yağ dokusuyla dolar; T hücresi havuzu büyük ölçüde erken yaşlarda oluşmuştur.' },
    ],
    tests: ['lymphocyte-abs', 'lymphocyte-pct', 'wbc'],
    caution: CAUTION,
  },
  bademcik: {
    id: 'bademcik',
    title: 'Bademcik',
    tissue: 'Bademcik dokusu',
    cell: 'Lenfositler',
    process: 'Ağızdan giren antijenlerin örneklenmesi',
    system: 'immune',
    summary: 'Boğazın girişindeki lenf dokusu; yüzeyindeki derin kriptlerle ağız ve burundan gelen mikropları örnekler.',
    structures: ['tonsils'],
    background: '#0c0610',
    layers: [
      { key: 'lumen', name: 'Ağız boşluğu / kript', kind: 'lumen', thickness: 0.6, color: '#2a1830', particle: '#e8d0f0', text: 'Yüzeyden derine uzanan kriptler, yiyecek ve mikrop parçalarının bağışıklık hücreleriyle karşılaştığı yerlerdir.' },
      { key: 'epitel', name: 'Çok katlı yassı epitel', kind: 'epi-squamous', thickness: 0.6, color: '#e0b8d0', text: 'Ağız boşluğunun devamı olan epitel; kriptlerde incelir ve lenfositlerle iç içe geçer.' },
      { key: 'folikuller', name: 'Lenf folikülleri', kind: 'lymphoid', thickness: 1.6, color: '#9a78c8', text: 'Açık renkli germinal merkezleri olan B hücresi folikülleri. Enfeksiyonda büyüyüp kızarabilirler.' },
      { key: 'kapsul', name: 'Kapsül', kind: 'capsule', thickness: 0.35, color: '#c0a8d0', text: 'Bademciği alttaki kaslardan ayıran bağ dokusu.' },
    ],
    process_stages: [
      { title: 'Antijen örnekleme', focus: 'folikuller', text: 'Kriptlerdeki özel hücreler mikrop parçalarını foliküllere iletir; B hücreleri çoğalır ve IgA gibi antikorlar üretilir. Ayrıntılı bağışıklık yanıtı Lenf düğümü sahnesinde anlatılır.' },
    ],
    tests: ['wbc', 'crp'],
    caution: CAUTION,
  },
  hipofiz: {
    id: 'hipofiz',
    title: 'Hipofiz bezi',
    tissue: 'Hipofiz dokusu',
    cell: 'Hormon hücreleri',
    process: 'Hipotalamus–hipofiz ekseni',
    system: 'endocrine',
    summary: 'Ön lobu (adenohipofiz) hormon yapan hücrelerden, arka lobu (nörohipofiz) hipotalamustan gelen sinir uzantılarından oluşur.',
    structures: ['pituitary'],
    background: '#0a0714',
    layers: [
      { key: 'on-lob', name: 'Ön lob (adenohipofiz)', kind: 'cords', thickness: 1.5, color: '#b8a0f0', arrangement: 'clusters', text: 'Kordonlar hâlinde dizilmiş beş tür hormon hücresi: TSH, ACTH, FSH/LH, büyüme hormonu ve prolaktin yapanlar. Hücrelerin boyanma özelliğine göre asidofil, bazofil ve kromofob diye ayrılırlar.' },
      { key: 'portal', name: 'Portal kılcallar', kind: 'sinusoids', thickness: 0.7, color: '#c04060', motion: 'flow', text: 'Hipotalamusun salgıladığı "salgılatıcı" hormonları doğrudan ön loba taşıyan özel damar ağı.' },
      { key: 'arka-lob', name: 'Arka lob (nörohipofiz)', kind: 'neural', thickness: 1.2, color: '#8fa8e8', text: 'Hipotalamustaki sinir hücrelerinin aksonları ve destek hücreleri (pitüsitler). ADH ve oksitosin burada depolanıp kana verilir.' },
    ],
    process_stages: [
      { title: 'Salgılatıcı hormonlar', focus: 'portal', text: 'Hipotalamus TRH, CRH, GnRH gibi hormonları portal damarlara bırakır; bunlar ön lob hücrelerini uyarır. Dopamin ise prolaktini baskılar.' },
      { title: 'Geri bildirim', focus: 'on-lob', text: 'Hedef bezlerin hormonları (ör. tiroid hormonu, kortizol) yükselince hipofiz ve hipotalamus salgıyı azaltır. Bu yüzden TSH ile serbest T4 birlikte yorumlanır. Ayrıntılı döngü Hormon salgısı sahnesinde.' },
    ],
    tests: ['tsh', 'prolactin', 'fsh', 'lh', 'cortisol'],
    caution: CAUTION,
  },
  'bobrek-ustu': {
    id: 'bobrek-ustu',
    title: 'Böbrek üstü bezi',
    tissue: 'Böbrek üstü bezi',
    cell: 'Korteks ve medulla hücreleri',
    process: 'Kortizol, aldosteron ve adrenalin',
    system: 'endocrine',
    summary: 'Dıştaki korteks üç bölgede steroid hormonlar yapar; içteki medulla adrenalin ve noradrenalin salgılar.',
    structures: ['adrenals'],
    background: '#0f0b04',
    layers: [
      { key: 'kapsul', name: 'Kapsül', kind: 'capsule', thickness: 0.3, color: '#d8c8a0', text: 'Bezi saran bağ dokusu.' },
      { key: 'glomeruloza', name: 'Zona glomerulosa', kind: 'cords', thickness: 0.6, color: '#f0d070', arrangement: 'clusters', text: 'Küme hâlindeki hücreler aldosteron yapar; aldosteron böbreğin tuz tutmasını ve potasyum atmasını sağlar (renin–anjiyotensin sistemiyle düzenlenir).' },
      { key: 'fasikulata', name: 'Zona fasciculata', kind: 'cords', thickness: 1.3, color: '#f2c462', arrangement: 'columns', text: 'Uzun sütunlar hâlinde, yağ damlacıklarından zengin hücreler. ACTH ile uyarılarak kortizol yapar.' },
      { key: 'retikularis', name: 'Zona reticularis', kind: 'cords', thickness: 0.6, color: '#d8a048', arrangement: 'network', text: 'Ağ biçimli hücre kordonları; DHEA-S gibi zayıf androjenler üretir.' },
      { key: 'medulla', name: 'Medulla', kind: 'dense-cells', thickness: 0.9, color: '#b07840', text: 'Kromaffin hücreleri stres anında sempatik sinirlerle uyarılır ve adrenalin, noradrenalin salgılar.' },
    ],
    process_stages: [
      { title: 'Kortizol', focus: 'fasikulata', text: 'Hipofizden gelen ACTH kortizol yapımını artırır; kortizol sabah en yüksek, gece en düşüktür. Bu yüzden kortizol tahlilinde saat önemlidir.' },
      { title: 'Aldosteron ve tuz', focus: 'glomeruloza', text: 'Tansiyon düşünce böbrekten salınan renin aldosteronu artırır; sodyum tutulur, potasyum atılır.' },
      { title: 'Stres yanıtı', focus: 'medulla', text: 'Ani stres sempatik sinirlerle medullayı uyarır; adrenalin kalp atışını ve kan şekerini saniyeler içinde artırır.' },
    ],
    tests: ['cortisol', 'dhea-s', 'sodium', 'potassium'],
    caution: CAUTION,
  },
  epifiz: {
    id: 'epifiz',
    title: 'Epifiz bezi',
    tissue: 'Epifiz dokusu',
    cell: 'Pinealositler',
    process: 'Melatonin ve gün–gece ritmi',
    system: 'endocrine',
    summary: 'Beynin ortasındaki küçük bez; karanlıkta melatonin salgılayarak uyku–uyanıklık ritmine katkıda bulunur.',
    structures: ['pineal'],
    background: '#050d0c',
    layers: [
      { key: 'kapsul', name: 'Pia mater kapsülü', kind: 'capsule', thickness: 0.3, color: '#a0d0c8', text: 'Bezi saran beyin zarı; bölmeleri bezi lobüllere ayırır.' },
      { key: 'pinealosit', name: 'Pinealosit lobülleri', kind: 'cords', thickness: 1.6, color: '#8fe3d6', arrangement: 'clusters', text: 'Melatonin yapan pinealositler kordonlar ve kümeler hâlinde dizilir.' },
      { key: 'glia', name: 'Glia ve kılcallar', kind: 'neural', thickness: 0.8, color: '#70b8b0', text: 'Destek (astrosit benzeri) hücreler ve sempatik sinir uçları. Yaşla birlikte "beyin kumu" denen kalsiyum birikintileri görülebilir; bunlar röntgen ve BT\'de fark edilir ve genellikle önemsizdir.' },
    ],
    process_stages: [
      { title: 'Karanlıkta melatonin', focus: 'pinealosit', text: 'Gözdeki ışığa duyarlı hücreler karanlığı algılayınca hipotalamus üzerinden sempatik sinirler epifizi uyarır ve melatonin salınır. Gece ışığı melatonini baskılar.' },
    ],
    tests: [],
    caution: CAUTION,
  },
  dalak: {
    id: 'dalak',
    title: 'Dalak dokusu',
    tissue: 'Dalak pulpası',
    cell: 'Makrofajlar ve lenfositler',
    process: 'Kanın süzülmesi',
    system: 'immune',
    summary: 'Kanı süzen organ: kırmızı pulpa yaşlı alyuvarları ayıklar, beyaz pulpa kandaki mikroplara karşı bağışıklık yanıtı başlatır.',
    structures: ['spleen'],
    background: '#100508',
    layers: [
      { key: 'kapsul', name: 'Kapsül ve trabeküller', kind: 'capsule', thickness: 0.35, color: '#d0a0a8', text: 'Dalağı saran bağ dokusu; içeri uzanan trabeküller damarları taşır.' },
      { key: 'beyaz', name: 'Beyaz pulpa', kind: 'lymphoid', thickness: 1.2, color: '#b0a0e0', text: 'Atardamarları saran T hücresi kılıfları ve B hücresi folikülleri. Kanla gelen mikroplara karşı antikor üretilir.' },
      { key: 'kirmizi', name: 'Kırmızı pulpa', kind: 'sinusoids', thickness: 1.6, color: '#b02840', motion: 'flow', text: 'Kordonlar ve geniş sinüzoitler. Esnekliğini yitirmiş yaşlı alyuvarlar dar aralıklardan geçemez ve makrofajlarca yıkılır; hemoglobinden bilirubin oluşur. Trombositlerin yaklaşık üçte biri burada depolanır.' },
    ],
    process_stages: [
      { title: 'Alyuvar ayıklama', focus: 'kirmizi', text: 'Yaklaşık 120 günlük ömrünü dolduran alyuvarlar burada yıkılır; demir geri kazanılır, hem ise bilirubine dönüşür (indirekt bilirubin). Aşırı yıkımda anemi ve indirekt bilirubin artışı görülebilir.' },
      { title: 'Büyüme', focus: 'kirmizi', text: 'Dalak büyürse (splenomegali) daha fazla kan hücresi tutabilir; trombosit ve akyuvar sayısı düşebilir. Ayrıntılı kan hücreleri Kan hücreleri sahnesinde.' },
    ],
    tests: ['hemoglobin', 'platelet', 'bilirubin-indirect', 'wbc'],
    caution: CAUTION,
  },
  'ven-duvari': {
    id: 'ven-duvari',
    title: 'Toplardamar duvarı',
    tissue: 'Toplardamar duvarı',
    cell: 'Endotel ve düz kas',
    process: 'Kanın kalbe dönüşü',
    system: 'cardiovascular',
    summary: 'Toplardamarların duvarı atardamarlardan incedir; kol ve bacak toplardamarlarındaki kapakçıklar kanın geri akmasını önler.',
    structures: ['veins', 'limb-vessels'],
    background: '#05070f',
    layers: [
      { key: 'lumen', name: 'Lümen (kan)', kind: 'lumen', thickness: 1.2, color: '#2a0810', particle: '#c8323f', text: 'Oksijeni azalmış kan kalbe doğru, düşük basınçla akar. Toplardamarlar vücuttaki kanın yaklaşık üçte ikisini barındırır.' },
      { key: 'intima', name: 'Tunika intima (endotel)', kind: 'endothelium', thickness: 0.25, color: '#e0b0b8', text: 'İç yüzü döşeyen tek sıra yassı hücre. Kapakçıklar bu tabakanın katlanmasıyla oluşur.' },
      { key: 'media', name: 'Tunika media', kind: 'smooth-muscle', thickness: 0.5, color: '#a04858', arrangement: 'circular', text: 'Atardamara göre ince düz kas tabakası; toplardamar bu yüzden kolay genişler.' },
      { key: 'adventisya', name: 'Tunika adventisya', kind: 'connective', thickness: 1.0, color: '#b89098', vessels: true, text: 'Toplardamarın en kalın tabakası; kolajen lifler ve duvarı besleyen küçük damarlar.' },
    ],
    process_stages: [
      { title: 'Kas pompası ve kapakçıklar', focus: 'lumen', text: 'Yürürken bacak kasları toplardamarları sıkar; kapakçıklar kanın yalnızca kalbe doğru akmasına izin verir. Kapakçıklar yetersizleşirse kan göllenir ve varis oluşabilir.' },
      { title: 'Pıhtı riski', focus: 'intima', text: 'Uzun hareketsizlik, damar hasarı ya da pıhtılaşma eğilimi derin toplardamarlarda pıhtıya (DVT) yol açabilir. Atardamarlardaki plak (ateroskleroz) ise toplardamarlarda görülmez; o süreç Damar içi sahnesinde anlatılır.' },
    ],
    tests: ['inr', 'aptt'],
    caution: CAUTION,
  },
  'pankreas-asinus': {
    id: 'pankreas-asinus',
    title: 'Pankreas asinusu',
    tissue: 'Ekzokrin pankreas',
    cell: 'Asinus hücreleri',
    process: 'Sindirim enzimleri (amilaz, lipaz)',
    system: 'digestive',
    summary: 'Pankreasın %98\'i sindirim enzimleri yapan asinuslardan oluşur; insülin yapan adacıklar bu dokunun içine serpilmiştir.',
    structures: ['pancreas'],
    background: '#0f0b05',
    layers: [
      { key: 'kanal', name: 'Pankreas kanalı', kind: 'epi-cuboidal', thickness: 0.5, color: '#e8d090', motion: 'secretion', text: 'Kanal hücreleri bikarbonattan zengin sıvı salgılayarak mide asidini nötralize eder; enzimler bu sıvıyla on iki parmak bağırsağına akar.' },
      { key: 'asinus', name: 'Asinuslar', kind: 'glands', thickness: 1.8, color: '#e8b060', motion: 'secretion', text: 'Üzüm salkımı gibi kümelenmiş hücreler; tepelerindeki zimojen granülleri etkisiz enzim öncüllerini (tripsinojen, amilaz, lipaz) depolar.' },
      { key: 'stroma', name: 'Bağ dokusu ve damarlar', kind: 'connective', thickness: 0.6, color: '#c8a870', vessels: true, text: 'Lobülleri ayıran ince bağ dokusu. İnsülin yapan Langerhans adacıkları asinusların arasındadır (Langerhans adacığı sahnesi).' },
    ],
    process_stages: [
      { title: 'Enzim salgısı', focus: 'asinus', text: 'Yemek sırasında hormon ve sinir uyarısıyla granüller kanala boşalır. Enzimler bağırsakta etkinleşir; böylece pankreas kendini sindirmez.' },
      { title: 'Pankreatit ve tahliller', focus: 'kanal', text: 'Pankreas iltihaplandığında enzimler dokuya ve kana sızar; kanda lipaz ve amilaz yükselir. Yükseklik tanı için hekimin muayenesi ve görüntülemeyle birlikte değerlendirilir.' },
    ],
    tests: ['lipase', 'amylase'],
    caution: CAUTION,
  },
  'erkek-uretim-yolu': {
    id: 'erkek-uretim-yolu',
    title: 'Sperm kanalı (vas deferens)',
    tissue: 'Vas deferens duvarı',
    cell: 'Stereosilli epitel',
    process: 'Spermin taşınması',
    system: 'reproductive',
    summary: 'Spermleri epididimden üretraya taşıyan kalın kaslı kanal; yolda seminal veziküllerin salgısı eklenir.',
    structures: ['male-genitals'],
    background: '#050d0a',
    layers: [
      { key: 'lumen', name: 'Lümen', kind: 'lumen', thickness: 0.6, color: '#12302a', particle: '#e0f0e8', text: 'Spermlerin ve sıvının geçtiği dar boşluk.' },
      { key: 'epitel', name: 'Yalancı çok katlı epitel', kind: 'epi-columnar', thickness: 0.6, color: '#a8d8c0', text: 'Yüzeyinde hareketsiz uzun mikrovilluslar (stereosiller) bulunan epitel.' },
      { key: 'lamina', name: 'Lamina propria', kind: 'connective', thickness: 0.4, color: '#90c0a8', text: 'Elastik liflerden zengin bağ dokusu.' },
      { key: 'kas', name: 'Kalın düz kas (üç tabaka)', kind: 'smooth-muscle', thickness: 1.6, color: '#5a9a7a', arrangement: 'circular', motion: 'peristalsis', text: 'İç uzunlamasına, orta dairesel ve dış uzunlamasına düz kas; boşalma sırasında güçlü peristaltik kasılmalarla spermi iter.' },
      { key: 'adventisya', name: 'Adventisya', kind: 'connective', thickness: 0.4, color: '#88b0a0', text: 'Kanalı sperm kordonunun diğer yapılarına bağlar.' },
    ],
    process_stages: [
      { title: 'Taşıma ve salgılar', focus: 'kas', text: 'Kasılmalar spermi ilerletir; seminal veziküller fruktozdan zengin sıvı, prostat PSA içeren sıvı ekler. Spermin yapımı Testis sahnesinde anlatılır.' },
    ],
    tests: ['testosterone'],
    caution: CAUTION,
  },
} as const satisfies Record<string, TissueProfile>;

export type TissueId = keyof typeof TISSUES;
export const TISSUE_IDS = Object.keys(TISSUES) as TissueId[];
export const tissueProfile = (id: string): TissueProfile | undefined => (TISSUES as Record<string, TissueProfile>)[id];
