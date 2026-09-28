import type { SceneContent } from '../content';

/**
 * İç kulak (koklea) sahnesinin eğitim içeriği. Genel biyoloji bilgisidir; kişinin kulağından bir
 * bulgu değildir. Bu sahneyle ilişkili bir kan tahlili yoktur.
 */
const content: SceneContent = {
  tests: [],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin kulağını göstermez. Koklea anlaşılır olsun diye büyük ölçüde açılmış (düz) çizilmiştir; gerçekte yaklaşık 2,5 tur kıvrılan bir salyangoz biçimindedir. Dalga genlikleri ve hareketler abartılmıştır. İşitme ancak işitme testleriyle değerlendirilebilir.',
  stages: [
    {
      title: 'Ses yolu',
      text: 'Ses, havada ilerleyen basınç dalgalarıdır. Dış kulak yolundan gelen dalgalar kulak zarını titreştirir; çekiç, örs ve üzengi kemikçikleri bu titreşimi güçlendirerek iç kulağın oval penceresine iletir.',
    },
    {
      title: 'Koklea içi',
      text: 'Koklea, sıvıyla dolu kanallardan oluşan salyangoz biçimli bir yapıdır. Üzengi oval pencereyi ittikçe sıvı dalgalanır ve kanalları ayıran baziler zar boyunca bir dalga ilerler; basınç yuvarlak pencereden boşalır.',
    },
    {
      title: 'Frekans haritası',
      text: 'Baziler zar tabanda dar ve serttir, tepeye doğru genişler ve esnekleşir. Bu yüzden tiz sesler en çok tabana yakın, pes sesler tepeye yakın bölgeyi titreştirir. Beyin, hangi bölgedeki hücrelerin uyarıldığından sesin perdesini anlar.',
    },
    {
      title: 'Tüy hücreleri',
      text: 'Baziler zarın üstünde bir sıra iç ve üç sıra dış tüy hücresi bulunur. Zar titreşince tüy hücrelerinin kirpikleri (stereosilya) üstteki tektoryal zara göre eğilir; bu eğilme iyon kanallarını açar ve hücrede elektrik sinyali doğar. Dış tüy hücreleri boylarını değiştirerek titreşimi güçlendirir.',
    },
    {
      title: 'İşitme siniri',
      text: 'İç tüy hücreleri, işitme siniri liflerine kimyasal sinapslarla sinyal verir. Lifler aksiyon potansiyeli üreterek bilgiyi beyin sapına, oradan işitme korteksine taşır. Sesin şiddeti arttıkça daha çok lif ve daha sık ateşler.',
    },
    {
      title: 'Denge organları',
      text: 'İç kulakta kokleanın yanında denge organları da bulunur. Birbirine dik üç yarım daire kanalındaki sıvı, baş dönerken eylemsizlikle geride kalır ve dönme hareketi algılanır. Utrikül ve sakküldeki küçük kristaller (otolitler) ise başın eğimini ve doğrusal hızlanmayı algılar.',
    },
  ],
  objects: {
    soundwave: {
      name: 'Ses dalgası ve dış kulak yolu',
      text: 'Havadaki sıkışma ve seyrelmelerden oluşan basınç dalgası. Dış kulak yolu sesi kulak zarına yönlendirir. Dalgaların sıklığı (frekans) sesin perdesini, büyüklüğü şiddetini belirler.',
    },
    eardrum: {
      name: 'Kulak zarı',
      text: 'Dış kulak ile orta kulağı ayıran ince zar. Ses dalgalarıyla titreşir ve titreşimi çekiç kemiğine aktarır.',
      size: 'çapı yaklaşık 8–10 milimetre',
    },
    ossicles: {
      name: 'Kulak kemikçikleri',
      text: 'Çekiç, örs ve üzengi; vücudun en küçük kemikleri. Kaldıraç gibi çalışarak ve geniş kulak zarından küçük oval pencereye aktararak titreşimin basıncını artırır.',
      size: 'üzengi yaklaşık 3 milimetre',
    },
    ovalwindow: {
      name: 'Oval ve yuvarlak pencere',
      text: 'Oval pencere, üzenginin tabanının oturduğu zar kaplı açıklıktır; titreşimi koklea sıvısına iletir. Sıvı sıkıştırılamadığı için yuvarlak pencere zarı aynı anda ters yönde esner.',
    },
    cochlea: {
      name: 'Koklea (salyangoz)',
      text: 'Yaklaşık 2,5 tur kıvrılan, sıvıyla dolu kemik kanal. İçinde perilenf ve endolenf adlı iki farklı sıvıyı taşıyan bölmeler ile işitme organı (Corti organı) bulunur.',
      size: 'açılmış uzunluğu yaklaşık 3,5 santimetre',
    },
    basilar: {
      name: 'Baziler zar',
      text: 'Koklea boyunca uzanan, tüy hücrelerini taşıyan zar. Tabanda dar ve sert, tepede geniş ve esnektir; bu yüzden her frekans zarın farklı bir noktasını en çok titreştirir.',
    },
    haircell: {
      name: 'Tüy hücresi',
      text: 'Titreşimi elektrik sinyaline çeviren duyu hücresi. İç tüy hücreleri sinyali sinire iletir; dış tüy hücreleri boy değiştirerek titreşimi güçlendirir. Bu hücreler yenilenmez; çok yüksek ses onlara zarar verebilir.',
      size: 'yaklaşık 10–50 mikrometre',
    },
    stereocilia: {
      name: 'Stereosilya (kirpik demeti)',
      text: 'Tüy hücresinin tepesinde merdiven gibi kademeli dizilmiş ince çıkıntılar. Uçları birbirine ince bağlarla bağlıdır; demet eğilince bu bağlar iyon kanallarını açar.',
    },
    tectorial: {
      name: 'Tektoryal zar',
      text: 'Tüy hücrelerinin üstünde duran jelimsi zar. Baziler zar titreşince kirpik demetleri bu zara göre kayar ve eğilir.',
    },
    nerve: {
      name: 'İşitme siniri',
      text: 'İç tüy hücrelerinden gelen sinyalleri spiral gangliyondaki nöronlar aracılığıyla beyne taşıyan sinir. Denge organlarından gelen sinirle birleşerek sekizinci kafa sinirini (vestibülokoklear sinir) oluşturur.',
    },
    canals: {
      name: 'Yarım daire kanalları',
      text: 'Birbirine dik üç sıvı dolu kanal; başın her yöndeki dönme hareketini algılar. Kanalın ucundaki şişkinlikte (ampulla) bulunan tüy hücreleri, sıvı geride kalınca eğilir.',
    },
    otolith: {
      name: 'Otolit organları (utrikül ve sakkül)',
      text: 'Tüy hücrelerinin üstünde kalsiyum karbonat kristalleri (otolitler) taşıyan jel bir tabaka bulunur. Baş eğildiğinde ya da hızlandığında kristallerin ağırlığı tabakayı kaydırır ve tüy hücreleri uyarılır.',
    },
  },
};

export default content;
