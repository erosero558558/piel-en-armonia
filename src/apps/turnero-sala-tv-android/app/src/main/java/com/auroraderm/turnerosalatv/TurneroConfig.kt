package com.auroraderm.turnerosalatv

import android.net.Uri

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object TurneroConfig {
    var RECONNECT_DELAY_MS = 5000L
    var HEARTBEAT_INTERVAL_MS = 60000L

    var baseUrl: String = BuildConfig.TURNERO_BASE_URL.trim().ifBlank {
        "https://pielarmonia.com"
    }
    var surfacePath: String = BuildConfig.TURNERO_SURFACE_PATH.trim().ifBlank {
        "/sala-turnos.html"
    }
    
    private var baseUri: Uri = Uri.parse(baseUrl)
    private var surfaceUri: Uri = Uri.parse("${baseUrl.trimEnd('/')}$surfacePath")

    fun updateUris() {
        baseUri = Uri.parse(baseUrl)
        surfaceUri = Uri.parse("${baseUrl.trimEnd('/')}$surfacePath")
    }

    fun surfaceUrl(): String = surfaceUri.toString()
    fun userAgentSuffix(): String = "TurneroSalaTV/${BuildConfig.VERSION_NAME}"

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

    fun fetchRemoteConfig(onUpdate: (Boolean) -> Unit) {
        val configUrl = "${baseUrl.trimEnd('/')}/api.php?resource=tv-config"
        thread {
            var updated = false
            try {
                val conn = URL(configUrl).openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                if (conn.responseCode == 200) {
                    val json = conn.inputStream.bufferedReader().use { it.readText() }
                    val obj = JSONObject(json)
                    if (obj.optBoolean("ok", false)) {
                        val newBase = obj.optString("baseUrl", baseUrl)
                        val newPath = obj.optString("surfacePath", surfacePath)
                        val feats = obj.optJSONObject("features")
                        val heartbeatInt = feats?.optLong("heartbeatIntervalMs", HEARTBEAT_INTERVAL_MS) ?: HEARTBEAT_INTERVAL_MS

                        if (baseUrl != newBase || surfacePath != newPath) {
                            baseUrl = newBase
                            surfacePath = newPath
                            updateUris()
                            updated = true
                        }
                        HEARTBEAT_INTERVAL_MS = heartbeatInt
                    }
                }
            } catch (ignore: Exception) {}
            onUpdate(updated)
        }
    }
}
