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
export const PLUS_PRICE_LABEL = '월 3,900원';
export const PLUS_PRODUCT_ID = 'com.minicovery.plus.monthly';

/** 캐릭터 단계: 다 배운 주제 수 기준 */
export const STAGES = [
  { key: 'rabbit', name: '토끼', min: 0 },
  { key: 'cat', name: '고양이', min: 3 },
] as const;
