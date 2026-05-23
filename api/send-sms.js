// Vercel serverless function — 알리고 API 프록시
// 환경변수는 Vercel 대시보드 → Settings → Environment Variables 에서 설정
// ALIGO_USER_ID / ALIGO_API_KEY / ALIGO_SENDER

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { receivers, msg } = req.body ?? {}

  if (!receivers || !msg) {
    return res.status(400).json({ error: '수신번호와 메시지가 필요합니다' })
  }

  const userId  = process.env.ALIGO_USER_ID
  const apiKey  = process.env.ALIGO_API_KEY
  const sender  = process.env.ALIGO_SENDER

  if (!userId || !apiKey || !sender) {
    return res.status(500).json({ error: '알리고 환경변수가 설정되지 않았습니다' })
  }

  const phoneList = Array.isArray(receivers) ? receivers.join(',') : receivers
  const msgType   = msg.length > 90 ? 'LMS' : 'SMS'

  const params = new URLSearchParams()
  params.append('key',      apiKey)
  params.append('user_id',  userId)
  params.append('sender',   sender)
  params.append('receiver', phoneList)
  params.append('msg',      msg)
  params.append('msg_type', msgType)

  let aligoData
  try {
    const aligoRes = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: params,
    })
    aligoData = await aligoRes.json()
  } catch (e) {
    return res.status(502).json({ error: '알리고 서버 연결 실패' })
  }

  if (String(aligoData.result_code) !== '1') {
    return res.status(400).json({ error: aligoData.message || '발송 실패' })
  }

  res.status(200).json({
    sent:  aligoData.success_cnt ?? 0,
    total: aligoData.msg_cnt     ?? 0,
  })
}
