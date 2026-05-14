package com.pentwo.crmapp

import android.Manifest
import android.content.ContentProviderOperation
import android.content.ContentUris
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ContactsPlugin")
class ContactsPlugin : Plugin() {

    @PluginMethod
    fun saveContact(call: PluginCall) {
        val hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        val hasWrite = ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CONTACTS) == PackageManager.PERMISSION_GRANTED
        if (!hasRead || !hasWrite) {
            call.reject("연락처 권한이 없습니다")
            return
        }

        val phone = call.getString("phone") ?: run { call.reject("phone required"); return }
        val name  = call.getString("name") ?: ""
        val memo  = call.getString("memo") ?: ""

        try {
            val contactId = findContactIdByPhone(phone)
            val result = JSObject()

            if (contactId != null) {
                updateNote(contactId, memo)
                result.put("action", "updated")
                result.put("contactId", contactId)
                Log.d("CRM_CONTACTS", "연락처 메모 업데이트: $contactId")
            } else {
                val newId = createContact(name.ifBlank { phone }, phone, memo)
                result.put("action", "created")
                result.put("contactId", newId)
                Log.d("CRM_CONTACTS", "새 연락처 생성: $newId")
            }

            call.resolve(result)
        } catch (e: Exception) {
            Log.e("CRM_CONTACTS", "saveContact 오류", e)
            call.reject("연락처 저장 실패: ${e.message}")
        }
    }

    private fun findContactIdByPhone(phone: String): Long? {
        val clean = phone.replace(Regex("[^0-9]"), "")
        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(clean)
        )
        context.contentResolver.query(
            uri, arrayOf(ContactsContract.PhoneLookup._ID), null, null, null
        )?.use { cur ->
            if (cur.moveToFirst())
                return cur.getLong(cur.getColumnIndexOrThrow(ContactsContract.PhoneLookup._ID))
        }
        return null
    }

    private fun updateNote(contactId: Long, note: String) {
        val ops = ArrayList<ContentProviderOperation>()

        val noteExists = context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(ContactsContract.Data._ID),
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
            arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE),
            null
        )?.use { it.moveToFirst() } ?: false

        if (noteExists) {
            ops.add(
                ContentProviderOperation.newUpdate(ContactsContract.Data.CONTENT_URI)
                    .withSelection(
                        "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
                        arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)
                    )
                    .withValue(ContactsContract.CommonDataKinds.Note.NOTE, note)
                    .build()
            )
        } else {
            val rawId = context.contentResolver.query(
                ContactsContract.RawContacts.CONTENT_URI,
                arrayOf(ContactsContract.RawContacts._ID),
                "${ContactsContract.RawContacts.CONTACT_ID} = ?",
                arrayOf(contactId.toString()), null
            )?.use { cur ->
                if (cur.moveToFirst()) cur.getLong(cur.getColumnIndexOrThrow(ContactsContract.RawContacts._ID)) else null
            }

            if (rawId != null) {
                ops.add(
                    ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                        .withValue(ContactsContract.Data.RAW_CONTACT_ID, rawId)
                        .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)
                        .withValue(ContactsContract.CommonDataKinds.Note.NOTE, note)
                        .build()
                )
            }
        }

        if (ops.isNotEmpty()) context.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
    }

    private fun createContact(name: String, phone: String, note: String): Long {
        val ops = ArrayList<ContentProviderOperation>()

        ops.add(
            ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
                .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
                .build()
        )
        ops.add(
            ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name)
                .build()
        )
        ops.add(
            ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phone)
                .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
                .build()
        )
        if (note.isNotBlank()) {
            ops.add(
                ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Note.NOTE, note)
                    .build()
            )
        }

        val results = context.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
        val rawUri  = results[0].uri ?: return -1
        val rawId   = ContentUris.parseId(rawUri)

        return context.contentResolver.query(
            ContactsContract.RawContacts.CONTENT_URI,
            arrayOf(ContactsContract.RawContacts.CONTACT_ID),
            "${ContactsContract.RawContacts._ID} = ?",
            arrayOf(rawId.toString()), null
        )?.use { cur ->
            if (cur.moveToFirst()) cur.getLong(cur.getColumnIndexOrThrow(ContactsContract.RawContacts.CONTACT_ID)) else -1
        } ?: -1
    }
}
