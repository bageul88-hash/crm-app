import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.static(join(__dirname, 'dist')))

// SPA 라우팅 폴백 — React Router가 모든 경로를 처리
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`CRM server listening on port ${PORT}`)
})

// Render 슬립 방지 — 5분마다 자기 자신에게 ping
const SELF_URL = 'https://crm-app-sj7m.onrender.com'
setInterval(() => {
  fetch(SELF_URL).catch(() => {})
}, 5 * 60 * 1000)
