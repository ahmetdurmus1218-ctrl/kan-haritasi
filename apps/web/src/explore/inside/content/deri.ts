import type { SceneContent } from '../content';

/**
 * Deri katmanları sahnesinin eğitim içeriği. Genel biyoloji bilgisidir; kişinin kendi derisinden
 * bir bulgu değildir. D vitamini molekül sayısı kan değerinin temsili karşılığıdır.
 */
const content: SceneContent = {
  tests: ['vitamin-d', 'calcium'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin derini göstermez. D vitamini düzeyi güneş ışığına, mevsime, enleme, cilt tipine, yaşa, beslenmeye ve takviyelere bağlıdır; bir kan değeri derinin ne kadar D vitamini ürettiğini tek başına göstermez.',
  stages: [
    {
      title: 'Deri katmanları',
      text: 'Deri üç katmandan oluşur: dışta sürekli yenilenen epidermis, altında damar, bez, kıl kökü ve sinir içeren dermis, en altta yağ hücrelerinden oluşan hipodermis. Epidermis anlaşılır olsun diye kalın çizilmiştir; gerçekte çoğu yerde 0,1 milimetre kadardır. Damarlardaki D vitamini parçacıkları kan değerinin temsili karşılığıdır.',
    },
    {
      title: 'Epidermisin yenilenmesi',
      text: 'En alttaki bazal katmanda keratinositler bölünür; yeni hücreler yukarı itilirken keratin doldurur, yassılaşır ve çekirdeklerini kaybeder. Yüzeye ulaşan ölü, yassı hücreler koruyucu boynuz katmanını oluşturur ve sonunda dökülür. Bu yolculuk birkaç hafta sürer.',
    },
    {
      title: 'Melanin ve UV koruması',
      text: 'Bazal katmandaki melanositler melanin pigmentini üretir ve uzantılarıyla çevredeki keratinositlere aktarır. Melanin, çekirdeklerin üstünde küçük şemsiyeler gibi toplanarak DNA’yı morötesi (UV) ışığın zararından korur. UVB daha çok epidermiste, UVA ise dermise kadar ulaşır.',
    },
    {
      title: 'D vitamini yapımı',
      text: 'UVB ışığı epidermisteki 7-dehidrokolesterolü önce D3 öncülüne, ısıyla da D3 vitaminine (kolekalsiferol) dönüştürür; D3 kılcallardan kana geçer. Karaciğerde 25-OH D’ye (tahlilde ölçülen biçim), böbrekte etkin biçimine çevrilir. Etkin D vitamini bağırsaktan kalsiyum emilimini artırır.',
    },
    {
      title: 'Isı düzenleme (ter, damarlar)',
      text: 'Vücut ısınınca ter bezleri kıvrımlı salgı kısmında ter üretir ve kanalla yüzeye verir; ter buharlaşırken ısı alır. Aynı zamanda yüzeye yakın damarlar genişler, daha çok kan deriden geçer ve ısı dışarı verilir. Soğukta damarlar daralır ve ısı korunur.',
    },
    {
      title: 'Duyu (sinir uçları)',
      text: 'Deride farklı duyu alıcıları vardır: epidermise uzanan serbest sinir uçları sıcaklık ve ağrıyı, dermisin üst kısmındaki Meissner cisimcikleri hafif dokunuşu, derindeki soğan kabuğu gibi katmanlı Pacini cisimcikleri titreşim ve basıncı algılar. Oluşan sinyal sinirlerle omuriliğe ve beyne iletilir.',
    },
  ],
  objects: {
    epidermis: { name: 'Epidermis', text: 'Derinin en dış, damarsız katmanı. Katman katman dizilmiş keratinositlerden oluşur; su kaybını ve mikropların girişini engeller.', size: 'çoğu yerde yaklaşık 0,05–0,1 milimetre (avuç içi ve tabanda daha kalın)' },
    keratinocyte: { name: 'Keratinosit', text: 'Epidermisin ana hücresi. Bazal katmanda doğar, yükseldikçe keratinle dolup yassılaşır, çekirdeğini kaybeder ve sonunda yüzeyden dökülür.' },
    melanocyte: { name: 'Melanosit', text: 'Bazal katmanda yer alan, dallı uzantıları olan pigment hücresi. Ürettiği melanini çevresindeki keratinositlere aktarır. Cilt renkleri arasındaki fark melanosit sayısından çok ürettikleri melaninin miktarı ve türünden kaynaklanır.' },
    melanin: { name: 'Melanin', text: 'Deriye ve saça rengini veren pigment. Keratinositlerde çekirdeğin üstünde toplanarak UV ışığını soğurur ve DNA’yı korur. Koyu tende UVB’yi daha çok süzdüğü için aynı sürede daha az D vitamini yapılabilir.' },
    dermis: { name: 'Dermis', text: 'Epidermisin altındaki kalın bağ dokusu katmanı. Kolajen ve elastik lifler, damarlar, kıl kökleri, ter ve yağ bezleri ile sinir uçlarını taşır.', size: 'yaklaşık 1–4 milimetre' },
    collagen: { name: 'Kolajen lifleri', text: 'Deriye dayanıklılık veren protein lifleri. Üst dermiste ince, derinde kalın demetler halindedir. Yaşla ve güneş hasarıyla azalır.' },
    capillary: { name: 'Kılcal damarlar', text: 'Epidermisin hemen altında kıvrımlar yapan kılcallar epidermisi besler (epidermisin kendi damarı yoktur). Isı düzenlemede genişleyip daralır; D vitamini de buradan kana geçer.' },
    hair: { name: 'Kıl kökü ve kıl', text: 'Dermise gömülü kıl kökünün tabanındaki soğanda hücreler bölünerek kılı uzatır. Köke bağlı küçük kas (erektör pili) kasılınca kıl dikleşir (tüylerin diken diken olması).' },
    sebaceous: { name: 'Yağ bezi', text: 'Kıl köküne açılan, sebum denen yağlı salgıyı üreten bez. Sebum deriyi ve kılı kayganlaştırır, su kaybını azaltır.' },
    sweat: { name: 'Ter bezi', text: 'Dermisin derininde kıvrılmış salgı kısmı ve yüzeydeki bir gözeneğe açılan kanaldan oluşur. Terin buharlaşması vücudu serinletir. Vücutta birkaç milyon ter bezi vardır.' },
    nerve: { name: 'Sinir uçları ve cisimcikler', text: 'Serbest sinir uçları (sıcaklık, ağrı), Meissner cisimcikleri (hafif dokunma) ve katmanlı Pacini cisimcikleri (titreşim, basınç) derideki duyu alıcılarıdır; sinyallerini sinirlerle omuriliğe iletirler.' },
    fat: { name: 'Hipodermis (yağ hücreleri)', text: 'Derinin altındaki yağ dokusu. Büyük, yuvarlak yağ hücreleri enerji depolar, ısı yalıtımı sağlar ve darbelere karşı yastık görevi görür.', size: 'yağ hücresi yaklaşık 50–150 mikrometre' },
    uv: { name: 'Morötesi (UV) ışık', text: 'Güneş ışığının görünmeyen kısmı. UVB epidermiste D vitamini yapımını başlatır ama güneş yanığına da yol açar; UVA daha derine ulaşır ve derinin yaşlanmasıyla ilişkilidir. Sahnedeki ışınlar temsilidir.' },
    vitd: { name: 'D vitamini (D3)', text: 'UVB’nin epidermisteki 7-dehidrokolesterolü (soluk mavi) dönüştürmesiyle oluşur (sarı), kana geçer ve karaciğerde 25-OH D’ye çevrilir; tahlilde ölçülen budur. Besinlerden ve takviyelerden de alınır. Sahnedeki sayı kan değerinin temsili karşılığıdır.', size: 'tek bir molekül (burada çok büyütülmüş)' },
  },
};

export default content;
