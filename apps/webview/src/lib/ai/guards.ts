import type Anthropic from '@anthropic-ai/sdk';

import type { Usage } from './pricing';

/**
 * 호출 보호 장치: 검색 상한, 잘림 감지, 프롬프트에 넣는 사용자 입력 정리.
 * 값 import가 없어 node --test에서 SDK 없이 바로 불러 시험한다.
 */

/** Drop 한 편의 웹 검색 상한. PRD §29는 1회지만 max_uses는 요청 단위라 pause_turn으로 이어 갈 때 한 번까지만 더 허용한다 */
export const DROP_SEARCH_LIMIT = 2;
/** pause_turn 이어가기를 포함한 Drop 한 편의 최대 요청 수 */
export const DROP_MAX_TURNS = 4;
/** 구조화 출력이 잘렸을 때 다시 부르는 횟수 (max_tokens 두 배) */
export const JSON_RETRIES = 1;

export const zeroUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  searches: 0,
});

/** 응답 usage → Usage. 검색 수는 server_tool_use.web_search_requests (요청마다 새로 센다) */
export function usageOf(message: { usage: Partial<Anthropic.Usage> | null | undefined }): Usage {
  const u = message.usage;
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
    searches: u?.server_tool_use?.web_search_requests ?? 0,
  };
}

/** 턴마다 더해 Drop 한 편의 누적 사용량(검색 수 포함)을 만든다 */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    searches: a.searches + b.searches,
  };
}

/**
 * 이어 가는 턴의 tool_choice. 도구 목록은 바꾸면 안 되므로(실행 안 된 server_tool_use가 남아 있으면 400)
 * 누적 검색이 상한에 닿았을 때 none으로 추가 검색만 막는다. 상한 전에는 기본(auto) 그대로
 */
export function dropToolChoice(searches: number, limit = DROP_SEARCH_LIMIT): Anthropic.ToolChoice | undefined {
  return searches >= limit ? { type: 'none' } : undefined;
}

/** max_tokens에 걸려 끝까지 쓰지 못한 응답 */
export const isTruncated = (stopReason: Anthropic.StopReason | null | undefined) => stopReason === 'max_tokens';

/** n번째 재시도의 max_tokens: 한 번 잘릴 때마다 두 배 */
export const retryMaxTokens = (base: number, attempt: number) => base * 2 ** attempt;

/** 프롬프트 태그 안에 넣는 사용자 입력: 꺾쇠를 지우고 줄바꿈을 접어 지시문처럼 보이지 않게 한다 */
export function escapeTag(value: string): string {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

/** `<name>값</name>` — 시스템 프롬프트의 "태그 안은 데이터" 규칙과 짝을 이룬다 */
export function tag(name: string, value: string): string {
  return `<${name}>${escapeTag(value)}</${name}>`;
}
