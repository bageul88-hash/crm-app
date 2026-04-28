// ──────────────────────────────────────────────
// 상담 CRM - Apps Script API
// 시트 이름: 상담DB (하단 탭 이름과 정확히 일치해야 함)
// ──────────────────────────────────────────────
var SHEET_NAME = '상담DB'

// 실제 시트 열 순서 (A열=0, B열=1, ...)
// A=구분  B=문의일  C=문의요일  D=나이  E=남여  F=이름
// G=진단예약일  H=진단요일  I=진단예약시간  J=진단결과  K=관계  L=특징  M=전화번호
// N=원본  O=저장시각
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
}

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
  const data = JSON.parse(e.postData.contents)
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("상담DB")

  if (data.action === 'delete') {
    const rows = sheet.getDataRange().getValues()

    for (let i = rows.length - 1; i >= 1; i--) {
      const name = rows[i][5]     // 이름
      const phone = rows[i][12]   // 전화번호

      if (name === data.name && phone === data.phone) {
        sheet.deleteRow(i + 1)
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
  }
}

// ──────────────────────────────────────────────
// 전체 조회 (헤더 행 제외)
// ──────────────────────────────────────────────
function getAllRows() {
  var sheet = getSheet()
  var last = sheet.getLastRow()
  if (last < 2) return { data: [], total: 0 }
  var data = sheet.getRange(2, 1, last - 1, 15).getValues()
  return { data: data, total: data.length }
}

// ──────────────────────────────────────────────
// 추가 (appendRow + 원본·저장시각 자동 기록)
// ──────────────────────────────────────────────
function addRow(data) {
  var sheet = getSheet()
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')

  // 원본 텍스트 (기존 Apps Script 방식과 동일하게 생성)
  var source = (data.category || '') + ' ' + (data.inquiryDate || '') + ' ' +
               (data.inquiryDay || '') + ' ' + (data.name || '')

  var row = [
    data.category    || '',
    data.inquiryDate || '',
    data.inquiryDay  || '',
    data.age         || '',
    data.gender      || '',
    data.name        || '',
    data.diagDate    || '',
    data.diagDay     || '',
    data.diagTime    || '',
    data.diagResult  || '',
    data.relation    || '',
    data.feature     || '',
    data.phone       || '',
    source,   // N: 원본
    now,      // O: 저장시각
  ]
  sheet.appendRow(row)
  return { success: true, savedAt: now }
}

// ──────────────────────────────────────────────
// 수정 (행 번호 id로 직접 접근)
// ──────────────────────────────────────────────
function updateRow(data) {
  var rowNum = parseInt(data.id)  // id = 실제 시트 행 번호
  if (!rowNum || rowNum < 2) return { error: '유효하지 않은 행 번호: ' + data.id }

  var sheet = getSheet()
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')

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
