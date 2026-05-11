package com.pentwo.crmapp

import android.content.Context
import android.provider.CallLog
import android.util.Log

object CallLogReader {

    private const val TAG = "CallLogReader"

    /**
     * 가장 최근 통화 기록에서 전화번호를 반환합니다.
     * 권한이 없거나 기록이 없으면 null을 반환합니다.
     */
    fun getLatestCallNumber(context: Context): String? {
        return try {
            val cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.TYPE),
                null,
                null,
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                if (it.moveToFirst()) {
                    val numberIndex = it.getColumnIndex(CallLog.Calls.NUMBER)
                    val typeIndex = it.getColumnIndex(CallLog.Calls.TYPE)

                    val number = if (numberIndex >= 0) it.getString(numberIndex) else null
                    val type = if (typeIndex >= 0) it.getInt(typeIndex) else -1

                    // 발신(OUTGOING) 또는 수신(INCOMING) 통화만 처리
                    if (type == CallLog.Calls.OUTGOING_TYPE || type == CallLog.Calls.INCOMING_TYPE) {
                        normalizePhoneNumber(number)
                    } else {
                        null
                    }
                } else {
                    null
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "READ_CALL_LOG 권한이 없습니다.", e)
            null
        } catch (e: Exception) {
            Log.e(TAG, "통화 기록 조회 중 오류 발생", e)
            null
        }
    }

    /**
     * 전화번호를 정규화합니다.
     * 예) +82-10-1234-5678 → 01012345678
     */
    private fun normalizePhoneNumber(number: String?): String? {
        if (number.isNullOrBlank()) return null

        var normalized = number.replace(Regex("[\\s\\-\\(\\)]"), "")

        // 국제번호 +82 → 0 으로 변환 (한국 번호 처리)
        if (normalized.startsWith("+82")) {
            normalized = "0" + normalized.removePrefix("+82")
        }

        // 숫자만 남기기
        normalized = normalized.filter { it.isDigit() }

        return normalized.ifBlank { null }
    }
}
