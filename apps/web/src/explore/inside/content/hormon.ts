import type { SceneContent } from '../content';

/**
 * Hormon salgısı sahnesinin eğitim içeriği. Genel endokrin biyolojisidir; kişinin kendi bezinden
 * bir bulgu değildir. Molekül sayıları kişisel değerin temsili karşılığıdır.
 */
const content: SceneContent = {
  tests: ['tsh', 'ft4', 'cortisol', 'prolactin', 'fsh', 'lh', 'testosterone', 'estradiol', 'progesterone', 'dhea-s'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin dokunu göstermez. Hormon düzeyleri günün saatine, adet döngüsünün evresine, strese, uykuya ve kullanılan ilaçlara göre değişir. Tek bir değer bir bezin hastalığı olduğunu ya da olmadığını göstermez; sonuçlar hekim tarafından birlikte değerlendirilir.',
  stages: [
    {
      title: 'Salgı hücreleri',
      text: 'Endokrin bezlerin salgı hücreleri hormonları kanal olmadan doğrudan kana verir. Peptit hormonlar (ör. TSH, FSH, LH, prolaktin, ACTH) hücre içinde granüllerde depolanır; steroid hormonlar (ör. kortizol, testosteron, östradiol, progesteron) kolesterolden gerektikçe yapılır.',
    },
    {
      title: 'Hormonun kana verilmesi',
      text: 'Uyarı gelince peptit hormon granülleri hücre zarıyla kaynaşır ve içeriklerini dışarı boşaltır (ekzositoz). Yağda çözünen steroid hormonlar ise depolanmadan, yapıldıkça zardan geçerek gözenekli kılcal damara yayılır.',
    },
    {
      title: 'Kanla taşınma',
      text: 'Hormonlar kan akımıyla tüm vücuda dağılır. Steroid hormonların çoğu albumin ya da SHBG gibi taşıyıcı proteinlere bağlı taşınır; hücrelere yalnızca küçük serbest kısım geçebilir. Bazı tahliller toplam, bazıları yalnızca serbest miktarı ölçer (ör. serbest T4).',
    },
    {
      title: 'Hedef hücrede reseptör',
      text: 'Hormon yalnızca kendi reseptörünü taşıyan hücreleri etkiler. Peptit hormonlar zardaki reseptöre bağlanır ve hücre içinde ikincil haberci (ör. cAMP) sinyali yayılır; steroid hormonlar zardan geçip hücre içindeki reseptöre bağlanır ve çekirdekte bazı genlerin okunmasını değiştirir.',
    },
    {
      title: 'Geri bildirim döngüsü',
      text: 'Hipotalamus ve hipofiz kandaki hormon düzeyini izler. Düzey yükselince bezi uyaran hormonların (ör. ACTH, TSH, LH, FSH) salgısı azalır, düşünce artar (negatif geri bildirim). Bu yüzden bir hormon ve onu uyaran hormon çoğu zaman birlikte değerlendirilir.',
    },
  ],
  objects: {
    gland: {
      name: 'Salgı (bez) hücresi',
      text: 'Hormon üreten hücre. Hipofiz, böbreküstü bezi, tiroid, testis ve yumurtalık gibi bezlerde bulunur. Sahnede rengi ve vurgulanan hormon türü, girdiğin yapıya göre değişir.',
    },
    granule: {
      name: 'Salgı granülü',
      text: 'Peptit hormonların hazır bekletildiği küçük zar keseciği. Steroid üreten hücrelerde bunun yerine kolesterol depolayan lipid damlacıkları bulunur; steroidlerin kendisi depolanmaz, gerektikçe yapılır.',
      size: 'yaklaşık 0,1–0,3 mikrometre (burada büyütülmüş)',
    },
    peptide: {
      name: 'Peptit (ve amin) hormon',
      text: 'Amino asitlerden yapılan, suda çözünen hormon; kanda çoğunlukla serbest dolaşır ve hücre zarından geçemez. Örnekler: TSH, FSH, LH, prolaktin, ACTH, insülin. Melatonin ve adrenalin gibi amin hormonlar da başlıca zardaki reseptörlerle etki eder (tiroid hormonları istisnadır).',
    },
    steroid: {
      name: 'Steroid hormon',
      text: 'Kolesterolden yapılan, yağda çözünen hormon; hücre zarından geçebilir. Örnekler: kortizol, aldosteron, testosteron, östradiol, progesteron ve böbreküstü bezinin salgıladığı bir androjen öncüsü olan DHEA-S. Sahnede altıgen halka simgesiyle gösterilir.',
    },
    capillary: {
      name: 'Kılcal damar',
      text: 'Bezlerin kılcalları gözenekli (fenestralı) olduğundan hormonlar kana kolayca geçer. Kan, hormonu vücudun her yerine taşır.',
    },
    carrier: {
      name: 'Taşıyıcı protein (albumin, SHBG)',
      text: 'Kanda steroid hormonlara bağlanan proteinler. Bağlı hormon hem korunur hem de depo gibi davranır; hücreye yalnızca serbest kısım geçer. SHBG testosteron ve östradiolü, CBG kortizolü taşır; albumin birçok hormonu gevşekçe bağlar.',
    },
    target: {
      name: 'Hedef hücre',
      text: 'Hormona uygun reseptörü olan hücre. Aynı hormon farklı hedef hücrelerde farklı etkiler doğurabilir. Sahnede üstteki hücre zar reseptörlü, alttaki hücre içi reseptörlü hedefi temsil eder.',
    },
    receptor: {
      name: 'Reseptör',
      text: 'Hormonu anahtar–kilit gibi tanıyan protein. Peptit hormon reseptörleri hücre zarında, steroid hormon reseptörleri hücre içinde (sitoplazma ya da çekirdek) bulunur. Hücredeki reseptör sayısı da hormonun etkisini belirler.',
    },
    messenger: {
      name: 'İkincil haberci',
      text: 'Zar reseptörü uyarılınca hücre içinde çoğalan küçük sinyal molekülleri (ör. cAMP, kalsiyum). Tek bir hormon molekülü çok sayıda haberci oluşturarak sinyali güçlendirir; etki saniyeler–dakikalar içinde başlar.',
    },
    nucleus: {
      name: 'Çekirdek ve DNA',
      text: 'Steroid hormon–reseptör birleşimi çekirdekte DNA’daki belirli bölgelere bağlanır ve bazı genlerin okunmasını artırır ya da azaltır. Yeni proteinler yapıldığı için bu etki saatler içinde gelişir ve daha uzun sürer.',
    },
    feedback: {
      name: 'Hipotalamus–hipofiz (şema)',
      text: 'Beyindeki hipotalamus salgılatıcı hormonlarla hipofizi, hipofiz de uyarıcı hormonlarla (TSH, ACTH, LH, FSH) bezleri yönetir. Kandaki hormon düzeyi yükselince bu uyarı azalır; termostat gibi çalışan bu düzene negatif geri bildirim denir.',
    },
    rbc: {
      name: 'Alyuvar',
      text: 'Kılcal damarda akan kan hücresi; hormonlar plazmada, alyuvarların arasında taşınır.',
      size: 'yaklaşık 7–8 mikrometre',
    },
  },
};

export default content;
