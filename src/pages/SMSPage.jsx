import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import dayjs from 'dayjs'

const CAT_TABS = ['예약', '문의', '가맹', '기타']
const RESULT_TABS = ['등록', '미등록', '문의만', '불가', '체결', '기타']

export default function SMSPage() {
  const { consults } = useApp()
  const [selCats, setSelCats] = useState([])
  const [selResults, setSelResults] = useState([])
  const [daysBefore, setDaysBefore] = useState(30)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const toggleCat = (val) =>
    setSelCats(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const toggleResult = (val) =>
    setSelResults(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const cutoff = useMemo(() =>
    dayjs().subtract(daysBefore, 'day').format('YYYYMMDD'), [daysBefore])

  const targets = useMemo(() => {
    return consults.filter(c => {
      // 구분 필터 (선택 없으면 전체)
      if (selCats.length > 0 && !selCats.includes(c.category)) return false
      // 진단결과 필터 (선택 없으면 전체)
      if (selResults.length > 0 && !selResults.includes(c.diagResult)) return false
      // 기간 필터
      if (daysBefore && c.inquiryDate) {
        const d = String(c.inquiryDate).replace(/-/g, '')
        return d >= cutoff
      }
      return true
    }).sort((a, b) => b.id - a.id)
  }, [consults, selCats, selResults, cutoff, daysBefore])

  const phoneList = targets.map(c => c.phone).filter(Boolean).join(', ')

  const copyAll = async () => {
    await navigator.clipboard.writeText(phoneList)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const copyOne = async (c) => {
    await navigator.clipboard.writeText(c.phone)
    setCopiedId(c.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const TabBtn = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 8, border: '1px solid',
      borderColor: active ? 'var(--accent)' : 'var(--border)',
      background: active ? 'rgba(79,126,248,0.15)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text2)',
      fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>문자 발송 대상</h2>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
        조건에 맞는 고객 연락처를 추출합니다
      </p>

      {/* 구분 필터 */}
      <div className="card" style={{ marginBottom: 10 }}>
        <label className="label">구분 (미선택 시 전체)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {CAT_TABS.map(t => (
            <TabBtn key={t} label={t}
              active={selCats.includes(t)}
              onClick={() => toggleCat(t)} />
          ))}
        </div>
      </div>

      {/* 진단결과 필터 */}
      <div className="card" style={{ marginBottom: 10 }}>
        <label className="label">진단결과 (미선택 시 전체)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {RESULT_TABS.map(t => (
            <TabBtn key={t} label={t}
              active={selResults.includes(t)}
              onClick={() => toggleResult(t)} />
          ))}
        </div>
      </div>

      {/* 기간 필터 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="label">최근 N일 이내 문의</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <input type="range" min={0} max={365} value={daysBefore}
            onChange={e => setDaysBefore(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <span style={{ minWidth: 56, fontSize: 14, fontWeight: 600, color: 'var(--accent)', textAlign: 'right' }}>
            {daysBefore === 0 ? '전체' : `${daysBefore}일`}
          </span>
        </div>
      </div>

      {/* 결과 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          대상 <span style={{ color: 'var(--accent)' }}>{targets.length}명</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={copyAll} disabled={targets.length === 0}>
          {copiedAll ? '✅ 복사됨' : '전체 번호 복사'}
        </button>
      </div>

      {/* 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {targets.map(c => (
          <div key={c.id} className="card" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.name || '(이름없음)'}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{c.phone}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {c.category && (
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 10,
                    background: 'var(--surface)', color: 'var(--text3)',
                    border: '1px solid var(--border)',
                  }}>{c.category}</span>
                )}
                {c.diagResult && (
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 10,
                    background: 'var(--surface)', color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                  }}>{c.diagResult}</span>
                )}
                {c.inquiryDate && (
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {c.inquiryDate}
                  </span>
                )}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 12, padding: '5px 10px', flexShrink: 0, marginLeft: 8,
                color: copiedId === c.id ? 'var(--green)' : 'var(--accent)',
                borderColor: copiedId === c.id ? 'var(--green)' : 'var(--accent)',
              }}
              onClick={() => copyOne(c)}
              disabled={!c.phone}
            >
              {copiedId === c.id ? '✅' : '📋 복사'}
            </button>
          </div>
        ))}

        {targets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>
            <div style={{ fontSize: 14 }}>조건에 맞는 고객이 없습니다</div>
          </div>
        )}
      </div>

      {/* 전체 번호 텍스트 */}
      {targets.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <label className="label">전화번호 목록 (복사용)</label>
          <textarea className="input" readOnly
            style={{ minHeight: 80, marginTop: 8, fontSize: 13, color: 'var(--text2)' }}
            value={phoneList} />
        </div>
      )}
    </div>
  )
}