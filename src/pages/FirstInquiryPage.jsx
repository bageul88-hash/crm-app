import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { registerPlugin } from '@capacitor/core'

const SmsPlugin = registerPlugin('SmsPlugin')
const MIN_DELAY = 5000
const MAX_DELAY = 10000

const DEFAULT_TEMPLATE = `안녕하세요, 참바른글씨입니다. 😊
{학생이름} 학생의 글씨 문의 감사드립니다.
진단 예약을 아직 안 하셨다면, 지금 바로 예약해보세요! ✍️

📅 편한 날짜와 시간으로 예약해 드립니다.
📞 02-558-4111
🌐 pentwo.com

감사합니다.`

const FI_HISTORY_KEY = 'crm_first_inquiry_history'
const FI_TEMPLATES_KEY = 'crm_first_inquiry_templates'
const FI_ACTIVE_KEY = 'crm_first_inquiry_active_template_id'
const FI_SENT_IDS_KEY = 'crm_first_inquiry_sent_ids'

const EXCLUDE_DIAG_RESULTS = new Set(['연결', '미등록', '가맹', '크레임'])

function loadTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(FI_TEMPLATES_KEY) || 'null')
    if (Array.isArray(saved) && saved.length > 0) return saved
  } catch {}
  return [{ id: 'fi1', title: '첫문의 안내', body: DEFAULT_TEMPLATE }]
}
function loadActiveId(tpls) {
  try {
    const saved = localStorage.getItem(FI_ACTIVE_KEY)
    if (saved && tpls.find(t => t.id === saved)) return saved
  } catch {}
  return tpls[0]?.id ?? null
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(FI_HISTORY_KEY) || '[]') } catch { return [] }
}
function loadSentSet() {
  try {
    const saved = JSON.parse(localStorage.getItem(FI_SENT_IDS_KEY) || '[]')
    return new Set(Array.isArray(saved) ? saved : [])
  } catch { return new Set() }
}
function persistSentName(name) {
  try {
    const saved = JSON.parse(localStorage.getItem(FI_SENT_IDS_KEY) || '[]')
    const arr = Array.isArray(saved) ? saved : []
    if (!arr.includes(name)) { arr.push(name); localStorage.setItem(FI_SENT_IDS_KEY, JSON.stringify(arr)) }
  } catch {}
}
function normName(s) { return String(s ?? '').replace(/\s+/g, '').toLowerCase() }
function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const mo = d.getMonth() + 1, day = d.getDate()
  const h = d.getHours(), m = d.getMinutes()
  return `${mo}/${day} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

function SortableTemplateItem({ tpl, isActive, onSelect, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tpl.id })
  return (
    <div ref={setNodeRef} style={{ borderRadius: 12, padding: '11px 13px', background: '#fff', border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)', transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div {...attributes} {...listeners} style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab', fontSize: 18, color: '#9ca3af', padding: '0 4px', userSelect: 'none', lineHeight: 1 }}>≡</div>
          {isActive && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>사용 중</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tpl.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {!isActive && <button type="button" onClick={onSelect} style={{ padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1px solid var(--accent)', background: 'rgba(79,126,248,0.08)', color: 'var(--accent)', cursor: 'pointer' }}>선택</button>}
          <button type="button" onClick={onEdit} style={{ padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', background: '#f3f4f6', color: 'var(--text2)', cursor: 'pointer' }}>수정</button>
          <button type="button" onClick={onDelete} style={{ padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444', cursor: 'pointer' }}>삭제</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, whiteSpace: 'pre-line', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{tpl.body}</div>
    </div>
  )
}

export default function FirstInquiryPage() {
  const { currentUser, consults: contextConsults, silentSync } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [students, setStudents] = useState([])
  const [history, setHistory] = useState(loadHistory)
  const [selected, setSelected] = useState(new Set())
  const [templates, setTemplates] = useState(loadTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState(() => loadActiveId(loadTemplates()))
  const [tplForm, setTplForm] = useState(null)
  const [phase, setPhase] = useState('list')
  const [sendQueue, setSendQueue] = useState([])
  const [sendIdx, setSendIdx] = useState(0)
  const [sendResults, setSendResults] = useState(null)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState(null)
  const abortRef = useRef(false)
  const wakeLockRef = useRef(null)

  const refresh = useCallback(() => {
    const allConsults = contextConsults?.length > 0
      ? contextConsults
      : (() => { try { return JSON.parse(localStorage.getItem('crm_consults_cache') || '[]') } catch { return [] } })()
    const sentSet = loadSentSet()
    const seen = new Map()
    allConsults.forEach(c => {
      if (c.category !== '문의') return
      if (EXCLUDE_DIAG_RESULTS.has(c.diagResult)) return
      const key = normName(c.name)
      if (!key) return
      if (sentSet.has(c.name)) return
      const existing = seen.get(key)
      if (!existing || Number(c.id) > Number(existing.consultId)) {
        seen.set(key, {
          id: String(c.id),
          name: String(c.name || ''),
          phone: String(c.phone || '').replace(/[^0-9]/g, ''),
          phoneDisplay: c.phone || '',
          consultId: c.id,
          inquiryDate: c.inquiryDate || '',
        })
      }
    })
    const result = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
    setStudents(result)
    setHistory(loadHistory())
  }, [contextConsults])

  useEffect(() => { refresh() }, [refresh])

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }, [])

  const handleImport = useCallback(async () => {
    if (importing) return
    setImporting(true)
    try { await silentSync() } catch {}
    refresh()
    setImporting(false)
    const allC = contextConsults?.length > 0
      ? contextConsults
      : (() => { try { return JSON.parse(localStorage.getItem('crm_consults_cache') || '[]') } catch { return [] } })()
    const sentSet = loadSentSet()
    const seen = new Set()
    allC.forEach(c => {
      if (c.category !== '문의') return
      if (EXCLUDE_DIAG_RESULTS.has(c.diagResult)) return
      if (sentSet.has(c.name)) return
      seen.add(normName(c.name))
    })
    showToast(`상담 데이터 갱신 완료 — 첫문의 대상 ${seen.size}명`)
  }, [importing, silentSync, refresh, showToast, contextConsults])

  const saveTemplates = list => { setTemplates(list); try { localStorage.setItem(FI_TEMPLATES_KEY, JSON.stringify(list)) } catch {} }
  const saveActiveId = id => { setActiveTemplateId(id); try { localStorage.setItem(FI_ACTIVE_KEY, id ?? '') } catch {} }
  const selectTemplate = id => saveActiveId(id)
  const deleteTemplate = id => {
    if (templates.length <= 1) { alert('템플릿은 최소 1개 이상이어야 합니다.'); return }
    if (!window.confirm('이 템플릿을 삭제하시겠습니까?')) return
    const next = templates.filter(t => t.id !== id)
    saveTemplates(next)
    if (activeTemplateId === id) saveActiveId(next[0]?.id ?? null)
  }
  const saveTplForm = () => {
    const { id, title, body } = tplForm
    if (!title.trim() || !body.trim()) { alert('제목과 내용을 모두 입력해주세요.'); return }
    if (id) {
      saveTemplates(templates.map(t => t.id === id ? { ...t, title: title.trim(), body: body.trim() } : t))
    } else {
      const newTpl = { id: `fi${Date.now()}`, title: title.trim(), body: body.trim() }
      saveTemplates([...templates, newTpl])
      saveActiveId(newTpl.id)
    }
    setTplForm(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const handleDragEnd = event => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIdx = templates.findIndex(t => t.id === active.id)
      const newIdx = templates.findIndex(t => t.id === over.id)
      saveTemplates(arrayMove(templates, oldIdx, newIdx))
    }
  }

  const activeBody = (templates.find(t => t.id === activeTemplateId) ?? templates[0])?.body ?? ''

  if (currentUser?.role !== 'admin') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div>본사 관리자만 접근 가능합니다</div>
      </div>
    )
  }

  const selectedStudents = students.filter(s => selected.has(s.id))
  const cur = sendQueue[sendIdx]
  const toggleSelect = id => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleAll = () => setSelected(selected.size === students.length ? new Set() : new Set(students.map(s => s.id)))

  const sendInquirySmsSequential = async () => {
    const targets = students.filter(s => selected.has(s.id))
    if (targets.length === 0) { alert('발송할 대상이 없습니다.'); return }
    const h = new Date().getHours()
    if (h >= 21 || h < 8) {
      if (!window.confirm('야간(오후 9시~오전 8시)에는 광고성 문자 발송이 제한됩니다.\n그래도 보내시겠습니까?')) return
    }
    try {
      const perm = await SmsPlugin.requestSendSmsPermission()
      if (!perm.granted) { alert('SMS 발송 권한이 없습니다. 설정에서 허용해주세요.'); return }
    } catch (e) { console.warn('[SMS] 권한 확인 실패(웹 환경):', e?.message) }
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch (e) { console.warn('[WakeLock]', e?.message) }
    abortRef.current = false
    setSendQueue(targets)
    setSendIdx(0)
    setSendResults(null)
    setPhase('sending')
    const successes = [], failures = [], newHistItems = []
    for (let i = 0; i < targets.length; i++) {
      if (abortRef.current) break
      setSendIdx(i)
      const s = targets[i]
      if (!s.phone) { failures.push({ name: s.name, phone: '없음', reason: '전화번호 없음' }); continue }
      try {
        const body = activeBody.replace(/{학생이름}/g, s.name).replace(/{N}/g, '')
        await SmsPlugin.sendSms({ phone: s.phone, body })
        successes.push({ name: s.name, phone: s.phone })
        persistSentName(s.name)
        newHistItems.push({ id: `fi_${Date.now()}_${i}`, studentName: s.name, phone: s.phone, sentAt: new Date().toISOString() })
      } catch (e) {
        failures.push({ name: s.name, phone: s.phone, reason: e?.message || '발송 오류' })
      }
      if (i < targets.length - 1 && !abortRef.current) {
        const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY
        await new Promise(r => setTimeout(r, delay))
      }
    }
    if (newHistItems.length > 0) {
      const updated = [...loadHistory(), ...newHistItems]
      try { localStorage.setItem(FI_HISTORY_KEY, JSON.stringify(updated)) } catch {}
      setHistory(updated)
    }
    try { await wakeLockRef.current?.release(); wakeLockRef.current = null } catch (_) {}
    setSendResults({ success: successes, failure: failures, aborted: abortRef.current })
    setPhase('results')
    refresh()
    setSelected(new Set())
  }

  if (phase === 'sending') {
    const total = sendQueue.length
    const pct = total > 0 ? Math.round(((sendIdx + 1) / total) * 100) : 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 24px' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>📨</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>순차 발송 중...</div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
          {sendIdx + 1} / {total}명 &nbsp;—&nbsp; <span style={{ fontWeight: 700 }}>{cur?.name || ''}</span>
        </div>
        <div style={{ width: '90%', maxWidth: 360, height: 8, background: '#e5e7eb', borderRadius: 4, marginBottom: 8 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 32 }}>{pct}%</div>
        <button onClick={() => { abortRef.current = true }} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>⏹ 중단</button>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 16, textAlign: 'center' }}>발송 사이에 5~10초 랜덤 대기 중<br/>화면을 끄지 마세요</div>
      </div>
    )
  }

  if (phase === 'results' && sendResults) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{sendResults.failure.length === 0 ? '✅' : '⚠️'}</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>발송 {sendResults.aborted ? '중단' : '완료'}</div>
        <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 20 }}>
          성공 <span style={{ color: '#16a34a', fontWeight: 700 }}>{sendResults.success.length}건</span>
          &nbsp;/ 실패 <span style={{ color: '#dc2626', fontWeight: 700 }}>{sendResults.failure.length}건</span>
        </div>
        {sendResults.failure.length > 0 && (
          <div style={{ width: '100%', maxWidth: 400, background: '#fef2f2', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>실패 목록</div>
            {sendResults.failure.map((f, i) => (
              <div key={i} style={{ fontSize: 13, color: '#7f1d1d', padding: '4px 0', borderBottom: '1px solid #fecaca' }}>{f.name} ({f.phone}) — {f.reason}</div>
            ))}
          </div>
        )}
        <button onClick={() => { setPhase('list'); setTab('done') }} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', minWidth: 160 }}>발송완료 탭으로 →</button>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1e293b', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{toast}</div>
      )}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        {[{ key: 'pending', label: `대기 목록 (${students.length})` }, { key: 'done', label: `발송 완료 (${history.length})` }].map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{ flex: 1, padding: '13px 0', fontSize: 14, fontWeight: tab === key ? 700 : 500, color: tab === key ? 'var(--accent)' : 'var(--text3)', border: 'none', background: 'none', cursor: 'pointer', borderBottom: tab === key ? '2.5px solid var(--accent)' : '2.5px solid transparent' }}>{label}</button>
        ))}
      </div>

      {tab === 'pending' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>첫문의 안내</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>문의 후 미예약·미수업 신규 문의자 자동 조회</div>
            </div>
            <button type="button" onClick={handleImport} disabled={importing} style={{ fontSize: 13, padding: '7px 13px', borderRadius: 9, border: '1px solid var(--accent)', background: 'rgba(79,126,248,0.08)', color: importing ? '#9ca3af' : 'var(--accent)', cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
              {importing ? '불러오는 중...' : '불러오기'}
            </button>
          </div>
          {students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14 }}>첫문의 안내 대상이 없습니다</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button type="button" onClick={toggleAll} style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>{selected.size === students.length ? '전체 해제' : '전체 선택'}</button>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>{selected.size > 0 ? `${selected.size}명 선택됨` : `총 ${students.length}명`}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {students.map(s => {
                  const isSelected = selected.has(s.id)
                  return (
                    <div key={s.id} onClick={() => toggleSelect(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: isSelected ? 'rgba(79,126,248,0.06)' : '#fff', border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${isSelected ? 'var(--accent)' : '#d1d5db'}`, background: isSelected ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, border-color 0.15s' }}>
                        {isSelected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</div>
                        {s.inquiryDate && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>문의일: {s.inquiryDate}</div>}
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>📱 {s.phoneDisplay || s.phone || '번호 없음'}</div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                        <button type="button" onClick={e => { e.stopPropagation(); if (!s.phone) { alert('전화번호가 없습니다.'); return }; const body = activeBody.replace(/{학생이름}/g, s.name).replace(/{N}/g, ''); window.location.href = `sms:${s.phone}?body=${encodeURIComponent(body)}` }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>문자보내기</button>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button type="button" onClick={e => { e.stopPropagation(); const newEntry = { id: `done_${Date.now()}`, studentName: s.name, phone: s.phone, sentAt: new Date().toISOString() }; const updated = [...history, newEntry]; try { localStorage.setItem(FI_HISTORY_KEY, JSON.stringify(updated)) } catch {}; setHistory(updated); persistSentName(s.name); setStudents(prev => prev.filter(st => st.id !== s.id)) }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f3f4f6', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>발송완료</button>
                          <button type="button" onClick={e => { e.stopPropagation(); if (s.consultId) navigate(`/input/${s.consultId}?returnTo=/first-inquiry`); else navigate('/input', { state: { phone: s.phone || '' } }) }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#f3f4f6', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>수정</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>문자 템플릿</div>
              <button type="button" onClick={() => setTplForm({ id: null, title: '', body: '' })} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 8, border: '1px solid var(--accent)', background: 'rgba(79,126,248,0.08)', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }}>+ 새 템플릿</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>&#123;학생이름&#125;, &#123;N&#125; 은 발송 시 자동 치환됩니다</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {templates.map(tpl => (
                    <SortableTemplateItem key={tpl.id} tpl={tpl} isActive={tpl.id === activeTemplateId} onSelect={() => selectTemplate(tpl.id)} onEdit={() => setTplForm({ id: tpl.id, title: tpl.title, body: tpl.body })} onDelete={() => deleteTemplate(tpl.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {tplForm && (
              <div style={{ marginTop: 12, borderRadius: 12, padding: '14px', border: '1.5px solid var(--accent)', background: '#f0f4ff' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>{tplForm.id ? '템플릿 수정' : '새 템플릿 추가'}</div>
                <input type="text" placeholder="제목" value={tplForm.title} onChange={e => setTplForm(f => ({ ...f, title: e.target.value }))} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', padding: '8px 11px', fontSize: 13, marginBottom: 8, outline: 'none', background: '#fff', boxSizing: 'border-box', color: 'var(--text)' }} />
                <textarea placeholder="내용 (&#123;학생이름&#125;, &#123;N&#125; 자동 치환)" value={tplForm.body} onChange={e => setTplForm(f => ({ ...f, body: e.target.value }))} rows={5} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', padding: '8px 11px', fontSize: 13, lineHeight: 1.8, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#fff', color: 'var(--text)', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={saveTplForm} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  <button type="button" onClick={() => setTplForm(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: '#f3f4f6', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            )}
          </div>
          {selected.size > 0 && (
            <button type="button" onClick={() => setPhase('confirm')} style={{ position: 'fixed', bottom: 72, left: 16, right: 16, padding: 16, borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 24px rgba(79,126,248,0.45)' }}>📩 첫문의 문자 발송 ({selected.size}명)</button>
          )}
        </div>
      )}

      {tab === 'done' && (
        <div style={{ padding: 16 }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 14 }}>발송 완료 기록이 없습니다</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...history].reverse().map(h => (
                <div key={h.id} style={{ background: '#fff', borderRadius: 12, padding: '13px 15px', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{h.studentName}</span>
                    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>첫문의 발송</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtDateTime(h.sentAt)}</div>
                  {h.phone && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>📱 {h.phone}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'confirm' && (
        <div onClick={() => setPhase('list')} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>발송 확인</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>총 {selectedStudents.length}명에게 첫문의 안내 문자를 자동 발송합니다</div>
              </div>
              <button type="button" onClick={() => setPhase('list')} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              {selectedStudents.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, width: 20, textAlign: 'center' }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>신규 문의</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.phoneDisplay || s.phone || '번호 없음'}</div>
                </div>
              ))}
            </div>
            <button type="button" onClick={sendInquirySmsSequential} style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>확정 발송 →</button>
          </div>
        </div>
      )}
    </div>
  )
}
