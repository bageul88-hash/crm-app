import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'

const STORAGE_KEY = 'crm_memos'
const DAY_KR = ['일','월','화','수','목','금','토']

function loadMemos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveMemos(memos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memos)) } catch {}
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const mo = d.getMonth() + 1, day = d.getDate()
  const h = d.getHours(), m = d.getMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  const hh = h % 12 || 12
  return `${mo}/${day}(${DAY_KR[d.getDay()]}) ${ampm} ${hh}:${String(m).padStart(2,'0')}`
}

export default function MemoPage() {
  const { currentUser } = useApp()
  const [memos, setMemos] = useState(loadMemos)
  const [editId, setEditId] = useState(null)   // null = list, 'new' = new, string = edit
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  if (currentUser?.role !== 'admin') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div>본사 관리자만 접근 가능합니다</div>
      </div>
    )
  }

  const openNew = () => {
    setEditId('new')
    setTitle('')
    setContent('')
  }

  const openEdit = (memo) => {
    setEditId(memo.id)
    setTitle(memo.title)
    setContent(memo.content)
  }

  const closeEdit = () => {
    setEditId(null)
    setTitle('')
    setContent('')
  }

  const handleSave = () => {
    const trimTitle = title.trim()
    const trimContent = content.trim()
    if (!trimTitle && !trimContent) return

    setSaving(true)
    const now = new Date().toISOString()

    let updated
    if (editId === 'new') {
      const newMemo = {
        id: `memo_${Date.now()}`,
        title: trimTitle || '(제목 없음)',
        content: trimContent,
        createdAt: now,
        updatedAt: now,
      }
      updated = [newMemo, ...memos]
    } else {
      updated = memos.map(m =>
        m.id === editId
          ? { ...m, title: trimTitle || '(제목 없음)', content: trimContent, updatedAt: now }
          : m
      )
    }

    saveMemos(updated)
    setMemos(updated)
    setSaving(false)
    closeEdit()
  }

  const handleDelete = (id) => {
    if (!window.confirm('이 메모를 삭제할까요?')) return
    const updated = memos.filter(m => m.id !== id)
    saveMemos(updated)
    setMemos(updated)
    if (editId === id) closeEdit()
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return memos
    const q = search.trim().toLowerCase()
    return memos.filter(m =>
      m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
    )
  }, [memos, search])

  // ── 편집 화면 ──
  if (editId !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fffef0' }}>
        {/* 편집 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
          <button onClick={closeEdit}
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            ← 뒤로
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '7px 18px' }}>
            저장
          </button>
        </div>

        {/* 제목 */}
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            fontSize: 18, fontWeight: 700, border: 'none', borderBottom: '1px solid #e5e7eb',
            padding: '16px', outline: 'none', background: '#fffef0', width: '100%',
          }}
        />

        {/* 본문 */}
        <textarea
          placeholder="내용을 입력하세요"
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{
            flex: 1, fontSize: 15, border: 'none', padding: '16px',
            outline: 'none', resize: 'none', background: '#fffef0',
            lineHeight: 1.7, fontFamily: 'inherit',
          }}
        />

        {/* 삭제 */}
        {editId !== 'new' && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
            <button onClick={() => handleDelete(editId)}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              🗑 메모 삭제
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── 목록 화면 ──
  return (
    <div style={{ padding: '16px 16px 32px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>본사 메모</h2>
        <button onClick={openNew}
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 9, cursor: 'pointer', padding: '8px 14px' }}>
          + 새 메모
        </button>
      </div>

      {/* 검색 */}
      <div className="search-box" style={{ marginBottom: 14 }}>
        <span>🔍</span>
        <input
          type="text"
          placeholder="메모 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoComplete="off"
        />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: '0 4px' }}>✕</button>
        )}
      </div>

      {/* 메모 없음 */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14 }}>{search ? '검색 결과가 없습니다' : '메모가 없습니다. 새 메모를 작성해보세요.'}</div>
        </div>
      )}

      {/* 메모 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(m => (
          <div key={m.id} onClick={() => openEdit(m)}
            style={{ background: '#fffef0', borderRadius: 12, padding: '14px 16px', border: '1px solid #e5d97e', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.title}
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(m.id) }}
                style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 0 0 8px', flexShrink: 0 }}>✕</button>
            </div>
            {m.content && (
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 8 }}>
                {m.content}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {fmtDateTime(m.updatedAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
