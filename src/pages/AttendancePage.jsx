import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ref as dbRef, remove, get, set } from 'firebase/database'
import { db } from '../firebase'
import { readSmsHistory } from '../hooks/useSmsAttendance'
import SearchInput from '../components/SearchInput'
import { handleStudentArrival, saveAttendanceToFirebase, buildStudentFolderName, isFullFolderName, requestDriveAttendance, sendArrivalSms } from '../api/firebaseAttendance'
import { loadMissed, clearMissed } from '../hooks/useFirebaseAttendanceListener'
import DatePicker from '../components/DatePicker'
import { useApp } from '../context/AppContext'

const TODAY     = new Date()
const TODAY_STR = `${TODAY.getFullYear()}${String(TODAY.getMonth()+1).padStart(2,'0')}${String(TODAY.getDate()).padStart(2,'0')}`
const TODAY_HYPHEN = `${TODAY.getFullYear()}-${String(TODAY.getMonth()+1).padStart(2,'0')}-${String(TODAY.getDate()).padStart(2,'0')}`
const TODAY_LBL = `${TODAY.getFullYear()}년 ${TODAY.getMonth()+1}월 ${TODAY.getDate()}일 (${['일','월','화','수','목','금','토'][TODAY.getDay()]})`
const DAYS_KR   = ['일','월','화','수','목','금','토']
const CUR_YEAR  = String(TODAY.getFullYear())
const CUR_MON   = String(TODAY.getMonth()+1).padStart(2,'0')

// 삭제 블록리스트 (RTDB) — 진실의 소스. 완전삭제/재설치에도 살아남음.
const DELETED_PATH = 'attendance_deleted/branch_pentwo'
// 키: 이름|날짜(YYYYMMDD)|시간(HH:mm). RTDB 금지문자(. # $ [ ] /)는 _ 로 치환.
const delKey = (name, date, time) => `${name}|${date}|${time || ''}`.replace(/[.#$\[\]\/]/g, '_')

// 나이 배지 매칭용 — 전화번호 정규화(숫자만) / "NN세" 표준형만 배지 표시
const normPhone = (p) => String(p || '').replace(/[^0-9]/g, '')
const isStdAge = (a) => /^\d{1,2}세$/.test(String(a || '').trim())
// 이름 비교용 정규화 — 공백 표기 차이('주 훈' vs '주훈')를 같은 학생으로 본다.
// 총출석 집계가 이름 문자열을 키로 쓰기 때문에, 표기가 갈리면 횟수가 쪼개진다.
// ※ \s는 zero-width space(U+200B) 등 보이지 않는 문자를 잡지 못한다.
//   시트에서 복사·붙여넣기로 들어온 이름에 섞여 있어도 매칭되도록 명시적으로 제거한다.
const normName = (n) =>
  String(n || '').replace(/[\s\u00a0\u200b-\u200f\u2060\ufeff\u3000\u00b7.,\-_]/g, '')

function toEntry(raw) { return typeof raw === 'string' ? { name: raw, time: null } : raw }
// 정렬용: 저장형식 "HH:mm"(24시간) 기준 분 단위. "오전/오후 h:mm"도 안전하게 처리. 시각 없으면 맨 뒤.
function toMin(t) {
  const s = String(t || '').trim()
  if (!s) return Number.MAX_SAFE_INTEGER
  const ap = /(오전|오후)\s*(\d{1,2}):(\d{2})/.exec(s)
  if (ap) {
    const h = (parseInt(ap[2], 10) % 12) + (ap[1] === '오후' ? 12 : 0)
    return h * 60 + parseInt(ap[3], 10)
  }
  const hm = /^(\d{1,2}):(\d{2})/.exec(s)
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10)
  return Number.MAX_SAFE_INTEGER
}
// 먼저 출석한 학생이 위 (오름차순). 동시각이면 기존 순서 유지(안정 정렬).
const byTimeAsc = (a, b) => toMin(a.time) - toMin(b.time)
function hasEntry(list, name) { return (list || []).some(e => toEntry(e).name === name) }
function fmtTime(t) {
  if (!t) return '-'
  const [h, m] = t.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2,'0')}`
}
function fmtDateLabel(d) {
  const y = +d.slice(0,4), mo = parseInt(d.slice(4,6)), day = parseInt(d.slice(6,8))
  return `${y}년 ${mo}월 ${day}일 (${DAYS_KR[new Date(y, mo-1, day).getDay()]})`
}

const TH = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', background: '#f9fafb', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
const td = (x={}) => ({ padding: '10px 12px', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', ...x })

export default function AttendancePage() {
  const [records, setRecords]         = useState({})
  const [tab, setTab]                 = useState('attend')
  const [search, setSearch]           = useState('')
  const [selYear, setSelYear]         = useState(CUR_YEAR)
  const [selMon, setSelMon]           = useState(CUR_MON)
  const [loadingToday, setLoadToday]  = useState(false)
  const [loadingAll, setLoadingAll]   = useState(false)
  const [importStat, setImportStat]   = useState(null)  // { total, added, scanned, matched, totalSaved }
  const [lastUpdated, setLastUpdated] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)   // 삭제 확인 대상 entry
  const [addingEntry, setAddingEntry] = useState(false)
  const [newDate, setNewDate] = useState(TODAY_HYPHEN)
  const [newAmPm, setNewAmPm] = useState('오후')
  const [newHour, setNewHour] = useState('3')
  const [newMin, setNewMin] = useState('00')
  // ── 수동 출석(소급 보정) ──
  // 상담목록과 동일한 조회 로직 재사용. 원장 1인 단독 사용이라 지점 분기가 없으므로
  // branchId로 걸러진 consults 대신 allConsults를 쓴다 — 학생이 조용히 누락되지 않도록.
  const { allConsults } = useApp()
  const [manualOpen, setManualOpen]   = useState(false)
  const [manualSearch, setManualSearch] = useState('')
  const [manualDate, setManualDate]   = useState(TODAY_HYPHEN)
  const [manualSel, setManualSel]     = useState(null)   // 확인 다이얼로그 대상 상담 레코드
  const [manualBusy, setManualBusy]   = useState(false)
  const [resultDlg, setResultDlg]     = useState(null)   // { tone, title, body[], detail }
  const [toast, setToast]             = useState(null)
  const lockRef = useRef(false)
  const pressTimer = useRef(null)
  const deletedRef = useRef(new Set())   // 삭제 블록리스트(RTDB 미러) — 재import 차단용

  // 오늘 "문자가 안 나간" 출석 목록 — 조용히 지나가지 않도록 화면에 띄운다
  const [missedSms, setMissedSms] = useState(() => loadMissed(TODAY_HYPHEN))

  // 초기 로컬스토리지 로드
  useEffect(() => {
    const saved = localStorage.getItem('attendance_records')
    if (saved) setRecords(JSON.parse(saved))
  }, [])

  // 삭제 블록리스트 로드 (RTDB = 진실의 소스). 이후 임포트 차단에 사용.
  useEffect(() => {
    get(dbRef(db, DELETED_PATH))
      .then(snap => { if (snap.exists()) deletedRef.current = new Set(Object.keys(snap.val())) })
      .catch(err => console.warn('[삭제 블록리스트] 로드 실패:', err?.message))
  }, [])

  // 출석 RTDB에서 (이름|날짜) → 학부모 전화번호 맵 — record에 phone이 없을 때 나이 배지 보완용.
  // ※ 읽기 전용(저장/출석 로직 무관). 같은 이름·같은 날 서로 다른 번호가 2건이면 모호 → null(배지 생략).
  const [attPhoneMap, setAttPhoneMap] = useState(() => new Map())
  useEffect(() => {
    get(dbRef(db, 'attendance/branch_pentwo'))
      .then(snap => {
        if (!snap.exists()) return
        const m = new Map()
        Object.entries(snap.val() || {}).forEach(([dateHyphen, nodes]) => {
          const dateKey = String(dateHyphen).replace(/-/g, '')      // YYYY-MM-DD → YYYYMMDD
          Object.values(nodes || {}).forEach(rec => {
            const nm = String(rec?.name || rec?.studentName || '').trim()
            const ph = normPhone(rec?.parentPhone)
            if (!nm || !ph) return
            const k = `${nm}|${dateKey}`
            if (!m.has(k)) m.set(k, ph)
            else if (m.get(k) !== ph) m.set(k, null)                // 같은 이름·같은 날 다른 번호 → 모호
          })
        })
        setAttPhoneMap(m)
      })
      .catch(err => console.warn('[출석 전화맵] 로드 실패:', err?.message))
  }, [])

  // 실시간 SMS 수신 → localStorage + Firebase 동시 저장
  useEffect(() => {
    const handler = (e) => {
      const { studentName, time, phone, firebaseId } = e.detail
      setRecords(prev => {
        const next = { ...prev }
        if (!hasEntry(next[TODAY_STR], studentName) && !deletedRef.current.has(delKey(studentName, TODAY_STR, time))) {
          next[TODAY_STR] = [...(next[TODAY_STR] || []), {
            name: studentName,
            time: time || null,
            phone: phone || null,
            firebaseId: firebaseId || null,
          }]
          localStorage.setItem('attendance_records', JSON.stringify(next))
          // Firebase 저장 + 드라이브 폴더 이동 (문자는 보내지 않는다)
          // 학부모 문자는 useFirebaseAttendanceListener 가 단독으로 책임진다.
          // 여기서도 보내면 ① 같은 출석에 2통 ② 앱 재시작 시 과거 출석에 뒤늦은 발송이 생긴다.
          handleStudentArrival(studentName, time || null, phone || null, { sendSms: false })
        }
        return next
      })
    }
    window.addEventListener('smsAttendance', handler)
    return () => window.removeEventListener('smsAttendance', handler)
  }, [])

  // 앱이 꺼져 있었거나 다른 화면에 있던 동안 들어온 출석 보정 —
  // 오늘 정본(attendance/branch_pentwo/날짜)을 읽어 화면·기록에 없는 건만 채운다.
  // ★ 문자는 절대 보내지 않는다(발송은 useFirebaseAttendanceListener 단독 책임).
  // ★ setRecords 업데이터는 순수하게 유지한다 — 안에서 저장을 호출하면
  //   업데이터가 두 번 불릴 때 그림자에 중복 레코드가 쌓인다.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      get(dbRef(db, `attendance/branch_pentwo/${TODAY_HYPHEN}`)),
      get(dbRef(db, `attendance/${TODAY_STR}`)),
    ])
      .then(([mainSnap, shadowSnap]) => {
        if (cancelled || !mainSnap.exists()) return

        // 이미 그림자에 있는 이름 — 중복 저장 방지
        const shadowNames = new Set()
        shadowSnap.forEach(ch => {
          const nm = (ch.val() || {}).name
          if (nm) shadowNames.add(nm)
        })

        const items = []
        mainSnap.forEach(ch => {
          const v = ch.val() || {}
          const nm = v.name || v.studentName
          if (nm) items.push({ nm, time: v.time || null, phone: v.parentPhone || null, id: ch.key })
        })

        let stored = {}
        try { stored = JSON.parse(localStorage.getItem('attendance_records') || '{}') } catch {}
        const todayList = stored[TODAY_STR] || []
        const missing = items.filter(it =>
          !hasEntry(todayList, it.nm) && !deletedRef.current.has(delKey(it.nm, TODAY_STR, it.time))
        )
        if (!missing.length) return

        // 1) 화면·로컬 기록 (업데이터는 순수)
        setRecords(prev => {
          const next = { ...prev }
          const list = [...(next[TODAY_STR] || [])]
          missing.forEach(({ nm, time, phone, id }) => {
            if (hasEntry(list, nm)) return
            list.push({ name: nm, time, phone, firebaseId: id })
          })
          next[TODAY_STR] = list
          try { localStorage.setItem('attendance_records', JSON.stringify(next)) } catch {}
          return next
        })

        // 2) 그림자에 없는 것만 1회 저장 (문자 미발송)
        missing.forEach(({ nm, time, phone }) => {
          if (shadowNames.has(nm)) return
          console.log(`[출석보정] 누락분 채움: ${nm} ${time || ''} (문자 미발송)`)
          saveAttendanceToFirebase(nm, null, time, phone)
        })
      })
      .catch(err => console.warn('[출석보정] 실패:', err?.message))
    return () => { cancelled = true }
  }, [])

  // 미발송 목록 변동 구독 (리스너가 기록/해제할 때마다 갱신)
  useEffect(() => {
    const refresh = () => setMissedSms(loadMissed(TODAY_HYPHEN))
    refresh()
    window.addEventListener('smsMissedChanged', refresh)
    const t = setInterval(refresh, 30 * 1000)
    return () => { window.removeEventListener('smsMissedChanged', refresh); clearInterval(t) }
  }, [])

  // 오늘 현황용 빠른 로드 (권한 에러 무시 — SMS 실패 시 기존 저장 이력 사용)
  const loadTodaySms = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true
    setLoadToday(true)
    try {
      const { items } = await readSmsHistory(99999)
      if (!items.length) return
      const raw = localStorage.getItem('attendance_records')
      const recs = raw ? JSON.parse(raw) : {}
      let changed = false
      items.forEach(({ studentName, date, time }) => {
        if (!hasEntry(recs[date], studentName) && !deletedRef.current.has(delKey(studentName, date, time))) {
          recs[date] = [...(recs[date]||[]), { name: studentName, time: time||null }]
          changed = true
        }
      })
      if (changed) { localStorage.setItem('attendance_records', JSON.stringify(recs)); setRecords({...recs}) }
    } finally { lockRef.current = false; setLoadToday(false) }
  }, [])

  // 전체 SMS 불러오기 (이력 탭용)
  const importAllSms = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true
    setLoadingAll(true)
    setImportStat(null)
    try {
      const { items, scanned, matched } = await readSmsHistory(99999)
      const raw = localStorage.getItem('attendance_records')
      const recs = raw ? JSON.parse(raw) : {}
      let added = 0
      items.forEach(({ studentName, date, time }) => {
        if (!hasEntry(recs[date], studentName) && !deletedRef.current.has(delKey(studentName, date, time))) {
          recs[date] = [...(recs[date]||[]), { name: studentName, time: time||null }]
          added++
        }
      })
      localStorage.setItem('attendance_records', JSON.stringify(recs))
      setRecords({...recs})
      const totalSaved = Object.values(recs).reduce((s, list) => s + (list?.length || 0), 0)
      setImportStat({ total: items.length, added, scanned, matched, totalSaved })
      setLastUpdated(new Date())
    } finally { lockRef.current = false; setLoadingAll(false) }
  }, [])

  // 탭 진입 시 자동 로드
  useEffect(() => {
    if (tab === 'attend') loadTodaySms()
    if (tab === 'history') importAllSms()
  }, [tab])

  // 출석 이력 탭: 3분마다 자동 갱신
  useEffect(() => {
    if (tab !== 'history') return
    const timer = setInterval(() => { importAllSms() }, 3 * 60 * 1000)
    return () => clearInterval(timer)
  }, [tab, importAllSms])

  // ── 출석 삭제 (롱프레스) ──
  const startPos = useRef({ x: 0, y: 0 })

  const startPress = useCallback((entry, ev) => {
    if (ev?.touches?.[0]) {
      startPos.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
    }
    pressTimer.current = setTimeout(() => setDeleteTarget(entry), 600)
  }, [])

  const movePress = useCallback((ev) => {
    if (!ev.touches?.[0]) return
    const dx = Math.abs(ev.touches[0].clientX - startPos.current.x)
    const dy = Math.abs(ev.touches[0].clientY - startPos.current.y)
    if (dx > 10 || dy > 10) clearTimeout(pressTimer.current)
  }, [])

  const endPress = useCallback(() => {
    clearTimeout(pressTimer.current)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    const entry = deleteTarget
    if (!entry) return
    setDeleteTarget(null)

    // localStorage에서 제거
    setRecords(prev => {
      const next = { ...prev }
      const list = next[TODAY_STR] || []
      const idx = list.findIndex(r => {
        const e = toEntry(r)
        return entry.firebaseId && e.firebaseId
          ? e.firebaseId === entry.firebaseId
          : e.name === entry.name
      })
      if (idx !== -1) {
        next[TODAY_STR] = [...list.slice(0, idx), ...list.slice(idx + 1)]
        localStorage.setItem('attendance_records', JSON.stringify(next))
      }
      return next
    })

    // sentIds에서 제거 → 같은 학생 재출석 가능
    if (entry.firebaseId) {
      try {
        const sentKey = `attendance_sms_sent_${TODAY_HYPHEN}`
        const raw = localStorage.getItem(sentKey)
        if (raw) {
          const ids = new Set(JSON.parse(raw))
          ids.delete(entry.firebaseId)
          localStorage.setItem(sentKey, JSON.stringify([...ids]))
        }
      } catch {}

      // Firebase에서 삭제
      try {
        await remove(dbRef(db, `attendance/branch_pentwo/${TODAY_HYPHEN}/${entry.firebaseId}`))
        console.log(`[Delete] Firebase 삭제 완료: ${entry.name}`)
      } catch (err) {
        console.error('[Delete] Firebase 삭제 실패:', err?.message)
      }
    }
  }, [deleteTarget])

  // ── 출석 일자 추가 ──
  const handleAddEntry = useCallback(async () => {
    if (!selectedStudent || !newDate) return
    const dateKey = newDate.replace(/-/g, '')
    let h = parseInt(newHour)
    if (newAmPm === '오전' && h === 12) h = 0
    if (newAmPm === '오후' && h !== 12) h += 12
    const timeStr = `${String(h).padStart(2, '0')}:${newMin}`

    const existingList = records[dateKey] || []
    const isDupe = existingList.some(e => {
      const entry = toEntry(e)
      return normName(entry.name) === normName(selectedStudent) && entry.time === timeStr
    })
    if (isDupe) { alert('이미 같은 날짜/시간의 출석 기록이 있습니다.'); return }

    const newEntry = { name: selectedStudent, time: timeStr }
    const updated = { ...records, [dateKey]: [...existingList, newEntry] }
    localStorage.setItem('attendance_records', JSON.stringify(updated))
    setRecords(updated)
    await saveAttendanceToFirebase(selectedStudent, dateKey, timeStr, null)
    setAddingEntry(false)
  }, [selectedStudent, newDate, newAmPm, newHour, newMin, records])

  // ── 수동 출석: 토스트 자동 해제 ──
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const manualDateKey = manualDate.replace(/-/g, '')

  // 선택한 날짜에 이미 등원 기록이 있는 학생 (비활성 표시용)
  const manualAttended = useMemo(
    () => new Set((records[manualDateKey] || []).map(toEntry).map(e => normName(e.name))),
    [records, manualDateKey]
  )

  // 이름 검색 — 입력 즉시 필터링. 전체 스크롤이 아니라 검색이 기본 진입점.
  const manualCandidates = useMemo(() => {
    const q = manualSearch.trim().toLowerCase()
    if (!q) return []
    const qn = normName(q)
    const qDigits = q.replace(/[^0-9]/g, '')
    const seen = new Set()
    return (allConsults || [])
      .filter(c => {
        const nm = String(c?.name || '').trim()
        if (nm && (nm.toLowerCase().includes(q) || (qn && normName(nm).toLowerCase().includes(qn)))) return true
        // 숫자만 입력하면 전화번호로도 찾는다 — 이름 표기가 깨진 학생의 대체 진입점
        return qDigits.length >= 2 && normPhone(c?.phone).includes(qDigits)
      })
      .filter(c => {
        const k = `${c.name}|${c.age}|${c.savedAt}|${c.phone}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'))
      .slice(0, 60)
  }, [manualSearch, allConsults])

  // CRM 출석기록 반영 — doPost는 드라이브만 처리하고 시트/총출석엔 쓰지 않으므로 별도 기록.
  // 총출석 횟수의 소스는 localStorage attendance_records + Firebase.
  const recordManualAttendance = useCallback(async (name, phone) => {
    const dateKey = manualDateKey
    const now = new Date()
    const timeStr = dateKey === TODAY_STR
      ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      : null
    // ※ records(state)가 아니라 localStorage에서 최신본을 다시 읽는다.
    //   서버 응답을 await 하는 동안 SMS 등원이 도착해 기록이 늘어날 수 있어,
    //   state 클로저를 그대로 쓰면 그 사이 추가분을 덮어쓴다.
    let cur = {}
    try { cur = JSON.parse(localStorage.getItem('attendance_records') || '{}') } catch {}
    const key = normName(name)

    // 이미 다른 날짜에 기록된 표기가 있으면 그 표기를 그대로 재사용한다.
    // 총출석이 이름 문자열을 키로 집계되므로, '주 훈'/'주훈'이 섞이면 횟수가 둘로 쪼개진다.
    let stored = name
    outer:
    for (const list of Object.values(cur)) {
      for (const raw of (list || [])) {
        const en = String(toEntry(raw).name || '').trim()
        if (en && normName(en) === key) { stored = en; break outer }
      }
    }

    // 중복 판정 기준은 드라이브 응답이 아니라 "그 날짜의 CRM 출석 기록" 자체다.
    const list = cur[dateKey] || []
    const dupe = list.map(toEntry).some(e => normName(e.name) === key)

    let next = cur
    if (!dupe) {
      next = { ...cur, [dateKey]: [...list, { name: stored, time: timeStr, phone: phone || null }] }
      localStorage.setItem('attendance_records', JSON.stringify(next))
      setRecords(next)
      await saveAttendanceToFirebase(stored, dateKey, timeStr, phone || null)
    }

    // 학부모 문자 — 오늘자 신규 기록일 때만.
    // 소급 날짜는 발송하지 않는다(지난 날짜에 "방금 출석" 문자가 나가면 안 됨).
    // 중복(dupe)일 때도 보내지 않는다 — 같은 날 두 번 눌러도 문자는 1회.
    let sms = { sent: false, reason: null }
    if (!dupe && dateKey === TODAY_STR && phone) {
      sms = await sendArrivalSms(stored, timeStr, phone)
    } else if (!dupe && dateKey !== TODAY_STR) {
      sms = { sent: false, reason: '소급 날짜 — 발송 안 함' }
    } else if (!dupe && !phone) {
      sms = { sent: false, reason: '전화번호 없음' }
    }

    // 반영 후 총출석 — 표기 차이를 흡수해 집계
    let total = 0
    Object.values(next).forEach(l => {
      ;(l || []).map(toEntry).forEach(e => { if (normName(e.name) === key) total++ })
    })
    return { added: !dupe, stored, total, sms }
  }, [manualDateKey])

  // ── 수동 출석 실행 — 키오스크 출첵과 완전히 동일한 서버 경로(doPost) ──
  const runManualAttendance = useCallback(async (c) => {
    if (!c || manualBusy) return
    const name = String(c.name || '').trim()
    const folderName = buildStudentFolderName(name, c.age, c.savedAt)
    const dateLabel = fmtDateLabel(manualDateKey)

    // 조립 실패(이름만 남음) → 전송 금지. 서버가 NEW_CREATED로 나이·번호 빠진 폴더를 만든다.
    if (!isFullFolderName(folderName)) {
      setManualSel(null)
      setResultDlg({
        tone: 'error',
        title: '전송할 수 없습니다',
        body: [
          `${name} 학생의 폴더명을 조립할 수 없습니다.`,
          `나이: ${c.age || '(비어있음)'} · 저장시각: ${c.savedAt || '(비어있음)'}`,
          '이름만 보내면 서버가 나이·번호가 빠진 폴더를 새로 만들고, 그 학생은 이후 계속 중복 대상이 됩니다.',
          '상담목록에서 나이·저장시각을 채운 뒤 다시 시도하세요.',
        ],
      })
      return
    }

    setManualBusy(true)
    let result
    try {
      result = await requestDriveAttendance(folderName, manualDate)
    } catch (err) {
      setManualBusy(false)
      setManualSel(null)
      setResultDlg({
        tone: 'error',
        title: '서버 호출 실패',
        body: [`${name} · ${dateLabel}`, '드라이브 폴더가 이동되지 않았습니다. 출석기록도 남기지 않았습니다.'],
        detail: err?.message || String(err),
      })
      return
    }
    setManualBusy(false)
    setManualSel(null)

    const status = String(result.status || '')
    const message = String(result.message || '')
    console.log('[수동출석]', status, '|', folderName, '|', manualDate, '|', message)

    // 드라이브가 오늘 폴더에 반영된 상태에서만 CRM 출석기록을 남긴다.
    // AMBIGUOUS/SKIPPED/ERROR/PAUSED는 폴더가 안 움직였으므로 기록도 남기지 않는다
    // (기록만 올라가면 총출석·재결제가 드라이브와 어긋난다).
    const driveOk = status === 'SUCCESS' || status === 'ALREADY_CHECKED' || status === 'NEW_CREATED'
    let rec = null
    if (driveOk) rec = await recordManualAttendance(name, c.phone)
    const recLine = !driveOk
      ? '출석기록을 남기지 않았습니다.'
      : rec.added
        ? `출석기록 추가됨 — ${dateLabel} · 총출석 ${rec.total}회`
        : `출석기록이 이미 있어 추가하지 않음 — ${dateLabel} · 총출석 ${rec.total}회`
    const smsLine = driveOk
      ? (rec.sms.sent ? '학부모 문자 발송됨' : `학부모 문자 미발송 (${rec.sms.reason || '해당 없음'})`)
      : null

    if (status === 'SUCCESS') {
      setManualOpen(false)
      setManualSearch('')
      setToast(`✅ ${name} · ${dateLabel} 출석 처리 완료 (총출석 ${rec.total}회${rec.sms.sent ? ' · 문자 발송' : ''})`)
      return
    }

    if (status === 'ALREADY_CHECKED') {
      setResultDlg({
        tone: 'info', title: '이미 처리된 출석입니다',
        body: [`${name} · ${dateLabel}`, '드라이브 오늘 폴더에 이미 있습니다.', recLine, ...(smsLine ? [smsLine] : [])],
        detail: message,
      })
      return
    }

    if (status === 'NEW_CREATED') {
      setResultDlg({
        tone: 'warn', title: '⚠️ 신규 폴더가 생성되었습니다',
        body: [
          `${name} · ${dateLabel}`,
          '과거 폴더를 찾지 못해 새 폴더를 만들었습니다. 기존 학생이라면 원본 폴더가 따로 있다는 뜻입니다.',
          '드라이브에서 중복 폴더가 생기지 않았는지 반드시 확인하세요.',
          recLine,
          ...(smsLine ? [smsLine] : []),
        ],
        detail: message,
      })
      return
    }

    if (status === 'AMBIGUOUS') {
      setResultDlg({
        tone: 'warn', title: '⚠️ 동일 이름 폴더가 여러 개입니다',
        body: [
          `${name} · ${dateLabel}`,
          '같은 이름 폴더가 과거에 2곳 이상 있어 자동 이동이 보류되었습니다.',
          '드라이브에서 중복 폴더를 정리한 뒤 다시 실행하세요.',
          recLine,
          ...(smsLine ? [smsLine] : []),
        ],
        detail: message,
      })
      return
    }

    if (status === 'PAUSED') {
      setResultDlg({
        tone: 'info', title: '폴더이동 점검 중입니다',
        body: [`${name} · ${dateLabel}`, '서버에서 폴더이동이 임시중단(MAINTENANCE) 상태입니다.', '점검이 끝난 뒤 다시 실행하세요.', recLine, ...(smsLine ? [smsLine] : [])],
        detail: message,
      })
      return
    }

    if (status === 'SKIPPED' || status === 'ERROR') {
      setResultDlg({
        tone: 'error', title: status === 'ERROR' ? '처리 실패' : '처리되지 않았습니다',
        body: [`${name} · ${dateLabel}`, recLine, ...(smsLine ? [smsLine] : [])],
        detail: message,
      })
      return
    }

    // 알 수 없는 status — 조용히 성공 처리하지 않는다
    setResultDlg({
      tone: 'warn', title: '⚠️ 알 수 없는 응답',
      body: [`${name} · ${dateLabel}`, `서버가 처리하지 못한 status를 반환했습니다: ${status || '(없음)'}`, recLine, ...(smsLine ? [smsLine] : [])],
      detail: message,
    })
  }, [manualBusy, manualDate, manualDateKey, recordManualAttendance])

  // ── 출석 기록 1건 삭제 (모달 각 날짜 행) ──
  const handleDeleteRecord = useCallback((date, time) => {
    if (!selectedStudent) return
    if (!window.confirm(`${fmtDateLabel(date)} 출석 기록을 삭제할까요?`)) return
    // 실제 저장된 이름을 찾아 블록리스트 키를 만든다 — 표기가 다르면('주 훈'/'주훈')
    // selectedStudent로 만든 키는 재import 차단에서 빗나간다.
    const storedName = (() => {
      const hit = (records[date] || []).map(toEntry)
        .find(e => normName(e.name) === normName(selectedStudent) && e.time === time)
      return hit ? String(hit.name) : selectedStudent
    })()
    const key = delKey(storedName, date, time)
    // 1) RTDB 블록리스트에 기록 (진실의 소스 — 재import 영구 차단)
    deletedRef.current.add(key)
    set(dbRef(db, `${DELETED_PATH}/${key}`), new Date().toISOString())
      .catch(err => { console.error('[삭제 블록리스트] 저장 실패:', err?.message); alert('삭제 기록 저장에 실패했습니다. 다시 시도해주세요.') })
    // 2) records에서 해당 1건 제거 (+ firebaseId 있으면 RTDB 출석노드도 삭제)
    setRecords(prev => {
      const next = { ...prev }
      const list = next[date] || []
      const idx = list.findIndex(x => { const e = toEntry(x); return normName(e.name) === normName(selectedStudent) && e.time === time })
      if (idx !== -1) {
        const orig = toEntry(list[idx])
        if (orig.firebaseId) {
          const d = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`
          remove(dbRef(db, `attendance/branch_pentwo/${d}/${orig.firebaseId}`)).catch(() => {})
        }
        next[date] = [...list.slice(0, idx), ...list.slice(idx + 1)]
        localStorage.setItem('attendance_records', JSON.stringify(next))
      }
      return next
    })
  }, [selectedStudent, records])

  // 파생 데이터
  const searchQ = search.trim().toLowerCase()
  const matchName = (name) => !searchQ || String(name || '').toLowerCase().includes(searchQ)

  const todayList = (records[TODAY_STR]||[]).map(toEntry).filter(e => matchName(e.name)).sort(byTimeAsc)
  const allDates  = Object.keys(records).sort().reverse()
  const MONTHS    = Array.from({length:12}, (_,i) => String(i+1).padStart(2,'0'))

  const dataYears = [...new Set(allDates.map(d => d.slice(0,4)))]
  const baseYears = ['2024','2025','2026', CUR_YEAR]
  const YEAR_OPTS = [...new Set([...baseYears, ...dataYears])].sort().reverse()

  const filteredDates = allDates.filter(d => d.startsWith(selYear + selMon))
  const grouped = filteredDates.map(d => ({
    dateStr: d,
    label: fmtDateLabel(d),
    entries: (records[d]||[]).map(toEntry).filter(e => matchName(e.name)).sort(byTimeAsc),   // 같은 날 안에서만 오름차순 (그룹 순서는 유지)
    isWknd: [0,6].includes(new Date(+d.slice(0,4), parseInt(d.slice(4,6))-1, parseInt(d.slice(6,8))).getDay())
  }))
  const monthTotal = grouped.reduce((s, g) => s + g.entries.length, 0)
  const totalAllSaved = Object.values(records).reduce((s, list) => s + (list?.length || 0), 0)

  // 총출석 집계 — 이름의 공백 표기 차이를 흡수한다.
  // 예전에는 이름 문자열 그대로를 키로 써서 '주 훈'/'주훈'이 별개로 세어졌고,
  // 기록은 남았는데 화면의 총출석은 그대로인 것처럼 보였다.
  const normTotals = useMemo(() => {
    const map = {}
    Object.values(records).forEach(list => {
      ;(list || []).map(toEntry).forEach(e => {
        const k = normName(e.name)
        if (k) map[k] = (map[k] || 0) + 1
      })
    })
    return map
  }, [records])

  // 나이 배지 조인 (crm_consults_cache)
  // ★ 동명이인 대응: 전화번호(안정키) 우선 매칭. 전화 없으면 이름 폴백하되,
  //   같은 이름이 서로 다른 나이면(동명이인) 배지 생략 — 틀린 나이 표시 방지.
  const { ageByPhone, ageByName } = useMemo(() => {
    const byPhone = new Map()
    const byName = new Map()          // 이름 → 나이 / null(동명이인 충돌)
    try {
      const cache = JSON.parse(localStorage.getItem('crm_consults_cache') || '[]')
      cache.forEach(c => {
        const age = String(c?.age || '').trim()
        if (!isStdAge(age)) return    // "NN세" 표준형만 사용
        const ph = normPhone(c?.phone)
        if (ph) byPhone.set(ph, age)
        const nm = String(c?.name || '').trim()
        if (nm) {
          if (!byName.has(nm)) byName.set(nm, age)
          else if (byName.get(nm) !== age) byName.set(nm, null)   // 나이가 다른 동명이인 → 충돌
        }
      })
    } catch {}
    return { ageByPhone: byPhone, ageByName: byName }
  }, [])

  // 이름 옆 나이 배지 — ① record.phone(실시간 도착분) → ② RTDB(이름|날짜) parentPhone
  //                    → ③ 이름 폴백(유일할 때만). 동명이인 충돌/비표준/미등록은 생략.
  const renderAgeBadge = (entry, dateKey) => {
    const nm = String(entry?.name || '').trim()
    let ph = normPhone(entry?.phone)                                  // ①
    if (!ph && dateKey) {
      const fromAtt = attPhoneMap.get(`${nm}|${dateKey}`)             // ② (null=모호면 사용 안 함)
      if (fromAtt) ph = fromAtt
    }
    let age = ph ? ageByPhone.get(ph) : undefined
    if (!age) age = ageByName.get(nm) || undefined                    // ③ null(동명이인) → 생략
    if (!age) return null
    return (
      <span style={{ marginLeft: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#eef4ff', borderRadius: 999, whiteSpace: 'nowrap' }}>
        {age}
      </span>
    )
  }

  return (
    <div className="fade-in" style={{ padding: '16px 16px 32px' }}>

      <SearchInput value={search} onChange={setSearch} placeholder="학생 이름 검색" style={{ marginBottom: 12 }} />

      {/* 파란 박스 */}
      <div style={{ background:'var(--accent)', borderRadius:'var(--radius)', padding:'14px 18px', marginBottom:14, color:'#fff', textAlign:'center' }}>
        <div style={{ fontSize:17, fontWeight:700 }}>{TODAY_LBL}</div>
      </div>

      {/* 탭 버튼 */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[['attend','오늘 출석 현황'],['history','출석 이력']].map(([k,l]) => (
          <button key={k} type="button" onClick={()=>setTab(k)}
            style={{ flex:1, padding:'9px 0', borderRadius:10, border:'none', fontWeight:700, fontSize:13, cursor:'pointer',
              background: tab===k ? 'var(--accent)' : '#f3f4f6',
              color: tab===k ? '#fff' : 'var(--text2)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── 출석 현황 탭 ── */}
      {tab === 'attend' && (
        <div>
          {missedSms.length > 0 && (
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'10px 12px', marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#c2410c', marginBottom:6 }}>
                ⚠️ 학부모 문자가 안 나간 출석 {missedSms.length}건
              </div>
              {missedSms.map(m => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'2px 0' }}>
                  <span style={{ fontSize:12, color:'#9a3412', lineHeight:1.6 }}>
                    · {m.name} {m.time || ''} — {m.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => { clearMissed(TODAY_HYPHEN, m.id); setMissedSms(loadMissed(TODAY_HYPHEN)) }}
                    style={{
                      flexShrink:0, fontSize:11, fontWeight:800, padding:'4px 9px', borderRadius:7,
                      border:'1px solid #c2410c', background:'#fff', color:'#c2410c', cursor:'pointer',
                      fontFamily:'var(--font)',
                    }}
                  >보냄</button>
                </div>
              ))}
              <div style={{ fontSize:11, color:'#9a3412', marginTop:6, opacity:0.85 }}>
                자동 재발송은 하지 않습니다. 직접 보내신 뒤에는 [보냄]을 눌러 경고를 내려주세요.
              </div>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text2)' }}>오늘 등원 {todayList.length}명</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button type="button" onClick={() => { setManualSearch(''); setManualDate(TODAY_HYPHEN); setManualSel(null); setManualOpen(true) }}
                style={{ fontSize:12, fontWeight:700, padding:'5px 11px', borderRadius:8, border:'1px solid var(--accent)', background:'rgba(79,126,248,0.08)', color:'var(--accent)', cursor:'pointer', whiteSpace:'nowrap' }}>
                + 수동 출석
              </button>
              <button type="button" onClick={loadTodaySms} disabled={loadingToday}
                style={{ fontSize:18, background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:'0 4px' }}>
                {loadingToday ? '⏳' : '🔄'}
              </button>
            </div>
          </div>
          <div style={{ borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>이름</th>
                  <th style={TH}>등원시간</th>
                </tr>
              </thead>
              <tbody>
                {todayList.length === 0
                  ? <tr><td colSpan={2} style={{ padding:'32px 16px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                      {loadingToday ? 'SMS를 읽어오는 중...' : '오늘 등원한 학생이 없습니다.'}
                    </td></tr>
                  : todayList.map((e,i) => (
                    <tr key={i}
                      onMouseDown={() => startPress(e)}
                      onMouseUp={endPress}
                      onMouseLeave={endPress}
                      onTouchStart={(ev) => startPress(e, ev)}
                      onTouchMove={movePress}
                      onTouchEnd={endPress}
                      onTouchCancel={endPress}
                      style={{ userSelect:'none' }}
                    >
                      <td style={td()}>
                        <span style={{ marginRight:6, fontWeight:600, fontSize:13, whiteSpace:'nowrap' }}>{e.name}</span>
                        {renderAgeBadge(e, TODAY_STR)}
                        <span onClick={() => setSelectedStudent(e.name)}
                          style={{ fontSize:11, color:'#3b82f6', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                          총출석 {normTotals[normName(e.name)] || 0}회
                        </span>
                      </td>
                      <td style={td({ color:'var(--text2)', whiteSpace:'nowrap', fontSize:13 })}>{fmtTime(e.time)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 학생 상세 이력 모달 ── */}
      {selectedStudent && (() => {
        const studentRecords = Object.entries(records)
          .flatMap(([date, list]) =>
            (list||[]).map(toEntry).filter(e => normName(e.name) === normName(selectedStudent)).map(e => ({ date, time: e.time }))
          )
          .sort((a, b) => b.date.localeCompare(a.date))
        return (
          <div onClick={() => setSelectedStudent(null)}
            style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width:'100%', maxWidth:430, maxHeight:'80vh', background:'#fff', borderRadius:'18px 18px 0 0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'16px 20px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>{selectedStudent}</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>총 출석 <span style={{ color:'var(--accent)', fontWeight:700 }}>{studentRecords.length}</span>회</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button type="button"
                    onClick={() => { setAddingEntry(true); setNewDate(TODAY_HYPHEN); setNewAmPm('오후'); setNewHour('3'); setNewMin('00') }}
                    style={{ fontSize:12, padding:'6px 10px', borderRadius:8, border:'1px solid var(--accent)', background:'rgba(79,126,248,0.08)', color:'var(--accent)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    + 추가
                  </button>
                  <button type="button" onClick={() => { setSelectedStudent(null); setAddingEntry(false) }}
                    style={{ fontSize:22, background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
                </div>
              </div>
              {addingEntry && (
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'#f8faff' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', marginBottom:8 }}>날짜</div>
                  <DatePicker value={newDate} onChange={setNewDate} />
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', margin:'12px 0 8px' }}>시간</div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <select value={newAmPm} onChange={e => setNewAmPm(e.target.value)}
                      style={{ flex:1, padding:'8px 6px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, background:'#fff', color:'var(--text)' }}>
                      <option>오전</option><option>오후</option>
                    </select>
                    <select value={newHour} onChange={e => setNewHour(e.target.value)}
                      style={{ flex:1, padding:'8px 6px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, background:'#fff', color:'var(--text)' }}>
                      {Array.from({length:12}, (_,i) => String(i+1)).map(h => <option key={h}>{h}</option>)}
                    </select>
                    <span style={{ fontWeight:700, color:'var(--text3)' }}>:</span>
                    <select value={newMin} onChange={e => setNewMin(e.target.value)}
                      style={{ flex:1, padding:'8px 6px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, background:'#fff', color:'var(--text)' }}>
                      {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button type="button" onClick={() => setAddingEntry(false)}
                      style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--border)', background:'#f3f4f6', color:'var(--text2)', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                      취소
                    </button>
                    <button type="button" onClick={handleAddEntry}
                      style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--accent)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                      추가
                    </button>
                  </div>
                </div>
              )}
              <div style={{ overflowY:'auto', flex:1, padding:'8px 0' }}>
                {studentRecords.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:14 }}>출석 이력이 없습니다.</div>
                ) : studentRecords.map((r, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 20px', borderBottom: i < studentRecords.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{fmtDateLabel(r.date)}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:13, color:'var(--text2)' }}>{fmtTime(r.time)}</span>
                      <button type="button" onClick={() => handleDeleteRecord(r.date, r.time)}
                        style={{ fontSize:11, padding:'3px 9px', borderRadius:6, border:'1px solid #fecaca', background:'#fff5f5', color:'#ef4444', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)' }}>
                <button type="button" onClick={() => { setSelectedStudent(null); setAddingEntry(false) }}
                  style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'var(--accent)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 삭제 확인 모달 ── */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{ position:'fixed', inset:0, zIndex:600, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width:'80%', maxWidth:320, background:'#fff', borderRadius:18, padding:'28px 24px 20px', textAlign:'center' }}
          >
            <div style={{ fontSize:28, marginBottom:10 }}>🗑️</div>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', marginBottom:6 }}>
              {deleteTarget.name} 학생
            </div>
            <div style={{ fontSize:14, color:'var(--text2)', marginBottom:24 }}>
              오늘 출석 기록을 삭제하시겠습니까?<br />
              <span style={{ fontSize:12, color:'var(--text3)' }}>Firebase에서도 함께 삭제됩니다.</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ flex:1, padding:'12px', borderRadius:10, border:'none', background:'#f3f4f6', color:'var(--text2)', fontSize:15, fontWeight:600, cursor:'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                style={{ flex:1, padding:'12px', borderRadius:10, border:'none', background:'#dc2626', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 출석 이력 탭 ── */}
      {tab === 'history' && (
        <div>

          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <button type="button" onClick={importAllSms} disabled={loadingAll}
              style={{ flex:1, padding:'12px', borderRadius:10, border:'none',
                background: loadingAll ? '#93c5fd' : 'var(--accent)', color:'#fff',
                fontSize:14, fontWeight:700, cursor: loadingAll ? 'default' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loadingAll
                ? <><span style={{ fontSize:16 }}>⏳</span> SMS 읽는 중...</>
                : <><span style={{ fontSize:16 }}>📥</span> SMS 새로고침</>}
            </button>
          </div>

          {lastUpdated && (
            <div style={{ marginBottom:6, fontSize:11, color:'var(--text3)', textAlign:'right' }}>
              마지막 갱신: {lastUpdated.getHours().toString().padStart(2,'0')}:{lastUpdated.getMinutes().toString().padStart(2,'0')}:{lastUpdated.getSeconds().toString().padStart(2,'0')}
            </div>
          )}

          {importStat && (
            <div style={{ marginBottom:10, padding:'10px 14px', background:'#f0fdf4', borderRadius:9, fontSize:12, color:'#166534' }}>
              <div style={{ fontWeight:700, marginBottom:2 }}>
                ✅ 전체 저장 이력: <span style={{ color:'#16a34a' }}>{importStat.totalSaved}건</span>
                {importStat.added > 0 && <span style={{ marginLeft:8, color:'#15803d' }}>· 신규 {importStat.added}건 추가됨</span>}
              </div>
              <div style={{ color:'#4b7c5a', marginTop:2 }}>
                SMS 스캔: {importStat.scanned}건 검사 → {importStat.matched}건 매칭 → {importStat.total}건 파싱
              </div>
            </div>
          )}

          {!importStat && totalAllSaved > 0 && (
            <div style={{ marginBottom:10, padding:'8px 14px', background:'#eff6ff', borderRadius:9, fontSize:12, color:'var(--accent)', fontWeight:600 }}>
              저장된 전체 이력: {totalAllSaved}건
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <select value={selYear} onChange={e=>setSelYear(e.target.value)}
              style={{ flex:1, padding:'9px 10px', borderRadius:9, border:'1px solid var(--border)', fontSize:13, background:'#fff', color:'var(--text)' }}>
              {YEAR_OPTS.map(y=><option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={selMon} onChange={e=>setSelMon(e.target.value)}
              style={{ flex:1, padding:'9px 10px', borderRadius:9, border:'1px solid var(--border)', fontSize:13, background:'#fff', color:'var(--text)' }}>
              {MONTHS.map(m=><option key={m} value={m}>{parseInt(m)}월</option>)}
            </select>
          </div>

          {monthTotal > 0 && (
            <div style={{ marginBottom:12, padding:'8px 14px', background:'#eff6ff', borderRadius:9, fontSize:12, color:'var(--accent)', fontWeight:700 }}>
              {selYear}년 {parseInt(selMon)}월 · {filteredDates.length}일 등원 · 총 {monthTotal}건
            </div>
          )}

          {loadingAll && (
            <div style={{ textAlign:'center', padding:'10px 0', color:'var(--text3)', fontSize:12, marginBottom:8 }}>
              문자 전체를 읽어오는 중... (기존 이력은 아래에서 확인 가능합니다)
            </div>
          )}

          {grouped.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text3)', fontSize:14 }}>
              {loadingAll
                ? 'SMS에서 출석 이력을 불러오는 중입니다...'
                : <>{selYear}년 {parseInt(selMon)}월 출석 이력이 없습니다.<br/>
                    <span style={{ fontSize:12, marginTop:4, display:'block' }}>다른 년/월을 선택하거나 SMS 새로고침을 눌러보세요.</span></>
              }
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {grouped.map(({ dateStr, label, entries, isWknd }) => (
                <div key={dateStr} style={{ background:'#fff', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', background: isWknd ? '#fff5f5' : '#f8faff', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, fontWeight:700, color: isWknd ? 'var(--red)' : 'var(--accent)' }}>{label}</span>
                    <span style={{ fontSize:12, color:'var(--text3)', fontWeight:600 }}>{entries.length}명</span>
                  </div>
                  <div style={{ padding:'4px 0' }}>
                    {entries.map((e,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'nowrap', gap:4, padding:'6px 11px', borderBottom: i < entries.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0, flex:1, overflow:'hidden' }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', flexShrink:0 }}>{e.name}</span>
                          {renderAgeBadge(e, dateStr)}
                          <span onClick={() => setSelectedStudent(e.name)}
                            style={{ fontSize:11, color:'#3b82f6', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>
                            총출석 {normTotals[normName(e.name)] || 0}회
                          </span>
                        </div>
                        {/* 오른쪽 끝 묶음 — 시간 먼저, [수정]이 맨 마지막(행의 오른쪽 끝) */}
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
                          <span style={{ fontSize:11, color:'var(--text2)', whiteSpace:'nowrap' }}>{fmtTime(e.time)}</span>
                          <button type="button" onClick={() => { setAddingEntry(false); setSelectedStudent(e.name) }}
                            style={{ fontSize:10, padding:'2px 6px', minWidth:36, flexShrink:0, textAlign:'center', borderRadius:6, border:'1px solid var(--accent)', background:'rgba(79,126,248,0.08)', color:'var(--accent)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                            수정
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -- 수동 출석: 학생 선택 모달 -- */}
      {manualOpen && (
        <div onClick={() => { if (!manualBusy) { setManualOpen(false); setManualSel(null) } }}
          style={{ position:'fixed', inset:0, zIndex:600, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'100%', maxWidth:430, height:'82vh', background:'#fff', borderRadius:'18px 18px 0 0', display:'flex', flexDirection:'column', overflow:'hidden' }}>

            <div style={{ padding:'16px 18px 10px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800 }}>수동 출석</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>키오스크 출첵과 동일한 경로로 처리됩니다</div>
                </div>
                <button type="button" onClick={() => { setManualOpen(false); setManualSel(null) }} disabled={manualBusy}
                  style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text3)' }}>&#10005;</button>
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:5 }}>출석일자</div>
                <DatePicker value={manualDate} onChange={setManualDate} />
                {manualDateKey !== TODAY_STR && (
                  <div style={{ fontSize:11, color:'#b45309', marginTop:5, fontWeight:600 }}>
                    소급 입력 &mdash; {fmtDateLabel(manualDateKey)}
                  </div>
                )}
              </div>

              <input type="text" value={manualSearch} onChange={e => setManualSearch(e.target.value)}
                placeholder="학생 이름 검색 (두 글자만 입력해도 됩니다)" autoFocus
                style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', fontSize:14, borderRadius:10, border:'1px solid var(--border)', outline:'none', background:'#fff', color:'var(--text)' }} />
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'6px 0 20px' }}>
              {!manualSearch.trim() ? (
                <div style={{ padding:'44px 20px', textAlign:'center', color:'var(--text3)', fontSize:13, lineHeight:1.7 }}>
                  학생 이름을 입력하세요.<br />동명이인 구분을 위해 나이와 전화번호가 함께 표시됩니다.
                  <div style={{ marginTop:10, fontSize:11, lineHeight:1.7 }}>
                    전화번호 뒷자리로도 검색할 수 있습니다.<br />
                    상담목록 {(allConsults || []).length}명 조회 가능
                  </div>
                </div>
              ) : manualCandidates.length === 0 ? (
                <div style={{ padding:'44px 20px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                  &lsquo;{manualSearch.trim()}&rsquo; 검색 결과가 없습니다.
                  <div style={{ marginTop:10, fontSize:11, lineHeight:1.7 }}>
                    상담목록 {(allConsults || []).length}명에서 찾았습니다.<br />
                    {(allConsults || []).length === 0
                      ? '목록이 비어 있습니다. 상담목록 탭을 한 번 열어 불러온 뒤 다시 시도하세요.'
                      : '전화번호 뒷자리로도 검색할 수 있습니다.'}
                  </div>
                </div>
              ) : (
                <>
                  {manualCandidates.map(c => {
                    const nm = String(c.name || '').trim()
                    const done = manualAttended.has(normName(nm))
                    const folderName = buildStudentFolderName(nm, c.age, c.savedAt)
                    const bad = !isFullFolderName(folderName)
                    return (
                      <button key={c.id} type="button" disabled={done} onClick={() => setManualSel(c)}
                        style={{ display:'flex', width:'100%', alignItems:'center', justifyContent:'space-between', gap:10, textAlign:'left',
                          padding:'11px 18px', border:'none', borderBottom:'1px solid #f3f4f6', background: done ? '#f9fafb' : '#fff',
                          cursor: done ? 'not-allowed' : 'pointer', opacity: done ? 0.5 : 1 }}>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
                            <span style={{ fontSize:14, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' }}>{nm}</span>
                            <span style={{ padding:'1px 7px', fontSize:11, fontWeight:700, color:'#2563eb', background:'#eef4ff', borderRadius:999, whiteSpace:'nowrap' }}>
                              {String(c.age || '나이없음').trim()}
                            </span>
                            {bad && <span style={{ padding:'1px 7px', fontSize:10, fontWeight:700, color:'#b91c1c', background:'#fee2e2', borderRadius:999, whiteSpace:'nowrap' }}>정보부족</span>}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {c.phone || '번호 없음'} &middot; 총출석 {normTotals[normName(nm)] || 0}회
                          </div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color: done ? 'var(--text3)' : 'var(--accent)', whiteSpace:'nowrap', flexShrink:0 }}>
                          {done ? '등원함' : '선택'}
                        </span>
                      </button>
                    )
                  })}
                  {manualCandidates.length >= 60 && (
                    <div style={{ padding:'12px 18px', fontSize:11, color:'var(--text3)', textAlign:'center' }}>
                      상위 60명만 표시했습니다. 이름을 더 입력해 좁혀주세요.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -- 수동 출석: 확인 다이얼로그 (오조작 방지) -- */}
      {manualSel && (() => {
        const nm = String(manualSel.name || '').trim()
        const folderName = buildStudentFolderName(nm, manualSel.age, manualSel.savedAt)
        return (
          <div style={{ position:'fixed', inset:0, zIndex:700, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ width:'100%', maxWidth:360, background:'#fff', borderRadius:16, padding:'20px 20px 16px' }}>
              <div style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>이 학생을 출석 처리할까요?</div>
              <div style={{ background:'#f9fafb', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                  <span style={{ fontSize:18, fontWeight:800 }}>{nm}</span>
                  <span style={{ padding:'2px 9px', fontSize:12, fontWeight:700, color:'#2563eb', background:'#eef4ff', borderRadius:999 }}>
                    {String(manualSel.age || '나이없음').trim()}
                  </span>
                </div>
                <div style={{ fontSize:12, color:'var(--text2)', marginBottom:3 }}>{fmtDateLabel(manualDateKey)}</div>
                <div style={{ fontSize:11, color:'var(--text3)', wordBreak:'break-all' }}>폴더명: {folderName}</div>
                {(() => {
                  const willSend = manualDateKey === TODAY_STR && !!manualSel.phone
                  return (
                    <div style={{ marginTop:6, fontSize:11, fontWeight:700, color: willSend ? '#b45309' : 'var(--text3)' }}>
                      {willSend
                        ? `학부모 문자 발송됩니다 → ${manualSel.phone}`
                        : manualDateKey !== TODAY_STR
                          ? '소급 날짜 — 학부모 문자 발송 안 함'
                          : '전화번호 없음 — 학부모 문자 발송 안 함'}
                    </div>
                  )
                })()}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={() => setManualSel(null)} disabled={manualBusy}
                  style={{ flex:1, padding:'11px 0', borderRadius:10, border:'1px solid var(--border)', background:'#f3f4f6', color:'var(--text2)', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  취소
                </button>
                <button type="button" onClick={() => runManualAttendance(manualSel)} disabled={manualBusy}
                  style={{ flex:2, padding:'11px 0', borderRadius:10, border:'none', background:'var(--accent)', color:'#fff', fontSize:14, fontWeight:700, cursor: manualBusy ? 'wait' : 'pointer', opacity: manualBusy ? 0.6 : 1 }}>
                  {manualBusy ? '처리 중...' : '출석 처리'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* -- 수동 출석: 결과 다이얼로그 (확인을 눌러야 닫힘) -- */}
      {resultDlg && (() => {
        const tone = resultDlg.tone
        const accent = tone === 'warn' ? '#d97706' : tone === 'error' ? '#dc2626' : '#2563eb'
        const bg     = tone === 'warn' ? '#fffbeb' : tone === 'error' ? '#fef2f2' : '#eff6ff'
        return (
          <div style={{ position:'fixed', inset:0, zIndex:800, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ width:'100%', maxWidth:380, background:'#fff', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:bg, borderBottom:`2px solid ${accent}`, padding:'14px 18px' }}>
                <div style={{ fontSize:16, fontWeight:800, color:accent }}>{resultDlg.title}</div>
              </div>
              <div style={{ padding:'16px 18px' }}>
                {resultDlg.body.map((line, i) => (
                  <div key={i} style={{ fontSize:13, color:'var(--text)', lineHeight:1.65, marginBottom:7 }}>{line}</div>
                ))}
                {resultDlg.detail && (
                  <div style={{ marginTop:10, padding:'9px 11px', background:'#f3f4f6', borderRadius:8, fontSize:12, color:'var(--text2)', wordBreak:'break-all' }}>
                    <span style={{ fontWeight:700, color:'var(--text3)' }}>서버 메시지: </span>{resultDlg.detail}
                  </div>
                )}
              </div>
              <div style={{ padding:'0 18px 18px' }}>
                <button type="button" onClick={() => setResultDlg(null)}
                  style={{ width:'100%', padding:'12px 0', borderRadius:10, border:'none', background:accent, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* -- 수동 출석: 성공 토스트 -- */}
      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:900, background:'#1e293b', color:'#fff', padding:'11px 18px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 4px 16px rgba(0,0,0,0.3)', whiteSpace:'nowrap', pointerEvents:'none' }}>
          {toast}
        </div>
      )}

    </div>
  )
}
