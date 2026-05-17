import { createContext, useContext, useState, useCallback } from 'react'
import {
  fetchConsults,
  addConsult,
  updateConsult,
  deleteConsult,
  cleanPhone,
} from '../api/sheets'
import { USERS } from '../auth/users'

const AppContext = createContext(null)

const USER_KEY = 'crm_user'
const CREDS_KEY = 'crm_credentials'
const PW_OVERRIDES_KEY = 'crm_pw_overrides'
const CACHE_KEY = 'crm_consults_cache'

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
}

function getEffectivePassword(userId) {
  try {
    const overrides = JSON.parse(localStorage.getItem(PW_OVERRIDES_KEY) || '{}')
    return overrides[userId] || null
  } catch {
    return null
  }
}

function getSavedUser() {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (raw) {
      const { id, password } = JSON.parse(raw)
      const user = USERS.find(u => u.id === id)
      if (!user) {
        localStorage.removeItem(CREDS_KEY)
        localStorage.removeItem(USER_KEY)
        return null
      }
      const effective = getEffectivePassword(id) || user.password
      if (effective === password) return user
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
  const [saveError, setSaveError] = useState(null)
  const [currentUser, setCurrentUser] = useState(getSavedUser)

  const login = useCallback((id, password) => {
    const user = USERS.find(u => u.id === id)
    if (!user) throw new Error('아이디 또는 비밀번호가 맞지 않습니다')

    const effective = getEffectivePassword(id) || user.password
    if (effective !== password) throw new Error('아이디 또는 비밀번호가 맞지 않습니다')

    localStorage.setItem(CREDS_KEY, JSON.stringify({ id, password }))
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setCurrentUser(user)
  }, [])

  const changePassword = useCallback((userId, currentPw, newPw) => {
    const user = USERS.find(u => u.id === userId)
    if (!user) throw new Error('아이디를 찾을 수 없습니다')

    const overrides = JSON.parse(localStorage.getItem(PW_OVERRIDES_KEY) || '{}')
    const effective = overrides[userId] || user.password
    if (effective !== currentPw) throw new Error('현재 비밀번호가 맞지 않습니다')
    if (newPw.length < 4) throw new Error('새 비밀번호는 4자 이상이어야 합니다')

    overrides[userId] = newPw
    localStorage.setItem(PW_OVERRIDES_KEY, JSON.stringify(overrides))

    // 로그인 유지 정보도 새 비밀번호로 업데이트 (새로고침 시 로그아웃 방지)
    try {
      const savedRaw = localStorage.getItem(CREDS_KEY)
      if (savedRaw) {
        const saved = JSON.parse(savedRaw)
        if (saved.id === userId) {
          localStorage.setItem(CREDS_KEY, JSON.stringify({ id: userId, password: newPw }))
        }
      }
    } catch {}
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(CREDS_KEY)
    localStorage.removeItem(USER_KEY)
    setCurrentUser(null)
  }, [])

  // 전체 새로고침: 캐시 즉시 표시 → 백그라운드 갱신
  const load = useCallback(async () => {
    const cached = loadCache()
    if (cached) {
      setConsults(cached)   // 캐시 즉시 표시 (스피너 없음)
    } else {
      setLoading(true)      // 첫 실행 시만 스피너
    }
    setError(null)
    try {
      const data = await fetchConsults()
      setConsults(data)
      saveCache(data)
    } catch (e) {
      if (!cached) setError(e.message || '데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  // 백그라운드 재동기화 (스피너 없음)
  const silentSync = useCallback(async () => {
    try {
      const data = await fetchConsults()
      setConsults(data)
      saveCache(data)
    } catch (_) { /* 백그라운드 실패는 무시 */ }
  }, [])

  const showSaveError = useCallback((msg) => {
    setSaveError(msg)
    setTimeout(() => setSaveError(null), 5000)
  }, [])

  // 낙관적 추가: UI 즉시 반영 → 백그라운드 API → 성공 시 ID 재동기화
  const add = useCallback(async data => {
    const payload = {
      ...data,
      branchId: currentUser?.branchId || data.branchId || '',
      branchName: currentUser?.branchName || data.branchName || '',
    }

    const tempId = `temp_${Date.now()}`
    const optimisticItem = {
      id: tempId,
      ...payload,
      phone: cleanPhone(payload.phone),
      savedAt: new Date().toISOString().slice(0, 10),
    }

    setConsults(prev => [...prev, optimisticItem])

    addConsult(payload)
      .then(() => silentSync())
      .catch(() => {
        setConsults(prev => prev.filter(c => c.id !== tempId))
        showSaveError('저장에 실패했습니다. 다시 시도해주세요.')
      })
  }, [currentUser, silentSync, showSaveError])

  // 낙관적 수정: UI 즉시 반영 → 백그라운드 API → 실패 시 롤백
  const update = useCallback(async data => {
    const payload = {
      ...data,
      branchId: currentUser?.branchId || data.branchId || '',
      branchName: currentUser?.branchName || data.branchName || '',
    }

    let originalItem = null
    setConsults(prev => {
      originalItem = prev.find(c => c.id === data.id)
      return prev.map(c =>
        c.id === data.id
          ? { ...c, ...payload, phone: cleanPhone(payload.phone) }
          : c
      )
    })

    updateConsult(payload).catch(() => {
      setConsults(prev =>
        prev.map(c => (c.id === data.id && originalItem ? originalItem : c))
      )
      showSaveError('수정 저장에 실패했습니다. 다시 시도해주세요.')
    })
  }, [currentUser, showSaveError])

  // 낙관적 삭제: UI 즉시 반영 → 백그라운드 API → 실패 시 복구
  const remove = useCallback(async id => {
    let removed = null
    setConsults(prev => {
      removed = prev.find(c => c.id === id)
      return prev.filter(c => c.id !== id)
    })

    deleteConsult(id)
      .then(() => silentSync()) // 삭제 후 row 번호 재동기화
      .catch(() => {
        setConsults(prev => {
          if (!removed) return prev
          return [...prev, removed].sort((a, b) => Number(a.id) - Number(b.id))
        })
        showSaveError('삭제에 실패했습니다. 다시 시도해주세요.')
      })
  }, [silentSync, showSaveError])

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
        changePassword,
        consults: visibleConsults,
        allConsults: consults,
        loading,
        error,
        saveError,
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
