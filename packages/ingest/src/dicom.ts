/**
 * DICOM okuyucu: MR, BT (tomografi), röntgen ve ultrason cihazlarının kaydettiği dosya biçimi.
 *
 * Tamamen cihazda ve bağımlılıksız çalışır. Yalnızca görüntülemek için gereken alanlar okunur:
 * modalite, bölge, açıklamalar, tarih, seri kimliği ve piksel verisi. Hasta adı, kimlik numarası,
 * doğum tarihi gibi alanlar okunmaz ve arayüze taşınmaz; özgün dosya kasada değiştirilmeden durur.
 *
 * Desteklenen aktarım sözdizimleri:
 *  - Sıkıştırmasız: örtük VR (little endian), açık VR (little/big endian)
 *  - RLE Lossless (bu dosyada çözülür)
 *  - JPEG Baseline 8 bit (çözümü tarayıcıya bırakılır: `encoded` çıktısı)
 * Diğer sıkıştırmalar (JPEG 2000, JPEG-LS, JPEG Lossless) tanınır ama çözülmez; kullanıcıya açıkça söylenir.
 */

export class DicomError extends Error {
  constructor(
    readonly code: 'NOT_DICOM' | 'CORRUPT' | 'UNSUPPORTED',
    message: string = code,
  ) {
    super(message);
    this.name = 'DicomError';
  }
}

export type DicomCodec = 'native' | 'rle' | 'jpeg-baseline' | 'unsupported';

export interface PixelLocation {
  /** Sıkıştırmasız piksel verisinin başlangıcı ve uzunluğu. */
  native?: { offset: number; length: number };
  /** Kapsüllenmiş (sıkıştırılmış) veri: temel ofset tablosu ve parçalar. */
  fragments?: Array<{ offset: number; length: number }>;
  offsetTable?: number[];
}

export interface DicomInfo {
  transferSyntax: string;
  littleEndian: boolean;
  codec: DicomCodec;
  sopClassUid?: string;
  modality?: string;
  bodyPart?: string;
  studyDescription?: string;
  seriesDescription?: string;
  /** YYYY-AA-GG */
  studyDate?: string;
  studyUid?: string;
  seriesUid?: string;
  seriesNumber?: number;
  instanceNumber?: number;
  sliceLocation?: number;
  imagePosition?: [number, number, number];
  rows: number;
  columns: number;
  frames: number;
  samplesPerPixel: number;
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number;
  photometric: string;
  planarConfiguration: number;
  windowCenter?: number;
  windowWidth?: number;
  rescaleSlope: number;
  rescaleIntercept: number;
  /** mm: [satır aralığı, sütun aralığı] */
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  pixel?: PixelLocation;
}

export const DICOM_TS = {
  implicitLE: '1.2.840.10008.1.2',
  explicitLE: '1.2.840.10008.1.2.1',
  deflatedLE: '1.2.840.10008.1.2.1.99',
  explicitBE: '1.2.840.10008.1.2.2',
  jpegBaseline: '1.2.840.10008.1.2.4.50',
  rle: '1.2.840.10008.1.2.5',
} as const;

/** DICOMDIR: CD'deki dizin dosyası; görüntü içermez. */
export const MEDIA_DIRECTORY_SOP = '1.2.840.10008.1.3.10';

export function isDicom(bytes: Uint8Array): boolean {
  return bytes.length >= 132 && bytes[128] === 0x44 && bytes[129] === 0x49 && bytes[130] === 0x43 && bytes[131] === 0x4d;
}

// ---------------------------------------------------------------------------------------------
// Öğe okuma

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'SV', 'UC', 'UN', 'UR', 'UT', 'UV']);
const UNDEFINED = 0xffffffff;
const tag = (g: number, e: number) => ((g << 16) | e) >>> 0;

const T = {
  metaLength: tag(0x0002, 0x0000),
  mediaSop: tag(0x0002, 0x0002),
  transferSyntax: tag(0x0002, 0x0010),
  charset: tag(0x0008, 0x0005),
  sopClass: tag(0x0008, 0x0016),
  studyDate: tag(0x0008, 0x0020),
  seriesDate: tag(0x0008, 0x0021),
  acquisitionDate: tag(0x0008, 0x0022),
  contentDate: tag(0x0008, 0x0023),
  modality: tag(0x0008, 0x0060),
  studyDescription: tag(0x0008, 0x1030),
  seriesDescription: tag(0x0008, 0x103e),
  bodyPart: tag(0x0018, 0x0015),
  sliceThickness: tag(0x0018, 0x0050),
  studyUid: tag(0x0020, 0x000d),
  seriesUid: tag(0x0020, 0x000e),
  seriesNumber: tag(0x0020, 0x0011),
  instanceNumber: tag(0x0020, 0x0013),
  imagePosition: tag(0x0020, 0x0032),
  sliceLocation: tag(0x0020, 0x1041),
  samplesPerPixel: tag(0x0028, 0x0002),
  photometric: tag(0x0028, 0x0004),
  planar: tag(0x0028, 0x0006),
  frames: tag(0x0028, 0x0008),
  rows: tag(0x0028, 0x0010),
  columns: tag(0x0028, 0x0011),
  pixelSpacing: tag(0x0028, 0x0030),
  bitsAllocated: tag(0x0028, 0x0100),
  bitsStored: tag(0x0028, 0x0101),
  pixelRepresentation: tag(0x0028, 0x0103),
  windowCenter: tag(0x0028, 0x1050),
  windowWidth: tag(0x0028, 0x1051),
  rescaleIntercept: tag(0x0028, 0x1052),
  rescaleSlope: tag(0x0028, 0x1053),
  pixelData: tag(0x7fe0, 0x0010),
  item: tag(0xfffe, 0xe000),
  itemEnd: tag(0xfffe, 0xe00d),
  seqEnd: tag(0xfffe, 0xe0dd),
} as const;

const US_TAGS: ReadonlySet<number> = new Set([T.samplesPerPixel, T.planar, T.rows, T.columns, T.bitsAllocated, T.bitsStored, T.pixelRepresentation]);
/** Yalnızca okunan alanlar saklanır; diğer her şey (hasta bilgileri dahil) atlanır. */
const WANTED: ReadonlySet<number> = new Set(Object.values(T));

interface Element {
  tag: number;
  vr: string;
  length: number;
  value: number;
  next: number;
}

class Reader {
  readonly view: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  need(pos: number, n: number) {
    if (pos < 0 || pos + n > this.bytes.length) throw new DicomError('CORRUPT', 'truncated');
  }
  u16(pos: number, le: boolean) {
    this.need(pos, 2);
    return this.view.getUint16(pos, le);
  }
  u32(pos: number, le: boolean) {
    this.need(pos, 4);
    return this.view.getUint32(pos, le);
  }
  isVr(pos: number): boolean {
    if (pos + 2 > this.bytes.length) return false;
    const a = this.bytes[pos]!;
    const b = this.bytes[pos + 1]!;
    return a >= 0x41 && a <= 0x5a && b >= 0x41 && b <= 0x5a;
  }

  element(pos: number, explicit: boolean, le: boolean): Element {
    const t = tag(this.u16(pos, le), this.u16(pos + 2, le));
    if (t >>> 16 === 0xfffe) {
      const length = this.u32(pos + 4, le);
      return { tag: t, vr: '', length, value: pos + 8, next: length === UNDEFINED ? pos + 8 : pos + 8 + length };
    }
    if (explicit && this.isVr(pos + 4)) {
      const vr = String.fromCharCode(this.bytes[pos + 4]!, this.bytes[pos + 5]!);
      if (LONG_VR.has(vr)) {
        const length = this.u32(pos + 8, le);
        return { tag: t, vr, length, value: pos + 12, next: length === UNDEFINED ? pos + 12 : pos + 12 + length };
      }
      const length = this.u16(pos + 6, le);
      return { tag: t, vr, length, value: pos + 8, next: pos + 8 + length };
    }
    const length = this.u32(pos + 4, le);
    const vr = t === T.pixelData ? 'OW' : US_TAGS.has(t) ? 'US' : 'UN';
    return { tag: t, vr, length, value: pos + 8, next: length === UNDEFINED ? pos + 8 : pos + 8 + length };
  }

  /** Tanımsız uzunluklu diziyi (SQ, UN) atlar; iç içe öğeler dahil. Dizinin bittiği konumu döner. */
  skipSequence(pos: number, explicit: boolean, le: boolean, depth = 0): number {
    if (depth > 32) throw new DicomError('CORRUPT', 'nesting');
    for (let guard = 0; guard < 1_000_000; guard++) {
      const el = this.element(pos, false, le);
      if (el.tag === T.seqEnd) return pos + 8;
      if (el.tag !== T.item) throw new DicomError('CORRUPT', 'bad item');
      if (el.length !== UNDEFINED) {
        pos = el.next;
        continue;
      }
      pos = this.skipDataset(el.value, explicit, le, depth + 1);
    }
    throw new DicomError('CORRUPT', 'sequence');
  }

  /** Tanımsız uzunluklu öğenin (item) içindeki veri kümesini, öğe sonu işaretine kadar atlar. */
  skipDataset(pos: number, explicit: boolean, le: boolean, depth: number): number {
    for (let guard = 0; guard < 1_000_000; guard++) {
      const el = this.element(pos, explicit, le);
      if (el.tag === T.itemEnd) return pos + 8;
      if (el.length === UNDEFINED) {
        // UN + tanımsız uzunluk: içerik örtük VR ile kodlanmıştır.
        pos = this.skipSequence(el.value, explicit && el.vr !== 'UN', le, depth + 1);
      } else {
        this.need(el.value, el.length);
        pos = el.next;
      }
    }
    throw new DicomError('CORRUPT', 'dataset');
  }
}

function decodeText(bytes: Uint8Array, charset: string | undefined): string {
  let label = 'windows-1252';
  if (charset) {
    if (charset.includes('ISO_IR 192')) label = 'utf-8';
    else if (charset.includes('ISO_IR 148')) label = 'iso-8859-9';
    else if (charset.includes('ISO_IR 100')) label = 'windows-1252';
  }
  let s: string;
  try {
    s = new TextDecoder(label).decode(bytes);
  } catch {
    s = String.fromCharCode(...bytes);
  }
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

const firstNumber = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number.parseFloat(s.split('\\')[0]!.trim());
  return Number.isFinite(n) ? n : undefined;
};
const numbers = (s: string | undefined): number[] =>
  (s ?? '')
    .split('\\')
    .map((x) => Number.parseFloat(x.trim()))
    .filter((n) => Number.isFinite(n));

function formatDa(s: string | undefined): string | undefined {
  const m = /^(\d{4})\.?(\d{2})\.?(\d{2})/.exec(s?.trim() ?? '');
  if (!m) return undefined;
  const [, y, mo, d] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return undefined;
  return `${y}-${mo}-${d}`;
}

function codecOf(ts: string): DicomCodec {
  if (ts === DICOM_TS.implicitLE || ts === DICOM_TS.explicitLE || ts === DICOM_TS.explicitBE) return 'native';
  if (ts === DICOM_TS.rle) return 'rle';
  if (ts === DICOM_TS.jpegBaseline) return 'jpeg-baseline';
  return 'unsupported';
}

// ---------------------------------------------------------------------------------------------

/** Başlığı ve piksel verisinin yerini okur; pikselleri çözmez. */
export function parseDicom(bytes: Uint8Array): DicomInfo {
  if (!isDicom(bytes)) throw new DicomError('NOT_DICOM');
  const r = new Reader(bytes);
  const strings = new Map<number, string>();
  const shorts = new Map<number, number>();
  const raw = (el: Element) => {
    r.need(el.value, el.length);
    return bytes.subarray(el.value, el.value + el.length);
  };

  // 1) Dosya meta bilgisi (grup 0002): her zaman açık VR, little endian.
  let pos = 132;
  while (pos + 8 <= bytes.length && r.u16(pos, true) === 0x0002) {
    const el = r.element(pos, true, true);
    if (el.length === UNDEFINED) throw new DicomError('CORRUPT', 'meta');
    if (el.tag === T.transferSyntax || el.tag === T.mediaSop) strings.set(el.tag, decodeText(raw(el), undefined));
    pos = el.next;
  }

  const transferSyntax = strings.get(T.transferSyntax) ?? DICOM_TS.explicitLE;
  if (transferSyntax === DICOM_TS.deflatedLE) throw new DicomError('UNSUPPORTED', 'deflated');
  const le = transferSyntax !== DICOM_TS.explicitBE;
  // Bildirilen sözdizimine rağmen bazı cihazlar diğerini yazar: ilk öğeye bakarak karar ver.
  const explicit = transferSyntax === DICOM_TS.implicitLE ? r.isVr(pos + 4) && bytes[pos + 5] !== 0 : true;

  let pixel: PixelLocation | undefined;

  // 2) Veri kümesi
  for (let guard = 0; guard < 1_000_000 && pos + 8 <= bytes.length; guard++) {
    const el = r.element(pos, explicit, le);
    if (el.tag === T.pixelData) {
      if (el.length === UNDEFINED) pixel = readFragments(r, el.value, le);
      else {
        r.need(el.value, el.length);
        pixel = { native: { offset: el.value, length: el.length } };
      }
      break;
    }
    if (el.length === UNDEFINED) {
      pos = r.skipSequence(el.value, explicit && el.vr !== 'UN', le);
      continue;
    }
    if (WANTED.has(el.tag)) {
      if (el.vr === 'US' || (US_TAGS.has(el.tag) && el.length === 2)) shorts.set(el.tag, r.u16(el.value, le));
      else strings.set(el.tag, decodeText(raw(el), el.tag === T.charset ? undefined : strings.get(T.charset)));
    } else {
      r.need(el.value, el.length);
    }
    pos = el.next;
  }

  const num = (t: number) => shorts.get(t) ?? firstNumber(strings.get(t));
  const str = (t: number) => {
    const s = strings.get(t);
    return s ? s : undefined;
  };
  const rows = num(T.rows) ?? 0;
  const columns = num(T.columns) ?? 0;
  const bitsAllocated = num(T.bitsAllocated) ?? (pixel ? 16 : 0);
  const spacing = numbers(strings.get(T.pixelSpacing));
  const position = numbers(strings.get(T.imagePosition));
  const slope = firstNumber(strings.get(T.rescaleSlope));

  return {
    transferSyntax,
    littleEndian: le,
    codec: codecOf(transferSyntax),
    sopClassUid: str(T.sopClass) ?? str(T.mediaSop),
    modality: str(T.modality)?.toUpperCase(),
    bodyPart: str(T.bodyPart),
    studyDescription: str(T.studyDescription),
    seriesDescription: str(T.seriesDescription),
    studyDate: formatDa(strings.get(T.studyDate)) ?? formatDa(strings.get(T.seriesDate)) ?? formatDa(strings.get(T.acquisitionDate)) ?? formatDa(strings.get(T.contentDate)),
    studyUid: str(T.studyUid),
    seriesUid: str(T.seriesUid),
    seriesNumber: firstNumber(strings.get(T.seriesNumber)),
    instanceNumber: firstNumber(strings.get(T.instanceNumber)),
    sliceLocation: firstNumber(strings.get(T.sliceLocation)),
    imagePosition: position.length === 3 ? [position[0]!, position[1]!, position[2]!] : undefined,
    rows,
    columns,
    frames: Math.max(1, Math.floor(firstNumber(strings.get(T.frames)) ?? 1)),
    samplesPerPixel: num(T.samplesPerPixel) ?? 1,
    bitsAllocated,
    bitsStored: num(T.bitsStored) ?? bitsAllocated,
    pixelRepresentation: num(T.pixelRepresentation) ?? 0,
    photometric: (str(T.photometric) ?? 'MONOCHROME2').toUpperCase(),
    planarConfiguration: num(T.planar) ?? 0,
    windowCenter: firstNumber(strings.get(T.windowCenter)),
    windowWidth: firstNumber(strings.get(T.windowWidth)),
    rescaleSlope: slope && slope !== 0 ? slope : 1,
    rescaleIntercept: firstNumber(strings.get(T.rescaleIntercept)) ?? 0,
    pixelSpacing: spacing.length >= 2 ? [spacing[0]!, spacing[1]!] : undefined,
    sliceThickness: firstNumber(strings.get(T.sliceThickness)),
    pixel,
  };
}

function readFragments(r: Reader, pos: number, le: boolean): PixelLocation {
  const fragments: Array<{ offset: number; length: number }> = [];
  let offsetTable: number[] = [];
  let first = true;
  for (let guard = 0; guard < 1_000_000; guard++) {
    const el = r.element(pos, false, le);
    if (el.tag === T.seqEnd) break;
    if (el.tag !== T.item || el.length === UNDEFINED) throw new DicomError('CORRUPT', 'fragment');
    r.need(el.value, el.length);
    if (first) {
      offsetTable = [];
      for (let i = 0; i + 4 <= el.length; i += 4) offsetTable.push(r.u32(el.value + i, le));
      first = false;
    } else {
      fragments.push({ offset: el.value, length: el.length });
    }
    pos = el.next;
  }
  return { fragments, offsetTable };
}

// ---------------------------------------------------------------------------------------------
// Piksel çözme

export type DecodedFrame =
  /** Gri tonlu: modalite değerleri (ör. BT'de Hounsfield), eğim/kesişim uygulanmış. */
  | { kind: 'gray'; width: number; height: number; data: Float32Array; min: number; max: number }
  /** Renkli (ultrason, bazı röntgenler): RGBA. */
  | { kind: 'rgba'; width: number; height: number; data: Uint8ClampedArray }
  /** Tarayıcının çözmesi gereken sıkıştırılmış çerçeve (JPEG). */
  | { kind: 'encoded'; width: number; height: number; mime: string; data: Uint8Array };

/** Görüntüleyicinin çözebildiği bir dosya mı? Değilse yalnızca bilgiler gösterilir. */
export function canDecode(info: DicomInfo): boolean {
  if (!info.pixel || info.rows <= 0 || info.columns <= 0) return false;
  if (info.codec === 'unsupported') return false;
  if (info.codec === 'jpeg-baseline') return true;
  if (![8, 16, 32].includes(info.bitsAllocated)) return false;
  if (info.samplesPerPixel === 1) return info.photometric.startsWith('MONOCHROME');
  return info.samplesPerPixel === 3 && info.bitsAllocated === 8 && ['RGB', 'YBR_FULL'].includes(info.photometric);
}

function frameFragments(info: DicomInfo, frame: number): Array<{ offset: number; length: number }> {
  const frags = info.pixel?.fragments ?? [];
  if (info.frames <= 1) return frags;
  const table = info.pixel?.offsetTable ?? [];
  if (table.length === info.frames) {
    // Ofsetler, ilk parçanın öğe başlığından itibaren sayılır (her parçanın 8 baytlık başlığı dahil).
    const base = (frags[0]?.offset ?? 8) - 8;
    const start = base + table[frame]!;
    const end = frame + 1 < table.length ? base + table[frame + 1]! : Number.POSITIVE_INFINITY;
    return frags.filter((f) => f.offset - 8 >= start && f.offset - 8 < end);
  }
  if (frags.length === info.frames) return frags[frame] ? [frags[frame]!] : [];
  throw new DicomError('UNSUPPORTED', 'fragment layout');
}

function concatFragments(bytes: Uint8Array, frags: Array<{ offset: number; length: number }>): Uint8Array {
  if (frags.length === 1) return bytes.subarray(frags[0]!.offset, frags[0]!.offset + frags[0]!.length);
  const out = new Uint8Array(frags.reduce((n, f) => n + f.length, 0));
  let o = 0;
  for (const f of frags) {
    out.set(bytes.subarray(f.offset, f.offset + f.length), o);
    o += f.length;
  }
  return out;
}

/** RLE Lossless (PS3.5 Ek G): segment başına PackBits. */
export function decodeRle(frame: Uint8Array, segmentLength: number): Uint8Array[] {
  if (frame.length < 64) throw new DicomError('CORRUPT', 'rle header');
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const count = view.getUint32(0, true);
  if (count < 1 || count > 15) throw new DicomError('CORRUPT', 'rle segments');
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) offsets.push(view.getUint32(4 + i * 4, true));
  const segments: Uint8Array[] = [];
  for (let s = 0; s < count; s++) {
    const out = new Uint8Array(segmentLength);
    let i = offsets[s]!;
    const end = s + 1 < count ? offsets[s + 1]! : frame.length;
    let o = 0;
    while (i < end && o < segmentLength) {
      const n = (frame[i++]! << 24) >> 24;
      if (n >= 0) {
        const len = Math.min(n + 1, segmentLength - o, end - i);
        out.set(frame.subarray(i, i + len), o);
        o += len;
        i += n + 1;
      } else if (n !== -128) {
        const v = frame[i++] ?? 0;
        const len = Math.min(-n + 1, segmentLength - o);
        out.fill(v, o, o + len);
        o += len;
      }
    }
    segments.push(out);
  }
  return segments;
}

function grayFrom(info: DicomInfo, src: Uint8Array, le: boolean): DecodedFrame {
  const w = info.columns;
  const h = info.rows;
  const n = w * h;
  const bytesPer = info.bitsAllocated / 8;
  if (src.length < n * bytesPer) throw new DicomError('CORRUPT', 'short frame');
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const signed = info.pixelRepresentation === 1;
  const stored = Math.min(info.bitsStored || info.bitsAllocated, info.bitsAllocated);
  const needsMask = stored < info.bitsAllocated;
  const mask = stored >= 32 ? 0xffffffff : 2 ** stored - 1;
  const signBit = 2 ** (stored - 1);
  const full = 2 ** stored;
  const { rescaleSlope: m, rescaleIntercept: b } = info;
  const data = new Float32Array(n);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    let v: number;
    if (bytesPer === 1) v = src[i]!;
    else if (bytesPer === 2) v = view.getUint16(i * 2, le);
    else v = view.getUint32(i * 4, le);
    if (needsMask) v = (v & mask) >>> 0;
    if (signed && v >= signBit) v -= full;
    const x = v * m + b;
    data[i] = x;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return { kind: 'gray', width: w, height: h, data, min, max };
}

function rgbaFrom(info: DicomInfo, src: Uint8Array, planar: boolean): DecodedFrame {
  const w = info.columns;
  const h = info.rows;
  const n = w * h;
  if (src.length < n * 3) throw new DicomError('CORRUPT', 'short frame');
  const ybr = info.photometric === 'YBR_FULL';
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    let a = planar ? src[i]! : src[i * 3]!;
    let b = planar ? src[n + i]! : src[i * 3 + 1]!;
    let c = planar ? src[2 * n + i]! : src[i * 3 + 2]!;
    if (ybr) {
      const y = a;
      const cb = b - 128;
      const cr = c - 128;
      a = y + 1.402 * cr;
      b = y - 0.344136 * cb - 0.714136 * cr;
      c = y + 1.772 * cb;
    }
    data[i * 4] = a;
    data[i * 4 + 1] = b;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  }
  return { kind: 'rgba', width: w, height: h, data };
}

/** Tek bir çerçeveyi çözer. `frame` 0 tabanlıdır. */
export function decodeFrame(bytes: Uint8Array, info: DicomInfo, frame = 0): DecodedFrame {
  if (!canDecode(info)) throw new DicomError('UNSUPPORTED', 'codec');
  if (frame < 0 || frame >= info.frames) throw new DicomError('CORRUPT', 'frame index');
  const w = info.columns;
  const h = info.rows;
  const n = w * h;
  const gray = info.samplesPerPixel === 1;

  if (info.codec === 'jpeg-baseline') {
    return { kind: 'encoded', width: w, height: h, mime: 'image/jpeg', data: concatFragments(bytes, frameFragments(info, frame)) };
  }

  if (info.codec === 'rle') {
    const src = concatFragments(bytes, frameFragments(info, frame));
    const bytesPer = info.bitsAllocated / 8;
    const segments = decodeRle(src, n);
    if (gray) {
      if (segments.length < bytesPer) throw new DicomError('CORRUPT', 'rle segments');
      // Segmentler en anlamlı bayttan başlar; little endian ara belleğe yerleştir.
      const buf = new Uint8Array(n * bytesPer);
      for (let s = 0; s < bytesPer; s++) {
        const seg = segments[s]!;
        const byteIndex = bytesPer - 1 - s;
        for (let i = 0; i < n; i++) buf[i * bytesPer + byteIndex] = seg[i]!;
      }
      return grayFrom(info, buf, true);
    }
    if (segments.length < 3) throw new DicomError('CORRUPT', 'rle segments');
    const planar = new Uint8Array(n * 3);
    planar.set(segments[0]!, 0);
    planar.set(segments[1]!, n);
    planar.set(segments[2]!, 2 * n);
    return rgbaFrom(info, planar, true);
  }

  const loc = info.pixel?.native;
  if (!loc) throw new DicomError('CORRUPT', 'no pixels');
  const frameBytes = n * info.samplesPerPixel * (info.bitsAllocated / 8);
  const start = loc.offset + frame * frameBytes;
  if (start + frameBytes > loc.offset + loc.length || start + frameBytes > bytes.length) throw new DicomError('CORRUPT', 'short pixel data');
  const src = bytes.subarray(start, start + frameBytes);
  return gray ? grayFrom(info, src, info.littleEndian) : rgbaFrom(info, src, info.planarConfiguration === 1);
}

// ---------------------------------------------------------------------------------------------
// Pencere (window/level) ve çizim

export interface Window {
  center: number;
  width: number;
}

/** Dosyada pencere yoksa: değerlerin %1–%99 aralığı (tek parlak nokta tüm görüntüyü karartmasın). */
export function autoWindow(data: Float32Array): Window {
  if (data.length === 0) return { center: 0, width: 1 };
  const step = Math.max(1, Math.floor(data.length / 65536));
  const sample: number[] = [];
  for (let i = 0; i < data.length; i += step) sample.push(data[i]!);
  sample.sort((a, b) => a - b);
  const lo = sample[Math.floor(sample.length * 0.01)]!;
  const hi = sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.99))]!;
  const width = Math.max(1, hi - lo);
  return { center: lo + width / 2, width };
}

/** Gri değerleri pencereye göre 0–255'e eşleyip RGBA ara belleğine yazar. */
export function renderGray(data: Float32Array, win: Window, invert: boolean, out: Uint8ClampedArray): void {
  const width = Math.max(1, win.width);
  const lower = win.center - width / 2;
  const k = 255 / width;
  for (let i = 0; i < data.length; i++) {
    let v = (data[i]! - lower) * k;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (invert) v = 255 - v;
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
}

/**
 * Renkli görüntüde (ultrason, fotoğrafı çekilmiş film) pencere her kanala aynı biçimde uygulanır:
 * { center: 127.5, width: 255 } görüntüyü değiştirmez.
 */
export function renderRgba(data: Uint8ClampedArray, win: Window, invert: boolean, out: Uint8ClampedArray): void {
  const width = Math.max(1, win.width);
  const lower = win.center - width / 2;
  const k = 255 / width;
  const identity = Math.abs(lower) < 1e-6 && Math.abs(width - 255) < 1e-6;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = identity ? data[i + c]! : (data[i + c]! - lower) * k;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      out[i + c] = invert ? 255 - v : v;
    }
    out[i + 3] = 255;
  }
}

/**
 * Fotoğraf/ekran görüntüsü neredeyse gri mi (röntgen filmi, MR baskısı)? Örneklenen piksellerin
 * %98'inde kanallar arası fark küçükse gri kabul edilir; o zaman gri tonlu yol (pencere/seviye) kullanılır.
 */
export function isNearlyGray(rgba: Uint8ClampedArray, tolerance = 14): boolean {
  const n = rgba.length / 4;
  const step = Math.max(1, Math.floor(n / 40000));
  let colored = 0;
  let seen = 0;
  for (let p = 0; p < n; p += step) {
    const i = p * 4;
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    if (Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) > tolerance) colored++;
    seen++;
  }
  return seen > 0 && colored / seen < 0.02;
}

/** RGBA → gri (parlaklık, 0–255) çerçeve. */
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): Extract<DecodedFrame, { kind: 'gray' }> {
  const data = new Float32Array(width * height);
  let min = 255;
  let max = 0;
  for (let p = 0; p < data.length; p++) {
    const i = p * 4;
    const v = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    data[p] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { kind: 'gray', width, height, data, min, max };
}

/**
 * Görüntü bir kâğıt/ekran belgesi mi (rapor fotoğrafı), yoksa film/görüntü mü?
 * Belgeler çoğunlukla açık zeminlidir; röntgen, MR ve BT görüntüleri ağırlıkla koyudur.
 * Kaba bir ayrımdır; yalnızca "rapor metnini kendiliğinden oku" kararı için kullanılır.
 */
export function looksLikeDocumentImage(rgba: Uint8ClampedArray): boolean {
  const n = rgba.length / 4;
  const step = Math.max(1, Math.floor(n / 40000));
  let bright = 0;
  let dark = 0;
  let seen = 0;
  for (let p = 0; p < n; p += step) {
    const i = p * 4;
    const v = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    if (v > 170) bright++;
    else if (v < 60) dark++;
    seen++;
  }
  return seen > 0 && bright / seen > 0.55 && dark / seen < 0.25;
}

/**
 * Tahlil olarak yüklenen bir fotoğraf aslında film/görüntü mü (röntgen, MR baskısı)? Temkinli:
 * yalnızca neredeyse gri ve büyük ölçüde koyu görüntüler için true döner; o zaman OCR'dan önce sorulur.
 */
export function looksLikeFilmImage(rgba: Uint8ClampedArray): boolean {
  if (!isNearlyGray(rgba, 20)) return false;
  const n = rgba.length / 4;
  const step = Math.max(1, Math.floor(n / 40000));
  let dark = 0;
  let seen = 0;
  for (let p = 0; p < n; p += step) {
    const i = p * 4;
    if (0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]! < 60) dark++;
    seen++;
  }
  return seen > 0 && dark / seen > 0.4;
}

// ---------------------------------------------------------------------------------------------
// Belge türü ve bölge tahmini

export type ImagingModality = 'mr' | 'ct' | 'xray' | 'us' | 'mammo' | 'pet' | 'angio' | 'dexa' | 'other';

/** DICOM modalite kodundan belge türü. */
export function modalityCategory(modality: string | undefined): ImagingModality | undefined {
  switch ((modality ?? '').toUpperCase()) {
    case 'MR':
      return 'mr';
    case 'CT':
      return 'ct';
    case 'MG':
      return 'mammo';
    case 'PT':
      return 'pet';
    case 'XA':
      return 'angio';
    case 'BMD':
      return 'dexa';
    case 'CR':
    case 'DX':
    case 'DR':
    case 'RF':
    case 'PX':
    case 'IO':
      return 'xray';
    case 'US':
      return 'us';
    case '':
      return undefined;
    default:
      return 'other';
  }
}

/** Yükleme sırasında arayüze taşınan özet; kimlik bilgisi içermez. */
export interface DicomSummary {
  modality?: string;
  bodyPart?: string;
  studyDescription?: string;
  seriesDescription?: string;
  studyDate?: string;
  seriesUid?: string;
  instanceNumber?: number;
  sliceLocation?: number;
  rows: number;
  columns: number;
  frames: number;
  decodable: boolean;
}

export function summarizeDicom(info: DicomInfo): DicomSummary {
  return {
    modality: info.modality,
    bodyPart: info.bodyPart,
    studyDescription: info.studyDescription,
    seriesDescription: info.seriesDescription,
    studyDate: info.studyDate,
    seriesUid: info.seriesUid,
    instanceNumber: info.instanceNumber,
    sliceLocation: info.sliceLocation ?? info.imagePosition?.[2],
    rows: info.rows,
    columns: info.columns,
    frames: info.frames,
    decodable: canDecode(info),
  };
}
