import { useState, useEffect } from 'react'

function toEntry(raw) { return typeof raw === 'string' ? { name: raw } : raw }

function computeTotals() {
  try {
    const raw = localStorage.getItem('attendance_records')
    if (!raw) return {}
    const records = JSON.parse(raw)
    const map = {}
    Object.values(records).forEach(list => {
      ;(list || []).map(toEntry).forEach(e => {
        if (e?.name) map[e.name] = (map[e.name] || 0) + 1
      })
    })
    return map
  } catch {
    return {}
  }
}

export function useAttendanceTotals() {
  const [totals, setTotals] = useState(computeTotals)

  useEffect(() => {
    const refresh = () => setTotals(computeTotals())
    const onStorage = (e) => { if (!e.key || e.key === 'attendance_records') refresh() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('smsAttendance', refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('smsAttendance', refresh)
    }
  }, [])

  return totals
}
