import type { LabEffect } from '../types';

/** Hormonlar: tiroid, hipofiz, böbreküstü, üreme, gebelik ve prostat. */
export const ENDOCRINE: LabEffect[] = [
  {
    test: 'tsh',
    normal: {
      summary: 'TSH hipofizin tiroidi uyaran hormonudur; tiroid hormonu azalınca artar, çoğalınca azalır (geri bildirim).',
      path: [
        { interior: 'ic.hypothalamus', stage: 'axis', text: 'Hipotalamus TRH ile hipofizi uyarır.' },
        { interior: 'pituitary', stage: 'secretion', text: 'Hipofiz TSH salgılar.' },
        { interior: 'thyroid', stage: 'hormone', text: 'TSH foliküllerde T4/T3 yapımını ve salınımını artırır.' },
        { interior: 'thyroid', stage: 'follicle', text: 'Folikül hücreleri iyotu tiroglobuline bağlayarak hormon yapar.' },
      ],
    },
    high: {
      summary: 'Hipofiz tiroidi "daha çok çalış" diye zorluyor: tiroid hormonu yetersiz (ya da yetersiz kalmak üzere).',
      mechanism: ['Tiroid (çoğunlukla Hashimoto’da bağışıklık saldırısıyla) yeterli T4 yapamaz.', 'Hipofiz bunu algılayıp TSH’yi artırır; T4 bir süre normal kalabilir (subklinik).', 'T4 düşünce metabolizma yavaşlar: hücrelerde ATP üretimi ve ısı azalır.', 'Hastalıktan iyileşme dönemi, iyot eksikliği/fazlası, bazı ilaçlar (lityum, amiodaron) ve laboratuvar farkları da yükseltebilir.'],
      sites: [
        { interior: 'pituitary', stage: 'secretion', text: 'TSH salgısı artmış.' },
        { interior: 'thyroid', stage: 'follicle', text: 'Foliküller yeterli hormon üretemiyor olabilir.' },
        { interior: 'thyroid', stage: 'hormone', text: 'Kana verilen T4/T3 azalmış olabilir.' },
        { interior: 'heart', stage: 'myocardium', text: 'Kalp hızı yavaşlayabilir.' },
      ],
      symptoms: ['Yorgunluk, uyku hâli', 'Üşüme', 'Kilo alma', 'Kabızlık', 'Kuru cilt, saç dökülmesi', 'Adet düzensizliği'],
      causes: ['hypothyroid', 'subclinical-hypothyroid', 'hashimoto', 'nonthyroidal-illness', 'secondary-tg'],
      next: ['ft4', 'anti-tpo', 'ft3', 'cholesterol-total', 'ck'],
      urgent: 'Gebelikte ya da gebelik planlanırken yüksek TSH hızlı değerlendirilmelidir.',
      scene: { signal: 0.8, flow: 0.85 },
    },
    low: {
      summary: 'Hipofiz TSH’yi baskılamış: kanda tiroid hormonu fazla (ya da dışarıdan alınıyor); gebeliğin ilk ayları ve biyotin de düşük gösterebilir.',
      mechanism: ['Tiroid fazla hormon yapınca (Graves, nodül, tiroidit) hipofiz susar.', 'Levotiroksin dozu fazla gelebilir.', 'Gebeliğin başında bHCG tiroidi uyarır.', 'Hipofiz hastalığında TSH düşükken T4 de düşüktür (santral).'],
      sites: [
        { interior: 'pituitary', stage: 'secretion', text: 'TSH salgısı baskılanmış.' },
        { interior: 'thyroid', stage: 'hormone', text: 'Fazla hormon kana veriliyor olabilir.' },
        { interior: 'heart', stage: 'myocardium', text: 'Kalp hızlanabilir, ritim bozulabilir (atriyal fibrilasyon riski).' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Uzun sürede kemik yıkımı hızlanabilir.' },
      ],
      symptoms: ['Çarpıntı', 'Kilo kaybı', 'Sıcağa dayanamama, terleme', 'Titreme, huzursuzluk', 'Uykusuzluk'],
      causes: ['hyperthyroid', 'subclinical-hyper', 'thyroiditis', 'pregnancy', 'biotin', 'central-hypothyroid', 'pituitary-insufficiency', 'nonthyroidal-illness', 'trophoblastic'],
      next: ['ft4', 'ft3'],
      scene: { signal: 1.25, flow: 1.2 },
    },
  },
  {
    test: 'ft4',
    normal: {
      summary: 'Serbest T4, tiroidin ana hormonunun kanda proteine bağlı olmayan (etkin) kısmıdır; dokularda T3’e çevrilir.',
      path: [
        { interior: 'thyroid', stage: 'hormone', text: 'Tiroid T4 salgılar.' },
        { interior: 'liver', stage: 'metabolism', text: 'Karaciğer ve diğer dokular T4’ü etkin T3’e çevirir.' },
      ],
    },
    high: {
      summary: 'Etkin tiroid hormonu fazla: metabolizma hızlanır.',
      mechanism: ['Graves, toksik nodül ya da tiroidit; ya da fazla ilaç.', 'Biyotin ve bazı ölçüm karışmaları yalancı yükseklik yapabilir.'],
      sites: [
        { interior: 'thyroid', stage: 'hormone', text: 'Fazla hormon salınıyor.' },
        { interior: 'heart', stage: 'myocardium', text: 'Kalp daha hızlı çalışır.' },
      ],
      causes: ['hyperthyroid', 'thyroiditis', 'subclinical-hyper', 'biotin', 'trophoblastic'],
      next: ['tsh', 'ft3'],
      scene: { signal: 1.25 },
    },
    low: {
      summary: 'Etkin tiroid hormonu az: metabolizma yavaşlar.',
      mechanism: ['Tiroid az üretiyor (TSH yüksek) ya da hipofiz yeterince uyarmıyor (TSH düşük/normal).'],
      sites: [
        { interior: 'thyroid', stage: 'follicle', text: 'Foliküller az hormon üretiyor olabilir.' },
        { interior: 'pituitary', stage: 'secretion', text: 'TSH yetersizse uyarı az.' },
      ],
      causes: ['hypothyroid', 'hashimoto', 'central-hypothyroid', 'pituitary-insufficiency', 'nonthyroidal-illness'],
      next: ['tsh', 'anti-tpo', 'cortisol'],
      scene: { signal: 0.8 },
    },
  },
  {
    test: 'ft3',
    normal: {
      summary: 'Serbest T3, hücre içinde genleri açıp kapatarak metabolizma hızını belirleyen etkin tiroid hormonudur.',
      path: [
        { interior: 'thyroid', stage: 'hormone', text: 'Tiroid bir miktar T3 salgılar; çoğu dokuda T4’ten oluşur.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp, kas ve beyin hücrelerinde metabolizmayı hızlandırır.' },
      ],
    },
    high: {
      summary: 'Etkin tiroid hormonu fazla; özellikle Graves ve toksik nodülde T3 öne çıkar.',
      mechanism: ['Aşırı uyarılmış tiroid T3 üretimini artırır.'],
      sites: [
        { interior: 'thyroid', stage: 'hormone', text: 'T3 üretimi artmış.' },
        { interior: 'heart', stage: 'cardiomyocyte', text: 'Kalp hücreleri hızlanır.' },
      ],
      causes: ['hyperthyroid', 'thyroiditis', 'biotin'],
      next: ['tsh', 'ft4'],
      scene: { signal: 1.3 },
    },
    low: {
      summary: 'T3 düşük: hipotiroidi ya da ağır hastalık/açlıkta T4’ün T3’e daha az çevrilmesi.',
      mechanism: ['Vücut hastalık ve açlıkta enerji tasarrufu için T3 yapımını azaltır.'],
      sites: [{ interior: 'liver', stage: 'metabolism', text: 'T4 → T3 dönüşümü azalmış olabilir.' }],
      causes: ['nonthyroidal-illness', 'hypothyroid', 'malnutrition', 'hypothalamic-amenorrhea'],
      next: ['tsh', 'ft4'],
      scene: { signal: 0.8 },
    },
  },
  {
    test: 'anti-tpo',
    normal: {
      summary: 'Anti-TPO, tiroid hormonu yapımında çalışan enzime (tiroid peroksidaz) karşı oluşmuş antikordur; normalde yok ya da çok düşüktür.',
      path: [{ interior: 'thyroid', stage: 'follicle', text: 'TPO folikül hücresinde iyotu tiroglobuline bağlar.' }],
    },
    high: {
      summary: 'Bağışıklık sistemi tiroide karşı etkin: Hashimoto tiroiditi (ya da Graves) yatkınlığı.',
      mechanism: ['Lenfositler tiroid dokusuna yerleşir; zamanla foliküller hasarlanır ve hormon yapımı azalabilir.', 'Anti-TPO pozitif olup TSH normal olanlarda yıllar içinde hipotiroidi gelişme olasılığı artar.'],
      sites: [
        { interior: 'thyroid', stage: 'follicle', text: 'Foliküller bağışıklık saldırısı altında.' },
        { interior: 'ic.lymph-node', stage: 'antibody', text: 'Antikor üreten B hücreleri etkin.' },
      ],
      causes: ['hashimoto', 'hyperthyroid', 'thyroiditis'],
      next: ['tsh', 'ft4'],
      scene: { inflam: 0.5 },
    },
    low: 'Anti-TPO’nun negatif/düşük olması beklenen durumdur.',
  },
  {
    test: 'cortisol',
    normal: {
      summary: 'Kortizol böbreküstü bezinin stres hormonudur; kan şekerini, tansiyonu, bağışıklığı ve uyku-uyanıklık ritmini düzenler. Sabah en yüksektir.',
      path: [
        { interior: 'ic.hypothalamus', stage: 'axis', text: 'Hipotalamus CRH salgılar (stres ve sabah ritmiyle).' },
        { interior: 'pituitary', stage: 'secretion', text: 'Hipofiz ACTH salgılar.' },
        { interior: 'adrenals', stage: 'hormones', text: 'Böbreküstü bezinin korteksi kortizol üretir.' },
        { interior: 'liver', stage: 'metabolism', text: 'Kortizol karaciğerde şeker üretimini artırır.' },
      ],
    },
    high: {
      summary: 'Kortizol yüksek: çoğunlukla stres, hastalık ya da örnek saati/doğum kontrol hapı etkisi; kalıcı ise Cushing sendromu araştırılır.',
      mechanism: ['Stres ve hastalıkta eksen etkinleşir.', 'Östrojen bağlayıcı proteini artırdığı için toplam kortizol yüksek ölçülür.', 'Cushing’de sürekli fazlalık şeker, tansiyon, kilo, kas erimesi ve kemik kaybı yapar.'],
      sites: [
        { interior: 'adrenals', stage: 'hormones', text: 'Kortizol üretimi artmış.' },
        { interior: 'pituitary', stage: 'secretion', text: 'ACTH fazlası kaynak olabilir.' },
        { interior: 'brain.limbic', stage: 'stress', text: 'Stres devresi etkin.' },
      ],
      causes: ['cortisol-timing', 'stress-steroid', 'estrogen-transferrin', 'cushing', 'pregnancy'],
      next: ['glucose', 'potassium', 'wbc'],
      scene: { sugar: 0.3 },
    },
    low: {
      summary: 'Kortizol düşük: akşam alınmış örnek, kortizon ilacının baskılaması ya da böbreküstü/hipofiz yetmezliği.',
      mechanism: ['Addison’da bez kortizol yapamaz; ACTH artar.', 'Uzun kortizon kullanımında eksen baskılanır; ilaç aniden kesilirse tehlikelidir.', 'Kortizol yetmezse stres anında tansiyon ve şeker düşebilir.'],
      sites: [
        { interior: 'adrenals', stage: 'hormones', text: 'Kortizol üretimi yetersiz olabilir.' },
        { interior: 'pituitary', stage: 'secretion', text: 'ACTH yetersizse uyarı az.' },
      ],
      symptoms: ['Halsizlik, kilo kaybı', 'Tuz isteği', 'Baş dönmesi, tansiyon düşüklüğü', 'Bulantı, karın ağrısı'],
      causes: ['cortisol-timing', 'steroid-suppression', 'adrenal-insufficiency', 'pituitary-insufficiency'],
      next: ['sodium', 'potassium', 'glucose'],
      urgent: 'Kusma, tansiyon düşüklüğü ve bilinç bulanıklığı varsa (adrenal kriz) ACİLDİR.',
    },
  },
  {
    test: 'prolactin',
    normal: {
      summary: 'Prolaktin hipofizin süt üretimini başlatan hormonudur; dopamin onu sürekli frenler.',
      path: [
        { interior: 'ic.hypothalamus', stage: 'axis', text: 'Hipotalamus dopaminle prolaktini baskılar.' },
        { interior: 'pituitary', stage: 'secretion', text: 'Hipofiz prolaktin salgılar.' },
        { interior: 'ic.breast', stage: 'milk', text: 'Meme bezinde süt yapımını uyarır.' },
      ],
    },
    high: {
      summary: 'Prolaktin yüksek: stres, ilaçlar, emzirme, hipotiroidi, makroprolaktin ya da hipofizde prolaktinoma.',
      mechanism: ['Dopamin frenini azaltan ilaçlar ve hipofiz sapına bası prolaktini artırır.', 'Prolaktin GnRH’yi baskılar: adet düzensizliği, kısırlık, cinsel istek azlığı, süt gelmesi.'],
      sites: [
        { interior: 'pituitary', stage: 'secretion', text: 'Prolaktin salgısı artmış.' },
        { interior: 'ic.breast', stage: 'milk', text: 'Süt gelmesi olabilir.' },
        { interior: 'ic.gonads', stage: 'axis', text: 'Üreme ekseni baskılanır.' },
      ],
      causes: ['prolactin-drugs', 'pregnancy', 'hypothyroid', 'prolactinoma', 'ckd', 'pcos'],
      next: ['tsh', 'bhcg', 'lh', 'fsh', 'creatinine'],
      scene: { signal: 1.1 },
    },
    low: {
      summary: 'Prolaktin düşük: genellikle önemsiz; dopamin etkili ilaçlar ya da nadiren hipofiz yetmezliği.',
      mechanism: ['Hipofiz hasarında birden çok hormonla birlikte düşer.'],
      sites: [{ interior: 'pituitary', stage: 'secretion', text: 'Salgı az.' }],
      causes: ['pituitary-insufficiency'],
      next: ['cortisol', 'ft4'],
    },
  },
  {
    test: 'testosterone',
    normal: {
      summary: 'Testosteron erkekte testisin, kadında yumurtalık ve böbreküstünün ürettiği erkeklik hormonudur; kas, kemik, kan yapımı ve cinsel işlevde rol alır.',
      path: [
        { interior: 'pituitary', stage: 'secretion', text: 'Hipofiz LH salgılar.' },
        { interior: 'testes', stage: 'spermatogenesis', text: 'LH, testisteki Leydig hücrelerinde testosteron yapımını uyarır.' },
        { interior: 'ic.gonads', stage: 'hormone-cells', text: 'Kadında yumurtalığın teka hücreleri az miktarda üretir.' },
      ],
    },
    high: {
      summary: 'Testosteron yüksek: kadında PKOS ya da böbreküstü kaynaklı fazlalık; erkekte dışarıdan hormon kullanımı.',
      mechanism: ['PKOS’ta LH ve insülin teka hücrelerini uyarır.', 'Dışarıdan hormon alındığında hipofiz LH/FSH’yi keser, testisler küçülür.'],
      sites: [
        { interior: 'ovaries', stage: 'follicles', text: 'Kadında foliküller olgunlaşamayıp kistleşebilir.' },
        { interior: 'adrenals', stage: 'hormones', text: 'Böbreküstü kaynaklı olabilir.' },
        { interior: 'ic.bone-marrow', stage: 'erythropoiesis', text: 'Alyuvar yapımını artırır.' },
      ],
      symptoms: ['Kadında: sivilce, tüylenme, adet düzensizliği, saç dökülmesi'],
      causes: ['pcos', 'adrenal-androgen', 'anabolic-steroid'],
      next: ['lh', 'fsh', 'dhea-s', 'insulin', 'prolactin'],
    },
    low: {
      summary: 'Testosteron düşük (erkekte): testis ya da hipofiz/hipotalamus kaynaklı; obezite, şeker, uykusuzluk ve opioidler sık nedendir. Sabah alınmayan örnek yanıltabilir.',
      mechanism: ['Testis kaynaklıysa LH/FSH yüksek, hipofiz kaynaklıysa düşük/normal.', 'Yağ dokusu testosteronu östrojene çevirir.'],
      sites: [
        { interior: 'testes', stage: 'spermatogenesis', text: 'Testosteron yapımı az.' },
        { interior: 'pituitary', stage: 'secretion', text: 'LH uyarısı yetersiz olabilir.' },
        { interior: 'adipose', stage: 'storage', text: 'Fazla yağ dokusu dönüşümü artırır.' },
      ],
      symptoms: ['Cinsel istek azlığı', 'Yorgunluk', 'Kas kaybı', 'Kemik incelmesi'],
      causes: ['secondary-hypogonadism', 'primary-hypogonadism', 'obesity', 'prolactinoma', 'pituitary-insufficiency', 'estrogen-excess-male', 'diabetes-t2'],
      next: ['lh', 'fsh', 'prolactin', 'glucose'],
    },
  },
  {
    test: 'estradiol',
    normal: {
      summary: 'Östradiol yumurtalığın ana östrojenidir; döngü boyunca değişir, rahim iç zarını kalınlaştırır, kemiği korur.',
      path: [
        { interior: 'pituitary', stage: 'secretion', text: 'FSH folikülleri büyütür.' },
        { interior: 'ovaries', stage: 'granulosa', text: 'Granüloza hücreleri östradiol üretir.' },
        { interior: 'tissue.endometrium', stage: 'cycle', text: 'Östradiol rahim iç zarını kalınlaştırır.' },
      ],
    },
    high: {
      summary: 'Östradiol yüksek: yumurtlama öncesi dönem, gebelik ya da hormon tedavisi; erkekte fazla kilo ve karaciğer hastalığı.',
      mechanism: ['Döngü ortasında baskın folikül çok östradiol üretir.', 'Erkekte yağ dokusu testosteronu östradiole çevirir.'],
      sites: [
        { interior: 'ovaries', stage: 'follicle', text: 'Büyüyen folikül östradiol üretiyor.' },
        { interior: 'tissue.endometrium', stage: 'cycle', text: 'Rahim iç zarı kalınlaşıyor.' },
      ],
      causes: ['cycle-phase', 'pregnancy', 'estrogen-excess-male', 'obesity'],
      next: ['lh', 'fsh', 'progesterone', 'bhcg'],
    },
    low: {
      summary: 'Östradiol düşük: döngünün başı, menopoz, yumurtalık rezervi azalması, aşırı egzersiz/düşük kilo ya da hipofiz sorunu.',
      mechanism: ['Folikül kalmadıysa FSH yüksek; hipotalamus/hipofiz frenliyse FSH/LH düşük.', 'Uzun süre düşük östrojen kemik kaybını hızlandırır.'],
      sites: [
        { interior: 'ovaries', stage: 'follicles', text: 'Folikül etkinliği az.' },
        { interior: 'ic.bone', stage: 'remodeling', text: 'Kemik yıkımı artabilir.' },
      ],
      causes: ['menopause', 'hypothalamic-amenorrhea', 'prolactinoma', 'pituitary-insufficiency'],
      next: ['fsh', 'lh', 'prolactin'],
    },
  },
  {
    test: 'progesterone',
    normal: {
      summary: 'Progesteron yumurtlamadan sonra sarı cisimden salgılanır; rahmi gebeliğe hazırlar. Gebelikte plasenta üretir.',
      path: [
        { interior: 'ovaries', stage: 'follicle', text: 'Yumurtlama sonrası folikül sarı cisme dönüşür.' },
        { interior: 'tissue.endometrium', stage: 'gland', text: 'Rahim iç zarının bezleri salgı evresine geçer.' },
      ],
    },
    high: {
      summary: 'Progesteron yüksek: luteal evre ya da gebelik (beklenen); nadiren böbreküstü kaynaklı.',
      mechanism: ['Sarı cisim ve plasenta progesteron üretir.'],
      sites: [
        { interior: 'ovaries', stage: 'follicle', text: 'Sarı cisim etkin.' },
        { interior: 'uterus', stage: 'cycle', text: 'Rahim gebeliğe hazırlanıyor.' },
      ],
      causes: ['cycle-phase', 'pregnancy', 'adrenal-androgen'],
      next: ['bhcg', 'estradiol'],
    },
    low: {
      summary: 'Progesteron düşük: döngünün ilk yarısı, yumurtlama olmaması (PKOS), menopoz; erken gebelikte düşük olması değerlendirme gerektirebilir.',
      mechanism: ['Yumurtlama olmazsa sarı cisim oluşmaz.'],
      sites: [{ interior: 'ovaries', stage: 'follicle', text: 'Yumurtlama/sarı cisim olmayabilir.' }],
      causes: ['cycle-phase', 'pcos', 'menopause', 'early-pregnancy-problem', 'hypothalamic-amenorrhea'],
      next: ['bhcg', 'lh', 'fsh'],
    },
  },
  {
    test: 'fsh',
    normal: {
      summary: 'FSH hipofizin foliküllerin (kadın) ve sperm yapımının (erkek) büyümesini uyaran hormonudur.',
      path: [
        { interior: 'pituitary', stage: 'secretion', text: 'Hipofiz GnRH uyarısıyla FSH salgılar.' },
        { interior: 'ovaries', stage: 'follicles', text: 'Kadında folikülleri büyütür.' },
        { interior: 'testes', stage: 'spermatogenesis', text: 'Erkekte Sertoli hücreleri üzerinden sperm yapımını destekler.' },
      ],
    },
    high: {
      summary: 'FSH yüksek: hipofiz yanıt vermeyen bir bezi zorluyor — menopoz/yumurtalık rezervinin azalması ya da testis yetmezliği.',
      mechanism: ['Folikül ya da testis hormonu (inhibin, östradiol, testosteron) azalınca fren kalkar, FSH artar.'],
      sites: [
        { interior: 'pituitary', stage: 'secretion', text: 'FSH salgısı artmış.' },
        { interior: 'ovaries', stage: 'follicles', text: 'Folikül havuzu azalmış olabilir.' },
        { interior: 'testes', stage: 'spermatogenesis', text: 'Sperm yapımı azalmış olabilir.' },
      ],
      causes: ['menopause', 'primary-hypogonadism'],
      next: ['lh', 'estradiol', 'testosterone'],
    },
    low: {
      summary: 'FSH düşük: hipofiz/hipotalamus frenlenmiş — gebelik, doğum kontrol hapı, dışarıdan hormon, yüksek prolaktin, aşırı egzersiz/düşük kilo.',
      mechanism: ['Yüksek hormon düzeyleri ya da beyin düzeyindeki baskılanma FSH’yi azaltır.'],
      sites: [{ interior: 'pituitary', stage: 'secretion', text: 'FSH salgısı baskılanmış.' }],
      causes: ['pregnancy', 'anabolic-steroid', 'prolactinoma', 'hypothalamic-amenorrhea', 'secondary-hypogonadism', 'pituitary-insufficiency'],
      next: ['lh', 'prolactin', 'bhcg'],
    },
  },
  {
    test: 'lh',
    normal: {
      summary: 'LH hipofizin yumurtlamayı tetikleyen (kadın) ve testosteron yapımını uyaran (erkek) hormonudur.',
      path: [
        { interior: 'pituitary', stage: 'secretion', text: 'Hipofiz LH salgılar; döngü ortasında kısa bir tepe yapar.' },
        { interior: 'ovaries', stage: 'follicle', text: 'LH tepesi olgun folikülü çatlatır (yumurtlama).' },
        { interior: 'testes', stage: 'spermatogenesis', text: 'Leydig hücrelerinde testosteron yapımını uyarır.' },
      ],
    },
    high: {
      summary: 'LH yüksek: yumurtlama dönemi, menopoz, PKOS (LH/FSH oranı artar) ya da testis yetmezliği.',
      mechanism: ['Hedef bez yanıt vermeyince ya da döngü ortasında LH artar.'],
      sites: [
        { interior: 'pituitary', stage: 'secretion', text: 'LH salgısı artmış.' },
        { interior: 'ovaries', stage: 'follicles', text: 'PKOS’ta foliküller olgunlaşamıyor olabilir.' },
      ],
      causes: ['cycle-phase', 'menopause', 'pcos', 'primary-hypogonadism'],
      next: ['fsh', 'estradiol', 'testosterone'],
    },
    low: {
      summary: 'LH düşük: hipofiz frenlenmiş — dışarıdan hormon, gebelik, prolaktin yüksekliği, stres/düşük kilo, hipofiz hastalığı.',
      mechanism: ['GnRH uyarısı azalınca LH azalır.'],
      sites: [{ interior: 'pituitary', stage: 'secretion', text: 'LH salgısı baskılanmış.' }],
      causes: ['anabolic-steroid', 'secondary-hypogonadism', 'hypothalamic-amenorrhea', 'prolactinoma', 'pituitary-insufficiency', 'pregnancy'],
      next: ['fsh', 'prolactin', 'testosterone', 'estradiol'],
    },
  },
  {
    test: 'dhea-s',
    normal: {
      summary: 'DHEA-S böbreküstü bezinin ürettiği zayıf bir androjendir; ergenlikten sonra artar, yaşla azalır.',
      path: [{ interior: 'adrenals', stage: 'layers', text: 'Böbreküstü korteksinin iç katmanında (retiküler bölge) üretilir.' }],
    },
    high: {
      summary: 'Böbreküstü kaynaklı androjen artmış: PKOS, konjenital adrenal hiperplazi ya da nadiren tümör.',
      mechanism: ['Böbreküstü bezi fazla androjen yapar; kadında tüylenme ve sivilce olabilir.'],
      sites: [{ interior: 'adrenals', stage: 'hormones', text: 'Androjen yapımı artmış.' }],
      causes: ['pcos', 'adrenal-androgen'],
      next: ['testosterone', 'cortisol'],
    },
    low: {
      summary: 'DHEA-S düşük: yaşlanma, kortizon kullanımı ya da böbreküstü/hipofiz yetmezliği.',
      mechanism: ['ACTH uyarısı azalınca ya da bez hasarlanınca düşer.'],
      sites: [{ interior: 'adrenals', stage: 'hormones', text: 'Böbreküstü korteksi az üretiyor.' }],
      causes: ['steroid-suppression', 'adrenal-insufficiency', 'pituitary-insufficiency'],
      next: ['cortisol'],
    },
  },
  {
    test: 'bhcg',
    normal: {
      summary: 'bHCG gebelikte plasentanın ürettiği hormondur; gebelik yoksa kanda bulunmaz ya da çok düşüktür.',
      path: [
        { interior: 'uterus', stage: 'cycle', text: 'Döllenen yumurta rahme yerleşince plasenta bHCG yapmaya başlar.' },
        { interior: 'ovaries', stage: 'follicle', text: 'bHCG sarı cismi korur; progesteron yapımı sürer.' },
      ],
    },
    high: {
      summary: 'bHCG pozitif/yüksek: en sık nedeni gebeliktir; artış hızı ve ultrason gebeliğin yerini ve gidişini gösterir.',
      mechanism: ['Normal gebelikte ilk haftalarda yaklaşık her 2 günde belirgin artar.', 'Yavaş artış dış gebelik ya da düşük tehdidini; çok yüksek değer çoğul gebelik ya da mol gebeliği düşündürebilir.', 'Erkekte ve gebelik dışı yüksekliğinde bazı tümörler araştırılır.'],
      sites: [
        { interior: 'uterus', stage: 'cycle', text: 'Plasenta dokusu bHCG üretiyor.' },
        { interior: 'fallopian-tubes', stage: 'transport', text: 'Dış gebelik en sık tüpte olur.' },
        { interior: 'thyroid', stage: 'hormone', text: 'Çok yüksek bHCG tiroidi uyarabilir.' },
      ],
      causes: ['pregnancy', 'early-pregnancy-problem', 'trophoblastic'],
      next: ['progesterone', 'tsh', 'hemoglobin'],
      urgent: 'bHCG pozitifken karın ağrısı, omuz ağrısı, kanama ya da bayılma varsa ACİLDİR (dış gebelik).',
    },
    low: 'Gebelik yoksa bHCG’nin düşük/negatif olması beklenen durumdur.',
  },
  {
    test: 'psa',
    normal: {
      summary: 'PSA prostat bezinin ürettiği, semeni sıvılaştıran bir proteindir; az miktarı kana geçer.',
      path: [
        { interior: 'prostate', stage: 'secretion', text: 'Prostat bez hücreleri PSA’yı bez boşluğuna salgılar.' },
        { interior: 'prostate', stage: 'luminal', text: 'Sağlam bez yapısı PSA’nın kana geçişini sınırlar.' },
      ],
    },
    high: {
      summary: 'Prostattan kana daha çok PSA geçiyor: büyüme, iltihap, mekanik uyarı ya da kanser — PSA tek başına kanser göstermez.',
      mechanism: ['Prostat büyüdükçe daha çok PSA üretir.', 'İltihap ve kanser bez yapısını bozarak kana geçişi artırır.', 'Boşalma, bisiklet, sonda ve muayene geçici yükseltir.'],
      sites: [
        { interior: 'prostate', stage: 'zones', text: 'Geçiş bölgesi büyümesi (iyi huylu) ya da periferik bölge değişiklikleri.' },
        { interior: 'prostate', stage: 'luminal', text: 'Bez yapısının bütünlüğü bozulmuş olabilir.' },
        { interior: 'urinary-tract.bladder', stage: 'voiding', text: 'Büyüyen prostat idrar akışını zorlaştırabilir.' },
      ],
      causes: ['bph', 'prostatitis', 'psa-manipulation', 'prostate-cancer', 'urinary-obstruction'],
      next: ['creatinine'],
      urgent: 'İdrar yapamama ya da ateşle birlikte idrar yanması varsa acildir.',
    },
    low: {
      summary: 'PSA düşük: genellikle normal; prostat küçültücü ilaçlar PSA’yı yarıya indirir, prostatı alınmış kişide beklenen durumdur.',
      mechanism: ['5-alfa redüktaz inhibitörleri prostat dokusunu küçültür.'],
      sites: [{ interior: 'prostate', stage: 'secretion', text: 'PSA üretimi az.' }],
      causes: ['five-ari'],
      next: [],
    },
  },
];
