import { copyRecommended } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 다른 사람이 만든 추천 코스 받기. 새 코스 한도를 그대로 쓴다 */
export async function POST(request: Request) {
  const { sourceId, replace } = (await request.json()) as { sourceId: string; replace?: boolean };
  const result = await copyRecommended(await currentUser(), sourceId, Boolean(replace));
  if (!result.ok) return Response.json({ reason: result.reason }, { status: result.reason === 'missing' ? 404 : 402 });
  return Response.json(result);
}
