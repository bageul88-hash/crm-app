import { createContext, useContext, useState, useCallback } from 'react'
import {
  fetchConsults,
  addConsult,
  updateConsult,
  deleteConsult,
  cleanPhone,
  saveBranchConfig,
  deleteAllConfigRows,
} from '../api/sheets'
import { USERS } from '../auth/users'

const AppContext = createContext(null)

const USER_KEY = 'crm_user'
const CREDS_KEY = 'crm_credentials'
const PW_OVERRIDES_KEY = 'crm_pw_overrides'
const BRANCH_OVERRIDES_KEY = 'crm_branch_overrides'
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
  const [branchOverrides, setBranchOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BRANCH_OVERRIDES_KEY) || '{}') } catch { return {} }
  })

  const [consults, setConsults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(null)
  const [currentUser, setCurrentUser] = useState(getSavedUser)

  const login = useCallback((id, password) => {
    let user = USERS.find(u => u.id === id)
    if (!user) {
      for (const [origId, ov] of Object.entries(branchOverrides)) {
        if (ov.loginId === id) { user = USERS.find(u => u.id === origId); break }
      }
    }
    if (!user) throw new Error('아이디 또는 비밀번호가 맞지 않습니다')

    const effective = getEffectivePassword(user.id) || user.password
    if (effective !== password) throw new Error('아이디 또는 비밀번호가 맞지 않습니다')

    localStorage.setItem(CREDS_KEY, JSON.stringify({ id: user.id, password }))
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setCurrentUser(user)
  }, [branchOverrides])

  const adminSetPassword = useCallback((userId, newPw) => {
    if (currentUser?.role !== 'admin') throw new Error('관리자만 변경할 수 있습니다')
    const user = USERS.find(u => u.id === userId)
    if (!user) throw new Error('아이디를 찾을 수 없습니다')
    if (newPw.length < 4) throw new Error('비밀번호는 4자 이상이어야 합니다')
    const overrides = JSON.parse(localStorage.getItem(PW_OVERRIDES_KEY) || '{}')
    overrides[userId] = newPw
    localStorage.setItem(PW_OVERRIDES_KEY, JSON.stringify(overrides))
  }, [currentUser])

  const adminUpdateBranch = useCallback(async (branchId, { displayName, principalName, loginId, newPassword }) => {
    if (currentUser?.role !== 'admin') throw new Error('관리자만 변경할 수 있습니다')

    if (newPassword && newPassword.length < 4) throw new Error('비밀번호는 4자 이상이어야 합니다')

    const updated = {
      ...branchOverrides,
      [branchId]: {
        ...(branchOverrides[branchId] || {}),
        ...(displayName !== undefined && { displayName }),
        ...(principalName !== undefined && { principalName }),
        ...(loginId !== undefined && { loginId }),
      },
    }
    localStorage.setItem(BRANCH_OVERRIDES_KEY, JSON.stringify(updated))
    setBranchOverrides(updated)

    const ov = updated[branchId] || {}
    await saveBranchConfig(branchId, {
      displayName: ov.displayName || '',
      principalName: ov.principalName || '',
      loginId: ov.loginId || '',
    })

    if (newPassword) {
      const pwOvs = JSON.parse(localStorage.getItem(PW_OVERRIDES_KEY) || '{}')
      pwOvs[branchId] = newPassword
      localStorage.setItem(PW_OVERRIDES_KEY, JSON.stringify(pwOvs))
    }
  }, [currentUser, branchOverrides])

  const getEffectivePw = useCallback((userId) => {
    const user = USERS.find(u => u.id === userId)
    return getEffectivePassword(userId) || user?.password || ''
  }, [])

  const changePassword = useCallback((userId, currentPw, newPw) => {
    let user = USERS.find(u => u.id === userId)
    if (!user) {
      for (const [origId, ov] of Object.entries(branchOverrides)) {
        if (ov.loginId === userId) { user = USERS.find(u => u.id === origId); break }
      }
    }
    if (!user) throw new Error('아이디를 찾을 수 없습니다')

    const overrides = JSON.parse(localStorage.getItem(PW_OVERRIDES_KEY) || '{}')
    const effective = overrides[user.id] || user.password
    if (effective !== currentPw) throw new Error('현재 비밀번호가 맞지 않습니다')
    if (newPw.length < 4) throw new Error('새 비밀번호는 4자 이상이어야 합니다')

    overrides[user.id] = newPw
    localStorage.setItem(PW_OVERRIDES_KEY, JSON.stringify(overrides))

    // 로그인 유지 정보도 새 비밀번호로 업데이트 (새로고침 시 로그아웃 방지)
    try {
      const savedRaw = localStorage.getItem(CREDS_KEY)
      if (savedRaw) {
        const saved = JSON.parse(savedRaw)
        if (saved.id === user.id) {
          localStorage.setItem(CREDS_KEY, JSON.stringify({ id: user.id, password: newPw }))
        }
      }
    } catch {}
  }, [branchOverrides])

  const logout = useCallback(() => {
    localStorage.removeItem(CREDS_KEY)
    localStorage.removeItem(USER_KEY)
    setCurrentUser(null)
  }, [])

  // DB에서 받아온 branchConfig를 branchOverrides + currentUser 양쪽에 동기화
  const applyBranchConfig = useCallback((branchConfig) => {
    setBranchOverrides(prev => {
      const next = { ...prev, ...branchConfig }
      localStorage.setItem(BRANCH_OVERRIDES_KEY, JSON.stringify(next))
      return next
    })
    setCurrentUser(prev => {
      if (!prev?.branchId || !branchConfig[prev.branchId]) return prev
      const cfg = branchConfig[prev.branchId]
      return {
        ...prev,
        branchName: cfg.displayName || prev.branchName,
        name: cfg.principalName || prev.name,
      }
    })
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
      const { consults: data, branchConfig } = await fetchConsults()
      setConsults(data)
      saveCache(data)
      if (branchConfig && Object.keys(branchConfig).length > 0) {
        applyBranchConfig(branchConfig)
      }
    } catch (e) {
      if (!cached) setError(e.message || '데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  // 백그라운드 재동기화 (스피너 없음)
  const silentSync = useCallback(async () => {
    try {
      const { consults: data, branchConfig } = await fetchConsults()
      setConsults(data)
      saveCache(data)
      if (branchConfig && Object.keys(branchConfig).length > 0) {
        applyBranchConfig(branchConfig)
      }
    } catch (_) { /* 백그라운드 실패는 무시 */ }
  }, [])

  const showSaveError = useCallback((msg) => {
    setSaveError(msg)
    setTimeout(() => setSaveError(null), 5000)
  }, [])

  const showSaveSuccess = useCallback((msg) => {
    setSaveSuccess(msg)
    setTimeout(() => setSaveSuccess(null), 4000)
  }, [])

  // 낙관적 추가: UI 즉시 반영 → 캐시 저장 → 백그라운드 API → 실패 시 롤백
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

    setConsults(prev => {
      const next = [...prev, optimisticItem]
      saveCache(next)
      return next
    })

    addConsult(payload)
      .then(() => {
        showSaveSuccess('✅ 서버 저장 완료')
        silentSync()
      })
      .catch(() => {
        setConsults(prev => {
          const rolled = prev.filter(c => c.id !== tempId)
          saveCache(rolled)
          return rolled
        })
        showSaveError('저장에 실패했습니다. 다시 시도해주세요.')
      })
  }, [currentUser, silentSync, showSaveSuccess, showSaveError])

  // 낙관적 수정: UI 즉시 반영 → 백그라운드 API → 성공 시 캐시 동기화, 실패 시 롤백
  const update = useCallback(async data => {
    const payload = {
      ...data,
      branchId: currentUser?.branchId || data.branchId || '',
      branchName: currentUser?.branchName || data.branchName || '',
    }

    let originalItem = null
    setConsults(prev => {
      originalItem = prev.find(c => c.id === data.id)
      const next = prev.map(c =>
        c.id === data.id
          ? { ...c, ...payload, phone: cleanPhone(payload.phone) }
          : c
      )
      saveCache(next)
      return next
    })

    updateConsult(payload)
      .then(() => showSaveSuccess('✅ 서버 저장 완료'))
      .catch(err => {
        setConsults(prev => {
          const rolled = prev.map(c => (c.id === data.id && originalItem ? originalItem : c))
          saveCache(rolled)
          return rolled
        })
        showSaveError(`❌ 수정 저장 실패: ${err?.message || '네트워크 오류'}`)
      })
  }, [currentUser, showSaveSuccess, showSaveError])

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

  // DB에서 __config__ 행 전체 삭제 후 현재 branchOverrides를 새 행으로 재저장
  const cleanupConfigRows = useCallback(async () => {
    if (currentUser?.role !== 'admin') throw new Error('관리자만 실행할 수 있습니다')
    const deletedCount = await deleteAllConfigRows()
    const saved = { ...branchOverrides }
    for (const [branchId, cfg] of Object.entries(saved)) {
      if (cfg.displayName || cfg.principalName || cfg.loginId) {
        await saveBranchConfig(branchId, {
          displayName: cfg.displayName || '',
          principalName: cfg.principalName || '',
          loginId: cfg.loginId || '',
        })
      }
    }
    return deletedCount
  }, [currentUser, branchOverrides])

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        changePassword,
        adminSetPassword,
        adminUpdateBranch,
        branchOverrides,
        getEffectivePw,
        consults: visibleConsults,
        allConsults: consults,
        loading,
        error,
        saveError,
        saveSuccess,
        load,
        silentSync,
        add,
        update,
        remove,
        removeDuplicates,
        cleanupConfigRows,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
