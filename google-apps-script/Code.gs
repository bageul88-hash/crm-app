/**
 * 참바른글씨 CRM - Google Apps Script
 *
 * [통합 엔트리 포인트]
 * doGet  → CRM 읽기 (getAll, searchByPhone)
 * doPost → CRM 쓰기 (action: add/update/delete) +
 *          드라이브 출석 자동화 (studentFolderName 파라미터가 있으면)
 *
 * 운영 시트: "상담DB" 탭에만 읽기/쓰기 (다른 탭 절대 접근 안 함)
 * 열 매핑: 시트 1행(머리글)을 실시간으로 읽어 동적 결정 — 열 번호 하드코딩 없음
 *
 * 드라이브 자동화 함수(onAttendanceCheck, findStudent, getOrCreate)는
 * attendance_drive.gs에 있으며, 같은 프로젝트 스코프를 공유합니다.
 */

// ── CRM: 시트 머리글 → 필드명 매핑 ───────────────────────────────────────
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

// ── 통합 엔트리 포인트 ────────────────────────────────────────────────────

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

    // 드라이브 출석 자동화: studentFolderName이 있으면 Drive 로직으로 분기
    if (data.studentFolderName !== undefined) {
      var result = onAttendanceCheck(data.studentFolderName, data.attendDate);
      return respond(result);
    }

    // CRM 쓰기: action으로 분기
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

// ── CRM: 시트 접근 ────────────────────────────────────────────────────────

function getSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  if (!sheet) throw new Error('"상담DB" 탭을 찾을 수 없습니다. 탭 이름을 확인해 주세요.');
  return sheet;
}

function cleanPhone(val) {
  var s = String(val || '').replace(/^'/, '').replace(/[^0-9]/g, '');
  if (s.length === 10 && s[0] !== '0') s = '0' + s;
  return s;
}

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

function makeRowArray(data, headerMap) {
  var colCount = Object.keys(headerMap).length;
  var row = new Array(colCount).fill('');
  for (var header in headerMap) {
    var fieldName = HEADER_TO_FIELD[header];
    if (!fieldName) continue;
    var colIdx = headerMap[header];
    var val = data[fieldName];
    if (fieldName === 'savedAt' && !val) {
      val = new Date().toISOString().slice(0, 10);
    }
    row[colIdx] = (val !== undefined && val !== null) ? val : '';
  }
  return row;
}

// ── CRM: CRUD ─────────────────────────────────────────────────────────────

function getAllRows() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return respond({ data: [] });
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return respond({ data: values });
}

function addRow(data) {
  var sheet = getSheet();
  var headerMap = buildHeaderMap(sheet);
  var row = makeRowArray(data, headerMap);
  sheet.appendRow(row);
  return respond({ status: 'OK', id: sheet.getLastRow() });
}

function updateRow(data) {
  var sheet = getSheet();
  var rowNum = parseInt(data.id, 10);
  if (!rowNum || rowNum < 2) return respond({ error: 'invalid id: ' + data.id });
  var headerMap = buildHeaderMap(sheet);
  var row = makeRowArray(data, headerMap);
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  return respond({ status: 'OK' });
}

function deleteRow(data) {
  var sheet = getSheet();
  var rowNum = parseInt(data.id, 10);
  if (!rowNum || rowNum < 2) return respond({ error: 'invalid id: ' + data.id });
  sheet.deleteRow(rowNum);
  return respond({ status: 'OK' });
}

function normDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, '0');
    var d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

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
  var nameCol        = headerMap['이름'];
  var ageCol         = headerMap['나이'];
  var savedAtCol     = headerMap['저장시각'];
  var inquiryDateCol = headerMap['문의일'];
  var genderCol      = headerMap['남여'];
  var featureCol     = headerMap['특징'];
  if (phoneCol === undefined || nameCol === undefined) {
    return respond({ success: false, error: '머리글에서 전화번호/이름 열을 찾을 수 없습니다.' });
  }
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var matches = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var phone       = cleanPhone(row[phoneCol]);
    var rowBranchId = branchIdCol !== undefined ? String(row[branchIdCol] || '').trim() : '';
    var name        = String(row[nameCol] || '').trim();
    if (name.indexOf('__config__') === 0) continue;
    if (phone.slice(-4) === String(lastFour) &&
        rowBranchId === String(branchId || '').trim()) {
      matches.push({
        name:        name,
        parentPhone: phone,
        age:         ageCol         !== undefined ? String(row[ageCol]         || '').replace(/세$/, '').trim() : '',
        savedAt:     savedAtCol     !== undefined ? normDate(row[savedAtCol])                                   : '',
        inquiryDate: inquiryDateCol !== undefined ? normDate(row[inquiryDateCol])                               : '',
        gender:      genderCol      !== undefined ? String(row[genderCol]      || '').trim()                   : '',
        feature:     featureCol     !== undefined ? String(row[featureCol]     || '').trim()                   : '',
      });
    }
  }
  if (matches.length === 0) return respond({ success: false });
  // 구 버전 클라이언트 호환: 단일 name/parentPhone 필드도 유지
  return respond({
    success:     true,
    students:    matches,
    name:        matches[0].name,
    parentPhone: matches[0].parentPhone,
  });
}

// ============================================================
// [나이 두 자리 통일] ageFixPlan(dry-run) / ageFixApply(실행)
//   규칙: "한 자리 숫자 + 세"(6세~9세)만 0 패딩(06세~09세).
//         두 자리·빈값·비표준(초6/40여/"9"/"9살" 등)은 전부 그대로.
//   ★ ageFixPlan() 먼저 실행해 계획 확인(변경 0). 승인 후에만 ageFixApply().
//   ★ ageFixApply는 "나이 열"만 setValues. 다른 열 안 건드림.
// ============================================================

/** [DRY-RUN] 나이 변환 계획만 로그 출력. 시트 변경 0. */
function ageFixPlan() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('데이터 없음'); return; }
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var H = {}; for (var i=0;i<headers.length;i++) H[String(headers[i]).trim()] = i;
  var ageCol = H['나이'], nameCol = H['이름'];
  if (ageCol === undefined) { Logger.log('나이 열 없음'); return; }

  var vals = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  var change = 0, keep = 0, hold = 0;
  Logger.log('===== AGE FIX PLAN (dry-run · 변경 0) =====');
  for (var r=0;r<vals.length;r++) {
    var rowNum = r + 2;
    var age = String(vals[r][ageCol]).trim();
    var name = String(vals[r][nameCol]).trim();
    if (age === '') { keep++; continue; }            // 빈값 보존
    var m = age.match(/^(\d{1,2})세$/);
    if (m) {
      if (m[1].length === 1) {                       // 한 자리 → 변환 대상
        var to = '0' + m[1] + '세';
        Logger.log('[FIX] 행' + rowNum + ' ' + name + ' : "' + age + '" → "' + to + '"');
        change++;
      } else {
        keep++;                                       // 두 자리 그대로
      }
    } else {
      // "N세" 형식이 아님(초6, 40여, "9", "9살" 등) → 변환 안 함
      Logger.log('[HOLD] 행' + rowNum + ' ' + name + ' : "' + age + '" (비표준 → 그대로/확인)');
      hold++;
    }
  }
  Logger.log('--- 요약: 변환예정 ' + change + ' / 보존 ' + keep + ' / HOLD(비표준) ' + hold + ' ---');
  Logger.log('※ 검토 후 ageFixApply() 실행. [HOLD]는 변환하지 않음.');
  Logger.log('===== AGE FIX PLAN 끝 =====');
  return 'plan done';
}

/** [실제 실행] 한 자리 "N세"만 0 패딩. 그 외 전부 그대로. 승인 후에만. */
function ageFixApply() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('데이터 없음'); return; }
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var H = {}; for (var i=0;i<headers.length;i++) H[String(headers[i]).trim()] = i;
  var ageCol = H['나이'];
  if (ageCol === undefined) { Logger.log('나이 열 없음'); return; }

  var range = sheet.getRange(2, ageCol+1, lastRow-1, 1);
  var col = range.getValues();
  var changed = 0;
  for (var r=0;r<col.length;r++) {
    var age = String(col[r][0]).trim();
    var m = age.match(/^(\d)세$/);                    // 정확히 "한 자리세"만
    if (m) { col[r][0] = '0' + m[1] + '세'; changed++; }
    // 그 외(빈값/두자리/비표준)는 col[r][0] 유지
  }
  range.setValues(col);                               // 나이 열만 한 번에 기록
  Logger.log('[DONE] 나이 두 자리 변환 ' + changed + '건');
  return 'apply done: ' + changed;
}

/* ===== HOLD 나이(세 없는 숫자) 정리 도구 ===== */

// 학생으로 볼 나이 상한(이 값 이하 숫자만 변환 후보). 필요시 조정.
var HOLD_STUDENT_MAX_AGE = 17;
// 변환에서 제외할 행번호(사람 확인 후 여기에 적어 넣고 holdApply 실행).
// 예: [261, 295, 313] — 성인/문의/가맹 등
var HOLD_EXCLUDE_ROWS = [];

/** [DRY-RUN] '세 없는 숫자' 나이 중 학생후보를 [FIX?]로, 나머지는 [KEEP]로 표시 */
function holdPlan() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('데이터 없음'); return; }
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var H = {}; for (var i=0;i<headers.length;i++) H[String(headers[i]).trim()] = i;
  var ageCol = H['나이'], nameCol = H['이름'], catCol = H['구분'];
  if (ageCol === undefined) { Logger.log('나이 열 없음'); return; }

  var vals = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  var fix = 0, keep = 0;
  Logger.log('===== HOLD PLAN (dry-run · 변경 0) =====');
  Logger.log('규칙: "세 없는 숫자"이고 ' + HOLD_STUDENT_MAX_AGE + '세 이하 → [FIX?] 학생후보 / 그 외 [KEEP]');
  for (var r=0;r<vals.length;r++) {
    var rowNum = r + 2;
    var age = String(vals[r][ageCol]).trim();
    var name = String(vals[r][nameCol]).trim();
    var cat  = catCol !== undefined ? String(vals[r][catCol]).trim() : '';
    if (age === '') continue;                       // 빈값은 대상 아님
    if (/^\d{1,2}세$/.test(age)) continue;          // 이미 "N세"(앞서 처리됨)
    var m = age.match(/^(\d{1,3})$/);               // "세 없는 순수 숫자"만
    if (m) {
      var num = parseInt(m[1], 10);
      if (num >= 1 && num <= HOLD_STUDENT_MAX_AGE) {
        var to = (num < 10 ? '0' + num : '' + num) + '세';   // 두자리 + 세
        Logger.log('[FIX?] 행' + rowNum + ' ' + name + ' (구분:' + cat + ') : "' + age + '" → "' + to + '"');
        fix++;
      } else {
        Logger.log('[KEEP] 행' + rowNum + ' ' + name + ' (구분:' + cat + ') : "' + age + '" (성인대 숫자 → 보존)');
        keep++;
      }
    } else {
      Logger.log('[KEEP] 행' + rowNum + ' ' + name + ' (구분:' + cat + ') : "' + age + '" (텍스트 → 보존)');
      keep++;
    }
  }
  Logger.log('--- 요약: 학생후보[FIX?] ' + fix + ' / 보존[KEEP] ' + keep + ' ---');
  Logger.log('※ [FIX?] 목록에서 학생 아닌 행이 있으면 그 "행번호"를 HOLD_EXCLUDE_ROWS 에 적고 holdApply 실행.');
  Logger.log('===== HOLD PLAN 끝 =====');
  return 'hold plan done';
}

/** [실제 실행] [FIX?] 중 HOLD_EXCLUDE_ROWS 제외하고 "세 없는 숫자"→"NN세" 부여 */
function holdApply() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('데이터 없음'); return; }
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var H = {}; for (var i=0;i<headers.length;i++) H[String(headers[i]).trim()] = i;
  var ageCol = H['나이'];
  if (ageCol === undefined) { Logger.log('나이 열 없음'); return; }

  var range = sheet.getRange(2, ageCol+1, lastRow-1, 1);
  var col = range.getValues();
  var changed = 0, skipped = 0;
  for (var r=0;r<col.length;r++) {
    var rowNum = r + 2;
    var age = String(col[r][0]).trim();
    var m = age.match(/^(\d{1,3})$/);
    if (!m) continue;
    var num = parseInt(m[1], 10);
    if (num < 1 || num > HOLD_STUDENT_MAX_AGE) continue;     // 성인대 보존
    if (HOLD_EXCLUDE_ROWS.indexOf(rowNum) >= 0) { skipped++; continue; } // 제외목록
    col[r][0] = (num < 10 ? '0' + num : '' + num) + '세';
    changed++;
  }
  range.setValues(col);
  Logger.log('[DONE] 세 부여+두자리 변환 ' + changed + '건 / 제외 ' + skipped + '건');
  return 'hold apply done: ' + changed;
}

/* ===== 학년형 나이("초6" 등) → "NN세" 환산 도구 (한국 나이, 초1=8세) =====
   ★ gradeFixPlan() 먼저(드라이런) → 검수 → gradeFixApply().
   환산표: 초1~6 → 08~13세 / 중1~3 → 14~16세 / 고1~3 → 17~19세.        */

// 학년→나이 환산에서 제외할 행번호(상담메모행 등). 필요시 채움.
var GRADE_EXCLUDE_ROWS = [];

// "초6"/"초 6"/"초6학년"/"초등6"/"초등학교 6학년" 등 → 만나이 숫자. 해석 불가/범위밖 → null.
function _gradeToAge(raw) {
  var s = String(raw || '').replace(/[\s]|학년|학교/g, ''); // 공백·"학년"·"학교" 제거
  var m = s.match(/^(초등|초|중학|중|고등|고)(\d+)$/);        // 긴 표기(초등/중학/고등) 우선
  if (!m) return null;
  var kind = m[1], n = parseInt(m[2], 10);
  if (kind === '초등' || kind === '초') { return (n >= 1 && n <= 6) ? n + 7  : null; } // 초1=8
  if (kind === '중학' || kind === '중') { return (n >= 1 && n <= 3) ? n + 13 : null; } // 중1=14
  if (kind === '고등' || kind === '고') { return (n >= 1 && n <= 3) ? n + 16 : null; } // 고1=17
  return null;
}

/** [DRY-RUN] 학년형 나이 환산 계획만 로그 출력. 시트 변경 0. */
function gradeFixPlan() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('데이터 없음'); return; }
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var H = {}; for (var i=0;i<headers.length;i++) H[String(headers[i]).trim()] = i;
  var ageCol = H['나이'], nameCol = H['이름'];
  if (ageCol === undefined) { Logger.log('나이 열 없음'); return; }

  var vals = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  var plan = 0, hold = 0;
  Logger.log('===== GRADE FIX PLAN (dry-run · 변경 0) =====');
  Logger.log('환산표(한국나이): 초1~6=08~13세 / 중1~3=14~16세 / 고1~3=17~19세');
  for (var r=0;r<vals.length;r++) {
    var rowNum = r + 2;
    var age  = String(vals[r][ageCol]).trim();
    var name = String(vals[r][nameCol]).trim();
    if (age === '') continue;                       // 빈값
    if (/^\d{1,2}세$/.test(age)) continue;          // 이미 "NN세"
    if (GRADE_EXCLUDE_ROWS.indexOf(rowNum) >= 0) {
      Logger.log('[HOLD] 행' + rowNum + ' ' + name + ' : "' + age + '" (제외목록)');
      hold++; continue;
    }
    var toAge = _gradeToAge(age);
    if (toAge != null) {
      var to = (toAge < 10 ? '0' + toAge : '' + toAge) + '세';
      Logger.log('[PLAN] 행' + rowNum + ' ' + name + ' : "' + age + '" → "' + to + '"');
      plan++;
    } else {
      Logger.log('[HOLD] 행' + rowNum + ' ' + name + ' : "' + age + '" (환산 대상 아님/해석불가)');
      hold++;
    }
  }
  Logger.log('--- 요약: 환산예정 ' + plan + ' / HOLD ' + hold + ' ---');
  Logger.log('※ 검수 후 gradeFixApply() 실행. [HOLD]는 변환하지 않음.');
  Logger.log('===== GRADE FIX PLAN 끝 =====');
  return 'grade plan done';
}

/** [실제 실행] 학년형 나이만 "NN세"로 환산. 그 외 전부 그대로. 승인 후에만. */
function gradeFixApply() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상담DB');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('데이터 없음'); return; }
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var H = {}; for (var i=0;i<headers.length;i++) H[String(headers[i]).trim()] = i;
  var ageCol = H['나이'];
  if (ageCol === undefined) { Logger.log('나이 열 없음'); return; }

  var range = sheet.getRange(2, ageCol+1, lastRow-1, 1);
  var col = range.getValues();
  var changed = 0;
  for (var r=0;r<col.length;r++) {
    var rowNum = r + 2;
    var age = String(col[r][0]).trim();
    if (/^\d{1,2}세$/.test(age)) continue;                    // 이미 NN세(멱등)
    if (GRADE_EXCLUDE_ROWS.indexOf(rowNum) >= 0) continue;    // 제외
    var toAge = _gradeToAge(age);
    if (toAge == null) continue;                              // 환산 대상 아님 → 보존
    col[r][0] = (toAge < 10 ? '0' + toAge : '' + toAge) + '세';
    changed++;
  }
  range.setValues(col);
  Logger.log('[DONE] 학년→나이 환산 ' + changed + '건');
  return 'grade apply done: ' + changed;
}
