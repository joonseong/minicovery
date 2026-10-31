import type { Usage } from './pricing';
import type { BatchItem, BatchPoll, DropOutput, Generator, Metered } from './types';

/**
 * API 키 없이 화면·흐름을 개발하기 위한 가짜 생성기.
 * 실제와 비슷한 지연과 스트리밍을 흉내 낸다. 토큰 수는 PRD §29.1 가정값.
 * MOCK_SCENARIO=refusal,max_tokens,conflict,no_sources,batch_pending (쉼표 구분)으로 실패 경로를 재현한다.
 */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** pollBatch가 지연 없이 돌릴 때 켠다 (환경 변수는 건드리지 않는다) */
let instant = false;
const delay = () => (instant ? 0 : Number(process.env.MOCK_DELAY_MS ?? 25));

export const MOCK_SCENARIOS = ['refusal', 'max_tokens', 'conflict', 'no_sources', 'batch_pending'] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

/** "refusal, max_tokens" 같은 쉼표 목록을 읽는다. 모르는 값·빈 값은 무시 */
export function parseScenarios(value: string | undefined): Set<MockScenario> {
  const known = new Set<string>(MOCK_SCENARIOS);
  return new Set(
    (value ?? '')
      .split(',')
      .map(s => s.trim())
      .filter((s): s is MockScenario => known.has(s)),
  );
}

const scenario = (s: MockScenario) => parseScenarios(process.env.MOCK_SCENARIO).has(s);

const zeroUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  searches: 0,
});

const BROAD = ['과학', '역사', '경제', '예술', '철학', '기술', '문화', '사회'];
const BLOCKED = ['폭탄', '마약', '해킹 방법', '자살'];

async function streamText(text: string, onText?: (delta: string) => void) {
  for (let i = 0; i < text.length; i += 6) {
    onText?.(text.slice(i, i + 6));
    await sleep(delay());
  }
}

function fakeDrop(courseTitle: string, title: string, index: number, learned: string[]): string {
  const connection = learned.length
    ? `\n\n@@connection\n지난번에 배운 "${learned[learned.length - 1]}"와 이어지는 이야기예요. 같은 원리가 다른 장면에서 어떻게 보이는지 떠올려 보세요.`
    : '';
  return `@@hook
"${title}" — 처음 들으면 어렵게 느껴지지만, 사실 우리는 매일 이 현상을 겪고 있어요. 오늘은 ${courseTitle}의 ${index + 1}번째 이야기를 3분 안에 정리해 볼게요.

@@concept
(가짜 응답) 이 자리에는 실제 서비스에서 Claude가 웹 검색 자료를 바탕으로 쓴 핵심 개념 설명이 들어갑니다. 한 Drop에는 개념을 하나만 담고, 처음 나오는 전문용어는 풀어서 설명해요. 문장은 짧게, 예시는 일상에서 가져옵니다. 길이는 공백 포함 800~1,500자 정도로, 출퇴근길에 한 번에 읽을 수 있는 분량이에요.

@@example
예를 들어 출근길 커피를 고를 때를 떠올려 보세요. 메뉴판 맨 위에 비싼 메뉴가 있으면, 그 아래 중간 가격 메뉴가 왠지 합리적으로 보이죠. 이렇게 일상의 장면 하나로 개념을 붙잡아 두면 오래 기억에 남아요.${connection}

@@takeaway
${title.replace(/[?？]$/, '')}의 핵심은, 낯선 개념도 일상의 장면 하나와 연결하면 이해할 수 있다는 것입니다.

@@points
- 한 Drop에는 핵심 개념 하나
- 전문용어는 처음 나올 때 풀어 설명
- 일상 장면 하나로 개념을 붙잡기`;
}

export class MockGenerator implements Generator {
  readonly name = 'mock' as const;
  private batches = new Map<string, BatchItem[]>();

  async checkTopic(input: string) {
    await sleep(300);
    if (scenario('max_tokens')) throw new Error('max_tokens');
    const q = input.trim();
    const usage = { ...zeroUsage(), inputTokens: 600, outputTokens: 120 };
    // 분류기 거절(stop_reason refusal)은 실제처럼 blocked로 돌려준다
    if (scenario('refusal') || BLOCKED.some(b => q.includes(b))) {
      return {
        model: 'haiku' as const,
        usage,
        result: {
          status: 'blocked' as const,
          topic: q,
          category: '라이프스타일',
          taskType: 'hobby' as const,
          suggestions: scenario('refusal') ? [] : ['행동경제학', '로마 역사', '와인'],
          message: scenario('refusal')
            ? '이 주제는 미니커버리에서 다루지 않아요.'
            : '이 주제는 미니커버리에서 다루지 않아요. 대신 이런 주제는 어떠세요?',
        },
      };
    }
    if (BROAD.includes(q)) {
      return {
        model: 'haiku' as const,
        usage,
        result: {
          status: 'broad' as const,
          topic: q,
          category: '과학',
          taskType: 'hobby' as const,
          suggestions: [`${q}의 큰 흐름`, `${q} 속 오해와 진실`, `일상 속 ${q}`],
        },
      };
    }
    return {
      model: 'haiku' as const,
      usage,
      result: { status: 'ok' as const, topic: q, category: '심리·행동', taskType: 'hobby' as const, suggestions: [] },
    };
  }

  async curriculum(params: Parameters<Generator['curriculum']>[0], on: Parameters<Generator['curriculum']>[1]) {
    const count = params.isFirstCourse ? 6 : 8;
    const title = `${params.topic} ${params.level === 'advanced' ? '핵심 원리' : '입문'}`;
    const drops = Array.from({ length: count }, (_, i) =>
      i === 0 && params.level !== 'advanced'
        ? `${params.topic}이란 무엇일까?`
        : `${params.topic} 이야기 ${i + 1}: 왜 그럴까?`,
    );
    await sleep(600);
    on.title?.(title);
    for (const [i, d] of drops.entries()) {
      await sleep(250);
      on.drop?.(d, i);
    }
    // 제목을 다 흘려보낸 뒤 실패해야 실제 타이밍과 같다
    if (scenario('refusal')) throw new Error('refusal');
    if (scenario('max_tokens')) throw new Error('max_tokens');
    return {
      model: 'opus' as const,
      usage: { ...zeroUsage(), inputTokens: 1500, cacheReadTokens: 3000, outputTokens: 1100 },
      result: { title, drops, related: [`${params.topic} 심화`, `${params.topic}과 일상`] },
    };
  }

  async drop(params: Parameters<Generator['drop']>[0], on: Parameters<Generator['drop']>[1]) {
    on.status?.('자료를 찾고 있어요');
    await sleep(delay() ? 1200 : 0);
    const text = fakeDrop(params.courseTitle, params.outline[params.index] ?? '', params.index, params.learnedTitles);
    const usage = { inputTokens: 6800, outputTokens: 2800, cacheReadTokens: 3000, cacheWriteTokens: 0, searches: 1 };
    const sources = scenario('no_sources')
      ? []
      : [
          {
            url: 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(params.courseTitle),
            title: `${params.courseTitle} - 위키백과`,
          },
          { url: 'https://example.com/mock-source', title: '(가짜 응답) 예시 출처' },
        ];
    const evidence = scenario('no_sources') ? [] : ['(가짜 응답) 근거 문장'];
    if (scenario('refusal')) {
      return { model: params.model, usage, result: { text: '', refused: true, sources: [], evidence: [] } };
    }
    if (scenario('max_tokens')) {
      // 중간까지 흘려보낸 뒤 잘린 것으로 표시한다. text를 비워 발행 검사에 걸리게 하는 것도 실제와 같다
      await streamText(text.slice(0, Math.floor(text.length * 0.6)), on.text);
      return { model: params.model, usage, result: { text: '', refused: false, truncated: true, sources, evidence } };
    }
    await streamText(text, on.text);
    return { model: params.model, usage, result: { text, refused: false, sources, evidence } };
  }

  async verify() {
    await sleep(400);
    if (scenario('refusal')) throw new Error('refusal');
    if (scenario('max_tokens')) throw new Error('max_tokens');
    const usage = { ...zeroUsage(), inputTokens: 3500, outputTokens: 600 };
    if (scenario('conflict'))
      return { model: 'haiku' as const, usage, result: { verdict: 'conflict' as const, fixedText: '' } };
    return { model: 'haiku' as const, usage, result: { verdict: 'ok' as const, fixedText: '' } };
  }

  async easy(params: { courseTitle: string; title: string; text: string }) {
    await sleep(delay() ? 900 : 0);
    if (scenario('refusal')) throw new Error('refusal');
    if (scenario('max_tokens')) throw new Error('max_tokens');
    return {
      model: 'sonnet' as const,
      usage: { ...zeroUsage(), inputTokens: 2400, outputTokens: 700 },
      result: {
        lead: `쉽게 말하면, "${params.title.replace(/[?？]$/, '')}"는 우리가 매일 겪는 마음의 습관 이야기예요.`,
        daily:
          '(가짜 응답) 길에서 만 원을 주웠다가 집에 오는 길에 다시 잃어버렸다고 해 볼게요. 결과만 보면 처음과 같은데, 기분은 오히려 나빠요.',
        so: '(가짜 응답) 그래서 사람들은 손해를 볼까 봐 새로운 걸 망설이고, 이미 가진 걸 놓치기 싫어해요.',
        takeaway: '낯선 개념도 일상의 장면 하나와 연결하면 이해할 수 있어요.',
      },
    };
  }

  async submitBatch(items: BatchItem[]) {
    const id = `mock-${Date.now()}`;
    this.batches.set(id, items);
    return id;
  }

  async pollBatch(batchId: string): Promise<BatchPoll> {
    // 아직 처리 중인 배치를 흉내 낸다 (시나리오를 빼면 다음 수거 때 끝난다)
    if (scenario('batch_pending')) return { status: 'processing' };
    const items = this.batches.get(batchId) ?? [];
    const results: { customId: string; output?: Metered<DropOutput>; error?: string }[] = [];
    instant = true;
    try {
      for (const item of items) {
        const output = await this.drop(item.params, {});
        // 실제 pollBatch처럼 거절·잘림은 본문 없이 error로 돌려준다
        if (output.result.refused) results.push({ customId: item.customId, error: 'refusal' });
        else if (output.result.truncated) results.push({ customId: item.customId, error: 'max_tokens' });
        else results.push({ customId: item.customId, output });
      }
    } finally {
      instant = false;
    }
    this.batches.delete(batchId);
    return { status: 'ended', results };
  }
}
