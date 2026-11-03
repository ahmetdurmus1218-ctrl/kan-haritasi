import type { LabEffect } from '../types';

/** Hemogram: alyuvar, akyuvar, trombosit ve indeksleri. */
export const HEMOGRAM: LabEffect[] = [
  {
    test: 'hemoglobin',
    normal: {
      summary: 'Hemoglobin alyuvarın içindeki demirli proteindir; akciğerde oksijen alır, dokularda bırakır.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Kemik iliği demir, B12 ve folat kullanarak hemoglobinle dolu alyuvar üretir (böbreğin eritropoietin sinyaliyle).' },
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Alveol kılcalından geçerken hemoglobin oksijen bağlar; kan açık kırmızı olur.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Dokuların kılcallarında oksijen bırakılır, CO₂ alınır.' },
        { interior: 'spleen', stage: 'filter', text: '~120 günlük ömrünü dolduran alyuvarlar dalakta yıkılır; demir geri kazanılır, kalan kısım bilirubine dönüşür.' },
      ],
    },
    high: {
      summary: 'Kanda birim hacimde daha çok hemoglobin var: ya plazma azaldı (koyulaşma) ya da kemik iliği fazla üretiyor.',
      mechanism: [
        'Sıvı kaybında plazma azalır, aynı sayıdaki alyuvar daha yoğun ölçülür.',
        'Dokular oksijensizlik algılarsa (sigara, uyku apnesi, akciğer hastalığı, yüksek rakım) böbrek eritropoietini artırır; ilik daha çok alyuvar yapar.',
        'Kemik iliğinde sinyalden bağımsız aşırı üretim (polisitemi vera) de aynı sonucu verir.',
        'Kan koyulaştıkça akışı yavaşlar; pıhtı riski artabilir.',
      ],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Alyuvar üretimi hızlanmış olabilir (ya da sıvı kaybıyla oransal artış).' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcallarda alyuvarlar sıkışık ilerler; kan daha koyu kıvamlıdır.' },
        { interior: 'kidneys', stage: 'blood', text: 'Böbrek, oksijen azlığını algılayınca eritropoietini artıran organdır.' },
        { interior: 'ic.artery', stage: 'flow', text: 'Koyu kan damarda daha yavaş akar.' },
      ],
      symptoms: ['Baş ağrısı, baş dönmesi', 'Yüzde kızarıklık', 'Sıcak sudan sonra kaşıntı (polisitemide)'],
      causes: ['dehydration', 'smoking', 'secondary-erythrocytosis', 'polycythemia-vera', 'anabolic-steroid'],
      next: ['hematocrit', 'rbc', 'cohb', 'po2', 'ferritin'],
      scene: { rbc: 1.5, flow: 0.7 },
    },
    low: {
      summary: 'Kansızlık (anemi): kan yeterince oksijen taşıyamıyor; dokular daha az oksijen alıyor.',
      mechanism: [
        'Ya üretim azalmıştır (demir, B12, folat eksikliği; böbrek hastalığında eritropoietin azlığı; kemik iliği sorunu),',
        'ya kayıp vardır (kanama: adet, sindirim kanalı),',
        'ya da alyuvarlar erken yıkılıyordur (hemoliz).',
        'Kalp daha hızlı çarparak telafi eder; dokulara giden oksijen azalınca yorgunluk ve nefes darlığı olur.',
      ],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Üretim hattında hammadde (demir/B12/folat) ya da sinyal eksik olabilir.' },
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Akciğer normal çalışsa da oksijeni bağlayacak hemoglobin azdır.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcallarda daha az ve (demir eksikliğinde) daha soluk alyuvar geçer.' },
        { interior: 'heart', stage: 'lv', text: 'Kalp aynı oksijeni taşımak için daha hızlı ve güçlü pompalar.' },
        { interior: 'small-intestine.duodenum', stage: 'iron', text: 'Demir eksikliğinde demirin emildiği yer; emilim sorunu burada olabilir.' },
      ],
      symptoms: ['Yorgunluk, halsizlik', 'Çarpıntı, eforla nefes darlığı', 'Solukluk', 'Baş dönmesi', 'Saç dökülmesi, tırnak kırılması (demir eksikliğinde)'],
      causes: ['iron-deficiency', 'blood-loss', 'gi-bleed', 'anemia-inflammation', 'b12-deficiency', 'folate-deficiency', 'thalassemia-trait', 'ckd', 'hemolysis', 'g6pd', 'hemoglobinopathy', 'pregnancy', 'hemodilution', 'marrow-failure', 'marrow-neoplasm', 'chemotherapy', 'celiac', 'malignancy'],
      next: ['mcv', 'ferritin', 'iron', 'tibc', 'b12', 'folate', 'rdw', 'creatinine', 'ldh', 'bilirubin-indirect'],
      urgent: 'Hemoglobin 7 g/dL’nin altındaysa, göğüs ağrısı, bayılma ya da siyah dışkı varsa acil değerlendirme gerekir.',
      scene: { rbc: 0.6, pale: 0.6, oxygen: 0.7 },
    },
  },
  {
    test: 'hematocrit',
    normal: {
      summary: 'Hematokrit, kan hacminin yüzde kaçının alyuvar olduğunu gösterir (geri kalanı plazma).',
      path: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Alyuvar sayısı ve büyüklüğü hematokriti belirler.' },
        { interior: 'ic.vein', stage: 'flow', text: 'Plazma hacmi (sıvı dengesi) hematokriti seyreltir ya da yoğunlaştırır.' },
        { interior: 'kidneys', stage: 'reabsorption', text: 'Böbrek su ve tuzu tutarak plazma hacmini ayarlar.' },
      ],
    },
    high: {
      summary: 'Kandaki hücre oranı artmış: kan koyulaşmış.',
      mechanism: ['Plazma azalırsa (susuzluk) oran yükselir.', 'Alyuvar üretimi artarsa (oksijensizlik, polisitemi) oran yükselir.', 'Hematokrit %55’in üstüne çıktıkça kanın akışkanlığı belirgin azalır.'],
      sites: [
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcallarda hücre yoğunluğu artmıştır.' },
        { interior: 'kidneys', stage: 'reabsorption', text: 'Susuzlukta böbrek su tutmaya çalışır.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Üretim artışı varsa kaynak kemik iliğidir.' },
      ],
      causes: ['dehydration', 'smoking', 'secondary-erythrocytosis', 'polycythemia-vera', 'anabolic-steroid'],
      next: ['hemoglobin', 'sodium', 'urea', 'cohb'],
      scene: { rbc: 1.45, flow: 0.75 },
    },
    low: {
      summary: 'Kan hacminde alyuvar payı azalmış; genellikle kansızlıkla birlikte görülür.',
      mechanism: ['Alyuvar sayısı azalır (üretim azlığı, kayıp, yıkım) ya da plazma artar (sulandırma, gebelik).', 'Oksijen taşıma kapasitesi düşer.'],
      sites: [
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcallarda alyuvarlar seyrek ilerler.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Üretim hattı yetersiz kalmış olabilir.' },
      ],
      causes: ['iron-deficiency', 'blood-loss', 'anemia-inflammation', 'b12-deficiency', 'hemodilution', 'pregnancy', 'ckd', 'hemolysis'],
      next: ['hemoglobin', 'mcv', 'ferritin'],
      scene: { rbc: 0.65, pale: 0.3 },
    },
  },
  {
    test: 'rbc',
    normal: {
      summary: 'Alyuvar sayısı, kandaki oksijen taşıyıcı hücrelerin miktarıdır.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Kemik iliği saniyede ~2 milyon alyuvar üretir.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Alyuvarlar kılcallardan tek sıra hâlinde geçecek kadar esnektir.' },
        { interior: 'spleen', stage: 'red-pulp', text: 'Yaşlanan alyuvarlar dalağın kırmızı pulpasında süzülür.' },
      ],
    },
    high: {
      summary: 'Alyuvar sayısı fazla: koyulaşma, oksijensizliğe yanıt ya da talasemi taşıyıcılığı (çok sayıda küçük hücre).',
      mechanism: ['Talasemi taşıyıcılığında ilik, küçük hücrelerin eksik hemoglobinini sayıyla telafi eder (MCV düşük, RBC yüksek).', 'Oksijensizlikte eritropoietin artar.', 'Susuzlukta oransal artış olur.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'İlik daha çok sayıda alyuvar salıyor.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcallarda hücre sayısı artmış.' },
      ],
      causes: ['thalassemia-trait', 'dehydration', 'secondary-erythrocytosis', 'polycythemia-vera', 'smoking'],
      next: ['mcv', 'hemoglobin', 'ferritin'],
      scene: { rbc: 1.4, rbcSize: 0.9 },
    },
    low: {
      summary: 'Alyuvar sayısı az: kansızlık yönünde.',
      mechanism: ['Üretim azlığı (beslenme eksiklikleri, böbrek, kemik iliği), kayıp ya da yıkım.', 'B12/folat eksikliğinde hücreler az ama büyüktür.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Üretim hattı yavaşlamış olabilir.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcallarda daha az alyuvar geçer.' },
      ],
      causes: ['iron-deficiency', 'b12-deficiency', 'folate-deficiency', 'blood-loss', 'anemia-inflammation', 'ckd', 'hemolysis', 'marrow-failure'],
      next: ['hemoglobin', 'mcv', 'ferritin', 'b12', 'folate'],
      scene: { rbc: 0.6 },
    },
  },
  {
    test: 'mcv',
    normal: {
      summary: 'MCV alyuvarın ortalama büyüklüğüdür; üretim hattında neyin eksik olduğuna dair en iyi ipucudur.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Alyuvar öncülü hemoglobinle dolarken bölünür; yeterli hemoglobin olunca bölünme durur ve hücre normal boyda kalır.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Normal boyutlu (~90 fL) disk şeklindeki alyuvar kılcala esneyerek girer.' },
      ],
    },
    high: {
      summary: 'Alyuvarlar büyük (makrositoz): DNA yapımı yavaşlamış ya da genç hücreler artmış olabilir.',
      mechanism: ['B12 ya da folat eksikliğinde DNA yapılamaz; hücre bölünemeden büyür.', 'Alkol, karaciğer hastalığı ve hipotiroidi zarı değiştirir.', 'Yıkım/kanamada ilik genç (büyük) hücreleri hızla salar.', 'Bazı ilaçlar (metotreksat, hidroksiüre, HIV ilaçları) da büyütür.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Öncül hücreler DNA eksikliğinde bölünemeden büyür.' },
        { interior: 'small-intestine.ileum', stage: 'b12', text: 'B12 eksikliğinde emilim noktası burasıdır.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Alkol/karaciğer hastalığı alyuvar zarını etkileyebilir.' },
      ],
      causes: ['b12-deficiency', 'folate-deficiency', 'pernicious-anemia', 'alcohol', 'hypothyroid', 'hemolysis', 'chemotherapy', 'b12-drugs', 'marrow-neoplasm'],
      next: ['b12', 'folate', 'ggt', 'tsh', 'homocysteine', 'ldh'],
      scene: { rbcSize: 1.25 },
    },
    low: {
      summary: 'Alyuvarlar küçük (mikrositoz): hemoglobin yapımı yetersiz.',
      mechanism: ['Demir yoksa hemoglobin yapılamaz; hücre fazla bölünür ve küçük kalır.', 'Talasemi taşıyıcılığında hemoglobin zinciri kalıtsal olarak az yapılır.', 'Kronik iltihapta demir depoda kilitlenir.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hemoglobin yapımı için demir ya da globin zinciri yetmiyor.' },
        { interior: 'small-intestine.duodenum', stage: 'iron', text: 'Demir eksikliğinde emilim noktası.' },
      ],
      causes: ['iron-deficiency', 'thalassemia-trait', 'anemia-inflammation', 'gi-bleed', 'celiac'],
      next: ['ferritin', 'rbc', 'rdw', 'iron', 'transferrin-saturation'],
      scene: { rbcSize: 0.78, pale: 0.4 },
    },
  },
  {
    test: 'mch',
    normal: {
      summary: 'MCH bir alyuvardaki ortalama hemoglobin miktarıdır (rengi ne kadar dolu).',
      path: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Öncül hücre yeterli demir ve globinle hemoglobinini doldurur.' }],
    },
    high: {
      summary: 'Hücre başına hemoglobin fazla; genellikle hücre büyük olduğu için (makrositoz).',
      mechanism: ['B12/folat eksikliği ve alkolde hücre büyüdüğü için içindeki hemoglobin de artar.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Büyük hücre üretimi.' }],
      causes: ['b12-deficiency', 'folate-deficiency', 'alcohol', 'hypothyroid'],
      next: ['mcv', 'b12', 'folate'],
      scene: { rbcSize: 1.2 },
    },
    low: {
      summary: 'Alyuvarlar soluk (hipokromi): hemoglobinle yeterince dolmamış.',
      mechanism: ['Demir eksikliği ve talasemi taşıyıcılığında hemoglobin yapımı azalır.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hemoglobin dolumu yetersiz.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcaldaki alyuvarlar daha açık renkli, ortası daha soluk.' },
      ],
      causes: ['iron-deficiency', 'thalassemia-trait', 'anemia-inflammation'],
      next: ['ferritin', 'mcv', 'rbc'],
      scene: { pale: 0.6 },
    },
  },
  {
    test: 'mchc',
    normal: {
      summary: 'MCHC alyuvar içindeki hemoglobin yoğunluğudur.',
      path: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hemoglobin hücre hacmine göre belirli bir yoğunlukta dolar.' }],
    },
    high: {
      summary: 'Hemoglobin hücre içinde yoğunlaşmış; küre biçimli alyuvar (sferositoz) ya da ölçüm etkisi (soğuk aglütinin, yağlı örnek).',
      mechanism: ['Zarı eksik alyuvar küre biçimini alır; içindeki hemoglobin yoğunlaşır ve dalakta erken yıkılır.', 'Örnek kaynaklı yanılgılar sık olduğundan tekrar ölçüm önemlidir.'],
      sites: [
        { interior: 'spleen', stage: 'red-pulp', text: 'Küre biçimli alyuvarlar dalağın dar geçitlerinden geçemeyip yıkılır.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Küre biçimli, daha az esnek alyuvarlar.' },
      ],
      causes: ['hemolysis', 'sample-hemolysis', 'nonfasting'],
      next: ['ldh', 'bilirubin-indirect', 'rdw'],
      scene: { rbcSize: 0.9 },
    },
    low: {
      summary: 'Hücre içi hemoglobin yoğunluğu az (hipokromi).',
      mechanism: ['Demir eksikliğinde hemoglobin yapımı yetersiz kalır.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hemoglobin dolumu yetersiz.' }],
      causes: ['iron-deficiency', 'thalassemia-trait'],
      next: ['ferritin', 'mcv'],
      scene: { pale: 0.5 },
    },
  },
  {
    test: 'rdw',
    normal: {
      summary: 'RDW alyuvarların boyca ne kadar farklı olduğudur; üretim hattı düzenliyse hücreler benzer boydadır.',
      path: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hammadde düzenli gelirse her gün benzer boyda alyuvar çıkar.' }],
    },
    high: {
      summary: 'Alyuvar boyları çok farklı: üretim hattında değişen bir eksiklik ya da karışık bir durum var.',
      mechanism: ['Demir eksikliği başlarken yeni hücreler küçülür, eskiler normaldir → boy farkı artar.', 'B12/folat eksikliği, kanama/yıkım sonrası genç hücreler ve karma eksiklikler de RDW’yi artırır.', 'Talasemi taşıyıcılığında hücreler küçük ama birbirine benzer olduğundan RDW genellikle normaldir (ayrımda ipucu).'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Farklı dönemlerde farklı boyda hücre üretilmiş.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Kılcalda farklı boyda alyuvarlar.' },
      ],
      causes: ['iron-deficiency', 'b12-deficiency', 'folate-deficiency', 'hemolysis', 'blood-loss', 'hemoglobinopathy', 'marrow-neoplasm'],
      next: ['mcv', 'ferritin', 'b12', 'folate'],
      scene: { rbcSize: 1.05 },
    },
    low: 'RDW’nin düşük olması klinik olarak anlam taşımaz; alyuvarların boyca benzer olduğunu gösterir.',
  },
  {
    test: 'rdw-sd',
    normal: {
      summary: 'RDW-SD alyuvar boy farkının femtolitre cinsinden ölçüsüdür (RDW’nin başka bir gösterimi).',
      path: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Düzenli üretimde boylar benzerdir.' }],
    },
    high: {
      summary: 'Alyuvar boyları farklılaşmış; özellikle büyük hücrelerin eklendiğini düşündürebilir.',
      mechanism: ['B12/folat eksikliği, genç hücre artışı ya da karışık eksiklik.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Farklı boyda hücre üretimi.' }],
      causes: ['b12-deficiency', 'folate-deficiency', 'iron-deficiency', 'hemolysis'],
      next: ['mcv', 'b12', 'folate', 'ferritin'],
    },
    low: 'RDW-SD’nin düşük olması genellikle anlam taşımaz.',
  },
  {
    test: 'wbc',
    normal: {
      summary: 'Akyuvarlar bağışıklık sisteminin savunma hücreleridir; kemik iliğinde üretilir, damardan dokulara geçerek mikroplarla savaşır.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Nötrofil, lenfosit, monosit, eozinofil ve bazofil kemik iliğinde farklı hatlarda üretilir.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'İltihap sinyali olan yerde venül duvarına yapışıp dokuya geçerler.' },
        { interior: 'ic.lymph-node', stage: 'presentation', text: 'Lenfositler lenf düğümlerinde mikrobu tanır ve çoğalır.' },
        { interior: 'spleen', stage: 'immune', text: 'Dalak kandaki mikropları süzer ve bağışıklık yanıtı başlatır.' },
      ],
    },
    high: {
      summary: 'Savunma hücreleri artmış: enfeksiyon, iltihap, stres yanıtı, sigara ya da nadiren kemik iliği hastalığı.',
      mechanism: ['Enfeksiyon/iltihapta salınan sinyaller (IL-1, IL-6, G-CSF) ilikten nötrofil salınımını artırır.', 'Stres ve kortizon, damar duvarına yapışık bekleyen nötrofilleri kana bırakır.', 'Hangi türün arttığı nedeni ayırmaya yardım eder (nötrofil: bakteri/stres; lenfosit: virüs; eozinofil: alerji/parazit).'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Üretim ve salınım hızlanmış.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'Akyuvarlar damar duvarından iltihap bölgesine göç ediyor.' },
        { interior: 'ic.lymph-node', stage: 'presentation', text: 'Lenf düğümleri etkinleşmiş olabilir.' },
      ],
      symptoms: ['Ateş, titreme (enfeksiyonda)', 'Halsizlik', 'Gece terlemesi (kalıcı yükseklikte)'],
      causes: ['bacterial-infection', 'stress-steroid', 'smoking', 'exercise', 'pregnancy', 'autoimmune-rheum', 'gout', 'marrow-neoplasm', 'lymphoproliferative', 'polycythemia-vera', 'splenectomy', 'sepsis'],
      next: ['neutrophil-abs', 'lymphocyte-abs', 'eosinophil-abs', 'crp', 'ig-abs'],
      urgent: '30.000/µL üstü, olgunlaşmamış hücreler ya da yüksek ateş ve genel durum bozukluğu varsa hızlı değerlendirme gerekir.',
      scene: { wbc: 2, inflam: 0.4 },
    },
    low: {
      summary: 'Savunma hücreleri azalmış: enfeksiyona karşı direnç düşebilir.',
      mechanism: ['Viral enfeksiyonlar geçici olarak üretimi baskılar ya da hücreleri dokulara çeker.', 'İlaçlar (kemoterapi, bazı antibiyotikler, tiroid ilaçları) ve otoimmün hastalıklar üretimi azaltır ya da yıkımı artırır.', 'B12/folat eksikliği ve kemik iliği hastalıkları da düşürür.', 'Büyük dalak akyuvarları havuzunda tutar.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Üretim baskılanmış ya da yetersiz olabilir.' },
        { interior: 'spleen', stage: 'immune', text: 'Büyük dalak hücreleri tutabilir.' },
      ],
      symptoms: ['Sık ya da uzun süren enfeksiyonlar', 'Ağızda yaralar', 'Ateş (düşük nötrofilde acil)'],
      causes: ['viral-infection', 'drug-neutropenia', 'chemotherapy', 'benign-neutropenia', 'autoimmune-rheum', 'b12-deficiency', 'hypersplenism', 'marrow-failure', 'marrow-neoplasm', 'brucellosis', 'cchf', 'immunodeficiency', 'sepsis'],
      next: ['neutrophil-abs', 'lymphocyte-abs', 'hemoglobin', 'platelet', 'b12'],
      urgent: 'Nötrofil 0,5×10³/µL’nin altındayken ateş varsa ACİL değerlendirme gerekir.',
      scene: { wbc: 0.4 },
    },
  },
  {
    test: 'platelet',
    normal: {
      summary: 'Trombositler damar zedelendiğinde ilk yapışıp tıkaç oluşturan hücre parçacıklarıdır; pıhtılaşmayı başlatırlar.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Megakaryosit adlı dev hücreler parçalanarak trombosit üretir (karaciğerin trombopoietin sinyaliyle).' },
        { interior: 'ic.artery', stage: 'endothelium', text: 'Endotel zedelenirse trombositler yapışır, kümelenir ve tıkaç oluşturur.' },
        { interior: 'spleen', stage: 'filter', text: 'Trombositlerin yaklaşık üçte biri dalakta beklemede durur; yaşlıları burada yıkılır.' },
      ],
    },
    high: {
      summary: 'Trombosit fazla: çoğunlukla iltihap, demir eksikliği ya da kanama sonrası tepkisel artış; nadiren kemik iliği kaynaklı.',
      mechanism: ['İltihapta IL-6 karaciğerde trombopoietini artırır.', 'Demir eksikliği megakaryosit yapımını uyarır.', 'Dalak yoksa trombositler havuzlanmaz, kanda kalır.', 'Kemik iliği hastalıklarında (esansiyel trombositemi) kontrolsüz üretim olur; pıhtı ya da kanama eğilimi doğabilir.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Megakaryositler daha çok trombosit üretiyor.' },
        { interior: 'ic.artery', stage: 'flow', text: 'Damarda daha çok trombosit dolaşıyor.' },
      ],
      causes: ['reactive-thrombocytosis', 'iron-deficiency', 'bacterial-infection', 'ibd', 'blood-loss', 'splenectomy', 'essential-thrombocythemia', 'polycythemia-vera', 'malignancy'],
      next: ['crp', 'ferritin', 'hemoglobin', 'esr'],
      urgent: '1.000.000/µL üstü değerler hızlı hekim değerlendirmesi gerektirir.',
      scene: { plt: 2 },
    },
    low: {
      summary: 'Trombosit az: kanamayı durduran ilk savunma zayıflamış olabilir.',
      mechanism: ['Üretim azlığı: viral enfeksiyon, alkol, B12/folat eksikliği, kemik iliği hastalığı, kemoterapi.', 'Yıkım artışı: bağışıklık (ITP), ilaçlar, DIC, kanamalı ateşler.', 'Dalakta tutulma: siroz ve büyük dalak.', 'Örnek tüpünde kümelenme yalancı düşüklük yapabilir.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Megakaryosit üretimi azalmış olabilir.' },
        { interior: 'spleen', stage: 'filter', text: 'Dalakta tutulma ya da yıkım artmış olabilir.' },
        { interior: 'ic.capillary', stage: 'wall', text: 'Küçük damar zedelenmelerinde tıkaç zayıf kalır (morarma, peteşi).' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer trombopoietin yapar; sirozda azalır.' },
      ],
      symptoms: ['Kolay morarma', 'Diş eti ya da burun kanaması', 'Deride iğne ucu kırmızı noktalar (peteşi)', 'Uzun süren kanama'],
      causes: ['pseudothrombocytopenia', 'viral-infection', 'itp', 'hypersplenism', 'cirrhosis', 'alcohol', 'b12-deficiency', 'folate-deficiency', 'chemotherapy', 'marrow-failure', 'marrow-neoplasm', 'dic', 'cchf', 'pregnancy', 'preeclampsia', 'antiphospholipid', 'sepsis'],
      next: ['mpv', 'hemoglobin', 'wbc', 'inr', 'aptt', 'alt', 'b12'],
      urgent: '20.000/µL altı ya da kanama varsa ACİL değerlendirme gerekir; keneyle temas ve ateş varsa KKKA açısından acile başvurulmalıdır.',
      scene: { plt: 0.3 },
    },
  },
  {
    test: 'mpv',
    normal: {
      summary: 'MPV trombositlerin ortalama büyüklüğüdür; genç trombositler daha büyüktür.',
      path: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Megakaryositten yeni kopan trombositler büyük, yaşlandıkça küçük olur.' }],
    },
    high: {
      summary: 'Trombositler büyük: kemik iliği hızlı yeni trombosit salıyor (çevrede yıkım varken).',
      mechanism: ['ITP gibi yıkım durumlarında ilik telafi için genç, büyük trombositleri hızla salar.', 'Bazı kalıtsal trombosit hastalıklarında da büyük trombosit görülür.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Hızlı trombosit yapımı.' }],
      causes: ['itp', 'reactive-thrombocytosis', 'essential-thrombocythemia', 'diabetes-t2'],
      next: ['platelet'],
    },
    low: {
      summary: 'Trombositler küçük: üretim azlığına işaret edebilir.',
      mechanism: ['Kemik iliği üretimi azsa (aplazi, kemoterapi) yeni büyük trombositler çıkmaz.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Üretim yavaş.' }],
      causes: ['marrow-failure', 'chemotherapy', 'hypersplenism'],
      next: ['platelet', 'wbc', 'hemoglobin'],
    },
  },
  {
    test: 'pdw',
    normal: {
      summary: 'PDW trombosit boylarının ne kadar farklı olduğudur.',
      path: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Trombosit üretimi düzenliyse boylar benzerdir.' }],
    },
    high: {
      summary: 'Trombosit boyları farklılaşmış; çoğu zaman genç trombositlerin artışıyla.',
      mechanism: ['Yıkım ya da tüketim arttığında ilik farklı boyda trombosit salar.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Değişken trombosit yapımı.' }],
      causes: ['itp', 'reactive-thrombocytosis', 'marrow-neoplasm'],
      next: ['platelet', 'mpv'],
    },
    low: 'PDW’nin düşük olması genellikle anlam taşımaz.',
  },
  {
    test: 'plateletcrit',
    normal: {
      summary: 'Plateletkrit trombositlerin kan hacminde kapladığı yüzdedir (sayı × boy).',
      path: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Trombosit sayısı ve boyu birlikte belirler.' }],
    },
    high: {
      summary: 'Toplam trombosit kütlesi artmış (çoğunlukla trombosit sayısı yüksek).',
      mechanism: ['Tepkisel ya da kemik iliği kaynaklı trombosit artışı.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Trombosit üretimi artmış.' }],
      causes: ['reactive-thrombocytosis', 'iron-deficiency', 'essential-thrombocythemia'],
      next: ['platelet', 'crp', 'ferritin'],
      scene: { plt: 1.6 },
    },
    low: {
      summary: 'Toplam trombosit kütlesi az (çoğunlukla trombosit sayısı düşük).',
      mechanism: ['Trombosit azlığının nedenleriyle aynıdır.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Trombosit üretimi azalmış ya da yıkım artmış.' }],
      causes: ['itp', 'viral-infection', 'hypersplenism', 'marrow-failure'],
      next: ['platelet', 'mpv'],
      scene: { plt: 0.5 },
    },
  },
  {
    test: 'neutrophil',
    normal: {
      summary: 'Nötrofiller bakterilere karşı ilk savunma hattıdır; damar duvarından dokuya geçip mikrobu yutarlar.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Kemik iliğinde 1–2 haftada olgunlaşırlar; büyük bir depo hazır bekler.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'İltihap sinyaliyle venül duvarına yapışıp dokuya göç ederler.' },
        { interior: 'ic.venule', stage: 'flow', text: 'Kanda yalnızca birkaç saat kalırlar; yarısı damar duvarında beklemededir.' },
      ],
    },
    high: {
      summary: 'Nötrofil artmış: bakteriyel enfeksiyon, iltihap, stres/kortizon, sigara ya da ağır egzersiz.',
      mechanism: ['G-CSF ve IL-1 sinyali ilik deposunu boşaltır; gençler de (çomak, IG) kana çıkar.', 'Kortizol damar duvarındaki nötrofilleri serbest bırakır.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Depo boşaltılıyor, üretim hızlanıyor.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'Nötrofiller iltihap bölgesine göç ediyor.' },
      ],
      causes: ['bacterial-infection', 'stress-steroid', 'smoking', 'exercise', 'autoimmune-rheum', 'gout', 'sepsis', 'marrow-neoplasm'],
      next: ['crp', 'wbc', 'ig-abs', 'lymphocyte-abs'],
      scene: { wbc: 1.8, inflam: 0.5 },
    },
    low: {
      summary: 'Nötrofil azalmış: bakteriyel enfeksiyona yatkınlık artabilir.',
      mechanism: ['Virüsler, ilaçlar, otoimmün hastalıklar ve B12/folat eksikliği üretimi azaltır ya da yıkımı artırır.', 'Bazı kişilerde ömür boyu, zararsız biçimde düşüktür.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Nötrofil hattı yavaşlamış.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'Damardan dokuya geçecek savunma hücresi az.' },
      ],
      causes: ['viral-infection', 'drug-neutropenia', 'benign-neutropenia', 'chemotherapy', 'autoimmune-rheum', 'b12-deficiency', 'hypersplenism', 'brucellosis', 'marrow-failure'],
      next: ['wbc', 'hemoglobin', 'platelet', 'b12'],
      urgent: 'Mutlak nötrofil 0,5×10³/µL altında ve ateş varsa ACİLDİR.',
      scene: { wbc: 0.5 },
    },
  },
  {
    test: 'lymphocyte',
    normal: {
      summary: 'Lenfositler (T, B ve NK hücreleri) virüslere karşı savaşır, antikor üretir ve bağışıklık hafızası oluşturur.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Kemik iliğinde üretilirler; T hücreleri timusta eğitilir.' },
        { interior: 'ic.thymus', stage: 'selection', text: 'T hücreleri kendine saldırmamayı timusta öğrenir.' },
        { interior: 'ic.lymph-node', stage: 'presentation', text: 'Lenf düğümünde antijeni tanıyan lenfosit çoğalır; B hücreleri antikor üretir.' },
      ],
    },
    high: {
      summary: 'Lenfosit artmış: çoğunlukla viral enfeksiyon; ileri yaşta kalıcıysa lenfosit çoğalması hastalıkları da düşünülür.',
      mechanism: ['Virüsü tanıyan lenfosit klonları çoğalır.', 'Bazı kronik enfeksiyonlar (bruselloz, tüberküloz, boğmaca) lenfositi artırır.', 'KLL gibi hastalıklarda olgun lenfositler birikir.'],
      sites: [
        { interior: 'ic.lymph-node', stage: 'presentation', text: 'Lenf düğümleri etkinleşip büyüyebilir.' },
        { interior: 'spleen', stage: 'white-pulp', text: 'Dalağın beyaz pulpasında lenfosit çoğalması.' },
      ],
      causes: ['viral-infection', 'mononucleosis', 'brucellosis', 'tuberculosis', 'lymphoproliferative', 'splenectomy', 'marrow-neoplasm'],
      next: ['wbc', 'neutrophil-abs', 'alt', 'ldh'],
      scene: { wbc: 1.5 },
    },
    low: {
      summary: 'Lenfosit azalmış: stres/kortizon, akut enfeksiyon, bağışıklık yetmezliği ya da ilaç etkisi.',
      mechanism: ['Kortizol lenfositleri dolaşımdan lenf düğümlerine çeker ve yıkımını artırır.', 'Bazı virüsler (HIV, COVID-19) lenfositleri azaltır.', 'Kemoterapi, radyoterapi ve bağışıklık baskılayıcılar üretimi azaltır.'],
      sites: [
        { interior: 'ic.lymph-node', stage: 'lymphocyte', text: 'Dolaşan lenfosit sayısı azalmış.' },
        { interior: 'ic.thymus', stage: 't-cell', text: 'T hücre üretimi (özellikle ileri yaşta) yavaşlar.' },
      ],
      causes: ['stress-steroid', 'viral-infection', 'immunodeficiency', 'chemotherapy', 'autoimmune-rheum', 'lymphoma', 'cushing', 'malnutrition', 'tuberculosis'],
      next: ['wbc', 'cortisol', 'albumin'],
      scene: { wbc: 0.7 },
    },
  },
  {
    test: 'monocyte',
    normal: {
      summary: 'Monositler kandan dokuya geçip makrofaja dönüşür; ölü hücreleri ve mikropları temizler.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Kemik iliğinde üretilir, 1–3 gün kanda kalır.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'Dokuya geçip makrofaj olur.' },
        { interior: 'liver', stage: 'sinusoid', text: 'Karaciğerdeki Kupffer hücreleri yerleşik makrofajlardır.' },
      ],
    },
    high: {
      summary: 'Monosit artmış: süren (kronik) enfeksiyon, iyileşme dönemi, otoimmün hastalık ya da nadiren kan hastalığı.',
      mechanism: ['Tüberküloz, bruselloz, endokardit gibi süregen enfeksiyonlar ve enfeksiyon sonrası iyileşme dönemi monositi artırır.', 'Kalıcı yüksek monositte kemik iliği hastalıkları (KMML) da değerlendirilir.'],
      sites: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Monosit üretimi artmış.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'Dokuya göç eden makrofaj öncülleri artmış.' },
      ],
      causes: ['viral-infection', 'mononucleosis', 'tuberculosis', 'brucellosis', 'autoimmune-rheum', 'ibd', 'marrow-neoplasm'],
      next: ['crp', 'esr', 'wbc'],
      scene: { wbc: 1.3 },
    },
    low: {
      summary: 'Monosit azalmış: kortizon kullanımı, kemik iliği baskılanması ya da bazı nadir durumlar.',
      mechanism: ['Kortizol ve kemoterapi monosit sayısını düşürür.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Monosit hattı baskılanmış olabilir.' }],
      causes: ['stress-steroid', 'chemotherapy', 'marrow-failure'],
      next: ['wbc', 'neutrophil-abs'],
    },
  },
  {
    test: 'eosinophil',
    normal: {
      summary: 'Eozinofiller parazitlere karşı savaşır ve alerjik iltihapta rol alır.',
      path: [
        { interior: 'ic.bone-marrow', stage: 'lineages', text: 'Kemik iliğinde IL-5 sinyaliyle üretilir.' },
        { interior: 'lungs', stage: 'bronchiole', text: 'Alerjik yanıtta bronş duvarına göç eder.' },
        { interior: 'small-intestine', stage: 'mucosa', text: 'Bağırsak duvarında parazitlere karşı nöbet tutar.' },
      ],
    },
    high: {
      summary: 'Eozinofil artmış: alerji, astım, egzama, parazit, bazı ilaçlar ya da nadiren böbreküstü yetmezliği ve kan hastalıkları.',
      mechanism: ['Alerjik yanıtta T yardımcı 2 hücreleri IL-5 salgılar; ilik eozinofil üretimini artırır.', 'Parazit dokuya yerleştiğinde eozinofiller güçlü biçimde çağrılır.', 'Kortizol azlığında (Addison) eozinofiller baskılanmaz.'],
      sites: [
        { interior: 'lungs', stage: 'bronchiole', text: 'Astım/alerjide bronşiyol duvarında birikirler.' },
        { interior: 'small-intestine', stage: 'mucosa', text: 'Parazitte bağırsak duvarına göç ederler.' },
        { interior: 'skin', stage: 'layers', text: 'Egzama ve ilaç döküntülerinde deride birikirler.' },
      ],
      causes: ['allergy', 'parasite', 'adrenal-insufficiency', 'autoimmune-rheum', 'lymphoma'],
      next: ['wbc', 'cortisol'],
      urgent: '1,5×10³/µL üstü kalıcı eozinofil artışı organ hasarı yapabileceğinden değerlendirilmelidir.',
      scene: { wbc: 1.3 },
    },
    low: {
      summary: 'Eozinofilin düşük olması çoğunlukla anlam taşımaz; stres ya da kortizon etkisi olabilir.',
      mechanism: ['Kortizol eozinofilleri dolaşımdan çeker.'],
      sites: [{ interior: 'adrenals', stage: 'hormones', text: 'Kortizol fazlalığında eozinofiller baskılanır.' }],
      causes: ['stress-steroid', 'cushing'],
      next: ['cortisol'],
    },
  },
  {
    test: 'basophil',
    normal: {
      summary: 'Bazofiller histamin depolayan en az sayıdaki akyuvarlardır; alerjik yanıtta rol alırlar.',
      path: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Kemik iliğinde üretilir, kanda çok az bulunur.' }],
    },
    high: {
      summary: 'Bazofil artmış: alerji, hipotiroidi, iltihabi hastalıklar; kalıcı belirgin artış kemik iliği hastalıklarında (KML) görülür.',
      mechanism: ['Alerjik yanıtta histamin salan hücreler artar.', 'Kronik miyeloid lösemi gibi hastalıklarda bazofil artışı tipiktir.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Bazofil üretimi artmış.' }],
      causes: ['allergy', 'hypothyroid', 'ibd', 'marrow-neoplasm', 'polycythemia-vera'],
      next: ['wbc', 'tsh'],
    },
    low: 'Bazofilin düşük olması klinik olarak anlam taşımaz (normalde de çok azdır).',
  },
  {
    test: 'ig',
    normal: {
      summary: 'İmmatür granülositler, kemik iliğinden henüz olgunlaşmadan kana çıkmış genç nötrofil öncülleridir; normalde kanda neredeyse yoktur.',
      path: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Olgunlaşma kemik iliğinde tamamlanır; gençler ilikte kalır.' }],
    },
    high: {
      summary: 'Kemik iliği genç hücreleri erken salıyor: ağır enfeksiyon, iltihap, gebelik, kortizon ya da kemik iliği hastalığı.',
      mechanism: ['Bakteriyel enfeksiyonda depo yetmeyince gençler de kana çıkar (sola kayma).', 'Kemik iliği hastalıklarında olgunlaşma bozulur.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'lineages', text: 'Olgunlaşmamış hücreler kana çıkıyor.' }],
      causes: ['bacterial-infection', 'sepsis', 'pregnancy', 'stress-steroid', 'marrow-neoplasm'],
      next: ['wbc', 'neutrophil-abs', 'crp'],
      scene: { wbc: 1.4 },
    },
    low: 'Normalde kanda neredeyse hiç immatür granülosit yoktur; düşük olması beklenen durumdur.',
  },
];
