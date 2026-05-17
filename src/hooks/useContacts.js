import { Capacitor, registerPlugin } from '@capacitor/core'

export function buildContactMemo(payload) {
  const lines = ['[참바른글씨 CRM]']
  if (payload.phone)      lines.push(`전화: ${payload.phone}`)
  if (payload.category)   lines.push(`구분: ${payload.category}`)
  if (payload.name)       lines.push(`이름: ${payload.name}`)
  if (payload.inquiryDate) lines.push(`문의일: ${payload.inquiryDate.replace(/-/g, '.')}`)
  if (payload.inquiryDay)  lines.push(`문의요일: ${payload.inquiryDay}`)
  if (payload.age)         lines.push(`나이: ${payload.age}`)
  if (payload.gender)      lines.push(`남녀: ${payload.gender}`)
  if (payload.diagDate)    lines.push(`진단예약일: ${payload.diagDate.replace(/-/g, '.')}`)
  if (payload.diagDay)     lines.push(`진단요일: ${payload.diagDay}`)
  if (payload.diagTime)    lines.push(`진단예약시간: ${payload.diagTime}`)
  if (payload.diagResult)  lines.push(`진단결과: ${payload.diagResult}`)
  if (payload.relation)    lines.push(`관계: ${payload.relation}`)
  if (payload.hasPhoto)    lines.push(`사진: ${payload.hasPhoto}`)
  if (payload.feature)     lines.push(`특징: ${payload.feature}`)
  return lines.join('\n')
}

export async function saveContactMemo(payload) {
  if (!Capacitor.isNativePlatform()) return { skipped: true }

  const ContactsPlugin = registerPlugin('ContactsPlugin')
  const memo = buildContactMemo(payload)
  const name = payload.name || payload.phone || ''

  return ContactsPlugin.saveContact({ phone: payload.phone, name, memo })
}
