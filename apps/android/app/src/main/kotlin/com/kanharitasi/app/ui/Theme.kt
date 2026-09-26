package com.kanharitasi.app.ui

import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.kanharitasi.app.R

private val Background = Color(0xFF05070B)
private val Surface = Color(0xFF0B0F17)
private val Accent = Color(0xFF37D6C4)
private val Foreground = Color(0xFFE7EDF5)
private val Muted = Color(0xFF93A1B5)

@Composable
fun KanHaritasiTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Accent,
            background = Background,
            surface = Surface,
            onBackground = Foreground,
            onSurface = Foreground,
        ),
        content = content,
    )
}

/** Web çekirdeğini sistem çubukları ve klavye alanının dışında gösterir. */
@Composable
fun WebHost(webView: WebView) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
            .systemBarsPadding()
            .imePadding(),
    ) {
        AndroidView(factory = { webView }, modifier = Modifier.fillMaxSize())
    }
}

@Composable
fun UnsupportedWebViewScreen(missing: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
            .systemBarsPadding()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = stringResource(R.string.webview_unsupported_title),
                color = Foreground,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(if (missing) R.string.webview_missing_body else R.string.webview_unsupported_body),
                color = Muted,
                fontSize = 15.sp,
                lineHeight = 22.sp,
            )
        }
    }
}
