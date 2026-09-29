/**
 * Görüntü incelemesi (deneysel, cihaz içinde, tanı DEĞİLDİR).
 *
 * Yazısı olmayan bir MR/BT fotoğrafında okunacak rapor yoktur. Bu modül görüntünün kendisinden
 * açıklanabilir, basit ölçümler çıkarır:
 *  1. Kolaj hâlindeki görüntüyü kesitlere (panellere) ayırır.
 *  2. Her kesitte vücut/baş maskesini bulur, orta hattı (simetri eksenini) arar.
 *  3. Sağ ve sol yarıyı ayna görüntüsüyle karşılaştırır; karşı tarafa göre belirgin biçimde daha
 *     parlak ya da daha koyu kalan bölgeleri "dikkat çeken bölge" olarak işaretler.
 *
 * Sınırlar: sağlıklı kişilerde de hafif asimetri olur; baş eğikliği, kesit düzeyi, fotoğraf açısı
 * ve iki tarafı aynı etkileyen (simetrik) değişiklikler bu yöntemle yakalanamaz ya da yanlış
 * işaretlenebilir. Sonuç bir hekim değerlendirmesinin yerini tutmaz; arayüz bunu açıkça yazar.
 */

export interface ReviewRegion {
  /** Özgün görüntü koordinatlarında kutu. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Görüntünün hangi yarısında (radyolojik düzende görüntünün solu çoğunlukla hastanın sağıdır). */
  side: 'left' | 'right';
  vertical: 'top' | 'middle' | 'bottom';
  /** Karşı taraftaki aynı noktaya göre daha parlak mı? */
  brighter: boolean;
  /** Kesitin iç alanına oranı (%). */
  areaPct: number;
  /** Ortalama fark (dayanıklı z birimi). */
  strength: number;
}

export interface PanelReview {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * symmetric: sağ-sol karşılaştırması yapıldı (eksen/koronal kesitler).
   * asymmetric-shape: kesit şekli simetrik değil (ör. yandan/sagital kesit); karşılaştırma yapılmadı.
   * too-small: kesit çok küçük ya da boş.
   */
  kind: 'symmetric' | 'asymmetric-shape' | 'too-small';
  /** Yoğunluk simetrisi (0 = yok, 1 = tam ayna). */
  symmetry: number;
  /** Dış şekil (maske) simetrisi (0–1). */
  shape: number;
  /** Orta hat (özgün koordinatlarda iki uç). */
  midline?: [number, number, number, number];
  regions: ReviewRegion[];
  /** Isı haritası: panel kutusunu kaplayan küçük gri tonlu dizi (0–255). */
  heat?: { w: number; h: number; data: Uint8Array };
  /** Baş kesitine benziyor mu (şekil ipucu; kesin değil). */
  headLike: boolean;
}

export interface ImageReview {
  width: number;
  height: number;
  panels: PanelReview[];
  /** Değerlendirilebilen (simetrik) kesit sayısı. */
  compared: number;
  flagged: number;
  headLike: boolean;
}

export const REVIEW_LIMITS = {
  /** Karşılaştırma çözünürlüğü (uzun kenar, piksel). */
  size: 128,
  /** Dikkat eşiği (dayanıklı z birimi). */
  threshold: 1.8,
  /** En küçük bölge: iç alanın yüzdesi. */
  minAreaPct: 1,
  /** Simetrik sayılmak için maske benzerliği. */
  minSymmetry: 0.82,
  /** Simetrik sayılmak için ayna farkının rastgele farka oranı en fazla. */
  maxRatio: 0.86,
} as const;

/* ------------------------------------------------------------------ yardımcılar */

function percentile(values: Float32Array | number[], p: number): number {
  const a = Float32Array.from(values).sort();
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]!;
}

/** 0–1 aralığına dayanıklı normalleştirme (1. ve 99,5. yüzdelik). */
export function normalize(data: Float32Array): Float32Array {
  const step = Math.max(1, Math.floor(data.length / 60000));
  const sample: number[] = [];
  for (let i = 0; i < data.length; i += step) sample.push(data[i]!);
  const lo = percentile(sample, 0.01);
  const hi = percentile(sample, 0.995);
  const k = hi > lo ? 1 / (hi - lo) : 1;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Math.min(1, Math.max(0, (data[i]! - lo) * k));
  return out;
}

/** Alan ortalamalı küçültme (bölge [x0,y0,w,h] → tw×th). */
function resample(src: Float32Array, sw: number, x0: number, y0: number, w: number, h: number, tw: number, th: number): Float32Array {
  const out = new Float32Array(tw * th);
  const fx = w / tw;
  const fy = h / th;
  for (let ty = 0; ty < th; ty++) {
    const ya = y0 + ty * fy;
    const yb = Math.max(ya + 1, y0 + (ty + 1) * fy);
    for (let tx = 0; tx < tw; tx++) {
      const xa = x0 + tx * fx;
      const xb = Math.max(xa + 1, x0 + (tx + 1) * fx);
      let s = 0;
      let n = 0;
      for (let y = Math.floor(ya); y < Math.floor(yb); y++)
        for (let x = Math.floor(xa); x < Math.floor(xb); x++) {
          s += src[y * sw + x]!;
          n++;
        }
      out[ty * tw + tx] = n ? s / n : 0;
    }
  }
  return out;
}

function blur(src: Float32Array, w: number, h: number, sigma: number, weight?: Uint8Array): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const k: number[] = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const pass = (a: Float32Array, wa: Float32Array, horizontal: boolean) => {
    const o = new Float32Array(a.length);
    const ow = new Float32Array(a.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0;
        let sw = 0;
        for (let i = -r; i <= r; i++) {
          const xx = horizontal ? x + i : x;
          const yy = horizontal ? y : y + i;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          const kk = k[i + r]! * wa[j]!;
          s += a[j]! * kk;
          sw += kk;
        }
        o[y * w + x] = sw > 0 ? s / sw : 0;
        ow[y * w + x] = sw;
      }
    return o;
  };
  const wa = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) wa[i] = weight ? weight[i]! : 1;
  // Maske ağırlıklı bulanıklaştırma: maske dışı (kafatası, arka plan) içeri sızmasın.
  return pass(pass(src, wa, true), wa, false);
}

function otsu(values: Float32Array): number {
  const bins = new Array<number>(64).fill(0);
  for (const v of values) bins[Math.min(63, Math.floor(v * 64))]!++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += i * bins[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let at = 16;
  for (let i = 0; i < 64; i++) {
    wB += bins[i]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * bins[i]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      at = i;
    }
  }
  return (at + 0.5) / 64;
}

/** En büyük bağlı bileşen + delik doldurma. */
function largestBlob(mask: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  let bestId = -1;
  let bestSize = 0;
  let id = 0;
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i]! >= 0) continue;
    let size = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && mask[q] && label[q]! < 0) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
    id++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = label[i] === bestId ? 1 : 0;
  // Delik doldurma: kenardan ulaşılamayan boşluklar maskeye katılır.
  const outside = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (!out[y * w + x] && !outside[y * w + x]) flood(x, y);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (!out[y * w + x] && !outside[y * w + x]) flood(x, y);
  function flood(sx: number, sy: number) {
    stack.push(sy * w + sx);
    outside[sy * w + sx] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !out[q] && !outside[q]) {
          outside[q] = 1;
          stack.push(q);
        }
      }
    }
  }
  for (let i = 0; i < out.length; i++) if (!outside[i]) out[i] = 1;
  return out;
}

/** Kenara uzaklık (şehir bloğu, iki geçişli). */
function distance(mask: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h);
  const INF = 1e6;
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, (x > 0 ? d[i - 1]! : 0) + 1, (y > 0 ? d[i - w]! : 0) + 1);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, (x < w - 1 ? d[i + 1]! : 0) + 1, (y < h - 1 ? d[i + w]! : 0) + 1);
    }
  return d;
}

/* ------------------------------------------------------------------ paneller */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bir eksende içerik taşıyan aralıklar (boş ya da tekdüze çizgiler ayırıcıdır). */
function runs(img: Float32Array, W: number, box: Box, vertical: boolean, minFrac: number): Array<[number, number]> {
  const len = vertical ? box.w : box.h;
  const across = vertical ? box.h : box.w;
  const content: boolean[] = [];
  for (let i = 0; i < len; i++) {
    let lit = 0;
    let s = 0;
    let s2 = 0;
    for (let j = 0; j < across; j++) {
      const v = vertical ? img[(box.y + j) * W + box.x + i]! : img[(box.y + i) * W + box.x + j]!;
      if (v > 0.1) lit++;
      s += v;
      s2 += v * v;
    }
    const mean = s / across;
    const std = Math.sqrt(Math.max(0, s2 / across - mean * mean));
    content.push(lit / across > 0.02 && std > 0.035);
  }
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= len; i++) {
    if (i < len && content[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (i - start >= len * minFrac) out.push([start, i]);
      start = -1;
    }
  }
  return out;
}

function trim(img: Float32Array, W: number, b: Box): Box | null {
  let x0 = b.x + b.w;
  let y0 = b.y + b.h;
  let x1 = b.x;
  let y1 = b.y;
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++)
      if (img[y * W + x]! > 0.1) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  if (x1 < x0 || y1 < y0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Kolajı kesitlere ayırır (en fazla 3 düzey sütun/satır bölmesi). */
export function splitPanels(img: Float32Array, W: number, H: number): Box[] {
  const out: Box[] = [];
  const minSide = Math.min(W, H) * 0.12;
  const visit = (b: Box, vertical: boolean, depth: number) => {
    const parts = runs(img, W, b, vertical, 0.08);
    if (parts.length > 1 && depth < 4) {
      for (const [a, z] of parts) visit(vertical ? { x: b.x + a, y: b.y, w: z - a, h: b.h } : { x: b.x, y: b.y + a, w: b.w, h: z - a }, !vertical, depth + 1);
      return;
    }
    if (depth < 2) {
      // Bu yönde bölünmedi: diğer yönü dene.
      const other = runs(img, W, b, !vertical, 0.08);
      if (other.length > 1) {
        for (const [a, z] of other) visit(!vertical ? { x: b.x + a, y: b.y, w: z - a, h: b.h } : { x: b.x, y: b.y + a, w: b.w, h: z - a }, vertical, depth + 2);
        return;
      }
    }
    const t = trim(img, W, b);
    if (t && t.w >= minSide && t.h >= minSide) out.push(t);
  };
  visit({ x: 0, y: 0, w: W, h: H }, true, 0);
  return out;
}

/* ------------------------------------------------------------------ kesit */

function reflect(x: number, y: number, cx: number, cy: number, c: number, s: number): [number, number] {
  // Orta hat: (cx,cy)'den geçen, düşeyle `a` açısı yapan doğru; yön (s, c) = (sin a, cos a).
  const dx = x - cx;
  const dy = y - cy;
  const along = dx * s + dy * c;
  const px = cx + along * s;
  const py = cy + along * c;
  return [2 * px - x, 2 * py - y];
}

export function reviewPanel(img: Float32Array, W: number, box: Box): PanelReview {
  const N = REVIEW_LIMITS.size;
  const scale = N / Math.max(box.w, box.h);
  const w = Math.max(8, Math.round(box.w * scale));
  const h = Math.max(8, Math.round(box.h * scale));
  const empty: PanelReview = { ...box, kind: 'too-small', symmetry: 0, shape: 0, regions: [], headLike: false };
  if (box.w < 40 || box.h < 40) return empty;
  const small = resample(img, W, box.x, box.y, box.w, box.h, w, h);
  const t = otsu(small);
  const raw = new Uint8Array(w * h);
  for (let i = 0; i < raw.length; i++) raw[i] = small[i]! > Math.max(0.06, t * 0.45) ? 1 : 0;
  const mask = largestBlob(raw, w, h);
  let area = 0;
  let sx = 0;
  let sy = 0;
  let bx0 = w;
  let bx1 = 0;
  let by0 = h;
  let by1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        area++;
        sx += x;
        sy += y;
        bx0 = Math.min(bx0, x);
        bx1 = Math.max(bx1, x);
        by0 = Math.min(by0, y);
        by1 = Math.max(by1, y);
      }
  if (area < w * h * 0.12) return empty;
  const cx0 = sx / area;
  const cy0 = sy / area;
  const bw = bx1 - bx0 + 1;
  const bh = by1 - by0 + 1;
  // İç bölge (kafatası/cilt halkası dışarıda): hem orta hat aramasında hem karşılaştırmada kullanılır.
  const dist = distance(mask, w, h);
  const inset = Math.max(3, Math.round(Math.min(bw, bh) * 0.085));
  const core: number[] = [];
  for (let i = 0; i < dist.length; i++) if (dist[i]! > inset * 0.6) core.push(i);

  // Orta hat araması: açı ve kaydırma. Maliyet = iç bölgede ayna noktasıyla ortalama yoğunluk farkı
  // (orak, ventriküller gibi orta hat yapıları belirleyicidir) + maske uyumsuzluğu (küçük ağırlık).
  const evaluate = (deg: number, off: number) => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const cx = cx0 + off;
    let n = 0;
    let diff = 0;
    for (let k = 0; k < core.length; k += 2) {
      const i = core[k]!;
      const x = i % w;
      const y = (i - x) / w;
      const [rx, ry] = reflect(x, y, cx, cy0, c, s);
      const ix = Math.round(rx);
      const iy = Math.round(ry);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h || !mask[iy * w + ix]) continue;
      n++;
      diff += Math.abs(small[i]! - small[iy * w + ix]!);
    }
    let inter = 0;
    let uni = 0;
    for (let y = by0; y <= by1; y += 2)
      for (let x = bx0; x <= bx1; x += 2) {
        const m = mask[y * w + x]!;
        const [rx, ry] = reflect(x, y, cx, cy0, c, s);
        const ix = Math.round(rx);
        const iy = Math.round(ry);
        const mm = ix >= 0 && iy >= 0 && ix < w && iy < h ? mask[iy * w + ix]! : 0;
        if (m || mm) uni++;
        if (m && mm) inter++;
      }
    const iou = uni ? inter / uni : 0;
    const d = n > core.length * 0.2 ? diff / n : 1;
    return { cost: d + (1 - iou) * 0.02, cx, a, iou, d };
  };
  let best = evaluate(0, 0);
  for (let deg = -20; deg <= 20; deg += 2) for (let off = -8; off <= 8; off += 2) {
    const e = evaluate(deg, off);
    if (e.cost < best.cost) best = e;
  }
  const d0 = (best.a * 180) / Math.PI;
  const o0 = best.cx - cx0;
  for (let deg = d0 - 1.5; deg <= d0 + 1.5; deg += 0.5) for (let off = o0 - 1; off <= o0 + 1; off += 0.5) {
    const e = evaluate(deg, off);
    if (e.cost < best.cost) best = e;
  }
  // Yoğunluk simetrisi: ayna farkı, rastgele eşleşmelerin farkına oranla (1'e yakınsa simetri yok, ör. sagital kesit).
  let base = 0;
  let bn = 0;
  for (let k = 0; k < core.length; k += 3) {
    const i = core[k]!;
    const j = core[(k * 7919 + 13) % core.length]!;
    base += Math.abs(small[i]! - small[j]!);
    bn++;
  }
  const ratio = bn && base > 0 ? best.d / (base / bn) : 1;
  const aspect = bh / bw;
  const symmetric = best.iou >= REVIEW_LIMITS.minSymmetry && ratio <= REVIEW_LIMITS.maxRatio;
  const headLike = symmetric && aspect >= 0.95 && aspect <= 1.55;
  const toOrig = (x: number, y: number): [number, number] => [box.x + x / scale, box.y + y / scale];
  const c = Math.cos(best.a);
  const s = Math.sin(best.a);
  const half = bh * 0.55;
  const top = toOrig(best.cx - s * half, cy0 - c * half);
  const bottom = toOrig(best.cx + s * half, cy0 + c * half);
  const panel: PanelReview = { ...box, kind: 'asymmetric-shape', symmetry: Math.round(Math.max(0, 1 - ratio) * 100) / 100, shape: Math.round(best.iou * 100) / 100, midline: [top[0], top[1], bottom[0], bottom[1]], regions: [], headLike };
  if (!symmetric) {
    delete panel.midline;
    return panel;
  }
  panel.kind = 'symmetric';

  const inner = new Uint8Array(w * h);
  let innerArea = 0;
  for (let i = 0; i < inner.length; i++)
    if (dist[i]! > inset) {
      inner[i] = 1;
      innerArea++;
    }
  if (innerArea < 200) return panel;
  const vals: number[] = [];
  for (let i = 0; i < inner.length; i++) if (inner[i]) vals.push(small[i]!);
  const med = percentile(vals, 0.5);
  const mad = percentile(
    vals.map((v) => Math.abs(v - med)),
    0.5,
  );
  const sd = 1.4826 * mad + 0.02;
  const z = new Float32Array(w * h);
  for (let i = 0; i < z.length; i++) z[i] = (small[i]! - med) / sd;
  const zs = blur(z, w, h, 2.2, inner);

  // Fark haritası: her noktada karşı taraftaki aynı noktayla fark; yalnızca "daha sapkın" taraf işaretlenir.
  const d = new Float32Array(w * h);
  const heat = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!inner[i]) continue;
      const [rx, ry] = reflect(x, y, best.cx, cy0, c, s);
      const ix = Math.round(rx);
      const iy = Math.round(ry);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
      const j = iy * w + ix;
      if (!inner[j]) continue;
      // Hizalama hatasına tolerans: ayna noktasının 3×3 komşuluğundaki en yakın değerle karşılaştır
      // (±1 piksel kayma kenarlarda yapay fark üretmesin).
      let diff = zs[i]! - zs[j]!;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const qx = ix + ox;
          const qy = iy + oy;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h || !inner[qy * w + qx]) continue;
          const dd = zs[i]! - zs[qy * w + qx]!;
          if (Math.abs(dd) < Math.abs(diff)) diff = dd;
        }
      if (Math.abs(zs[i]!) < Math.abs(zs[j]!)) continue;
      d[i] = diff;
      heat[i] = Math.min(255, Math.round((Math.abs(diff) / (REVIEW_LIMITS.threshold * 2)) * 255));
    }
  panel.heat = { w, h, data: heat };

  // Eşik üstü bağlı bölgeler.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < d.length; i++) {
    if (seen[i] || Math.abs(d[i]!) < REVIEW_LIMITS.threshold) continue;
    const sign = Math.sign(d[i]!);
    const pts: number[] = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      pts.push(p);
      const x = p % w;
      const y = (p - x) / w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !seen[q] && Math.sign(d[q]!) === sign && Math.abs(d[q]!) >= REVIEW_LIMITS.threshold * 0.8) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    const pct = (pts.length / innerArea) * 100;
    if (pct < REVIEW_LIMITS.minAreaPct) continue;
    let rx0 = w;
    let ry0 = h;
    let rx1 = 0;
    let ry1 = 0;
    let sum = 0;
    let mx = 0;
    let my = 0;
    for (const p of pts) {
      const x = p % w;
      const y = (p - x) / w;
      rx0 = Math.min(rx0, x);
      ry0 = Math.min(ry0, y);
      rx1 = Math.max(rx1, x);
      ry1 = Math.max(ry1, y);
      sum += Math.abs(d[p]!);
      mx += x;
      my += y;
    }
    mx /= pts.length;
    my /= pts.length;
    // Orta hatta göre hangi yarı (eğiklik hesaba katılarak).
    const sideVal = (mx - best.cx) * c - (my - cy0) * s;
    const rel = (my - by0) / bh;
    const [ox, oy] = toOrig(rx0, ry0);
    panel.regions.push({
      x: ox,
      y: oy,
      w: (rx1 - rx0 + 1) / scale,
      h: (ry1 - ry0 + 1) / scale,
      side: sideVal < 0 ? 'left' : 'right',
      vertical: rel < 0.36 ? 'top' : rel > 0.64 ? 'bottom' : 'middle',
      brighter: sign > 0,
      areaPct: Math.round(pct * 10) / 10,
      strength: Math.round((sum / pts.length) * 10) / 10,
    });
  }
  panel.regions.sort((a, b) => b.areaPct * b.strength - a.areaPct * a.strength);
  panel.regions = panel.regions.slice(0, 4);
  return panel;
}

/** Gri tonlu görüntünün tamamını inceler (değerler herhangi bir aralıkta olabilir). */
export function reviewImage(gray: Float32Array, width: number, height: number): ImageReview {
  // Çok büyük görüntüler önce küçültülür (panel bulma için 700 piksel yeterli).
  const k = Math.min(1, 700 / Math.max(width, height));
  const W = Math.max(1, Math.round(width * k));
  const H = Math.max(1, Math.round(height * k));
  const norm = normalize(gray);
  const img = k < 1 ? resample(norm, width, 0, 0, width, height, W, H) : norm;
  const panels = splitPanels(img, W, H)
    .slice(0, 16)
    .map((b) => reviewPanel(img, W, b))
    .map((p) => {
      // Koordinatları özgün boyuta geri çevir.
      if (k === 1) return p;
      const f = 1 / k;
      return {
        ...p,
        x: p.x * f,
        y: p.y * f,
        w: p.w * f,
        h: p.h * f,
        midline: p.midline?.map((v) => v * f) as PanelReview['midline'],
        regions: p.regions.map((r) => ({ ...r, x: r.x * f, y: r.y * f, w: r.w * f, h: r.h * f })),
      };
    });
  const compared = panels.filter((p) => p.kind === 'symmetric').length;
  const flagged = panels.reduce((n, p) => n + p.regions.length, 0);
  const valid = panels.filter((p) => p.kind !== 'too-small');
  const headLike = valid.length > 0 && valid.filter((p) => p.headLike).length >= Math.ceil(valid.length / 2);
  return { width, height, panels, compared, flagged, headLike };
}
