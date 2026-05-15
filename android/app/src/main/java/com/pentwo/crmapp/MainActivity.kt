package com.pentwo.crmapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    private val REQUEST_CODE_PERMISSIONS = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SmsPlugin::class.java)
        registerPlugin(ContactsPlugin::class.java)
        super.onCreate(savedInstanceState)

        // 키보드 입력 시 흰 화면 방지 — Window/WebView 배경 모두 앱 배경색으로 고정
        val appBg = Color.parseColor("#f6f7fb")
        window.setBackgroundDrawable(ColorDrawable(appBg))
        bridge.webView.setBackgroundColor(appBg)

        // Enter 키를 WebView 네이티브 레벨에서 가로채 페이지 이동 차단
        bridge.webView.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN) {
                bridge.webView.evaluateJavascript(
                    "(function(){ var el=document.activeElement; if(el) el.blur(); })();",
                    null
                )
                true
            } else {
                false
            }
        }

        if (savedInstanceState == null) {
            handleIntentUrl()
        }

        requestRequiredPermissions()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        setIntent(intent)

        handleIntentUrl()
    }

    private fun handleIntentUrl() {
        val crmUrl = intent.getStringExtra("crm_url")
        if (crmUrl.isNullOrBlank()) return
        bridge.webView.post {
            bridge.webView.loadUrl(crmUrl)
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.WRITE_CONTACTS
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(
                Manifest.permission.POST_NOTIFICATIONS
            )
        }

        val notGranted =
            permissions.filter {
                ContextCompat.checkSelfPermission(
                    this,
                    it
                ) != PackageManager.PERMISSION_GRANTED
            }

        if (notGranted.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                notGranted.toTypedArray(),
                REQUEST_CODE_PERMISSIONS
            )
        } else {
            startCallStateService()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(
            requestCode,
            permissions,
            grantResults
        )

        if (requestCode == REQUEST_CODE_PERMISSIONS) {
            startCallStateService()
        }
    }

    private fun startCallStateService() {
        val intent =
            Intent(
                this,
                CallStateService::class.java
            )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
}