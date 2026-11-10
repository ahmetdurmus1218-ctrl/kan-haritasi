import { lastOf } from '../run';
import type { SimModel } from '../types';

const TSH0 = 1.5; // mIU/L
const FT40 = 1.2; // ng/dL
const FT30 = 3.2; // pg/mL
const BETA = 7; // log-doğrusal TSH–sT4 eğimi
const D = 2; // mIU/L, tiroidin TSH'ye yarı doygunluğu
const START = 10; // gün

const tshTarget = (ft4: number, trh: number): number => Math.min(150, TSH0 * trh * Math.exp(-BETA * (ft4 / FT40 - 1)));

/** Hipotalamus–hipofiz–tiroid ekseni. Durum: [TSH, sT4, sT3]; zaman: gün. */
export const thyroid: SimModel = {
  id: 'tiroid-ekseni',
  title: 'Tiroid ekseni (TSH ↔ T4/T3 geri bildirimi)',
  question: 'Hipofiz ve tiroid, hormon düzeyini geri bildirimle nasıl sabit tutar?',
  system: 'Endokrin',
  organs: ['thyroid'],
  interior: 'thyroid',
  relatedTests: ['tsh', 'ft4', 'ft3', 'anti-tpo'],
  timeUnit: 'gün',
  dt: 0.02,
  duration: 150,
  sampleEvery: 0.5,
  pace: 15,
  panels: ['TSH (mIU/L)', 'Serbest T4 (ng/dL)', 'Serbest T3 (pg/mL)'],
  series: [
    { key: 'tsh', label: 'TSH', unit: 'mIU/L', panel: 0, color: 'a', decimals: 2 },
    { key: 'ft4', label: 'Serbest T4', unit: 'ng/dL', panel: 1, color: 'b', decimals: 2 },
    { key: 'ft3', label: 'Serbest T3', unit: 'pg/mL', panel: 2, color: 'c', decimals: 2 },
  ],
  params: [
    { key: 'gt', label: 'Tiroidin salgı kapasitesi', unit: '× tipik', min: 0, max: 2, step: 0.05, value: 1 },
    { key: 'trh', label: 'Merkezi uyarı (hipotalamus-hipofiz)', unit: '× tipik', min: 0.05, max: 2, step: 0.05, value: 1 },
    { key: 'auto', label: 'TSH\'den bağımsız salgı', unit: '× tipik', min: 0, max: 3, step: 0.05, value: 0, hint: 'Tiroidin kendi başına hormon üretmesi' },
    { key: 'conv', label: 'T4 → T3 dönüşümü', unit: '× tipik', min: 0.3, max: 1.5, step: 0.05, value: 1, hint: 'Karaciğer, böbrek ve kasta deiyodinaz enzimleri' },
  ],
  scenarios: [
    { id: 'birincil-hipo', label: 'Tiroid az çalışıyor', note: 'Bez az hormon üretir: sT4 düşer, geri bildirim kalkar ve TSH belirgin yükselir.', set: { gt: 0.25 } },
    { id: 'hafif', label: 'Hafif kapasite kaybı', note: 'TSH yükselerek sT4\'ü normal aralıkta tutabilir (TSH ↑, sT4 normal).', set: { gt: 0.6 } },
    { id: 'hiper', label: 'TSH\'den bağımsız fazla salgı', note: 'sT4 ve sT3 yükselir, hipofiz baskılanır: TSH çok düşer.', set: { auto: 1.8 } },
    { id: 'merkezi', label: 'Merkezi uyarı azalmış', note: 'TSH düşük ya da "normal" kalırken sT4 düşer: bu örüntüde TSH tek başına yanıltıcıdır.', set: { trh: 0.06 } },
    { id: 'donusum', label: 'Azalmış T4 → T3 dönüşümü', note: 'sT3 düşer; bu basit modelde hipofiz yalnızca sT4\'ü algıladığından TSH değişmez.', set: { conv: 0.5 } },
  ],
  equations: [
    'TSH hedefi = TSH₀ · merkezi uyarı · exp(−β · (sT4 / sT4₀ − 1))   (log-doğrusal ilişki)',
    'dTSH/dt = (TSH hedefi − TSH) / τ_TSH',
    'd sT4/dt = ln2 / 7 gün · (sT4₀ · [kapasite · doygunluk(TSH) + bağımsız salgı] − sT4)',
    'd sT3/dt = ln2 / 1 gün · (sT3₀ · dönüşüm · sT4 / sT4₀ − sT3)',
  ],
  assumptions: ['T4 yarı ömrü ≈ 7 gün, T3 ≈ 1 gün alınır.', 'Hipofiz yalnızca sT4 düzeyini algılar; gün içi ritim ve TRH nabızları yoktur.', 'Bağlayıcı proteinler ve iyot dengesi modellenmez.'],
  validity: 'Birincil ve merkezi eksen değişikliklerinde TSH ve sT4\'ün yönünü ve haftalar süren yeni dengeye geçişi gösterir.',
  limits: ['Kişisel tiroid durumu ya da ilaç dozu değerlendirmesi değildir.', 'Sayısal düzeyler yaklaşık değerlerdir; laboratuvar referans aralıklarıyla karşılaştırılmamalıdır.'],
  sources: [
    { title: 'Dietrich JW ve ark. J Thyroid Res 2012;2012:351864', detail: 'TSH ve tiroid homeostazı: geri bildirim modelleri' },
    { title: 'Spencer CA ve ark. J Clin Endocrinol Metab 1990;70:453–460', detail: 'TSH ile serbest T4 arasındaki log-doğrusal ilişki' },
  ],
  init: () => [TSH0, FT40, FT30],
  deriv(t, y, p) {
    const q = t < START ? { gt: 1, trh: 1, auto: 0, conv: 1 } : p;
    const [tsh, ft4, ft3] = y as [number, number, number];
    const sat = tsh / (tsh + D) / (TSH0 / (TSH0 + D));
    return [(tshTarget(ft4, q.trh!) - tsh) / 0.5, (Math.LN2 / 7) * (FT40 * (q.gt! * sat + q.auto!) - ft4), Math.LN2 * (FT30 * q.conv! * (ft4 / FT40) - ft3)];
  },
  observe: (_t, y) => ({ tsh: y[0]!, ft4: y[1]!, ft3: y[2]! }),
  phase: (t) => (t < START ? 'Denge' : 'Yeni dengeye geçiş'),
  metrics(samples) {
    return [
      { key: 'tsh', label: 'TSH (150. gün)', value: lastOf(samples, 'tsh'), unit: 'mIU/L', decimals: 2, typical: '≈ 0,4–4' },
      { key: 'ft4', label: 'Serbest T4 (150. gün)', value: lastOf(samples, 'ft4'), unit: 'ng/dL', decimals: 2, typical: '≈ 0,9–1,7' },
      { key: 'ft3', label: 'Serbest T3 (150. gün)', value: lastOf(samples, 'ft3'), unit: 'pg/mL', decimals: 2, typical: '≈ 2–4,4' },
    ];
  },
  curves(samples, p) {
    return [
      {
        id: 'tshft4',
        title: 'TSH ↔ serbest T4 (logaritmik ilişki)',
        xLabel: 'Serbest T4 (ng/dL)',
        yLabel: 'log₁₀ TSH',
        lines: [{ label: 'Hipofizin yanıtı', points: Array.from({ length: 41 }, (_, i) => 0.3 + i * 0.06).map((x) => ({ x, y: Math.log10(Math.max(0.001, tshTarget(x, p.trh!))) })) }],
        marker: { x: lastOf(samples, 'ft4'), y: Math.log10(Math.max(0.001, lastOf(samples, 'tsh'))), label: 'Model' },
      },
    ];
  },
  personal(m) {
    const markers = [];
    const used: string[] = [];
    if (m.tsh !== undefined && m.ft4 !== undefined && m.tsh > 0) {
      markers.push({ curve: 'tshft4', x: m.ft4, y: Math.log10(m.tsh), label: 'Senin ölçümün (TSH, sT4)' });
      used.push('tsh', 'ft4');
    }
    return { params: {}, markers, used };
  },
};
