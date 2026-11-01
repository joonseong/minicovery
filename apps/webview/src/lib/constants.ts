/**
 * Knowledge Map 상위 분류 (가안, PRD §13.1 · §33-8 대표 확정 전).
 * AI는 새 주제를 이 목록 중 하나에 배치만 한다.
 */
export const CATEGORIES = [
  '경제·금융',
  '경영·마케팅',
  '정치·사회',
  '역사',
  '철학·종교',
  '심리·행동',
  '과학',
  '기술·AI',
  '건강·의학',
  '환경·지구',
  '우주',
  '수학·논리',
  '언어·글쓰기',
  '문학',
  '미술·디자인',
  '음악',
  '영화·대중문화',
  '음식·와인',
  '여행·지리',
  '스포츠',
  '라이프스타일',
] as const;

export const SUGGESTED_TOPICS = ['행동경제학', '진화론', '와인', '로마 역사', 'UX 심리학', '금리와 환율', '양자역학', '미술사'];

/** Learned 판정: 코스 Drop의 70% 이상 완료 + 완료한 Drop의 "이해했어요" 과반 (PRD §13.2) */
export const LEARNED_COMPLETION_RATIO = 0.7;

/** 하루 실시간 생성 중 Opus로 만드는 개수. 그 뒤로는 Sonnet (PRD §29.3) */
export const DAILY_PREMIUM_REALTIME = 2;

/** 알림을 보내지 않는 시간대 (PRD §17.2) */
export const QUIET_HOURS = { start: '21:00', end: '08:00' };

/** 무료는 코스 1개, Plus는 새 코스 한 달 3개 (2026-10-22 대표 결정) */
export const FREE_COURSE_LIMIT = 1;
export const PLUS_MONTHLY_COURSES = 3;

/** 알림이 꺼진 사용자에게 Drop 완료 뒤 다시 물어보는 간격 */
export const NOTIFY_ASK_INTERVAL_DAYS = 3;
/** 재질문 간격(일): '나중에'·거절 횟수 0 → 3일, 1 → 7일, 2회 이상 → 30일 (2026-10-31 대표 결정 D3) */
export const NOTIFY_ASK_INTERVALS_DAYS = [NOTIFY_ASK_INTERVAL_DAYS, 7, 30] as const;

/** 주제 입력 최대 길이 (StartScreen maxLength와 같다) */
export const TOPIC_MAX_LENGTH = 100;
/** 주제 검사를 통과한 주제를 코스 만들기에 쓸 수 있는 시간·개수 */
export const APPROVED_TOPIC_HOURS = 24;
export const APPROVED_TOPIC_MAX = 10;
/** 같은 IP에서 하루에 코스를 만들 수 있는 익명 사용자 수. 환경 변수 ANON_IP_DAILY_LIMIT로 조정.
 *  기본값은 심사 기간 동안 30(애플 심사팀이 같은 IP에서 여러 기기·재설치로 테스트해도 막히지 않게) — 승인 뒤 5로 되돌릴 것 */
export const ANON_IP_DAILY_LIMIT = Number(process.env.ANON_IP_DAILY_LIMIT) || 30;
/** 로그인 실패 잠금: 15분에 10회 */
export const LOGIN_FAIL_LIMIT = 10;
export const LOGIN_FAIL_WINDOW_MIN = 15;
/** 실시간 생성이 이 시간을 넘기면 멈춘 것으로 보고 다른 요청이 넘겨받는다 */
export const GENERATING_STALE_MIN = 6;
/** App Store 리뷰를 요청하는 누적 완료 편수 */
export const REVIEW_AT_DROPS = [3, 10, 30];
export const PLUS_PRICE_LABEL = '월 3,900원';

/** 고객 문의 (App Store 지원 URL 페이지·약관에 표시) */
export const SUPPORT_EMAIL = 'minimalReading@gmail.com';
export const PLUS_PRODUCT_ID = 'com.minicovery.plus.monthly';

/** 캐릭터 단계: 다 배운 주제 수 기준 */
export const STAGES = [
  { key: 'rabbit', name: '토끼', min: 0 },
  { key: 'cat', name: '고양이', min: 3 },
] as const;
