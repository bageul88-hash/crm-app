import { useState, useEffect } from 'react'
import { SMS_TEMPLATES, pickTemplateKey, buildSmsBody } from '../api/smsTemplates'
import { OPTIONS } from '../api/sheets'
import { sendSmsAligo, ALIGO_CONFIGURED } from '../api/aligo'

/**
 * SmsModal
 * 저장 완료 후 문자 미리보기 + 발송 모달
 *
 * props:
 *   consult  — 저장된 상담 데이터
 *   onClose  — 닫기 콜백
 */
export default function SmsModal({ consult, onClose }) {
  const [templateKey, setTemplateKey] = useState('')
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendMode, setSendMode] = useState('app')  // 'app' | 'aligo'
  const [aligoStatus, setAligoStatus] = useState(null)  // null | 'sending' | 'ok' | 'err'
  const [aligoMsg, setAligoMsg] = useState('')

  useEffect(() => {
    const key = pickTemplateKey(consult.category, consult.relation)
    setTemplateKey(key)
    setBody(buildSmsBody(key, consult))
  }, [consult])

  // 템플릿 변경 시 내용 재생성
  const handleTemplateChange = (key) => {
    setTemplateKey(key)
    setBody(buildSmsBody(key, consult))
    setEditing(false)
  }

  const handleSend = async () => {
    if (sendMode === 'aligo') {
      const phone = consult.phone?.replace(/[^0-9]/g, '') || ''
      if (!phone) { alert('전화번호가 없습니다.'); return }
      setAligoStatus('sending')
      setAligoMsg('')
      try {
        const res = await sendSmsAligo({ receivers: [phone], msg: body })
        setAligoStatus('ok')
        setAligoMsg(`발송 완료 (${res.sent}건)`)
        setTimeout(onClose, 1800)
      } catch (e) {
        setAligoStatus('err')
        setAligoMsg(e.message)
      }
      return
    }
    // Method A: 기본 문자앱 열기
    const phone = consult.phone?.replace(/[^0-9]/g, '') || ''
    window.location.href = `sms:${phone}?body=${encodeURIComponent(body)}`
    setSent(true)
    setTimeout(onClose, 1500)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body)
    alert('문자 내용이 복사되었습니다')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{
        background: 'var(--bg2)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '92dvh',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* 핸들 */}
        <div style={{
          width: 40, height: 4, background: 'var(--border2)',
          borderRadius: 2, margin: '12px auto 0',
        }} />

        {/* 헤더 */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>문자 발송</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
              📱 {consult.phone} · {consult.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text3)',
            fontSize: 22, cursor: 'pointer', padding: 4,
          }}>✕</button>
        </div>

        {/* 발송 방식 선택 */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          {[
            { key: 'app',   label: '📱 문자앱' },
            { key: 'aligo', label: '🚀 알리고 API', disabled: !ALIGO_CONFIGURED },
          ].map(({ key, label, disabled }) => (
            <button key={key} onClick={() => !disabled && setSendMode(key)}
              disabled={disabled}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid',
                borderColor: sendMode === key ? 'var(--accent)' : 'var(--border)',
                background: sendMode === key ? 'rgba(79,126,248,0.12)' : 'transparent',
                color: disabled ? 'var(--text3)' : (sendMode === key ? 'var(--accent)' : 'var(--text2)'),
                fontSize: 13, fontWeight: sendMode === key ? 700 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* 스크롤 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* 템플릿 선택 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text3)',
              letterSpacing: '0.05em', textTransform: 'uppercase',
              display: 'block', marginBottom: 8,
            }}>문자 종류 선택</label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
            }}>
              {Object.entries(SMS_TEMPLATES).map(([key, tmpl]) => (
                <button key={key} onClick={() => handleTemplateChange(key)} style={{
                  padding: '6px 12px', borderRadius: 20,
                  border: '1px solid',
                  borderColor: templateKey === key ? 'var(--accent)' : 'var(--border)',
                  background: templateKey === key ? 'rgba(79,126,248,0.15)' : 'transparent',
                  color: templateKey === key ? 'var(--accent)' : 'var(--text2)',
                  fontSize: 13, fontWeight: templateKey === key ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  transition: 'all 0.15s',
                }}>{tmpl.label}</button>
              ))}
            </div>
          </div>

          {/* 문자 미리보기 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 8,
            }}>
              <label style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text3)',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>미리보기</label>
              <button onClick={() => setEditing(!editing)} style={{
                background: 'none', border: 'none',
                color: 'var(--accent)', fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}>{editing ? '✓ 완료' : '✏️ 수정'}</button>
            </div>

            {editing ? (
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                style={{
                  width: '100%', minHeight: 320,
                  background: 'var(--bg3)',
                  border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)', fontFamily: 'var(--font)',
                  fontSize: 13, lineHeight: 1.7, padding: 14,
                  resize: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 14, fontSize: 13,
                lineHeight: 1.8, color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                maxHeight: 320, overflowY: 'auto',
              }}>{body}</div>
            )}

            <div style={{
              fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'right',
            }}>{body.length}자</div>
          </div>

          {/* 자동 치환 정보 */}
          {(consult.diagDate || consult.diagTime) && (
            <div style={{
              background: 'rgba(79,126,248,0.08)',
              border: '1px solid rgba(79,126,248,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px', fontSize: 12, color: 'var(--text2)',
              marginBottom: 8,
            }}>
              ✅ 자동 입력됨:
              {consult.diagDate && ` 📅 ${consult.diagDate}`}
              {consult.diagDay && ` (${consult.diagDay})`}
              {consult.diagTime && ` 🕐 ${consult.diagTime}`}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: '12px 20px 28px', borderTop: '1px solid var(--border)' }}>
          {aligoStatus === 'err' && (
            <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fee2e2', borderRadius: 7, fontSize: 12, color: '#dc2626' }}>
              ❌ {aligoMsg}
            </div>
          )}
          {aligoStatus === 'ok' && (
            <div style={{ marginBottom: 8, padding: '8px 12px', background: '#dcfce7', borderRadius: 7, fontSize: 12, color: '#16a34a' }}>
              ✅ {aligoMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleCopy}>복사</button>
            <button className="btn btn-primary" style={{ flex: 2, fontSize: 15 }}
              onClick={handleSend}
              disabled={sent || aligoStatus === 'sending' || aligoStatus === 'ok'}>
              {aligoStatus === 'sending' ? '⏳ 발송 중...'
                : aligoStatus === 'ok' ? '✅ 발송 완료'
                : sent ? '✅ 문자앱 열림'
                : sendMode === 'aligo' ? '🚀 알리고로 발송'
                : '📱 문자앱으로 보내기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
