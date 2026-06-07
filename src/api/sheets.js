// ✅ Apps Script 배포 URL
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxNjBhQIGO3d-Q7aLnjyL3wi6GjXNLmAWeHCoKILd_McfT81W9XHCL5rnTL7hJ-nYtx/exec'
  

// 실제 시트 열 순서 (A=0 ~ U=20)
// A~P(0~15) 고정, Q~U(16~20) 추가 열 — 운영 시트 "상담DB" 기준
export const FIELD_MAP = {
  category: 0,    // A 구분
  inquiryDate: 1, // B 문의일
  inquiryDay: 2,  // C 문의요일
  age: 3,         // D 나이
  gender: 4,      // E 남여
  name: 5,        // F 이름
  diagDate: 6,    // G 진단예약일
  diagDay: 7,     // H 진단요일
  diagTime: 8,    // I 진단예약시간
  diagResult: 9,  // J 진단결과
  relation: 10,   // K 관계
  feature: 11,    // L 특징
  phone: 12,      // M 전화번호
  source: 13,     // N 원본
  savedAt: 14,    // O 저장시각
  branchId: 15,   // P branchId
  hasPhoto: 16,   // Q 수업자료
  lessonDate: 17, // R 수업예약일
  lessonDay: 18,  // S 수업요일
  lessonTime: 19, // T 수업예약시간
  branchName: 20, // U branchName
}

export const CATEGORY_TABS = ['전체', '예약', '문의', '수업중', '수업종료', '핑크', '환불', '미등록', '연결', '가맹']

const DIAG_ONLY_TABS = ['펑크', '환불', '미등록', '연결', '가맹', '크레임']

export function filterByTab(list, tab) {
  if (!Array.isArray(list)) return []
  if (tab === '전체') return list
  if (tab === '수업중') return list.filter(c => (c.category === '수업중' || c.diagResult === '등록') && c.category !== '수업종료')
  if (tab === '펑크')   return list.filter(c => c.diagResult === '펑크')
  if (tab === '환불')   return list.filter(c => c.diagResult === '환불')
  if (tab === '크레임')  return list.filter(c => c.diagResult === '크레임' || c.category === '크레임')
  if (tab === '수업종료') return list.filter(c => c.category === '수업종료')
  if (tab === '미등록') return list.filter(c => c.diagResult === '미등록')
  if (tab === '연결')   return list.filter(c => c.diagResult === '연결')
  if (tab === '가맹')   return list.filter(c => c.diagResult === '가맹' || c.category === '가맹')
  if (tab === '재결재완료') return list.filter(c => c.diagResult === '재결재완료')
  if (tab === '수업자료') return list.filter(c => c.hasPhoto === '유')
  if (tab === '예약')   return list.filter(c => c.category === '예약' && !DIAG_ONLY_TABS.includes(c.diagResult))
  if (tab === '문의')   return list.filter(c => c.category === '문의' && !['연결', '미등록', '가맹', '크레임'].includes(c.diagResult))
  return list.filter(c => c.category === tab)
}

export const OPTIONS = {
  category: ['문의', '예약', '수업중', '수업종료'],
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
  diagResult: ['미등록', '등록', '재결재완료', '연결', '펑크', '크레임', '환불', '가맹'],
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
  if (value === '불가') return '가맹'
  if (value === '체결') return '환불'
  return value || ''
}

function normalizeDateValue(value) {
  if (!value) return ''

  // Date 객체 직접 처리 — toISOString() UTC 변환으로 인한 날짜/연도 왜곡 방지
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const str = String(value).trim()

  // 이미 정규 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // ISO 8601 (UTC 직렬화) — 타임존 오프셋으로 인한 날짜 편차 없이 로컬 날짜 추출
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.slice(0, 10)
  }

  // 숫자만 추출해 재조합
  const clean = str.replace(/[^0-9]/g, '')
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }

  return ''
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

  const branchConfig = {}
  const consults = rows
    .map((row, i) => ({ id: i + 2, ...rowToObject(row) }))
    .filter(item => {
      if (String(item.name ?? '').startsWith('__config__')) {
        const branchId = item.branchId || String(item.name).slice('__config__'.length)
        if (branchId) {
          try {
            const cfg = JSON.parse(item.feature || '{}')
            if (cfg && (cfg.displayName || cfg.principalName || cfg.loginId)) {
              branchConfig[branchId] = cfg
            }
          } catch {}
        }
        return false
      }
      return true
    })

  return { consults, branchConfig }
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

export async function deleteAllConfigRows() {
  const json = await getFromSheet()
  const rows = json.data || []
  const configIds = rows
    .map((row, i) => ({ id: i + 2, name: String(row[FIELD_MAP.name] ?? '') }))
    .filter(r => r.name.startsWith('__config__'))
    .map(r => r.id)
  for (const id of configIds) {
    await deleteConsult(id)
  }
  return configIds.length
}

export async function saveBranchConfig(branchId, { displayName, principalName, loginId }) {
  const feature = JSON.stringify({
    displayName: displayName ?? '',
    principalName: principalName ?? '',
    loginId: loginId ?? '',
  })

  // 기존 __config__ 행이 있으면 UPDATE, 없으면 ADD (upsert)
  const json = await getFromSheet()
  const rows = json.data || []
  const existing = rows
    .map((row, i) => ({ id: i + 2, name: String(row[FIELD_MAP.name] ?? '') }))
    .find(r => r.name === `__config__${branchId}`)

  if (existing) {
    return postToSheet(
      {
        action: 'update',
        id: existing.id,
        category: '문의',
        branchId,
        branchName: '',
        name: `__config__${branchId}`,
        feature,
      },
      '지사 정보 저장에 실패했습니다'
    )
  }

  return postToSheet(
    {
      action: 'add',
      category: '문의',
      branchId,
      branchName: '',
      name: `__config__${branchId}`,
      feature,
    },
    '지사 정보 저장에 실패했습니다'
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