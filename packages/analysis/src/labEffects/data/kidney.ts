import type { LabEffect } from '../types';

/** Böbrek, idrar, elektrolit ve mineraller. */
export const KIDNEY: LabEffect[] = [
  {
    test: 'creatinine',
    normal: {
      summary: 'Kreatinin kaslardaki kreatinin sabit hızda oluşan yıkım ürünüdür; böbrek onu süzerek atar. Kandaki düzeyi böbreğin süzme gücünü yansıtır.',
      path: [
        { interior: 'skeletal-muscle', stage: 'contraction', text: 'Kas enerjisi için kullanılan kreatin her gün ~%2 oranında kreatinine dönüşür.' },
        { interior: 'kidneys', stage: 'filtration', text: 'Glomerül kreatinini süzer; geri emilmez.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Süzüntüyle idrara geçer.' },
      ],
    },
    high: {
      summary: 'Böbreğin süzme gücü azalmış olabilir (ya da kas kütlesi/kreatin alımı fazladır).',
      mechanism: ['Glomerüle gelen kan azalırsa (sıvı kaybı, kalp yetersizliği), süzgeç hasarlanırsa ya da idrar yolu tıkanırsa süzme düşer ve kreatinin birikir.', 'Süzme yarıya inmeden kreatinin belirgin yükselmez; küçük artışlar önemli olabilir.', 'Bazı ilaçlar (trimetoprim, simetidin) kreatinin atılımını engelleyerek süzme bozulmadan yükseltir.'],
      sites: [
        { interior: 'kidneys', stage: 'filtration', text: 'Glomerüler süzme azalmış olabilir.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Daha az süzüntü oluşuyor; atıklar kanda kalıyor.' },
        { interior: 'kidneys', stage: 'blood', text: 'Böbreğe gelen kan akışı azalmış olabilir (susuzluk, kalp).' },
        { interior: 'urinary-tract.bladder', stage: 'urine', text: 'İdrar yolu tıkanıklığı süzmeyi geriye doğru bozabilir.' },
      ],
      symptoms: ['Erken dönemde çoğu zaman belirti yoktur', 'İdrar miktarında azalma', 'Ödem, halsizlik, bulantı (ileri dönemde)'],
      causes: ['dehydration', 'aki', 'ckd', 'diabetic-kidney', 'hypertensive-kidney', 'urinary-obstruction', 'glomerulonephritis', 'high-muscle-mass', 'rhabdomyolysis', 'liver-congestion', 'myeloma', 'sepsis'],
      next: ['egfr', 'urea', 'potassium', 'urine-microalbumin', 'hco3', 'phosphorus'],
      urgent: 'Kreatinin günler içinde hızla yükseliyorsa, idrar çok azaldıysa ya da potasyum yüksekse acil değerlendirme gerekir.',
      scene: { flow: 0.5, protein: 0.2 },
    },
    low: {
      summary: 'Kreatinin düşük: genellikle az kas kütlesini, gebeliği ya da kanın sulanmasını yansıtır.',
      mechanism: ['Kas azsa daha az kreatinin üretilir.', 'Gebelikte süzme artar.'],
      sites: [{ interior: 'skeletal-muscle', stage: 'contraction', text: 'Kreatinin kaynağı olan kas kütlesi az olabilir.' }],
      causes: ['low-muscle-mass', 'pregnancy', 'malnutrition', 'hemodilution'],
      next: ['albumin', 'ck'],
    },
  },
  {
    test: 'egfr',
    normal: {
      summary: 'eGFR, kreatinin, yaş ve cinsiyetten hesaplanan dakikada süzülen kan miktarıdır (normal ≥ 90 mL/dk/1,73 m²).',
      path: [
        { interior: 'kidneys', stage: 'glomerulus', text: 'Her böbrekte ~1 milyon glomerül kanı süzer.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Günde ~180 litre süzüntü oluşur, %99’u geri emilir.' },
      ],
    },
    high: {
      summary: 'eGFR yüksek: genellikle iyi süzme ya da az kas kütlesi; diyabetin erken döneminde ve gebelikte aşırı süzme olabilir.',
      mechanism: ['Kreatinin düşük olduğunda hesap yüksek çıkar.', 'Erken diyabette glomerüller aşırı süzer (hiperfiltrasyon).'],
      sites: [{ interior: 'kidneys', stage: 'glomerulus', text: 'Süzme yüksek görünüyor.' }],
      causes: ['low-muscle-mass', 'pregnancy', 'diabetic-kidney'],
      next: ['creatinine', 'urine-microalbumin'],
    },
    low: {
      summary: 'Böbreklerin süzme gücü azalmış: 60’ın altında 3 aydan uzun sürerse kronik böbrek hastalığı tanımına girer.',
      mechanism: ['Glomerül sayısı ya da süzme basıncı azalır.', 'Atıklar (üre, kreatinin), potasyum, fosfat ve asit birikmeye başlar.', 'Böbreğin hormon işlevleri (eritropoietin, aktif D vitamini) azalır.'],
      sites: [
        { interior: 'kidneys', stage: 'glomerulus', text: 'İşleyen glomerül sayısı ya da süzme basıncı azalmış.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Daha az süzüntü.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Eritropoietin azalırsa kansızlık gelişebilir.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Aktif D vitamini ve fosfat dengesi bozulursa kemik etkilenir.' },
      ],
      causes: ['ckd', 'aki', 'dehydration', 'diabetic-kidney', 'hypertensive-kidney', 'high-muscle-mass', 'urinary-obstruction', 'glomerulonephritis'],
      next: ['creatinine', 'urine-microalbumin', 'potassium', 'hemoglobin', 'phosphorus', 'calcium'],
      urgent: 'eGFR 15’in altındaysa ya da hızla düşüyorsa hızlı nefroloji değerlendirmesi gerekir.',
      scene: { flow: 0.5 },
    },
  },
  {
    test: 'urea',
    normal: {
      summary: 'Üre, proteinlerin yıkımından çıkan amonyağın karaciğerde zararsız hâle getirilmiş biçimidir; böbrekle atılır.',
      path: [
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer amonyağı üre döngüsünde üreye çevirir.' },
        { interior: 'kidneys', stage: 'filtration', text: 'Böbrek süzer; bir kısmı susuzlukta geri emilir.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Susuzlukta su ile birlikte üre de geri emilir.' },
      ],
    },
    high: {
      summary: 'Üre artmış: susuzluk, böbrek süzmesinin azalması, yüksek protein yükü ya da sindirim kanalı kanaması.',
      mechanism: ['Susuzlukta böbrek suyu tutarken üreyi de geri emer; üre/kreatinin oranı yükselir.', 'Üst sindirim kanalına kanamada kan proteini sindirilip üreye dönüşür.', 'Böbrek süzmesi azalırsa üre birikir.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Susuzlukta geri emilim artmış.' },
        { interior: 'kidneys', stage: 'filtration', text: 'Süzme azalmış olabilir.' },
        { interior: 'stomach', stage: 'mucosa', text: 'Üst sindirim kanalı kanaması kaynak olabilir.' },
      ],
      causes: ['dehydration', 'aki', 'ckd', 'gi-bleed', 'liver-congestion', 'stress-steroid', 'vomiting'],
      next: ['creatinine', 'hemoglobin', 'sodium'],
      scene: { flow: 0.7 },
    },
    low: {
      summary: 'Üre düşük: düşük protein alımı, karaciğer üretim azlığı, gebelik ya da kanın sulanması.',
      mechanism: ['Karaciğer üre döngüsü yavaşlarsa (siroz) üre azalır, amonyak artabilir.'],
      sites: [{ interior: 'liver', stage: 'metabolism', text: 'Üre yapımı azalmış olabilir.' }],
      causes: ['malnutrition', 'cirrhosis', 'pregnancy', 'siadh', 'polydipsia', 'hemodilution'],
      next: ['albumin', 'sodium'],
    },
  },
  {
    test: 'bun',
    normal: {
      summary: 'BUN, kandaki üre azotudur (üre ÷ 2,14); ürenin farklı bir birimle gösterimidir.',
      path: [
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğerde üre olarak üretilir.' },
        { interior: 'kidneys', stage: 'filtration', text: 'Böbrekle atılır.' },
      ],
    },
    high: {
      summary: 'BUN artmış: üre yüksekliğiyle aynı anlam (susuzluk, böbrek, kanama, yüksek protein).',
      mechanism: ['BUN/kreatinin > 20 susuzluk ya da üst sindirim kanalı kanamasını düşündürür.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Geri emilim artmış olabilir.' },
        { interior: 'kidneys', stage: 'filtration', text: 'Süzme azalmış olabilir.' },
      ],
      causes: ['dehydration', 'aki', 'ckd', 'gi-bleed'],
      next: ['creatinine', 'hemoglobin'],
    },
    low: {
      summary: 'BUN düşük: düşük protein alımı, karaciğer hastalığı ya da sulanma.',
      mechanism: ['Üre yapımı azalmıştır.'],
      sites: [{ interior: 'liver', stage: 'metabolism', text: 'Üre yapımı azalmış olabilir.' }],
      causes: ['malnutrition', 'cirrhosis', 'siadh'],
      next: ['albumin'],
    },
  },
  {
    test: 'uric-acid',
    normal: {
      summary: 'Ürik asit, hücre DNA’sındaki ve besinlerdeki pürinlerin son yıkım ürünüdür; çoğu böbrekle atılır.',
      path: [
        { interior: 'liver', stage: 'metabolism', text: 'Pürinler karaciğerde ürik aside yıkılır.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek süzer, büyük kısmını geri emer, bir kısmını salgılar.' },
      ],
    },
    high: {
      summary: 'Ürik asit fazla: ya çok üretiliyor (beslenme, alkol, hücre yıkımı) ya da böbrek yeterince atamıyor.',
      mechanism: ['Kanda çözünürlük sınırını (~6,8 mg/dL) aşınca eklemde ve böbrekte kristal oluşabilir.', 'İnsülin direnci ve idrar söktürücüler böbrekten atılımı azaltır.', 'Hızlı hücre yıkımı (kan hastalıkları, kemoterapi) üretimi artırır.'],
      sites: [
        { interior: 'ic.joint', stage: 'fluid', text: 'Eklem sıvısında iğne biçimli kristaller oluşabilir (gut).' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrekten atılım azalmış olabilir; taş oluşabilir.' },
        { interior: 'liver', stage: 'metabolism', text: 'Fruktoz ve alkol yapımını artırır.' },
      ],
      symptoms: ['Çoğunlukla belirti yok', 'Gut atağı: ani, kızarık, şiş, çok ağrılı eklem (sıklıkla ayak başparmağı)', 'Böbrek taşı ağrısı'],
      causes: ['purine-diet', 'metabolic-syndrome', 'gout', 'ckd', 'diuretics', 'alcohol', 'dehydration', 'obesity', 'preeclampsia', 'lymphoma', 'marrow-neoplasm', 'rhabdomyolysis'],
      next: ['creatinine', 'egfr', 'triglyceride', 'glucose'],
      scene: { crystals: 0.7 },
    },
    low: {
      summary: 'Ürik asit düşük: ürik asit düşürücü ilaç, uygunsuz ADH (sulanma), bazı böbrek tübül bozuklukları ya da Wilson.',
      mechanism: ['Allopürinol yapımı keser.', 'Sulanma ve tübül bozukluklarında atılım artar.'],
      sites: [{ interior: 'tissue.nephron', stage: 'reabsorb', text: 'Geri emilim azalmış olabilir.' }],
      causes: ['allopurinol', 'siadh', 'wilson', 'pregnancy'],
      next: ['sodium'],
    },
  },
  {
    test: 'urine-creatinine',
    normal: {
      summary: 'Spot idrar kreatinini, idrarın ne kadar yoğun ya da seyrek olduğunu gösterir; idrar albumin/protein oranının paydasıdır.',
      path: [
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Süzülen kreatinin idrarda yoğunlaşır.' },
        { interior: 'urinary-tract.bladder', stage: 'urine', text: 'Mesanedeki idrarın yoğunluğu su alımına göre değişir.' },
      ],
    },
    high: {
      summary: 'İdrar yoğun: az su içme, sabah ilk idrarı ya da yüksek kas kütlesi.',
      mechanism: ['Böbrek suyu geri emdikçe idrar yoğunlaşır.'],
      sites: [{ interior: 'tissue.nephron', stage: 'reabsorb', text: 'Su geri emilimi artmış.' }],
      causes: ['dehydration', 'high-muscle-mass'],
      next: ['urea', 'sodium'],
    },
    low: {
      summary: 'İdrar seyrek: çok su içme; oran testlerinin yorumunda dikkat gerekir.',
      mechanism: ['Fazla su alımında böbrek seyrek idrar yapar.'],
      sites: [{ interior: 'tissue.nephron', stage: 'aquaporin', text: 'ADH az, su kanalları kapalı: idrar seyrek.' }],
      causes: ['polydipsia', 'low-muscle-mass'],
      next: ['sodium'],
    },
  },
  {
    test: 'urine-microalbumin',
    normal: {
      summary: 'Sağlıklı böbrek süzgeci albumini neredeyse hiç geçirmez; idrarda küçük miktarda albumin süzgecin zorlandığının erken işaretidir.',
      path: [
        { interior: 'kidneys', stage: 'podocyte', text: 'Podositlerin ayakçıkları arasındaki süzme yarığı albumini tutar.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Süzüntüde albumin olmamalı.' },
      ],
    },
    high: {
      summary: 'Süzgeç albumin kaçırıyor: böbrek damarlarının ve süzgecin zorlandığının erken işareti (diyabet, tansiyon) ya da geçici bir durum.',
      mechanism: ['Yüksek şeker ve yüksek basınç glomerül zarını kalınlaştırır, podositleri hasarlar.', 'Albumin kaçağı tüm vücut damarlarının sağlığıyla da ilişkilidir (kalp-damar riski).', 'Ateş, yoğun egzersiz, idrar yolu enfeksiyonu ve regl geçici olarak artırır; 3 örnekten 2’si yüksekse kalıcı sayılır.'],
      sites: [
        { interior: 'kidneys', stage: 'podocyte', text: 'Süzme yarığından albumin sızıyor.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Süzüntüde albumin var.' },
        { interior: 'ic.arteriole', stage: 'wall', text: 'Küçük damar duvarları zorlanıyor olabilir.' },
      ],
      causes: ['diabetic-kidney', 'hypertensive-kidney', 'transient-proteinuria', 'ckd', 'glomerulonephritis', 'metabolic-syndrome', 'obesity'],
      next: ['hba1c', 'glucose', 'egfr', 'creatinine', 'urine-protein'],
      scene: { protein: 0.5 },
    },
    low: 'İdrarda albumin olmaması/düşük olması beklenen sağlıklı durumdur.',
  },
  {
    test: 'urine-protein',
    normal: {
      summary: 'İdrarda normalde çok az protein bulunur; süzgeç ve tübüller proteinleri tutar.',
      path: [
        { interior: 'kidneys', stage: 'podocyte', text: 'Süzgeç büyük proteinleri geçirmez.' },
        { interior: 'tissue.nephron', stage: 'pct-cell', text: 'Süzülen küçük proteinler proksimal tübülde geri alınır.' },
      ],
    },
    high: {
      summary: 'İdrara protein kaçıyor: süzgeç hasarı, tübül sorunu ya da geçici durumlar.',
      mechanism: ['Glomerül hasarında (diyabet, glomerülonefrit, nefrotik sendrom) albumin ve diğer proteinler kaçar; çok fazlaysa kanda albumin düşer, ödem olur.', 'Miyelomda hafif zincirler idrara taşar.', 'Ateş, egzersiz, ayakta kalma ve enfeksiyon geçici artış yapar.'],
      sites: [
        { interior: 'kidneys', stage: 'podocyte', text: 'Süzgeç protein geçiriyor.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Süzüntüde protein var.' },
        { interior: 'urinary-tract.bladder', stage: 'urine', text: 'İdrar köpüklü olabilir.' },
      ],
      symptoms: ['Köpüklü idrar', 'Göz kapaklarında, bacaklarda şişlik'],
      causes: ['transient-proteinuria', 'diabetic-kidney', 'hypertensive-kidney', 'glomerulonephritis', 'nephrotic', 'preeclampsia', 'myeloma', 'autoimmune-rheum', 'exercise'],
      next: ['urine-microalbumin', 'albumin', 'creatinine', 'egfr', 'cholesterol-total'],
      urgent: 'Gebelikte yeni ortaya çıkan protein kaçağı ve tansiyon yüksekliği acildir.',
      scene: { protein: 0.8 },
    },
    low: 'İdrarda proteinin düşük olması beklenen sağlıklı durumdur.',
  },
  {
    test: 'sodium',
    normal: {
      summary: 'Sodyum hücre dışı sıvının ana tuzudur; vücuttaki su dağılımını, kan hacmini ve sinir-kas uyarılabilirliğini belirler.',
      path: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Tuz bağırsaktan emilir.' },
        { interior: 'ic.hypothalamus', stage: 'sensing', text: 'Hipotalamus kanın yoğunluğunu algılar; susama ve ADH ile su dengesini ayarlar.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek süzülen sodyumun %99’unu geri emer; aldosteron ince ayarı yapar.' },
        { interior: 'nerves', stage: 'signal', text: 'Sinir hücresine sodyum girişi elektrik sinyalini başlatır.' },
      ],
    },
    high: {
      summary: 'Sodyum yüksek: vücutta tuza göre su az (çoğunlukla su kaybı ya da yetersiz su içme).',
      mechanism: ['Su kaybı (terleme, ishal, ateş) ya da susama mekanizmasının bozulduğu durumlar (yaşlılık, bilinç bozukluğu) kanı yoğunlaştırır.', 'ADH yetersizliğinde (diabetes insipidus) böbrek suyu tutamaz.', 'Kan yoğunlaşınca su hücrelerden dışarı çekilir; beyin hücreleri büzüşür.'],
      sites: [
        { interior: 'ic.hypothalamus', stage: 'sensing', text: 'Yoğun kan susama ve ADH sinyalini artırır.' },
        { interior: 'tissue.nephron', stage: 'aquaporin', text: 'Böbrek su kanallarıyla su tutmaya çalışır.' },
        { interior: 'brain', stage: 'blood', text: 'Beyin hücrelerinden su çekilir (ileri durumda bilinç değişikliği).' },
      ],
      symptoms: ['Susama', 'Halsizlik', 'Bilinç bulanıklığı (ileri düzeyde)'],
      causes: ['dehydration', 'cushing', 'hyperaldosteronism', 'diarrhea'],
      next: ['urea', 'glucose', 'hematocrit'],
      urgent: '155 mmol/L üstü ya da bilinç değişikliği varsa acildir.',
      scene: { fluid: 0, signal: 0.8 },
    },
    low: {
      summary: 'Sodyum düşük: vücutta tuza göre su fazla (sulanma) ya da tuz kaybı.',
      mechanism: ['ADH fazlası (ilaçlar, akciğer/beyin hastalıkları, ağrı, bulantı), kalp yetersizliği, siroz ve aşırı su içme suyu tutturur.', 'İdrar söktürücüler, kusma/ishal ve böbreküstü yetmezliği tuz kaybettirir.', 'Kan sulanınca su hücrelere girer; beyin hücreleri şişer (baş ağrısı, bulantı, denge bozukluğu, nöbet).'],
      sites: [
        { interior: 'pituitary', stage: 'secretion', text: 'ADH gereksiz salgılanıyor olabilir.' },
        { interior: 'tissue.nephron', stage: 'aquaporin', text: 'Su kanalları açık kalıyor, su tutuluyor.' },
        { interior: 'brain', stage: 'blood', text: 'Beyin hücreleri su alıp şişebilir.' },
        { interior: 'adrenals', stage: 'hormones', text: 'Aldosteron/kortizol azlığında tuz kaybı.' },
      ],
      symptoms: ['Baş ağrısı, bulantı', 'Halsizlik, kas krampı', 'Denge bozukluğu, düşmeler (yaşlılarda)', 'Bilinç bulanıklığı, nöbet (ağır düzeyde)'],
      causes: ['diuretics', 'siadh', 'polydipsia', 'liver-congestion', 'cirrhosis', 'vomiting', 'diarrhea', 'adrenal-insufficiency', 'hypothyroid', 'pituitary-insufficiency', 'dka', 'tuberculosis'],
      next: ['potassium', 'glucose', 'urea', 'cortisol', 'tsh', 'uric-acid'],
      urgent: '125 mmol/L altı, hızlı düşüş, bilinç değişikliği ya da nöbet varsa ACİLDİR.',
      scene: { fluid: 0.5, signal: 0.8 },
    },
  },
  {
    test: 'potassium',
    normal: {
      summary: 'Potasyum hücre içinin ana tuzudur; kalbin ve kasların elektriksel düzeni için dar bir aralıkta tutulması gerekir.',
      path: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Besinlerle (sebze, meyve, baklagil) alınır.' },
        { interior: 'skeletal-muscle', stage: 'contraction', text: 'Vücut potasyumunun çoğu kas hücrelerinin içindedir; insülin hücre içine çeker.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek, aldosteronun etkisiyle fazlasını idrara salgılar.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp hücresinin dinlenme gerilimini potasyum belirler.' },
      ],
    },
    high: {
      summary: 'Potasyum yüksek: kalbin elektriksel düzeni bozulabilir; önce örnek hatası dışlanmalıdır.',
      mechanism: ['Tüpte alyuvar parçalanması (hemoliz), sıkı yumruk ve uzun turnike yalancı yükseklik yapar — çok sıktır.', 'Böbrek atamazsa (böbrek yetmezliği, ACE inhibitörü/ARB, spironolakton) birikir.', 'Asidoz, insülin eksikliği ve hücre yıkımı (kas, tümör) potasyumu hücre dışına çıkarır.', 'Kalp hücresinin dinlenme gerilimi değişir; ritim bozukluğu riski doğar.'],
      sites: [
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp kası hücresinin uyarılabilirliği değişir (EKG’de sivri T).' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrekten salgılama azalmış olabilir.' },
        { interior: 'adrenals', stage: 'hormones', text: 'Aldosteron azlığında potasyum atılamaz.' },
        { interior: 'ic.vein', stage: 'cells', text: 'Örnek alınırken alyuvar parçalanması yalancı yükseklik yapabilir.' },
      ],
      symptoms: ['Çoğu zaman belirti yok', 'Kas güçsüzlüğü', 'Çarpıntı, ritim bozukluğu'],
      causes: ['sample-hemolysis', 'aki', 'ckd', 'hyperkalemia-drugs', 'adrenal-insufficiency', 'dka', 'rhabdomyolysis', 'hemolysis', 'urinary-obstruction'],
      next: ['creatinine', 'egfr', 'hco3', 'glucose', 'ck'],
      urgent: '6,0 mmol/L üstü (hemoliz yoksa) ya da çarpıntı/kas güçsüzlüğü varsa ACİL değerlendirme ve EKG gerekir.',
      scene: { signal: 1.4 },
    },
    low: {
      summary: 'Potasyum düşük: kas ve kalp hücrelerinin uyarılabilirliği bozulur (güçsüzlük, kramp, ritim bozukluğu).',
      mechanism: ['İdrar söktürücüler, kusma, ishal ve aldosteron fazlası potasyum kaybettirir.', 'İnsülin, astım ilaçları (salbutamol) ve alkaloz potasyumu hücre içine çeker.', 'Düşük magnezyum, böbrekten potasyum kaybını sürdürür.'],
      sites: [
        { interior: 'skeletal-muscle', stage: 'contraction', text: 'Kas hücreleri zor uyarılır (güçsüzlük, kramp).' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalpte ritim bozukluğu eğilimi.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrekten kayıp olabilir.' },
        { interior: 'large-intestine', stage: 'water', text: 'İshalde kalın bağırsaktan kayıp.' },
      ],
      symptoms: ['Kas güçsüzlüğü, kramp', 'Kabızlık', 'Çarpıntı'],
      causes: ['diuretics', 'vomiting', 'diarrhea', 'hyperaldosteronism', 'magnesium-loss', 'cushing', 'refeeding', 'rta'],
      next: ['magnesium', 'hco3', 'sodium', 'chloride'],
      urgent: '3,0 mmol/L altı ya da çarpıntı/güçsüzlük varsa hızlı değerlendirme gerekir.',
      scene: { signal: 0.6 },
    },
  },
  {
    test: 'chloride',
    normal: {
      summary: 'Klor, sodyumla birlikte hücre dışı sıvının ana negatif iyonudur; asit-baz dengesinde bikarbonatla yer değiştirir.',
      path: [
        { interior: 'stomach', stage: 'acid', text: 'Mide asidi (HCl) klor içerir.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek sodyumla birlikte geri emer.' },
      ],
    },
    high: {
      summary: 'Klor yüksek: bikarbonat kaybıyla giden asidoz (ishal, böbrek tübül sorunu), susuzluk ya da fazla serum fizyolojik.',
      mechanism: ['Bikarbonat kaybolunca elektriksel denge için klor artar.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Asit atımı/bikarbonat tutumu bozulmuş olabilir.' },
        { interior: 'large-intestine', stage: 'water', text: 'İshalde bikarbonat kaybı.' },
      ],
      causes: ['diarrhea', 'rta', 'dehydration'],
      next: ['hco3', 'sodium', 'ph'],
      scene: { acid: -0.4 },
    },
    low: {
      summary: 'Klor düşük: kusma (mide asidi kaybı), idrar söktürücü ya da sulanma; çoğunlukla alkaloz eşlik eder.',
      mechanism: ['Kusmada HCl kaybolur, kan alkaliye kayar.'],
      sites: [{ interior: 'stomach', stage: 'acid', text: 'Mide asidiyle klor kaybedilmiş olabilir.' }],
      causes: ['vomiting', 'diuretics', 'siadh', 'co2-retention'],
      next: ['hco3', 'potassium', 'sodium'],
      scene: { acid: 0.4 },
    },
  },
  {
    test: 'calcium',
    normal: {
      summary: 'Kalsiyum kemiğin yapı taşıdır; kanda dar aralıkta tutulur çünkü kas kasılması, sinir iletimi, kalp ritmi ve pıhtılaşma ona bağlıdır.',
      path: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Kalsiyum aktif D vitamini yardımıyla duodenum ve ince bağırsaktan emilir.' },
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'Paratiroidler kandaki kalsiyumu algılar; düşerse PTH salgılar.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'PTH kemikten kalsiyum çeker; kemik dev bir depo gibi çalışır.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'PTH böbrekte kalsiyumu tutar ve D vitaminini aktifleştirir.' },
      ],
    },
    high: {
      summary: 'Kalsiyum yüksek: kemikten fazla çekiliyor, bağırsaktan fazla emiliyor ya da böbrek atamıyor.',
      mechanism: ['Paratiroid fazlasında PTH kemikten kalsiyum çeker (fosfor düşük).', 'Kanser kemiği eritebilir ya da PTH benzeri hormon salgılayabilir.', 'Fazla D vitamini ve granülomatöz hastalıklar bağırsak emilimini artırır.', 'Yüksek kalsiyum sinir-kas uyarılabilirliğini azaltır, böbrekte taş ve su kaybı yapar.'],
      sites: [
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'PTH fazla salgılanıyor olabilir.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemikten kalsiyum çekiliyor.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrekte kalsiyum taşı ve sulandırma güçlüğü.' },
        { interior: 'nerves', stage: 'signal', text: 'Sinir-kas uyarılabilirliği azalır (halsizlik, kabızlık).' },
      ],
      symptoms: ['Susama, sık idrar', 'Kabızlık, bulantı', 'Halsizlik, depresif his', 'Böbrek taşı', 'Kemik ağrısı'],
      causes: ['hyperparathyroidism', 'hypercalcemia-malignancy', 'vitamin-d-excess', 'myeloma', 'granulomatous', 'dehydration', 'diuretics', 'hyperthyroid', 'adrenal-insufficiency'],
      next: ['calcium-ionized', 'phosphorus', 'albumin', 'vitamin-d', 'alp', 'creatinine'],
      urgent: '12 mg/dL üstü, bilinç bulanıklığı ya da kusma varsa acildir.',
      scene: { crystals: 0.4, signal: 0.7 },
    },
    low: {
      summary: 'Kalsiyum düşük: önce albumin düşüklüğüne bağlı yalancı düşüklük dışlanmalı; gerçekse sinir ve kaslar aşırı uyarılabilir hâle gelir.',
      mechanism: ['Albumin düşükse toplam kalsiyum düşük ölçülür ama etkin kalsiyum normal olabilir.', 'D vitamini eksikliğinde emilim azalır.', 'PTH azlığında (boyun ameliyatı sonrası) ve düşük magnezyumda kemikten kalsiyum çekilemez.', 'Böbrek hastalığı ve pankreatit de düşürür; düşük kalsiyum sinir hücrelerini kolay uyarılır yapar (karıncalanma, kramp).'],
      sites: [
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'PTH yetersiz olabilir.' },
        { interior: 'small-intestine', stage: 'absorption', text: 'D vitamini azlığında emilim azalır.' },
        { interior: 'nerves', stage: 'signal', text: 'Sinirler kolay ateşlenir: karıncalanma, kramp.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp kasında kasılma ve ritim etkilenebilir.' },
      ],
      symptoms: ['El, ayak ve ağız çevresinde karıncalanma', 'Kas krampları', 'Ağır durumda nöbet, ritim bozukluğu'],
      causes: ['albumin-calcium-artifact', 'vitamin-d-deficiency', 'hypoparathyroidism', 'magnesium-loss', 'ckd', 'acute-pancreatitis', 'malabsorption', 'rhabdomyolysis'],
      next: ['albumin', 'calcium-ionized', 'vitamin-d', 'magnesium', 'phosphorus', 'creatinine'],
      urgent: 'Düzeltilmiş kalsiyum 7,5 mg/dL altı, kas kasılmaları ya da nöbet varsa acildir.',
      scene: { signal: 1.3 },
    },
  },
  {
    test: 'calcium-ionized',
    normal: {
      summary: 'İyonize kalsiyum, albumine bağlı olmayan, biyolojik olarak etkin kalsiyumdur.',
      path: [
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'Paratiroidin algıladığı ve düzenlediği kalsiyum budur.' },
        { interior: 'nerves', stage: 'signal', text: 'Sinir ve kas uyarılabilirliğini doğrudan belirler.' },
      ],
    },
    high: {
      summary: 'Etkin kalsiyum gerçekten yüksek (albuminden bağımsız).',
      mechanism: ['Toplam kalsiyum yüksekliğiyle aynı nedenler; albumin değişikliklerinden etkilenmez.'],
      sites: [
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'PTH fazlası olabilir.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemikten çekilme artmış olabilir.' },
      ],
      causes: ['hyperparathyroidism', 'hypercalcemia-malignancy', 'vitamin-d-excess', 'granulomatous'],
      next: ['phosphorus', 'vitamin-d', 'alp'],
      scene: { signal: 0.7 },
    },
    low: {
      summary: 'Etkin kalsiyum gerçekten düşük; ya da hızlı nefes almayla (alkaloz) albumine daha çok bağlanmış.',
      mechanism: ['Alkalozda albumin daha çok kalsiyum bağlar; karıncalanma yapar.', 'PTH azlığı, D vitamini eksikliği, magnezyum düşüklüğü.'],
      sites: [
        { interior: 'nerves', stage: 'signal', text: 'Sinirler kolay uyarılır.' },
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'PTH yetersiz olabilir.' },
      ],
      causes: ['hyperventilation', 'hypoparathyroidism', 'vitamin-d-deficiency', 'magnesium-loss', 'sepsis'],
      next: ['magnesium', 'vitamin-d', 'ph'],
      scene: { signal: 1.3 },
    },
  },
  {
    test: 'magnesium',
    normal: {
      summary: 'Magnezyum 300’den fazla enzimin yardımcısıdır; ATP kullanımı, kas gevşemesi, kalp ritmi ve PTH salgısı için gereklidir.',
      path: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Yeşil sebze, kuruyemiş ve tam tahıllardan emilir.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek gerektiği kadarını tutar.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp hücresinde iyon kanallarının düzgün çalışmasına yardım eder.' },
      ],
    },
    high: {
      summary: 'Magnezyum yüksek: genellikle böbrek yetmezliğinde magnezyumlu ilaç/antiasit ya da laksatif kullanımıyla.',
      mechanism: ['Böbrek atamazsa birikir; sinir-kas iletimi yavaşlar.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Atılım azalmış olabilir.' },
        { interior: 'nerves', stage: 'signal', text: 'Refleksler azalabilir.' },
      ],
      causes: ['ckd', 'aki'],
      next: ['creatinine', 'egfr'],
      urgent: '4 mg/dL üstü, refleks kaybı ya da solunum yavaşlaması varsa acildir.',
      scene: { signal: 0.7 },
    },
    low: {
      summary: 'Magnezyum düşük: kas krampları, ritim bozukluğu; düşük potasyum ve kalsiyumun düzelmesini engeller.',
      mechanism: ['Alkol, ishal, mide koruyucu PPI’lar, idrar söktürücüler ve kontrolsüz şeker kaybı artırır.', 'Düşük magnezyum PTH salgısını azaltır ve böbrekten potasyum kaybını sürdürür.'],
      sites: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Emilim azalmış olabilir.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrekten kayıp olabilir.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Ritim bozukluğu eğilimi.' },
        { interior: 'ic.parathyroid', stage: 'sensing', text: 'PTH salgısı azalabilir.' },
      ],
      symptoms: ['Kas krampları, seğirme', 'Çarpıntı', 'Halsizlik'],
      causes: ['magnesium-loss', 'diuretics', 'diarrhea', 'alcohol', 'diabetes-t2', 'malabsorption', 'refeeding'],
      next: ['potassium', 'calcium'],
      scene: { signal: 1.25 },
    },
  },
  {
    test: 'phosphorus',
    normal: {
      summary: 'Fosfat kemik minerali ve ATP’nin (enerji) yapı taşıdır; böbrek ve PTH/FGF23 hormonlarıyla dengelenir.',
      path: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Besinlerden emilir.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kalsiyumla birlikte kemik mineralini (hidroksiapatit) oluşturur.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'PTH böbrekten fosfat atılımını artırır.' },
      ],
    },
    high: {
      summary: 'Fosfat yüksek: çoğunlukla böbrek atamıyor; PTH azlığı, hücre yıkımı ya da fazla D vitamini.',
      mechanism: ['Böbrek hastalığında fosfat birikir; kalsiyumla birleşip damarlarda çökebilir.', 'Kas/tümör yıkımında hücre içi fosfat kana çıkar.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Atılım azalmış olabilir.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemik-mineral dengesi bozulabilir.' },
        { interior: 'ic.artery', stage: 'wall', text: 'Uzun sürede damar duvarında kalsiyum-fosfat birikimi.' },
      ],
      causes: ['ckd', 'aki', 'hypoparathyroidism', 'rhabdomyolysis', 'vitamin-d-excess'],
      next: ['creatinine', 'calcium', 'vitamin-d'],
      scene: { crystals: 0.3 },
    },
    low: {
      summary: 'Fosfat düşük: yetersiz beslenme, yeniden beslenme, alkol, D vitamini eksikliği, paratiroid fazlası ya da hızlı nefes.',
      mechanism: ['İnsülin ve alkaloz fosfatı hücre içine çeker.', 'PTH fazlası böbrekten atar.', 'Ağır düşüklükte kaslar ve solunum kasları zayıflar (ATP yapılamaz).'],
      sites: [
        { interior: 'skeletal-muscle', stage: 'contraction', text: 'ATP üretimi için fosfat yetmez; güçsüzlük.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemik mineralleşmesi zayıflar.' },
      ],
      causes: ['hyperparathyroidism', 'vitamin-d-deficiency', 'refeeding', 'malnutrition', 'alcohol', 'hyperventilation', 'secondary-hyperparathyroidism'],
      next: ['calcium', 'vitamin-d', 'magnesium', 'potassium'],
    },
  },
];
