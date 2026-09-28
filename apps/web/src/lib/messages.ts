import type { RejectCode, UploadWarning } from '@kh/ingest';
import { DEFAULT_LIMITS } from '@kh/ingest';
import { VaultError, type VaultErrorCode } from '@kh/vault';
import { logEvent } from '../log';

export const GENERIC_ERROR = 'Bir hata oluştu. Lütfen tekrar deneyin.';

const VAULT_MESSAGES: Partial<Record<VaultErrorCode, string>> = {
  WRONG_PASSPHRASE: 'Parola yanlış.',
  LOCKED: 'Kasa kilitlendi. Devam etmek için kilidi aç.',
  INTEGRITY: 'Bu dosya doğrulanamadı; bozulmuş veya değiştirilmiş olabilir.',
  NOT_FOUND: 'Belge bulunamadı. Silinmiş olabilir.',
  INVALID_INPUT: 'Girilen değer geçerli değil.',
  UNSUPPORTED_VERSION: 'Bu veriler uygulamanın daha yeni bir sürümüyle oluşturulmuş.',
  AUTH_CANCELLED: 'Doğrulama iptal edildi.',
  AUTH_UNAVAILABLE: 'Cihaz kilidi şu an kullanılamıyor. Kurtarma parolanla açabilirsin.',
  KEY_INVALIDATED: 'Cihaz kilidi anahtarı artık geçerli değil (ör. ekran kilidi kaldırıldı). Kurtarma parolanla aç; anahtar yeniden oluşturulur.',
};

const mb = (n: number) => Math.round(n / (1024 * 1024));

export const UPLOAD_REJECT_MESSAGES: Record<RejectCode, string> = {
  EMPTY: 'Dosya boş.',
  TOO_LARGE: `Dosya çok büyük. En fazla ${mb(DEFAULT_LIMITS.maxBytes)} MB (DICOM için ${mb(DEFAULT_LIMITS.maxDicomBytes)} MB) yüklenebilir.`,
  UNSUPPORTED_EXTENSION: 'Yalnızca PDF, JPG, PNG ve DICOM (MR, BT, röntgen) dosyaları yüklenebilir.',
  UNSUPPORTED_TYPE: 'Dosyanın içeriği PDF, JPG, PNG veya desteklenen bir DICOM değil.',
  EXTENSION_MISMATCH: 'Dosyanın uzantısı içeriğiyle uyuşmuyor.',
  IMAGE_TOO_LARGE: `Fotoğrafın çözünürlüğü çok yüksek (en fazla ${DEFAULT_LIMITS.maxSide} px kenar, ${
    DEFAULT_LIMITS.maxPixels / 1_000_000
  } MP). Normal çözünürlükte çekip tekrar dene.`,
  TOO_MANY_PAGES: `PDF çok uzun. En fazla ${DEFAULT_LIMITS.maxPdfPages} sayfa yüklenebilir.`,
  DICOM_NO_IMAGE: 'Bu DICOM dosyası görüntü içermiyor (ör. CD\'deki DICOMDIR dizin dosyası). Klasördeki görüntü dosyalarını seç.',
  CORRUPT: 'Dosya bozuk veya okunamıyor.',
};

export const UPLOAD_WARNING_MESSAGES: Partial<Record<UploadWarning, string>> = {
  EXTENSION_CORRECTED: 'Dosya uzantısı içeriğe göre düzeltildi.',
  PDF_ENCRYPTED: 'PDF parola korumalı; açarken parola sorulacak.',
  PDF_HAS_SCRIPT: 'PDF gömülü komut içeriyor; uygulama komutları çalıştırmaz.',
  DICOM_NOT_VIEWABLE: 'Görüntü, uygulamanın çözemediği bir sıkıştırmayla kaydedilmiş (ör. JPEG 2000). Dosya ve bilgileri saklandı; görüntüyü göstermek için hastanenin verdiği görüntüleyiciyi kullanabilirsin.',
};

/** Hata ayrıntısı kullanıcıya asla gösterilmez; yalnızca bilinen kodlar Türkçe metne çevrilir. */
export function userMessage(error: unknown): string {
  if (error instanceof VaultError) {
    logEvent('error.vault', { code: error.code });
    return VAULT_MESSAGES[error.code] ?? GENERIC_ERROR;
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Cihazda yeterli depolama alanı yok.';
  }
  logEvent('error.unknown', { name: error instanceof Error ? error.name : typeof error });
  return GENERIC_ERROR;
}
