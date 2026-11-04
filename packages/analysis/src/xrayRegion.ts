/**
 * Telefon fotoğrafında ya da ekran görüntüsünde röntgenin kapladığı dikdörtgeni bulur.
 *
 * Görüntü ~128 piksele alan ortalamasıyla küçültülür (ekran moiré deseni, gürültü ve küçük yazılar söner); 5×5
 * pencerede yerel standart sapma = orta ölçekli doku (akciğer, kaburga, mediasten). Düz arayüz, negatoskop ışığı ve
 * çerçeve dokusuzdur. Dokulu maske açılır (ince kenar çizgileri silinir); satırlarda ve sütunlarda dokulu oranın
 * ≥ %15 olduğu en uzun kesintisiz aralık röntgenin kutusudur.
 *
 * Python eşi (ölçüm ve eşdeğerlik fikstürleri): scripts/models/xray_photo/xray_eval.py — `xray_region`.
 */
export interface XrayRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** numpy.percentile (doğrusal ara değer) ile aynı. */
function percentile(values: Float32Array, q: number): number {
  const s = Float32Array.from(values).sort();
  const pos = (q / 100) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(s.length - 1, lo + 1);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/** scipy.ndimage.uniform_filter(size=5, mode='nearest') — ayrık, kenarda en yakın değer tekrarlanır. */
function box5(src: Float64Array, w: number, h: number): Float64Array {
  const tmp = new Float64Array(w * h);
  const out = new Float64Array(w * h);
  const cl = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let t = -2; t <= 2; t++) a += src[y * w + cl(x + t, w)]!;
      tmp[y * w + x] = a / 5;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let t = -2; t <= 2; t++) a += tmp[cl(y + t, h) * w + x]!;
      out[y * w + x] = a / 5;
    }
  return out;
}

/** scipy.ndimage.binary_opening(iterations=1), çapraz (4-komşu) yapı; görüntü dışı 0 sayılır. */
function open4(m: Uint8Array, w: number, h: number): Uint8Array {
  const at = (src: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]!);
  const er = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) er[y * w + x] = at(m, x, y) && at(m, x - 1, y) && at(m, x + 1, y) && at(m, x, y - 1) && at(m, x, y + 1) ? 1 : 0;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out[y * w + x] = at(er, x, y) || at(er, x - 1, y) || at(er, x + 1, y) || at(er, x, y - 1) || at(er, x, y + 1) ? 1 : 0;
  return out;
}

/** En uzun kesintisiz aralık (değer ≥ eşik): [uzunluk, başlangıç, bitiş]. */
function longestRun(a: number[], thr: number): [number, number, number] {
  let best: [number, number, number] = [0, 0, -1];
  let cur = 0;
  let s0 = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i]! >= thr) {
      if (cur === 0) s0 = i;
      cur++;
      if (cur > best[0]) best = [cur, s0, i];
    } else cur = 0;
  }
  return best;
}

export function xrayRegion(gray: Float32Array, W: number, H: number): XrayRegion {
  const full = { x: 0, y: 0, w: W, h: H };
  const B = Math.max(1, Math.ceil(Math.max(H, W) / 128));
  const hb = Math.floor(H / B);
  const wb = Math.floor(W / B);
  if (hb < 16 || wb < 16) return full;
  const small = new Float64Array(hb * wb);
  for (let y = 0; y < hb * B; y++) {
    const row = Math.floor(y / B) * wb;
    for (let x = 0; x < wb * B; x++) small[row + Math.floor(x / B)]! += gray[y * W + x]!;
  }
  const sq = new Float64Array(hb * wb);
  for (let i = 0; i < small.length; i++) {
    small[i]! /= B * B;
    sq[i] = small[i]! * small[i]!;
  }
  const m1 = box5(small, wb, hb);
  const m2 = box5(sq, wb, hb);
  const sd = new Float32Array(hb * wb);
  for (let i = 0; i < sd.length; i++) sd[i] = Math.sqrt(Math.max(0, m2[i]! - m1[i]! * m1[i]!));
  const thr = Math.max(2.5, 0.3 * percentile(sd, 75));
  const raw = new Uint8Array(hb * wb);
  for (let i = 0; i < sd.length; i++) raw[i] = sd[i]! > thr ? 1 : 0;
  const m = open4(raw, wb, hb);
  const rowOcc: number[] = [];
  for (let y = 0; y < hb; y++) {
    let a = 0;
    for (let x = 0; x < wb; x++) a += m[y * wb + x]!;
    rowOcc.push(a / wb);
  }
  const [n, r0, r1] = longestRun(rowOcc, 0.15);
  if (n < 8) return full;
  const colOcc: number[] = [];
  for (let x = 0; x < wb; x++) {
    let a = 0;
    for (let y = r0; y <= r1; y++) a += m[y * wb + x]!;
    colOcc.push(a / (r1 - r0 + 1));
  }
  const [n2, c0, c1] = longestRun(colOcc, 0.15);
  if (n2 < 8) return full;
  return { x: c0 * B, y: r0 * B, w: (c1 - c0 + 1) * B, h: (r1 - r0 + 1) * B };
}

/**
 * Modelin bakacağı alan: röntgen kutusu görüntünün %80'inden küçükse (ekran görüntüsü, ekran ya da film fotoğrafı)
 * %3 paylı kutu, değilse tüm görüntü (taranmış/dijital röntgen olduğu gibi kalır).
 */
export function xrayFrame(gray: Float32Array, W: number, H: number): XrayRegion {
  const b = xrayRegion(gray, W, H);
  if (b.w * b.h >= 0.8 * W * H) return { x: 0, y: 0, w: W, h: H };
  const x0 = Math.max(0, Math.trunc(b.x - 0.03 * b.w));
  const y0 = Math.max(0, Math.trunc(b.y - 0.03 * b.h));
  const x1 = Math.min(W, Math.trunc(b.x + b.w * 1.03));
  const y1 = Math.min(H, Math.trunc(b.y + b.h * 1.03));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
