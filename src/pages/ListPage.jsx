import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CATEGORY_TABS } from '../api/sheets'
import { BRANCHES } from '../auth/users'
import ConsultCard from '../components/ConsultCard'

export default function ListPage() {
  const { consults, loading, error, remove, currentUser } = useApp()
  const navigate = useNavigate()
  const isAdmin = currentUser?.role === 'admin'
  const [tab, setTab] = useState('전체')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('전체')

  // 관리자: 지사 필터 적용 / 지사 계정: 이미 context에서 자기 지사만 내려옴
  const branchFiltered = useMemo(() => {
    if (!isAdmin || branchFilter === '전체') return consults
    return consults.filter(c => c.branchId === branchFilter)
  }, [consults, isAdmin, branchFilter])

  const counts = useMemo(() => {
    const map = { '전체': branchFiltered.length }
    for (const t of CATEGORY_TABS.slice(1)) {
      map[t] = branchFiltered.filter(c => c.category === t).length
    }
    return map
  }, [branchFiltered])

  const filtered = useMemo(() => {
    let list = tab === '전체' ? branchFiltered : branchFiltered.filter(c => c.category === tab)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      )
    }
    return list
  }, [branchFiltered, tab, search])

  const handleDelete = async consult => {
    if (!window.confirm(`"${consult.name}" 상담을 삭제할까요?`)) return
    await remove(consult.id)
  }

  return (
    <div className="list-page">
      <div className="search-box">
        <span>🔍</span>
        <input
          placeholder="이름 또는 전화번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isAdmin && (
        <div className="tab-wrap" style={{ paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          {[{ id: '전체', name: '전체' }, ...BRANCHES].map(b => (
            <button
              key={b.id}
              type="button"
              className={`category-chip${branchFilter === b.id ? ' active' : ''}`}
              onClick={() => setBranchFilter(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="tab-wrap">
        {CATEGORY_TABS.map(t => (
          <button
            key={t}
            type="button"
            className={`category-chip${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}<span>{counts[t] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="list-divider" />

      {loading && (
        <div className="center-box">
          <div className="spinner" />
        </div>
      )}

      {error && !loading && (
        <div className="error-box">{error}</div>
      )}

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
  )
}
