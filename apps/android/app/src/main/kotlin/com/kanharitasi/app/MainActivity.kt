package com.kanharitasi.app

import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import com.kanharitasi.app.security.BiometricGate
import com.kanharitasi.app.ui.KanHaritasiTheme
import com.kanharitasi.app.ui.UnsupportedWebViewScreen
import com.kanharitasi.app.ui.WebHost
import com.kanharitasi.app.web.CaptureCache
import com.kanharitasi.app.web.DocumentSaver
import com.kanharitasi.app.web.FileChooser
import com.kanharitasi.app.web.NativeBridge
import com.kanharitasi.app.web.SecureWebView
import com.kanharitasi.app.web.WebViewSupport

/**
 * Tek ekranlı kabuk. Arayüzün tamamı APK içindeki web çekirdeğidir; bu sınıf yalnızca
 * platforma özgü işleri üstlenir: güvenli WebView, köprü, dosya seçme/kaydetme,
 * cihaz kilidi (Keystore + BiometricPrompt) ve ekran görüntüsü engeli.
 */
class MainActivity : FragmentActivity() {

    private var webView: WebView? = null
    private var bridge: NativeBridge? = null

    // ActivityResult kayıtları onCreate'te, STARTED durumundan önce yapılmalı.
    private val fileChooser = FileChooser(this)
    private val documentSaver = DocumentSaver(this)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)

        // Sağlık verisi: ekran görüntüsü, ekran kaydı ve "son uygulamalar" önizlemesi engellenir.
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        CaptureCache.clear(this)

        val support = WebViewSupport.check(this)
        if (support != WebViewSupport.Status.OK) {
            setContent { KanHaritasiTheme { UnsupportedWebViewScreen(missing = support == WebViewSupport.Status.MISSING) } }
            return
        }

        val view = SecureWebView.create(this, fileChooser)
        webView = view
        bridge = NativeBridge(this, view, documentSaver, BiometricGate(this)).also { it.install() }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val current = webView
                    if (current != null && current.canGoBack()) current.goBack() else finish()
                }
            },
        )

        setContent { KanHaritasiTheme { WebHost(view) } }
        view.loadUrl(SecureWebView.START_URL)
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        CaptureCache.clearStale(this)
        bridge?.emit("foreground")
    }

    override fun onPause() {
        bridge?.emit("background")
        webView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView?.let {
            (it.parent as? android.view.ViewGroup)?.removeView(it)
            it.destroy()
        }
        webView = null
        if (isFinishing) CaptureCache.clear(this)
        super.onDestroy()
    }
}
