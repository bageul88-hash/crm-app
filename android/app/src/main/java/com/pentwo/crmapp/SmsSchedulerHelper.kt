package com.pentwo.crmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

object SmsSchedulerHelper {

    private const val PREFS_NAME = "crm_sms_scheduler"
    private const val JOBS_KEY   = "jobs"

    data class Job(
        val jobId: String,
        val phone: String,
        val body: String,
        val triggerAtMillis: Long
    )

    fun getJobs(context: Context): List<Job> {
        val json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(JOBS_KEY, "[]") ?: "[]"
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.getJSONObject(i)
                Job(
                    jobId           = o.getString("jobId"),
                    phone           = o.getString("phone"),
                    body            = o.getString("body"),
                    triggerAtMillis = o.getLong("triggerAtMillis")
                )
            }
        } catch (e: Exception) {
            Log.e("CRM_SCHED", "jobs 파싱 오류: ${e.message}")
            emptyList()
        }
    }

    fun addJob(context: Context, job: Job) {
        val jobs = getJobs(context).toMutableList()
        jobs.removeAll { it.jobId == job.jobId }
        jobs.add(job)
        saveJobs(context, jobs)
    }

    fun removeJob(context: Context, jobId: String) {
        val jobs = getJobs(context).toMutableList()
        if (jobs.removeAll { it.jobId == jobId }) saveJobs(context, jobs)
    }

    private fun saveJobs(context: Context, jobs: List<Job>) {
        val arr = JSONArray()
        jobs.forEach { job ->
            arr.put(JSONObject().apply {
                put("jobId",           job.jobId)
                put("phone",           job.phone)
                put("body",            job.body)
                put("triggerAtMillis", job.triggerAtMillis)
            })
        }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(JOBS_KEY, arr.toString()).apply()
    }

    fun scheduleAlarm(context: Context, job: Job) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = buildPendingIntent(context, job)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, job.triggerAtMillis, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, job.triggerAtMillis, pi)
                Log.w("CRM_SCHED", "SCHEDULE_EXACT_ALARM 미허용 비정확 알람 사용: ${job.jobId}")
            }
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, job.triggerAtMillis, pi)
        }
        Log.d("CRM_SCHED", "알람 등록: ${job.jobId} triggerAt=${job.triggerAtMillis}")
    }

    fun cancelAlarm(context: Context, jobId: String) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, SmsSchedulerReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            context, jobId.hashCode(), intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        pi?.let { am.cancel(it) }
        Log.d("CRM_SCHED", "알람 취소: $jobId")
    }

    fun canScheduleExactAlarms(context: Context): Boolean {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.canScheduleExactAlarms() else true
    }

    private fun buildPendingIntent(context: Context, job: Job): PendingIntent {
        val intent = Intent(context, SmsSchedulerReceiver::class.java).apply {
            action = "com.pentwo.crmapp.SMS_SCHEDULE"
            putExtra("jobId", job.jobId)
            putExtra("phone", job.phone)
            putExtra("body",  job.body)
        }
        return PendingIntent.getBroadcast(
            context, job.jobId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
