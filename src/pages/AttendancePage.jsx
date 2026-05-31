import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { checkSmsPermission, requestSmsPermission, readSmsHistory, openSmsSettings } from '../hooks/useSmsAttendance'
import SearchInput from '../components/SearchInput'

const TODAY     = new Date()
const TODAY_STR = `${TODAY.getFullYear()}${String(TODAY.getMonth()+1).padStart(2,'0')}${String(TODAY.getDate()).padStart(2,'0')}`
const TODAY_LBL = `${TODAY.getFullYear()}년 ${TODAY.getMonth()+1}월 ${TODAY.getDate()}일 (${['일','월','화','수','목','금','토'][TODAY.getDay()]})`
const DAYS_KR   = ['일','월','화','수','목','금','토']
const CUR_YEAR  = String(TODAY.getFullYear())
const CUR_MON   = String(TODAY.getMonth()+1).padStart(2,'0')

function toEntry(raw) { return typeof raw === 'string' ? { name: raw, time: null } : raw }
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
  const [permDenied, setPermDenied]       = useState(false)
  const [lastUpdated, setLastUpdated]     = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const lockRef = useRef(false)

  // 초기 로컬스토리지 로드
  useEffect(() => {
    const saved = localStorage.getItem('attendance_records')
    if (saved) setRecords(JSON.parse(saved))
  }, [])

  // 실시간 SMS 수신 → 즉시 반영
  useEffect(() => {
    const handler = (e) => {
      const { studentName, time, phone } = e.detail
      setRecords(prev => {
        const next = { ...prev }
        if (!hasEntry(next[TODAY_STR], studentName)) {
          next[TODAY_STR] = [...(next[TODAY_STR] || []), { name: studentName, time: time || null, phone: phone || null }]
          localStorage.setItem('attendance_records', JSON.stringify(next))
        }
        return next
      })
    }
    window.addEventListener('smsAttendance', handler)
    return () => window.removeEventListener('smsAttendance', handler)
  }, [])

  // 오늘 현황용 빠른 로드
  const loadTodaySms = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true
    setLoadToday(true)
    try {
      let ok = await checkSmsPermission()
      if (!ok) ok = await requestSmsPermission()
      if (!ok) { setPermDenied(true); return }
      setPermDenied(false)
      const { items } = await readSmsHistory(99999)
      if (!items.length) return
      const raw = localStorage.getItem('attendance_records')
      const recs = raw ? JSON.parse(raw) : {}
      let changed = false
      items.forEach(({ studentName, date, time }) => {
        if (!hasEntry(recs[date], studentName)) {
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
      let ok = await checkSmsPermission()
      if (!ok) ok = await requestSmsPermission()
      if (!ok) { setPermDenied(true); return }
      setPermDenied(false)
      const { items, scanned, matched } = await readSmsHistory(99999)
      const raw = localStorage.getItem('attendance_records')
      const recs = raw ? JSON.parse(raw) : {}
      let added = 0
      items.forEach(({ studentName, date, time }) => {
        if (!hasEntry(recs[date], studentName)) {
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

  // 파생 데이터
  const searchQ = search.trim().toLowerCase()
  const matchName = (name) => !searchQ || String(name || '').toLowerCase().includes(searchQ)

  const todayList = (records[TODAY_STR]||[]).map(toEntry).filter(e => matchName(e.name))
  const allDates  = Object.keys(records).sort().reverse()
  const MONTHS    = Array.from({length:12}, (_,i) => String(i+1).padStart(2,'0'))

  // 년도: 데이터에서 동적 추출 + 기본 연도 보장
  const dataYears = [...new Set(allDates.map(d => d.slice(0,4)))]
  const baseYears = ['2024','2025','2026', CUR_YEAR]
  const YEAR_OPTS = [...new Set([...baseYears, ...dataYears])].sort().reverse()

  // 이력 탭: 선택 년/월 날짜 그룹
  const filteredDates = allDates.filter(d => d.startsWith(selYear + selMon))
  const grouped = filteredDates.map(d => ({
    dateStr: d,
    label: fmtDateLabel(d),
    entries: (records[d]||[]).map(toEntry).filter(e => matchName(e.name)),
    isWknd: [0,6].includes(new Date(+d.slice(0,4), parseInt(d.slice(4,6))-1, parseInt(d.slice(6,8))).getDay())
  }))
  const monthTotal = grouped.reduce((s, g) => s + g.entries.length, 0)
  const totalAllSaved = Object.values(records).reduce((s, list) => s + (list?.length || 0), 0)

  const studentTotals = useMemo(() => {
    const map = {}
    Object.values(records).forEach(list => {
      ;(list || []).map(toEntry).forEach(e => { map[e.name] = (map[e.name] || 0) + 1 })
    })
    return map
  }, [records])

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

      {permDenied && (
        <div style={{ marginBottom:12, padding:'12px 14px', background:'#fee2e2', borderRadius:9 }}>
          <div style={{ fontSize:12, color:'var(--red)', fontWeight:600, marginBottom:8 }}>
            SMS 권한이 거부됐습니다. 앱 설정 → 권한에서 SMS를 허용해주세요.
          </div>
          <button
            type="button"
            onClick={openSmsSettings}
            style={{
              padding:'7px 14px', borderRadius:7, border:'none',
              background:'var(--red)', color:'#fff',
              fontSize:12, fontWeight:700, cursor:'pointer',
            }}
          >
            앱 설정 열기
          </button>
        </div>
      )}

      {/* ── 출석 현황 탭 ── */}
      {tab === 'attend' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text2)' }}>오늘 등원 {todayList.length}명</span>
            <button type="button" onClick={loadTodaySms} disabled={loadingToday}
              style={{ fontSize:18, background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:'0 4px' }}>
              {loadingToday ? '⏳' : '🔄'}
            </button>
          </div>
          <div style={{ borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr><th style={TH}>이름</th><th style={TH}>등원시간</th></tr>
              </thead>
              <tbody>
                {todayList.length === 0
                  ? <tr><td colSpan={2} style={{ padding:'32px 16px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                      {loadingToday ? 'SMS를 읽어오는 중...' : '오늘 등원한 학생이 없습니다.'}
                    </td></tr>
                  : todayList.map((e,i) => (
                    <tr key={i}>
                      <td style={td()}>
                        <span style={{ marginRight:6 }}>{e.name}</span>
                        <span onClick={() => setSelectedStudent(e.name)}
                          style={{ fontSize:11, color:'#3b82f6', fontWeight:600, cursor:'pointer' }}>
                          총 출석 {studentTotals[e.name] || 0}회
                        </span>
                      </td>
                      <td style={td({ color:'var(--text2)' })}>{fmtTime(e.time)}</td>
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
            (list||[]).map(toEntry).filter(e => e.name === selectedStudent).map(e => ({ date, time: e.time }))
          )
          .sort((a, b) => b.date.localeCompare(a.date))
        return (
          <div onClick={() => setSelectedStudent(null)}
            style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width:'100%', maxWidth:430, maxHeight:'80vh', background:'#fff', borderRadius:'18px 18px 0 0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              {/* 헤더 */}
              <div style={{ padding:'16px 20px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>{selectedStudent}</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>총 출석 <span style={{ color:'var(--accent)', fontWeight:700 }}>{studentRecords.length}</span>회</div>
                </div>
                <button type="button" onClick={() => setSelectedStudent(null)}
                  style={{ fontSize:22, background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
              </div>
              {/* 목록 */}
              <div style={{ overflowY:'auto', flex:1, padding:'8px 0' }}>
                {studentRecords.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:14 }}>출석 이력이 없습니다.</div>
                ) : studentRecords.map((r, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 20px', borderBottom: i < studentRecords.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{fmtDateLabel(r.date)}</span>
                    <span style={{ fontSize:13, color:'var(--text2)' }}>{fmtTime(r.time)}</span>
                  </div>
                ))}
              </div>
              {/* 닫기 버튼 */}
              <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)' }}>
                <button type="button" onClick={() => setSelectedStudent(null)}
                  style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'var(--accent)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 출석 이력 탭 ── */}
      {tab === 'history' && (
        <div>

          {/* 전체 불러오기 버튼 */}
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

          {/* 갱신 시각 */}
          {lastUpdated && (
            <div style={{ marginBottom:6, fontSize:11, color:'var(--text3)', textAlign:'right' }}>
              마지막 갱신: {lastUpdated.getHours().toString().padStart(2,'0')}:{lastUpdated.getMinutes().toString().padStart(2,'0')}:{lastUpdated.getSeconds().toString().padStart(2,'0')}
            </div>
          )}

          {/* 불러오기 결과 */}
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

          {/* 전체 저장 이력 요약 (importStat 없을 때도 표시) */}
          {!importStat && totalAllSaved > 0 && (
            <div style={{ marginBottom:10, padding:'8px 14px', background:'#eff6ff', borderRadius:9, fontSize:12, color:'var(--accent)', fontWeight:600 }}>
              저장된 전체 이력: {totalAllSaved}건
            </div>
          )}

          {/* 년/월 드롭다운 */}
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

          {/* 월 요약 */}
          {monthTotal > 0 && (
            <div style={{ marginBottom:12, padding:'8px 14px', background:'#eff6ff', borderRadius:9, fontSize:12, color:'var(--accent)', fontWeight:700 }}>
              {selYear}년 {parseInt(selMon)}월 · {filteredDates.length}일 등원 · 총 {monthTotal}건
            </div>
          )}

          {/* SMS 읽는 중 인디케이터 (기록 목록 위에 오버레이하지 않고 따로 표시) */}
          {loadingAll && (
            <div style={{ textAlign:'center', padding:'10px 0', color:'var(--text3)', fontSize:12, marginBottom:8 }}>
              문자 전체를 읽어오는 중... (기존 이력은 아래에서 확인 가능합니다)
            </div>
          )}

          {/* 날짜별 카드 — 로딩 중에도 기존 데이터 표시 */}
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
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 16px', borderBottom: i < entries.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{e.name}</span>
                          <span onClick={() => setSelectedStudent(e.name)}
                            style={{ fontSize:11, color:'#3b82f6', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                            총 출석 {studentTotals[e.name] || 0}회
                          </span>
                        </div>
                        <span style={{ fontSize:13, color:'var(--text2)' }}>{fmtTime(e.time)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
