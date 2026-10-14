/**
 * "Vücutta göster" açıklaması konumun NEREDEN geldiğine göre değişir; üç durum birbirine karıştırılmaz.
 *  - model:  gerçek bir tıbbi görüntü modelinin piksel/voksel konumu (yalnızca konum üreten model çalıştıysa).
 *  - region: yalnızca görüntünün ait olduğu organ/bölge biliniyor.
 *  - report: konum rapordaki anatomik ifadeden eşleştirildi.
 *  - precheck: sağ-sol ön kontrolündeki alanın yaklaşık anatomik karşılığı (varsayımla).
 */
export const LOCATION_NOTICE = {
  model: 'Bulgu, görüntü analizinden elde edilen konum bilgisiyle 3B anatomide gösteriliyor.',
  region: 'Bu gösterim görüntünün ait olduğu organı/bölgeyi gösterir; belirli bir bulgunun kesin konumu değildir.',
  report: 'Konum rapordaki anatomik ifadeden eşleştirildi; gerçek piksel koordinatı değildir.',
  precheck: 'Anatomik olarak yaklaşık gösterim: sağ-sol ön kontrolündeki alanın yeri varsayımla eşleştirildi; bir bulgunun konumu değildir.',
} as const;

export type LocationNoticeKind = keyof typeof LOCATION_NOTICE;
