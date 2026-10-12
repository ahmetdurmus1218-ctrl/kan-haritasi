/**
 * Ultrason: görüntü alanının (yelpaze/sektör) bulunması gerçek; organ tanıma, ölçüm ve bulgu adayı
 * çıkarma bu kurulumda YOK. Bölge, kullanıcının seçiminden ya da dosya adından gelir ve bu yazılır.
 */
import { downsample, percentile } from '../image';
import { sectorScore } from '../modality';
import { type ImageObservation, type ModelVersion, score } from '../types';
import { type ImageAnalysisAdapter, capabilityStatus, obsId } from './types';

export const US_MODEL: ModelVersion = { id: 'kh-us-geometry', name: 'Ultrason görüntü alanı (sektör) tespiti', version: '1.0.0', kind: 'heuristic', local: true };

export const ultrasoundAdapter: ImageAnalysisAdapter = {
  id: 'ultrasound',
  label: 'Ultrason — görüntü alanı ve bağlam',
  modalities: ['ULTRASOUND', 'DOPPLER', 'ECHOCARDIOGRAPHY'],
  model: US_MODEL,
  capabilities: [
    { key: 'sector', label: 'Ultrason görüntü alanını (yelpaze) bulma', implemented: true },
    { key: 'organ', label: 'Organı görüntüden tanıma (ör. pankreas)', implemented: false },
    { key: 'calibration', label: 'Derinlik ölçeğinden mm kalibrasyonu', implemented: false },
    { key: 'measure', label: 'Otomatik boyut ölçümü', implemented: false },
    { key: 'lesion', label: 'Kist / kitle / taş adayı', implemented: false },
    { key: 'doppler', label: 'Doppler akım analizi', implemented: false },
  ],
  analyze({ image, anatomy, quality }) {
    const g = downsample(image.gray, image.width, image.height, 420);
    const lo = percentile(g.data, 0.01);
    const hi = percentile(g.data, 0.995);
    const sector = sectorScore(g.data, g.width, g.height, lo, hi > lo ? 255 / (hi - lo) : 1);
    const observations: ImageObservation[] = [];
    if (sector > 0.6)
      observations.push({
        id: obsId('us'),
        source: 'IMAGE_ANALYSIS',
        kind: 'sector-geometry',
        text: 'Yelpaze (sektör) biçimli ultrason görüntü alanı bulundu: görüntü konveks/sektör prob ile alınmış olabilir.',
        localization: { kind: 'none' },
        confidence: score(Math.min(0.75, sector * 0.75 * Math.sqrt(quality.score)), 'satır genişliklerinin derinlikle doğrusal artışı'),
        model: US_MODEL,
        limitations: ['Bu bir görüntü-türü gözlemidir; organ ya da bulgu hakkında bilgi vermez.'],
        cues: { sector: Math.round(sector * 100) / 100 },
      });
    const where = anatomy.structure
      ? `Bölge (${anatomy.source === 'USER_INPUT' ? 'senin seçimin / dosya adı' : anatomy.source === 'DICOM_METADATA' ? 'DICOM başlığı' : 'tahmin'}): ${anatomy.structure}. Görüntüden doğrulanmadı.`
      : 'Bölge bilinmiyor; belge için bölge seçebilirsin.';
    return {
      adapterId: this.id,
      modality: 'ULTRASOUND',
      status: sector > 0.6 ? 'PARTIAL' : 'UNAVAILABLE',
      model: US_MODEL,
      capabilities: capabilityStatus(this, { sector: { ok: sector > 0.6, detail: `sektör puanı ${sector.toFixed(2)}` } }),
      observations,
      limitations: [
        'Ultrason görüntüsünden organ tanıyan, ölçüm yapan ya da bulgu adayı çıkaran bir model bu kurulumda YOK.',
        'Ultrason görüntüsü probun açısına ve basısına bağlıdır; tek kare tüm organı göstermez.',
        'Görüntüdeki ölçüm imleçleri ve yazılar (varsa) bu adımda okunmaz.',
        where,
      ],
      summary: 'Ultrason görüntüsü tanındı; organ tanıma ve otomatik bulgu çıkarımı bu kurulumda yok. Görüntüdeki ölçümleri görüntüleyicideki cetvelle elle yapabilirsin.',
    };
  },
};
