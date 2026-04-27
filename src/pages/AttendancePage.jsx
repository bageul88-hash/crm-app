import { useState, useEffect, useCallback } from 'react'

const TODAY = new Date()
const TODAY_STR = `${TODAY.getFullYear()}${String(TODAY.getMonth()+1).padStart(2,'0')}${String(TODAY.getDate()).padStart(2,'0')}`
const TODAY_LABEL = `${TODAY.getFullYear()}년 ${TODAY.getMonth()+1}월 ${TODAY.getDate()}일 (${['일','월','화','수','목','금','토'][TODAY.getDay()]})`

export default function AttendancePage() {
  const [students, setStudents]     = useState([])
  const [newName, setNewName]       = useState('')
  const [search, setSearch]         = useState('')
  const [log, setLog]               = useState([])
  const [showLog, setShowLog]       = useState(false)
  const [processing, setProcessing] = useState(false)
  const [copyDone, setCopyDone]     = useState(false)
  const [tab, setTab]               = useState('attend') // 'attend' | 'manage'

  useEffect(() => {
    const saved    = localStorage.getItem('attendance_students')
    const lastDate = localStorage.getItem('attendance_last_date')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (lastDate !== TODAY_STR) {
        const reset = parsed.map(s => ({ ...s, checked: false, done: false }))
        setStudents(reset)
        localStorage.setItem('attendance_students', JSON.stringify(reset))
        localStorage.setItem('attendance_last_date', TODAY_STR)
      } else {
        setStudents(parsed)
      }
    }
  }, [])

  const persist = useCallback((list) => {
    localStorage.setItem('attendance_students', JSON.stringify(list))
    setStudents(list)
  }, [])

  const addStudent = () => {
    const name = newName.trim()
    if (!name) return
    if (students.find(s => s.name === name)) { alert('이미 있는 학생입니다.'); return }
    persist([...students, { id: Date.now(), name, checked: false, done: false }])
    setNewName('')
  }

  const removeStudent = (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    persist(students.filter(s => s.id !== id))
  }

  const toggle = (id) => persist(students.map(s => s.id === id ? { ...s, checked: !s.checked } : s))
  const selectAll   = () => persist(students.map(s => ({ ...s, checked: true })))
  const deselectAll = () => persist(students.map(s => ({ ...s, checked: false })))

  const runAttendance = async () => {
    const selected = students.filter(s => s.checked)
    if (!selected.length) { alert('출석할 학생을 선택해주세요.'); return }
    if (!confirm(`오늘(${TODAY_STR}) 출석 처리할 학생 ${selected.length}명\n\n${selected.map(s => '✔ ' + s.name).join('\n')}\n\n계속하시겠습니까?`)) return

    setProcessing(true)
    const lines = []
    lines.push(`[${new Date().toLocaleTimeString()}] 출석 처리 시작`)
    lines.push(`날짜 폴더: ${TODAY_STR}`)
    lines.push('─'.repeat(28))

    const names = selected.map(s => s.name).join('\n')
    try {
      await navigator.clipboard.writeText(names)
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
      lines.push('아래 목록을 수동 입력하세요:')
      selected.forEach(s => lines.push(`  • ${s.name}`))
    }

    lines.push('─'.repeat(28))
    lines.push(`출석 ${selected.length}명 처리 완료`)

    persist(students.map(s => s.checked ? { ...s, done: true, checked: false } : s))
    setLog(lines)
    setShowLog(true)
    setProcessing(false)
  }

  const filtered     = students.filter(s => s.name.includes(search.trim()))
  const checkedCount = students.filter(s => s.checked).length
  const doneCount    = students.filter(s => s.done).length
  const totalCount   = students.length

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

      {/* 탭 */}
      <div style={{
        display: 'flex', background: 'var(--surface)',
        borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 16,
      }}>
        {[['attend','✔ 출석 체크'],['manage','👥 학생 관리']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: 7,
            fontSize: 13, fontWeight: tab === key ? 600 : 400, cursor: 'pointer',
            background: tab === key ? 'var(--bg2)' : 'transparent',
            color: tab === key ? 'var(--accent)' : 'var(--text3)',
            boxShadow: tab === key ? 'var(--shadow)' : 'none',
            transition: 'all 0.15s', fontFamily: 'var(--font)',
          }}>{label}</button>
        ))}
      </div>

      {/* ── 출석 체크 탭 ── */}
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
            <div key={s.id}
              onClick={() => !s.done && toggle(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px', cursor: s.done ? 'default' : 'pointer',
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
                <span className="badge" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--green)', fontSize: 11 }}>
                  처리완료
                </span>
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
                {line || '\u00A0'}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ── 학생 관리 탭 ── */}
      {tab === 'manage' && (<>
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
                <span className="badge" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--green)', fontSize: 11 }}>
                  오늘출석
                </span>
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
                persist(students.map(s => ({ ...s, checked: false, done: false })))
            }}>
            오늘 출석 기록 초기화
          </button>
        )}
      </>)}
    </div>
  )
}
