// 날짜 포맷: "2026-04-20T15:00:00.000Z" → "2026-04-20"
function fmtDate(val) {
  if (!val) return ''
  return String(val).slice(0, 10)
}

const RESULT_COLOR = {
  '등록':  'var(--green)',
  '미등록': 'var(--orange)',
  '불가':  'var(--red)',
}

export default function ConsultCard({ consult: c, onClick, onEdit }) {
  return (
    <div className="card fade-in" style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.985)'}
      onMouseUp={e => e.currentTarget.style.transform = ''}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.985)'}
      onTouchEnd={e => e.currentTarget.style.transform = ''}
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
            <span style={{
              fontSize: 12, fontWeight: 600,
              padding: '3px 8px', borderRadius: 12,
              background: 'var(--surface)',
              color: RESULT_COLOR[c.diagResult] || 'var(--text2)',
              border: `1px solid ${RESULT_COLOR[c.diagResult] || 'var(--border)'}`,
            }}>{c.diagResult}</span>
          )}
          {c.category && (
            <span style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 10,
              background: 'var(--surface)', color: 'var(--text3)',
              border: '1px solid var(--border)',
            }}>{c.category}</span>
          )}
          <button className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={e => { e.stopPropagation(); onEdit() }}>수정</button>
        </div>
      </div>

      {c.feature && (
        <div style={{
          fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 6,
        }}>{c.feature}</div>
      )}

      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
        {c.inquiryDate && (
          <span>📅 {fmtDate(c.inquiryDate)}{c.inquiryDay ? ` (${c.inquiryDay})` : ''}</span>
        )}
        {c.diagDate && (
          <span style={{ color: 'var(--orange)' }}>
            🔔 {fmtDate(c.diagDate)}{c.diagDay ? ` (${c.diagDay})` : ''}
            {c.diagTime ? ` ${c.diagTime}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}