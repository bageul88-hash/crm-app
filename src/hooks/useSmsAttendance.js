import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

const SmsPlugin = registerPlugin('SmsPlugin')

export function useSmsAttendance(onStudentArrival) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let handle
    SmsPlugin.addListener('smsAttendance', ({ studentName }) => {
      onStudentArrival?.(studentName)
    }).then(h => { handle = h })

    return () => { handle?.remove() }
  }, [onStudentArrival])
}
