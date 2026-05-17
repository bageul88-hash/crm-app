import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const NAV = [
  { path: '/', icon: '☰', label: '상담목록' },
  { path: '/input', icon: '+', label: '상담등록' },
  { path: '/schedule', icon: '◷', label: '예약일' },
  { path: '/sms', icon: '✉', label: '문자대상' },
  { path: '/attendance', icon: '✔', label: '출석관리' },
]

const ADMIN_NAV = { path: '/branch', icon: '⊞', label: '지사관리' }

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useApp()
  const isAdmin = currentUser?.role === 'admin'

  const items = isAdmin ? [...NAV, ADMIN_NAV] : NAV

  return (
    <nav className="bottom-nav">
      {items.map(item => {
        const active =
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)

        return (
          <button
            key={item.path}
            type="button"
            className={`bottom-nav-btn${active ? ' active' : ''}`}
            onClick={() => navigate(item.path, { replace: true })}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
