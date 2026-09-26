package com.kanharitasi.app.web

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.AssetManager
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.kanharitasi.app.BuildConfig
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * Sertleştirilmiş WebView:
 * - Sayfa, APK içindeki varlıklardan `https://appassets.androidplatform.net` sanal kökeniyle sunulur
 *   (güvenli bağlam: WebCrypto çalışır). Başka hiçbir adrese istek veya gezinme yapılamaz.
 * - Dosya erişimi kapalı, pencere açma kapalı, izin istekleri (kamera, konum...) reddedilir.
 * - Konsol mesajları Logcat'e yazılmaz (sağlık verisi sızmasın).
 */
object SecureWebView {
    const val HOST = "appassets.androidplatform.net"
    const val ORIGIN = "https://$HOST"
    const val START_URL = "$ORIGIN/web/index.html"
    private const val BACKGROUND = 0xFF05070B.toInt()

    @SuppressLint("SetJavaScriptEnabled")
    fun create(context: Context, chooser: FileChooser): WebView {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.WEB_DEBUG)
        val loader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .setHttpAllowed(false)
            .addPathHandler("/", WebAssetsHandler(context.assets))
            .build()

        return WebView(context).apply {
            // Açık MATCH_PARENT şart: Compose AndroidView düzen parametresi vermezse WebView "içeriğe göre
            // yükseklik" kipine girer; sayfanın %100 yüksekliği sıfıra iner ve ana içerik görünmez olur.
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            setBackgroundColor(BACKGROUND)
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER

            with(settings) {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                // Dosya seçiciden gelen content:// URI'leri WebView'ın kendi yükleme hattıyla okunur;
                // sayfanın content:// yüklemesi zaten CSP (default-src 'self') ile engelli.
                allowContentAccess = true
                setSupportMultipleWindows(false)
                javaScriptCanOpenWindowsAutomatically = false
                mediaPlaybackRequiresUserGesture = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                safeBrowsingEnabled = false
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                setGeolocationEnabled(false)
            }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                    val url = request.url
                    if (isOwnOrigin(url)) return loader.shouldInterceptRequest(url) ?: notFound()
                    // Dış dünyaya giden her istek burada durur (ayrıca uygulamanın internet izni yok).
                    return forbidden()
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    !isOwnOrigin(request.url)
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams,
                ): Boolean {
                    chooser.open(filePathCallback, fileChooserParams)
                    return true
                }

                override fun onPermissionRequest(request: PermissionRequest) = request.deny()

                override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                    callback.invoke(origin, false, false)
                }

                override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean = !BuildConfig.WEB_DEBUG
            }

            setDownloadListener { _, _, _, _, _ -> /* İndirmeler köprü (file.save) üzerinden yapılır. */ }
        }
    }

    fun isOwnOrigin(url: Uri): Boolean = url.scheme == "https" && url.host == HOST && (url.port == -1 || url.port == 443)

    private fun forbidden() = WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
    private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
}

/**
 * `assets/web/...` altındaki dosyaları doğru MIME türüyle sunar. Yol dışına çıkma (`..`)
 * reddedilir. Modül betikleri (.mjs), WebAssembly ve 3D modeller için türler açıkça tanımlıdır.
 */
class WebAssetsHandler(private val assets: AssetManager) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val clean = path.substringBefore('?').substringBefore('#').trimStart('/')
        if (clean.isEmpty() || clean.contains("..") || clean.contains('\\') || !clean.startsWith("web/")) return null
        val assetPath = if (clean.endsWith('/')) "${clean}index.html" else clean
        return try {
            val stream = assets.open(assetPath)
            val mime = mimeFor(assetPath)
            val encoding = if (mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("xml")) "utf-8" else null
            WebResourceResponse(mime, encoding, 200, "OK", HEADERS, stream)
        } catch (e: IOException) {
            null
        }
    }

    companion object {
        private val HEADERS = mapOf(
            "X-Content-Type-Options" to "nosniff",
            "Referrer-Policy" to "no-referrer",
            "Cross-Origin-Opener-Policy" to "same-origin",
            "Cache-Control" to "no-cache",
        )

        fun mimeFor(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
            "html" -> "text/html"
            "js", "mjs" -> "text/javascript"
            "css" -> "text/css"
            "json", "webmanifest" -> "application/json"
            "wasm" -> "application/wasm"
            "svg" -> "image/svg+xml"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "webp" -> "image/webp"
            "ico" -> "image/x-icon"
            "glb" -> "model/gltf-binary"
            "bcmap", "traineddata", "gz", "pfb" -> "application/octet-stream"
            "ttf" -> "font/ttf"
            "otf" -> "font/otf"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "txt" -> "text/plain"
            "icc" -> "application/vnd.iccprofile"
            else -> "application/octet-stream"
        }
    }
}

/** Web çekirdeği Chromium 111+ özelliklerine (color-mix, Trusted Types, OPFS) dayanır. */
object WebViewSupport {
    enum class Status { OK, TOO_OLD, MISSING }

    private const val MIN_MAJOR = 111

    fun check(context: Context): Status {
        val pkg = try {
            WebViewCompat.getCurrentWebViewPackage(context)
        } catch (e: Exception) {
            null
        } ?: return Status.MISSING
        val major = pkg.versionName?.substringBefore('.')?.toIntOrNull() ?: return Status.OK
        return if (major >= MIN_MAJOR) Status.OK else Status.TOO_OLD
    }
}
