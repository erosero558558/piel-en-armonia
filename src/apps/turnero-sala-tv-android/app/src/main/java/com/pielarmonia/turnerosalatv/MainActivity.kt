package com.pielarmonia.turnerosalatv

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

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var offlineState: android.view.View
    private lateinit var statusText: TextView
    private lateinit var retryButton: Button

    private val mainHandler = Handler(Looper.getMainLooper())
    private val reconnectRunnable = Runnable { loadSurface("retry") }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        webView = findViewById(R.id.turneroWebView)
        offlineState = findViewById(R.id.offlineState)
        statusText = findViewById(R.id.offlineStatusText)
        retryButton = findViewById(R.id.retryButton)

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

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            loadSurface("boot")
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
            userAgentString = "${userAgentString} ${TurneroConfig.USER_AGENT_SUFFIX}"
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
        scheduleReconnect()
    }

    private fun showOnlineState() {
        mainHandler.removeCallbacks(reconnectRunnable)
        offlineState.isVisible = false
        statusText.text = getString(R.string.state_connected)
    }

    private fun scheduleReconnect() {
        mainHandler.removeCallbacks(reconnectRunnable)
        mainHandler.postDelayed(reconnectRunnable, TurneroConfig.RECONNECT_DELAY_MS)
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
