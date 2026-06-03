import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CATEGORY_TABS, filterByTab, cleanPhone } from '../api/sheets'
import { readMmsHistory, normalizeMmsPhone } from '../hooks/useSmsAttendance'
import ConsultCard from '../components/ConsultCard'
import { useAttendanceTotals } from '../hooks/useAttendanceTotals'
import AttendanceHistoryModal from '../components/AttendanceHistoryModal'

// 탭 순서 재정의: 수업종료·핑크·환불·미등록·연결·가맹·전체
const MAIN_TABS = ['예약', '문의', '수업중']
// 서브탭: 가맹 바로 옆(뒤)에 전체 고정
const SUB_TABS = ['수업종료', '펑크', '크레임', '환불', '미등록', '연결', '가맹', '재결재완료', '전체', '📷 이미지']

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
  const location = useLocation()
  const { totals: attendanceTotals, getFilteredCount } = useAttendanceTotals()
  const [attendanceStudent, setAttendanceStudent] = useState(null) // { name, phone, fromDate }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.key])

  const [tab, setTab] = useState('전체')         // 현재 필터 탭
  const [selectedTab, setSelectedTab] = useState(null)   // 1클릭 선택(파란 테두리)
  const [chartTab, setChartTab] = useState(null)          // 2클릭 활성(하늘색 + 차트)
  const [search, setSearch] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [showSubTabs, setShowSubTabs] = useState(false)

  const MMS_CACHE_KEY = 'crm_mms_senders'

  // MMS 이미지 발신자 전화번호 Set — 캐시에서 즉시 초기화
  const [mmsSenders, setMmsSenders] = useState(() => {
    try {
      const cached = localStorage.getItem(MMS_CACHE_KEY)
      if (cached) return new Set(JSON.parse(cached))
    } catch {}
    return null
  })
  const [mmsLoading, setMmsLoading] = useState(false)
  const [mmsScanned, setMmsScanned] = useState(false)

  // '📷 이미지' 탭 선택 시 디바이스 재스캔 (세션당 1회) — 캐시는 즉시 표시
  useEffect(() => {
    if (tab !== '📷 이미지' || mmsScanned || mmsLoading) return
    setMmsLoading(true)
    readMmsHistory(3000).then(({ items }) => {
      const phones = new Set(
        items.map(i => normalizeMmsPhone(i.phone)).filter(p => p.length >= 9)
      )
      setMmsSenders(phones)
      try { localStorage.setItem(MMS_CACHE_KEY, JSON.stringify([...phones])) } catch {}
      setMmsScanned(true)
      setMmsLoading(false)
    })
  }, [tab, mmsScanned, mmsLoading])
  // 시간 제한 없이 클릭 횟수로만 판단
  const clickCountRef = useRef({ tab: null, count: 0 })
  const composingRef = useRef(false)

  const handleSearchChange = useCallback(e => {
    const val = e.target.value
    setInputVal(val)
    if (!composingRef.current) setSearch(val)
  }, [])

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(e => {
    composingRef.current = false
    setSearch(e.target.value)
  }, [])

  const ALL_TABS = [...MAIN_TABS, ...SUB_TABS]

  const counts = useMemo(() => {
    const map = {}
    for (const t of ALL_TABS) {
      if (t === '📷 이미지') {
        map[t] = consults.filter(c =>
          c.hasPhoto === '유' || (mmsSenders?.has(cleanPhone(c.phone)))
        ).length
      } else {
        map[t] = filterByTab(consults, t).length
      }
    }
    return map
  }, [consults, mmsSenders])

  const filtered = useMemo(() => {
    let list
    if (tab === '📷 이미지') {
      list = consults.filter(c =>
        c.hasPhoto === '유' || (mmsSenders?.has(cleanPhone(c.phone)))
      )
    } else {
      list = filterByTab(consults, tab)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.phone || '').includes(q)
      )
    }
    if (tab === '예약') {
      return [...list].sort((a, b) => {
        const da = a.diagDate || ''
        const db = b.diagDate || ''
        return da.localeCompare(db)
      })
    }
    return [...list].sort((a, b) => {
      const da = a.inquiryDate || a.savedAt || ''
      const db = b.inquiryDate || b.savedAt || ''
      return db.localeCompare(da)
    })
  }, [consults, tab, search, mmsSenders])

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
      <div className="list-sticky-top" style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 90 }}>
        <div className="search-box">
          <span>🔍</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            placeholder="이름 또는 전화번호 검색"
            value={inputVal}
            onChange={handleSearchChange}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
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
        {loading && <div className="top-loading-bar" />}
        {error && !loading && <div className="error-box">{error}</div>}
        {loading && filtered.length === 0 && (
          <div className="empty-box" style={{ color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>
            데이터를 불러오는 중입니다...
          </div>
        )}
        {tab === '📷 이미지' && mmsLoading && (
          <div className="empty-box" style={{ color: 'var(--text3)', fontSize: 13 }}>
            MMS 이미지 내역을 불러오는 중...
          </div>
        )}
        {!loading && !error && !mmsLoading && filtered.length === 0 && (
          <div className="empty-box">
            {search
              ? '검색 결과가 없습니다'
              : tab === '📷 이미지'
                ? '이미지를 보낸 문의가 없습니다'
                : '등록된 상담이 없습니다'}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="consult-list">
            {filtered.map(c => {
              const showAttendance = ['수업중', '수업종료', '환불'].includes(tab)
              const count = showAttendance ? getFilteredCount(c.name, c.phone, c.inquiryDate) : 0
              return (
                <ConsultCard
                  key={c.id}
                  consult={c}
                  attendanceCount={count}
                  onAttendanceClick={count > 0 ? () => setAttendanceStudent({ name: c.name, phone: c.phone, fromDate: c.inquiryDate }) : undefined}
                  onClick={() => navigate(`/detail/${c.id}`)}
                  onEdit={() => navigate(`/input/${c.id}`)}
                  onDelete={() => handleDelete(c)}
                />
              )
            })}
          </div>
        )}
      </div>

      {attendanceStudent && (
        <AttendanceHistoryModal
          studentName={attendanceStudent.name}
          studentPhone={attendanceStudent.phone}
          fromDate={attendanceStudent.fromDate}
          onClose={() => setAttendanceStudent(null)}
        />
      )}
    </div>
  )
}
