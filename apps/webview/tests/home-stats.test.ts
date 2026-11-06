import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildHomeStats } from '../src/lib/stats.ts';

// 2026-11-06(금) 12:00 KST
const now = Date.parse('2026-11-06T03:00:00Z');
const kst = (date: string, hh = '10') => new Date(Date.parse(`${date}T${hh}:00:00+09:00`)).toISOString();

test('주: 월~일 막대, 오늘 위치, 오늘까지 이어 읽은 날', () => {
  const s = buildHomeStats([kst('2026-11-06'), kst('2026-11-05'), kst('2026-11-04', '23'), kst('2026-11-02')], 1, now);
  assert.deepEqual(s.week.days, [true, false, true, true, true, false, false]);
  assert.equal(s.week.todayIndex, 4);
  assert.equal(s.week.count, 4);
  assert.equal(s.week.streak, 3);
});

test('연속은 오늘 아직 안 읽었으면 어제부터 센다', () => {
  const s = buildHomeStats([kst('2026-11-05'), kst('2026-11-04')], 0, now);
  assert.equal(s.week.streak, 2);
  assert.equal(buildHomeStats([kst('2026-11-03')], 0, now).week.streak, 0);
});

test('월: 이번 달 수와 지난달 같은 날짜까지와의 차이, 전체', () => {
  const s = buildHomeStats([kst('2026-11-06'), kst('2026-11-01'), kst('2026-10-03'), kst('2026-10-20'), kst('2026-08-01')], 2, now);
  assert.equal(s.month.count, 2);
  assert.equal(s.month.days.length, 30);
  assert.equal(s.month.todayIndex, 5);
  assert.equal(s.month.diff, 1);
  assert.equal(s.all.count, 5);
  assert.equal(s.all.weeks.length, 30);
  assert.equal(s.all.weeks[29], true);
  assert.equal(s.all.learned, 2);
});
