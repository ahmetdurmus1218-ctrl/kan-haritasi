/**
 * Henüz gerçek modeli olmayan modaliteler. Bunlar "çalışıyormuş gibi" yapmaz: durum UNAVAILABLE,
 * beklenen yetenekler listede "uygulanmadı" görünür. Gerçek bir model eklendiğinde aynı kimlikle yeni
 * bir adaptör kaydedilir (registry.register) ve bu yer tutucunun yerini alır.
 */
import type { Modality, ModelVersion } from '../types';
import { type ImageAnalysisAdapter, capabilityStatus } from './types';

const NONE: ModelVersion = { id: 'none', name: 'Model yok', version: '—', kind: 'heuristic', local: true };

function unavailable(id: string, label: string, modalities: Modality[], capabilities: string[], extra: string[] = []): ImageAnalysisAdapter {
  return {
    id,
    label,
    modalities,
    model: NONE,
    capabilities: capabilities.map((c, i) => ({ key: `${id}-${i}`, label: c, implemented: false })),
    analyze() {
      return {
        adapterId: id,
        modality: modalities[0]!,
        status: 'UNAVAILABLE',
        model: NONE,
        capabilities: capabilityStatus(this),
        observations: [],
        limitations: ['Bu modalite için görüntüden güvenilir bulgu üreten bir model bu kurulumda yok; sistem bulgu uydurmaz.', ...extra],
        summary: 'Bu modalite için otomatik görüntü yorumu bu kurulumda yok. Görüntü saklanır, görüntüleyicide açılır ve elle ölçülebilir; rapor varsa rapor ayrıca okunur.',
      };
    },
  };
}

export const xrayAdapter = unavailable('xray', 'Röntgen', ['XRAY', 'FLUOROSCOPY'], ['Akciğer alanlarını bulma', 'Opasite / konsolidasyon adayı', 'Kardiyotorasik oran (otomatik)', 'Kırık adayı'], [
  'Kardiyotorasik oranı görüntüleyicideki "iki çizgiden oran" aracıyla elle ölçebilirsin.',
]);
export const mammographyAdapter = unavailable('mammography', 'Mamografi', ['MAMMOGRAPHY'], ['Meme dokusu yoğunluğu', 'Kitle adayı', 'Mikrokalsifikasyon adayı', 'BI-RADS önerisi']);
export const endoscopyAdapter = unavailable('endoscopy', 'Endoskopi / kolonoskopi', ['ENDOSCOPY', 'COLONOSCOPY'], ['Anatomik bölgeyi tanıma', 'Yüzey ve renk değişiklikleri', 'Polip adayı', 'Ülser adayı', 'Kanama görünümü']);
export const dermatologyAdapter = unavailable('dermatology', 'Dermatolojik görüntü', ['DERMOSCOPY'], ['Lezyon sınırı ve renk dağılımı', 'ABCD kuralı ölçümleri']);
export const dentalAdapter = unavailable('dental', 'Diş görüntüsü', ['DENTAL'], ['Diş numaralandırma', 'Çürük / kemik kaybı adayı']);
export const fundusAdapter = unavailable('fundus', 'Göz dibi (fundus)', ['FUNDUS'], ['Optik disk ve makula tespiti', 'Damar değişiklikleri', 'Kanama / eksuda adayı']);
export const genericAdapter = unavailable('generic', 'Genel tıbbi görüntü', ['PHOTO', 'UNKNOWN', 'DOCUMENT'], ['Görüntü türünü tanıma ve uygun modele yönlendirme']);
