import type { SceneContent } from '../content';

/** Kas lifi ve sarkomer sahnesinin eğitim içeriği. Genel biyolojidir; kişinin kasından bir bulgu değildir. */
const content: SceneContent = {
  tests: ['ck', 'potassium', 'calcium', 'creatinine', 'vitamin-d'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin kasını göstermez. CK yoğun egzersizden, kas içine yapılan iğnelerden ve başka birçok nedenden sonra da yükselebilir; yüksek bir CK değeri tek başına kas hastalığı olduğunu göstermez. İyon ve molekül sayıları farklar görülebilsin diye abartılmıştır.',
  stages: [
    {
      title: 'Kas lifleri',
      text: 'İskelet kası, demetler halinde dizilmiş uzun ve çok çekirdekli kas liflerinden (hücrelerinden) oluşur; çekirdekler lifin kenarında yer alır. Sahnede liflerden dışarı sızan CK molekülleri ve çevredeki iyonlar senin sonuçlarına göre ayarlanır.',
    },
    {
      title: 'Miyofibril ve sarkomer',
      text: 'Her kas lifinin içi, boydan boya uzanan miyofibrillerle doludur. Miyofibriller, Z çizgileriyle ayrılan tekrarlayan birimlerden (sarkomer) oluşur: ince aktin iplikleri Z çizgisine tutunur, kalın miyozin iplikleri ortada durur.',
    },
    {
      title: 'Sinir uyarısı',
      text: 'Hareket sinir hücresi (motor nöron) uyarıyı sinir-kas kavşağına taşır ve buraya asetilkolin bırakır. Asetilkolin kas lifinin zarındaki reseptörlere bağlanır ve lif boyunca bir elektrik dalgası yayılır.',
    },
    {
      title: 'Kalsiyum salınımı',
      text: 'Elektrik dalgası, lifin içindeki kalsiyum deposunu (sarkoplazmik retikulum) uyarır ve kalsiyum miyofibrillerin çevresine salınır. Kalsiyum aktin üzerindeki düzenleyici proteine (troponin) bağlanarak miyozinin tutunacağı yerleri açar.',
    },
    {
      title: 'Kayan filamentler',
      text: 'Miyozin başları aktine tutunur, eğilir (güç vuruşu) ve aktini sarkomerin ortasına doğru çeker; sonra bırakıp yeniden tutunur. İplikler kısalmaz, birbirinin üzerinden kayar: Z çizgileri yaklaşır ve kas kısalır. Kalsiyum depoya geri pompalanınca kas gevşer.',
    },
    {
      title: 'Enerji (ATP)',
      text: 'Her güç vuruşu ve kalsiyumun geri pompalanması ATP harcar. Kas, ATP’yi hızla yenilemek için kreatin fosfatı kullanır; bu tepkimeyi kreatin kinaz (CK) enzimi yürütür. Lifler zorlandığında ya da hasar gördüğünde CK kana geçer; kreatin fosfatın bir kısmı ise her gün kreatinine dönüşür.',
    },
  ],
  objects: {
    fiber: {
      name: 'Kas lifi (kas hücresi)',
      text: 'Birçok hücrenin kaynaşmasıyla oluşan, çok çekirdekli, uzun silindir biçimli hücre; istemli hareketi sağlar. Kasın gücü lif sayısı ve kalınlığıyla ilişkilidir. D vitamini, kalsiyum dengesi aracılığıyla kas işlevini de destekler.',
      size: 'çapı yaklaşık 10–100 mikrometre, uzunluğu santimetrelerce olabilir',
    },
    myofibril: {
      name: 'Miyofibril',
      text: 'Kas lifinin içini dolduran, sarkomerlerin uç uca dizilmesiyle oluşan kasılabilir ipliksi yapı. Kasın çizgili görünümü, miyofibrillerdeki bantların yan yana hizalanmasından gelir.',
      size: 'yaklaşık 1–2 mikrometre çap',
    },
    sarcomere: {
      name: 'Sarkomer',
      text: 'İki Z çizgisi arasındaki bölge; kasın kasılan temel birimi. Kasılmada kısalır, gevşemede eski boyuna döner. Miyofibril üzerinde vurgulanan bölüm aşağıda büyütülerek gösterilir.',
      size: 'dinlenirken yaklaşık 2–2,5 mikrometre',
    },
    zline: {
      name: 'Z çizgisi (Z diski)',
      text: 'Sarkomerin iki ucunda, aktin ipliklerinin tutunduğu disk. Kasılmada Z çizgileri birbirine yaklaşır.',
    },
    actin: {
      name: 'Aktin (ince iplik)',
      text: 'Z çizgisinden sarkomerin ortasına doğru uzanan, iki sarmal zincirden oluşan ince iplik. Üzerindeki troponin ve tropomiyozin, kalsiyum yokken miyozinin tutunmasını engeller.',
    },
    myosin: {
      name: 'Miyozin (kalın iplik)',
      text: 'Sarkomerin ortasındaki M çizgisine tutunan kalın iplik. Yüzeyindeki başlar aktine bağlanıp eğilerek çekme kuvveti üretir; her döngüde bir ATP harcanır.',
    },
    neuron: {
      name: 'Motor nöron ve sinir-kas kavşağı',
      text: 'Omurilikten gelen sinir hücresinin uzantısı (akson) kas lifinin üzerinde sonlanır. Aksonu saran miyelin kılıf uyarının hızlı iletilmesini sağlar. Bir motor nöron birden çok kas lifini yönetir.',
    },
    acetylcholine: {
      name: 'Asetilkolin',
      text: 'Sinir ucundan salınan ve kas lifinin zarındaki reseptörlere bağlanan ileti maddesi. Kavşaktaki bir enzim (asetilkolinesteraz) tarafından hızla parçalanır; böylece kas sürekli uyarılı kalmaz.',
    },
    calcium: {
      name: 'Kalsiyum (Ca²⁺)',
      text: 'Kasılmayı başlatan sinyal. Kasılmada kullanılan kalsiyumun çoğu lifin içindeki depodan (sarkoplazmik retikulum) gelir. Kandaki kalsiyum düzeyi ise sinir ve kas hücrelerinin uyarılabilirliğini etkiler; sahnedeki kalsiyum yoğunluğu senin sonucuna göre ayarlanır.',
    },
    potassium: {
      name: 'Potasyum (K⁺)',
      text: 'Hücre içinde bol, dışında az bulunan iyon; sinir ve kas hücrelerinin elektrik yükünü belirler. Tahlilde hücre dışındaki (serum) düzeyi ölçülür; sahnede lifler arasındaki mor parçacıklar bunu temsil eder.',
    },
    atp: {
      name: 'ATP ve kreatin fosfat',
      text: 'ATP hücrenin enerji taşıyıcısıdır. Kas, kısa süreli yoğun işte ATP’yi kreatin fosfattan hızla yeniler. Kreatin fosfatın bir kısmı her gün kendiliğinden kreatinine dönüşür; bu yüzden kandaki kreatinin kas kütlesiyle de ilişkilidir.',
    },
    ck: {
      name: 'Kreatin kinaz (CK)',
      text: 'Kreatin fosfat ile ATP arasındaki enerji aktarımını yapan enzim; kas liflerinde bol bulunur (bir kısmı M çizgisine bağlıdır). Lif zorlandığında ya da hasar gördüğünde kana geçer. Sahnede liflerden dışarı sızan CK miktarı senin CK sonucuna göre ayarlanır.',
    },
    mitochondrion: {
      name: 'Mitokondri',
      text: 'Oksijen kullanarak ATP üreten organel. Miyofibrillerin arasında ve zarın altında bulunur; dayanıklılık egzersizleriyle sayısı artabilir.',
      size: 'yaklaşık 1–2 mikrometre',
    },
    nucleus: {
      name: 'Çekirdek',
      text: 'İskelet kası lifleri çok çekirdeklidir; çekirdekler lifin kenarında, zarın hemen altında durur (kalp kasında ise ortadadır).',
    },
  },
};

export default content;
