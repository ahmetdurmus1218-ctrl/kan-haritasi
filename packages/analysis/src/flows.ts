/**
 * Vücut akışları (fizyoloji): "Besin → mide → duodenum → … → karaciğer" gibi, kullanıcının
 * "Sonraki" ile adım adım izleyebildiği normal işleyiş zincirleri.
 *
 *   PhysiologyFlow  : bir sistemin bir işi (ör. "Bağırsakta emilim")
 *   FlowStep        : tek basamak (normal açıklama, anatomi, ilişkili organlar ve testler)
 *   FlowRelation    : kişinin bir sonucunun bir basamakla İLİŞKİSİ (her zaman "olası ilişki")
 *   PersonalOverlay : akışın üzerine kişinin verisi
 *
 * Kurallar: akışlar genel eğitim bilgisidir (KNOWLEDGE). Kişisel katman yalnızca VERİNİN olduğu
 * basamakları işaretler; verinin desteklemediği basamak "bozuk" gösterilmez. Bir sonucun basamakla
 * ilişkisi POSSIBLE_RELATION'dır ("etkileyebilir"); "bozulmuş" demek için gözlenmiş/doğrulanmış kanıt
 * gerekir ve bu katman bunu asla iddia etmez.
 */
import type { HealthModel } from './fusion';
import { GRAPH } from './knowledge';
import { type LabObservation, type MedicalFinding, type ReportFinding, isPositiveReport } from './types';

export type FlowSystem = 'digestive' | 'cardiovascular' | 'respiratory' | 'urinary' | 'endocrine' | 'nervous' | 'immune' | 'hematologic' | 'musculoskeletal' | 'reproductive';

export interface FlowStep {
  id: string;
  title: string;
  normalExplanation: string;
  /** Bilgi grafiği düğümü ya da 3B yapı kimliği (organ sayfası / 3B için). */
  anatomyId?: string;
  /** Bu basamakta rol alan organlar (organlar arası geçiş bağlantıları). */
  relatedOrgans: string[];
  /** Bu basamakla ilişkili laboratuvar testleri (katalog anahtarı). */
  relatedBiomarkers: string[];
  /** Varsa içine girilebilen eğitsel sahne (ör. 'villus'). */
  inside?: string;
  previous?: string;
  next?: string;
}

export interface PhysiologyFlow {
  id: string;
  system: FlowSystem;
  title: string;
  summary: string;
  steps: FlowStep[];
  /** Kişisel katmanın dürüst özeti: ilişki olabilir, neden kanıtlanmaz. */
  caution: string;
}

export interface FlowRelation {
  stepId: string;
  testKey: string;
  name: string;
  value: number;
  unit: string;
  status: LabObservation['status'];
  severity?: LabObservation['severity'];
  critical?: boolean;
  date: string;
  /** Bu katman yalnızca olası ilişki kurar; "OBSERVED" ancak gerçek bir gözlem/bulgu varsa kullanılır. */
  relation: 'POSSIBLE_RELATION' | 'OBSERVED';
  text: string;
}

/**
 * Bir görüntü/rapor/model bulgusunun bir basamakla ilişkisi (anatomik konum üzerinden). Örn. ileum
 * mukozasında model bulgusu → "İleum: B12 emilimi" basamağı. İlişki olasıdır; işlevin bozulduğu söylenmez.
 */
export interface FlowFindingRelation {
  stepId: string;
  source: 'IMAGE_MODEL' | 'RADIOLOGY_REPORT' | 'OCR';
  derivation: 'model-derived' | 'report-derived';
  text: string;
  relation: 'POSSIBLE_RELATION';
}

export interface PersonalOverlay {
  flowId: string;
  relations: FlowRelation[];
  findings: FlowFindingRelation[];
  /** Aralık dışı sonuç bağlanan basamaklar. */
  flaggedSteps: string[];
  /** Hiç verisi olmayan basamaklar ("veri yok" — bozuk DEĞİL). */
  noDataSteps: string[];
  statement: string;
  hasData: boolean;
}

type S = Omit<FlowStep, 'relatedOrgans' | 'relatedBiomarkers' | 'previous' | 'next'> & { relatedOrgans?: string[]; relatedBiomarkers?: string[] };

function flow(f: Omit<PhysiologyFlow, 'steps'> & { steps: S[] }): PhysiologyFlow {
  const steps = f.steps.map((s, i, all) => ({
    ...s,
    relatedOrgans: s.relatedOrgans ?? (s.anatomyId ? [rootOf(s.anatomyId)] : []),
    relatedBiomarkers: s.relatedBiomarkers ?? [],
    ...(i > 0 ? { previous: all[i - 1]!.id } : {}),
    ...(i < all.length - 1 ? { next: all[i + 1]!.id } : {}),
  }));
  return { ...f, steps };
}

/** Düğümün organı (ör. small-intestine.duodenum → small-intestine); grafikte yoksa kendisi. */
function rootOf(id: string): string {
  const path = GRAPH.pathTo(id);
  return path.find((n) => n.kind === 'organ')?.id ?? path[0]?.id ?? id;
}

const POSSIBLE = 'Bu sonuçlar bu akışın ilgili basamaklarıyla ilişkili olabilir; akışın o noktada bozulduğunu göstermez. Değerlendirme hekime aittir.';

export const FLOWS: readonly PhysiologyFlow[] = [
  flow({
    id: 'digestion',
    system: 'digestive',
    title: 'Sindirim: besinin yolculuğu',
    summary: 'Ağızdan kalın bağırsağa kadar besinin nasıl parçalandığı ve ilerlediği.',
    caution: POSSIBLE,
    steps: [
      { id: 'mouth', title: 'Ağız: çiğneme ve tükürük', normalExplanation: 'Dişler besini küçültür; tükürükteki amilaz nişastayı sindirmeye başlar.', relatedOrgans: [], relatedBiomarkers: ['amylase'] },
      { id: 'swallow', title: 'Yutma ve yemek borusu', normalExplanation: 'Yutulan lokma yemek borusunun kas dalgalarıyla (peristaltizm) mideye iner.', anatomyId: 'esophagus', relatedOrgans: ['esophagus'], inside: 'yemek-borusu' },
      { id: 'stomach', title: 'Mide: asit ve pepsin', normalExplanation: 'Mide asidi ve pepsin proteinleri sindirmeye başlar; iç faktör B12 emilimi için hazırlanır.', anatomyId: 'stomach', inside: 'mide' },
      { id: 'duodenum', title: 'Duodenum: safra ve pankreas enzimleri', normalExplanation: 'Karaciğerden gelen safra yağları küçük damlalara ayırır; pankreas enzimleri (amilaz, lipaz, proteaz) sindirimi sürdürür.', anatomyId: 'small-intestine.duodenum', relatedOrgans: ['small-intestine', 'liver', 'pancreas'], relatedBiomarkers: ['lipase', 'amylase'] },
      { id: 'jejunum', title: 'Jejunum: sindirim tamamlanır, emilim', normalExplanation: 'Besinler son yapı taşlarına (şeker, amino asit, yağ asidi) ayrılır ve villuslardan emilir.', anatomyId: 'small-intestine.jejunum', relatedBiomarkers: ['folate'], inside: 'villus' },
      { id: 'ileum', title: 'İleum: B12 ve safra asitleri', normalExplanation: 'B12 (iç faktörle birlikte) ve safra asitleri burada geri emilir.', anatomyId: 'small-intestine.ileum', relatedBiomarkers: ['b12'] },
      { id: 'colon', title: 'Kalın bağırsak: su ve tuz', normalExplanation: 'Suyun ve tuzların çoğu geri emilir; bakteriler bazı lifleri işler; dışkı oluşur.', anatomyId: 'large-intestine', inside: 'kalin-bagirsak' },
    ],
  }),
  flow({
    id: 'intestinal-absorption',
    system: 'digestive',
    title: 'Bağırsakta emilim: besinden kana',
    summary: 'Sindirilen besinin villuslardan kana ve lenfe, oradan karaciğere ve dolaşıma geçişi.',
    caution: 'Bu sonuçlar bağırsak emilimiyle ilişkili olabilir; ancak tek başına bağırsak emilim bozukluğunu kanıtlamaz.',
    steps: [
      { id: 'food', title: 'Besin', normalExplanation: 'Yediklerimiz karbonhidrat, protein, yağ, vitamin ve mineral içerir.', relatedOrgans: [] },
      { id: 'stomach', title: 'Mide', normalExplanation: 'Asit ve pepsin besini parçalar, içerik yavaşça bağırsağa geçer.', anatomyId: 'stomach', inside: 'mide' },
      { id: 'duodenum', title: 'Duodenum', normalExplanation: 'Mideden gelen asitli içerik nötrlenir; demir en çok burada emilir.', anatomyId: 'small-intestine.duodenum' },
      { id: 'enzymes', title: 'Safra + pankreas enzimleri', normalExplanation: 'Safra yağları emülsiyon haline getirir; pankreas enzimleri karbonhidrat, protein ve yağları parçalar.', anatomyId: 'pancreas', relatedOrgans: ['pancreas', 'liver'], relatedBiomarkers: ['lipase', 'amylase'], inside: 'pankreas-asinus' },
      { id: 'digestion', title: 'Sindirim', normalExplanation: 'Moleküller emilebilecek kadar küçülür: glukoz, amino asitler, yağ asitleri.', anatomyId: 'small-intestine' },
      { id: 'villus', title: 'Villus', normalExplanation: 'Parmak biçimli villuslar ve mikrovilluslar emilim yüzeyini yüzlerce kat artırır.', anatomyId: 'tissue.villus', relatedOrgans: ['small-intestine'], inside: 'villus' },
      { id: 'absorption', title: 'Emilim (enterosit)', normalExplanation: 'Enterositler taşıyıcı proteinlerle besinleri, vitaminleri ve minerali içeri alıp kana/lenfe verir.', anatomyId: 'cell.enterocyte', relatedOrgans: ['small-intestine'], relatedBiomarkers: ['ferritin', 'iron', 'b12', 'folate'], inside: 'villus' },
      { id: 'capillary', title: 'Kılcal damar / lenf', normalExplanation: 'Şeker ve amino asitler kılcallara, yağlar lenf kanalına (lakteal) geçer.', anatomyId: 'tissue.villus-capillary', relatedOrgans: ['small-intestine'], relatedBiomarkers: ['triglyceride'] },
      { id: 'portal', title: 'Portal ven', normalExplanation: 'Bağırsaktan gelen kan önce portal venle karaciğere taşınır.', anatomyId: 'abdominal-vessels', relatedOrgans: ['abdominal-vessels'] },
      { id: 'liver', title: 'Karaciğer', normalExplanation: 'Karaciğer gelen besinleri işler, depolar (glikojen) ve proteinler (albümin) üretir.', anatomyId: 'liver', relatedBiomarkers: ['albumin', 'total-protein'], inside: 'lobul' },
      { id: 'circulation', title: 'Dolaşım', normalExplanation: 'İşlenen besinler kanla tüm hücrelere ulaşır.', anatomyId: 'heart', relatedOrgans: ['heart'], relatedBiomarkers: ['glucose'] },
    ],
  }),
  flow({
    id: 'iron-absorption',
    system: 'hematologic',
    title: 'Demir: bağırsaktan hemoglobine',
    summary: 'Besindeki demirin emilip depolanması ve alyuvar yapımında kullanılması.',
    caution: 'Bu sonuçlar demir eksikliğiyle uyumlu olabilir; nedenini (yetersiz alım, emilim, kan kaybı vb.) tek başına belirlemez. Sorunun bağırsakta olduğunu göstermez.',
    steps: [
      { id: 'diet', title: 'Besindeki demir', normalExplanation: 'Et, baklagil ve yeşil sebzelerdeki demir; C vitamini emilimi kolaylaştırır.', relatedOrgans: [] },
      { id: 'acid', title: 'Mide asidi', normalExplanation: 'Asit demiri emilebilir (iki değerlikli) hale getirir.', anatomyId: 'stomach' },
      { id: 'duodenum', title: 'Duodenum ve villus', normalExplanation: 'Demir en çok on iki parmak bağırsağında emilir.', anatomyId: 'small-intestine.duodenum', inside: 'villus' },
      { id: 'enterocyte', title: 'Enterosit', normalExplanation: 'Hücre demiri DMT1 ile içeri alır, ferroportin ile kana verir; vücut ihtiyaca göre bu kapıyı açıp kapar (hepsidin).', anatomyId: 'cell.enterocyte', relatedOrgans: ['small-intestine'] },
      { id: 'transport', title: 'Kanda taşınma (transferrin)', normalExplanation: 'Demir kanda transferrin proteinine bağlı taşınır.', relatedOrgans: [], relatedBiomarkers: ['iron', 'transferrin-saturation', 'tibc'] },
      { id: 'storage', title: 'Depolanma (ferritin)', normalExplanation: 'Fazla demir karaciğer ve dalakta ferritin olarak depolanır.', anatomyId: 'liver', relatedOrgans: ['liver', 'spleen'], relatedBiomarkers: ['ferritin'] },
      { id: 'marrow', title: 'Kemik iliği: alyuvar yapımı', normalExplanation: 'Kemik iliği demiri hemoglobin yapımında kullanır; B12 ve folat da gerekir.', anatomyId: 'bones', relatedBiomarkers: ['b12', 'folate'], inside: 'ilik' },
      { id: 'hemoglobin', title: 'Hemoglobin', normalExplanation: 'Alyuvarlardaki hemoglobin oksijeni akciğerden dokulara taşır.', relatedOrgans: ['bones'], relatedBiomarkers: ['hemoglobin', 'mcv', 'rbc'], inside: 'kan' },
    ],
  }),
  flow({
    id: 'circulation',
    system: 'cardiovascular',
    title: 'Kalp ve dolaşım',
    summary: 'Kanın kalbin dört odacığından geçip akciğerlere ve tüm vücuda pompalanması.',
    caution: POSSIBLE,
    steps: [
      { id: 'vena-cava', title: 'Vena cava', normalExplanation: 'Vücuttan dönen oksijeni azalmış kan ana toplardamarlarla kalbe gelir.', anatomyId: 'veins', relatedOrgans: ['veins'] },
      { id: 'right-atrium', title: 'Sağ atrium', normalExplanation: 'Kan sağ kulakçıkta toplanır; sinüs düğümü her atımı buradan başlatır.', anatomyId: 'heart', relatedBiomarkers: ['potassium'] },
      { id: 'right-ventricle', title: 'Sağ ventrikül', normalExplanation: 'Sağ karıncık kanı akciğer atardamarına pompalar.', anatomyId: 'heart' },
      { id: 'lungs', title: 'Akciğer', normalExplanation: 'Kan alveollerin çevresinde oksijen alır, karbondioksit bırakır.', anatomyId: 'lungs', relatedOrgans: ['lungs', 'pulmonary-vessels'], relatedBiomarkers: ['hemoglobin'], inside: 'alveol' },
      { id: 'left-atrium', title: 'Sol atrium', normalExplanation: 'Oksijenlenmiş kan akciğer toplardamarlarıyla sol kulakçığa döner.', anatomyId: 'heart' },
      { id: 'left-ventricle', title: 'Sol ventrikül', normalExplanation: 'En kalın duvarlı odacık kanı yüksek basınçla aorta pompalar.', anatomyId: 'heart.left-ventricle', relatedOrgans: ['heart'], inside: 'kalpkasi' },
      { id: 'aorta', title: 'Aort', normalExplanation: 'Ana atardamar kanı dallarıyla tüm vücuda dağıtır.', anatomyId: 'aorta', relatedOrgans: ['aorta'], relatedBiomarkers: ['ldl'], inside: 'damar' },
      { id: 'tissues', title: 'Dokular', normalExplanation: 'Kılcallarda oksijen ve besin hücrelere geçer; atıklar kana alınır.', relatedOrgans: [] },
    ],
  }),
  flow({
    id: 'respiration',
    system: 'respiratory',
    title: 'Solunum: havadan kana',
    summary: 'Havanın akciğerlere ulaşması ve oksijen–karbondioksit değişimi.',
    caution: POSSIBLE,
    steps: [
      { id: 'air', title: 'Hava', normalExplanation: 'Solunan hava yaklaşık %21 oksijen içerir.', relatedOrgans: [] },
      { id: 'nose', title: 'Burun / ağız', normalExplanation: 'Burun havayı ısıtır, nemlendirir ve süzer.', relatedOrgans: [] },
      { id: 'trachea', title: 'Trakea', normalExplanation: 'Nefes borusu havayı göğüs boşluğuna iletir; kirpikli hücreler mukusu yukarı süpürür.', anatomyId: 'airways', relatedOrgans: ['airways'], inside: 'solunum-yolu' },
      { id: 'bronchi', title: 'Bronşlar', normalExplanation: 'Nefes borusu iki ana bronşa, sonra giderek daralan dallara ayrılır.', anatomyId: 'airways', relatedOrgans: ['airways', 'lungs'] },
      { id: 'bronchioles', title: 'Bronşioller', normalExplanation: 'En ince hava yolları; düz kas çapı ayarlar.', anatomyId: 'lungs' },
      { id: 'alveoli', title: 'Alveoller', normalExplanation: 'Milyonlarca hava keseciği; duvarı tek hücre kalınlığındadır.', anatomyId: 'tissue.alveolus', relatedOrgans: ['lungs'], inside: 'alveol' },
      { id: 'oxygen', title: 'O₂ kana', normalExplanation: 'Oksijen alveolden kılcala geçip hemoglobine bağlanır.', relatedOrgans: ['lungs'], relatedBiomarkers: ['hemoglobin'] },
      { id: 'co2', title: 'CO₂ dışarı', normalExplanation: 'Hücrelerin ürettiği karbondioksit ters yönde alveole geçip solunan havayla atılır.', relatedOrgans: ['lungs'] },
    ],
  }),
  flow({
    id: 'kidney-filtration',
    system: 'urinary',
    title: 'Böbrek: kandan idrara',
    summary: 'Kanın süzülmesi, gerekli maddelerin geri alınması ve idrarın oluşması.',
    caution: POSSIBLE,
    steps: [
      { id: 'blood', title: 'Kan', normalExplanation: 'Kalbin pompaladığı kanın yaklaşık beşte biri böbreklere gelir.', anatomyId: 'renal-vessels', relatedOrgans: ['renal-vessels'] },
      { id: 'glomerulus', title: 'Glomerül', normalExplanation: 'Kılcal yumak; podositler süzgeç gibi çalışır.', anatomyId: 'cell.podocyte', relatedOrgans: ['kidneys'], inside: 'nefron' },
      { id: 'filtration', title: 'Filtrasyon', normalExplanation: 'Dakikada yaklaşık 90–120 mL plazma süzülür; hücreler ve büyük proteinler kanda kalır.', anatomyId: 'tissue.nephron', relatedOrgans: ['kidneys'], relatedBiomarkers: ['creatinine', 'egfr', 'urea'] },
      { id: 'tubule', title: 'Tübül', normalExplanation: 'Süzüntü uzun bir kanaldan geçer.', anatomyId: 'tissue.nephron', relatedOrgans: ['kidneys'] },
      { id: 'reabsorption', title: 'Geri emilim', normalExplanation: 'Su, sodyum, glukoz ve gerekli maddeler kana geri alınır; potasyum ve asit dengesi ayarlanır.', relatedOrgans: ['kidneys'], relatedBiomarkers: ['sodium', 'potassium'] },
      { id: 'urine', title: 'İdrar', normalExplanation: 'Kalan sıvı idrar olarak mesaneye iner.', anatomyId: 'urinary-tract', relatedOrgans: ['urinary-tract'], inside: 'mesane' },
    ],
  }),
  flow({
    id: 'glucose-insulin',
    system: 'endocrine',
    title: 'Kan şekeri: pankreastan hücreye',
    summary: 'Yemekten sonra yükselen kan şekerinin insülinle hücrelere alınması.',
    caution: 'Bu sonuçlar kan şekeri düzenlemesiyle ilişkili olabilir; tek başına bir tanı değildir. Önemini hekimin değerlendirir.',
    steps: [
      { id: 'glucose', title: 'Glukoz', normalExplanation: 'Yemekten sonra bağırsaktan emilen glukoz kan şekerini yükseltir.', relatedOrgans: ['small-intestine'], relatedBiomarkers: ['glucose', 'hba1c'] },
      { id: 'pancreas', title: 'Pankreas', normalExplanation: 'Langerhans adacıklarındaki beta hücreleri yükselen şekeri algılar.', anatomyId: 'pancreas.endocrine', relatedOrgans: ['pancreas'], inside: 'adacik' },
      { id: 'insulin', title: 'İnsülin', normalExplanation: 'Beta hücreleri insülini kana bırakır.', anatomyId: 'cell.beta', relatedOrgans: ['pancreas'], relatedBiomarkers: ['insulin'] },
      { id: 'cell', title: 'Hücre', normalExplanation: 'İnsülin kas, yağ ve karaciğer hücrelerindeki kapıları (GLUT4) açar.', relatedOrgans: ['skeletal-muscle', 'liver'], inside: 'hucre' },
      { id: 'use', title: 'Glukoz kullanımı', normalExplanation: 'Hücreler glukozu yakar (ATP) ya da glikojen/yağ olarak depolar; kan şekeri düşer.', relatedOrgans: [], relatedBiomarkers: ['hba1c', 'triglyceride'] },
    ],
  }),
  flow({
    id: 'pancreas-enzymes',
    system: 'digestive',
    title: 'Pankreas enzimleri: sindirim',
    summary: 'Pankreasın ekzokrin bölümünün sindirim enzimleri.',
    caution: POSSIBLE,
    steps: [
      { id: 'pancreas', title: 'Pankreas', normalExplanation: 'Asiner hücreler sindirim enzimlerini üretir.', anatomyId: 'pancreas.exocrine', relatedOrgans: ['pancreas'], inside: 'pankreas-asinus' },
      { id: 'enzymes', title: 'Amilaz / Lipaz / Proteaz', normalExplanation: 'Amilaz nişastayı, lipaz yağları, proteazlar proteinleri parçalar; kanallarla duodenuma akar.', anatomyId: 'pancreas.exocrine', relatedOrgans: ['pancreas'], relatedBiomarkers: ['amylase', 'lipase'] },
      { id: 'digestion', title: 'Sindirim', normalExplanation: 'Enzimler duodenumda besinleri emilebilecek parçalara ayırır.', anatomyId: 'small-intestine.duodenum' },
      { id: 'absorption', title: 'Besin emilimi', normalExplanation: 'Parçalanan besinler ince bağırsaktan emilir.', anatomyId: 'small-intestine', inside: 'villus' },
    ],
  }),
  flow({
    id: 'endocrine-axis',
    system: 'endocrine',
    title: 'Hormon ekseni (örnek: tiroid)',
    summary: 'Beyindeki merkezlerden bezlere ve hedef dokulara hormon zinciri ve geri bildirim.',
    caution: POSSIBLE,
    steps: [
      { id: 'hypothalamus', title: 'Hipotalamus', normalExplanation: 'Vücudun ihtiyacını algılar, hipofize serbestleştirici hormon (TRH) gönderir.', anatomyId: 'hypothalamus', relatedOrgans: ['hypothalamus'] },
      { id: 'pituitary', title: 'Hipofiz', normalExplanation: 'Uyarıcı hormonu (TSH) kana verir.', anatomyId: 'pituitary', relatedOrgans: ['pituitary'], relatedBiomarkers: ['tsh'], inside: 'hipofiz' },
      { id: 'gland', title: 'Hedef bez (tiroid)', normalExplanation: 'TSH tiroid foliküllerini uyarır.', anatomyId: 'thyroid', inside: 'folikul' },
      { id: 'hormone', title: 'Hormon (T4 / T3)', normalExplanation: 'Tiroid T4 ve T3 hormonlarını kana verir.', anatomyId: 'tissue.thyroid-follicle', relatedOrgans: ['thyroid'], relatedBiomarkers: ['ft4', 'ft3'] },
      { id: 'target', title: 'Hedef doku', normalExplanation: 'Hormon hücrelerin enerji harcama hızını artırır.', relatedOrgans: [], inside: 'hormon' },
      { id: 'feedback', title: 'Negatif geri bildirim', normalExplanation: 'Hormon yükselince hipotalamus ve hipofiz yavaşlar; düzey dengede kalır.', relatedOrgans: ['pituitary', 'hypothalamus'], relatedBiomarkers: ['tsh'] },
    ],
  }),
  flow({
    id: 'nervous',
    system: 'nervous',
    title: 'Sinir sistemi: duyudan yanıta',
    summary: 'Bir uyarının algılanıp beyinde işlenmesi ve yanıta dönüşmesi.',
    caution: POSSIBLE,
    steps: [
      { id: 'sense', title: 'Duyu', normalExplanation: 'Göz, kulak, deri gibi alıcılar uyarıyı elektrik sinyaline çevirir.', relatedOrgans: ['eyes', 'ear', 'skin'], inside: 'retina' },
      { id: 'pathways', title: 'Sinir yolları', normalExplanation: 'Sinyal miyelinli sinir lifleriyle omurilik ve beyne iletilir; B12 miyelin için gereklidir.', anatomyId: 'nerves', relatedOrgans: ['nerves', 'spinal-cord'], relatedBiomarkers: ['b12'], inside: 'noron' },
      { id: 'regions', title: 'Beyin bölgeleri', normalExplanation: 'Talamus sinyali ilgili kortekse aktarır (görme arka lobda, dokunma yan lobda…).', anatomyId: 'brain.thalamus', relatedOrgans: ['brain'] },
      { id: 'processing', title: 'İşleme', normalExplanation: 'Alın lobu bilgiyi değerlendirir, karar verir; bellek ve duygular katkıda bulunur.', anatomyId: 'brain.frontal', relatedOrgans: ['brain'], relatedBiomarkers: ['sodium', 'glucose'] },
      { id: 'response', title: 'Motor / otonom / bilişsel yanıt', normalExplanation: 'Motor korteks kaslara komut gönderir; beyin sapı kalp ve solunumu ayarlar.', anatomyId: 'brain.pons', relatedOrgans: ['brain', 'skeletal-muscle'] },
    ],
  }),
  flow({
    id: 'immune',
    system: 'immune',
    title: 'Bağışıklık yanıtı',
    summary: 'Bir mikrobun vücuda girmesinden antikor ve belleğe kadar.',
    caution: 'Bu sonuçlar bir inflamasyon/bağışıklık yanıtıyla ilişkili olabilir; nedenini ve yerini göstermez.',
    steps: [
      { id: 'entry', title: 'Mikrop girişi', normalExplanation: 'Deri ve mukozalar ilk bariyerdir; aşılırsa bağışıklık devreye girer.', relatedOrgans: ['skin'], inside: 'deri' },
      { id: 'innate', title: 'Doğal bağışıklık', normalExplanation: 'Nötrofil ve makrofajlar mikrobu yutar, haberci moleküller salgılar.', relatedOrgans: [], relatedBiomarkers: ['wbc'], inside: 'kan' },
      { id: 'inflammation', title: 'İnflamasyon', normalExplanation: 'Karaciğer CRP gibi akut faz proteinleri üretir; ateş ve kızarıklık olabilir.', anatomyId: 'liver', relatedOrgans: ['liver'], relatedBiomarkers: ['crp', 'hs-crp', 'esr'] },
      { id: 'lymph', title: 'Lenf düğümü', normalExplanation: 'Antijen sunan hücreler mikrop parçalarını lenf düğümüne taşır.', anatomyId: 'lymph-node', relatedOrgans: ['lymph-node', 'spleen'], inside: 'lenf' },
      { id: 'lymphocytes', title: 'T ve B lenfositler', normalExplanation: 'Uyarılan T hücreleri saldırıyı yönetir; B hücreleri çoğalır.', relatedOrgans: ['lymph-node', 'thymus'], relatedBiomarkers: ['wbc'] },
      { id: 'antibody', title: 'Antikor ve bellek', normalExplanation: 'Plazma hücreleri antikor üretir; bellek hücreleri bir sonraki karşılaşmada hızlı yanıt sağlar.', relatedOrgans: ['lymph-node'] },
    ],
  }),
  flow({
    id: 'blood-cells',
    system: 'hematologic',
    title: 'Alyuvarın yaşamı',
    summary: 'Kemik iliğinde yapımdan dalakta yıkıma kadar alyuvarlar.',
    caution: POSSIBLE,
    steps: [
      { id: 'stem', title: 'Kemik iliği kök hücresi', normalExplanation: 'Tüm kan hücreleri kemik iliğindeki kök hücrelerden gelir.', anatomyId: 'bones', inside: 'ilik' },
      { id: 'epo', title: 'EPO uyarısı (böbrek)', normalExplanation: 'Oksijen azalınca böbrek eritropoietin salgılar ve alyuvar yapımını hızlandırır.', anatomyId: 'kidneys', relatedOrgans: ['kidneys'] },
      { id: 'production', title: 'Alyuvar yapımı', normalExplanation: 'Demir, B12 ve folat kullanılarak hemoglobin dolu alyuvarlar üretilir.', anatomyId: 'bones', relatedBiomarkers: ['ferritin', 'b12', 'folate', 'rdw'] },
      { id: 'circulation', title: 'Dolaşım (~120 gün)', normalExplanation: 'Alyuvarlar yaklaşık 120 gün boyunca oksijen taşır.', relatedOrgans: ['heart'], relatedBiomarkers: ['hemoglobin', 'rbc', 'mcv', 'hematocrit'], inside: 'kan' },
      { id: 'breakdown', title: 'Yıkım (dalak)', normalExplanation: 'Yaşlanan alyuvarlar dalakta yıkılır; demir geri kazanılır.', anatomyId: 'spleen', relatedOrgans: ['spleen'], inside: 'dalak' },
      { id: 'bilirubin', title: 'Bilirubin (karaciğer)', normalExplanation: 'Hemoglobinin yıkım ürünü bilirubin karaciğerde işlenip safrayla atılır.', anatomyId: 'liver', relatedBiomarkers: ['bilirubin-total', 'bilirubin-indirect'] },
    ],
  }),
  flow({
    id: 'muscle',
    system: 'musculoskeletal',
    title: 'Kas kasılması',
    summary: 'Sinir uyarısından kasın kasılıp gevşemesine.',
    caution: POSSIBLE,
    steps: [
      { id: 'signal', title: 'Sinir uyarısı', normalExplanation: 'Motor sinir kasa elektrik sinyali gönderir.', anatomyId: 'nerves', relatedOrgans: ['nerves'], relatedBiomarkers: ['potassium'], inside: 'noron' },
      { id: 'junction', title: 'Sinir-kas kavşağı', normalExplanation: 'Asetilkolin kas zarını uyarır.', relatedOrgans: ['skeletal-muscle'], relatedBiomarkers: ['magnesium'] },
      { id: 'calcium', title: 'Kalsiyum salınımı', normalExplanation: 'Kas hücresinin deposundan kalsiyum salınır.', relatedOrgans: ['skeletal-muscle'], relatedBiomarkers: ['calcium'] },
      { id: 'sliding', title: 'Aktin–miyozin kayması', normalExplanation: 'Miyozin başları ATP kullanarak aktin iplerini çeker; sarkomer kısalır.', anatomyId: 'skeletal-muscle', relatedOrgans: ['skeletal-muscle'], inside: 'sarkomer' },
      { id: 'contraction', title: 'Kasılma', normalExplanation: 'Binlerce sarkomer birlikte kısalınca kas kasılır.', anatomyId: 'skeletal-muscle', relatedOrgans: ['skeletal-muscle'], relatedBiomarkers: ['ck'] },
      { id: 'relax', title: 'Gevşeme', normalExplanation: 'Kalsiyum depoya geri pompalanır, kas gevşer.', relatedOrgans: ['skeletal-muscle'] },
    ],
  }),
  flow({
    id: 'reproductive-cycle',
    system: 'reproductive',
    title: 'Adet döngüsü hormonları',
    summary: 'Beyin, yumurtalık ve rahim arasındaki aylık hormon döngüsü.',
    caution: 'Bu sonuçlar döngünün ilgili evresiyle ilişkili olabilir; hormon düzeyleri döngü gününe göre değişir ve tek başına yorumlanmaz.',
    steps: [
      { id: 'hypothalamus', title: 'Hipotalamus (GnRH)', normalExplanation: 'Hipotalamus GnRH ile hipofizi uyarır.', anatomyId: 'hypothalamus', relatedOrgans: ['hypothalamus'] },
      { id: 'pituitary', title: 'Hipofiz (FSH, LH)', normalExplanation: 'FSH foliküllerin gelişimini, LH yumurtlamayı başlatır.', anatomyId: 'pituitary', relatedOrgans: ['pituitary'], relatedBiomarkers: ['fsh', 'lh'], inside: 'hipofiz' },
      { id: 'ovary', title: 'Yumurtalık: folikül ve östrojen', normalExplanation: 'Gelişen folikül östrojen üretir.', anatomyId: 'ovaries', relatedOrgans: ['ovaries'], relatedBiomarkers: ['estradiol'], inside: 'ovaryum' },
      { id: 'ovulation', title: 'Yumurtlama', normalExplanation: 'LH dalgası olgun folikülü çatlatır, yumurta tüpe geçer.', anatomyId: 'ovaries', relatedOrgans: ['ovaries', 'fallopian-tubes'], relatedBiomarkers: ['lh'] },
      { id: 'luteum', title: 'Korpus luteum (progesteron)', normalExplanation: 'Kalan yapı progesteron salgılar.', anatomyId: 'ovaries', relatedOrgans: ['ovaries'], relatedBiomarkers: ['progesterone'] },
      { id: 'uterus', title: 'Rahim iç tabakası', normalExplanation: 'Östrojen ve progesteron rahim iç tabakasını hazırlar; gebelik olmazsa adet kanaması olur.', anatomyId: 'uterus', relatedOrgans: ['uterus'], inside: 'rahim' },
    ],
  }),
];

export const FLOW_SYSTEM_LABEL: Record<FlowSystem, string> = {
  digestive: 'Sindirim',
  cardiovascular: 'Dolaşım',
  respiratory: 'Solunum',
  nervous: 'Sinir sistemi',
  endocrine: 'Hormonlar',
  urinary: 'Böbrek / idrar',
  immune: 'Bağışıklık',
  hematologic: 'Kan',
  musculoskeletal: 'Kas',
  reproductive: 'Üreme',
};

const byId = new Map(FLOWS.map((f) => [f.id, f]));

export function flowById(id: string): PhysiologyFlow | undefined {
  return byId.get(id);
}

/** Bir organın rol aldığı akışlar (organ sayfasındaki "Fizyolojiyi adım adım incele"). */
export function flowsForOrgan(organId: string): PhysiologyFlow[] {
  const root = rootOf(organId);
  // Basamağın anatomisi organın kendisiyse 2, organ yalnızca "ilgili organ" ise 1 puan.
  const score = (f: PhysiologyFlow) =>
    f.steps.reduce((sum, s) => sum + (s.anatomyId && (s.anatomyId === organId || rootOf(s.anatomyId) === root) ? 2 : s.relatedOrgans.includes(root) || s.relatedOrgans.includes(organId) ? 1 : 0), 0);
  return FLOWS.map((f, i) => ({ f, i, n: score(f) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.f);
}

/**
 * Organlar arası akış: organın akışlardaki komşuları (ör. İnce bağırsak: Mide → İnce bağırsak →
 * Karaciğer). Her akış için organ sırası çıkarılır, organdan bir önceki ve bir sonraki organ alınır.
 */
export function organNeighbors(organId: string): Array<{ flow: PhysiologyFlow; before?: string; after?: string }> {
  const root = rootOf(organId);
  const out: Array<{ flow: PhysiologyFlow; before?: string; after?: string }> = [];
  for (const f of flowsForOrgan(organId)) {
    const seq: string[] = [];
    for (const s of f.steps) {
      const o = s.anatomyId ? rootOf(s.anatomyId) : s.relatedOrgans[0];
      if (o && seq[seq.length - 1] !== o) seq.push(o);
    }
    const i = seq.indexOf(root);
    if (i < 0) continue;
    const before = seq[i - 1];
    const after = seq[i + 1];
    if (before || after) out.push({ flow: f, ...(before ? { before } : {}), ...(after ? { after } : {}) });
  }
  return out;
}

const STATUS_TR: Record<LabObservation['status'], string> = { low: 'düşük', high: 'yüksek', normal: 'aralıkta', unknown: 'aralık yok' };

/**
 * Akışın üzerine kişinin son sonuçları. Yalnızca VERİ olan basamaklar işaretlenir; ilişki her zaman
 * "olası" (POSSIBLE_RELATION) — bir sonucun bir basamağı "bozduğu" söylenmez.
 */
/** Bulgunun anatomik yolu basamağın anatomisine denk geliyor mu? (tam yapı ya da organın kendisi) */
function findingMatchesStep(path: readonly string[], step: FlowStep): boolean {
  if (!step.anatomyId || !path.length) return false;
  if (path.includes(step.anatomyId)) return true;
  const n = GRAPH.node(step.anatomyId);
  return Boolean(n && n.kind === 'organ' && rootOf(path[path.length - 1]!) === step.anatomyId);
}

export function personalOverlay(flow: PhysiologyFlow, model: (Pick<HealthModel, 'latestLabs'> & Partial<Pick<HealthModel, 'reportFindings' | 'modelFindings'>>) | null): PersonalOverlay {
  const labs = new Map((model?.latestLabs ?? []).map((l) => [l.testKey, l]));
  const relations: FlowRelation[] = [];
  for (const s of flow.steps)
    for (const key of s.relatedBiomarkers) {
      const l = labs.get(key);
      if (!l) continue;
      const off = l.status === 'high' || l.status === 'low';
      relations.push({
        stepId: s.id,
        testKey: key,
        name: l.name,
        value: l.value,
        unit: l.unit,
        status: l.status,
        ...(l.severity ? { severity: l.severity } : {}),
        ...(l.critical ? { critical: true } : {}),
        date: l.date,
        relation: 'POSSIBLE_RELATION',
        text: off ? `${l.name} ${STATUS_TR[l.status]}: bu basamağı etkileyebilir (olası ilişki; kanıtlanmış değil).` : `${l.name} aralıkta.`,
      });
    }
  const findings: FlowFindingRelation[] = [];
  const located: Array<{ path: string[]; f: MedicalFinding | ReportFinding }> = [
    ...(model?.modelFindings ?? []).filter((f) => f.anatomicalStructure?.path.length).map((f) => ({ path: f.anatomicalStructure!.path, f })),
    ...(model?.reportFindings ?? []).filter((f) => isPositiveReport(f) && f.location?.path.length).map((f) => ({ path: f.location!.path, f })),
  ];
  for (const s of flow.steps)
    for (const { path, f } of located) {
      if (!findingMatchesStep(path, s)) continue;
      const fromModel = 'finding' in f;
      findings.push({
        stepId: s.id,
        source: fromModel ? 'IMAGE_MODEL' : f.source,
        derivation: fromModel ? 'model-derived' : 'report-derived',
        text: fromModel ? `Yerel tıbbi AI modeli: ${f.finding} — bu basamakla ilişkili olabilir (tanı değildir).` : `Rapor: “${f.text}” — bu basamakla ilişkili olabilir.`,
        relation: 'POSSIBLE_RELATION',
      });
    }
  const flaggedSteps = [...new Set([...relations.filter((r) => r.status === 'high' || r.status === 'low').map((r) => r.stepId), ...findings.map((f) => f.stepId)])];
  const noDataSteps = flow.steps.filter((s) => !relations.some((r) => r.stepId === s.id) && !findings.some((r) => r.stepId === s.id)).map((s) => s.id);
  const hasData = relations.length + findings.length > 0;
  return {
    flowId: flow.id,
    relations,
    findings,
    flaggedSteps,
    noDataSteps,
    statement: !hasData
      ? 'Bu akışla ilişkili bir sonucun yok. Verisi olmayan basamaklar “sorunlu” sayılmaz.'
      : flaggedSteps.length
        ? flow.caution
        : 'Bu akışla ilişkili sonuçların aralıkta. Bu, akışın her basamağının değerlendirildiği anlamına gelmez.',
    hasData,
  };
}
