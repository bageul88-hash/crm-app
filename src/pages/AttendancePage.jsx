import { useState, useEffect, useCallback, useRef } from 'react'
import { checkSmsPermission, requestSmsPermission, readSmsHistory } from '../hooks/useSmsAttendance'

const TODAY      = new Date()
const TODAY_STR  = `${TODAY.getFullYear()}${String(TODAY.getMonth()+1).padStart(2,'0')}${String(TODAY.getDate()).padStart(2,'0')}`
const TODAY_YEAR = String(TODAY.getFullYear())
const TODAY_MON  = String(TODAY.getMonth()+1).padStart(2,'0')
const TODAY_LABEL = `${TODAY.getFullYear()}년 ${TODAY.getMonth()+1}월 ${TODAY.getDate()}일 (${['일','월','화','수','목','금','토'][TODAY.getDay()]})`
const DAYS_KR     = ['일','월','화','수','목','금','토']

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2,'0')}`
}

function toEntry(raw) {
  return typeof raw === 'string' ? { name: raw, time: null } : raw
}

function hasEntry(list, name) {
  return (list || []).some(e => toEntry(e).name === name)
}

export default function AttendancePage() {
  const [students, setStudents]     = useState([])
  const [records, setRecords]       = useState({})
  const [newName, setNewName]       = useState('')
  const [search, setSearch]         = useState('')
  const [tab, setTab]               = useState('attend')
  const [selectedYear, setSelectedYear]   = useState(TODAY_YEAR)
  const [selectedMonth, setSelectedMonth] = useState(TODAY_MON)
  const [smsNotice, setSmsNotice]         = useState(null)
  const [smsImporting, setSmsImporting]   = useState(false)
  const [smsResult, setSmsResult]         = useState(null)
  const [smsError, setSmsError]           = useState(null)
  const [historyImporting, setHistoryImporting] = useState(false)
  const [lastImportTime, setLastImportTime]     = useState(null)
  const [permDenied, setPermDenied] = useState(false)
  const [log, setLog]               = useState([])
  const [showLog, setShowLog]       = useState(false)
  const [processing, setProcessing] = useState(false)
  const [copyDone, setCopyDone]     = useState(false)
  const importingRef                = useRef(false)

  // 초기 데이터 로드
  useEffect(() => {
    const savedStudents = localStorage.getItem('attendance_students')
    const savedRecords  = localStorage.getItem('attendance_records')
    const lastDate      = localStorage.getItem('attendance_last_date')

    if (savedStudents) {
      const parsed = JSON.parse(savedStudents)
      if (lastDate !== TODAY_STR) {
        const reset = parsed.map(s => ({ ...s, checked: false, done: false }))
        setStudents(reset)
        localStorage.setItem('attendance_students', JSON.stringify(reset))
        localStorage.setItem('attendance_last_date', TODAY_STR)
      } else {
        setStudents(parsed)
      }
    }
    if (savedRecords) setRecords(JSON.parse(savedRecords))
  }, [])

  // SMS 전체 이력 자동 불러오기 (중복 방지 포함)
  const autoImportSms = async () => {
    if (importingRef.current) return
    importingRef.current = true
    setHistoryImporting(true)
    try {
      let hasPerm = await checkSmsPermission()
      if (!hasPerm) hasPerm = await requestSmsPermission()
      if (!hasPerm) { setPermDenied(true); return }

      const items = await readSmsHistory(5000)
      console.log('[이력] SMS 항목:', items.length, '건')

      if (items.length > 0) {
        const saved = localStorage.getItem('attendance_records')
        const recs  = saved ? JSON.parse(saved) : {}
        let changed = false
        items.forEach(({ studentName, date, time }) => {
          if (!hasEntry(recs[date], studentName)) {
            recs[date] = [...(recs[date] || []), { name: studentName, time: time || null }]
            changed = true
          }
        })
        if (changed) {
          localStorage.setItem('attendance_records', JSON.stringify(recs))
          setRecords({ ...recs })
        }
      }
      setLastImportTime(new Date())
    } finally {
      importingRef.current = false
      setHistoryImporting(false)
    }
  }

  // 앱 첫 실행 시 권한 있으면 자동 불러오기
  useEffect(() => {
    checkSmsPermission().then(hasPerm => { if (hasPerm) autoImportSms() })
  }, [])

  // 출석 이력 탭 진입 시 자동 불러오기
  useEffect(() => {
    if (tab === 'history') autoImportSms()
  }, [tab])

  // 실시간 SMS 등원 감지
  useEffect(() => {
    const handler = (e) => {
      const { studentName, time } = e.detail
      console.log('[출석] 실시간 등원 이벤트:', studentName, time)
      const entry = { name: studentName, time: time || null }
      setRecords(prev => {
        const updated = { ...prev }
        if (!hasEntry(updated[TODAY_STR], studentName)) {
          updated[TODAY_STR] = [...(updated[TODAY_STR] || []), entry]
          localStorage.setItem('attendance_records', JSON.stringify(updated))
        }
        return updated
      })
      setStudents(prev => prev.map(s =>
        s.name === studentName ? { ...s, done: true, checked: false } : s
      ))
      setSmsNotice({ name: studentName, time })
      setTimeout(() => setSmsNotice(null), 5000)
    }
    window.addEventListener('smsAttendance', handler)
    return () => window.removeEventListener('smsAttendance', handler)
  }, [])

  const persistStudents = useCallback((list) => {
    localStorage.setItem('attendance_students', JSON.stringify(list))
    setStudents(list)
  }, [])

  const persistRecords = useCallback((recs) => {
    localStorage.setItem('attendance_records', JSON.stringify(recs))
    setRecords(recs)
  }, [])

  const addStudent = () => {
    const name = newName.trim()
    if (!name) return
    if (students.find(s => s.name === name)) { alert('이미 있는 학생입니다.'); return }
    persistStudents([...students, { id: Date.now(), name, checked: false, done: false }])
    setNewName('')
  }

  const removeStudent = (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    persistStudents(students.filter(s => s.id !== id))
  }

  // 학생 관리 탭: 수동 SMS 불러오기 (신규 학생 자동 등록 + 결과 통계)
  const importFromSms = async () => {
    console.log('[출석] 수동 SMS 불러오기 클릭')
    setSmsError(null)
    setSmsResult(null)

    let hasPerm = false
    try { hasPerm = await checkSmsPermission() } catch (e) { console.error(e) }
    if (!hasPerm) {
      try { hasPerm = await requestSmsPermission() } catch (e) { console.error(e) }
    }
    if (!hasPerm) { setPermDenied(true); return }

    setSmsImporting(true)
    let items = []
    try {
      items = await readSmsHistory(5000)
    } catch (e) {
      setSmsError('SMS 읽기 중 오류가 발생했습니다: ' + e)
      setSmsImporting(false)
      return
    }
    console.log('[출석] 읽어온 항목:', items.length)

    if (items.length === 0) {
      setSmsResult({ added: 0, dup: 0, newStudents: 0, total: 0 })
      setSmsImporting(false)
      return
    }

    const saved = localStorage.getItem('attendance_records')
    const newRecords = saved ? JSON.parse(saved) : {}
    let addedCount = 0, dupCount = 0
    const allNames = new Set()

    items.forEach(({ studentName, date, time }) => {
      allNames.add(studentName)
      if (!hasEntry(newRecords[date], studentName)) {
        newRecords[date] = [...(newRecords[date] || []), { name: studentName, time: time || null }]
        addedCount++
      } else {
        dupCount++
      }
    })

    const existingNames = new Set(students.map(s => s.name))
    const toAdd = [...allNames]
      .filter(n => !existingNames.has(n))
      .map(n => ({ id: Date.now() + Math.random(), name: n, checked: false, done: false }))

    if (toAdd.length > 0) {
      const newList = [...students, ...toAdd]
      localStorage.setItem('attendance_students', JSON.stringify(newList))
      setStudents(newList)
    }

    localStorage.setItem('attendance_records', JSON.stringify(newRecords))
    setRecords({ ...newRecords })
    setSmsResult({ added: addedCount, dup: dupCount, newStudents: toAdd.length, total: items.length })
    setSmsImporting(false)
  }

  const toggle      = (id) => persistStudents(students.map(s => s.id === id ? { ...s, checked: !s.checked } : s))
  const selectAll   = () => persistStudents(students.map(s => ({ ...s, checked: true })))
  const deselectAll = () => persistStudents(students.map(s => ({ ...s, checked: false })))

  const runAttendance = async () => {
    const selected = students.filter(s => s.checked)
    if (!selected.length) { alert('출석할 학생을 선택해주세요.'); return }
    if (!confirm(`오늘(${TODAY_STR}) 출석 처리할 학생 ${selected.length}명\n\n${selected.map(s => '✔ ' + s.name).join('\n')}\n\n계속하시겠습니까?`)) return

    setProcessing(true)
    const lines = []
    lines.push(`[${new Date().toLocaleTimeString()}] 출석 처리 시작`)
    lines.push(`날짜 폴더: ${TODAY_STR}`)
    lines.push('─'.repeat(28))

    try {
      await navigator.clipboard.writeText(selected.map(s => s.name).join('\n'))
      lines.push('📋 클립보드 복사 완료!')
      lines.push('')
      selected.forEach(s => lines.push(`  ✔ ${s.name}`))
      lines.push('')
      lines.push('💡 PC의 출석관리.py를 실행하여')
      lines.push('   위 학생을 선택하면 폴더가')
      lines.push('   자동 이동됩니다.')
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 3000)
    } catch {
      lines.push('⚠️ 클립보드 복사 실패')
      selected.forEach(s => lines.push(`  • ${s.name}`))
    }

    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    const newRecs = { ...records }
    selected.forEach(s => {
      if (!hasEntry(newRecs[TODAY_STR], s.name))
        newRecs[TODAY_STR] = [...(newRecs[TODAY_STR] || []), { name: s.name, time: timeStr }]
    })
    persistRecords(newRecs)

    lines.push('─'.repeat(28))
    lines.push(`출석 ${selected.length}명 처리 완료`)
    persistStudents(students.map(s => s.checked ? { ...s, done: true, checked: false } : s))
    setLog(lines)
    setShowLog(true)
    setProcessing(false)
  }

  // 파생 데이터
  const allDates       = Object.keys(records).sort().reverse()
  const filteredDates  = (selectedYear && selectedMonth)
    ? allDates.filter(d => d.startsWith(selectedYear + selectedMonth))
    : []
  const totalForPeriod = filteredDates.reduce((sum, d) => sum + (records[d]?.length || 0), 0)
  const filtered       = students.filter(s => s.name.includes(search.trim()))
  const checkedCount   = students.filter(s => s.checked).length
  const doneCount      = students.filter(s => s.done).length
  const totalCount     = students.length

  const SmsResultBox = () => {
    if (smsError) return (
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13, color: 'var(--red)' }}>
        ⚠️ {smsError}
      </div>
    )
    if (!smsResult) return null
    return (
      <div style={{ marginTop: 10, fontSize: 13 }}>
        {smsResult.total === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '6px 0' }}>
            "[참바른글씨]" 등원 문자가 없습니다.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(22,163,74,0.1)', color: 'var(--green)', fontWeight: 600 }}>
                ✅ {smsResult.added}건 새로 저장
              </span>
              {smsResult.dup > 0 && (
                <span style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--surface)', color: 'var(--text3)' }}>
                  {smsResult.dup}건 중복 제외
                </span>
              )}
              {smsResult.newStudents > 0 && (
                <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', fontWeight: 600 }}>
                  +{smsResult.newStudents}명 자동 등록
                </span>
              )}
            </div>
            <button className="btn btn-ghost btn-full btn-sm" onClick={() => setTab('history')}>
              📅 출석 이력 탭에서 날짜별 상세 보기
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ padding: '16px 16px 24px' }}>

      {/* 날짜 카드 */}
      <div style={{
        background: 'var(--accent)', borderRadius: 'var(--radius)',
        padding: '16px 18px', marginBottom: 16, color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>오늘 출석일</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{TODAY_LABEL}</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>폴더명: {TODAY_STR}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{doneCount}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>/{totalCount}명 처리됨</div>
        </div>
      </div>

      {/* 실시간 SMS 등원 알림 */}
      {smsNotice && (
        <div style={{
          background: 'rgba(22,163,74,0.12)', border: '1px solid var(--green)',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, color: 'var(--green)', fontWeight: 600,
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span>
            {smsNotice.name} 학생 등원 문자 감지
            {smsNotice.time && <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.8 }}>({formatTime(smsNotice.time)})</span>}
          </span>
        </div>
      )}

      {/* SMS 권한 없음 모달 */}
      {permDenied && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setPermDenied(false)}>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: 24,
            maxWidth: 320, width: '100%',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>📵</div>
            <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 10, color: 'var(--text)' }}>
              SMS 읽기 권한이 필요합니다
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.9, marginBottom: 20 }}>
              "[참바른글씨]" 등원 문자를 자동으로 읽으려면 SMS 읽기 권한이 필요합니다.
              <br /><br />
              <strong style={{ color: 'var(--text2)' }}>권한 허용 방법</strong><br />
              설정 → 앱 → CRM → 권한 → 문자 메시지 → 허용
              <br /><br />
              권한 허용 후 다시 시도해주세요.
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setPermDenied(false)}>확인</button>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{
        display: 'flex', background: 'var(--surface)',
        borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 16,
      }}>
        {[['attend','✔ 출석 체크'],['history','📅 출석 이력'],['manage','👥 학생 관리']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '7px 4px', border: 'none', borderRadius: 7,
            fontSize: 12, fontWeight: tab === key ? 600 : 400, cursor: 'pointer',
            background: tab === key ? 'var(--bg2)' : 'transparent',
            color: tab === key ? 'var(--accent)' : 'var(--text3)',
            boxShadow: tab === key ? 'var(--shadow)' : 'none',
            transition: 'all 0.15s', fontFamily: 'var(--font)',
          }}>{label}</button>
        ))}
      </div>

      {/* ──────────── 출석 체크 탭 ──────────── */}
      {tab === 'attend' && (<>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text3)', fontSize: 15, pointerEvents: 'none',
          }}>🔍</span>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="학생 검색" style={{ paddingLeft: 36 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={selectAll}>✅ 전체 선택</button>
          <button className="btn btn-ghost btn-sm" onClick={deselectAll}>☐ 전체 해제</button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            {checkedCount}명 선택
          </span>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              {totalCount === 0 ? '👥 학생 관리 탭에서 학생을 추가해주세요.' : '검색 결과가 없습니다.'}
            </div>
          ) : filtered.map((s, i) => (
            <div key={s.id} onClick={() => !s.done && toggle(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              cursor: s.done ? 'default' : 'pointer',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              background: s.done ? 'rgba(22,163,74,0.05)' : s.checked ? 'rgba(37,99,235,0.05)' : 'transparent',
              transition: 'background 0.15s',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: s.done ? 'none' : s.checked ? 'none' : '2px solid var(--border)',
                background: s.done ? 'var(--green)' : s.checked ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {(s.checked || s.done) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{
                flex: 1, fontSize: 15,
                color: s.done ? 'var(--text3)' : s.checked ? 'var(--accent)' : 'var(--text)',
                fontWeight: s.checked ? 600 : 400,
                textDecoration: s.done ? 'line-through' : 'none',
              }}>{s.name}</span>
              {s.done && (
                <span className="badge" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--green)', fontSize: 11 }}>처리완료</span>
              )}
            </div>
          ))}
        </div>

        <button
          className={`btn btn-full ${checkedCount > 0 ? 'btn-primary' : 'btn-ghost'}`}
          onClick={runAttendance}
          disabled={processing || checkedCount === 0}
          style={{ padding: '14px', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
          {processing ? '처리 중...' : copyDone ? '📋 클립보드에 복사됨!' : `🚀 출석 처리 실행 (${checkedCount}명)`}
        </button>

        <div className="card" style={{ background: 'var(--bg3)', borderStyle: 'dashed' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.9 }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>📌 사용 방법</div>
            <div>① 오늘 출석한 학생을 체크 선택</div>
            <div>② <strong>출석 처리 실행</strong> 클릭 → 이름 클립보드 복사</div>
            <div>③ PC에서 <strong>출석관리.py</strong> 실행</div>
            <div>④ 해당 학생 선택 후 폴더 자동 이동</div>
          </div>
        </div>

        {showLog && (
          <div style={{
            marginTop: 12, background: '#0d0d1a', borderRadius: 'var(--radius)',
            padding: '14px 16px', border: '1px solid #1e2d40',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64ffda', fontWeight: 600 }}>처리 로그</span>
              <button onClick={() => setShowLog(false)} style={{
                background: 'none', border: 'none', color: '#a8b2d8',
                cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
              }}>닫기 ✕</button>
            </div>
            {log.map((line, i) => (
              <div key={i} style={{ fontSize: 12, color: '#64ffda', fontFamily: 'monospace', lineHeight: 1.85 }}>
                {line || ' '}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ──────────── 출석 이력 탭 ──────────── */}
      {tab === 'history' && (<>

        {/* 년도/월 선택 + 새로고침 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="input"
              style={{ flex: 1 }}
            >
              <option value="">년도 선택</option>
              {['2024','2025','2026', String(TODAY.getFullYear())]
                .filter((v,i,a) => a.indexOf(v) === i).sort()
                .map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="input"
              style={{ flex: 1 }}
            >
              <option value="">월 선택</option>
              {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0'))
                .map(m => <option key={m} value={m}>{parseInt(m)}월</option>)}
            </select>
            <button
              onClick={autoImportSms}
              disabled={historyImporting}
              title="SMS 새로고침"
              style={{
                flexShrink: 0, width: 42, height: 42,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)', cursor: historyImporting ? 'not-allowed' : 'pointer',
                fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {historyImporting ? '⏳' : '🔄'}
            </button>
          </div>

          {historyImporting && (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
              SMS 문자를 읽어오고 있습니다...
            </div>
          )}
          {lastImportTime && !historyImporting && (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 6 }}>
              마지막 업데이트: {lastImportTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* 결과 표시 */}
        {selectedYear && selectedMonth ? (<>
          {filteredDates.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, padding: '40px 16px', lineHeight: 2 }}>
              {selectedYear}년 {parseInt(selectedMonth)}월<br />
              {historyImporting ? 'SMS를 읽어오는 중...' : '출석 기록이 없습니다.'}
            </div>
          ) : (<>
            <div style={{
              fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{selectedYear}년 {parseInt(selectedMonth)}월</span>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>
                {filteredDates.length}일 · 총 {totalForPeriod}명
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredDates.map(dateStr => {
                const entries = (records[dateStr] || []).map(toEntry)
                const y  = dateStr.slice(0,4)
                const mo = dateStr.slice(4,6)
                const d  = dateStr.slice(6,8)
                const dow = new Date(parseInt(y), parseInt(mo)-1, parseInt(d)).getDay()
                const isWeekend = dow === 0 || dow === 6
                return (
                  <div key={dateStr} className="card" style={{ padding: '12px 16px' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: entries.length > 0 ? 10 : 0,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: isWeekend ? 'var(--red)' : 'var(--text)' }}>
                        {parseInt(y)}년 {parseInt(mo)}월 {parseInt(d)}일 ({DAYS_KR[dow]})
                      </span>
                      <span className="badge">{entries.length}명</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {entries.map((entry, idx) => (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', borderRadius: 8,
                          background: 'rgba(37,99,235,0.06)',
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>
                            {entry.name}
                          </span>
                          {entry.time && (
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                              {formatTime(entry.time)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}
        </>) : (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '32px 0', lineHeight: 2 }}>
            년도와 월을 선택하면<br />출석 이력이 표시됩니다.
          </div>
        )}
      </>)}

      {/* ──────────── 학생 관리 탭 ──────────── */}
      {tab === 'manage' && (<>

        {/* SMS 이력 불러오기 */}
        <div className="card" style={{ marginBottom: 14 }}>
          <label className="label">📱 SMS 출석 이력 불러오기</label>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 10px', lineHeight: 1.6 }}>
            "[참바른글씨]" 등원 문자에서 학생 이름과 날짜를 자동으로 읽어옵니다.<br />
            신규 학생은 자동 등록됩니다.
          </p>
          <button
            className={`btn ${smsImporting ? 'btn-ghost' : 'btn-primary'} btn-full`}
            onClick={importFromSms}
            disabled={smsImporting}
          >
            {smsImporting ? '📨 불러오는 중...' : '📨 SMS 이력 불러오기'}
          </button>
          <SmsResultBox />
        </div>

        {/* 학생 추가 */}
        <div className="card" style={{ marginBottom: 14 }}>
          <label className="label">학생 추가</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStudent()}
              placeholder="이름 입력 후 추가 또는 Enter"
              style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={addStudent} style={{ flexShrink: 0 }}>추가</button>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>전체 학생</span>
            <span className="badge badge-등록">{totalCount}명</span>
          </div>
          {students.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              등록된 학생이 없습니다.
            </div>
          ) : students.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 15, flex: 1, color: 'var(--text)' }}>{s.name}</span>
              {s.done && (
                <span className="badge" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--green)', fontSize: 11 }}>오늘출석</span>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => removeStudent(s.id)}>삭제</button>
            </div>
          ))}
        </div>

        {students.length > 0 && (
          <button
            className="btn btn-ghost btn-full btn-sm"
            style={{ marginTop: 12, color: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={() => {
              if (confirm('오늘 출석 처리 기록을 초기화하시겠습니까?\n(학생 목록은 유지됩니다)'))
                persistStudents(students.map(s => ({ ...s, checked: false, done: false })))
            }}>
            오늘 출석 기록 초기화
          </button>
        )}
      </>)}

    </div>
  )
}
