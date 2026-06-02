import { useState, useEffect, useRef } from 'react'

const ITEM_H = 48
const PAD = 2

const YEARS = Array.from({ length: 21 }, (_, i) => String(2015 + i))
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n) {
  return String(n).padStart(2, '0')
}

function parseDate(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null
  const [y, m, d] = str.split('-').map(Number)
  return { year: y, month: m, day: d }
}

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

// ── Drum-roll scroll picker ──────────────────────────────────────
function ScrollPicker({ items, value, onChange, suffix = '' }) {
  const ref = useRef()
  const timer = useRef()

  useEffect(() => {
    const idx = items.indexOf(String(value))
    if (idx < 0 || !ref.current) return
    requestAnimationFrame(() => {
      if (ref.current) ref.current.scrollTop = idx * ITEM_H
    })
  }, []) // mount only — user controls scroll after

  const onScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!ref.current) return
      const idx = Math.max(0, Math.min(Math.round(ref.current.scrollTop / ITEM_H), items.length - 1))
      ref.current.scrollTop = idx * ITEM_H
      onChange(items[idx])
    }, 150)
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* highlight bar at center */}
      <div style={{
        position: 'absolute',
        top: PAD * ITEM_H, left: 4, right: 4, height: ITEM_H,
        background: '#eff6ff',
        borderTop: '1.5px solid #bfdbfe',
        borderBottom: '1.5px solid #bfdbfe',
        borderRadius: 8,
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div
        ref={ref}
        onScroll={onScroll}
        style={{
          overflowY: 'scroll',
          height: (PAD * 2 + 1) * ITEM_H,
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {Array.from({ length: PAD }, (_, i) => (
          <div key={`t${i}`} style={{ height: ITEM_H }} />
        ))}
        {items.map(item => (
          <div
            key={item}
            style={{
              height: ITEM_H,
              scrollSnapAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, color: 'var(--text)',
            }}
          >
            {item}{suffix}
          </div>
        ))}
        {Array.from({ length: PAD }, (_, i) => (
          <div key={`b${i}`} style={{ height: ITEM_H }} />
        ))}
      </div>
    </div>
  )
}

// ── DatePicker ───────────────────────────────────────────────────
export default function DatePicker({ value, onChange, placeholder = '날짜 선택' }) {
  const now = new Date()
  const parsed = parseDate(value)

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1)
  const [mode, setMode] = useState('calendar') // 'calendar' | 'picker'
  const [pickerYear, setPickerYear] = useState(String(parsed?.year ?? now.getFullYear()))
  const [pickerMonth, setPickerMonth] = useState(String(parsed?.month ?? now.getMonth() + 1))

  function openModal() {
    const p = parseDate(value)
    const y = p?.year ?? now.getFullYear()
    const m = p?.month ?? now.getMonth() + 1
    setViewYear(y)
    setViewMonth(m)
    setPickerYear(String(y))
    setPickerMonth(String(m))
    setMode('calendar')
    setOpen(true)
  }

  function openYearMonthPicker() {
    setPickerYear(String(viewYear))
    setPickerMonth(String(viewMonth))
    setMode('picker')
  }

  function confirmPicker() {
    setViewYear(Number(pickerYear))
    setViewMonth(Number(pickerMonth))
    setMode('calendar')
  }

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day) {
    onChange(`${viewYear}-${pad(viewMonth)}-${pad(day)}`)
    setOpen(false)
  }

  // Calendar grid cells
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay()
  const dayCount = new Date(viewYear, viewMonth, 0).getDate()
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const tod = todayStr()
  const displayText = parsed
    ? `${parsed.year}년 ${parsed.month}월 ${parsed.day}일`
    : ''

  return (
    <>
      {/* Trigger */}
      <div
        className="input"
        onClick={openModal}
        style={{
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: displayText ? 'var(--text)' : 'var(--text3)',
          userSelect: 'none',
        }}
      >
        <span>{displayText || placeholder}</span>
        {value && (
          <span
            onClick={e => { e.stopPropagation(); onChange('') }}
            style={{ color: 'var(--text3)', fontSize: 16, lineHeight: 1, marginLeft: 6 }}
          >
            ✕
          </span>
        )}
      </div>

      {/* Bottom-sheet modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: '#fff', borderRadius: '20px 20px 0 0',
              overflow: 'hidden',
            }}
          >
            {mode === 'calendar' ? (
              <>
                {/* Month navigation header */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '12px 4px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <button type="button" onClick={prevMonth} style={NAV_BTN}>‹</button>
                  <button
                    type="button"
                    onClick={openYearMonthPicker}
                    style={{
                      flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 17, fontWeight: 700, color: 'var(--text)',
                    }}
                  >
                    {viewYear}년 {viewMonth}월
                  </button>
                  <button type="button" onClick={nextMonth} style={NAV_BTN}>›</button>
                </div>

                {/* Weekday labels */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                  padding: '8px 12px 0',
                }}>
                  {DAY_LABELS.map((lbl, i) => (
                    <div key={lbl} style={{
                      textAlign: 'center', fontSize: 12, fontWeight: 600, padding: '4px 0',
                      color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--text3)',
                    }}>
                      {lbl}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                  padding: '4px 12px 24px', gap: 2,
                }}>
                  {cells.map((day, idx) => {
                    if (!day) return <div key={`e${idx}`} />
                    const col = idx % 7
                    const ds = `${viewYear}-${pad(viewMonth)}-${pad(day)}`
                    const isSel = ds === value
                    const isTod = ds === tod
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => selectDay(day)}
                        style={{
                          height: 40, borderRadius: 8, border: 'none',
                          background: isSel ? 'var(--accent)' : isTod ? '#eff6ff' : 'transparent',
                          color: isSel ? '#fff'
                            : col === 0 ? '#ef4444'
                            : col === 6 ? '#3b82f6'
                            : 'var(--text)',
                          fontSize: 14,
                          fontWeight: isSel || isTod ? 700 : 400,
                          cursor: 'pointer',
                          outline: isTod && !isSel ? '1.5px solid var(--accent)' : 'none',
                          outlineOffset: -1,
                        }}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Year/Month picker header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'center',
                  fontSize: 16, fontWeight: 700,
                }}>
                  년도 · 월 선택
                </div>

                {/* Dual scroll pickers */}
                <div style={{ display: 'flex', padding: '8px 24px', gap: 8 }}>
                  <ScrollPicker
                    items={YEARS}
                    value={pickerYear}
                    onChange={setPickerYear}
                    suffix="년"
                  />
                  <ScrollPicker
                    items={MONTHS}
                    value={pickerMonth}
                    onChange={setPickerMonth}
                    suffix="월"
                  />
                </div>

                {/* Confirm button */}
                <div style={{ padding: '8px 20px 28px' }}>
                  <button
                    type="button"
                    onClick={confirmPicker}
                    style={{
                      width: '100%', padding: 14, borderRadius: 12, border: 'none',
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    확인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const NAV_BTN = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 28, color: 'var(--text2)', padding: '0 14px', lineHeight: 1,
}
