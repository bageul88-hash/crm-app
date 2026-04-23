import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import ConsultCard from '../components/ConsultCard'

// 1번째 줄 탭 (구분 기준)
const TOP_TABS = [
  { key: '전체', filterKey: null,       filterVal: null },
  { key: '예약', filterKey: 'category', filterVal: '예약' },
  { key: '문의', filterKey: 'category', filterVal: '문의' },
  { key: '가맹', filterKey: 'category', filterVal: '가맹' },
]

// 2번째 줄 탭 (진단결과 기준)
const BOT_TABS = [
  { key: '등록',  filterKey: 'diagResult', filterVal: '등록' },
  { key: '미등록', filterKey: 'diagResult', filterVal: '미등록' },
  { key: '문의만', filterKey: 'diagResult', filterVal: '문의만' },
  { key: '불가',  filterKey: 'diagResult', filterVal: '불가' },
  { key: '체결',  filterKey: 'diagResult', filterVal: '체결' },
  { key: '기타',  filterKey: 'diagResult', filterVal: '기타' },
]

const TAB_COLOR = {
  '전체':  { bg: 'rgba(79,126,248,0.12)',  border: 'var(--accent)',  text: 'var(--accent)' },
  '예약':  { bg: 'rgba(52,201,126,0.12)',  border: 'var(--green)',   text: 'var(--green)' },
  '문의':  { bg: 'rgba(168,85,247,0.12)',  border: 'var(--purple)',  text: 'var(--purple)' },
  '가맹':  { bg: 'rgba(14,165,233,0.12)',  border: '#0ea5e9',        text: '#0ea5e9' },
  '등록':  { bg: 'rgba(52,201,126,0.12)',  border: 'var(--green)',   text: 'var(--green)' },
  '미등록': { bg: 'rgba(245,166,35,0.12)', border: 'var(--orange)',  text: 'var(--orange)' },
  '문의만': { bg: 'rgba(168,85,247,0.12)', border: 'var(--purple)',  text: 'var(--purple)' },
  '불가':  { bg: 'rgba(240,69,69,0.12)',   border: 'var(--red)',     text: 'var(--red)' },
  '체결':  { bg: 'rgba(79,126,248,0.12)',  border: 'var(--accent)',  text: 'var(--accent)' },
  '기타':  { bg: 'rgba(156,163,175,0.12)', border: 'var(--text3)',   text: 'var(--text2)' },
}

const ALL_TABS = [...TOP_TABS, ...BOT_TABS]

export default function ListPage() {
  const { consults, loading, error } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('전체')
  const [search, setSearch] = useState('')

  const currentTab = ALL_TABS.find(t => t.key === tab)

  const filtered = useMemo(() => {
    let list = consults
    if (currentTab?.filterKey) {
      list = list.filter(c => c[currentTab.filterKey] === currentTab.filterVal)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.feature?.toLowerCase().includes(q) ||
        c.relation?.includes(q)
      )
    }
    return [...list].sort((a, b) => b.id - a.id)
  }, [consults, tab, search, currentTab])

  const counts = useMemo(() => {
    const map = { '전체': consults.length }
    ALL_TABS.filter(t => t.filterKey).forEach(t => {
      map[t.key] = consults.filter(c => c[t.filterKey] === t.filterVal).length
    })
    return map
  }, [consults])

  const col = (key) => TAB_COLOR[key] || TAB_COLOR['기타']

  const TabRow = ({ tabs }) => (
    <div style={{
      display: 'flex', gap: 6,
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {tabs.map(t => {
        const active = tab === t.key
        const c = col(t.key)
        return (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: 20,
            border: `1px solid ${active ? c.border : 'var(--border)'}`,
            background: active ? c.bg : 'transparent',
            color: active ? c.text : 'var(--text2)',
            fontSize: 13, fontWeight: active ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font)',
          }}>
            {t.key}
            <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div>
      {/* 검색창 */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 15,
          }}>🔍</span>
          <input className="input" style={{ paddingLeft: 36 }}
            placeholder="이름, 전화번호, 특징 검색"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* 1번째 줄: 구분 탭 */}
      <div style={{ padding: '12px 16px 0' }}>
        <TabRow tabs={TOP_TABS} />
      </div>

      {/* 2번째 줄: 진단결과 탭 */}
      <div style={{ padding: '6px 16px 0' }}>
        <TabRow tabs={BOT_TABS} />
      </div>

      {/* 목록 */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        )}
        {error && (
          <div style={{
            background: 'rgba(240,69,69,0.1)', border: '1px solid rgba(240,69,69,0.3)',
            borderRadius: 'var(--radius)', padding: 16, color: 'var(--red)', fontSize: 14,
          }}>⚠️ {error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14 }}>
              {tab === '전체' ? '상담 내역이 없습니다' : `'${tab}' 항목이 없습니다`}
            </div>
          </div>
        )}
        {filtered.map(c => (
          <ConsultCard key={c.id} consult={c}
            onClick={() => navigate(`/detail/${c.id}`)}
            onEdit={() => navigate(`/input/${c.id}`)} />
        ))}
      </div>
    </div>
  )
}