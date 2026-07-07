/**
 * ============================================================
 * [지시서 ②] 일회성 폴더 병합 정리 도구
 *
 * 사용 순서 (Apps Script 편집기 → 함수 선택 → ▶ 실행):
 *   STEP 0:  scanSplitStudents()        ← 현황 스캔 (읽기 전용)
 *   STEP 1:  dryRunMergeAll()           ← 모의실행 (이동 0건)
 *   STEP 2:  mergeOneStudent('변기정')    ← 1명만 실제 병합 (인수 생략 시 변기정)
 *   STEP 3:  mergeAllStudents()         ← 전원 병합 (재실행 안전: 중단 시 다시 호출)
 *
 * ★ STEP 1을 거치지 않고 STEP 2/3 실행 금지.
 * ★ STEP 2 결과 Drive에서 눈으로 확인 후 STEP 3 진행.
 * ★ 로그 확인: Apps Script 편집기 → '실행 기록' → 출력 → 텍스트 복사.
 *
 * 정책:
 *   - 이동/병합만. 삭제 안 함 (빈 과거 폴더 정리는 별도 함수 cleanupEmptyFolders).
 *   - 충돌(target에 동일 mmdd 하위폴더 존재) → 건너뜀(보존), 덮어쓰기 절대 금지.
 *   - 학생 식별: 폴더명 그대로. "08세 ..." / "8세 ..." 변형은 동일 학생으로 정규화.
 *
 * 공유 글로벌: ROOT_FOLDER_ID, getOrCreate (attendance_drive.gs에 정의).
 * ============================================================
 */

// 평소 null. 특정 날짜로 강제 병합 시 'yyyyMMdd' 지정 (예: '20260624').
const MERGE_TODAY_OVERRIDE = null;

function _mergeTodayStr() {
  return MERGE_TODAY_OVERRIDE
    || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
}

// "08세 김철수" ↔ "8세 김철수" 동일 학생 정규화 (앞자리 0 제거)
function _mergeNormalizeName(name) {
  return name.replace(/^0(\d세 )/, '$1');
}

/**
 * 루트의 모든 날짜폴더를 훑어 학생 폴더 수집.
 * 반환: { 정규화이름: [{ date, folder, originalName }, ...] } (date 내림차순)
 */
function _mergeCollectAll() {
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const map = {};
  const dateFolders = root.getFolders();
  while (dateFolders.hasNext()) {
    const dateFolder = dateFolders.next();
    const dateName = dateFolder.getName();
    if (!/^\d{8}$/.test(dateName)) continue;
    const studentFolders = dateFolder.getFolders();
    while (studentFolders.hasNext()) {
      const sf = studentFolders.next();
      const norm = _mergeNormalizeName(sf.getName());
      if (!map[norm]) map[norm] = [];
      map[norm].push({ date: dateName, folder: sf, originalName: sf.getName() });
    }
  }
  for (const k in map) {
    map[k].sort(function (a, b) { return b.date.localeCompare(a.date); });
  }
  return map;
}

// 폴더 요약 (하위폴더명 정렬 리스트 + 파일 수, desktop.ini 제외)
function _mergeSummarize(folder) {
  const subNames = [];
  const sub = folder.getFolders();
  while (sub.hasNext()) subNames.push(sub.next().getName());
  subNames.sort();
  let fileCount = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    if (files.next().getName().toLowerCase() !== 'desktop.ini') fileCount++;
  }
  return { subNames: subNames, fileCount: fileCount };
}

// ────────────────────────────────────────────────────────
// STEP 0: 쪼개진 학생 폴더 현황 스캔 (읽기 전용)
// ────────────────────────────────────────────────────────
function scanSplitStudents() {
  const todayStr = _mergeTodayStr();
  const map = _mergeCollectAll();

  const lines = [];
  lines.push('========================================');
  lines.push('[STEP 0] 쪼개진 학생 폴더 스캔 (읽기 전용)');
  lines.push('오늘 날짜 폴더: ' + todayStr);
  lines.push('========================================');

  const splitNorms = [];
  for (const norm in map) {
    if (map[norm].length >= 2) splitNorms.push(norm);
  }
  splitNorms.sort(function (a, b) { return a.localeCompare(b, 'ko'); });

  lines.push('★ 2개 이상 날짜폴더에 분산된 학생: ' + splitNorms.length + '명');
  lines.push('');

  for (let i = 0; i < splitNorms.length; i++) {
    const norm = splitNorms[i];
    const entries = map[norm];
    lines.push('▼ ' + norm + '  (' + entries.length + '곳 분산)');

    const subCountByName = {};
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j];
      const sum = _mergeSummarize(e.folder);
      const mark = (e.date === todayStr) ? '  ★오늘' : '';
      lines.push('   - ' + e.date + '/' + e.originalName
                 + '  (하위 ' + sum.subNames.length + '개: '
                 + (sum.subNames.join(',') || '-')
                 + ', 파일 ' + sum.fileCount + ')' + mark);
      for (let k = 0; k < sum.subNames.length; k++) {
        const sn = sum.subNames[k];
        subCountByName[sn] = (subCountByName[sn] || 0) + 1;
      }
    }
    const conflicts = Object.keys(subCountByName).filter(function (k) { return subCountByName[k] > 1; });
    if (conflicts.length > 0) {
      lines.push('   ⚠️ 충돌 후보(여러 위치에 동일 하위폴더): ' + conflicts.sort().join(','));
    }
    lines.push('');
  }

  const out = lines.join('\n');
  Logger.log(out);
  return out;
}

/**
 * 한 학생의 병합 계획 계산 (이동/건너뜀 목록만).
 * 실제 이동/생성은 하지 않음.
 */
function _mergePlanForStudent(norm, entries, todayStr) {
  const todayEntry = entries.filter(function (e) { return e.date === todayStr; })[0] || null;
  const pastEntries = entries.filter(function (e) { return e.date !== todayStr; });

  const targetSubNames = {};
  if (todayEntry) {
    const sum = _mergeSummarize(todayEntry.folder);
    for (let i = 0; i < sum.subNames.length; i++) targetSubNames[sum.subNames[i]] = true;
  }

  const moves = [];
  const skips = [];
  for (let i = 0; i < pastEntries.length; i++) {
    const e = pastEntries[i];
    const sum = _mergeSummarize(e.folder);
    for (let j = 0; j < sum.subNames.length; j++) {
      const sn = sum.subNames[j];
      if (targetSubNames[sn]) {
        skips.push({ subName: sn, fromDate: e.date, fromName: e.originalName, reason: '오늘 폴더(또는 직전 병합)에 동일 하위폴더 존재 → 보존' });
      } else {
        moves.push({ kind: 'folder', subName: sn, fromDate: e.date, fromName: e.originalName });
        targetSubNames[sn] = true;
      }
    }
    if (sum.fileCount > 0) {
      moves.push({ kind: 'files', count: sum.fileCount, fromDate: e.date, fromName: e.originalName });
    }
  }
  return { todayEntry: todayEntry, pastEntries: pastEntries, moves: moves, skips: skips };
}

// ────────────────────────────────────────────────────────
// STEP 1: DRY-RUN (실제 이동 0건)
// ────────────────────────────────────────────────────────
function dryRunMergeAll() {
  const todayStr = _mergeTodayStr();
  const map = _mergeCollectAll();

  const lines = [];
  lines.push('========================================');
  lines.push('[STEP 1] DRY-RUN 병합 계획 (실제 이동 0건)');
  lines.push('오늘 날짜 폴더: ' + todayStr);
  lines.push('========================================');

  const splitNorms = Object.keys(map)
    .filter(function (k) { return map[k].length >= 2; })
    .sort(function (a, b) { return a.localeCompare(b, 'ko'); });

  let totalMove = 0, totalSkip = 0;
  for (let i = 0; i < splitNorms.length; i++) {
    const norm = splitNorms[i];
    const plan = _mergePlanForStudent(norm, map[norm], todayStr);
    lines.push('▼ ' + norm);
    if (!plan.todayEntry) {
      lines.push('   ※ 오늘 폴더에 학생폴더 없음 → 가장 최근 과거 폴더를 오늘로 이동 후 target 사용');
    } else {
      lines.push('   target: ' + todayStr + '/' + plan.todayEntry.originalName);
    }
    if (plan.moves.length === 0 && plan.skips.length === 0) {
      lines.push('   - 이동 없음 (이미 정리됨)');
    }
    for (let j = 0; j < plan.moves.length; j++) {
      const m = plan.moves[j];
      if (m.kind === 'folder') {
        lines.push('   - MOVE: ' + m.fromDate + '/' + m.fromName + '/' + m.subName
                   + ' → ' + todayStr + '/' + norm + '/' + m.subName);
      } else {
        lines.push('   - MOVE files: ' + m.fromDate + '/' + m.fromName + '/(파일 ' + m.count + '개)'
                   + ' → ' + todayStr + '/' + norm + '/');
      }
    }
    for (let j = 0; j < plan.skips.length; j++) {
      const s = plan.skips[j];
      lines.push('   - SKIP: ' + s.fromDate + '/' + s.fromName + '/' + s.subName + '  (' + s.reason + ')');
    }
    totalMove += plan.moves.length;
    totalSkip += plan.skips.length;
    lines.push('');
  }
  lines.push('----------------------------------------');
  lines.push('합계: 이동 예정 ' + totalMove + '건, 건너뜀 예정 ' + totalSkip + '건');
  lines.push('※ 실제 이동은 한 건도 발생하지 않았습니다.');

  const out = lines.join('\n');
  Logger.log(out);
  return out;
}

/**
 * 한 학생 실제 병합 실행.
 * - target = 오늘 학생폴더 (없으면 가장 최근 과거 폴더를 오늘로 이동해 target 확보).
 * - 충돌 하위폴더 → 건너뜀(source에 그대로 보존).
 * - source 폴더 자체는 절대 삭제하지 않음.
 */
function _mergeExecuteForStudent(norm, entries, todayStr) {
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  let targetFolder;
  let workingEntries = entries.slice();

  const todayEntry = workingEntries.filter(function (e) { return e.date === todayStr; })[0] || null;
  if (todayEntry) {
    targetFolder = todayEntry.folder;
  } else {
    const todayFolder = getOrCreate(root, todayStr);
    workingEntries.sort(function (a, b) { return b.date.localeCompare(a.date); });
    const latest = workingEntries[0];
    targetFolder = latest.folder;
    targetFolder.moveTo(todayFolder);
    workingEntries = workingEntries.filter(function (e) { return e.folder.getId() !== latest.folder.getId(); });
  }

  const pastEntries = workingEntries.filter(function (e) { return e.date !== todayStr; });

  const targetSubNames = {};
  let sub = targetFolder.getFolders();
  while (sub.hasNext()) targetSubNames[sub.next().getName()] = true;

  const moved = [];
  const skipped = [];
  const errors = [];

  for (let i = 0; i < pastEntries.length; i++) {
    const e = pastEntries[i];
    try {
      const subIter = e.folder.getFolders();
      while (subIter.hasNext()) {
        const sf = subIter.next();
        const sn = sf.getName();
        if (targetSubNames[sn]) {
          skipped.push(e.date + '/' + e.originalName + '/' + sn + '  (충돌→보존)');
          continue;
        }
        sf.moveTo(targetFolder);
        targetSubNames[sn] = true;
        moved.push(e.date + '/' + e.originalName + '/' + sn);
      }
      const fileIter = e.folder.getFiles();
      while (fileIter.hasNext()) {
        const file = fileIter.next();
        if (file.getName().toLowerCase() === 'desktop.ini') continue;
        file.moveTo(targetFolder);
        moved.push(e.date + '/' + e.originalName + '/(file)' + file.getName());
      }
    } catch (err) {
      errors.push({ from: e.date + '/' + e.originalName, error: err.message });
    }
  }
  return { norm: norm, targetName: targetFolder.getName(), moved: moved, skipped: skipped, errors: errors };
}

// ────────────────────────────────────────────────────────
// STEP 2: 1명 실제 병합 (기본: 변기정)
// ────────────────────────────────────────────────────────
function mergeOneStudent(studentName) {
  if (!studentName) studentName = '변기정';
  const todayStr = _mergeTodayStr();
  const map = _mergeCollectAll();

  // 정확 매칭 → 접미 매칭("X세 변기정") 순으로 후보 좁힘
  const norms = Object.keys(map);
  let candidates = norms.filter(function (k) { return k === studentName; });
  if (candidates.length === 0) {
    candidates = norms.filter(function (k) { return k.indexOf('세 ' + studentName) >= 0 && k.replace(/^\d+세 /, '') === studentName; });
  }
  if (candidates.length === 0) {
    throw new Error('학생 폴더 못 찾음: ' + studentName + '  (정규화 후 키 ' + norms.length + '개 중 일치 0)');
  }
  if (candidates.length > 1) {
    throw new Error('동명이인 후보 다수 → 정확한 폴더명으로 다시 호출: ' + candidates.join(', '));
  }
  const norm = candidates[0];
  const entries = map[norm];
  if (entries.length < 2) {
    return '대상 학생 분산 0 (병합 불필요): ' + norm;
  }

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  let result;
  try {
    result = _mergeExecuteForStudent(norm, entries, todayStr);
  } finally {
    lock.releaseLock();
  }

  const lines = [];
  lines.push('========================================');
  lines.push('[STEP 2] 1명 병합 결과');
  lines.push('학생: ' + result.norm + '   target: ' + todayStr + '/' + result.targetName);
  lines.push('----------------------------------------');
  lines.push('이동 ' + result.moved.length + '건:');
  for (let i = 0; i < result.moved.length; i++) lines.push('  ✓ ' + result.moved[i]);
  lines.push('건너뜀(보존) ' + result.skipped.length + '건:');
  for (let i = 0; i < result.skipped.length; i++) lines.push('  ⚠ ' + result.skipped[i]);
  lines.push('실패 ' + result.errors.length + '건:');
  for (let i = 0; i < result.errors.length; i++) lines.push('  ✗ ' + result.errors[i].from + ' : ' + result.errors[i].error);
  lines.push('');
  lines.push('※ source(과거 학생폴더)는 삭제하지 않았습니다. Drive에서 직접 확인 후 비어있는 경우 수동 정리 또는 cleanupEmptyFolders() 호출.');

  const out = lines.join('\n');
  Logger.log(out);
  return out;
}

// ────────────────────────────────────────────────────────
// STEP 3: 전원 병합 (재실행 안전)
// ────────────────────────────────────────────────────────
function mergeAllStudents() {
  const todayStr = _mergeTodayStr();
  const map = _mergeCollectAll();
  const splitNorms = Object.keys(map)
    .filter(function (k) { return map[k].length >= 2; })
    .sort(function (a, b) { return a.localeCompare(b, 'ko'); });

  const results = [];
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);
  try {
    for (let i = 0; i < splitNorms.length; i++) {
      const norm = splitNorms[i];
      try {
        const r = _mergeExecuteForStudent(norm, map[norm], todayStr);
        results.push({ status: 'OK', r: r });
      } catch (err) {
        results.push({ status: 'FAIL', norm: norm, error: err.message });
      }
    }
  } finally {
    lock.releaseLock();
  }

  const lines = [];
  lines.push('========================================');
  lines.push('[STEP 3] 전원 병합 결과 (대상 ' + splitNorms.length + '명)');
  lines.push('오늘 폴더: ' + todayStr);
  lines.push('========================================');
  let totMove = 0, totSkip = 0, totFail = 0;
  for (let i = 0; i < results.length; i++) {
    const e = results[i];
    if (e.status === 'FAIL') {
      totFail++;
      lines.push('✗ ' + e.norm + ' : ' + e.error);
    } else {
      const r = e.r;
      totMove += r.moved.length;
      totSkip += r.skipped.length;
      lines.push('✓ ' + r.norm + ' (이동 ' + r.moved.length + ', 건너뜀 ' + r.skipped.length + ', 에러 ' + r.errors.length + ')');
      for (let j = 0; j < r.errors.length; j++) {
        lines.push('    ✗ ' + r.errors[j].from + ' : ' + r.errors[j].error);
      }
    }
  }
  lines.push('----------------------------------------');
  lines.push('합계: 이동 ' + totMove + ', 건너뜀 ' + totSkip + ', 학생 실패 ' + totFail);
  lines.push('※ 6분 실행 한도로 중단되어도 재실행 시 남은 학생만 자동 처리됩니다(이미 병합된 학생은 splitNorms에서 제외됨).');

  const out = lines.join('\n');
  Logger.log(out);
  return out;
}
