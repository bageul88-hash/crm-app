import { useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CATEGORY_TABS, filterByTab } from '../api/sheets'
import { BRANCHES } from '../auth/users'
import ConsultCard from '../components/ConsultCard'
import { registerPlugin } from '@capacitor/core'

const SmsPlugin = registerPlugin('SmsPlugin')
const MIN_DELAY = 5000
const MAX_DELAY = 10000
const OWNER_PHONES_KEY = 'crm_owner_phones'

function loadOwnerPhones() {
  try { return JSON.parse(localStorage.getItem(OWNER_PHONES_KEY) || '{}') } catch { return {} }
}

export default function BranchPage() {
  const { allConsults, remove, adminUpdateBranch, branchOverrides, getEffectivePw, login, currentUser, cleanupConfigRows } = useApp()
  const navigate = useNavigate()
  const isAdmin = currentUser?.role === 'admin'

  const [selectedBranch, setSelectedBranch] = useState(null)
  const [tab, setTab] = useState('전체')
  const [search, setSearch] = useState('')

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ displayName: '', principalName: '', loginId: '', newPassword: '', ownerPhone: '' })
  const [editMsg, setEditMsg] = useState(null)
  const [cleanupMsg, setCleanupMsg] = useState(null)

  const [ownerPhones, setOwnerPhones] = useState(loadOwnerPhones)

  // ── SMS 대량 발송 상태 ──
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsChecked, setSmsChecked] = useState(new Set())
  const [smsText, setSmsText] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsSendIdx, setSmsSendIdx] = useState(0)
  const [smsSendResults, setSmsSendResults] = useState(null)
  const smsAbortRef = useRef(false)
  const smsWakeLockRef = useRef(null)

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
    const phones = loadOwnerPhones()
    setEditTarget(branch)
    setEditForm({
      displayName: getEffectiveBranchName(branch.id, branch.name),
      principalName: getEffectivePrincipalName(branch.id, branch.name),
      loginId: ov.loginId || branch.id,
      newPassword: '',
      ownerPhone: phones[branch.id] || '',
    })
    setEditMsg(null)
  }

  const closeEdit = () => {
    setEditTarget(null)
    setEditForm({ displayName: '', principalName: '', loginId: '', newPassword: '', ownerPhone: '' })
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
      // ownerPhone은 localStorage에만 저장
      const phones = loadOwnerPhones()
      phones[editTarget.id] = editForm.ownerPhone.trim()
      localStorage.setItem(OWNER_PHONES_KEY, JSON.stringify(phones))
      setOwnerPhones({ ...phones })

      setEditMsg({ ok: true, text: '저장되었습니다.' })
      setEditForm(f => ({ ...f, newPassword: '' }))
    } catch (e) {
      setEditMsg({ ok: false, text: e.message })
    }
  }

  const handleCleanup = async () => {
    if (!window.confirm('DB에서 __config__ 설정 행을 모두 삭제하고 현재 설정으로 재저장합니다. 계속할까요?')) return
    setCleanupMsg({ ok: null, text: '정리 중...' })
    try {
      const count = await cleanupConfigRows()
      setCleanupMsg({ ok: true, text: `완료: ${count}개 삭제 후 재저장됨` })
      setTimeout(() => setCleanupMsg(null), 5000)
    } catch (e) {
      setCleanupMsg({ ok: false, text: e.message })
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

  // ── SMS 모달 열기 ──
  const openSmsModal = () => {
    const phones = loadOwnerPhones()
    const withPhone = new Set(
      BRANCHES.filter(b => phones[b.id]?.trim()).map(b => b.id)
    )
    setSmsChecked(withPhone)
    setSmsText('')
    setSmsSendResults(null)
    setSmsOpen(true)
  }

  const closeSmsModal = useCallback(() => {
    if (smsSending) return
    setSmsOpen(false)
    setSmsSendResults(null)
    setSmsText('')
  }, [smsSending])

  const toggleAllSms = () => {
    const phones = loadOwnerPhones()
    const withPhone = BRANCHES.filter(b => phones[b.id]?.trim()).map(b => b.id)
    if (smsChecked.size === withPhone.length) {
      setSmsChecked(new Set())
    } else {
      setSmsChecked(new Set(withPhone))
    }
  }

  const toggleOneSms = (branchId) => {
    setSmsChecked(prev => {
      const next = new Set(prev)
      if (next.has(branchId)) next.delete(branchId)
      else next.add(branchId)
      return next
    })
  }

  // 문구 치환: {지사명}, {원장명}
  const buildSmsBody = useCallback((branchId, branchName) => {
    const displayName = getEffectiveBranchName(branchId, branchName)
    const principalName = getEffectivePrincipalName(branchId, branchName)
    return smsText
      .replace(/\{지사명\}/g, displayName)
      .replace(/\{원장명\}/g, principalName)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smsText, branchOverrides, dbBranchNames])

  // 순차 발송 (SMSPage.jsx 동일 패턴)
  const sendBranchSmsSequential = useCallback(async () => {
    const phones = loadOwnerPhones()
    const targets = BRANCHES.filter(b => smsChecked.has(b.id) && phones[b.id]?.trim())

    if (targets.length === 0) { alert('발송할 대상이 없습니다.'); return }
    if (!smsText.trim()) { alert('문자 내용을 입력해주세요.'); return }

    const h = new Date().getHours()
    if (h >= 21 || h < 8) {
      if (!window.confirm('야간(오후 9시~오전 8시)에는 광고성 문자 발송이 제한됩니다.\n그래도 보내시겠습니까?')) return
    }

    try {
      const perm = await SmsPlugin.requestSendSmsPermission()
      if (!perm.granted) { alert('SMS 발송 권한이 없습니다. 설정에서 허용해주세요.'); return }
    } catch (e) { console.warn('[SMS] 권한 확인 실패(웹 환경):', e?.message) }

    try {
      if ('wakeLock' in navigator) {
        smsWakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch (e) { console.warn('[WakeLock]', e?.message) }

    smsAbortRef.current = false
    setSmsSending(true)
    setSmsSendIdx(0)
    setSmsSendResults(null)

    const successes = []
    const failures = []

    for (let i = 0; i < targets.length; i++) {
      if (smsAbortRef.current) break
      setSmsSendIdx(i)
      const b = targets[i]
      const phone = phones[b.id]?.trim()
      const displayName = getEffectiveBranchName(b.id, b.name)
      const principalName = getEffectivePrincipalName(b.id, b.name)

      try {
        const body = buildSmsBody(b.id, b.name)
        await SmsPlugin.sendSms({ phone, body })
        successes.push({ name: `${displayName} ${principalName}`, phone })
      } catch (e) {
        failures.push({ name: `${displayName} ${principalName}`, phone, reason: e?.message || '발송 오류' })
      }

      if (i < targets.length - 1 && !smsAbortRef.current) {
        const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY
        await new Promise(r => setTimeout(r, delay))
      }
    }

    try { await smsWakeLockRef.current?.release(); smsWakeLockRef.current = null } catch (_) {}
    setSmsSending(false)
    setSmsSendResults({ success: successes, failure: failures, aborted: smsAbortRef.current })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smsChecked, smsText, buildSmsBody])

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

  // ── SMS 대량 발송 모달 ──
  const smsTargets = useMemo(() => {
    return BRANCHES.filter(b => smsChecked.has(b.id) && ownerPhones[b.id]?.trim())
  }, [smsChecked, ownerPhones])

  const phonesWithCount = useMemo(() => {
    return BRANCHES.filter(b => ownerPhones[b.id]?.trim()).length
  }, [ownerPhones])

  // ── 지사 선택 화면 ──
  if (!selectedBranch) {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.04em' }}>
          지사 관리
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: isAdmin ? 8 : 16 }}>
          조회할 지사를 선택하세요
        </p>

        {isAdmin && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={handleCleanup}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: '#f3f4f6', color: 'var(--text2)', cursor: 'pointer', fontWeight: 600 }}>
              DB 설정 행 정리
            </button>
            <button type="button" onClick={openSmsModal}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent)',
                background: 'rgba(79,126,248,0.08)', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }}>
              📨 문자보내기(대량 문자)
            </button>
            {cleanupMsg && (
              <span style={{ fontSize: 12, fontWeight: 600,
                color: cleanupMsg.ok === true ? '#15803d' : cleanupMsg.ok === false ? 'var(--red)' : 'var(--text2)' }}>
                {cleanupMsg.text}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {BRANCHES.map(b => {
            const cnt = allConsults.filter(c => c.branchId === b.id).length
            const displayName = getEffectiveBranchName(b.id, b.name)
            const principalName = getEffectivePrincipalName(b.id, b.name)
            const hasPhone = !!ownerPhones[b.id]?.trim()
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
                  {isAdmin && (
                    <span style={{ fontSize: 9, color: hasPhone ? '#16a34a' : '#d1d5db', fontWeight: 600, marginTop: 1 }}>
                      {hasPhone ? '📞' : '번호없음'}
                    </span>
                  )}
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
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>원장 휴대폰</div>
                <input className="input" type="tel" placeholder="010-0000-0000"
                  value={editForm.ownerPhone}
                  onChange={e => { setEditForm(f => ({ ...f, ownerPhone: e.target.value })); setEditMsg(null) }}
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

        {/* ── SMS 대량 발송 모달 ── */}
        {smsOpen && (
          <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 999, overflowY: 'auto' }}>

            {/* 발송 결과 화면 */}
            {smsSendResults ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 24px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>
                  {smsSendResults.failure.length === 0 ? '✅' : '⚠️'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                  발송 {smsSendResults.aborted ? '중단' : '완료'}
                </div>
                <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 20 }}>
                  성공 <span style={{ color: '#16a34a', fontWeight: 700 }}>{smsSendResults.success.length}건</span>
                  &nbsp;/ 실패 <span style={{ color: '#dc2626', fontWeight: 700 }}>{smsSendResults.failure.length}건</span>
                </div>
                {smsSendResults.failure.length > 0 && (
                  <div style={{ width: '100%', maxWidth: 400, background: '#fef2f2', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>실패 목록</div>
                    {smsSendResults.failure.map((f, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#7f1d1d', padding: '4px 0', borderBottom: '1px solid #fecaca' }}>
                        {f.name} ({f.phone}) — {f.reason}
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary" style={{ minWidth: 160 }}
                  onClick={() => { setSmsSendResults(null); setSmsOpen(false); setSmsText('') }}>
                  확인
                </button>
              </div>

            ) : smsSending ? (
              /* 발송 진행 화면 */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 24px' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>📨</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>원장님께 순차 발송 중...</div>
                {(() => {
                  const phones = loadOwnerPhones()
                  const targets = BRANCHES.filter(b => smsChecked.has(b.id) && phones[b.id]?.trim())
                  const cur = targets[smsSendIdx]
                  const displayName = cur ? getEffectiveBranchName(cur.id, cur.name) : ''
                  const principalName = cur ? getEffectivePrincipalName(cur.id, cur.name) : ''
                  return (
                    <>
                      <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
                        {smsSendIdx + 1} / {targets.length}명 &nbsp;—&nbsp;
                        <span style={{ fontWeight: 700 }}>{displayName} {principalName}</span>
                      </div>
                      <div style={{ width: '90%', maxWidth: 360, height: 8, background: '#e5e7eb', borderRadius: 4, marginBottom: 8 }}>
                        <div style={{
                          width: `${Math.round(((smsSendIdx + 1) / targets.length) * 100)}%`,
                          height: '100%', background: 'var(--accent)', borderRadius: 4,
                          transition: 'width 0.4s',
                        }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 32 }}>
                        {Math.round(((smsSendIdx + 1) / targets.length) * 100)}%
                      </div>
                    </>
                  )
                })()}
                <button className="btn btn-ghost"
                  onClick={() => { smsAbortRef.current = true }}
                  style={{ color: '#dc2626', borderColor: '#dc2626' }}>
                  ⏹ 중단
                </button>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 16, textAlign: 'center' }}>
                  발송 사이에 5~10초 랜덤 대기 중<br/>화면을 끄지 마세요
                </div>
              </div>

            ) : (
              /* 기본 작성 화면 */
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>원장 대량 문자</h2>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      번호 등록 지사 {phonesWithCount}개 · 선택 {smsTargets.length}명
                    </div>
                  </div>
                  <button type="button" onClick={closeSmsModal}
                    style={{ fontSize: 22, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                </div>

                {/* 지사 선택 목록 */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>발송 대상 선택</div>
                    <button type="button" onClick={toggleAllSms}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                        background: '#f3f4f6', color: 'var(--text2)', cursor: 'pointer', fontWeight: 600 }}>
                      {smsChecked.size === phonesWithCount ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {BRANCHES.map((b, idx) => {
                      const displayName = getEffectiveBranchName(b.id, b.name)
                      const principalName = getEffectivePrincipalName(b.id, b.name)
                      const phone = ownerPhones[b.id]?.trim() || ''
                      const hasPhone = !!phone
                      const checked = smsChecked.has(b.id)
                      return (
                        <div key={b.id}
                          onClick={() => hasPhone && toggleOneSms(b.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px',
                            borderBottom: idx < BRANCHES.length - 1 ? '1px solid #f3f4f6' : 'none',
                            background: checked ? 'rgba(79,126,248,0.05)' : '#fff',
                            cursor: hasPhone ? 'pointer' : 'default',
                            opacity: hasPhone ? 1 : 0.4,
                          }}>
                          <input type="checkbox" checked={checked} disabled={!hasPhone}
                            onChange={() => hasPhone && toggleOneSms(b.id)}
                            style={{ accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{principalName}</div>
                          </div>
                          <div style={{ fontSize: 11, color: hasPhone ? 'var(--text3)' : '#d1d5db', flexShrink: 0 }}>
                            {phone || '번호 없음'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 문자 내용 */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>문자 내용</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                    <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{'{지사명}'}</code>
                    &nbsp;
                    <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{'{원장명}'}</code>
                    &nbsp;을 입력하면 각 원장님께 자동 치환됩니다
                  </div>
                  <textarea
                    className="input"
                    placeholder={`안녕하세요, {지사명} {원장명} 원장님!\n\n참바른글씨 공지 내용을 입력하세요.`}
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                    style={{ minHeight: 200, fontSize: 14, lineHeight: 1.7 }}
                  />
                </div>

                <button type="button"
                  onClick={sendBranchSmsSequential}
                  disabled={smsTargets.length === 0 || !smsText.trim()}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: smsTargets.length === 0 || !smsText.trim() ? '#e5e7eb' : 'var(--accent)',
                    color: smsTargets.length === 0 || !smsText.trim() ? '#9ca3af' : '#fff',
                    fontSize: 15, fontWeight: 700, cursor: smsTargets.length === 0 || !smsText.trim() ? 'not-allowed' : 'pointer',
                    marginTop: 8,
                  }}>
                  📩 {smsTargets.length}명 원장님께 순차 발송
                </button>
              </div>
            )}
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
