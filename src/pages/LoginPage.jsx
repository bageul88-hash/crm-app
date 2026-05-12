import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function LoginPage() {
  const { login, changePassword } = useApp()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login')

  // 로그인 상태
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [msg, setMsg] = useState('')

  // 비밀번호 변경 상태
  const [cpId, setCpId] = useState('')
  const [cpCurrent, setCpCurrent] = useState('')
  const [cpNew, setCpNew] = useState('')
  const [cpConfirm, setCpConfirm] = useState('')
  const [showCpCurrent, setShowCpCurrent] = useState(false)
  const [showCpNew, setShowCpNew] = useState(false)
  const [cpMsg, setCpMsg] = useState('')
  const [cpSuccess, setCpSuccess] = useState(false)

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

  const handleChangePassword = e => {
    e.preventDefault()
    setCpMsg('')
    setCpSuccess(false)
    if (cpNew !== cpConfirm) {
      setCpMsg('새 비밀번호가 일치하지 않습니다')
      return
    }
    try {
      changePassword(cpId.trim(), cpCurrent.trim(), cpNew.trim())
      setCpSuccess(true)
      setCpMsg('비밀번호가 변경되었습니다')
      setTimeout(() => {
        setMode('login')
        setCpId(''); setCpCurrent(''); setCpNew(''); setCpConfirm('')
        setCpMsg(''); setCpSuccess(false)
      }, 1800)
    } catch (err) {
      setCpMsg(err.message || '비밀번호 변경 실패')
    }
  }

  const goToChangePw = () => { setMsg(''); setMode('changePw') }
  const goToLogin = () => { setCpMsg(''); setCpSuccess(false); setMode('login') }

  return (
    <div className="login-page">
      <div className="login-card">
        {mode === 'login' ? (
          <div className="login-section fade-in">
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
                  type={showPw ? 'text' : 'password'}
                  placeholder="비밀번호"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className="pw-toggle-btn" onClick={() => setShowPw(v => !v)}>
                  {showPw ? '숨김' : '보기'}
                </button>
              </div>

              {msg && <p className="login-error">{msg}</p>}

              <button type="submit" className="btn btn-primary login-submit-btn">
                로그인
              </button>
            </form>

            <div className="login-footer">
              <button type="button" className="login-link-btn" onClick={goToChangePw}>
                비밀번호 변경
              </button>
            </div>
          </div>
        ) : (
          <div className="login-section fade-in">
            <button type="button" className="login-back-btn" onClick={goToLogin}>
              ← 로그인으로
            </button>

            <div className="login-logo login-logo-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="login-title">비밀번호 변경</h1>

            <form onSubmit={handleChangePassword} className="login-form">
              <input
                className="input"
                placeholder="아이디"
                value={cpId}
                onChange={e => setCpId(e.target.value)}
                autoComplete="username"
              />

              <div className="login-pw-row">
                <input
                  className="input"
                  type={showCpCurrent ? 'text' : 'password'}
                  placeholder="현재 비밀번호"
                  value={cpCurrent}
                  onChange={e => setCpCurrent(e.target.value)}
                />
                <button type="button" className="pw-toggle-btn" onClick={() => setShowCpCurrent(v => !v)}>
                  {showCpCurrent ? '숨김' : '보기'}
                </button>
              </div>

              <div className="login-pw-divider" />

              <div className="login-pw-row">
                <input
                  className="input"
                  type={showCpNew ? 'text' : 'password'}
                  placeholder="새 비밀번호 (4자 이상)"
                  value={cpNew}
                  onChange={e => setCpNew(e.target.value)}
                />
                <button type="button" className="pw-toggle-btn" onClick={() => setShowCpNew(v => !v)}>
                  {showCpNew ? '숨김' : '보기'}
                </button>
              </div>

              <input
                className="input"
                type="password"
                placeholder="새 비밀번호 확인"
                value={cpConfirm}
                onChange={e => setCpConfirm(e.target.value)}
              />

              {cpMsg && (
                <p className={cpSuccess ? 'login-success-msg' : 'login-error'}>{cpMsg}</p>
              )}

              <button type="submit" className="btn btn-primary login-submit-btn" disabled={cpSuccess}>
                변경하기
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
