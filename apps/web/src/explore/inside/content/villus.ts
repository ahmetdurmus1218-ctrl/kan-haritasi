import type { SceneContent } from '../content';

/**
 * Bağırsak villusları sahnesinin eğitim içeriği. Genel biyoloji bilgisidir; kişinin kendi
 * dokusundan bir bulgu değildir. Boşluktaki parçacık sayıları kan değerlerinin temsili karşılığıdır.
 */
const content: SceneContent = {
  tests: ['iron', 'ferritin', 'b12', 'folate', 'albumin', 'vitamin-d', 'glucose', 'triglyceride'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin bağırsak dokunu göstermez. Emilim sorunları yalnızca kan değerlerine bakılarak anlaşılamaz: düşük demir, B12, folat ya da D vitamininin beslenme, kan kaybı, ilaçlar gibi birçok olası nedeni vardır. Değerlendirmeyi hekim yapar.',
  stages: [
    {
      title: 'Bağırsak duvarı ve villuslar',
      text: 'İnce bağırsağın iç yüzü parmak biçimli villuslarla kaplıdır; aralarında kriptler duvara iner. Kıvrımlar, villuslar ve mikrovilluslar birlikte emilim yüzeyini yüzlerce kat artırır. Boşluktaki şeker, demir, B12 ve yağ parçacıklarının sayısı kan değerlerinden türetilen temsili bir göstergedir.',
    },
    {
      title: 'Enterositler ve mikrovillus',
      text: 'Villus yüzeyi tek sıra emici hücreyle (enterosit) döşelidir. Her enterositin boşluğa bakan yüzünde binlerce mikrovillus fırçamsı bir kenar oluşturur; sindirimi tamamlayan enzimler burada bulunur. Aralardaki goblet hücreleri koruyucu mukus salgılar.',
    },
    {
      title: 'Şeker ve protein emilimi',
      text: 'Karbonhidratlar glukoz gibi basit şekerlere, proteinler amino asitlere ve küçük peptitlere parçalanır. Bunlar enterosite özel taşıyıcılarla girer, hücrenin karşı yüzünden çıkıp kılcallara geçer ve portal venle önce karaciğere gider.',
    },
    {
      title: 'Yağ emilimi (şilomikron, lakteal)',
      text: 'Safra yağları küçük misellere ayırır; yağ asitleri enterosite girer ve burada yeniden trigliseride dönüşüp proteinle paketlenir: şilomikron. Şilomikronlar kılcala giremeyecek kadar büyüktür; villusun ortasındaki lenf kanalına (lakteal) geçer ve lenfle kana ulaşır.',
    },
    {
      title: 'Demir ve vitaminler',
      text: 'Demir çoğunlukla on iki parmak bağırsağında (duodenum) emilir; kana ne kadar geçeceğini karaciğerin hormonu hepsidin ayarlar. B12 ise iç faktöre bağlı olarak ince bağırsağın son kısmında (ileum) emilir. Anlaşılır olsun diye sahnede ikisi aynı villusta gösterilir.',
    },
    {
      title: 'Kalın bağırsak farkı',
      text: 'Kalın bağırsakta villus yoktur: yüzey düzdür ve yalnızca kript ağızları bulunur. Burada çoğunlukla su ve tuzlar emilir; kalın bir mukus tabakası yüzeyi korur. Mukusun üstünde yaşayan trilyonlarca bakteri (mikrobiyota) lifleri mayalar ve K vitamini yapımına katkıda bulunur.',
    },
  ],
  objects: {
    villus: { name: 'Villus', text: 'İnce bağırsak yüzeyindeki parmak biçimli çıkıntı. İçinde kılcal ağ, bir lenf kanalı (lakteal) ve bağ dokusu bulunur. Öndeki villus, içi görünsün diye kesik çizilmiştir.', size: 'yaklaşık 0,5–1 milimetre boyunda' },
    enterocyte: { name: 'Enterosit', text: 'Villus yüzeyini döşeyen emici hücre. Besinleri boşluk tarafındaki taşıyıcılarla alır, karşı yüzünden kana ya da lenfe verir. Kriptlerdeki kök hücrelerden sürekli yenilenir; ömrü birkaç gündür.', size: 'yaklaşık 20–25 mikrometre boyunda' },
    microvilli: { name: 'Mikrovillus (fırçamsı kenar)', text: 'Enterositin boşluğa bakan yüzündeki binlerce mikroskobik çıkıntı. Yüzeyi büyütür; şekerleri ve peptitleri son aşamada parçalayan enzimleri taşır.', size: 'yaklaşık 1 mikrometre boyunda (burada büyütülmüş)' },
    goblet: { name: 'Goblet hücresi', text: 'Kadeh biçimli, mukus salgılayan hücre. Mukus yüzeyi kayganlaştırır ve mikroplara karşı bir engel oluşturur. Kalın bağırsakta çok daha fazladır.' },
    crypt: { name: 'Kript (Lieberkühn kripti)', text: 'Villuslar arasında duvara inen bez. Tabanındaki kök hücreler bölünerek yeni epitel hücrelerini üretir; Paneth hücreleri mikroplara karşı maddeler salgılar.' },
    capillary: { name: 'Kılcal damar', text: 'Villusun içindeki ince damar ağı. Emilen şeker, amino asit, demir ve B12 kana buradan geçer; bu kan portal venle önce karaciğere gider.' },
    lacteal: { name: 'Lakteal (lenf kanalı)', text: 'Villusun ortasındaki kör uçlu lenf kanalı. Kılcallara giremeyecek kadar büyük olan şilomikronları alır; lenf sonunda göğüs kanalıyla kana karışır.' },
    glucose: { name: 'Glukoz', text: 'Karbonhidratların sindirimiyle oluşan basit şeker. Enterosite taşıyıcılarla girer ve kana geçer. Sahnedeki miktar kan şekeri değerinin temsili karşılığıdır.' },
    aminoacid: { name: 'Amino asitler', text: 'Proteinlerin yapı taşları. Sindirimle serbestleşir, enterositlerden kana geçer ve vücutta yeni proteinlerin (ör. karaciğerde albumin) yapımında kullanılır.' },
    fat: { name: 'Yağ miseli', text: 'Safra tuzlarının yağ asitleri ve monogliseritlerle oluşturduğu küçük damlacık. Yağın enterosit yüzeyine ulaşmasını sağlar; D vitamini gibi yağda çözünen vitaminler de bu yolla emilir.' },
    chylomicron: { name: 'Şilomikron', text: 'Enterositin yeniden birleştirdiği trigliseridleri, kolesterolü ve yağda çözünen vitaminleri taşıyan büyük lipoprotein paketi. Lenf yoluyla kana geçer; yemek sonrası trigliserid artışının bir kısmı buradan gelir. Sahnedeki sayı trigliserid değerinin temsili karşılığıdır.', size: 'yaklaşık 75–1200 nanometre (burada büyütülmüş)' },
    iron: { name: 'Demir', text: 'Başlıca on iki parmak bağırsağında emilir. Enterosite giren demir vücudun ihtiyacına göre kana verilir ya da hücrede tutulur; bu ayarı hepsidin yapar. Kanda transferrinle taşınır, fazlası ferritin olarak depolanır.' },
    b12: { name: 'B12 vitamini', text: 'İç faktöre bağlı olarak ince bağırsağın son kısmında (ileum) özel alıcılarla emilir. Kanda taşıyıcı proteinlere bağlanır; fazlası karaciğerde depolanır.', size: 'tek bir molekül (burada çok büyütülmüş)' },
    bacteria: { name: 'Bağırsak bakterileri (mikrobiyota)', text: 'Çoğunlukla kalın bağırsakta yaşayan trilyonlarca mikrop. Sindirilemeyen lifleri mayalayarak kısa zincirli yağ asitleri üretir, K vitamini yapımına katkıda bulunur ve zararlı mikroplarla yarışır. Sahnedeki bakteriler temsilidir.' },
    colon: { name: 'Kalın bağırsak yüzeyi', text: 'Villussuz, düz yüzey; yalnızca kript ağızları vardır. Suyun ve tuzların geri emilimi burada tamamlanır. Kalın bir mukus tabakası yüzeyi bakterilerden ayırır.' },
  },
};

export default content;
