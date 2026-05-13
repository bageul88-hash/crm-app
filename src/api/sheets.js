// ✅ Apps Script 배포 URL
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzEqb1D0byiP1ctmKSq2dV9c-CZCerJkL3LyBsV-fSiB1yvSj_vCQLTIsHb3O3Z5rHw/exec'
  

// 실제 시트 열 순서
export const FIELD_MAP = {
  category: 0,
  inquiryDate: 1,
  inquiryDay: 2,
  age: 3,
  gender: 4,
  name: 5,
  diagDate: 6,
  diagDay: 7,
  diagTime: 8,
  diagResult: 9,
  relation: 10,
  feature: 11,
  phone: 12,
  source: 13,
  savedAt: 14,
  branchId: 15,
  branchName: 16,
  lessonDate: 17,
  lessonDay: 18,
  lessonTime: 19,
}

export const CATEGORY_TABS = ['전체', '예약', '문의', '수업중', '수업종료', '핑크', '환불', '미등록', '연결']

const DIAG_ONLY_TABS = ['핑크', '환불', '미등록', '연결', '기타']

export function filterByTab(list, tab) {
  if (tab === '전체') return list
  if (tab === '수업중') return list.filter(c => c.category === '수업중' || c.diagResult === '등록')
  if (tab === '핑크')   return list.filter(c => c.diagResult === '핑크')
  if (tab === '환불')   return list.filter(c => c.diagResult === '환불')
  if (tab === '수업종료') return list.filter(c => c.category === '수업종료')
  if (tab === '미등록') return list.filter(c => c.diagResult === '미등록')
  if (tab === '연결')   return list.filter(c => c.diagResult === '연결')
  if (tab === '예약')   return list.filter(c => c.category === '예약' && !DIAG_ONLY_TABS.includes(c.diagResult))
  return list.filter(c => c.category === tab)
}

export const OPTIONS = {
  category: ['예약', '문의', '수업중', '수업종료'],
  age: Array.from({ length: 75 }, (_, i) => `${i + 6}세`),
  gender: ['남', '여'],
  diagTime: [
    '오전 8:00', '오전 8:30',
    '오전 9:00', '오전 9:30',
    '오전 10:00', '오전 10:30',
    '오전 11:00', '오전 11:30',
    '오후 12:00', '오후 12:30',
    '오후 1:00', '오후 1:30',
    '오후 2:00', '오후 2:30',
    '오후 3:00', '오후 3:30',
    '오후 4:00', '오후 4:30',
    '오후 5:00', '오후 5:30',
    '오후 6:00', '오후 6:30',
    '오후 7:00', '오후 7:30',
    '오후 8:00', '오후 8:30',
    '오후 9:00',
  ],
  diagResult: ['등록', '미등록', '연결', '핑크', '환불', '기타'],
  relation: ['어머니', '아버지', '일반남', '일반여', '할머니', '할아버지', '직접입력'],
}

export function cleanPhone(value) {
  let phone = String(value || '')
    .replace(/^'/, '')
    .replace(/[^0-9]/g, '')

  if (phone.length === 10 && phone[0] !== '0') {
    phone = '0' + phone
  }

  return phone
}

function phoneForSheet(value) {
  const phone = cleanPhone(value)
  return phone ? `'${phone}` : ''
}

function normalizeCategory(value) {
  if (value === '가맹') return '수업중'
  if (value === '연결') return ''
  return value || ''
}

function normalizeDiagResult(value) {
  if (value === '문의만') return '연결'
  if (value === '불가') return '기타'
  if (value === '체결') return '환불'
  return value || ''
}

function normalizeDateValue(value) {
  if (!value) return ''

  const str = String(value).trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  if (str.includes('T')) {
    return str.slice(0, 10)
  }

  const clean = str.replace(/[^0-9]/g, '')

  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }

  return str.slice(0, 10)
}

function normalizeTimeValue(value) {
  if (!value) return ''

  const str = String(value).trim()

  if (str.includes('오전') || str.includes('오후')) {
    return str.replace(/\s+/g, ' ')
  }

  const timeMatch = str.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const h = Number(timeMatch[1])
    const m = timeMatch[2]

    if (h === 0) return `오전 12:${m}`
    if (h < 12) return `오전 ${h}:${m}`
    if (h === 12) return `오후 12:${m}`

    return `오후 ${h - 12}:${m}`
  }

  return str
}

function normalizePayload(payload) {
  const next = { ...payload }

  if ('phone' in next) {
    next.phone = phoneForSheet(next.phone)
  }

  if ('category' in next) {
    next.category = normalizeCategory(next.category)
  }

  if ('diagResult' in next) {
    next.diagResult = normalizeDiagResult(next.diagResult)
  }

  if ('inquiryDate' in next) {
    next.inquiryDate = normalizeDateValue(next.inquiryDate)
  }

  if ('diagDate' in next) {
    next.diagDate = normalizeDateValue(next.diagDate)
  }

  if ('lessonDate' in next) {
    next.lessonDate = normalizeDateValue(next.lessonDate)
  }

  if ('diagTime' in next) {
    next.diagTime = normalizeTimeValue(next.diagTime)
  }

  if ('lessonTime' in next) {
    next.lessonTime = normalizeTimeValue(next.lessonTime)
  }

  return next
}

async function getFromSheet() {
  const res = await fetch(`${APPS_SCRIPT_URL}?action=getAll`)

  if (!res.ok) {
    throw new Error('데이터를 불러오지 못했습니다')
  }

  const json = await res.json()

  if (json.error) {
    throw new Error(json.error)
  }

  return json
}

async function postToSheet(payload, errorMessage) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(normalizePayload(payload)),
  })

  if (!res.ok) {
    throw new Error(errorMessage)
  }

  const json = await res.json()

  if (json.error) {
    throw new Error(json.error)
  }

  return json
}

export async function fetchConsults() {
  const json = await getFromSheet()
  const rows = json.data || []

  return rows.map((row, i) => ({
    id: i + 2,
    ...rowToObject(row),
  }))
}

export async function addConsult(data) {
  return postToSheet(
    {
      action: 'add',
      ...data,
    },
    '저장에 실패했습니다'
  )
}

export async function updateConsult(data) {
  return postToSheet(
    {
      action: 'update',
      ...data,
    },
    '수정에 실패했습니다'
  )
}

export async function deleteConsult(id) {
  return postToSheet(
    {
      action: 'delete',
      id,
    },
    '삭제에 실패했습니다'
  )
}

function rowToObject(row) {
  const obj = {}

  for (const [key, idx] of Object.entries(FIELD_MAP)) {
    let val = row[idx] ?? ''

    if (key === 'inquiryDate' || key === 'diagDate' || key === 'lessonDate' || key === 'savedAt') {
      val = normalizeDateValue(val)
    }

    if (key === 'diagTime' || key === 'lessonTime') {
      val = normalizeTimeValue(val)
    }

    if (key === 'phone') {
      val = cleanPhone(val)
    }

    if (key === 'category') {
      val = normalizeCategory(val)
    }

    if (key === 'diagResult') {
      val = normalizeDiagResult(val)
    }

    obj[key] = val
  }

  return obj
}