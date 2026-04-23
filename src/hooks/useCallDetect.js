import { useEffect, useState, useCallback } from 'react'

// Capacitor는 네이티브 앱에서만 동작 — 웹 브라우저에서는 무시
let CallPlugin = null
try {
  // 동적 import: 웹에서 빌드 오류 방지
  const { registerPlugin } = await import('@capacitor/core')
  CallPlugin = registerPlugin('CallPlugin')
} catch {
  // 웹 환경이거나 Capacitor 미설치 시 무시
}

/**
 * useCallDetect
 *
 * 통화 종료 시 자동으로 React 상태를 업데이트하는 훅
 *
 * 반환값:
 *   lastCall  — { phone, duration, endedAt } | null
 *   isNative  — 네이티브 앱 환경인지 여부
 *   permitted — 권한 허용 여부
 *   requestPermission — 권한 요청 함수
 *   clearLastCall — 마지막 통화 정보 초기화
 */
export function useCallDetect() {
  const [lastCall, setLastCall] = useState(null)
  const [permitted, setPermitted] = useState(false)
  const isNative = Boolean(CallPlugin)

  // 권한 요청
  const requestPermission = useCallback(async () => {
    if (!CallPlugin) return false
    try {
      const result = await CallPlugin.requestPermissions()
      const granted = Object.values(result).every(v => v === 'granted')
      setPermitted(granted)
      return granted
    } catch (e) {
      console.warn('권한 요청 실패:', e)
      return false
    }
  }, [])

  useEffect(() => {
    if (!CallPlugin) return

    let cleanup = () => {}

    const init = async () => {
      // 권한 확인
      try {
        const result = await CallPlugin.checkPermissions()
        const granted = Object.values(result).every(v => v === 'granted')
        setPermitted(granted)
        if (!granted) return
      } catch {
        return
      }

      // 통화 감지 시작
      await CallPlugin.startListening()

      // 통화 종료 이벤트 구독
      const { PluginListenerHandle } = await import('@capacitor/core')
      const handle = await CallPlugin.addListener('callEnded', (data) => {
        setLastCall({
          phone: data.phone || '',
          duration: data.duration || 0,
          endedAt: data.endedAt || Date.now(),
        })
      })

      cleanup = () => {
        handle.remove()
        CallPlugin.stopListening()
      }
    }

    init()
    return () => cleanup()
  }, [permitted])

  const clearLastCall = useCallback(() => setLastCall(null), [])

  return { lastCall, isNative, permitted, requestPermission, clearLastCall }
}
