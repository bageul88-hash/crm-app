import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { filterByTab } from '../api/sheets'
import SearchInput from '../components/SearchInput'
import dayjs from 'dayjs'

const SMS_TABS = ['예약', '문의', '수업중', '미등록', '연결', '펑크', '크레임', '환불', '가맹', '전체']

const RESULT_COLOR = {
  등록: 'var(--green)',
  미등록: 'var(--orange)',
  환불: 'var(--red)',
  가맹: 'var(--accent)',
  펑크: 'var(--pink)',
}

const MAX_DAYS = 1095
const TICKS = [
  { val: 30,   label: '1개월', showLabel: false },
  { val: 90,   label: '3개월', showLabel: false },
  { val: 180,  label: '6개월', showLabel: true  },
  { val: 365,  label: '1년',   showLabel: true  },
  { val: 730,  label: '2년',   showLabel: true  },
  { val: 1095, label: '3년',   showLabel: true  },
]

function fmtDays(d) {
  if (d === 0)    return '전체'
  if (d === 30)   return '1개월'
  if (d === 60)   return '2개월'
  if (d === 90)   return '3개월'
  if (d === 120)  return '4개월'
  if (d === 150)  return '5개월'
  if (d === 180)  return '6개월'
  if (d === 365)  return '1년'
  if (d === 730)  return '2년'
  if (d === 1095) return '3년'
  return `${d}일`
}

const TEMPLATES = [
  { key: 'studentReserve', label: '학생 진단·예약' },
  { key: 'generalReserve', label: '일반인 진단·예약' },
  { key: 'examReserve', label: '고시생 진단·예약' },
  { key: 'studentAsk', label: '학생 문의' },
  { key: 'generalAsk', label: '일반인 문의' },
  { key: 'examAsk', label: '고시생 문의' },
  { key: 'classing', label: '수업중 안내' },
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
  const schedule = `${date} ${day} ${time}`.trim()

  if (templateKey === 'studentReserve') {
    return `♤참바른글씨 진단테스트 예약

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

📅 예약일시
${schedule}

[준비물]
평소 사용하던 한글노트, 영어노트 또는 참고서 각 1권
필통 (필수)

[진단 안내]
테스트 → 진단 → 결과 상담 (당일 진행)
필체 및 습관 분석 포함
상담비: 10,000원 (약 40~50분)

📞 02-558-4111
🌐 pentwo.com

[오시는 길]
네비게이션: 한신인터밸리24 주차장 → 동관 3층 315호

[대중교통]
선릉역 2호선 4번 출구 → 직진 80m → 좌측
한신인터밸리24 3층 315호`
  }

  if (templateKey === 'generalReserve') {
    return `♤참바른글씨 진단테스트 예약

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

📅 예약일시
${schedule}

[진단 안내]
테스트 → 진단 → 결과 상담 (당일 진행)
필체 및 습관 분석 포함
상담비: 10,000원 (약 40~50분)

📞 02-558-4111
🌐 pentwo.com

[오시는 길]
네비게이션: 한신인터밸리24 주차장 → 동관 3층 315호

[대중교통]
선릉역 2호선 4번 출구 → 직진 80m → 좌측
한신인터밸리24 3층 315호`
  }

  if (templateKey === 'examReserve') {
    return `♤참바른글씨 진단테스트 예약

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

📅 예약일시
${schedule}

[준비물]
평상시 쓴 글씨 또는 필기한 모의고사 용지
평상시 쓰는 볼펜 또는 펜(필수*)

[진단 안내]
테스트 → 진단 → 결과 상담 (당일 진행)
필체 및 습관 분석 포함
상담비: 10,000원 (약 40~50분)

📞 02-558-4111
🌐 pentwo.com

[오시는 길]
네비게이션: 한신인터밸리24 주차장 → 동관 3층 315호

[대중교통]
선릉역 2호선 4번 출구 → 직진 80m → 좌측
한신인터밸리24 3층 315호`
  }

  if (templateKey === 'studentAsk') {
    return `♤ 참바른글씨 학생 상담 안내

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

♡ 상담 예약 필수 ♡

[진단 안내]
테스트 → 진단 → 결과 상담 (당일 진행)
필체 및 습관 분석 포함
상담비: 10,000원 (약 40~50분 소요)

[준비물]
평소 필기한 수학 참고서 1권
필통 (필수 지참)

📞 02-558-4111
🌐 pentwo.com

[오시는 길 안내]
네비게이션: 한신인터밸리24 주차장
→ 동관 3층 315호

🚇 대중교통
선릉역 2호선 4번 출구 → 직진 80m → 좌측
한신인터밸리24 3층 315호`
  }

  if (templateKey === 'generalAsk') {
    return `♤ 참바른글씨 상담 안내

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

♡ 상담 예약 필수 ♡

[진단 안내]
테스트 → 진단 → 결과 상담 (당일 진행)
필체 및 습관 분석 포함
상담비: 10,000원 (약 40~50분 소요)

📞 02-558-4111
🌐 pentwo.com

[오시는 길 안내]
네비게이션: 한신인터밸리24 주차장
→ 동관 3층 315호

🚇 대중교통
선릉역 2호선 4번 출구 → 직진 80m → 좌측
한신인터밸리24 3층 315호`
  }

  if (templateKey === 'examAsk') {
    return `♤참바른글씨 상담 안내

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

[준비물]
평상시 쓴 글씨 또는 필기한 모의고사 용지
평상시 쓰는 볼펜 또는 펜(필수*)

[진단 안내]
테스트 → 진단 → 결과 상담 (당일 진행)
필체 및 습관 분석 포함
상담비: 10,000원 (약 40~50분)

📞 02-558-4111
🌐 pentwo.com

[오시는 길]
네비게이션: 한신인터밸리24 주차장 → 동관 3층 315호

[대중교통]
선릉역 2호선 4번 출구 → 직진 80m → 좌측
한신인터밸리24 3층 315호`
  }

  if (templateKey === 'classing') {
    return `참바른글씨
첫수업 축하드립니다.
${name} 학생의 수업일정

기초-24회차(6개월)
집필
자세
손의힘
자.모음 조합

마무리-24회차(6개월)
줄의 높낮이
글씨크기 일관성
띄어쓰기
문장쓰기
영쓰기
숫자쓰기

성심을 다해 열심히 지도하겠습니다.

🌐 pentwo.com`
  }

  return `${name}님 안녕하세요. 상담 안내드립니다.`
}

export default function SMSPage() {
  const { consults } = useApp()

  const [activeTab, setActiveTab] = useState('전체')
  const [daysBefore, setDaysBefore] = useState(30)
  const [search, setSearch] = useState('')
  const [checkedIds, setCheckedIds] = useState(new Set())

  const [selectedTargets, setSelectedTargets] = useState([])
  const [templateKey, setTemplateKey] = useState('generalReserve')
  const [customText, setCustomText] = useState('')
  const [tabsExpanded, setTabsExpanded] = useState(false)

  const cutoff = useMemo(
    () => dayjs().subtract(daysBefore, 'day').format('YYYYMMDD'),
    [daysBefore]
  )

  const targets = useMemo(() => {
    let list = filterByTab(consults, activeTab)

    if (daysBefore) {
      list = list.filter(c => {
        if (!c.inquiryDate) return false
        const d = String(c.inquiryDate).replace(/-/g, '')
        return d >= cutoff
      })
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q)
      )
    }

    return [...list].sort((a, b) => b.id - a.id)
  }, [consults, activeTab, cutoff, daysBefore, search])

  // targets 변경 시 전체 체크로 초기화
  useEffect(() => {
    setCheckedIds(new Set(targets.map(c => c.id)))
  }, [targets])

  const checkedTargets = useMemo(
    () => targets.filter(c => checkedIds.has(c.id)),
    [targets, checkedIds]
  )

  const allChecked = targets.length > 0 && checkedIds.size === targets.length
  const someChecked = checkedIds.size > 0 && checkedIds.size < targets.length

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(targets.map(c => c.id)))
    }
  }

  const toggleOne = id => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const counts = useMemo(() => {
    const map = {}
    SMS_TABS.forEach(t => {
      map[t] = filterByTab(consults, t).length
    })
    return map
  }, [consults])

  const firstTarget = checkedTargets[0] ?? selectedTargets[0]
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
    window.location.href = `sms:${phones}?body=${encodeURIComponent(previewText)}`
  }

  const copyText = async () => {
    await navigator.clipboard.writeText(previewText)
    alert('문자 내용이 복사되었습니다.')
  }

  return (
    <div style={{ padding: 16 }}>
      <SearchInput value={search} onChange={setSearch} style={{ marginBottom: 12 }} />
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
        문자 발송 대상
      </h2>

      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
        조건에 맞는 고객 연락처를 추출합니다
      </p>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <div
          className="tab-wrap"
          style={{
            overflow: 'hidden',
            maxHeight: tabsExpanded ? 'none' : 42,
            paddingRight: 36,
          }}
        >
          {SMS_TABS.map(t => (
            <button
              key={t}
              className={`category-chip${activeTab === t ? ' active' : ''}`}
              onClick={() => setActiveTab(t)}
              style={{
                border: `1px solid ${activeTab === t ? '#60a5fa' : 'var(--border)'}`,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              {t}
              <span>{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setTabsExpanded(v => !v)}
          style={{
            position: 'absolute',
            top: 8,
            right: 0,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface)',
            cursor: 'pointer',
            fontSize: 11,
            transform: tabsExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ▼
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="label">최근 N일 이내 문의</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <input
              type="range"
              min={0}
              max={MAX_DAYS}
              value={daysBefore}
              onChange={e => setDaysBefore(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ position: 'relative', height: 28, marginTop: 2 }}>
              {TICKS.map(({ val, label, showLabel }) => {
                const pct = (val / MAX_DAYS) * 100
                const active = daysBefore >= val
                return (
                  <div key={val} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 2, height: 6, background: active ? 'var(--accent)' : '#d1d5db', borderRadius: 1 }} />
                    {showLabel && (
                      <span style={{ fontSize: 10, color: active ? 'var(--accent)' : 'var(--text3)', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap', marginTop: 2 }}>
                        {label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <span style={{ minWidth: 48, fontSize: 14, fontWeight: 600, color: 'var(--accent)', textAlign: 'right' }}>
            {fmtDays(daysBefore)}
          </span>
        </div>
      </div>

      {/* 전체 체크박스 + 카운트 + 문자보내기 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked }}
            onChange={toggleAll}
            style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            전체 선택&nbsp;
            <span style={{ color: 'var(--accent)' }}>{checkedIds.size}</span>
            <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/{targets.length}명</span>
          </span>
        </label>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => openSmsModal(checkedTargets)}
          disabled={checkedTargets.length === 0}
        >
          📩 문자보내기
        </button>
      </div>

      {/* 학생 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {targets.map(c => (
          <div
            key={c.id}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              opacity: checkedIds.has(c.id) ? 1 : 0.45,
            }}
          >
            {/* 개별 체크박스 */}
            <input
              type="checkbox"
              checked={checkedIds.has(c.id)}
              onChange={() => toggleOne(c.id)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
            />

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
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 10,
                    background: 'var(--surface)',
                    color: RESULT_COLOR[c.diagResult] || 'var(--text2)',
                    border: `1px solid ${RESULT_COLOR[c.diagResult] || 'var(--border)'}`,
                  }}>
                    {c.diagResult}
                  </span>
                )}
                {c.category && (
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 10,
                    background: 'var(--surface)', color: 'var(--text3)',
                    border: '1px solid var(--border)',
                  }}>
                    {c.category}
                  </span>
                )}
              </div>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, padding: '5px 10px', flexShrink: 0, color: 'var(--accent)', borderColor: 'var(--accent)' }}
              onClick={() => openSmsModal([c])}
              disabled={!c.phone}
            >
              📩
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

      {/* 문자 발송 모달 */}
      {selectedTargets.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, background: '#fff',
          zIndex: 999, padding: 16, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>문자 발송</h2>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                대상 {selectedTargets.length}명
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={closeSmsModal} style={{ fontSize: 18 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12 }}>
            {TEMPLATES.map(t => (
              <button
                key={t.key}
                onClick={() => { setTemplateKey(t.key); setCustomText('') }}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 20,
                  border: `1px solid ${templateKey === t.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: templateKey === t.key ? 'rgba(79,126,248,0.12)' : 'transparent',
                  color: templateKey === t.key ? 'var(--accent)' : 'var(--text2)',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="label">문자 내용</label>
          <textarea
            className="input"
            style={{ minHeight: 260, marginTop: 8, fontSize: 14, lineHeight: 1.6, color: 'var(--text2)' }}
            value={previewText}
            onChange={e => setCustomText(e.target.value)}
          />

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
            수신번호: {targetPhones.join(', ')}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={copyText}>내용 복사</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={sendSms}>📩 문자 보내기</button>
          </div>
        </div>
      )}
    </div>
  )
}
