/**
 * 참바른글씨 CRM - Google Apps Script
 *
 * 운영 시트: "상담DB" 탭 (이 이름의 탭에만 읽기/쓰기)
 * 열 매핑: 시트 1행(머리글)을 실시간으로 읽어 동적 결정 — 코드에 열 번호 고정 없음
 *
 * 실제 시트 머리글 기준:
 *  구분 | 문의일 | 문의요일 | 나이 | 남여 | 이름 | 진단예약일 | 진단요일 |
 *  진단예약시간 | 진단결과 | 관계 | 특징 | 전화번호 | 원본 | 저장시각 |
 *  branchId | 수업자료 | 수업예약일 | 수업요일 | 수업예약시간 | branchName
 */

// 시트 머리글 → CRM 필드명 매핑
var HEADER_TO_FIELD = {
  '구분':         'category',
  '문의일':       'inquiryDate',
  '문의요일':     'inquiryDay',
  '나이':         'age',
  '남여':         'gender',
  '이름':         'name',
  '진단예약일':   'diagDate',
  '진단요일':     'diagDay',
  '진단예약시간': 'diagTime',
  '진단결과':     'diagResult',
  '관계':         'relation',
  '특징':         'feature',
  '전화번호':     'phone',
  '원본':         'source',
  '저장시각':     'savedAt',
  'branchId':     'branchId',
  '수업자료':     'hasPhoto',
  '수업예약일':   'lessonDate',
  '수업요일':     'lessonDay',
  '수업예약시간': 'lessonTime',
  'branchName':   'branchName',
};

function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === 'getAll')        return getAllRows();
    if (action === 'searchByPhone') return searchByPhone(e.parameter.lastFour, e.parameter.branchId);
    return respond({ error: 'unknown action: ' + action });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    if (action === 'add')    return addRow(data);
    if (action === 'update') return updateRow(data);
    if (action === 'delete') return deleteRow(data);
    return respond({ error: 'unknown action: ' + action });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 반드시 "상담DB" 탭만 사용
function getSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  if (!sheet) throw new Error('"상담DB" 탭을 찾을 수 없습니다. 탭 이름을 확인해 주세요.');
  return sheet;
}

// 전화번호에서 숫자만 추출 (앞의 ' 제거 포함)
function cleanPhone(val) {
  var s = String(val || '').replace(/^'/, '').replace(/[^0-9]/g, '');
  if (s.length === 10 && s[0] !== '0') s = '0' + s;
  return s;
}

// 시트 1행 머리글 → { 머리글: 열인덱스(0-based) } 맵 반환
function buildHeaderMap(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (h) map[h] = i;
  }
  return map;
}

// 데이터를 시트 열 순서 배열로 변환 (머리글 기반 동적 매핑)
function makeRowArray(data, headerMap) {
  var colCount = Object.keys(headerMap).length;
  var row = new Array(colCount).fill('');

  for (var header in headerMap) {
    var fieldName = HEADER_TO_FIELD[header];
    if (!fieldName) continue; // 매핑 없는 열은 건드리지 않음

    var colIdx = headerMap[header];
    var val = data[fieldName];

    if (fieldName === 'savedAt' && !val) {
      val = new Date().toISOString().slice(0, 10);
    }

    row[colIdx] = (val !== undefined && val !== null) ? val : '';
  }

  return row;
}

// 전체 행 반환
function getAllRows() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return respond({ data: [] });

  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return respond({ data: values });
}

// 행 추가
function addRow(data) {
  var sheet = getSheet();
  var headerMap = buildHeaderMap(sheet);
  var row = makeRowArray(data, headerMap);
  sheet.appendRow(row);
  return respond({ status: 'OK', id: sheet.getLastRow() });
}

// 행 수정
function updateRow(data) {
  var sheet = getSheet();
  var rowNum = parseInt(data.id, 10);
  if (!rowNum || rowNum < 2) return respond({ error: 'invalid id: ' + data.id });

  var headerMap = buildHeaderMap(sheet);
  var row = makeRowArray(data, headerMap);
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  return respond({ status: 'OK' });
}

// 행 삭제
function deleteRow(data) {
  var sheet = getSheet();
  var rowNum = parseInt(data.id, 10);
  if (!rowNum || rowNum < 2) return respond({ error: 'invalid id: ' + data.id });

  sheet.deleteRow(rowNum);
  return respond({ status: 'OK' });
}

/**
 * 전화번호 뒷 4자리로 학생 검색 (공기계 출석체크 앱용)
 * GET ?action=searchByPhone&lastFour=1234&branchId=branch_pentwo
 * 반환: { success: true, name: "홍길동", parentPhone: "01099369388" }
 */
function searchByPhone(lastFour, branchId) {
  if (!lastFour || String(lastFour).length !== 4) {
    return respond({ success: false, error: 'lastFour 4자리 필수' });
  }

  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return respond({ success: false });

  var headerMap = buildHeaderMap(sheet);
  var phoneCol    = headerMap['전화번호'];
  var branchIdCol = headerMap['branchId'];
  var nameCol     = headerMap['이름'];

  if (phoneCol === undefined || nameCol === undefined) {
    return respond({ success: false, error: '머리글에서 전화번호/이름 열을 찾을 수 없습니다.' });
  }

  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var phone       = cleanPhone(row[phoneCol]);
    var rowBranchId = branchIdCol !== undefined ? String(row[branchIdCol] || '').trim() : '';
    var name        = String(row[nameCol] || '').trim();

    if (name.indexOf('__config__') === 0) continue;

    if (phone.slice(-4) === String(lastFour) &&
        rowBranchId === String(branchId || '').trim()) {
      return respond({
        success:     true,
        name:        name,
        parentPhone: phone,
      });
    }
  }

  return respond({ success: false });
}
