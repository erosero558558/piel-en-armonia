package com.pielarmonia.turnerosalatv

import android.net.Uri

object TurneroConfig {
    const val BASE_URL = "https://pielarmonia.com"
    const val SURFACE_PATH = "/sala-turnos.html"
    const val RECONNECT_DELAY_MS = 5000L
    const val USER_AGENT_SUFFIX = "TurneroSalaTV/0.1.0"

    private val baseUri: Uri = Uri.parse(BASE_URL)
    private val surfaceUri: Uri = Uri.parse("${BASE_URL.trimEnd('/')}$SURFACE_PATH")

    fun surfaceUrl(): String = surfaceUri.toString()

    fun isAllowedUrl(candidate: String?): Boolean {
        if (candidate.isNullOrBlank()) {
            return false
        }

        val uri = runCatching { Uri.parse(candidate) }.getOrNull() ?: return false
        return uri.scheme == surfaceUri.scheme &&
            uri.host == surfaceUri.host &&
            (uri.port.takeIf { it >= 0 } ?: baseUri.port) == (surfaceUri.port.takeIf { it >= 0 } ?: baseUri.port) &&
            uri.path == surfaceUri.path
    }
}
