import { useEffect, useRef } from 'react'
import { ref, get, onChildAdded } from 'firebase/database'
import { registerPlugin } from '@capacitor/core'
import { db } from '../firebase'

const SmsPlugin = registerPlugin('SmsPlugin')

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환
function todayHyphen() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

// 이미 발송한 출석 ID를 localStorage에서 불러오기 (오늘 날짜 키로 격리)
function loadSentIds(dateStr) {
  try {
    const raw = localStorage.getItem(`attendance_sms_sent_${dateStr}`)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function saveSentIds(dateStr, set) {
  try {
    localStorage.setItem(`attendance_sms_sent_${dateStr}`, JSON.stringify([...set]))
  } catch {}
}

/**
 * Firebase attendance/branch_pentwo/{YYYY-MM-DD} 경로를 실시간으로 감시하여
 * 앱 시작 이후 새로 추가된 출석에 한해 부모님께 자동 문자를 발송합니다.
 *
 * 조건:
 * - parentPhone 값이 있는 출석만 발송
 * - 같은 출석 ID는 단 1회만 발송 (localStorage 기반 중복 방지)
 * - 앱 시작 전 존재하던 데이터는 발송하지 않음
 */
export function useFirebaseAttendanceListener() {
  const dateStr = todayHyphen()
  const sentRef = useRef(loadSentIds(dateStr))
  const unsubRef = useRef(null)

  useEffect(() => {
    // SEND_SMS 런타임 권한 요청 (Android 6+ 필수 — 실패해도 리스너는 계속 등록)
    SmsPlugin.requestSendSmsPermission()
      .then(r => console.log('[AutoSMS] SEND_SMS 권한:', r?.granted))
      .catch(() => {})

    const attendancePath = `attendance/branch_pentwo/${dateStr}`
    const attendanceRef  = ref(db, attendancePath)

    // Step 1: 앱 시작 시점의 기존 출석 ID 집합을 먼저 수집
    get(attendanceRef).then(snapshot => {
      const existingIds = new Set()
      if (snapshot.exists()) {
        snapshot.forEach(child => existingIds.add(child.key))
      }

      // Step 2: child_added 리스너 등록 — 기존 ID는 건너뜀
      unsubRef.current = onChildAdded(attendanceRef, childSnap => {
        const id   = childSnap.key
        const data = childSnap.val() || {}

        // 앱 시작 전부터 있던 데이터 → 무시
        if (existingIds.has(id)) return

        // 이미 발송한 항목 → 무시 (중복 방지)
        if (sentRef.current.has(id)) return

        // 공기계는 'name' 필드로 저장, CRM 자체 저장은 'studentName' — 둘 다 지원
        const studentName = data.name || data.studentName
        const { parentPhone, time } = data

        if (!studentName) return

        // AttendancePage 오늘 출석 현황 실시간 반영 (firebaseId 포함 → 삭제 기능용)
        window.dispatchEvent(new CustomEvent('smsAttendance', {
          detail: { studentName, time: time || null, phone: parentPhone || null, firebaseId: id }
        }))

        // 부모 전화번호 없으면 SMS 발송 안 함
        if (!parentPhone) {
          console.log(`[AutoSMS] ${studentName} — parentPhone 없음, 건너뜀`)
          return
        }

        // 발송 전 ID 기록 (race condition 방지)
        sentRef.current.add(id)
        saveSentIds(dateStr, sentRef.current)

        const fmtTime = (t) => {
          if (!t) return '방금'
          const [h, m] = String(t).split(':').map(Number)
          if (isNaN(h)) return t
          return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
        }

        const body = `[참바른글씨] ${studentName} 학생이 ${fmtTime(time)}에 출석하였습니다.`

        SmsPlugin.sendSms({ phone: String(parentPhone), body })
          .then(() => console.log(`[AutoSMS] 발송 완료 → ${studentName} (${parentPhone})`))
          .catch(err => console.error(`[AutoSMS] 발송 실패 → ${studentName}:`, err?.message))
      })
    }).catch(err => {
      console.error('[AutoSMS] Firebase 리스너 초기화 실패:', err?.message)
    })

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, []) // 하루에 1번 마운트 — 날짜 변경 시 앱 재시작 전제
}
