export type VaultErrorCode =
  | 'LOCKED'
  | 'WRONG_PASSPHRASE'
  | 'INTEGRITY'
  | 'NOT_FOUND'
  | 'NOT_INITIALIZED'
  | 'ALREADY_INITIALIZED'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_INPUT'
  | 'AUTH_CANCELLED'
  | 'AUTH_UNAVAILABLE'
  | 'KEY_INVALIDATED'
  | 'STORAGE';

/**
 * Kasanın fırlattığı tek hata tipi. Mesajlar teknik ve İngilizcedir; kullanıcıya
 * asla doğrudan gösterilmez. Arayüz yalnızca `code` alanına bakıp Türkçe metin seçer.
 * Hata nesnelerine sağlık verisi, dosya adı veya anahtar konmaz.
 */
export class VaultError extends Error {
  readonly code: VaultErrorCode;

  constructor(code: VaultErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'VaultError';
    this.code = code;
  }
}

export function isVaultError(e: unknown, code?: VaultErrorCode): e is VaultError {
  return e instanceof VaultError && (code === undefined || e.code === code);
}
