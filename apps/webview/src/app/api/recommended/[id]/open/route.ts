import { recordRecommendOpen } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 추천 코스 미리보기를 열었음 (인기순 정렬용) */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  await recordRecommendOpen(user, params.id);
  return Response.json({ ok: true });
}
