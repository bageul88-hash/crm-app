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
