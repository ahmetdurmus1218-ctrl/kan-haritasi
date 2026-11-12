/**
 * 3B model kaynakları: her mesh'in glTF düğümünde kısa bir kaynak kodu (`src`) bulunur; ad, lisans ve
 * bağlantı buradan okunur. Lisans metinleri ve değişiklikler: public/models/ATTRIBUTION.txt.
 */
export interface ModelSource {
  name: string;
  license: string;
  url: string;
  /** Kaynak vücut (uyarlanmamış hali). */
  body: string;
}

export const MODEL_SOURCES: Record<string, ModelSource> = {
  hra: {
    name: 'HuBMAP Human Reference Atlas (VH Male / VH Female)',
    license: 'CC BY 4.0',
    url: 'github.com/hubmapconsortium/ccf-3d-reference-object-library',
    body: 'Visible Human erkek ve kadın',
  },
  bp3d3: {
    name: 'BodyParts3D 3.0 (DBCLS)',
    license: 'CC BY-SA 2.1 JP',
    url: 'github.com/Kevin-Mattheus-Moerman/BodyParts3D',
    body: 'yetişkin erkek referans vücudu',
  },
  za: {
    name: 'Z-Anatomy (BodyParts3D türevi + ek modeller)',
    license: 'CC BY-SA 4.0 (+ BodyParts3D CC BY-SA 2.1 JP)',
    url: 'github.com/LluisV/Z-Anatomy',
    body: 'yetişkin erkek referans vücudu',
  },
};

export const ADAPTED_NOTE = 'Erkek referansından uyarlanmıştır';
export const ADAPTED_DETAIL =
  'Bu yapı erkek referans modelinden kadın vücuduna dönüştürülerek yerleştirildi (ölçek, dönme ve eklem uyumu). Kadına özgü şekil farklarını taşımaz; açık ve lisanslı bir kadın modeli bulunduğunda değiştirilecek.';
