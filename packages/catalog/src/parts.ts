/**
 * Organların iç ve dış bölümleri (3D modelde ayrı seçilebilen parçalar).
 *
 * Model hattı (assets-pipeline) kaynak düğüm adlarını bu kurallarla gruplar ve düğümü
 * "yapı|bölüm" diye adlandırır; uygulama aynı tablodan Türkçe ad, Latince ad ve açıklamayı okur.
 * Kaynaklar: HRA (HuBMAP 3D referans organları, CC BY 4.0) ve BodyParts3D (CC BY-SA 2.1 JP).
 *
 * `inner`: organın dışından görünmeyen yapı. "İç anatomi" görünümünde dış katmanlar saydamlaşır,
 * bunlar öne çıkar.
 */

export interface PartDef {
  structure: string;
  key: string;
  tr: string;
  latin?: string;
  info?: string;
  inner?: boolean;
  /** Temizlenmiş kaynak adında (küçük harf, önek yok, "_" → boşluk) aranır. İlk eşleşen kazanır. */
  match?: RegExp;
}

/** "VH_M_left_cardiac_atrium" → "left cardiac atrium" */
export function cleanNodeName(raw: string): string {
  return raw
    .replace(/^(VH_[MF]_|Allen_|Yao_|SBU_[MF]_|NIH_[MF]_)/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const P = (structure: string, list: Array<Omit<PartDef, 'structure'>>): PartDef[] => list.map((p) => ({ structure, ...p }));

export const PARTS: readonly PartDef[] = [
  /* ------------------------------------------------------------------ Kalp */
  ...P('heart', [
    { key: 'right-atrium', tr: 'Sağ kulakçık', latin: 'Atrium dextrum', match: /right cardiac atrium/, info: 'Vücuttan dönen oksijeni azalmış kanı üst ve alt ana toplardamarlardan alır. Kalbin doğal uyarı merkezi (sinüs düğümü) bu odacığın duvarındadır.' },
    { key: 'right-ventricle', tr: 'Sağ karıncık', latin: 'Ventriculus dexter', match: /right ventricle/, info: 'Kanı pulmoner kapaktan akciğerlere pompalar; duvarı sol karıncıktan incedir çünkü akciğer dolaşımının basıncı düşüktür.' },
    { key: 'left-atrium', tr: 'Sol kulakçık', latin: 'Atrium sinistrum', match: /left cardiac atrium/, info: 'Akciğerlerden gelen oksijenlenmiş kanı dört pulmoner toplardamardan alır.' },
    { key: 'left-ventricle', tr: 'Sol karıncık', latin: 'Ventriculus sinister', match: /left ventricle/, info: 'Kanı aort kapağından tüm vücuda pompalayan, en kalın duvarlı odacık.' },
    { key: 'septum', tr: 'Karıncıklar arası bölme', latin: 'Septum interventriculare', match: /interventricular septum/, info: 'Sağ ve sol karıncığı ayıran kas duvar; içinden iletim sisteminin dalları (His demeti) geçer.', inner: true },
    { key: 'tricuspid', tr: 'Triküspit kapak', latin: 'Valva atrioventricularis dextra', match: /tricuspid/, info: 'Sağ kulakçık ile sağ karıncık arasındaki üç yaprakçıklı kapak.', inner: true },
    { key: 'pulmonary-valve', tr: 'Pulmoner kapak', latin: 'Valva trunci pulmonalis', match: /pulmonary valve/, info: 'Sağ karıncıktan akciğer atardamarına açılan kapak.', inner: true },
    { key: 'mitral', tr: 'Mitral kapak', latin: 'Valva atrioventricularis sinistra (mitralis)', match: /mitral/, info: 'Sol kulakçık ile sol karıncık arasındaki iki yaprakçıklı kapak.', inner: true },
    { key: 'aortic-valve', tr: 'Aort kapağı', latin: 'Valva aortae', match: /aortic valve/, info: 'Sol karıncıktan aorta açılan kapak; koroner arterler hemen üstünden çıkar.', inner: true },
    { key: 'papillary', tr: 'Papiller kaslar', latin: 'Musculi papillares', match: /papillary/, info: 'Karıncık duvarından uzanan kas çıkıntıları; kiriş ipleriyle kapak yaprakçıklarını tutar, kapakların geri kaçmasını önler.', inner: true },
  ]),

  /* ------------------------------------------------------------------ Böbrek ve idrar yolları */
  ...P('kidneys', [
    { key: 'capsule', tr: 'Böbrek kapsülü', latin: 'Capsula fibrosa renis', match: /kidney capsule/, info: 'Böbreği saran ince, sağlam bağ dokusu kılıf.' },
    { key: 'cortex', tr: 'Böbrek kabuğu (korteks)', latin: 'Cortex renalis', match: /cortex of kidney/, info: 'Glomerüllerin ve kıvrımlı tübüllerin bulunduğu dış katman; süzme burada başlar.', inner: true },
    { key: 'column', tr: 'Böbrek sütunları', latin: 'Columnae renales (Bertini)', match: /renal column/, info: 'Korteksin piramitler arasına uzanan bölümleri; damarlar buradan geçer.', inner: true },
    { key: 'pyramid', tr: 'Böbrek piramitleri (medulla)', latin: 'Pyramides renales', match: /renal pyramid/, info: 'Henle kulpları ve toplayıcı kanalların bulunduğu iç bölge; idrar burada yoğunlaştırılır.', inner: true },
    { key: 'papilla', tr: 'Böbrek papillaları', latin: 'Papillae renales', match: /renal papilla/, info: 'Piramitlerin ucu; idrar buradan küçük kalikslere damlar.', inner: true },
    { key: 'hilum', tr: 'Böbrek kapısı (hilus)', latin: 'Hilum renale', match: /hilum of kidney/, info: 'Damarların, sinirlerin ve idrar yolunun böbreğe girip çıktığı iç kenar.' },
  ]),
  ...P('urinary-tract', [
    { key: 'renal-pelvis', tr: 'Böbrek havuzu', latin: 'Pelvis renalis', match: /renal pelvis/, info: 'Kalikslerden gelen idrarın toplandığı huni biçimli boşluk; üretere devam eder.', inner: true },
    { key: 'calyces', tr: 'Böbrek kaliksleri', latin: 'Calices renales', match: /calyx/, info: 'Papillalardan idrarı toplayan küçük ve büyük kadehler.', inner: true },
    { key: 'ureter', tr: 'Üreter (idrar borusu)', latin: 'Ureter', match: /(^| )ureter( |$)/, info: 'İdrarı kas dalgalarıyla böbrekten mesaneye taşıyan yaklaşık 25–30 cm’lik boru.' },
    { key: 'bladder', tr: 'Mesane gövdesi ve kubbesi', latin: 'Vesica urinaria', match: /fundus|dome|urinary bladder$/, info: 'İdrarı depolayan, esneyebilen kaslı kese (detrüsör kası).' },
    { key: 'trigone', tr: 'Mesane üçgeni ve üreter ağızları', latin: 'Trigonum vesicae', match: /trigone|ureteral orifice/, info: 'İki üreter ağzı ile üretra girişi arasındaki düz üçgen bölge.', inner: true },
    { key: 'bladder-neck', tr: 'Mesane boynu', latin: 'Cervix vesicae', match: /bladder neck/, info: 'Üretranın başladığı, düz kas halkasıyla çevrili bölüm.' },
    { key: 'urethra', tr: 'Üretra', latin: 'Urethra', match: /urethra/, info: 'İdrarı mesaneden dışarı taşıyan kanal; erkekte prostatın içinden geçer.' },
  ]),
  ...P('prostate', [
    { key: 'peripheral', tr: 'Periferik bölge', latin: 'Zona peripherica', match: /peripheral zone/, info: 'Prostat dokusunun büyük kısmı; muayenede ele gelen arka bölge.' },
    { key: 'transition', tr: 'Geçiş bölgesi', latin: 'Zona transitionalis', match: /transition zone/, info: 'Üretrayı saran bölge; yaşla büyüyen (iyi huylu büyüme) kısım budur.', inner: true },
    { key: 'central', tr: 'Santral bölge', latin: 'Zona centralis', match: /central zone/, info: 'Ejakülatuvar kanalları çevreleyen bölge.', inner: true },
    { key: 'stroma', tr: 'Ön fibromüsküler stroma', latin: 'Stroma fibromusculare anterius', match: /fibromuscular/, info: 'Bez içermeyen, kas ve bağ dokusundan oluşan ön bölüm.' },
    { key: 'apex-base', tr: 'Prostat tabanı ve tepesi', latin: 'Basis et apex prostatae', match: /apex|base of prostate/ },
    { key: 'ducts', tr: 'Prostat içi kanallar', latin: 'Ductuli prostatici, ductus ejaculatorius', match: /duct|utricle|colliculus|vas deferens|seminal vesicle/, info: 'Prostat salgısını ve sperm yolunu üretraya taşıyan kanallar.', inner: true },
  ]),

  /* ------------------------------------------------------------------ Beyin */
  ...P('brain', [
    { key: 'motor', tr: 'Birincil motor korteks', latin: 'Gyrus precentralis', match: /precentral gyrus/, info: 'İstemli hareket komutlarının çıktığı şerit; vücudun her bölümü burada bir alanla temsil edilir.' },
    { key: 'sensory', tr: 'Birincil duyu korteksi', latin: 'Gyrus postcentralis', match: /postcentral gyrus/, info: 'Dokunma, ağrı, ısı ve konum duyularının ilk işlendiği şerit.' },
    { key: 'auditory', tr: 'İşitme korteksi (Heschl girusu)', latin: 'Gyri temporales transversi', match: /transverse temporal/, info: 'Kulaktan gelen seslerin ilk işlendiği alan.' },
    { key: 'cingulate', tr: 'Singulat girus (limbik korteks)', latin: 'Gyrus cinguli', match: /cingul|ingulo/, info: 'Duygu, dikkat ve hata algılamayla ilişkili, korpus kallozumu saran kıvrım.', inner: true },
    { key: 'amygdala', tr: 'Amigdala', latin: 'Corpus amygdaloideum', match: /amygdal|central nuclear group|^lateral nucleus|basolateral|basomedial|cortical nucleus|^medial nucleus/, info: 'Korku ve duygusal öğrenmeyle ilişkili badem biçimli çekirdek grubu.', inner: true },
    { key: 'hippocampus', tr: 'Hipokampus', latin: 'Hippocampus', match: /hippocamp/, info: 'Yeni anıların oluşturulmasında ve uzamsal hafızada görevli yapı.', inner: true },
    { key: 'temporal', tr: 'Şakak lobu', latin: 'Lobus temporalis', match: /temporal gyrus|temporal pole|planum|fusiform gyrus temporal|perirhinal|parahippocampal/, info: 'İşitme, dil anlama, yüz tanıma ve hafızada rol alır.' },
    { key: 'frontal', tr: 'Alın lobu', latin: 'Lobus frontalis', match: /frontal gyrus|frontal pole|frontomarginal|orbital gyrus|gyrus rectus|paracentral lobule rostral|frontal operculum|rostral gyrus|subcallosal/, info: 'Planlama, karar verme, dikkat, kişilik ve konuşma üretimi (Broca alanı).' },
    { key: 'parietal', tr: 'Yan kafa lobu', latin: 'Lobus parietalis', match: /supraparietal|supramarginal|angular gyrus|precuneus|paracentral lobule caudal|parietal operculum/, info: 'Duyuların birleştirilmesi, uzay algısı ve dikkat.' },
    { key: 'occipital', tr: 'Arka kafa lobu (görme korteksi)', latin: 'Lobus occipitalis', match: /cuneus|lingual gyrus|occipital/, info: 'Gözden gelen görüntünün işlendiği görme merkezleri.' },
    { key: 'insula', tr: 'İnsula', latin: 'Insula (lobus insularis)', match: /insul/, info: 'Yan yarığın derininde; tat, iç organ duyuları ve duygusal farkındalık.', inner: true },
    { key: 'basal-nuclei', tr: 'Bazal çekirdekler', latin: 'Nuclei basales (corpus striatum)', match: /caudate|putamen|globus pallidus|accumbens|claustrum|subthalamic|basal forebrain|septal|bed nucleus/, info: 'Hareketin başlatılması ve ayarlanması, alışkanlık ve ödül öğrenmesi.', inner: true },
    { key: 'thalamus', tr: 'Talamus', latin: 'Thalamus', match: /thalam|geniculate|pulvinar|habenul|zona incerta|pretectal|ventral posterior|centromedian|parafascicular|reuniens|midline nuclear/, info: 'Koku dışındaki tüm duyuların kortekse aktarıldığı ana istasyon.', inner: true },
    { key: 'midbrain', tr: 'Orta beyin', latin: 'Mesencephalon', match: /midbrain|cerebral peduncle|colliculus|red nucleus|substantia nigra|aqueduct/, info: 'Göz hareketleri, görme ve işitme refleksleri; dopamin üreten substantia nigra buradadır.', inner: true },
    { key: 'pons', tr: 'Köprü (pons)', latin: 'Pons', match: /pons|pontine/, info: 'Beyin ile beyincik arasındaki yolları taşır; solunum ritmine katkıda bulunur.' },
    { key: 'medulla', tr: 'Soğancık', latin: 'Medulla oblongata', match: /medulla oblongata|inferior olive/, info: 'Kalp atımı, kan basıncı ve solunum gibi hayati merkezlerin bulunduğu, omuriliğe devam eden bölüm.' },
    { key: 'cerebellum', tr: 'Beyincik', latin: 'Cerebellum', match: /cerebell|vermis|white matter of hindbrain/, info: 'Denge, koordinasyon ve hareket öğrenmesi.' },
    { key: 'ventricles', tr: 'Beyin karıncıkları', latin: 'Ventriculi cerebri', match: /ventricle|atrium of lateral/, info: 'Beyin-omurilik sıvısının üretildiği ve dolaştığı boşluklar.', inner: true },
    { key: 'corpus-callosum', tr: 'Korpus kallozum', latin: 'Corpus callosum', match: /corpus callosum/, info: 'İki beyin yarıküresini bağlayan en büyük sinir lifi demeti.', inner: true },
    { key: 'visual-pathway', tr: 'Görme yolları', latin: 'Chiasma, tractus et radiatio optica', match: /optic/, info: 'Görme sinirlerinin çaprazlaştığı kiazma ve görüntüyü talamustan görme korteksine taşıyan yollar.', inner: true },
    { key: 'olfactory', tr: 'Koku soğanı ve koku yolları', latin: 'Bulbus et tractus olfactorius', match: /olfactory|piriform|gyrus ambiens/, info: 'Burundan gelen koku sinyallerinin ilk işlendiği yapılar.' },
    { key: 'white-matter', tr: 'Beyaz cevher ve bağlantı yolları', latin: 'Substantia alba', match: /white matter|fornix|commissure|mammillothalamic/, info: 'Beyin bölgelerini birbirine bağlayan miyelinli sinir lifleri.', inner: true },
  ]),
  ...P('hypothalamus', [{ key: 'regions', tr: 'Hipotalamus bölgeleri', latin: 'Hypothalamus', match: /./, inner: true }]),
  ...P('spinal-cord', [
    { key: 'cervical', tr: 'Boyun segmentleri (C1–C8)', latin: 'Pars cervicalis medullae spinalis', match: /^c\d|cervical/, info: 'Kolları, boynu ve diyaframı yöneten sinirler buradan çıkar.' },
    { key: 'thoracic', tr: 'Göğüs segmentleri (T1–T12)', latin: 'Pars thoracica', match: /thoracic/, info: 'Gövde kaslarını ve sempatik sinir sistemini besler.' },
    { key: 'lumbar', tr: 'Bel segmentleri (L1–L5)', latin: 'Pars lumbalis', match: /lumbar/, info: 'Bacak sinirlerinin (ör. femoral sinir) kaynağı.' },
    { key: 'sacral', tr: 'Sakral segmentler (S1–S5)', latin: 'Pars sacralis, conus medullaris', match: /sacral/, info: 'Mesane, bağırsak ve cinsel işlev sinirleri; siyatik sinire katkı.' },
  ]),

  /* ------------------------------------------------------------------ Göz */
  ...P('eyes', [
    { key: 'cornea', tr: 'Kornea', latin: 'Cornea', match: /^cornea [lr]$|^cornea$/, info: 'Gözün önündeki saydam pencere; ışığı en çok kıran katman.' },
    { key: 'sclera', tr: 'Sklera (göz akı)', latin: 'Sclera', match: /sclera/, info: 'Gözü saran beyaz, sert dış tabaka.' },
    { key: 'conjunctiva', tr: 'Konjonktiva', latin: 'Tunica conjunctiva', match: /conjunctiva/, info: 'Göz akını ve göz kapaklarının iç yüzünü örten ince zar.' },
    { key: 'iris', tr: 'İris ve göz bebeği', latin: 'Iris, pupilla', match: /iris|pupil/, info: 'Göze rengini veren kas halkası; ortadaki açıklığı (göz bebeği) ışığa göre daraltıp genişletir.' },
    { key: 'lens', tr: 'Göz merceği (lens)', latin: 'Lens', match: /^lens/, info: 'Şekli değişerek yakına ve uzağa odaklanmayı sağlayan saydam mercek.', inner: true },
    { key: 'zonule', tr: 'Lens askı bağları', latin: 'Zonula ciliaris', match: /suspensory ligament/, info: 'Merceği siliyer cisme bağlayan ince lifler.', inner: true },
    { key: 'ciliary', tr: 'Siliyer cisim', latin: 'Corpus ciliare', match: /ciliary/, info: 'Merceğin şeklini ayarlayan kas ve ön kamara sıvısını üreten çıkıntılar.', inner: true },
    { key: 'aqueous', tr: 'Ön kamara sıvısı ve drenaj', latin: 'Humor aquosus, sinus venosus sclerae', match: /aqueous|schlemm|trabecular/, info: 'Göz içi basıncını belirleyen sıvı; Schlemm kanalından boşalır.', inner: true },
    { key: 'vitreous', tr: 'Camsı cisim', latin: 'Corpus vitreum', match: /vitreous/, info: 'Gözün arka boşluğunu dolduran saydam jel.', inner: true },
    { key: 'retina', tr: 'Retina (ağ tabaka)', latin: 'Retina', match: /retina|ora serrata/, info: 'Işığı sinir sinyaline çeviren çubuk ve koni hücrelerinin bulunduğu tabaka.', inner: true },
    { key: 'macula', tr: 'Sarı nokta ve fovea', latin: 'Macula lutea, fovea centralis', match: /macula|fovea/, info: 'Keskin ve renkli görmenin sağlandığı, konilerin en yoğun olduğu bölge.', inner: true },
    { key: 'optic-disc', tr: 'Kör nokta (optik disk)', latin: 'Discus nervi optici', match: /optic disc/, info: 'Görme sinirinin gözden çıktığı, fotoreseptör bulunmayan nokta.', inner: true },
    { key: 'choroid', tr: 'Koroid (damar tabaka)', latin: 'Choroidea', match: /choroid/, info: 'Retinanın dış katmanlarını besleyen damarlı tabaka.', inner: true },
    { key: 'optic-nerve', tr: 'Görme siniri', latin: 'Nervus opticus (II)', match: /optic nerve|dura mater/, info: 'Retinadan gelen sinyalleri beyne taşıyan yaklaşık 1 milyon sinir lifi.' },
    { key: 'muscles', tr: 'Göz dışı kaslar', latin: 'Musculi bulbi', match: /rectus|oblique|levator/, info: 'Gözü yukarı, aşağı, sağa, sola ve döndürerek hareket ettiren altı kas ile üst göz kapağını kaldıran kas.' },
  ]),

  /* ------------------------------------------------------------------ Solunum */
  ...P('lungs', [
    { key: 'right-upper', tr: 'Sağ üst lob', latin: 'Lobus superior pulmonis dextri', match: /right (apical|posterior|anterior) bronchopulmonary/ },
    { key: 'right-middle', tr: 'Sağ orta lob', latin: 'Lobus medius pulmonis dextri', match: /right (lateral|medial) bronchopulmonary/ },
    { key: 'right-lower', tr: 'Sağ alt lob', latin: 'Lobus inferior pulmonis dextri', match: /right (superior|[a-z]+ basal) bronchopulmonary/ },
    { key: 'left-upper', tr: 'Sol üst lob (lingula dahil)', latin: 'Lobus superior pulmonis sinistri', match: /left (apical|posterior|anterior|apicoposterior|lingula [a-z]+|lingular) bronchopulmonary|^lingula/ },
    { key: 'left-lower', tr: 'Sol alt lob', latin: 'Lobus inferior pulmonis sinistri', match: /left (superior|[a-z]+ basal) bronchopulmonary/ },
    { key: 'hilum', tr: 'Akciğer kökü (hilus)', latin: 'Hilum pulmonis', match: /hilum/, info: 'Bronşların, damarların ve sinirlerin akciğere girdiği bölge.', inner: true },
  ]),
  ...P('airways', [
    { key: 'epiglottis', tr: 'Gırtlak kapağı (epiglot)', latin: 'Epiglottis', match: /epiglot/, info: 'Yutkunurken gırtlağı kapatıp lokmanın soluk yoluna kaçmasını önler.' },
    { key: 'larynx', tr: 'Gırtlak kıkırdakları', latin: 'Cartilagines laryngis', match: /arytenoid|cricoid|thyroid cartilage|corniculate/, info: 'Ses tellerini taşıyan kıkırdak iskelet; tiroid kıkırdağı “Adem elması”dır.' },
    { key: 'trachea', tr: 'Nefes borusu (trakea)', latin: 'Trachea', match: /^trachea$|carina/, info: 'Gırtlaktan göğse inen, iç yüzü kirpikli hücrelerle döşeli hava yolu.' },
    { key: 'tracheal-rings', tr: 'Trakea kıkırdak halkaları', latin: 'Cartilagines tracheales', match: /tracheal cartilage/ },
    { key: 'main-bronchi', tr: 'Ana bronşlar', latin: 'Bronchi principales', match: /^bronchus$|main bronchus|intermediate bronchus/ },
    { key: 'lobar-bronchi', tr: 'Lob bronşları', latin: 'Bronchi lobares', match: /lobar bronchus/ },
    { key: 'bronchial-cartilage', tr: 'Bronş kıkırdakları', latin: 'Cartilagines bronchiales', match: /cartilage of the/ },
    { key: 'segmental-bronchi', tr: 'Segment bronşları', latin: 'Bronchi segmentales', match: /bronch|basal$/ },
  ]),

  /* ------------------------------------------------------------------ Sindirim */
  ...P('liver', [
    { key: 'right-lobe', tr: 'Sağ lob (segment V–VIII)', latin: 'Lobus hepatis dexter', match: /right (posteroinferior|posterosuperior|anterosuperior|anteroinferior) segment/, inner: true },
    { key: 'left-lobe', tr: 'Sol lob (segment II–IV)', latin: 'Lobus hepatis sinister', match: /left (anterolateral|posterolateral|superiomedial|superomedial|inferomedial) segment/, inner: true },
    { key: 'caudate', tr: 'Kaudat lob (segment I)', latin: 'Lobus caudatus', match: /caudate/, inner: true },
    { key: 'quadrate', tr: 'Kuadrat lob', latin: 'Lobus quadratus', match: /quadrate/, inner: true },
    { key: 'porta', tr: 'Karaciğer kapısı', latin: 'Porta hepatis', match: /porta hepatis/, info: 'Portal ven, karaciğer atardamarı ve safra kanalının girip çıktığı yer.' },
    { key: 'ligaments', tr: 'Karaciğer bağları', latin: 'Ligamenta hepatis', match: /ligament/, info: 'Karaciğeri diyaframa ve karın ön duvarına asan bağlar (falsiform, yuvarlak, koroner, üçgen).' },
    { key: 'capsule', tr: 'Karaciğer kapsülü ve yüzeyleri', latin: 'Capsula fibrosa perivascularis', match: /capsule|surface|impression|bare area/, info: 'Karaciğeri saran kılıf; komşu organların bıraktığı izler (böbrek, mide, kolon izleri) görülür.' },
  ]),
  ...P('gallbladder', [
    { key: 'gallbladder', tr: 'Safra kesesi', latin: 'Vesica biliaris', match: /gallbladder/ },
    { key: 'bile-ducts', tr: 'Safra yolları', latin: 'Ductus hepaticus, cysticus, choledochus', match: /hepatic duct|cystic duct|bile duct/, info: 'Safrayı karaciğerden keseye ve on iki parmak bağırsağına taşıyan kanallar.' },
  ]),
  ...P('pancreas', [
    { key: 'head', tr: 'Pankreas başı ve boynu', latin: 'Caput et collum pancreatis', match: /head|uncinate|neck/ },
    { key: 'body', tr: 'Pankreas gövdesi', latin: 'Corpus pancreatis', match: /body/ },
    { key: 'tail', tr: 'Pankreas kuyruğu', latin: 'Cauda pancreatis', match: /tail/, info: 'Langerhans adacıkları kuyrukta biraz daha yoğundur.' },
    { key: 'ducts', tr: 'Pankreas kanalları ve Vater ampullası', latin: 'Ductus pancreaticus, ampulla hepatopancreatica', match: /pancreatic duct|ampulla/, info: 'Sindirim enzimlerini on iki parmak bağırsağına taşıyan kanallar.', inner: true },
  ]),
  ...P('small-intestine', [
    { key: 'duodenum', tr: 'On iki parmak bağırsağı', latin: 'Duodenum', match: /duoden|santorini|sphincter/, info: 'Mideden gelen içeriğe safra ve pankreas enzimlerinin katıldığı ilk bölüm; demir en çok burada emilir.' },
    { key: 'jejunum', tr: 'Jejunum', latin: 'Jejunum', match: /jejun|jejen/, info: 'Besinlerin büyük kısmının emildiği, bol kıvrımlı orta bölüm.' },
    { key: 'ileum', tr: 'İleum', latin: 'Ileum', match: /ileum/, info: 'B12 vitamini ve safra asitlerinin emildiği son bölüm.' },
  ]),
  ...P('large-intestine', [
    { key: 'cecum', tr: 'Çekum, apandis ve ileoçekal kapak', latin: 'Caecum, appendix vermiformis', match: /caecum|cecum|appendix|ileocecal/ },
    { key: 'ascending', tr: 'Çıkan kolon', latin: 'Colon ascendens', match: /ascending colon|hepatic flexure/ },
    { key: 'transverse', tr: 'Transvers kolon', latin: 'Colon transversum', match: /transverse colon|splenic flexure/ },
    { key: 'descending', tr: 'İnen kolon', latin: 'Colon descendens', match: /descending colon/ },
    { key: 'sigmoid', tr: 'Sigmoid kolon', latin: 'Colon sigmoideum', match: /sigmoid/ },
    { key: 'rectum', tr: 'Rektum', latin: 'Rectum', match: /rectum/ },
  ]),
  ...P('spleen', [
    { key: 'hilum', tr: 'Dalak kapısı', latin: 'Hilum splenicum', match: /hilum/, info: 'Dalak atardamarı ve toplardamarının girip çıktığı yer.' },
    { key: 'surface', tr: 'Dalak (yüzeyler)', latin: 'Splen (lien)', match: /./ },
  ]),

  /* ------------------------------------------------------------------ Bağışıklık */
  ...P('lymph-node', [
    { key: 'capsule', tr: 'Kapsül', latin: 'Capsula nodi lymphoidei', match: /capsule/ },
    { key: 'follicles', tr: 'Lenf follikülleri (B hücreleri)', latin: 'Folliculi lymphoidei', match: /follicle/, info: 'B lenfositlerinin çoğalıp antikor üretmeye hazırlandığı yuvarlak kümeler.', inner: true },
    { key: 'paracortex', tr: 'Parakorteks (T hücreleri)', latin: 'Paracortex', match: /paracortex/, info: 'T lenfositlerinin antijen sunan hücrelerle karşılaştığı bölge.', inner: true },
    { key: 'medulla', tr: 'Medulla', latin: 'Medulla nodi lymphoidei', match: /medulla/, info: 'Plazma hücrelerinin ve makrofajların bulunduğu, lenfin toplandığı iç bölge.', inner: true },
    { key: 'afferent', tr: 'Getirici lenf damarları', latin: 'Vasa lymphatica afferentia', match: /afferent/ },
    { key: 'efferent', tr: 'Götürücü lenf damarı', latin: 'Vas lymphaticum efferens', match: /efferent/ },
    { key: 'vessels', tr: 'Kan damarları', latin: 'Vasa sanguinea', match: /blood/, inner: true },
  ]),
  ...P('knee', [
    { key: 'meniscus', tr: 'Menisküsler', latin: 'Meniscus medialis et lateralis', match: /meniscus/, info: 'Uyluk ve kaval kemiği arasında yükü dağıtan C biçimli kıkırdak yastıklar.' },
    { key: 'cartilage', tr: 'Eklem kıkırdağı', latin: 'Cartilago articularis', match: /articular cartilage/, info: 'Eklem yüzeylerini kaplayan, sürtünmeyi azaltan kaygan kıkırdak.' },
    { key: 'acl', tr: 'Ön çapraz bağ', latin: 'Ligamentum cruciatum anterius', match: /anterior cruciate ligament/, info: 'Kaval kemiğinin öne kaymasını önler; sporda sık yaralanır.' },
    { key: 'pcl', tr: 'Arka çapraz bağ', latin: 'Ligamentum cruciatum posterius', match: /posterior cruciate ligament/ },
    { key: 'collateral', tr: 'Yan bağlar', latin: 'Ligg. collateralia tibiale et fibulare', match: /collater|anterolateral ligament/ },
    { key: 'patellar', tr: 'Diz kapağı bağı', latin: 'Ligamentum patellae', match: /patellar ligament/ },
  ]),

  /* ------------------------------------------------------------------ Kadın üreme */
  ...P('uterus', [
    { key: 'fundus', tr: 'Rahim tabanı (fundus)', latin: 'Fundus uteri', match: /fundus|cornua/ },
    { key: 'body', tr: 'Rahim gövdesi ve duvarları', latin: 'Corpus uteri (myometrium)', match: /body of uterus|wall of uterus/, info: 'Kalın düz kas tabakası (miyometriyum) ve her döngüde kalınlaşıp dökülen iç tabaka (endometriyum).' },
    { key: 'lower-segment', tr: 'Alt uterin segment', latin: 'Isthmus uteri', match: /lower uterine segment/ },
    { key: 'cervix', tr: 'Rahim ağzı (serviks)', latin: 'Cervix uteri', match: /cervix|cervical os/, info: 'Rahmin vajinaya açılan boyun kısmı.' },
    { key: 'ligaments', tr: 'Rahim ve yumurtalık bağları', latin: 'Lig. latum, teres uteri, ovarii proprium, suspensorium ovarii', match: /ligament|pouch|mesosalpinx|mesovarium/, info: 'Rahmi, tüpleri ve yumurtalıkları pelviste asılı tutan bağlar.' },
  ]),
  ...P('ovaries', [
    { key: 'left', tr: 'Sol yumurtalık', latin: 'Ovarium sinistrum', match: /left ovary/ },
    { key: 'right', tr: 'Sağ yumurtalık', latin: 'Ovarium dextrum', match: /right ovary/ },
  ]),
  ...P('fallopian-tubes', [
    { key: 'infundibulum', tr: 'İnfundibulum ve fimbriyalar', latin: 'Infundibulum tubae, fimbriae', match: /infundibulum|fimbria|fibria|abdominal ostium/, info: 'Yumurtalıktan atılan yumurtayı yakalayan saçaklı uç.' },
    { key: 'ampulla', tr: 'Ampulla', latin: 'Ampulla tubae uterinae', match: /ampulla/, info: 'Döllenmenin çoğunlukla gerçekleştiği geniş bölüm.' },
    { key: 'isthmus', tr: 'İstmus', latin: 'Isthmus tubae uterinae', match: /isthmus/ },
  ]),
  ...P('vagina', [{ key: 'vagina', tr: 'Vajina', latin: 'Vagina', match: /./ }]),
  ...P('breasts', [
    { key: 'lobes', tr: 'Süt bezi lobları', latin: 'Lobi glandulae mammariae', match: /mammary lobes/, info: 'Süt üreten bez dokusu; prolaktin ve oksitosin hormonlarıyla yönetilir.', inner: true },
    { key: 'ducts', tr: 'Süt kanalları ve sinüsleri', latin: 'Ductus et sinus lactiferi', match: /lactiferous/, inner: true },
    { key: 'nipple', tr: 'Meme başı ve areola', latin: 'Papilla et areola mammae', match: /nipple|areola/ },
    { key: 'ligaments', tr: 'Asıcı bağlar (Cooper)', latin: 'Ligamenta suspensoria mammaria', match: /suspensory/, inner: true },
    { key: 'fat', tr: 'Meme yağ dokusu', latin: 'Corpus adiposum mammae', match: /fat/ },
  ]),

  /* ------------------------------------------------------------------ BodyParts3D grupları (düğüm adı zaten anahtar) */
  ...P('bones', [
    { key: 'skull', tr: 'Kafatası ve yüz kemikleri', latin: 'Cranium, ossa faciei' },
    { key: 'teeth', tr: 'Dişler', latin: 'Dentes' },
    { key: 'spine', tr: 'Omurga', latin: 'Columna vertebralis', match: /vertebra|sacrum|coccyx/, info: '7 boyun, 12 göğüs, 5 bel omuru, sakrum ve kuyruk sokumu; aralarında diskler.' },
    { key: 'ribcage', tr: 'Göğüs kafesi', latin: 'Cavea thoracis (costae, sternum)', info: 'Kaburgalar ve göğüs kemiği; kalbi ve akciğerleri korur. Göğüs kemiği iliği kan yapar.' },
    { key: 'pelvis', tr: 'Leğen kemiği', latin: 'Pelvis (os coxae, sacrum)', match: /ilium|ischium|pubis/, info: 'Kadında daha geniş ve yuvarlak, erkekte daha dar ve derindir.' },
    { key: 'shoulder-r', tr: 'Sağ omuz kuşağı', latin: 'Cingulum pectorale dextrum (clavicula, scapula)' },
    { key: 'shoulder-l', tr: 'Sol omuz kuşağı', latin: 'Cingulum pectorale sinistrum (clavicula, scapula)' },
    { key: 'humerus-r', tr: 'Sağ üst kol kemiği', latin: 'Humerus dexter' },
    { key: 'humerus-l', tr: 'Sol üst kol kemiği', latin: 'Humerus sinister' },
    { key: 'forearm-r', tr: 'Sağ önkol kemikleri', latin: 'Radius et ulna dextra' },
    { key: 'forearm-l', tr: 'Sol önkol kemikleri', latin: 'Radius et ulna sinistra' },
    { key: 'hand-r', tr: 'Sağ el kemikleri', latin: 'Ossa manus dextrae' },
    { key: 'hand-l', tr: 'Sol el kemikleri', latin: 'Ossa manus sinistrae' },
    { key: 'femur-r', tr: 'Sağ uyluk kemiği ve diz kapağı', latin: 'Femur et patella dextra', info: 'Vücudun en uzun ve en güçlü kemiği.' },
    { key: 'femur-l', tr: 'Sol uyluk kemiği ve diz kapağı', latin: 'Femur et patella sinistra' },
    { key: 'leg-r', tr: 'Sağ bacak kemikleri', latin: 'Tibia et fibula dextra' },
    { key: 'leg-l', tr: 'Sol bacak kemikleri', latin: 'Tibia et fibula sinistra' },
    { key: 'foot-r', tr: 'Sağ ayak kemikleri', latin: 'Ossa pedis dextri' },
    { key: 'foot-l', tr: 'Sol ayak kemikleri', latin: 'Ossa pedis sinistri' },
  ]),
  ...P('skeletal-muscle', [
    { key: 'head', tr: 'Baş ve yüz kasları', latin: 'Musculi capitis' },
    { key: 'neck', tr: 'Boyun kasları', latin: 'Musculi colli' },
    { key: 'thorax', tr: 'Göğüs kasları', latin: 'Musculi thoracis' },
    { key: 'abdomen', tr: 'Karın kasları', latin: 'Musculi abdominis' },
    { key: 'back', tr: 'Sırt kasları', latin: 'Musculi dorsi' },
    { key: 'upper-arm-r', tr: 'Sağ omuz ve üst kol kasları', latin: 'Musculi membri superioris dextri (brachium)' },
    { key: 'upper-arm-l', tr: 'Sol omuz ve üst kol kasları', latin: 'Musculi membri superioris sinistri (brachium)' },
    { key: 'forearm-r', tr: 'Sağ önkol ve el kasları', latin: 'Musculi antebrachii et manus dextrae' },
    { key: 'forearm-l', tr: 'Sol önkol ve el kasları', latin: 'Musculi antebrachii et manus sinistrae' },
    { key: 'hip-r', tr: 'Sağ kalça kasları', latin: 'Musculi coxae dextrae' },
    { key: 'hip-l', tr: 'Sol kalça kasları', latin: 'Musculi coxae sinistrae' },
    { key: 'thigh-r', tr: 'Sağ uyluk kasları', latin: 'Musculi femoris dextri' },
    { key: 'thigh-l', tr: 'Sol uyluk kasları', latin: 'Musculi femoris sinistri' },
    { key: 'leg-r', tr: 'Sağ bacak ve ayak kasları', latin: 'Musculi cruris et pedis dextri' },
    { key: 'leg-l', tr: 'Sol bacak ve ayak kasları', latin: 'Musculi cruris et pedis sinistri' },
    { key: 'other', tr: 'Diğer kaslar', latin: 'Musculi' },
  ]),
  ...P('adrenals', [
    { key: 'right', tr: 'Sağ böbreküstü bezi', latin: 'Glandula suprarenalis dextra' },
    { key: 'left', tr: 'Sol böbreküstü bezi', latin: 'Glandula suprarenalis sinistra' },
  ]),
  ...P('testes', [
    { key: 'right', tr: 'Sağ testis ve epididim', latin: 'Testis et epididymis dextra' },
    { key: 'left', tr: 'Sol testis ve epididim', latin: 'Testis et epididymis sinistra' },
  ]),
  ...P('male-genitals', [
    { key: 'seminal-vesicles', tr: 'Seminal veziküller', latin: 'Glandulae vesiculosae' },
    { key: 'vas-deferens', tr: 'Sperm kanalları (duktus deferens)', latin: 'Ductus deferens' },
    { key: 'penis', tr: 'Penis', latin: 'Penis' },
  ]),
  ...P('thyroid', [
    { key: 'left-lobe', tr: 'Sol lob', latin: 'Lobus sinister glandulae thyroideae' },
    { key: 'right-lobe', tr: 'Sağ lob', latin: 'Lobus dexter glandulae thyroideae' },
    { key: 'isthmus', tr: 'İstmus (köprü)', latin: 'Isthmus glandulae thyroideae' },
  ]),
  ...P('ear', [
    { key: 'canal', tr: 'Dış kulak yolu', latin: 'Meatus acusticus externus', info: 'Sesi kulak zarına ileten kanal.' },
    { key: 'eardrum', tr: 'Kulak zarı', latin: 'Membrana tympanica', info: 'Ses dalgalarıyla titreşen ince zar; titreşimi kemikçiklere iletir.' },
    { key: 'ossicles', tr: 'Kulak kemikçikleri', latin: 'Ossicula auditus (malleus, incus, stapes)', info: 'Çekiç, örs ve üzengi: vücudun en küçük kemikleri; titreşimi yükselterek iç kulağa aktarır.', inner: true },
    { key: 'cochlea', tr: 'Koklea (salyangoz)', latin: 'Cochlea', info: 'Sıvı dolu sarmal kanal; içindeki tüy hücreleri titreşimi sinir sinyaline çevirir.', inner: true },
    { key: 'vestibule', tr: 'Vestibül', latin: 'Vestibulum', info: 'Başın eğimini ve doğrusal hareketi algılayan denge organları.', inner: true },
    { key: 'canals', tr: 'Yarım daire kanalları', latin: 'Canales semicirculares', info: 'Birbirine dik üç kanal; başın dönme hareketlerini algılar.', inner: true },
  ]),
  ...P('nerves', [
    { key: 'brachial', tr: 'Brakiyal pleksus', latin: 'Plexus brachialis', info: 'Boyun omuriliğinden (C5–T1) çıkan ve kolun tüm sinirlerini oluşturan ağ.' },
    { key: 'median', tr: 'Median sinir', latin: 'Nervus medianus', info: 'Önkolun ön yüzü ve başparmak tarafındaki parmakların duyusu; karpal tünelden geçer.' },
    { key: 'ulnar', tr: 'Ulnar sinir', latin: 'Nervus ulnaris', info: 'Dirseğin iç arkasından (“komik kemik”) geçer; serçe parmak tarafı.' },
    { key: 'radial', tr: 'Radyal sinir', latin: 'Nervus radialis', info: 'Kolun arkasını dolanarak el bileği ve parmakları açan kasları yönetir.' },
    { key: 'femoral', tr: 'Femoral sinir', latin: 'Nervus femoralis', info: 'Uyluğun ön kaslarını (diz açma) yönetir.' },
    { key: 'sciatic', tr: 'Siyatik sinir', latin: 'Nervus ischiadicus', info: 'Vücudun en kalın siniri; kalçadan uyluğun arkasına iner.' },
    { key: 'tibial', tr: 'Tibial sinir', latin: 'Nervus tibialis', info: 'Baldır kaslarını ve ayak tabanını yönetir.' },
    { key: 'peroneal', tr: 'Ortak peroneal sinir', latin: 'Nervus fibularis communis', info: 'Fibula başını dolanır; ayağı yukarı kaldıran kasları yönetir.' },
    { key: 'intercostal', tr: 'Kaburgalar arası sinirler', latin: 'Nervi intercostales' },
    { key: 'vagus', tr: 'Vagus siniri', latin: 'Nervus vagus (X)', info: 'Beyin sapından çıkıp kalp, akciğer ve sindirim organlarına uzanan en uzun kafa siniri; “dinlen-sindir” sistemi.' },
  ]),
];

export const partsOf = (structure: string): PartDef[] => PARTS.filter((p) => p.structure === structure);
const byKey = new Map(PARTS.map((p) => [`${p.structure}|${p.key}`, p]));
export function partDef(structure: string, key: string | null): PartDef | undefined {
  return key ? byKey.get(`${structure}|${key}`) : undefined;
}

/** Kaynak düğüm adını (HRA) bir bölüme bağlar; kural tanımlanmamışsa null. */
export function partFor(structure: string, rawName: string): string | null {
  const rules = PARTS.filter((p) => p.structure === structure && p.match);
  if (!rules.length) return null;
  const n = cleanNodeName(rawName);
  return rules.find((p) => p.match!.test(n))?.key ?? 'other';
}
