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

    private val channelId = "crm_call_channel"

    override fun onCreate() {
        super.onCreate()

        createNotificationChannel()

        // Android 8.0+: startForegroundService()로 시작된 서비스는
        // 5초 이내에 반드시 startForeground()를 호출해야 함
        val serviceNotification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("CRM 통화 감지 중")
            .setContentText("통화 종료 시 상담 등록 알림이 표시됩니다.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        startForeground(1, serviceNotification)

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
                "http://localhost/input?phone=$encodedPhone"

            val openIntent =
                Intent(
                    this@CallStateService,
                    MainActivity::class.java
                ).apply {

                    putExtra(
                        "crm_url",
                        url
                    )

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
                    channelId
                )
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("신규 상담 등록")
                    .setContentText("통화가 종료되었습니다. 상담을 등록하세요.")
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)

                    // 중요도
                    .setPriority(
                        NotificationCompat.PRIORITY_HIGH
                    )

                    // 진동 + 소리 + 알림 활성화
                    .setDefaults(
                        NotificationCompat.DEFAULT_ALL
                    )

                    // 잠금화면 표시
                    .setVisibility(
                        NotificationCompat.VISIBILITY_PUBLIC
                    )

                    .build()

            val manager =
                getSystemService(
                    NotificationManager::class.java
                )

            manager.notify(200, notification)

            Log.d("CRM", "CRM 알림 표시: $url")

        } catch (e: Exception) {
            Log.e("CRM", "CRM 알림 표시 실패", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel =
                NotificationChannel(
                    channelId,
                    "CRM 통화 알림",
                    NotificationManager.IMPORTANCE_HIGH
                )

            channel.description =
                "통화 종료 후 신규 상담 등록 알림"

            val manager =
                getSystemService(
                    NotificationManager::class.java
                )

            manager.createNotificationChannel(channel)
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