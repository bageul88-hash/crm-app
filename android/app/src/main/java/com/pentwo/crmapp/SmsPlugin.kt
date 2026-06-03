package com.pentwo.crmapp

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.provider.Telephony
import androidx.core.content.ContextCompat
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
    private var mmsObserver: ContentObserver? = null
    private var lastMmsId: String? = null

    override fun load() {
        registerSmsReceiver()
        initLastMmsId()
        registerMmsObserver()
    }

    @PluginMethod
    fun ping(call: PluginCall) {
        call.resolve()
    }

    @PluginMethod
    fun checkSmsPermission(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
        Log.d("CRM_SMS", "checkSmsPermission: $granted")
        val ret = JSObject()
        ret.put("granted", granted)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestSmsPermission(call: PluginCall) {
        Log.d("CRM_SMS", "requestSmsPermission 호출")
        val alreadyGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
        if (alreadyGranted) {
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
    fun openAppSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", activity.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        call.resolve()
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

    @PluginMethod
    fun readMmsHistory(call: PluginCall) {
        val limit = call.getInt("limit", 2000) ?: 2000
        val results = JSArray()
        try {
            val cursor = context.contentResolver.query(
                Uri.parse("content://mms/inbox"),
                arrayOf("_id", "date"),
                null, null,
                "date DESC"
            )
            cursor?.use { mc ->
                val idIdx   = mc.getColumnIndex("_id")
                val dateIdx = mc.getColumnIndex("date")
                while (mc.moveToNext() && results.length() < limit) {
                    val mmsId       = if (idIdx   >= 0) mc.getString(idIdx) ?: "" else ""
                    val dateSec     = if (dateIdx >= 0) mc.getLong(dateIdx)   else 0L
                    if (mmsId.isEmpty()) continue
                    if (!hasImagePart(mmsId)) continue
                    val phone = getMmsSender(mmsId)
                    if (phone.isEmpty()) continue
                    val item = JSObject()
                    item.put("phone", phone)
                    item.put("date", dateSec * 1000L) // seconds → milliseconds
                    results.put(item)
                }
            }
            Log.d("CRM_SMS", "MMS 이미지 발신자: ${results.length()}건")
        } catch (e: Exception) {
            Log.e("CRM_SMS", "MMS 읽기 오류", e)
        }
        val ret = JSObject()
        ret.put("items", results)
        call.resolve(ret)
    }

    private fun hasImagePart(mmsId: String): Boolean {
        return try {
            val cursor = context.contentResolver.query(
                Uri.parse("content://mms/part"),
                arrayOf("ct"),
                "mid = ?",
                arrayOf(mmsId),
                null
            )
            cursor?.use {
                val ctIdx = it.getColumnIndex("ct")
                while (it.moveToNext()) {
                    val ct = if (ctIdx >= 0) it.getString(ctIdx) ?: "" else ""
                    if (ct.startsWith("image/")) return true
                }
            }
            false
        } catch (_: Exception) { false }
    }

    private fun getMmsSender(mmsId: String): String {
        return try {
            val cursor = context.contentResolver.query(
                Uri.parse("content://mms/$mmsId/addr"),
                arrayOf("address", "type"),
                "type = 137", // PduHeaders.FROM
                null, null
            )
            cursor?.use {
                val addrIdx = it.getColumnIndex("address")
                if (it.moveToFirst() && addrIdx >= 0) {
                    val addr = it.getString(addrIdx) ?: ""
                    if (addr != "insert-address-token") addr else ""
                } else ""
            } ?: ""
        } catch (_: Exception) { "" }
    }

    private fun initLastMmsId() {
        try {
            val cursor = context.contentResolver.query(
                Uri.parse("content://mms/inbox"),
                arrayOf("_id"), null, null, "_id DESC"
            )
            cursor?.use { if (it.moveToFirst()) lastMmsId = it.getString(0) }
        } catch (e: Exception) {
            Log.w("CRM_SMS", "MMS 초기화 오류: ${e.message}")
        }
    }

    private fun registerMmsObserver() {
        val handler = Handler(Looper.getMainLooper())
        mmsObserver = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean) { checkNewMms() }
        }
        context.contentResolver.registerContentObserver(
            Uri.parse("content://mms"), true, mmsObserver!!
        )
        Log.d("CRM_SMS", "MMS 수신 감시 등록 완료")
    }

    private fun checkNewMms() {
        try {
            val cursor = context.contentResolver.query(
                Uri.parse("content://mms/inbox"),
                arrayOf("_id"), null, null, "_id DESC"
            )
            cursor?.use {
                val idIdx = it.getColumnIndex("_id")
                if (!it.moveToFirst() || idIdx < 0) return
                val newId = it.getString(idIdx)
                if (newId == lastMmsId) return
                lastMmsId = newId
                if (!hasImagePart(newId)) return
                val phone = getMmsSender(newId)
                if (phone.isEmpty()) return
                Log.d("CRM_SMS", "새 MMS 이미지 수신: $phone")
                val data = JSObject()
                data.put("phone", phone)
                notifyListeners("mmsReceived", data)
            }
        } catch (e: Exception) {
            Log.e("CRM_SMS", "MMS 체크 오류: ${e.message}")
        }
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

    // [참바른글씨] 발신 문자에서 학생 이름으로 전화번호 추출
    // sent → inbox → all 순서로 검색해서 가장 먼저 찾은 번호 반환
    @PluginMethod
    fun searchPhoneByStudentName(call: PluginCall) {
        val name = call.getString("name") ?: run {
            call.reject("name is required")
            return
        }

        val ret = JSObject()
        val foundPhone = searchSmsForPhone(name, "content://sms/sent")
            ?: searchSmsForPhone(name, "content://sms/inbox")
            ?: searchSmsForPhone(name, "content://sms")
            ?: ""

        Log.d("CRM_SMS", "searchPhoneByStudentName($name) → \"$foundPhone\"")
        ret.put("phone", foundPhone)
        ret.put("found", foundPhone.isNotEmpty())
        call.resolve(ret)
    }

    private fun searchSmsForPhone(name: String, uri: String): String? {
        return try {
            val cursor = context.contentResolver.query(
                android.net.Uri.parse(uri),
                arrayOf("address", "body"),
                null, null,
                "date DESC"
            )
            cursor?.use {
                val addrIdx = it.getColumnIndex("address")
                val bodyIdx = it.getColumnIndex("body")
                while (it.moveToNext()) {
                    val body    = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""
                    val address = if (addrIdx >= 0) it.getString(addrIdx) ?: "" else ""
                    if (body.contains("[참바른글씨]") && body.contains(name)) {
                        val cleaned = address.replace(Regex("[^0-9]"), "")
                        if (cleaned.length >= 9) {
                            return@use if (cleaned.startsWith("82") && cleaned.length == 12)
                                "0" + cleaned.substring(2)
                            else cleaned
                        }
                    }
                }
                null
            }
        } catch (e: Exception) {
            Log.w("CRM_SMS", "searchSmsForPhone($uri) 오류: ${e.message}")
            null
        }
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
        try { smsReceiver?.let { context.unregisterReceiver(it) } } catch (_: Exception) {}
        smsReceiver = null
        mmsObserver?.let { context.contentResolver.unregisterContentObserver(it) }
        mmsObserver = null
        Log.d("CRM_SMS", "SMS/MMS 리스너 해제")
    }
}
