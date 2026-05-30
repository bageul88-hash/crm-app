import { useState, useEffect, useMemo, useCallback } from 'react'

function toEntry(raw) { return typeof raw === 'string' ? { name: raw, time: null, phone: null } : raw }

function normPhone(p) { return String(p || '').replace(/\D/g, '') }

function loadRawRecords() {
  try {
    const raw = localStorage.getItem('attendance_records')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function useAttendanceTotals() {
  const [rawRecords, setRawRecords] = useState(loadRawRecords)

  useEffect(() => {
    const refresh = () => setRawRecords(loadRawRecords())
    const onStorage = (e) => { if (!e.key || e.key === 'attendance_records') refresh() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('smsAttendance', refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('smsAttendance', refresh)
    }
  }, [])

  // 이름만으로 집계 (하위 호환 — 기존 코드에서 totals[name] 형태로 사용)
  const totals = useMemo(() => {
    const map = {}
    Object.values(rawRecords).forEach(list => {
      ;(list || []).map(toEntry).forEach(e => {
        if (e?.name) map[e.name] = (map[e.name] || 0) + 1
      })
    })
    return map
  }, [rawRecords])

  // 이름 + 전화번호 + 입학일 기준 정확한 횟수 반환
  const getFilteredCount = useCallback((name, phone, fromDate) => {
    const np = normPhone(phone)
    const fromStr = fromDate ? String(fromDate).replace(/-/g, '') : null
    let count = 0
    Object.entries(rawRecords).forEach(([date, list]) => {
      ;(list || []).map(toEntry).forEach(e => {
        if (e.name !== name) return
        const ep = normPhone(e.phone)
        if (np && ep) {
          if (ep === np) count++           // 전화번호 일치: 포함
        } else if (np && !ep && fromStr) {
          if (date >= fromStr) count++     // 구 기록(전화번호 없음): 입학일 이후만 포함
        } else {
          count++
        }
      })
    })
    return count
  }, [rawRecords])

  return { totals, getFilteredCount }
}
