import type { SceneContent } from '../content';

/**
 * Mide duvarı sahnesinin eğitim içeriği. Genel biyoloji bilgisidir; kişinin kendi dokusundan
 * bir bulgu değildir. Lümendeki B12 ve demir miktarı kan değerlerinin temsili karşılığıdır.
 */
const content: SceneContent = {
  tests: ['b12', 'ferritin', 'iron', 'albumin'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin mide dokunu göstermez. Düşük B12 ya da demirin birçok olası nedeni vardır (beslenme, emilim sorunları, kan kaybı, bazı ilaçlar); bir kan değeri midenin durumunu tek başına göstermez. Değerlendirmeyi hekim yapar.',
  stages: [
    {
      title: 'Mide duvarı katmanları',
      text: 'Mide duvarı içten dışa mukoza, submukoza, kas katmanları ve ince bir seroza örtüsünden oluşur. Mukoza yüzeyindeki milyonlarca küçük çukurcuk mide bezlerine açılır. Boşluktaki B12 ve demir miktarı kan değerlerinin temsili karşılığıdır; midendeki gerçek miktarı göstermez.',
    },
    {
      title: 'Mide bezleri',
      text: 'Her çukurcuk tüp biçimli bezlerle devam eder. Bezin üst kısmında mukus boyun hücreleri, ortasında asit ve iç faktör salgılayan pariyetal hücreler, derininde pepsinojen salgılayan esas (şef) hücreler bulunur.',
    },
    {
      title: 'Asit salgısı (pariyetal hücre)',
      text: 'Pariyetal hücreler zarlarındaki proton pompalarıyla (H⁺/K⁺-ATPaz) hidrojen iyonlarını bez boşluğuna verir; klorürle birlikte hidroklorik asit oluşur. Mide içi pH 1–3’e kadar düşebilir: asit mikropların çoğunu öldürür, besinlerdeki B12’nin serbestleşmesine ve demirin çözünür kalmasına yardım eder.',
    },
    {
      title: 'Pepsin ve protein sindirimi',
      text: 'Esas hücreler pepsini etkisiz öncülü pepsinojen olarak salgılar; pepsinojen asitli ortamda pepsine dönüşür. Pepsin uzun protein zincirlerini daha kısa parçalara (peptitlere) keser; protein sindirimi ince bağırsakta tamamlanır.',
    },
    {
      title: 'Koruyucu mukus',
      text: 'Yüzey ve boyun hücreleri kalın bir mukus tabakası ve bikarbonat salgılar. Bu tabaka hücre yüzeyinin hemen önünde pH’ı nötre yakın tutar; böylece asit ve pepsin mide duvarının kendisini sindiremez.',
    },
    {
      title: 'İç faktör ve B12',
      text: 'Pariyetal hücreler B12 emilimi için gereken iç faktörü de üretir. Besinlerden serbestleşen B12 önce başka bir taşıyıcıya (haptokorin) bağlanır, on iki parmak bağırsağında iç faktöre geçer ve bu çift ince bağırsağın son kısmında (ileum) emilir. Sahnede birleşme, anlaşılır olsun diye çıkış yolunda gösterilir.',
    },
  ],
  objects: {
    mucosa: { name: 'Mukoza', text: 'Midenin iç yüzünü döşeyen katman: yüzey epiteli, mide bezleri ve aralarındaki bağ dokusu (lamina propria). Yüzey hücreleri birkaç günde bir yenilenir.', size: 'kalınlığı yaklaşık 0,5–1,5 milimetre' },
    pit: { name: 'Mide çukurcuğu (foveola)', text: 'Mukoza yüzeyindeki küçük çukur. Dibine bir ya da birkaç mide bezi açılır; bezlerin salgısı buradan mide boşluğuna çıkar.' },
    gland: { name: 'Mide bezi', text: 'Çukurcuktan aşağı inen tüp biçimli bez. Duvarındaki farklı hücreler asit, enzim, mukus ve iç faktör salgılar.' },
    parietal: { name: 'Pariyetal hücre', text: 'Büyük, üçgenimsi, pembe boyanan hücre. Proton pompasıyla mide asidini üretir ve B12 emilimi için gerekli iç faktörü salgılar. Bu yoğun iş için çok sayıda mitokondri taşır.', size: 'yaklaşık 20–30 mikrometre' },
    chief: { name: 'Esas (şef) hücre', text: 'Bezin derin kısmında bulunan hücre. Protein sindiren pepsinin öncülü pepsinojeni (ve az miktarda mide lipazını) salgılar.' },
    mucous: { name: 'Mukus hücreleri', text: 'Yüzey mukus hücreleri ve bez boynundaki mukus boyun hücreleri koruyucu mukus ile bikarbonat salgılar. Boyun bölgesindeki kök hücreler bezin yeni hücrelerini üretir.' },
    acid: { name: 'Mide asidi (H⁺)', text: 'Pariyetal hücrelerin verdiği hidrojen iyonları klorürle hidroklorik asidi oluşturur. Mikropları öldürür, pepsinojeni pepsine çevirir, besinlerden B12’nin ve demirin serbestleşmesine yardım eder.' },
    pepsin: { name: 'Pepsin', text: 'Proteinleri kısa parçalara kesen enzim. Etkisiz pepsinojen olarak salgılanır (mor), asitli ortamda etkin pepsine dönüşür (turuncu).' },
    protein: { name: 'Protein zinciri', text: 'Besinlerdeki proteinler amino asitlerden oluşan uzun zincirlerdir. Midede pepsinle kısaltılır; ince bağırsakta amino asitlere kadar parçalanıp emilir.' },
    mucus: { name: 'Mukus tabakası', text: 'Mide yüzeyini örten kaygan jel. İçinde tutulan bikarbonat asidi nötrler; asit ve pepsin hücre yüzeyine ulaşamaz.' },
    intrinsic: { name: 'İç faktör', text: 'Pariyetal hücrelerin salgıladığı protein. B12’ye bağlanır ve ileumdaki özel alıcılar sayesinde B12’nin emilmesini sağlar. İç faktör olmadan B12 çok az emilir.' },
    b12: { name: 'B12 vitamini', text: 'Hayvansal besinlerde bulunan vitamin. Kan hücresi yapımı ve sinir sistemi için gereklidir. Sahnedeki miktar kandaki B12 değerinin temsili karşılığıdır; midendeki gerçek miktarı göstermez.', size: 'tek bir molekül (burada çok büyütülmüş)' },
    iron: { name: 'Demir', text: 'Besinlerle gelen demir. Mide asidi demirin çözünür kalmasına ve emilebilir biçime (Fe²⁺) geçmesine yardım eder; asıl emilim on iki parmak bağırsağında olur. Sahnedeki miktar kan değerinin temsili karşılığıdır.' },
    muscle: { name: 'Kas katmanları', text: 'Mukozanın altındaki ince kas tabakası (muscularis mucosae) ve dışta eğik, dairesel ve boylamsal üç kas katmanı. Dalga dalga kasılmaları besini karıştırır ve mideyi bağırsağa doğru boşaltır. En dışta ince seroza örtüsü bulunur.' },
    vessel: { name: 'Submukoza ve damarlar', text: 'Mukozanın altındaki gevşek bağ dokusu; atardamar, toplardamar, lenf damarları ve sinirler taşır. Kılcal dallar bezlere oksijen ve besin getirir.' },
  },
};

export default content;
