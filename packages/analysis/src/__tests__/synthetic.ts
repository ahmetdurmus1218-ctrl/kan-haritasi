/**
 * Testler için sentetik görüntüler. Gerçek hasta verisi kullanılmaz.
 */

export interface Rgba {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

function blank(width: number, height: number, rgb: [number, number, number]): Rgba {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    rgba[p * 4] = rgb[0];
    rgba[p * 4 + 1] = rgb[1];
    rgba[p * 4 + 2] = rgb[2];
    rgba[p * 4 + 3] = 255;
  }
  return { rgba, width, height };
}

function set(img: Rgba, x: number, y: number, rgb: [number, number, number]) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (Math.round(y) * img.width + Math.round(x)) * 4;
  img.rgba[i] = rgb[0];
  img.rgba[i + 1] = rgb[1];
  img.rgba[i + 2] = rgb[2];
}

/**
 * EKG kâğıdı: pembe milimetrik ızgara (1 mm = `mm` piksel, her 5 mm'de kalın çizgi) ve siyah iz.
 * `bpm` hızında QRS (ayrıca küçük P ve T dalgaları); `jitter` RR değişkenliği (0–1).
 */
export function ecgImage(opts: { mm?: number; bpm?: number; rows?: number; jitter?: number; width?: number } = {}): Rgba {
  const mm = opts.mm ?? 8;
  const bpm = opts.bpm ?? 75;
  const rows = opts.rows ?? 1;
  const width = opts.width ?? 1200;
  const rowH = Math.round(mm * 30);
  const height = rowH * rows + mm * 10;
  const img = blank(width, height, [253, 240, 240]);
  for (let x = 0; x < width; x++)
    for (let y = 0; y < height; y++) {
      const major = x % (mm * 5) === 0 || y % (mm * 5) === 0;
      const minor = x % mm === 0 || y % mm === 0;
      if (major) set(img, x, y, [235, 120, 130]);
      else if (minor) set(img, x, y, [245, 190, 195]);
    }
  const pxPerBeat = (60 / bpm) * 25 * mm;
  for (let r = 0; r < rows; r++) {
    const base = r * rowH + rowH * 0.65;
    const beats: number[] = [];
    let t = mm * 6;
    let k = 0;
    while (t < width - mm * 4) {
      beats.push(t);
      const j = opts.jitter ? (k % 2 ? 1 : -1) * opts.jitter * pxPerBeat : 0;
      t += pxPerBeat + j;
      k++;
    }
    let prev = base;
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (const b of beats) {
        const d = x - b;
        // P dalgası (1,5 mm), QRS (12 mm yukarı, dar), T dalgası (3 mm)
        v += 1.5 * mm * Math.exp(-(((d + 4 * mm) / (0.9 * mm)) ** 2));
        if (Math.abs(d) <= mm) v += 12 * mm * (1 - Math.abs(d) / mm);
        if (d > mm && d < 1.6 * mm) v -= 2 * mm * (1 - Math.abs(d - 1.3 * mm) / (0.3 * mm));
        v += 3 * mm * Math.exp(-(((d - 8 * mm) / (1.6 * mm)) ** 2));
      }
      const y = base - v;
      // Kalın (2 piksel) çizgi, önceki noktayla birleştirilmiş
      const lo = Math.min(prev, y);
      const hi = Math.max(prev, y);
      for (let yy = Math.floor(lo); yy <= Math.ceil(hi) + 1; yy++) set(img, x, yy, [25, 25, 30]);
      prev = y;
    }
  }
  return img;
}

/** Gri tonlu RGBA (fotoğraf gibi) olarak sarar. */
export function grayToRgba(gray: Float32Array, width: number, height: number): Rgba {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < gray.length; p++) {
    const v = Math.max(0, Math.min(255, gray[p]!));
    rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = v;
    rgba[p * 4 + 3] = 255;
  }
  return { rgba, width, height };
}

/** Eksenel "baş" kesiti (dokulu simetrik beyin); isteğe bağlı tek taraflı parlak odak. */
export function headSlice(w: number, h: number, lesion?: { x: number; y: number; r: number; v: number }): Float32Array {
  const img = new Float32Array(w * h);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.36;
  const ry = h * 0.44;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const e = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (e > 1) continue;
      let v = e > 0.82 ? 220 : 120 + 25 * Math.cos(Math.abs(dx) * 0.35) * Math.cos(dy * 0.3);
      if (Math.abs(dx) < w * 0.05 && Math.abs(dy) < h * 0.12) v = 40;
      if (lesion && (x - lesion.x) ** 2 + (y - lesion.y) ** 2 < lesion.r * lesion.r) v = lesion.v;
      img[y * w + x] = v;
    }
  return img;
}

/** Ultrason benzeri sektör (yelpaze) görüntüsü: koyu zemin, üst ortada tepe, benekli doku. */
export function ultrasoundImage(width = 480, height = 400): Rgba {
  const gray = new Float32Array(width * height);
  const ax = width / 2;
  const ay = 20;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = x - ax;
      const dy = y - ay;
      const r = Math.hypot(dx, dy);
      const ang = Math.atan2(dx, dy);
      if (dy <= 0 || r > height - 40 || Math.abs(ang) > 0.62) continue;
      // Benek gürültüsü + derinlikle azalan parlaklık + koyu ovaller (damar/kist benzeri)
      let v = 70 + 90 * rnd() * (1 - r / height);
      if ((x - ax - 30) ** 2 / 900 + (y - 200) ** 2 / 400 < 1) v *= 0.2;
      gray[y * width + x] = v;
    }
  return grayToRgba(gray, width, height);
}

/** H&E boyalı patoloji kesiti benzeri: beyaz zemin, pembe stroma, mor çekirdekler. */
export function pathologyImage(width = 400, height = 300): Rgba {
  const img = blank(width, height, [245, 243, 247]);
  let seed = 3;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if ((x - 200) ** 2 / 170 ** 2 + (y - 150) ** 2 / 120 ** 2 < 1) set(img, x, y, [228 - 20 * rnd(), 150 - 20 * rnd(), 190 - 15 * rnd()]);
    }
  for (let k = 0; k < 160; k++) {
    const cx = 60 + rnd() * 280;
    const cy = 50 + rnd() * 200;
    if ((cx - 200) ** 2 / 165 ** 2 + (cy - 150) ** 2 / 115 ** 2 >= 1) continue;
    const r = 3 + rnd() * 2;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(img, cx + x, cy + y, [85, 50, 140]);
  }
  return img;
}

/** Laboratuvar kâğıdı fotoğrafı benzeri: beyaz sayfa, siyah yazı satırları. */
export function documentImage(width = 600, height = 800): Rgba {
  const img = blank(width, height, [236, 236, 232]);
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let line = 0; line < 30; line++) {
    const y0 = 60 + line * 22;
    let x = 50;
    while (x < width - 60) {
      const wlen = 20 + rnd() * 60;
      for (let xx = x; xx < x + wlen; xx++) for (let yy = y0; yy < y0 + 10; yy++) if (rnd() < 0.45) set(img, xx, yy, [20, 20, 20]);
      x += wlen + 12;
    }
  }
  return img;
}

/** Ayrılabilir Gauss bulanıklaştırma (kalite testleri için). */
export function gaussianBlur(data: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.ceil(sigma * 3);
  const k: number[] = [];
  let ks = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    ks += v;
  }
  const tmp = new Float32Array(data.length);
  const out = new Float32Array(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += data[y * w + Math.min(w - 1, Math.max(0, x + i))]! * k[i + r]!;
      tmp[y * w + x] = s / ks;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]! * k[i + r]!;
      out[y * w + x] = s / ks;
    }
  return out;
}
