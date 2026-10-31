import { setFeatured } from '@/lib/learning';

/** 어드민: 추천을 켠 완주 코스 중 추천 코스로 보여 줄 것 고르기 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return new Response('not found', { status: 404 });
  const { courseId, on } = (await request.json()) as { courseId: string; on: boolean };
  return Response.json({ ok: await setFeatured(courseId, Boolean(on)) });
}
