function fmtDate(value) {
  if (!value) return ''
  const str = String(value)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : str.slice(0, 10)
}

const DAY_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function getDayFromDate(value) {
  const dateStr = fmtDate(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return ''

  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)

  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return ''
  }

  return DAY_KR[date.getDay()]
}

function formatAge(value) {
  if (!value) return ''
  const text = String(value).trim()
  return text.endsWith('세') ? text : `${text}세`
}

function getStatus(consult) {
  if (consult.diagResult) return consult.diagResult
  if (consult.category) return consult.category
  return ''
}

function hasLessonInfo(item) {
  return Boolean(item?.lessonDate || item?.lessonDay || item?.lessonTime)
}

function shouldShowLessonBadge(item) {
  return (
    ['예약', '등록', '수업중'].includes(item?.category) ||
    ['예약', '등록', '수업중'].includes(item?.diagResult)
  )
}

function getLessonText(item) {
  if (!shouldShowLessonBadge(item) || !hasLessonInfo(item)) return ''

  const date = fmtDate(item.lessonDate)
  const day = item.lessonDay || getDayFromDate(item.lessonDate)
  const time = item.lessonTime || ''

  const parts = [date, day, time].filter(Boolean)

  return parts.length ? `수업중 - ${parts.join(' ')}` : ''
}

export default function ConsultCard({ consult, onClick, onEdit, onDelete }) {
  const c = consult || {}
  const status = getStatus(c)
  const lessonText = getLessonText(c)
  const phone = c.phone || '-'

  return (
    <article className="consult-card fade-in" onClick={onClick}>
      <div className="consult-card-top">
        <div className="consult-info">
          <h3>{c.name || '(이름없음)'}</h3>

          <p>
            {phone}
            {c.age ? ` · ${formatAge(c.age)}` : ''}
          </p>

          <p>
            {c.gender || ''}
            {c.relation ? ` · ${c.relation}` : ''}
          </p>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="mini-btn edit"
            onClick={e => {
              e.stopPropagation()
              onEdit?.()
            }}
          >
            수정
          </button>

          <button
            type="button"
            className="mini-btn delete"
            onClick={e => {
              e.stopPropagation()
              onDelete?.()
            }}
          >
            삭제
          </button>
        </div>
      </div>

      {c.feature && <p className="consult-feature">{c.feature}</p>}

      <div className="consult-dates">
        {c.inquiryDate && <span>📅 {fmtDate(c.inquiryDate)}</span>}

        {c.diagDate && (
          <span>
            🔔 {fmtDate(c.diagDate)}
            {c.diagTime ? ` ${c.diagTime}` : ''}
          </span>
        )}
      </div>

      <div className="consult-bottom">
        <div className="card-bottom-status">
          {status && <span className="status-chip">{status}</span>}

          {lessonText && (
            <span className="lesson-chip">
              {lessonText}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}