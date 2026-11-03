import type { LabEffect } from '../types';

/** Demir, vitaminler, iltihap ve pıhtılaşma. */
export const VITAMINS: LabEffect[] = [
  {
    test: 'iron',
    normal: {
      summary: 'Serum demiri, transferrine bağlı olarak kanda taşınan demirdir; gün içinde ve yemekle çok değişir.',
      path: [
        { interior: 'small-intestine.duodenum', stage: 'iron', text: 'Demir duodenumdan (DMT1) emilir, ferroportinle kana verilir.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Kanda transferrine bağlı taşınır.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Kemik iliği hemoglobin yapımı için alır.' },
        { interior: 'spleen', stage: 'filter', text: 'Yaşlı alyuvarlardan geri kazanılan demir dalak makrofajlarından tekrar kana verilir.' },
      ],
    },
    high: {
      summary: 'Serum demiri yüksek: tahlilden önce demir ilacı, demir birikimi (hemokromatoz, sık kan nakli), hemoliz ya da karaciğer hasarı.',
      mechanism: ['Bağırsak hepsidin freni olmadan fazla demir emer (hemokromatoz).', 'Hasarlı karaciğer ve parçalanan alyuvarlar demiri kana bırakır.'],
      sites: [
        { interior: 'small-intestine.duodenum', stage: 'iron', text: 'Emilim fazla olabilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Fazla demir karaciğerde birikir.' },
      ],
      causes: ['iron-supplement', 'hemochromatosis', 'iron-overload-secondary', 'hemolysis', 'viral-hepatitis'],
      next: ['ferritin', 'transferrin-saturation', 'alt'],
    },
    low: {
      summary: 'Serum demiri düşük: demir eksikliği ya da iltihapta demirin depoda kilitlenmesi (ferritine bakarak ayrılır).',
      mechanism: ['Eksiklikte depo boştur (ferritin düşük, TIBC yüksek).', 'İltihapta hepsidin demiri depoda tutar (ferritin normal/yüksek, TIBC düşük).'],
      sites: [
        { interior: 'small-intestine.duodenum', stage: 'iron', text: 'Emilim yetersiz ya da hepsidinle frenlenmiş olabilir.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Kemik iliğine yeterli demir ulaşmıyor.' },
      ],
      causes: ['iron-deficiency', 'anemia-inflammation', 'blood-loss', 'celiac', 'malabsorption', 'pregnancy'],
      next: ['ferritin', 'tibc', 'transferrin-saturation', 'crp', 'hemoglobin'],
      scene: { pale: 0.3 },
    },
  },
  {
    test: 'ferritin',
    normal: {
      summary: 'Ferritin hücre içindeki demir deposu proteinidir; kandaki düzeyi depoların büyüklüğünü yansıtır — ama iltihapta da yükselir.',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Demir karaciğerde ferritin olarak depolanır.' },
        { interior: 'spleen', stage: 'red-pulp', text: 'Dalak makrofajları geri kazanılan demiri ferritinde tutar.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'İhtiyaçta depodan kemik iliğine demir verilir.' },
      ],
    },
    high: {
      summary: 'Ferritin yüksek: çoğu zaman iltihap, yağlı karaciğer, alkol ya da metabolik sendrom; transferrin satürasyonu da yüksekse gerçek demir birikimi düşünülür.',
      mechanism: ['İltihap sinyalleri ferritin yapımını demirden bağımsız artırır.', 'Hasarlı karaciğer hücrelerinden ferritin sızar.', 'Hemokromatoz ve sık kan naklinde depo gerçekten dolar; demir organlarda birikir.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Depo artmış ya da hücre zorlanması var.' },
        { interior: 'spleen', stage: 'red-pulp', text: 'Makrofaj deposu dolmuş olabilir.' },
        { interior: 'pancreas', stage: 'endocrine', text: 'Gerçek demir birikiminde pankreas etkilenebilir.' },
        { interior: 'heart', stage: 'myocardium', text: 'Ağır birikimde kalp kası etkilenebilir.' },
      ],
      causes: ['ferritin-inflammation', 'masld', 'alcohol', 'metabolic-syndrome', 'hemochromatosis', 'iron-overload-secondary', 'anemia-inflammation', 'viral-hepatitis', 'malignancy'],
      next: ['transferrin-saturation', 'iron', 'crp', 'alt', 'ggt'],
    },
    low: {
      summary: 'Demir deposu boşalmış: demir eksikliğinin en güvenilir göstergesidir (kansızlık henüz olmasa bile).',
      mechanism: ['Önce depo (ferritin) tükenir, sonra serum demiri düşer, en son hemoglobin düşer.', 'Demir eksikliği kansızlık olmadan da yorgunluk, saç dökülmesi ve huzursuz bacak yapabilir.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Demir deposu boş.' },
        { interior: 'small-intestine.duodenum', stage: 'iron', text: 'Emilim yetmiyor ya da kayıp emilimden fazla.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Kemik iliği yakında küçük, soluk alyuvar yapmaya başlar.' },
      ],
      symptoms: ['Yorgunluk', 'Saç dökülmesi', 'Tırnak kırılması', 'Huzursuz bacak', 'Buz ya da toprak yeme isteği'],
      causes: ['iron-deficiency', 'blood-loss', 'gi-bleed', 'celiac', 'malabsorption', 'pregnancy', 'vegan-diet', 'parasite', 'ibd'],
      next: ['hemoglobin', 'mcv', 'iron', 'tibc', 'transferrin-saturation'],
      scene: { pale: 0.35 },
    },
  },
  {
    test: 'tibc',
    normal: {
      summary: 'TIBC, kandaki transferrinin bağlayabileceği toplam demir miktarıdır; karaciğer, demir azaldıkça transferrin yapımını artırır.',
      path: [{ interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer transferrin üretir.' }],
    },
    high: {
      summary: 'Taşıyıcı (transferrin) artmış: vücut demir arıyor — demir eksikliği; gebelik ve doğum kontrol hapı da artırır.',
      mechanism: ['Depo boşalınca karaciğer daha çok transferrin yapar.'],
      sites: [{ interior: 'liver', stage: 'hepatocyte', text: 'Transferrin yapımı artmış.' }],
      causes: ['iron-deficiency', 'pregnancy', 'estrogen-transferrin'],
      next: ['ferritin', 'iron', 'transferrin-saturation'],
    },
    low: {
      summary: 'Taşıyıcı azalmış: iltihap, karaciğer hastalığı, protein kaybı ya da demir fazlalığı.',
      mechanism: ['İltihapta ve beslenme bozukluğunda transferrin üretimi azalır.'],
      sites: [{ interior: 'liver', stage: 'hepatocyte', text: 'Transferrin yapımı azalmış.' }],
      causes: ['anemia-inflammation', 'cirrhosis', 'nephrotic', 'malnutrition', 'hemochromatosis'],
      next: ['ferritin', 'crp', 'albumin'],
    },
  },
  {
    test: 'uibc',
    normal: {
      summary: 'UIBC, transferrinin henüz boş olan demir bağlama kapasitesidir (TIBC − serum demiri).',
      path: [{ interior: 'liver', stage: 'hepatocyte', text: 'Transferrin karaciğerde yapılır.' }],
    },
    high: {
      summary: 'Taşıyıcıların çoğu boş: demir eksikliği yönünde.',
      mechanism: ['Demir az, transferrin çok olunca boş yer artar.'],
      sites: [{ interior: 'ic.capillary', stage: 'cells', text: 'Kanda boş taşıyıcı fazla.' }],
      causes: ['iron-deficiency', 'pregnancy', 'estrogen-transferrin'],
      next: ['ferritin', 'iron'],
    },
    low: {
      summary: 'Taşıyıcılar dolu ya da azalmış: demir fazlalığı ya da iltihap.',
      mechanism: ['Demir birikiminde transferrin dolar.'],
      sites: [{ interior: 'liver', stage: 'hepatocyte', text: 'Demir yükü fazla olabilir.' }],
      causes: ['hemochromatosis', 'iron-overload-secondary', 'anemia-inflammation', 'iron-supplement'],
      next: ['ferritin', 'transferrin-saturation'],
    },
  },
  {
    test: 'transferrin-saturation',
    normal: {
      summary: 'Transferrin satürasyonu, taşıyıcıların yüzde kaçının demirle dolu olduğudur (%20–45).',
      path: [
        { interior: 'ic.capillary', stage: 'cells', text: 'Kanda transferrin demiri kemik iliğine taşır.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'İlik transferrin alıcılarıyla demiri alır.' },
      ],
    },
    high: {
      summary: 'Taşıyıcılar aşırı dolu: demir birikimi (hemokromatoz), sık kan nakli ya da tahlil öncesi demir ilacı.',
      mechanism: ['%45 üstü kalıcıysa demir organlara serbest olarak yüklenebilir; hemokromatoz araştırılır.'],
      sites: [
        { interior: 'small-intestine.duodenum', stage: 'iron', text: 'Fazla emilim olabilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Demir karaciğerde birikiyor olabilir.' },
      ],
      causes: ['hemochromatosis', 'iron-overload-secondary', 'iron-supplement', 'hemolysis'],
      next: ['ferritin', 'alt', 'glucose'],
    },
    low: {
      summary: 'Taşıyıcılarda az demir: kemik iliğine yeterli demir gitmiyor (eksiklik ya da iltihap).',
      mechanism: ['%20 altında kan yapımı için demir yetersiz kalır.'],
      sites: [{ interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'İliğe ulaşan demir az.' }],
      causes: ['iron-deficiency', 'anemia-inflammation', 'blood-loss'],
      next: ['ferritin', 'crp', 'hemoglobin'],
      scene: { pale: 0.3 },
    },
  },
  {
    test: 'b12',
    normal: {
      summary: 'B12 (kobalamin) DNA yapımı ve sinir kılıfı (miyelin) için gereklidir; yalnızca hayvansal gıdalarda bulunur ve emilimi midenin iç faktörüne bağlıdır.',
      path: [
        { interior: 'stomach', stage: 'acid', text: 'Mide asidi B12’yi besin proteininden ayırır.' },
        { interior: 'stomach', stage: 'if', text: 'Parietal hücreler iç faktör salgılar.' },
        { interior: 'small-intestine.ileum', stage: 'b12', text: 'B12–iç faktör kompleksi ileumun son kısmından emilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer yıllarca yetecek B12 depolar.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hızla bölünen ilik hücreleri DNA yapımı için B12 kullanır.' },
        { interior: 'brain.white-matter', stage: 'myelin', text: 'Miyelin yapımı ve korunması için gereklidir.' },
      ],
    },
    high: {
      summary: 'B12 yüksek: çoğunlukla takviye/iğne; takviye yoksa karaciğer, böbrek ya da kan hastalıkları açısından değerlendirilebilir.',
      mechanism: ['Takviye fazlası idrarla atılır, zararsızdır.', 'Karaciğer hasarında depodan salınım ve bazı kan hastalıklarında taşıyıcı protein artışı görülür.'],
      sites: [{ interior: 'liver', stage: 'hepatocyte', text: 'Depo dolu ya da salınım artmış.' }],
      causes: ['b12-high', 'viral-hepatitis', 'ckd', 'marrow-neoplasm'],
      next: ['alt', 'creatinine', 'wbc'],
    },
    low: {
      summary: 'B12 düşük: kemik iliği (büyük alyuvar) ve sinir sistemi (miyelin) etkilenebilir.',
      mechanism: ['Alım azlığı (vegan beslenme), mide asidinin/iç faktörün azlığı (pernisiyöz anemi, atrofik gastrit, PPI, mide ameliyatı), ileum hastalığı ya da metformin.', 'B12 yoksa DNA yapımı yavaşlar: alyuvarlar büyür, sayıları azalır.', 'Miyelin bozulur: ayaklarda uyuşma, denge sorunu, unutkanlık; uzun sürerse kalıcı olabilir.', 'Homosistein ve metilmalonik asit birikir.'],
      sites: [
        { interior: 'stomach', stage: 'if', text: 'İç faktör az olabilir.' },
        { interior: 'small-intestine.ileum', stage: 'b12', text: 'Emilim noktasında sorun olabilir.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hücreler bölünemeden büyür.' },
        { interior: 'brain.white-matter', stage: 'myelin', text: 'Miyelin kılıfı incelebilir (temsili).' },
        { interior: 'nerves', stage: 'myelin', text: 'Periferik sinirlerde uyuşma, karıncalanma.' },
      ],
      symptoms: ['Yorgunluk', 'El-ayakta uyuşma, karıncalanma', 'Denge bozukluğu', 'Unutkanlık', 'Dilde yanma, kızarıklık'],
      causes: ['vegan-diet', 'b12-drugs', 'pernicious-anemia', 'b12-deficiency', 'malabsorption', 'ibd', 'alcohol'],
      next: ['mcv', 'hemoglobin', 'homocysteine', 'folate'],
      scene: { signal: 0.75, rbcSize: 1.2 },
    },
  },
  {
    test: 'folate',
    normal: {
      summary: 'Folat (B9) DNA yapımı ve hücre bölünmesi için gereklidir; yeşil yapraklı sebzeler ve baklagillerde bulunur, depoları birkaç ay yeter.',
      path: [
        { interior: 'small-intestine.jejunum', stage: 'absorption', text: 'Folat jejunumdan emilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğerde depolanır ve etkin biçimine çevrilir.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Bölünen ilik hücreleri kullanır.' },
      ],
    },
    high: 'Folatın yüksek olması genellikle takviye kullanımını gösterir ve tek başına anlam taşımaz (B12 eksikliğini maskeleyebileceği için B12 de kontrol edilmelidir).',
    low: {
      summary: 'Folat düşük: büyük alyuvarlı kansızlık ve homosistein yüksekliği; gebelikte bebeğin sinir tüpü gelişimi için önemlidir.',
      mechanism: ['Az sebze tüketimi, alkol, gebelik/emzirme, emilim bozukluğu ve bazı ilaçlar (metotreksat, fenitoin) folatı azaltır.', 'DNA yapımı yavaşlar, hücreler büyür.'],
      sites: [
        { interior: 'small-intestine.jejunum', stage: 'absorption', text: 'Emilim yetersiz olabilir.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Hücre bölünmesi yavaşlar.' },
      ],
      causes: ['folate-deficiency', 'alcohol', 'celiac', 'malabsorption', 'pregnancy', 'malnutrition'],
      next: ['mcv', 'b12', 'homocysteine'],
      scene: { rbcSize: 1.15 },
    },
  },
  {
    test: 'vitamin-d',
    normal: {
      summary: '25-OH D vitamini, D vitamini deposunun göstergesidir; deride güneşle yapılır, karaciğer ve böbrekte etkinleşir, kalsiyum emilimini sağlar.',
      path: [
        { interior: 'skin', stage: 'vitamin-d', text: 'Deri UVB ışığıyla kolesterolden D3 vitamini yapar.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer 25-OH D’ye çevirir (ölçülen biçim).' },
        { interior: 'kidneys', stage: 'proximal', text: 'Böbrek PTH uyarısıyla etkin 1,25-(OH)₂D yapar.' },
        { interior: 'small-intestine', stage: 'absorption', text: 'Etkin D vitamini bağırsaktan kalsiyum emilimini artırır.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemik mineralleşmesini destekler.' },
      ],
    },
    high: {
      summary: 'D vitamini yüksek: genellikle yüksek doz takviye/ampul; kalsiyum da yüksekse zehirlenme riski.',
      mechanism: ['Fazla D vitamini bağırsaktan kalsiyum emilimini artırır.'],
      sites: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Kalsiyum emilimi artmış.' },
        { interior: 'kidneys', stage: 'filtration', text: 'Yüksek kalsiyum böbreği zorlayabilir.' },
      ],
      causes: ['vitamin-d-excess'],
      next: ['calcium', 'phosphorus', 'creatinine'],
      urgent: 'Kalsiyum yüksekliğiyle birlikte bulantı, susama, sık idrar varsa hızlı değerlendirme gerekir.',
    },
    low: {
      summary: 'D vitamini deposu az: bağırsaktan kalsiyum emilimi azalır, kemik mineralleşmesi zayıflar, paratiroid uyarılır.',
      mechanism: ['Kalsiyum düşme eğilimindeyken PTH artar ve kemikten kalsiyum çeker (ALP artabilir).', 'Uzun sürerse erişkinde osteomalazi (yumuşak kemik), çocukta raşitizm; kas güçsüzlüğü ve ağrı olabilir.'],
      sites: [
        { interior: 'skin', stage: 'vitamin-d', text: 'Deride yapım az (güneş az).' },
        { interior: 'small-intestine', stage: 'absorption', text: 'Kalsiyum emilimi azalmış.' },
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'Paratiroid uyarılmış olabilir.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Mineralleşme zayıflar.' },
      ],
      symptoms: ['Çoğu zaman belirti yok', 'Kemik ve kas ağrısı', 'Kas güçsüzlüğü', 'Yorgunluk'],
      causes: ['low-sun', 'vitamin-d-deficiency', 'obesity', 'malabsorption', 'celiac', 'ckd', 'cirrhosis', 'chronic-pancreatitis'],
      next: ['calcium', 'phosphorus', 'alp'],
    },
  },
  {
    test: 'homocysteine',
    normal: {
      summary: 'Homosistein, metiyonin amino asidinin ara ürünüdür; B12, folat ve B6 ile zararsız maddelere çevrilir.',
      path: [
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer homosisteini B12/folat ile metiyonine, B6 ile sisteine çevirir.' },
        { interior: 'ic.artery', stage: 'endothelium', text: 'Yüksek düzeyi damar iç yüzeyini zorlar.' },
      ],
    },
    high: {
      summary: 'Homosistein birikiyor: B12/folat/B6 eksikliği, böbrek hastalığı, hipotiroidi ya da kalıtsal enzim farklılığı; damar sağlığıyla ilişkilidir.',
      mechanism: ['Vitamin eksikliğinde çevrim durur, homosistein kana taşar.', 'Endotel işlevini bozarak damar sertliği ve pıhtı eğilimiyle ilişkilendirilir.'],
      sites: [
        { interior: 'liver', stage: 'metabolism', text: 'Çevrim yavaşlamış.' },
        { interior: 'ic.artery', stage: 'endothelium', text: 'Damar iç yüzeyi zorlanıyor.' },
      ],
      causes: ['b12-deficiency', 'folate-deficiency', 'vegan-diet', 'ckd', 'hypothyroid', 'homocysteine-genetic'],
      next: ['b12', 'folate', 'creatinine', 'tsh'],
      scene: { plaque: 0.3, inflam: 0.2 },
    },
    low: 'Homosisteinin düşük olması anlam taşımaz.',
  },
  {
    test: 'crp',
    normal: {
      summary: 'CRP, iltihap ya da enfeksiyon başladığında karaciğerin saatler içinde ürettiği "akut faz" proteinidir; normalde çok düşüktür.',
      path: [
        { interior: 'ic.venule', stage: 'leukocyte', text: 'İltihap bölgesindeki hücreler IL-6 salgılar.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'IL-6 karaciğerde CRP yapımını hızla artırır.' },
        { interior: 'ic.lymph-node', stage: 'antibody', text: 'CRP mikropların yüzeyine yapışıp bağışıklık sistemine işaretler.' },
      ],
    },
    high: {
      summary: 'Vücutta bir yerde iltihap ya da enfeksiyon var — CRP yerini söylemez; değer ne kadar yüksekse süreç o kadar etkin olabilir.',
      mechanism: ['Bakteriyel enfeksiyonlar (özellikle >100 mg/L), viral enfeksiyonlar (genelde daha düşük), romatizmal hastalıklar, doku hasarı (ameliyat, travma, kalp krizi) ve bazı kanserler artırır.', 'Yağ dokusu ve sigara düşük düzeyde sürekli artış yapar.', 'Tedaviye yanıtta 1–2 günde düşmeye başlar; izlemde yararlıdır.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer CRP üretimini artırmış.' },
        { interior: 'ic.venule', stage: 'leukocyte', text: 'İltihap bölgesinde akyuvar göçü ve sinyaller.' },
        { interior: 'ic.lymph-node', stage: 'presentation', text: 'Bağışıklık sistemi etkinleşmiş.' },
      ],
      symptoms: ['Ateş, halsizlik', 'Ağrı, şişlik (iltihap yerinde)'],
      causes: ['bacterial-infection', 'viral-infection', 'autoimmune-rheum', 'ibd', 'sepsis', 'gout', 'acute-pancreatitis', 'giant-cell-arteritis', 'tuberculosis', 'brucellosis', 'obesity', 'malignancy', 'thyroiditis'],
      next: ['wbc', 'neutrophil-abs', 'esr', 'ferritin', 'albumin'],
      urgent: 'CRP çok yüksekken (ör. >100 mg/L) ateş, nefes darlığı, bilinç değişikliği ya da tansiyon düşüklüğü varsa acildir.',
      scene: { inflam: 0.75, wbc: 1.3 },
    },
    low: 'CRP’nin düşük olması beklenen sağlıklı durumdur; anlamlı bir düşüklük kavramı yoktur.',
  },
  {
    test: 'hs-crp',
    normal: {
      summary: 'hs-CRP, CRP’nin çok düşük düzeyleri ölçebilen biçimidir; damar duvarındaki sessiz (düşük düzey) iltihabı ve kalp-damar riskini değerlendirmede kullanılır.',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer IL-6 sinyaliyle CRP üretir.' },
        { interior: 'ic.artery', stage: 'ldl', text: 'Damar duvarındaki plak iltihabı düşük düzeyde sürekli sinyal verir.' },
      ],
    },
    high: {
      summary: 'Düşük düzeyde süregen iltihap: 1–3 mg/L orta, >3 mg/L yüksek kalp-damar riski (o sırada enfeksiyon yoksa); >10 mg/L akut iltihabı düşündürür.',
      mechanism: ['Yağ dokusu, sigara, insülin direnci ve plak iltihabı sürekli IL-6 salgılatır.', 'İki hafta arayla tekrar ölçüm önerilir.'],
      sites: [
        { interior: 'ic.artery', stage: 'ldl', text: 'Plak içindeki iltihap.' },
        { interior: 'adipose', stage: 'storage', text: 'Yağ dokusunun iltihap sinyalleri.' },
      ],
      causes: ['cv-risk', 'obesity', 'metabolic-syndrome', 'smoking', 'bacterial-infection', 'autoimmune-rheum'],
      next: ['ldl', 'hdl', 'glucose', 'hba1c'],
      scene: { inflam: 0.35, plaque: 0.3 },
    },
    low: 'hs-CRP’nin düşük olması damar iltihabı açısından olumlu bir bulgudur.',
  },
  {
    test: 'esr',
    normal: {
      summary: 'Sedimantasyon, alyuvarların tüpte bir saatte ne kadar çöktüğüdür; kanda iltihap proteinleri (fibrinojen, antikorlar) artınca alyuvarlar üst üste dizilip hızlı çöker.',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer iltihapta fibrinojen üretir.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Proteinler alyuvarların birbirine yapışmasını kolaylaştırır.' },
      ],
    },
    high: {
      summary: 'Sedimantasyon hızlı: iltihap, enfeksiyon, kansızlık, gebelik, ileri yaş ya da antikor artışı (miyelom); CRP’den yavaş değişir.',
      mechanism: ['Fibrinojen ve antikorlar alyuvarların yük dengesini değiştirir; rulo dizilim hızlı çöker.', 'Kansızlıkta ve yaşla doğal olarak artar.', 'Çok yüksek (>100 mm/sa) değerler enfeksiyon, romatizmal hastalık, miyelom ya da dev hücreli arteriti düşündürür.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'İltihap proteinleri artmış.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Alyuvarlar rulo şeklinde diziliyor.' },
      ],
      causes: ['autoimmune-rheum', 'bacterial-infection', 'anemia-inflammation', 'giant-cell-arteritis', 'myeloma', 'tuberculosis', 'brucellosis', 'pregnancy', 'ibd', 'malignancy', 'thyroiditis'],
      next: ['crp', 'hemoglobin', 'total-protein'],
      urgent: '50 yaş üstünde çok yüksek sedimantasyonla yeni başlayan baş ağrısı, çene ağrısı ya da görme sorunu ACİLDİR.',
      scene: { inflam: 0.5 },
    },
    low: 'Sedimantasyonun düşük olması genellikle anlam taşımaz (polisitemi ve bazı alyuvar şekil bozukluklarında düşük ölçülebilir).',
  },
  {
    test: 'inr',
    normal: {
      summary: 'INR, karaciğerde K vitaminiyle yapılan pıhtılaşma faktörlerinin (dış yol) ne kadar hızlı pıhtı oluşturduğunu gösterir (normal ~1,0).',
      path: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Yağda eriyen K vitamini safra yardımıyla emilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Karaciğer K vitaminiyle faktör II, VII, IX ve X’u etkinleştirir.' },
        { interior: 'ic.capillary', stage: 'wall', text: 'Damar zedelenince faktörler zincirleme pıhtı oluşturur.' },
      ],
    },
    high: {
      summary: 'Kan geç pıhtılaşıyor: kan sulandırıcı (varfarin), K vitamini eksikliği, karaciğer hastalığı ya da DIC.',
      mechanism: ['Varfarin K vitamini döngüsünü keser (hedef aralık hekimce belirlenir).', 'Karaciğer hasarında faktör yapımı azalır — INR karaciğer işlevinin iyi bir göstergesidir.', 'Safra tıkanıklığı ve emilim bozukluğunda K vitamini emilemez.'],
      sites: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Pıhtılaşma faktörü yapımı azalmış ya da ilaçla frenlenmiş.' },
        { interior: 'ic.capillary', stage: 'wall', text: 'Küçük zedelenmelerde kanama uzayabilir.' },
        { interior: 'small-intestine', stage: 'absorption', text: 'K vitamini emilimi azalmış olabilir.' },
      ],
      symptoms: ['Kolay morarma', 'Diş eti/burun kanaması', 'İdrarda ya da dışkıda kan'],
      causes: ['warfarin', 'vitamin-k-deficiency', 'cirrhosis', 'biliary-obstruction', 'dic', 'malabsorption', 'heparin-doac', 'coag-sample', 'cchf'],
      next: ['aptt', 'albumin', 'platelet', 'alt', 'bilirubin-total'],
      urgent: 'Varfarin kullanırken INR 5 üstü ya da herhangi bir kanama varsa acil değerlendirme gerekir.',
    },
    low: 'INR’nin düşük olması genellikle anlam taşımaz; varfarin kullananlarda hedefin altında kalmak pıhtı riskini artırabilir.',
  },
  {
    test: 'aptt',
    normal: {
      summary: 'aPTT, pıhtılaşmanın iç yolundaki faktörlerin (VIII, IX, XI, XII) çalışmasını ölçer.',
      path: [
        { interior: 'liver', stage: 'hepatocyte', text: 'Pıhtılaşma faktörlerinin çoğu karaciğerde yapılır.' },
        { interior: 'ic.capillary', stage: 'wall', text: 'Damar zedelenince faktör zinciri etkinleşir.' },
      ],
    },
    high: {
      summary: 'İç yol pıhtılaşması yavaş: heparin/yeni kan sulandırıcılar, hemofili/von Willebrand, lupus antikoagülanı, DIC, karaciğer hastalığı ya da tüp hatası.',
      mechanism: ['Faktör eksikliğinde ya da faktörü engelleyen ilaç/antikorda pıhtı geç oluşur.', 'Lupus antikoagülanı tüpte süreyi uzatır ama vücutta pıhtı eğilimi yapar.'],
      sites: [
        { interior: 'ic.capillary', stage: 'wall', text: 'Pıhtı oluşumu gecikebilir.' },
        { interior: 'ic.joint', stage: 'fluid', text: 'Hemofilide eklem içi kanamalar olabilir.' },
        { interior: 'liver', stage: 'hepatocyte', text: 'Faktör yapımı azalmış olabilir.' },
      ],
      causes: ['heparin-doac', 'coag-sample', 'hemophilia-vwd', 'antiphospholipid', 'dic', 'cirrhosis', 'vitamin-k-deficiency', 'warfarin', 'cchf'],
      next: ['inr', 'platelet'],
      urgent: 'Kanamayla birlikte ya da ilaç kullanmıyorken belirgin uzunsa hızlı değerlendirme gerekir.',
    },
    low: 'aPTT’nin kısa olması genellikle anlam taşımaz (akut iltihapta faktör VIII artışıyla görülebilir).',
  },
];
