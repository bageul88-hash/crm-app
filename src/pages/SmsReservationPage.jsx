import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { searchPhoneByStudentName } from '../hooks/useSmsAttendance'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DEFAULT_TEMPLATE = `안녕하세요, 참바른글씨입니다. 😊
{학생이름} 학생이 총 {N}회 수업을 완료하였습니다.
수업료 재결재를 부탁드립니다.
감사합니다.`

const SMS_HISTORY_KEY = 'crm_sms_history'
const SMS_TEMPLATES_KEY = 'crm_sms_templates'
const SMS_ACTIVE_KEY = 'crm_sms_active_template_id'

function loadTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(SMS_TEMPLATES_KEY) || 'null')
    if (Array.isArray(saved) && saved.length > 0) return saved
  } catch {}
  return [{ id: 't1', title: '재결재 요청', body: DEFAULT_TEMPLATE }]
}

function loadActiveId(tpls) {
  try {
    const saved = localStorage.getItem(SMS_ACTIVE_KEY)
    if (saved && tpls.find(t => t.id === saved)) return saved
  } catch {}
  return tpls[0]?.id ?? null
}

function isTarget(n) {
  return n >= 20 && n <= 26
}

function loadSmsHistory() {
  try { return JSON.parse(localStorage.getItem(SMS_HISTORY_KEY) || '[]') } catch { return [] }
}

function normName(s) {
  return String(s ?? '').replace(/\s+/g, '').toLowerCase()
}

const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

function fmtAttendDate(dateKey) {
  const y = +dateKey.slice(0, 4)
  const m = parseInt(dateKey.slice(4, 6))
  const d = parseInt(dateKey.slice(6, 8))
  return `${y}년 ${m}월 ${d}일 (${DAY_KR[new Date(y, m - 1, d).getDay()]})`
}

function fmtAttendTime(timeStr) {
  if (!timeStr) return ''
  const [h, min] = timeStr.split(':').map(Number)
  if (isNaN(h)) return ''
  const ampm = h < 12 ? '오전' : '오후'
  return `${ampm} ${h % 12 || 12}:${String(min).padStart(2, '0')}`
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const mo = d.getMonth() + 1, day = d.getDate()
  const h = d.getHours(), m = d.getMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  return `${mo}/${day} ${ampm} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

function SortableTemplateItem({ tpl, isActive, onSelect, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tpl.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 12, padding: '11px 13px', background: '#fff',
        border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : undefined,
        position: 'relative',
      }}
    >
      {/* 제목 행 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* 드래그 핸들 */}
          <div
            {...attributes}
            {...listeners}
            style={{
              touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab',
              fontSize: 18, color: '#9ca3af', padding: '0 4px', userSelect: 'none',
              lineHeight: 1,
            }}
          >
            ≡
          </div>
          {isActive && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 20,
              background: 'var(--accent)', color: '#fff', fontWeight: 700,
            }}>
              사용 중
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tpl.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {!isActive && (
            <button type="button" onClick={onSelect} style={{
              padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700,
              border: '1px solid var(--accent)', background: 'rgba(79,126,248,0.08)',
              color: 'var(--accent)', cursor: 'pointer',
            }}>선택</button>
          )}
          <button type="button" onClick={onEdit} style={{
            padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: '1px solid var(--border)', background: '#f3f4f6',
            color: 'var(--text2)', cursor: 'pointer',
          }}>수정</button>
          <button type="button" onClick={onDelete} style={{
            padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: '1px solid #fecaca', background: '#fff5f5',
            color: '#ef4444', cursor: 'pointer',
          }}>삭제</button>
        </div>
      </div>
      {/* 내용 미리보기 */}
      <div style={{
        fontSize: 12, color: 'var(--text3)', lineHeight: 1.6,
        whiteSpace: 'pre-line', overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {tpl.body}
      </div>
    </div>
  )
}

export default function SmsReservationPage() {
  const { currentUser, consults: contextConsults, silentSync } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [students, setStudents] = useState([])
  const [history, setHistory] = useState(loadSmsHistory)
  const [selected, setSelected] = useState(new Set())
  const [templates, setTemplates] = useState(loadTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState(() => loadActiveId(loadTemplates()))
  const [tplForm, setTplForm] = useState(null) // null | { id, title, body }
  const [phase, setPhase] = useState('list') // 'list' | 'confirm' | 'sending'
  const [queue, setQueue] = useState([])
  const [queueIdx, setQueueIdx] = useState(0)
  const [smsOpened, setSmsOpened] = useState(false)
  const [attendanceModal, setAttendanceModal] = useState(null) // student | null

  const refresh = useCallback(() => {
    const records = (() => {
      try { return JSON.parse(localStorage.getItem('attendance_records') || '{}') } catch { return {} }
    })()
    // AppContext에 로드된 데이터 우선, 없으면 localStorage 캐시 폴백
    const consults = contextConsults?.length > 0
      ? contextConsults
      : (() => {
          try { return JSON.parse(localStorage.getItem('crm_consults_cache') || '[]') } catch { return [] }
        })()
    const hist = loadSmsHistory()

    const totals = {}
    // 출석 기록에서 이름별 총 횟수 + 전화번호 맵 동시 구축
    const phoneMap = {}
    Object.values(records).forEach(list => {
      ;(list || []).forEach(entry => {
        const name = typeof entry === 'string' ? entry : entry?.name
        if (name) {
          totals[name] = (totals[name] || 0) + 1
          // 실시간 SMS 감지 시 저장된 phone 필드 활용
          if (typeof entry === 'object' && entry?.phone && !phoneMap[name]) {
            phoneMap[name] = String(entry.phone).replace(/[^0-9]/g, '')
          }
        }
      })
    })

    // 이미 발송한 학생+총출석횟수 조합으로 중복 제외
    const histSet = new Set(hist.map(h => `${h.studentName}_${h.totalCount}`))

    const result = []
    for (const [name, count] of Object.entries(totals)) {
      if (!isTarget(count)) continue
      if (histSet.has(`${name}_${count}`)) continue

      // 이름 정규화 매칭 (공백 차이 흡수)
      const nameNorm = normName(name)
      // 출석기록 phone (숫자만)
      const attendPhone = phoneMap[name] ? String(phoneMap[name]).replace(/[^0-9]/g, '') : ''

      // 1차: 이름 정확 일치
      // 2차: 이름 포함(contains) 매칭
      // 3차: 전화번호 일치
      let allMatches = consults.filter(c => normName(c.name) === nameNorm)
      if (allMatches.length === 0) {
        allMatches = consults.filter(c => {
          const cn = normName(c.name)
          return cn.includes(nameNorm) || nameNorm.includes(cn)
        })
      }
      if (allMatches.length === 0 && attendPhone) {
        allMatches = consults.filter(c => {
          const cPhone = String(c.phone || '').replace(/[^0-9]/g, '')
          return cPhone && cPhone === attendPhone
        })
      }

      // 여러 기록이 있을 때 최신 기록(id 최대값) 기준으로 현재 상태 판단
      const latestConsult = allMatches.length > 0
        ? allMatches.reduce((best, c) => Number(c.id) > Number(best.id) ? c : best)
        : null

      // 수업종료 또는 재결재완료 필터: 직접 매칭된 경우
      if (latestConsult?.category === '수업종료') {
        console.log('[수업종료 제외]', name, `→ id=${latestConsult.id} category=${latestConsult.category}`)
        continue
      }
      if (latestConsult?.diagResult === '재결재완료') {
        console.log('[재결재완료 제외]', name, `→ id=${latestConsult.id} diagResult=${latestConsult.diagResult}`)
        continue
      }

      // 매칭 실패 시 폭넓은 이름 검색으로 수업종료/재결재완료 여부 재확인
      if (!latestConsult && consults.length > 0) {
        const hasEnded = consults.some(c =>
          (c.category === '수업종료' || c.diagResult === '재결재완료') &&
          (normName(c.name).includes(nameNorm) || nameNorm.includes(normName(c.name)))
        )
        if (hasEnded) {
          console.log('[수업종료/재결재완료 제외 - 폭넓은 매칭]', name)
          continue
        }
      }

      console.log('[대기 목록 포함]', name, latestConsult
        ? `→ id=${latestConsult.id} category=${latestConsult.category}`
        : '→ CRM 매칭 없음'
      )

      // 전화번호: CRM 매칭 → 출석기록 phone 필드 → 없음 순으로 폴백
      const rawPhone = latestConsult?.phone || attendPhone || ''

      // 해당 학생의 가장 오래된 문자 발송일
      const studentHist = hist.filter(h => normName(h.studentName) === nameNorm)
      const firstSmsDate = studentHist.length > 0
        ? studentHist
            .reduce((min, h) => (h.sentAt < min ? h.sentAt : min), studentHist[0].sentAt)
            .slice(0, 10)
        : null

      // 해당 학생의 출석 날짜/시간 수집 (최신순)
      const attendanceDates = []
      for (const [dateKey, list] of Object.entries(records)) {
        ;(list || []).forEach(entry => {
          const entryName = typeof entry === 'string' ? entry : entry?.name
          if (entryName === name) {
            attendanceDates.push({
              dateKey,
              time: typeof entry === 'object' ? (entry?.time || '') : '',
            })
          }
        })
      }
      attendanceDates.sort((a, b) => b.dateKey.localeCompare(a.dateKey))

      result.push({
        id: `${name}_${count}`,
        name,
        totalCount: count,
        phone: rawPhone.replace(/[^0-9]/g, ''),
        phoneDisplay: rawPhone,
        consultId: latestConsult?.id || null,
        firstSmsDate,
        attendanceDates,
      })
    }

    result.sort((a, b) => a.totalCount - b.totalCount || a.name.localeCompare(b.name))
    console.log(`[문자예약] 필터 완료: 출석대상=${Object.keys(totals).filter(n => isTarget(totals[n])).length}명 → 대기목록=${result.length}명 (CRM=${consults.length}건)`)
    setStudents(result)
    setHistory(hist)
  }, [contextConsults])

  useEffect(() => { refresh() }, [refresh])

  // ── 템플릿 관리 헬퍼 ──
  const saveTemplates = list => {
    setTemplates(list)
    try { localStorage.setItem(SMS_TEMPLATES_KEY, JSON.stringify(list)) } catch {}
  }

  const saveActiveId = id => {
    setActiveTemplateId(id)
    try { localStorage.setItem(SMS_ACTIVE_KEY, id ?? '') } catch {}
  }

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
      const newTpl = { id: `t${Date.now()}`, title: title.trim(), body: body.trim() }
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
  const cur = queue[queueIdx]

  const toggleSelect = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () => {
    setSelected(selected.size === students.length ? new Set() : new Set(students.map(s => s.id)))
  }

  const handleOpenSms = () => {
    if (!cur) return
    const body = activeBody
      .replace(/{학생이름}/g, cur.name)
      .replace(/{N}/g, cur.totalCount)
    window.location.href = `sms:${cur.phone}?body=${encodeURIComponent(body)}`
    setSmsOpened(true)
  }

  const recordAndAdvance = () => {
    const newEntry = {
      id: `sms_${Date.now()}_${queueIdx}`,
      studentName: cur.name,
      phone: cur.phone,
      totalCount: cur.totalCount,
      sentAt: new Date().toISOString(),
    }
    const updated = [...history, newEntry]
    try { localStorage.setItem(SMS_HISTORY_KEY, JSON.stringify(updated)) } catch {}
    setHistory(updated)

    if (queueIdx + 1 >= queue.length) {
      setPhase('list')
      setSelected(new Set())
      setTab('done')
      refresh()
    } else {
      setQueueIdx(idx => idx + 1)
      setSmsOpened(false)
    }
  }

  const skipAndAdvance = () => {
    if (queueIdx + 1 >= queue.length) {
      setPhase('list')
    } else {
      setQueueIdx(idx => idx + 1)
      setSmsOpened(false)
    }
  }

  const startSending = () => {
    const q = students.filter(s => selected.has(s.id))
    setQueue(q)
    setQueueIdx(0)
    setSmsOpened(false)
    setPhase('sending')
  }

  // ── 발송 진행 화면 ──
  if (phase === 'sending' && cur) {
    const bodyPreview = activeBody
      .replace(/{학생이름}/g, cur.name)
      .replace(/{N}/g, cur.totalCount)
    const isLast = queueIdx + 1 >= queue.length

    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => { setPhase('list') }}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text2)', padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>문자 발송 진행</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{queueIdx + 1} / {queue.length}명</div>
          </div>
        </div>

        {/* 진행바 */}
        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
          <div style={{
            height: '100%', background: 'var(--accent)', borderRadius: 3,
            width: `${(queueIdx / queue.length) * 100}%`, transition: 'width 0.3s',
          }} />
        </div>

        {/* 현재 학생 카드 */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 20,
          border: '2px solid var(--accent)',
          boxShadow: '0 4px 16px rgba(79,126,248,0.15)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{queueIdx + 1}번째 학생</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{cur.name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', color: 'var(--text2)', fontWeight: 600 }}>
              총 {cur.totalCount}회 출석
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>
            📱 {cur.phoneDisplay || cur.phone || '번호 없음'}
          </div>
        </div>

        {/* 발송 내용 미리보기 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>발송 내용</div>
          <div style={{
            background: '#f9fafb', borderRadius: 12, padding: '12px 14px',
            fontSize: 13, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap',
            border: '1px solid var(--border)',
          }}>
            {bodyPreview}
          </div>
        </div>

        {/* SMS 열기 버튼 */}
        <button
          type="button"
          onClick={handleOpenSms}
          style={{
            width: '100%', padding: 16, borderRadius: 14, border: 'none',
            background: smsOpened ? '#d1fae5' : 'var(--accent)',
            color: smsOpened ? '#065f46' : '#fff',
            fontSize: 16, fontWeight: 700,
            cursor: smsOpened ? 'default' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {smsOpened ? '✅ SMS 앱이 열렸습니다' : '📱 SMS 앱 열기'}
        </button>

        {/* 하단 액션 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={skipAndAdvance}
            style={{
              flex: 1, padding: 14, borderRadius: 12,
              border: '1.5px solid var(--border)',
              background: '#fff', color: 'var(--text2)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={recordAndAdvance}
            disabled={!smsOpened}
            style={{
              flex: 2, padding: 14, borderRadius: 12, border: 'none',
              background: smsOpened ? '#16a34a' : '#d1d5db',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: smsOpened ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            {isLast ? '✅ 발송 완료' : '발송 완료 → 다음 ›'}
          </button>
        </div>
      </div>
    )
  }

  // ── 메인 화면 ──
  return (
    <div style={{ paddingBottom: 100 }}>
      {/* 탭 */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: '#fff', position: 'sticky', top: 0, zIndex: 10,
      }}>
        {[
          { key: 'pending', label: `대기 목록 (${students.length})` },
          { key: 'done',    label: `발송 완료 (${history.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '13px 0', fontSize: 14,
              fontWeight: tab === key ? 700 : 500,
              color: tab === key ? 'var(--accent)' : 'var(--text3)',
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === key ? '2.5px solid var(--accent)' : '2.5px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 대기 목록 탭 ── */}
      {tab === 'pending' && (
        <div style={{ padding: 16 }}>
          {/* 제목 + 불러오기 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>수업료 재결재 요청</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                총 출석 20회 ~ 26회 해당 학생 자동 조회
              </div>
            </div>
            <button
              type="button"
              onClick={() => { silentSync(); refresh() }}
              style={{
                fontSize: 13, padding: '7px 13px', borderRadius: 9,
                border: '1px solid var(--accent)', background: 'rgba(79,126,248,0.08)',
                color: 'var(--accent)', cursor: 'pointer', fontWeight: 700,
              }}
            >
              불러오기
            </button>
          </div>

          {students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14 }}>재결재 요청 대상 학생이 없습니다</div>
            </div>
          ) : (
            <>
              {/* 전체 선택 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={toggleAll}
                  style={{
                    fontSize: 13, color: 'var(--accent)', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0,
                  }}
                >
                  {selected.size === students.length ? '전체 해제' : '전체 선택'}
                </button>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                  {selected.size > 0 ? `${selected.size}명 선택됨` : `총 ${students.length}명`}
                </span>
              </div>

              {/* 학생 카드 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {students.map(s => {
                  const isSelected = selected.has(s.id)
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelect(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: isSelected ? 'rgba(79,126,248,0.06)' : '#fff',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      {/* 체크박스 */}
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isSelected ? 'var(--accent)' : '#d1d5db'}`,
                        background: isSelected ? 'var(--accent)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}>
                        {isSelected && (
                          <span style={{ color: '#fff', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>
                        )}
                      </div>

                      {/* 학생 정보 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</span>
                        </div>
                        <div
                          onClick={e => { e.stopPropagation(); setAttendanceModal(s) }}
                          style={{
                            fontSize: 12, color: 'var(--accent)', marginTop: 3,
                            cursor: 'pointer', textDecoration: 'underline', fontWeight: 600,
                            display: 'inline-block',
                          }}
                        >
                          총 {s.totalCount}회 출석
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                          📱 {s.phoneDisplay || s.phone || '번호 없음'}
                        </div>
                      </div>

                      {/* 버튼 영역 — 문자보내기 / 재결재완료 / 수정 */}
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                        {/* 문자보내기 */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            if (!s.phone) { alert('전화번호가 없습니다.'); return }
                            const body = activeBody
                              .replace(/{학생이름}/g, s.name)
                              .replace(/{N}/g, s.totalCount)
                            window.location.href = `sms:${s.phone}?body=${encodeURIComponent(body)}`
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 8,
                            border: 'none', background: 'var(--accent)',
                            color: '#fff', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          문자보내기
                        </button>
                        {/* 재결재완료 + 수정 */}
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              const newEntry = {
                                id: `done_${Date.now()}`,
                                studentName: s.name,
                                phone: s.phone,
                                totalCount: s.totalCount,
                                sentAt: new Date().toISOString(),
                              }
                              const updated = [...history, newEntry]
                              try { localStorage.setItem(SMS_HISTORY_KEY, JSON.stringify(updated)) } catch {}
                              setHistory(updated)
                              setStudents(prev => prev.filter(st => st.id !== s.id))
                            }}
                            style={{
                              padding: '6px 10px', borderRadius: 8,
                              border: '1px solid #d1d5db', background: '#f3f4f6',
                              color: 'var(--text3)', fontSize: 12, fontWeight: 600,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            재결재완료
                          </button>
                          <button
                            type="button"
                            onClick={async e => {
                              e.stopPropagation()

                              let resolvedPhone = s.phone
                              if (!resolvedPhone) {
                                const { phone: smsPhone, found } =
                                  await searchPhoneByStudentName(s.name)
                                if (found) resolvedPhone = smsPhone
                              }

                              const goEdit = (id) => {
                                const extra = resolvedPhone && resolvedPhone !== s.phone
                                  ? { state: { phone: resolvedPhone } }
                                  : undefined
                                navigate(`/input/${id}?returnTo=/sms-reservation`, extra)
                              }

                              if (s.consultId) {
                                goEdit(s.consultId)
                                return
                              }

                              const nameNorm = normName(s.name)
                              const phone = resolvedPhone

                              const found =
                                contextConsults.find(c => normName(c.name) === nameNorm) ||
                                contextConsults.find(c => normName(c.name).includes(nameNorm) || nameNorm.includes(normName(c.name))) ||
                                (phone && contextConsults.find(c =>
                                  String(c.phone || '').replace(/[^0-9]/g, '') === phone
                                ))

                              if (found) {
                                goEdit(found.id)
                                return
                              }

                              navigate('/input', {
                                state: {
                                  phone: resolvedPhone || '',
                                  inquiryDate: s.firstSmsDate || '',
                                },
                              })
                            }}
                            style={{
                              padding: '6px 10px', borderRadius: 8,
                              border: '1px solid var(--border)', background: '#f3f4f6',
                              color: 'var(--text2)', fontSize: 12, fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            수정
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* 문자 템플릿 관리 */}
          <div style={{ marginTop: 22 }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>문자 템플릿</div>
              <button
                type="button"
                onClick={() => setTplForm({ id: null, title: '', body: '' })}
                style={{
                  fontSize: 12, padding: '5px 11px', borderRadius: 8,
                  border: '1px solid var(--accent)', background: 'rgba(79,126,248,0.08)',
                  color: 'var(--accent)', cursor: 'pointer', fontWeight: 700,
                }}
              >
                + 새 템플릿
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
              &#123;학생이름&#125;, &#123;N&#125; 은 발송 시 자동 치환됩니다
            </div>

            {/* 템플릿 목록 — 드래그 정렬 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {templates.map(tpl => (
                    <SortableTemplateItem
                      key={tpl.id}
                      tpl={tpl}
                      isActive={tpl.id === activeTemplateId}
                      onSelect={() => selectTemplate(tpl.id)}
                      onEdit={() => setTplForm({ id: tpl.id, title: tpl.title, body: tpl.body })}
                      onDelete={() => deleteTemplate(tpl.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* 추가/수정 폼 */}
            {tplForm && (
              <div style={{
                marginTop: 12, borderRadius: 12, padding: '14px',
                border: '1.5px solid var(--accent)', background: '#f0f4ff',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
                  {tplForm.id ? '템플릿 수정' : '새 템플릿 추가'}
                </div>
                <input
                  type="text"
                  placeholder="제목"
                  value={tplForm.title}
                  onChange={e => setTplForm(f => ({ ...f, title: e.target.value }))}
                  style={{
                    width: '100%', borderRadius: 8, border: '1px solid var(--border)',
                    padding: '8px 11px', fontSize: 13, marginBottom: 8,
                    outline: 'none', background: '#fff', boxSizing: 'border-box',
                    color: 'var(--text)',
                  }}
                />
                <textarea
                  placeholder="내용 (&#123;학생이름&#125;, &#123;N&#125; 자동 치환)"
                  value={tplForm.body}
                  onChange={e => setTplForm(f => ({ ...f, body: e.target.value }))}
                  rows={5}
                  style={{
                    width: '100%', borderRadius: 8, border: '1px solid var(--border)',
                    padding: '8px 11px', fontSize: 13, lineHeight: 1.8,
                    fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                    background: '#fff', color: 'var(--text)', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={saveTplForm}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 9,
                      border: 'none', background: 'var(--accent)',
                      color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setTplForm(null)}
                    style={{
                      padding: '9px 18px', borderRadius: 9,
                      border: '1px solid var(--border)', background: '#f3f4f6',
                      color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 문자 예약 버튼 (고정) */}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setPhase('confirm')}
              style={{
                position: 'fixed', bottom: 72, left: 16, right: 16,
                padding: 16, borderRadius: 14, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(79,126,248,0.45)',
              }}
            >
              📩 문자 예약 ({selected.size}명)
            </button>
          )}
        </div>
      )}

      {/* ── 발송 완료 탭 ── */}
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
                <div
                  key={h.id}
                  style={{
                    background: '#fff', borderRadius: 12,
                    padding: '13px 15px', border: '1px solid var(--border)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{h.studentName}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 9px', borderRadius: 20,
                      background: '#d1fae5', color: '#065f46', fontWeight: 700,
                    }}>
                      총 {h.totalCount}회 발송
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    총 {h.totalCount}회 · {fmtDateTime(h.sentAt)}
                  </div>
                  {h.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      📱 {h.phone}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 확인 모달 ── */}
      {phase === 'confirm' && (
        <div
          onClick={() => setPhase('list')}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: '#fff', borderRadius: '20px 20px 0 0',
              padding: '20px 20px 32px',
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            }}
          >
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>발송 확인</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  총 {selectedStudents.length}명에게 순서대로 문자를 발송합니다
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhase('list')}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)' }}
              >
                ✕
              </button>
            </div>

            {/* 학생 목록 */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              {selectedStudents.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 0', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, width: 20, textAlign: 'center' }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>총 {s.totalCount}회 출석</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {s.phoneDisplay || s.phone || '번호 없음'}
                  </div>
                </div>
              ))}
            </div>

            {/* 확정 발송 버튼 */}
            <button
              type="button"
              onClick={startSending}
              style={{
                width: '100%', padding: 16, borderRadius: 14, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              확정 발송 →
            </button>
          </div>
        </div>
      )}
      {/* ── 출석 날짜 전체화면 모달 ── */}
      {attendanceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: '#fff',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border)',
            position: 'relative',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{attendanceModal.name}</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>
              총 출석{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                {attendanceModal.totalCount}
              </span>회
            </div>
            <button
              type="button"
              onClick={() => setAttendanceModal(null)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none',
                fontSize: 22, cursor: 'pointer', color: 'var(--text3)',
                lineHeight: 1,
              }}
            >✕</button>
          </div>

          {/* 출석 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
            {attendanceModal.attendanceDates?.length > 0 ? (
              attendanceModal.attendanceDates.map((rec, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 0', borderBottom: '1px solid #f0f0f0',
                }}>
                  <span style={{ fontSize: 15, color: 'var(--text)' }}>
                    {fmtAttendDate(rec.dateKey)}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text2)' }}>
                    {fmtAttendTime(rec.time)}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
                날짜 정보가 없습니다
              </div>
            )}
          </div>

          {/* 닫기 버튼 */}
          <div style={{ padding: '16px 20px' }}>
            <button
              type="button"
              onClick={() => setAttendanceModal(null)}
              style={{
                width: '100%', padding: 16, borderRadius: 12, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}
