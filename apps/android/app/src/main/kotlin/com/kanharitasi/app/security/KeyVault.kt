package com.kanharitasi.app.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Web çekirdeğinin ana anahtarını (MK) sarmak için Android Keystore'daki AES-256 anahtarı.
 *
 * - Anahtar cihazdan dışarı çıkamaz (varsa StrongBox donanımında tutulur).
 * - Her kullanımda kullanıcı doğrulaması gerekir: güçlü biyometri veya ekran kilidi (PIN/desen/şifre).
 * - Ekran kilidi kaldırılırsa sistem anahtarı siler; kullanıcı kurtarma parolasıyla açar ve
 *   web tarafı yeni bir anahtarla yeniden sarar.
 */
object KeyVault {
    private const val ALIAS = "kh_master_wrap_v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val KEYSTORE = "AndroidKeyStore"

    class KeyMissingException : Exception()

    private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    fun hasKey(): Boolean = keyStore().containsAlias(ALIAS)

    fun delete() {
        val ks = keyStore()
        if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS)
    }

    /** Kurulum/yeniden bağlama: her seferinde yeni anahtar üretilir. */
    fun newEncryptCipher(): Cipher {
        delete()
        val key = generate(strongBox = true) ?: generate(strongBox = false) ?: throw IllegalStateException("key generation failed")
        return Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key) }
    }

    /** @throws KeyMissingException anahtar yok; KeyPermanentlyInvalidatedException geçersizleşmiş. */
    fun decryptCipher(iv: ByteArray): Cipher {
        val key = keyStore().getKey(ALIAS, null) as? SecretKey ?: throw KeyMissingException()
        return try {
            Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv)) }
        } catch (e: KeyPermanentlyInvalidatedException) {
            delete()
            throw e
        }
    }

    private fun generate(strongBox: Boolean): SecretKey? = try {
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
            // Yeni parmak izi eklenince verinin kaybolmaması için; doğrulama yine zorunlu.
            .setInvalidatedByBiometricEnrollment(false)
            .setIsStrongBoxBacked(strongBox)
            .build()
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).apply { init(spec) }.generateKey()
    } catch (e: StrongBoxUnavailableException) {
        null
    } catch (e: Exception) {
        if (strongBox) null else throw e
    }
}

/** BiometricPrompt sarmalayıcısı: şifreleme nesnesini yalnızca başarılı doğrulamadan sonra döndürür. */
class BiometricGate(private val activity: FragmentActivity) {
    sealed interface Outcome {
        data class Success(val cipher: Cipher) : Outcome
        data class Failure(val code: String) : Outcome
    }

    private val authenticators = BIOMETRIC_STRONG or DEVICE_CREDENTIAL

    fun availability(): String = when (BiometricManager.from(activity).canAuthenticate(authenticators)) {
        BiometricManager.BIOMETRIC_SUCCESS -> "available"
        BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "none_enrolled"
        else -> "unavailable"
    }

    fun authenticate(cipher: Cipher, subtitle: String, onResult: (Outcome) -> Unit) {
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    val c = result.cryptoObject?.cipher
                    onResult(if (c != null) Outcome.Success(c) else Outcome.Failure("FAILED"))
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    val code = when (errorCode) {
                        BiometricPrompt.ERROR_USER_CANCELED,
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                        BiometricPrompt.ERROR_CANCELED -> "CANCELLED"
                        BiometricPrompt.ERROR_LOCKOUT,
                        BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "LOCKOUT"
                        BiometricPrompt.ERROR_NO_BIOMETRICS,
                        BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL,
                        BiometricPrompt.ERROR_HW_NOT_PRESENT,
                        BiometricPrompt.ERROR_HW_UNAVAILABLE -> "UNAVAILABLE"
                        else -> "FAILED"
                    }
                    onResult(Outcome.Failure(code))
                }
                // onAuthenticationFailed: tanınmayan parmak; istem açık kalır, kullanıcı yeniden dener.
            },
        )
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(activity.getString(com.kanharitasi.app.R.string.prompt_title))
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(authenticators)
            .setConfirmationRequired(false)
            .build()
        prompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
    }
}
