/**
 * 참바른글씨 CRM - Google Apps Script
 *
 * 열 구조 (1-indexed in GAS / 0-indexed in FIELD_MAP):
 *  A(1/0)  구분        category
 *  B(2/1)  문의일      inquiryDate
 *  C(3/2)  문의요일    inquiryDay
 *  D(4/3)  나이        age
 *  E(5/4)  남여        gender
 *  F(6/5)  이름        name        ← searchByPhone 반환
 *  G(7/6)  진단예약일  diagDate
 *  H(8/7)  진단요일    diagDay
 *  I(9/8)  진단예약시간 diagTime
 *  J(10/9) 진단결과    diagResult
 *  K(11/10) 관계       relation
 *  L(12/11) 특징       feature
 *  M(13/12) 전화번호   phone       ← searchByPhone 사용, parentPhone 반환
 *  N(14/13) 원본       source
 *  O(15/14) 저장시각   savedAt
 *  P(16/15) branchId               ← searchByPhone 사용
 *  Q(17/16) 수업자료   hasPhoto    ← 신규
 *  R(18/17) 수업예약일  lessonDate ← 신규
 *  S(19/18) 수업요일   lessonDay   ← 신규
 *  T(20/19) 수업예약시간 lessonTime ← 신규
 *
 * 총 20열(A~T)
 */

var TOTAL_COLS = 20;

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

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

// 전화번호에서 숫자만 추출 (앞의 ' 제거 포함)
function cleanPhone(val) {
  var s = String(val || '').replace(/^'/, '').replace(/[^0-9]/g, '');
  // 10자리이고 0으로 시작하지 않으면 앞에 0 추가 (Sheets가 leading-zero 제거한 경우)
  if (s.length === 10 && s[0] !== '0') s = '0' + s;
  return s;
}

// 데이터를 시트 열 순서 배열로 변환
function makeRowArray(data) {
  return [
    data.category    || '',                                   // A
    data.inquiryDate || '',                                   // B
    data.inquiryDay  || '',                                   // C
    data.age         || '',                                   // D
    data.gender      || '',                                   // E
    data.name        || '',                                   // F
    data.diagDate    || '',                                   // G
    data.diagDay     || '',                                   // H
    data.diagTime    || '',                                   // I
    data.diagResult  || '',                                   // J
    data.relation    || '',                                   // K
    data.feature     || '',                                   // L
    data.phone       || '',                                   // M (CRM이 이미 '01011112222 형식으로 전달)
    data.source      || '',                                   // N
    data.savedAt     || new Date().toISOString().slice(0,10), // O
    data.branchId    || '',                                   // P
    data.hasPhoto    || '',                                   // Q 수업자료
    data.lessonDate  || '',                                   // R 수업예약일
    data.lessonDay   || '',                                   // S 수업요일
    data.lessonTime  || '',                                   // T 수업예약시간
  ];
}

// 전체 행 반환
function getAllRows() {
  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return respond({ data: [] });

  var lastCol = Math.max(sheet.getLastColumn(), TOTAL_COLS);
  var values  = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return respond({ data: values });
}

// 행 추가
function addRow(data) {
  var sheet = getSheet();
  var row   = makeRowArray(data);
  sheet.appendRow(row);
  return respond({ status: 'OK', id: sheet.getLastRow() });
}

// 행 수정
function updateRow(data) {
  var sheet  = getSheet();
  var rowNum = parseInt(data.id, 10);
  if (!rowNum || rowNum < 2) return respond({ error: 'invalid id: ' + data.id });

  var row = makeRowArray(data);
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  return respond({ status: 'OK' });
}

// 행 삭제
function deleteRow(data) {
  var sheet  = getSheet();
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

  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return respond({ success: false });

  var lastCol = Math.max(sheet.getLastColumn(), TOTAL_COLS);
  var values  = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var i = 0; i < values.length; i++) {
    var row         = values[i];
    var phone       = cleanPhone(row[12]); // M열 (인덱스 12)
    var rowBranchId = String(row[15] || '').trim(); // P열 (인덱스 15)
    var name        = String(row[5] || '').trim();  // F열 (인덱스 5)

    // __config__ 행 제외
    if (name.indexOf('__config__') === 0) continue;

    if (phone.slice(-4) === String(lastFour) &&
        rowBranchId === String(branchId || '').trim()) {
      return respond({
        success:     true,
        name:        name,
        parentPhone: phone, // 하이픈 없는 11자리
      });
    }
  }

  return respond({ success: false });
}
