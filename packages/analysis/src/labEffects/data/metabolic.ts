import type { LabEffect } from '../types';

/** Yağlar, şeker, pankreas enzimleri ve kas enzimi. */
export const METABOLIC: LabEffect[] = [
  {
    test: 'cholesterol-total',
    normal: {
      summary: 'Kolesterol hücre zarının, safranın, D vitamininin ve steroid hormonların yapı taşıdır; çoğunu karaciğer üretir, lipoprotein paketleriyle (LDL, HDL) taşınır.',
      path: [
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer kolesterol üretir ve VLDL→LDL olarak kana verir.' },
        { interior: 'small-intestine', stage: 'absorption', text: 'Besinlerdeki ve safradaki kolesterolün bir kısmı geri emilir.' },
        { interior: 'ic.artery', stage: 'ldl', text: 'LDL dokulara kolesterol taşır; fazlası damar duvarında birikebilir.' },
        { interior: 'gallbladder', stage: 'bile', text: 'Karaciğer fazla kolesterolü safrayla atar.' },
      ],
    },
    high: {
      summary: 'Kanda taşınan kolesterol fazla: damar duvarında birikme riski artar (en çok LDL kısmı önemlidir).',
      mechanism: ['Karaciğerde LDL alıcıları azsa (kalıtsal ya da doymuş yağdan zengin beslenme) LDL kanda uzun kalır.', 'Hipotiroidi, nefrotik sendrom, kolestaz ve gebelik kolesterolü artırır.', 'Yüksek HDL de toplam kolesterolü yükseltebilir; bu yüzden alt kırılımlar önemlidir.'],
      sites: [
        { interior: 'ic.artery', stage: 'ldl', text: 'Damar duvarına giren LDL artar.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğerin üretim/temizleme dengesi değişmiş.' },
      ],
      causes: ['diet-lipids', 'familial-hypercholesterolemia', 'hypothyroid', 'nephrotic', 'cholangitis-autoimmune', 'pregnancy', 'menopause', 'metabolic-syndrome'],
      next: ['ldl', 'hdl', 'triglyceride', 'tsh', 'glucose'],
      scene: { plaque: 0.4, lipid: 0.2 },
    },
    low: {
      summary: 'Kolesterol düşük: kolesterol ilacı, hipertiroidi, yetersiz beslenme, emilim bozukluğu, ileri karaciğer hastalığı ya da kalıtsal.',
      mechanism: ['Üretim azalır (karaciğer hastalığı, yetersiz beslenme) ya da temizlenme artar (hipertiroidi, statin).'],
      sites: [{ interior: 'liver', stage: 'metabolism', text: 'Kolesterol üretimi az ya da temizliği hızlı.' }],
      causes: ['statin', 'hyperthyroid', 'malnutrition', 'malabsorption', 'cirrhosis', 'low-ldl-genetic'],
      next: ['tsh', 'albumin', 'alt'],
      scene: { lipid: 0 },
    },
  },
  {
    test: 'ldl',
    normal: {
      summary: 'LDL, kolesterolü karaciğerden dokulara taşıyan lipoprotein paketidir; fazlası damar duvarına sızar ("kötü kolesterol").',
      path: [
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer VLDL salgılar; kanda LDL’ye dönüşür ve LDL alıcılarıyla geri alınır.' },
        { interior: 'ic.artery', stage: 'endothelium', text: 'LDL endotelden damar duvarına girip çıkar.' },
        { interior: 'ic.artery', stage: 'ldl', text: 'Duvarda kalan LDL oksitlenirse makrofajlar onu yutar, köpük hücresi olur (plağın başlangıcı).' },
      ],
    },
    high: {
      summary: 'Damar duvarına giren LDL artmış: ateroskleroz (damar sertliği) riski yükselir.',
      mechanism: ['LDL endotel altına girip oksitlenir.', 'Makrofajlar yutup köpük hücresine dönüşür; yağlı çizgi → fibröz plak oluşur.', 'Plak damarı daraltır ya da yırtılıp pıhtı oluşturabilir (kalp krizi, inme).', 'Risk; LDL düzeyi ve maruz kalınan yıl sayısıyla birlikte artar.'],
      sites: [
        { interior: 'ic.artery', stage: 'ldl', text: 'Damar duvarında LDL birikimi ve plak oluşumu.' },
        { interior: 'vessel.aorta', stage: 'ldl', text: 'Aort duvarında yağlı çizgiler.' },
        { interior: 'heart', stage: 'aorta', text: 'Kalbi besleyen koroner arterler etkilenebilir.' },
        { interior: 'vessel.circle-of-willis', stage: 'ldl', text: 'Beyin arterlerinde plak, inme riski.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğerin LDL alıcıları yetersiz olabilir.' },
      ],
      symptoms: ['Genellikle belirti yoktur', 'Çok yüksek kalıtsal düzeylerde göz kapağında sarı birikintiler, tendon kalınlaşması'],
      causes: ['diet-lipids', 'familial-hypercholesterolemia', 'hypothyroid', 'nephrotic', 'metabolic-syndrome', 'cholangitis-autoimmune', 'menopause'],
      next: ['hdl', 'triglyceride', 'non-hdl', 'hs-crp', 'tsh', 'hba1c'],
      urgent: 'LDL 190 mg/dL üstündeyse ailesel kolesterol yüksekliği açısından değerlendirme önerilir; göğüs ağrısı varsa acil.',
      scene: { plaque: 0.7, lipid: 0.2 },
    },
    low: {
      summary: 'LDL düşük: çoğunlukla kolesterol ilacı etkisi ya da sağlıklı düşük düzey; nadiren hipertiroidi, emilim bozukluğu, karaciğer hastalığı.',
      mechanism: ['Statin karaciğerin kolesterol yapımını azaltır, LDL alıcılarını artırır.'],
      sites: [{ interior: 'ic.artery', stage: 'ldl', text: 'Damar duvarına giren LDL azdır.' }],
      causes: ['statin', 'hyperthyroid', 'malabsorption', 'cirrhosis', 'low-ldl-genetic'],
      next: ['tsh', 'albumin'],
      scene: { plaque: 0.05 },
    },
  },
  {
    test: 'hdl',
    normal: {
      summary: 'HDL, dokulardaki ve damar duvarındaki fazla kolesterolü toplayıp karaciğere geri taşır ("iyi kolesterol").',
      path: [
        { interior: 'ic.artery', stage: 'ldl', text: 'HDL damar duvarındaki makrofajlardan kolesterol alır.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer HDL’nin getirdiği kolesterolü safraya atar.' },
      ],
    },
    high: {
      summary: 'HDL yüksek: genellikle iyi (egzersiz, kalıtım, östrojen); çok yüksek düzeyler her zaman koruyucu değildir, alkol de artırır.',
      mechanism: ['Egzersiz ve bazı genetik varyantlar HDL’yi artırır.'],
      sites: [{ interior: 'ic.artery', stage: 'ldl', text: 'Damar duvarından kolesterol geri taşınımı.' }],
      causes: ['hdl-high', 'alcohol'],
      next: ['ldl', 'ggt'],
    },
    low: {
      summary: 'HDL düşük: damar duvarından kolesterol geri taşınımı azalmış; çoğunlukla insülin direnci, trigliserid yüksekliği, hareketsizlik ve sigarayla birlikte.',
      mechanism: ['Trigliserid yüksekken HDL parçacıkları hızla yıkılır.', 'Sigara ve hareketsizlik HDL’yi düşürür; anabolik steroidler belirgin azaltır.'],
      sites: [
        { interior: 'ic.artery', stage: 'ldl', text: 'Geri taşınım zayıf; plak riski artar.' },
        { interior: 'adipose', stage: 'storage', text: 'İnsülin direnci ve yağ dokusu sinyalleri HDL’yi düşürür.' },
      ],
      causes: ['metabolic-syndrome', 'obesity', 'smoking', 'diabetes-t2', 'masld', 'anabolic-steroid'],
      next: ['triglyceride', 'glucose', 'hba1c', 'insulin'],
      scene: { plaque: 0.4 },
    },
  },
  {
    test: 'triglyceride',
    normal: {
      summary: 'Trigliserid kandaki ana yağ yakıtıdır; bağırsaktan şilomikronla, karaciğerden VLDL ile taşınır, kas ve yağ dokusu kullanır/depolar.',
      path: [
        { interior: 'small-intestine', stage: 'absorption', text: 'Yemekteki yağ emilip şilomikron olarak lenfe verilir.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer fazla şeker ve alkolü trigliseride çevirip VLDL olarak salgılar.' },
        { interior: 'adipose', stage: 'storage', text: 'Yağ dokusu insülinin etkisiyle trigliseridi depolar.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Kılcal duvarındaki lipoprotein lipaz trigliseridi parçalar.' },
      ],
    },
    high: {
      summary: 'Kanda yağ yakıtı fazla: insülin direnci, fazla şeker/alkol, aç kalmadan alınan örnek ya da kalıtsal; çok yüksekse pankreatit riski.',
      mechanism: ['İnsülin direncinde karaciğer daha çok VLDL yapar, yağ dokusu daha çok yağ asidi salar.', 'Alkol ve fruktoz karaciğerde trigliserid yapımını artırır.', 'Hipotiroidi ve bazı ilaçlar temizlemeyi azaltır.', '500 mg/dL üstünde plazma süt gibi bulanıklaşır; 1000 üstünde pankreatit riski belirgindir.'],
      sites: [
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğerin VLDL üretimi artmış; karaciğer yağlanması eşlik edebilir.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Plazma yağ parçacıklarıyla bulanık.' },
        { interior: 'adipose', stage: 'storage', text: 'Yağ dokusu depolama/salınım dengesi bozulmuş.' },
        { interior: 'pancreas', stage: 'exocrine', text: 'Çok yüksek düzeyde pankreatit riski.' },
      ],
      causes: ['nonfasting', 'metabolic-syndrome', 'secondary-tg', 'alcohol', 'diabetes-t2', 'masld', 'obesity', 'hypothyroid', 'nephrotic', 'pregnancy'],
      next: ['glucose', 'hba1c', 'hdl', 'alt', 'ggt', 'tsh'],
      urgent: '1000 mg/dL üstü ya da şiddetli karın ağrısı varsa acil değerlendirme gerekir.',
      scene: { lipid: 0.8 },
    },
    low: {
      summary: 'Trigliserid düşük: genellikle önemsiz; yetersiz beslenme, hipertiroidi ya da emilim bozukluğunda görülebilir.',
      mechanism: ['Yağ alımı ve yapımı az ya da kullanımı hızlıdır.'],
      sites: [{ interior: 'small-intestine', stage: 'absorption', text: 'Yağ emilimi az olabilir.' }],
      causes: ['malnutrition', 'hyperthyroid', 'malabsorption', 'low-ldl-genetic'],
      next: ['albumin', 'tsh'],
      scene: { lipid: 0 },
    },
  },
  {
    test: 'non-hdl',
    normal: {
      summary: 'HDL dışı kolesterol = toplam kolesterol − HDL; damar duvarına girebilen tüm partikülleri (LDL, VLDL, kalıntılar) kapsar.',
      path: [{ interior: 'ic.artery', stage: 'ldl', text: 'Duvara giren tüm aterojenik partiküller.' }],
    },
    high: {
      summary: 'Damar duvarına girebilen kolesterollü partikül yükü fazla.',
      mechanism: ['LDL ve trigliseridden zengin kalıntı partiküller birlikte plak riskini artırır.'],
      sites: [{ interior: 'ic.artery', stage: 'ldl', text: 'Duvara giren partiküller artmış.' }],
      causes: ['diet-lipids', 'familial-hypercholesterolemia', 'metabolic-syndrome', 'hypothyroid'],
      next: ['ldl', 'triglyceride', 'hdl'],
      scene: { plaque: 0.6 },
    },
    low: 'HDL dışı kolesterolün düşük olması damar sağlığı açısından olumludur.',
  },
  {
    test: 'vldl',
    normal: {
      summary: 'VLDL karaciğerin trigliserid taşımak için yaptığı paketlerdir; yağ bıraktıkça LDL’ye dönüşür.',
      path: [{ interior: 'liver', stage: 'metabolism', text: 'Karaciğer VLDL salgılar.' }],
    },
    high: {
      summary: 'Karaciğer çok VLDL üretiyor (trigliserid yüksekliği ile aynı anlam).',
      mechanism: ['Fazla şeker, alkol ve insülin direnci VLDL yapımını artırır.'],
      sites: [{ interior: 'liver', stage: 'metabolism', text: 'VLDL yapımı artmış.' }],
      causes: ['metabolic-syndrome', 'secondary-tg', 'alcohol', 'nonfasting'],
      next: ['triglyceride', 'glucose'],
      scene: { lipid: 0.5 },
    },
    low: 'VLDL’nin düşük olması genellikle anlam taşımaz.',
  },
  {
    test: 'glucose',
    normal: {
      summary: 'Glukoz hücrelerin ana yakıtıdır; insülin (düşürür) ve glukagon (yükseltir) ile 70–99 mg/dL (açlık) aralığında tutulur.',
      path: [
        { interior: 'small-intestine.jejunum', stage: 'absorption', text: 'Karbonhidratlar glukoza parçalanıp emilir.' },
        { interior: 'pancreas.endocrine', stage: 'beta', text: 'Kan şekeri yükselince beta hücreleri insülin salgılar.' },
        { interior: 'skeletal-muscle', stage: 'glucose', text: 'İnsülinle kas ve yağ hücreleri glukoz alır (GLUT4).' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer fazlayı glikojen olarak depolar, açlıkta geri verir.' },
        { interior: 'brain', stage: 'blood', text: 'Beyin enerjisinin neredeyse tamamını glukozdan alır.' },
      ],
    },
    high: {
      summary: 'Kanda şeker fazla: insülin yetersiz ya da etkisiz (diyabet/prediyabet), stres, kortizon ya da aç kalmadan alınmış örnek.',
      mechanism: ['İnsülin direncinde kas ve karaciğer insüline geç yanıt verir; pankreas yorulur.', 'Fazla şeker proteinlere yapışır (glikasyon: HbA1c), küçük damarları (göz, böbrek, sinir) zamanla hasarlar.', '180 mg/dL üstünde böbrek şekeri tutamaz; idrarla şeker ve su kaybedilir (sık idrar, susama).', 'Stres, enfeksiyon ve kortizon karaciğerin şeker üretimini artırır.'],
      sites: [
        { interior: 'pancreas.endocrine', stage: 'beta', text: 'Beta hücreleri yeterli insülin salgılayamıyor ya da insülin etkisiz.' },
        { interior: 'skeletal-muscle', stage: 'glucose', text: 'Kas hücreleri glukozu içeri almakta zorlanıyor.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Kılcallarda fazla şeker; damar iç yüzeyi zamanla zarar görür.' },
        { interior: 'eyes.retina', stage: 'layers', text: 'Uzun sürede retina damarları etkilenebilir.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Yüksek şeker süzgeci zorlar; eşik aşılırsa idrara şeker geçer.' },
      ],
      symptoms: ['Çok su içme, sık idrara çıkma', 'Yorgunluk', 'Bulanık görme', 'Yaraların geç iyileşmesi', 'Kilo kaybı (insülin yetersizliğinde)'],
      causes: ['nonfasting', 'prediabetes', 'diabetes-t2', 'diabetes-t1', 'metabolic-syndrome', 'stress-steroid', 'cushing', 'acute-pancreatitis', 'chronic-pancreatitis', 'hyperthyroid', 'dka', 'hemochromatosis', 'pcos'],
      next: ['hba1c', 'insulin', 'triglyceride', 'urine-microalbumin'],
      urgent: '250 mg/dL üstüyle birlikte bulantı, kusma, hızlı nefes ya da bilinç bulanıklığı varsa ACİLDİR (ketoasidoz).',
      scene: { sugar: 0.75 },
    },
    low: {
      summary: 'Kan şekeri düşük: beyin yakıtsız kalabilir.',
      mechanism: ['Şeker ilaçları (insülin, sülfonilüre) en sık nedendir.', 'Uzun açlık, alkol, ağır karaciğer/böbrek hastalığı, böbreküstü yetmezliği ve nadiren insülin salgılayan tümör.', 'Tüpte bekleyen örnekte hücreler şekeri tüketir (yalancı düşüklük).'],
      sites: [
        { interior: 'brain', stage: 'blood', text: 'Beyne giden yakıt azalır: titreme, terleme, bilinç bulanıklığı.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğerin glikojen deposu ya da şeker üretimi yetersiz kalmış olabilir.' },
        { interior: 'pancreas.endocrine', stage: 'beta', text: 'İnsülin fazla salgılanıyor ya da dışarıdan fazla verilmiş olabilir.' },
      ],
      symptoms: ['Titreme, terleme, çarpıntı', 'Açlık hissi', 'Bilinç bulanıklığı, bayılma'],
      causes: ['hypoglycemia', 'adrenal-insufficiency', 'cirrhosis', 'alcohol', 'malnutrition', 'pituitary-insufficiency'],
      next: ['insulin', 'cortisol', 'alt', 'creatinine'],
      urgent: '54 mg/dL altı ya da bilinç değişikliği varsa ACİLDİR (bilinçliyse şekerli içecek).',
      scene: { sugar: 0.05 },
    },
  },
  {
    test: 'hba1c',
    normal: {
      summary: 'HbA1c, alyuvardaki hemoglobine yapışmış şekerin oranıdır; alyuvar ~120 gün yaşadığı için son 2–3 ayın ortalama kan şekerini gösterir.',
      path: [
        { interior: 'ic.capillary', stage: 'cells', text: 'Kandaki glukoz alyuvarın hemoglobinine yavaşça ve kalıcı yapışır.' },
        { interior: 'spleen', stage: 'filter', text: 'Alyuvar yaşlanıp yıkılana kadar bu iz kalır.' },
      ],
    },
    high: {
      summary: 'Son aylarda kan şekeri ortalaması yüksek: %5,7–6,4 prediyabet, %6,5 ve üstü diyabet aralığı (tanı hekimce doğrulanır).',
      mechanism: ['Ortalama şeker yükseldikçe daha çok hemoglobin şekerlenir.', 'Aynı şekerlenme damar duvarı ve sinir proteinlerinde de olur; mikrovasküler hasarın temelidir.', 'Demir eksikliği ve böbrek hastalığında yalancı yüksek, hemoliz ve kan kaybında yalancı düşük çıkabilir.'],
      sites: [
        { interior: 'ic.capillary', stage: 'cells', text: 'Alyuvarların daha büyük kısmı şekerlenmiş.' },
        { interior: 'eyes.retina', stage: 'layers', text: 'Retina kılcalları uzun sürede etkilenebilir.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Böbrek süzgeci zamanla zarar görebilir.' },
        { interior: 'nerves', stage: 'axon', text: 'Uzun sürede sinirler etkilenebilir (ayaklarda uyuşma).' },
      ],
      causes: ['prediabetes', 'diabetes-t2', 'diabetes-t1', 'metabolic-syndrome', 'iron-deficiency', 'ckd'],
      next: ['glucose', 'urine-microalbumin', 'triglyceride', 'creatinine'],
      scene: { sugar: 0.6 },
    },
    low: {
      summary: 'HbA1c düşük: genellikle iyi şeker kontrolü; alyuvar ömrü kısalmışsa (hemoliz, kanama, gebelik) yalancı düşük çıkar.',
      mechanism: ['Alyuvarlar kısa yaşarsa şekerlenmeye yeterli süre bulamaz.'],
      sites: [{ interior: 'spleen', stage: 'filter', text: 'Alyuvar yıkımı hızlıysa ölçüm yanıltıcı olabilir.' }],
      causes: ['hemolysis', 'blood-loss', 'pregnancy', 'hypoglycemia'],
      next: ['hemoglobin', 'glucose'],
      scene: { sugar: 0.1 },
    },
  },
  {
    test: 'insulin',
    normal: {
      summary: 'İnsülin pankreasın beta hücrelerinin hormonudur; hücrelerin şeker almasını ve enerjiyi depolamasını sağlar.',
      path: [
        { interior: 'pancreas.endocrine', stage: 'insulin', text: 'Beta hücreleri kan şekerine yanıt olarak insülin salar.' },
        { interior: 'liver', stage: 'metabolism', text: 'İnsülin karaciğerin şeker üretimini durdurur.' },
        { interior: 'skeletal-muscle', stage: 'glucose', text: 'Kas hücresine GLUT4 kapılarını açtırır.' },
        { interior: 'adipose', stage: 'storage', text: 'Yağ depolamayı artırır.' },
      ],
    },
    high: {
      summary: 'Açlık insülini yüksek: dokular insüline direnç gösteriyor, pankreas daha çok salgılayarak şekeri normalde tutmaya çalışıyor.',
      mechanism: ['İnsülin direnci → telafi edici yüksek insülin → karaciğerde yağ ve trigliserid yapımı artar.', 'Uzun sürede beta hücreleri yorulur ve şeker yükselir.', 'Nadiren insülin salgılayan tümör şekerle birlikte düşük kan şekeri yapar.'],
      sites: [
        { interior: 'pancreas.endocrine', stage: 'insulin', text: 'Beta hücreleri fazla çalışıyor.' },
        { interior: 'skeletal-muscle', stage: 'glucose', text: 'Kas hücreleri insüline geç yanıt veriyor.' },
        { interior: 'adipose', stage: 'storage', text: 'Yağ depolama yönünde sinyal artmış.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer yağlanması eşlik edebilir.' },
      ],
      causes: ['metabolic-syndrome', 'obesity', 'prediabetes', 'pcos', 'masld', 'diabetes-t2', 'hypoglycemia', 'cushing'],
      next: ['glucose', 'hba1c', 'triglyceride', 'hdl', 'alt'],
      scene: { sugar: 0.3 },
    },
    low: {
      summary: 'İnsülin düşük: aç örnekte normal olabilir; şeker yüksekken düşükse beta hücreleri yeterince üretmiyor (tip 1 diyabet, pankreas hasarı).',
      mechanism: ['Beta hücreleri azalır ya da çalışamaz; şeker hücreye giremez.'],
      sites: [{ interior: 'pancreas.endocrine', stage: 'beta', text: 'İnsülin üretimi az.' }],
      causes: ['diabetes-t1', 'chronic-pancreatitis', 'pituitary-insufficiency'],
      next: ['glucose', 'hba1c'],
    },
  },
  {
    test: 'amylase',
    normal: {
      summary: 'Amilaz nişastayı parçalayan enzimdir; tükürük bezleri ve pankreas üretir, fazlası böbrekle atılır.',
      path: [
        { interior: 'ic.mouth', stage: 'saliva', text: 'Tükürük amilazı ağızda sindirime başlar.' },
        { interior: 'pancreas', stage: 'enzymes', text: 'Pankreas amilazı ince bağırsağa salgılanır.' },
        { interior: 'small-intestine', stage: 'digestion', text: 'Nişasta bağırsakta şekerlere parçalanır.' },
      ],
    },
    high: {
      summary: 'Amilaz kana taşmış: pankreas iltihabı, tükürük bezi sorunu, böbrekten atılım azlığı ya da zararsız makroamilazemi.',
      mechanism: ['Pankreas hücresi hasarında enzim kana sızar (lipazla birlikte).', 'Tükürük bezi iltihabında yalnız amilaz artar.', 'Böbrek yetmezliğinde atılamaz.'],
      sites: [
        { interior: 'pancreas', stage: 'acinar', text: 'Asiner hücrelerden enzim sızıyor olabilir.' },
        { interior: 'ic.pancreatic-ducts', stage: 'flow', text: 'Kanal tıkanıklığı (taş) enzimleri geri iter.' },
        { interior: 'ic.mouth', stage: 'saliva', text: 'Tükürük bezi kaynaklı olabilir.' },
      ],
      causes: ['acute-pancreatitis', 'salivary', 'macroamylasemia', 'ckd', 'biliary-obstruction', 'alcohol'],
      next: ['lipase', 'creatinine', 'alt', 'triglyceride', 'calcium'],
      urgent: 'Şiddetli karın ağrısıyla birlikte lipaz/amilaz üst sınırın 3 katını aşarsa acildir.',
      scene: { leak: 0.5, inflam: 0.4 },
    },
    low: {
      summary: 'Amilaz düşük: kronik pankreas hasarında, kistik fibroziste ya da bazen obezitede görülebilir.',
      mechanism: ['Enzim üreten pankreas dokusu azalmış olabilir.'],
      sites: [{ interior: 'pancreas', stage: 'acinar', text: 'Asiner hücre kitlesi azalmış olabilir.' }],
      causes: ['chronic-pancreatitis', 'obesity'],
      next: ['lipase', 'glucose'],
    },
  },
  {
    test: 'lipase',
    normal: {
      summary: 'Lipaz yağları parçalayan pankreas enzimidir; pankreasa amilazdan daha özgüdür.',
      path: [
        { interior: 'pancreas', stage: 'enzymes', text: 'Asiner hücreler lipazı pankreas kanalına salgılar.' },
        { interior: 'small-intestine', stage: 'digestion', text: 'Safranın küçük damlalara ayırdığı yağları parçalar.' },
      ],
    },
    high: {
      summary: 'Pankreas enzimleri kana taşmış: üst sınırın 3 katından fazlası şiddetli karın ağrısıyla akut pankreatiti düşündürür.',
      mechanism: ['Taş, alkol, çok yüksek trigliserid ya da ilaçlar enzimlerin pankreas içinde etkinleşmesine yol açar; doku kendini sindirmeye başlar.', 'Hafif yüksekliği böbrek yetmezliği, bağırsak sorunları ve bazı ilaçlar da yapabilir.'],
      sites: [
        { interior: 'pancreas', stage: 'acinar', text: 'Asiner hücrelerde enzimler erken etkinleşmiş olabilir.' },
        { interior: 'ic.pancreatic-ducts', stage: 'flow', text: 'Kanal tıkanmış olabilir (safra taşı).' },
        { interior: 'gallbladder.bile-ducts', stage: 'flow', text: 'Ortak kanala düşen taş iki yolu birden tıkayabilir.' },
      ],
      symptoms: ['Göbek üstünde sırta vuran şiddetli ağrı', 'Bulantı, kusma', 'Ateş'],
      causes: ['acute-pancreatitis', 'gallstones', 'alcohol', 'biliary-obstruction', 'ckd'],
      next: ['amylase', 'triglyceride', 'calcium', 'alt', 'alp', 'wbc', 'crp'],
      urgent: 'Şiddetli karın ağrısıyla birlikte ACİLDİR.',
      scene: { leak: 0.6, inflam: 0.6 },
    },
    low: {
      summary: 'Lipaz düşük: pankreasın enzim üreten dokusu azalmış olabilir (kronik pankreatit, kistik fibrozis).',
      mechanism: ['Asiner hücreler bağ dokusuna dönüşmüş olabilir; yağlar sindirilemez (yağlı dışkı).'],
      sites: [
        { interior: 'pancreas', stage: 'acinar', text: 'Enzim üreten hücreler azalmış olabilir.' },
        { interior: 'small-intestine', stage: 'digestion', text: 'Yağ sindirimi yetersiz kalabilir.' },
      ],
      causes: ['chronic-pancreatitis'],
      next: ['glucose', 'vitamin-d', 'albumin'],
    },
  },
  {
    test: 'ck',
    normal: {
      summary: 'CK (kreatin kinaz) kas hücresinin hızlı enerji deposunu yöneten enzimdir; kas zarı hasarlanınca kana çıkar.',
      path: [
        { interior: 'skeletal-muscle', stage: 'contraction', text: 'Kas kasılırken CK, kreatin fosfattan ATP üretir.' },
        { interior: 'cell.skeletal-myocyte', stage: 'motor', text: 'Kas lifinin içinde bulunur.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp kasında da (CK-MB) bulunur.' },
      ],
    },
    high: {
      summary: 'Kas hücrelerinden CK sızıyor: egzersiz, travma, iğne, kas hastalığı, ilaç (statin), hipotiroidi; çok yüksekse kas yıkımı (rabdomiyoliz).',
      mechanism: ['Kas zarı hasarlanınca CK, miyoglobin ve potasyum kana geçer.', 'Ağır egzersizden 24–72 saat sonra en yüksek düzeye çıkar.', 'Çok yüksek CK’de miyoglobin böbrek tübüllerini tıkayabilir.'],
      sites: [
        { interior: 'skeletal-muscle', stage: 'fiber', text: 'Kas liflerinin zarından enzim sızıyor.' },
        { interior: 'cell.skeletal-myocyte', stage: 'sarcomere', text: 'Sarkomerler zorlanmış/hasarlanmış.' },
        { interior: 'tissue.nephron', stage: 'filtrate', text: 'Çok yüksek düzeyde miyoglobin böbreği zorlar.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp kası kaynaklı olabilir (göğüs ağrısı varsa).' },
      ],
      symptoms: ['Kas ağrısı, güçsüzlük', 'Koyu (çay renginde) idrar — rabdomiyolizde'],
      causes: ['exercise', 'muscle-injury', 'statin', 'hypothyroid', 'rhabdomyolysis', 'myocardial-injury', 'high-muscle-mass', 'cchf'],
      next: ['ast', 'ldh', 'creatinine', 'potassium', 'tsh'],
      urgent: 'Normalin 5–10 katı üstü, koyu idrar ya da göğüs ağrısı varsa acildir.',
      scene: { leak: 0.6 },
    },
    low: 'CK’nin düşük olması genellikle anlam taşımaz (az kas kütlesi, ileri yaş, kortizon).',
  },
];
