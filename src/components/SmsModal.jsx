import { useState, useEffect } from 'react'
import { SMS_TEMPLATES, pickTemplateKey, buildSmsBody } from '../api/smsTemplates'
import { OPTIONS } from '../api/sheets'

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

  // 안드로이드 문자앱 열기 (sms: URI 스킴)
  const handleSend = () => {
    const phone = consult.phone?.replace(/[^0-9]/g, '') || ''
    const encoded = encodeURIComponent(body)
    // sms: URI — 안드로이드 기본 문자앱이 열리면서 번호+내용 자동 입력
    window.location.href = `sms:${phone}?body=${encoded}`
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
        <div style={{
          padding: '12px 20px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10,
        }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}
            onClick={handleCopy}>복사</button>
          <button className="btn btn-primary" style={{ flex: 2, fontSize: 15 }}
            onClick={handleSend} disabled={sent}>
            {sent ? '✅ 문자앱 열림' : `📱 문자 보내기`}
          </button>
        </div>
      </div>
    </div>
  )
}
