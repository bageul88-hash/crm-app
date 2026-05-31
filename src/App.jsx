import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useApp } from './context/AppContext'
import { App as CapApp } from '@capacitor/app'

const TELEGRAM_TOKEN  = import.meta.env.VITE_TELEGRAM_TOKEN
const TELEGRAM_CHAT   = import.meta.env.VITE_TELEGRAM_CHAT_ID
const TELEGRAM_DAYS   = ['일','월','화','수','목','금','토']

function fmtKrTime(timeStr) {
  if (!timeStr) {
    const n = new Date()
    const h = n.getHours(), m = n.getMinutes()
    return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2,'0')}`
  }
  const [h, m] = timeStr.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2,'0')}`
}

function sendTelegramAttendance(studentName, attendDate, attendTime, totalCount) {
  const [y, mo, d] = attendDate.split('-').map(Number)
  const dayName = TELEGRAM_DAYS[new Date(y, mo - 1, d).getDay()]
  const text =
    `✅ 출석 완료\n\n` +
    `👤 ${studentName}\n` +
    `📅 ${attendDate} (${dayName}요일)\n` +
    `🕐 ${attendTime}\n` +
    `📊 총 출석 ${totalCount}회`
  fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text }),
  }).catch(() => {})
}

import ListPage from './pages/ListPage'
import InputPage from './pages/InputPage'
import SchedulePage from './pages/SchedulePage'
import SMSPage from './pages/SMSPage'
import DetailPage from './pages/DetailPage'
import AttendancePage from './pages/AttendancePage'
import BranchPage from './pages/BranchPage'
import MemoPage from './pages/MemoPage'
import LoginPage from './pages/LoginPage'

import CallBanner from './components/CallBanner'
import BottomNav from './components/BottomNav'
import { useSmsAttendance, useMmsReceived, normalizeMmsPhone } from './hooks/useSmsAttendance'
import { useUpdateCheck } from './hooks/useUpdateCheck'

export default function App() {
  const { load, silentSync, currentUser, logout, saveError, saveSuccess, branchOverrides, consults } = useApp()
  const navigate = useNavigate()
  const isAdmin = currentUser?.role === 'admin'

  const ov = branchOverrides?.[currentUser?.branchId] || {}
  const headerBranchName = isAdmin ? '본사' : (ov.displayName || currentUser?.branchName || '')
  const headerPrincipalName = isAdmin ? '관리자' : (ov.principalName || currentUser?.name || '')
  const [smsToast, setSmsToast] = useState(null)
  const [mmsToast, setMmsToast] = useState(null)

  useEffect(() => {
    if (currentUser) load()
  }, [currentUser, load])

  // 앱이 포그라운드로 돌아올 때 지사명/원장명 포함 최신 데이터 동기화
  useEffect(() => {
    if (!currentUser) return
    let handle
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) silentSync()
    }).then(h => { handle = h }).catch(() => {})
    return () => { handle?.remove() }
  }, [currentUser, silentSync])

  const handleSmsAttendance = useCallback((studentName, time) => {
    // localStorage 즉시 반영 (AttendancePage가 마운트되지 않아도 보존)
    try {
      const saved = localStorage.getItem('attendance_students')
      if (saved) {
        const list = JSON.parse(saved)
        const found = list.some(s => s.name === studentName)
        if (found) {
          const updated = list.map(s =>
            s.name === studentName ? { ...s, done: true, checked: false } : s
          )
          localStorage.setItem('attendance_students', JSON.stringify(updated))
        }
      }
    } catch (_) {}

    // 전화번호 조회 (동명이인 분리용)
    let studentPhone = ''
    try {
      const cached = localStorage.getItem('crm_consults_cache')
      if (cached) {
        const all = JSON.parse(cached)
        const found = all.find(c => c.name === studentName)
        if (found) studentPhone = String(found.phone || '').replace(/\D/g, '')
      }
    } catch {}

    // AttendancePage in-memory 상태 갱신 (time + phone 포함)
    window.dispatchEvent(new CustomEvent('smsAttendance', { detail: { studentName, time, phone: studentPhone } }))

    // 텔레그램 출석 알림
    try {
      const now = new Date()
      const attendDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      const attendTime = fmtKrTime(time)
      const todayStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
      const allRecs = JSON.parse(localStorage.getItem('attendance_records') || '{}')
      const todayHas = (allRecs[todayStr] || []).some(e => (typeof e === 'string' ? e : e?.name) === studentName)
      const historical = Object.values(allRecs).reduce((sum, list) =>
        sum + (list || []).filter(e => (typeof e === 'string' ? e : e?.name) === studentName).length, 0)
      const totalCount = todayHas ? historical : historical + 1
      sendTelegramAttendance(studentName, attendDate, attendTime, totalCount)
    } catch (_) {}

    // 토스트 표시
    setSmsToast(studentName)
    setTimeout(() => setSmsToast(null), 5000)
  }, [])

  useSmsAttendance(handleSmsAttendance)

  const handleMmsReceived = useCallback((rawPhone) => {
    const phone = normalizeMmsPhone(rawPhone)
    // localStorage MMS 캐시에 즉시 추가
    try {
      const cached = localStorage.getItem('crm_mms_senders')
      const set = cached ? new Set(JSON.parse(cached)) : new Set()
      set.add(phone)
      localStorage.setItem('crm_mms_senders', JSON.stringify([...set]))
    } catch {}
    // 기등록 번호 체크
    const existing = consults.find(c => c.phone === phone)
    if (existing) {
      navigate(`/detail/${existing.id}`)
      setMmsToast(`📷 이미 등록된 상담 — ${phone}`)
    } else {
      navigate('/input', { state: { phone, hasPhoto: '유' } })
      setMmsToast(`📷 MMS 수신 — ${phone} 신규 등록`)
    }
    setTimeout(() => setMmsToast(null), 5000)
  }, [consults, navigate])

  useMmsReceived(handleMmsReceived)

  const { update, dismiss } = useUpdateCheck()

  // 로그인 전에는 헤더/하단메뉴 없이 로그인 화면만 표시
  if (!currentUser) {
    return <LoginPage />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand-wrap" onClick={() => { window.location.href = '/' }}>
          <img src="/logo.png" alt="로고" className="brand-logo-img" />
          <div className="brand-text-group">
            <div className="brand-title">
              <strong>상담</strong>
              <strong>CRM</strong>
            </div>
            {!isAdmin && (
              <div className="user-box">
                <strong>{headerBranchName}</strong>
                <span>{headerPrincipalName}</span>
              </div>
            )}
          </div>
        </button>

        <div className="header-actions">
          {isAdmin && (
            <>
              <button
                type="button"
                className="header-btn header-btn-memo"
                onClick={() => navigate('/memo')}
                style={{ whiteSpace: 'nowrap' }}
              >
                본사메모
              </button>
              <button
                type="button"
                className="header-btn header-btn-branch"
                onClick={() => navigate('/branch')}
              >
                <span>지사</span>
                <span>관리</span>
              </button>
            </>
          )}
          <button type="button" className="header-btn header-btn-logout" onClick={logout}>
            로그아웃
          </button>
          <button type="button" className="refresh-btn" onClick={load} title="새로고침">
            ↻
          </button>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/input" element={<InputPage />} />
          <Route path="/input/:id" element={<InputPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/sms" element={<SMSPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/branch" element={<BranchPage />} />
          <Route path="/memo" element={<MemoPage />} />
          <Route path="/detail/:id" element={<DetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <CallBanner />
      <BottomNav />

      {mmsToast && (
        <div style={{
          position: 'fixed', bottom: smsToast ? 140 : 80, left: '50%', transform: 'translateX(-50%)',
          background: '#0ea5e9', color: '#fff', borderRadius: 12,
          padding: '12px 20px', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          {mmsToast}
        </div>
      )}

      {smsToast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', color: '#fff', borderRadius: 12,
          padding: '12px 20px', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          <span>✅</span>
          <span>{smsToast} 학생 등원 자동 체크</span>
        </div>
      )}

      {saveSuccess && (
        <div style={{
          position: 'fixed', bottom: smsToast ? 140 : 80, left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', color: '#fff', borderRadius: 12,
          padding: '12px 20px', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          {saveSuccess}
        </div>
      )}

      {saveError && (
        <div style={{
          position: 'fixed', bottom: smsToast ? 140 : 80, left: '50%', transform: 'translateX(-50%)',
          background: '#dc2626', color: '#fff', borderRadius: 12,
          padding: '12px 20px', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 9999,
          whiteSpace: 'nowrap',
          maxWidth: '90vw', textAlign: 'center',
        }}>
          {saveError}
        </div>
      )}

      {update && (
        <div style={{
          position: 'fixed', bottom: 68, left: 0, right: 0, zIndex: 9990,
          margin: '0 12px',
          background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
          borderRadius: 14, padding: '12px 16px',
          boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              새 버전 {update.version} 업데이트
            </div>
            {update.notes && (
              <div style={{ fontSize: 11, color: '#bfdbfe', marginTop: 2 }}>{update.notes}</div>
            )}
          </div>
          <button
            onClick={() => window.open(update.apkUrl, '_system')}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: '#fff', color: '#1d4ed8',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}
          >
            다운로드
          </button>
          <button
            onClick={dismiss}
            style={{
              width: 24, height: 24, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              fontSize: 14, cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}