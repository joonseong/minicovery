import type { DropBody } from './types';

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
    const value = text.slice(start, end).trim();
    if (value) body[m[1] as SectionKey] = value;
  });
  return body;
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
