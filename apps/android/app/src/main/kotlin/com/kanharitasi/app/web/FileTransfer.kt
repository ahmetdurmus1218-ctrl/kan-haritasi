package com.kanharitasi.app.web

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient.FileChooserParams
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import java.io.File
import java.util.concurrent.Executors

/**
 * Uygulamanın kendi açtığı sistem ekranları (belge seçici, kamera, kaydetme, cihaz kilidi) sürerken
 * etkinlik duraklar; bu, kullanıcının uygulamadan çıkması sayılmamalı (aksi halde "hemen kilitle"
 * ayarında dosya seçerken kasa kilitlenir ve yükleme kaybolur).
 */
object ExternalFlow {
    @Volatile
    var active = false
}

/**
 * Sayfadaki `<input type=file>` için sistem belge seçicisi; `capture` özniteliği varsa kamera.
 * Yalnızca PDF, JPEG ve PNG seçilebilir (web tarafı ayrıca imzadan doğrular).
 */
class FileChooser(private val activity: ComponentActivity) {
    private var callback: ValueCallback<Array<Uri>>? = null
    private var captureUri: Uri? = null

    private val pickLauncher = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        ExternalFlow.active = false
        val cb = callback ?: return@registerForActivityResult
        callback = null
        cb.onReceiveValue(if (result.resultCode == Activity.RESULT_OK) urisFrom(result.data) else null)
    }

    private val captureLauncher = activity.registerForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        ExternalFlow.active = false
        val cb = callback ?: return@registerForActivityResult
        callback = null
        val uri = captureUri
        captureUri = null
        cb.onReceiveValue(if (saved && uri != null) arrayOf(uri) else null)
    }

    fun open(cb: ValueCallback<Array<Uri>>, params: FileChooserParams) {
        // Önceki istek yanıtsız kaldıysa WebView bir daha seçici açmaz; kapat.
        callback?.onReceiveValue(null)
        callback = cb

        val wantsImage = params.acceptTypes.any { it.startsWith("image") }
        if (params.isCaptureEnabled && wantsImage) {
            try {
                val uri = CaptureCache.newUri(activity)
                captureUri = uri
                ExternalFlow.active = true
                captureLauncher.launch(uri)
            } catch (e: Exception) {
                cancel()
            }
            return
        }

        // Yedek dosyası (.khyedek) ve DICOM (MR/BT/röntgen; çoğu uzantısız) için tür filtresi yok;
        // içerik web tarafında imzasıyla doğrulanır.
        val unfiltered = params.acceptTypes.all { it.isBlank() } ||
            params.acceptTypes.any { it == ".khyedek" || it == "application/octet-stream" || it == "application/dicom" || it == ".dcm" }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
            .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
        if (!unfiltered) intent.putExtra(Intent.EXTRA_MIME_TYPES, ALLOWED_MIME)
        try {
            ExternalFlow.active = true
            pickLauncher.launch(intent)
        } catch (e: ActivityNotFoundException) {
            cancel()
        }
    }

    private fun cancel() {
        ExternalFlow.active = false
        callback?.onReceiveValue(null)
        callback = null
        captureUri = null
    }

    private fun urisFrom(data: Intent?): Array<Uri>? {
        if (data == null) return null
        val clip = data.clipData
        if (clip != null && clip.itemCount > 0) {
            return Array(clip.itemCount) { clip.getItemAt(it).uri }.take(MAX_FILES).toTypedArray()
        }
        return data.data?.let { arrayOf(it) }
    }

    companion object {
        private val ALLOWED_MIME = arrayOf("application/pdf", "image/jpeg", "image/png", "application/dicom")
        // Bir MR/BT serisi yüzlerce kesit içerebilir; dosyalar web tarafında sırayla, tek tek işlenir.
        private const val MAX_FILES = 1000
    }
}

/** Kamerayla çekilen fotoğraf, web tarafı okuyup şifreleyene kadar önbellekte kısa süre durur. */
object CaptureCache {
    private const val DIR = "capture"
    private const val STALE_MS = 10 * 60 * 1000L

    private fun dir(context: Context) = File(context.cacheDir, DIR).apply { mkdirs() }

    fun newUri(context: Context): Uri {
        val file = File.createTempFile("kh_", ".jpg", dir(context))
        return FileProvider.getUriForFile(context, "${context.packageName}.capture", file)
    }

    fun clear(context: Context) {
        dir(context).listFiles()?.forEach { it.delete() }
    }

    /** Uygulama ön plana dönünce 10 dakikadan eski çekimleri siler. */
    fun clearStale(context: Context) {
        val now = System.currentTimeMillis()
        dir(context).listFiles()?.filter { now - it.lastModified() > STALE_MS }?.forEach { it.delete() }
    }
}

/** Orijinal baytları, kullanıcının sistem "Kaydet" iletişim kutusunda seçtiği yere yazar. */
class DocumentSaver(private val activity: ComponentActivity) {
    private var pending: Pair<ByteArray, (Boolean) -> Unit>? = null
    private val io = Executors.newSingleThreadExecutor()

    private val launcher = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        ExternalFlow.active = false
        val (bytes, done) = pending ?: return@registerForActivityResult
        pending = null
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            bytes.fill(0)
            done(false)
            return@registerForActivityResult
        }
        io.execute {
            val ok = try {
                activity.contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes) } != null
            } catch (e: Exception) {
                false
            } finally {
                bytes.fill(0)
            }
            activity.runOnUiThread { done(ok) }
        }
    }

    fun save(name: String, mime: String, bytes: ByteArray, done: (Boolean) -> Unit) {
        pending?.let { (old, oldDone) ->
            old.fill(0)
            oldDone(false)
        }
        pending = bytes to done
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime)
            .putExtra(Intent.EXTRA_TITLE, name)
        try {
            ExternalFlow.active = true
            launcher.launch(intent)
        } catch (e: ActivityNotFoundException) {
            ExternalFlow.active = false
            pending = null
            bytes.fill(0)
            done(false)
        }
    }
}
