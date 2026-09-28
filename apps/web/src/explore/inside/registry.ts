import type { SystemId } from '@kh/catalog';

/**
 * "İçeri gir" sahneleri. Hepsi eğitimsel ve temsilidir: kişinin kendi dokusunun görüntüsü değildir.
 * `ready: false` olan sahneler arayüzde açıkça "HAZIR DEĞİL" olarak gösterilir.
 */
export type InsideId =
  | 'damar'
  | 'alveol'
  | 'nefron'
  | 'lobul'
  | 'adacik'
  | 'folikul'
  | 'ilik'
  | 'kan'
  | 'noron'
  | 'retina'
  | 'koklea'
  | 'kalpkasi'
  | 'sarkomer'
  | 'osteon'
  | 'mide'
  | 'villus'
  | 'deri'
  | 'hucre'
  | 'hormon'
  | 'lenf'
  | 'ovaryum'
  | 'testis';

export interface InsideScene {
  id: InsideId;
  title: string;
  /** Gezinme yolundaki seviye adları: doku → hücre → süreç. */
  tissue: string;
  cell: string;
  process: string;
  system: SystemId;
  summary: string;
  ready: boolean;
  /** Her yapıdan girilebilen genel sahne (ör. hücre): vurgu rengi girilen yapıdan alınır. */
  generic?: boolean;
}

export const INSIDE: Record<InsideId, InsideScene> = {
  damar: {
    id: 'damar',
    title: 'Damar içi',
    tissue: 'Atardamar duvarı',
    cell: 'Endotel ve kan hücreleri',
    process: 'LDL ve ateroskleroz',
    system: 'cardiovascular',
    summary: 'Plazmada akan alyuvarlar, LDL ve HDL parçacıkları; damar iç yüzeyini döşeyen endotel hücreleri.',
    ready: true,
  },
  alveol: {
    id: 'alveol',
    title: 'Alveol',
    tissue: 'Akciğer dokusu',
    cell: 'Alveol hücreleri',
    process: 'Gaz değişimi',
    system: 'respiratory',
    summary: 'Hava keseciklerinin çevresini saran kılcal ağda oksijenin kana, karbondioksitin havaya geçişi.',
    ready: true,
  },
  nefron: {
    id: 'nefron',
    title: 'Nefron',
    tissue: 'Böbrek dokusu',
    cell: 'Glomerül ve podositler',
    process: 'Süzme (filtrasyon)',
    system: 'urinary',
    summary: 'Glomerül kılcallarından Bowman kapsülüne süzülen sıvı; kreatinin gibi küçük moleküller geçer, hücreler ve büyük proteinler kanda kalır.',
    ready: true,
  },
  lobul: {
    id: 'lobul',
    title: 'Karaciğer lobülü',
    tissue: 'Karaciğer dokusu',
    cell: 'Hepatositler',
    process: 'Karaciğer metabolizması',
    system: 'digestive',
    summary: 'Portal alanlardan gelen kan, hepatosit sıraları arasından merkez vene akar; hepatositler bu sırada kanı işler.',
    ready: true,
  },
  adacik: {
    id: 'adacik',
    title: 'Langerhans adacığı',
    tissue: 'Pankreas dokusu',
    cell: 'Beta hücreleri',
    process: 'İnsülin salgısı',
    system: 'endocrine',
    summary: 'Kan şekeri yükselince beta hücreleri insülin granüllerini kana bırakır; insülin hücrelerin glukoz almasını sağlar.',
    ready: true,
  },
  folikul: {
    id: 'folikul',
    title: 'Tiroid folikülleri',
    tissue: 'Tiroid dokusu',
    cell: 'Folikül hücreleri',
    process: 'Tiroid hormonu yapımı',
    system: 'endocrine',
    summary: 'Folikül hücreleri TSH uyarısıyla koloidde depolanan tiroglobulinden T4 ve T3 üretir.',
    ready: true,
  },
  kan: {
    id: 'kan',
    title: 'Kan hücreleri',
    tissue: 'Kan',
    cell: 'Alyuvar, akyuvar, trombosit',
    process: 'Kan hücrelerinin görevleri',
    system: 'hematologic',
    summary: 'Plazmada süzülen alyuvarlar, beş akyuvar türü ve trombositler. Sayı, boyut ve renkler senin hemogramına göre çizilir.',
    ready: true,
  },
  noron: {
    id: 'noron',
    title: 'Nöron ve sinaps',
    tissue: 'Sinir dokusu',
    cell: 'Nöronlar',
    process: 'Sinir sinyalinin iletimi',
    system: 'nervous',
    summary: 'Nöronlar elektrik sinyalini aksonları boyunca iletir; sinapslarda kimyasal habercilerle bir sonraki hücreye aktarır.',
    ready: true,
  },
  retina: {
    id: 'retina',
    title: 'Retina',
    tissue: 'Retina katmanları',
    cell: 'Çubuk ve koni hücreleri',
    process: 'Işığın algılanması',
    system: 'nervous',
    summary: 'Işık retinanın katmanlarından geçip çubuk ve konilere ulaşır; bu hücreler ışığı sinir sinyaline çevirir.',
    ready: true,
  },
  koklea: {
    id: 'koklea',
    title: 'İç kulak (koklea)',
    tissue: 'Koklea',
    cell: 'Tüy hücreleri',
    process: 'Sesin algılanması',
    system: 'nervous',
    summary: 'Ses titreşimi kokleadaki sıvıyı dalgalandırır; tüy hücrelerinin kirpikleri eğilir ve sinir sinyali doğar.',
    ready: true,
  },
  kalpkasi: {
    id: 'kalpkasi',
    title: 'Kalp kası',
    tissue: 'Miyokard',
    cell: 'Kalp kası hücreleri',
    process: 'Elektriksel uyarı ve kasılma',
    system: 'cardiovascular',
    summary: 'Dallanan kalp kası hücreleri ara disklerle birbirine bağlıdır; elektrik dalgası hücreden hücreye geçer ve kalp bir bütün olarak kasılır.',
    ready: true,
  },
  sarkomer: {
    id: 'sarkomer',
    title: 'Kas lifi ve sarkomer',
    tissue: 'İskelet kası',
    cell: 'Kas lifleri',
    process: 'Kas kasılması',
    system: 'musculoskeletal',
    summary: 'Kas lifleri miyofibrillerden, miyofibriller sarkomerlerden oluşur; miyozin başları aktin iplerini çekerek kası kısaltır.',
    ready: true,
  },
  osteon: {
    id: 'osteon',
    title: 'Kemik dokusu',
    tissue: 'Kompakt kemik',
    cell: 'Osteoblast, osteosit, osteoklast',
    process: 'Kemik yapımı ve yıkımı',
    system: 'musculoskeletal',
    summary: 'Kemik, damar kanallarının çevresinde halkalar (osteonlar) halinde dizilir; osteoblastlar yapar, osteoklastlar yıkar.',
    ready: true,
  },
  mide: {
    id: 'mide',
    title: 'Mide duvarı',
    tissue: 'Mide mukozası',
    cell: 'Mide bezleri',
    process: 'Asit, pepsin ve iç faktör',
    system: 'digestive',
    summary: 'Mide bezlerindeki hücreler asit, pepsin, koruyucu mukus ve B12 emilimi için gereken iç faktörü salgılar.',
    ready: true,
  },
  villus: {
    id: 'villus',
    title: 'Bağırsak villusları',
    tissue: 'İnce bağırsak mukozası',
    cell: 'Enterositler',
    process: 'Besin emilimi',
    system: 'digestive',
    summary: 'Parmak biçimli villuslar ve üzerlerindeki mikrovilluslar emilim yüzeyini yüzlerce kat artırır; besinler kana ve lenfe geçer.',
    ready: true,
  },
  deri: {
    id: 'deri',
    title: 'Deri katmanları',
    tissue: 'Epidermis ve dermis',
    cell: 'Keratinositler, melanositler',
    process: 'Koruma ve D vitamini yapımı',
    system: 'integumentary',
    summary: 'Epidermis sürekli yenilenen koruyucu katmandır; dermiste damarlar, bezler ve kıl kökleri bulunur. Güneşin UVB ışığı D vitamini yapımını başlatır.',
    ready: true,
  },
  hucre: {
    id: 'hucre',
    title: 'Hücre ve enerji',
    tissue: 'Hücre',
    cell: 'Organeller',
    process: 'Hücresel enerji üretimi',
    system: 'hematologic',
    summary: 'Vücuttaki her hücrenin temel yapısı: çekirdek, protein yapım hattı ve enerji (ATP) üreten mitokondriler.',
    ready: true,
    generic: true,
  },
  hormon: {
    id: 'hormon',
    title: 'Hormon salgısı',
    tissue: 'Bez dokusu',
    cell: 'Salgı ve hedef hücreler',
    process: 'Hormonun salgılanması ve etkisi',
    system: 'endocrine',
    summary: 'Bez hücreleri hormonu kana verir; hormon uzaktaki hedef hücrede reseptörüne bağlanarak etki eder ve geri bildirimle düzeyi ayarlanır.',
    ready: true,
  },
  lenf: {
    id: 'lenf',
    title: 'Lenf düğümü ve bağışıklık',
    tissue: 'Lenf dokusu',
    cell: 'T ve B lenfositler',
    process: 'Bağışıklık yanıtı',
    system: 'immune',
    summary: 'Lenf düğümlerinde antijen sunan hücreler T lenfositleri uyarır; B lenfositler çoğalıp antikor üreten plazma hücrelerine dönüşür.',
    ready: true,
  },
  ovaryum: {
    id: 'ovaryum',
    title: 'Yumurtalık ve adet döngüsü',
    tissue: 'Yumurtalık dokusu',
    cell: 'Foliküller ve yumurta hücresi',
    process: 'Yumurtlama ve hormonlar',
    system: 'reproductive',
    summary: 'FSH ile gelişen folikül östrojen üretir; LH dalgası yumurtlamayı başlatır; kalan korpus luteum progesteron salgılar.',
    ready: true,
  },
  testis: {
    id: 'testis',
    title: 'Testis ve sperm yapımı',
    tissue: 'Seminifer tübüller',
    cell: 'Sperm öncülleri, Sertoli ve Leydig hücreleri',
    process: 'Sperm ve testosteron yapımı',
    system: 'reproductive',
    summary: 'Tübüllerde sperm hücreleri olgunlaşır; aralarındaki Leydig hücreleri LH uyarısıyla testosteron üretir.',
    ready: true,
  },
  ilik: {
    id: 'ilik',
    title: 'Kemik iliği',
    tissue: 'Kemik iliği',
    cell: 'Kök hücreler',
    process: 'Kan hücresi yapımı',
    system: 'hematologic',
    summary: 'Kök hücrelerden alyuvar, akyuvar ve trombositlerin olgunlaşıp kana geçişi.',
    ready: true,
  },
};

/** Eski bağlantılar: test kataloğundaki simülasyon kimlikleri. */
export function resolveInside(id: string): { scene: InsideId; startSimulation: boolean } | null {
  if (id === 'ldl-atherosclerosis') return { scene: 'damar', startSimulation: true };
  return id in INSIDE ? { scene: id as InsideId, startSimulation: false } : null;
}
