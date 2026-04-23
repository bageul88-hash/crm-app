import { useEffect, useState, useCallback } from 'react'

// Capacitor는 네이티브 앱에서만 동작 — 웹 브라우저에서는 null 유지
let CallPlugin = null

async function getCallPlugin() {
  if (CallPlugin) return CallPlugin

  try {
    const { registerPlugin } = await import('@capacitor/core')
    CallPlugin = registerPlugin('CallPlugin')
    return CallPlugin
  } catch (error) {
    console.warn('CallPlugin 로드 실패:', error)
    return null
  }
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
  const [isNative, setIsNative] = useState(false)

  const requestPermission = useCallback(async () => {
    const plugin = await getCallPlugin()

    if (!plugin) {
      setIsNative(false)
      setPermitted(false)
      return false
    }

    setIsNative(true)

    try {
      const result = await plugin.requestPermissions()
      const granted = Object.values(result).every(value => value === 'granted')
      setPermitted(granted)
      return granted
    } catch (error) {
      console.warn('권한 요청 실패:', error)
      setPermitted(false)
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let removeListener = null

    const init = async () => {
      const plugin = await getCallPlugin()

      if (!plugin) {
        if (!cancelled) {
          setIsNative(false)
          setPermitted(false)
        }
        return
      }

      if (!cancelled) {
        setIsNative(true)
      }

      try {
        const result = await plugin.checkPermissions()
        const granted = Object.values(result).every(value => value === 'granted')

        if (cancelled) return

        setPermitted(granted)

        if (!granted) return
      } catch (error) {
        console.warn('권한 확인 실패:', error)
        if (!cancelled) {
          setPermitted(false)
        }
        return
      }

      try {
        await plugin.startListening()

        const handle = await plugin.addListener('callEnded', data => {
          if (cancelled) return

          setLastCall({
            phone: data?.phone || '',
            duration: data?.duration || 0,
            endedAt: data?.endedAt || Date.now(),
          })
        })

        removeListener = async () => {
          try {
            await handle.remove()
          } catch (error) {
            console.warn('리스너 제거 실패:', error)
          }

          try {
            await plugin.stopListening()
          } catch (error) {
            console.warn('통화 감지 중지 실패:', error)
          }
        }
      } catch (error) {
        console.warn('통화 감지 초기화 실패:', error)
      }
    }

    init()

    return () => {
      cancelled = true

      if (removeListener) {
        removeListener()
      }
    }
  }, [])

  const clearLastCall = useCallback(() => {
    setLastCall(null)
  }, [])

  return {
    lastCall,
    isNative,
    permitted,
    requestPermission,
    clearLastCall,
  }
}