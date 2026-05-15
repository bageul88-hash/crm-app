package com.pentwo.crmapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.net.URLEncoder

class CallStateService : Service() {

    private lateinit var telephonyManager: TelephonyManager

    private var wasInCall = false
    private var isFirstState = true
    private var lastNotificationTime = 0L

    private val callChannelId = "crm_call_channel"
    private val serviceChannelId = "crm_call_service"

    override fun onCreate() {
        super.onCreate()

        createNotificationChannels()
        startForegroundNotification()

        telephonyManager =
            getSystemService(TELEPHONY_SERVICE) as TelephonyManager

        @Suppress("DEPRECATION")
        telephonyManager.listen(
            phoneStateListener,
            PhoneStateListener.LISTEN_CALL_STATE
        )

        Log.d("CRM", "통화 감지 서비스 시작")
    }

    @Suppress("DEPRECATION")
    private val phoneStateListener =
        object : PhoneStateListener() {

            override fun onCallStateChanged(
                state: Int,
                phoneNumber: String?
            ) {
                when (state) {

                    TelephonyManager.CALL_STATE_RINGING -> {
                        Log.d("CRM", "전화 수신 중")
                    }

                    TelephonyManager.CALL_STATE_OFFHOOK -> {
                        Log.d("CRM", "통화 시작")
                        isFirstState = false
                        wasInCall = true
                    }

                    TelephonyManager.CALL_STATE_IDLE -> {
                        if (isFirstState) {
                            Log.d("CRM", "최초 IDLE 무시")
                            isFirstState = false
                            return
                        }

                        if (!wasInCall) {
                            Log.d("CRM", "통화 없음 IDLE 무시")
                            return
                        }

                        Log.d("CRM", "통화 종료 감지")
                        wasInCall = false

                        Handler(
                            Looper.getMainLooper()
                        ).postDelayed({

                            val number =
                                CallLogReader.getLatestCallNumber(
                                    this@CallStateService
                                )

                            Log.d("CRM", "최근 통화번호: $number")

                            if (!number.isNullOrBlank()) {
                                showCrmNotification(number)
                            } else {
                                Log.w("CRM", "전화번호 없음 - 알림 취소")
                            }

                        }, 1500)
                    }
                }
            }
        }

    private fun startForegroundNotification() {
        val notification =
            NotificationCompat.Builder(
                this,
                serviceChannelId
            )
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("상담 CRM 실행 중")
                .setContentText("통화 종료를 감지하고 있습니다.")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()

        startForeground(
            1001,
            notification
        )
    }

    private fun showCrmNotification(phone: String) {
        try {
            val now = System.currentTimeMillis()

            if (now - lastNotificationTime < 5000) {
                Log.d("CRM", "중복 알림 방지")
                return
            }

            lastNotificationTime = now

            val encodedPhone =
                URLEncoder.encode(phone, "UTF-8")

            val url =
                "https://crm-app-sj7m.onrender.com/input?phone=$encodedPhone"

            val openIntent =
                Intent(
                    this@CallStateService,
                    MainActivity::class.java
                ).apply {
                    putExtra("crm_url", url)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }

            val pendingIntent =
                PendingIntent.getActivity(
                    this,
                    200,
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or
                        PendingIntent.FLAG_IMMUTABLE
                )

            val notification =
                NotificationCompat.Builder(
                    this,
                    callChannelId
                )
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("신규 상담 등록")
                    .setContentText("통화가 종료되었습니다. 상담을 등록하세요.")
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .build()

            val manager =
                getSystemService(
                    NotificationManager::class.java
                )

            manager.notify(
                200,
                notification
            )

            Log.d("CRM", "CRM 알림 표시: $url")

        } catch (e: Exception) {
            Log.e("CRM", "CRM 알림 표시 실패", e)
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val serviceChannel =
                NotificationChannel(
                    serviceChannelId,
                    "CRM 통화 감지",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description =
                        "통화 종료 감지를 위해 실행 중인 서비스"
                }

            val callChannel =
                NotificationChannel(
                    callChannelId,
                    "CRM 상담 등록 알림",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description =
                        "통화 종료 후 신규 상담 등록 알림"
                    enableVibration(true)
                    enableLights(true)
                }

            val manager =
                getSystemService(
                    NotificationManager::class.java
                )

            manager.createNotificationChannel(
                serviceChannel
            )

            manager.createNotificationChannel(
                callChannel
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()

        @Suppress("DEPRECATION")
        telephonyManager.listen(
            phoneStateListener,
            PhoneStateListener.LISTEN_NONE
        )

        Log.d("CRM", "통화 감지 서비스 종료")
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}