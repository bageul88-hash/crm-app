import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

export function useSmsAttendance(onStudentArrival) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const SmsPlugin = registerPlugin('SmsPlugin')
    let handle
    SmsPlugin.addListener('smsAttendance', ({ studentName }) => {
      onStudentArrival?.(studentName)
    }).then(h => { handle = h })

    return () => { handle?.remove() }
  }, [onStudentArrival])
}

export async function checkSmsPermission() {
  if (!Capacitor.isNativePlatform()) return true
  try {
    const SmsPlugin = registerPlugin('SmsPlugin')
    const { granted } = await SmsPlugin.checkSmsPermission()
    return granted
  } catch {
    return false
  }
}

export async function readSmsHistory() {
  if (!Capacitor.isNativePlatform()) return []
  try {
    const SmsPlugin = registerPlugin('SmsPlugin')
    const result = await SmsPlugin.readSmsHistory({ limit: 500 })
    return result.items || []
  } catch (e) {
    console.log('SMS 이력 읽기 실패: ' + e)
    return []
  }
}
