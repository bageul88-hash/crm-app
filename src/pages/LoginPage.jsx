import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [msg, setMsg] = useState('')

  const handleLogin = e => {
    e.preventDefault()
    setMsg('')
    try {
      login(id.trim(), password.trim())
      const params = new URLSearchParams(window.location.search)
      const phone = params.get('phone')
      navigate(phone ? `/input?phone=${phone}` : '/', { replace: true })
    } catch (err) {
      setMsg(err.message || '로그인 실패')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">C</div>
        <h1 className="login-title">상담 CRM</h1>

        <form onSubmit={handleLogin} className="login-form">
          <input
            className="input"
            placeholder="아이디"
            value={id}
            onChange={e => setId(e.target.value)}
            autoComplete="username"
          />

          <div className="login-pw-row">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="pw-toggle-btn"
              onClick={() => setShowPassword(v => !v)}
            >
              {showPassword ? '숨김' : '보기'}
            </button>
          </div>

          {msg && <p className="login-error">{msg}</p>}

          <button type="submit" className="btn btn-primary login-submit-btn">
            로그인
          </button>
        </form>
      </div>
    </div>
  )
}
