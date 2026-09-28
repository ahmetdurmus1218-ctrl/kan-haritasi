import type { SceneContent } from '../content';

/**
 * Lenf düğümü ve bağışıklık sahnesinin eğitim içeriği. Genel bağışıklık biyolojisidir; kişinin
 * kendi lenf düğümünden bir bulgu değildir. Hücre ve antijen sayıları temsilidir.
 */
const content: SceneContent = {
  tests: ['wbc', 'lymphocyte-abs', 'lymphocyte-pct', 'neutrophil-pct', 'crp'],
  caution:
    'Bu sahne EĞİTİMSEL ve temsilidir; senin lenf düğümünü göstermez. Akyuvar ve lenfosit sayıları ile CRP birçok enfeksiyonda, iltihapta, stres ve ilaç kullanımında değişir. Lenf düğümlerinin durumu kan değerlerinden anlaşılamaz; muayene ve gerekirse görüntüleme ile değerlendirilir.',
  stages: [
    {
      title: 'Lenf düğümü',
      text: 'Lenf düğümleri, dokulardan gelen lenf sıvısını süzen fasulye biçimli istasyonlardır. Kapsülün altında B hücresi foliküllerinin bulunduğu korteks, daha derinde T hücrelerinin yoğun olduğu parakorteks, ortada ise medulla yer alır.',
    },
    {
      title: 'Lenf akışı ve antijenler',
      text: 'Lenf, dışbükey yüzdeki getirici damarlardan girer, sinüslerden geçer ve göbekteki (hilus) götürücü damardan çıkar. Lenfin taşıdığı mikrop parçaları (antijenler) burada makrofajlarca yakalanır; dokulardan gelen dendritik hücreler de antijen getirir.',
    },
    {
      title: 'Antijen sunumu',
      text: 'Dendritik hücre yakaladığı antijeni parçalar ve yüzeyinde T hücrelerine gösterir. Binlerce T hücresi arasından yalnızca bu antijene uyan reseptörü taşıyan az sayıda hücre etkinleşir.',
    },
    {
      title: 'T ve B hücrelerinin çoğalması',
      text: 'Etkinleşen T hücreleri hızla bölünerek aynı antijeni tanıyan bir hücre topluluğu (klon) oluşturur. Yardımcı T hücrelerinin desteğiyle foliküldeki B hücreleri de çoğalır ve germinal merkezler belirginleşir; bu sırada düğüm büyüyüp hassaslaşabilir.',
    },
    {
      title: 'Antikor üretimi',
      text: 'Olgunlaşan B hücrelerinin bir kısmı plazma hücresine dönüşür ve medullada saniyede binlerce Y biçimli antikor salgılar. Antikorlar lenf ve kanla dolaşıp antijenlere yapışır, onları etkisizleştirir ve yutucu hücrelerce yok edilmelerini kolaylaştırır.',
    },
    {
      title: 'Bellek hücreleri',
      text: 'Enfeksiyon geçtikten sonra etkin hücrelerin çoğu ölür; bir kısmı uzun ömürlü bellek T ve B hücreleri olarak kalır (sahnede altın renkli). Aynı antijenle yeniden karşılaşıldığında yanıt çok daha hızlı ve güçlü olur; aşılar da bu ilkeye dayanır.',
    },
  ],
  objects: {
    capsule: {
      name: 'Kapsül',
      text: 'Düğümü saran bağ dokusu kılıfı. Hemen altında lenfin ilk aktığı kapsül altı sinüs bulunur.',
      size: 'lenf düğümü yaklaşık 0,2–2 santimetre',
    },
    follicle: {
      name: 'Lenf folikülü (B hücresi bölgesi)',
      text: 'Korteksteki yuvarlak B lenfosit kümeleri. Uyarı yokken küçük ve sakindir; antijenle karşılaşınca ortasında germinal merkez oluşur.',
    },
    germinal: {
      name: 'Germinal merkez',
      text: 'Etkinleşen B hücrelerinin hızla bölündüğü ve antijene daha sıkı bağlanan antikorları üretecek hücrelerin seçildiği bölge. Buradan plazma hücreleri ve bellek B hücreleri çıkar.',
    },
    paracortex: {
      name: 'Parakorteks (T hücresi bölgesi)',
      text: 'Foliküllerin altındaki, T lenfositlerin yoğun olduğu bölge. Kandaki lenfositler buradaki özel venüllerden düğüme girer; dendritik hücreler antijeni burada T hücrelerine sunar.',
    },
    medulla: {
      name: 'Medulla',
      text: 'Düğümün iç kısmı. Lenfin toplandığı medulla sinüsleri ile plazma hücreleri ve makrofajlardan zengin medulla kordonlarından oluşur.',
    },
    dendritic: {
      name: 'Dendritik hücre',
      text: 'Dokularda antijen yakalayıp lenf yoluyla düğüme gelen, uzun uzantılı “haberci” hücre. Antijeni T hücrelerine sunarak bağışıklık yanıtını başlatır.',
    },
    tcell: {
      name: 'T lenfosit',
      text: 'Timusta olgunlaşan lenfosit. Yardımcı T hücreleri yanıtı yönetir, sitotoksik T hücreleri virüsle enfekte hücreleri yok eder. Kandaki lenfositlerin çoğu T hücresidir; yanıt bitince bir kısmı bellek hücresi olarak kalır.',
      size: 'yaklaşık 7–10 mikrometre',
    },
    bcell: {
      name: 'B lenfosit',
      text: 'Kemik iliğinde olgunlaşan, yüzeyindeki reseptörle antijeni doğrudan tanıyan lenfosit. Etkinleşince çoğalır; plazma hücresine ya da bellek B hücresine dönüşür.',
      size: 'yaklaşık 7–10 mikrometre',
    },
    plasma: {
      name: 'Plazma hücresi',
      text: 'Antikor üretmek için özelleşmiş olgun B hücresi. Protein yapım aygıtı çok geniştir.',
    },
    antibody: {
      name: 'Antikor (immünoglobulin)',
      text: 'Y biçimli protein. İki kolunun ucu belirli bir antijene uyar. Mikropları etkisizleştirir, kümeleştirir ve yutucu hücrelere işaretler.',
      size: 'yaklaşık 10–15 nanometre (burada çok büyütülmüş)',
    },
    antigen: {
      name: 'Antijen (temsili)',
      text: 'Bağışıklık sisteminin tanıdığı yabancı molekül ya da parça; ör. bir bakteri ya da virüs proteini. Sahnede gösterilmesi vücudunda enfeksiyon olduğu anlamına gelmez.',
    },
    macrophage: {
      name: 'Makrofaj',
      text: 'Sinüslerde bekleyip lenfle gelen mikropları ve artıkları yutan büyük hücre. Yuttuğu antijenleri lenfositlere de gösterebilir.',
    },
    lymphvessel: {
      name: 'Lenf damarı',
      text: 'Getirici (afferent) lenf damarları düğüme dışbükey yüzden girer; götürücü (efferent) damar göbekten çıkar. Lenf, dokular arası sıvıdan oluşur ve sonunda kana karışır.',
    },
    vessel: {
      name: 'Kan damarı',
      text: 'Düğüme göbekten giren atardamar ve çıkan toplardamar. Kandaki lenfositler özel yüksek endotelli venüllerden düğüme girer. Kişisel görünümde damarda akan akyuvar sayısı akyuvar (WBC) sonucuna göre ayarlanır.',
    },
  },
};

export default content;
