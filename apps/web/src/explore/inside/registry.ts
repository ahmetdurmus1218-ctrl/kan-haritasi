import type { SystemId } from '@kh/catalog';

/**
 * "İçeri gir" sahneleri. Hepsi eğitimsel ve temsilidir: kişinin kendi dokusunun görüntüsü değildir.
 * `ready: false` olan sahneler arayüzde açıkça "HAZIR DEĞİL" olarak gösterilir.
 */
export type InsideId = 'damar' | 'alveol' | 'nefron' | 'lobul' | 'adacik' | 'folikul' | 'ilik' | 'kan';

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
