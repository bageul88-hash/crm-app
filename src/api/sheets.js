// ✅ Apps Script 배포 URL
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbym9Gen7mWXPrkHiD_fLLu5F9KCVZbPkdunrA_FlfO7nKr-E0FCpIzp5BwfkMy-VUDo/exec'

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
}

// 구분 탭: 기타/펑크 대신 연결
export const CATEGORY_TABS = ['전체', '예약', '문의', '가맹', '연결']

export const OPTIONS = {
  category: ['예약', '문의', '가맹', '연결'],
  age: Array.from({ length: 75 }, (_, i) => `${i + 6}세`),
  gender: ['남', '여'],
  diagTime: [
    '오전 8:00', '오전 8:30', '오전 9:00', '오전 9:30',
    '오전 10:00', '오전 10:30', '오전 11:00', '오전 11:30',
    '오후 12:00', '오후 12:30',
    '오후 1:00', '오후 1:30', '오후 2:00', '오후 2:30',
    '오후 3:00', '오후 3:30', '오후 4:00', '오후 4:30',
    '오후 5:00', '오후 5:30', '오후 6:00',
  ],
  diagResult: ['등록', '미등록', '연결', '불가', '체결', '펑크'],
  relation: ['어머니', '아버지', '일반남', '일반여', '할머니', '할아버지', '직접입력'],
}

function cleanPhone(value) {
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
  if (value === '기타') return '연결'
  if (value === '펑크') return '연결'
  return value || ''
}

function normalizeDiagResult(value) {
  if (value === '문의만') return '연결'
  if (value === '기타') return '펑크'
  return value || ''
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

    if (key !== 'diagTime' && typeof val === 'string' && val.includes('T')) {
      val = val.slice(0, 10)
    }

    if (key === 'diagTime' && typeof val === 'string' && val.includes('T')) {
      const t = new Date(val)
      const h = t.getUTCHours()
      const m = String(t.getUTCMinutes()).padStart(2, '0')
      const ampm = h < 12 ? '오전' : '오후'
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      val = `${ampm} ${h12}:${m}`
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