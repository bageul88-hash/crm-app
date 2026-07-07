/**
 * 드라이브 출석 자동화
 *
 * doPost는 Code.gs에 통합되었습니다.
 * 이 파일은 함수만 정의하며, Code.gs의 doPost에서 studentFolderName
 * 파라미터가 감지되면 여기의 onAttendanceCheck()를 호출합니다.
 */

const ROOT_FOLDER_ID = '1TzxBdF3G17llAd5-_pGEKBakFvmi41aH';

function onAttendanceCheck(studentFolderName, attendDate) {
  // ★★ STEP 0 긴급(2026-06-28): 폴더명 변조 사고 대응 — 자동 폴더이동 임시 중단.
  //    출석기록(Firebase)·학부모문자(출석앱 직접발송)는 무관. Drive 폴더 이동/생성만 정지.
  //    → 변조 폴더 양산 즉시 중단. 복구·수정 검증이 끝나면 MAINTENANCE=false 로 되돌릴 것.
  var MAINTENANCE = true;
  if (MAINTENANCE) {
    Logger.log('[MAINTENANCE] 폴더이동 임시중단 — 건너뜀: ' + studentFolderName);
    return { status: 'SKIPPED', message: '폴더이동 점검중(임시중단)' };
  }

  // ── [TIMING] 단계별 소요시간 측정 (로직 변경 없음, 로그만 추가) ──
  // 확인: Apps Script 편집기 → "실행 기록(Executions)" 또는 보기 > 로그.
  var __t0 = new Date().getTime();
  var __last = __t0;
  function lap(label) {
    var now = new Date().getTime();
    Logger.log('[TIMING] ' + label + ': +' + (now - __last) + 'ms (누적 ' + (now - __t0) + 'ms)');
    __last = now;
  }
  Logger.log('[TIMING] onAttendanceCheck 시작: ' + studentFolderName);

  const todayStr = attendDate.replace(/-/g, '');
  const mmdd     = attendDate.slice(5).replace('-', '');

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  lap('1) LockService.tryLock (다른 출석과 잠금 경합 시 대기)');

  try {
    const root        = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const todayFolder = getOrCreate(root, todayStr);
    lap('2) 루트/오늘 폴더 확보');

    // 오늘 폴더에 이미 있는지 확인 (새 형식·이전 형식 모두)
    let studentFolder = findInFolder(todayFolder, studentFolderName);
    lap('3) 오늘 폴더 내 학생 검색(findInFolder)');
    if (studentFolder) {
      if (studentFolder.getName() !== studentFolderName) {
        studentFolder.setName(studentFolderName);
      }
      getOrCreate(studentFolder, mmdd);
      lap('3-1) 이미 출석 처리(mmdd 폴더 확보)');
      Logger.log('[TIMING] onAttendanceCheck 총 소요(ALREADY_CHECKED): ' + (new Date().getTime() - __t0) + 'ms');
      return { status: 'ALREADY_CHECKED', message: '오늘 이미 출석 처리됨' };
    }

    // ★ STEP 2-3: 전체 날짜폴더 순회 대신, 학생 폴더명으로 핀포인트 검색.
    //   getFoldersByName(이름)으로 Drive에서 그 학생 폴더만 직접 찾는다(전체 순회 제거).
    const candidates = findStudentPinpoint(root, studentFolderName, todayStr);
    lap('4) 학생 폴더 핀포인트 검색(getFoldersByName) ← 전체 순회 제거');

    if (candidates.length === 0) {
      studentFolder = todayFolder.createFolder(studentFolderName);
    } else {
      // 가장 최근 폴더 → 오늘 폴더로 이동 + 이름 통일
      studentFolder = candidates[0].folder;
      studentFolder.moveTo(todayFolder);
      if (studentFolder.getName() !== studentFolderName) {
        studentFolder.setName(studentFolderName);
      }

      // 나머지 중복 폴더 → 내용 병합 후 휴지통
      for (let i = 1; i < candidates.length; i++) {
        mergeAndTrash(candidates[i].folder, studentFolder);
      }
    }
    lap('5) 폴더 이동/생성 + 중복 병합(mergeAndTrash ' + Math.max(0, candidates.length - 1) + '건)');

    getOrCreate(studentFolder, mmdd);
    lap('6) mmdd 하위폴더 확보');

    // ★ STEP 2-1: 빈 폴더 정리(cleanupEmptyFolders)를 등원 경로에서 제거.
    //   매 등원마다 전체 날짜폴더×학생폴더를 순회·검사해 ~48초의 주범이었음.
    //   → cleanupEmptyFolders 함수 정의는 아래에 그대로 두고, "새벽 시간기반 트리거"로 분리.
    //   (Apps Script 편집기 → 트리거 → cleanupEmptyFolders 일 단위 새벽 실행)

    Logger.log('[TIMING] onAttendanceCheck 총 소요(SUCCESS): ' + (new Date().getTime() - __t0) + 'ms');
    return { status: 'SUCCESS', message: '출석 처리 완료' };

  } catch (e) {
    return { status: 'ERROR', message: e.message };

  } finally {
    lock.releaseLock();
  }
}

/**
 * 특정 부모 폴더에서 studentFolderName 검색.
 * 새 형식("08세 ...") 우선, 없으면 이전 형식("8세 ...")도 검색.
 * 반환: Folder 또는 null
 */
function findInFolder(parent, name) {
  let it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  // 앞자리 0 제거 변형: "08세 " → "8세 "
  const unpaddedName = name.replace(/^0(\d세 )/, '$1');
  if (unpaddedName !== name) {
    it = parent.getFoldersByName(unpaddedName);
    if (it.hasNext()) return it.next();
  }
  return null;
}

/**
 * 루트 하위 날짜 폴더(오늘 제외)에서 학생 폴더 전부 검색.
 * 반환: [{ date, folder }, ...] 최신 날짜 순
 */
function findStudent(root, name, todayStr) {
  const iter  = root.getFolders();
  const found = [];
  while (iter.hasNext()) {
    const f = iter.next();
    const n = f.getName();
    if (n === todayStr || !/^\d{8}$/.test(n)) continue;
    const sub = findInFolder(f, name);
    if (sub) found.push({ date: n, folder: sub });
  }
  found.sort((a, b) => b.date.localeCompare(a.date));
  return found;
}

/**
 * ★ STEP 2-3: 핀포인트 검색 — 전체 날짜폴더 순회 없이 학생 폴더만 찾는다.
 * getFoldersByName(이름)으로 Drive 전체에서 해당 이름 폴더를 직접 조회한 뒤,
 * "부모가 root 직속의 8자리 날짜폴더(오늘 제외)"인 것만 채택.
 * "08세 .."/"8세 .." 변형 모두 검색, 휴지통 폴더는 제외, 중복 ID 제거.
 * 반환: [{ date, folder }, ...] 최신 날짜 순 (findStudent와 동일 형태).
 */
function findStudentPinpoint(root, name, todayStr) {
  const rootId = root.getId();
  const names = [name];
  const unpadded = name.replace(/^0(\d세 )/, '$1');
  if (unpadded !== name) names.push(unpadded);

  const found = [];
  const seen = {};
  for (var ni = 0; ni < names.length; ni++) {
    const it = DriveApp.getFoldersByName(names[ni]);
    while (it.hasNext()) {
      const f = it.next();
      const id = f.getId();
      if (seen[id]) continue;
      if (f.isTrashed()) continue;

      // 부모 = 날짜폴더(8자리, 오늘 제외) 인지 확인
      const parents = f.getParents();
      if (!parents.hasNext()) continue;
      const parent = parents.next();
      const pname = parent.getName();
      if (!/^\d{8}$/.test(pname) || pname === todayStr) continue;

      // 그 날짜폴더가 root 직속인지 확인 (다른 곳의 동명 폴더 배제)
      const grand = parent.getParents();
      if (!grand.hasNext() || grand.next().getId() !== rootId) continue;

      seen[id] = true;
      found.push({ date: pname, folder: f });
    }
  }
  found.sort(function (a, b) { return b.date.localeCompare(a.date); });
  return found;
}

/**
 * source 폴더의 내용(하위 폴더·파일)을 target으로 병합한 뒤
 * source를 휴지통으로 이동.
 */
function mergeAndTrash(source, target) {
  const subFolders = source.getFolders();
  while (subFolders.hasNext()) {
    subFolders.next().moveTo(target);
  }
  const files = source.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().toLowerCase() !== 'desktop.ini') {
      file.moveTo(target);
    }
  }
  DriveApp.getFileById(source.getId()).setTrashed(true);
}

/**
 * 잘못 생성된 빈 학생 폴더 자동 정리.
 * 하위 폴더 0개 + 파일 없음(또는 desktop.ini만) → 휴지통.
 * 오늘 날짜 폴더는 건드리지 않음.
 * 단독 실행도 가능 (인수 생략 시 자동 산출).
 */
function cleanupEmptyFolders(root, todayStr) {
  if (!root)     root     = DriveApp.getFolderById(ROOT_FOLDER_ID);
  if (!todayStr) todayStr = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');

  const toTrash = [];
  const dateFolders = root.getFolders();
  while (dateFolders.hasNext()) {
    const dateFolder = dateFolders.next();
    const dateName   = dateFolder.getName();
    if (!/^\d{8}$/.test(dateName) || dateName === todayStr) continue;

    const studentFolders = dateFolder.getFolders();
    while (studentFolders.hasNext()) {
      const sf = studentFolders.next();
      if (sf.getFolders().hasNext()) continue; // 하위 폴더 있으면 건너뜀
      if (isEffectivelyEmpty(sf)) toTrash.push(sf.getId());
    }
  }

  for (const id of toTrash) {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
  }

  return { cleaned: toTrash.length };
}

function isEffectivelyEmpty(folder) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    if (files.next().getName().toLowerCase() !== 'desktop.ini') return false;
  }
  return true;
}

function getOrCreate(parent, name) {
  const f = parent.getFoldersByName(name);
  return f.hasNext() ? f.next() : parent.createFolder(name);
}

// ============================================================
// [복구] 변조 학생폴더 정리 — recoverPlan(dry-run) / recoverApply(실행)
//   규칙: 같은 이름 중 "가장 오래된 날짜폴더"의 폴더 = 원본(정본, 불변).
//         나머지(변조본) 내용물 → 원본으로 병합 후, 빈 변조본 → 휴지통(영구삭제 X).
//   ★ 먼저 recoverPlan() 만 실행해 계획 확인(변경 0). 승인 후에만 recoverApply().
//   ★ 폴더명 변경(rename) 없음. 원본은 이동/이름변경 안 함.
// ============================================================

// 순수 숫자 나이차가 이 값 이상이면 "다른 학생 의심" → [HOLD](사람 판단).
var RECOVER_HOLD_AGE_GAP = 6;

// 폴더명 "NN세 이름 YYYYMMDD" → { age, name, date8 } 분해
function _recoverParse(full) {
  var m = full.match(/^(\S+세)\s+(.+?)\s+(\d{8})$/);
  if (m) return { age: m[1], name: m[2], date8: m[3] };
  m = full.match(/^(.+?)\s+(\d{8})$/);
  if (m) return { age: '', name: m[1], date8: m[2] };
  return { age: '', name: full, date8: '' };
}

// 순수 숫자 나이만 비교에 사용("13세"→13). "초6세"·"중2세" 학년표기는 null(비교 제외).
function _recoverAgeNum(ageTok) {
  var m = String(ageTok || '').match(/^(\d+)\s*세?$/);
  return m ? parseInt(m[1], 10) : null;
}

// root 하위 모든 날짜폴더(YYYYMMDD) 순회 → 이름별 폴더 목록 인덱싱 (읽기전용)
function _recoverCollect() {
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var byName = {};
  var df = root.getFolders();
  while (df.hasNext()) {
    var d = df.next();
    var dn = d.getName();
    if (!/^\d{8}$/.test(dn)) continue;
    var subs = d.getFolders();
    while (subs.hasNext()) {
      var sf = subs.next();
      var full = sf.getName();
      var p = _recoverParse(full);
      if (!byName[p.name]) byName[p.name] = [];
      byName[p.name].push({ date: dn, full: full, folder: sf, ageNum: _recoverAgeNum(p.age) });
    }
  }
  return byName;
}

// 이름별로 원본/변조본/HOLD 산출 (recoverPlan·recoverApply 공용)
function _recoverGroups() {
  var byName = _recoverCollect();
  var groups = [];
  for (var name in byName) {
    var arr = byName[name];
    if (arr.length < 2) continue; // 한 곳뿐 = 정상, 대상 아님

    // HOLD: 순수 숫자 나이가 RECOVER_HOLD_AGE_GAP 이상 벌어지면 다른 학생 의심
    var nums = arr.map(function (e) { return e.ageNum; }).filter(function (v) { return v !== null; });
    var hold = false, reason = '';
    if (nums.length >= 2) {
      var mn = Math.min.apply(null, nums), mx = Math.max.apply(null, nums);
      if (mx - mn >= RECOVER_HOLD_AGE_GAP) { hold = true; reason = '나이 ' + mn + '~' + mx + '세 격차(다른 학생 의심)'; }
    }

    // 원본 = 가장 오래된 날짜폴더. 동률이면 getDateCreated 이른 것.
    arr.sort(function (a, b) { return a.date.localeCompare(b.date); });
    var minDate = arr[0].date;
    var earliest = arr.filter(function (e) { return e.date === minDate; });
    var origin = earliest[0];
    if (earliest.length > 1) {
      earliest.sort(function (a, b) {
        return a.folder.getDateCreated().getTime() - b.folder.getDateCreated().getTime();
      });
      origin = earliest[0];
    }
    var originId = origin.folder.getId();
    var tampered = arr.filter(function (e) { return e.folder.getId() !== originId; });

    groups.push({ name: name, origin: origin, tampered: tampered, hold: hold, reason: reason });
  }
  return groups;
}

// 변조본 내부 항목 수 세기(읽기전용) — desktop.ini 제외
function _recoverCount(folder) {
  var f = 0, fl = 0;
  var subs = folder.getFolders();
  while (subs.hasNext()) { subs.next(); f++; }
  var files = folder.getFiles();
  while (files.hasNext()) { if (files.next().getName().toLowerCase() !== 'desktop.ini') fl++; }
  return { folders: f, files: fl };
}

// ── 1) dry-run: 계획만 로그 출력 (폴더 변경 0) ──
function recoverPlan() {
  var groups = _recoverGroups();
  var grp = 0, tamp = 0, hold = 0;
  Logger.log('===== [DRY-RUN] 복구 계획 — 폴더 변경 없음 =====');
  groups.forEach(function (g) {
    grp++;
    if (g.hold) {
      hold++;
      var locs = [g.origin].concat(g.tampered).map(function (e) { return e.date + '/' + e.full; }).join('  ||  ');
      Logger.log('[HOLD] ' + g.name + ' | 사유: ' + g.reason + ' | 위치: ' + locs);
      return;
    }
    Logger.log('[GROUP] ' + g.name + ' | 원본(정본·불변): ' + g.origin.date + '/' + g.origin.full);
    g.tampered.forEach(function (t) {
      tamp++;
      var c = _recoverCount(t.folder);
      Logger.log('  [PLAN] 변조본: ' + t.date + '/' + t.full +
        ' | 내부(하위폴더 ' + c.folders + ', 파일 ' + c.files + ')' +
        ' | 처리: 내용→원본 병합 후 변조본 휴지통');
    });
  });
  Logger.log('===== 요약: 그룹 ' + grp + ' / 변조본 ' + tamp + ' / HOLD ' + hold + ' =====');
}

// 변조본(source) 내용을 원본(target)으로 병합 — 같은 이름 하위폴더는 재귀 병합
function _recoverMergeInto(source, target) {
  var subs = source.getFolders();
  while (subs.hasNext()) {
    var sub = subs.next();
    var existing = target.getFoldersByName(sub.getName());
    if (existing.hasNext()) {
      _recoverMergeInto(sub, existing.next()); // 같은 mmdd 존재 → 내용 병합
      sub.setTrashed(true);                    // 비워진 중복 mmdd 휴지통
    } else {
      sub.moveTo(target);                      // 없으면 통째 이동
    }
  }
  var files = source.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().toLowerCase() !== 'desktop.ini') f.moveTo(target);
  }
}

// ── 2) 실제 실행 (승인 후에만) ──
function recoverApply() {
  var groups = _recoverGroups();
  var done = 0, fail = 0, hold = 0;
  Logger.log('===== [APPLY] 복구 실행 =====');
  groups.forEach(function (g) {
    if (g.hold) { hold++; Logger.log('[HOLD-SKIP] ' + g.name + ' | ' + g.reason); return; }
    g.tampered.forEach(function (t) {
      try {
        _recoverMergeInto(t.folder, g.origin.folder);
        t.folder.setTrashed(true);
        done++;
        Logger.log('[DONE] ' + g.name + ' | 변조본 ' + t.date + '/' + t.full +
          ' → 원본 ' + g.origin.date + '/' + g.origin.full + ' 병합완료');
      } catch (e) {
        fail++;
        Logger.log('[FAIL] ' + g.name + ' | ' + t.date + '/' + t.full + ' | ' + e.message);
      }
    });
  });
  Logger.log('===== 요약: 완료 ' + done + ' / 실패 ' + fail + ' / HOLD건너뜀 ' + hold + ' =====');
}
