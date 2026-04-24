import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import dayjs from 'dayjs'

const TOP_TABS = ['전체', '예약', '문의', '가맹']
const BOT_TABS = ['등록', '미등록', '문의만', '불가', '체결', '기타']

const RESULT_COLOR = {
  등록: 'var(--green)',
  미등록: 'var(--orange)',
  문의만: 'var(--purple)',
  불가: 'var(--red)',
  체결: 'var(--accent)',
  기타: 'var(--text2)',
}

const TEMPLATES = [
  { key: 'studentReserve', label: '학생 진단·예약' },
  { key: 'generalReserve', label: '일반인 진단·예약' },
  { key: 'studentAsk', label: '학생 문의' },
  { key: 'generalAsk', label: '일반인 문의' },
  { key: 'franchise', label: '가맹 문의' },
]

function fmtDate(val) {
  if (!val) return ''
  const str = String(val)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return str.slice(0, 10)
  return `${match[1]}-${match[2]}-${match[3]}`
}

function makeSmsBody(c, templateKey) {
  const name = c?.name || '고객님'
  const date = fmtDate(c?.diagDate)
  const day = c?.diagDay ? `(${c.diagDay})` : ''
  const time = c?.diagTime || ''

  if (templateKey === 'studentReserve') {
    return `${name} 학생 진단 예약 안내드립니다.

진단일: ${date} ${day}
시간: ${time}

예약 시간에 맞춰 방문 부탁드립니다.`
  }

  if (templateKey === 'generalReserve') {
    return `${name}님 진단 및 상담 예약 안내드립니다.

진단일: ${date} ${day}
시간: ${time}

예약 시간에 맞춰 방문 부탁드립니다.`
  }

  if (templateKey === 'studentAsk') {
    return `${name} 학생 문의 주셔서 감사합니다.

상담 가능 시간에 순차적으로 연락드리겠습니다.`
  }

  if (templateKey === 'generalAsk') {
    return `${name}님 문의 주셔서 감사합니다.

상담 가능 시간에 순차적으로 연락드리겠습니다.`
  }

  if (templateKey === 'franchise') {
    return `${name}님 가맹 문의 주셔서 감사합니다.

확인 후 담당자가 연락드리겠습니다.`
  }

  return `${name}님 안녕하세요. 상담 안내드립니다.`
}

export default function SMSPage() {
  const { consults } = useApp()

  const [topTab, setTopTab] = useState('전체')
  const [botTab, setBotTab] = useState(null)
  const [daysBefore, setDaysBefore] = useState(30)

  const [selectedTargets, setSelectedTargets] = useState([])
  const [templateKey, setTemplateKey] = useState('generalReserve')
  const [customText, setCustomText] = useState('')

  const cutoff = useMemo(
    () => dayjs().subtract(daysBefore, 'day').format('YYYYMMDD'),
    [daysBefore]
  )

  const topFiltered = useMemo(() => {
    let list = consults

    if (topTab === '예약') {
      list = list.filter(c => c.category === '예약')
    } else if (topTab === '문의') {
      list = list.filter(c => c.category === '문의')
    } else if (topTab === '가맹') {
      list = list.filter(c => c.category === '가맹')
    }

    return list
  }, [consults, topTab])

  const targets = useMemo(() => {
    let list = topFiltered

    if (botTab) {
      list = list.filter(c => c.diagResult === botTab)
    }

    if (daysBefore) {
      list = list.filter(c => {
        if (!c.inquiryDate) return false
        const d = String(c.inquiryDate).replace(/-/g, '')
        return d >= cutoff
      })
    }

    return [...list].sort((a, b) => b.id - a.id)
  }, [topFiltered, botTab, cutoff, daysBefore])

  const counts = useMemo(() => {
    const map = {}

    map['전체'] = consults.length
    map['예약'] = consults.filter(c => c.category === '예약').length
    map['문의'] = consults.filter(c => c.category === '문의').length
    map['가맹'] = consults.filter(c => c.category === '가맹').length

    BOT_TABS.forEach(t => {
      map[t] = topFiltered.filter(c => c.diagResult === t).length
    })

    return map
  }, [consults, topFiltered])

  const firstTarget = selectedTargets[0]
  const previewText = customText || makeSmsBody(firstTarget, templateKey)
  const targetPhones = selectedTargets.map(c => c.phone).filter(Boolean)

  const openSmsModal = list => {
    setSelectedTargets(list.filter(c => c.phone))
    setTemplateKey('generalReserve')
    setCustomText('')
  }

  const closeSmsModal = () => {
    setSelectedTargets([])
    setCustomText('')
  }

  const sendSms = () => {
    if (targetPhones.length === 0) {
      alert('전화번호가 없습니다.')
      return
    }

    const phones = targetPhones.join(',')
    const body = encodeURIComponent(previewText)

    window.location.href = `sms:${phones}?body=${body}`
  }

  const copyText = async () => {
    await navigator.clipboard.writeText(previewText)
    alert('문자 내용이 복사되었습니다.')
  }

  const TabBtn = ({ label, count, active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '6px 12px',
        borderRadius: 20,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(79,126,248,0.12)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text2)',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'var(--font)',
      }}
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>
        {count ?? 0}
      </span>
    </button>
  )

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
        문자 발송 대상
      </h2>

      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
        조건에 맞는 고객 연락처를 추출합니다
      </p>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
        {TOP_TABS.map(t => (
          <TabBtn
            key={t}
            label={t}
            count={counts[t]}
            active={topTab === t}
            onClick={() => {
              setTopTab(t)
              setBotTab(null)
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
        {BOT_TABS.map(t => (
          <TabBtn
            key={t}
            label={t}
            count={counts[t]}
            active={botTab === t}
            onClick={() => setBotTab(botTab === t ? null : t)}
          />
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="label">최근 N일 이내 문의</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <input
            type="range"
            min={0}
            max={365}
            value={daysBefore}
            onChange={e => setDaysBefore(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span style={{ minWidth: 56, fontSize: 14, fontWeight: 600, color: 'var(--accent)', textAlign: 'right' }}>
            {daysBefore === 0 ? '전체' : `${daysBefore}일`}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          대상 <span style={{ color: 'var(--accent)' }}>{targets.length}명</span>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => openSmsModal(targets)}
          disabled={targets.length === 0}
        >
          📩 문자보내기
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {targets.map(c => (
          <div
            key={c.id}
            className="card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
                {c.name || '(이름없음)'}
              </div>

              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                {c.phone}
                {c.age ? ` • ${c.age}` : ''}
                {c.gender ? ` ${c.gender}` : ''}
                {c.relation ? ` • ${c.relation}` : ''}
              </div>

              {c.feature && (
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 6 }}>
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

              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {c.diagResult && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 10,
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
              </div>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 12,
                padding: '5px 10px',
                flexShrink: 0,
                color: 'var(--accent)',
                borderColor: 'var(--accent)',
              }}
              onClick={() => openSmsModal([c])}
              disabled={!c.phone}
            >
              📩 문자보내기
            </button>
          </div>
        ))}

        {targets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>
            <div style={{ fontSize: 14 }}>조건에 맞는 고객이 없습니다</div>
          </div>
        )}
      </div>

      {selectedTargets.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#fff',
            zIndex: 999,
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                문자 발송
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                대상 {selectedTargets.length}명
              </div>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={closeSmsModal}
              style={{ fontSize: 18 }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
            {TEMPLATES.map(t => (
              <button
                key={t.key}
                onClick={() => {
                  setTemplateKey(t.key)
                  setCustomText('')
                }}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: `1px solid ${templateKey === t.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: templateKey === t.key ? 'rgba(79,126,248,0.12)' : 'transparent',
                  color: templateKey === t.key ? 'var(--accent)' : 'var(--text2)',
                  fontSize: 13,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="label">문자 내용</label>
          <textarea
            className="input"
            style={{
              minHeight: 260,
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text2)',
            }}
            value={previewText}
            onChange={e => setCustomText(e.target.value)}
          />

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
            수신번호: {targetPhones.join(', ')}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={copyText}
            >
              내용 복사
            </button>

            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={sendSms}
            >
              📩 문자 보내기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}