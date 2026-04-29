import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import ConsultCard from '../components/ConsultCard'

const TOP_TABS = [
  { key: '전체' },
  { key: '예약' },
  { key: '문의' },
  { key: '가맹' },
]

const BOT_TABS = [
  { key: '등록', filterKey: 'diagResult', filterVal: '등록' },
  { key: '미등록', filterKey: 'diagResult', filterVal: '미등록' },
  { key: '문의만', filterKey: 'diagResult', filterVal: '문의만' },
  { key: '불가', filterKey: 'diagResult', filterVal: '불가' },
  { key: '체결', filterKey: 'diagResult', filterVal: '체결' },
  { key: '기타', filterKey: 'diagResult', filterVal: '기타' },
]

const TAB_COLOR = {
  전체: { bg: 'rgba(79,126,248,0.12)', border: 'var(--accent)', text: 'var(--accent)' },
  예약: { bg: 'rgba(52,201,126,0.12)', border: 'var(--green)', text: 'var(--green)' },
  문의: { bg: 'rgba(168,85,247,0.12)', border: 'var(--purple)', text: 'var(--purple)' },
  가맹: { bg: 'rgba(14,165,233,0.12)', border: '#0ea5e9', text: '#0ea5e9' },
  등록: { bg: 'rgba(52,201,126,0.12)', border: 'var(--green)', text: 'var(--green)' },
  미등록: { bg: 'rgba(245,166,35,0.12)', border: 'var(--orange)', text: 'var(--orange)' },
  문의만: { bg: 'rgba(168,85,247,0.12)', border: 'var(--purple)', text: 'var(--purple)' },
  불가: { bg: 'rgba(240,69,69,0.12)', border: 'var(--red)', text: 'var(--red)' },
  체결: { bg: 'rgba(79,126,248,0.12)', border: 'var(--accent)', text: 'var(--accent)' },
  기타: { bg: 'rgba(156,163,175,0.12)', border: 'var(--text3)', text: 'var(--text2)' },
}

const isOnlyReserved = c =>
  c.category === '예약' &&
  (!c.diagResult || String(c.diagResult).trim() === '')

export default function ListPage() {
  const { consults, loading, error, remove } = useApp()
  const navigate = useNavigate()

  const [topTab, setTopTab] = useState('전체')
  const [botTab, setBotTab] = useState(null)
  const [search, setSearch] = useState('')

  const col = key => TAB_COLOR[key] || TAB_COLOR['기타']

  useEffect(() => {
    if (topTab !== '전체') {
      setBotTab(null)
    }
  }, [topTab])

  const topFiltered = useMemo(() => {
    let list = consults

    if (topTab === '예약') {
      list = list.filter(isOnlyReserved)
    } else if (topTab === '문의') {
      list = list.filter(c => c.category === '문의')
    } else if (topTab === '가맹') {
      list = list.filter(c => c.category === '가맹')
    }

    return list
  }, [consults, topTab])

  const counts = useMemo(() => {
    const map = {}

    map['전체'] = consults.length
    map['예약'] = consults.filter(isOnlyReserved).length
    map['문의'] = consults.filter(c => c.category === '문의').length
    map['가맹'] = consults.filter(c => c.category === '가맹').length

    BOT_TABS.forEach(t => {
      map[t.key] = consults.filter(c => c[t.filterKey] === t.filterVal).length
    })

    return map
  }, [consults])

  const filtered = useMemo(() => {
    let list = topFiltered

    if (topTab === '전체' && botTab) {
      const currentBot = BOT_TABS.find(t => t.key === botTab)

      if (currentBot?.filterKey) {
        list = list.filter(c => c[currentBot.filterKey] === currentBot.filterVal)
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()

      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.feature?.toLowerCase().includes(q) ||
        c.relation?.toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => Number(b.id) - Number(a.id))
  }, [topFiltered, topTab, botTab, search])

  const handleDelete = async id => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return

    try {
      await remove(id)
    } catch (e) {
      alert(`삭제 중 오류가 발생했습니다.\n${e.message || e}`)
    }
  }

  const TabRow = ({ tabs, current, onChange }) => (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
      }}
    >
      {tabs.map(t => {
        const active = current === t.key
        const c = col(t.key)

        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 20,
              border: `1px solid ${active ? c.border : 'var(--border)'}`,
              background: active ? c.bg : 'transparent',
              color: active ? c.text : 'var(--text2)',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'var(--font)',
            }}
          >
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
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text3)',
              fontSize: 15,
            }}
          >
            🔍
          </span>

          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="이름, 전화번호, 특징 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <TabRow tabs={TOP_TABS} current={topTab} onChange={setTopTab} />
      </div>

      {topTab === '전체' && (
        <div style={{ padding: '6px 16px 0' }}>
          <TabRow tabs={BOT_TABS} current={botTab} onChange={setBotTab} />
        </div>
      )}

      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(240,69,69,0.1)',
              border: '1px solid rgba(240,69,69,0.3)',
              borderRadius: 'var(--radius)',
              padding: 16,
              color: 'var(--red)',
              fontSize: 14,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14 }}>
              {topTab === '전체' && !botTab
                ? '상담 내역이 없습니다'
                : `'${topTab}${botTab ? ` > ${botTab}` : ''}' 항목이 없습니다`}
            </div>
          </div>
        )}

        {!loading && !error && filtered.map(c => (
          <ConsultCard
            key={c.id}
            consult={c}
            onClick={() => navigate(`/detail/${c.id}`)}
            onEdit={() => navigate(`/input/${c.id}`)}
            onDelete={() => handleDelete(c.id)}
          />
        ))}
      </div>
    </div>
  )
}