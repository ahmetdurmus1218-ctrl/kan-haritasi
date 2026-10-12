/**
 * EKG görüntüsünden (fotoğraf / tarama / ekran görüntüsü) ölçüm: cihazda, sinyal işlemeyle.
 *
 * Yapılan (gerçek ölçüm):
 *  1. Milimetrik kâğıt ızgarası aranır; küçük kare (1 mm) piksel boyu özilintiyle bulunur → kalibrasyon.
 *  2. Koyu çizgi (EKG izi) ızgaradan ayrılır; yatay şeritler (derivasyon sıraları) bulunur.
 *  3. En uzun, kesintisiz şerit (çoğunlukla alttaki ritim şeridi) tek boyutlu sinyale çevrilir.
 *  4. R dalgası tepeleri bulunur → RR aralıkları, kalp hızı, ritim düzenliliği.
 *
 * Yapılmayan (uydurulmaz): PR, QRS süresi, QT/QTc, ST/T değişiklikleri, elektriksel aks ve derivasyon
 * adları. Bunlar dalga sınırlarının güvenilir bulunmasını ve derivasyon etiketlerinin okunmasını
 * gerektirir; bu kurulumda yoktur ve sonuçta açıkça "ölçülmedi" diye yazılır.
 *
 * Varsayım: kâğıt hızı 25 mm/sn (standart). Kayıt 50 mm/sn ise süreler yarıya, hız iki katına çıkar;
 * arayüz bu varsayımı gösterir.
 */
import { autocorrelation, downsampleRgba, percentile } from './image';

export const ECG_PAPER_SPEED_MM_S = 25;

export interface EcgGrid {
  detected: boolean;
  /** 1 mm'lik küçük karenin piksel boyu (küçültülmüş görüntüde değil, özgün görüntüde). */
  pxPerMm?: number;
  /** Özilinti tepe gücü (0–1). */
  strength: number;
  /** Küçük kareler mi görüldü yoksa yalnızca 5 mm'lik büyük kareler mi (çıkarım). */
  basis?: 'small-and-large' | 'small-only' | 'large-only';
  color: 'red' | 'gray' | 'none';
}

export interface EcgStrip {
  y0: number;
  y1: number;
  /** Şeridin genişliğinin ne kadarında iz var (0–1). */
  coverage: number;
}

export interface EcgAnalysis {
  grid: EcgGrid;
  strips: EcgStrip[];
  /** Ölçümün yapıldığı şerit (özgün koordinat). */
  rhythmStrip?: EcgStrip;
  /** R tepelerinin x konumları (özgün koordinat). */
  peaks: number[];
  /** RR aralıkları (ms). */
  rrMs: number[];
  heartRate?: number;
  /** RR değişkenlik katsayısı. */
  rrCv?: number;
  regularity?: 'regular' | 'mildly-irregular' | 'irregular';
  /** Ölçülemeyen ve bu yüzden verilmeyen değerler (neden). */
  notMeasured: Array<{ name: string; reason: string }>;
  /** Neden ölçüm yapılamadığı (varsa). */
  failure?: 'no-grid' | 'no-trace' | 'too-few-beats';
}

const NOT_MEASURED: Array<{ name: string; reason: string }> = [
  { name: 'PR aralığı', reason: 'P dalgasının başlangıcı fotoğrafta güvenilir bulunamıyor; bu kurulumda dalga sınırı bulan model yok.' },
  { name: 'QRS süresi', reason: 'QRS başlangıç/bitişi için dalga sınırı tespiti gerekir; uygulanmadı.' },
  { name: 'QT / QTc', reason: 'T dalgası bitişi güvenilir ölçülemiyor; uydurulmaz.' },
  { name: 'ST / T değişiklikleri', reason: 'İzoelektrik hat ve J noktası ölçümü uygulanmadı; ST yorumu hekim tarafından yapılır.' },
  { name: 'Elektriksel aks', reason: 'Derivasyon adları (I, aVF…) görüntüden okunmuyor; aks hesaplanamaz.' },
  { name: 'Derivasyon adları', reason: 'Etiketlerin okunması (OCR) bu adımda yapılmıyor; yalnızca şerit sayısı bulunur.' },
];

function lum(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Profilde en güçlü yerel tepeler (gecikme, değer). */
function peaksOf(ac: Float32Array, minLag: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let l = Math.max(2, minLag); l < ac.length - 1; l++) if (ac[l]! > ac[l - 1]! && ac[l]! >= ac[l + 1]! && ac[l]! > 0.05) out.push([l, ac[l]!]);
  return out.sort((a, b) => b[1] - a[1]);
}

function near(peaks: Array<[number, number]>, lag: number, tol: number): [number, number] | undefined {
  return peaks.find(([l]) => Math.abs(l - lag) <= tol);
}

/** Milimetrik ızgara (küçültülmüş RGBA üzerinde). */
export function detectGrid(rgba: Uint8ClampedArray, w: number, h: number): Omit<EcgGrid, 'pxPerMm'> & { mm?: number } {
  // Kâğıt rengi: en açık pikseller.
  const lums: number[] = [];
  const step = Math.max(1, Math.floor((w * h) / 40000));
  for (let p = 0; p < w * h; p += step) lums.push(lum(rgba[p * 4]!, rgba[p * 4 + 1]!, rgba[p * 4 + 2]!));
  const paper = percentile(lums, 0.9);
  // EKG kâğıdı açık renklidir: piksellerin büyük kısmı kâğıt tonuna yakın olmalı (koyu MR/film kesitleri elenir).
  const paperLike = lums.filter((v) => v > paper - 30).length / lums.length;
  if (paper < 160 || paperLike < 0.35) return { detected: false, strength: 0, color: 'none' };
  const tryMask = (color: 'red' | 'gray') => {
    const col = new Float32Array(w);
    const row = new Float32Array(h);
    let n = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = rgba[i]!;
        const g = rgba[i + 1]!;
        const b = rgba[i + 2]!;
        const l = lum(r, g, b);
        const on = color === 'red' ? r - Math.max(g, b) > 22 && l > 90 : l < paper - 12 && l > paper - 90 && Math.max(r, g, b) - Math.min(r, g, b) < 30;
        if (on) {
          col[x] = col[x]! + 1;
          row[y] = row[y]! + 1;
          n++;
        }
      }
    return { col, row, frac: n / (w * h) };
  };
  for (const color of ['red', 'gray'] as const) {
    const m = tryMask(color);
    if (m.frac < 0.02) continue;
    const maxLag = Math.min(120, Math.floor(Math.min(w, h) / 3));
    const acx = autocorrelation(m.col, maxLag);
    const acy = autocorrelation(m.row, maxLag);
    const px = peaksOf(acx, 3);
    const py = peaksOf(acy, 3);
    if (!px.length || !py.length) continue;
    const [lx, vx] = px[0]!;
    // Aynı periyot iki eksende de olmalı (kare ızgara).
    const match = near(py, lx, Math.max(1, lx * 0.12));
    if (!match) continue;
    const strength = Math.min(vx, match[1]);
    if (strength < 0.15) continue;
    // Küçültülmüş fotoğrafta 1 mm tam sayı piksel değildir (ör. 6,83 px): çizgiler 6 ya da 7 piksel arayla
    // düşer ve özilintinin en güçlü tepesi gerçek periyodun katı olabilir (41 px = 6 × 6,83). Gerçek
    // (alt piksel) periyot, en güçlü tepenin tam bölenleri arasından tüm katlarında tepe veren en küçük
    // aday olarak seçilir.
    // Aday periyot P'nin açıkladığı tepeler: belirgin özilinti tepeleri P'nin katlarına (±1 px) düşmeli
    // (duyarlılık) ve P'nin katları belirgin tepelere denk gelmeli (kesinlik).
    const fit = (peaks: Array<[number, number]>, maxLag: number, P: number) => {
      const sig = peaks.filter(([, v]) => v > 0.25).map(([l]) => l);
      if (!sig.length) return 0;
      const onMultiple = (l: number) => Math.abs(l - Math.round(l / P) * P) <= 1.01;
      const recall = sig.filter(onMultiple).length / sig.length;
      let hits = 0;
      let n = 0;
      for (let m = 1; m * P <= maxLag - 1; m++) {
        n++;
        if (sig.some((l) => Math.abs(l - m * P) <= 1.01)) hits++;
      }
      return n ? recall * (hits / n) : 0;
    };
    const L = (lx + match[0]) / 2;
    const cands: Array<{ P: number; s: number }> = [];
    for (let k = 1; k <= 12; k++) {
      const P = L / k;
      if (P < 2.5) break;
      cands.push({ P, s: (fit(px, acx.length, P) + fit(py, acy.length, P)) / 2 });
    }
    const bestScore = Math.max(...cands.map((c) => c.s));
    const fund = cands.filter((c) => c.s >= bestScore - 1e-6).sort((a, b) => a.P - b.P)[0]!;
    const P = fund.P;
    if (P < 14) {
      // Her 5. çizgi kalınsa (5 mm'lik kareler) 5P gecikmesinde özilinti P'dekinden belirgin güçlüdür.
      const at = (ac: Float32Array, x: number) => (x < ac.length - 1 ? Math.max(ac[Math.floor(x)]!, ac[Math.ceil(x)]!) : 0);
      const heavier = at(acx, P * 5) > at(acx, P) * 1.05;
      return { detected: true, mm: P, strength, basis: heavier ? 'small-and-large' : 'small-only', color };
    }
    // Tek, iri periyot: yalnızca 5 mm'lik kareler görülüyor kabul edilir (güven düşük).
    return { detected: true, mm: P / 5, strength: strength * 0.7, basis: 'large-only', color };
  }
  return { detected: false, strength: 0, color: 'none' };
}

export function analyzeEcg(rgba: Uint8ClampedArray, width: number, height: number): EcgAnalysis {
  const small = downsampleRgba(rgba, width, height, 1600);
  const { width: w, height: h } = small;
  const s = small.rgba;
  const back = 1 / small.scale;
  const g = detectGrid(s, w, h);
  const grid: EcgGrid = { detected: g.detected, strength: Math.round(g.strength * 100) / 100, color: g.color, ...(g.basis ? { basis: g.basis } : {}), ...(g.mm ? { pxPerMm: Math.round(g.mm * back * 100) / 100 } : {}) };
  const out: EcgAnalysis = { grid, strips: [], peaks: [], rrMs: [], notMeasured: NOT_MEASURED };
  if (!g.detected || !g.mm) return { ...out, failure: 'no-grid' };
  const mm = g.mm;

  // İz maskesi: koyu ve (kırmızı ızgara değil) pikseller.
  const lums: number[] = [];
  for (let p = 0; p < w * h; p += 7) lums.push(lum(s[p * 4]!, s[p * 4 + 1]!, s[p * 4 + 2]!));
  const paper = percentile(lums, 0.9);
  const dark = Math.min(110, paper * 0.55);
  const trace = new Uint8Array(w * h);
  const rowCount = new Float32Array(h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = s[i]!;
      const gg = s[i + 1]!;
      const b = s[i + 2]!;
      if (lum(r, gg, b) < dark && r - Math.max(gg, b) < 40) {
        trace[y * w + x] = 1;
        rowCount[y] = rowCount[y]! + 1;
      }
    }
  // Şeritler: iz taşıyan satır öbekleri (aralarında ≥ 2 mm boşluk), en az 5 mm yüksek.
  const bands: Array<{ y0: number; y1: number }> = [];
  let start = -1;
  let gap = 0;
  for (let y = 0; y <= h; y++) {
    const on = y < h && rowCount[y]! > w * 0.004;
    if (on) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > mm * 2 || y === h) {
        const y1 = y - gap;
        if (y1 - start >= mm * 5) bands.push({ y0: start, y1 });
        start = -1;
        gap = 0;
      }
    }
  }
  const strips = bands.map((b) => {
    let cols = 0;
    for (let x = 0; x < w; x++) {
      for (let y = b.y0; y <= b.y1; y++)
        if (trace[y * w + x]) {
          cols++;
          break;
        }
    }
    return { ...b, coverage: cols / w };
  });
  out.strips = strips.map((b) => ({ y0: Math.round(b.y0 * back), y1: Math.round(b.y1 * back), coverage: Math.round(b.coverage * 100) / 100 }));
  if (!strips.length) return { ...out, failure: 'no-trace' };
  // Ritim şeridi: en geniş kapsama; eşitlikte alttaki.
  let best = strips[0]!;
  for (const b of strips) if (b.coverage > best.coverage + 0.02 || (Math.abs(b.coverage - best.coverage) <= 0.02 && b.y0 > best.y0)) best = b;
  out.rhythmStrip = { y0: Math.round(best.y0 * back), y1: Math.round(best.y1 * back), coverage: Math.round(best.coverage * 100) / 100 };

  // Sinyal: her sütunda izin en üst noktası (R dalgası yukarı).
  const sig = new Float32Array(w).fill(Number.NaN);
  for (let x = 0; x < w; x++)
    for (let y = best.y0; y <= best.y1; y++)
      if (trace[y * w + x]) {
        sig[x] = best.y1 - y;
        break;
      }
  // Boşlukları doğrusal doldur.
  let last = -1;
  for (let x = 0; x < w; x++) {
    if (Number.isNaN(sig[x]!)) continue;
    if (last >= 0 && x - last > 1) for (let k = last + 1; k < x; k++) sig[k] = sig[last]! + ((sig[x]! - sig[last]!) * (k - last)) / (x - last);
    last = x;
  }
  const valid = Array.from(sig).filter((v) => !Number.isNaN(v));
  if (valid.length < w * 0.3) return { ...out, failure: 'no-trace' };
  const base = percentile(valid, 0.5);
  const top = percentile(valid, 0.995);
  // R dalgası: taban çizgisinden en az 3 mm (≈0,3 mV) ve tepe yüksekliğinin yarısı kadar yukarıda.
  const thr = Math.max(base + mm * 3, base + (top - base) * 0.5);
  const refractory = Math.round((0.2 * ECG_PAPER_SPEED_MM_S * mm)); // 200 ms
  const peaks: number[] = [];
  for (let x = 1; x < w - 1; x++) {
    const v = sig[x]!;
    if (Number.isNaN(v) || v < thr) continue;
    let isMax = true;
    for (let k = Math.max(0, x - refractory); k <= Math.min(w - 1, x + refractory); k++)
      if (sig[k]! > v || (sig[k] === v && k < x)) {
        isMax = false;
        break;
      }
    if (isMax) peaks.push(x);
  }
  out.peaks = peaks.map((x) => Math.round(x * back));
  if (peaks.length < 3) return { ...out, failure: 'too-few-beats' };
  const msPerPx = 1000 / (ECG_PAPER_SPEED_MM_S * mm);
  const rr = peaks.slice(1).map((x, i) => (x - peaks[i]!) * msPerPx);
  // 300 ms (200/dk) altı ya da 2000 ms (30/dk) üstü aralıklar fizyolojik kabul edilmez (yanlış tepe).
  const ok = rr.filter((v) => v >= 300 && v <= 2000);
  if (ok.length < 2) return { ...out, failure: 'too-few-beats' };
  const mean = ok.reduce((a, b) => a + b, 0) / ok.length;
  const sd = Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / ok.length);
  out.rrMs = ok.map((v) => Math.round(v));
  out.heartRate = Math.round(60000 / mean);
  out.rrCv = Math.round((sd / mean) * 1000) / 1000;
  out.regularity = out.rrCv < 0.08 ? 'regular' : out.rrCv < 0.15 ? 'mildly-irregular' : 'irregular';
  return out;
}

/** Hızlı EKG ipucu (modalite sınıflandırması için): ızgara var mı ve koyu iz şeritleri var mı. */
export function ecgLikelihood(rgba: Uint8ClampedArray, width: number, height: number): { grid: boolean; strength: number } {
  const small = downsampleRgba(rgba, width, height, 900);
  const g = detectGrid(small.rgba, small.width, small.height);
  return { grid: g.detected, strength: g.strength };
}
