import { DicomError, type DicomSummary, MEDIA_DIRECTORY_SOP, isDicom, parseDicom, summarizeDicom } from './dicom';

/**
 * Yüklenen dosyanın gerçekten desteklenen bir PDF/JPEG/PNG/DICOM olduğunu, çözümlemeden
 * (decode etmeden) yalnızca baytlara bakarak doğrular. Uzantı ve tarayıcının bildirdiği
 * MIME türü asla tek başına güvenilmez; belirleyici olan dosya imzasıdır.
 */
export const DEFAULT_LIMITS = {
  maxBytes: 20 * 1024 * 1024,
  /** MR/BT dosyaları (DICOM) çok kesitli olabilir; ayrıca daha yüksek sınır. */
  maxDicomBytes: 60 * 1024 * 1024,
  maxPdfPages: 30,
  maxPixels: 40_000_000,
  maxSide: 8000,
} as const;

export type UploadLimits = { [K in keyof typeof DEFAULT_LIMITS]: number };

export type DetectedKind = 'pdf' | 'jpeg' | 'png' | 'dicom';

export const MIME_BY_KIND: Record<DetectedKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  dicom: 'application/dicom',
};

const CANONICAL_EXT: Record<DetectedKind, string> = { pdf: 'pdf', jpeg: 'jpg', png: 'png', dicom: 'dcm' };
const EXT_KIND: Record<string, DetectedKind> = { pdf: 'pdf', jpg: 'jpeg', jpeg: 'jpeg', png: 'png', dcm: 'dicom', dicom: 'dicom' };

export const ACCEPT_ATTRIBUTE = '.pdf,.jpg,.jpeg,.png,.dcm,.dicom,application/pdf,image/jpeg,image/png,application/dicom';

export type RejectCode =
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_EXTENSION'
  | 'UNSUPPORTED_TYPE'
  | 'EXTENSION_MISMATCH'
  | 'IMAGE_TOO_LARGE'
  | 'TOO_MANY_PAGES'
  | 'DICOM_NO_IMAGE'
  | 'CORRUPT';

export type UploadWarning = 'EXTENSION_CORRECTED' | 'MIME_MISMATCH' | 'PDF_ENCRYPTED' | 'PDF_HAS_SCRIPT' | 'DICOM_NOT_VIEWABLE';

export interface AcceptedUpload {
  ok: true;
  kind: DetectedKind;
  mimeType: string;
  /** Temizlenmiş, uzantısı içerikle uyumlu dosya adı. */
  fileName: string;
  /** Uzantısız, kullanıcıya gösterilecek ad. */
  displayName: string;
  width?: number;
  height?: number;
  /** DICOM ise: modalite, bölge, tarih, seri (kimlik bilgisi yok). */
  dicom?: DicomSummary;
  warnings: UploadWarning[];
}

export interface RejectedUpload {
  ok: false;
  code: RejectCode;
}

export type UploadValidation = AcceptedUpload | RejectedUpload;

export interface UploadInput {
  bytes: Uint8Array;
  fileName: string;
  declaredMime?: string;
}

const reject = (code: RejectCode): RejectedUpload => ({ ok: false, code });

// ---------------------------------------------------------------------------
// Dosya adı

// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>:"|?*]/g;
export const MAX_FILE_NAME = 120;

export function splitExtension(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

/**
 * Yol bileşenlerini, kontrol/yön karakterlerini ve işletim sistemlerinde sorun çıkaran
 * karakterleri atar. Sonuç yalnızca görünen ad/indirme adı olarak kullanılır;
 * depolama anahtarı her zaman rastgele UUID'dir.
 */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  let name = base.normalize('NFC').replace(UNSAFE_NAME_CHARS, '').replace(/\s+/g, ' ').trim();
  name = name.replace(/^\.+/, '').trim();
  if (!name) return 'belge';
  if (name.length > MAX_FILE_NAME) {
    const { stem, ext } = splitExtension(name);
    const room = MAX_FILE_NAME - (ext ? ext.length + 1 : 0);
    name = ext ? `${stem.slice(0, Math.max(1, room)).trim()}.${ext}` : name.slice(0, MAX_FILE_NAME);
  }
  return name;
}

// ---------------------------------------------------------------------------
// İmza ve başlık okuma

function startsWith(bytes: Uint8Array, sig: ArrayLike<number>, offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

export function indexOfBytes(hay: Uint8Array, needle: Uint8Array, from = 0, until = hay.length): number {
  const end = Math.min(until, hay.length) - needle.length;
  const first = needle[0];
  outer: for (let i = from; i <= end; i++) {
    if (hay[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const PDF_HEADER = ascii('%PDF-');
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIG = [0xff, 0xd8, 0xff] as const;
const IHDR = ascii('IHDR');

export function detectKind(bytes: Uint8Array): DetectedKind | null {
  if (startsWith(bytes, PNG_SIG)) return 'png';
  if (startsWith(bytes, JPEG_SIG)) return 'jpeg';
  if (isDicom(bytes)) return 'dicom';
  // PDF standardı başlığın ilk 1024 bayt içinde olmasına izin verir.
  if (indexOfBytes(bytes, PDF_HEADER, 0, 1024) !== -1) return 'pdf';
  return null;
}

function u16(b: Uint8Array, i: number): number {
  return ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
}
function u32(b: Uint8Array, i: number): number {
  return (((b[i] ?? 0) << 24) >>> 0) + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
}

export function readPngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 33 || !startsWith(b, IHDR, 12)) return null;
  const width = u32(b, 16);
  const height = u32(b, 20);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** JPEG segmentlerini dolaşıp SOF işaretçisinden boyutu okur; görüntüyü çözmez. */
export function readJpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  for (let guard = 0; guard < 10_000 && i + 3 < b.length; guard++) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff && i < b.length) i++;
    const marker = b[i];
    i++;
    if (marker === undefined) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) return null;
    const len = u16(b, i);
    if (len < 2 || i + len > b.length) return null;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (len < 7) return null;
      const height = u16(b, i + 3);
      const width = u16(b, i + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += len;
  }
  return null;
}

/** En iyi çaba: sıkıştırılmış nesne akışlarındaki script'ler görünmeyebilir; PDF.js'te script zaten kapalı. */
export function inspectPdf(b: Uint8Array): { encrypted: boolean; hasScript: boolean } {
  return {
    encrypted: indexOfBytes(b, ascii('/Encrypt')) !== -1,
    hasScript: indexOfBytes(b, ascii('/JavaScript')) !== -1 || indexOfBytes(b, ascii('/JS')) !== -1,
  };
}

// ---------------------------------------------------------------------------

export function validateUpload(input: UploadInput, limits: UploadLimits = DEFAULT_LIMITS): UploadValidation {
  const { bytes } = input;
  if (bytes.length === 0) return reject('EMPTY');
  const kind = detectKind(bytes);
  if (bytes.length > (kind === 'dicom' ? Math.max(limits.maxBytes, limits.maxDicomBytes) : limits.maxBytes)) return reject('TOO_LARGE');

  const cleanName = sanitizeFileName(input.fileName);
  if (kind === 'dicom') return validateDicom(bytes, cleanName, input.declaredMime, limits);

  const { stem, ext } = splitExtension(cleanName);
  if (ext && !(ext in EXT_KIND)) return reject('UNSUPPORTED_EXTENSION');
  if (!kind) return reject('UNSUPPORTED_TYPE');

  const warnings: UploadWarning[] = [];
  const extKind = ext ? EXT_KIND[ext] : undefined;
  if (extKind && extKind !== kind) {
    // JPEG ↔ PNG karışıklığı zararsızdır (telefonlar bazen yanlış uzantı verir); PDF ↔ görsel değildir.
    if (extKind === 'pdf' || kind === 'pdf' || extKind === 'dicom') return reject('EXTENSION_MISMATCH');
    warnings.push('EXTENSION_CORRECTED');
  }
  if (input.declaredMime && input.declaredMime !== MIME_BY_KIND[kind]) warnings.push('MIME_MISMATCH');

  const fileName = `${stem}.${extKind === kind ? ext : CANONICAL_EXT[kind]}`;
  const base: AcceptedUpload = { ok: true, kind, mimeType: MIME_BY_KIND[kind], fileName, displayName: stem, warnings };

  if (kind === 'pdf') {
    const { encrypted, hasScript } = inspectPdf(bytes);
    if (encrypted) warnings.push('PDF_ENCRYPTED');
    if (hasScript) warnings.push('PDF_HAS_SCRIPT');
    return base;
  }

  // Sıkıştırma bombası koruması: piksel sayısı çözmeden önce başlıktan kontrol edilir.
  const size = kind === 'png' ? readPngSize(bytes) : readJpegSize(bytes);
  if (!size) return reject('CORRUPT');
  if (size.width > limits.maxSide || size.height > limits.maxSide || size.width * size.height > limits.maxPixels) {
    return reject('IMAGE_TOO_LARGE');
  }
  return { ...base, width: size.width, height: size.height };
}

/**
 * DICOM: CD'lerdeki dosyaların çoğunun uzantısı yoktur ya da "IM000001", "1.2.840…" gibi adlar taşır;
 * bu yüzden uzantı yok sayılır, belirleyici olan 128. bayttaki "DICM" imzası ve okunabilen başlıktır.
 */
function validateDicom(bytes: Uint8Array, cleanName: string, declaredMime: string | undefined, limits: UploadLimits): UploadValidation {
  const { stem, ext } = splitExtension(cleanName);
  const known = ext === 'dcm' || ext === 'dicom';
  if (ext && ext in EXT_KIND && !known) return reject('EXTENSION_MISMATCH');
  let info;
  try {
    info = parseDicom(bytes);
  } catch (e) {
    return reject(e instanceof DicomError && e.code === 'UNSUPPORTED' ? 'UNSUPPORTED_TYPE' : 'CORRUPT');
  }
  if (info.sopClassUid === MEDIA_DIRECTORY_SOP || !info.pixel) return reject('DICOM_NO_IMAGE');
  if (info.rows <= 0 || info.columns <= 0) return reject('CORRUPT');
  if (info.rows > limits.maxSide || info.columns > limits.maxSide || info.rows * info.columns > limits.maxPixels) return reject('IMAGE_TOO_LARGE');

  const summary = summarizeDicom(info);
  const warnings: UploadWarning[] = [];
  if (declaredMime && declaredMime !== MIME_BY_KIND.dicom && declaredMime !== 'application/octet-stream') warnings.push('MIME_MISMATCH');
  if (!summary.decodable) warnings.push('DICOM_NOT_VIEWABLE');
  const displayName = known ? stem : cleanName;
  const fileName = known ? cleanName : `${cleanName}.dcm`;
  return {
    ok: true,
    kind: 'dicom',
    mimeType: MIME_BY_KIND.dicom,
    fileName: fileName.length > MAX_FILE_NAME ? sanitizeFileName(fileName) : fileName,
    displayName,
    width: info.columns,
    height: info.rows,
    dicom: summary,
    warnings,
  };
}
