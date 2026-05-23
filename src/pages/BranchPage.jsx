import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CATEGORY_TABS, filterByTab } from '../api/sheets'
import { BRANCHES } from '../auth/users'
import ConsultCard from '../components/ConsultCard'

export default function BranchPage() {
  const { allConsults, remove, adminUpdateBranch, branchOverrides, getEffectivePw, login, currentUser } = useApp()
  const navigate = useNavigate()
  const isAdmin = currentUser?.role === 'admin'

  const [selectedBranch, setSelectedBranch] = useState(null)
  const [tab, setTab] = useState('전체')
  const [search, setSearch] = useState('')

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ displayName: '', principalName: '', loginId: '', newPassword: '' })
  const [editMsg, setEditMsg] = useState(null)

  // DB(allConsults)에서 실제 지사명 추출
  const dbBranchNames = useMemo(() => {
    const map = {}
    allConsults.forEach(c => {
      if (c.branchId && c.branchName?.trim() && !map[c.branchId]) {
        map[c.branchId] = c.branchName.trim()
      }
    })
    return map
  }, [allConsults])

  // 우선순위: admin override > DB branchName > 하드코딩 fallback
  const getEffectiveBranchName = (branchId, fallback) => {
    const ov = branchOverrides[branchId] || {}
    return ov.displayName || dbBranchNames[branchId] || fallback
  }

  const getEffectivePrincipalName = (branchId, branchName) => {
    const ov = branchOverrides[branchId] || {}
    return ov.principalName || `${getEffectiveBranchName(branchId, branchName)} 원장`
  }

  const openEdit = (e, branch) => {
    e.stopPropagation()
    const ov = branchOverrides[branch.id] || {}
    setEditTarget(branch)
    setEditForm({
      displayName: getEffectiveBranchName(branch.id, branch.name),
      principalName: getEffectivePrincipalName(branch.id, branch.name),
      loginId: ov.loginId || branch.id,
      newPassword: '',
    })
    setEditMsg(null)
  }

  const closeEdit = () => {
    setEditTarget(null)
    setEditForm({ displayName: '', principalName: '', loginId: '', newPassword: '' })
    setEditMsg(null)
  }

  const handleSaveEdit = async () => {
    try {
      setEditMsg({ ok: null, text: '저장 중...' })
      await adminUpdateBranch(editTarget.id, {
        displayName: editForm.displayName.trim() || undefined,
        principalName: editForm.principalName.trim() || undefined,
        loginId: editForm.loginId.trim() || undefined,
        newPassword: editForm.newPassword.trim() || undefined,
      })
      setEditMsg({ ok: true, text: '저장되었습니다.' })
      setEditForm(f => ({ ...f, newPassword: '' }))
    } catch (e) {
      setEditMsg({ ok: false, text: e.message })
    }
  }

  const handleLoginAsBranch = () => {
    try {
      const pw = getEffectivePw(editTarget.id)
      login(editTarget.id, pw)
      navigate('/')
    } catch (e) {
      setEditMsg({ ok: false, text: e.message })
    }
  }

  const branchConsults = useMemo(() => {
    if (!selectedBranch) return []
    return allConsults.filter(c => c.branchId === selectedBranch.id)
  }, [allConsults, selectedBranch])

  const counts = useMemo(() => {
    const map = { '전체': branchConsults.length }
    for (const t of CATEGORY_TABS.slice(1)) {
      map[t] = filterByTab(branchConsults, t).length
    }
    return map
  }, [branchConsults])

  const filtered = useMemo(() => {
    let list = filterByTab(branchConsults, tab)
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

  // ── 지사 선택 화면 ──
  if (!selectedBranch) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.04em' }}>
          지사 관리
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
          조회할 지사를 선택하세요
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {BRANCHES.map(b => {
            const cnt = allConsults.filter(c => c.branchId === b.id).length
            const displayName = getEffectiveBranchName(b.id, b.name)
            const principalName = getEffectivePrincipalName(b.id, b.name)
            return (
              <div key={b.id} style={{ position: 'relative', minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => { setSelectedBranch(b); setTab('전체'); setSearch('') }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    padding: isAdmin ? '12px 6px 28px' : '14px 6px',
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 1px 6px rgba(15,23,42,0.05)',
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: 800, color: 'var(--accent)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '90%', letterSpacing: '-0.02em',
                  }}>
                    {displayName}
                  </span>
                  <span style={{
                    fontSize: 11, color: 'var(--text2)', fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '90%',
                  }}>
                    {principalName}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>
                    {cnt}건
                  </span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={e => openEdit(e, b)}
                    style={{
                      position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 10, padding: '2px 8px', borderRadius: 6,
                      border: '1px solid var(--border)', background: '#f3f4f6',
                      color: 'var(--text3)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                    }}
                  >
                    편집
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 지사 편집 모달 (관리자 전용) */}
        {editTarget && (
          <div onClick={closeEdit}
            style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: '18px 18px 0 0', padding: '24px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>
                    {getEffectiveBranchName(editTarget.id, editTarget.name)} 편집
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>관리자 전용</div>
                </div>
                <button type="button" onClick={closeEdit}
                  style={{ fontSize: 22, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>지사명</div>
                <input className="input" type="text" placeholder="지사명"
                  value={editForm.displayName}
                  onChange={e => { setEditForm(f => ({ ...f, displayName: e.target.value })); setEditMsg(null) }}
                  style={{ fontSize: 14 }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>원장명</div>
                <input className="input" type="text" placeholder="원장명"
                  value={editForm.principalName}
                  onChange={e => { setEditForm(f => ({ ...f, principalName: e.target.value })); setEditMsg(null) }}
                  style={{ fontSize: 14 }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>아이디</div>
                <input className="input" type="text" placeholder="로그인 아이디"
                  value={editForm.loginId}
                  onChange={e => { setEditForm(f => ({ ...f, loginId: e.target.value })); setEditMsg(null) }}
                  style={{ fontSize: 14, letterSpacing: 0.5 }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>현재 비밀번호</div>
                <div style={{ padding: '11px 14px', background: '#f3f4f6', borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: 2 }}>
                  {getEffectivePw(editTarget.id)}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>새 비밀번호 (변경 시 입력, 4자 이상)</div>
                <input className="input" type="text" placeholder="변경할 비밀번호 (미입력 시 유지)"
                  value={editForm.newPassword}
                  onChange={e => { setEditForm(f => ({ ...f, newPassword: e.target.value })); setEditMsg(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                  style={{ fontSize: 14, letterSpacing: 0.5 }} />
              </div>

              {editMsg && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: editMsg.ok === true ? '#f0fdf4' : editMsg.ok === false ? '#fee2e2' : '#f3f4f6',
                  color: editMsg.ok === true ? '#15803d' : editMsg.ok === false ? 'var(--red)' : 'var(--text2)' }}>
                  {editMsg.ok === true ? '✅ ' : editMsg.ok === false ? '❌ ' : '⏳ '}{editMsg.text}
                </div>
              )}

              <button type="button" onClick={handleSaveEdit}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                저장
              </button>

              <button type="button" onClick={handleLoginAsBranch}
                style={{ width: '100%', padding: '13px', borderRadius: 12, marginTop: 10,
                  border: '1.5px solid var(--accent)', background: '#fff',
                  color: 'var(--accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                이 지사로 로그인
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 지사 상담 목록 화면 ──
  const headerName = getEffectiveBranchName(selectedBranch.id, selectedBranch.name)

  return (
    <div className="list-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => { setSelectedBranch(null); setSearch('') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '7px 12px', border: '1px solid var(--border)',
            borderRadius: 9, background: '#f3f4f6',
            color: 'var(--text2)', fontSize: 13, fontWeight: 700,
          }}
        >
          ← 지사 목록
        </button>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.04em' }}>
          {headerName}
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
          <button key={t} type="button"
            className={`category-chip${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}>
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
