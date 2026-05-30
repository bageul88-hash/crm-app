import { useState, useEffect } from 'react'

const CURRENT_VERSION = '26.05.31'
const GITHUB_API = 'https://api.github.com/repos/bageul88-hash/crm-app/releases/latest'
const DISMISSED_KEY = 'crm_dismissed_version'

function parseVersion(tag) {
  return String(tag || '').replace(/^v/, '')
}

function isNewer(remote, local) {
  const r = parseVersion(remote).split('.').map(Number)
  const l = parseVersion(local).split('.').map(Number)
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

    fetch(`${GITHUB_API}?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        const version = parseVersion(data?.tag_name)
        if (!version || !isNewer(version, CURRENT_VERSION)) return
        if (dismissed === version) return

        const apkAsset = (data.assets || []).find(a => a.name?.endsWith('.apk'))
        setUpdate({
          version,
          apkUrl: apkAsset?.browser_download_url || '',
          notes: data.body || '',
        })
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
