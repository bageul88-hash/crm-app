import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import dayjs from 'dayjs'

export default function SchedulePage() {
  const { consults } = useApp()
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')

  const upcoming = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate >= today)
      .sort((a, b) => a.diagDate.localeCompare(b.diagDate)),
    [consults, today]
  )

  const past = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate < today)
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span className={`badge badge-${c.category}`}>{c.category || '미분류'}</span>
                    {c.diagResult && (
                      <span style={{
                        fontSize: 12,
                        color: c.diagResult === '예약확정' ? 'var(--green)'
                             : c.diagResult === '취소' ? 'var(--red)' : 'var(--text3)',
                      }}>{c.diagResult}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
            {past.map(c => (
              <div key={c.id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/detail/${c.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {c.diagDate}{c.diagDay ? ` (${c.diagDay})` : ''}
                      {c.diagTime ? ` ${c.diagTime}` : ''}
                    </div>
                  </div>
                  <span className={`badge badge-${c.category}`}>{c.category || '미분류'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

