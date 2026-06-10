import { db } from '../firebase'
import { ref, push, set } from 'firebase/database'
import { registerPlugin } from '@capacitor/core'

const SmsPlugin = registerPlugin('SmsPlugin')

function todayKey() {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * Firebase Realtime Database에 출석 데이터 저장
 * 경로: attendance/{date}/{pushId}
 *
 * @param {string} studentName
 * @param {string} date - YYYYMMDD (미지정 시 오늘)
 * @param {string|null} time - "HH:mm" 형식
 * @param {string|null} phone - 학부모 전화번호
 */
export async function saveAttendanceToFirebase(studentName, date, time = null, phone = null) {
  try {
    const dateKey = date || todayKey()
    const entryRef = push(ref(db, `attendance/${dateKey}`))
    await set(entryRef, {
      name: studentName,
      time: time || null,
      phone: phone || null,
      savedAt: new Date().toISOString(),
    })
    console.log(`[Firebase] 출석 저장 완료: ${studentName} (${dateKey})`)
  } catch (err) {
    // Firebase 저장 실패해도 localStorage는 유지 — 에러 무시
    console.warn('[Firebase] 출석 저장 실패:', err?.message)
  }
}

function fmtTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h)) return timeStr
  const ampm = h < 12 ? '오전' : '오후'
  return `${ampm} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

/**
 * 학생 등원 처리 통합 함수
 * Firebase 저장 + 학부모 자동 문자 발송
 *
 * @param {string} studentName
 * @param {string|null} time - "HH:mm" 형식
 * @param {string|null} parentPhone - 학부모 전화번호 (있을 때만 발송)
 */
export async function handleStudentArrival(studentName, time = null, parentPhone = null) {
  const date = todayKey()

  // 1. Firebase에 출석 저장
  await saveAttendanceToFirebase(studentName, date, time, parentPhone)

  // 2. 학부모 전화번호가 있을 때만 자동 문자 발송
  if (parentPhone) {
    const timeLabel = fmtTime(time) || '방금'
    const body = `[참바른글씨] ${studentName} 학생이 ${timeLabel}에 출석하였습니다.`
    try {
      await SmsPlugin.sendSms({ phone: parentPhone, body })
      console.log(`[SMS] 학부모 문자 발송 완료: ${parentPhone}`)
    } catch (err) {
      console.warn('[SMS] 학부모 문자 발송 실패:', err?.message)
    }
  }

  // 3. 구글 드라이브 폴더 이동 (출석 체크 완료 후 서버 호출)
  try {
    const students = JSON.parse(localStorage.getItem('attendance_students') || '[]')
    const student = students.find(s => s.name === studentName) || { name: studentName }
    const folderName = student.folderName ||
      (student.age && student.grade && student.registerDate
        ? `${student.age}세 ${student.name} ${student.grade}학년 ${student.registerDate}`
        : studentName)

    const r = await fetch('https://crm-app-sj7m.onrender.com/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentFolderName: folderName,
        attendDate: (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}` })(),
      }),
    })
    const result = await r.json()
    if (result.status === 'SUCCESS') {
      console.log('[Drive] 폴더 이동 완료:', folderName)
    } else {
      console.error('[Drive] 오류:', result.message)
    }
  } catch (err) {
    console.error('[Drive] 서버 호출 실패:', err)
  }
}
