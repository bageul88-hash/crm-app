package com.pentwo.crmapp

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@CapacitorPlugin(
    name = "SmsPlugin",
    permissions = [
        Permission(strings = [Manifest.permission.READ_SMS],     alias = "readSms"),
        Permission(strings = [Manifest.permission.RECEIVE_SMS],  alias = "receiveSms")
    ]
)
class SmsPlugin : Plugin() {

    private var smsReceiver: BroadcastReceiver? = null

    override fun load() {
        registerSmsReceiver()
    }

    @PluginMethod
    fun ping(call: PluginCall) {
        call.resolve()
    }

    // 현재 SMS 권한 상태 확인
    @PluginMethod
    fun checkSmsPermission(call: PluginCall) {
        val granted = getPermissionState("readSms") == PermissionState.GRANTED
        Log.d("CRM_SMS", "checkSmsPermission: $granted")
        val ret = JSObject()
        ret.put("granted", granted)
        call.resolve(ret)
    }

    // Android 시스템 권한 요청 다이얼로그 표시
    @PluginMethod
    fun requestSmsPermission(call: PluginCall) {
        Log.d("CRM_SMS", "requestSmsPermission 호출")
        if (getPermissionState("readSms") == PermissionState.GRANTED) {
            Log.d("CRM_SMS", "이미 권한 있음")
            val ret = JSObject()
            ret.put("granted", true)
            call.resolve(ret)
            return
        }
        requestPermissionForAlias("readSms", call, "smsPermissionCallback")
    }

    @PermissionCallback
    private fun smsPermissionCallback(call: PluginCall) {
        val granted = getPermissionState("readSms") == PermissionState.GRANTED
        Log.d("CRM_SMS", "권한 요청 결과: $granted")
        val ret = JSObject()
        ret.put("granted", granted)
        call.resolve(ret)
    }

    @PluginMethod
    fun readSmsHistory(call: PluginCall) {
        val limit = call.getInt("limit", 500) ?: 500
        val results = JSArray()

        try {
            val cursor = context.contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("_id", "body", "date"),
                "body LIKE ?",
                arrayOf("%참바른글씨%"),
                "date DESC"
            )

            var count = 0
            cursor?.use {
                val bodyIdx = it.getColumnIndex("body")
                val dateIdx = it.getColumnIndex("date")

                while (it.moveToNext() && count < limit) {
                    val body      = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""
                    val timestamp = if (dateIdx >= 0) it.getLong(dateIdx) else 0L

                    val studentName = parseStudentName(body) ?: continue
                    val smsDate = Date(timestamp)
                    val dateStr = SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(smsDate)
                    val timeStr = SimpleDateFormat("HH:mm",    Locale.getDefault()).format(smsDate)

                    val item = JSObject()
                    item.put("studentName", studentName)
                    item.put("date", dateStr)
                    item.put("time", timeStr)
                    results.put(item)
                    count++
                }
            }
            Log.d("CRM_SMS", "SMS 이력 읽기 완료: ${results.length()}건")
        } catch (e: Exception) {
            Log.e("CRM_SMS", "SMS 이력 읽기 오류: ${e.message}")
        }

        val ret = JSObject()
        ret.put("items", results)
        call.resolve(ret)
    }

    private fun registerSmsReceiver() {
        smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                    ?: return

                val fullBody = messages.joinToString("") { it?.messageBody ?: "" }
                Log.d("CRM_SMS", "수신 SMS: $fullBody")

                val studentName = parseStudentName(fullBody) ?: return
                Log.d("CRM_SMS", "등원 학생 감지: $studentName")

                val timeStr = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

                val data = JSObject()
                data.put("studentName", studentName)
                data.put("time", timeStr)
                notifyListeners("smsAttendance", data)
            }
        }

        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION).apply {
            priority = 999
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(smsReceiver, filter)
        }

        Log.d("CRM_SMS", "SMS 수신 리스너 등록 완료")
    }

    // [참바른글씨] OOO 학생이 등원하였습니다.
    private fun parseStudentName(body: String): String? {
        val regex = Regex("""\[참바른글씨\]\s+(.+?)\s+학생이\s+등원하였습니다""")
        return regex.find(body)?.groupValues?.getOrNull(1)?.trim()
    }

    override fun handleOnDestroy() {
        try {
            smsReceiver?.let { context.unregisterReceiver(it) }
        } catch (_: Exception) {}
        smsReceiver = null
        Log.d("CRM_SMS", "SMS 수신 리스너 해제")
    }
}
