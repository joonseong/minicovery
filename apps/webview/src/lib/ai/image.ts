import { createHash } from 'node:crypto';

import type { Drop } from '../types';

/**
 * Drop 그림 (OpenAI Images API). 흰 배경 두들 그림 한 장: 검은 펜 선 + 분야 색 하나, 글자 없음.
 * 환경 변수: OPENAI_API_KEY(비우면 그림을 만들지 않는다), OPENAI_IMAGE_MODEL(기본 gpt-image-2.5-flare)
 */

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';
/** GPT Image 2.5 정가 (USD / 1M tokens, 2026-11): 글 입력 5, 그림 출력 30 */
const PRICE = { textIn: 5, imageOut: 30 };
export const IMAGE_SIZE = { width: 1536, height: 1024 };

export const imageEnabled = () => Boolean(process.env.OPENAI_API_KEY);

/** 이 시간 안에 시도한 그림은 다른 호출이 만드는 중으로 보고 건너뛴다 */
const IMAGE_RETRY_MS = 15 * 60_000;
const IMAGE_MAX_TRIES = 3;

/** 그림을 (다시) 그려도 되는 Drop인지: 아직 없고, 만드는 중이 아니고, 세 번 넘게 실패하지 않았다 */
export function imageRetryable(drop: Pick<Drop, 'image'>, now = Date.now()) {
  if (!drop.image) return true;
  if (drop.image.url) return false;
  return drop.image.tries < IMAGE_MAX_TRIES && now - Date.parse(drop.image.at) > IMAGE_RETRY_MS;
}

export interface AccentColor {
  hex: string;
  /** 모델이 알아듣는 색 이름 (hex만 주면 가끔 다른 색을 쓴다) */
  name: string;
}

/** 참고한 그림은 다른 작가 것이라 넣지 않고 말로만 스타일을 정한다 (캔버스 'Drop 그림 시안'과 같은 지시) */
export function dropImagePrompt(title: string, point: string, color: AccentColor) {
  return [
    'Minimal hand-drawn doodle illustration on a plain pure white background.',
    'Loose, confident black ink line art with slightly uneven pen strokes, like a quick editorial sketch.',
    `Use exactly one accent color, ${color.name} (${color.hex}), as a flat fill on one or two shapes. Everything else is black line work on white;`,
    'no other colors at all - draw things that usually have another color (wine, sky, leaves) in black line work or in the accent color.',
    'A small area of fine halftone dots is fine. Generous white space: the drawing sits in the middle and fills about 60 percent of the canvas.',
    'Simple stylized people with tiny dot eyes or no facial detail; warm, witty mood.',
    'No text, no letters, no numbers, no logos, no captions, no frame, no border, no shadows, no gradients, no scenery behind the subject.',
    '',
    'Draw one simple scene that captures the core idea of this short lesson so a reader gets it at a glance.',
    `Lesson title: ${title}`,
    `Key point: ${point}`,
    'Keep it to one main subject and at most two supporting objects.',
  ].join('\n');
}

export interface DrawnImage {
  bytes: Uint8Array;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface ImagesResponse {
  data?: { b64_json?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { text_tokens?: number } };
}

/** 1536×1024 webp 한 장. 429·5xx는 한 번 더 시도하고, 그 밖의 실패(검열 등)는 바로 던진다 */
export async function drawDropImage(input: { title: string; point: string; color: AccentColor; userId: string }): Promise<DrawnImage> {
  const body = JSON.stringify({
    model: MODEL,
    prompt: dropImagePrompt(input.title, input.point, input.color),
    size: `${IMAGE_SIZE.width}x${IMAGE_SIZE.height}`,
    quality: 'medium',
    background: 'opaque',
    output_format: 'webp',
    output_compression: 85,
    n: 1,
    // 사용자 id는 그대로 보내지 않는다
    safety_identifier: createHash('sha256').update(input.userId).digest('hex').slice(0, 32),
  });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) {
      const json = (await res.json()) as ImagesResponse;
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new Error('image: empty response');
      const inputTokens = json.usage?.input_tokens_details?.text_tokens ?? json.usage?.input_tokens ?? 0;
      const outputTokens = json.usage?.output_tokens ?? 0;
      return {
        bytes: new Uint8Array(Buffer.from(b64, 'base64')),
        inputTokens,
        outputTokens,
        costUsd: (inputTokens * PRICE.textIn + outputTokens * PRICE.imageOut) / 1_000_000,
      };
    }
    const detail = (await res.text()).slice(0, 300);
    if (attempt >= 1 || !(res.status === 429 || res.status >= 500)) throw new Error(`image ${res.status}: ${detail}`);
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
}
