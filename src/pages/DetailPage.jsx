import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import SmsModal from '../components/SmsModal'

export default function DetailPage() {
  const { id } = useParams()
  const { consults, remove } = useApp()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSms, setShowSms] = useState(false)

  const c = consults.find(x => String(x.id) === String(id))

  if (!c) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
      <div>상담 내역을 찾을 수 없습니다</div>
      <button className="btn btn-ghost" style={{ marginTop: 20 }}
        onClick={() => navigate('/')}>목록으로</button>
    </div>
  )

  const handleDelete = async () => {
    setDeleting(true)
    try { await remove(c.id); navigate('/') }
    catch (e) { alert('삭제 실패: ' + e.message); setDeleting(false) }
  }

  const Row = ({ label, value, highlight }) => value ? (
    <div style={{
      borderBottom: '1px solid var(--border)', padding: '13px 0',
      display: 'flex', gap: 14,
    }}>
      <div style={{ width: 90, flexShrink: 0, fontSize: 12, color: 'var(--text3)', paddingTop: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, flex: 1, lineHeight: 1.6,
        color: highlight || 'var(--text)' }}>{value}</div>
    </div>
  ) : null

  return (
    <div style={{ padding: 16 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}>← 뒤로</button>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{c.name}</div>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>{c.phone}</div>
        </div>
        <span className={`badge badge-${c.category}`} style={{ fontSize: 14, padding: '6px 14px' }}>
          {c.category || '미분류'}
        </span>
      </div>

      <div className="card">
        <Row label="문의일"
          value={c.inquiryDate ? `${c.inquiryDate}${c.inquiryDay ? ` (${c.inquiryDay})` : ''}` : ''} />
        <Row label="나이 / 성별"
          value={[c.age, c.gender].filter(Boolean).join(' / ')} />
        <Row label="관계" value={c.relation} />
        <Row label="진단예약일"
          value={c.diagDate ? `${c.diagDate}${c.diagDay ? ` (${c.diagDay})` : ''}` : ''}
          highlight="var(--orange)" />
        <Row label="진단시간" value={c.diagTime} />
        <Row label="진단결과" value={c.diagResult} />
        <Row label="특징" value={c.feature} />
      </div>

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }}
          onClick={() => navigate(`/input/${c.id}`)}>✏️ 수정</button>
        {!confirm ? (
          <button className="btn btn-danger" style={{ flex: 1 }}
            onClick={() => setConfirm(true)}>🗑 삭제</button>
        ) : (
          <div style={{ flex: 1, display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}
              onClick={() => setConfirm(false)}>취소</button>
            <button className="btn btn-danger btn-sm" style={{ flex: 1 }}
              onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제중' : '확인'}
            </button>
          </div>
        )}
      </div>

      {/* 전화 + 문자 버튼 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        {c.phone && (
          <a href={`tel:${c.phone}`} style={{ textDecoration: 'none', flex: 1 }}>
            <button className="btn btn-ghost btn-full"
              style={{ color: 'var(--green)', borderColor: 'rgba(52,201,126,0.4)' }}>
              📞 전화하기
            </button>
          </a>
        )}
        {c.phone && (
          <button className="btn btn-ghost" style={{
            flex: 1, color: 'var(--accent)', borderColor: 'rgba(79,126,248,0.4)',
          }} onClick={() => setShowSms(true)}>
            📱 문자보내기
          </button>
        )}
      </div>

      {/* 문자 발송 모달 */}
      {showSms && (
        <SmsModal consult={c} onClose={() => setShowSms(false)} />
      )}
    </div>
  )
}
