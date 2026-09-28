import type { SceneContent } from '../content';

/**
 * Yumurtalık ve adet döngüsü sahnesinin eğitim içeriği. Genel üreme biyolojisidir; kişinin kendi
 * yumurtalığından bir bulgu değildir. Hormonlar döngü evresine bağlı olduğundan sahne kişisel
 * değerlerle değişmez; genel döngüyü gösterir.
 */
const content: SceneContent = {
  tests: ['fsh', 'lh', 'estradiol', 'progesterone', 'bhcg', 'prolactin'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin yumurtalığını göstermez ve kişisel değerlerle değişmez. FSH, LH, östradiol ve progesteron adet döngüsünün evresine göre çok değişir; sonuçlar raporda o evreye ait aralıkla ve kanın alındığı döngü günüyle birlikte okunmalıdır. Gebelik, hormonlu ilaçlar ve menopoz da bu değerleri etkiler.',
  stages: [
    {
      title: 'Yumurtalık dokusu',
      text: 'Yumurtalığın dış kısmında (korteks) doğumdan beri bekleyen çok sayıda ilkel folikül bulunur; her biri tek sıra yassı hücreyle sarılı bir yumurta hücresidir. İç kısımda (medulla) damarlar ve bağ dokusu yer alır.',
    },
    {
      title: 'FSH ile folikül gelişimi (östrojen)',
      text: 'Döngünün başında hipofizden gelen FSH bir grup folikülü büyütür. Folikül hücreleri çoğalır, içlerinde sıvı dolu bir boşluk (antrum) açılır ve östrojen (östradiol) üretirler. Genellikle yalnızca biri baskın folikül olur, diğerleri geriler.',
    },
    {
      title: 'LH dalgası ve yumurtlama',
      text: 'Yükselen östrojen belli bir düzeyi geçince hipofiz kısa süreli, yüksek bir LH dalgası salgılar. Yaklaşık 1–1,5 gün içinde olgun folikül yumurtalık yüzeyinde yırtılır ve yumurta hücresi çevresindeki hücrelerle birlikte dışarı bırakılır.',
    },
    {
      title: 'Korpus luteum ve progesteron',
      text: 'Boşalan folikül sarı renkli korpus luteuma dönüşür ve progesteron ile östrojen salgılar. Progesteron rahim iç tabakasını olası bir gebeliğe hazırlar. Gebelik olmazsa korpus luteum yaklaşık iki haftada geriler.',
    },
    {
      title: 'Tüpte taşınma ve döllenme',
      text: 'Fallop tüpünün saçaklı ucu (fimbriya) yumurtayı yakalar; kirpikli hücreler ve kas kasılmaları onu rahme doğru ilerletir. Döllenme çoğunlukla tüpün geniş kısmında (ampulla) olur. Gebelik başlarsa embriyonun ürettiği hCG korpus luteumu ayakta tutar; gebelik testleri β-hCG’yi ölçer.',
    },
    {
      title: 'Rahim iç tabakası (endometriyum)',
      text: 'Döngünün ilk yarısında östrojen rahim iç tabakasını kalınlaştırır; yumurtlamadan sonra progesteron bu tabakayı salgı yapan, beslenmeye hazır bir hale getirir. Gebelik olmazsa progesteron düşer, üst tabaka dökülür ve adet kanaması başlar; ardından döngü yeniden başlar.',
    },
  ],
  objects: {
    ovary: {
      name: 'Yumurtalık (ovaryum)',
      text: 'Yumurta hücrelerini barındıran ve östrojen ile progesteron üreten organ. İç kısmındaki (medulla) damarlar hormonları getirip götürür.',
      size: 'yaklaşık 3–5 santimetre',
    },
    primordial: {
      name: 'İlkel (primordiyal) folikül',
      text: 'Tek sıra yassı hücreyle sarılmış, olgunlaşmayı bekleyen yumurta hücresi. Doğumda yaklaşık 1–2 milyon olan bu foliküllerin sayısı yaşla azalır; her döngüde yalnızca küçük bir kısmı gelişmeye başlar.',
      size: 'yaklaşık 0,03–0,04 milimetre',
    },
    follicle: {
      name: 'Gelişen folikül',
      text: 'FSH etkisiyle büyüyen, yumurta hücresini ve onu besleyen hücre katlarını içeren kesecik. Dış katmandaki teka hücreleri androjen yapar, granüloza hücreleri bunları östrojene çevirir. Baskın olmayan foliküller geriler.',
      size: 'olgunlukta yaklaşık 1,8–2,5 santimetre',
    },
    oocyte: {
      name: 'Yumurta hücresi (oosit)',
      text: 'İnsan vücudunun en büyük hücrelerinden biri; çevresinde koruyucu bir kılıf (zona pellusida) ve eşlik eden hücreler vardır. Yumurtlamadan sonra yaklaşık 12–24 saat döllenebilir. Sahnede tüpte ona doğru yüzen spermler de gösterilir.',
      size: 'yaklaşık 0,1 milimetre',
    },
    granulosa: {
      name: 'Granüloza hücreleri',
      text: 'Yumurta hücresini saran, FSH ile çoğalan ve östrojen (östradiol) üreten hücreler. Yumurtlamada bir kısmı yumurtaya eşlik eder; kalanlar korpus luteum hücrelerine dönüşür.',
    },
    antrum: {
      name: 'Antrum (folikül sıvısı)',
      text: 'Büyüyen folikülün içinde açılan, hormonlardan zengin sıvıyla dolu boşluk. Yumurtlamada bu sıvı dışarı boşalır.',
    },
    luteum: {
      name: 'Korpus luteum (sarı cisim)',
      text: 'Yumurtlamadan sonra boşalan folikülden oluşan, progesteron ve östrojen salgılayan geçici bez. Gebelik olmazsa yaklaşık 10–14 günde geriler; gebelikte hCG onu korur.',
    },
    fsh: {
      name: 'FSH (folikül uyarıcı hormon)',
      text: 'Hipofizden salgılanır; foliküllerin büyümesini ve östrojen yapımını uyarır. Sahnede mavi parçacıklar.',
    },
    lh: {
      name: 'LH (lüteinleştirici hormon)',
      text: 'Hipofizden salgılanır. Döngünün ortasındaki ani LH dalgası yumurtlamayı başlatır; ardından korpus luteumu destekler. Sahnede mor parçacıklar.',
    },
    estrogen: {
      name: 'Östrojen (östradiol)',
      text: 'Gelişen folikülün ana hormonu. Rahim iç tabakasını kalınlaştırır; yüksek düzeyi LH dalgasını tetikler. Sahnede pembe parçacıklar.',
    },
    progesterone: {
      name: 'Progesteron',
      text: 'Korpus luteumun ana hormonu. Rahim iç tabakasını gebeliğe hazırlar; düzeyi yumurtlamadan yaklaşık bir hafta sonra en yüksektir. Sahnede turuncu (kehribar) parçacıklar.',
    },
    fimbria: {
      name: 'Fallop tüpü ve fimbriya',
      text: 'Yumurtalığı rahme bağlayan tüp. Yumurtalığa bakan ucu parmak gibi saçaklarla (fimbriya) çevrilidir; yumurtlamada bu saçaklar yumurtayı süpürerek tüpe alır.',
      size: 'tüp yaklaşık 10–12 santimetre',
    },
    cilia: {
      name: 'Kirpikler (silyalar)',
      text: 'Tüpün iç yüzündeki hücrelerin dalga gibi çırpan kıl benzeri uzantıları. Kas kasılmalarıyla birlikte yumurtayı rahme doğru taşır.',
    },
    endometrium: {
      name: 'Rahim iç tabakası (endometriyum)',
      text: 'Döngü boyunca kalınlaşıp dökülen tabaka. Alttaki kalıcı tabaka her döngüde üst tabakayı yeniden oluşturur. Sahnedeki bezler ve sarmal atardamarlar temsilidir.',
    },
  },
};

export default content;
