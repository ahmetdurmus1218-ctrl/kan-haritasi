/**
 * JPEG Lossless (ITU T.81, süreç 14 — SOF3, Huffman) çözücü: DICOM aktarım sözdizimleri 1.2.840.10008.1.2.4.57 ve
 * 1.2.840.10008.1.2.4.70 (birinci derece öngörü, SV1). Hastane CD'lerindeki BT/MR serilerinin önemli bir kısmı
 * bu biçimdedir. Yalnızca tek bileşen (gri tonlama) ve 2–16 bit hassasiyet desteklenir; kayıpsızdır, yani
 * çözülen değerler özgün piksellerle bit bit aynıdır.
 */

export class JpegLosslessError extends Error {}

interface Huffman {
  /** Kod uzunluğu l için en büyük kod (yoksa -1) ve o uzunluktaki ilk değerin HUFFVAL indeksi. */
  maxcode: Int32Array;
  valptr: Int32Array;
  mincode: Int32Array;
  values: Uint8Array;
}

function buildHuffman(bits: Uint8Array, values: Uint8Array): Huffman {
  const maxcode = new Int32Array(18).fill(-1);
  const valptr = new Int32Array(17);
  const mincode = new Int32Array(17);
  let code = 0;
  let k = 0;
  for (let l = 1; l <= 16; l++) {
    const n = bits[l - 1]!;
    if (n) {
      valptr[l] = k;
      mincode[l] = code;
      code += n;
      k += n;
      maxcode[l] = code - 1;
    }
    code <<= 1;
  }
  maxcode[17] = 0x7fffffff;
  return { maxcode, valptr, mincode, values };
}

/** Bayt doldurmalı (FF 00) entropi verisini bit bit okur; bir işarete (FF xx) gelince durur. */
class BitReader {
  private bit = 0;
  private cur = 0;
  pos: number;
  marker = -1;
  constructor(
    private readonly d: Uint8Array,
    start: number,
  ) {
    this.pos = start;
  }
  private nextByte(): number {
    if (this.marker >= 0) return 0;
    const b = this.d[this.pos];
    if (b === undefined) throw new JpegLosslessError('Beklenmeyen veri sonu');
    if (b === 0xff) {
      const n = this.d[this.pos + 1];
      if (n === 0x00) {
        this.pos += 2;
        return 0xff;
      }
      // İşaret: okumayı durdur (kalan bitler 0 kabul edilir)
      this.marker = n ?? 0;
      return 0;
    }
    this.pos++;
    return b;
  }
  read1(): number {
    if (this.bit === 0) {
      this.cur = this.nextByte();
      this.bit = 8;
    }
    this.bit--;
    return (this.cur >> this.bit) & 1;
  }
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | this.read1();
    return v;
  }
  /** Yeniden başlatma (RSTn) işaretini tüketir ve bit tamponunu sıfırlar. */
  restart(): void {
    this.bit = 0;
    if (this.marker < 0) {
      // Henüz işarete gelinmediyse ileri tara (dolgu bitlerinden sonra)
      while (this.pos + 1 < this.d.length && !(this.d[this.pos] === 0xff && this.d[this.pos + 1]! >= 0xd0 && this.d[this.pos + 1]! <= 0xd7)) this.pos++;
      this.marker = this.d[this.pos + 1] ?? -1;
    }
    if (this.marker >= 0xd0 && this.marker <= 0xd7) this.pos += 2;
    else throw new JpegLosslessError('Yeniden başlatma işareti bekleniyordu');
    this.marker = -1;
  }
  decode(h: Huffman): number {
    let code = this.read1();
    let l = 1;
    while (code > h.maxcode[l]!) {
      code = (code << 1) | this.read1();
      if (++l > 16) throw new JpegLosslessError('Geçersiz Huffman kodu');
    }
    return h.values[h.valptr[l]! + code - h.mincode[l]!]!;
  }
}

export interface LosslessImage {
  width: number;
  height: number;
  precision: number;
  /** Çözülen örnekler (işaretsiz bit deseni, 0 … 2^precision − 1). */
  samples: Uint16Array;
}

/** Tek bileşenli JPEG Lossless akışını çözer. */
export function decodeJpegLossless(d: Uint8Array): LosslessImage {
  if (d[0] !== 0xff || d[1] !== 0xd8) throw new JpegLosslessError('SOI yok');
  const tables = new Map<number, Huffman>();
  let width = 0, height = 0, precision = 0, restartInterval = 0;
  let p = 2;
  const u16 = (i: number) => (d[i]! << 8) | d[i + 1]!;
  while (p + 4 <= d.length) {
    if (d[p] !== 0xff) {
      p++;
      continue;
    }
    const m = d[p + 1]!;
    if (m === 0xff) {
      p++;
      continue;
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) {
      p += 2;
      continue;
    }
    if (m === 0xd9) break;
    const len = u16(p + 2);
    const seg = p + 4;
    if (m === 0xc4) {
      let q = seg;
      while (q < p + 2 + len) {
        const tcth = d[q]!;
        const bits = d.subarray(q + 1, q + 17);
        const total = bits.reduce((s, x) => s + x, 0);
        tables.set(tcth & 0x0f, buildHuffman(bits, d.subarray(q + 17, q + 17 + total)));
        q += 17 + total;
      }
    } else if (m === 0xc3) {
      precision = d[seg]!;
      height = u16(seg + 1);
      width = u16(seg + 3);
      if (d[seg + 5] !== 1) throw new JpegLosslessError('Yalnızca tek bileşenli (gri) JPEG Lossless desteklenir');
    } else if (m === 0xdd) {
      restartInterval = u16(seg);
    } else if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      throw new JpegLosslessError('JPEG Lossless (SOF3) değil');
    } else if (m === 0xda) {
      if (!width || !height) throw new JpegLosslessError('SOF3 yok');
      if (d[seg] !== 1) throw new JpegLosslessError('Tek bileşen bekleniyordu');
      const table = tables.get(d[seg + 2]! >> 4);
      if (!table) throw new JpegLosslessError('Huffman tablosu yok');
      const predictor = d[seg + 3]!;
      const pt = d[seg + 5]! & 0x0f;
      if (predictor < 1 || predictor > 7) throw new JpegLosslessError('Geçersiz öngörü seçimi');
      const samples = scan(d, p + 2 + len, table, width, height, precision, predictor, pt, restartInterval);
      return { width, height, precision, samples };
    }
    p += 2 + len;
  }
  throw new JpegLosslessError('Tarama (SOS) bulunamadı');
}

function scan(d: Uint8Array, start: number, h: Huffman, w: number, hgt: number, P: number, ps: number, pt: number, ri: number): Uint16Array {
  const out = new Uint16Array(w * hgt);
  const mask = (1 << (P - pt)) - 1;
  const initial = 1 << (P - pt - 1);
  // Satır ortasında yeniden başlatma tanımsız kalıyor (libjpeg de satır katı ister): tahmin etmek yerine reddet.
  if (ri % w) throw new JpegLosslessError('Yeniden başlatma aralığı satır uzunluğunun katı değil');
  const br = new BitReader(d, start);
  // T.81 H.1.2.1: taramanın (ve her yeniden başlatmanın) ilk örneği 2^(P−Pt−1) ile, o satırın kalanı soldan (Ra),
  // sonraki satırların ilk örneği yukarıdan (Rb), diğerleri seçilen öngörüyle tahmin edilir.
  let reset = 0;
  let count = 0;
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (ri && count === ri) {
        br.restart();
        count = 0;
        reset = i;
      }
      let pred: number;
      if (i === reset) pred = initial;
      else if (y === Math.floor(reset / w)) pred = out[i - 1]!;
      else if (x === 0) pred = out[i - w]!;
      else {
        const ra = out[i - 1]!, rb = out[i - w]!, rc = out[i - w - 1]!;
        pred = ps === 1 ? ra : ps === 2 ? rb : ps === 3 ? rc : ps === 4 ? ra + rb - rc : ps === 5 ? ra + ((rb - rc) >> 1) : ps === 6 ? rb + ((ra - rc) >> 1) : (ra + rb) >> 1;
      }
      const s = br.decode(h);
      let diff: number;
      if (s === 0) diff = 0;
      else if (s === 16) diff = 32768;
      else {
        diff = br.read(s);
        if (diff < 1 << (s - 1)) diff -= (1 << s) - 1;
      }
      out[i] = (pred + diff) & mask;
      count++;
    }
  }
  if (pt) for (let i = 0; i < out.length; i++) out[i] = out[i]! << pt;
  return out;
}
