package com.transcodes.mobileauthtest

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object TokenHelper {
    private const val PREFS_NAME = "auth_prefs"
    private const val KEY_ACCESS_TOKEN = "access_token"

    private fun getEncryptedPrefs(context: Context): EncryptedSharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        ) as EncryptedSharedPreferences
    }

    fun save(context: Context, key: String, value: String) {
        val prefs = getEncryptedPrefs(context)
        prefs.edit().putString(key, value).apply()
    }

    fun get(context: Context, key: String): String? {
        val prefs = getEncryptedPrefs(context)
        return prefs.getString(key, null)
    }

    fun delete(context: Context, key: String) {
        val prefs = getEncryptedPrefs(context)
        prefs.edit().remove(key).apply()
    }
}

