import { isAdminRequest } from '@/lib/auth';
import { setFeatured } from '@/lib/learning';

/** 어드민: 추천을 켠 완주 코스 중 추천 코스로 보여 줄 것 고르기. 쿠키(mc_admin) 또는 x-admin-token 헤더로 확인 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return new Response('not found', { status: 404 });
  const { courseId, on } = (await request.json().catch(() => ({}))) as { courseId?: string; on?: boolean };
  if (!courseId) return Response.json({ error: 'invalid' }, { status: 400 });
  return Response.json({ ok: await setFeatured(courseId, Boolean(on)) });
}
