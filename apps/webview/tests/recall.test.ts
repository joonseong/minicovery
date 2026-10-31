import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allDropsDone, nextDrop, pickRecallDrop } from '../src/lib/util.ts';

const today = '2026-10-31';
const drop = (id: string, courseId: string, completedAt: string | undefined, takeaway = '한 문장') => ({
  id,
  courseId,
  completedAt,
  title: `${id}: 개념`,
  body: { takeaway },
});
const courses = [
  { id: 'A', status: 'active' as const },
  { id: 'B', status: 'completed' as const },
  { id: 'X', status: 'deleted' as const },
];

test('recall: 같은 코스의 직전 완료 Drop을 먼저 고른다', () => {
  const drops = [
    drop('a1', 'A', '2026-10-28T10:00:00.000Z'),
    drop('b1', 'B', '2026-10-30T10:00:00.000Z'), // 더 최근이지만 다른 코스
    drop('a2', 'A', undefined),
  ];
  assert.equal(pickRecallDrop(drops, courses, { id: 'a2', courseId: 'A' }, today)?.id, 'a1');
});

test('recall: 같은 코스에 없으면 가장 최근 완료 Drop', () => {
  const drops = [drop('a1', 'A', '2026-10-28T10:00:00.000Z'), drop('b1', 'B', '2026-10-30T10:00:00.000Z'), drop('c1', 'C', undefined)];
  assert.equal(pickRecallDrop(drops, [...courses, { id: 'C', status: 'active' as const }], { id: 'c1', courseId: 'C' }, today)?.id, 'b1');
  // 홈 카드: 현재 Drop 없이
  assert.equal(pickRecallDrop(drops, courses, null, today)?.id, 'b1');
});

test('recall: 지운 코스·오늘 읽은 것·지금 Drop·한 문장 없는 것은 뺀다', () => {
  const drops = [
    drop('x1', 'X', '2026-10-30T10:00:00.000Z'), // 지운 코스
    drop('a0', 'A', '2026-10-31T01:00:00.000Z'), // 오늘(KST) 읽음
    drop('a1', 'A', '2026-10-29T10:00:00.000Z', ''), // 한 문장 없음
    drop('a2', 'A', '2026-10-27T10:00:00.000Z'),
    drop('a3', 'A', undefined),
  ];
  assert.equal(pickRecallDrop(drops, courses, { id: 'a3', courseId: 'A' }, today)?.id, 'a2');
  assert.equal(pickRecallDrop([drop('a3', 'A', '2026-10-20T10:00:00.000Z')], courses, { id: 'a3', courseId: 'A' }, today), null);
});

test('다음 Drop: 완료하지 않았고 건너뛰지 않은 첫 Drop · 완주 조건', () => {
  const drops = [
    { id: '1', completedAt: '2026-10-29T00:00:00.000Z', status: 'ready' as const },
    { id: '2', completedAt: undefined, status: 'skipped' as const },
    { id: '3', completedAt: undefined, status: 'pending' as const },
  ];
  assert.equal(nextDrop(drops)?.id, '3');
  assert.equal(allDropsDone(drops), false);
  assert.equal(allDropsDone(drops.slice(0, 2)), true);
  assert.equal(allDropsDone([]), false);
});
