// 날짜 포맷: 날짜가 하루 밀리지 않도록 문자열 기준으로 처리
function fmtDate(val) {
  if (!val) return ''

  const str = String(val)

  // "2026-04-20T15:00:00.000Z" 또는 "2026-04-20" → "2026-04-20"
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
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.985)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}
      onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.985)')}
      onTouchEnd={e => (e.currentTarget.style.transform = '')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
            {c.name || '(이름없음)'}
          </div>

          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {c.phone}
            {c.age ? ` • ${c.age}` : ''}
            {c.gender ? ` ${c.gender}` : ''}
            {c.relation ? ` • ${c.relation}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {c.diagResult && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 12,
                background: 'var(--surface)',
                color: RESULT_COLOR[c.diagResult] || 'var(--text2)',
                border: `1px solid ${RESULT_COLOR[c.diagResult] || 'var(--border)'}`,
              }}
            >
              {c.diagResult}
            </span>
          )}

          {c.category && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 10,
                background: 'var(--surface)',
                color: 'var(--text3)',
                border: '1px solid var(--border)',
              }}
            >
              {c.category}
            </span>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={e => {
                e.stopPropagation()
                onEdit()
              }}
            >
              수정
            </button>

            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 12,
                padding: '4px 10px',
                color: 'var(--red)',
                borderColor: 'rgba(240,69,69,0.35)',
              }}
              onClick={e => {
                e.stopPropagation()
                onDelete?.()
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </div>

      {c.feature && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text2)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          {c.feature}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
        {c.inquiryDate && (
          <span>
            📅 {fmtDate(c.inquiryDate)}
            {c.inquiryDay ? ` (${c.inquiryDay})` : ''}
          </span>
        )}

        {c.diagDate && (
          <span style={{ color: 'var(--orange)' }}>
            🔔 {fmtDate(c.diagDate)}
            {c.diagDay ? ` (${c.diagDay})` : ''}
            {c.diagTime ? ` ${c.diagTime}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}