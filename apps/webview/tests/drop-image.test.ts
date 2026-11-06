import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dropImagePrompt, imageRetryable } from '../src/lib/ai/image.ts';
import { CATEGORIES, CATEGORY_COLOR } from '../src/lib/constants.ts';

test('모든 분야(+기타)에 그림 포인트 색이 있다', () => {
  for (const c of [...CATEGORIES, '기타']) {
    assert.match(CATEGORY_COLOR[c]?.hex ?? '', /^#[0-9A-F]{6}$/, c);
    assert.ok(CATEGORY_COLOR[c]?.name, c);
  }
});

test('그림 지시에 분야 색 하나와 Drop 제목·정리 한 줄이 들어간다', () => {
  const p = dropImagePrompt('잃는 게 더 아픈 이유: 손실 회피', '잃는 아픔은 얻는 기쁨보다 약 두 배 크다.', CATEGORY_COLOR['경제·금융']!);
  assert.match(p, /exactly one accent color, bright green \(#10C45C\)/);
  assert.match(p, /Lesson title: 잃는 게 더 아픈 이유: 손실 회피/);
  assert.match(p, /Key point: 잃는 아픔은/);
  assert.match(p, /No text, no letters/);
});

test('그림 재시도: 없으면 그리고, 만드는 중(15분 안)·세 번 실패·이미 있으면 건너뛴다', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  assert.equal(imageRetryable({}, now), true);
  assert.equal(imageRetryable({ image: { url: 'https://x/y.webp', at: ago(60), tries: 1 } }, now), false);
  assert.equal(imageRetryable({ image: { at: ago(5), tries: 1 } }, now), false);
  assert.equal(imageRetryable({ image: { at: ago(20), tries: 1 } }, now), true);
  assert.equal(imageRetryable({ image: { at: ago(20), tries: 3 } }, now), false);
});
