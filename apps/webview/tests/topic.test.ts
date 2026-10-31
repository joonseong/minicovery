import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeTopic } from '../src/lib/util.ts';

test('주제 정규화: 앞뒤 공백, 연속 공백, 대소문자', () => {
  assert.equal(normalizeTopic('  행동  경제학 '), '행동 경제학');
  assert.equal(normalizeTopic('UX\t심리학\n입문'), 'ux 심리학 입문');
  assert.equal(normalizeTopic('Roman History'), normalizeTopic('roman   history'));
  assert.notEqual(normalizeTopic('와인'), normalizeTopic('와인 역사'));
});
