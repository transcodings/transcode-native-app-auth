package com.transcodes.mobileauthtest

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class AuthWebViewActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val authURL = "https://transcode-native-app-auth.vercel.app/auth/mobile"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        setupWebView()
        loadAuthPage()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
        }

        // JavaScript Bridge
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        // Console logger
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: android.webkit.ConsoleMessage): Boolean {
                val prefix = when (message.messageLevel()) {
                    android.webkit.ConsoleMessage.MessageLevel.ERROR -> "❌ [JS Console]"
                    android.webkit.ConsoleMessage.MessageLevel.WARNING -> "⚠️ [JS Console]"
                    android.webkit.ConsoleMessage.MessageLevel.LOG -> "📝 [JS Console]"
                    android.webkit.ConsoleMessage.MessageLevel.DEBUG -> "🔍 [JS Console]"
                    android.webkit.ConsoleMessage.MessageLevel.TIP -> "ℹ️ [JS Console]"
                    else -> "📝 [JS Console]"
                }
                android.util.Log.d("WebView", "$prefix ${message.message()}")
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
            }
        }
    }

    private fun loadAuthPage() {
        webView.loadUrl(authURL)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun postMessage(message: String) {
            runOnUiThread {
                try {
                    val json = JSONObject(message)
                    val type = json.getString("type")
                    val payload = json.getJSONObject("payload")

                    when (type) {
                        "AUTH_SUCCESS" -> {
                            val token = payload.getString("token")
                            val userObj = payload.getJSONObject("user")
                            val user = mapOf(
                                "id" to userObj.getString("id"),
                                "email" to userObj.optString("email"),
                                "name" to userObj.optString("name")
                            )

                            android.util.Log.d("[Android]", "✅ Received AUTH_SUCCESS")
                            android.util.Log.d("[Android]", "Token length: ${token.length}")
                            android.util.Log.d("[Android]", "Token preview: ${token.take(50)}...")

                            TokenHelper.save(this@AuthWebViewActivity, "access_token", token)
                            android.util.Log.d("[Android]", "Token saved")

                            // Verify token was saved
                            val savedToken = TokenHelper.get(this@AuthWebViewActivity, "access_token")
                            if (savedToken != null) {
                                android.util.Log.d("[Android]", "✅ Verified: Token retrieved, length: ${savedToken.length}")
                            } else {
                                android.util.Log.e("[Android]", "❌ Warning: Token not found after save")
                            }

                            val resultIntent = Intent().apply {
                                putExtra("token", token)
                                putExtra("user_id", user["id"])
                                putExtra("user_email", user["email"])
                                putExtra("user_name", user["name"])
                            }
                            setResult(RESULT_OK, resultIntent)
                            finish()
                        }
                        "AUTH_CANCELLED" -> {
                            android.util.Log.d("[Android]", "AUTH_CANCELLED")
                            finish()
                        }
                        "AUTH_ERROR" -> {
                            val errorMessage = payload.optString("message", "Unknown error")
                            android.util.Log.e("[Android]", "AUTH_ERROR: $errorMessage")
                            val resultIntent = Intent().apply {
                                putExtra("error", errorMessage)
                            }
                            setResult(RESULT_CANCELED, resultIntent)
                            finish()
                        }
                        "AUTH_STARTED" -> {
                            android.util.Log.d("[Android]", "AUTH_STARTED")
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("[Android]", "Error parsing bridge message: ${e.message}")
                }
            }
        }
    }
}

