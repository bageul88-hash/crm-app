import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { OPTIONS } from '../api/sheets'
import SmsModal from '../components/SmsModal'
import { saveContactMemo } from '../hooks/useContacts'
import dayjs from 'dayjs'

const DAY_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

const LESSON_CATEGORY_STATUS = ['예약', '수업중']
const LESSON_RESULT_STATUS = ['예약', '등록', '수업중']

const DAY_OPTIONS = [
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
  '일요일',
]

const TIME_OPTIONS = [
  '오전 9:00',
  '오전 9:30',
  '오전 10:00',
  '오전 10:30',
  '오전 11:00',
  '오전 11:30',
  '오후 12:00',
  '오후 12:30',
  '오후 1:00',
  '오후 1:30',
  '오후 2:00',
  '오후 2:30',
  '오후 3:00',
  '오후 3:30',
  '오후 4:00',
  '오후 4:30',
  '오후 5:00',
  '오후 5:30',
  '오후 6:00',
  '오후 6:30',
  '오후 7:00',
  '오후 7:30',
  '오후 8:00',
  '오후 8:30',
  '오후 9:00',
]

function normalizeDate(value) {
  if (!value) return ''

  const str = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  const clean = str.replace(/[^0-9]/g, '')
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }

  return ''
}

function getDay(dateStr) {
  const dateValue = normalizeDate(dateStr)
  if (!dateValue) return ''

  const [y, m, d] = dateValue.split('-').map(Number)
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

function shouldShowLessonFields(form) {
  return (
    LESSON_CATEGORY_STATUS.includes(form.category) ||
    LESSON_RESULT_STATUS.includes(form.diagResult) ||
    form.category === '수업중' ||
    form.diagResult === '수업중'
  )
}

function cleanPhone(value) {
  return String(value || '').replace(/[^0-9]/g, '')
}

function normalizeTime(value) {
  if (!value) return ''

  const str = String(value).trim()

  if (str.includes('오전') || str.includes('오후')) {
    return str.replace(/\s+/g, ' ')
  }

  const match = str.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return str

  const hour = Number(match[1])
  const minute = match[2]

  if (hour === 0) return `오전 12:${minute}`
  if (hour < 12) return `오전 ${hour}:${minute}`
  if (hour === 12) return `오후 12:${minute}`

  return `오후 ${hour - 12}:${minute}`
}

const EMPTY = {
  category: '',
  name: '',
  inquiryDate: dayjs().format('YYYY-MM-DD'),
  inquiryDay: getDay(dayjs().format('YYYY-MM-DD')),
  age: '',
  gender: '',
  diagDate: '',
  diagDay: '',
  diagTime: '',
  diagResult: '',
  relation: '',
  customRelation: '',
  hasPhoto: '',
  lessonDate: '',
  lessonDay: '',
  lessonTime: '',
  feature: '',
  phone: '',
}

function Sel({ label, field, options, form, set, required }) {
  return (
    <div className="form-group">
      <label className="label">
        {label}
        {required && ' *'}
      </label>

      <select
        className="input"
        value={form[field] || ''}
        onChange={e => set(field, e.target.value)}
      >
        <option value="">선택</option>
        {options.map(o => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
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
  const [msg, setMsg] = useState('')
  const [smsConsult, setSmsConsult] = useState(null)
  const [contactMsg, setContactMsg] = useState('')

  const showLessonFields = shouldShowLessonFields(form)

  useEffect(() => {
    if (!isEdit) return

    const found = consults.find(c => String(c.id) === String(id))
    if (!found) return

    const isPresetRelation = OPTIONS.relation.includes(found.relation)

    const inquiryDate = normalizeDate(found.inquiryDate) || EMPTY.inquiryDate
    const diagDate = normalizeDate(found.diagDate)
    const lessonDate = normalizeDate(found.lessonDate)

    setForm({
      ...EMPTY,
      ...found,
      category: found.category || '',
      name: found.name || '',
      relation: isPresetRelation ? found.relation : found.relation ? '직접입력' : '',
      customRelation: isPresetRelation ? '' : found.relation || '',

      inquiryDate,
      inquiryDay: getDay(inquiryDate),

      diagDate,
      diagDay: getDay(diagDate),
      diagTime: normalizeTime(found.diagTime),
      diagResult: found.diagResult || '',

      lessonDate,
      lessonDay: lessonDate ? getDay(lessonDate) : found.lessonDay || '',
      lessonTime: normalizeTime(found.lessonTime),

      phone: cleanPhone(found.phone),
      feature: found.feature || '',
    })
  }, [id, consults, isEdit])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const phoneFromUrl = searchParams.get('phone')

    if (phoneFromUrl) {
      setForm(prev => ({ ...prev, phone: cleanPhone(phoneFromUrl) }))
    }
  }, [location.search])

  useEffect(() => {
    if (location.state?.phone) {
      setForm(prev => ({ ...prev, phone: cleanPhone(location.state.phone) }))
    }
  }, [location.state])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const set = (key, val) => {
    setForm(prev => {
      const next = {
        ...prev,
        [key]:
          key === 'phone'
            ? cleanPhone(val)
            : key === 'diagTime' || key === 'lessonTime'
              ? normalizeTime(val)
              : key === 'inquiryDate' || key === 'diagDate' || key === 'lessonDate'
                ? normalizeDate(val)
                : val,
      }

      if (key === 'inquiryDate') {
        next.inquiryDay = getDay(next.inquiryDate)
      }

      if (key === 'diagDate') {
        next.diagDay = getDay(next.diagDate)
      }

      if (key === 'lessonDate') {
        next.lessonDay = getDay(next.lessonDate)
      }

      if (key === 'relation' && val !== '직접입력') {
        next.customRelation = ''
      }

      if (key === 'diagResult' && val === '등록') {
        next.category = '수업중'
      }

      const lessonVisible = shouldShowLessonFields(next)

      if ((key === 'category' || key === 'diagResult') && !lessonVisible) {
        next.lessonDate = ''
        next.lessonDay = ''
        next.lessonTime = ''
      }

      return next
    })
  }

  const showContactMsg = (text) => {
    setContactMsg(text)
    setTimeout(() => setContactMsg(''), 4000)
  }

  const reset = () => {
    const today = dayjs().format('YYYY-MM-DD')

    setForm({
      ...EMPTY,
      inquiryDate: today,
      inquiryDay: getDay(today),
    })

    setMsg('')
  }

  const handleSubmit = () => {
    const phoneText = cleanPhone(form.phone)

    if (!phoneText) {
      setMsg('전화번호를 입력해주세요')
      return
    }

    const relationValue =
      form.relation === '직접입력'
        ? form.customRelation.trim()
        : form.relation

    const inquiryDate = normalizeDate(form.inquiryDate)
    const diagDate = normalizeDate(form.diagDate)
    const lessonVisible = shouldShowLessonFields(form)
    const lessonDate = lessonVisible ? normalizeDate(form.lessonDate) : ''

    const payload = {
      category: form.category || '',
      inquiryDate,
      inquiryDay: getDay(inquiryDate),

      age: form.age || '',
      gender: form.gender || '',
      name: form.name || '',

      diagDate,
      diagDay: getDay(diagDate),
      diagTime: normalizeTime(form.diagTime),
      diagResult: form.diagResult || '',

      relation: relationValue || '',
      hasPhoto: form.hasPhoto || '',

      lessonDate,
      lessonDay: lessonDate ? getDay(lessonDate) : '',
      lessonTime: lessonVisible ? normalizeTime(form.lessonTime) : '',

      feature: form.feature || '',
      phone: phoneText,
    }

    if (isEdit) {
      update({ ...payload, id: form.id || id })
      saveContactMemo(payload)
        .then(r => !r?.skipped && showContactMsg('✅ 연락처 메모 업데이트 완료'))
        .catch(() => showContactMsg('⚠️ 연락처 저장 실패'))
      navigate('/', { replace: true })
      return
    }

    const exists = consults.some(c => cleanPhone(c.phone) === phoneText)

    if (exists) {
      setMsg('❌ 이미 등록된 상담입니다. 기존 상담을 수정해주세요.')
      return
    }

    add(payload)
    saveContactMemo(payload)
      .then(r => !r?.skipped && showContactMsg('✅ 연락처 메모 저장 완료'))
      .catch(() => showContactMsg('⚠️ 연락처 저장 실패'))
    setSmsConsult(payload)
    reset()
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
        {isEdit ? '상담 수정' : '신규 상담 등록'}
      </h2>

      <div className="form-group">
        <label className="label">전화번호 *</label>
        <input
          className="input"
          type="tel"
          inputMode="numeric"
          placeholder="예: 01012345678"
          value={form.phone || ''}
          onChange={e => set('phone', e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sel
          label="구분"
          field="category"
          options={OPTIONS.category}
          form={form}
          set={set}
          required
        />

        <div className="form-group">
          <label className="label">이름</label>
          <input
            className="input"
            placeholder="이름"
            value={form.name || ''}
            onChange={e => set('name', e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="label">문의일</label>
          <input
            className="input"
            type="date"
            value={form.inquiryDate || ''}
            onChange={e => set('inquiryDate', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">문의요일</label>
          <input
            className="input"
            value={form.inquiryDay || ''}
            readOnly
            style={{ color: 'var(--text2)', cursor: 'default' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sel label="나이" field="age" options={OPTIONS.age} form={form} set={set} />
        <Sel label="남여" field="gender" options={OPTIONS.gender} form={form} set={set} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="label">진단예약일</label>
          <input
            className="input"
            type="date"
            value={form.diagDate || ''}
            onChange={e => set('diagDate', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">진단요일</label>
          <input
            className="input"
            value={form.diagDay || ''}
            readOnly
            style={{ color: 'var(--text2)', cursor: 'default' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sel
          label="진단예약시간"
          field="diagTime"
          options={TIME_OPTIONS}
          form={form}
          set={set}
        />

        <Sel
          label="진단결과"
          field="diagResult"
          options={OPTIONS.diagResult}
          form={form}
          set={set}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sel label="관계" field="relation" options={OPTIONS.relation} form={form} set={set} />
        <Sel label="사진" field="hasPhoto" options={['유', '무']} form={form} set={set} />
      </div>

      {form.relation === '직접입력' && (
        <div className="form-group">
          <label className="label">관계 직접입력</label>
          <input
            className="input"
            placeholder="관계를 직접 입력하세요"
            value={form.customRelation || ''}
            onChange={e => set('customRelation', e.target.value)}
          />
        </div>
      )}

      {showLessonFields && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">수업예약일</label>
              <input
                className="input"
                type="date"
                value={form.lessonDate || ''}
                onChange={e => set('lessonDate', e.target.value)}
              />
            </div>

            <Sel
              label="수업요일"
              field="lessonDay"
              options={DAY_OPTIONS}
              form={form}
              set={set}
            />
          </div>

          <Sel
            label="수업예약시간"
            field="lessonTime"
            options={TIME_OPTIONS}
            form={form}
            set={set}
          />
        </>
      )}

      <div className="form-group">
        <label className="label">특징</label>
        <textarea
          className="input"
          placeholder="특징 입력"
          value={form.feature || ''}
          onChange={e => set('feature', e.target.value)}
          onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
        />
      </div>

      {msg && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            marginBottom: 16,
            background: msg.startsWith('✅')
              ? 'rgba(52,201,126,0.1)'
              : 'rgba(240,69,69,0.1)',
            color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)',
            fontSize: 14,
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={reset}>
          초기화
        </button>

        <button
          className="btn btn-primary"
          style={{ flex: 2 }}
          onClick={handleSubmit}
        >
          {isEdit ? '수정 완료' : '저장 후 문자보내기'}
        </button>
      </div>

      {smsConsult && (
        <SmsModal
          consult={smsConsult}
          onClose={() => {
            setSmsConsult(null)
            navigate('/')
          }}
        />
      )}

      {contactMsg && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: contactMsg.startsWith('✅') ? '#16a34a' : '#d97706',
          color: '#fff', borderRadius: 12, padding: '12px 20px',
          fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          {contactMsg}
        </div>
      )}
    </div>
  )
}