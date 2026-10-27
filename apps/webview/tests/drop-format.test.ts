import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatDropText, isCompleteBody, parseDropText, splitPoints } from '../src/lib/drop-format.ts';

const sample = `앞에 붙은 잡담은 무시한다
@@hook
훅 문장
@@concept
개념 설명
여러 줄
@@example
예시
@@takeaway
요약`;

test('표식으로 섹션을 나눈다', () => {
  const body = parseDropText(sample);
  assert.equal(body.hook, '훅 문장');
  assert.equal(body.concept, '개념 설명\n여러 줄');
  assert.equal(body.connection, undefined);
  assert.ok(isCompleteBody(body));
});

test('스트리밍 중인 부분 텍스트도 읽는다', () => {
  const body = parseDropText('@@hook\n훅\n@@concept\n개념 일부');
  assert.equal(body.concept, '개념 일부');
  assert.equal(isCompleteBody(body), false);
});

test('format → parse 왕복', () => {
  const body = { hook: 'a', concept: 'b', example: 'c', connection: 'd', takeaway: 'e' };
  assert.deepEqual(parseDropText(formatDropText(body)), body);
});

test('정리하기 개조식: 표식으로 읽고 항목으로 나눈다', () => {
  const body = parseDropText(`${sample}\n@@points\n- 첫째\n• 둘째\n\n* 셋째`);
  assert.equal(body.takeaway, '요약');
  assert.deepEqual(splitPoints(body.points), ['첫째', '둘째', '셋째']);
  assert.deepEqual(splitPoints(undefined), []);
});
