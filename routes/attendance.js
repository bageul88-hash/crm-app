import { Router } from 'express'

const router = Router()
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL

router.post('/api/attendance', async (req, res) => {
  const { studentFolderName, attendDate } = req.body

  if (!studentFolderName || !attendDate) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'studentFolderName, attendDate 필수',
    })
  }

  if (!APPS_SCRIPT_URL) {
    return res.status(503).json({
      status: 'ERROR',
      message: 'APPS_SCRIPT_URL 환경변수 미설정',
    })
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentFolderName, attendDate }),
    })
    const result = await response.json()
    res.json(result)
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message })
  }
})

export default router
