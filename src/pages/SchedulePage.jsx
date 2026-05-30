import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import SearchInput from '../components/SearchInput'
import dayjs from 'dayjs'

export default function SchedulePage() {
  const { consults } = useApp()
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')
  const [search, setSearch] = useState('')

  const matchSearch = useCallback((c) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q)
  }, [search])

  const upcoming = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate >= today && matchSearch(c))
      .sort((a, b) => a.diagDate.localeCompare(b.diagDate)),
    [consults, today, matchSearch]
  )

  const past = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate < today && matchSearch(c))
      .sort((a, b) => b.diagDate.localeCompare(a.diagDate))
      .slice(0, 10),
    [consults, today]
  )

  const grouped = useMemo(() => {
    const map = {}
    upcoming.forEach(c => {
      const key = c.diagDate
      if (!map[key]) map[key] = []
      map[key].push(c)
    })
    return Object.entries(map)
  }, [upcoming])

  const dayLabel = (dateStr) => {
    const d = dayjs(dateStr)
    const diff = d.diff(dayjs().startOf('day'), 'day')
    if (diff === 0) return '오늘'
    if (diff === 1) return '내일'
    if (diff === 2) return '모레'
    return d.format('M월 D일')
  }

  return (
    <div style={{ padding: 16 }}>
      <SearchInput value={search} onChange={setSearch} style={{ marginBottom: 12 }} />
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>진단 예약 일정</h2>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        오늘: {dayjs().format('YYYY년 M월 D일')}
      </p>

      {grouped.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <div>예정된 진단 예약이 없습니다</div>
        </div>
      )}

      {grouped.map(([date, list]) => (
        <div key={date} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              background: date === today ? 'var(--accent)' : 'var(--surface)',
              color: date === today ? '#fff' : 'var(--text2)',
              borderRadius: 8, padding: '4px 12px',
              fontSize: 13, fontWeight: 600,
            }}>{dayLabel(date)}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {date}{list[0]?.diagDay ? ` (${list[0].diagDay})` : ''}
            </div>
            <div style={{
              marginLeft: 'auto', fontSize: 12,
              background: 'var(--surface)', borderRadius: 20,
              padding: '2px 8px', color: 'var(--text2)',
            }}>{list.length}명</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(c => (
              <div key={c.id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/detail/${c.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      {c.phone}
                      {c.age ? ` • ${c.age}` : ''}
                      {c.gender ? ` ${c.gender}` : ''}
                    </div>
                    {c.diagTime && (
                      <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>
                        🕐 {c.diagTime}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {c.diagResult ? (
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 10, border: '1px solid',
                        borderColor: {
                          미등록: '#9CA3AF', 연결: '#3B82F6', 펑크: '#EF4444',
                          환불: '#F97316', 가맹: '#8B5CF6', 등록: '#16a34a',
                        }[c.diagResult] || '#d1d5db',
                        color: {
                          미등록: '#9CA3AF', 연결: '#3B82F6', 펑크: '#EF4444',
                          환불: '#F97316', 가맹: '#8B5CF6', 등록: '#16a34a',
                        }[c.diagResult] || 'var(--text3)',
                      }}>{c.diagResult}</span>
                    ) : (
                      <span className={`badge badge-${c.category}`}>{c.category || '미분류'}</span>
                    )}
                  </div>
                </div>
                {c.feature && (
                  <div style={{
                    marginTop: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{c.feature}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {past.length > 0 && (
        <>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text3)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            margin: '24px 0 12px',
          }}>지난 예약</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(c => {
              const hasResult = Boolean(c.diagResult)
              // 진단결과 미기재 → 빨간 '미확인' (수동 처리 필요 안내)
              const diagResult = c.diagResult || '미확인'
              const resultColor = hasResult
                ? ({ 미등록: '#9CA3AF', 연결: '#3B82F6', 펑크: '#EF4444', 환불: '#F97316', 가맹: '#8B5CF6' }[c.diagResult] || '#9CA3AF')
                : '#EF4444'
              return (
                <div key={c.id} className="card"
                  style={{ cursor: 'pointer', opacity: hasResult ? 0.6 : 1 }}
                  onClick={() => navigate(`/detail/${c.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        {c.name}
                        <span style={{
                          fontSize: 11, padding: '1px 6px', borderRadius: 10,
                          border: `1px solid ${resultColor}`,
                          color: resultColor, fontWeight: 700, lineHeight: 1.5,
                        }}>{diagResult}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        {c.diagDate}{c.diagDay ? ` (${c.diagDay})` : ''}
                        {c.diagTime ? ` ${c.diagTime}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.category}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

