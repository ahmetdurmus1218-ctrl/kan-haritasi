import type { LabEffect } from '../types';

/** Karaciğer, safra ve protein testleri. */
export const LIVER: LabEffect[] = [
  {
    test: 'alt',
    normal: {
      summary: 'ALT, karaciğer hücresinin (hepatosit) içinde çalışan bir enzimdir; amino asitleri enerjiye ve şekere çevirir. Kanda az bulunur.',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'ALT hepatositin içinde, amino asit ve şeker metabolizmasında çalışır.' },
        { interior: 'liver', stage: 'sinusoid', text: 'Sağlam hücreden sinüzoide (kana) çok az sızar; kandaki düşük düzey normal hücre yenilenmesini yansıtır.' },
      ],
    },
    high: {
      summary: 'Karaciğer hücreleri zorlanıyor ya da hasarlanıyor; hücre zarından ALT kana sızıyor.',
      mechanism: [
        'Yağ birikimi, virüs, ilaç, alkol ya da bağışıklık saldırısı hepatosit zarını hasarlar.',
        'Hücre içindeki ALT sinüzoid kanına geçer; yükseklik hasarın şiddetiyle değil, o anki hücre sızıntısıyla ilişkilidir.',
        '5 katın altı hafif, 5–15 kat orta, 15 katın üstü belirgin artış sayılır; çok yüksek değerler viral, ilaç (parasetamol) ya da şok karaciğerini düşündürür.',
        'Karaciğerin üretim işlevi (albumin, INR) genellikle hasar ağırlaşana kadar korunur.',
      ],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Zorlanan hepatositlerden enzim sızıyor.' },
        { interior: 'liver', stage: 'sinusoid', text: 'Sinüzoid kanında ALT artmış; Kupffer hücreleri etkinleşmiş olabilir.' },
        { interior: 'liver', stage: 'lobule', text: 'Yağlanmada lobülün hücreleri yağ damlacıklarıyla dolar.' },
        { interior: 'skeletal-muscle', stage: 'fiber', text: 'Daha az oranda kasta da bulunur; ağır kas hasarında hafif artabilir.' },
      ],
      symptoms: ['Çoğu zaman belirti yoktur', 'Yorgunluk, iştahsızlık', 'Sağ üst karında dolgunluk', 'Sarılık ve koyu idrar (ağır durumda)'],
      causes: ['masld', 'drug-liver', 'alcohol', 'viral-hepatitis', 'autoimmune-hepatitis', 'hemochromatosis', 'celiac', 'hyperthyroid', 'muscle-injury', 'mononucleosis', 'biliary-obstruction', 'ischemic-hepatitis', 'wilson', 'statin', 'preeclampsia', 'brucellosis', 'cchf'],
      next: ['ast', 'ggt', 'alp', 'bilirubin-total', 'albumin', 'inr', 'ck', 'ferritin', 'triglyceride', 'hba1c'],
      urgent: 'Üst sınırın 10–15 katından fazla, sarılık, bilinç değişikliği ya da INR uzaması varsa hızlı değerlendirme gerekir.',
      scene: { leak: 0.7 },
    },
    low: 'ALT’nin düşük olması genellikle anlam taşımaz (B6 vitamini eksikliği ve ileri böbrek hastalığında hafif düşük ölçülebilir).',
  },
  {
    test: 'ast',
    normal: {
      summary: 'AST hepatosit, kas, kalp kası ve alyuvarda bulunan bir enzimdir; karaciğere ALT kadar özgü değildir.',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Hepatositin sitoplazma ve mitokondrisinde bulunur.' },
        { interior: 'skeletal-muscle', stage: 'fiber', text: 'Kas liflerinde de bol bulunur.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp kası hücrelerinde de vardır.' },
      ],
    },
    high: {
      summary: 'AST’nin geldiği hücrelerden biri (karaciğer, kas, kalp, alyuvar) hasarlanıyor.',
      mechanism: [
        'Karaciğer hasarında ALT ile birlikte artar; AST/ALT > 2 alkol ve ileri karaciğer hastalığını düşündürür.',
        'Kas hasarında CK ile birlikte artar (ALT normal ya da hafif).',
        'Tüpte alyuvar parçalanması (hemoliz) AST’yi yalancı yükseltir.',
      ],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Hepatosit mitokondrisi hasarlanmış olabilir (alkolde tipik).' },
        { interior: 'skeletal-muscle', stage: 'contraction', text: 'Kas liflerinden sızıntı (egzersiz, travma).' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp kası hasarında da artar.' },
      ],
      causes: ['alcohol', 'masld', 'viral-hepatitis', 'cirrhosis', 'drug-liver', 'muscle-injury', 'exercise', 'rhabdomyolysis', 'myocardial-injury', 'hemolysis', 'sample-hemolysis', 'ischemic-hepatitis', 'hypothyroid', 'cchf'],
      next: ['alt', 'ck', 'ggt', 'ldh'],
      scene: { leak: 0.5 },
    },
    low: 'AST’nin düşük olması genellikle anlam taşımaz.',
  },
  {
    test: 'ggt',
    normal: {
      summary: 'GGT safra kanalı hücrelerinde ve karaciğerde bulunan, glutatyon (antioksidan) döngüsünde çalışan bir enzimdir.',
      path: [
        { interior: 'liver', stage: 'bile', text: 'Safra kanalcıklarını döşeyen hücrelerin zarında bulunur.' },
        { interior: 'gallbladder.bile-ducts', stage: 'flow', text: 'Safra yolları boyunca hücrelerde bulunur.' },
      ],
    },
    high: {
      summary: 'Safra akışı zorlanıyor ya da karaciğer uyarılıyor (alkol, ilaç, yağlanma).',
      mechanism: ['Safra yolu tıkanırsa kanal hücreleri GGT üretimini artırır.', 'Alkol ve bazı ilaçlar (epilepsi ilaçları) karaciğerde GGT yapımını uyarır; hasar olmasa da artar.', 'ALP ile birlikte yüksekse kaynak büyük olasılıkla safra yollarıdır; ALP tek başına yüksek ve GGT normalse kemik düşünülür.'],
      sites: [
        { interior: 'gallbladder.bile-ducts', stage: 'flow', text: 'Safra akışında geri basınç olabilir.' },
        { interior: 'liver', stage: 'bile', text: 'Kanalcık hücreleri uyarılmış.' },
      ],
      causes: ['alcohol', 'masld', 'enzyme-inducers', 'biliary-obstruction', 'cholangitis-autoimmune', 'drug-liver', 'gallstones', 'liver-congestion', 'secondary-tg'],
      next: ['alp', 'bilirubin-direct', 'alt', 'triglyceride'],
      scene: { yellow: 0.2 },
    },
    low: 'GGT’nin düşük olması anlam taşımaz.',
  },
  {
    test: 'alp',
    normal: {
      summary: 'ALP safra kanalları, kemik yapan hücreler (osteoblast), bağırsak ve gebelikte plasentada bulunan bir enzimdir.',
      path: [
        { interior: 'gallbladder.bile-ducts', stage: 'bile', text: 'Safra kanalı hücrelerinin yüzeyinde bulunur.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemik yapan hücreler mineral döşerken ALP kullanır.' },
        { interior: 'small-intestine', stage: 'enterocyte', text: 'Bağırsak hücrelerinde de bulunur (yağlı yemekten sonra hafif artabilir).' },
      ],
    },
    high: {
      summary: 'Ya safra akışı tıkanıyor ya da kemik yapımı artmış (büyüme, iyileşme, kemik hastalığı); gebelikte plasentadan normal olarak yükselir.',
      mechanism: ['Safra yolu tıkanıklığında kanal hücreleri ALP üretimini artırır (GGT de yüksek).', 'Kemikte yıkım-yapım hızlandığında (büyüme çağı, kırık, D vitamini eksikliği, paratiroid fazlası, Paget, kemik tutulumu) osteoblast ALP’si artar (GGT normal).'],
      sites: [
        { interior: 'gallbladder.bile-ducts', stage: 'flow', text: 'Safra akışında geri basınç.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemik yapımı hızlanmış olabilir.' },
        { interior: 'uterus', stage: 'cycle', text: 'Gebelikte plasenta ALP üretir (beklenen).' },
      ],
      causes: ['biliary-obstruction', 'cholangitis-autoimmune', 'gallstones', 'drug-liver', 'vitamin-d-deficiency', 'hyperparathyroidism', 'secondary-hyperparathyroidism', 'hyperthyroid', 'pregnancy', 'hypercalcemia-malignancy', 'malignancy', 'enzyme-inducers', 'giant-cell-arteritis'],
      next: ['ggt', 'bilirubin-direct', 'calcium', 'phosphorus', 'vitamin-d'],
      scene: { yellow: 0.2 },
    },
    low: {
      summary: 'ALP düşük: genellikle önemsizdir; çinko/magnezyum eksikliği, hipotiroidi, yetersiz beslenme ya da nadir kalıtsal kemik hastalığı (hipofosfatazya) olabilir.',
      mechanism: ['ALP’nin çalışması için çinko ve magnezyum gerekir.', 'Kalıtsal hipofosfatazyada kemik mineralleşmesi bozulur.'],
      sites: [{ interior: 'ic.bone', stage: 'remodeling', text: 'Kemik yapan hücrelerin enzim etkinliği az.' }],
      causes: ['malnutrition', 'hypothyroid', 'magnesium-loss', 'wilson'],
      next: ['magnesium', 'tsh', 'phosphorus'],
    },
  },
  {
    test: 'bilirubin-total',
    normal: {
      summary: 'Bilirubin, yaşlı alyuvarlardaki hemoglobinin sarı yıkım ürünüdür; karaciğer onu suda çözünür hâle getirip safrayla atar.',
      path: [
        { interior: 'spleen', stage: 'red-pulp', text: 'Yaşlı alyuvarlar dalakta yıkılır; hem → biliverdin → (dolaylı) bilirubin.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Hepatosit bilirubini glukuronik asitle bağlar (doğrudan bilirubin).' },
        { interior: 'gallbladder.bile-ducts', stage: 'bile', text: 'Doğrudan bilirubin safrayla bağırsağa akar.' },
        { interior: 'large-intestine', stage: 'feces', text: 'Bağırsak bakterileri onu dışkıya kahverengi rengini veren maddelere çevirir.' },
      ],
    },
    high: {
      summary: 'Bilirubin birikiyor: ya fazla üretiliyor (alyuvar yıkımı), ya karaciğer işleyemiyor, ya da safrayla atılamıyor.',
      mechanism: ['Dolaylı (bağlanmamış) yüksekse: alyuvar yıkımı ya da Gilbert sendromu (bağlama enzimi az).', 'Doğrudan (bağlanmış) yüksekse: hepatosit hasarı ya da safra yolu tıkanıklığı; idrar koyulaşır, dışkı açılır.', '2–3 mg/dL üstünde göz akı ve deri sararır.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Bağlama ve atma kapasitesi aşılmış olabilir.' },
        { interior: 'gallbladder.bile-ducts', stage: 'flow', text: 'Safra akışı engellenmiş olabilir.' },
        { interior: 'spleen', stage: 'filter', text: 'Alyuvar yıkımı artmış olabilir.' },
        { interior: 'skin', stage: 'layers', text: 'Bilirubin deri ve göz akında birikerek sarılık yapar.' },
      ],
      symptoms: ['Göz akında ve deride sararma', 'Koyu çay renginde idrar', 'Açık renkli dışkı (tıkanıklıkta)', 'Kaşıntı'],
      causes: ['gilbert', 'hemolysis', 'g6pd', 'viral-hepatitis', 'biliary-obstruction', 'gallstones', 'cirrhosis', 'drug-liver', 'alcohol', 'sepsis', 'liver-congestion', 'cholangitis-autoimmune'],
      next: ['bilirubin-direct', 'bilirubin-indirect', 'alt', 'alp', 'ggt', 'ldh', 'hemoglobin'],
      urgent: 'Sarılıkla birlikte ateş ve karın ağrısı ya da bilinç değişikliği varsa acil değerlendirme gerekir.',
      scene: { yellow: 0.7 },
    },
    low: 'Bilirubinin düşük olması klinik olarak anlam taşımaz.',
  },
  {
    test: 'bilirubin-direct',
    normal: {
      summary: 'Doğrudan bilirubin, karaciğerde bağlanmış ve safraya atılmaya hazır bilirubindir; kanda çok az bulunur.',
      path: [
        { interior: 'liver', stage: 'bile', text: 'Hepatosit bağladığı bilirubini safra kanalcığına pompalar.' },
        { interior: 'gallbladder.bile-ducts', stage: 'bile', text: 'Safrayla bağırsağa akar.' },
      ],
    },
    high: {
      summary: 'Bağlanmış bilirubin safraya atılamıyor ve kana geri kaçıyor: safra yolu tıkanıklığı ya da hepatosit hasarı.',
      mechanism: ['Kanal tıkanırsa safra geri basınç yapar; bağlanmış bilirubin kana döner.', 'Suda çözündüğü için idrara geçer ve idrarı koyulaştırır.'],
      sites: [
        { interior: 'gallbladder.bile-ducts', stage: 'flow', text: 'Safra akışında engel olabilir.' },
        { interior: 'liver', stage: 'bile', text: 'Hepatositten kanalcığa pompalama bozulmuş olabilir.' },
      ],
      causes: ['biliary-obstruction', 'gallstones', 'viral-hepatitis', 'drug-liver', 'cholangitis-autoimmune', 'cirrhosis', 'sepsis'],
      next: ['alp', 'ggt', 'alt'],
      urgent: 'Sarılık, ateş ve sağ üst karın ağrısı birlikteyse (kolanjit) acildir.',
      scene: { yellow: 0.6 },
    },
    low: 'Doğrudan bilirubinin düşük olması anlam taşımaz.',
  },
  {
    test: 'bilirubin-indirect',
    normal: {
      summary: 'Dolaylı bilirubin, alyuvar yıkımından gelen ve henüz karaciğerde bağlanmamış bilirubindir; kanda albumine bağlı taşınır.',
      path: [
        { interior: 'spleen', stage: 'red-pulp', text: 'Alyuvar yıkımıyla oluşur.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Hepatositte bağlanır.' },
      ],
    },
    high: {
      summary: 'Ya alyuvar yıkımı artmış ya da karaciğerin bağlama enzimi az çalışıyor (Gilbert).',
      mechanism: ['Hemolizde yıkım ürünü artar, karaciğerin bağlama kapasitesi aşılır.', 'Gilbert sendromunda açlık, stres ve hastalıkta hafif yükselir; zararsızdır.'],
      sites: [
        { interior: 'spleen', stage: 'red-pulp', text: 'Alyuvar yıkımı artmış olabilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Bağlama enzimi az çalışıyor olabilir.' },
      ],
      causes: ['gilbert', 'hemolysis', 'g6pd', 'hemoglobinopathy', 'b12-deficiency'],
      next: ['ldh', 'hemoglobin', 'rdw', 'alt'],
      scene: { yellow: 0.5 },
    },
    low: 'Dolaylı bilirubinin düşük olması anlam taşımaz.',
  },
  {
    test: 'albumin',
    normal: {
      summary: 'Albumin karaciğerin ürettiği en bol kan proteinidir; suyu damarda tutar (onkotik basınç) ve hormon, ilaç, kalsiyum, bilirubin taşır.',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Hepatosit günde ~12 g albumin üretir (yeterli protein ve enerjiyle).' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Kılcalda suyu damar içinde tutar; dokuya sıvı kaçmasını engeller.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Sağlam böbrek süzgeci albumini geçirmez.' },
      ],
    },
    high: {
      summary: 'Albumin yüksekliği hemen her zaman susuzluğa (kanın koyulaşması) bağlıdır.',
      mechanism: ['Plazma suyu azalınca albumin oransal olarak artar.'],
      sites: [{ interior: 'kidneys', stage: 'reabsorption', text: 'Susuzlukta böbrek su tutmaya çalışır.' }],
      causes: ['dehydration'],
      next: ['sodium', 'urea', 'hematocrit'],
    },
    low: {
      summary: 'Albumin düşük: karaciğer az üretiyor, böbrek/bağırsaktan kaybediliyor, iltihap üretimi bastırıyor ya da beslenme yetersiz.',
      mechanism: ['İltihapta karaciğer önceliği CRP gibi akut faz proteinlerine verir; albumin üretimi düşer.', 'Sirozda üretici hücre azalır.', 'Nefrotik sendromda süzgeçten kaçar; iltihabi bağırsak hastalığında bağırsaktan kaybolur.', 'Albumin düşünce su dokulara kaçar (ödem, karında sıvı); albumine bağlı kalsiyum düşük ölçülür.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Üretim azalmış olabilir.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Damarda tutulamayan sıvı dokuya sızar (ödem).' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Süzgeçten kaçak olabilir.' },
        { interior: 'small-intestine', stage: 'absorption', text: 'Protein emilimi/kaybı sorunu olabilir.' },
      ],
      symptoms: ['Bacaklarda ve göz çevresinde şişlik', 'Karında sıvı (ileri durumda)'],
      causes: ['anemia-inflammation', 'cirrhosis', 'nephrotic', 'malnutrition', 'malabsorption', 'ibd', 'sepsis', 'hemodilution', 'pregnancy', 'myeloma', 'celiac'],
      next: ['total-protein', 'urine-protein', 'crp', 'inr', 'alt'],
      scene: { fluid: 0.6 },
    },
  },
  {
    test: 'total-protein',
    normal: {
      summary: 'Total protein = albumin + globulinler (antikorlar, taşıyıcı ve pıhtılaşma proteinleri).',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Albumin ve çoğu taşıyıcı protein karaciğerde yapılır.' },
        { interior: 'ic.lymph-node', stage: 'antibody', text: 'Antikorlar (immünglobulin) plazma hücrelerince yapılır.' },
      ],
    },
    high: {
      summary: 'Protein fazla: susuzluk ya da globulin (antikor) artışı — kronik iltihap/enfeksiyon veya plazma hücresi hastalığı.',
      mechanism: ['Kronik iltihap ve enfeksiyonda (hepatit, HIV, otoimmün hastalık) çok sayıda antikor üretilir.', 'Miyelomda tek tip antikor aşırı üretilir.'],
      sites: [
        { interior: 'ic.lymph-node', stage: 'antibody', text: 'Antikor üretimi artmış olabilir.' },
        { interior: 'ic.bone-marrow', stage: 'tissue', text: 'Plazma hücreleri kemik iliğindedir.' },
      ],
      causes: ['dehydration', 'autoimmune-rheum', 'autoimmune-hepatitis', 'myeloma', 'cirrhosis', 'immunodeficiency', 'granulomatous'],
      next: ['albumin', 'esr', 'calcium', 'creatinine'],
    },
    low: {
      summary: 'Protein az: beslenme yetersizliği, karaciğer üretim azlığı ya da böbrek/bağırsak kaybı.',
      mechanism: ['Albumin düşüklüğünün nedenleriyle büyük ölçüde aynıdır; antikor azlığında da düşer.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Üretim azalmış olabilir.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Kayıp olabilir.' },
      ],
      causes: ['malnutrition', 'nephrotic', 'cirrhosis', 'malabsorption', 'hemodilution'],
      next: ['albumin', 'urine-protein'],
      scene: { fluid: 0.4 },
    },
  },
  {
    test: 'ldh',
    normal: {
      summary: 'LDH hemen her hücrede bulunan, şekeri oksijensiz enerjiye çeviren enzimdir; hücre yıkıldığında kana çıkar.',
      path: [
        { interior: 'skeletal-muscle', stage: 'fiber', text: 'Kas, karaciğer, kalp, alyuvar ve akciğer hücrelerinin içinde bol bulunur.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Alyuvarlarda çok bulunur; tüpte parçalanma LDH’yi yükseltir.' },
      ],
    },
    high: {
      summary: 'Bir yerde hücre yıkımı var (alyuvar, kas, karaciğer, akciğer, tümör hücresi) — kaynağı tek başına belli değildir.',
      mechanism: ['Hemolizde alyuvardan, kas hasarında kastan, akciğer enfeksiyonunda akciğerden, hızlı çoğalan tümörlerde hücre yıkımından kana geçer.', 'Tüpte alyuvar parçalanması yalancı yükseklik yapar.'],
      sites: [
        { interior: 'spleen', stage: 'red-pulp', text: 'Alyuvar yıkımı kaynak olabilir.' },
        { interior: 'skeletal-muscle', stage: 'contraction', text: 'Kas hasarı kaynak olabilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer hasarı kaynak olabilir.' },
        { interior: 'ic.lymph-node', stage: 'lymphocyte', text: 'Lenfomada hücre yıkımı kaynak olabilir.' },
      ],
      causes: ['hemolysis', 'sample-hemolysis', 'muscle-injury', 'b12-deficiency', 'viral-hepatitis', 'ischemic-hepatitis', 'myocardial-injury', 'lymphoma', 'malignancy', 'marrow-neoplasm', 'mononucleosis', 'cchf', 'preeclampsia'],
      next: ['hemoglobin', 'bilirubin-indirect', 'ck', 'ast', 'alt'],
      scene: { leak: 0.4 },
    },
    low: 'LDH’nin düşük olması klinik olarak anlam taşımaz.',
  },
];
