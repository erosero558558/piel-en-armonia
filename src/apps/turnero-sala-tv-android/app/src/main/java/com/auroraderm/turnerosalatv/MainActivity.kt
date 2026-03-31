package com.auroraderm.turnerosalatv

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import android.provider.Settings

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var offlineState: android.view.View
    private lateinit var statusText: TextView
    private lateinit var retryButton: Button

    private lateinit var diagHost: TextView
    private lateinit var diagNetwork: TextView
    private lateinit var diagLastAttempt: TextView
    private lateinit var diagNextAttempt: TextView

    private val mainHandler = Handler(Looper.getMainLooper())
    private val reconnectRunnable = object : Runnable {
        override fun run() {
            var remaining = nextAttemptTime - System.currentTimeMillis()
            if (remaining <= 0) {
                loadSurface("retry")
            } else {
                updateCountdown(remaining)
                mainHandler.postDelayed(this, 1000)
            }
        }
    }
    private var nextAttemptTime = 0L
    private var deviceId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        webView = findViewById(R.id.turneroWebView)
        offlineState = findViewById(R.id.offlineState)
        statusText = findViewById(R.id.offlineStatusText)
        retryButton = findViewById(R.id.retryButton)

        diagHost = findViewById(R.id.diagHost)
        diagNetwork = findViewById(R.id.diagNetwork)
        diagLastAttempt = findViewById(R.id.diagLastAttempt)
        diagNextAttempt = findViewById(R.id.diagNextAttempt)

        deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "UNKNOWN_TV"

        configureWebView()
        retryButton.setOnClickListener { loadSurface("manual") }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    // Keep the TV shell anchored on the sala surface.
                }
            }
        )

        TurneroConfig.fetchRemoteConfig { updated ->
            mainHandler.post {
                if (savedInstanceState != null) {
                    webView.restoreState(savedInstanceState)
                } else {
                    loadSurface("boot")
                }
                startHeartbeat()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        webView.onResume()
        if (!TurneroConfig.isAllowedUrl(webView.url)) {
            loadSurface("resume")
        }
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUi()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(reconnectRunnable)
        webView.destroy()
        super.onDestroy()
    }

    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = "${userAgentString} ${TurneroConfig.userAgentSuffix()}"
        }

        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                return !TurneroConfig.isAllowedUrl(request?.url?.toString())
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (TurneroConfig.isAllowedUrl(url)) {
                    showOnlineState()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showOfflineState(
                        error?.description?.toString()
                            ?: getString(R.string.state_retrying)
                    )
                }
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                if (request?.isForMainFrame == true) {
                    showOfflineState(
                        getString(
                            R.string.state_http_error,
                            errorResponse?.statusCode ?: 0
                        )
                    )
                }
            }

            override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
            ): Boolean {
                showOfflineState(
                    getString(R.string.state_renderer_recovering)
                )
                mainHandler.postDelayed(
                    { recreate() },
                    TurneroConfig.RECONNECT_DELAY_MS
                )
                return true
            }
        }
    }

    private fun loadSurface(source: String) {
        mainHandler.removeCallbacks(reconnectRunnable)
        statusText.text =
            getString(R.string.state_loading, TurneroConfig.surfaceUrl(), source)

        if (!isNetworkConnected()) {
            showOfflineState(getString(R.string.state_retrying))
            return
        }

        if (TurneroConfig.isAllowedUrl(webView.url)) {
            webView.reload()
        } else {
            webView.loadUrl(TurneroConfig.surfaceUrl())
        }
    }

    private fun showOfflineState(message: String) {
        offlineState.isVisible = true
        statusText.text = message
        
        val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        diagHost.text = "Host: ${TurneroConfig.baseUrl}"
        diagNetwork.text = "Estado de Red: ${if (isNetworkConnected()) "Conectado, pero sin acceso al host" else "Sin Internet"}"
        diagLastAttempt.text = "Último Intento: ${sdf.format(Date())}"
        
        scheduleReconnect()
    }

    private fun showOnlineState() {
        mainHandler.removeCallbacks(reconnectRunnable)
        offlineState.isVisible = false
        statusText.text = getString(R.string.state_connected)
    }

    private fun updateCountdown(remainingMs: Long) {
        val seconds = remainingMs / 1000
        diagNextAttempt.text = "Próximo Reintento: en $seconds s"
    }

    private fun scheduleReconnect() {
        mainHandler.removeCallbacks(reconnectRunnable)
        nextAttemptTime = System.currentTimeMillis() + TurneroConfig.RECONNECT_DELAY_MS
        updateCountdown(TurneroConfig.RECONNECT_DELAY_MS)
        mainHandler.postDelayed(reconnectRunnable, 1000)
    }

    private fun startHeartbeat() {
        thread {
            while (true) {
                try {
                    val status = if (offlineState.isVisible) "offline" else "online"
                    val payload = JSONObject().apply {
                        put("device_id", deviceId)
                        put("version", BuildConfig.VERSION_NAME)
                        put("surface_url", TurneroConfig.surfaceUrl())
                        put("status", status)
                    }

                    val hpUrl = "${TurneroConfig.baseUrl.trimEnd('/')}/api.php?resource=tv-heartbeat"
                    val conn = URL(hpUrl).openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    conn.outputStream.use { os ->
                        os.write(payload.toString().toByteArray())
                    }
                    conn.responseCode // Just consume the response
                } catch (ignore: Exception) {}
                
                Thread.sleep(TurneroConfig.HEARTBEAT_INTERVAL_MS)
            }
        }
    }

    private fun hideSystemUi() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun isNetworkConnected(): Boolean {
        val manager =
            getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return false
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
