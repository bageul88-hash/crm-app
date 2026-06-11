package com.pentwo.crmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsManager
import android.util.Log

class SmsSchedulerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val jobId = intent.getStringExtra("jobId") ?: run {
            Log.e("CRM_SCHED", "jobId 없음 — 무시")
            return
        }
        val phone = intent.getStringExtra("phone") ?: run {
            Log.e("CRM_SCHED", "phone 없음 — 무시")
            return
        }
        val body = intent.getStringExtra("body") ?: run {
            Log.e("CRM_SCHED", "body 없음 — 무시")
            return
        }

        Log.d("CRM_SCHED", "알람 수신: jobId=$jobId phone=$phone")

        val pending = goAsync()
        Thread {
            try {
                val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    context.getSystemService(SmsManager::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    SmsManager.getDefault()
                }
                val parts = smsManager.divideMessage(body)
                if (parts.size == 1) {
                    smsManager.sendTextMessage(phone, null, body, null, null)
                } else {
                    smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
                }
                Log.d("CRM_SCHED", "예약 문자 발송 성공: jobId=$jobId")
            } catch (e: Exception) {
                Log.e("CRM_SCHED", "예약 문자 발송 실패: ${e.message}")
            } finally {
                SmsSchedulerHelper.removeJob(context, jobId)
                pending.finish()
            }
        }.start()
    }
}
