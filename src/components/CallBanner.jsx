import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallDetect } from '../hooks/useCallDetect'

/**
 * CallBanner
 *
 * 통화 종료 후 화면 하단에 팝업처럼 나타나는 배너.
 * "상담 등록하기" 버튼을 누르면 해당 번호가 자동 입력된 폼으로 이동.
 */
export default function CallBanner() {
  const { lastCall, isNative, permitted, requestPermission, clearLastCall } = useCallDetect()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (lastCall) setVisible(true)
  }, [lastCall])

  // 웹 환경이면 렌더링 안 함
  if (!isNative) return null

  // 권한 미허용 시 권한 요청 버튼 표시
  if (!permitted) {
    return (
      <div style={{
        position: 'fixed', bottom: 90, left: 16, right: 16, zIndex: 500,
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>📞</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            통화 자동 감지 설정
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            통화 후 자동으로 상담 폼이 열리려면 권한이 필요합니다
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={requestPermission}>
          허용
        </button>
      </div>
    )
  }

  // 통화 종료 배너
  if (!visible || !lastCall) return null

  const mins = Math.floor(lastCall.duration / 60)
  const secs = lastCall.duration % 60
  const durationStr = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`

  const handleRegister = () => {
    clearLastCall()
    setVisible(false)
    // 전화번호를 state로 넘겨서 InputPage에서 자동 입력
    navigate('/input', { state: { phone: lastCall.phone } })
  }

  const handleDismiss = () => {
    clearLastCall()
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 90, left: 16, right: 16, zIndex: 500,
      background: 'var(--bg2)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(79,126,248,0.25)',
      animation: 'slideUp 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(52,201,126,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>📞</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
            통화 종료
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {lastCall.phone || '번호 없음'} · {durationStr}
          </div>
        </div>
        <button onClick={handleDismiss} style={{
          background: 'none', border: 'none', color: 'var(--text3)',
          fontSize: 18, cursor: 'pointer', padding: 4,
        }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }}
          onClick={handleDismiss}>
          건너뛰기
        </button>
        <button className="btn btn-primary" style={{ flex: 2 }}
          onClick={handleRegister}>
          📋 상담 등록하기
        </button>
      </div>
    </div>
  )
}
