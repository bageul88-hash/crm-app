package com.pentwo.crmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.provider.Telephony
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "SmsPlugin")
class SmsPlugin : Plugin() {

    private var smsReceiver: BroadcastReceiver? = null

    override fun load() {
        registerSmsReceiver()
    }

    @PluginMethod
    fun ping(call: PluginCall) {
        call.resolve()
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

                val data = JSObject()
                data.put("studentName", studentName)
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

    // [참바른글씨] 학생이름 학생이 등원하였습니다.
    private fun parseStudentName(body: String): String? {
        val regex = Regex("""\[참바른글씨\]\s*(.+?)\s+학생이\s+등원하였습니다""")
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
