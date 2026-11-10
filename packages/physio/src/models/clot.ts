import { argMax, firstCross, maxOf } from '../run';
import type { SimModel } from '../types';

// İndirgenmiş trombin oluşumu modeli (boyutsuz: protrombin başlangıcı = 1).
const KI = 0.008; // doku faktörüyle başlatma
const TAU_TF = 10; // dk, başlatma sinyalinin sönmesi (TFPI)
const KFB = 2.4; // trombinin kofaktörleri (V, VIII) etkinleştirmesi → olumlu geri bildirim
const KDP = 0.14; // protrombinaz bozunumu
const KCAT = 0.88;
const KM = 0.5;
const KAT = 0.44; // antitrombin ile trombin inhibisyonu
const KF = 3.6; // trombinin fibrinojeni fibrine çevirmesi

/** Pıhtılaşma: başlatma → trombin patlaması → fibrin. Durum: [protrombinaz, protrombin, trombin, fibrinojen]; zaman: dk. */
export const clot: SimModel = {
  id: 'pihtilasma',
  title: 'Pıhtılaşma: trombin oluşumu ve fibrin',
  question: 'Küçük bir tetikleyici, nasıl olup da hızlı ve kendini sınırlayan bir pıhtıya dönüşür?',
  system: 'Kan',
  organs: ['liver'],
  interior: 'ic.artery',
  relatedTests: ['inr', 'aptt', 'platelet', 'albumin'],
  timeUnit: 'dk',
  dt: 0.005,
  duration: 40,
  sampleEvery: 0.1,
  pace: 4,
  panels: ['Trombin (göreli)', 'Fibrin (g/L)'],
  series: [
    { key: 'iia', label: 'Trombin', unit: '', panel: 0, color: 'a', decimals: 3 },
    { key: 'fn', label: 'Fibrin', unit: 'g/L', panel: 1, color: 'b', decimals: 1 },
  ],
  params: [
    { key: 'tf', label: 'Doku faktörü (tetikleyici)', unit: '× tipik', min: 0.1, max: 3, step: 0.1, value: 1 },
    { key: 'cof', label: 'Güçlendirme faktörleri (VIII/IX/V)', unit: '× tipik', min: 0.01, max: 1.5, step: 0.01, value: 1 },
    { key: 'ii', label: 'Protrombin düzeyi', unit: '× tipik', min: 0.1, max: 1.5, step: 0.05, value: 1, hint: 'K vitaminine bağımlı; karaciğerde yapılır' },
    { key: 'at', label: 'Antitrombin etkisi', unit: '× tipik', min: 0.3, max: 6, step: 0.1, value: 1 },
    { key: 'fg', label: 'Fibrinojen', unit: 'g/L', min: 0.3, max: 6, step: 0.1, value: 3 },
  ],
  scenarios: [
    { id: 'faktor', label: 'Güçlendirme faktörü eksikliği', note: 'Başlatma olur ama trombin patlaması zayıf kalır: tepe düşer, fibrin geç ve az oluşur.', set: { cof: 0.05 } },
    { id: 'antitrombin', label: 'Artmış antitrombin etkisi', note: 'Heparin benzeri: oluşan trombin hızla etkisizleşir; tepe ve toplam trombin azalır.', set: { at: 4 } },
    { id: 'protrombin', label: 'Azalmış protrombin', note: 'K vitamini eksikliği/antagonisti benzeri: hammadde azdır, trombin tepesi düşer ve gecikir.', set: { ii: 0.3 } },
    { id: 'fibrinojen', label: 'Düşük fibrinojen', note: 'Trombin oluşumu normaldir ama fibrin ağı az oluşur.', set: { fg: 0.8 } },
    { id: 'guclu-tetik', label: 'Güçlü tetikleyici', note: 'Gecikme kısalır; tepe yüksekliği hammadde ve inhibitörlerle sınırlı kaldığından az değişir.', set: { tf: 3 } },
  ],
  equations: [
    'dP/dt = k_i · TF · e^(−t/τ) + k_gb · trombin · kofaktör · (1 − P) − k_b · P   (protrombinaz)',
    'd(protrombin)/dt = −k_cat · P · protrombin / (K_m + protrombin)',
    'd(trombin)/dt = +k_cat · P · protrombin / (K_m + protrombin) − k_AT · antitrombin · trombin',
    'd(fibrinojen)/dt = −k_f · trombin · fibrinojen;  fibrin = başlangıç − kalan',
  ],
  assumptions: ['Onlarca tepkime dört değişkene indirgenmiştir; birimler görelidir.', 'Trombositler, damar duvarı, akış, protein C ve fibrinoliz yoktur.', 'Kofaktör etkisi tek bir çarpanla temsil edilir.'],
  validity: 'Trombin oluşum eğrisinin biçimini (gecikme, patlama, sönme) ve hangi bileşenin eğriyi nasıl değiştirdiğini nitel olarak gösterir.',
  limits: ['INR, aPTT ya da kanama/pıhtı riski tahmini değildir.', 'İlaç dozu ya da tedavi kararı için kullanılamaz.', 'Sayısal değerler gerçek derişimler değildir.'],
  sources: [
    { title: 'Hockin MF ve ark. J Biol Chem 2002;277:18322–18333', detail: 'Doku faktörü yolunun ayrıntılı kinetik modeli (indirgemenin dayandığı model)' },
    { title: 'Hemker HC ve ark. Pathophysiol Haemost Thromb 2003;33:4–15', detail: 'Trombin oluşum eğrisi: gecikme, tepe, endojen trombin potansiyeli' },
  ],
  init: (p) => [0, p.ii!, 0, p.fg!],
  deriv(t, y, p) {
    const [pr, ii, iia, fg] = y as [number, number, number, number];
    const gen = (KCAT * pr * ii) / (KM + ii);
    return [KI * p.tf! * Math.exp(-t / TAU_TF) + KFB * iia * p.cof! * (1 - pr) - KDP * pr, -gen, gen - KAT * p.at! * iia, -KF * iia * fg];
  },
  observe: (_t, y, p) => ({ iia: y[2]!, fn: p.fg! - y[3]!, ii: y[1]! }),
  phase(_t, y) {
    if (y[2]! < 0.005 && y[1]! > 0.8 * 1) return 'Başlatma (gecikme)';
    return y[1]! > 0.15 ? 'Güçlenme ve yayılma' : 'Sönme (inhibisyon)';
  },
  metrics(samples, p) {
    const dt = samples.length > 1 ? samples[1]!.t - samples[0]!.t : 0;
    const etp = samples.reduce((a, s) => a + s.v.iia! * dt, 0);
    return [
      { key: 'lag', label: 'Gecikme süresi', value: firstCross(samples, 'iia', 0.01), unit: 'dk', decimals: 1 },
      { key: 'peak', label: 'Trombin tepesi', value: maxOf(samples, 'iia'), unit: 'göreli', decimals: 3 },
      { key: 'ttp', label: 'Tepeye ulaşma', value: argMax(samples, 'iia'), unit: 'dk', decimals: 1 },
      { key: 'etp', label: 'Toplam trombin (eğri altı alan)', value: etp, unit: 'göreli·dk', decimals: 2 },
      { key: 'clot', label: 'Fibrinin yarısı oluştu', value: firstCross(samples, 'fn', p.fg! / 2), unit: 'dk', decimals: 1 },
    ];
  },
};
