package com.pentwo.crmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class SmsBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Log.d("CRM_SCHED", "부팅 완료 — 예약 알람 복구 시작")

        val now = System.currentTimeMillis()
        val jobs = SmsSchedulerHelper.getJobs(context)
        for (job in jobs) {
            if (job.triggerAtMillis > now) {
                SmsSchedulerHelper.scheduleAlarm(context, job)
                Log.d("CRM_SCHED", "알람 복구: ${job.jobId}")
            } else {
                SmsSchedulerHelper.removeJob(context, job.jobId)
                Log.d("CRM_SCHED", "만료 알람 제거: ${job.jobId}")
            }
        }
    }
}
