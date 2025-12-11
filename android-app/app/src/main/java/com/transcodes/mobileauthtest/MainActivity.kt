package com.transcodes.mobileauthtest

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var loginButton: Button
    private lateinit var statusLabel: TextView
    private lateinit var tokenLabel: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        loginButton = findViewById(R.id.loginButton)
        statusLabel = findViewById(R.id.statusLabel)
        tokenLabel = findViewById(R.id.tokenLabel)

        loginButton.setOnClickListener {
            if (TokenHelper.get(this, "access_token") != null) {
                logout()
            } else {
                startAuth()
            }
        }

        checkAuthStatus()
    }

    override fun onResume() {
        super.onResume()
        checkAuthStatus()
    }

    private fun checkAuthStatus() {
        val token = TokenHelper.get(this, "access_token")
        
        if (token != null) {
            android.util.Log.d("[Android]", "Token found, length: ${token.length}")
            android.util.Log.d("[Android]", "Token preview: ${token.take(50)}...")

            statusLabel.text = "✅ Authenticated"
            statusLabel.setTextColor(getColor(android.R.color.holo_green_dark))

            val maxDisplayLength = 200
            val displayToken = if (token.length > maxDisplayLength) {
                "${token.take(maxDisplayLength)}\n...(truncated, total: ${token.length} chars)"
            } else {
                token
            }

            tokenLabel.text = "Token (${token.length} chars):\n$displayToken"
            tokenLabel.setTextColor(getColor(android.R.color.black))
            tokenLabel.setBackgroundColor(getColor(android.R.color.darker_gray))

            loginButton.text = "Logout"
            loginButton.setBackgroundColor(getColor(android.R.color.holo_red_dark))
        } else {
            android.util.Log.d("[Android]", "No token found")

            statusLabel.text = "Not authenticated"
            statusLabel.setTextColor(getColor(android.R.color.darker_gray))
            tokenLabel.text = "Token: None"
            tokenLabel.setTextColor(getColor(android.R.color.darker_gray))
            tokenLabel.setBackgroundColor(android.graphics.Color.TRANSPARENT)

            loginButton.text = "Login with Passkey"
            loginButton.setBackgroundColor(getColor(android.R.color.holo_blue_dark))
        }
    }

    private fun startAuth() {
        val intent = Intent(this, AuthWebViewActivity::class.java)
        startActivityForResult(intent, REQUEST_CODE_AUTH)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == REQUEST_CODE_AUTH) {
            if (resultCode == RESULT_OK) {
                val token = data?.getStringExtra("token")
                if (token != null) {
                    val user = mapOf<String, Any?>(
                        "id" to data.getStringExtra("user_id"),
                        "email" to data.getStringExtra("user_email"),
                        "name" to data.getStringExtra("user_name")
                    )
                    onAuthSuccess(token, user)
                }
            } else if (resultCode == RESULT_CANCELED) {
                val error = data?.getStringExtra("error") ?: "Authentication cancelled"
                onAuthError(error)
            }
        }
    }

    companion object {
        private const val REQUEST_CODE_AUTH = 1001
    }

    private fun logout() {
        TokenHelper.delete(this, "access_token")
        checkAuthStatus()
    }

    fun onAuthSuccess(token: String, user: Map<String, Any?>) {
        checkAuthStatus()

        val userEmail = user["email"] as? String ?: "Unknown"
        val userName = user["name"] as? String
        val message = if (userName != null) "$userName\n$userEmail" else userEmail

        AlertDialog.Builder(this)
            .setTitle("✅ Login Successful")
            .setMessage("Authenticated as:\n$message\n\nToken saved securely")
            .setPositiveButton("OK") { _, _ ->
                checkAuthStatus()
            }
            .show()
    }

    fun onAuthError(error: String) {
        AlertDialog.Builder(this)
            .setTitle("Error")
            .setMessage(error)
            .setPositiveButton("OK", null)
            .show()
    }
}

