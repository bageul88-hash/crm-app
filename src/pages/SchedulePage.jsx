import { useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import SearchInput from '../components/SearchInput'
import dayjs from 'dayjs'

const RESULT_COLOR = {
  미등록: '#9CA3AF', 연결: '#3B82F6', 펑크: '#EF4444',
  환불: '#F97316', 가맹: '#8B5CF6', 등록: '#16a34a',
}

export default function SchedulePage() {
  const { consults } = useApp()
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const scrollRef = useRef(null)
  const isTabScrolling = useRef(false)
  const activeTabRef = useRef(0)

  // 이번 주 월~일 (한국 기준 월요일 시작)
  const { weekStart, weekEnd } = useMemo(() => {
    const d = dayjs()
    const offset = (d.day() + 6) % 7 // 0=일 → 6, 1=월 → 0
    const monday = d.subtract(offset, 'day')
    return {
      weekStart: monday.format('YYYY-MM-DD'),
      weekEnd: monday.add(6, 'day').format('YYYY-MM-DD'),
    }
  }, [today])

  const matchSearch = useCallback((c) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q)
  }, [search])

  const todayItems = useMemo(() =>
    consults
      .filter(c => c.diagDate === today && matchSearch(c))
      .sort((a, b) => (a.diagTime || '').localeCompare(b.diagTime || '')),
    [consults, today, matchSearch]
  )

  const weekItems = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate >= weekStart && c.diagDate <= weekEnd && matchSearch(c))
      .sort((a, b) => a.diagDate.localeCompare(b.diagDate) || (a.diagTime || '').localeCompare(b.diagTime || '')),
    [consults, weekStart, weekEnd, matchSearch]
  )

  const pastItems = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate < today && matchSearch(c))
      .sort((a, b) => b.diagDate.localeCompare(a.diagDate))
      .slice(0, 30),
    [consults, today, matchSearch]
  )

  const groupByDate = (items) => {
    const map = {}
    items.forEach(c => {
      if (!map[c.diagDate]) map[c.diagDate] = []
      map[c.diagDate].push(c)
    })
    return Object.entries(map)
  }

  const dayLabel = (dateStr) => {
    const diff = dayjs(dateStr).diff(dayjs().startOf('day'), 'day')
    if (diff === 0) return '오늘'
    if (diff === 1) return '내일'
    if (diff === 2) return '모레'
    return dayjs(dateStr).format('M월 D일')
  }

  const handleTabClick = useCallback((idx) => {
    activeTabRef.current = idx
    setActiveTab(idx)
    if (scrollRef.current) {
      isTabScrolling.current = true
      scrollRef.current.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' })
      setTimeout(() => { isTabScrolling.current = false }, 600)
    }
  }, [])

  const handleScroll = useCallback(() => {
    if (isTabScrolling.current) return
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== activeTabRef.current) {
      activeTabRef.current = idx
      setActiveTab(idx)
    }
  }, [])

  const CardItem = ({ c }) => (
    <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/detail/${c.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {c.phone}{c.age ? ` • ${c.age}` : ''}{c.gender ? ` ${c.gender}` : ''}
          </div>
          {c.diagTime && (
            <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>🕐 {c.diagTime}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {c.diagResult ? (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10, border: '1px solid',
              borderColor: RESULT_COLOR[c.diagResult] || '#d1d5db',
              color: RESULT_COLOR[c.diagResult] || 'var(--text3)',
            }}>{c.diagResult}</span>
          ) : (
            <span className={`badge badge-${c.category}`}>{c.category || '미분류'}</span>
          )}
        </div>
      </div>
      {c.feature && (
        <div style={{
          marginTop: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{c.feature}</div>
      )}
    </div>
  )

  const GroupedPanel = ({ items }) => {
    const groups = groupByDate(items)
    if (groups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <div>해당 예약이 없습니다</div>
        </div>
      )
    }
    return groups.map(([date, list]) => (
      <div key={date} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            background: date === today ? 'var(--accent)' : 'var(--surface)',
            color: date === today ? '#fff' : 'var(--text2)',
            borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 600,
          }}>{dayLabel(date)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {date}{list[0]?.diagDay ? ` (${list[0].diagDay})` : ''}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, background: 'var(--surface)', borderRadius: 20, padding: '2px 8px', color: 'var(--text2)' }}>
            {list.length}명
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(c => <CardItem key={c.id} c={c} />)}
        </div>
      </div>
    ))
  }

  const TABS = ['오늘', '이번주', '이전']

  return (
    <div>
      <div style={{ padding: '16px 16px 0' }}>
        <SearchInput value={search} onChange={setSearch} style={{ marginBottom: 12 }} />
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: '#fff', position: 'sticky', top: 0, zIndex: 10,
      }}>
        {TABS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => handleTabClick(idx)}
            style={{
              flex: 1, padding: '12px 0', fontSize: 14,
              fontWeight: activeTab === idx ? 700 : 500,
              color: activeTab === idx ? 'var(--accent)' : 'var(--text3)',
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === idx ? '2.5px solid var(--accent)' : '2.5px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 스와이프 컨테이너 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          overflowX: 'scroll',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {/* 패널 0: 오늘 */}
        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: 16, minHeight: 200 }}>
          <GroupedPanel items={todayItems} />
        </div>

        {/* 패널 1: 이번주 */}
        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: 16, minHeight: 200 }}>
          <GroupedPanel items={weekItems} />
        </div>

        {/* 패널 2: 이전 */}
        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: 16, minHeight: 200 }}>
          {pastItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
              <div>지난 예약이 없습니다</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 12 }}>
                지난 예약 (최근 30건)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pastItems.map(c => {
                  const hasResult = Boolean(c.diagResult)
                  const diagResult = c.diagResult || '미확인'
                  const resultColor = hasResult
                    ? (RESULT_COLOR[c.diagResult] || '#9CA3AF')
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
                              border: `1px solid ${resultColor}`, color: resultColor, fontWeight: 700, lineHeight: 1.5,
                            }}>{diagResult}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                            {c.diagDate}{c.diagDay ? ` (${c.diagDay})` : ''}{c.diagTime ? ` ${c.diagTime}` : ''}
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
      </div>
    </div>
  )
}
