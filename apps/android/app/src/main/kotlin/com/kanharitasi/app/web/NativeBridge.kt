package com.kanharitasi.app.web

import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.util.Base64
import android.webkit.WebView
import androidx.fragment.app.FragmentActivity
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.kanharitasi.app.BuildConfig
import com.kanharitasi.app.R
import com.kanharitasi.app.security.BiometricGate
import com.kanharitasi.app.security.KeyVault
import org.json.JSONException
import org.json.JSONObject

/**
 * Web çekirdeği ile native kabuk arasındaki tek kanal.
 *
 * Güvenlik:
 * - `addJavascriptInterface` KULLANILMAZ. `khNative` nesnesi WebMessageListener ile yalnızca
 *   https://appassets.androidplatform.net kökenine ve yalnızca ana çerçeveye enjekte edilir.
 * - Her mesaj JSON olarak ayrıştırılır, tür/uzunluk denetlenir; bilinmeyen tür reddedilir.
 * - Ana anahtar baytları native tarafta yalnızca şifreleme/çözme süresince tutulur ve sıfırlanır.
 * - Hiçbir mesaj içeriği loglanmaz.
 */
class NativeBridge(
    private val activity: FragmentActivity,
    private val webView: WebView,
    private val saver: DocumentSaver,
    private val gate: BiometricGate,
) {
    private val main = Handler(Looper.getMainLooper())
    private var proxy: JavaScriptReplyProxy? = null
    private var authInProgress = false

    fun install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, OBJECT_NAME, setOf(SecureWebView.ORIGIN)) { _, message, sourceOrigin, isMainFrame, replyProxy ->
            if (!isMainFrame || !SecureWebView.isOwnOrigin(sourceOrigin)) return@addWebMessageListener
            val text = try {
                message.data
            } catch (e: IllegalStateException) {
                null // ArrayBuffer mesajı: köprü yalnızca JSON dizesi kabul eder.
            } ?: return@addWebMessageListener
            if (text.length > MAX_MESSAGE_CHARS) return@addWebMessageListener
            proxy = replyProxy
            handle(text)
        }
    }

    /** Native → web olayları (ör. uygulama arka plana geçti). */
    fun emit(event: String) = send(JSONObject().put("event", event))

    private fun handle(raw: String) {
        val msg = try {
            JSONObject(raw)
        } catch (e: JSONException) {
            return
        }
        val id = msg.optString("id")
        if (!ID_PATTERN.matches(id)) return
        val payload = msg.optJSONObject("payload") ?: JSONObject()
        when (msg.optString("type")) {
            "hello" -> ok(
                id,
                JSONObject()
                    .put("platform", "android")
                    .put("appVersion", BuildConfig.VERSION_NAME)
                    .put("deviceAuth", gate.availability())
                    .put("hasDeviceKey", KeyVault.hasKey()),
            )
            "keys.wrap" -> wrap(id, payload)
            "keys.unwrap" -> unwrap(id, payload)
            "keys.delete" -> {
                runCatching { KeyVault.delete() }
                ok(id, JSONObject())
            }
            "file.save" -> save(id, payload)
            else -> fail(id, "UNKNOWN")
        }
    }

    private fun wrap(id: String, payload: JSONObject) {
        if (authInProgress) return fail(id, "BUSY")
        val mk = decode(payload.optString("mk"))
        if (mk == null || mk.size != 32) {
            mk?.fill(0)
            return fail(id, "BAD_INPUT")
        }
        val cipher = try {
            KeyVault.newEncryptCipher()
        } catch (e: Exception) {
            mk.fill(0)
            return fail(id, "UNAVAILABLE")
        }
        authInProgress = true
        gate.authenticate(cipher, activity.getString(R.string.prompt_wrap_subtitle)) { outcome ->
            authInProgress = false
            try {
                when (outcome) {
                    is BiometricGate.Outcome.Success -> {
                        val ct = outcome.cipher.doFinal(mk)
                        ok(id, JSONObject().put("iv", encode(outcome.cipher.iv)).put("ct", encode(ct)))
                    }
                    is BiometricGate.Outcome.Failure -> {
                        runCatching { KeyVault.delete() }
                        fail(id, outcome.code)
                    }
                }
            } catch (e: Exception) {
                fail(id, "FAILED")
            } finally {
                mk.fill(0)
            }
        }
    }

    private fun unwrap(id: String, payload: JSONObject) {
        if (authInProgress) return fail(id, "BUSY")
        val iv = decode(payload.optString("iv"))
        val ct = decode(payload.optString("ct"))
        if (iv == null || ct == null || iv.size != 12 || ct.size != 48) return fail(id, "BAD_INPUT")
        val cipher = try {
            KeyVault.decryptCipher(iv)
        } catch (e: KeyVault.KeyMissingException) {
            return fail(id, "KEY_MISSING")
        } catch (e: KeyPermanentlyInvalidatedException) {
            return fail(id, "KEY_INVALIDATED")
        } catch (e: Exception) {
            return fail(id, "UNAVAILABLE")
        }
        authInProgress = true
        gate.authenticate(cipher, activity.getString(R.string.prompt_unwrap_subtitle)) { outcome ->
            authInProgress = false
            when (outcome) {
                is BiometricGate.Outcome.Success -> {
                    val mk = try {
                        outcome.cipher.doFinal(ct)
                    } catch (e: Exception) {
                        null
                    }
                    if (mk == null) {
                        fail(id, "FAILED")
                    } else {
                        ok(id, JSONObject().put("mk", encode(mk)))
                        mk.fill(0)
                    }
                }
                is BiometricGate.Outcome.Failure -> fail(id, outcome.code)
            }
        }
    }

    private fun save(id: String, payload: JSONObject) {
        val name = sanitizeName(payload.optString("name"))
        val mime = payload.optString("mime").takeIf { it in ALLOWED_SAVE_MIME } ?: return fail(id, "BAD_INPUT")
        val bytes = decode(payload.optString("data")) ?: return fail(id, "BAD_INPUT")
        if (bytes.isEmpty() || bytes.size > MAX_FILE_BYTES) return fail(id, "BAD_INPUT")
        saver.save(name, mime, bytes) { saved -> ok(id, JSONObject().put("saved", saved)) }
    }

    private fun ok(id: String, result: JSONObject) = send(JSONObject().put("id", id).put("ok", true).put("result", result))
    private fun fail(id: String, code: String) = send(JSONObject().put("id", id).put("ok", false).put("code", code))

    private fun send(obj: JSONObject) {
        val text = obj.toString()
        main.post { proxy?.postMessage(text) }
    }

    private fun decode(value: String): ByteArray? = try {
        if (value.isEmpty()) null else Base64.decode(value, Base64.NO_WRAP)
    } catch (e: IllegalArgumentException) {
        null
    }

    private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun sanitizeName(raw: String): String {
        val cleaned = raw.substringAfterLast('/').substringAfterLast('\\')
            .filter { it >= ' ' && it !in "<>:\"|?*" && it.code !in 0x202A..0x202E && it.code !in 0x2066..0x2069 }
            .trim().trimStart('.')
        return cleaned.take(120).ifEmpty { "belge" }
    }

    companion object {
        private const val OBJECT_NAME = "khNative"
        private val ID_PATTERN = Regex("^[A-Za-z0-9-]{1,40}$")
        private const val MAX_FILE_BYTES = 64 * 1024 * 1024
        private const val MAX_MESSAGE_CHARS = 100 * 1024 * 1024
        private val ALLOWED_SAVE_MIME = setOf(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "application/zip",
            "application/json",
            "text/csv",
            "application/octet-stream",
        )
    }
}
