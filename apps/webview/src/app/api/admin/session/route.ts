import { cookies } from 'next/headers';

import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, adminTokenOk } from '@/lib/auth';

/**
 * /admin?token=… 으로 들어오면 어드민 페이지가 여기로 보낸다: 토큰이 맞으면 httpOnly 쿠키를 심고 /admin으로 돌려보낸다.
 * (서버 컴포넌트는 쿠키를 쓸 수 없어서 라우트가 대신 심는다.) 토큰이 없거나 틀리면 404
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!adminTokenOk(token)) return new Response('not found', { status: 404 });
  cookies().set(ADMIN_COOKIE, token!, ADMIN_COOKIE_OPTIONS);
  return Response.redirect(new URL('/admin', url.origin), 303);
}
