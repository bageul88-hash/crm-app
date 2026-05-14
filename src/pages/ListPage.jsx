import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CATEGORY_TABS, filterByTab } from '../api/sheets'
import ConsultCard from '../components/ConsultCard'

// 탭 순서 재정의: 수업종료·핑크·환불·미등록·연결·가맹·전체
const MAIN_TABS = ['예약', '문의', '수업중']
// 서브탭: 가맹 바로 옆(뒤)에 전체 고정
const SUB_TABS = ['수업종료', '펑크', '환불', '미등록', '연결', '가맹', '전체']

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

// consults에서 연도 목록 추출
function getYears(consults) {
  const years = new Set()
  consults.forEach(c => {
    const d = c.inquiryDate || c.savedAt || ''
    const m = d.match(/(\d{4})[.\-\/]/)
    if (m) years.add(m[1])
  })
  const sorted = [...years].sort().reverse()
  return sorted.length ? sorted : [String(new Date().getFullYear())]
}

// 특정 탭·연도의 월별 건수
function getMonthlyData(consults, tab, year) {
  const counts = new Array(12).fill(0)
  filterByTab(consults, tab).forEach(c => {
    const d = c.inquiryDate || c.savedAt || ''
    const m = d.match(/(\d{4})[.\-\/](\d{1,2})/)
    if (m && m[1] === year) {
      const idx = parseInt(m[2], 10) - 1
      if (idx >= 0 && idx < 12) counts[idx]++
    }
  })
  return counts
}

// 특정 탭의 연도별 총 건수
function getYearlyData(consults, tab, years) {
  return years.map(year => {
    const list = filterByTab(consults, tab)
    return list.filter(c => {
      const d = c.inquiryDate || c.savedAt || ''
      const m = d.match(/(\d{4})[.\-\/]/)
      return m && m[1] === year
    }).length
  })
}

function MonthlyChart({ consults, tab, onClose }) {
  const years = useMemo(() => getYears(consults), [consults])
  const [chartMode, setChartMode] = useState('monthly') // 'monthly' | 'yearly'
  const [selectedYear, setSelectedYear] = useState(years[0] || String(new Date().getFullYear()))

  const monthlyData = useMemo(() => getMonthlyData(consults, tab, selectedYear), [consults, tab, selectedYear])
  const yearlyData  = useMemo(() => getYearlyData(consults, tab, years), [consults, tab, years])

  const data  = chartMode === 'monthly' ? monthlyData : yearlyData
  const labels = chartMode === 'monthly' ? MONTHS : years
  const max   = Math.max(...data, 1)
  const total = data.reduce((a, b) => a + b, 0)

  return (
    <div className="mc-box">
      {/* 헤더 */}
      <div className="mc-header">
        <span className="mc-title">{tab}</span>
        <div className="mc-mode-btns">
          <button
            className={`mc-mode-btn${chartMode === 'monthly' ? ' sel' : ''}`}
            onClick={() => setChartMode('monthly')}
          >월별</button>
          <button
            className={`mc-mode-btn${chartMode === 'yearly' ? ' sel' : ''}`}
            onClick={() => setChartMode('yearly')}
          >연도별</button>
        </div>
        <button className="mc-close" onClick={onClose}>✕</button>
      </div>

      {/* 연도 선택 (월별 모드에서만) */}
      {chartMode === 'monthly' && (
        <div className="mc-year-row">
          {years.map(y => (
            <button
              key={y}
              className={`mc-year-btn${selectedYear === y ? ' sel' : ''}`}
              onClick={() => setSelectedYear(y)}
            >{y}</button>
          ))}
        </div>
      )}

      {/* 요약 */}
      <div className="mc-summary">
        <span className="mc-summary-label">
          {chartMode === 'monthly' ? `${selectedYear}년 합계` : '전체 합계'}
        </span>
        <span className="mc-summary-count">{total}건</span>
      </div>

      {/* 바 차트 */}
      <div className="mc-bars">
        {labels.map((label, i) => {
          const pct = Math.round((data[i] / max) * 100)
          return (
            <div key={label} className="mc-bar-row">
              <span className="mc-bar-label">{label}</span>
              <div className="mc-bar-track">
                <div className="mc-bar-fill" style={{ width: `${pct || (data[i] > 0 ? 2 : 0)}%` }} />
              </div>
              <span className="mc-bar-count">{data[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ListPage() {
  const { consults, loading, error, remove } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('전체')         // 현재 필터 탭
  const [selectedTab, setSelectedTab] = useState(null)   // 1클릭 선택(파란 테두리)
  const [chartTab, setChartTab] = useState(null)          // 2클릭 활성(하늘색 + 차트)
  const [search, setSearch] = useState('')
  const [showSubTabs, setShowSubTabs] = useState(false)
  // 시간 제한 없이 클릭 횟수로만 판단
  const clickCountRef = useRef({ tab: null, count: 0 })

  const ALL_TABS = [...MAIN_TABS, ...SUB_TABS]

  const counts = useMemo(() => {
    const map = { '전체': consults.length }
    for (const t of CATEGORY_TABS.slice(1)) {
      map[t] = filterByTab(consults, t).length
    }
    return map
  }, [consults])

  const filtered = useMemo(() => {
    let list = filterByTab(consults, tab)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      )
    }
    return list
  }, [consults, tab, search])

  const handleDelete = async consult => {
    if (!window.confirm(`"${consult.name}" 상담을 삭제할까요?`)) return
    await remove(consult.id)
  }

  const handleTabClick = t => {
    const ref = clickCountRef.current

    if (ref.tab === t) {
      // 같은 탭 재클릭 → 카운트 증가
      ref.count += 1
    } else {
      // 다른 탭 클릭 → 초기화 후 1클릭
      ref.tab = t
      ref.count = 1
      setChartTab(null)
    }

    if (ref.count === 1) {
      // 1클릭: 파란 테두리 선택
      setSelectedTab(t)
      setTab(t)
      if (SUB_TABS.includes(t)) setShowSubTabs(true)
    } else if (ref.count === 2) {
      // 2클릭: 하늘색 활성 + 차트 표시
      setChartTab(t)
      setSelectedTab(t)
      setTab(t)
      ref.count = 0 // 다음 클릭 시 다시 1클릭부터
    }
  }

  const getChipClass = t => {
    let cls = 'category-chip'
    if (chartTab === t)   cls += ' chip-chart'    // 2클릭: 하늘색
    else if (selectedTab === t) cls += ' chip-sel' // 1클릭: 파란 테두리
    if (t === '전체' && !chartTab && !selectedTab) cls += ' chip-default-all'
    return cls
  }

  const renderTab = t => (
    <button
      key={t}
      type="button"
      className={getChipClass(t)}
      onClick={() => handleTabClick(t)}
    >
      {t}<span>{counts[t] ?? 0}</span>
    </button>
  )

  return (
    <div className="list-page">
      <div className="list-sticky-top">
        <div className="search-box">
          <span>🔍</span>
          <input
            placeholder="이름 또는 전화번호 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="tab-area">
          <div className="tab-row">
            {MAIN_TABS.map(renderTab)}
            <button
              type="button"
              className={`tab-toggle-btn${showSubTabs ? ' open' : ''}`}
              onClick={() => setShowSubTabs(p => !p)}
              title={showSubTabs ? '탭 접기' : '더 보기'}
            >
              {showSubTabs ? '▲' : '▼'}
            </button>
          </div>

          {showSubTabs && (
            <div className="tab-row tab-row-sub">
              {SUB_TABS.map(renderTab)}
            </div>
          )}
        </div>

        <p className="tab-hint">탭 1번 클릭: 선택 · 2번 클릭: 월별/연도별 현황</p>
        <div className="list-divider" style={{ margin: '6px 0 0' }} />
      </div>

      {chartTab && (
        <MonthlyChart
          consults={consults}
          tab={chartTab}
          onClose={() => setChartTab(null)}
        />
      )}

      <div className="list-scroll-body">
        {loading && <div className="center-box"><div className="spinner" /></div>}
        {error && !loading && <div className="error-box">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-box">
            {search ? '검색 결과가 없습니다' : '등록된 상담이 없습니다'}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="consult-list">
            {filtered.map(c => (
              <ConsultCard
                key={c.id}
                consult={c}
                onClick={() => navigate(`/detail/${c.id}`)}
                onEdit={() => navigate(`/input/${c.id}`)}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
