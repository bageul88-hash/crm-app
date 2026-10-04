import { useEffect, useRef } from 'react'
import { ref, get, onChildAdded } from 'firebase/database'
import { registerPlugin } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
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

// ─────────────────────────────────────────────
// 문자가 "안 나간" 출석을 날짜별로 남긴다.
//   조용히 지나가면 아무도 모른다 → 출석관리 화면에서 경고로 보여주기 위한 기록.
//   키: attendance_sms_missed_{YYYY-MM-DD} = [{ id, name, time, reason, at }]
// ─────────────────────────────────────────────
export function missedKey(dateStr) { return `attendance_sms_missed_${dateStr}` }

export function loadMissed(dateStr) {
  try {
    const raw = localStorage.getItem(missedKey(dateStr))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function recordMissed(dateStr, entry) {
  try {
    const list = loadMissed(dateStr).filter(x => x.id !== entry.id)
    list.push({ ...entry, at: new Date().toISOString() })
    localStorage.setItem(missedKey(dateStr), JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('smsMissedChanged', { detail: { dateStr } }))
  } catch {}
}

function clearMissed(dateStr, id) {
  try {
    const list = loadMissed(dateStr).filter(x => x.id !== id)
    localStorage.setItem(missedKey(dateStr), JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('smsMissedChanged', { detail: { dateStr } }))
  } catch {}
}

/**
 * Firebase attendance/branch_pentwo/{YYYY-MM-DD} 를 실시간 감시해
 * 새로 들어온 출석을 화면에 띄우고, 학부모에게 자동 문자를 보낸다.
 *
 * 설계 원칙
 * - 화면 표시(smsAttendance 이벤트)는 조건 없이 항상 보낸다.
 *   (앱이 꺼져 있던 사이에 들어온 출석도 화면에서 빠지지 않게)
 * - 문자 발송은 "앱 시작 이후 새로 들어온 출석"에만 한다.
 *   (과거 출석에 뒤늦게 문자가 나가는 것을 막기 위함)
 * - 문자가 나가지 않은 건은 전부 missed 목록에 남겨 화면에서 확인할 수 있게 한다.
 * - 날짜가 바뀌면 스스로 다음 날 노드로 다시 구독한다(앱 재시작에 기대지 않는다).
 */
export function useFirebaseAttendanceListener() {
  const unsubRef = useRef(null)
  const dateRef  = useRef(null)
  const sentRef  = useRef(new Set())

  useEffect(() => {
    let disposed = false

    // SEND_SMS 런타임 권한 요청 (Android 6+ 필수 — 실패해도 리스너는 계속 등록)
    SmsPlugin.requestSendSmsPermission()
      .then(r => console.log('[AutoSMS] SEND_SMS 권한:', r?.granted))
      .catch(() => {})

    const fmtTime = (t) => {
      if (!t) return '방금'
      const [h, m] = String(t).split(':').map(Number)
      if (isNaN(h)) return t
      return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
    }

    const handleChild = (childSnap, existingIds, dateStr) => {
      if (disposed || dateRef.current !== dateStr) return

      const id   = childSnap.key
      const data = childSnap.val() || {}

      // 공기계는 'name' 필드로 저장, CRM 자체 저장은 'studentName' — 둘 다 지원
      const studentName = data.name || data.studentName
      const { parentPhone, time } = data

      if (!studentName) return

      // ── 화면 표시·출석 기록은 항상 수행 ─────────────────────────
      // (중복은 AttendancePage 의 hasEntry 가 이름·날짜 기준으로 막아 준다)
      window.dispatchEvent(new CustomEvent('smsAttendance', {
        detail: { studentName, time: time || null, phone: parentPhone || null, firebaseId: id }
      }))

      // ── 이하 "문자 발송" 판단만 ──────────────────────────────
      if (existingIds.has(id)) {
        console.log(`[AutoSMS] ${studentName} — 앱 시작 전 출석, 화면만 표시하고 문자는 생략`)
        recordMissed(dateStr, { id, name: studentName, time: time || null, reason: '앱이 꺼져 있던 동안 들어온 출석' })
        return
      }

      if (sentRef.current.has(id)) return

      if (!parentPhone) {
        console.log(`[AutoSMS] ${studentName} — parentPhone 없음, 건너뜀`)
        recordMissed(dateStr, { id, name: studentName, time: time || null, reason: '학부모 전화번호 없음' })
        return
      }

      // 중복 발송 방지를 위해 발송 직전에 기록하고, 실패하면 되돌린다.
      sentRef.current.add(id)
      saveSentIds(dateStr, sentRef.current)

      const body = `[참바른글씨] ${studentName} 학생이 ${fmtTime(time)}에 출석하였습니다.`

      SmsPlugin.sendSms({ phone: String(parentPhone), body })
        .then(() => {
          console.log(`[AutoSMS] 발송 완료 → ${studentName}`)
          clearMissed(dateStr, id)
        })
        .catch(err => {
          console.error(`[AutoSMS] 발송 실패 → ${studentName}:`, err?.message)
          // 실패한 건은 다시 시도할 수 있도록 발송기록에서 빼고, 미발송으로 남긴다.
          sentRef.current.delete(id)
          saveSentIds(dateStr, sentRef.current)
          recordMissed(dateStr, { id, name: studentName, time: time || null, reason: `문자 발송 실패 (${err?.message || '원인 미상'})` })
        })
    }

    const subscribe = (dateStr) => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
      dateRef.current = dateStr
      sentRef.current = loadSentIds(dateStr)
      console.log('[AutoSMS] 감시 날짜:', dateStr)

      const attendanceRef = ref(db, `attendance/branch_pentwo/${dateStr}`)

      // Step 1: 구독 시점에 이미 있던 출석 ID 수집 (문자 억제용)
      get(attendanceRef).then(snapshot => {
        if (disposed || dateRef.current !== dateStr) return
        const existingIds = new Set()
        if (snapshot.exists()) snapshot.forEach(child => existingIds.add(child.key))

        // Step 2: child_added 구독
        unsubRef.current = onChildAdded(attendanceRef, snap => handleChild(snap, existingIds, dateStr))
      }).catch(err => {
        console.error('[AutoSMS] 리스너 초기화 실패:', err?.message)
        // 초기화에 실패하면 다음 점검 때 다시 붙도록 날짜를 비워 둔다.
        if (dateRef.current === dateStr) dateRef.current = null
      })
    }

    // 날짜가 바뀌었거나 아직 구독하지 못했으면 다시 구독한다.
    const ensureToday = () => {
      if (disposed) return
      const d = todayHyphen()
      if (d !== dateRef.current) subscribe(d)
    }

    ensureToday()

    // 자정을 넘겨도 앱 재시작 없이 다음 날 노드로 넘어가도록 주기 점검
    const timer = setInterval(ensureToday, 60 * 1000)

    // 포그라운드 복귀 시에도 즉시 점검 (절전으로 타이머가 밀렸을 수 있음)
    let handle
    CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) ensureToday() })
      .then(h => { handle = h })
      .catch(() => {})

    return () => {
      disposed = true
      clearInterval(timer)
      handle?.remove()
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    }
  }, [])
}
