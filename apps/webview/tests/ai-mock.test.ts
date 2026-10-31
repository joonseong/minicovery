import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MockGenerator, parseScenarios } from '../src/lib/ai/mock.ts';
import type { Generator } from '../src/lib/ai/types.ts';

const params = {
  courseTitle: '행동경제학 입문',
  level: 'beginner' as const,
  outline: ['손실 회피란 무엇일까?', '앵커링 효과'],
  index: 0,
  learnedTitles: [],
  model: 'opus' as const,
};

/** 시나리오를 켜고 지연 없이 돌린 뒤 환경 변수를 되돌린다 */
async function withScenario<T>(value: string, run: () => Promise<T>): Promise<T> {
  const prev = { scenario: process.env.MOCK_SCENARIO, delay: process.env.MOCK_DELAY_MS };
  process.env.MOCK_SCENARIO = value;
  process.env.MOCK_DELAY_MS = '0';
  try {
    return await run();
  } finally {
    if (prev.scenario === undefined) delete process.env.MOCK_SCENARIO;
    else process.env.MOCK_SCENARIO = prev.scenario;
    if (prev.delay === undefined) delete process.env.MOCK_DELAY_MS;
    else process.env.MOCK_DELAY_MS = prev.delay;
  }
}

test('MOCK_SCENARIO는 쉼표 목록, 모르는 값은 무시', () => {
  assert.deepEqual([...parseScenarios('refusal, max_tokens,unknown,')], ['refusal', 'max_tokens']);
  assert.equal(parseScenarios(undefined).size, 0);
  assert.equal(parseScenarios('').size, 0);
});

test('기본 Drop은 완성 본문과 출처를 돌려준다', async () => {
  const m = await withScenario('', () => new MockGenerator().drop(params, {}));
  assert.equal(m.result.refused, false);
  assert.equal(m.result.truncated, undefined);
  assert.ok(m.result.text.includes('@@hook') && m.result.text.includes('@@points'));
  assert.equal(m.result.sources.length, 2);
  assert.equal(m.usage.searches, 1);
});

test('max_tokens: 중간까지 흘려보낸 뒤 truncated, text는 비운다', async () => {
  let streamed = '';
  const m = await withScenario('max_tokens', () => new MockGenerator().drop(params, { text: d => (streamed += d) }));
  assert.equal(m.result.truncated, true);
  assert.equal(m.result.text, '');
  assert.ok(streamed.startsWith('@@hook'));
});

test('no_sources·refusal', async () => {
  const none = await withScenario('no_sources', () => new MockGenerator().drop(params, {}));
  assert.deepEqual(none.result.sources, []);
  const refused = await withScenario('refusal', () => new MockGenerator().drop(params, {}));
  assert.equal(refused.result.refused, true);
});

test('conflict: 검증이 충돌로 끝난다', async () => {
  const g: Generator = new MockGenerator();
  const m = await withScenario('conflict', () => g.verify('', []));
  assert.equal(m.result.verdict, 'conflict');
});

test('batch_pending이면 처리 중, 아니면 결과(잘림은 error)로 끝난다', async () => {
  const g = new MockGenerator();
  const id = await g.submitBatch([{ customId: 'd1', params }]);
  const pending = await withScenario('batch_pending', () => g.pollBatch(id));
  assert.equal(pending.status, 'processing');
  const ended = await withScenario('max_tokens', () => g.pollBatch(id));
  assert.equal(ended.status, 'ended');
  if (ended.status === 'ended') {
    assert.equal(ended.results[0]?.error, 'max_tokens');
    assert.equal(ended.results[0]?.output, undefined);
  }
});
