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

    @PluginMethod
    fun checkSmsPermission(call: PluginCall) {
        val granted = getPermissionState("readSms") == PermissionState.GRANTED
        Log.d("CRM_SMS", "checkSmsPermission: $granted")
        val ret = JSObject()
        ret.put("granted", granted)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestSmsPermission(call: PluginCall) {
        Log.d("CRM_SMS", "requestSmsPermission 호출")
        if (getPermissionState("readSms") == PermissionState.GRANTED) {
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
        var totalScanned = 0
        var keywordMatched = 0

        try {
            // SQL LIKE 한글 필터 대신 전체 inbox를 읽고 Kotlin에서 필터링
            // (일부 기기에서 한글 LIKE 쿼리가 동작하지 않는 문제 방지)
            val cursor = context.contentResolver.query(
                Uri.parse("content://sms"),
                arrayOf("_id", "body", "date"),
                null,
                null,
                "date DESC"
            )

            cursor?.use {
                val bodyIdx = it.getColumnIndex("body")
                val dateIdx = it.getColumnIndex("date")

                while (it.moveToNext() && results.length() < limit) {
                    totalScanned++
                    val body      = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""
                    val timestamp = if (dateIdx >= 0) it.getLong(dateIdx) else 0L

                    // Kotlin contains()로 필터 (SQL LIKE 인코딩 이슈 회피)
                    if (!body.contains("참바른글씨")) continue
                    keywordMatched++

                    val studentName = parseStudentName(body)
                    if (studentName == null) {
                        Log.w("CRM_SMS", "파싱실패: ${body.take(100)}")
                        continue
                    }

                    val smsDate = Date(timestamp)
                    val dateStr = SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(smsDate)
                    val timeStr = SimpleDateFormat("HH:mm",    Locale.getDefault()).format(smsDate)

                    val item = JSObject()
                    item.put("studentName", studentName)
                    item.put("date", dateStr)
                    item.put("time", timeStr)
                    results.put(item)
                }
            }

            Log.d("CRM_SMS", "완료: 스캔=${totalScanned} 키워드=${keywordMatched} 파싱=${results.length()}")
        } catch (e: Exception) {
            Log.e("CRM_SMS", "SMS 읽기 오류", e)
        }

        val ret = JSObject()
        ret.put("items", results)
        ret.put("debug_scanned", totalScanned)
        ret.put("debug_matched", keywordMatched)
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

    // "[참바른글씨] OOO 학생이 등원하였습니다" 패턴에서 이름 추출
    // \s*학생이 : 이름과 "학생이" 사이 공백 0개 이상 허용 (공백 없는 경우 포함)
    private fun parseStudentName(body: String): String? {
        val regex = Regex(
            """\[참바른글씨\]\s*(.+?)\s*학생이""",
            RegexOption.DOT_MATCHES_ALL
        )
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
