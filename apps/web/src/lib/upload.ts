import { type AcceptedUpload, DEFAULT_LIMITS, isDicom, modalityCategory, sanitizeFileName, validateUpload } from '@kh/ingest';
import { type Bytes, type DocCategory, type FileInfo, MAX_DISPLAY_NAME, type NewFileInput, type Vault, sha256Hex } from '@kh/vault';
import { UPLOAD_REJECT_MESSAGES, UPLOAD_WARNING_MESSAGES, userMessage } from './messages';
import { CATEGORY_LABEL, guessCategory, guessRegion, isImaging, regionByKey } from './imaging';
import { logEvent } from '../log';

export type UploadPhase = 'checking' | 'encrypting' | 'done' | 'duplicate' | 'error';

export interface UploadOutcome {
  phase: Exclude<UploadPhase, 'checking' | 'encrypting'>;
  file?: FileInfo;
  message?: string;
  notes: string[];
}

export interface UploadDeps {
  /** PDF sayfa sayısı; parola korumalıysa null. Testlerde sahte verilir. */
  countPdfPages(bytes: Uint8Array): Promise<number | null>;
  /**
   * Aynı dosya zaten kasada mı? Verilmezse kasadaki liste her dosyada yeniden çözülür; çok dosyalı
   * (ör. yüzlerce kesitlik MR) yüklemede çağıran taraf listeyi bir kez çözüp buradan verir.
   */
  findExisting?(sha256: string): Promise<FileInfo | undefined>;
}

export interface UploadOptions {
  /** Kullanıcının seçtiği belge türü. DICOM dosyasında dosyanın kendi modalitesi önceliklidir. */
  category?: DocCategory;
}

const UID = /^[0-9.]{1,64}$/;

/** Belge türü, bölge, tarih ve seri bilgisi: DICOM başlığından ya da dosya adından. */
export function classify(v: AcceptedUpload, originalName: string, selected: DocCategory = 'lab'): Pick<NewFileInput, 'category' | 'region' | 'studyDate' | 'seriesUid' | 'sliceIndex' | 'displayName'> {
  if (v.kind === 'dicom' && v.dicom) {
    const d = v.dicom;
    const category = modalityCategory(d.modality) ?? (selected === 'lab' ? 'other' : selected);
    const described = [d.studyDescription, d.seriesDescription].filter(Boolean).join(' · ');
    const displayName = described ? sanitizeFileName(described).slice(0, MAX_DISPLAY_NAME).trim() || v.displayName : v.displayName;
    const index = d.instanceNumber ?? d.sliceLocation;
    return {
      category,
      region: guessRegion(d.bodyPart, d.studyDescription, d.seriesDescription, originalName),
      studyDate: d.studyDate,
      seriesUid: d.seriesUid && UID.test(d.seriesUid) ? d.seriesUid : undefined,
      sliceIndex: index !== undefined && Number.isFinite(index) ? index : undefined,
      displayName,
    };
  }
  const category = selected !== 'lab' ? selected : (guessCategory(originalName) ?? 'lab');
  return { category, region: isImaging(category) ? guessRegion(originalName) : undefined, displayName: v.displayName };
}

/** 20 MB'tan büyük dosya yalnızca DICOM ise (60 MB'a kadar) okunur; önce imzaya bakılır. */
async function withinSizeLimit(file: File): Promise<boolean> {
  if (file.size <= DEFAULT_LIMITS.maxBytes) return true;
  if (file.size > DEFAULT_LIMITS.maxDicomBytes) return false;
  return isDicom(new Uint8Array(await file.slice(0, 132).arrayBuffer()));
}

/**
 * Tek dosyanın yükleme hattı:
 * boyut (okumadan önce) → imza/başlık doğrulaması → PDF sayfa sınırı → çift kayıt → şifreli kayıt.
 * Hiçbir adımda dosya içeriği veya adı loglanmaz.
 */
export async function processUpload(
  vault: Vault,
  file: File,
  deps: UploadDeps,
  onPhase: (phase: UploadPhase) => void = () => undefined,
  options: UploadOptions = {},
): Promise<UploadOutcome> {
  onPhase('checking');
  if (file.size === 0) return { phase: 'error', message: UPLOAD_REJECT_MESSAGES.EMPTY, notes: [] };
  if (!(await withinSizeLimit(file).catch(() => false))) return { phase: 'error', message: UPLOAD_REJECT_MESSAGES.TOO_LARGE, notes: [] };

  try {
    const bytes: Bytes = new Uint8Array(await file.arrayBuffer());
    const v = validateUpload({ bytes, fileName: file.name, declaredMime: file.type || undefined });
    if (!v.ok) {
      logEvent('upload.rejected', { code: v.code });
      return { phase: 'error', message: UPLOAD_REJECT_MESSAGES[v.code], notes: [] };
    }
    const notes = v.warnings.map((w) => UPLOAD_WARNING_MESSAGES[w]).filter((m): m is string => Boolean(m));

    if (v.kind === 'pdf') {
      let pages: number | null;
      try {
        pages = await deps.countPdfPages(bytes);
      } catch {
        logEvent('upload.rejected', { code: 'CORRUPT' });
        return { phase: 'error', message: UPLOAD_REJECT_MESSAGES.CORRUPT, notes };
      }
      if (pages !== null && pages > DEFAULT_LIMITS.maxPdfPages) {
        return { phase: 'error', message: UPLOAD_REJECT_MESSAGES.TOO_MANY_PAGES, notes };
      }
    }

    const sha = await sha256Hex(bytes);
    const existing = deps.findExisting ? await deps.findExisting(sha) : await vault.findBySha256(sha);
    if (existing) return { phase: 'duplicate', file: existing, notes };

    const meta = classify(v, file.name, options.category);
    if (isImaging(meta.category)) {
      const region = meta.region ? regionByKey.get(meta.region)?.label : undefined;
      notes.unshift(`${CATEGORY_LABEL[meta.category!]}${region ? ` · ${region}` : ''} olarak kaydedildi.`);
    }

    onPhase('encrypting');
    const info = await vault.addFile({
      bytes,
      originalFileName: v.fileName,
      mimeType: v.mimeType,
      kind: v.kind,
      ...meta,
    });
    logEvent('upload.done', { kind: v.kind, category: info.category });
    return { phase: 'done', file: info, notes };
  } catch (e) {
    return { phase: 'error', message: userMessage(e), notes: [] };
  }
}
