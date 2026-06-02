import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { searchPhoneByStudentName } from '../hooks/useSmsAttendance'

const DEFAULT_TEMPLATE = `안녕하세요, 참바른글씨입니다. 😊
{학생이름} 학생이 총 {N}회 수업을 완료하였습니다.
수업료 재결재를 부탁드립니다.
감사합니다.`

const SMS_HISTORY_KEY = 'crm_sms_history'

function isTarget(n) {
  return n === 20 || (n > 20 && (n - 20) % 24 === 0)
}

function calcRound(n) {
  if (n === 20) return 1
  return (n - 20) / 24 + 1
}

function loadSmsHistory() {
  try { return JSON.parse(localStorage.getItem(SMS_HISTORY_KEY) || '[]') } catch { return [] }
}

function normName(s) {
  return String(s ?? '').replace(/\s+/g, '').toLowerCase()
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const mo = d.getMonth() + 1, day = d.getDate()
  const h = d.getHours(), m = d.getMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  return `${mo}/${day} ${ampm} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

export default function SmsReservationPage() {
  const { currentUser, consults: contextConsults } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [students, setStudents] = useState([])
  const [history, setHistory] = useState(loadSmsHistory)
  const [selected, setSelected] = useState(new Set())
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [phase, setPhase] = useState('list') // 'list' | 'confirm' | 'sending'
  const [queue, setQueue] = useState([])
  const [queueIdx, setQueueIdx] = useState(0)
  const [smsOpened, setSmsOpened] = useState(false)

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

    const histSet = new Set(hist.map(h => `${h.studentName}_${h.round}`))

    const result = []
    for (const [name, count] of Object.entries(totals)) {
      if (!isTarget(count)) continue
      const round = calcRound(count)
      if (histSet.has(`${name}_${round}`)) continue

      // 이름 정규화 매칭 (공백 차이 흡수)
      const nameNorm = normName(name)
      // 출석기록 phone (숫자만)
      const attendPhone = phoneMap[name] ? String(phoneMap[name]).replace(/[^0-9]/g, '') : ''

      // 이름 일치 우선, 없으면 전화번호로 2차 매칭
      let allMatches = consults.filter(c => normName(c.name) === nameNorm)
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

      // 최신 구분이 수업종료면 제외
      if (latestConsult?.category === '수업종료') continue

      // 전화번호: CRM 매칭 → 출석기록 phone 필드 → 없음 순으로 폴백
      const rawPhone = latestConsult?.phone || attendPhone || ''

      // 해당 학생의 가장 오래된 문자 발송일
      const studentHist = hist.filter(h => normName(h.studentName) === nameNorm)
      const firstSmsDate = studentHist.length > 0
        ? studentHist
            .reduce((min, h) => (h.sentAt < min ? h.sentAt : min), studentHist[0].sentAt)
            .slice(0, 10)
        : null

      result.push({
        id: `${name}_${count}`,
        name,
        totalCount: count,
        round,
        phone: rawPhone.replace(/[^0-9]/g, ''),
        phoneDisplay: rawPhone,
        consultId: latestConsult?.id || null,
        firstSmsDate,
      })
    }

    result.sort((a, b) => a.round - b.round || a.name.localeCompare(b.name))
    setStudents(result)
    setHistory(hist)
  }, [contextConsults])

  useEffect(() => { refresh() }, [refresh])

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
    const body = template
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
      round: cur.round,
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
    const bodyPreview = template
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
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>
              {cur.round}회차 재결재
            </span>
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
          {/* 제목 + 새로고침 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>수업료 재결재 요청</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                20회, 44회, 68회... 도달 학생 자동 조회
              </div>
            </div>
            <button
              type="button"
              onClick={() => { silentSync(); refresh() }}
              style={{
                fontSize: 13, padding: '7px 13px', borderRadius: 9,
                border: '1px solid var(--border)', background: '#f3f4f6',
                color: 'var(--text2)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              ↻ 새로고침
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
                          <span style={{
                            fontSize: 11, padding: '2px 9px', borderRadius: 20,
                            background: '#dbeafe', color: '#1d4ed8', fontWeight: 700,
                          }}>
                            {s.round}회차 재결재
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                          총 {s.totalCount}회 출석
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                          📱 {s.phoneDisplay || s.phone || '번호 없음'}
                        </div>
                      </div>

                      {/* 버튼 영역 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                        {/* 신규 상담 등록 버튼 */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            navigate('/input', {
                              state: {
                                phone: s.phone,
                                inquiryDate: s.firstSmsDate || '',
                              },
                            })
                          }}
                          style={{
                            padding: '6px 11px', borderRadius: 8,
                            border: '1px solid #bfdbfe', background: '#eff6ff',
                            color: '#1d4ed8', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          신규
                        </button>

                        {/* 기존 상담 수정 버튼 */}
                        <button
                          type="button"
                          onClick={async e => {
                            e.stopPropagation()

                            // 전화번호가 없으면 SMS inbox에서 자동 검색
                            let resolvedPhone = s.phone
                            if (!resolvedPhone) {
                              const { phone: smsPhone, found } =
                                await searchPhoneByStudentName(s.name)
                              if (found) {
                                resolvedPhone = smsPhone
                              }
                              // found 여부 무관하게 계속 진행 (직접 입력 안내는 폼에서)
                            }

                            // 이동할 상담 결정: consultId → 이름 매칭 → 전화번호 매칭
                            const doNavigate = (id) => {
                              const state = resolvedPhone && resolvedPhone !== s.phone
                                ? { state: { phone: resolvedPhone } }
                                : undefined
                              navigate(`/input/${id}?returnTo=/sms-reservation`, state)
                            }

                            if (s.consultId) {
                              doNavigate(s.consultId)
                              return
                            }

                            // consultId 없음 → 런타임 검색
                            const nameNorm = normName(s.name)
                            const found =
                              contextConsults.find(c => normName(c.name) === nameNorm) ||
                              (resolvedPhone && contextConsults.find(c =>
                                String(c.phone || '').replace(/[^0-9]/g, '') === resolvedPhone
                              ))

                            if (found) {
                              doNavigate(found.id)
                            } else {
                              alert('기존 상담을 찾을 수 없습니다.\n신규 버튼으로 새 상담을 등록해주세요.')
                            }
                          }}
                          style={{
                            padding: '6px 11px', borderRadius: 8,
                            border: '1px solid var(--border)', background: '#f3f4f6',
                            color: 'var(--text2)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          수정
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* 문자 템플릿 */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
              문자 템플릿
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
              &#123;학생이름&#125;, &#123;N&#125; 은 발송 시 자동 치환됩니다
            </div>
            <textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={6}
              style={{
                width: '100%', borderRadius: 12,
                border: '1.5px solid var(--border)',
                padding: '12px 14px', fontSize: 13, lineHeight: 1.8,
                fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                background: '#f9fafb', color: 'var(--text)', boxSizing: 'border-box',
              }}
            />
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
                      {h.round}회차 발송
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
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>총 {s.totalCount}회 · {s.round}회차</div>
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
    </div>
  )
}
