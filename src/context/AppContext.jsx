import { createContext, useContext, useState, useCallback } from 'react'
import { fetchConsults, addConsult, updateConsult, deleteConsult } from '../api/sheets'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [consults, setConsults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchConsults()
      setConsults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(async data => {
    await addConsult(data)
    await load()
  }, [load])

  const update = useCallback(async data => {
    await updateConsult(data)
    await load()
  }, [load])

const remove = useCallback(async id => {
  await deleteConsult(id)
  await load()
}, [load])

  // 중복 상담 자동 제거
  // 기준: 전화번호 + 이름이 같은 경우, 최신 id 1개만 남기고 나머지 삭제
  const removeDuplicates = useCallback(async () => {
    const seen = new Set()
    const duplicated = []

    const sorted = [...consults].sort((a, b) => Number(b.id) - Number(a.id))

    for (const c of sorted) {
      const phone = String(c.phone || '').replace(/\D/g, '').trim()
      const name = String(c.name || '').trim()

      if (!phone || !name) continue

      const key = `${phone}-${name}`

      if (seen.has(key)) {
        duplicated.push(c)
      } else {
        seen.add(key)
      }
    }

    for (const item of duplicated) {
      await deleteConsult(item.id)
    }

    await load()

    return duplicated.length
  }, [consults, load])

  return (
    <AppContext.Provider
      value={{
        consults,
        loading,
        error,
        load,
        add,
        update,
        remove,
        removeDuplicates,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)