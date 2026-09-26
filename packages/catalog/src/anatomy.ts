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
  | 'integumentary';

export interface BodySystem {
  id: SystemId;
  nameTr: string;
  color: string;
}

export const SYSTEMS: readonly BodySystem[] = [
  { id: 'cardiovascular', nameTr: 'Kalp ve damarlar', color: '#e5606b' },
  { id: 'respiratory', nameTr: 'Solunum', color: '#8fb8ff' },
  { id: 'digestive', nameTr: 'Sindirim', color: '#e0a15a' },
  { id: 'urinary', nameTr: 'Boşaltım', color: '#d8c35a' },
  { id: 'endocrine', nameTr: 'Endokrin (hormonlar)', color: '#b98cf0' },
  { id: 'nervous', nameTr: 'Sinir sistemi', color: '#f2d7a0' },
  { id: 'musculoskeletal', nameTr: 'Kemik ve kas', color: '#d9d4c7' },
  { id: 'immune', nameTr: 'Bağışıklık', color: '#6fd3a8' },
  { id: 'hematologic', nameTr: 'Kan ve kemik iliği', color: '#ff7a7a' },
  { id: 'integumentary', nameTr: 'Deri', color: '#c9a58f' },
];

export type ModelAsset = 'body' | 'skeleton' | 'cardio' | 'respiratory' | 'digestive' | 'urinary' | 'nervous' | 'immune' | 'schematic';

export interface Structure {
  id: string;
  nameTr: string;
  systems: SystemId[];
  /** Hangi 3D dosyasında; null: modelde yok (arayüz bunu açıkça söyler). */
  asset: ModelAsset | null;
  /** HRA düğüm adlarında aranacak parçalar (küçük harf). */
  modelMatch: string[];
  /** Temsili (şematik) şekil mi? */
  schematic?: boolean;
  /** Bu yapıya "içeri girildiğinde" açılacak alt seviye sahne. */
  drill?: 'vessel' | 'nephron' | 'hepatocyte' | 'alveolus' | 'bone-marrow' | 'beta-cell' | 'thyroid-follicle';
  blurb: string;
}

export const STRUCTURES: readonly Structure[] = [
  { id: 'heart', nameTr: 'Kalp', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['cardiac_atrium', 'ventricle', 'interventricular_septum', '_valve', 'papillary_muscle'], blurb: 'Kanı vücuda ve akciğerlere pompalayan kas organ.' },
  { id: 'coronary-arteries', nameTr: 'Koroner arterler', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['coronary_artery', 'anterior_descending', 'marginal_artery', 'marginal_branch', 'posterior_descending', 'diagonal_branch'], drill: 'vessel', blurb: 'Kalp kasını besleyen damarlar; ateroskleroz en sık burada önem kazanır.' },
  { id: 'aorta', nameTr: 'Aort', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['aorta', 'aortic_arch'], drill: 'vessel', blurb: 'Kalpten çıkan ana atardamar.' },
  { id: 'carotid-arteries', nameTr: 'Şah damarları (karotis)', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['carotid', 'brachiocephalic_artery', 'subclavian_artery'], drill: 'vessel', blurb: 'Beyne kan taşıyan boyun atardamarları.' },
  { id: 'pulmonary-vessels', nameTr: 'Akciğer damarları', systems: ['cardiovascular', 'respiratory'], asset: 'cardio', modelMatch: ['pulmonary_artery', 'pulmonary_trunk', 'pulmonary_vein'], blurb: 'Kanı akciğerlere taşıyıp oksijenlenmiş olarak geri getiren damarlar.' },
  { id: 'veins', nameTr: 'Ana toplardamarlar', systems: ['cardiovascular'], asset: 'cardio', modelMatch: ['vena_cava', 'brachiocephalic_vein', 'iliac_vein', 'cardiac_vein', 'coronary_sinus', 'vein_of_', 'oblique_vein'], blurb: 'Kanı kalbe geri taşıyan büyük toplardamarlar.' },
  { id: 'renal-vessels', nameTr: 'Böbrek damarları', systems: ['cardiovascular', 'urinary'], asset: 'cardio', modelMatch: ['renal_artery', 'renal_vein'], blurb: 'Böbreklere kan getiren ve götüren damarlar.' },
  { id: 'abdominal-vessels', nameTr: 'Karın damarları', systems: ['cardiovascular', 'digestive'], asset: 'cardio', modelMatch: ['mesenteric', 'colic', 'sigmoid', 'rectal', 'celiac', 'hepatic_artery', 'hepatic_vein', 'splenic', 'cystic', 'pancreaticoduodenal', 'sacral', 'pudendal', 'iliac_artery', 'drummond'], blurb: 'Sindirim organlarını besleyen damar ağı.' },
  { id: 'eye-vessels', nameTr: 'Göz damarları', systems: ['cardiovascular', 'nervous'], asset: 'cardio', modelMatch: ['ophthalmic', 'opthalmic', 'retinal', 'ciliary'], blurb: 'Retina ve gözü besleyen çok ince damarlar.' },
  { id: 'lungs', nameTr: 'Akciğerler', systems: ['respiratory'], asset: 'respiratory', modelMatch: ['bronchopulmonary_segment', 'hilum'], drill: 'alveolus', blurb: 'Kana oksijen geçen, karbondioksitin atıldığı organ.' },
  { id: 'airways', nameTr: 'Nefes borusu ve bronşlar', systems: ['respiratory'], asset: 'respiratory', modelMatch: ['trachea', 'bronch', 'cartilage'], blurb: 'Havayı akciğerlere ileten yollar.' },
  { id: 'liver', nameTr: 'Karaciğer', systems: ['digestive'], asset: 'digestive', modelMatch: ['liver', 'hepat', 'caudate', 'quadrate', 'segment', 'porta_hepatis', 'ligament', 'bare_area', 'impression', 'diaphragmatic'], drill: 'hepatocyte', blurb: 'Protein, kolesterol ve pıhtılaşma faktörü üreten; ilaç ve atıkları işleyen organ.' },
  { id: 'gallbladder', nameTr: 'Safra kesesi', systems: ['digestive'], asset: 'digestive', modelMatch: ['gallbladder'], blurb: 'Karaciğerin ürettiği safrayı depolar.' },
  { id: 'pancreas', nameTr: 'Pankreas', systems: ['digestive', 'endocrine'], asset: 'digestive', modelMatch: ['pancrea'], drill: 'beta-cell', blurb: 'Sindirim enzimleri ve kan şekerini düzenleyen insülini üretir.' },
  { id: 'small-intestine', nameTr: 'İnce bağırsak', systems: ['digestive'], asset: 'digestive', modelMatch: ['small_intestine', 'duodenum', 'jejunum', 'ileum'], blurb: 'Besinlerin, demir ve B12 dahil emildiği bölüm.' },
  { id: 'large-intestine', nameTr: 'Kalın bağırsak', systems: ['digestive'], asset: 'digestive', modelMatch: ['colon', 'cecum', 'rectum', 'appendix', 'intestine_large', 'large_intestine'], blurb: 'Su ve tuzların geri emildiği bölüm.' },
  { id: 'kidneys', nameTr: 'Böbrekler', systems: ['urinary'], asset: 'urinary', modelMatch: ['kidney', 'renal_papilla', 'renal_pyramid', 'renal_column', 'cortex_of_kidney', 'hilum_of_kidney'], drill: 'nephron', blurb: 'Kanı süzen, sıvı-tuz dengesini ve atık atılımını düzenleyen organlar.' },
  { id: 'urinary-tract', nameTr: 'Üreterler ve mesane', systems: ['urinary'], asset: 'urinary', modelMatch: ['ureter', 'urinary_bladder', 'bladder'], blurb: 'İdrarı böbreklerden taşıyan ve depolayan yollar.' },
  { id: 'prostate', nameTr: 'Prostat', systems: ['urinary'], asset: 'urinary', modelMatch: ['prostate'], blurb: 'Erkeklerde mesane altındaki bez.' },
  { id: 'brain', nameTr: 'Beyin', systems: ['nervous'], asset: 'nervous', modelMatch: ['brain', 'allen', 'cortex', 'gyrus', 'lobe', 'cerebell', 'thalam', 'hippocamp', 'nucleus', 'ventricle_of_brain'], blurb: 'Sinir sisteminin merkezi.' },
  { id: 'spinal-cord', nameTr: 'Omurilik', systems: ['nervous'], asset: 'nervous', modelMatch: ['spinal_cord', 'spinal', 'cervical', 'thoracic', 'lumbar'], blurb: 'Beyin ile vücut arasında sinyal taşır.' },
  { id: 'bones', nameTr: 'Omurga ve pelvis', systems: ['musculoskeletal', 'hematologic'], asset: 'skeleton', modelMatch: ['vertebra', 'sacrum', 'coccyx', 'pelvi', 'hip_bone', 'ilium', 'ischium', 'pubis', 'femur', 'atlas', 'axis'], drill: 'bone-marrow', blurb: 'Yetişkinde kan yapımının (kemik iliği) büyük kısmı omurga ve pelviste olur.' },
  { id: 'spleen', nameTr: 'Dalak', systems: ['immune', 'hematologic'], asset: 'immune', modelMatch: ['spleen', 'splenic_'], blurb: 'Yaşlanmış alyuvarları ayıklar, bağışıklık hücrelerini barındırır.' },
  { id: 'thymus', nameTr: 'Timus', systems: ['immune'], asset: 'immune', modelMatch: ['thymus'], blurb: 'T lenfositlerinin olgunlaştığı bez.' },
  { id: 'skin', nameTr: 'Deri', systems: ['integumentary'], asset: 'body', modelMatch: ['skin'], blurb: 'Güneş ışığıyla D vitamini yapımının başladığı organ.' },
  // Şematik yapılar (HRA'da model yok; konumu temsil eden basit şekiller)
  { id: 'thyroid', nameTr: 'Tiroid (şematik)', systems: ['endocrine'], asset: 'schematic', modelMatch: ['schematic_thyroid'], schematic: true, drill: 'thyroid-follicle', blurb: 'Boyunda, metabolizmayı düzenleyen T3/T4 hormonlarını üreten bez.' },
  { id: 'pituitary', nameTr: 'Hipofiz (şematik)', systems: ['endocrine', 'nervous'], asset: 'schematic', modelMatch: ['schematic_pituitary'], schematic: true, blurb: 'TSH, prolaktin, ACTH gibi hormonları salgılayan bez.' },
  { id: 'hypothalamus', nameTr: 'Hipotalamus (şematik)', systems: ['endocrine', 'nervous'], asset: 'schematic', modelMatch: ['schematic_hypothalamus'], schematic: true, blurb: 'Hipofizi yöneten beyin bölgesi.' },
  { id: 'adrenals', nameTr: 'Böbreküstü bezleri (şematik)', systems: ['endocrine'], asset: 'schematic', modelMatch: ['schematic_adrenal'], schematic: true, blurb: 'Kortizol ve aldosteron üreten bezler.' },
  { id: 'skeletal-muscle', nameTr: 'İskelet kasları', systems: ['musculoskeletal'], asset: null, modelMatch: [], blurb: 'Hareket kasları. Bu yapı 3D modelde yer almıyor.' },
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
  | 'prostate';

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
