/**
 * Vücut sistemleri, anatomik yapılar ve biyolojik süreçler.
 *
 * Laboratuvar sonucu doğrudan tek bir organa bağlanmaz:
 *   Test → Biyolojik süreç(ler) → Yapı(lar) → Sistem(ler)
 * 3D model düğümleri `modelMatch` desenleriyle yapılara bağlanır (HRA erkek referans modelleri,
 * CC BY 4.0). `schematic` yapılar gerçek veri değil, konumu temsil eden şematik şekillerdir.
 */

export type SystemId =
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'endocrine'
  | 'nervous'
  | 'musculoskeletal'
  | 'immune'
  | 'hematologic'
  | 'integumentary'
  | 'reproductive';

export interface BodySystem {
  id: SystemId;
  nameTr: string;
  color: string;
}

export const SYSTEMS: readonly BodySystem[] = [
  { id: 'cardiovascular', nameTr: 'Kalp ve damarlar', color: '#e5606b' },
  { id: 'respiratory', nameTr: 'Solunum', color: '#4fd6e8' },
  { id: 'digestive', nameTr: 'Sindirim', color: '#e0a15a' },
  { id: 'urinary', nameTr: 'Boşaltım', color: '#a78bfa' },
  { id: 'endocrine', nameTr: 'Endokrin (hormonlar)', color: '#e879c9' },
  { id: 'nervous', nameTr: 'Sinir sistemi', color: '#5b8cff' },
  { id: 'musculoskeletal', nameTr: 'Kemik ve kas', color: '#d9d4c7' },
  { id: 'immune', nameTr: 'Bağışıklık', color: '#6fd3a8' },
  { id: 'hematologic', nameTr: 'Kan ve kemik iliği', color: '#ff7a7a' },
  { id: 'integumentary', nameTr: 'Deri', color: '#c9a58f' },
  { id: 'reproductive', nameTr: 'Üreme', color: '#f59ec0' },
];

export type ModelAsset =
  | 'body'
  | 'skeleton'
  | 'muscles'
  | 'cardio'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'nervous'
  | 'immune'
  | 'endocrine'
  | 'reproductive'
  | 'schematic';

export interface Structure {
  id: string;
  nameTr: string;
  /** Latince (Terminologia Anatomica) adı. */
  latin?: string;
  systems: SystemId[];
  /** Hangi 3D dosyasında; null: modelde yok (arayüz bunu açıkça söyler). */
  asset: ModelAsset | null;
  /** HRA düğüm adlarında aranacak parçalar (küçük harf). */
  modelMatch: string[];
  /** Yalnızca bir cinsiyetin vücudunda bulunan yapı. */
  sex?: 'male' | 'female';
  /** Temsili (şematik) şekil mi? */
  schematic?: boolean;
  /** Modelde gerçek karşılığı olmayan, yaklaşık yolu çizilmiş yapı (ör. kol/bacak damarları). */
  approximate?: boolean;
  /** Bu yapıya "içeri girildiğinde" açılacak alt seviye sahne. */
  drill?: 'vessel' | 'nephron' | 'hepatocyte' | 'alveolus' | 'bone-marrow' | 'beta-cell' | 'thyroid-follicle';
  /** Yapının kendi biyolojik süreçleri (testlerden bağımsız). */
  processes?: ProcessId[];
  blurb: string;
}

export const STRUCTURES: readonly Structure[] = [
  { id: 'heart', nameTr: 'Kalp', latin: 'Cor', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['cardiac_atrium', 'ventricle', 'interventricular_septum', '_valve', 'papillary_muscle'], processes: ['heart-contraction'], blurb: 'Kanı vücuda ve akciğerlere pompalayan kas organ.' },
  { id: 'coronary-arteries', nameTr: 'Koroner arterler', latin: 'Arteriae coronariae', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['coronary_artery', 'anterior_descending', 'right_marginal_artery', 'marginal_branch', 'posterior_descending', 'diagonal_branch'], drill: 'vessel', processes: ['circulation'], blurb: 'Kalp kasını besleyen damarlar; ateroskleroz en sık burada önem kazanır.' },
  { id: 'aorta', nameTr: 'Aort', latin: 'Aorta', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['aorta', 'aortic_arch'], drill: 'vessel', processes: ['circulation'], blurb: 'Kalpten çıkan ana atardamar.' },
  { id: 'carotid-arteries', nameTr: 'Şah damarları (karotis)', latin: 'Arteriae carotides', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['carotid', 'brachiocephalic_artery', 'subclavian_artery'], drill: 'vessel', processes: ['circulation'], blurb: 'Beyne kan taşıyan boyun atardamarları.' },
  { id: 'pulmonary-vessels', nameTr: 'Akciğer damarları', latin: 'Vasa pulmonalia', systems: ['cardiovascular', 'respiratory'], asset: 'cardio', modelMatch: ['pulmonary_artery', 'pulmonary_trunk', 'pulmonary_vein'], processes: ['circulation', 'oxygen-transport'], blurb: 'Kanı akciğerlere taşıyıp oksijenlenmiş olarak geri getiren damarlar.' },
  { id: 'veins', nameTr: 'Ana toplardamarlar', latin: 'Venae cavae et venae magnae', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['vena_cava', 'brachiocephalic_vein', 'iliac_vein', 'cardiac_vein', 'coronary_sinus', 'vein_of_', 'oblique_vein'], processes: ['circulation'], blurb: 'Kanı kalbe geri taşıyan büyük toplardamarlar.' },
  { id: 'renal-vessels', nameTr: 'Böbrek damarları', latin: 'Arteriae et venae renales', systems: ['cardiovascular', 'urinary'], asset: 'cardio', modelMatch: ['renal_artery', 'renal_vein'], processes: ['circulation'], blurb: 'Böbreklere kan getiren ve götüren damarlar.' },
  { id: 'abdominal-vessels', nameTr: 'Karın damarları', latin: 'Truncus coeliacus, aa. mesentericae, v. portae hepatis', systems: ['cardiovascular', 'digestive'], asset: 'cardio', modelMatch: ['mesenteric', 'colic', 'sigmoid', 'rectal', 'celiac', 'hepatic_artery', 'hepatic_vein', 'splenic', 'cystic', 'pancreaticoduodenal', 'sacral', 'pudendal', 'iliac_artery', 'drummond', 'uterine', 'ovarian', 'testicular', 'gonadal'], processes: ['circulation'], blurb: 'Sindirim ve pelvis organlarını besleyen damar ağı.' },
  { id: 'eye-vessels', nameTr: 'Göz damarları', latin: 'Vasa oculi (a. ophthalmica, a. centralis retinae)', systems: ['cardiovascular', 'nervous'], asset: 'cardio', modelMatch: ['ophthalmic', 'opthalmic', 'retinal', 'ciliary'], processes: ['circulation'], blurb: 'Retina ve gözü besleyen çok ince damarlar.' },
  { id: 'lungs', nameTr: 'Akciğerler', latin: 'Pulmones', systems: ['respiratory'], asset: 'respiratory', modelMatch: ['bronchopulmonary_seg', 'hilum'], drill: 'alveolus', processes: ['gas-exchange'], blurb: 'Kana oksijen geçen, karbondioksitin atıldığı organ.' },
  { id: 'airways', nameTr: 'Gırtlak, nefes borusu ve bronşlar', latin: 'Larynx, trachea, bronchi', systems: ['respiratory'], asset: 'respiratory', modelMatch: ['trachea', 'bronch', 'cartilage', 'carina', 'epiglot', 'posterior_basal'], processes: ['gas-exchange'], blurb: 'Havayı akciğerlere ileten yollar; gırtlakta ses telleri bulunur.' },
  { id: 'diaphragm', nameTr: 'Diyafram', latin: 'Diaphragma', systems: ['respiratory', 'musculoskeletal'], asset: 'respiratory', modelMatch: [], processes: ['gas-exchange', 'muscle-contraction'], blurb: 'Göğüs ve karın boşluğunu ayıran kubbe biçimli ana solunum kası; kasılınca akciğerlere hava dolar.' },
  { id: 'liver', nameTr: 'Karaciğer', latin: 'Hepar', systems: ['digestive'], asset: 'digestive', modelMatch: ['liver', 'hepat', 'caudate', 'quadrate', 'segment', 'porta_hepatis', 'ligament', 'bare_area', 'impression', 'diaphragmatic'], drill: 'hepatocyte', blurb: 'Protein, kolesterol ve pıhtılaşma faktörü üreten; ilaç ve atıkları işleyen organ.' },
  { id: 'gallbladder', nameTr: 'Safra kesesi ve safra yolları', latin: 'Vesica biliaris, ductus biliferi', systems: ['digestive'], asset: 'digestive', modelMatch: ['gallbladder'], processes: ['bile-metabolism', 'digestion'], blurb: 'Karaciğerin ürettiği safrayı depolar ve bağırsağa iletir.' },
  { id: 'pancreas', nameTr: 'Pankreas', latin: 'Pancreas', systems: ['digestive', 'endocrine'], asset: 'digestive', modelMatch: ['pancrea'], drill: 'beta-cell', processes: ['digestion'], blurb: 'Sindirim enzimleri ve kan şekerini düzenleyen insülini üretir.' },
  { id: 'stomach', nameTr: 'Mide', latin: 'Gaster (ventriculus)', systems: ['digestive'], asset: 'digestive', modelMatch: [], processes: ['digestion', 'b12-folate'], blurb: 'Besinleri asit ve enzimlerle sindirmeye başlayan organ; B12 emilimi için gereken iç faktörü üretir.' },
  { id: 'esophagus', nameTr: 'Yemek borusu', latin: 'Oesophagus', systems: ['digestive'], asset: 'digestive', modelMatch: [], processes: ['digestion'], blurb: 'Yutulan besinleri boğazdan mideye taşıyan kaslı boru.' },
  { id: 'small-intestine', nameTr: 'İnce bağırsak', latin: 'Intestinum tenue', systems: ['digestive'], asset: 'digestive', modelMatch: ['small_intestine', 'duodenum', 'jejunum', 'ileum', 'duodenal'], processes: ['digestion', 'absorption'], blurb: 'Besinlerin, demir ve B12 dahil emildiği bölüm.' },
  { id: 'large-intestine', nameTr: 'Kalın bağırsak', latin: 'Intestinum crassum', systems: ['digestive'], asset: 'digestive', modelMatch: ['colon', 'cecum', 'caecum', 'rectum', 'appendix', 'intestine_large', 'large_intestine'], processes: ['absorption'], blurb: 'Su ve tuzların geri emildiği bölüm.' },
  { id: 'kidneys', nameTr: 'Böbrekler', latin: 'Renes', systems: ['urinary'], asset: 'urinary', modelMatch: ['kidney', 'renal_papilla', 'renal_pyramid', 'renal_column', 'cortex_of_kidney', 'hilum_of_kidney'], drill: 'nephron', blurb: 'Kanı süzen, sıvı-tuz dengesini ve atık atılımını düzenleyen organlar.' },
  { id: 'urinary-tract', nameTr: 'İdrar yolları ve mesane', latin: 'Pelvis renalis, ureteres, vesica urinaria, urethra', systems: ['urinary'], asset: 'urinary', modelMatch: ['ureter', 'urinary_bladder', 'bladder', 'calyx', 'renal_pelvis', 'urethra'], processes: ['glomerular-filtration'], blurb: 'İdrarı böbreklerden taşıyan, depolayan ve dışarı atan yollar.' },
  { id: 'prostate', nameTr: 'Prostat', latin: 'Prostata', systems: ['urinary', 'reproductive'], asset: 'urinary', modelMatch: ['prostate'], sex: 'male', blurb: 'Erkeklerde mesane altındaki bez.' },
  { id: 'brain', nameTr: 'Beyin', latin: 'Encephalon', systems: ['nervous'], asset: 'nervous', modelMatch: ['brain', 'allen', 'cortex', 'gyrus', 'lobe', 'cerebell', 'thalam', 'hippocamp', 'nucleus', 'ventricle_of_brain'], processes: ['nerve-signal'], blurb: 'Sinir sisteminin merkezi.' },
  { id: 'hypothalamus', nameTr: 'Hipotalamus', latin: 'Hypothalamus', systems: ['endocrine', 'nervous'], asset: 'nervous', modelMatch: [], processes: ['pituitary-hormones', 'thyroid-axis', 'stress-hormones'], blurb: 'Hipofizi yöneten, vücut ısısı, açlık ve susuzluğu düzenleyen beyin bölgesi.' },
  { id: 'pineal', nameTr: 'Epifiz (pineal bez)', latin: 'Glandula pinealis', systems: ['endocrine', 'nervous'], asset: 'nervous', modelMatch: [], processes: ['hormone-secretion'], blurb: 'Karanlıkta melatonin salgılayarak uyku-uyanıklık ritmini düzenleyen küçük bez.' },
  { id: 'spinal-cord', nameTr: 'Omurilik', latin: 'Medulla spinalis', systems: ['nervous'], asset: 'nervous', modelMatch: ['spinal_cord', 'spinal', 'cervical', 'thoracic', 'lumbar'], processes: ['nerve-signal'], blurb: 'Beyin ile vücut arasında sinyal taşır.' },
  { id: 'nerves', nameTr: 'Periferik sinirler', latin: 'Nervi periferici', systems: ['nervous'], asset: 'nervous', modelMatch: [], approximate: true, processes: ['nerve-signal'], blurb: 'Omurilikten kollara, bacaklara ve gövdeye uzanan ana sinirler. Yolları kemiklere göre şematik çizilmiştir.' },
  { id: 'eyes', nameTr: 'Gözler', latin: 'Organum visus (bulbus oculi)', systems: ['nervous'], asset: 'nervous', modelMatch: [], processes: ['vision'], blurb: 'Görme organı. Retina damarları uzun süreli yüksek kan şekeri ve tansiyondan etkilenebilir.' },
  { id: 'ear', nameTr: 'Kulak (şematik)', latin: 'Organum vestibulocochleare', systems: ['nervous'], asset: 'schematic', modelMatch: [], schematic: true, processes: ['hearing'], blurb: 'İşitme ve denge organı. Kullanılan açık model kaynaklarında kulak yok; iç kulak şematik çizilir.' },
  { id: 'limb-vessels', nameTr: 'Kol ve bacak damarları', latin: 'Vasa membrorum', systems: ['cardiovascular'], asset: 'cardio', modelMatch: [], drill: 'vessel', approximate: true, processes: ['circulation'], blurb: 'Kolları ve bacakları besleyen ana atardamarlar (brakiyal, radyal, femoral, tibial) ve toplardamarlar (safen, sefalik, bazilik). Yolları kemiklere göre şematik çizilmiştir.' },
  { id: 'bones', nameTr: 'İskelet', latin: 'Systema skeletale (ossa)', systems: ['musculoskeletal', 'hematologic'], asset: 'skeleton', modelMatch: ['vertebra', 'sacrum', 'coccyx', 'pelvi', 'hip_bone', 'ilium', 'ischium', 'pubis', 'femur', 'atlas', 'axis'], drill: 'bone-marrow', processes: ['bone-remodeling'], blurb: 'Vücudu taşıyan 200’den fazla kemik. Yetişkinde kan yapımının (kemik iliği) büyük kısmı omurga, pelvis, kaburgalar ve göğüs kemiğinde olur.' },
  { id: 'knee', nameTr: 'Diz eklemi (bağlar ve menisküs)', latin: 'Articulatio genus', systems: ['musculoskeletal'], asset: 'skeleton', modelMatch: [], processes: ['bone-remodeling'], blurb: 'Vücudun en büyük eklemi: menisküsler, eklem kıkırdağı, çapraz ve yan bağlar.' },
  { id: 'skeletal-muscle', nameTr: 'İskelet kasları', latin: 'Musculi skeleti', systems: ['musculoskeletal'], asset: 'muscles', modelMatch: [], processes: ['muscle-contraction'], blurb: 'Hareketi sağlayan, kemiklere tutunan kaslar. Kas enzimi (CK) ve kreatinin kas kütlesi ve kas hasarıyla ilişkilidir.' },
  { id: 'spleen', nameTr: 'Dalak', latin: 'Splen (lien)', systems: ['immune', 'hematologic'], asset: 'immune', modelMatch: ['spleen', 'splenic_'], processes: ['immune-response'], blurb: 'Yaşlanmış alyuvarları ayıklar, bağışıklık hücrelerini barındırır.' },
  { id: 'thymus', nameTr: 'Timus', latin: 'Thymus', systems: ['immune'], asset: 'immune', modelMatch: ['thymus'], processes: ['immune-response'], blurb: 'T lenfositlerinin olgunlaştığı bez.' },
  { id: 'tonsils', nameTr: 'Bademcikler', latin: 'Tonsillae palatinae', systems: ['immune'], asset: 'immune', modelMatch: ['tonsil'], processes: ['immune-response'], blurb: 'Boğaz girişinde ağızdan ve burundan giren mikroplarla ilk karşılaşan lenf dokusu.' },
  { id: 'lymph-node', nameTr: 'Lenf düğümü (örnek)', latin: 'Nodus lymphoideus', systems: ['immune'], asset: 'immune', modelMatch: [], processes: ['immune-response'], blurb: 'Vücutta 500–700 lenf düğümü vardır. Burada iç yapısı ayrıntılı modellenmiş tek bir örnek düğüm gösterilir; konumu temsilidir.' },
  { id: 'skin', nameTr: 'Deri', latin: 'Cutis (integumentum commune)', systems: ['integumentary'], asset: 'body', modelMatch: ['skin'], processes: ['vitamin-d-synthesis'], blurb: 'Güneş ışığıyla D vitamini yapımının başladığı organ.' },
  // Şematik yapılar (kaynaklarda model yok; konumu temsil eden basit şekiller)
  { id: 'thyroid', nameTr: 'Tiroid (şematik)', latin: 'Glandula thyroidea', systems: ['endocrine'], asset: 'schematic', modelMatch: ['schematic_thyroid'], schematic: true, drill: 'thyroid-follicle', blurb: 'Boyunda, metabolizmayı düzenleyen T3/T4 hormonlarını üreten bez.' },
  { id: 'pituitary', nameTr: 'Hipofiz', latin: 'Hypophysis', systems: ['endocrine', 'nervous'], asset: 'endocrine', modelMatch: [], processes: ['pituitary-hormones'], blurb: 'TSH, FSH, LH, prolaktin, ACTH gibi hormonları salgılayan, diğer bezleri yöneten bez.' },
  { id: 'adrenals', nameTr: 'Böbreküstü bezleri', latin: 'Glandulae suprarenales', systems: ['endocrine'], asset: 'endocrine', modelMatch: [], processes: ['stress-hormones'], blurb: 'Kortizol, aldosteron, adrenalin ve DHEA-S üreten bezler.' },
  // Üreme sistemi (cinsiyete göre: vücut seçimi erkek ya da kadın)
  { id: 'testes', nameTr: 'Testisler', latin: 'Testes', systems: ['reproductive', 'endocrine'], asset: 'reproductive', modelMatch: [], sex: 'male', processes: ['sex-hormones'], blurb: 'Sperm ve testosteron üreten erkek üreme bezleri; üstlerinde epididim bulunur.' },
  { id: 'male-genitals', nameTr: 'Erkek üreme yolları', latin: 'Organa genitalia masculina', systems: ['reproductive'], asset: 'reproductive', modelMatch: [], sex: 'male', blurb: 'Sperm kanalları (duktus deferens), seminal veziküller ve penis.' },
  { id: 'ovaries', nameTr: 'Yumurtalıklar', latin: 'Ovaria', systems: ['reproductive', 'endocrine'], asset: 'reproductive', modelMatch: [], sex: 'female', processes: ['sex-hormones'], blurb: 'Yumurta hücrelerini olgunlaştıran, östrojen ve progesteron üreten kadın üreme bezleri.' },
  { id: 'uterus', nameTr: 'Rahim', latin: 'Uterus', systems: ['reproductive'], asset: 'reproductive', modelMatch: [], sex: 'female', processes: ['sex-hormones'], blurb: 'Gebeliğin geliştiği kaslı organ; iç tabakası her döngüde hormonlara göre kalınlaşıp dökülür.' },
  { id: 'fallopian-tubes', nameTr: 'Fallop tüpleri', latin: 'Tubae uterinae', systems: ['reproductive'], asset: 'reproductive', modelMatch: [], sex: 'female', blurb: 'Yumurtayı yumurtalıktan rahme taşıyan, döllenmenin gerçekleştiği tüpler.' },
  { id: 'vagina', nameTr: 'Vajina', latin: 'Vagina', systems: ['reproductive'], asset: 'reproductive', modelMatch: [], sex: 'female', blurb: 'Rahim ağzından dış genital bölgeye uzanan kaslı kanal.' },
  { id: 'breasts', nameTr: 'Meme bezleri', latin: 'Glandulae mammariae', systems: ['reproductive', 'endocrine'], asset: 'reproductive', modelMatch: [], sex: 'female', processes: ['hormone-secretion'], blurb: 'Süt üreten bez dokusu, kanallar ve yağ dokusundan oluşur; prolaktin süt yapımını uyarır.' },
];

export type ProcessId =
  | 'lipid-transport'
  | 'atherosclerosis'
  | 'oxygen-transport'
  | 'erythropoiesis'
  | 'iron-metabolism'
  | 'immune-response'
  | 'inflammation'
  | 'hemostasis'
  | 'glucose-regulation'
  | 'hepatocyte-injury'
  | 'bile-metabolism'
  | 'protein-synthesis'
  | 'glomerular-filtration'
  | 'electrolyte-balance'
  | 'uric-acid-metabolism'
  | 'thyroid-axis'
  | 'bone-mineral'
  | 'b12-folate'
  | 'pancreatic-enzymes'
  | 'muscle-injury'
  | 'stress-hormones'
  | 'pituitary-hormones'
  | 'prostate'
  | 'sex-hormones'
  | 'pregnancy'
  | 'heart-contraction'
  | 'circulation'
  | 'gas-exchange'
  | 'nerve-signal'
  | 'vision'
  | 'hearing'
  | 'muscle-contraction'
  | 'digestion'
  | 'absorption'
  | 'vitamin-d-synthesis'
  | 'cell-energy'
  | 'hormone-secretion'
  | 'bone-remodeling';

export const PROCESSES: Readonly<Record<ProcessId, { nameTr: string; summary: string }>> = {
  'lipid-transport': { nameTr: 'Lipid taşınması', summary: 'Kolesterol ve trigliseritler kanda lipoprotein (LDL, HDL, VLDL) paketleriyle taşınır.' },
  atherosclerosis: { nameTr: 'Ateroskleroz biyolojisi', summary: 'Damar duvarında biriken lipoproteinler ve bağışıklık yanıtı yıllar içinde plak oluşumuna katkıda bulunabilir.' },
  'oxygen-transport': { nameTr: 'Oksijen taşınması', summary: 'Alyuvarlardaki hemoglobin akciğerde oksijen alır, dokulara bırakır.' },
  erythropoiesis: { nameTr: 'Kan hücresi yapımı', summary: 'Kemik iliğinde alyuvar, akyuvar ve trombositler üretilir.' },
  'iron-metabolism': { nameTr: 'Demir metabolizması', summary: 'Demir bağırsaktan emilir, transferrinle taşınır, ferritin olarak depolanır ve hemoglobine katılır.' },
  'immune-response': { nameTr: 'Bağışıklık yanıtı', summary: 'Akyuvarlar enfeksiyon ve yabancı maddelere karşı savunmayı yürütür.' },
  inflammation: { nameTr: 'İnflamasyon (iltihap yanıtı)', summary: 'Vücudun hasar veya enfeksiyona verdiği yanıt; karaciğer CRP gibi proteinleri artırır.' },
  hemostasis: { nameTr: 'Pıhtılaşma', summary: 'Trombositler ve pıhtılaşma faktörleri kanamayı durdurur.' },
  'glucose-regulation': { nameTr: 'Kan şekeri düzenlenmesi', summary: 'Pankreastaki insülin ve glukagon kan şekerini dar bir aralıkta tutar.' },
  'hepatocyte-injury': { nameTr: 'Karaciğer hücresi enzimleri', summary: 'Karaciğer hücreleri zorlandığında ALT/AST gibi enzimler kana daha fazla geçer.' },
  'bile-metabolism': { nameTr: 'Safra ve bilirubin', summary: 'Yaşlanan alyuvarlardan oluşan bilirubin karaciğerde işlenir ve safrayla atılır.' },
  'protein-synthesis': { nameTr: 'Protein yapımı', summary: 'Albumin ve pıhtılaşma faktörleri karaciğerde üretilir.' },
  'glomerular-filtration': { nameTr: 'Böbrekte süzme', summary: 'Glomerüller kanı süzer; kreatinin ve üre bu süzme ile atılır.' },
  'electrolyte-balance': { nameTr: 'Sıvı-tuz dengesi', summary: 'Böbrekler ve hormonlar sodyum, potasyum ve klor düzeyini ayarlar.' },
  'uric-acid-metabolism': { nameTr: 'Ürik asit', summary: 'Pürin yıkımının son ürünüdür ve çoğunlukla böbreklerle atılır.' },
  'thyroid-axis': { nameTr: 'Hipotalamus–hipofiz–tiroid ekseni', summary: 'Hipofizin TSH\'si tiroidi uyarır; T3/T4 yükselince TSH geri çekilir.' },
  'bone-mineral': { nameTr: 'Kemik ve mineral dengesi', summary: 'D vitamini, kalsiyum ve fosfor kemik yapımını ve kas-sinir işlevini destekler.' },
  'b12-folate': { nameTr: 'B12 ve folat', summary: 'DNA yapımı, kan hücresi üretimi ve sinir sistemi için gereklidir.' },
  'pancreatic-enzymes': { nameTr: 'Pankreas enzimleri', summary: 'Amilaz ve lipaz sindirimde görev alır; pankreas zorlandığında kanda artabilir.' },
  'muscle-injury': { nameTr: 'Kas enzimleri', summary: 'Kas hücreleri zorlandığında CK kana geçer; yoğun egzersizde de yükselebilir.' },
  'stress-hormones': { nameTr: 'Stres hormonları', summary: 'Kortizol böbreküstü bezinden salgılanır, günlük döngüsü vardır.' },
  'pituitary-hormones': { nameTr: 'Hipofiz hormonları', summary: 'Hipofiz birçok bezi yöneten hormonlar salgılar.' },
  prostate: { nameTr: 'Prostat', summary: 'PSA prostat hücrelerince üretilen bir proteindir.' },
  'sex-hormones': { nameTr: 'Cinsiyet hormonları', summary: 'Hipofizden salgılanan FSH ve LH, testis ve yumurtalıkları uyararak testosteron, östrojen ve progesteron yapımını yönetir; kan düzeyleri geri bildirimle ayarlanır.' },
  pregnancy: { nameTr: 'Gebelik hormonu (hCG)', summary: 'hCG, gebelikte plasentanın ürettiği hormondur; gebeliğin ilk haftalarında hızla yükselir.' },
  'heart-contraction': { nameTr: 'Kalbin kasılması', summary: 'Sinüs düğümünden çıkan elektrik dalgası kulakçıkları, sonra karıncıkları kasar; kapaklar kanın tek yönde akmasını sağlar.' },
  circulation: { nameTr: 'Kan dolaşımı', summary: 'Büyük dolaşım oksijenli kanı dokulara taşır; küçük dolaşım kanı akciğerlerde oksijenlendirir.' },
  'gas-exchange': { nameTr: 'Gaz alışverişi', summary: 'Oksijen alveollerden kana, karbondioksit kandan alveollere difüzyonla geçer.' },
  'nerve-signal': { nameTr: 'Sinir sinyali iletimi', summary: 'Nöronlar elektriksel sinyali (aksiyon potansiyeli) aksonları boyunca iletir, sinapslarda kimyasal habercilerle bir sonraki hücreye aktarır.' },
  vision: { nameTr: 'Görme', summary: 'Işık kornea ve mercekte kırılıp retinaya odaklanır; çubuk ve koniler ışığı sinir sinyaline çevirir.' },
  hearing: { nameTr: 'İşitme ve denge', summary: 'Ses dalgaları kulak zarını ve kemikçikleri titreştirir; kokleadaki tüy hücreleri titreşimi sinir sinyaline çevirir.' },
  'muscle-contraction': { nameTr: 'Kas kasılması', summary: 'Sinir uyarısıyla kas hücresinde kalsiyum salınır; miyozin başları aktin iplerini ATP kullanarak kaydırır.' },
  digestion: { nameTr: 'Sindirim', summary: 'Mide asidi ve enzimler proteinleri; pankreas enzimleri ve safra yağları ve karbonhidratları parçalar.' },
  absorption: { nameTr: 'Besin emilimi', summary: 'İnce bağırsak villuslarındaki hücreler parçalanmış besinleri, vitaminleri ve mineralleri kana ve lenfe geçirir.' },
  'vitamin-d-synthesis': { nameTr: 'D vitamini yapımı', summary: 'Güneşin UVB ışınları deride 7-dehidrokolesterolü D3 vitaminine çevirir; karaciğer ve böbrek onu etkin hale getirir.' },
  'cell-energy': { nameTr: 'Hücresel enerji üretimi', summary: 'Mitokondriler glukoz ve yağ asitlerini oksijenle yakarak ATP üretir.' },
  'hormone-secretion': { nameTr: 'Hormon salgısı', summary: 'Bez hücreleri hormonları kana verir; hormon uzaktaki hedef hücrenin reseptörüne bağlanarak etki eder.' },
  'bone-remodeling': { nameTr: 'Kemik yenilenmesi', summary: 'Osteoklastlar eski kemiği yıkar, osteoblastlar yenisini yapar; kalsiyum, fosfor ve D vitamini bu dengeyi etkiler.' },
};

export const structureById = new Map(STRUCTURES.map((s) => [s.id, s]));
export const systemById = new Map(SYSTEMS.map((s) => [s.id, s]));

// Genel desenli yapılar (ör. kalpteki "ventricle") en son denenir; böylece
// "posterior_vein_of_left_ventricle" kalbe değil toplardamarlara bağlanır.
const GENERIC = new Set(['heart', 'liver', 'brain']);

/** Bir HRA düğüm adını (ör. "VH_M_left_coronary_artery") yapı kimliğine bağlar. */
export function structureForNode(nodeName: string, asset: ModelAsset): string | null {
  const n = nodeName.toLowerCase();
  for (const pass of [false, true]) {
    for (const s of STRUCTURES) {
      if (s.asset !== asset || GENERIC.has(s.id) !== pass) continue;
      if (s.modelMatch.some((m) => n.includes(m))) return s.id;
    }
  }
  return null;
}
