import { createContext, useContext, useState, useCallback } from 'react'
import {
  fetchConsults,
  addConsult,
  updateConsult,
  deleteConsult,
} from '../api/sheets'
import { USERS } from '../auth/users'

const AppContext = createContext(null)

const USER_KEY = 'crm_user'
const CREDS_KEY = 'crm_credentials'

function getSavedUser() {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (raw) {
      const { id, password } = JSON.parse(raw)
      const user = USERS.find(u => u.id === id && u.password === password)
      if (user) return user
      // 저장된 자격증명이 USERS와 맞지 않으면 초기화
      localStorage.removeItem(CREDS_KEY)
      localStorage.removeItem(USER_KEY)
      return null
    }
    return null
  } catch {
    localStorage.removeItem(CREDS_KEY)
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function AppProvider({ children }) {
  const [consults, setConsults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(getSavedUser)

  const login = useCallback((id, password) => {
    const user = USERS.find(u => u.id === id && u.password === password)

    if (!user) {
      throw new Error('아이디 또는 비밀번호가 맞지 않습니다')
    }

    localStorage.setItem(CREDS_KEY, JSON.stringify({ id, password }))
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setCurrentUser(user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(CREDS_KEY)
    localStorage.removeItem(USER_KEY)
    setCurrentUser(null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchConsults()
      setConsults(data)
    } catch (e) {
      setError(e.message || '데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(
    async data => {
      const payload = {
        ...data,
        branchId: currentUser?.branchId || data.branchId || '',
        branchName: currentUser?.branchName || data.branchName || '',
      }

      await addConsult(payload)
      await load()
    },
    [load, currentUser]
  )

  const update = useCallback(
    async data => {
      const payload = {
        ...data,
        branchId: currentUser?.branchId || data.branchId || '',
        branchName: currentUser?.branchName || data.branchName || '',
      }

      await updateConsult(payload)
      await load()
    },
    [load, currentUser]
  )

  const remove = useCallback(
    async id => {
      await deleteConsult(id)
      await load()
    },
    [load]
  )

  const visibleConsults =
    currentUser?.role === 'admin'
      ? consults
      : consults.filter(c => c.branchId === currentUser?.branchId)

  const removeDuplicates = useCallback(async () => {
    const seen = new Set()
    const duplicated = []

    const sorted = [...visibleConsults].sort(
      (a, b) => Number(b.id) - Number(a.id)
    )

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
  }, [visibleConsults, load])

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        consults: visibleConsults,
        allConsults: consults,
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
