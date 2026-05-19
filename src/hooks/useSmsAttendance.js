import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

export function useSmsAttendance(onStudentArrival) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const SmsPlugin = registerPlugin('SmsPlugin')
    let handle
    SmsPlugin.addListener('smsAttendance', ({ studentName, time }) => {
      console.log('[SMS수신] 등원 감지:', studentName, time)
      onStudentArrival?.(studentName, time)
    }).then(h => { handle = h })

    return () => { handle?.remove() }
  }, [onStudentArrival])
}

// 현재 권한 상태 확인
export async function checkSmsPermission() {
  console.log('[SMS] checkSmsPermission - isNative:', Capacitor.isNativePlatform())
  if (!Capacitor.isNativePlatform()) return true
  try {
    const SmsPlugin = registerPlugin('SmsPlugin')
    const result = await SmsPlugin.checkSmsPermission()
    console.log('[SMS] 권한 상태:', result)
    return result.granted === true
  } catch (e) {
    console.error('[SMS] checkSmsPermission 오류:', e)
    return false
  }
}

// Android 시스템 권한 요청 다이얼로그 표시
export async function requestSmsPermission() {
  console.log('[SMS] requestSmsPermission - isNative:', Capacitor.isNativePlatform())
  if (!Capacitor.isNativePlatform()) return true
  try {
    const SmsPlugin = registerPlugin('SmsPlugin')
    const result = await SmsPlugin.requestSmsPermission()
    console.log('[SMS] 권한 요청 결과:', result)
    return result.granted === true
  } catch (e) {
    console.error('[SMS] requestSmsPermission 오류:', e)
    return false
  }
}

// SMS 이력 읽기
export async function readSmsHistory() {
  console.log('[SMS] readSmsHistory - isNative:', Capacitor.isNativePlatform())
  if (!Capacitor.isNativePlatform()) return []
  try {
    const SmsPlugin = registerPlugin('SmsPlugin')
    console.log('[SMS] readSmsHistory 호출 (limit: 500)')
    const result = await SmsPlugin.readSmsHistory({ limit: 500 })
    console.log('[SMS] 결과:', result?.items?.length ?? 0, '건', result?.items?.slice(0, 3))
    return result.items || []
  } catch (e) {
    console.error('[SMS] readSmsHistory 오류:', e)
    return []
  }
}
