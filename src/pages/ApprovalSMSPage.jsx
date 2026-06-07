import { useState, useEffect } from 'react'

const STORAGE_KEY = 'attendance_students'
const DEFAULT_SCHEDULE = '2026-06-13 (토요일) 오전 11:00'

const TABS = [
  { key: 'msg01', label: '문자01' },
  { key: 'general', label: '일반인 진단·예약' },
  { key: 'exam', label: '고시' },
]

function buildTemplate(key, student, schedule) {
  const name = student?.name || '고객님'

  if (key === 'msg01') {
    return `✏️참바른글씨 진단테스트 예약

🏆 대한민국 최대 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

📅 예약일시
${schedule}`
  }

  if (key === 'general') {
    return `안녕하세요, 참바른글씨입니다 😊
${name}님 일반인 진단 예약이 아래와 같이 완료되었습니다.

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

📅 예약일시
${schedule}

✔ 원활한 진행을 위해
"확인" 또는 "참석합니다" 답장 부탁드립니다.
(미회신 시 예약이 취소될 수 있습니다)

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

  if (key === 'exam') {
    return `안녕하세요, 참바른글씨입니다 😊
${name}님 예약이 아래와 같이 완료되었습니다.

🏆 대한민국 최다 방송사 소개
📚 『또박또박 예쁜글씨(길벗)』 14만부 판매 저자
🏫 전국 17곳 캠퍼스 / 강남 선릉 본사 대표 직강

📅 예약일시
${schedule}

✔ 원활한 진행을 위해
"확인" 또는 "참석합니다" 답장 부탁드립니다.
(미회신 시 예약이 취소될 수 있습니다)

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

  return ''
}

export default function ApprovalSMSPage() {
  const [students, setStudents] = useState([])
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('msg01')
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setStudents(JSON.parse(saved)) } catch { setStudents([]) }
    }
  }, [])

  const bodyText = editing ? editText : buildTemplate(activeTab, selected, schedule)

  const openDetail = (student) => {
    setSelected(student)
    setActiveTab('msg01')
    setEditing(false)
    setEditText('')
    setSchedule(DEFAULT_SCHEDULE)
  }

  const closeDetail = () => {
    setSelected(null)
    setEditing(false)
  }

  const startEdit = () => {
    setEditText(bodyText)
    setEditing(true)
  }

  const changeTab = (key) => {
    setActiveTab(key)
    setEditing(false)
    setEditText('')
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(bodyText)
      alert('클립보드에 복사되었습니다.')
    } catch {
      alert('복사 실패. 텍스트를 직접 선택해주세요.')
    }
  }

  const sendSms = () => {
    const phone = selected?.phone
    if (!phone) {
      alert('전화번호가 없습니다.\n출석관리 탭 > 학생 관리에서 전화번호를 등록해주세요.')
      return
    }
    const body = encodeURIComponent(bodyText)
    window.location.href = `sms:${phone}?body=${body}`
  }

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allChecked = students.length > 0 && students.every(s => checkedIds.has(s.id))
  const toggleAll = () =>
    setCheckedIds(allChecked ? new Set() : new Set(students.map(s => s.id)))

  // ── 상세(문자 작성) 화면 ──
  if (selected) {
    return (
      <div className="fade-in" style={{ padding: 16 }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 10, marginBottom: 20,
        }}>
          <button className="btn btn-ghost btn-sm" onClick={closeDetail}
            style={{ fontSize: 18, padding: '4px 10px' }}>←</button>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>결재 문자</h2>
        </div>

        {/* 탭 */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          paddingBottom: 4, marginBottom: 16,
        }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => changeTab(t.key)} style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 20,
              border: `1.5px solid ${activeTab === t.key ? 'var(--accent)' : 'var(--border)'}`,
              background: activeTab === t.key ? 'rgba(79,126,248,0.12)' : 'transparent',
              color: activeTab === t.key ? 'var(--accent)' : 'var(--text3)',
              fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* 예약일시 입력 (문자01 탭) */}
        {activeTab === 'msg01' && (
          <div style={{ marginBottom: 12 }}>
            <label className="label">📅 예약일시</label>
            <input className="input" value={schedule}
              onChange={e => setSchedule(e.target.value)}
              placeholder="예: 2026-06-13 (토요일) 오전 11:00"
              style={{ marginTop: 6 }} />
          </div>
        )}

        {/* 문자 내용 */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>문자 내용</span>
            <button className="btn btn-ghost btn-sm" onClick={startEdit}
              style={{ fontSize: 12, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
              ✏️ 수정
            </button>
          </div>
          {editing ? (
            <textarea className="input" value={editText}
              onChange={e => setEditText(e.target.value)}
              style={{ minHeight: 240, fontSize: 13, lineHeight: 1.75, resize: 'vertical' }} />
          ) : (
            <pre style={{
              fontSize: 13, lineHeight: 1.75, color: 'var(--text2)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0, fontFamily: 'var(--font)',
            }}>{bodyText}</pre>
          )}
        </div>

        {/* 수신번호 */}
        <div style={{
          fontSize: 13, color: 'var(--text3)', marginBottom: 20,
          padding: '10px 14px', background: 'var(--surface)',
          borderRadius: 8, border: '1px solid var(--border)',
        }}>
          수신번호:{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {selected.phone || '(번호 없음)'}
          </span>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={copyText}>
            내용 복사
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={sendSms} disabled={!selected.phone}>
            📨 문자 보내기
          </button>
        </div>
      </div>
    )
  }

  // ── 목록 화면 ──
  return (
    <div className="fade-in" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>결재문자</h2>

      {/* 전체 선택 행 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'var(--surface)',
        borderRadius: 10, border: '1px solid var(--border)', marginBottom: 12,
      }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', fontSize: 14, fontWeight: 500,
        }}>
          <input type="checkbox" checked={allChecked} onChange={toggleAll}
            style={{ width: 17, height: 17, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          전체 선택
        </label>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>
          총 <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{students.length}</span>명
        </span>
      </div>

      {/* 학생 카드 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14 }}>출석관리 탭에서 학생을 추가해주세요</div>
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text3)' }}>
              학생 추가 시 전화번호도 함께 입력하세요
            </div>
          </div>
        ) : students.map(s => (
          <div key={s.id} className="card" style={{ padding: '12px 14px' }}>
            {/* 1행: 체크박스 + 이름 + 문자보내기 배지 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
            }}>
              <input type="checkbox" checked={checkedIds.has(s.id)}
                onChange={() => toggleCheck(s.id)}
                style={{
                  width: 17, height: 17, accentColor: 'var(--accent)',
                  cursor: 'pointer', flexShrink: 0,
                }} />
              <span style={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0 }}>
                {s.name}
              </span>
              <span
                onClick={() => openDetail(s)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
                  background: 'rgba(79,126,248,0.12)', color: 'var(--accent)',
                  border: '1px solid rgba(79,126,248,0.3)', fontWeight: 500,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                문자보내기
              </span>
            </div>

            {/* 2행: 전화번호 + 수정 버튼 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingLeft: 27, marginBottom: 4,
            }}>
              <span style={{
                fontSize: 13, color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                📱 {s.phone || '(번호 없음)'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => openDetail(s)}
                style={{ fontSize: 12, padding: '3px 10px', color: 'var(--text3)' }}>
                수정
              </button>
            </div>

            {/* 3행: 출석 횟수 */}
            <div style={{ paddingLeft: 27 }}>
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>
                총 {s.attendCount || 0}회 출석
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
