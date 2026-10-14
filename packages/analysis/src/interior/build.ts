import type { InteriorScale, InteriorStage, StageKind } from './types';

/** Kısa basamak oluşturucu. */
export function st(id: string, kind: StageKind, scale: InteriorScale, title: string, text: string, extra: Omit<InteriorStage, 'id' | 'kind' | 'scale' | 'title' | 'text'> = {}): InteriorStage {
  return { id, kind, scale, title, text, ...extra };
}

/** Sindirim kanalının dört katmanlı duvarı (lümenden dışa). */
export const GI_WALL = [
  { id: 'lumen', name: 'Lümen (iç boşluk)', text: 'İçeriğin aktığı boşluk; duvarın en iç yüzeyine bakar.' },
  { id: 'mucus', name: 'Mukus tabakası', text: 'Goblet hücrelerinin salgıladığı kaygan, koruyucu jel.', node: 'mol.mucus' },
  { id: 'epithelium', name: 'Epitel', text: 'Lümene bakan tek sıra hücre: emer, salgılar, bariyer oluşturur.', node: 'tissue.intestinal-epithelium' },
  { id: 'lamina-propria', name: 'Lamina propria', text: 'Epitelin altındaki gevşek bağ dokusu: kılcallar, lenf damarları, bağışıklık hücreleri.', node: 'tissue.lamina-propria' },
  { id: 'submucosa', name: 'Submukoza', text: 'Daha büyük damarlar ve Meissner sinir ağı.', node: 'tissue.submucosa' },
  { id: 'muscularis', name: 'Kas tabakası (muskularis)', text: 'İçte dairesel, dışta boylamsal düz kas: karıştırma ve ileri itme.', node: 'tissue.muscularis-externa' },
  { id: 'serosa', name: 'Seroza', text: 'Dış yüzeyi örten ince zar (periton).', node: 'tissue.serosa' },
];

/** Damar duvarı (lümenden dışa). */
export const VESSEL_WALL = [
  { id: 'lumen', name: 'Lümen', text: 'Kanın aktığı boşluk.' },
  { id: 'endothelium', name: 'Endotel (intima)', text: 'Tek sıra yassı hücre: pıhtılaşmayı önler, damar çapını ayarlayan sinyaller üretir.', node: 'tissue.endothelium' },
  { id: 'media', name: 'Düz kas (media)', text: 'Damarın daralıp genişlemesini sağlayan düz kas ve elastik lifler.', node: 'tissue.smooth-muscle' },
  { id: 'adventitia', name: 'Dış kılıf (adventisya)', text: 'Bağ dokusu, damarın kendi küçük damarları ve sinirleri.' },
];

export const AIRWAY_WALL = [
  { id: 'lumen', name: 'Lümen (hava)', text: 'Havanın geçtiği boşluk.' },
  { id: 'mucus', name: 'Mukus örtüsü', text: 'Toz ve mikropları yakalayan yapışkan tabaka.', node: 'mol.mucus' },
  { id: 'epithelium', name: 'Silli solunum epiteli', text: 'Kirpikli hücreler mukusu boğaza doğru süpürür; kadeh hücreleri mukus yapar.', node: 'tissue.respiratory-epithelium' },
  { id: 'lamina-propria', name: 'Lamina propria ve bezler', text: 'Bağ dokusu, seröz/müköz bezler, bağışıklık hücreleri.' },
  { id: 'smooth-muscle', name: 'Düz kas', text: 'Hava yolu çapını ayarlar.', node: 'tissue.smooth-muscle' },
  { id: 'cartilage', name: 'Kıkırdak', text: 'Trakea ve bronşları açık tutan C şekilli/plak kıkırdak (bronşiollerde yoktur).' },
];

export const URINARY_WALL = [
  { id: 'lumen', name: 'Lümen (idrar)', text: 'İdrarın bulunduğu boşluk.' },
  { id: 'urothelium', name: 'Ürotel', text: 'Gerilince yassılaşan, idrarı geçirmeyen değişici epitel; en üstte şemsiye hücreler.', node: 'tissue.urothelium' },
  { id: 'lamina-propria', name: 'Lamina propria', text: 'Bağ dokusu ve damarlar.' },
  { id: 'muscle', name: 'Düz kas', text: 'İdrarı ileten ya da boşaltan kas tabakası.', node: 'tissue.smooth-muscle' },
  { id: 'adventitia', name: 'Dış tabaka', text: 'Bağ dokusu (mesane üstünde seroza).' },
];
