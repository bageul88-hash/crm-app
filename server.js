import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import attendanceRouter from './routes/attendance.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json({ limit: '32kb' }))
app.use(attendanceRouter)

// 텔레그램 알림 프록시 — 토큰은 Render 환경변수(TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)에서 읽음
app.post('/api/telegram-notify', async (req, res) => {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    return res.status(503).json({ ok: false, error: 'telegram not configured' })
  }
  const text = String(req.body?.text || '').slice(0, 4000)
  if (!text) return res.status(400).json({ ok: false, error: 'empty text' })
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    res.status(r.ok ? 200 : 502).json({ ok: r.ok })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

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
