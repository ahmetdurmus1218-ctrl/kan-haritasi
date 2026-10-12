/** EKG görüntüsü: ızgara kalibrasyonu, ritim şeridi, RR ve kalp hızı (gerçek ölçüm); diğerleri uydurulmaz. */
import { ECG_PAPER_SPEED_MM_S, analyzeEcg } from '../ecg';
import { type ImageObservation, type ModelVersion, score } from '../types';
import { type ImageAnalysisAdapter, capabilityStatus, obsId } from './types';

export const ECG_MODEL: ModelVersion = { id: 'kh-ecg-image', name: 'EKG görüntüsü ölçümü (ızgara + R tepesi, sinyal işleme)', version: '1.0.0', kind: 'heuristic', local: true };

const REG_TR = { regular: 'düzenli', 'mildly-irregular': 'hafif düzensiz', irregular: 'düzensiz' } as const;
const FAIL_TR = {
  'no-grid': 'Milimetrik kâğıt ızgarası bulunamadı; zaman kalibrasyonu yapılamadığı için ölçüm verilmedi.',
  'no-trace': 'EKG çizgisi (iz) güvenilir biçimde ayrılamadı.',
  'too-few-beats': 'Ölçüm için yeterli sayıda (en az 3) R dalgası bulunamadı.',
} as const;

const HEART_PATH = { path: ['heart', 'heart.conduction'], structure: 'heart', basis: 'knowledge' as const, confidence: score(0.9, 'EKG kalbin elektriksel etkinliğini kaydeder') };

export const ecgAdapter: ImageAnalysisAdapter = {
  id: 'ecg-image',
  label: 'EKG görüntüsü — ritim ve hız ölçümü',
  modalities: ['ECG'],
  model: ECG_MODEL,
  capabilities: [
    { key: 'grid', label: 'Kâğıt ızgarasından kalibrasyon (1 mm = ? piksel)', implemented: true },
    { key: 'strips', label: 'Derivasyon sıralarını (şeritleri) ayırma', implemented: true },
    { key: 'rate', label: 'RR aralığı ve kalp hızı', implemented: true },
    { key: 'regularity', label: 'Ritim düzenliliği (RR değişkenliği)', implemented: true },
    { key: 'leads', label: 'Derivasyon adlarını okuma (I, II, aVF…)', implemented: false },
    { key: 'pr', label: 'PR aralığı', implemented: false },
    { key: 'qrs', label: 'QRS süresi', implemented: false },
    { key: 'qt', label: 'QT / QTc', implemented: false },
    { key: 'st', label: 'ST / T değişiklikleri', implemented: false },
    { key: 'axis', label: 'Elektriksel aks', implemented: false },
  ],
  analyze({ image, quality }) {
    if (!image.rgba)
      return {
        adapterId: this.id,
        modality: 'ECG',
        status: 'UNAVAILABLE',
        model: ECG_MODEL,
        capabilities: capabilityStatus(this),
        observations: [],
        limitations: ['DICOM dalga formu (waveform) EKG dosyaları bu kurulumda okunmuyor; yalnızca EKG kâğıdının fotoğrafı/taraması ölçülür.'],
        summary: 'Bu EKG dosyası türü için otomatik ölçüm yok.',
      };
    const e = analyzeEcg(image.rgba, image.width, image.height);
    const observations: ImageObservation[] = [];
    const qf = Math.sqrt(quality.score);
    if (e.grid.detected && e.grid.pxPerMm)
      observations.push({
        id: obsId('ecg'),
        source: 'IMAGE_ANALYSIS',
        kind: 'quality',
        text: `Milimetrik ızgara bulundu: 1 mm ≈ ${e.grid.pxPerMm.toLocaleString('tr-TR')} piksel${e.grid.basis === 'large-only' ? ' (yalnızca 5 mm\'lik kareler görüldü; kalibrasyon daha az güvenilir)' : ''}.`,
        location: HEART_PATH,
        localization: { kind: 'none' },
        confidence: score(e.grid.strength * (e.grid.basis === 'large-only' ? 0.7 : 1), 'ızgara periyodunun düzenliliği'),
        model: ECG_MODEL,
        limitations: ['Fotoğraf eğik çekildiyse (perspektif) kalibrasyon kayar.'],
        cues: { pxPerMm: e.grid.pxPerMm, strength: e.grid.strength, color: e.grid.color },
      });
    if (e.strips.length)
      observations.push({
        id: obsId('ecg'),
        source: 'IMAGE_ANALYSIS',
        kind: 'structure-presence',
        text: `${e.strips.length} EKG şeridi (derivasyon sırası) bulundu${e.strips.length >= 3 ? '; 12 derivasyonlu standart düzen olabilir' : ''}. Derivasyon adları okunmadı.`,
        location: HEART_PATH,
        localization: { kind: 'none' },
        confidence: score(0.6 * qf, 'satır profili'),
        model: ECG_MODEL,
        limitations: ['Hangi şeridin hangi derivasyon olduğu bilinmiyor.'],
      });
    if (e.heartRate !== undefined && e.rrMs.length) {
      const beats = e.rrMs.length + 1;
      const rs = e.rhythmStrip!;
      observations.push({
        id: obsId('ecg'),
        source: 'IMAGE_ANALYSIS',
        kind: 'heart-rate',
        text: `Kalp hızı yaklaşık ${e.heartRate}/dk (ortalama RR ${Math.round(e.rrMs.reduce((a, b) => a + b, 0) / e.rrMs.length)} ms, ${beats} atım üzerinden).`,
        location: HEART_PATH,
        localization: { kind: 'pixel', frame: 0, box: { x: 0, y: rs.y0, w: image.width, h: rs.y1 - rs.y0 }, imageSize: { width: image.width, height: image.height } },
        confidence: { kind: 'measured', basis: `ızgara kalibrasyonu + ${beats} R tepesi; kâğıt hızı ${ECG_PAPER_SPEED_MM_S} mm/sn varsayıldı` },
        model: ECG_MODEL,
        measurement: { name: 'Kalp hızı', value: e.heartRate, unit: '/dk', method: `RR aralıkları, ${ECG_PAPER_SPEED_MM_S} mm/sn` },
        limitations: [`Kâğıt hızı ${ECG_PAPER_SPEED_MM_S} mm/sn varsayıldı; 50 mm/sn kayıtlarda gerçek hız bunun iki katıdır.`, 'Yalnızca görünen kısa şerit ölçülür; uzun kayıttaki ritim değişiklikleri görülmez.'],
        cues: { beats, cv: e.rrCv ?? 0 },
      });
      observations.push({
        id: obsId('ecg'),
        source: 'IMAGE_ANALYSIS',
        kind: 'rhythm',
        text: `RR aralıkları ${REG_TR[e.regularity!]} (değişkenlik katsayısı ${(e.rrCv! * 100).toFixed(1)}%). Bu, ritmin adını (ör. sinüs ritmi) söylemez.`,
        location: HEART_PATH,
        localization: { kind: 'none' },
        confidence: score(Math.min(0.75, (0.35 + beats * 0.04) * qf), 'atım sayısı ve görüntü kalitesi'),
        model: ECG_MODEL,
        limitations: ['P dalgaları değerlendirilmediği için ritim tipi belirlenmez; düzensizlik ekstra atım ya da ölçüm hatasından olabilir.'],
      });
    }
    const measured = e.heartRate !== undefined;
    return {
      adapterId: this.id,
      modality: 'ECG',
      status: measured ? 'PARTIAL' : 'UNAVAILABLE',
      model: ECG_MODEL,
      capabilities: capabilityStatus(this, {
        grid: { ok: e.grid.detected, detail: e.grid.pxPerMm ? `1 mm ≈ ${e.grid.pxPerMm} px` : 'ızgara yok' },
        strips: { ok: e.strips.length > 0, detail: `${e.strips.length} şerit` },
        rate: { ok: measured, detail: measured ? `${e.heartRate}/dk` : e.failure ? FAIL_TR[e.failure] : undefined },
        regularity: { ok: measured },
      }),
      observations,
      limitations: [...e.notMeasured.map((n) => `${n.name}: ölçülmedi — ${n.reason}`), `Kâğıt hızı ${ECG_PAPER_SPEED_MM_S} mm/sn varsayıldı.`],
      summary: measured
        ? `EKG görüntüsünden kalp hızı (${e.heartRate}/dk) ve RR düzenliliği ölçüldü. PR, QRS, QT, ST ve aks ölçülmedi.`
        : `EKG görüntüsünden ölçüm yapılamadı: ${FAIL_TR[e.failure ?? 'no-trace']}`,
    };
  },
};
