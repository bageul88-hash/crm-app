import { useState, useEffect, useCallback, useRef } from 'react'
import { checkSmsPermission, requestSmsPermission, readSmsHistory } from '../hooks/useSmsAttendance'

const TODAY      = new Date()
const TODAY_STR  = `${TODAY.getFullYear()}${String(TODAY.getMonth()+1).padStart(2,'0')}${String(TODAY.getDate()).padStart(2,'0')}`
const TODAY_YEAR = String(TODAY.getFullYear())
const TODAY_MON  = String(TODAY.getMonth()+1).padStart(2,'0')
const TODAY_LABEL = `${TODAY.getFullYear()}년 ${TODAY.getMonth()+1}월 ${TODAY.getDate()}일 (${['일','월','화','수','목','금','토'][TODAY.getDay()]})`
const DAYS_KR     = ['일','월','화','수','목','금','토']

function formatTime(t) {
  if (!t) return '-'
  const [h, m] = t.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2,'0')}`
}
function toEntry(raw) { return typeof raw === 'string' ? { name: raw, time: null } : raw }
function hasEntry(list, name) { return (list || []).some(e => toEntry(e).name === name) }
function formatDateShort(dateStr) {
  const mo  = parseInt(dateStr.slice(4, 6))
  const d   = parseInt(dateStr.slice(6, 8))
  const dow = new Date(parseInt(dateStr.slice(0, 4)), mo - 1, d).getDay()
  return `${mo}/${d}(${DAYS_KR[dow]})`
}

const TH_STYLE = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', background: 'var(--surface)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
const tdStyle  = (extra = {}) => ({ padding: '10px 12px', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', ...extra })

export default function AttendancePage() {
  const [students, setStudents]           = useState([])
  const [records, setRecords]             = useState({})
  const [newName, setNewName]             = useState('')
  const [tab, setTab]                     = useState('attend')
  const [selectedYear, setSelectedYear]   = useState(TODAY_YEAR)
  const [selectedMonth, setSelectedMonth] = useState(TODAY_MON)
  const [smsNotice, setSmsNotice]         = useState(null)
  const [smsImporting, setSmsImporting]   = useState(false)
  const [smsResult, setSmsResult]         = useState(null)
  const [smsError, setSmsError]           = useState(null)
  const [historyImporting, setHistoryImporting] = useState(false)
  const [lastImportTime, setLastImportTime]     = useState(null)
  const [permDenied, setPermDenied]       = useState(false)
  const importingRef                      = useRef(false)

  useEffect(() => {
    const saved  = localStorage.getItem('attendance_students')
    const savedR = localStorage.getItem('attendance_records')
    const lastDate = localStorage.getItem('attendance_last_date')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (lastDate !== TODAY_STR) {
        const reset = parsed.map(s => ({ ...s, checked: false, done: false }))
        setStudents(reset)
        localStorage.setItem('attendance_students', JSON.stringify(reset))
        localStorage.setItem('attendance_last_date', TODAY_STR)
      } else { setStudents(parsed) }
    }
    if (savedR) setRecords(JSON.parse(savedR))
  }, [])

  const autoImportSms = async () => {
    if (importingRef.current) return
    importingRef.current = true
    setHistoryImporting(true)
    try {
      let hasPerm = await checkSmsPermission()
      if (!hasPerm) hasPerm = await requestSmsPermission()
      if (!hasPerm) { setPermDenied(true); return }
      const items = await readSmsHistory(5000)
      if (items.length > 0) {
        const savedR = localStorage.getItem('attendance_records')
        const recs = savedR ? JSON.parse(savedR) : {}
        let changed = false
        items.forEach(({ studentName, date, time }) => {
          if (!hasEntry(recs[date], studentName)) {
            recs[date] = [...(recs[date] || []), { name: studentName, time: time || null }]
            changed = true
          }
        })
        if (changed) { localStorage.setItem('attendance_records', JSON.stringify(recs)); setRecords({ ...recs }) }
      }
      setLastImportTime(new Date())
    } finally { importingRef.current = false; setHistoryImporting(false) }
  }

  useEffect(() => { checkSmsPermission().then(p => { if (p) autoImportSms() }) }, [])
  useEffect(() => { if (tab === 'attend') autoImportSms() }, [tab])

  useEffect(() => {
    const handler = (e) => {
      const { studentName, time } = e.detail
      const entry = { name: studentName, time: time || null }
      setRecords(prev => {
        const updated = { ...prev }
        if (!hasEntry(updated[TODAY_STR], studentName)) {
          updated[TODAY_STR] = [...(updated[TODAY_STR] || []), entry]
          localStorage.setItem('attendance_records', JSON.stringify(updated))
        }
        return updated
      })
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

  const importFromSms = async () => {
    setSmsError(null); setSmsResult(null)
    let hasPerm = false
    try { hasPerm = await checkSmsPermission() } catch {}
    if (!hasPerm) { try { hasPerm = await requestSmsPermission() } catch {} }
    if (!hasPerm) { setPermDenied(true); return }
    setSmsImporting(true)
    let items = []
    try { items = await readSmsHistory(5000) } catch (e) {
      setSmsError('SMS 읽기 오류: ' + e); setSmsImporting(false); return
    }
    if (items.length === 0) {
      setSmsResult({ added: 0, dup: 0, newStudents: 0, total: 0 }); setSmsImporting(false); return
    }
    const savedR = localStorage.getItem('attendance_records')
    const newRecs = savedR ? JSON.parse(savedR) : {}
    let added = 0, dup = 0
    const allNames = new Set()
    items.forEach(({ studentName, date, time }) => {
      allNames.add(studentName)
      if (!hasEntry(newRecs[date], studentName)) {
        newRecs[date] = [...(newRecs[date] || []), { name: studentName, time: time || null }]; added++
      } else dup++
    })
    const existingNames = new Set(students.map(s => s.name))
    const toAdd = [...allNames].filter(n => !existingNames.has(n))
      .map(n => ({ id: Date.now() + Math.random(), name: n, checked: false, done: false }))
    if (toAdd.length > 0) {
      const nl = [...students, ...toAdd]
      localStorage.setItem('attendance_students', JSON.stringify(nl)); setStudents(nl)
    }
    localStorage.setItem('attendance_records', JSON.stringify(newRecs))
    setRecords({ ...newRecs })
    setSmsResult({ added, dup, newStudents: toAdd.length, total: items.length })
    setSmsImporting(false)
  }

  const todayEntries  = (records[TODAY_STR] || []).map(toEntry)
  const allDates      = Object.keys(records).sort().reverse()
  const filteredDates = (selectedYear && selectedMonth)
    ? allDates.filter(d => d.startsWith(selectedYear + selectedMonth)) : []
  const historyRows   = filteredDates.flatMap(dateStr =>
    (records[dateStr] || []).map((raw, idx) => ({
      dateStr, idx, dateLabel: formatDateShort(dateStr), ...toEntry(raw),
    }))
  )

  return (
    <div className="fade-in" style={{ padding: '16px 16px 32px' }}>

      {/* 날짜 카드 */}
      <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 14, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>오늘 출석일</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{TODAY_LABEL}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{todayEntries.length}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>명 등원</div>
        </div>
      </div>

      {/* 실시간 등원 알림 */}
      {smsNotice && (
        <div style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '11px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>
          <span>✅</span>
          <span>{smsNotice.name} 학생 등원{smsNotice.time && <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.8 }}>({formatTime(smsNotice.time)})</span>}</span>
        </div>
      )}

      {/* 권한 없음 모달 */}
      {permDenied && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setPermDenied(false)}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: 24, maxWidth: 320, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>📵</div>
            <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: 'var(--text)' }}>SMS 읽기 권한이 필요합니다</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.9, marginBottom: 20 }}>설정 → 앱 → CRM → 권한 → 문자 메시지 → 허용 후 다시 시도해주세요.</div>
            <button className="btn btn-primary btn-full" onClick={() => setPermDenied(false)}>확인</button>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 16 }}>
        {[['attend','📋 출석 현황'],['manage','👥 학생 관리']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: tab === key ? 600 : 400, cursor: 'pointer', background: tab === key ? 'var(--bg2)' : 'transparent', color: tab === key ? 'var(--accent)' : 'var(--text3)', boxShadow: tab === key ? 'var(--shadow)' : 'none', transition: 'all 0.15s', fontFamily: 'var(--font)' }}>{label}</button>
        ))}
      </div>

      {/* ── 출석 현황 탭 ── */}
      {tab === 'attend' && (<>

        {/* 오늘 등원 현황 표 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>오늘 등원 현황</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {historyImporting && <span style={{ fontSize: 11, color: 'var(--text3)' }}>불러오는 중...</span>}
              <button onClick={autoImportSms} disabled={historyImporting} title="SMS 새로고침"
                style={{ width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: historyImporting ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {historyImporting ? '⏳' : '🔄'}
              </button>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>이름</th>
                  <th style={{ ...TH_STYLE, textAlign: 'right' }}>등원시간</th>
                </tr>
              </thead>
              <tbody>
                {todayEntries.length === 0 ? (
                  <tr><td colSpan={2} style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                    {historyImporting ? 'SMS를 읽어오고 있습니다...' : '오늘 등원한 학생이 없습니다.'}
                  </td></tr>
                ) : todayEntries.map((entry, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(37,99,235,0.02)' }}>
                    <td style={tdStyle({ fontWeight: 500 })}>{entry.name}</td>
                    <td style={tdStyle({ textAlign: 'right', color: 'var(--text3)', fontSize: 13 })}>{formatTime(entry.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lastImportTime && (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 5 }}>
              업데이트: {lastImportTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* 출석 이력 조회 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>출석 이력 조회</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="input" style={{ flex: 1 }}>
              <option value="">년도</option>
              {['2024','2025','2026', String(TODAY.getFullYear())].filter((v,i,a) => a.indexOf(v) === i).sort().map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input" style={{ flex: 1 }}>
              <option value="">월</option>
              {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(m => <option key={m} value={m}>{parseInt(m)}월</option>)}
            </select>
          </div>
          {selectedYear && selectedMonth ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {historyRows.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  {selectedYear}년 {parseInt(selectedMonth)}월 출석 기록이 없습니다.
                </div>
              ) : (<>
                <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{selectedYear}년 {parseInt(selectedMonth)}월</span>
                  <span>총 {historyRows.length}건 · {filteredDates.length}일</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH_STYLE, width: '28%' }}>날짜</th>
                      <th style={TH_STYLE}>이름</th>
                      <th style={{ ...TH_STYLE, textAlign: 'right' }}>등원시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row, i) => {
                      const isFirst = row.idx === 0
                      const mo  = parseInt(row.dateStr.slice(4,6))
                      const d   = parseInt(row.dateStr.slice(6,8))
                      const dow = new Date(parseInt(row.dateStr.slice(0,4)), mo-1, d).getDay()
                      const isWeekend = dow === 0 || dow === 6
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(37,99,235,0.02)', borderTop: isFirst && i > 0 ? '2px solid var(--border)' : undefined }}>
                          <td style={tdStyle({ fontSize: 13, fontWeight: isFirst ? 600 : 400, color: isFirst ? (isWeekend ? 'var(--red)' : 'var(--text)') : 'transparent' })}>
                            {isFirst ? row.dateLabel : ''}
                          </td>
                          <td style={tdStyle({ fontWeight: 500 })}>{row.name}</td>
                          <td style={tdStyle({ textAlign: 'right', color: 'var(--text3)', fontSize: 13 })}>{formatTime(row.time)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '24px 0', lineHeight: 2 }}>년도와 월을 선택하면 출석 이력이 표시됩니다.</div>
          )}
        </div>
      </>)}

      {/* ── 학생 관리 탭 ── */}
      {tab === 'manage' && (<>

        <div className="card" style={{ marginBottom: 14 }}>
          <label className="label">📱 SMS 출석 이력 불러오기</label>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 10px', lineHeight: 1.6 }}>
            "[참바른글씨]" 등원 문자에서 학생 이름·날짜를 읽어옵니다. 신규 학생은 자동 등록됩니다.
          </p>
          <button className={`btn ${smsImporting ? 'btn-ghost' : 'btn-primary'} btn-full`} onClick={importFromSms} disabled={smsImporting}>
            {smsImporting ? '📨 불러오는 중...' : '📨 SMS 이력 불러오기'}
          </button>
          {smsError && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--red)' }}>⚠️ {smsError}</div>}
          {smsResult && (
            <div style={{ marginTop: 10, fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {smsResult.total === 0
                ? <span style={{ color: 'var(--text3)' }}>"[참바른글씨]" 등원 문자가 없습니다.</span>
                : (<>
                  <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(22,163,74,0.1)', color: 'var(--green)', fontWeight: 600 }}>✅ {smsResult.added}건 저장</span>
                  {smsResult.dup > 0 && <span style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--surface)', color: 'var(--text3)' }}>{smsResult.dup}건 중복</span>}
                  {smsResult.newStudents > 0 && <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', fontWeight: 600 }}>+{smsResult.newStudents}명 자동 등록</span>}
                </>)
              }
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <label className="label">학생 추가</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStudent()} placeholder="이름 입력 후 추가 또는 Enter" style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={addStudent} style={{ flexShrink: 0 }}>추가</button>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>전체 학생</span>
            <span className="badge">{students.length}명</span>
          </div>
          {students.length === 0
            ? <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>등록된 학생이 없습니다.</div>
            : students.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{s.name}</span>
                <button className="btn btn-danger btn-sm" onClick={() => removeStudent(s.id)}>삭제</button>
              </div>
            ))
          }
        </div>

      </>)}
    </div>
  )
}