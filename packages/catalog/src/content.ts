/**
 * "Neden önemli? / Ne yapabilirim? / Doktora sorabileceklerin" içerikleri.
 *
 * İlkeler:
 * - Genel, eğitim amaçlı bilgi; teşhis koymaz, "şu hastalıktır" demez.
 * - Kişiye özel ilaç başlatma/bırakma/doz önerisi yoktur.
 * - Yaşam tarzı önerileri geniş kabul görmüş, güvenli genel önerilerdir.
 * - Kaynak yaklaşımı: hasta odaklı laboratuvar test rehberleri (ör. MedlinePlus Lab Tests).
 *   Yayından önce bir hekimin gözden geçirmesi önerilir.
 */
export interface LearnContent {
  what: string;
  high?: string;
  low?: string;
  factors: string[];
  actions: string[];
  askDoctor: string[];
}

const GENERAL_ASK = [
  'Bu sonuç önceki tahlillerimle karşılaştırıldığında nasıl?',
  'Tekrar ölçüm veya ek test gerekir mi, ne zaman?',
];

const HEART_HEALTHY = [
  'Doymuş ve trans yağı azaltıp sebze, meyve, baklagil, tam tahıl ve lifli gıdaları artırmak',
  'Haftada en az 150 dakika orta tempolu fiziksel aktivite (hekiminin uygun gördüğü ölçüde)',
  'Sigara kullanıyorsan bırakmak için destek almak',
  'Fazla kiloyu kademeli olarak azaltmak',
];

const DIFF_COMMON: LearnContent = {
  what: 'Akyuvarlar (lökositler) farklı türlerden oluşur. Her türün sayısı ve oranı, bağışıklık sisteminin o anki durumu hakkında fikir verir.',
  high: 'Artış; enfeksiyon, iltihap, alerji, stres veya bazı ilaçlarla ilişkili olabilir. Tek başına bir tanı anlamına gelmez.',
  low: 'Azalma; bazı enfeksiyonlar, ilaçlar veya kemik iliğini etkileyen durumlarla ilişkili olabilir.',
  factors: ['Yakın zamanda geçirilen enfeksiyon veya aşı', 'Kortizon gibi ilaçlar', 'Yoğun egzersiz ve stres', 'Sigara'],
  actions: ['Enfeksiyon belirtilerini (ateş, halsizlik) not etmek', 'Kullandığın ilaçları hekiminle paylaşmak'],
  askDoctor: ['Diğer akyuvar türleri ve toplam lökosit sayısıyla birlikte nasıl değerlendiriliyor?', ...GENERAL_ASK],
};

export const CONTENT: Record<string, LearnContent> = {
  hemoglobin: {
    what: 'Hemoglobin, alyuvarların içinde oksijeni akciğerlerden dokulara taşıyan proteindir.',
    high: 'Yüksekliği; sıvı kaybı, sigara, yüksek rakımda yaşama veya kemik iliğinin fazla alyuvar üretmesiyle ilişkili olabilir.',
    low: 'Düşüklüğü (kansızlık) demir, B12 veya folat eksikliği, kan kaybı ya da kronik hastalıklarla ilişkili olabilir.',
    factors: ['Sıvı alımı (susuzluk değeri yükseltebilir)', 'Adet kanaması, gebelik', 'Sigara', 'Yüksek rakım'],
    actions: ['Demir, B12 ve folat açısından dengeli beslenmek (kırmızı et, baklagil, yeşil yapraklı sebzeler)', 'Belirgin yorgunluk, çarpıntı veya nefes darlığını hekime söylemek'],
    askDoctor: ['Kansızlığın nedenini anlamak için demir, B12, folat testleri gerekir mi?', ...GENERAL_ASK],
  },
  hematocrit: {
    what: 'Hematokrit, kan hacminin yüzde kaçının alyuvarlardan oluştuğunu gösterir.',
    high: 'Sıvı kaybı, sigara veya alyuvar üretiminin artmasıyla ilişkili olabilir.',
    low: 'Genellikle hemoglobin düşüklüğüyle birlikte görülür ve kansızlığı düşündürebilir.',
    factors: ['Sıvı dengesi', 'Gebelik', 'Rakım'],
    actions: ['Yeterli sıvı almak', 'Hemoglobin ve alyuvar indeksleriyle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  rbc: {
    what: 'Alyuvar (eritrosit) sayısı, kanda oksijen taşıyan hücrelerin miktarını gösterir.',
    high: 'Sıvı kaybı, sigara veya kemik iliğinin fazla üretimiyle ilişkili olabilir.',
    low: 'Kansızlık, kan kaybı veya üretim azlığıyla ilişkili olabilir.',
    factors: ['Sıvı dengesi', 'Rakım', 'Bazı ilaçlar'],
    actions: ['Hemoglobin, MCV ve diğer indekslerle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  wbc: {
    what: 'Lökosit (akyuvar) sayısı, bağışıklık sisteminin savunma hücrelerinin toplam miktarıdır.',
    high: 'Enfeksiyon, iltihap, stres, sigara veya bazı ilaçlarla ilişkili olabilir.',
    low: 'Bazı viral enfeksiyonlar, ilaçlar veya kemik iliğini etkileyen durumlarla ilişkili olabilir.',
    factors: ['Yakın zamanda geçirilen enfeksiyon', 'Kortizon gibi ilaçlar', 'Yoğun egzersiz', 'Sigara'],
    actions: ['Ateş, boğaz ağrısı gibi enfeksiyon belirtilerini not etmek'],
    askDoctor: ['Akyuvar türlerinin dağılımı (formül) ne gösteriyor?', ...GENERAL_ASK],
  },
  platelet: {
    what: 'Trombositler, kanamayı durdurmak için pıhtı oluşumunu başlatan kan hücreleridir.',
    high: 'İltihap, demir eksikliği, kanama sonrası dönem veya kemik iliğiyle ilgili durumlarla ilişkili olabilir.',
    low: 'Viral enfeksiyonlar, bazı ilaçlar, dalakta tutulma veya bağışıklık kaynaklı durumlarla ilişkili olabilir.',
    factors: ['Yakın zamanda geçirilen enfeksiyon', 'Alkol', 'Bazı ilaçlar (ör. kan sulandırıcılar değil, bazı antibiyotikler)'],
    actions: ['Kolay morarma, diş eti veya burun kanamasını hekime söylemek'],
    askDoctor: GENERAL_ASK,
  },
  mcv: {
    what: 'MCV, alyuvarların ortalama büyüklüğüdür. Kansızlığın türünü anlamaya yardım eder.',
    high: 'Büyük alyuvarlar B12 veya folat eksikliği, alkol ya da tiroid ve karaciğerle ilgili durumlarla ilişkili olabilir.',
    low: 'Küçük alyuvarlar sıklıkla demir eksikliği veya kalıtsal hemoglobin farklılıklarıyla (ör. talasemi taşıyıcılığı) ilişkilidir.',
    factors: ['Alkol', 'Beslenme', 'Bazı ilaçlar'],
    actions: ['Demir, B12 ve folat düzeyleriyle birlikte değerlendirmek'],
    askDoctor: ['Talasemi taşıyıcılığı açısından değerlendirme gerekir mi?', ...GENERAL_ASK],
  },
  mch: {
    what: 'MCH, bir alyuvardaki ortalama hemoglobin miktarıdır.',
    high: 'Genellikle büyük alyuvarlarla (yüksek MCV) birlikte görülür.',
    low: 'Genellikle demir eksikliği veya talasemi taşıyıcılığıyla birlikte görülür.',
    factors: ['Beslenme', 'Kalıtsal özellikler'],
    actions: ['MCV ve demir testleriyle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  mchc: {
    what: 'MCHC, alyuvarların içindeki hemoglobin yoğunluğudur.',
    high: 'Nadirdir; bazı kalıtsal alyuvar şekil bozuklukları veya ölçüm etkileriyle ilişkili olabilir.',
    low: 'Demir eksikliğiyle ilişkili olabilir.',
    factors: ['Numune kalitesi'],
    actions: ['Diğer alyuvar indeksleriyle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  rdw: {
    what: 'RDW, alyuvarların büyüklük farklılığını gösterir.',
    high: 'Alyuvarların boyutları arasında fark olduğunu gösterir; demir, B12 veya folat eksikliğinin erken döneminde yükselebilir.',
    factors: ['Yakın zamanda kan kaybı veya kan nakli', 'Beslenme'],
    actions: ['Demir, B12 ve folat testleriyle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  mpv: {
    what: 'MPV, trombositlerin ortalama büyüklüğüdür; kemik iliğinin trombosit üretimi hakkında fikir verir.',
    high: 'Genç, büyük trombositlerin fazla olduğunu gösterebilir.',
    low: 'Küçük trombositlerin çoğunlukta olduğunu gösterebilir.',
    factors: ['Numunenin bekleme süresi'],
    actions: ['Trombosit sayısıyla birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  ...Object.fromEntries(['neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil'].flatMap((k) => [[`${k}-abs`, DIFF_COMMON], [`${k}-pct`, DIFF_COMMON]])),

  alt: {
    what: 'ALT, büyük ölçüde karaciğer hücrelerinde bulunan bir enzimdir. Hücreler zorlandığında kana daha çok geçer.',
    high: 'Yağlı karaciğer, alkol, bazı ilaçlar ve takviyeler, viral hepatitler veya yoğun egzersizle ilişkili olabilir.',
    factors: ['Alkol', 'Bazı ilaçlar ve bitkisel takviyeler', 'Yoğun egzersiz (ölçümden önceki günlerde)', 'Fazla kilo'],
    actions: ['Alkolü azaltmak veya bırakmak', 'Kullandığın ilaç ve takviyeleri hekiminle gözden geçirmek', 'Fazla kiloyu kademeli azaltmak, düzenli hareket etmek'],
    askDoctor: ['Karaciğer ultrasonu veya hepatit testleri gerekir mi?', 'Kullandığım ilaçlar bu değeri etkiliyor olabilir mi?', ...GENERAL_ASK],
  },
  ast: {
    what: 'AST, karaciğerde ve kaslarda (kalp kası dahil) bulunan bir enzimdir.',
    high: 'Karaciğeri zorlayan durumlar, alkol, kas hasarı veya yoğun egzersizle ilişkili olabilir.',
    factors: ['Yoğun egzersiz', 'Alkol', 'Bazı ilaçlar'],
    actions: ['Test öncesi günlerde çok ağır egzersizden kaçınmak', 'Alkolü azaltmak'],
    askDoctor: ['ALT ile oranı neyi düşündürüyor?', ...GENERAL_ASK],
  },
  ggt: {
    what: 'GGT, karaciğer ve safra yollarıyla ilgili bir enzimdir.',
    high: 'Alkol kullanımı, safra akışını etkileyen durumlar, yağlı karaciğer veya bazı ilaçlarla ilişkili olabilir.',
    factors: ['Alkol', 'Bazı ilaçlar (ör. sara ilaçları)', 'Fazla kilo'],
    actions: ['Alkolü azaltmak veya bırakmak'],
    askDoctor: GENERAL_ASK,
  },
  alp: {
    what: 'ALP, karaciğer, safra yolları ve kemiklerde bulunan bir enzimdir.',
    high: 'Safra akışını etkileyen durumlar veya kemik yapımının arttığı dönemler (büyüme çağı, kırık iyileşmesi) ile ilişkili olabilir.',
    low: 'Nadirdir; beslenme veya bazı kalıtsal durumlarla ilişkili olabilir.',
    factors: ['Yaş (çocuk ve ergenlerde yüksek olur)', 'Gebelik', 'Kırık iyileşmesi'],
    actions: ['GGT ve bilirubin sonuçlarıyla birlikte değerlendirmek'],
    askDoctor: ['Yükseklik karaciğer mi kemik kaynaklı mı?', ...GENERAL_ASK],
  },
  'bilirubin-total': {
    what: 'Bilirubin, yaşlanan alyuvarların parçalanmasıyla oluşan sarı bir maddedir; karaciğerde işlenip safrayla atılır.',
    high: 'Alyuvar yıkımının artması, karaciğerin işleme kapasitesi veya safra akışıyla ilişkili olabilir. Gilbert sendromu adı verilen zararsız ve sık görülen bir durum da hafif yükselmeye yol açabilir.',
    factors: ['Açlık (hafif yükseltebilir)', 'Yoğun egzersiz', 'Bazı ilaçlar'],
    actions: ['Gözlerde veya ciltte sararma olursa hekime başvurmak'],
    askDoctor: ['Direkt ve indirekt bilirubin ayrımı ne gösteriyor?', ...GENERAL_ASK],
  },
  'bilirubin-direct': {
    what: 'Direkt (konjuge) bilirubin, karaciğerde işlenmiş ve safraya atılmaya hazır bilirubindir.',
    high: 'Safra akışını etkileyen durumlar veya karaciğer işlevleriyle ilişkili olabilir.',
    factors: ['Bazı ilaçlar'],
    actions: ['Diğer karaciğer testleriyle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  'bilirubin-indirect': {
    what: 'İndirekt bilirubin, henüz karaciğerde işlenmemiş bilirubindir.',
    high: 'Alyuvar yıkımının artması veya Gilbert sendromu gibi zararsız durumlarla ilişkili olabilir.',
    factors: ['Açlık', 'Stres, hastalık'],
    actions: ['Hemogram sonuçlarıyla birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  albumin: {
    what: 'Albümin, karaciğerde üretilen ve kanda en bol bulunan proteindir; sıvı dengesini korur ve maddeleri taşır.',
    high: 'Genellikle sıvı kaybını (susuzluk) yansıtır.',
    low: 'Beslenme yetersizliği, karaciğerin üretim kapasitesi, böbreklerden protein kaybı veya iltihapla ilişkili olabilir.',
    factors: ['Sıvı dengesi', 'Beslenme', 'Akut hastalık'],
    actions: ['Yeterli protein içeren dengeli beslenmek (hekim aksini söylemedikçe)'],
    askDoctor: ['İdrarda protein kaybı açısından test gerekir mi?', ...GENERAL_ASK],
  },
  'total-protein': {
    what: 'Total protein, kandaki albümin ve globulinlerin (antikorlar dahil) toplamıdır.',
    high: 'Sıvı kaybı veya globulinlerin artması ile ilişkili olabilir.',
    low: 'Beslenme, karaciğer veya böbrek kaynaklı protein kaybıyla ilişkili olabilir.',
    factors: ['Sıvı dengesi', 'Beslenme'],
    actions: ['Albüminle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  ldh: {
    what: 'LDH, vücuttaki birçok dokuda bulunan bir enzimdir; doku hasarının genel bir göstergesidir.',
    high: 'Birçok dokuda hücre yıkımıyla ilişkili olabilir; kaynağı tek başına söylenemez. Numunedeki alyuvar parçalanması da yükseltebilir.',
    factors: ['Numunenin bekletilmesi veya hemolizi', 'Yoğun egzersiz'],
    actions: ['Diğer testlerle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },

  'cholesterol-total': {
    what: 'Total kolesterol, kandaki LDL, HDL ve diğer lipoproteinlerdeki kolesterolün toplamıdır. Kolesterol hücre zarları ve bazı hormonlar için gereklidir.',
    high: 'Uzun süreli yüksekliği, damar duvarında plak oluşumu riskiyle ilişkilidir; değerlendirme LDL ve HDL ayrımıyla yapılır.',
    factors: ['Beslenme (doymuş/trans yağ)', 'Kalıtım', 'Tiroid işlevi', 'Kilo, hareketsizlik'],
    actions: HEART_HEALTHY,
    askDoctor: ['Kalp-damar riskim (yaş, tansiyon, sigara, aile öyküsü) birlikte nasıl değerlendiriliyor?', 'LDL için hedef değerim ne olmalı?', ...GENERAL_ASK],
  },
  ldl: {
    what: 'LDL, kolesterolü karaciğerden dokulara taşıyan lipoproteindir. Fazlası damar duvarında birikebildiği için "kötü kolesterol" olarak da bilinir.',
    high: 'Uzun süreli yüksek LDL, damar duvarında yıllar içinde plak (ateroskleroz) gelişimiyle ilişkilidir. Risk; yaş, tansiyon, sigara, diyabet ve aile öyküsüyle birlikte değerlendirilir.',
    factors: ['Doymuş ve trans yağdan zengin beslenme', 'Kalıtım (ailesel yüksek kolesterol)', 'Tiroid işlevinin azalması', 'Kilo ve hareketsizlik'],
    actions: HEART_HEALTHY,
    askDoctor: ['Kişisel kalp-damar riskime göre LDL hedefim ne?', 'Ailesel yüksek kolesterol açısından değerlendirme gerekir mi?', 'Tiroid testi gerekir mi?', ...GENERAL_ASK],
  },
  hdl: {
    what: 'HDL, fazla kolesterolü dokulardan karaciğere geri taşıyan lipoproteindir ("iyi kolesterol").',
    low: 'Düşük HDL, kalp-damar riskinin değerlendirilmesinde dikkate alınır; hareketsizlik, sigara, fazla kilo ve yüksek trigliseritle ilişkili olabilir.',
    high: 'Genellikle olumlu kabul edilir; çok yüksek değerler ayrıca değerlendirilebilir.',
    factors: ['Fiziksel aktivite', 'Sigara', 'Kilo', 'Kalıtım'],
    actions: ['Düzenli aerobik egzersiz', 'Sigarayı bırakmak', 'Fazla kiloyu azaltmak'],
    askDoctor: GENERAL_ASK,
  },
  triglyceride: {
    what: 'Trigliseritler kanda taşınan yağlardır; enerji deposu olarak kullanılır.',
    high: 'Tokken ölçüm, fazla şeker/rafine karbonhidrat ve alkol, fazla kilo ve kan şekeri düzensizliğiyle ilişkili olabilir. Çok yüksek değerler pankreası da ilgilendirebilir.',
    factors: ['Aç olmadan ölçüm (genellikle 9–12 saat açlık istenir)', 'Alkol', 'Şekerli içecekler', 'Bazı ilaçlar'],
    actions: ['Şekerli içecekleri ve rafine karbonhidratları azaltmak', 'Alkolü sınırlamak', 'Düzenli hareket etmek'],
    askDoctor: ['Açlık durumunda tekrar ölçmek gerekir mi?', ...GENERAL_ASK],
  },
  'non-hdl': {
    what: 'HDL dışı kolesterol, damar duvarında birikebilen tüm lipoproteinlerdeki kolesterolün toplamıdır (total kolesterol eksi HDL).',
    high: 'Yüksekliği, LDL gibi plak oluşumu riskiyle ilişkilidir; özellikle trigliseritler yüksekken faydalı bir göstergedir.',
    factors: ['Beslenme', 'Kalıtım', 'Kilo'],
    actions: HEART_HEALTHY,
    askDoctor: GENERAL_ASK,
  },
  vldl: {
    what: 'VLDL, karaciğerde üretilen ve çoğunlukla trigliserit taşıyan lipoproteindir; çoğu raporda trigliseritten hesaplanır.',
    high: 'Genellikle yüksek trigliseritle birlikte görülür.',
    factors: ['Trigliserit düzeyi', 'Açlık durumu'],
    actions: ['Trigliserit önerileriyle aynı'],
    askDoctor: GENERAL_ASK,
  },

  sodium: {
    what: 'Sodyum, vücudun sıvı dengesini ve sinir-kas işlevini düzenleyen temel tuzdur.',
    high: 'Genellikle yetersiz sıvı alımı veya sıvı kaybıyla ilişkili olabilir.',
    low: 'Fazla sıvı alımı, bazı ilaçlar (ör. idrar söktürücüler), hormonal veya böbrekle ilgili durumlarla ilişkili olabilir.',
    factors: ['Sıvı alımı', 'İshal, kusma, terleme', 'İdrar söktürücü ilaçlar'],
    actions: ['Belirgin halsizlik, bulantı veya bilinç bulanıklığında acilen başvurmak'],
    askDoctor: ['Kullandığım ilaçlar etkiliyor olabilir mi?', ...GENERAL_ASK],
  },
  potassium: {
    what: 'Potasyum, kalp ritmi ve kas işlevi için kritik bir mineraldir.',
    high: 'Böbrek işlevi, bazı ilaçlar veya numunede alyuvar parçalanması (yalancı yükseklik) ile ilişkili olabilir.',
    low: 'İshal, kusma, idrar söktürücüler veya yetersiz alımla ilişkili olabilir.',
    factors: ['Numunenin bekletilmesi veya hemolizi', 'Tansiyon ve idrar söktürücü ilaçlar', 'Sıvı kaybı'],
    actions: ['Çarpıntı veya belirgin kas güçsüzlüğünde vakit kaybetmeden başvurmak'],
    askDoctor: ['Tekrar ölçüm gerekir mi (numune kaynaklı olabilir mi)?', ...GENERAL_ASK],
  },
  chloride: {
    what: 'Klor, sodyumla birlikte sıvı ve asit-baz dengesinde görev alan bir tuzdur.',
    high: 'Sıvı kaybı veya asit-baz dengesindeki değişikliklerle ilişkili olabilir.',
    low: 'Kusma veya bazı ilaçlarla ilişkili olabilir.',
    factors: ['Sıvı dengesi'],
    actions: ['Sodyum ve diğer elektrolitlerle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  calcium: {
    what: 'Kalsiyum; kemik yapısı, kas kasılması, sinir iletimi ve pıhtılaşma için gereklidir.',
    high: 'Paratiroid bezleri, D vitamini fazlalığı, bazı ilaçlar veya kemikle ilgili durumlarla ilişkili olabilir.',
    low: 'D vitamini eksikliği, düşük albümin (düzeltilmiş kalsiyuma bakılır) veya böbrekle ilgili durumlarla ilişkili olabilir.',
    factors: ['Albümin düzeyi', 'D vitamini', 'Takviyeler'],
    actions: ['Kalsiyum ve D vitamini takviyelerini hekiminle konuşmadan artırmamak'],
    askDoctor: ['Albümine göre düzeltilmiş kalsiyum ne?', 'Parathormon veya D vitamini ölçümü gerekir mi?', ...GENERAL_ASK],
  },
  magnesium: {
    what: 'Magnezyum, kas-sinir işlevi, kalp ritmi ve yüzlerce enzim için gereklidir.',
    high: 'Genellikle böbrek işlevi veya magnezyum içeren ilaç/takviyelerle ilişkilidir.',
    low: 'Yetersiz alım, ishal, alkol veya bazı ilaçlarla (ör. mide ilaçları) ilişkili olabilir.',
    factors: ['Beslenme', 'Alkol', 'Mide asidi baskılayıcı ilaçlar'],
    actions: ['Yeşil yapraklı sebze, kuruyemiş ve tam tahıl içeren beslenme'],
    askDoctor: GENERAL_ASK,
  },
  phosphorus: {
    what: 'Fosfor, kalsiyumla birlikte kemik yapısında ve enerji üretiminde görev alır.',
    high: 'Böbrek işlevi veya paratiroid ile ilişkili olabilir.',
    low: 'Beslenme, D vitamini veya bazı ilaçlarla ilişkili olabilir.',
    factors: ['Yaş (çocuklarda yüksek)', 'Beslenme'],
    actions: ['Kalsiyum ve D vitaminiyle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },

  creatinine: {
    what: 'Kreatinin, kaslarda oluşan bir atık maddedir; böbrekler tarafından süzülerek atılır. Böbreklerin süzme işlevinin göstergesidir.',
    high: 'Böbreklerin süzme işlevinin azalması, sıvı kaybı, yüksek kas kütlesi veya bol et tüketimiyle ilişkili olabilir.',
    low: 'Düşük kas kütlesiyle ilişkili olabilir; genellikle önemsizdir.',
    factors: ['Kas kütlesi', 'Sıvı alımı', 'Test öncesi bol et yemek', 'Kreatin takviyesi', 'Bazı ilaçlar'],
    actions: ['Yeterli sıvı almak', 'Ağrı kesicileri (NSAİİ) uzun süre kullanmadan önce hekime danışmak', 'Tansiyon ve kan şekerini kontrol altında tutmak'],
    askDoctor: ['eGFR ve idrar testleriyle böbrek işlevim nasıl?', ...GENERAL_ASK],
  },
  egfr: {
    what: 'eGFR, kreatinin, yaş ve cinsiyetten hesaplanan tahmini böbrek süzme hızıdır.',
    low: 'Düşük değer, böbreklerin kanı daha az süzdüğünü gösterebilir. Tek ölçüm yerine en az 3 ay arayla tekrarlar ve idrar testleriyle değerlendirilir.',
    factors: ['Kreatinini etkileyen her şey (kas kütlesi, sıvı dengesi)', 'Yaş'],
    actions: ['Tansiyon ve kan şekerini kontrol altında tutmak', 'Böbreğe yük olabilecek ilaçları hekimle konuşmak'],
    askDoctor: ['İdrarda albümin testi gerekir mi?', 'Kullandığım ilaçların dozu böbrek işlevime göre ayarlanmalı mı?', ...GENERAL_ASK],
  },
  urea: {
    what: 'Üre, proteinlerin yıkımıyla karaciğerde oluşan ve böbreklerle atılan bir atıktır.',
    high: 'Sıvı kaybı, yüksek protein tüketimi, böbrek işlevi veya sindirim kanalında kanamayla ilişkili olabilir.',
    low: 'Düşük protein alımı veya karaciğer işleviyle ilişkili olabilir.',
    factors: ['Protein alımı', 'Sıvı dengesi'],
    actions: ['Kreatininle birlikte değerlendirmek', 'Yeterli sıvı almak'],
    askDoctor: GENERAL_ASK,
  },
  bun: {
    what: 'BUN, kandaki üre miktarının azot olarak ifadesidir (üre ≈ BUN × 2,14).',
    high: 'Sıvı kaybı, yüksek protein tüketimi veya böbrek işleviyle ilişkili olabilir.',
    low: 'Düşük protein alımıyla ilişkili olabilir.',
    factors: ['Protein alımı', 'Sıvı dengesi'],
    actions: ['Kreatininle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  'uric-acid': {
    what: 'Ürik asit, pürin adlı maddelerin yıkım ürünüdür ve çoğunlukla böbreklerle atılır.',
    high: 'Pürinden zengin beslenme (sakatat, kırmızı et, bazı deniz ürünleri), alkol, şekerli içecekler, fazla kilo veya böbrek atılımıyla ilişkili olabilir. Eklemlerde kristal birikmesine (gut) yatkınlık yaratabilir.',
    low: 'Genellikle önemsizdir.',
    factors: ['Alkol (özellikle bira)', 'Früktozlu içecekler', 'İdrar söktürücüler', 'Sıvı alımı'],
    actions: ['Bol su içmek', 'Alkolü ve şekerli içecekleri azaltmak', 'Sakatat ve kırmızı eti sınırlamak'],
    askDoctor: GENERAL_ASK,
  },

  iron: {
    what: 'Serum demiri, kanda transferrine bağlı taşınan demiri gösterir; gün içinde ve öğünlerle çok değişir.',
    high: 'Demir takviyesi, demir birikimiyle ilgili durumlar veya karaciğer hücre hasarıyla ilişkili olabilir.',
    low: 'Demir eksikliği veya iltihapla ilişkili olabilir; ferritinle birlikte yorumlanır.',
    factors: ['Günün saati (sabah yüksek)', 'Son öğün ve takviyeler'],
    actions: ['Ferritin ve transferrin satürasyonuyla birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  ferritin: {
    what: 'Ferritin, vücuttaki demir depolarının en iyi göstergesidir.',
    high: 'Demir fazlalığı yanında iltihap, karaciğer yağlanması, alkol veya enfeksiyonla da yükselebilir.',
    low: 'Demir depolarının azaldığını gösterir; beslenme, emilim sorunları veya kan kaybı (adet dahil) ile ilişkili olabilir.',
    factors: ['İltihap/enfeksiyon (yükseltir)', 'Adet kanaması', 'Beslenme', 'Kan bağışı'],
    actions: ['Demirden zengin gıdalar (kırmızı et, baklagil, yeşil yapraklı sebzeler) ve C vitamini kaynaklarıyla birlikte tüketmek', 'Çay/kahveyi yemekle birlikte değil, araya zaman koyarak içmek', 'Takviyeyi hekimin önerdiği şekilde kullanmak'],
    askDoctor: ['Demir eksikliğinin nedeni araştırılmalı mı?', 'Takviye gerekirse ne kadar süre?', ...GENERAL_ASK],
  },
  tibc: {
    what: 'TDBK, kandaki demiri bağlayabilecek toplam transferrin kapasitesidir.',
    high: 'Demir eksikliğinde vücut transferrini artırdığı için yükselir.',
    low: 'İltihap, beslenme veya karaciğer işleviyle ilişkili olabilir.',
    factors: ['Gebelik', 'Doğum kontrol hapları'],
    actions: ['Ferritin ve demirle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  uibc: {
    what: 'Serbest demir bağlama kapasitesi, transferrinin henüz demir bağlamamış kısmıdır.',
    high: 'Demir eksikliğinde yükselir.',
    low: 'Demir fazlalığında düşebilir.',
    factors: ['Demir düzeyi'],
    actions: ['Diğer demir testleriyle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  'transferrin-saturation': {
    what: 'Transferrin satürasyonu, taşıyıcı proteinin yüzde kaçının demirle dolu olduğunu gösterir.',
    high: 'Demir birikimi açısından değerlendirilebilir.',
    low: 'Dokulara yeterli demir taşınmadığını düşündürebilir.',
    factors: ['Günün saati', 'Takviyeler'],
    actions: ['Ferritinle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },

  glucose: {
    what: 'Açlık kan şekeri, en az 8 saatlik açlıktan sonra kandaki glukoz düzeyidir.',
    high: 'Açlık olmadan ölçüm, stres, bazı ilaçlar veya insülinin etkisinin azalmasıyla ilişkili olabilir. Tekrarlayan yükseklik, şeker metabolizması açısından değerlendirilir.',
    low: 'Uzun açlık, yoğun egzersiz veya şeker düşürücü ilaçlarla ilişkili olabilir.',
    factors: ['Açlık süresi', 'Kortizon gibi ilaçlar', 'Akut hastalık ve stres'],
    actions: ['Şekerli içecekleri ve rafine karbonhidratları azaltmak', 'Düzenli fiziksel aktivite', 'Fazla kiloyu azaltmak', 'Titreme, terleme gibi düşük şeker belirtilerini ciddiye almak'],
    askDoctor: ['HbA1c ile birlikte değerlendirme gerekir mi?', ...GENERAL_ASK],
  },
  hba1c: {
    what: 'HbA1c, alyuvarlara bağlanan şeker oranıdır ve son 2–3 ayın ortalama kan şekerini yansıtır.',
    high: 'Son aylarda ortalama kan şekerinin yüksek seyrettiğini gösterebilir.',
    factors: ['Kansızlık veya alyuvar ömrünü değiştiren durumlar sonucu etkileyebilir', 'Yakın zamanda kan kaybı veya kan nakli'],
    actions: ['Beslenmede şeker ve rafine karbonhidratı azaltmak', 'Düzenli hareket', 'Kilo yönetimi'],
    askDoctor: ['Bu değer benim için hangi takip sıklığını gerektiriyor?', ...GENERAL_ASK],
  },
  insulin: {
    what: 'İnsülin, pankreasın ürettiği ve kan şekerini hücrelere sokan hormondur.',
    high: 'Açlıkta yüksek insülin, vücudun insüline daha az duyarlı olduğunu (insülin direnci) gösterebilir; glukozla birlikte yorumlanır.',
    low: 'Pankreasın insülin üretimiyle ilişkili olabilir.',
    factors: ['Açlık durumu', 'Kilo', 'Hareketsizlik'],
    actions: ['Düzenli hareket', 'Kilo yönetimi', 'Lifli ve dengeli beslenme'],
    askDoctor: ['Açlık glukozuyla birlikte nasıl yorumlanıyor (HOMA-IR)?', ...GENERAL_ASK],
  },

  tsh: {
    what: 'TSH, hipofiz bezinin tiroidi uyarmak için salgıladığı hormondur. Tiroid hormonları azaldığında TSH yükselir, arttığında düşer.',
    high: 'Tiroid bezinin az çalışmasıyla (hipotiroidi eğilimi) ilişkili olabilir.',
    low: 'Tiroid bezinin fazla çalışması veya tiroid hormonu kullanımıyla ilişkili olabilir.',
    factors: ['Biotin (B7) takviyesi bazı ölçümleri etkileyebilir', 'Tiroid ilaçlarının alınma saati', 'Akut hastalık', 'Gebelik'],
    actions: ['Tiroid ilacı kullanıyorsan test gününü hekiminin önerdiği şekilde planlamak', 'Biotin kullanıyorsan test öncesi hekime söylemek'],
    askDoctor: ['Serbest T4 ve tiroid antikorlarına bakılmalı mı?', ...GENERAL_ASK],
  },
  ft4: {
    what: 'Serbest T4, tiroid bezinin ürettiği ve kanda serbest dolaşan ana hormondur.',
    high: 'Tiroid bezinin fazla çalışması veya hormon kullanımıyla ilişkili olabilir.',
    low: 'Tiroid bezinin az çalışmasıyla ilişkili olabilir.',
    factors: ['Biotin takviyesi', 'Gebelik', 'Bazı ilaçlar'],
    actions: ['TSH ile birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  ft3: {
    what: 'Serbest T3, tiroid hormonunun dokularda etkili olan biçimidir.',
    high: 'Tiroid bezinin fazla çalışmasıyla ilişkili olabilir.',
    low: 'Ağır hastalık, açlık veya tiroid işleviyle ilişkili olabilir.',
    factors: ['Akut hastalık', 'Beslenme'],
    actions: ['TSH ve serbest T4 ile birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },
  'anti-tpo': {
    what: 'Anti-TPO, bağışıklık sisteminin tiroid dokusuna karşı ürettiği bir antikordur.',
    high: 'Tiroidin bağışıklık kaynaklı iltihabına (ör. Hashimoto) yatkınlıkla ilişkili olabilir; tiroid hormonları normal olsa bile takip önerilebilir.',
    factors: ['Aile öyküsü'],
    actions: ['TSH\'yi hekimin önerdiği aralıklarla izlemek'],
    askDoctor: ['Hangi sıklıkla TSH kontrolü önerirsiniz?', ...GENERAL_ASK],
  },

  b12: {
    what: 'B12 vitamini, kan hücresi yapımı ve sinir sistemi için gereklidir; hayvansal gıdalarla alınır ve ince bağırsağın son kısmından emilir.',
    low: 'Yetersiz alım (özellikle vegan beslenme), mide asidini baskılayan ilaçlar, metformin veya emilim sorunlarıyla ilişkili olabilir.',
    high: 'Genellikle takviye kullanımını yansıtır.',
    factors: ['Beslenme', 'Mide ilaçları', 'Metformin', 'Yaş'],
    actions: ['Et, balık, yumurta ve süt ürünleri; vegan beslenmede takviye seçeneğini hekimle konuşmak', 'Uyuşma, karıncalanma veya unutkanlık olursa söylemek'],
    askDoctor: ['Emilim açısından değerlendirme gerekir mi?', ...GENERAL_ASK],
  },
  folate: {
    what: 'Folat (B9), DNA yapımı ve kan hücresi üretimi için gereklidir; gebelikte özellikle önemlidir.',
    low: 'Yeşil sebzelerden fakir beslenme, alkol veya bazı ilaçlarla ilişkili olabilir.',
    factors: ['Beslenme', 'Alkol', 'Gebelik'],
    actions: ['Yeşil yapraklı sebzeler, baklagiller ve tam tahıllar'],
    askDoctor: GENERAL_ASK,
  },
  'vitamin-d': {
    what: '25-OH D vitamini, vücuttaki D vitamini deposunu gösterir. D vitamini güneş ışığıyla deride üretilir; kemik ve kas sağlığı için gereklidir.',
    low: 'Güneşe az çıkma, kapalı giyinme, koyu ten, fazla kilo veya emilim sorunlarıyla ilişkili olabilir.',
    high: 'Genellikle yüksek dozda takviye kullanımını yansıtır; çok yüksek değerler zararlı olabilir.',
    factors: ['Mevsim (kışın düşük)', 'Güneşe çıkma süresi', 'Takviyeler'],
    actions: ['Güvenli şekilde güneş ışığından yararlanmak', 'Takviye dozunu hekimle belirlemek; yüksek dozu kendi başına kullanmamak'],
    askDoctor: ['Takviye gerekirse ne kadar süre ve ne zaman kontrol?', ...GENERAL_ASK],
  },

  crp: {
    what: 'CRP, vücutta iltihap olduğunda karaciğerin hızla ürettiği bir proteindir.',
    high: 'Enfeksiyon, iltihap, doku hasarı veya yakın zamandaki bir hastalıkla ilişkili olabilir; yeri hakkında bilgi vermez.',
    factors: ['Soğuk algınlığı gibi yakın zamandaki enfeksiyonlar', 'Yaralanma', 'Fazla kilo', 'Sigara'],
    actions: ['Belirtilerle (ateş, ağrı) birlikte hekime danışmak'],
    askDoctor: ['Belirtilerim geçtikten sonra tekrar ölçüm gerekir mi?', ...GENERAL_ASK],
  },
  'hs-crp': {
    what: 'Yüksek duyarlıklı CRP, düşük düzeydeki iltihabı ölçer ve kalp-damar riskinin değerlendirilmesinde kullanılabilir.',
    high: 'Düşük dereceli iltihapla ilişkilidir; enfeksiyon varken ölçülürse yanıltıcı olabilir.',
    factors: ['Yakın zamandaki enfeksiyon', 'Sigara', 'Fazla kilo', 'Hareketsizlik'],
    actions: HEART_HEALTHY,
    askDoctor: GENERAL_ASK,
  },
  esr: {
    what: 'Sedimantasyon, alyuvarların bir tüpte ne hızla çöktüğünü ölçer; iltihabın genel bir göstergesidir.',
    high: 'İltihap, enfeksiyon, kansızlık, gebelik ve ileri yaşla ilişkili olabilir.',
    factors: ['Yaş', 'Cinsiyet', 'Kansızlık', 'Gebelik'],
    actions: ['CRP ve belirtilerle birlikte değerlendirmek'],
    askDoctor: GENERAL_ASK,
  },

  amylase: {
    what: 'Amilaz, karbonhidratları sindiren ve çoğunlukla pankreas ile tükürük bezlerinden salgılanan bir enzimdir.',
    high: 'Pankreası veya tükürük bezlerini etkileyen durumlarla ilişkili olabilir.',
    low: 'Genellikle önemsizdir.',
    factors: ['Alkol', 'Bazı ilaçlar'],
    actions: ['Şiddetli karın ağrısında acilen başvurmak'],
    askDoctor: ['Lipaz ile birlikte değerlendirme gerekir mi?', ...GENERAL_ASK],
  },
  lipase: {
    what: 'Lipaz, yağları sindiren ve pankreastan salgılanan bir enzimdir.',
    high: 'Pankreası etkileyen durumlarla ilişkili olabilir.',
    factors: ['Alkol', 'Safra taşları', 'Çok yüksek trigliserit'],
    actions: ['Şiddetli karın ağrısında acilen başvurmak'],
    askDoctor: GENERAL_ASK,
  },

  ck: {
    what: 'CK, kaslarda (kalp kası dahil) bulunan bir enzimdir; kas zorlandığında kana geçer.',
    high: 'Yoğun egzersiz, kas zedelenmesi, enjeksiyonlar veya bazı ilaçlarla (ör. kolesterol ilaçları) ilişkili olabilir.',
    factors: ['Test öncesi günlerde ağır egzersiz', 'Kas içi enjeksiyon', 'Bazı ilaçlar'],
    actions: ['Test öncesi 2–3 gün ağır egzersizden kaçınmak', 'Açıklanamayan kas ağrısı veya koyu idrarı hekime söylemek'],
    askDoctor: ['Kullandığım ilaçlar kas enzimlerini etkiliyor olabilir mi?', ...GENERAL_ASK],
  },
  cortisol: {
    what: 'Kortizol, böbreküstü bezlerinin salgıladığı stres hormonudur; sabah yüksek, akşam düşüktür.',
    high: 'Stres, uykusuzluk, kortizon içeren ilaçlar veya hormonal durumlarla ilişkili olabilir.',
    low: 'Böbreküstü bezi veya hipofizle ilgili durumlarla ilişkili olabilir.',
    factors: ['Ölçüm saati (genellikle sabah 8 civarı)', 'Stres', 'Kortizon içeren ilaçlar (krem, sprey dahil)', 'Doğum kontrol hapları'],
    actions: ['Test saatini hekimin önerdiği gibi planlamak'],
    askDoctor: GENERAL_ASK,
  },
  prolactin: {
    what: 'Prolaktin, hipofiz bezinin salgıladığı ve süt üretimini sağlayan hormondur.',
    high: 'Stres, gebelik ve emzirme, bazı ilaçlar veya hipofizle ilgili durumlarla ilişkili olabilir.',
    factors: ['Stres ve iğne korkusu', 'Gebelik, emzirme', 'Bazı psikiyatri ve mide ilaçları', 'Uyku'],
    actions: ['Test öncesi dinlenmiş olmak'],
    askDoctor: ['Tekrar ölçüm gerekir mi?', ...GENERAL_ASK],
  },
  psa: {
    what: 'PSA, prostat bezinin ürettiği bir proteindir.',
    high: 'Prostat büyümesi, iltihabı veya diğer prostat durumlarıyla ilişkili olabilir; yorum yaş ve öyküye göre yapılır.',
    factors: ['Yaş', 'Yakın zamanda bisiklet sürme veya boşalma', 'Prostat muayenesi', 'İdrar yolu enfeksiyonu'],
    actions: ['Test öncesi 48 saat bisiklet ve cinsel ilişkiden kaçınmak'],
    askDoctor: ['Yaşıma göre bu değer nasıl yorumlanıyor?', ...GENERAL_ASK],
  },
  inr: {
    what: 'INR, kanın pıhtılaşma süresini standart bir ölçekte gösterir; karaciğerin pıhtılaşma faktörü üretimini ve kan sulandırıcı etkisini yansıtır.',
    high: 'Kan sulandırıcı ilaç kullanımı, K vitamini eksikliği veya karaciğer işleviyle ilişkili olabilir.',
    low: 'Genellikle önemsizdir.',
    factors: ['Kan sulandırıcı ilaçlar', 'K vitamininden zengin gıdalar', 'Antibiyotikler'],
    actions: ['Kan sulandırıcı kullanıyorsan ilacını ve beslenmeni hekiminin önerdiği şekilde sürdürmek'],
    askDoctor: GENERAL_ASK,
  },
  aptt: {
    what: 'aPTT, pıhtılaşma sisteminin bir kolunun çalışma süresini ölçer.',
    high: 'Heparin gibi ilaçlar veya pıhtılaşma faktörleriyle ilgili durumlarla ilişkili olabilir.',
    low: 'Genellikle önemsizdir.',
    factors: ['Numune alımı', 'İlaçlar'],
    actions: ['Kanama eğilimini hekime söylemek'],
    askDoctor: GENERAL_ASK,
  },
  homocysteine: {
    what: 'Homosistein, bir amino asit yıkım ürünüdür; B12, B6 ve folat bu maddenin işlenmesinde görev alır.',
    high: 'B12 veya folat eksikliği, böbrek işlevi veya kalıtsal etkenlerle ilişkili olabilir; damar sağlığı açısından değerlendirilir.',
    factors: ['B vitamini alımı', 'Sigara', 'Kahve'],
    actions: ['B12 ve folat açısından dengeli beslenmek'],
    askDoctor: ['B12 ve folat düzeylerime bakılmalı mı?', ...GENERAL_ASK],
  },
};

export const MEDICAL_DISCLAIMER =
  'Bu bilgiler geneldir ve eğitim amaçlıdır; teşhis veya tedavi önerisi değildir. Sonuçlarını, kişisel durumunu bilen bir hekimle değerlendir. Acil belirtilerde 112\'yi ara.';
