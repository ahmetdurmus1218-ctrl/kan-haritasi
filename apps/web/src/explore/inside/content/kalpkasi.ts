import type { SceneContent } from '../content';

/** Kalp kası (miyokard) sahnesinin eğitim içeriği. Genel biyolojidir; kişinin kalbinden bir bulgu değildir. */
const content: SceneContent = {
  tests: ['potassium', 'calcium', 'magnesium', 'ck', 'hemoglobin'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin kalbini göstermez. Potasyum, kalsiyum ve magnezyum kalp ritmi için önemlidir, ancak tek bir değer kalp hastalığı olduğunu göstermez. Kalp ritmi EKG ile değerlendirilir. Sahnedeki iyon sayıları farklar görülebilsin diye abartılmıştır.',
  stages: [
    {
      title: 'Kalp kası dokusu',
      text: 'Kalp kası (miyokard), dallanan ve uç uca bağlanan çizgili kas hücrelerinden oluşan bir ağdır. Hücrelerin arasında sık bir kılcal damar ağı bulunur. Sahnedeki iyon ve alyuvar yoğunlukları senin sonuçlarına göre ayarlanır.',
    },
    {
      title: 'Elektrik dalgası',
      text: 'Her atım, sağ kulakçıktaki sinüs düğümünde doğan bir elektrik uyarısıyla başlar. Uyarı, ara disklerdeki oluklu bağlantılar sayesinde hücreden hücreye hızla yayılır; bu yüzden kalp kası tek bir birim gibi çalışır.',
    },
    {
      title: 'Kalsiyum ve kasılma',
      text: 'Uyarı hücre zarına ulaşınca dışarıdan az miktarda kalsiyum girer ve hücre içindeki depodan (sarkoplazmik retikulum) çok daha fazla kalsiyumun salınmasını tetikler. Kalsiyum, aktin ve miyozin ipliklerinin birbirini çekmesini başlatır; sarkomerler kısalır.',
    },
    {
      title: 'Kalp döngüsü',
      text: 'Kalsiyum depoya geri pompalanınca hücreler gevşer ve kalp yeniden kanla dolar. Potasyum kanalları hücrenin elektriksel olarak dinlenme durumuna dönmesini (repolarizasyon) sağlar. Bu kasılma–gevşeme döngüsü dinlenirken dakikada yaklaşık 60–100 kez tekrarlanır.',
    },
    {
      title: 'Enerji ve oksijen',
      text: 'Kalp kası hiç durmadan çalıştığı için enerjisini neredeyse tamamen oksijenle çalışan mitokondrilerden alır; mitokondriler hücre hacminin yaklaşık üçte birini kaplar. Oksijen, kılcallardaki alyuvarların hemoglobininden hücrelere geçer.',
    },
  ],
  objects: {
    cardiomyocyte: {
      name: 'Kalp kası hücresi (kardiyomiyosit)',
      text: 'Genellikle tek (bazen iki) merkezi çekirdekli, dallanan, çizgili kas hücresi. İskelet kasından farklı olarak istemsiz çalışır ve yorulmadan kasılır.',
      size: 'yaklaşık 100 mikrometre uzunluk, 10–25 mikrometre çap',
    },
    disc: {
      name: 'Ara disk',
      text: 'Komşu kalp kası hücrelerini uç uca bağlayan özel bağlantı bölgesi. Hücreleri mekanik olarak birbirine tutturan yapışma noktaları ve elektriği geçiren oluklu bağlantılar içerir. Mikroskopta parlak, basamaklı çizgiler olarak görülür.',
    },
    gap: {
      name: 'Oluklu bağlantı (gap junction)',
      text: 'İki hücrenin sitoplazmasını birleştiren küçük kanallar. İyonlar bu kanallardan geçerek elektrik uyarısını bir hücreden diğerine hızla taşır. Sahnede dalga geçerken parlayan noktalar bunları temsil eder.',
      size: 'kanal çapı yaklaşık 1,5–2 nanometre (burada büyütülmüş)',
    },
    nucleus: {
      name: 'Çekirdek',
      text: 'Kalp kası hücresinde çekirdek hücrenin ortasında yer alır (iskelet kasında ise kenardadır). Hücrenin genetik bilgisini taşır.',
    },
    mitochondrion: {
      name: 'Mitokondri',
      text: 'Oksijen kullanarak ATP üreten organel. Kalp kası hücrelerinde miyofibriller arasında sıralar halinde dizilir. Kas hücrelerindeki CK (kreatin kinaz) enzimi bu enerjiyi kreatin fosfat aracılığıyla hızla aktarır; kas zorlandığında ya da hasar gördüğünde CK kana geçebilir.',
      size: 'yaklaşık 1–2 mikrometre',
    },
    sarcomere: {
      name: 'Sarkomer',
      text: 'Kas hücresinin kasılan en küçük birimi; iki Z çizgisi arasındaki bölgedir. Aktin ve miyozin iplikleri burada birbirinin üzerinden kayarak hücreyi kısaltır. Kasın çizgili görünümünü sarkomerlerin düzenli dizilişi verir.',
      size: 'yaklaşık 2 mikrometre',
    },
    capillary: {
      name: 'Kılcal damar',
      text: 'Kalp kasında neredeyse her kas hücresinin yanında bir kılcal bulunur; oksijen ve besinler buradan hücrelere geçer. Kalp kası kendi kanını koroner arterlerden alır.',
    },
    rbc: {
      name: 'Alyuvar',
      text: 'Hemoglobiniyle oksijen taşıyan kan hücresi. Sahnedeki alyuvar yoğunluğu hemoglobin sonucuna göre ayarlanır.',
      size: 'yaklaşık 7–8 mikrometre',
    },
    calcium: {
      name: 'Kalsiyum (Ca²⁺)',
      text: 'Her atımda hücre içinde kısa süreliğine yükselir ve kasılmayı başlatır; ardından depoya geri pompalanır. Kandaki kalsiyum düzeyi sıkı biçimde düzenlenir; kalp ritmi ve kas işlevi için önemlidir. Sahnedeki kıvılcım sayısı kalsiyum sonucuna göre ayarlanır.',
    },
    potassium: {
      name: 'Potasyum (K⁺)',
      text: 'Hücre içinde çok, hücre dışında az bulunur. Bu fark hücrenin dinlenme elektrik yükünü belirler ve her atımdan sonra hücrenin yeniden “şarj olmasını” sağlar. Tahlilde ölçülen hücre dışındaki (serum) potasyumdur; sahnede hücreler arasındaki mor parçacıklar bunu temsil eder.',
    },
    magnesium: {
      name: 'Magnezyum (Mg²⁺)',
      text: 'Çoğunlukla hücre içinde bulunur; ATP ile birlikte çalışır ve iyon pompalarının, kanalların düzenli işlemesine katkıda bulunur. Kanda ölçülen miktar, vücuttaki toplam magnezyumun küçük bir kısmıdır.',
    },
    wave: {
      name: 'Uyarı dalgası (aksiyon potansiyeli)',
      text: 'Hücre zarındaki elektrik yükünün kısa süreli tersine dönmesi. Sinüs düğümünden başlayan dalga kalp boyunca yayılır; EKG bu elektriksel etkinliğin vücut yüzeyinden kaydıdır.',
    },
    oxygen: {
      name: 'Oksijen (O₂)',
      text: 'Alyuvarlardan kılcal duvarını geçerek kas hücrelerine ulaşır ve mitokondride enerji üretiminde kullanılır.',
    },
  },
};

export default content;
