// 날짜 포맷
function fmtDate(val) {
  if (!val) return ''

  const str = String(val)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return str.slice(0, 10)

  return `${match[1]}-${match[2]}-${match[3]}`
}

const RESULT_COLOR = {
  등록: 'var(--green)',
  미등록: 'var(--orange)',
  문의만: 'var(--purple)',
  불가: 'var(--red)',
  체결: 'var(--accent)',
  기타: 'var(--text2)',
}

export default function ConsultCard({ consult: c, onClick, onEdit, onDelete }) {
  return (
    <div
      className="card fade-in"
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {c.name || '(이름없음)'}
          </div>

          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {c.phone}
            {c.age ? ` • ${c.age}` : ''}
            {c.gender ? ` ${c.gender}` : ''}
            {c.relation ? ` • ${c.relation}` : ''}
          </div>
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', gap: 6 }}>

          {/* 수정 버튼 */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            수정
          </button>

          {/* 삭제 버튼 (핵심 수정) */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{
              color: 'var(--red)',
              border: '1px solid rgba(240,69,69,0.4)',
              background: 'rgba(240,69,69,0.05)',
              cursor: 'pointer',
              zIndex: 999,
              position: 'relative'
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()

              console.log('삭제 클릭됨', c.id) // 확인용

              onDelete?.()
            }}
          >
            삭제
          </button>
        </div>
      </div>

      {c.feature && (
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          {c.feature}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
        {c.inquiryDate && (
          <span>📅 {fmtDate(c.inquiryDate)}</span>
        )}

        {c.diagDate && (
          <span style={{ marginLeft: 10, color: 'var(--orange)' }}>
            🔔 {fmtDate(c.diagDate)} {c.diagTime}
          </span>
        )}
      </div>
    </div>
  )
}