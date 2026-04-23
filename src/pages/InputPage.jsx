import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { OPTIONS } from '../api/sheets'
import SmsModal from '../components/SmsModal'
import dayjs from 'dayjs'

const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']
function getDay(dateStr) {
  if (!dateStr) return ''
  const clean = String(dateStr).replace(/-/g, '')
  if (clean.length === 8) {
    const d = new Date(`${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`)
    return isNaN(d) ? '' : DAY_KR[d.getDay()]
  }
  return ''
}

const EMPTY = {
  category: '', name: '',
  inquiryDate: dayjs().format('YYYY-MM-DD'),
  inquiryDay: DAY_KR[new Date().getDay()],
  age: '', gender: '',
  diagDate: '', diagDay: '',
  diagTime: '', diagResult: '',
  relation: '', feature: '', phone: '',
}

function Sel({ label, field, options, form, set, required }) {
  return (
    <div className="form-group">
      <label className="label">{label}{required && ' *'}</label>
      <select className="input" value={form[field]} onChange={e => set(field, e.target.value)}>
        <option value="">선택</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function InputPage() {
  const { consults, add, update } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [smsConsult, setSmsConsult] = useState(null) // 저장 완료 후 문자 모달용

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (isEdit) {
      const found = consults.find(c => String(c.id) === String(id))
      if (found) setForm({ ...EMPTY, ...found })
    }
  }, [id, consults, isEdit])

  // 통화 종료 후 자동 진입: 전화번호 자동 입력
  useEffect(() => {
    if (location.state?.phone) {
      setForm(prev => ({ ...prev, phone: location.state.phone }))
    }
  }, [location.state])

  const set = (key, val) => {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'inquiryDate') next.inquiryDay = getDay(val)
      if (key === 'diagDate')    next.diagDay    = getDay(val)
      return next
    })
  }

  const reset = () => setForm(EMPTY)

  const handleSubmit = async () => {
    if (!form.name.trim())  { setMsg('이름을 입력해주세요'); return }
    if (!form.phone.trim()) { setMsg('전화번호를 입력해주세요'); return }
    setSaving(true); setMsg('')
    try {
      if (isEdit) {
        await update(form)
        setMsg('✅ 수정되었습니다')
        setTimeout(() => navigate('/'), 800)
      } else {
        await add(form)
        // 저장 완료 → 문자 발송 모달 열기
        setSmsConsult({ ...form })
        reset()
      }
    } catch (e) {
      setMsg('❌ ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
        {isEdit ? '상담 수정' : '신규 상담 등록'}
      </h2>

      {/* 구분 + 이름 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sel label="구분" field="category" options={OPTIONS.category} form={form} set={set} required />
        <div className="form-group">
          <label className="label">이름 *</label>
          <input className="input" placeholder="이름" value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
      </div>

      {/* 문의일 + 문의요일 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="label">문의일</label>
          <input className="input" type="date" value={form.inquiryDate}
            onChange={e => set('inquiryDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">문의요일</label>
          <input className="input" value={form.inquiryDay} readOnly
            style={{ color: 'var(--text2)', cursor: 'default' }} />
        </div>
      </div>

      {/* 나이 + 남여 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sel label="나이" field="age" options={OPTIONS.age} form={form} set={set} />
        <Sel label="남여" field="gender" options={OPTIONS.gender} form={form} set={set} />
      </div>

      {/* 진단예약일 + 진단요일 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="label">진단예약일</label>
          <input className="input" type="date" value={form.diagDate}
            onChange={e => set('diagDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">진단요일</label>
          <input className="input" value={form.diagDay} readOnly
            style={{ color: 'var(--text2)', cursor: 'default' }} />
        </div>
      </div>

      {/* 진단예약시간 + 진단결과 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sel label="진단예약시간" field="diagTime" options={OPTIONS.diagTime} form={form} set={set} />
        <Sel label="진단결과"     field="diagResult" options={OPTIONS.diagResult} form={form} set={set} />
      </div>

      {/* 관계 */}
      <Sel label="관계" field="relation" options={OPTIONS.relation} form={form} set={set} />

      {/* 특징 */}
      <div className="form-group">
        <label className="label">특징</label>
        <textarea className="input" placeholder="특징 입력" value={form.feature}
          onChange={e => set('feature', e.target.value)} />
      </div>

      {/* 전화번호 */}
      <div className="form-group">
        <label className="label">전화번호 *</label>
        <input className="input" type="tel" placeholder="예: 01012345678"
          value={form.phone} onChange={e => set('phone', e.target.value)} />
      </div>

      {msg && (
        <div style={{
          padding: '12px 14px', borderRadius: 8, marginBottom: 16,
          background: msg.startsWith('✅') ? 'rgba(52,201,126,0.1)' : 'rgba(240,69,69,0.1)',
          color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)',
          fontSize: 14,
        }}>{msg}</div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={reset}>초기화</button>
        <button className="btn btn-primary" style={{ flex: 2 }}
          onClick={handleSubmit} disabled={saving}>
          {saving ? '저장 중...' : isEdit ? '수정 완료' : '저장 후 문자보내기'}
        </button>
      </div>

      {/* 저장 완료 후 문자 발송 모달 */}
      {smsConsult && (
        <SmsModal
          consult={smsConsult}
          onClose={() => { setSmsConsult(null); navigate('/') }}
        />
      )}
    </div>
  )
}
