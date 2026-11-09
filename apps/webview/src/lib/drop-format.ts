import type { Drop, DropBody } from './types';

/**
 * Drop 본문은 스트리밍 중에도 섹션별로 그릴 수 있게 줄 머리 표식으로 나눈다.
 * 서버(저장)와 클라이언트(스트리밍 표시)가 같이 쓴다.
 */
export const SECTION_MARKERS = {
  hook: '@@hook',
  concept: '@@concept',
  example: '@@example',
  connection: '@@connection',
  takeaway: '@@takeaway',
  points: '@@points',
} as const;

export type SectionKey = keyof typeof SECTION_MARKERS;

const MARKER_RE = /^@@(hook|concept|example|connection|takeaway|points)\s*$/gm;

export function parseDropText(text: string): Partial<DropBody> {
  const body: Partial<DropBody> = {};
  const matches = [...text.matchAll(MARKER_RE)];
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length;
    const value = stripMemo(text.slice(start, end).trim());
    if (value) body[m[1] as SectionKey] = value;
  });
  return body;
}

/**
 * 모델이 본문 끝에 붙인 편집자·작성자용 메모 (검색 한도를 넘었을 때 "게시 전에 출처 확인해 주세요" 같은 글).
 * 사용자에게 보이면 안 된다 (2026-11-10 발견: 정리하기·한 문장에 18편). 메모 문단은 '---', '(', '※', '**', '참고'로
 * 시작하고 그 뒤에 메모 표현이 있다. 그런 문단부터 끝까지 잘라 낸다. 본문 중간의 일반 문단은 건드리지 않는다
 */
const MEMO_START = /^(-{3,}|\(|※|\*\*|참고)/;
// '편집자'·'작성자'만으로는 판단하지 않는다 (본문이 그 말을 다룰 수 있다). 검색 실패·게시 전 확인 요청 표현이 있어야 메모다
const MEMO_WORDS = /(검색 도구|웹 검색|검색이 되면|발행 전|게시 전|게재 전|게시하기 전|출처를 붙이기 전|출처 확인)/;

export function stripMemo(value: string): string {
  const paras = value.split(/\n\s*\n/);
  for (let i = 0; i < paras.length; i++) {
    if (MEMO_START.test(paras[i]!.trim()) && MEMO_WORDS.test(paras.slice(i).join('\n\n'))) {
      return paras.slice(0, i).join('\n\n').trim();
    }
  }
  return value;
}

/** 저장된 Drop을 읽을 때 본문의 메모를 걷어 낸다 (이미 저장된 글도 화면에 메모가 나오지 않게) */
export function cleanDrop<T extends Drop | null>(drop: T): T {
  if (!drop?.body) return drop;
  const body = { ...drop.body } as DropBody;
  let changed = false;
  for (const k of Object.keys(body) as (keyof DropBody)[]) {
    const v = body[k];
    if (typeof v !== 'string') continue;
    const cleaned = stripMemo(v);
    if (cleaned !== v) {
      (body as unknown as Record<string, string>)[k] = cleaned;
      changed = true;
    }
  }
  return changed ? ({ ...drop, body } as T) : drop;
}

/** '@@points' 본문을 항목 배열로: 줄머리 '-', '•', '*' 는 떼고 빈 줄은 버린다 */
export function splitPoints(points?: string): string[] {
  return (points ?? '')
    .split('\n')
    .map(l => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export function isCompleteBody(body: Partial<DropBody>): body is DropBody {
  return Boolean(body.hook && body.concept && body.example && body.takeaway);
}

export function formatDropText(body: DropBody): string {
  return (Object.keys(SECTION_MARKERS) as SectionKey[])
    .filter(k => body[k])
    .map(k => `${SECTION_MARKERS[k]}\n${body[k]}`)
    .join('\n\n');
}

/** 화면 표시용 글자 수 기반 소요 시간 (분). 실측으로 보정 예정 (PRD §11) */
export function estimateMinutes(body?: Partial<DropBody>): number {
  if (!body) return 3;
  const chars = Object.values(body).join('').length;
  return Math.max(2, Math.min(5, Math.round(chars / 400)));
}
