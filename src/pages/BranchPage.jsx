import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CATEGORY_TABS } from '../api/sheets'
import { BRANCHES } from '../auth/users'
import ConsultCard from '../components/ConsultCard'

export default function BranchPage() {
  const { allConsults, remove } = useApp()
  const navigate = useNavigate()

  const [selectedBranch, setSelectedBranch] = useState(null)
  const [tab, setTab] = useState('전체')
  const [search, setSearch] = useState('')

  const branchConsults = useMemo(() => {
    if (!selectedBranch) return []
    return allConsults.filter(c => c.branchId === selectedBranch.id)
  }, [allConsults, selectedBranch])

  const counts = useMemo(() => {
    const map = { '전체': branchConsults.length }
    for (const t of CATEGORY_TABS.slice(1)) {
      map[t] = branchConsults.filter(c => c.category === t).length
    }
    return map
  }, [branchConsults])

  const filtered = useMemo(() => {
    let list = tab === '전체' ? branchConsults : branchConsults.filter(c => c.category === tab)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      )
    }
    return list
  }, [branchConsults, tab, search])

  const handleDelete = async consult => {
    if (!window.confirm(`"${consult.name}" 상담을 삭제할까요?`)) return
    await remove(consult.id)
  }

  // 지사 선택 화면
  if (!selectedBranch) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.04em' }}>
          지사 관리
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          조회할 지사를 선택하세요
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {BRANCHES.map(b => {
            const cnt = allConsults.filter(c => c.branchId === b.id).length
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { setSelectedBranch(b); setTab('전체'); setSearch('') }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '18px 8px',
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.04em' }}>
                  {b.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                  {cnt}건
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // 해당 지사 상담 목록 화면
  return (
    <div className="list-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => { setSelectedBranch(null); setSearch('') }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '7px 12px',
            border: '1px solid var(--border)',
            borderRadius: 9,
            background: '#f3f4f6',
            color: 'var(--text2)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ← 지사 목록
        </button>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.04em' }}>
          {selectedBranch.name}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>
          {branchConsults.length}건
        </span>
      </div>

      <div className="search-box">
        <span>🔍</span>
        <input
          placeholder="이름 또는 전화번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

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

      {filtered.length === 0 && (
        <div className="empty-box">
          {search ? '검색 결과가 없습니다' : '등록된 상담이 없습니다'}
        </div>
      )}

      {filtered.length > 0 && (
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
