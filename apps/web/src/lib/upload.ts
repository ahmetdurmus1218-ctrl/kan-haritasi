import { DEFAULT_LIMITS, validateUpload } from '@kh/ingest';
import { type Bytes, type FileInfo, type Vault, sha256Hex } from '@kh/vault';
import { UPLOAD_REJECT_MESSAGES, UPLOAD_WARNING_MESSAGES, userMessage } from './messages';
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
): Promise<UploadOutcome> {
  onPhase('checking');
  if (file.size === 0) return { phase: 'error', message: UPLOAD_REJECT_MESSAGES.EMPTY, notes: [] };
  if (file.size > DEFAULT_LIMITS.maxBytes) return { phase: 'error', message: UPLOAD_REJECT_MESSAGES.TOO_LARGE, notes: [] };

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

    const existing = await vault.findBySha256(await sha256Hex(bytes));
    if (existing) return { phase: 'duplicate', file: existing, notes };

    onPhase('encrypting');
    const info = await vault.addFile({
      bytes,
      originalFileName: v.fileName,
      displayName: v.displayName,
      mimeType: v.mimeType,
      kind: v.kind,
    });
    logEvent('upload.done', { kind: v.kind });
    return { phase: 'done', file: info, notes };
  } catch (e) {
    return { phase: 'error', message: userMessage(e), notes: [] };
  }
}
