import type { LabEffect } from '../types';

/** Kan gazı ve ko-oksimetri. Örnek türü (arter/ven) yorumda belirleyicidir. */
export const BLOODGAS: LabEffect[] = [
  {
    test: 'ph',
    normal: {
      summary: 'Kan pH’ı 7,35–7,45 arasında tutulur; akciğer CO₂ atarak, böbrek asit atıp bikarbonat tutarak dengeler.',
      path: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Akciğer CO₂’yi (asit kaynağı) dakikalar içinde atar.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek günler içinde asit atar, bikarbonatı geri kazanır.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Dokuların ürettiği asit kanın tampon sistemleriyle nötralize edilir.' },
      ],
    },
    high: {
      summary: 'Kan alkaliye kaymış (alkaloz): ya CO₂ fazla atılıyor (hızlı nefes) ya da asit kaybı/bikarbonat fazlası var (kusma, idrar söktürücü).',
      mechanism: ['Solunumsal: hızlı nefes CO₂’yi düşürür.', 'Metabolik: mide asidi kaybı ya da aldosteron fazlası bikarbonatı artırır.', 'Alkalozda iyonize kalsiyum ve potasyum düşer: karıncalanma, kramp.'],
      sites: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'CO₂ fazla atılıyor olabilir.' },
        { interior: 'stomach', stage: 'acid', text: 'Kusmada asit kaybı.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek bikarbonat tutuyor olabilir.' },
      ],
      causes: ['hyperventilation', 'vomiting', 'diuretics', 'hyperaldosteronism'],
      next: ['pco2', 'hco3', 'potassium', 'chloride'],
      urgent: 'pH 7,55 üstünde acildir.',
      scene: { acid: 0.6 },
    },
    low: {
      summary: 'Kan asite kaymış (asidoz): ya CO₂ atılamıyor ya da metabolik asit birikiyor/bikarbonat kaybediliyor.',
      mechanism: ['Solunumsal: akciğer CO₂’yi atamaz (KOAH alevlenmesi, solunum depresyonu).', 'Metabolik: laktat (oksijensizlik, sepsis), ketonlar (diyabet), böbrek yetmezliği, ishal ya da zehirlenme.', 'Vücut hızlı-derin nefesle (metabolik asidozda) ya da böbrekle telafi etmeye çalışır.', 'Asidoz kalp kasılmasını zayıflatır, potasyumu hücre dışına çıkarır.'],
      sites: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'CO₂ atılımı yetersiz olabilir.' },
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Asit atımı yetersiz olabilir.' },
        { interior: 'skeletal-muscle', stage: 'glucose', text: 'Oksijensiz enerji üretiminde laktat birikir.' },
        { interior: 'heart', stage: 'myocardium', text: 'Asidoz kalp kasının gücünü azaltır.' },
      ],
      causes: ['lactic-acidosis', 'dka', 'sepsis', 'co2-retention', 'aki', 'ckd', 'diarrhea', 'rta'],
      next: ['pco2', 'hco3', 'lactate', 'glucose', 'creatinine', 'potassium'],
      urgent: 'pH 7,25 altında acildir.',
      scene: { acid: -0.7 },
    },
  },
  {
    test: 'pco2',
    normal: {
      summary: 'pCO₂ kandaki karbondioksit basıncıdır; solunumun yeterliliğini gösterir.',
      path: [
        { interior: 'ic.capillary', stage: 'exchange', text: 'Dokular CO₂ üretir, kan toplar.' },
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Alveolde CO₂ havaya verilir.' },
        { interior: 'brain.medulla', stage: 'work', text: 'Beyin sapı CO₂’yi algılayıp solunum hızını ayarlar.' },
      ],
    },
    high: {
      summary: 'CO₂ birikiyor: solunum yetersiz (ya da toplardamar örneği).',
      mechanism: ['KOAH, uyku apnesi, ağır astım, kas zayıflığı ya da solunumu baskılayan ilaçlar CO₂ atılımını azaltır.', 'Toplardamar örneğinde pCO₂ doğal olarak biraz yüksektir.'],
      sites: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'CO₂ atılımı azalmış.' },
        { interior: 'airways.bronchioles', stage: 'muscle', text: 'Daralan hava yolları hava akışını kısıtlar.' },
        { interior: 'diaphragm', stage: 'contraction', text: 'Solunum kası yorgunluğu.' },
      ],
      causes: ['co2-retention', 'venous-sample', 'vomiting'],
      next: ['ph', 'hco3', 'po2'],
      urgent: 'pH düşükken yüksek pCO₂ ve uykuya meyil acildir.',
      scene: { acid: -0.4, oxygen: 0.85 },
    },
    low: {
      summary: 'CO₂ fazla atılıyor: hızlı nefes (panik, ağrı, ateş, akciğer sorunu) ya da metabolik asidoza solunum yanıtı.',
      mechanism: ['Metabolik asidozda vücut asidi dengelemek için derin-hızlı solur (Kussmaul).', 'Akciğer embolisi/zatürre başında oksijen düşükken hızlı nefes CO₂’yi düşürür.'],
      sites: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'CO₂ hızlı atılıyor.' },
        { interior: 'brain.medulla', stage: 'work', text: 'Solunum merkezi uyarılmış.' },
      ],
      causes: ['hyperventilation', 'hypoxemia', 'dka', 'lactic-acidosis', 'sepsis', 'pregnancy'],
      next: ['ph', 'hco3', 'po2'],
      scene: { acid: 0.4 },
    },
  },
  {
    test: 'po2',
    normal: {
      summary: 'pO₂ kanda çözünmüş oksijen basıncıdır; atardamar kanında akciğerin oksijen aktarımını gösterir.',
      path: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Oksijen alveolden kılcala geçer.' },
        { interior: 'ic.pulmonary-vessels', stage: 'exchange', text: 'Akciğer damarlarında kan oksijenlenir.' },
        { interior: 'ic.artery', stage: 'flow', text: 'Oksijenli kan atardamarlarla dokulara gider.' },
      ],
    },
    high: {
      summary: 'Oksijen basıncı yüksek: genellikle ek oksijen tedavisi sırasında.',
      mechanism: ['Oksijen solutulduğunda pO₂ yükselir.'],
      sites: [{ interior: 'tissue.alveolus', stage: 'exchange', text: 'Alveoldeki oksijen artmış.' }],
      causes: ['hyperventilation'],
      next: ['so2'],
      scene: { oxygen: 1.2 },
    },
    low: {
      summary: 'Kandaki oksijen düşük — ama örnek toplardamardan alındıysa bu NORMALDİR.',
      mechanism: ['Toplardamar kanı dokulara oksijenini bırakmış kandır; pO₂ 30–50 mmHg beklenir.', 'Atardamar örneğinde düşüklük: zatürre, astım, KOAH, akciğer embolisi, kalp yetersizliği alveolden kana oksijen geçişini bozar.'],
      sites: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Oksijen geçişi azalmış olabilir.' },
        { interior: 'ic.pulmonary-vessels', stage: 'flow', text: 'Akciğer damar akışı bozulmuş olabilir (emboli).' },
        { interior: 'ic.vein', stage: 'flow', text: 'Toplardamar kanı doğal olarak oksijeni düşük kandır.' },
      ],
      causes: ['venous-sample', 'hypoxemia', 'co2-retention', 'liver-congestion'],
      next: ['so2', 'pco2', 'ph', 'lactate'],
      urgent: 'Atardamar örneğinde pO₂ 60 mmHg altı (satürasyon < %90), nefes darlığı ya da morarma varsa acildir.',
      scene: { oxygen: 0.6 },
    },
  },
  {
    test: 'hco3',
    normal: {
      summary: 'Bikarbonat kanın ana tamponudur; böbrek tarafından düzenlenir.',
      path: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek süzülen bikarbonatı geri emer ve yenisini üretir.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Dokuların ürettiği asidi tamponlar.' },
      ],
    },
    high: {
      summary: 'Bikarbonat fazla: metabolik alkaloz (kusma, idrar söktürücü, aldosteron fazlası) ya da kronik CO₂ tutulumuna böbreğin yanıtı.',
      mechanism: ['Asit kaybedilince ya da böbrek bikarbonat tutunca artar.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek bikarbonat tutuyor.' },
        { interior: 'stomach', stage: 'acid', text: 'Kusmada asit kaybı.' },
      ],
      causes: ['vomiting', 'diuretics', 'hyperaldosteronism', 'co2-retention'],
      next: ['ph', 'pco2', 'potassium', 'chloride'],
      scene: { acid: 0.4 },
    },
    low: {
      summary: 'Bikarbonat azalmış: metabolik asidoz (laktat, keton, böbrek yetmezliği, ishal) ya da hızlı nefese böbrek yanıtı.',
      mechanism: ['Biriken asit bikarbonatı tüketir ya da ishalde/böbrekte bikarbonat kaybolur.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek bikarbonatı tutamıyor ya da asidi atamıyor olabilir.' },
        { interior: 'large-intestine', stage: 'water', text: 'İshalde bikarbonat kaybı.' },
      ],
      causes: ['lactic-acidosis', 'dka', 'aki', 'ckd', 'diarrhea', 'rta', 'sepsis', 'hyperventilation'],
      next: ['ph', 'lactate', 'glucose', 'creatinine', 'chloride'],
      scene: { acid: -0.5 },
    },
  },
  {
    test: 'base-excess',
    normal: {
      summary: 'Baz fazlası, kanın metabolik (solunum dışı) asit-baz durumunu tek sayıyla özetler (normal −2 ile +2).',
      path: [{ interior: 'tissue.nephron', stage: 'reabsorb', text: 'Böbrek baz rezervini düzenler.' }],
    },
    high: {
      summary: 'Baz fazlası artmış: metabolik alkaloz.',
      mechanism: ['Asit kaybı ya da bikarbonat birikimi.'],
      sites: [{ interior: 'tissue.nephron', stage: 'reabsorb', text: 'Bikarbonat tutulumu.' }],
      causes: ['vomiting', 'diuretics', 'hyperaldosteronism', 'co2-retention'],
      next: ['hco3', 'ph'],
      scene: { acid: 0.4 },
    },
    low: {
      summary: 'Baz açığı: metabolik asidoz — asit birikiyor ya da baz kaybediliyor.',
      mechanism: ['Laktat, keton, böbrek yetmezliği ya da ishal.'],
      sites: [
        { interior: 'tissue.nephron', stage: 'reabsorb', text: 'Asit atımı yetersiz olabilir.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Dokular asit üretiyor olabilir.' },
      ],
      causes: ['lactic-acidosis', 'dka', 'sepsis', 'aki', 'diarrhea'],
      next: ['lactate', 'hco3', 'glucose'],
      scene: { acid: -0.5 },
    },
  },
  {
    test: 'so2',
    normal: {
      summary: 'Oksijen satürasyonu, hemoglobinin yüzde kaçının oksijen taşıdığıdır (atardamarda %95–100).',
      path: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Hemoglobin alveol kılcalında oksijenle doyar.' },
        { interior: 'ic.capillary', stage: 'exchange', text: 'Dokularda oksijen bırakılır; toplardamarda satürasyon ~%70’e iner.' },
      ],
    },
    high: 'Oksijen satürasyonunun yüksek olması (≤%100) beklenen durumdur.',
    low: {
      summary: 'Hemoglobinin oksijen yükü az — toplardamar örneğinde normaldir; atardamarda oksijen aktarımı sorunu.',
      mechanism: ['Akciğer hastalıkları, emboli, kalp yetersizliği; methemoglobin ya da karbonmonoksit hemoglobini meşgul edebilir.'],
      sites: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Oksijen yüklemesi azalmış olabilir.' },
        { interior: 'ic.vein', stage: 'flow', text: 'Toplardamar kanında satürasyon doğal olarak düşüktür.' },
      ],
      causes: ['venous-sample', 'hypoxemia', 'co2-retention', 'methemoglobinemia', 'co-poisoning'],
      next: ['po2', 'cohb', 'methb', 'hemoglobin'],
      urgent: 'Atardamar satürasyonu %90 altıysa acildir.',
      scene: { oxygen: 0.6 },
    },
  },
  {
    test: 'o2hb',
    normal: {
      summary: 'Oksihemoglobin, oksijen bağlamış hemoglobinin toplam hemoglobine oranıdır (ko-oksimetri).',
      path: [{ interior: 'tissue.alveolus', stage: 'exchange', text: 'Hemoglobin alveolde oksijen bağlar.' }],
    },
    high: 'Oksihemoglobin oranının yüksek olması beklenen durumdur.',
    low: {
      summary: 'Oksijen taşıyan hemoglobin oranı az: düşük oksijen, toplardamar örneği ya da COHb/MetHb’nin hemoglobini meşgul etmesi.',
      mechanism: ['Karbonmonoksit ve methemoglobin, oksijenin bağlanacağı yeri kapatır.'],
      sites: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Oksijen bağlanması azalmış.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'Alyuvarlar daha az oksijen taşıyor.' },
      ],
      causes: ['venous-sample', 'hypoxemia', 'co-poisoning', 'smoking', 'methemoglobinemia'],
      next: ['so2', 'cohb', 'methb', 'po2'],
      scene: { oxygen: 0.65 },
    },
  },
  {
    test: 'cohb',
    normal: {
      summary: 'Karboksihemoglobin, karbonmonoksit bağlamış hemoglobindir; sigara içmeyenlerde %1–2’nin altındadır.',
      path: [
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Solunan CO, hemoglobine oksijenden ~200 kat güçlü bağlanır.' },
        { interior: 'ic.capillary', stage: 'cells', text: 'CO bağlı hemoglobin dokuya oksijen veremez.' },
      ],
    },
    high: {
      summary: 'Hemoglobinin bir kısmı karbonmonoksitle meşgul: sigara/nargile ya da zehirlenme (soba, şofben, yangın).',
      mechanism: ['CO bağlı hemoglobin oksijen taşıyamaz, kalan hemoglobin de oksijeni dokuya zor bırakır.', 'Beyin ve kalp oksijensizliğe en duyarlı organlardır.', 'pO₂ normal görünebilir; bu yanıltıcıdır.'],
      sites: [
        { interior: 'ic.capillary', stage: 'cells', text: 'Alyuvarlar parlak kırmızı ama oksijen taşıyamıyor.' },
        { interior: 'brain', stage: 'blood', text: 'Beyin oksijensizliği: baş ağrısı, baş dönmesi.' },
        { interior: 'heart', stage: 'myocardium', text: 'Kalp kası oksijensizliği.' },
      ],
      symptoms: ['Baş ağrısı, baş dönmesi, bulantı', 'Aynı ortamdaki birkaç kişide benzer şikâyet', 'Bilinç bulanıklığı'],
      causes: ['smoking', 'co-poisoning'],
      next: ['lactate', 'hemoglobin'],
      urgent: 'Sigara içmeyende %3–5 üstü, içende %10 üstü ya da baş ağrısı/bulantı/bilinç değişikliği varsa ACİLDİR; ortam havalandırılmalı.',
      scene: { oxygen: 0.65 },
    },
    low: 'COHb’nin düşük olması beklenen sağlıklı durumdur.',
  },
  {
    test: 'methb',
    normal: {
      summary: 'Methemoglobin, demiri oksitlenmiş ve oksijen taşıyamayan hemoglobindir; alyuvar enzimleri onu sürekli geri çevirir (<%1,5).',
      path: [{ interior: 'ic.capillary', stage: 'cells', text: 'Alyuvar içindeki redüktaz enzimi methemoglobini normal hemoglobine döndürür.' }],
    },
    high: {
      summary: 'Oksijen taşıyamayan hemoglobin artmış: bazı ilaç ve kimyasallar (lokal anestezik sprey, dapson, nitrit) ya da kalıtsal enzim eksikliği.',
      mechanism: ['Oksitlenmiş demir oksijen bağlayamaz; kalan hemoglobin de oksijeni zor bırakır.', 'Deri ve dudaklar morarır; kan çikolata renginde görünür.'],
      sites: [
        { interior: 'ic.capillary', stage: 'cells', text: 'Alyuvarların bir kısmı oksijen taşıyamıyor.' },
        { interior: 'tissue.alveolus', stage: 'exchange', text: 'Akciğer normal çalışsa da oksijen bağlanamaz.' },
      ],
      causes: ['methemoglobinemia', 'g6pd'],
      next: ['so2', 'hemoglobin'],
      urgent: '%15 üstü ya da morarma/nefes darlığı varsa ACİLDİR.',
      scene: { oxygen: 0.6 },
    },
    low: 'Methemoglobinin düşük olması beklenen sağlıklı durumdur.',
  },
  {
    test: 'lactate',
    normal: {
      summary: 'Laktat, hücreler oksijensiz enerji ürettiğinde oluşur; karaciğer onu geri şekere çevirir.',
      path: [
        { interior: 'skeletal-muscle', stage: 'glucose', text: 'Yoğun egzersizde kas laktat üretir.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer laktatı Cori döngüsüyle glukoza çevirir.' },
      ],
    },
    high: {
      summary: 'Laktat birikiyor: dokular yeterli oksijen alamıyor (şok, sepsis, ağır kansızlık, CO zehirlenmesi) ya da karaciğer temizleyemiyor; yoğun egzersiz ve nöbet sonrası geçici olabilir.',
      mechanism: ['Oksijen yetmezse hücre glukozu laktata kadar yıkar (az ATP).', 'Laktat birikince kan asitleşir.', 'Metformin, alkol ve karaciğer yetmezliği temizlenmeyi azaltır.'],
      sites: [
        { interior: 'ic.capillary', stage: 'exchange', text: 'Dokulara oksijen sunumu yetersiz olabilir.' },
        { interior: 'skeletal-muscle', stage: 'glucose', text: 'Kas oksijensiz enerji üretiyor.' },
        { interior: 'liver', stage: 'metabolism', text: 'Laktat temizliği yetersiz olabilir.' },
      ],
      causes: ['lactic-acidosis', 'sepsis', 'exercise', 'co-poisoning', 'ischemic-hepatitis', 'hypoxemia', 'dka'],
      next: ['ph', 'hco3', 'po2', 'hemoglobin'],
      urgent: '2 mmol/L üstü hastalık tablosu, 4 mmol/L üstü her durumda acildir.',
      scene: { acid: -0.5, oxygen: 0.75 },
    },
    low: 'Laktatın düşük olması beklenen sağlıklı durumdur.',
  },
];
