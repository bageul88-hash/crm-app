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

const ATTENDANCE_API = 'https://crm-app-sj7m.onrender.com/api/attendance'

function todayHyphen() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/**
 * 드라이브 학생 폴더명 조립 — "${나이}세 ${이름} ${savedAt8자리}"
 * 예) age="13세", savedAt="2026-08-30" → "13세 방시윤 20260830"
 *
 * ※ 뒤 8자리는 시트 O열 "저장시각"(savedAt)이다. 등록일·첫상담일이 아니다.
 * ※ 서버(attendance_drive.gs)는 extractStudentName()으로 "이름"만 뽑아 매칭하므로
 *   나이·8자리는 NEW_CREATED 분기에서 새 폴더를 만들 때 그대로 폴더명이 된다.
 *   → 이름만 보내면 나이·번호가 빠진 폴더가 생성되어 이후 영구히 AMBIGUOUS 대상이 된다.
 * 조건 미충족 시 이름만 반환하므로, 호출부는 isFullFolderName()으로 반드시 확인할 것.
 */
export function buildStudentFolderName(name, age, savedAt) {
  const nm = String(name || '').trim()
  const ageNum = String(age || '').replace(/세$/, '').trim()
  const dateStr = String(savedAt || '').replace(/-/g, '').trim()
  if (nm && ageNum && dateStr.length === 8) return `${ageNum}세 ${nm} ${dateStr}`
  return nm
}

/** 조립이 완전한지("나이세 이름 8자리") 판별 — 이름만 남은 폴백을 걸러내는 용도 */
export function isFullFolderName(folderName) {
  return /^\S+세\s+.+\s+\d{8}$/.test(String(folderName || '').trim())
}

/**
 * crm_consults_cache에서 이름으로 찾아 폴더명 조립 (키오스크 경로 전용).
 * ※ 이름만으로 첫 히트를 쓰므로 동명이인은 엉뚱한 나이·날짜가 붙을 수 있다.
 *   상담 레코드를 이미 들고 있다면 buildStudentFolderName()에 직접 넘길 것.
 */
export function folderNameFromCache(studentName) {
  try {
    const cache = JSON.parse(localStorage.getItem('crm_consults_cache') || '[]')
    const match = cache.find(c => String(c.name || '').trim() === String(studentName).trim())
    if (match) return buildStudentFolderName(studentName, match.age, match.savedAt)
  } catch {}
  return String(studentName || '').trim()
}

/**
 * 드라이브 출석 요청 — 키오스크 출첵과 완전히 동일한 서버 경로.
 * Render 프록시(/api/attendance) → Apps Script doPost → onAttendanceCheck()
 *
 * 반환 status: SUCCESS | ALREADY_CHECKED | NEW_CREATED | AMBIGUOUS | SKIPPED | PAUSED | ERROR
 * @param {string} folderName - buildStudentFolderName() 결과
 * @param {string} attendDate - "YYYY-MM-DD"
 * @returns {Promise<{status:string, message:string}>}
 */
export async function requestDriveAttendance(folderName, attendDate) {
  const r = await fetch(ATTENDANCE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentFolderName: folderName, attendDate }),
  })
  const result = await r.json()
  if (!result || typeof result.status !== 'string') {
    throw new Error('서버 응답 형식이 올바르지 않습니다')
  }
  return result
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
 * 학부모 등원 문자 발송 — 키오스크·수동 출석 공용.
 * 본문은 "이름 + 시각"만 담는다. 나이·전화번호는 본문에 넣지 않는다.
 *
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
export async function sendArrivalSms(studentName, time = null, parentPhone = null) {
  if (!parentPhone) return { sent: false, reason: '전화번호 없음' }
  const timeLabel = fmtTime(time) || '방금'
  const body = `[참바른글씨] ${studentName} 학생이 ${timeLabel}에 출석하였습니다.`
  try {
    await SmsPlugin.sendSms({ phone: String(parentPhone), body })
    console.log(`[SMS] 학부모 문자 발송 완료: ${parentPhone}`)
    return { sent: true }
  } catch (err) {
    console.warn('[SMS] 학부모 문자 발송 실패:', err?.message)
    return { sent: false, reason: err?.message || '발송 실패' }
  }
}

/**
 * 학생 등원 처리 통합 함수
 * Firebase 저장 + 학부모 자동 문자 발송
 *
 * @param {string} studentName
 * @param {string|null} time - "HH:mm" 형식
 * @param {string|null} parentPhone - 학부모 전화번호 (있을 때만 발송)
 */
export async function handleStudentArrival(studentName, time = null, parentPhone = null, opts = {}) {
  const { sendSms = true } = opts   // 문자 중복·뒤늦은 발송 방지용 (호출부에서 끌 수 있음)
  const date = todayKey()

  // 1. Firebase에 출석 저장
  await saveAttendanceToFirebase(studentName, date, time, parentPhone)

  // 2. 학부모 전화번호가 있을 때만 자동 문자 발송
  if (sendSms) await sendArrivalSms(studentName, time, parentPhone)

  // 3. 구글 드라이브 폴더 이동 (출석 체크 완료 후 서버 호출)
  try {
    const folderName = folderNameFromCache(studentName)
    console.log('[Drive] folderName:', folderName)
    const result = await requestDriveAttendance(folderName, todayHyphen())
    if (result.status === 'SUCCESS') {
      console.log('[Drive] 폴더 이동 완료:', folderName)
    } else {
      console.error('[Drive] 오류:', result.status, result.message)
    }
  } catch (err) {
    console.error('[Drive] 서버 호출 실패:', err)
  }
}
