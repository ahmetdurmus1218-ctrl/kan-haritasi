import type { SceneContent } from '../content';

/**
 * Testis ve sperm yapımı sahnesinin eğitim içeriği. Genel üreme biyolojisidir; kişinin kendi
 * dokusundan bir bulgu değildir. Hormon molekülü sayıları kişisel değerin temsili karşılığıdır.
 */
const content: SceneContent = {
  tests: ['testosterone', 'lh', 'fsh', 'estradiol', 'psa', 'prolactin'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin dokunu göstermez. Testosteron sabah en yüksektir ve gün içinde, uyku, hastalık ve ilaçlarla değişir; bu yüzden genellikle sabah ölçülür ve gerekirse tekrarlanır. PSA prostat büyümesi, iltihabı, bisiklet ya da yoğun egzersiz, ejakülasyon ve bazı işlemler gibi birçok nedenle yükselebilir; tek başına kanser anlamına gelmez.',
  stages: [
    {
      title: 'Seminifer tübüller',
      text: 'Testisin içi, kıvrımlı ince borucuklarla (seminifer tübüller) doludur. Kesitte her tübülün duvarında dıştan içe doğru olgunlaşan sperm hücreleri, tübüllerin arasında ise Leydig hücreleri ve kılcal damarlar görülür.',
    },
    {
      title: 'Leydig hücreleri ve testosteron (LH)',
      text: 'Hipofizden kanla gelen LH, tübüller arasındaki Leydig hücrelerini uyarır. Leydig hücreleri kolesterolden testosteron yapar; testosteron hem kana geçer hem de tübüllerde sperm yapımını destekler. Kandaki testosteron yükselince LH salgısı azalır.',
    },
    {
      title: 'Sperm yapımı (FSH, Sertoli)',
      text: 'Tübül duvarının dış kenarındaki spermatogonyumlar bölünür; oluşan spermatositler mayozla kromozom sayısını yarıya indirir ve spermatidlere dönüşür. FSH ve testosteron, bu hücreleri saran ve besleyen Sertoli hücrelerini uyarır. Bir spermin oluşumu yaklaşık 2–2,5 ay sürer.',
    },
    {
      title: 'Olgunlaşma ve taşınma (epididim)',
      text: 'Tübül boşluğuna bırakılan spermler henüz yüzemez; sıvı akışıyla testisin arkasındaki kıvrımlı epididime taşınır. Epididimde birkaç gün ile iki hafta arasında olgunlaşıp hareket yeteneği kazanır, sonra meni kanalıyla (vas deferens) ilerlerler.',
    },
    {
      title: 'Prostat ve PSA',
      text: 'Prostat, meninin sıvı kısmının bir bölümünü üreten bezdir; bez hücreleri salgıya meniyi sıvılaştıran PSA enzimini katar. Çok azı normalde de kana sızar; prostat büyüdüğünde, iltihaplandığında ya da doku yapısı bozulduğunda kandaki PSA artabilir.',
    },
  ],
  objects: {
    tubule: {
      name: 'Seminifer tübül',
      text: 'Sperm yapılan ince, kıvrımlı borucuk. Her testiste yüzlerce vardır ve toplam uzunlukları yüzlerce metreyi bulur.',
      size: 'çapı yaklaşık 0,2 milimetre',
    },
    spermatogonium: {
      name: 'Spermatogonyum',
      text: 'Tübül duvarının dış kenarında oturan kök hücre. Bölünerek hem kendini yeniler hem de sperm hattına hücre verir; bu yüzden sperm yapımı ergenlikten itibaren ömür boyu sürer.',
    },
    spermatocyte: {
      name: 'Spermatosit',
      text: 'Mayoz bölünme geçiren büyük hücre. Mayozla kromozom sayısı yarıya iner (46’dan 23’e).',
    },
    spermatid: {
      name: 'Spermatid',
      text: 'Mayozdan çıkan, boşluğa yakın küçük yuvarlak hücre. Kuyruk geliştirip şekil değiştirerek spermatozoona dönüşür.',
    },
    sperm: {
      name: 'Sperm (spermatozoon)',
      text: 'Baş (DNA ve yumurtayı delmeye yarayan enzimler), orta parça (mitokondriler) ve kuyruktan oluşan hücre. Hareket yeteneğini epididimde kazanır.',
      size: 'yaklaşık 0,05–0,06 milimetre (kuyruk dahil)',
    },
    sertoli: {
      name: 'Sertoli hücresi',
      text: 'Tübül duvarını baştan başa geçen “bakıcı” hücre. Gelişen sperm hücrelerini besler, kan–testis bariyerini oluşturur, FSH ve testosteronla uyarılır ve FSH’yi düzenleyen inhibin salgılar.',
    },
    leydig: {
      name: 'Leydig hücresi',
      text: 'Tübüllerin arasındaki bağ dokusunda, kılcallara yakın kümeler halinde bulunur. LH uyarısıyla kolesterolden testosteron üretir.',
    },
    testosterone: {
      name: 'Testosteron',
      text: 'Başlıca erkek cinsiyet hormonu. Sperm yapımını, kas ve kemik yapısını, kıllanmayı ve cinsel isteği etkiler. Kanda büyük kısmı SHBG ve albumine bağlı taşınır; bir kısmı dokularda östradiole dönüşür. Sahnede turuncu parçacıklar.',
    },
    lh: {
      name: 'LH (lüteinleştirici hormon)',
      text: 'Hipofizden salgılanan, Leydig hücrelerini testosteron yapmaya uyaran hormon. Sahnede mor parçacıklar.',
    },
    fsh: {
      name: 'FSH (folikül uyarıcı hormon)',
      text: 'Hipofizden salgılanan, Sertoli hücrelerini uyararak sperm yapımını destekleyen hormon. Sahnede mavi parçacıklar.',
    },
    capillary: {
      name: 'Kılcal damar',
      text: 'Tübüller arasındaki ince damarlar; LH ve FSH’yi getirir, testosteronu vücuda dağıtır.',
    },
    epididymis: {
      name: 'Epididim',
      text: 'Testisin arkasındaki, çok kıvrımlı tek bir kanal. Tübüllerden gelen spermler burada olgunlaşır ve depolanır.',
      size: 'kanal uzunluğu yaklaşık 4–6 metre',
    },
    prostate: {
      name: 'Prostat bezi (temsili bez birimi)',
      text: 'Mesanenin altında, idrar yolunu saran bez. Bez boşluklarını döşeyen hücreler meni sıvısının bir kısmını ve PSA’yı salgılar. Yaşla büyüyebilir.',
    },
    psa: {
      name: 'PSA (prostata özgü antijen)',
      text: 'Prostat hücrelerinin salgıladığı, meniyi sıvılaştıran enzim. Çok azı kana geçer; kandaki düzeyi büyüme, iltihap, egzersiz ya da işlemler sonrasında da yükselebilir. Sahnede yeşil parçacıklar.',
    },
  },
};

export default content;
