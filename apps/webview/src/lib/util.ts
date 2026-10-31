import { createHash, randomUUID } from 'node:crypto';

import type { Course, Drop } from './types';

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 날짜 'YYYY-MM-DD' (학습일 판정 기준, PRD §19.1) */
export function kstDate(iso: string | Date = new Date()): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  return new Date(t + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** KST 시각 'HH:mm' */
export function kstTime(iso: string | Date = new Date()): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  return new Date(t + KST_OFFSET_MS).toISOString().slice(11, 16);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(kstDate(toIso)) - Date.parse(kstDate(fromIso))) / 86_400_000);
}

/** KST 요일 (0=일) */
export function kstWeekday(iso: string | Date = new Date()): number {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  return new Date(t + KST_OFFSET_MS).getUTCDay();
}

/** sha256 hex. 짧게 쓰려면 slice */
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/* ---------- 날짜 계산 (순수 함수, tests/에서 검증) ---------- */

/**
 * n달 뒤 같은 날. 말일이 모자라면 그 달 말일로 맞춘다 (1/31 + 1달 = 2/28, 10/31 → 11/30).
 * 날짜 부분만 바꾸고 시각(UTC)은 그대로 둔다
 */
export function addMonthsClamped(iso: string, n: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

/**
 * Plus 혜택을 세는 한 달: 시작일을 앵커로 n달 뒤 ~ n+1달 뒤.
 * 매번 시작일에서 더하므로 말일 클램프가 누적되지 않는다 (10/31 → 11/30 → 12/31)
 */
export function plusPeriodAt(plusSince: string, now: string): { start: string; end: string } {
  let n = 0;
  while (Date.parse(addMonthsClamped(plusSince, n + 1)) <= Date.parse(now)) n++;
  return { start: n === 0 ? plusSince : addMonthsClamped(plusSince, n), end: addMonthsClamped(plusSince, n + 1) };
}

/* ---------- 주제 정규화 ---------- */

/** 주제 검사 통과 목록과 비교할 때: 앞뒤 공백 제거, 연속 공백 하나로, 소문자 */
export const normalizeTopic = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/* ---------- Drop 고르기 (순수 함수) ---------- */

/** 다음 Drop: 아직 완료하지 않았고 건너뛰지(skipped) 않은 첫 Drop. 모든 "다음 Drop" 계산은 이 정의를 쓴다 */
export const nextDrop = <T extends Pick<Drop, 'completedAt' | 'status'>>(drops: T[]) =>
  drops.find(d => !d.completedAt && d.status !== 'skipped');

/** 모든 Drop이 완료 또는 건너뜀이면 코스 완료 (전체 열기에서 마지막 편을 먼저 읽어도 끝나지 않게) */
export const allDropsDone = <T extends Pick<Drop, 'completedAt' | 'status'>>(drops: T[]) =>
  drops.length > 0 && drops.every(d => d.completedAt || d.status === 'skipped');

export type RecallCandidate = Pick<Drop, 'id' | 'courseId' | 'completedAt' | 'title'> & { body?: { takeaway?: string } };

/**
 * 어제 되짚기에 쓸 Drop: 오늘(KST) 전에 완료했고 '한 문장'이 있으며, 코스가 진행 중·완료 상태인 것 중
 * 같은 코스의 직전 완료 Drop을 먼저, 없으면 가장 최근 완료 Drop
 */
export function pickRecallDrop<T extends RecallCandidate>(
  drops: T[],
  courses: Pick<Course, 'id' | 'status'>[],
  current: { id?: string; courseId?: string } | null,
  today = kstDate(),
): T | null {
  const alive = new Set(courses.filter(c => c.status === 'active' || c.status === 'completed').map(c => c.id));
  const done = drops
    .filter(d => d.completedAt && d.id !== current?.id && kstDate(d.completedAt) < today && d.body?.takeaway && alive.has(d.courseId))
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  return (current?.courseId ? done.find(d => d.courseId === current.courseId) : undefined) ?? done[0] ?? null;
}
