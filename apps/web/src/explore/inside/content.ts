import type { InsideId } from './registry';

/**
 * İçeri-gir sahnelerinin eğitim içeriği: aşamalar (süreç adımları) ve seçilebilir nesneler.
 * Hepsi genel biyoloji bilgisidir; kişinin kendi dokusundan bir bulgu değildir.
 * Ölçekler anlaşılır olsun diye bilerek değiştirilmiştir (ör. LDL gerçekte alyuvardan ~300 kat küçüktür).
 */

export interface Stage {
  title: string;
  text: string;
}

export interface SceneObject {
  name: string;
  text: string;
  /** Gerçek boyut notu. */
  size?: string;
}

export interface SceneContent {
  stages: Stage[];
  objects: Record<string, SceneObject>;
  /** Sahneye özel uyarı (her zaman görünür). */
  caution?: string;
  /** Bu sahneyle ilişkili tahliller (katalog anahtarları). */
  tests: string[];
}

export const INSIDE_CONTENT: Record<InsideId, SceneContent> = {
  damar: {
    tests: ['ldl', 'cholesterol-total', 'hdl', 'non-hdl', 'triglyceride', 'hs-crp', 'homocysteine'],
    caution:
      'Bu bir EĞİTİMSEL BİYOLOJİK SİMÜLASYONDUR. Yüksek bir LDL sonucu, damarlarında plak olduğunu, plağın yerini ya da boyutunu göstermez. Plak yalnızca görüntüleme yöntemleriyle değerlendirilebilir.',
    stages: [
      {
        title: 'Kan akışı',
        text: 'Atardamarın içindesin. Plazmada alyuvarlar, LDL ve HDL parçacıkları akıyor. Akış damarın ortasında en hızlı, duvara yakın yerde en yavaştır.',
      },
      {
        title: 'LDL taşınması',
        text: 'LDL, kolesterolü karaciğerden dokulara taşıyan bir lipoprotein paketidir. Hücrelerin zar yapımı ve hormon üretimi için kolesterole ihtiyacı vardır.',
      },
      {
        title: 'Duvara giriş',
        text: 'Kandaki LDL miktarı arttıkça, bir kısmı endotelin altındaki katmana (intima) geçer ve orada tutulabilir. Akışın düzensiz olduğu dallanma noktaları daha yatkındır.',
      },
      {
        title: 'LDL’nin değişimi',
        text: 'Duvarda tutulan LDL oksidasyon gibi kimyasal değişikliklere uğrayabilir. Değişmiş LDL, bağışıklık sistemi tarafından yabancı gibi algılanır.',
      },
      {
        title: 'İnflamatuvar yanıt',
        text: 'Endotel hücreleri yapışma molekülleri gösterir; kandaki monositler duvara yavaşlayıp yapışır. hs-CRP gibi belirteçler bu tür inflamasyonla ilişkili olabilir.',
      },
      {
        title: 'Monositten makrofaja',
        text: 'Monositler endotelin arasından duvara geçer ve makrofaja dönüşür. Makrofajlar değişmiş LDL’yi yutar.',
      },
      {
        title: 'Köpük hücreleri',
        text: 'Çok fazla lipid yutan makrofajlar köpük hücresine dönüşür. HDL, kolesterolün bir kısmını bu hücrelerden alıp karaciğere geri taşıyabilir (ters kolesterol taşınması).',
      },
      {
        title: 'Plak gelişimi',
        text: 'Yıllar içinde lipid çekirdeği ve üzerinde lifli bir örtü oluşabilir; damar iç çapı daralabilir. Bu süreç yavaştır ve birçok etkene bağlıdır: genetik, tansiyon, sigara, diyabet, yaş.',
      },
    ],
    objects: {
      rbc: { name: 'Alyuvar (eritrosit)', text: 'Hemoglobin taşıyan, ortası çukur disk biçimli hücre. Oksijeni akciğerden dokulara taşır.', size: 'yaklaşık 7–8 mikrometre' },
      ldl: { name: 'LDL parçacığı', text: 'Düşük yoğunluklu lipoprotein. Kolesterolü karaciğerden dokulara taşır. Tahlildeki “LDL kolesterol” bu parçacıklardaki kolesterol miktarıdır.', size: 'yaklaşık 20–25 nanometre (burada büyütülmüş)' },
      hdl: { name: 'HDL parçacığı', text: 'Yüksek yoğunluklu lipoprotein. Fazla kolesterolü dokulardan alıp karaciğere geri taşımaya katkıda bulunur.', size: 'yaklaşık 8–12 nanometre (burada büyütülmüş)' },
      platelet: { name: 'Trombosit', text: 'Kanamayı durduran küçük hücre parçası. Damar hasarında ilk yanıt verenlerdendir.', size: 'yaklaşık 2–3 mikrometre' },
      vldl: { name: 'Trigliseritten zengin lipoprotein (VLDL)', text: 'Karaciğerin ürettiği, trigliserid taşıyan büyük lipoprotein. Trigliserid yüksekken sayıları artar; çok yüksek değerlerde plazma bulanık (sütümsü) görünebilir. Sahnede yalnızca trigliseridin yüksek olduğu durumda görünür.', size: 'yaklaşık 30–80 nanometre (burada büyütülmüş)' },
      endothelium: { name: 'Endotel', text: 'Damarın iç yüzeyini döşeyen tek katlı hücre tabakası. Akışı, pıhtılaşmayı ve damar genişliğini düzenleyen maddeler salgılar.' },
      wall: { name: 'Damar duvarı', text: 'İç (intima), orta (media, düz kas) ve dış (adventisya) katmanlardan oluşur. Ateroskleroz intimada gelişir.' },
      oxldl: { name: 'Değişmiş (oksitlenmiş) LDL', text: 'Duvarda tutulup kimyasal olarak değişmiş LDL. Bağışıklık hücrelerini çeker.' },
      monocyte: { name: 'Monosit', text: 'Kanda dolaşan bir akyuvar türü. Dokuya geçince makrofaja dönüşür.', size: 'yaklaşık 15–20 mikrometre' },
      macrophage: { name: 'Makrofaj', text: 'Yabancı ya da değişmiş maddeleri yutan bağışıklık hücresi.' },
      foam: { name: 'Köpük hücresi', text: 'İçi lipid damlacıklarıyla dolmuş makrofaj. Mikroskopta köpüklü görünür; erken plak (yağlı çizgi) evresinin işaretidir.' },
      plaque: { name: 'Plak (temsili)', text: 'Lipid çekirdeği, bağışıklık hücreleri ve lifli örtüden oluşan birikim. BU SAHNEDEKİ PLAK TEMSİLİDİR; senin damarlarını göstermez.' },
    },
  },
  alveol: {
    tests: ['hemoglobin', 'hematocrit', 'rbc'],
    stages: [
      { title: 'Hava kesecikleri', text: 'En ince hava yolları, üzüm salkımı gibi alveol keseciklerinde sonlanır. İki akciğerde yüz milyonlarca alveol vardır.' },
      { title: 'Kılcal ağ', text: 'Her alveolün çevresi ince bir kılcal damar ağıyla sarılıdır. Alyuvarlar bu kılcallardan neredeyse tek sıra halinde geçer.' },
      { title: 'Oksijen kana geçer', text: 'Oksijen, alveol duvarı ile kılcal duvarından oluşan çok ince bir engeli difüzyonla geçer ve alyuvardaki hemoglobine bağlanır.' },
      { title: 'Karbondioksit atılır', text: 'Dokulardan gelen karbondioksit ters yönde kandan alveole geçer ve nefesle dışarı verilir.' },
      { title: 'Sürfaktan', text: 'Tip II alveol hücreleri, alveollerin sönmesini önleyen yüzey etkin bir madde (sürfaktan) üretir.' },
    ],
    objects: {
      alveolus: { name: 'Alveol', text: 'Gaz değişiminin gerçekleştiği küçük hava keseciği.', size: 'yaklaşık 0,2 milimetre' },
      type1: { name: 'Tip I alveol hücresi', text: 'Alveol yüzeyinin büyük kısmını kaplayan çok ince hücre; gaz geçişine izin verir.' },
      type2: { name: 'Tip II alveol hücresi', text: 'Sürfaktan üreten, gerektiğinde yeni alveol hücrelerine dönüşebilen hücre.' },
      capillary: { name: 'Kılcal damar', text: 'Duvarı tek hücre kalınlığında olan en ince damar.' },
      rbc: { name: 'Alyuvar', text: 'Hemoglobin taşır. Oksijen bağlayınca daha parlak kırmızı görünür.' },
      o2: { name: 'Oksijen (O₂)', text: 'Alveolden kana difüzyonla geçer.' },
      co2: { name: 'Karbondioksit (CO₂)', text: 'Kandan alveole geçer ve nefesle atılır.' },
      macrophage: { name: 'Alveol makrofajı', text: 'Alveollere ulaşan tozu ve mikropları temizleyen bağışıklık hücresi.' },
    },
  },
  nefron: {
    tests: ['creatinine', 'egfr', 'urea', 'bun', 'uric-acid', 'sodium', 'potassium', 'albumin'],
    caution: 'Kreatinin düzeyi kas kütlesi, sıvı durumu ve bazı ilaçlardan da etkilenir; tek bir değer böbrek hastalığı anlamına gelmez.',
    stages: [
      { title: 'Nefron', text: 'Böbreğin süzme birimi: bir kılcal yumağı (glomerül), onu saran Bowman kapsülü ve uzun bir tübülden oluşur.' },
      { title: 'Glomerüle kan girişi', text: 'Kan, getirici arteriyolden glomerül kılcallarına girer, götürücü arteriyolden çıkar. Aradaki basınç süzmeyi sağlar.' },
      { title: 'Süzme', text: 'Su, tuzlar, glukoz, üre ve kreatinin gibi küçük moleküller kılcal duvarından ve podosit yarıklarından Bowman kapsülüne geçer. Kan hücreleri ve albumin gibi büyük proteinler kanda kalır.' },
      { title: 'Geri emilim ve atılım', text: 'Tübül; suyun, tuzun ve glukozun çoğunu geri emer. Kreatinin ise büyük ölçüde idrarla atılır. Bu yüzden kandaki kreatinin, böbreğin süzme hızı (eGFR) hesabında kullanılır.' },
    ],
    objects: {
      glomerulus: { name: 'Glomerül', text: 'Getirici ve götürücü arteriyoller arasındaki kılcal yumağı.', size: 'yaklaşık 0,2 milimetre' },
      bowman: { name: 'Bowman kapsülü', text: 'Glomerülü saran, süzülen sıvıyı toplayan çift katlı kapsül.' },
      podocyte: { name: 'Podosit', text: 'Kılcalları ayaksı uzantılarıyla saran hücre. Uzantıların arasındaki yarıklar büyük proteinleri tutar.' },
      afferent: { name: 'Getirici arteriyol', text: 'Glomerüle kan getiren küçük atardamar.' },
      efferent: { name: 'Götürücü arteriyol', text: 'Süzülmüş kanı glomerülden götüren küçük atardamar.' },
      tubule: { name: 'Tübül', text: 'Süzüntüden gerekli maddeleri geri emen, bazılarını salgılayan kanal.' },
      creatinine: { name: 'Kreatinin', text: 'Kas metabolizmasının atık ürünü. Serbestçe süzülür, çok az geri emilir.' },
      albumin: { name: 'Albumin', text: 'Kanın ana proteini. Sağlıklı süzgeçten geçemeyecek kadar büyüktür.' },
      urea: { name: 'Üre', text: 'Proteinlerin yıkımından karaciğerde oluşan atık. Süzülür; bir kısmı geri emilir. Sıvı kaybında ve böbrek süzmesi azaldığında kanda artar.' },
      water: { name: 'Su ve tuzlar', text: 'Süzülür; büyük kısmı tübülde geri emilir.' },
      rbc: { name: 'Alyuvar', text: 'Süzgeçten geçmez, kanda kalır.' },
    },
  },
  lobul: {
    tests: ['alt', 'ast', 'ggt', 'alp', 'bilirubin-total', 'albumin', 'inr', 'cholesterol-total', 'ldl'],
    caution: 'ALT/AST yüksekliği hangi hücrelerin, ne kadar ve neden zorlandığını tek başına göstermez; egzersiz, ilaçlar ve birçok durum etkileyebilir.',
    stages: [
      { title: 'Lobül', text: 'Karaciğer, altıgen biçimli milyonlarca lobülden oluşur. Köşelerde portal alanlar, ortada merkez ven bulunur.' },
      { title: 'Kan akışı', text: 'Bağırsaktan gelen portal ven kanı ve oksijenli arter kanı, sinüzoid denen geniş kılcallardan merkez vene doğru akar.' },
      { title: 'Hepatositlerin işi', text: 'Hepatositler kan geçerken albumin ve pıhtılaşma faktörlerini üretir, kolesterolü yapar ve LDL’yi kandan alır, glukozu glikojen olarak depolar, ilaçları dönüştürür.' },
      { title: 'Safra', text: 'Hepatositler safrayı kan akışının tersi yönde, ince safra kanalcıklarına verir; safra portal alandaki safra kanalına ulaşır.' },
      { title: 'Enzimler kana geçer', text: 'Hepatositler zorlandığında içlerindeki ALT ve AST gibi enzimler kana daha fazla geçer. Kan tahlilinde ölçülen budur.' },
    ],
    objects: {
      albumin: { name: 'Albumin', text: 'Hepatositlerin ürettiği ana kan proteini. Sıvıyı damar içinde tutar, birçok maddeyi taşır. Uzun süreli düşüklük karaciğerin yapım kapasitesi, beslenme ya da idrarla kayıpla ilişkili olabilir.' },
      hepatocyte: { name: 'Hepatosit', text: 'Karaciğerin ana hücresi; metabolizmanın büyük kısmını yürütür.', size: 'yaklaşık 20–30 mikrometre' },
      sinusoid: { name: 'Sinüzoid', text: 'Hepatosit sıraları arasındaki geçirgen, geniş kılcal damar.' },
      centralvein: { name: 'Merkez ven', text: 'Lobülün ortasında kanı toplayan toplardamar; hepatik venlere açılır.' },
      portal: { name: 'Portal alan', text: 'Portal ven dalı, hepatik arter dalı ve safra kanalının bir arada bulunduğu köşe.' },
      kupffer: { name: 'Kupffer hücresi', text: 'Sinüzoidlerde yaşayan, kanı temizleyen makrofaj.' },
      bile: { name: 'Safra kanalcığı', text: 'Hepatositlerin safrayı bıraktığı ince kanal.' },
      alt: { name: 'ALT enzimi', text: 'Hepatositlerin içinde bol bulunan bir enzim. Hücre zorlandığında kana geçer.' },
      rbc: { name: 'Alyuvar', text: 'Sinüzoidlerde akan kan hücresi.' },
    },
  },
  adacik: {
    tests: ['glucose', 'hba1c', 'insulin'],
    caution: 'Tek bir yüksek glukoz değeri diyabet tanısı değildir; açlık durumu, stres ve zamanlama etkiler. Tanı hekim tarafından tekrarlı ölçümlerle konur.',
    stages: [
      { title: 'Pankreas dokusu', text: 'Pankreasın çoğu sindirim enzimi üreten asinus hücreleridir. Aralarına serpiştirilmiş hücre kümeleri Langerhans adacıklarıdır.' },
      { title: 'Adacık hücreleri', text: 'Adacıkta beta hücreleri insülin, alfa hücreleri glukagon, delta hücreleri somatostatin üretir. Adacık zengin bir kılcal ağla sarılıdır.' },
      { title: 'Kan şekeri yükselir', text: 'Yemekten sonra kandaki glukoz artar. Glukoz beta hücrelerine girer ve hücre bunu “insülin salgıla” sinyali olarak algılar.' },
      { title: 'İnsülin salgısı', text: 'Beta hücreleri içlerinde depoladıkları insülin granüllerini kana bırakır.' },
      { title: 'Hücreler glukozu alır', text: 'İnsülin kas ve yağ hücrelerinde reseptörüne bağlanır; hücre zarına glukoz kanalları (GLUT4) taşınır ve glukoz hücreye girer. Kan şekeri düşer.' },
    ],
    objects: {
      rbc: { name: 'Alyuvar (HbA1c)', text: 'Kandaki glukoz alyuvardaki hemoglobine yavaşça yapışır (glikozillenme). HbA1c bunun oranını ölçer ve alyuvarlar ~120 gün yaşadığı için son 2–3 ayın ortalama kan şekerini yansıtır. Sarımsı alyuvarlar bu oranı temsil eder (abartılı ölçek).' },
      beta: { name: 'Beta hücresi', text: 'İnsülin üreten ve depolayan hücre; adacığın çoğunluğunu oluşturur.' },
      alpha: { name: 'Alfa hücresi', text: 'Kan şekeri düşünce glukagon salgılayarak karaciğerden glukoz salınmasını sağlar.' },
      delta: { name: 'Delta hücresi', text: 'Somatostatin salgılar; diğer adacık hormonlarını dengeler.' },
      acinar: { name: 'Asinus hücresi', text: 'Amilaz, lipaz gibi sindirim enzimlerini üretir.' },
      glucose: { name: 'Glukoz', text: 'Vücudun ana enerji kaynağı olan şeker.' },
      insulin: { name: 'İnsülin', text: 'Hücrelerin glukoz almasını sağlayan hormon.' },
      glucagon: { name: 'Glukagon', text: 'Kan şekerini yükselten hormon.' },
      capillary: { name: 'Kılcal damar', text: 'Adacık hormonlarını kana taşır.' },
      target: { name: 'Kas hücresi (hedef)', text: 'İnsülin sinyaliyle glukozu içeri alan hücre.' },
    },
  },
  folikul: {
    tests: ['tsh', 'ft4', 'ft3', 'anti-tpo'],
    stages: [
      { title: 'Tiroid dokusu', text: 'Tiroid, küçük keseciklerden (foliküller) oluşur. Her folikül tek sıra hücreyle çevrili, içi koloid dolu bir boşluktur.' },
      { title: 'TSH sinyali', text: 'Hipofizden gelen TSH, folikül hücrelerindeki reseptörüne bağlanır ve hormon yapımını hızlandırır.' },
      { title: 'İyot ve tiroglobulin', text: 'Hücreler kandan iyot alır; iyot, koloiddeki tiroglobulin proteinine eklenir.' },
      { title: 'T4 ve T3 salgısı', text: 'Tiroglobulin hücreye geri alınıp parçalanır; T4 ve daha az miktarda T3 kana verilir.' },
      { title: 'Geri bildirim', text: 'Kanda T4/T3 yükselince hipotalamus ve hipofiz TSH’yi azaltır; düşünce artırır. Bu yüzden TSH, tiroid işlevinin hassas bir göstergesidir.' },
    ],
    objects: {
      follicle: { name: 'Folikül hücresi', text: 'Tiroid hormonlarını üreten hücre.' },
      colloid: { name: 'Koloid', text: 'Folikülün içini dolduran, tiroglobulin depolayan jel.' },
      capillary: { name: 'Kılcal damar', text: 'Hormonları kana taşır; TSH ve iyotu getirir.' },
      tsh: { name: 'TSH', text: 'Hipofizin tiroidi uyaran hormonu.' },
      iodine: { name: 'İyot', text: 'Tiroid hormonlarının yapı taşı.' },
      t4: { name: 'T4 (tiroksin)', text: 'Tiroidin ana hormonu; dokularda T3’e dönüşür.' },
      t3: { name: 'T3', text: 'Tiroid hormonunun daha etkin biçimi.' },
      ccell: { name: 'C hücresi', text: 'Kalsitonin üreten parafoliküler hücre.' },
    },
  },
  kan: {
    tests: ['hemoglobin', 'hematocrit', 'rbc', 'mcv', 'mch', 'mchc', 'rdw', 'wbc', 'neutrophil-pct', 'lymphocyte-pct', 'monocyte-pct', 'eosinophil-pct', 'basophil-pct', 'platelet', 'mpv'],
    caution:
      'Bu sahne EĞİTİMSEL ve temsilidir: hücre sayıları senin hemogramından türetilen oranlarla çizilir ama gerçek sayılar değildir (gerçekte her akyuvara yaklaşık 700 alyuvar düşer). Hücre görünümleri boyanmış yayma görüntülerinden esinlenmiştir.',
    stages: [
      { title: 'Kan örneği', text: 'Kanın yaklaşık yarısı plazmadır; geri kalanı çoğunlukla alyuvarlardır. Akyuvarlar ve trombositler sayıca çok daha azdır. Sahnedeki sayılar ve boyutlar senin hemogramına göre ayarlanır.' },
      { title: 'Alyuvarlar', text: 'Ortası çukur disk biçimli alyuvarlar hemoglobinle oksijen taşır. MCV büyüklüklerini, MCH ise içlerindeki hemoglobin miktarını (rengin koyuluğunu) gösterir. Demir eksikliğinde küçük ve soluk, B12/folat eksikliğinde büyük olabilirler.' },
      { title: 'Beş akyuvar türü', text: 'Nötrofil (çok parçalı çekirdek; bakterilere ilk yanıt), lenfosit (büyük yuvarlak çekirdek; virüsler ve bağışıklık hafızası), monosit (böbrek biçimli çekirdek; dokuda makrofaja dönüşür), eozinofil (turuncu tanecikler; alerji ve parazitler), bazofil (koyu tanecikler; alerjik yanıt).' },
      { title: 'Trombositler', text: 'Trombositler kemik iliğindeki dev hücrelerden kopan küçük parçalardır. Damar hasar görünce yapışıp kümelenir ve pıhtılaşmayı başlatırlar.' },
      { title: 'Enfeksiyona yanıt', text: 'Bakteriler dokuya girince salgılanan sinyaller nötrofilleri çeker; nötrofiller bölgeye göç edip bakterileri yutar. Enfeksiyonda akyuvar ve nötrofil sayısının artması bu yüzdendir. (Temsili canlandırma.)' },
    ],
    objects: {
      rbc: { name: 'Alyuvar (eritrosit)', text: 'Çekirdeksiz, ortası çukur disk. Hemoglobin taşır; yaklaşık 120 gün yaşar. Hemoglobin, hematokrit, RBC, MCV, MCH ve RDW bu hücrelerle ilgilidir.', size: 'yaklaşık 7–8 mikrometre' },
      neutrophil: { name: 'Nötrofil', text: 'En çok bulunan akyuvar. Çekirdeği 3–5 parçalıdır. Bakteri enfeksiyonlarında ilk yanıt verir ve sayısı artar.', size: 'yaklaşık 12–15 mikrometre' },
      lymphocyte: { name: 'Lenfosit', text: 'Büyük, yuvarlak çekirdekli akyuvar. B ve T lenfositler antikor üretir, virüsle enfekte hücreleri tanır ve bağışıklık hafızası oluşturur.', size: 'yaklaşık 7–15 mikrometre' },
      monocyte: { name: 'Monosit', text: 'En büyük akyuvar; böbrek biçimli çekirdeği vardır. Dokuya geçince makrofaja dönüşür.', size: 'yaklaşık 15–20 mikrometre' },
      eosinophil: { name: 'Eozinofil', text: 'Turuncu-kırmızı tanecikli, genellikle iki parçalı çekirdekli akyuvar. Alerjilerde ve parazit enfeksiyonlarında artabilir.' },
      basophil: { name: 'Bazofil', text: 'Koyu mor tanecikli, en az bulunan akyuvar. Histamin salgılayarak alerjik yanıtta rol alır.' },
      platelet: { name: 'Trombosit', text: 'Pıhtılaşmayı başlatan küçük hücre parçası. Sayısı çok düşükse kanama, çok yüksekse pıhtı eğilimi değerlendirilir.', size: 'yaklaşık 2–3 mikrometre' },
      bacteria: { name: 'Bakteri (temsili)', text: 'Enfeksiyon canlandırması için gösterilir; senin kanında bakteri olduğu anlamına gelmez.' },
    },
  },
  ilik: {
    tests: ['hemoglobin', 'rbc', 'wbc', 'platelet', 'ferritin', 'iron', 'b12', 'folate', 'mcv'],
    stages: [
      { title: 'Kemik iliği', text: 'Süngerimsi kemiğin boşluklarında yer alan iliğin kırmızı kısmı kan yapar. Arada yağ hücreleri ve geniş damarlar (sinüzoidler) bulunur.' },
      { title: 'Kök hücreler', text: 'Kan kök hücreleri bölünerek hem kendilerini yeniler hem de farklı kan hücresi hatlarına dönüşen öncüller üretir.' },
      { title: 'Alyuvar yapımı', text: 'Böbrekten gelen eritropoietin (EPO) alyuvar yapımını uyarır. Hemoglobin yapımı için demir, hücre bölünmesi için B12 ve folat gerekir.' },
      { title: 'Akyuvar ve trombosit', text: 'Akyuvarlar enfeksiyona karşı savunma için olgunlaşır. Dev megakaryosit hücreleri parçalanarak trombositleri oluşturur.' },
      { title: 'Kana çıkış', text: 'Olgunlaşan hücreler sinüzoid duvarından geçerek dolaşıma katılır. Alyuvarlar yaklaşık 120 gün yaşar.' },
    ],
    objects: {
      iron: { name: 'Demir', text: 'Hemoglobin yapımı için gereklidir. Kanda transferrine bağlı taşınır, alyuvar öncüllerine verilir; fazlası ferritin olarak (karaciğer, dalak, ilik) depolanır. Ferritin düşükse depolar azalmıştır.' },
      stem: { name: 'Kan kök hücresi', text: 'Tüm kan hücrelerinin kaynağı.' },
      erythroblast: { name: 'Eritroblast', text: 'Olgunlaşmakta olan alyuvar öncüsü; çekirdeğini atarak alyuvara dönüşür.' },
      rbc: { name: 'Alyuvar', text: 'Olgun, çekirdeksiz oksijen taşıyıcı hücre.' },
      wbc: { name: 'Akyuvar (nötrofil)', text: 'Bakterilere karşı ilk savunmada görev alan akyuvar.' },
      megakaryocyte: { name: 'Megakaryosit', text: 'Trombositleri üreten dev hücre.' },
      platelet: { name: 'Trombosit', text: 'Pıhtılaşmada görev alan hücre parçası.' },
      fat: { name: 'Yağ hücresi', text: 'İlikte yaşla artan yağ dokusu.' },
      sinusoid: { name: 'Sinüzoid', text: 'Olgun hücrelerin kana geçtiği geniş damar.' },
      bone: { name: 'Kemik trabekülü', text: 'Süngerimsi kemiğin ince kemik çubukları.' },
    },
  },
};
