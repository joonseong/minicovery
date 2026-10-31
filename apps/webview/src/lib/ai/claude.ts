import Anthropic from '@anthropic-ai/sdk';

import type { Source } from '../types';
import {
  DROP_MAX_TURNS,
  JSON_RETRIES,
  addUsage,
  dropToolChoice,
  isTruncated,
  retryMaxTokens,
  usageOf,
  zeroUsage,
} from './guards';
import { MODEL_ID } from './pricing';
import {
  CURRICULUM_SYSTEM,
  DROP_SYSTEM,
  EASY_SCHEMA,
  EASY_SYSTEM,
  TOPIC_CHECK_SCHEMA,
  TOPIC_CHECK_SYSTEM,
  VERIFY_SCHEMA,
  VERIFY_SYSTEM,
  curriculumSchema,
  curriculumUserPrompt,
  dropUserPrompt,
  easyUserPrompt,
  topicCheckUserPrompt,
  verifyUserPrompt,
} from './prompts';
import type { BatchItem, BatchPoll, DropOutput, DropParams, Generator, Metered } from './types';

// 서버 도구 블록(web_search_tool_result 등)은 SDK 유니언이 넓어 필요한 필드만 any로 읽는다

const WEB_SEARCH_TOOL = {
  type: 'web_search_20260209' as const,
  name: 'web_search' as const,
  // 요청 단위 상한. Drop 전체 상한(DROP_SEARCH_LIMIT)은 drop()이 pause_turn 턴마다 tool_choice로 지킨다
  max_uses: 1,
  user_location: { type: 'approximate' as const, country: 'KR', timezone: 'Asia/Seoul' },
};

/**
 * 5.5 모델은 thinking이 항상 켜져 있고 그 토큰도 max_tokens에 들어간다.
 * 가벼운 단계(check·verify·easy)는 effort low로 생각을 짧게 하고, 잘리면 한 번 두 배로 다시 부른다
 */
const MAX_TOKENS = { check: 2000, curriculum: 4000, drop: 8000, verify: 6000, easy: 4000 } as const;

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
}

/** 출처는 웹 검색 결과로 받은 URL만 쓴다 (PRD §14.2). 인용된 URL을 먼저, 그다음 검색 결과 순 */
function collectSources(message: Anthropic.Message, into: { sources: Source[]; evidence: string[] }) {
  const cited: Source[] = [];
  const results: Source[] = [];
  for (const block of message.content as any[]) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.url) results.push({ url: r.url, title: r.title ?? r.url });
    }
    if (block.type === 'text' && Array.isArray(block.citations)) {
      for (const c of block.citations) {
        if (c.url) cited.push({ url: c.url, title: c.title ?? c.url });
        if (c.cited_text) into.evidence.push(c.cited_text);
      }
    }
  }
  const seen = new Set(into.sources.map(s => s.url));
  for (const s of [...cited, ...results]) {
    if (!seen.has(s.url)) {
      seen.add(s.url);
      into.sources.push(s);
    }
  }
}

/** 도구 목록은 턴마다 같아야 한다(pause_turn 이어가기 규칙·캐시). 검색을 막을 때는 tool_choice만 바꾼다 */
function dropRequest(params: DropParams, messages: Anthropic.MessageParam[], toolChoice?: Anthropic.ToolChoice) {
  return {
    model: MODEL_ID[params.model],
    max_tokens: MAX_TOKENS.drop,
    system: [{ type: 'text' as const, text: DROP_SYSTEM, cache_control: { type: 'ephemeral' as const } }],
    tools: [WEB_SEARCH_TOOL],
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    output_config: { effort: 'medium' as const },
    messages,
  };
}

/** 스트리밍 중인 커리큘럼 JSON에서 완성된 Drop 제목만 꺼낸다 */
function completedStrings(json: string, key: string): string[] {
  const start = json.indexOf(`"${key}"`);
  if (start < 0) return [];
  const open = json.indexOf('[', start);
  if (open < 0) return [];
  const close = json.indexOf(']', open);
  const segment = json.slice(open + 1, close < 0 ? undefined : close);
  return [...segment.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => JSON.parse(`"${m[1]}"`));
}

export class ClaudeGenerator implements Generator {
  readonly name = 'claude' as const;
  private client = new Anthropic();

  /** 구조화 출력 호출. max_tokens로 잘린 JSON은 파싱하지 않고 한 번 두 배로 다시 부른다. 그래도 잘리면 호출자의 재시도·실패 경로로 */
  private async createJson(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    for (let attempt = 0; ; attempt++) {
      const message = await this.client.messages.create({
        ...params,
        max_tokens: retryMaxTokens(params.max_tokens, attempt),
      });
      if (!isTruncated(message.stop_reason)) return message;
      if (attempt >= JSON_RETRIES) throw new Error('max_tokens');
    }
  }

  async checkTopic(input: string) {
    const message = await this.createJson({
      model: MODEL_ID.haiku,
      max_tokens: MAX_TOKENS.check,
      system: TOPIC_CHECK_SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: TOPIC_CHECK_SCHEMA } },
      messages: [{ role: 'user', content: topicCheckUserPrompt(input) }],
    });
    const usage = usageOf(message);
    if (message.stop_reason === 'refusal') {
      return {
        model: 'haiku' as const,
        usage,
        result: {
          status: 'blocked' as const,
          topic: input,
          category: '라이프스타일',
          taskType: 'hobby' as const,
          suggestions: [],
          message: '이 주제는 미니커버리에서 다루지 않아요.',
        },
      };
    }
    const r = JSON.parse(textOf(message));
    return {
      model: 'haiku' as const,
      usage,
      result: {
        status: r.status,
        topic: r.topic,
        category: r.category,
        taskType: r.task_type,
        suggestions: r.suggestions,
        message: r.message || undefined,
      },
    };
  }

  async curriculum(params: Parameters<Generator['curriculum']>[0], on: Parameters<Generator['curriculum']>[1]) {
    const range = params.isFirstCourse ? { min: 5, max: 7 } : { min: 5, max: 14 };
    // 잘리면 한 번 두 배로 다시 만든다. 제목 이벤트도 처음부터 다시 보낸다
    for (let attempt = 0; ; attempt++) {
      const stream = this.client.messages.stream({
        model: MODEL_ID.opus,
        max_tokens: retryMaxTokens(MAX_TOKENS.curriculum, attempt),
        system: [{ type: 'text', text: CURRICULUM_SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: curriculumSchema() } },
        messages: [{ role: 'user', content: curriculumUserPrompt(params) }],
      });

      let json = '';
      let titleSent = false;
      let dropsSent = 0;
      for await (const event of stream) {
        if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue;
        json += event.delta.text;
        if (!titleSent) {
          const m = json.match(/"course_title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (m) {
            titleSent = true;
            on.title?.(JSON.parse(`"${m[1]}"`));
          }
        }
        const titles = completedStrings(json, 'drop_titles');
        while (dropsSent < titles.length) {
          on.drop?.(titles[dropsSent]!, dropsSent);
          dropsSent++;
        }
      }
      const message = await stream.finalMessage();
      if (message.stop_reason === 'refusal') throw new Error('refusal');
      if (isTruncated(message.stop_reason)) {
        if (attempt >= JSON_RETRIES) throw new Error('max_tokens');
        continue;
      }
      const r = JSON.parse(textOf(message));
      const drops = (r.drop_titles as string[]).filter(Boolean).slice(0, range.max);
      if (drops.length < range.min) throw new Error(`too few drops: ${drops.length}`);
      return {
        model: 'opus' as const,
        usage: usageOf(message),
        result: { title: r.course_title, drops, related: (r.related_topics as string[]).filter(Boolean).slice(0, 2) },
      };
    }
  }

  async drop(params: DropParams, on: Parameters<Generator['drop']>[1]): Promise<Metered<DropOutput>> {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: dropUserPrompt(params) }];
    const out: DropOutput = { text: '', sources: [], evidence: [], refused: false };
    let usage = zeroUsage();
    let stop: Anthropic.StopReason | null = null;

    // 서버 도구가 오래 걸리면 pause_turn으로 멈출 수 있어 이어서 요청한다. 누적 검색이 상한이면 다음 턴은 검색 없이
    for (let turn = 0; turn < DROP_MAX_TURNS; turn++) {
      const stream = this.client.messages.stream(dropRequest(params, messages, dropToolChoice(usage.searches)));
      for await (const event of stream) {
        if (event.type === 'content_block_start' && (event.content_block as any).type === 'server_tool_use') {
          on.status?.('자료를 찾고 있어요');
        }
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          out.text += event.delta.text;
          on.text?.(event.delta.text);
        }
      }
      const message = await stream.finalMessage();
      usage = addUsage(usage, usageOf(message));
      collectSources(message, out);
      stop = message.stop_reason;
      if (stop !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: message.content });
    }
    if (stop === 'refusal') out.refused = true;
    // max_tokens로 잘렸거나 이어가기 한도 안에 끝나지 않은 본문은 발행하지 않는다: text를 비워 isCompleteBody에 걸리게 한다
    else if (isTruncated(stop) || stop === 'pause_turn') {
      out.truncated = true;
      out.text = '';
    }
    return { model: params.model, usage, result: out };
  }

  async verify(text: string, evidence: string[]) {
    const message = await this.createJson({
      model: MODEL_ID.haiku,
      max_tokens: MAX_TOKENS.verify,
      system: VERIFY_SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: VERIFY_SCHEMA } },
      messages: [{ role: 'user', content: verifyUserPrompt({ text, evidence }) }],
    });
    if (message.stop_reason === 'refusal') throw new Error('refusal');
    const r = JSON.parse(textOf(message));
    return {
      model: 'haiku' as const,
      usage: usageOf(message),
      result: { verdict: r.verdict, fixedText: r.fixed_text },
    };
  }

  async easy(params: { courseTitle: string; title: string; text: string }) {
    const message = await this.createJson({
      model: MODEL_ID.sonnet,
      max_tokens: MAX_TOKENS.easy,
      system: [{ type: 'text', text: EASY_SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: EASY_SCHEMA } },
      messages: [{ role: 'user', content: easyUserPrompt(params) }],
    });
    if (message.stop_reason === 'refusal') throw new Error('refusal');
    const r = JSON.parse(textOf(message));
    return {
      model: 'sonnet' as const,
      usage: usageOf(message),
      result: { lead: r.lead, daily: r.daily, so: r.so, takeaway: r.takeaway },
    };
  }

  async submitBatch(items: BatchItem[]) {
    const batch = await this.client.messages.batches.create({
      requests: items.map(item => ({
        custom_id: item.customId,
        params: dropRequest(item.params, [{ role: 'user', content: dropUserPrompt(item.params) }]),
      })),
    });
    return batch.id;
  }

  async pollBatch(batchId: string): Promise<BatchPoll> {
    const batch = await this.client.messages.batches.retrieve(batchId);
    if (batch.processing_status !== 'ended') return { status: 'processing' };
    const results: { customId: string; output?: Metered<DropOutput>; error?: string }[] = [];
    for await (const r of await this.client.messages.batches.results(batchId)) {
      if (r.result.type !== 'succeeded') {
        results.push({ customId: r.custom_id, error: r.result.type });
        continue;
      }
      const message = r.result.message;
      // 멈춤·거절·잘림은 본문 없이 error로 돌려 호출자가 pending으로 되돌리게 한다
      if (
        message.stop_reason === 'pause_turn' ||
        message.stop_reason === 'refusal' ||
        isTruncated(message.stop_reason)
      ) {
        results.push({ customId: r.custom_id, error: message.stop_reason ?? 'unknown' });
        continue;
      }
      const out = { text: textOf(message), sources: [] as Source[], evidence: [] as string[], refused: false };
      collectSources(message, out);
      // 모델 종류는 호출하는 쪽이 아는 값으로 덮어쓴다
      results.push({ customId: r.custom_id, output: { model: 'opus', usage: usageOf(message), result: out } });
    }
    return { status: 'ended', results };
  }
}
