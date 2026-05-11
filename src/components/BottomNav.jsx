import { useLocation, Link } from 'react-router-dom'

const NAV = [
  { path: '/', icon: '☰', label: '상담목록' },
  { path: '/input', icon: '+', label: '상담등록' },
  { path: '/schedule', icon: '◷', label: '예약일' },
  { path: '/sms', icon: '✉', label: '문자대상' },
  { path: '/attendance', icon: '✔', label: '출석관리' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="bottom-nav">
      {NAV.map(item => {
        const active =
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)

        return (
          <Link
            key={item.path}
            to={item.path}
            replace
            className={`bottom-nav-btn${active ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
