import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMonthsClamped, plusPeriodAt } from '../src/lib/util.ts';

test('addMonthsClamped: 말일이 모자라면 그 달 말일로', () => {
  assert.equal(addMonthsClamped('2026-01-31T09:00:00.000Z', 1), '2026-02-28T09:00:00.000Z');
  assert.equal(addMonthsClamped('2028-01-31T09:00:00.000Z', 1), '2028-02-29T09:00:00.000Z');
  assert.equal(addMonthsClamped('2026-10-31T09:00:00.000Z', 1), '2026-11-30T09:00:00.000Z');
  assert.equal(addMonthsClamped('2026-10-31T09:00:00.000Z', 2), '2026-12-31T09:00:00.000Z');
  assert.equal(addMonthsClamped('2026-10-31T09:00:00.000Z', 3), '2027-01-31T09:00:00.000Z');
  // 보통 날짜는 그대로
  assert.equal(addMonthsClamped('2026-10-15T09:00:00.000Z', 1), '2026-11-15T09:00:00.000Z');
  assert.equal(addMonthsClamped('2026-12-15T09:00:00.000Z', 1), '2027-01-15T09:00:00.000Z');
});

test('plusPeriodAt: 10/31 시작 → 11/30 → 12/31 (앵커 고정, 드리프트 없음)', () => {
  const since = '2026-10-31T09:00:00.000Z';
  assert.deepEqual(plusPeriodAt(since, '2026-11-15T00:00:00.000Z'), { start: since, end: '2026-11-30T09:00:00.000Z' });
  assert.deepEqual(plusPeriodAt(since, '2026-12-01T00:00:00.000Z'), { start: '2026-11-30T09:00:00.000Z', end: '2026-12-31T09:00:00.000Z' });
  // 기간 끝 시각이 되면 다음 기간 (end는 포함하지 않는다)
  assert.deepEqual(plusPeriodAt(since, '2026-12-31T09:00:00.000Z'), { start: '2026-12-31T09:00:00.000Z', end: '2027-01-31T09:00:00.000Z' });
  assert.deepEqual(plusPeriodAt(since, '2027-02-10T00:00:00.000Z'), { start: '2027-01-31T09:00:00.000Z', end: '2027-02-28T09:00:00.000Z' });
  // 누적으로 더했다면 11/30 → 12/30 으로 밀렸을 것. 앵커 방식이라 12/31로 돌아온다
  assert.equal(plusPeriodAt(since, '2026-12-30T12:00:00.000Z').end, '2026-12-31T09:00:00.000Z');
});

test('plusPeriodAt: 첫 기간의 start는 저장된 plusSince 문자열 그대로', () => {
  const since = '2026-10-27T01:02:03Z';
  const p = plusPeriodAt(since, '2026-10-28T00:00:00.000Z');
  assert.equal(p.start, since);
  assert.equal(p.end, '2026-11-27T01:02:03.000Z');
});
