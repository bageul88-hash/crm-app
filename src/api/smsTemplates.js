/**
 * 문자 템플릿 모음
 * {date}     → 진단예약일 (예: 2026-04-21)
 * {dateKr}   → 진단예약일 한국어 (예: 04월 21일)
 * {day}      → 진단요일 (예: 화요일)
 * {time}     → 진단예약시간 (예: 오후 6:00)
 * {name}     → 고객 이름
 */

const FOOTER_CAR = `♡승용차
네이게이션 검색어 :
한신인터밸리24 주차장 검색해서 오시면 편리하게 오실 수 있습니다.(안내요원 있음)
동관 3층 315호`

const FOOTER_BUS = `♡대중교통
2호선 선릉역4번출구 직진 80m 좌측
한신인터밸리24 3층 315호
(1층·3층 안내데스크 있음)`

const FOOTER_ALL = `**오시는길 안내**
${FOOTER_CAR}

${FOOTER_BUS}`

const INTRO_FULL = `참바른글씨
대한민국 최다! 방송사 소개
최다저서.조선일보사,길벗출판사,등
또박또박 예쁜글씨(길벗) 14만부 판매 돌파 저자
전국17곳 캠퍼스 본사 대표 직강`

const INTRO_EXAM = `참바른글씨
대한민국 최다! 방송사 소개
최다저서.조선일보사,길벗출판사,등
또박또박 예쁜글씨(길벗) 12만부 돌파 저자
전국16곳 캠퍼스 본사 대표 직강`

// ─────────────────────────────────────────────
// 템플릿 정의
// key: "구분_관계유형"
// ─────────────────────────────────────────────
export const SMS_TEMPLATES = {

  // ── 학생 예약 ──────────────────────────────
  '예약_학생': {
    label: '학생 진단·예약',
    body: (v) => `학생 진단 및 상담 예약
${INTRO_FULL}

{dateKr}
({day}) {time}

*준비물*
평상시 필기한
한글노트.영어노트.
또는 참고서 각각1권
필통,지참 필수

*테스트.진단.결과 당일상담
*진단테스트및 필체,습관분석
상담유료*일만원
(40~50분)소요

참바른글씨
TEL02-558-4111
감사합니다^^

${FOOTER_ALL}
pentwo.com`,
  },

  // ── 일반인 예약 ────────────────────────────
  '예약_일반': {
    label: '일반인 진단·예약',
    body: (v) => `일반인 진단 및 상담 예약
${INTRO_FULL}

{dateKr}
({day}) {time}

*테스트.진단.결과 당일상담
*진단테스트및 필체,습관분석
테스트및 상담유료*일만원
(40~50분)소요

참바른글씨
TEL02-558-4111
pentwo.com

${FOOTER_ALL}`,
  },

  // ── 고시생 예약 ────────────────────────────
  '예약_고시생': {
    label: '고시생 진단·예약',
    body: (v) => `고시생 진단 및 상담 예약
${INTRO_EXAM}

{dateKr}
({day}) {time}

*테스트.진단.결과 당일상담
*진단테스트및 필체,습관분석
상담,및 진단테스트
유료*일만원
(40~50분)소요

*준비물 지참*
평상시 필기한 노트,
또는 모의고사 필기한 답안지

참바른글씨
TEL02-558-4111
감사합니다^^

${FOOTER_ALL}
pentwo.com`,
  },

  // ── 학생 문의 ──────────────────────────────
  '문의_학생': {
    label: '학생 문의',
    body: (v) => `학생 문의 안내
${INTRO_FULL}

♡상담 예약 필수♡

*테스트.진단.결과 당일상담
*진단테스트및 필체,습관분석

상담,테스트유료*일만원
(40~50분)소요

*준비물*
평상시 필기한
수학 참고서 1권
필통,지참 필수

참바른글씨 홈페이지
pentwo.com
TEL02-558-4111
감사합니다^^

${FOOTER_ALL}`,
  },

  // ── 일반인 문의 ────────────────────────────
  '문의_일반': {
    label: '일반인 문의',
    body: (v) => `일반인 문의 안내
${INTRO_FULL}

♡상담 예약 필수♡

*테스트.진단.결과 당일상담
*진단테스트및 필체,습관분석

상담,및 진단테스트
유료*일만원
(40~50분)소요

참바른글씨
TEL02-558-4111
감사합니다^^

${FOOTER_ALL}`,
  },

  // ── 고시생 문의 ────────────────────────────
  '문의_고시생': {
    label: '고시생 문의',
    body: (v) => `고시생 문의 안내
${INTRO_EXAM}

♡상담 예약 필수♡

*테스트.진단.결과 당일상담
*진단테스트및 필체,습관분석

상담,및 진단테스트
유료*일만원
(40~50분)소요

*준비물 지참*
평상시 필기한 노트,
또는 모의고사 필기한 답안지

참바른글씨
TEL02-558-4111
감사합니다^^

${FOOTER_ALL}
pentwo.com`,
  },

  // ── 가맹 문의 ──────────────────────────────
  '가맹_가맹': {
    label: '가맹 문의',
    body: (v) => `가맹 문의 안내
참바른글씨
대한민국 최다! 방송사 소개
최다저서.조선일보사,길벗출판사,등
또박또박 예쁜글씨(길벗) 14만부 판매 돌파 저자
전국16곳 캠퍼스
노트지면을 보지 않고 필기하는
뇌과학 글씨교정 창시자
대표 유성영

♡가맹 상담 예약♡
{dateKr}
({day}) {time}

참바른글씨 홈피
pentwo.com
시각장애인을 위한 한글쓰기 홈피
hunmaeng.com

TEL02-558-4111
감사합니다^^

${FOOTER_ALL}
pentwo.com`,
  },
}

// ─────────────────────────────────────────────
// 템플릿 선택 로직
// category(구분) + relation(관계) → 가장 맞는 템플릿 키 반환
// ─────────────────────────────────────────────
export function pickTemplateKey(category, relation) {
  const cat = category || ''
  const rel = relation || ''

  // 가맹
  if (cat === '가맹') return '가맹_가맹'

  // 고시생 판단 (관계가 본인이고 20대이상, 또는 직접 고시생 관계)
  const isExam = rel.includes('고시') || rel === '본인'

  // 예약
  if (cat === '예약') {
    if (isExam) return '예약_고시생'
    // 학생: 어머니/아버지/할머니/할아버지/일반남/일반여 → 학생
    const isParent = ['어머니','아버지','할머니','할아버지'].includes(rel)
    return isParent ? '예약_학생' : '예약_일반'
  }

  // 문의
  if (cat === '문의') {
    if (isExam) return '문의_고시생'
    const isParent = ['어머니','아버지','할머니','할아버지'].includes(rel)
    return isParent ? '문의_학생' : '문의_일반'
  }

  // 기타 → 일반 문의
  return '문의_일반'
}

// ─────────────────────────────────────────────
// 변수 치환 함수
// ─────────────────────────────────────────────
export function buildSmsBody(templateKey, consult) {
  const tmpl = SMS_TEMPLATES[templateKey]
  if (!tmpl) return ''

  const raw = tmpl.body(consult)

  // 날짜 포맷 변환 (20260421 or 2026-04-21 → 04월 21일)
  let dateKr = ''
  let dateRaw = consult.diagDate || ''
  if (dateRaw) {
    const clean = dateRaw.replace(/-/g, '')
    if (clean.length === 8) {
      dateKr = `${clean.slice(4, 6)}월 ${clean.slice(6, 8)}일`
    }
  }

  return raw
    .replace(/\{dateKr\}/g, dateKr || consult.diagDate || '날짜 미정')
    .replace(/\{date\}/g,   consult.diagDate   || '')
    .replace(/\{day\}/g,    consult.diagDay    || '')
    .replace(/\{time\}/g,   consult.diagTime   || '')
    .replace(/\{name\}/g,   consult.name       || '')
}
