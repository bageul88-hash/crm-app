import { useEffect, useCallback } from 'react'
import { registerPlugin } from '@capacitor/core'

const SmsPlugin = registerPlugin('SmsPlugin')

export function normalizeMmsPhone(raw) {
  const cleaned = String(raw || '').replace(/[^0-9]/g, '')
  if (cleaned.startsWith('82') && cleaned.length === 12) return '0' + cleaned.slice(2)
  if (cleaned.length === 10 && cleaned[0] !== '0') return '0' + cleaned
  return cleaned
}

export function useMmsReceived(onMmsReceived) {
  const stable = useCallback(onMmsReceived, [onMmsReceived])
  useEffect(() => {
    let handle
    SmsPlugin.addListener('mmsReceived', ({ phone }) => {
      console.log('[MMS] 이미지 수신:', phone)
      stable?.(phone)
    }).then(h => { handle = h }).catch(() => {})
    return () => { handle?.remove() }
  }, [stable])
}

export function useSmsAttendance(onStudentArrival) {
  useEffect(() => {
    let handle
    SmsPlugin.addListener('smsAttendance', ({ studentName, time }) => {
      console.log('[SMS수신] 등원 감지:', studentName, time)
      onStudentArrival?.(studentName, time)
    }).then(h => { handle = h }).catch(() => {})

    return () => { handle?.remove() }
  }, [onStudentArrival])
}

export async function checkSmsPermission() {
  try {
    const result = await SmsPlugin.checkSmsPermission()
    console.log('[SMS] 권한 상태:', result)
    return result.granted === true
  } catch (e) {
    console.warn('[SMS] checkSmsPermission 실패 (웹 환경이거나 플러그인 미등록):', e?.message)
    return false
  }
}

export async function requestSmsPermission() {
  try {
    const result = await SmsPlugin.requestSmsPermission()
    console.log('[SMS] 권한 요청 결과:', result)
    return result.granted === true
  } catch (e) {
    console.warn('[SMS] requestSmsPermission 실패:', e?.message)
    return false
  }
}

export async function openSmsSettings() {
  try {
    await SmsPlugin.openAppSettings()
  } catch (e) {
    console.warn('[SMS] openAppSettings 실패:', e?.message)
  }
}

export async function readMmsHistory(limit = 2000) {
  try {
    const result = await SmsPlugin.readMmsHistory({ limit })
    const items = result.items || []
    console.log(`[MMS] 이미지 발신자: ${items.length}건`)
    return { items }
  } catch (e) {
    console.warn('[MMS] readMmsHistory 오류:', e?.message)
    return { items: [] }
  }
}

export async function readSmsHistory(limit = 5000) {
  try {
    console.log(`[SMS] readSmsHistory 호출 (limit: ${limit})`)
    const result = await SmsPlugin.readSmsHistory({ limit })
    const items = result.items || []
    const scanned = result.debug_scanned ?? 0
    const matched = result.debug_matched ?? 0
    console.log(`[SMS] 완료: 스캔=${scanned} 키워드=${matched} 파싱=${items.length}건`)
    return { items, scanned, matched }
  } catch (e) {
    console.error('[SMS] readSmsHistory 오류:', e)
    return { items: [], scanned: 0, matched: 0 }
  }
}
