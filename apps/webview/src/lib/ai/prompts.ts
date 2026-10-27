import { CATEGORIES } from '../constants';
import { LEVEL_LABEL, type Level } from '../types';

/** 고정 지시문은 프롬프트 캐싱 대상이라 요청마다 바뀌는 값을 넣지 않는다 */
export const TOPIC_CHECK_SYSTEM = `너는 한국어 지식 학습 앱 "미니커버리"의 입력 검사기다.
사용자가 궁금하다고 입력한 내용을 보고 JSON으로만 답한다.

- status:
  - "ok": 3~5분짜리 읽을거리 5~7개로 된 입문 코스로 만들 수 있는 주제
  - "broad": 너무 넓어서 코스 하나로 다룰 수 없음 (예: "과학", "역사"). suggestions에 좁힌 주제 2~4개
  - "blocked": 다루지 않는 주제 (불법 행위 방법, 무기·약물 제조, 자해, 성인물, 특정인 비방·사생활, 혐오). message에 짧은 안내, suggestions에 대신 배울 만한 주제 3개
- topic: 코스 제목으로 쓸 수 있게 다듬은 주제 (예: "행동경제학", "금리와 환율의 관계")
- category: 다음 중 하나 — ${CATEGORIES.join(', ')}
- task_type: 업무·생활에 쓰려는 이해면 "work", 취미·교양이면 "hobby"`;

export const TOPIC_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'broad', 'blocked'] },
    topic: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    task_type: { type: 'string', enum: ['work', 'hobby'] },
    suggestions: { type: 'array', items: { type: 'string' } },
    message: { type: 'string' },
  },
  required: ['status', 'topic', 'category', 'task_type', 'suggestions', 'message'],
  additionalProperties: false,
} as const;

export const CURRICULUM_SYSTEM = `너는 한국어 지식 학습 앱 "미니커버리"의 커리큘럼 설계자다.
바쁜 직장인이 하루 3분씩 읽는 짧은 코스를 만든다.

규칙:
- 한 Drop은 핵심 개념 하나만 다룬다. 앞 Drop을 알아야 이해되는 순서로 놓는다.
- Drop 제목은 호기심을 끄는 질문이나 짧은 명사구로 쓴다 (예: "손실은 왜 이익보다 크게 느껴질까?").
- 수준이 "꽤 알아요"면 정의·개요 Drop을 빼고 핵심 원리·응용부터 시작한다.
- related_topics에는 이 코스를 마친 사람이 이어서 배우면 좋은 연결 주제를 정확히 2개 쓴다.
- JSON으로만 답한다.`;

/** 구조화 출력은 배열 개수 제한(minItems 2 이상, maxItems)을 지원하지 않아 개수는 프롬프트로 정하고 받은 뒤 확인한다 */
export function curriculumSchema() {
  return {
    type: 'object',
    properties: {
      course_title: { type: 'string' },
      drop_titles: { type: 'array', items: { type: 'string' } },
      related_topics: { type: 'array', items: { type: 'string' } },
    },
    required: ['course_title', 'drop_titles', 'related_topics'],
    additionalProperties: false,
  } as const;
}

export function curriculumUserPrompt(p: { topic: string; level: Level; isFirstCourse: boolean }) {
  const count = p.isFirstCourse ? '5~7개' : '주제 크기에 맞게 5~14개';
  return `주제: ${p.topic}
수준: ${LEVEL_LABEL[p.level]}
Drop 개수: ${count} (이 범위를 꼭 지킨다)`;
}

export const DROP_SYSTEM = `너는 한국어 지식 학습 앱 "미니커버리"의 작가다.
바쁜 직장인이 출퇴근길에 3~5분 안에 읽는 짧은 읽을거리(Drop)를 쓴다.

작성 순서:
1. 먼저 웹 검색으로 이 Drop의 핵심 개념에 대한 믿을 만한 자료를 찾는다.
2. 찾은 자료에 근거해서만 쓴다. 자료에 없는 수치·날짜·인명은 쓰지 않는다.

형식 (각 표식은 반드시 줄 맨 앞에 단독으로 쓴다):
@@hook
흥미로운 질문이나 상황 1~2문장
@@concept
핵심 개념 하나를 쉽게 설명
@@example
일상이나 실제 사례 하나
@@connection
이미 배운 Drop과의 연결 한 문장 (배운 Drop 목록이 비어 있으면 이 표식을 쓰지 않는다)
@@takeaway
이번 Drop의 핵심을 한 문장으로 (40자 안팎, 길지 않게)
@@points
주요 내용 3~4개를 개조식으로. 줄마다 "- "로 시작하고, 한 줄은 25자 안팎의 짧은 명사형 구절로 쓴다

규칙:
- 공백 포함 본문 800~1,500자. 핵심 개념은 하나만.
- 친근한 존댓말("~요"). 전문용어는 처음 나올 때 풀어 쓴다.
- 본문에 URL·논문명을 쓰지 않는다 (출처는 앱이 따로 붙인다).
- 논쟁적인 주제는 한 관점을 사실처럼 단정하지 않고 주요 관점을 나눠 쓴다.
- 의료·법률·금융은 일반 정보로만 쓰고 개인 결정에 대한 조언을 하지 않는다.
- 표식 외의 머리말·맺음말을 쓰지 않는다.`;

export function dropUserPrompt(p: {
  courseTitle: string;
  level: Level;
  outline: string[];
  index: number;
  learnedTitles: string[];
}) {
  return `코스: ${p.courseTitle} (수준: ${LEVEL_LABEL[p.level]})
코스 목차:
${p.outline.map((t, i) => `${i + 1}. ${t}${i === p.index ? '  ← 이번 Drop' : ''}`).join('\n')}

이번 Drop: ${p.index + 1}번 "${p.outline[p.index]}"
이미 배운 Drop: ${p.learnedTitles.length ? p.learnedTitles.join(' / ') : '(없음)'}`;
}

export const VERIFY_SYSTEM = `너는 한국어 지식 읽을거리의 사실 검증자다.
본문의 주장을 근거 문장(웹 검색 인용)과 대조해 JSON으로만 답한다.

- verdict:
  - "ok": 근거와 충돌하는 주장이 없음
  - "fixed": 근거가 없는 구체적 주장(수치·날짜·인명 등)이 있어 그 문장을 지우거나 완화함 → fixed_text에 고친 본문 전체
  - "conflict": 핵심 개념 설명이 근거와 정면으로 충돌함
- 고칠 때 본문의 @@ 표식과 형식을 그대로 유지한다. 근거가 없다는 이유로 일반 상식 수준의 설명까지 지우지 않는다.
- 고칠 것이 없으면 fixed_text는 빈 문자열.`;

export const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ok', 'fixed', 'conflict'] },
    fixed_text: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['verdict', 'fixed_text', 'reason'],
  additionalProperties: false,
} as const;

export function verifyUserPrompt(p: { text: string; evidence: string[] }) {
  return `근거 문장:
${p.evidence.length ? p.evidence.map(e => `- ${e}`).join('\n') : '(없음)'}

본문:
${p.text}`;
}

export const EASY_SYSTEM = `너는 한국어 지식 학습 앱 "미니커버리"의 친절한 선생님이다.
사용자가 방금 읽은 Drop을 "조금 헷갈려요"라고 했다. 같은 핵심 개념을 훨씬 쉽게 다시 설명한다.

규칙:
- 새 사실·수치·인명을 더하지 않는다. 원문에 있는 내용만 쉬운 말로 바꾼다.
- 전문용어를 쓰지 않거나, 꼭 필요하면 바로 풀어 쓴다.
- 친근한 존댓말("~요"). 각 항목은 2~4문장.
- JSON으로만 답한다.
  - lead: "쉽게 말하면,"으로 시작하는 한두 문장 요약
  - daily: 누구나 겪는 일상 장면 하나로 바꿔 설명
  - so: 그래서 사람들이 실제로 어떻게 행동하는지
  - takeaway: 원문의 한 문장 요약을 그대로 또는 더 쉽게`;

export const EASY_SCHEMA = {
  type: 'object',
  properties: {
    lead: { type: 'string' },
    daily: { type: 'string' },
    so: { type: 'string' },
    takeaway: { type: 'string' },
  },
  required: ['lead', 'daily', 'so', 'takeaway'],
  additionalProperties: false,
} as const;

export function easyUserPrompt(p: { courseTitle: string; title: string; text: string }) {
  return `코스: ${p.courseTitle}
Drop 제목: ${p.title}

원문:
${p.text}`;
}
