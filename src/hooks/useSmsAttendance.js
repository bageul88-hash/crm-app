import { useEffect } from 'react'
import { registerPlugin } from '@capacitor/core'

// isNativePlatform() 체크 제거 — 브릿지 초기화 타이밍 이슈 방지
// 플러그인 호출 실패 시 catch에서 빈값 반환
const SmsPlugin = registerPlugin('SmsPlugin')

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
