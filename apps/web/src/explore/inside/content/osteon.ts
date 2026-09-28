import type { SceneContent } from '../content';

/** Kemik dokusu sahnesinin eğitim içeriği. Genel biyolojidir; kişinin kemiğinden bir bulgu değildir. */
const content: SceneContent = {
  tests: ['vitamin-d', 'calcium', 'phosphorus', 'alp'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin kemiğini göstermez. D vitamini, kalsiyum, fosfor ve ALP kemik metabolizmasıyla ilişkilidir ancak kemik yoğunluğunu göstermez; kemik yoğunluğu DXA taramasıyla ölçülür. ALP karaciğerden de kaynaklanabilir ve büyüme çağında doğal olarak yüksektir. Parçacık sayıları farklar görülebilsin diye abartılmıştır.',
  stages: [
    {
      title: 'Kompakt ve süngerimsi kemik',
      text: 'Kemiğin dış kabuğu sıkı (kompakt) kemikten, iç kısmı ise ince kemik çubuklarının (trabekül) oluşturduğu süngerimsi kemikten yapılır; dışını damar ve sinir taşıyan periost zarı sarar. Sahnedeki D vitamini, kalsiyum ve fosfat yoğunluğu ile kemik yapıcı hücrelerin etkinliği senin sonuçlarına göre ayarlanır.',
    },
    {
      title: 'Osteon',
      text: 'Kompakt kemiğin yapı birimi osteondur: ortadaki Havers kanalının çevresinde soğan katmanları gibi dizilmiş kemik halkaları (lamel). Lameller arasındaki küçük boşluklarda yaşayan osteositler, ince kanalcıklarla birbirine ve kanaldaki damara bağlanır.',
    },
    {
      title: 'Kemik yapımı',
      text: 'Osteoblastlar yüzeyi döşeyerek önce kolajenden zengin, yumuşak bir ara madde (osteoid) üretir; bu, yeni bir lamel olarak katman katman kalınlaşır. Bu sırada alkalen fosfataz (ALP) enzimi de üretirler; bu yüzden kemik yapımının arttığı dönemlerde kandaki ALP yükselebilir.',
    },
    {
      title: 'Mineralleşme',
      text: 'Kandan gelen kalsiyum ve fosfat, osteoidin içinde hidroksiapatit kristallerine dönüşerek kemiği sertleştirir. D vitamini, bağırsaktan kalsiyum ve fosfat emilimini artırarak bu yapı taşlarının yeterli olmasına yardım eder.',
    },
    {
      title: 'Kemik yıkımı',
      text: 'Çok çekirdekli dev osteoklastlar kemik yüzeyine yapışır, asit ve enzimlerle minerali çözüp küçük çukurlar açar. Çözülen kalsiyum kana geçer; bu, kandaki kalsiyum düzeyinin korunmasına da yardım eder.',
    },
    {
      title: 'Yenilenme dengesi',
      text: 'Kemik ömür boyu yıkılıp yeniden yapılır: osteoklastların açtığı çukurları osteoblastlar doldurur. Yetişkinde iskeletin yaklaşık onda biri her yıl yenilenir; yıkım uzun süre yapımdan fazla olursa kemik zamanla incelir.',
    },
  ],
  objects: {
    osteon: {
      name: 'Osteon (Havers sistemi)',
      text: 'Kompakt kemiğin silindir biçimli yapı birimi. Merkezdeki kanalın çevresinde eş merkezli lamellerden oluşur ve kemiğin uzun eksenine paralel uzanır. Osteonların arasını eski osteonların kalıntıları doldurur.',
      size: 'yaklaşık 0,1–0,4 milimetre çap',
    },
    canal: {
      name: 'Havers kanalı',
      text: 'Osteonun ortasından geçen kanal; içinde kılcal damarlar ve sinir lifleri bulunur. Yandan gelen Volkmann kanalları bu kanalları birbirine ve periosta bağlar.',
      size: 'yaklaşık 50 mikrometre çap',
    },
    lamella: {
      name: 'Lamel',
      text: 'Osteonu oluşturan ince kemik halkası. Her lameldeki kolajen lifleri komşu lameldekinden farklı açıyla dizilir; bu çapraz düzen kemiği hem sağlam hem esnek yapar.',
      size: 'yaklaşık 3–7 mikrometre kalınlık',
    },
    osteocyte: {
      name: 'Osteosit',
      text: 'Kemik matriksinin içine gömülmüş olgun kemik hücresi; aslında kendi ürettiği matrikse gömülen bir osteoblasttır. Kemiğe binen yükü algılar ve yapım–yıkım hücrelerine sinyal gönderir.',
      size: 'yaklaşık 10–20 mikrometre',
    },
    canaliculi: {
      name: 'Kanalcıklar (kanalikül)',
      text: 'Osteositlerin uzantılarının geçtiği çok ince kanallar. Hücreleri birbirine ve Havers kanalına bağlar; besin, oksijen ve sinyaller bu ağ üzerinden taşınır.',
    },
    osteoblast: {
      name: 'Osteoblast',
      text: 'Yeni kemik yapan, yüzeyi döşeyen küp biçimli hücre. Osteoid denen organik ara maddeyi üretir ve alkalen fosfataz (ALP) ile mineralleşmeye yardım eder. Sahnedeki osteoblast sayısı ve etkinliği ALP sonucuna göre ayarlanır.',
      size: 'yaklaşık 15–30 mikrometre',
    },
    osteoclast: {
      name: 'Osteoklast',
      text: 'Kemiği yıkan dev, çok çekirdekli hücre; kan yapıcı hücre soyundan gelir. Yüzeye sıkıca yapışıp asit ve enzim salgılayarak kemik mineralini ve kolajeni çözer.',
      size: 'yaklaşık 50–100 mikrometre',
    },
    calcium: {
      name: 'Kalsiyum ve hidroksiapatit',
      text: 'Kemik minerali hidroksiapatitin ana yapı taşı; vücuttaki kalsiyumun yaklaşık %99’u kemikte depolanır. Kandaki düzeyi hormonlarla sıkı biçimde düzenlenir. Yeşil parçacıklar kalsiyum iyonlarını, beyaz altıgen çubuklar yeni oluşan kristalleri temsil eder; iyon yoğunluğu senin sonucuna göre ayarlanır.',
    },
    phosphate: {
      name: 'Fosfat',
      text: 'Kalsiyumla birlikte hidroksiapatit kristallerini oluşturur. Tahlildeki “fosfor” kandaki fosfatı ölçer. Sahnedeki fosfat yoğunluğu senin sonucuna göre ayarlanır.',
    },
    vitd: {
      name: 'D vitamini',
      text: 'Deride güneş ışığıyla yapılır ya da besinlerle alınır; karaciğer ve böbrekte etkin biçimine dönüşür. Bağırsaktan kalsiyum ve fosfat emilimini artırır. Tahlilde genellikle depo biçimi (25-OH D vitamini) ölçülür; sahnedeki sarı parçacıklar senin sonucuna göre ayarlanır.',
    },
    vessel: {
      name: 'Kan damarı',
      text: 'Kemik canlı bir dokudur ve zengin bir damar ağına sahiptir. Damarlar periosttan Volkmann kanallarıyla kemiğe girer ve Havers kanallarında osteonların içinden geçer.',
    },
    periosteum: {
      name: 'Periost',
      text: 'Kemiğin dış yüzünü saran, damar ve sinirden zengin bağ dokusu zarı. İç katmanındaki hücreler kemiğin kalınlaşmasına ve kırık iyileşmesine katkıda bulunur.',
    },
    trabecula: {
      name: 'Trabekül (süngerimsi kemik)',
      text: 'Süngerimsi kemiği oluşturan ince kemik çubukları ve plakaları; aralarındaki boşluklarda kemik iliği bulunur. Yüzeyleri geniş olduğu için yenilenme burada daha hızlıdır.',
    },
    alp: {
      name: 'Alkalen fosfataz (ALP)',
      text: 'Osteoblastların zarında bulunan ve mineralleşmeye yardım eden enzim. Kandaki ALP’nin önemli bir kısmı kemikten, bir kısmı karaciğerden gelir; büyüme çağında ve kırık iyileşirken doğal olarak yüksek olabilir.',
    },
  },
};

export default content;
