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

  const add = useCallback(async (data) => {
    await addConsult(data)
    await load()
  }, [load])

  const update = useCallback(async (data) => {
    await updateConsult(data)
    await load()
  }, [load])

  const remove = useCallback(async (id) => {
    await deleteConsult(id)
    setConsults(prev => prev.filter(c => c.id !== id))
  }, [])

  return (
    <AppContext.Provider value={{ consults, loading, error, load, add, update, remove }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
