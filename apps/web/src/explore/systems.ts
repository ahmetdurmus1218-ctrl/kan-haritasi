import { STRUCTURES, type SystemId, systemById } from '@kh/catalog';

/** Sistem seviyesi için kısa editoryal açıklamalar. */
export const SYSTEM_TEXT: Partial<Record<SystemId, string>> = {
  cardiovascular: 'Kalp ve damarlar kanı vücudun her hücresine taşır: oksijen, besin ve hormonlar gider; karbondioksit ve atıklar geri gelir.',
  respiratory: 'Solunum yolları havayı alveollere kadar iletir; orada oksijen kana, karbondioksit havaya geçer.',
  digestive: 'Sindirim sistemi besinleri parçalar ve emer. Karaciğer, emilen maddeleri işleyen ve kanın birçok proteinini üreten merkezdir.',
  urinary: 'Böbrekler kanı süzer, atıkları idrarla uzaklaştırır; sıvı, tuz ve asit–baz dengesini korur.',
  endocrine: 'Hormon bezleri kan yoluyla haberleşir: hipotalamus ve hipofiz diğer bezleri yönetir, geri bildirimle denge kurulur.',
  nervous: 'Beyin ve omurilik vücudun iletişim ağının merkezidir; hormon sistemini de hipotalamus üzerinden yönlendirir.',
  musculoskeletal: 'Kemikler vücudu taşır, mineral depolar ve iliklerinde kan hücrelerini üretir. Kas modeli bu sürümde yok.',
  immune: 'Dalak, timus ve lenf dokusu bağışıklık hücrelerini üretir, olgunlaştırır ve kanı süzer.',
  hematologic: 'Kan hücreleri kemik iliğinde üretilir; dalak yaşlanan hücreleri ayıklar.',
  integumentary: 'Deri vücudu korur, ısıyı düzenler ve D vitamini yapımını başlatır.',
};

/** Menüde gösterilen sistemler (sırasıyla). */
export const MENU_SYSTEMS: SystemId[] = ['cardiovascular', 'respiratory', 'digestive', 'urinary', 'endocrine', 'nervous', 'musculoskeletal', 'immune'];

export function structuresOfSystem(system: SystemId): string[] {
  if (system === 'hematologic') return ['bones', 'spleen'];
  return STRUCTURES.filter((s) => s.asset && s.systems.includes(system) && s.id !== 'skin').map((s) => s.id);
}

export function systemColor(system: SystemId | undefined | null): string {
  return (system && systemById.get(system)?.color) || '#37d6c4';
}

export function isSystemId(v: string | undefined): v is SystemId {
  return !!v && systemById.has(v as SystemId);
}
