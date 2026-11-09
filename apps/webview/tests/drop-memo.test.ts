import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanDrop, parseDropText, splitPoints, stripMemo } from '../src/lib/drop-format.ts';

// 2026-11-10 운영에서 발견한 실제 꼬리 메모 모양들 (정리하기·한 문장)
const POINTS = '- 역할: AI가 취할 관점\n- 맥락: 배경 설명\n- 형식: 결과물 모양\n- 한 요소부터';

test('정리하기 뒤에 붙은 작성자 메모를 잘라 낸다', () => {
  const cases = [
    `${POINTS}\n\n(작성자 참고: 검색 도구 사용 한도가 초과되어 자료를 확인하지 못했어요. 게시 전에 출처 확인이 필요해요.)`,
    `${POINTS}\n\n---\n※ 편집자 확인 필요: 웹 검색 도구의 사용 한도가 초과돼 근거 자료를 찾지 못했어요.`,
    `${POINTS}\n\n참고: 이번에는 웹 검색 도구를 쓸 수 없어서 출처를 확인하지 못했어요. 게시하기 전에 국세청 자료로 검수해 주세요.`,
    `${POINTS}\n\n---\n\n**검색이 되면 확인할 항목:**\n- **작가 이름:** 확인`,
  ];
  for (const c of cases) {
    assert.equal(stripMemo(c), POINTS);
    assert.equal(splitPoints(stripMemo(c)).length, 4);
  }
});

test('한 문장(takeaway) 뒤 메모도 잘라 낸다', () => {
  const t = '버튼은 크고 가까울수록 빠르게 눌려요.\n\n---\n※ 작성 참고: 이번에는 웹 검색 도구가 사용 한도 초과로 작동하지 않아서 발행 전에 검수해 주세요.';
  assert.equal(stripMemo(t), '버튼은 크고 가까울수록 빠르게 눌려요.');
});

test('일반 본문 문단은 건드리지 않는다', () => {
  const concept = '편집자는 원고를 다듬는 사람이에요.\n\n(예를 들어) 신문사에는 여러 편집자가 있어요.';
  assert.equal(stripMemo(concept), concept);
  assert.equal(stripMemo(POINTS), POINTS);
});

test('스트리밍 글을 해석할 때도, 저장된 Drop을 읽을 때도 메모가 빠진다', () => {
  const body = parseDropText(`@@hook\n질문\n@@concept\n개념\n@@example\n예\n@@takeaway\n한 문장\n@@points\n${POINTS}\n\n(작성 참고: 웹 검색 도구가 작동하지 않아 게재 전에 출처 확인이 필요해요.)`);
  assert.equal(body.points, POINTS);
  const drop = cleanDrop({ id: 'd', courseId: 'c', userId: 'u', index: 0, title: 't', status: 'ready', sources: [], body: { hook: 'h', concept: 'c', example: 'e', takeaway: '한 문장\n\n---\n(편집자 참고: 게시 전에 확인)', points: POINTS } });
  assert.equal(drop.body?.takeaway, '한 문장');
});
