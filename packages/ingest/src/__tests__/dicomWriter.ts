/** Testler için küçük DICOM yazıcı: yalnızca okuyucunun kullandığı alanlar. */
export interface El {
  g: number;
  e: number;
  vr: string;
  value: Uint8Array | string | number | El[][] | null;
  /** SQ/piksel için tanımsız uzunluk. */
  undefinedLength?: boolean;
}

const LONG = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'SV', 'UC', 'UN', 'UR', 'UT', 'UV']);

class Buf {
  parts: number[] = [];
  constructor(readonly le: boolean) {}
  u16(v: number) {
    if (this.le) this.parts.push(v & 0xff, (v >> 8) & 0xff);
    else this.parts.push((v >> 8) & 0xff, v & 0xff);
  }
  u32(v: number) {
    const b = [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    this.parts.push(...(this.le ? b : b.reverse()));
  }
  bytes(b: ArrayLike<number>) {
    for (let i = 0; i < b.length; i++) this.parts.push(b[i]!);
  }
}

function valueBytes(el: El, le: boolean): Uint8Array {
  const v = el.value;
  if (v instanceof Uint8Array) return v.length % 2 ? Uint8Array.from([...v, 0]) : v;
  if (typeof v === 'number') {
    const b = new Buf(le);
    b.u16(v);
    return Uint8Array.from(b.parts);
  }
  if (typeof v === 'string') {
    const pad = el.vr === 'UI' ? 0 : 0x20;
    const s = [...new TextEncoder().encode(v)];
    if (s.length % 2) s.push(pad);
    return Uint8Array.from(s);
  }
  return new Uint8Array(0);
}

function writeEl(b: Buf, el: El, explicit: boolean) {
  b.u16(el.g);
  b.u16(el.e);
  if (Array.isArray(el.value)) {
    // Dizi: tanımsız uzunluk, öğeler tanımsız uzunluk.
    if (explicit) {
      b.bytes([el.vr.charCodeAt(0), el.vr.charCodeAt(1), 0, 0]);
    }
    b.u32(0xffffffff);
    for (const item of el.value) {
      b.u16(0xfffe);
      b.u16(0xe000);
      b.u32(0xffffffff);
      for (const inner of item) writeEl(b, inner, explicit);
      b.u16(0xfffe);
      b.u16(0xe00d);
      b.u32(0);
    }
    b.u16(0xfffe);
    b.u16(0xe0dd);
    b.u32(0);
    return;
  }
  const data = valueBytes(el, b.le);
  if (explicit) {
    b.bytes([el.vr.charCodeAt(0), el.vr.charCodeAt(1)]);
    if (LONG.has(el.vr)) {
      b.u16(0);
      b.u32(data.length);
    } else b.u16(data.length);
  } else b.u32(data.length);
  b.bytes(data);
}

/** Kapsüllenmiş piksel verisi (RLE/JPEG). */
export function encapsulated(frames: Uint8Array[]): El {
  return { g: 0x7fe0, e: 0x0010, vr: 'OB', value: null, undefinedLength: true, ...{ frames } } as El & { frames: Uint8Array[] };
}

export interface WriteOptions {
  transferSyntax?: string;
  sopClass?: string;
  preambleOnly?: boolean;
}

export function writeDicom(elements: El[], opts: WriteOptions = {}): Uint8Array<ArrayBuffer> {
  const ts = opts.transferSyntax ?? '1.2.840.10008.1.2.1';
  const explicit = ts !== '1.2.840.10008.1.2';
  const le = ts !== '1.2.840.10008.1.2.2';
  const meta = new Buf(true);
  const metaEls: El[] = [
    { g: 2, e: 1, vr: 'OB', value: Uint8Array.from([0, 1]) },
    { g: 2, e: 2, vr: 'UI', value: opts.sopClass ?? '1.2.840.10008.5.1.4.1.1.4' },
    { g: 2, e: 0x10, vr: 'UI', value: ts },
  ];
  const body = new Buf(true);
  for (const el of metaEls) writeEl(body, el, true);
  meta.u16(2);
  meta.u16(0);
  meta.bytes([0x55, 0x4c]);
  meta.u16(4);
  meta.u32(body.parts.length);
  meta.bytes(body.parts);

  const ds = new Buf(le);
  for (const el of [...elements].sort((a, b) => a.g - b.g || a.e - b.e)) {
    const frames = (el as El & { frames?: Uint8Array[] }).frames;
    if (frames) {
      ds.u16(el.g);
      ds.u16(el.e);
      if (explicit) ds.bytes([0x4f, 0x42, 0, 0]);
      ds.u32(0xffffffff);
      ds.u16(0xfffe);
      ds.u16(0xe000);
      ds.u32(0); // boş temel ofset tablosu
      for (const f of frames) {
        const data = f.length % 2 ? Uint8Array.from([...f, 0]) : f;
        ds.u16(0xfffe);
        ds.u16(0xe000);
        ds.u32(data.length);
        ds.bytes(data);
      }
      ds.u16(0xfffe);
      ds.u16(0xe0dd);
      ds.u32(0);
      continue;
    }
    writeEl(ds, el, explicit);
  }
  const out = new Uint8Array(132 + meta.parts.length + ds.parts.length);
  out.set([0x44, 0x49, 0x43, 0x4d], 128);
  out.set(meta.parts, 132);
  out.set(ds.parts, 132 + meta.parts.length);
  return out;
}

/** Tipik tek kesitli gri görüntü alanları. */
export function imageElements(o: {
  rows: number;
  cols: number;
  pixels?: Uint8Array;
  bits?: number;
  signed?: boolean;
  modality?: string;
  photometric?: string;
  spp?: number;
  frames?: number;
  extra?: El[];
  le?: boolean;
}): El[] {
  const bits = o.bits ?? 16;
  const els: El[] = [
    { g: 0x0008, e: 0x0060, vr: 'CS', value: o.modality ?? 'MR' },
    { g: 0x0028, e: 0x0002, vr: 'US', value: o.spp ?? 1 },
    { g: 0x0028, e: 0x0004, vr: 'CS', value: o.photometric ?? 'MONOCHROME2' },
    { g: 0x0028, e: 0x0010, vr: 'US', value: o.rows },
    { g: 0x0028, e: 0x0011, vr: 'US', value: o.cols },
    { g: 0x0028, e: 0x0100, vr: 'US', value: bits },
    { g: 0x0028, e: 0x0101, vr: 'US', value: bits },
    { g: 0x0028, e: 0x0102, vr: 'US', value: bits - 1 },
    { g: 0x0028, e: 0x0103, vr: 'US', value: o.signed ? 1 : 0 },
    ...(o.frames ? [{ g: 0x0028, e: 0x0008, vr: 'IS', value: String(o.frames) }] : []),
    ...(o.extra ?? []),
  ];
  if (o.pixels) els.push({ g: 0x7fe0, e: 0x0010, vr: bits > 8 ? 'OW' : 'OB', value: o.pixels });
  return els;
}

export function u16Pixels(values: number[], le = true): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint16(i * 2, v & 0xffff, le));
  return out;
}

/** PackBits: yalnızca birebir kopya parçaları (testte doğru çözümü göstermek için yeterli) + bir tekrar. */
export function rleFrame(segments: Uint8Array[]): Uint8Array {
  const encoded = segments.map((seg) => {
    const out: number[] = [];
    let i = 0;
    while (i < seg.length) {
      // tekrar eden bayt dizisi
      let run = 1;
      while (i + run < seg.length && seg[i + run] === seg[i] && run < 128) run++;
      if (run >= 3) {
        out.push((-(run - 1)) & 0xff, seg[i]!);
        i += run;
        continue;
      }
      const len = Math.min(128, seg.length - i);
      let lit = 1;
      while (lit < len && !(i + lit + 2 < seg.length && seg[i + lit] === seg[i + lit + 1] && seg[i + lit] === seg[i + lit + 2])) lit++;
      out.push(lit - 1, ...seg.subarray(i, i + lit));
      i += lit;
    }
    if (out.length % 2) out.push(0x80); // -128: işlem yok (dolgu)
    return out;
  });
  const header = new Uint8Array(64);
  const view = new DataView(header.buffer);
  view.setUint32(0, segments.length, true);
  let offset = 64;
  encoded.forEach((e, i) => {
    view.setUint32(4 + i * 4, offset, true);
    offset += e.length;
  });
  return Uint8Array.from([...header, ...encoded.flat()]);
}
