import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useApp } from './context/AppContext'
import ListPage from './pages/ListPage'
import InputPage from './pages/InputPage'
import SchedulePage from './pages/SchedulePage'
import SMSPage from './pages/SMSPage'
import DetailPage from './pages/DetailPage'
import AttendancePage from './pages/AttendancePage'
import CallBanner from './components/CallBanner'

const NAV = [
  { path: '/',           icon: '≡',  label: '상담목록' },
  { path: '/input',      icon: '+',  label: '상담등록' },
  { path: '/schedule',   icon: '◷',  label: '예약일' },
  { path: '/sms',        icon: '✉',  label: '문자대상' },
  { path: '/attendance', icon: '✔',  label: '출석관리' },
]

export default function App() {
  const { load } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* 헤더 */}
      <header style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'DM Sans, sans-serif',
          }}>C</div>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px' }}>상담 CRM</span>
        </div>
        <button className="btn btn-ghost btn-sm"
          onClick={() => load()}
          style={{ fontSize: 18, padding: '6px 10px' }} title="새로고침">↻</button>
      </header>

      {/* 메인 */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        <Routes>
          <Route path="/"              element={<ListPage />} />
          <Route path="/input"         element={<InputPage />} />
          <Route path="/input/:id"     element={<InputPage />} />
          <Route path="/schedule"      element={<SchedulePage />} />
          <Route path="/sms"           element={<SMSPage />} />
          <Route path="/detail/:id"    element={<DetailPage />} />
          <Route path="/attendance"    element={<AttendancePage />} />
        </Routes>
      </main>

      {/* 통화 종료 배너 */}
      <CallBanner />

      {/* 하단 네비게이션 */}
      <nav style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        display: 'flex', zIndex: 200,
      }}>
        {NAV.map(n => {
          const active = location.pathname === n.path ||
            (n.path === '/input' && location.pathname.startsWith('/input'))
          return (
            <button key={n.path} onClick={() => navigate(n.path)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '10px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--accent)' : 'var(--text3)',
              transition: 'color 0.15s', position: 'relative',
            }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{n.label}</span>
              {active && (
                <span style={{
                  position: 'absolute', bottom: 0,
                  width: 24, height: 2,
                  background: 'var(--accent)', borderRadius: 2,
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
