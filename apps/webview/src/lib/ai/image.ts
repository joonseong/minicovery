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

/** 다 그린 그림을 Claude로 한 번 더 확인할지 (손·팔 개수, 글자, 작품 캐릭터). 2026-11-07부터 꺼 둠, 환경 변수 IMAGE_CHECK=on 이면 켠다 */
export const imageCheckEnabled = () => process.env.IMAGE_CHECK === 'on';

/** 시작한 지 이 시간이 지나도 끝나지 않은 그림은 멈춘 것으로 본다 */
const IMAGE_STALE_MS = 15 * 60_000;
/** 한 번 시도 = 그리기·검사 최대 두 번. 두 번 시도해도 안 되면 그 Drop은 그림 없이 둔다 */
const IMAGE_MAX_TRIES = 2;

/** 다른 호출이 지금 그리고 있는지 */
export function imageInProgress(drop: Pick<Drop, 'image'>, now = Date.now()) {
  const image = drop.image;
  return Boolean(image && !image.url && !image.failed && now - Date.parse(image.at) < IMAGE_STALE_MS);
}

/** 그림을 (다시) 그려도 되는 Drop인지: 아직 없고, 그리는 중이 아니고, 시도 횟수가 남았다 */
export function imageRetryable(drop: Pick<Drop, 'image'>, now = Date.now()) {
  if (!drop.image) return true;
  if (drop.image.url) return false;
  return drop.image.tries < IMAGE_MAX_TRIES && !imageInProgress(drop, now);
}

/** 기존 작품(만화·애니·게임·영화·소설)을 다루는 분야: 그림에 캐릭터 대신 사람·물건만 */
const WORK_CATEGORIES = new Set(['영화·대중문화', '문학']);
export const isWorkCategory = (category?: string) => WORK_CATEGORIES.has(category ?? '');

export interface AccentColor {
  hex: string;
  /** 모델이 알아듣는 색 이름 (hex만 주면 가끔 다른 색을 쓴다) */
  name: string;
}

/**
 * 참고한 그림은 다른 작가 것이라 넣지 않고 말로만 스타일을 정한다 (캔버스 'Drop 그림 시안'과 같은 지시).
 * point(정리 한 줄)는 글이 끝난 뒤에만 있다 — 글과 동시에 그릴 때는 제목과 코스 이름으로 그린다.
 * simpler: 검사에 걸려 다시 그릴 때 사람·손을 줄인다
 * category: 대중문화·문학 코스는 작품 이야기라 캐릭터를 닮게 그리기 쉽다 → 사람과 물건만 그린다.
 * scene: 그런 코스는 제목에 작품·캐릭터 이름이 있으면 그림 모델이 금지해도 그대로 그려서,
 *   이름 없이 바꾼 장면(imageScene)만 보내고 제목·코스 이름은 보내지 않는다
 */
export function dropImagePrompt(input: {
  title: string;
  point?: string;
  course?: string;
  category?: string;
  scene?: string;
  color: AccentColor;
  simpler?: boolean;
}) {
  const { color } = input;
  const aboutWork = isWorkCategory(input.category);
  const style = [
    'Minimal hand-drawn doodle illustration on a plain pure white background.',
    'Loose, confident black ink line art with slightly uneven pen strokes, like a quick editorial sketch.',
    `Use exactly one accent color, ${color.name} (${color.hex}), as a flat fill on one or two shapes. Everything else is black line work on white;`,
    'no other colors at all - draw things that usually have another color (wine, sky, leaves) in black line work or in the accent color.',
    'A small area of fine halftone dots is fine. Generous white space: the drawing sits in the middle and fills about 60 percent of the canvas.',
    'Simple stylized people with tiny dot eyes or no facial detail; warm, witty mood.',
    "Anatomy must be correct: draw at most two people; each person has exactly two arms and two hands, and every hand is clearly attached to one of that person's arms.",
    'Never draw a third hand or arm, a floating hand, or extra fingers. If an idea would need more hands, simplify the pose (for example one hand on the chin and the other resting) or show an object on its own instead.',
    input.simpler ? 'Keep this one extra simple: at most one person with both hands clearly visible, or only objects with no people.' : '',
    'No text, no letters, no numbers, no logos, no captions, no frame, no border, no shadows, no gradients, no scenery behind the subject.',
    'Never draw existing characters, mascots or brand logos from comics, anime, games, films or companies, or anything that resembles them, even if the lesson is about them; use original generic figures or objects instead.',
    aboutWork
      ? "This lesson is about an existing creative work. Draw only ordinary people and everyday objects (for example a person reading a comic book or a phone, a stack of books with blank covers, a speech bubble, a heart, a globe). Do not draw any animals, creatures, mascots or cartoon characters, and nothing that looks like the work's characters."
      : '',
  ];
  const scene = input.scene
    ? ['Draw this one simple scene:', input.scene, 'Keep it to one main subject and at most two supporting objects.']
    : [
        'Draw one simple scene that captures the core idea of this short lesson so a reader gets it at a glance.',
        input.course ? `Course: ${input.course}` : '',
        `Lesson title: ${input.title}`,
        input.point ? `Key point: ${input.point}` : '',
        'Keep it to one main subject and at most two supporting objects.',
      ];
  return [...style.filter(Boolean), '', ...scene.filter(Boolean)].join('\n');
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
export async function drawDropImage(
  input: { title: string; point?: string; course?: string; category?: string; scene?: string; color: AccentColor; simpler?: boolean; userId: string },
): Promise<DrawnImage> {
  const body = JSON.stringify({
    model: MODEL,
    prompt: dropImagePrompt(input),
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
