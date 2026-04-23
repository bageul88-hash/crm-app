// ✅ Apps Script 배포 URL
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby_fo8D01dOjagXck2-zOhNwQldcrabM6qGKathR7aetZlxG4NBmqztZ84YHaYztBgs/exec'
// 실제 시트 열 순서
// A=구분  B=문의일  C=문의요일  D=나이  E=남여  F=이름
// G=진단예약일  H=진단요일  I=진단예약시간  J=진단결과  K=관계  L=특징  M=전화번호
// N=원본  O=저장시각
export const FIELD_MAP = {
  category:    0,
  inquiryDate: 1,
  inquiryDay:  2,
  age:         3,
  gender:      4,
  name:        5,
  diagDate:    6,
  diagDay:     7,
  diagTime:    8,
  diagResult:  9,
  relation:    10,
  feature:     11,
  phone:       12,
  source:      13,
  savedAt:     14,
}

export const CATEGORY_TABS = ['전체', '예약', '문의', '가맹', '기타']

export const OPTIONS = {
  category: ['예약', '문의', '가맹', '기타'],
  age: Array.from({ length: 75 }, (_, i) => `${i + 6}세`),
  gender: ['남', '여'],
  diagTime: [
    '오전 8:00','오전 8:30','오전 9:00','오전 9:30',
    '오전 10:00','오전 10:30','오전 11:00','오전 11:30',
    '오후 12:00','오후 12:30',
    '오후 1:00','오후 1:30','오후 2:00','오후 2:30',
    '오후 3:00','오후 3:30','오후 4:00','오후 4:30',
    '오후 5:00','오후 5:30','오후 6:00',
  ],
  diagResult: ['등록', '미등록', '불가'],
  relation: ['어머니', '아버지', '일반남', '일반여', '할머니', '할아버지', '직접입력'],
}

export async function fetchConsults() {
  const res = await fetch(`${APPS_SCRIPT_URL}?action=getAll`)
  if (!res.ok) throw new Error('데이터를 불러오지 못했습니다')
  const json = await res.json()
  const rows = json.data || json || []
  return rows.map((row, i) => ({ id: i + 2, ...rowToObject(row) }))
}

export async function addConsult(data) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'add', ...data }),
  })
  if (!res.ok) throw new Error('저장에 실패했습니다')
  return res.json()
}

export async function updateConsult(data) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', ...data }),
  })
  if (!res.ok) throw new Error('수정에 실패했습니다')
  return res.json()
}

export async function deleteConsult(id) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id }),
  })
  if (!res.ok) throw new Error('삭제에 실패했습니다')
  return res.json()
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
    obj[key] = val
  }
  return obj
}