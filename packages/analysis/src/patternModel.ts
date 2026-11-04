/**
 * "Örüntü benzerliği" modeli (pattern-2d): tek bir 2B tıbbi görüntü kesitine bakıp
 *   1. hangi örüntüye benzediğini (sınıf olasılıkları — ör. sağlıklı referans / beyin içi kitle / iç kulak yolu
 *      kitlesi / kronik doku kaybı alanı),
 *   2. kesitin neresinin örüntüye katkı verdiğini (modelin lezyon olasılık haritası — piksel maskesi),
 *   3. kesitin SAĞLIKLI REFERANS kesitlerinden ne kadar farklı olduğunu (gömme uzayında beyazlatılmış uzaklık,
 *      doğrulama kümesindeki sağlıklı kesitlerin yüzdeliğine çevrilmiş),
 *   4. görüntünün modelin eğitildiği görüntülere benzeyip benzemediğini (eğitim dağılımı dışı — OOD)
 * söyler. Eğitim dağılımı dışındaki kesitte örüntü SÖYLENMEZ (“bu görüntü modelin tanıdığı türde değil”).
 *
 * Her şey cihazda; çıktılar olasılık ve benzerliktir, TANI DEĞİLDİR.
 *
 * Fotoğraf (film/ekran) ya da tek DICOM kesiti: kolaj kesitlere ayrılır (@kh/ingest reviewImage), her kesitte
 * kafa sınırlayıcı kutusu bulunur, kareye tamamlanır, 160×160'a örneklenir ve görüntü başına %1–%99,5
 * yüzdelik normalizasyonu yapılır — eğitimdeki ön işlemeyle birebir aynı (scripts/models/brain_pattern).
 */
import { borderValue, normalize as normalize01, reviewImage, rotateImage } from '@kh/ingest';
import type { RasterImage } from './types';
import type { ModelManifest, Tensor } from './localModel';

export interface PatternSpec {
  /** Sağlıklı referans (doğrulama kümesi) kesitlerinin uzaklık yüzdelikleri: [yüzdelik, uzaklık]. */
  refQuantiles: Array<[number, number]>;
  /** Eğitim dağılımı dışı eşiği (tüm sınıfların doğrulama kesitlerinde %99,5'lik). */
  oodThreshold: number;
  /** Eğitilmiş kapı eşiği: "modelin türünde değil" olasılığı bunu aşarsa örüntü söylenmez. */
  gateThreshold?: number;
  /** Lezyon olasılık haritası eşiği. */
  maskThreshold: number;
  /** En fazla kaç kesit incelenir (kolaj). */
  maxPanels: number;
  /** Yalnızca bu bölgelerde çalışır (3B yapı kimlikleri, ör. ["brain"]); bölge bilinmiyorsa çalışır, OOD kapısı korur. */
  regions?: string[];
  /** Hasta bazlı ayrık test kümesi başarımı (arayüzde gösterilir). */
  metrics?: PatternMetrics;
  /** Eğitim verisinin kaynakları (atıf). */
  data?: Array<{ name: string; license: string; patients: number; slices: number; role: string; url?: string }>;
}

export interface PatternClassMetric {
  n: number;
  sensitivity: number;
  specificity: number;
  precision?: number;
  f1?: number;
  auc?: number;
}

export interface PatternMetrics {
  test: { accuracy: number; macro_f1: number; abnormal_auc: number; abnormal_sens_at_0_5: number; abnormal_spec_at_0_5: number; per_class: Record<string, PatternClassMetric> };
  photo: { accuracy: number; macro_f1: number; abnormal_auc: number; abnormal_sens_at_0_5: number; abnormal_spec_at_0_5: number };
  refAuc: number;
  lesionMapDice: number;
  patients: { train: number; val: number; test: number };
  slices: { train: number; val: number; test: number };
  /** Eğitim dışı kapısı: beyin MR test kesitlerinin geçme oranı ve negatif türlerin reddedilme oranları (test). */
  gate?: { brainPass: number; brainPassPhoto: number; rejected: Record<string, number>; rejectedPhoto: Record<string, number>; negatives: Record<string, number> };
  /**
   * Bulgu eşiğinde (scoreThreshold) hasta bazlı test kümesindeki davranış: lezyonlu kesitlerin yüzde kaçında bir
   * örüntü söylendi (ve doğru örüntü mü), lezyonsuz kesitlerin yüzde kaçında yanlışlıkla söylendi.
   */
  finding?: { threshold: number; lesionReported: number; correctPattern: number; normalFalse: number; lesionReportedPhoto: number; normalFalsePhoto: number; oodRate: number };
  /** Örüntü başına test hasta/kesit sayısı ve kesit düzeyinde duyarlılığın %95 güven aralığı (Wilson). */
  perClassCi?: Record<string, { patients: number; slices: number; sensitivity_ci95: [number, number] }>;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PatternPanelResult {
  /** Kesit sırası (kolajda 0'dan). */
  panel: number;
  /** Kesitin özgün görüntüdeki kutusu. */
  box: Box;
  /** Sınıf olasılıkları (büyükten küçüğe). */
  probs: Array<{ key: string; name: string; p: number }>;
  /** Sağlıklı referansa uzaklık: ham değer ve yüzdeliği (0–100: sağlıklı kesitlerin yüzde kaçından farklı). */
  refDistance: number;
  refPercentile: number;
  /** Eğitim dağılımı dışı mı (öyleyse örüntü söylenmez): gömme uzaklığı ya da eğitilmiş kapı. */
  ood: boolean;
  oodDistance: number;
  /** Eğitilmiş kapının "beyin MR kesiti değil" olasılığı (varsa). */
  gate?: number;
  /** Örüntüye katkı veren alan (özgün görüntünün 64×64'lük ızgarasında 0/1) ve kutusu. */
  mask?: { width: number; height: number; data: number[] };
  maskBox?: Box;
  maskAreaPct: number;
}

export interface PatternExtras {
  panels: PatternPanelResult[];
  /** En belirgin (normal dışı olasılığı en yüksek, OOD olmayan) kesit. */
  lead?: PatternPanelResult;
}

export const PATTERN_SIZE = 160;

/* ------------------------------------------------------------------ ön işleme */

function percentile(sorted: Float32Array, q: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i]!;
}

/** Kesitteki kafanın sınırlayıcı kutusu: arka plan tonundan belirgin farklı satır/sütunların yoğun olduğu aralık. */
export function headBox(gray: Float32Array, W: number, box: Box): Box {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const w = Math.max(1, Math.floor(box.w));
  const h = Math.max(1, Math.floor(box.h));
  const vals = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vals[y * w + x] = gray[(y0 + y) * W + x0 + x] ?? 0;
  const s = vals.slice().sort();
  const lo = percentile(s, 0.05);
  const hi = percentile(s, 0.99);
  const thr = lo + 0.15 * (hi - lo);
  const col = new Float32Array(w);
  const row = new Float32Array(h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (vals[y * w + x]! > thr) {
        col[x] = col[x]! + 1 / h;
        row[y] = row[y]! + 1 / w;
      }
  const span = (a: Float32Array, n: number): [number, number] => {
    let a0 = 0;
    let a1 = n - 1;
    while (a0 < n && a[a0]! < 0.06) a0++;
    while (a1 > a0 && a[a1]! < 0.06) a1--;
    return a1 - a0 < n * 0.2 ? [0, n - 1] : [a0, a1];
  };
  const [cx0, cx1] = span(col, w);
  const [cy0, cy1] = span(row, h);
  return { x: x0 + cx0, y: y0 + cy0, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1 };
}

/** Kafa kutusunu %8 paylı kareye tamamlar (eğitimdeki kırpmayla aynı). */
export function squareAround(b: Box): Box {
  const s = Math.max(b.w, b.h) * 1.08;
  return { x: b.x + b.w / 2 - s / 2, y: b.y + b.h / 2 - s / 2, w: s, h: s };
}

/** Kare kutuyu 160×160'a çift doğrusal örnekler (dışı 0) ve %1–%99,5 yüzdelikle 0–1'e getirir. */
export function patternTensor(gray: Float32Array, W: number, H: number, sq: Box): Tensor {
  const N = PATTERN_SIZE;
  const out = new Float32Array(N * N);
  const k = sq.w / N;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const fx = sq.x + (x + 0.5) * k - 0.5;
      const fy = sq.y + (y + 0.5) * k - 0.5;
      const xa = Math.floor(fx);
      const ya = Math.floor(fy);
      const ax = fx - xa;
      const ay = fy - ya;
      const v = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : gray[yy * W + xx]!);
      out[y * N + x] = (v(xa, ya) * (1 - ax) + v(xa + 1, ya) * ax) * (1 - ay) + (v(xa, ya + 1) * (1 - ax) + v(xa + 1, ya + 1) * ax) * ay;
    }
  const s = out.slice().sort();
  const lo = percentile(s, 0.01);
  const hi = percentile(s, 0.995);
  const d = Math.max(1e-3, hi - lo);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, (out[i]! - lo) / d));
  return { data: out, dims: [1, 1, N, N] };
}

/**
 * Film kolajında kesitler arasındaki PARLAK ayırıcı çizgiler (beyaz ızgara): satır/sütun boyunca piksellerin
 * çoğu parlak olan dar şeritler. Koyu boşluklu kolajlar reviewImage ile zaten ayrılır; bu yalnızca onun tek
 * kesit bulduğu durumda denenir. Her hücre yeterince büyük ve içerikli olmalı.
 */
export function brightGrid(gray: Float32Array, W: number, H: number): Box[] {
  // Eğik çekimde çizgiler birkaç piksel kayar: her satır/sütun ±k komşu satır/sütunla birlikte değerlendirilir.
  const lineAt = (n: number, len: number, get: (i: number, j: number) => number): boolean[] => {
    const k = Math.max(1, Math.round(n * 0.02));
    const bright = new Uint8Array(n * len);
    for (let i = 0; i < n; i++) for (let j = 0; j < len; j++) bright[i * len + j] = get(i, j) > 0.8 ? 1 : 0;
    const out: boolean[] = [];
    const a = Math.floor(len * 0.08);
    const b = Math.ceil(len * 0.92);
    for (let i = 0; i < n; i++) {
      let on = 0;
      for (let j = a; j < b; j++) {
        let hit = 0;
        for (let d = Math.max(0, i - k); d <= Math.min(n - 1, i + k) && !hit; d++) hit = bright[d * len + j]!;
        on += hit;
      }
      out.push(on / Math.max(1, b - a) > 0.8);
    }
    // Yalnızca İNCE şeritler ayırıcıdır (kalın parlak bölge bir görüntünün kendisidir)
    // (yukarıdaki ±k komşuluk şeridi 2k uzatır)
    const maxRun = 2 * k + Math.max(3, Math.round(n * 0.05));
    for (let i = 0; i < n; ) {
      if (!out[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < n && out[j]) j++;
      if (j - i > maxRun) for (let t = i; t < j; t++) out[t] = false;
      i = j;
    }
    return out;
  };
  const rows = lineAt(H, W, (y, x) => gray[y * W + x]!);
  const cols = lineAt(W, H, (x, y) => gray[y * W + x]!);
  const cells = (flags: boolean[], n: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    let start = -1;
    for (let i = 0; i <= n; i++) {
      const sep = i === n || flags[i]!;
      if (!sep && start < 0) start = i;
      if (sep && start >= 0) {
        if (i - start >= n * 0.18) out.push([start, i]);
        start = -1;
      }
    }
    return out;
  };
  const ys = cells(rows, H);
  const xs = cells(cols, W);
  if (ys.length * xs.length < 2) return [];
  // Kolaj hücreleri benzer boyuttadır
  const similar = (c: Array<[number, number]>) => c.length < 2 || Math.min(...c.map(([a, z]) => z - a)) / Math.max(...c.map(([a, z]) => z - a)) > 0.5;
  if (!similar(ys) || !similar(xs)) return [];
  const boxes: Box[] = [];
  for (const [y0, y1] of ys)
    for (const [x0, x1] of xs) {
      // içerik denetimi: hücrenin tamamı düz değilse
      let s = 0;
      let s2 = 0;
      let k = 0;
      for (let y = y0; y < y1; y += 3)
        for (let x = x0; x < x1; x += 3) {
          const v = gray[y * W + x]!;
          s += v;
          s2 += v * v;
          k++;
        }
      const sd = Math.sqrt(Math.max(0, s2 / k - (s / k) ** 2));
      if (sd > 0.05) boxes.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  return boxes.length >= 2 ? boxes : [];
}

/** Görüntüdeki kesitler (kolajsa birden çok) ve döndürme açısı. */
export function patternPanels(img: RasterImage, maxPanels: number): { gray: Float32Array; angle: number; boxes: Box[] } {
  const W = img.width;
  const H = img.height;
  const base = normalize01(img.gray);
  const rev = reviewImage(img.gray, W, H);
  const gray = rev.angle ? rotateImage(base, W, H, rev.angle, borderValue(base, W, H)) : base;
  let boxes = rev.panels.filter((p) => p.kind !== 'too-small').map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
  if (boxes.length <= 1) {
    const grid = brightGrid(gray, W, H);
    if (grid.length >= 2) boxes = grid;
  }
  return { gray, angle: rev.angle, boxes: (boxes.length ? boxes : [{ x: 0, y: 0, w: W, h: H }]).slice(0, maxPanels) };
}

/* ------------------------------------------------------------------ son işleme */

/** Döndürülmüş görüntüdeki noktayı özgün görüntüye taşır (rotateImage ile aynı dönüşüm). */
function unrotate(x: number, y: number, W: number, H: number, deg: number): [number, number] {
  if (!deg) return [x, y];
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  return [c * (x - cx) - s * (y - cy) + cx, s * (x - cx) + c * (y - cy) + cy];
}

const softmax = (xs: number[]) => {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

const num = (t: Tensor, i: number) => Number(t.data[i]);

/** Uzaklığın sağlıklı referans yüzdeliği (doğrusal ara değer; uçlarda kırpılır). */
export function refPercentile(d: number, q: Array<[number, number]>): number {
  if (!q.length) return 0;
  if (d <= q[0]![1]) return q[0]![0];
  for (let i = 1; i < q.length; i++) if (d <= q[i]![1]) return q[i - 1]![0] + ((d - q[i - 1]![1]) / Math.max(1e-9, q[i]![1] - q[i - 1]![1])) * (q[i]![0] - q[i - 1]![0]);
  return q[q.length - 1]![0];
}

export function postprocessPattern(outputs: Record<string, Tensor>, manifest: ModelManifest, ctx: { panel: number; panelBox: Box; square: Box; imageSize: { width: number; height: number }; angle: number }): PatternPanelResult {
  const spec = manifest.pattern!;
  const o = manifest.output;
  const logits = outputs[o.logits!];
  const mask = outputs[o.mask!];
  const ref = outputs[o.refDist!];
  const ood = outputs[o.oodDist!];
  const gateT = o.gate ? outputs[o.gate] : undefined;
  if (!logits || !mask || !ref || !ood || (o.gate && !gateT)) throw new Error('Örüntü modeli çıktıları eksik (logits/mask/ref/ood/gate).');
  const p = softmax(Array.from({ length: logits.data.length }, (_, i) => num(logits, i)));
  const probs = manifest.labels.map((l) => ({ key: l.key ?? String(l.id), name: l.finding, p: Math.round((p[l.id] ?? 0) * 1000) / 1000 })).sort((a, b) => b.p - a.p);
  const refDistance = num(ref, 0);
  const oodDistance = num(ood, 0);
  const [, , mh, mw] = mask.dims as [number, number, number, number];
  // Maske: kare kırpma ızgarası (mw×mh) → özgün görüntünün 64×64'lük ızgarası
  const { width: W, height: H } = ctx.imageSize;
  const G = 64;
  const grid = new Array<number>(G * G).fill(0);
  let on = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const cell = ctx.square.w / mw;
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      const raw = num(mask, y * mw + x);
      const pr = raw >= 0 && raw <= 1 ? raw : 1 / (1 + Math.exp(-raw));
      if (pr < spec.maskThreshold) continue;
      on++;
      const [ox, oy] = unrotate(ctx.square.x + (x + 0.5) * cell, ctx.square.y + (y + 0.5) * cell, W, H, ctx.angle);
      if (ox < 0 || oy < 0 || ox >= W || oy >= H) continue;
      minX = Math.min(minX, ox - cell / 2);
      minY = Math.min(minY, oy - cell / 2);
      maxX = Math.max(maxX, ox + cell / 2);
      maxY = Math.max(maxY, oy + cell / 2);
      // hücrenin kapladığı ızgara gözleri
      const gx0 = Math.max(0, Math.floor(((ox - cell / 2) / W) * G));
      const gx1 = Math.min(G - 1, Math.floor(((ox + cell / 2) / W) * G));
      const gy0 = Math.max(0, Math.floor(((oy - cell / 2) / H) * G));
      const gy1 = Math.min(G - 1, Math.floor(((oy + cell / 2) / H) * G));
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) grid[gy * G + gx] = 1;
    }
  const [bx, by] = unrotate(ctx.panelBox.x, ctx.panelBox.y, W, H, ctx.angle);
  const res: PatternPanelResult = {
    panel: ctx.panel,
    box: { x: Math.round(Math.max(0, bx)), y: Math.round(Math.max(0, by)), w: Math.round(ctx.panelBox.w), h: Math.round(ctx.panelBox.h) },
    probs,
    refDistance: Math.round(refDistance * 1000) / 1000,
    refPercentile: Math.round(refPercentile(refDistance, spec.refQuantiles) * 10) / 10,
    ood: oodDistance > spec.oodThreshold || (gateT !== undefined && num(gateT, 0) > (spec.gateThreshold ?? 0.5)),
    oodDistance: Math.round(oodDistance * 1000) / 1000,
    ...(gateT ? { gate: Math.round(num(gateT, 0) * 1000) / 1000 } : {}),
    maskAreaPct: Math.round((on / (mw * mh)) * 1000) / 10,
  };
  if (on && Number.isFinite(minX)) {
    res.mask = { width: G, height: G, data: grid };
    res.maskBox = { x: Math.round(Math.max(0, minX)), y: Math.round(Math.max(0, minY)), w: Math.round(Math.min(W, maxX) - Math.max(0, minX)), h: Math.round(Math.min(H, maxY) - Math.max(0, minY)) };
  }
  return res;
}

/** Kolajdaki en belirgin kesit: OOD olmayanlar içinde normal dışı olasılığı en yüksek olan. */
export function leadPanel(panels: PatternPanelResult[]): PatternPanelResult | undefined {
  const ok = panels.filter((p) => !p.ood);
  const abn = (p: PatternPanelResult) => 1 - (p.probs.find((x) => x.key === 'normal')?.p ?? 0);
  return ok.sort((a, b) => abn(b) - abn(a))[0];
}
