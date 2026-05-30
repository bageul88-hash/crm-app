import { useMemo } from 'react'

const DAYS_KR = ['일','월','화','수','목','금','토']

function toEntry(raw) { return typeof raw === 'string' ? { name: raw, time: null } : raw }

function fmtDateLabel(d) {
  const y = +d.slice(0,4), mo = parseInt(d.slice(4,6)), day = parseInt(d.slice(6,8))
  return `${y}년 ${mo}월 ${day}일 (${DAYS_KR[new Date(y, mo-1, day).getDay()]})`
}

function fmtTime(t) {
  if (!t) return '-'
  const [h, m] = t.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2,'0')}`
}

export default function AttendanceHistoryModal({ studentName, onClose }) {
  const studentRecords = useMemo(() => {
    try {
      const raw = localStorage.getItem('attendance_records')
      if (!raw) return []
      const records = JSON.parse(raw)
      return Object.entries(records)
        .flatMap(([date, list]) =>
          (list || []).map(toEntry).filter(e => e.name === studentName).map(e => ({ date, time: e.time }))
        )
        .sort((a, b) => b.date.localeCompare(a.date))
    } catch { return [] }
  }, [studentName])

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width:'100%', maxWidth:430, maxHeight:'80vh', background:'#fff', borderRadius:'18px 18px 0 0', display:'flex', flexDirection:'column', overflow:'hidden' }}
      >
        <div style={{ padding:'16px 20px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>{studentName}</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
              총 출석 <span style={{ color:'var(--accent)', fontWeight:700 }}>{studentRecords.length}</span>회
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ fontSize:22, background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

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

        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)' }}>
          <button type="button" onClick={onClose}
            style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'var(--accent)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
