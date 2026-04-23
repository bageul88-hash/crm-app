# 📱 Capacitor 안드로이드 앱 빌드 가이드

## 사전 준비 (최초 1회)

### 1. Android Studio 설치
https://developer.android.com/studio 에서 다운로드 후 설치

### 2. Java JDK 설치 (17 권장)
https://adoptium.net 에서 JDK 17 설치

### 3. 환경 변수 확인
Android Studio 설치 후 아래 경로가 환경변수에 있어야 함:
- ANDROID_HOME = `C:\Users\[사용자명]\AppData\Local\Android\Sdk`
- PATH에 `%ANDROID_HOME%\tools` 추가

---

## 앱 빌드 순서

### Step 1. 패키지 설치
```bash
cd crm-app
npm install
```

### Step 2. React 빌드
```bash
npm run build
```
→ `dist/` 폴더 생성됨

### Step 3. Capacitor Android 프로젝트 초기화 (최초 1회만)
```bash
npx cap add android
```
→ `android/` 폴더 생성됨

### Step 4. 네이티브 플러그인 파일 복사 (최초 1회만)
아래 두 파일을 `android/app/src/main/java/com/pentwo/crmapp/` 에 복사:
- `android/app/src/main/java/com/pentwo/crmapp/CallPlugin.java`
- `android/app/src/main/java/com/pentwo/crmapp/MainActivity.java`

AndroidManifest.xml 교체:
- `android/app/src/main/AndroidManifest.xml` 을 제공된 파일로 교체

### Step 5. Capacitor 동기화
```bash
npx cap sync android
```

### Step 6. Android Studio에서 열기
```bash
npx cap open android
```

### Step 7. APK 빌드
Android Studio에서:
1. `Build` 메뉴 → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. 빌드 완료 후 `locate` 클릭
3. APK 파일을 삼성 갤럭시에 전송해서 설치

---

## React 코드 수정 후 업데이트

```bash
npm run build        # React 재빌드
npx cap sync android # 안드로이드에 반영
```
Android Studio에서 다시 Run (▶) 하면 됨

---

## 통화 자동 감지 동작 흐름

```
부모님과 통화 (발신/수신)
    ↓
통화 종료 (3초 이상 연결된 경우만)
    ↓
앱 하단에 배너 팝업
  "통화 종료 · 010-XXXX-XXXX · 2분 30초"
  [건너뛰기]  [📋 상담 등록하기]
    ↓
"상담 등록하기" 탭
    ↓
전화번호 자동 입력된 상담 폼 열림
    ↓
나머지 항목 채우고 저장
    ↓
구글시트에 자동 저장 + 각 탭 자동 분배
```

---

## 권한 안내 (앱 최초 실행 시)

앱 설치 후 첫 실행 시 권한 요청 팝업이 나타납니다:
- **전화 상태 읽기** → 통화 감지에 필요
- **통화 기록 읽기** → 번호 확인에 필요
- **발신 전화 처리** → 발신 번호 확인에 필요

모두 **허용** 해야 통화 자동 감지가 작동합니다.

> ⚠️ 삼성 갤럭시의 경우 설정 → 앱 → 상담CRM → 권한 에서도 확인 가능

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| 빌드 오류 (SDK not found) | Android Studio에서 SDK 설치 확인 |
| 통화 감지 안 됨 | 앱 권한 → 전화 → 허용 확인 |
| 배너가 안 뜸 | 배터리 최적화 → 상담CRM → 최적화 안 함 설정 |
| 데이터 안 불러와짐 | Apps Script 재배포 후 URL 확인 |
