import { useState, useEffect } from 'react'

const CURRENT_VERSION = '1.0.0'
const VERSION_URL = 'https://crm-app.vercel.app/version.json'
const DISMISSED_KEY = 'crm_dismissed_version'

function isNewer(remote, local) {
  const r = remote.split('.').map(Number)
  const l = local.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true
    if ((r[i] || 0) < (l[i] || 0)) return false
  }
  return false
}

export function useUpdateCheck() {
  const [update, setUpdate] = useState(null)

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY)

    fetch(`${VERSION_URL}?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        if (data?.version && isNewer(data.version, CURRENT_VERSION)) {
          if (dismissed !== data.version) {
            setUpdate(data)
          }
        }
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    if (update?.version) {
      localStorage.setItem(DISMISSED_KEY, update.version)
    }
    setUpdate(null)
  }

  return { update, dismiss }
}

export { CURRENT_VERSION }
