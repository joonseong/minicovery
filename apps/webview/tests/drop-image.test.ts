import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dropImagePrompt, imageInProgress, imageRetryable } from '../src/lib/ai/image.ts';
import { CATEGORIES, CATEGORY_COLOR } from '../src/lib/constants.ts';

test('모든 분야(+기타)에 그림 포인트 색이 있다', () => {
  for (const c of [...CATEGORIES, '기타']) {
    assert.match(CATEGORY_COLOR[c]?.hex ?? '', /^#[0-9A-F]{6}$/, c);
    assert.ok(CATEGORY_COLOR[c]?.name, c);
  }
});

test('그림 지시: 분야 색 하나, 해부학 규칙, 제목·정리 한 줄 (정리 한 줄은 있을 때만)', () => {
  const color = CATEGORY_COLOR['경제·금융']!;
  const full = dropImagePrompt({ title: '잃는 게 더 아픈 이유: 손실 회피', point: '잃는 아픔은 얻는 기쁨보다 약 두 배 크다.', course: '행동경제학', color });
  assert.match(full, /exactly one accent color, bright green \(#10C45C\)/);
  assert.match(full, /exactly two arms and two hands/);
  assert.match(full, /Never draw existing characters/);
  assert.match(full, /Course: 행동경제학\nLesson title: 잃는 게 더 아픈 이유: 손실 회피\nKey point: 잃는 아픔은/);
  assert.doesNotMatch(full, /extra simple/);
  const early = dropImagePrompt({ title: '처음 본 숫자에 끌려가는 이유', color, simpler: true });
  assert.doesNotMatch(early, /Key point|Course:/);
  assert.match(early, /extra simple/);
  assert.doesNotMatch(early, /\n\n\n/);
});

test('그림 재시도: 없으면 그리고, 그리는 중(15분 안)·두 번 시도·이미 있으면 건너뛴다', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  assert.equal(imageRetryable({}, now), true);
  assert.equal(imageRetryable({ image: { url: 'https://x/y.webp', at: ago(60), tries: 1 } }, now), false);
  assert.equal(imageInProgress({ image: { at: ago(5), tries: 1 } }, now), true);
  assert.equal(imageRetryable({ image: { at: ago(5), tries: 1 } }, now), false);
  assert.equal(imageRetryable({ image: { at: ago(20), tries: 1 } }, now), true);
  assert.equal(imageRetryable({ image: { at: ago(1), tries: 1, failed: true } }, now), true);
  assert.equal(imageRetryable({ image: { at: ago(20), tries: 2, failed: true } }, now), false);
});
