// 알리고 SMS — Vercel 서버리스 프록시를 통해 발송 (CORS 없음)
// API 키는 Vercel 환경변수에서 관리 (클라이언트에 노출 안 됨)
const SMS_PROXY = 'https://crm-app.vercel.app/api/send-sms'

export const ALIGO_CONFIGURED = true  // 서버사이드 처리라 항상 활성화

export async function sendSmsAligo({ receivers, msg }) {
  const res = await fetch(SMS_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receivers, msg }),
  })

  const data = await res.json()

  if (!res.ok) throw new Error(data.error || '발송 실패')

  return { sent: data.sent ?? 0, total: data.total ?? 0 }
}
