import { type ProcessId, structureById } from './anatomy';
import { type LabTestDef, TESTS, testByKey } from './tests';

/**
 * Tahlil → biyolojik süreç → organ/yapı ilişki kataloğu. Her bağlantı bir KANIT DÜZEYİ ve dayanağını taşır;
 * hiçbir bağlantı "bu organ hasta" anlamına gelmez.
 *
 *  - measured     Doğrudan ölçülen veri: testin kanda/idrarda ölçtüğü büyüklüğün kendisi.
 *  - established  Klinik olarak bilinen ilişki: test bu organın/sürecin kabul görmüş göstergesidir
 *                 (yine de tek başına tanı koydurmaz).
 *  - possible     Olası ilişki: değer bu yapıyla ilişkili OLABİLİR; başka birçok etken de aynı sonucu verir.
 *  - educational  Eğitimsel mekanizma: fizyolojide bu yapının rolünü anlatır; kişinin değeri bu yapı
 *                 hakkında bilgi vermez.
 *  - insufficient Veri yetersiz: ilişki tanımlı ama kişide bu test ölçülmemiş (arayüz üretir).
 */
export type EvidenceLevel = 'measured' | 'established' | 'possible' | 'educational' | 'insufficient';

export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  measured: 'Doğrudan ölçülen veri',
  established: 'Klinik olarak bilinen ilişki',
  possible: 'Olası ilişki',
  educational: 'Eğitimsel mekanizma',
  insufficient: 'Veri yetersiz',
};

export const EVIDENCE_HINT: Record<EvidenceLevel, string> = {
  measured: 'Raporda ölçülmüş değerin kendisi.',
  established: 'Bu test, bu yapının ya da sürecin kabul görmüş bir göstergesidir. Tek başına tanı koydurmaz.',
  possible: 'İlişkili olabilir; aynı sonucu başka birçok etken de verebilir.',
  educational: 'Normal fizyolojide bu yapının rolünü anlatır; değerin bu yapı hakkında bilgi vermez.',
  insufficient: 'Bu ilişkiyi değerlendirmek için gereken ölçüm yok.',
};

/** Güç sırası (sıralama ve "en güçlü ilişki" için). */
export const EVIDENCE_RANK: Record<EvidenceLevel, number> = { measured: 4, established: 3, possible: 2, educational: 1, insufficient: 0 };

export interface TestRelation {
  /** STRUCTURES kimliği. */
  structure: string;
  level: Exclude<EvidenceLevel, 'measured' | 'insufficient'>;
  /** Neden bu düzey: ilişkinin dayanağı (tanı dili olmadan). */
  basis: string;
  process?: ProcessId;
}

export interface TestEvidence {
  /** Kanda/idrarda doğrudan ölçülen şey. */
  measures: string;
  relations: TestRelation[];
  /** Birlikte değerlendirildiğinde anlam kazandıran testler (katalog anahtarı). */
  complements: string[];
  /** Bu test TEK BAŞINA neyi söylemez? */
  cannotTell: string;
  /** İlişkilerin dayandığı genel kaynak. */
  source: string;
  /** Elle yazılmış mı (true) yoksa katalog verisinden kuralla mı türetildi (false)? */
  curated: boolean;
}

/** 'source': test, bu yapının doğrudan salgıladığı hormondur. */
type Rel = [structure: string, level: TestRelation['level'] | 'source', basis: string, process?: ProcessId];
interface Entry {
  measures: string;
  rel: Rel[];
  with: string[];
  not: string;
  src?: string;
}

const MEDLINE = 'MedlinePlus Lab Tests (ABD Ulusal Tıp Kütüphanesi, NIH)';
const NOT_ALONE = 'Tek bir değer, tek başına bir organın hasta olduğunu göstermez.';

/** Elle yazılmış ilişkiler: en sık istenen testler. */
const CURATED: Record<string, Entry> = {
  hba1c: {
    measures: 'Alyuvarlardaki hemoglobinin glukozla kaplanmış oranı (son 2–3 ayın ortalama kan şekeri).',
    rel: [
      ['pancreas', 'established', 'Kan şekerini insülin düzenler; insülin pankreasın adacıklarında yapılır.', 'glucose-regulation'],
      ['liver', 'educational', 'Karaciğer glukoz depolar ve açlıkta kana verir; HbA1c karaciğerin durumunu ölçmez.', 'glucose-regulation'],
      ['skeletal-muscle', 'educational', 'Kas, insülinle glukoz alan en büyük dokudur; HbA1c kası ölçmez.', 'glucose-regulation'],
      ['kidneys', 'possible', 'Uzun süre yüksek kan şekeri böbreğin küçük damarlarını etkileyebilir; bunu idrar albümini ve eGFR gösterir, HbA1c göstermez.', 'glomerular-filtration'],
      ['eye-vessels', 'possible', 'Uzun süre yüksek kan şekeri retina damarlarını etkileyebilir; bunu göz dibi muayenesi gösterir.', 'circulation'],
      ['aorta', 'possible', 'Uzun dönemde damar sağlığıyla ilişkilidir; tek ölçüm damarların durumunu göstermez.', 'atherosclerosis'],
    ],
    with: ['glucose', 'insulin', 'hemoglobin', 'urine-microalbumin', 'egfr'],
    not: 'HbA1c, hangi organın etkilendiğini ya da diyabetin tipini söylemez; kansızlık ve hemoglobin varyantları sonucu saptırabilir.',
    src: 'American Diabetes Association, Standards of Care in Diabetes; ' + MEDLINE,
  },
  glucose: {
    measures: 'Örnek alındığı andaki kan glukozu.',
    rel: [
      ['pancreas', 'established', 'Kan şekerinin başlıca düzenleyicileri (insülin, glukagon) pankreasta yapılır.', 'glucose-regulation'],
      ['liver', 'educational', 'Açlıkta kan şekerini karaciğer sağlar.', 'glucose-regulation'],
      ['adrenals', 'possible', 'Stres hormonları (kortizol, adrenalin) kan şekerini yükseltebilir.', 'stress-hormones'],
    ],
    with: ['hba1c', 'insulin'],
    not: 'Tek bir glukoz değeri açlık/tokluk durumuna, strese ve ilaçlara bağlıdır; süregelen durumu göstermez.',
  },
  insulin: {
    measures: 'Örnek alındığı andaki kan insülini.',
    rel: [
      ['pancreas', 'established', 'İnsülin pankreasın beta hücrelerinde yapılır.', 'glucose-regulation'],
      ['liver', 'educational', 'İnsülinin önemli bölümünü karaciğer temizler.', 'glucose-regulation'],
    ],
    with: ['glucose', 'hba1c'],
    not: 'Açlık durumu bilinmeden yorumlanamaz; evrensel bir referans aralığı yoktur.',
  },
  ferritin: {
    measures: 'Kandaki ferritin proteini (vücudun demir depolarının dolaylı göstergesi).',
    rel: [
      ['liver', 'established', 'Demir başlıca karaciğerde ferritin olarak depolanır.', 'iron-metabolism'],
      ['bones', 'established', 'Kemik iliği, hemoglobin yapmak için depo demirini kullanır.', 'erythropoiesis'],
      ['spleen', 'educational', 'Dalak yaşlı alyuvarları yıkar ve demirini geri kazandırır.', 'iron-metabolism'],
      ['small-intestine', 'educational', 'Demir onikiparmak bağırsağında emilir; ferritin emilimi doğrudan ölçmez.', 'absorption'],
    ],
    with: ['iron', 'tibc', 'transferrin-saturation', 'hemoglobin', 'mcv', 'crp'],
    not: 'Ferritin aynı zamanda bir iltihap proteinidir: enfeksiyon ve iltihapta depolar düşük olsa bile yüksek çıkabilir.',
    src: 'WHO guideline on use of ferritin concentrations to assess iron status (2020); ' + MEDLINE,
  },
  iron: {
    measures: 'O anda kanda transferrine bağlı dolaşan demir.',
    rel: [
      ['bones', 'established', 'Dolaşan demir kemik iliğine hemoglobin yapımı için taşınır.', 'erythropoiesis'],
      ['liver', 'possible', 'Depolar ve taşıyıcı protein karaciğerle ilişkilidir.', 'iron-metabolism'],
      ['small-intestine', 'educational', 'Demirin kaynağı bağırsak emilimidir.', 'absorption'],
    ],
    with: ['ferritin', 'tibc', 'transferrin-saturation', 'hemoglobin'],
    not: 'Serum demiri gün içinde ve öğünle belirgin değişir; tek başına demir durumunu göstermez.',
  },
  tsh: {
    measures: 'Hipofizin salgıladığı tiroid uyarıcı hormon.',
    rel: [
      ['pituitary', 'source', '', 'pituitary-hormones'],
      ['thyroid', 'established', 'TSH, tiroid hormonlarına geri bildirimle yanıt verir; tiroid işlevinin en duyarlı göstergesidir.', 'thyroid-axis'],
      ['hypothalamus', 'educational', 'Hipotalamus TRH ile hipofizi uyarır.', 'thyroid-axis'],
    ],
    with: ['ft4', 'ft3', 'anti-tpo'],
    not: 'TSH tek başına sorunun tiroidde mi hipofizde mi olduğunu ayırt etmez; serbest T4 ile birlikte değerlendirilir. Ağır hastalık ve bazı ilaçlar geçici değiştirir.',
    src: 'American Thyroid Association kılavuzları; ' + MEDLINE,
  },
  ft4: {
    measures: 'Kanda proteine bağlı olmayan (etkin) tiroksin.',
    rel: [
      ['thyroid', 'established', 'T4 yalnızca tiroid bezinde yapılır.', 'thyroid-axis'],
      ['pituitary', 'established', 'Hipofiz TSH salgısını serbest T4 düzeyine göre ayarlar.', 'thyroid-axis'],
      ['liver', 'educational', 'T4, karaciğer ve diğer dokularda etkin T3\'e çevrilir.', 'thyroid-axis'],
    ],
    with: ['tsh', 'ft3'],
    not: 'TSH olmadan yorumlanması yanıltıcıdır.',
  },
  ft3: {
    measures: 'Kanda proteine bağlı olmayan triiyodotironin (etkin tiroid hormonu).',
    rel: [
      ['thyroid', 'established', 'T3\'ün bir bölümü tiroidde yapılır.', 'thyroid-axis'],
      ['liver', 'possible', 'T3\'ün çoğu karaciğer, böbrek ve kasta T4\'ten dönüştürülür; ağır hastalık ve açlıkta düşer.', 'thyroid-axis'],
    ],
    with: ['tsh', 'ft4'],
    not: 'Tiroid dışı hastalıklarda da düşebilir; tek başına tiroid işlevini göstermez.',
  },
  alt: {
    measures: 'Kandaki ALT enzimi etkinliği.',
    rel: [
      ['liver', 'established', 'ALT en çok karaciğer hücrelerinde bulunur; hücre zarı hasar görünce kana geçer.', 'hepatocyte-injury'],
      ['skeletal-muscle', 'possible', 'Yoğun egzersiz ve kas hasarı ALT\'yi hafif yükseltebilir.', 'muscle-injury'],
    ],
    with: ['ast', 'ggt', 'alp', 'bilirubin-total', 'albumin', 'ck', 'inr'],
    not: 'ALT hücre hasarının göstergesidir, karaciğerin ne kadar iyi çalıştığının değil; hasarın nedenini de söylemez.',
    src: 'American College of Gastroenterology, anormal karaciğer testleri kılavuzu (2017); ' + MEDLINE,
  },
  ast: {
    measures: 'Kandaki AST enzimi etkinliği.',
    rel: [
      ['liver', 'established', 'AST karaciğer hücrelerinde bulunur; hasarda kana geçer.', 'hepatocyte-injury'],
      ['skeletal-muscle', 'established', 'AST kasta da boldur; kas hasarı ve yoğun egzersiz yükseltir.', 'muscle-injury'],
      ['heart', 'possible', 'Kalp kasında da bulunur; kalp için özgül bir gösterge değildir.', 'muscle-injury'],
    ],
    with: ['alt', 'ck', 'ggt', 'ldh'],
    not: 'AST tek başına kaynağın karaciğer mi kas mı olduğunu ayırt etmez; ALT ve CK ile birlikte değerlendirilir.',
  },
  ggt: {
    measures: 'Kandaki GGT enzimi etkinliği.',
    rel: [
      ['liver', 'established', 'GGT karaciğer ve safra yolu hücrelerinden gelir.', 'bile-metabolism'],
      ['gallbladder', 'possible', 'Safra akışındaki yavaşlamada ALP ile birlikte yükselebilir.', 'bile-metabolism'],
    ],
    with: ['alp', 'alt', 'bilirubin-total'],
    not: 'Alkol ve birçok ilaç GGT\'yi yükseltir; tek başına karaciğer hastalığı göstermez.',
  },
  alp: {
    measures: 'Kandaki alkalen fosfataz etkinliği.',
    rel: [
      ['liver', 'established', 'Safra yollarını döşeyen hücrelerden gelir.', 'bile-metabolism'],
      ['bones', 'established', 'Kemik yapan hücrelerden de gelir; büyüme ve kemik yenilenmesinde artar.', 'bone-remodeling'],
    ],
    with: ['ggt', 'bilirubin-total', 'calcium', 'vitamin-d'],
    not: 'ALP\'nin kaynağının karaciğer mi kemik mi olduğu GGT ile ayrılır; gebelikte ve ergenlikte doğal olarak yüksektir.',
  },
  'bilirubin-total': {
    measures: 'Kandaki toplam bilirubin (alyuvar yıkım ürünü).',
    rel: [
      ['liver', 'established', 'Karaciğer bilirubini işleyip safraya atar.', 'bile-metabolism'],
      ['spleen', 'possible', 'Alyuvar yıkımı arttığında üretim artar.', 'oxygen-transport'],
      ['gallbladder', 'possible', 'Safra akışı engellendiğinde kana geri kaçar.', 'bile-metabolism'],
    ],
    with: ['bilirubin-direct', 'bilirubin-indirect', 'alt', 'alp', 'hemoglobin', 'ldh'],
    not: 'Toplam bilirubin sorunun üretimde mi, işlemede mi, atılımda mı olduğunu söylemez; direkt/indirekt ayrımı gerekir.',
  },
  albumin: {
    measures: 'Kandaki albümin proteini.',
    rel: [
      ['liver', 'established', 'Albümin yalnızca karaciğerde yapılır.', 'protein-synthesis'],
      ['kidneys', 'possible', 'Böbrekten protein kaçağı albümini düşürebilir.', 'glomerular-filtration'],
      ['small-intestine', 'possible', 'Beslenme ve bağırsaktan protein kaybı etkiler.', 'absorption'],
    ],
    with: ['total-protein', 'alt', 'inr', 'urine-microalbumin', 'crp'],
    not: 'Albümin iltihapta, sıvı fazlalığında ve beslenme yetersizliğinde de düşer; tek başına karaciğer işlevini göstermez.',
  },
  creatinine: {
    measures: 'Kandaki kreatinin (kasın atık ürünü).',
    rel: [
      ['kidneys', 'established', 'Kreatinin başlıca glomerüllerden süzülerek atılır; süzme azalınca kanda birikir.', 'glomerular-filtration'],
      ['skeletal-muscle', 'established', 'Üretimi kas kütlesiyle orantılıdır.', 'muscle-contraction'],
    ],
    with: ['egfr', 'urea', 'bun', 'urine-microalbumin', 'potassium'],
    not: 'Kreatinin kas kütlesi, et tüketimi ve bazı ilaçlardan etkilenir; erken süzme kaybında normal kalabilir.',
    src: 'KDIGO 2012/2024 Kronik Böbrek Hastalığı kılavuzu; ' + MEDLINE,
  },
  egfr: {
    measures: 'Kreatinin, yaş ve cinsiyetten HESAPLANAN tahmini süzme hızı (ölçüm değildir).',
    rel: [['kidneys', 'established', 'Glomerüler süzme hızının kabul görmüş tahminidir.', 'glomerular-filtration']],
    with: ['creatinine', 'urine-microalbumin', 'urea'],
    not: 'Bir tahmindir: kas kütlesi uç değerlerde olanlarda ve hızlı değişen durumlarda yanıltır. Tek ölçüm kalıcı bir durumu göstermez.',
    src: 'KDIGO 2012/2024 Kronik Böbrek Hastalığı kılavuzu',
  },
  urea: {
    measures: 'Kandaki üre (protein yıkım ürünü).',
    rel: [
      ['kidneys', 'established', 'Üre böbrekten atılır.', 'glomerular-filtration'],
      ['liver', 'educational', 'Üre karaciğerde amonyaktan yapılır.', 'protein-synthesis'],
    ],
    with: ['creatinine', 'egfr'],
    not: 'Protein alımı, sıvı durumu ve sindirim kanamasından etkilenir; böbreğe özgü değildir.',
  },
  crp: {
    measures: 'Kandaki C-reaktif protein (akut faz proteini).',
    rel: [
      ['liver', 'educational', 'CRP karaciğerde yapılır; ama yükselmesi karaciğerin değil, vücudun herhangi bir yerindeki iltihabın işaretidir.', 'inflammation'],
      ['spleen', 'educational', 'Bağışıklık sistemi iltihap yanıtını yönetir.', 'immune-response'],
    ],
    with: ['wbc', 'esr', 'ferritin', 'neutrophil-abs'],
    not: 'CRP sistemik iltihabı gösterir; iltihabın nerede olduğunu ya da nedenini söylemez. Belirli bir organa atanamaz.',
  },
  esr: {
    measures: 'Alyuvarların bir saatte çökme hızı.',
    rel: [['spleen', 'educational', 'İltihapta kandaki proteinler değişir ve çökme hızlanır; bir organı göstermez.', 'inflammation']],
    with: ['crp', 'hemoglobin', 'wbc'],
    not: 'Yaş, cinsiyet, kansızlık ve gebelikten etkilenir; özgül değildir.',
  },
  hemoglobin: {
    measures: 'Kandaki hemoglobin derişimi (oksijen taşıyan protein).',
    rel: [
      ['bones', 'established', 'Alyuvarlar ve hemoglobin kemik iliğinde yapılır.', 'erythropoiesis'],
      ['kidneys', 'possible', 'Alyuvar yapımını uyaran eritropoietin böbrekte yapılır.', 'erythropoiesis'],
      ['spleen', 'possible', 'Yaşlı alyuvarlar dalakta yıkılır.', 'oxygen-transport'],
      ['lungs', 'educational', 'Hemoglobin oksijeni akciğerde alır; hemoglobin düzeyi akciğeri ölçmez.', 'gas-exchange'],
      ['heart', 'educational', 'Düşük hemoglobinde kalp debiyi artırarak telafi eder.', 'circulation'],
    ],
    with: ['mcv', 'ferritin', 'b12', 'folate', 'rbc', 'rdw', 'creatinine'],
    not: 'Hemoglobin düşüklüğünün nedenini (demir, B12, kanama, süregelen hastalık…) söylemez; sıvı durumu da etkiler.',
    src: 'WHO, Haemoglobin concentrations for the diagnosis of anaemia (2011/2024); ' + MEDLINE,
  },
  mcv: {
    measures: 'Alyuvarların ortalama hacmi.',
    rel: [['bones', 'established', 'Alyuvar boyutu kemik iliğindeki yapım sürecini yansıtır (demir, B12, folat).', 'erythropoiesis']],
    with: ['hemoglobin', 'ferritin', 'b12', 'folate', 'rdw'],
    not: 'Tek başına hangi eksikliğin olduğunu söylemez; iki neden bir arada ise normal görünebilir.',
  },
  wbc: {
    measures: 'Kandaki toplam akyuvar sayısı.',
    rel: [
      ['bones', 'established', 'Akyuvarlar kemik iliğinde yapılır.', 'immune-response'],
      ['spleen', 'educational', 'Dalak ve lenf dokusu bağışıklık hücrelerini barındırır.', 'immune-response'],
    ],
    with: ['neutrophil-abs', 'lymphocyte-abs', 'crp'],
    not: 'Enfeksiyon, stres, sigara, ilaç ve egzersizle değişir; bir organı ya da nedeni göstermez.',
  },
  platelet: {
    measures: 'Kandaki trombosit sayısı.',
    rel: [
      ['bones', 'established', 'Trombositler kemik iliğinde yapılır.', 'hemostasis'],
      ['spleen', 'possible', 'Dalak trombositlerin bir bölümünü tutar; büyüdüğünde sayı düşebilir.', 'hemostasis'],
      ['liver', 'possible', 'Yapımı uyaran trombopoietin karaciğerde yapılır.', 'hemostasis'],
    ],
    with: ['mpv', 'hemoglobin', 'wbc', 'inr'],
    not: 'Sayı, trombositlerin ne kadar iyi çalıştığını göstermez; tüpte kümelenme yanlış düşük sonuç verebilir.',
  },
  ldl: {
    measures: 'Kandaki LDL kolesterol.',
    rel: [
      ['coronary-arteries', 'established', 'LDL, damar duvarında plak oluşumunun nedensel etkenidir (uzun dönem toplam maruziyet).', 'atherosclerosis'],
      ['carotid-arteries', 'possible', 'Aynı süreç boyun damarlarında da işler.', 'atherosclerosis'],
      ['aorta', 'possible', 'Aynı süreç büyük atardamarlarda da işler.', 'atherosclerosis'],
      ['liver', 'educational', 'LDL\'yi kandan başlıca karaciğer temizler.', 'lipid-transport'],
    ],
    with: ['hdl', 'triglyceride', 'cholesterol-total', 'non-hdl', 'hba1c', 'hs-crp'],
    not: 'LDL değeri damarlarda plak olup olmadığını göstermez; risk yaş, tansiyon, sigara ve diyabetle birlikte değerlendirilir.',
    src: 'ESC/EAS 2019 Dislipidemi kılavuzu; ' + MEDLINE,
  },
  triglyceride: {
    measures: 'Kandaki trigliserid (yağ).',
    rel: [
      ['liver', 'established', 'Trigliseridden zengin lipoproteinleri karaciğer yapar.', 'lipid-transport'],
      ['pancreas', 'possible', 'Çok yüksek düzeyler (genellikle > 500–1000 mg/dL) pankreas iltihabıyla ilişkilidir.', 'pancreatic-enzymes'],
      ['coronary-arteries', 'possible', 'Damar riskiyle ilişkilidir.', 'atherosclerosis'],
    ],
    with: ['ldl', 'hdl', 'glucose', 'hba1c'],
    not: 'Öğünden belirgin etkilenir; açlık durumu bilinmeden yorumlanamaz.',
  },
  sodium: {
    measures: 'Kandaki sodyum derişimi.',
    rel: [
      ['kidneys', 'established', 'Su ve sodyum atılımını böbrek ayarlar.', 'electrolyte-balance'],
      ['pituitary', 'possible', 'Su tutulmasını ADH düzenler (hipotalamus-hipofiz).', 'pituitary-hormones'],
      ['adrenals', 'possible', 'Aldosteron sodyum tutulmasını artırır.', 'stress-hormones'],
      ['brain', 'educational', 'Hızlı sodyum değişimleri en çok beyin hücrelerini etkiler.', 'nerve-signal'],
    ],
    with: ['potassium', 'chloride', 'glucose', 'urea', 'creatinine'],
    not: 'Sodyum derişimi vücuttaki tuz miktarını değil, su-tuz oranını gösterir.',
  },
  potassium: {
    measures: 'Kandaki potasyum derişimi.',
    rel: [
      ['kidneys', 'established', 'Potasyumun çoğunu böbrek atar.', 'electrolyte-balance'],
      ['heart', 'established', 'Potasyum kalp hücrelerinin elektriksel etkinliğini belirler; belirgin sapmalar ritmi etkileyebilir.', 'heart-contraction'],
      ['adrenals', 'possible', 'Aldosteron potasyum atılımını artırır.', 'stress-hormones'],
      ['skeletal-muscle', 'educational', 'Vücut potasyumunun çoğu kas hücrelerinin içindedir.', 'muscle-contraction'],
    ],
    with: ['sodium', 'creatinine', 'egfr', 'magnesium', 'ph'],
    not: 'Örnek bekletilirse ya da alyuvarlar parçalanırsa (hemoliz) yanlış yüksek çıkar.',
  },
  calcium: {
    measures: 'Kandaki toplam kalsiyum (yaklaşık yarısı albümine bağlı).',
    rel: [
      ['bones', 'established', 'Kalsiyumun deposu kemiktir.', 'bone-mineral'],
      ['kidneys', 'established', 'Böbrek kalsiyum atılımını ve D vitamininin etkinleşmesini sağlar.', 'bone-mineral'],
      ['thyroid', 'possible', 'Tiroidin arkasındaki paratiroid bezleri kalsiyumu parathormonla düzenler.', 'bone-mineral'],
      ['small-intestine', 'educational', 'Kalsiyum bağırsaktan D vitaminiyle emilir.', 'absorption'],
    ],
    with: ['albumin', 'calcium-ionized', 'phosphorus', 'vitamin-d', 'magnesium', 'creatinine'],
    not: 'Albümin düşükken toplam kalsiyum yanıltıcı düşük görünür; nedenini söylemez.',
  },
  b12: {
    measures: 'Kandaki B12 vitamini.',
    rel: [
      ['stomach', 'established', 'B12 emilimi için gereken iç faktör midede yapılır.', 'b12-folate'],
      ['small-intestine', 'established', 'B12 ince bağırsağın son bölümünde (ileum) emilir.', 'absorption'],
      ['bones', 'established', 'Kemik iliğinde hücre bölünmesi için gereklidir.', 'erythropoiesis'],
      ['nerves', 'established', 'Sinirlerin miyelin kılıfı için gereklidir.', 'nerve-signal'],
      ['liver', 'educational', 'B12 karaciğerde yıllarca yetecek kadar depolanır.', 'b12-folate'],
    ],
    with: ['folate', 'hemoglobin', 'mcv', 'homocysteine'],
    not: 'Düşük B12\'nin nedenini (az alım, emilim sorunu, ilaç) söylemez; sınırda değerlerde doku düzeyi farklı olabilir.',
  },
  'vitamin-d': {
    measures: 'Kandaki 25-hidroksi D vitamini (depo biçimi).',
    rel: [
      ['skin', 'established', 'D vitamini güneş ışığıyla deride yapılır.', 'vitamin-d-synthesis'],
      ['bones', 'established', 'Kalsiyum emilimi ve kemik mineralleşmesi için gereklidir.', 'bone-mineral'],
      ['liver', 'educational', 'Karaciğerde 25-hidroksi biçimine çevrilir (ölçülen bu biçimdir).', 'vitamin-d-synthesis'],
      ['kidneys', 'educational', 'Böbrekte etkin biçimine çevrilir.', 'vitamin-d-synthesis'],
    ],
    with: ['calcium', 'phosphorus', 'alp'],
    not: 'Mevsime ve güneşe göre değişir; kemik sağlığını tek başına göstermez.',
  },
  amylase: {
    measures: 'Kandaki amilaz enzimi etkinliği.',
    rel: [
      ['pancreas', 'established', 'Amilazın bir bölümü pankreastan gelir.', 'pancreatic-enzymes'],
      ['stomach', 'educational', 'Tükürük bezleri de amilaz yapar; bu yüzden pankreasa özgü değildir.', 'digestion'],
    ],
    with: ['lipase', 'triglyceride', 'creatinine'],
    not: 'Tükürük bezi kaynaklı olabilir ve böbrek süzmesi azaldığında yükselir; lipaz pankreas için daha özgüldür.',
  },
  lipase: {
    measures: 'Kandaki lipaz enzimi etkinliği.',
    rel: [['pancreas', 'established', 'Lipaz başlıca pankreasın asinus hücrelerinden gelir.', 'pancreatic-enzymes']],
    with: ['amylase', 'triglyceride', 'alt'],
    not: 'Yükseklik düzeyi hastalığın şiddetini göstermez; böbrek süzmesi azaldığında da yükselebilir.',
  },
  ck: {
    measures: 'Kandaki kreatin kinaz etkinliği.',
    rel: [
      ['skeletal-muscle', 'established', 'CK en çok iskelet kasında bulunur; kas hücresi hasarında kana geçer.', 'muscle-injury'],
      ['heart', 'possible', 'Kalp kasında da bulunur; toplam CK kalp için özgül değildir.', 'muscle-injury'],
    ],
    with: ['ast', 'ldh', 'creatinine', 'tsh'],
    not: 'Yoğun egzersiz, kas içi enjeksiyon ve bazı ilaçlar yükseltir; tek başına kas hastalığı göstermez.',
  },
  psa: {
    measures: 'Kandaki prostata özgü antijen.',
    rel: [['prostate', 'established', 'PSA yalnızca prostat dokusunda yapılır (organa özgü, hastalığa özgü değil).', 'prostate']],
    with: [],
    not: 'PSA prostat büyümesi, iltihabı, bisiklet, cinsel etkinlik ve girişimlerle de yükselir; kanser tanısı koydurmaz ya da dışlamaz.',
  },
  inr: {
    measures: 'Protrombin zamanının standartlaştırılmış oranı.',
    rel: [
      ['liver', 'established', 'Pıhtılaşma faktörlerinin çoğu karaciğerde yapılır.', 'hemostasis'],
      ['small-intestine', 'educational', 'Bu faktörler için gereken K vitamini bağırsaktan emilir.', 'absorption'],
    ],
    with: ['aptt', 'platelet', 'albumin', 'alt'],
    not: 'K vitamini antagonisti ilaçlar INR\'yi bilerek yükseltir; ilaç bilgisi olmadan yorumlanamaz.',
  },
  cortisol: {
    measures: 'Kandaki kortizol (örnek saatine bağlıdır).',
    rel: [
      ['adrenals', 'established', 'Kortizol böbreküstü bezinin kabuğunda yapılır.', 'stress-hormones'],
      ['pituitary', 'established', 'Salgısını hipofizden gelen ACTH yönetir.', 'pituitary-hormones'],
      ['hypothalamus', 'educational', 'Günlük ritmi ve stres yanıtını hipotalamus başlatır.', 'stress-hormones'],
    ],
    with: ['sodium', 'potassium', 'glucose'],
    not: 'Sabah yüksek, gece düşüktür; örnek saati, stres ve ilaçlar bilinmeden yorumlanamaz.',
  },
  ph: {
    measures: 'Kanın asitlik derecesi.',
    rel: [
      ['lungs', 'established', 'Akciğer CO₂ atarak pH\'yı dakikalar içinde ayarlar.', 'gas-exchange'],
      ['kidneys', 'established', 'Böbrek bikarbonat ve asit atılımıyla pH\'yı günler içinde ayarlar.', 'electrolyte-balance'],
    ],
    with: ['pco2', 'hco3', 'lactate', 'base-excess', 'sodium', 'chloride'],
    not: 'pH tek başına bozukluğun solunumsal mı metabolik mi olduğunu söylemez; örnek türü (arter/ven) değeri değiştirir.',
  },
  po2: {
    measures: 'Kanda çözünmüş oksijenin kısmi basıncı.',
    rel: [['lungs', 'established', 'Arter kanında oksijen basıncı akciğerdeki gaz değişimini yansıtır.', 'gas-exchange']],
    with: ['so2', 'pco2', 'hemoglobin'],
    not: 'Toplardamar örneğinde doğal olarak düşüktür ve akciğeri yansıtmaz; örnek türü bilinmelidir.',
  },
  pco2: {
    measures: 'Kanda karbondioksitin kısmi basıncı.',
    rel: [
      ['lungs', 'established', 'pCO₂ doğrudan alveol ventilasyonuyla belirlenir.', 'gas-exchange'],
      ['brain', 'educational', 'Solunum hızını beyin sapı pCO₂\'ye göre ayarlar.', 'nerve-signal'],
    ],
    with: ['ph', 'hco3', 'po2'],
    not: 'Değişimin birincil mi yoksa telafi mi olduğunu pH ve bikarbonat olmadan söylemez.',
  },
  'urine-microalbumin': {
    measures: 'Spot idrardaki albümin.',
    rel: [
      ['kidneys', 'established', 'Sağlam glomerül albümini tutar; idrarda albümin süzgecin geçirgenliğinin göstergesidir.', 'glomerular-filtration'],
      ['renal-vessels', 'possible', 'Küçük damar sağlığıyla ilişkilidir.', 'circulation'],
    ],
    with: ['urine-creatinine', 'creatinine', 'egfr', 'hba1c'],
    not: 'Egzersiz, ateş, idrar yolu enfeksiyonu ve adet dönemi geçici yükseltir; idrarın yoğunluğuna bağlıdır (kreatinine oranlanmalıdır).',
    src: 'KDIGO 2012/2024 Kronik Böbrek Hastalığı kılavuzu',
  },
};

function fallback(t: LabTestDef): TestEvidence {
  const proc = t.processes[0];
  const relations: TestRelation[] = t.structures
    .filter((s) => structureById.has(s))
    .map((structure, i) => ({
      structure,
      level: t.nonSpecific ? 'possible' : i === 0 ? 'established' : 'possible',
      basis: t.nonSpecific ? 'Bu test tek bir organa özgü değildir; ilişki geneldir.' : i === 0 ? 'Katalogda bu testin birincil ilişkili yapısı.' : 'Katalogda bu testle ilişkilendirilen ek yapı.',
      ...(proc ? { process: proc } : {}),
    }));
  return { measures: `${t.nameTr} (${t.unit || 'birimsiz'}).`, relations, complements: [], cannotTell: t.nonSpecific ?? NOT_ALONE, source: 'Uygulama kataloğu (genel fizyoloji)', curated: false };
}

function build(t: LabTestDef): TestEvidence {
  const c = CURATED[t.key];
  if (!c) return fallback(t);
  const relations: TestRelation[] = c.rel
    .filter((r): r is [string, TestRelation['level'], string, ProcessId?] => r[1] !== 'source' && structureById.has(r[0]))
    .map(([structure, level, basis, process]) => ({ structure, level, basis, ...(process ? { process } : {}) }));
  // Hipofiz hormonu gibi "yapının kendi salgısı" olan testlerde kaynak yapı klinik olarak bilinen ilişkidir.
  for (const r of c.rel) if (r[1] === 'source' && structureById.has(r[0])) relations.unshift({ structure: r[0], level: 'established', basis: 'Bu hormon doğrudan bu bezden salgılanır.', ...(r[3] ? { process: r[3] } : {}) });
  return { measures: c.measures, relations, complements: c.with.filter((k) => testByKey.has(k)), cannotTell: c.not, source: c.src ?? MEDLINE, curated: true };
}

const CACHE = new Map<string, TestEvidence>(TESTS.map((t) => [t.key, build(t)]));

/** Bir testin kanıt düzeyli ilişkileri. */
export function evidenceFor(testKey: string): TestEvidence | undefined {
  return CACHE.get(testKey);
}

/** Bir yapıyla ilişkili testler, kanıt düzeyiyle (en güçlüden zayıfa). */
export function testsForStructure(structure: string): Array<{ test: LabTestDef; relation: TestRelation }> {
  const out: Array<{ test: LabTestDef; relation: TestRelation }> = [];
  for (const t of TESTS) {
    const r = CACHE.get(t.key)?.relations.find((x) => x.structure === structure);
    if (r) out.push({ test: t, relation: r });
  }
  return out.sort((a, b) => EVIDENCE_RANK[b.relation.level] - EVIDENCE_RANK[a.relation.level] || a.test.nameTr.localeCompare(b.test.nameTr, 'tr'));
}

export const CURATED_EVIDENCE_KEYS: readonly string[] = Object.keys(CURATED);
