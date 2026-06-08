/**
 * 드라이브 출석 자동화
 *
 * doPost는 Code.gs에 통합되었습니다.
 * 이 파일은 함수만 정의하며, Code.gs의 doPost에서 studentFolderName
 * 파라미터가 감지되면 여기의 onAttendanceCheck()를 호출합니다.
 */

const ROOT_FOLDER_ID = '1TzxBdF3G17llAd5-_pGEKBakFvmi41aH';

function onAttendanceCheck(studentFolderName, attendDate) {
  const todayStr = attendDate.replace(/-/g, '');
  const mmdd     = attendDate.slice(5).replace('-', '');

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const root        = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const todayFolder = getOrCreate(root, todayStr);

    const alreadyToday = todayFolder.getFoldersByName(studentFolderName);
    let studentFolder;
    if (alreadyToday.hasNext()) {
      studentFolder = alreadyToday.next();
      getOrCreate(studentFolder, mmdd);
      return { status: 'ALREADY_CHECKED', message: '오늘 이미 출석 처리됨' };
    }

    const candidates = findStudent(root, studentFolderName, todayStr);

    if (candidates.length > 1) {
      const quarantine = getOrCreate(root, '_중복확인필요');
      for (let i = 1; i < candidates.length; i++) {
        candidates[i].folder.moveTo(quarantine);
      }
      MailApp.sendEmail(
        'admin@yourdomain.com',
        '[출석오류] 중복 폴더 발견: ' + studentFolderName,
        '중복 폴더: ' + candidates.map(c => c.date).join(', ') +
        '\n_중복확인필요 폴더로 격리되었습니다.'
      );
    }

    if (candidates.length > 0) {
      studentFolder = candidates[0].folder;
      studentFolder.moveTo(todayFolder);
    } else {
      studentFolder = todayFolder.createFolder(studentFolderName);
    }

    getOrCreate(studentFolder, mmdd);
    return { status: 'SUCCESS', message: '출석 처리 완료' };

  } catch (e) {
    return { status: 'ERROR', message: e.message };

  } finally {
    lock.releaseLock();
  }
}

function findStudent(root, name, todayStr) {
  const iter  = root.getFolders();
  const found = [];
  while (iter.hasNext()) {
    const f = iter.next();
    const n = f.getName();
    if (n === todayStr || !/^\d{8}$/.test(n)) continue;
    const sub = f.getFoldersByName(name);
    if (sub.hasNext()) found.push({ date: n, folder: sub.next() });
  }
  found.sort((a, b) => b.date.localeCompare(a.date));
  return found;
}

function getOrCreate(parent, name) {
  const f = parent.getFoldersByName(name);
  return f.hasNext() ? f.next() : parent.createFolder(name);
}
