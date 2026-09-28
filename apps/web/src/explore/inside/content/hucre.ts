import type { SceneContent } from '../content';

/**
 * Hücre ve enerji sahnesinin eğitim içeriği. Genel bir hücre modelidir; kişinin kendi
 * hücrelerinden bir bulgu değildir. Parçacık sayıları kan değerlerinin temsili karşılığıdır.
 */
const content: SceneContent = {
  tests: ['glucose', 'insulin', 'hemoglobin', 'ft4', 'ft3', 'iron', 'b12', 'folate'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir: genel bir hücre modelidir, senin hücrelerini göstermez. Gerçek hücreler organa göre biçim, organel sayısı ve taşıyıcı türü bakımından çok farklıdır. Glukoz, oksijen, ATP ve taşıyıcı sayıları kan değerlerinden türetilen temsili göstergelerdir.',
  stages: [
    {
      title: 'Hücre',
      text: 'Vücuttaki hemen her hücrenin ortak parçaları: dışta seçici geçirgen zar, içte çekirdek, protein yapan ER ve Golgi, enerji üreten mitokondriler ve atıkları sindiren lizozomlar. Dışarıdaki glukoz ve oksijen ile içerideki ATP miktarı senin değerlerine göre temsili olarak çizilir.',
    },
    {
      title: 'Çekirdek ve DNA',
      text: 'Çekirdek, hücrenin DNA’sını çift katlı bir zarla korur. Bir gen kullanılacağında DNA’dan mRNA kopyası çıkarılır; mRNA çekirdek porlarından sitoplazmaya geçer. Çekirdekçik, ribozomların yapıldığı yerdir.',
    },
    {
      title: 'Protein yapımı (ribozom, ER, Golgi)',
      text: 'Ribozomlar mRNA’daki şifreyi okuyarak amino asitleri sırayla birleştirir ve protein zinciri üretir. Granüllü ER’deki ribozomların yaptığı proteinler ER’de katlanır, keseciklerle Golgi’ye gider; Golgi onları düzenleyip paketler ve zara ya da hücre dışına gönderir.',
    },
    {
      title: 'Glukozun girişi',
      text: 'Glukoz zardan kendiliğinden geçemez; GLUT denen taşıyıcı proteinlerden girer. Kas ve yağ hücrelerinde insülin, depodaki GLUT4 taşıyıcılarını zara getirerek glukoz girişini artırır; beyin gibi dokular ise insülinden bağımsız taşıyıcılar kullanır.',
    },
    {
      title: 'Mitokondride ATP',
      text: 'Glukoz sitoplazmada parçalanır; ürünleri mitokondride oksijen kullanılarak yakılır ve hücrenin enerji parası ATP üretilir, karbondioksit ve su açığa çıkar. Oksijeni kandaki hemoglobin taşır; tiroid hormonları hücrelerin metabolizma hızını ve enerji tüketimini artırır.',
    },
    {
      title: 'Hücre zarı ve sinyaller',
      text: 'Zardaki reseptörler, kanla gelen hormonları tanır. Hormon reseptörüne bağlanınca hücre içinde bir sinyal zinciri başlar ve hücre davranışını değiştirir (ör. taşıyıcıları zara getirir ya da genleri açar). Tiroid hormonları gibi bazı hormonlar ise hücreye girip çekirdekteki reseptörlere bağlanır.',
    },
  ],
  objects: {
    membrane: { name: 'Hücre zarı', text: 'Hücreyi çevreleyen, iki katlı yağ (fosfolipit) tabakasından ve içine gömülü proteinlerden oluşan seçici zar. Neyin girip çıkacağını taşıyıcılar ve kanallar belirler.', size: 'kalınlığı yaklaşık 7–10 nanometre' },
    nucleus: { name: 'Çekirdek', text: 'DNA’yı taşıyan, çift zarlı bölme. Zarındaki porlar mRNA’nın ve proteinlerin geçişine izin verir; içindeki koyu çekirdekçik ribozom yapımında görev alır.', size: 'yaklaşık 5–10 mikrometre' },
    dna: { name: 'DNA (kromatin)', text: 'Genetik bilgiyi taşıyan molekül. Çekirdekte proteinlere sarılı kromatin olarak bulunur. Hücre bölünmesi için DNA kopyalanırken folat ve B12 gerekir.' },
    mrna: { name: 'mRNA', text: 'Bir genin DNA’dan çıkarılan geçici kopyası. Çekirdekten çıkıp ribozomlara proteinin tarifini götürür.' },
    ribosome: { name: 'Ribozom', text: 'mRNA’yı okuyup amino asitleri protein zincirine birleştiren küçük yapı. ER’ye tutunanlar salgılanacak ya da zara gidecek proteinleri yapar; yeşil boncuk zincirleri yeni yapılan proteinleri temsil eder.', size: 'yaklaşık 25–30 nanometre (burada büyütülmüş)' },
    er: { name: 'Endoplazmik retikulum (ER)', text: 'Çekirdeği saran, katlanmış zar yaprakları. Üzeri ribozomlu (granüllü) ER proteinleri katlar; düz ER yağ yapımında ve kalsiyum depolamada görev alır.' },
    golgi: { name: 'Golgi aygıtı', text: 'Üst üste dizilmiş yassı keseciklerden oluşan paketleme merkezi. ER’den gelen proteinleri düzenler, etiketler ve keseciklerle gidecekleri yere yollar.' },
    vesicle: { name: 'Kesecik (vezikül)', text: 'Zarla çevrili küçük taşıma kesesi. Proteinleri ER’den Golgi’ye, Golgi’den zara taşır; zarla birleşince içeriğini hücre dışına bırakır.' },
    mitochondrion: { name: 'Mitokondri', text: 'Hücrenin enerji santrali. İç zarının kıvrımları (kristalar) ATP üreten enzimleri taşır; glukoz ve yağlardan gelen yakıtı oksijenle yakar. Kendine ait küçük bir DNA’sı vardır.', size: 'yaklaşık 1–2 mikrometre uzunluk' },
    atp: { name: 'ATP', text: 'Hücrenin enerji taşıyıcı molekülü. Kas kasılması, zar pompaları, protein yapımı gibi hemen her iş ATP harcar. Sahnede üretim hızı serbest T4 değerine göre temsili olarak ayarlanır.', size: 'tek bir molekül (burada çok büyütülmüş)' },
    glucose: { name: 'Glukoz', text: 'Kandaki ana şeker. Taşıyıcılarla hücreye girer, sitoplazmada parçalanır ve ürünleri (turuncu) mitokondride yakılır. Sahnedeki miktar kan şekeri değerinin temsili karşılığıdır.' },
    oxygen: { name: 'Oksijen (O₂)', text: 'Kanda hemoglobine bağlı taşınır ve zardan difüzyonla hücreye geçer. Mitokondride ATP üretiminin son adımında kullanılır. Sahnedeki miktar hemoglobin değerinin temsili karşılığıdır.' },
    transporter: { name: 'Glukoz taşıyıcısı (GLUT)', text: 'Glukozun zardan geçmesini sağlayan kanal benzeri protein. Kas ve yağ hücrelerindeki GLUT4, insülin sinyaliyle zara taşınır. Sahnedeki taşıyıcı sayısı insülin değerinin temsili karşılığıdır.' },
    receptor: { name: 'Reseptör ve hormon', text: 'Zardaki reseptör proteinler kanla gelen hormonları (pembe) tanır. Bağlanma, hücre içinde bir sinyal zinciri (mavi) başlatır ve hücrenin davranışını değiştirir.' },
    lysosome: { name: 'Lizozom', text: 'Sindirim enzimleriyle dolu kese. Eskimiş organelleri, yutulan maddeleri ve atıkları parçalayıp yeniden kullanılabilir yapı taşlarına ayırır.' },
  },
};

export default content;
