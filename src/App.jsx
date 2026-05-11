import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useApp } from './context/AppContext'

import ListPage from './pages/ListPage'
import InputPage from './pages/InputPage'
import SchedulePage from './pages/SchedulePage'
import SMSPage from './pages/SMSPage'
import DetailPage from './pages/DetailPage'
import AttendancePage from './pages/AttendancePage'
import LoginPage from './pages/LoginPage'

import CallBanner from './components/CallBanner'
import BottomNav from './components/BottomNav'
import { useSmsAttendance } from './hooks/useSmsAttendance'

export default function App() {
  const { load, currentUser, logout } = useApp()
  const [smsToast, setSmsToast] = useState(null)

  useEffect(() => {
    if (currentUser) load()
  }, [currentUser, load])

  const handleSmsAttendance = useCallback((studentName) => {
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

    // AttendancePage가 마운트된 경우 in-memory 상태도 갱신
    window.dispatchEvent(new CustomEvent('smsAttendance', { detail: { studentName } }))

    // 토스트 표시
    setSmsToast(studentName)
    setTimeout(() => setSmsToast(null), 5000)
  }, [])

  useSmsAttendance(handleSmsAttendance)

  // 로그인 전에는 헤더/하단메뉴 없이 로그인 화면만 표시
  if (!currentUser) {
    return <LoginPage />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-wrap">
          <div className="brand-logo">C</div>
          <div className="brand-title">
            <strong>상담</strong>
            <strong>CRM</strong>
          </div>
        </div>

        <div className="user-box">
          <strong>{currentUser?.branchName || currentUser?.name || '본사'}</strong>
          <span>{currentUser?.role === 'admin' ? '관리자' : currentUser?.name}</span>
        </div>

        <div className="header-actions">
          <button type="button" className="header-btn" onClick={logout}>
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
          <Route path="/detail/:id" element={<DetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <CallBanner />
      <BottomNav />

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
    </div>
  )
}