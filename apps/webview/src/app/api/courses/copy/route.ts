import { copyRecommended } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 다른 사람이 만든 추천 코스 받기. 새 코스 한도를 그대로 쓴다. 이미 받은 코스면 409 { reason: 'already', courseId } */
export async function POST(request: Request) {
  const { sourceId, replace } = (await request.json().catch(() => ({}))) as { sourceId?: string; replace?: boolean };
  if (!sourceId) return Response.json({ error: 'invalid' }, { status: 400 });
  const result = await copyRecommended(await currentUser(), sourceId, Boolean(replace));
  if (!result.ok) {
    const status = result.reason === 'missing' ? 404 : result.reason === 'already' ? 409 : 402;
    return Response.json(result, { status });
  }
  return Response.json(result);
}
