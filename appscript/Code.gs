// ──────────────────────────────────────────────
// 상담 CRM - Apps Script API
// 시트 이름: 상담DB
// ──────────────────────────────────────────────
var SHEET_NAME = '상담DB'

// A=구분  B=문의일  C=문의요일  D=나이  E=남여  F=이름
// G=진단예약일  H=진단요일  I=진단예약시간  J=진단결과  K=관계  L=특징  M=전화번호
// N=원본  O=저장시각  P=지사ID  Q=지사명  R=수업예약일  S=수업요일  T=수업시간  U=수업자료
var COLS = {
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
  branchId:    15,
  branchName:  16,
  lessonDate:  17,
  lessonDay:   18,
  lessonTime:  19,
  hasPhoto:    20,
}

var TOTAL_COLS = 21

// 날짜 셀 컬럼 인덱스 (Date 객체 → 문자열 변환 대상)
var DATE_COLS = [
  COLS.inquiryDate,
  COLS.diagDate,
  COLS.savedAt,
  COLS.lessonDate,
]

// ──────────────────────────────────────────────
// GET: 전체 데이터 반환
// ──────────────────────────────────────────────
function doGet(e) {
  var result
  try {
    var action = (e && e.parameter && e.parameter.action) || 'getAll'
    if (action === 'getAll') result = getAllRows()
    else result = { error: 'Unknown action: ' + action }
  } catch (err) {
    result = { error: err.message }
  }
  return jsonResponse(result)
}

// ──────────────────────────────────────────────
// POST: 추가 / 수정 / 삭제
// ──────────────────────────────────────────────
function doPost(e) {
  var result
  try {
    var data = JSON.parse(e.postData.contents)
    if (data.action === 'add')    result = addRow(data)
    else if (data.action === 'update') result = updateRow(data)
    else if (data.action === 'delete') result = deleteRow(data.id)
    else result = { error: 'Unknown action: ' + data.action }
  } catch (err) {
    result = { error: err.message }
  }
  return jsonResponse(result)
}

// ──────────────────────────────────────────────
// 전체 조회 (헤더 행 제외)
// Date 객체를 'Asia/Seoul' 기준 YYYY-MM-DD 문자열로 변환하여 반환
// ──────────────────────────────────────────────
function getAllRows() {
  var sheet = getSheet()
  var last = sheet.getLastRow()
  if (last < 2) return { data: [], total: 0 }

  var raw = sheet.getRange(2, 1, last - 1, TOTAL_COLS).getValues()

  var data = raw.map(function(row) {
    return row.map(function(val, idx) {
      // Date 객체 → 문자열 (연도 왜곡 방지)
      if (val instanceof Date) {
        if (DATE_COLS.indexOf(idx) !== -1) {
          return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd')
        }
        return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
      }
      return val
    })
  })

  return { data: data, total: data.length }
}

// ──────────────────────────────────────────────
// 추가
// ──────────────────────────────────────────────
function addRow(data) {
  var sheet = getSheet()
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')

  var source = (data.category || '') + ' ' + (data.inquiryDate || '') + ' ' +
               (data.inquiryDay || '') + ' ' + (data.name || '')

  var row = new Array(TOTAL_COLS).fill('')
  row[COLS.category]    = data.category    || ''
  row[COLS.inquiryDate] = data.inquiryDate || ''
  row[COLS.inquiryDay]  = data.inquiryDay  || ''
  row[COLS.age]         = data.age         || ''
  row[COLS.gender]      = data.gender      || ''
  row[COLS.name]        = data.name        || ''
  row[COLS.diagDate]    = data.diagDate    || ''
  row[COLS.diagDay]     = data.diagDay     || ''
  row[COLS.diagTime]    = data.diagTime    || ''
  row[COLS.diagResult]  = data.diagResult  || ''
  row[COLS.relation]    = data.relation    || ''
  row[COLS.feature]     = data.feature     || ''
  row[COLS.phone]       = data.phone       || ''
  row[COLS.source]      = source
  row[COLS.savedAt]     = now
  row[COLS.branchId]    = data.branchId    || ''
  row[COLS.branchName]  = data.branchName  || ''
  row[COLS.lessonDate]  = data.lessonDate  || ''
  row[COLS.lessonDay]   = data.lessonDay   || ''
  row[COLS.lessonTime]  = data.lessonTime  || ''
  row[COLS.hasPhoto]    = data.hasPhoto    || ''

  sheet.appendRow(row)
  return { success: true, savedAt: now }
}

// ──────────────────────────────────────────────
// 수정 (행 번호 id로 직접 접근)
// ──────────────────────────────────────────────
function updateRow(data) {
  var rowNum = parseInt(data.id)
  if (!rowNum || rowNum < 2) return { error: '유효하지 않은 행 번호: ' + data.id }

  var sheet = getSheet()
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')

  // 날짜는 문자열 그대로 저장 (Date 객체 생성 금지 — 연도 왜곡 원인)
  sheet.getRange(rowNum, COLS.category    + 1).setValue(data.category    || '')
  sheet.getRange(rowNum, COLS.inquiryDate + 1).setValue(data.inquiryDate || '')
  sheet.getRange(rowNum, COLS.inquiryDay  + 1).setValue(data.inquiryDay  || '')
  sheet.getRange(rowNum, COLS.age         + 1).setValue(data.age         || '')
  sheet.getRange(rowNum, COLS.gender      + 1).setValue(data.gender      || '')
  sheet.getRange(rowNum, COLS.name        + 1).setValue(data.name        || '')
  sheet.getRange(rowNum, COLS.diagDate    + 1).setValue(data.diagDate    || '')
  sheet.getRange(rowNum, COLS.diagDay     + 1).setValue(data.diagDay     || '')
  sheet.getRange(rowNum, COLS.diagTime    + 1).setValue(data.diagTime    || '')
  sheet.getRange(rowNum, COLS.diagResult  + 1).setValue(data.diagResult  || '')
  sheet.getRange(rowNum, COLS.relation    + 1).setValue(data.relation    || '')
  sheet.getRange(rowNum, COLS.feature     + 1).setValue(data.feature     || '')
  sheet.getRange(rowNum, COLS.phone       + 1).setValue(data.phone       || '')
  sheet.getRange(rowNum, COLS.savedAt     + 1).setValue(now)
  sheet.getRange(rowNum, COLS.branchId    + 1).setValue(data.branchId    || '')
  sheet.getRange(rowNum, COLS.branchName  + 1).setValue(data.branchName  || '')
  sheet.getRange(rowNum, COLS.lessonDate  + 1).setValue(data.lessonDate  || '')
  sheet.getRange(rowNum, COLS.lessonDay   + 1).setValue(data.lessonDay   || '')
  sheet.getRange(rowNum, COLS.lessonTime  + 1).setValue(data.lessonTime  || '')
  sheet.getRange(rowNum, COLS.hasPhoto    + 1).setValue(data.hasPhoto    || '')

  return { success: true }
}

// ──────────────────────────────────────────────
// 삭제 (행 번호 id로 직접 접근)
// ──────────────────────────────────────────────
function deleteRow(id) {
  var rowNum = parseInt(id)
  if (!rowNum || rowNum < 2) return { error: '유효하지 않은 행 번호: ' + id }
  var sheet = getSheet()
  sheet.deleteRow(rowNum)
  return { success: true }
}

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + SHEET_NAME)
  return sheet
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}
