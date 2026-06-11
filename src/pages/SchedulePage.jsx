import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import SearchInput from '../components/SearchInput'
import dayjs from 'dayjs'
import { registerPlugin } from '@capacitor/core'
import { cleanPhone } from '../api/sheets'

const SmsPlugin = registerPlugin('SmsPlugin')

const DEFAULT_SCHED_TMPL =
  '안녕하세요, 참바른글씨입니다. 😊\n{이름} 학생 예약 안내드립니다.\n📅 {예약일} {예약시간}\n잊지 말고 방문해 주세요!\n감사합니다.'
const SCHED_TMPL_KEY = 'crm_schedule_sms_template'

function getSchedTmpl() {
  return localStorage.getItem(SCHED_TMPL_KEY) || DEFAULT_SCHED_TMPL
}

function fillVars(tmpl, c) {
  return tmpl
    .replace(/\{이름\}/g, c.name || '')
    .replace(/\{예약일\}/g, c.diagDate || '')
    .replace(/\{예약시간\}/g, c.diagTime || '')
}

function to24h(timeStr) {
  if (!timeStr) return ''
  const m = timeStr.match(/(오전|오후)\s*(\d+):(\d{2})/)
  if (!m) return timeStr.slice(0, 5) // already HH:mm
  let h = parseInt(m[2])
  if (m[1] === '오후' && h !== 12) h += 12
  if (m[1] === '오전' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[3]}`
}

function fmtTrigger(ms) {
  const d = new Date(ms)
  const mo = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 || 12
  return `${mo}월 ${day}일 ${ampm} ${h12}:${mi}`
}

const sheetStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'flex-end',
}
const sheetInner = {
  background: '#fff', borderRadius: '16px 16px 0 0',
  padding: '20px 16px 36px', width: '100%',
  maxHeight: '80vh', overflowY: 'auto', boxSizing: 'border-box',
}
const btnPrimary = {
  flex: 1, padding: '11px 0', background: '#2563eb', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
const btnCancel = {
  flex: 1, padding: '11px 0', background: '#f3f4f6', color: '#374151',
  border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer',
}
const inputStyle = {
  padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: 14, boxSizing: 'border-box',
}

function BottomSheet({ onClose, children }) {
  return (
    <div style={sheetStyle} onClick={onClose}>
      <div style={sheetInner} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function SendSmsModal({ c, onClose }) {
  const phone = c.phone || ''
  const [body, setBody] = useState(() => fillVars(getSchedTmpl(), c))
  const [busy, setBusy] = useState(false)

  const doSend = async () => {
    if (!phone) { alert('전화번호가 없습니다'); return }
    setBusy(true)
    try {
      const perm = await SmsPlugin.requestSendSmsPermission()
      if (!perm.granted) { alert('문자 발송 권한이 없습니다\n설정에서 SMS 권한을 허용해 주세요'); setBusy(false); return }
      await SmsPlugin.sendSms({ phone, body })
      alert('발송 완료')
      onClose()
    } catch {
      alert('발송 실패')
    }
    setBusy(false)
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>문자 보내기</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
        {c.name} · {phone || '전화번호 없음'}
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={7}
        style={{ ...inputStyle, width: '100%', resize: 'none', fontFamily: 'inherit', lineHeight: 1.65 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onClose} style={btnCancel}>취소</button>
        <button onClick={doSend} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.7 : 1 }}>
          {busy ? '발송 중...' : '발송'}
        </button>
      </div>
    </BottomSheet>
  )
}

function ScheduleSmsModal({ c, onClose, todayStr }) {
  const phone = c.phone || ''
  const [jobs, setJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newDate, setNewDate] = useState(c.diagDate || todayStr)
  const [newTime, setNewTime] = useState(() => to24h(c.diagTime || ''))
  const [newBody, setNewBody] = useState(() => fillVars(getSchedTmpl(), c))
  const [saving, setSaving] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      const result = await SmsPlugin.getScheduledSms()
      const cp = cleanPhone(phone)
      setJobs((result.jobs || []).filter(j => cleanPhone(j.phone) === cp))
    } catch {}
    setLoadingJobs(false)
  }, [phone])

  useEffect(() => { loadJobs() }, [loadJobs])

  const doAdd = async () => {
    if (!newDate || !newTime) { alert('날짜와 시간을 선택하세요'); return }
    if (!phone) { alert('전화번호가 없습니다'); return }
    setSaving(true)
    try {
      const perm = await SmsPlugin.checkExactAlarmPermission()
      if (!perm.canSchedule) {
        const go = window.confirm(
          '정확한 시간에 발송하려면 시스템 설정에서\n"알람 및 리마인더" 권한이 필요합니다.\n\n설정으로 이동할까요?'
        )
        if (go) await SmsPlugin.openExactAlarmSettings()
        setSaving(false)
        return
      }
      const triggerAtMillis = new Date(`${newDate}T${newTime}:00`).getTime()
      if (triggerAtMillis <= Date.now()) { alert('과거 시간은 설정할 수 없습니다'); setSaving(false); return }
      const jobId = `${c.id}_${Date.now()}`
      await SmsPlugin.scheduleSms({ phone, body: newBody, triggerAtMillis, jobId })
      setAdding(false)
      await loadJobs()
    } catch {
      alert('예약 등록 실패')
    }
    setSaving(false)
  }

  const doCancel = async (jobId) => {
    if (!window.confirm('이 예약 문자를 취소할까요?')) return
    try {
      await SmsPlugin.cancelScheduledSms({ jobId })
      await loadJobs()
    } catch { alert('취소 실패') }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>예약 문자</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
        {c.name} · {phone || '전화번호 없음'}
      </div>

      {loadingJobs ? (
        <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>불러오는 중...</div>
      ) : (
        <>
          {jobs.length === 0 && !adding && (
            <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>예약된 문자가 없습니다</div>
          )}
          {jobs.map(job => (
            <div key={job.jobId} style={{
              border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
              marginBottom: 8, background: '#fafafa',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 4 }}>
                {fmtTrigger(job.triggerAtMillis)}
              </div>
              <div style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                {job.body.length > 80 ? job.body.slice(0, 80) + '...' : job.body}
              </div>
              <button
                onClick={() => doCancel(job.jobId)}
                style={{ marginTop: 8, fontSize: 11, color: '#ef4444', background: '#fff', border: '1px solid #fecaca', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}
              >
                취소
              </button>
            </div>
          ))}

          {adding ? (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="date" value={newDate} min={todayStr}
                  onChange={e => setNewDate(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} />
                <input type="time" value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} />
              </div>
              <textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                rows={5}
                style={{ ...inputStyle, width: '100%', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setAdding(false)} style={btnCancel}>취소</button>
                <button onClick={doAdd} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                  {saving ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          ) : jobs.length < 3 ? (
            <button
              onClick={() => setAdding(true)}
              style={{
                width: '100%', padding: '10px 0', marginBottom: 10,
                border: '2px dashed #d1d5db', borderRadius: 8,
                color: '#2563eb', background: 'none', fontSize: 14, cursor: 'pointer',
              }}
            >
              + 예약 추가
            </button>
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>예약은 최대 3개까지 가능합니다</div>
          )}

          <button onClick={onClose} style={{ ...btnCancel, width: '100%' }}>닫기</button>
        </>
      )}
    </BottomSheet>
  )
}

const RESULT_COLOR = {
  미등록: '#9CA3AF', 연결: '#3B82F6', 펑크: '#EF4444',
  환불: '#F97316', 가맹: '#8B5CF6', 등록: '#16a34a',
}

export default function SchedulePage() {
  const { consults } = useApp()
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [sendModal, setSendModal] = useState(null)   // { c }
  const [schedModal, setSchedModal] = useState(null) // { c }
  const scrollRef = useRef(null)
  const isTabScrolling = useRef(false)
  const activeTabRef = useRef(0)

  // 이번 주 월~일 (한국 기준 월요일 시작)
  const { weekStart, weekEnd } = useMemo(() => {
    const d = dayjs()
    const offset = (d.day() + 6) % 7 // 0=일 → 6, 1=월 → 0
    const monday = d.subtract(offset, 'day')
    return {
      weekStart: monday.format('YYYY-MM-DD'),
      weekEnd: monday.add(6, 'day').format('YYYY-MM-DD'),
    }
  }, [today])

  const matchSearch = useCallback((c) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q)
  }, [search])

  const todayItems = useMemo(() =>
    consults
      .filter(c => c.diagDate === today && matchSearch(c))
      .sort((a, b) => (a.diagTime || '').localeCompare(b.diagTime || '')),
    [consults, today, matchSearch]
  )

  const weekItems = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate >= weekStart && c.diagDate <= weekEnd && matchSearch(c))
      .sort((a, b) => a.diagDate.localeCompare(b.diagDate) || (a.diagTime || '').localeCompare(b.diagTime || '')),
    [consults, weekStart, weekEnd, matchSearch]
  )

  const pastItems = useMemo(() =>
    consults
      .filter(c => c.diagDate && c.diagDate < today && matchSearch(c))
      .sort((a, b) => b.diagDate.localeCompare(a.diagDate))
      .slice(0, 30),
    [consults, today, matchSearch]
  )

  const groupByDate = (items) => {
    const map = {}
    items.forEach(c => {
      if (!map[c.diagDate]) map[c.diagDate] = []
      map[c.diagDate].push(c)
    })
    return Object.entries(map)
  }

  const dayLabel = (dateStr) => {
    const diff = dayjs(dateStr).diff(dayjs().startOf('day'), 'day')
    if (diff === 0) return '오늘'
    if (diff === 1) return '내일'
    if (diff === 2) return '모레'
    return dayjs(dateStr).format('M월 D일')
  }

  const handleTabClick = useCallback((idx) => {
    activeTabRef.current = idx
    setActiveTab(idx)
    if (scrollRef.current) {
      isTabScrolling.current = true
      scrollRef.current.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' })
      setTimeout(() => { isTabScrolling.current = false }, 600)
    }
  }, [])

  const handleScroll = useCallback(() => {
    if (isTabScrolling.current) return
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== activeTabRef.current) {
      activeTabRef.current = idx
      setActiveTab(idx)
    }
  }, [])

  const CardItem = ({ c }) => (
    <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/detail/${c.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {c.phone}{c.age ? ` • ${c.age}` : ''}{c.gender ? ` ${c.gender}` : ''}
          </div>
          {c.diagTime && (
            <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>🕐 {c.diagTime}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {c.diagResult ? (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10, border: '1px solid',
              borderColor: RESULT_COLOR[c.diagResult] || '#d1d5db',
              color: RESULT_COLOR[c.diagResult] || 'var(--text3)',
            }}>{c.diagResult}</span>
          ) : (
            <span className={`badge badge-${c.category}`}>{c.category || '미분류'}</span>
          )}
        </div>
      </div>
      {c.feature && (
        <div style={{
          marginTop: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{c.feature}</div>
      )}
      {/* SMS 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setSendModal({ c })}
          style={{
            flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
            color: '#2563eb', background: '#eff6ff',
            border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer',
          }}
        >
          문자 보내기
        </button>
        <button
          onClick={() => setSchedModal({ c })}
          style={{
            flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
            color: '#7c3aed', background: '#f5f3ff',
            border: '1px solid #ddd6fe', borderRadius: 6, cursor: 'pointer',
          }}
        >
          예약 문자
        </button>
      </div>
    </div>
  )

  const GroupedPanel = ({ items }) => {
    const groups = groupByDate(items)
    if (groups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <div>해당 예약이 없습니다</div>
        </div>
      )
    }
    return groups.map(([date, list]) => (
      <div key={date} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            background: date === today ? 'var(--accent)' : 'var(--surface)',
            color: date === today ? '#fff' : 'var(--text2)',
            borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 600,
          }}>{dayLabel(date)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {date}{list[0]?.diagDay ? ` (${list[0].diagDay})` : ''}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, background: 'var(--surface)', borderRadius: 20, padding: '2px 8px', color: 'var(--text2)' }}>
            {list.length}명
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(c => <CardItem key={c.id} c={c} />)}
        </div>
      </div>
    ))
  }

  const TABS = ['오늘', '이번주', '이전']

  return (
    <div>
      {sendModal && (
        <SendSmsModal c={sendModal.c} onClose={() => setSendModal(null)} />
      )}
      {schedModal && (
        <ScheduleSmsModal c={schedModal.c} onClose={() => setSchedModal(null)} todayStr={today} />
      )}
      <div style={{ padding: '16px 16px 0' }}>
        <SearchInput value={search} onChange={setSearch} style={{ marginBottom: 12 }} />
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: '#fff', position: 'sticky', top: 0, zIndex: 10,
      }}>
        {TABS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => handleTabClick(idx)}
            style={{
              flex: 1, padding: '12px 0', fontSize: 14,
              fontWeight: activeTab === idx ? 700 : 500,
              color: activeTab === idx ? 'var(--accent)' : 'var(--text3)',
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === idx ? '2.5px solid var(--accent)' : '2.5px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 스와이프 컨테이너 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          overflowX: 'scroll',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {/* 패널 0: 오늘 */}
        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: 16, minHeight: 200 }}>
          <GroupedPanel items={todayItems} />
        </div>

        {/* 패널 1: 이번주 */}
        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: 16, minHeight: 200 }}>
          <GroupedPanel items={weekItems} />
        </div>

        {/* 패널 2: 이전 */}
        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: 16, minHeight: 200 }}>
          {pastItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
              <div>지난 예약이 없습니다</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 12 }}>
                지난 예약 (최근 30건)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pastItems.map(c => {
                  const hasResult = Boolean(c.diagResult)
                  const diagResult = c.diagResult || '미확인'
                  const resultColor = hasResult
                    ? (RESULT_COLOR[c.diagResult] || '#9CA3AF')
                    : '#EF4444'
                  return (
                    <div key={c.id} className="card"
                      style={{ cursor: 'pointer', opacity: hasResult ? 0.6 : 1 }}
                      onClick={() => navigate(`/detail/${c.id}`)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                            {c.name}
                            <span style={{
                              fontSize: 11, padding: '1px 6px', borderRadius: 10,
                              border: `1px solid ${resultColor}`, color: resultColor, fontWeight: 700, lineHeight: 1.5,
                            }}>{diagResult}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                            {c.diagDate}{c.diagDay ? ` (${c.diagDay})` : ''}{c.diagTime ? ` ${c.diagTime}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.category}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
