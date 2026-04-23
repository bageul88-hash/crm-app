# 상담 CRM 앱

## 📁 프로젝트 구조

```
crm-app/
├── src/
│   ├── api/sheets.js          ← Apps Script URL · 컬럼 매핑 (여기만 수정)
│   ├── context/AppContext.jsx ← 전역 상태 관리
│   ├── pages/
│   │   ├── ListPage.jsx       ← 상담 목록 + 탭 + 검색
│   │   ├── InputPage.jsx      ← 신규 등록 / 수정 폼
│   │   ├── SchedulePage.jsx   ← 진단 예약일 기준 보기
│   │   ├── SMSPage.jsx        ← 문자 발송 대상 추출
│   │   └── DetailPage.jsx     ← 상담 상세 + 삭제 + 전화
│   └── components/
│       └── ConsultCard.jsx    ← 목록 카드 컴포넌트
├── appscript/
│   └── Code.gs                ← Google Apps Script (시트에 붙여넣기)
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 시작하기 (VS Code)

### 1. 터미널에서 실행
```bash
cd crm-app
npm install
npm run dev
```
→ 브라우저에서 http://localhost:3000 열기

---

## ⚙️ 구글시트 연동 설정

### Step 1. Apps Script 코드 적용
기존 Apps Script 편집기를 열고 `appscript/Code.gs` 내용을 **교체**합니다.

> ⚠️ 기존 코드와 새 코드의 컬럼 순서가 다를 경우,  
> `Code.gs` 상단의 `COLS` 객체를 실제 시트 열 순서에 맞게 수정하세요.

### Step 2. 시트 이름 확인
`Code.gs` 1번째 줄:
```js
var SHEET_NAME = '상담DB'
```
실제 시트 탭 이름과 동일하게 맞춰주세요.

### Step 3. 컬럼 순서 확인 (중요!)
현재 기본값:
```
A=id  B=구분  C=이름  D=문의일  E=문의요일  F=나이  G=남여
H=진단예약일  I=진단요일  J=진단예약시간  K=진단결과  L=관계  M=특징  N=전화번호
```
시트 열 순서가 다르면 `src/api/sheets.js`의 `FIELD_MAP`도 함께 수정하세요.

### Step 4. Apps Script 재배포
Apps Script 편집기 → 배포 → 배포 관리 → **새 버전으로 배포**

---

## 📱 모바일 앱처럼 사용하기

휴대폰 브라우저에서 배포 URL 접속 후:
- **안드로이드**: 메뉴 → "홈 화면에 추가"
- **아이폰**: 공유 → "홈 화면에 추가"

---

## 🔧 주요 수정 포인트

| 파일 | 수정 내용 |
|------|-----------|
| `src/api/sheets.js` | URL, FIELD_MAP 컬럼 순서 |
| `appscript/Code.gs` | SHEET_NAME, COLS 컬럼 순서 |
| `src/api/sheets.js` | OPTIONS (드롭다운 선택지) |

---

## 📦 배포 (Netlify 무료 호스팅)

```bash
npm run build
# dist/ 폴더를 netlify.com에 드래그&드롭
```
